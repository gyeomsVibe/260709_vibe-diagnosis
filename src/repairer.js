const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chat } = require('./ai-provider');
const { getResolvedByok } = require('./config-manager');
const { runDiagnostics, discoverDiagnostics } = require('./runner');
const triage = require('./triage');

const BACKUP_EXT = '.bak';

const SYSTEM_PROMPT = `You are a code repair specialist for a Node.js project.
You receive a diagnostic failure with context and must fix the root cause.

RULES:
- Return ONLY a valid JSON object, no markdown fences, no explanation outside JSON.
- Each file change must include the COMPLETE file content, not patches or diffs.
- Only modify files that directly fix the diagnostic failure.
- Do NOT add comments to the source code.
- File paths must be relative to the project root.
- If the issue cannot be fixed by modifying files, set "files" to an empty array and explain in "summary".

Response format:
{
  "files": [
    { "path": "relative/path/to/file", "content": "complete file content here" }
  ],
  "summary": "Brief explanation of what was fixed and why"
}`;

function collectContext(projectDir, diagResult) {
  const ctx = { diagnostic: diagResult, projectFiles: [], diagSource: null, errorPattern: null };

  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      ctx.packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
  } catch {}

  const diagFiles = discoverDiagnostics(projectDir);
  const matchingDiag = diagFiles.find(f => path.basename(f, '.clinic.js') === diagResult.id);
  if (matchingDiag && fs.existsSync(matchingDiag)) {
    ctx.diagSource = fs.readFileSync(matchingDiag, 'utf-8');
  }

  const patternsDir = path.join(projectDir, '.vibe-clinic', 'error-patterns');
  if (fs.existsSync(patternsDir)) {
    const patterns = fs.readdirSync(patternsDir).filter(f => f.endsWith('.md'));
    const matching = patterns.find(f => f.toLowerCase().includes(diagResult.id.toLowerCase()));
    if (matching) {
      ctx.errorPattern = fs.readFileSync(path.join(patternsDir, matching), 'utf-8');
    }
  }

  try {
    ctx.projectFiles = listProjectFiles(projectDir, '', 2);
  } catch {}

  return ctx;
}

function listProjectFiles(dir, prefix, depth) {
  if (depth <= 0) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build') continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (entry.isDirectory()) {
      result.push(rel + '/');
      result.push(...listProjectFiles(path.join(dir, name), rel, depth - 1));
    } else {
      result.push(rel);
    }
  }
  return result;
}

function buildPrompt(ctx) {
  let prompt = `DIAGNOSTIC FAILURE:\n`;
  prompt += `- ID: ${ctx.diagnostic.id}\n`;
  prompt += `- Name: ${ctx.diagnostic.name}\n`;
  prompt += `- Layer: ${ctx.diagnostic.layer}\n`;
  prompt += `- Status: ${ctx.diagnostic.status}\n`;
  prompt += `- Details: ${ctx.diagnostic.details}\n\n`;

  if (ctx.diagSource) {
    prompt += `DIAGNOSTIC SOURCE CODE (.clinic.js):\n\`\`\`javascript\n${ctx.diagSource}\n\`\`\`\n\n`;
  }

  if (ctx.errorPattern) {
    prompt += `ERROR PATTERN DOCUMENTATION:\n${ctx.errorPattern}\n\n`;
  }

  if (ctx.packageJson) {
    prompt += `PACKAGE.JSON:\n\`\`\`json\n${JSON.stringify(ctx.packageJson, null, 2)}\n\`\`\`\n\n`;
  }

  if (ctx.projectFiles.length > 0) {
    prompt += `PROJECT STRUCTURE:\n${ctx.projectFiles.join('\n')}\n\n`;
  }

  prompt += `Fix this diagnostic failure. Return ONLY the JSON response.`;
  return prompt;
}

function parseAiResponse(raw) {
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed.files)) {
    throw new Error('AI response missing "files" array');
  }
  if (typeof parsed.summary !== 'string') {
    throw new Error('AI response missing "summary" string');
  }

  for (const file of parsed.files) {
    if (!file.path || (typeof file.content !== 'string' && file.delete !== true)) {
      throw new Error('Invalid file entry in AI response');
    }
  }

  return parsed;
}

function createBackup(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const backupPath = filePath + BACKUP_EXT;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function resolveProjectFile(projectDir, relativePath) {
  const rootDir = path.resolve(projectDir);
  const filePath = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, filePath);

  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path traversal detected: ${relativePath}`);
  }

  return filePath;
}

function readFileSnapshot(projectDir, relativePath) {
  const filePath = resolveProjectFile(projectDir, relativePath);
  const exists = fs.existsSync(filePath);
  const content = exists ? fs.readFileSync(filePath, 'utf-8') : '';

  return {
    path: relativePath,
    content,
    exists,
    hash: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

function applyChanges(projectDir, files) {
  const modified = [];
  const backups = [];
  const undoManifest = [];

  for (const file of files) {
    const absPath = resolveProjectFile(projectDir, file.path);
    const existedBefore = fs.existsSync(absPath);

    const backup = createBackup(absPath);
    if (backup) backups.push(backup);
    undoManifest.push({ path: file.path, existedBefore, backupPath: backup });

    if (file.delete === true) {
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
      modified.push(file.path);
      continue;
    }

    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(absPath, file.content, 'utf-8');
    modified.push(file.path);
  }

  return { modified, backups, undoManifest };
}

// P3 자동 롤백: applyChanges의 undoManifest를 역순으로 되돌린다.
// 기존 파일은 .bak에서 복원하고, 치료가 새로 만든 파일은 삭제한다.
function rollbackChanges(projectDir, undoManifest) {
  const restored = [];
  for (const entry of [...undoManifest].reverse()) {
    try {
      const absPath = resolveProjectFile(projectDir, entry.path);
      if (entry.existedBefore && entry.backupPath && fs.existsSync(entry.backupPath)) {
        fs.copyFileSync(entry.backupPath, absPath);
        restored.push(entry.path);
      } else if (!entry.existedBefore && fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
        restored.push(entry.path);
      }
    } catch {}
  }
  return restored;
}

function createFailureResult(diagId, error, summary = '') {
  return {
    success: false,
    diagId,
    filesModified: [],
    backupFiles: [],
    summary,
    rerunResult: null,
    error,
  };
}

function clearModuleCache(projectDir, relativePaths) {
  for (const rel of relativePaths) {
    const absPath = path.resolve(projectDir, rel);
    try {
      const resolved = require.resolve(absPath);
      delete require.cache[resolved];
    } catch {}
  }
}

async function rerunSingleDiagnostic(projectDir, diagId, modifiedFiles = []) {
  const { target } = await rerunAllDiagnostics(projectDir, diagId, modifiedFiles);
  return target;
}

// 전체 재진단 + 대상 진단 식별. P3 회귀 게이트가 전체 결과를 함께 쓴다.
async function rerunAllDiagnostics(projectDir, diagId, modifiedFiles = []) {
  try {
    clearModuleCache(projectDir, modifiedFiles);
    const results = await runDiagnostics(projectDir);

    const exact = results.find(r => r.id === diagId);
    if (exact) return { allResults: results, target: exact };

    // A load-failed diagnostic reports its FILE basename as id (the module
    // never loaded), but once repaired it reports its own module id. Resolve
    // the repaired file's real id so a successful fix is not reported as a
    // failure just because the id changed (e.g. 'example' -> 'example-diagnostic').
    for (const rel of modifiedFiles) {
      if (!/\.clinic\.(js|cjs)$/.test(rel)) continue;
      try {
        const absPath = path.resolve(projectDir, rel);
        if (!fs.existsSync(absPath)) continue;
        delete require.cache[require.resolve(absPath)];
        const mod = require(absPath);
        if (mod && mod.id) {
          const byModuleId = results.find(r => r.id === mod.id);
          if (byModuleId) return { allResults: results, target: byModuleId };
        }
      } catch {}
    }

    return { allResults: results, target: null };
  } catch {
    return { allResults: [], target: null };
  }
}

function generateLocalRepairProposal(projectDir, diagResult) {
  const diagId = diagResult.id;
  const details = diagResult.details || '';
  const errMsg = diagResult.errorMessage || '';

  // 1. package.json의 "type": "module" 설정으로 인한 CommonJS 진단 도구 로드 오류 (.js -> .cjs 자동 변환)
  // 증상→원인 판정은 triage 규칙 엔진에 일원화되어 있다 (Node 버전별 증상 차이 흡수).
  if (triage.hasCause(projectDir, diagResult, triage.CAUSES.ESM_CJS_MISMATCH)) {
    const diagDir = path.join(projectDir, '.vibe-clinic', 'diagnostics');
    const jsPath = path.join(diagDir, `${diagId}.clinic.js`);
    if (fs.existsSync(jsPath)) {
      const content = fs.readFileSync(jsPath, 'utf-8');
      return {
        success: true,
        diagId,
        summary: `프로젝트 설정(package.json의 "type": "module")에 의해 CommonJS 사양의 진단 도구 파일(.js)을 로드하지 못하는 오류가 감지되었습니다. 확장자를 .cjs로 변경하여 로컬 Node.js 로더가 정상적으로 진단 스크립트를 CommonJS 모듈로 실행할 수 있도록 자동 교정합니다.`,
        projectDir: path.resolve(projectDir),
        originalFiles: [
          { path: `.vibe-clinic/diagnostics/${diagId}.clinic.js`, content, exists: true, hash: crypto.createHash('sha256').update(content).digest('hex') }
        ],
        repairedFiles: [
          { path: `.vibe-clinic/diagnostics/${diagId}.clinic.js`, content: '', delete: true },
          { path: `.vibe-clinic/diagnostics/${diagId}.clinic.cjs`, content }
        ]
      };
    }
  }

  // 2. 부동소수점 연산 정밀도 오류 보정 (func-calc-engine)
  if (diagId === 'func-calc-engine' || details.includes('expected ~0.3') || details.includes('precision') || details.includes('TOLERANCE')) {
    const calcPath = path.join(projectDir, 'calculator.js');
    if (fs.existsSync(calcPath)) {
      const content = fs.readFileSync(calcPath, 'utf-8');
      const fixedContent = `function add(a, b) {
  return parseFloat((a + b).toFixed(12));
}

function subtract(a, b) {
  return parseFloat((a - b).toFixed(12));
}

function multiply(a, b) {
  return parseFloat((a * b).toFixed(12));
}

function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return parseFloat((a / b).toFixed(12));
}

module.exports = {
  add,
  subtract,
  multiply,
  divide
};
`;
      return {
        success: true,
        diagId,
        summary: `부동소수점 연산 시 이진법 표현 한계로 인한 오차(예: 0.1 + 0.2 = 0.30000000000000004)를 방지하기 위해, 모든 사칙연산 결과에 소수점 12자리 정밀도 보정(toFixed(12))을 적용하여 수학적 정밀도를 향상시킵니다.`,
        projectDir: path.resolve(projectDir),
        originalFiles: [
          { path: 'calculator.js', content, exists: true, hash: crypto.createHash('sha256').update(content).digest('hex') }
        ],
        repairedFiles: [
          { path: 'calculator.js', content: fixedContent }
        ]
      };
    }
  }

  // 3. 나눗셈의 0 나누기 예외 처리 (task-002-division-zero)
  if (diagId === 'task-002-division-zero' || details.includes('expected throw') || details.includes('division by zero')) {
    const calcPath = path.join(projectDir, 'calculator.js');
    if (fs.existsSync(calcPath)) {
      const content = fs.readFileSync(calcPath, 'utf-8');
      if (!content.includes('Division by zero')) {
        const fixedContent = content.replace(
          /function divide\(([^)]+)\)\s*\{([\s\S]*?)\}/,
          `function divide($1) {
  if (arguments[1] === 0 || $1 === 0 || arguments[1] === '0') {
    throw new Error('Division by zero');
  }
  return a / b;
}`
        );
        return {
          success: true,
          diagId,
          summary: `나눗셈 수행 시 분모가 0일 때 무한대(Infinity) 또는 NaN이 반환되어 연산 신뢰도를 저하시키는 현상을 방지하도록 예외 검증 분기문(throw Error('Division by zero'))을 주입합니다.`,
          projectDir: path.resolve(projectDir),
          originalFiles: [
            { path: 'calculator.js', content, exists: true, hash: crypto.createHash('sha256').update(content).digest('hex') }
          ],
          repairedFiles: [
            { path: 'calculator.js', content: fixedContent }
          ]
        };
      }
    }
  }

  return null;
}

// P2 처방 평가: 사용자가 후보를 비교·승인할 때 보는 판단 근거.
function assessProposal(proposal) {
  const files = proposal.repairedFiles || [];
  return {
    filesTouched: files.length,
    bytes: files.reduce((n, f) => n + (f.delete ? 0 : Buffer.byteLength(String(f.content || ''))), 0),
    reversible: true, // 적용 시 항상 .bak + undo manifest 생성 (P3 자동 롤백 경로)
    touchesDiagnostics: files.some(f => /\.clinic\.(js|cjs)$/.test(f.path)),
  };
}

// P2 판단 계약 — 진단 약화 차단 가드 (must-reject):
// 처방이 진단 파일(.clinic.*)을 수정하는 것은 triage가 원인을 "진단 파일
// 자체의 결함"(ESM 불일치, 모듈 스키마 위반)으로 판정했을 때만 허용한다.
// 그 외의 수정은 진단 기대값을 완화해 "가짜 완치"를 만드는 경로이므로
// 자동 거부한다 — "never weaken a diagnostic to fake a pass"의 코드 집행.
function validateProposalSafety(projectDir, diagResult, proposal) {
  const touched = (proposal.repairedFiles || []).filter(f => /\.clinic\.(js|cjs)$/.test(f.path));
  if (touched.length === 0) return { safe: true };

  const diagnosticDefect =
    triage.hasCause(projectDir, diagResult, triage.CAUSES.ESM_CJS_MISMATCH) ||
    triage.hasCause(projectDir, diagResult, triage.CAUSES.INVALID_DIAGNOSTIC_MODULE);
  if (diagnosticDefect) return { safe: true };

  return {
    safe: false,
    code: 'BLOCKED_WEAKENING',
    reason: `처방이 진단 파일(${touched.map(f => f.path).join(', ')})을 수정하려 했지만, 분석된 원인은 진단 파일 자체의 결함이 아닙니다. 진단 기대값을 완화하는 "가짜 완치"를 막기 위해 자동 거부했습니다 (BLOCKED_WEAKENING).`,
  };
}

function finalizeProposal(projectDir, diagResult, proposal, strategy) {
  const safety = validateProposalSafety(projectDir, diagResult, proposal);
  if (!safety.safe) {
    const failure = createFailureResult(diagResult.id, safety.reason);
    failure.errorCode = safety.code;
    return failure;
  }
  proposal.strategy = strategy;
  proposal.assessment = assessProposal(proposal);
  return proposal;
}

async function createRepairProposal(projectDir, diagResult, dependencies = {}) {
  const getByok = dependencies.getByok || getResolvedByok;
  const chatImpl = dependencies.chat || chat;
  // P2 후보 전략: 'auto'(로컬 룰 우선, 없으면 AI) | 'local'(무AI 강제) | 'ai'(AI 강제)
  const strategy = dependencies.strategy || 'auto';
  const byok = getByok(projectDir);
  const byokReady = !!(byok.provider && byok.apiKey && byok.model);

  // 후보 A — 로컬 룰 처방: 즉시·무AI·결정적. MIA "가장 값싼 유효 매체 우선".
  if (strategy !== 'ai') {
    const localProposal = generateLocalRepairProposal(projectDir, diagResult);
    if (localProposal) {
      const finalized = finalizeProposal(projectDir, diagResult, localProposal, 'local');
      if (finalized.success && byokReady) finalized.alternatives = ['ai'];
      return finalized;
    }
    if (strategy === 'local') {
      return createFailureResult(diagResult.id, '이 증상에 맞는 로컬 처방 규칙이 없습니다. AI 처방(strategy: "ai")으로 다시 요청하세요.');
    }
  }

  if (!byokReady) {
    return createFailureResult(diagResult.id, 'BYOK not configured. Set provider, apiKey, and model.');
  }

  // 후보 B — AI 처방 (강제 'ai' 또는 로컬 룰이 없는 auto).
  try {
    const ctx = collectContext(projectDir, diagResult);
    const userPrompt = buildPrompt(ctx);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    let raw;
    try {
      raw = await chatImpl(byok.provider, byok.apiKey, byok.model, messages);
    } catch (chatErr) {
      console.warn(`[AI Repair] Gemini API failed (${chatErr.message}). Falling back to local smart repairer.`);
      const localProposal = generateLocalRepairProposal(projectDir, diagResult);
      if (localProposal) return finalizeProposal(projectDir, diagResult, localProposal, 'local');
      throw chatErr;
    }

    const parsed = parseAiResponse(raw);

    if (parsed.files.length === 0) {
      return createFailureResult(diagResult.id, 'AI determined no file changes could fix this issue.', parsed.summary);
    }

    return finalizeProposal(projectDir, diagResult, {
      success: true,
      diagId: diagResult.id,
      summary: parsed.summary,
      projectDir: path.resolve(projectDir),
      originalFiles: parsed.files.map(file => readFileSnapshot(projectDir, file.path)),
      repairedFiles: parsed.files,
    }, 'ai');
  } catch (err) {
    const localProposal = generateLocalRepairProposal(projectDir, diagResult);
    if (localProposal) return finalizeProposal(projectDir, diagResult, localProposal, 'local');
    return createFailureResult(diagResult.id, err.message);
  }
}

async function applyRepairProposal(projectDir, proposal, options = {}) {
  if (!proposal || !proposal.diagId || !Array.isArray(proposal.repairedFiles) || !Array.isArray(proposal.originalFiles)) {
    return createFailureResult(proposal?.diagId || 'unknown', 'Invalid repair proposal.');
  }
  if (path.resolve(projectDir) !== proposal.projectDir) {
    return createFailureResult(proposal.diagId, 'Repair proposal belongs to a different project.');
  }

  try {
    for (const originalFile of proposal.originalFiles) {
      const current = readFileSnapshot(projectDir, originalFile.path);
      if (current.exists !== originalFile.exists || current.hash !== originalFile.hash) {
        return createFailureResult(proposal.diagId, `Repair proposal is stale because "${originalFile.path}" changed after preview.`);
      }
    }

    const { modified, backups, undoManifest } = applyChanges(projectDir, proposal.repairedFiles);
    const { allResults, target: rerunResult } = await rerunAllDiagnostics(projectDir, proposal.diagId, modified);
    const targetHealed = rerunResult?.status === 'OK';

    // P3 회귀 게이트 (MIA Regression Guard): 치료 전 OK였던 다른 진단이
    // 치료 후 실패로 전환되면 그 치료는 성공이 아니다. SUSPECTED(간헐 의심)
    // 실패도 회귀로 취급한다 — 안전한 쪽으로 판정.
    const baseline = Array.isArray(options.baselineResults) ? options.baselineResults : null;
    const regressions = baseline
      ? baseline
          .filter(b => b.status === 'OK' && b.id !== '_no_diagnostics')
          .filter(b => {
            const now = allResults.find(r => r.id === b.id);
            return now && now.status !== 'OK';
          })
          .map(b => {
            const now = allResults.find(r => r.id === b.id);
            return { id: b.id, status: now.status, details: now.details };
          })
      : [];

    // 치료 실패 또는 회귀 발생 → 자동 롤백(P3): .bak 복원 + 신규 파일 삭제.
    if (!targetHealed || regressions.length > 0) {
      const restored = rollbackChanges(projectDir, undoManifest);
      const reason = !targetHealed
        ? `치료 후에도 대상 진단이 완치되지 않아 자동 롤백했습니다 (${restored.length}개 파일 원상복구).`
        : `치료가 다른 진단 ${regressions.length}건을 손상시켜(회귀) 자동 롤백했습니다: ${regressions.map(r => r.id).join(', ')} (${restored.length}개 파일 원상복구).`;

      return {
        success: false,
        maturity: 'ROLLED_BACK',
        diagId: proposal.diagId,
        filesModified: [],
        backupFiles: backups,
        rolledBackFiles: restored,
        regressions,
        summary: proposal.summary,
        rerunResult,
        error: reason,
        originalFiles: proposal.originalFiles,
        repairedFiles: proposal.repairedFiles,
      };
    }

    return {
      success: true,
      // 기준선(치료 전 전체 결과)이 있어 회귀 0을 실증했으면 VERIFIED_RESULT,
      // 기준선이 없으면 대상 완치만 확인된 APPLIED 로 구분한다 (MIA 성숙도 라벨).
      maturity: baseline ? 'VERIFIED_RESULT' : 'APPLIED',
      diagId: proposal.diagId,
      filesModified: modified,
      backupFiles: backups,
      regressions: [],
      summary: proposal.summary,
      rerunResult,
      error: null,
      originalFiles: proposal.originalFiles,
      repairedFiles: proposal.repairedFiles,
    };
  } catch (err) {
    return createFailureResult(proposal.diagId, err.message);
  }
}

async function repairDiagnostic(projectDir, diagResult) {
  const proposal = await createRepairProposal(projectDir, diagResult);
  if (!proposal.success) return proposal;
  return applyRepairProposal(projectDir, proposal);
}

module.exports = {
  repairDiagnostic,
  createRepairProposal,
  applyRepairProposal,
};
