const http = require('http');
const fs = require('fs');
const path = require('path');
const { runDiagnostics, discoverDiagnostics } = require('./runner');
const { validateDiagnosticModule } = require('./schema');
const { getByokConfig, saveByokConfig, getResolvedByok } = require('./config-manager');
const { createRepairProposal, applyRepairProposal } = require('./repairer');
const aiProvider = require('./ai-provider');
const { execFile } = require('child_process');
const { initialize } = require('./init');
const crypto = require('crypto');

const HTML_PATH = path.join(__dirname, 'dashboard.html');
const MAX_BODY_BYTES = 1024 * 1024;
const REPAIR_PROPOSAL_TTL_MS = 10 * 60 * 1000;

function listDiagnosticMeta(projectDir) {
  const files = discoverDiagnostics(projectDir);
  const result = [];

  for (const filePath of files) {
    try {
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);
      const validation = validateDiagnosticModule(mod, filePath);
      result.push({
        file: path.basename(filePath),
        id: mod.id || path.basename(filePath, '.clinic.js'),
        name: mod.name || 'Unknown',
        layer: mod.layer || 'UNKNOWN',
        linkedTask: mod.linkedTask || null,
        valid: validation.valid,
      });
    } catch (err) {
      result.push({
        file: path.basename(filePath),
        id: path.basename(filePath, '.clinic.js'),
        name: 'Failed to load',
        layer: 'UNKNOWN',
        valid: false,
      });
    }
  }

  return result;
}

function listErrorPatterns(projectDir) {
  const patternsDir = path.join(projectDir, '.vibe-clinic', 'error-patterns');
  if (!fs.existsSync(patternsDir)) return [];
  return fs.readdirSync(patternsDir).filter(f => f.endsWith('.md'));
}

function readErrorPattern(projectDir, filename) {
  const safeName = path.basename(filename);
  if (safeName !== filename || !safeName.endsWith('.md')) return null;
  const filePath = path.join(projectDir, '.vibe-clinic', 'error-patterns', safeName);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function collectProjectMetadata(projectDir) {
  const metadata = {
    name: path.basename(projectDir),
    packageJson: null,
    readmeSnippet: '',
    files: []
  };

  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      metadata.packageJson = {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
        devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
        scripts: pkg.scripts ? Object.keys(pkg.scripts) : []
      };
    }
  } catch {}

  try {
    const readmePath = path.join(projectDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, 'utf-8');
      metadata.readmeSnippet = readme.slice(0, 1000);
    }
  } catch {}

  try {
    metadata.files = listFilesForExplanation(projectDir, '', 2);
  } catch {}

  return metadata;
}

function listFilesForExplanation(dir, prefix, depth) {
  if (depth <= 0) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build') continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (entry.isDirectory()) {
      result.push(rel + '/');
      result.push(...listFilesForExplanation(path.join(dir, name), rel, depth - 1));
    } else {
      result.push(rel);
    }
  }
  return result.slice(0, 30);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function generateLocalFallbackSummary(meta) {
  const deps = [];
  if (meta.packageJson && meta.packageJson.dependencies) {
    deps.push(...Object.keys(meta.packageJson.dependencies));
  }
  if (meta.packageJson && meta.packageJson.devDependencies) {
    deps.push(...Object.keys(meta.packageJson.devDependencies));
  }

  const techStack = [];
  const keyFeatures = [];

  if (deps.includes('react')) techStack.push('React');
  if (deps.includes('next')) techStack.push('Next.js');
  if (deps.includes('vue')) techStack.push('Vue.js');
  if (deps.includes('svelte')) techStack.push('Svelte');
  if (deps.includes('typescript')) techStack.push('TypeScript');
  if (deps.includes('express')) techStack.push('Express.js');
  if (deps.includes('fastify')) techStack.push('Fastify');
  if (deps.includes('vitest') || deps.includes('jest')) techStack.push('Testing (Vitest/Jest)');
  if (deps.includes('mcp') || deps.some(d => d.includes('mcp'))) techStack.push('MCP Protocol');
  if (deps.includes('electron')) techStack.push('Electron');
  if (deps.includes('tailwindcss')) techStack.push('Tailwind CSS');
  
  const filesStr = meta.files.join(' ');
  if (filesStr.includes('.html')) techStack.push('HTML5');
  if (filesStr.includes('.css')) techStack.push('CSS3');
  if (filesStr.includes('.ts') && !techStack.includes('TypeScript')) techStack.push('TypeScript');
  if (filesStr.includes('.py')) techStack.push('Python');
  if ((filesStr.includes('.js') || filesStr.includes('.mjs') || filesStr.includes('.cjs')) && !techStack.includes('JavaScript')) {
    techStack.push('JavaScript');
  }

  if (techStack.length === 0) {
    techStack.push('Node.js', 'JavaScript');
  }

  if (filesStr.includes('bin/vibe-clinic') || filesStr.includes('runner.js')) {
    keyFeatures.push('진단 엔진 실행기 (Vibe Diagnostics Runner)');
  }
  if (filesStr.includes('dashboard') || filesStr.includes('server')) {
    keyFeatures.push('대시보드 통제반 (Interactive Control Dashboard)');
  }
  if (filesStr.includes('mcp-server')) {
    keyFeatures.push('Gemini MCP 서버 프로토콜 (Gemini MCP Integration)');
  }
  if (filesStr.includes('vscode') || filesStr.includes('extension')) {
    keyFeatures.push('VS Code 자동 치료 확장 프로그램 (VS Code Extension)');
  }

  if (keyFeatures.length === 0) {
    keyFeatures.push('코드베이스 모듈');
  }

  // 구현 방식 추론
  const implParts = [];
  if (deps.includes('react') || deps.includes('next')) {
    implParts.push('React 컴포넌트 기반 SPA 구조');
  } else if (filesStr.includes('.html') && (filesStr.includes('.js') || filesStr.includes('.mjs'))) {
    implParts.push('순수 JavaScript와 DOM API로 구현된 단일 페이지 구조');
  }
  if (deps.includes('express') || deps.includes('fastify') || filesStr.includes('server')) {
    implParts.push('Node.js HTTP 서버 기반 REST API 백엔드');
  }
  if (filesStr.includes('test/') || deps.includes('vitest') || deps.includes('jest')) {
    implParts.push('자동화된 테스트 스위트 내장');
  }
  if (meta.packageJson && meta.packageJson.scripts && meta.packageJson.scripts.length > 0) {
    implParts.push(`npm scripts: ${meta.packageJson.scripts.slice(0, 5).join(', ')}`);
  }
  const implementationNotes = implParts.length > 0
    ? implParts.join('. ') + '.'
    : `${techStack.join(', ')} 기술을 활용한 코드베이스입니다.`;

  const summary = `${meta.name} 프로젝트는 ${techStack.join(', ')} 기술을 사용하는 코드베이스입니다.`;
  const details = `로컬 메타데이터를 정적 분석한 결과, package.json에 정의된 의존성과 디렉토리 파일 구조를 바탕으로 스펙을 구성하였습니다.`;

  return {
    success: true,
    isFallback: true,
    summary,
    techStack,
    keyFeatures,
    details,
    implementationNotes
  };
}

async function explainProject(projectDir) {
  const byok = getResolvedByok(projectDir);

  if (!byok.provider || !byok.apiKey || !byok.model) {
    return {
      success: false,
      error: 'BYOK not configured. Set provider, apiKey, and model in config.',
    };
  }

  const meta = collectProjectMetadata(projectDir);
  
  const systemPrompt = `You are a technical project analyzer.
Analyze the given project metadata (package.json, README snippet, file structure) and provide a concise summary.
Provide your output in Korean. Pair key technical terms with English equivalents if useful.
Return ONLY a valid JSON object, no markdown code fences, no other text outside the JSON.
Format:
{
  "summary": "이 프로젝트의 핵심 역할을 설명하는 1문장 요약",
  "techStack": ["주요 언어/프레임워크 1", "주요 라이브러리 2"],
  "keyFeatures": ["주요 모듈/기능 1", "주요 모듈/기능 2"],
  "details": "개발자 관점의 코드베이스 구조 및 구동/테스트 방식을 설명하는 3문장 요약.",
  "implementationNotes": "구현 방식과 아키텍처를 설명하는 2-3문장. 예: 순수 JavaScript와 Node.js HTTP 모듈로 구현된 단일 페이지 SPA 구조입니다. React 컴포넌트 대신 DOM API를 직접 조작하며, Express를 쓰지 않고 Node.js 기본 http 모듈로 API를 제공합니다."
}`;

  let userPrompt = `PROJECT METADATA:\n`;
  userPrompt += `- Directory Name: ${meta.name}\n`;
  if (meta.packageJson) {
    userPrompt += `- package.json: ${JSON.stringify(meta.packageJson)}\n`;
  }
  if (meta.readmeSnippet) {
    userPrompt += `- README Snippet: \n${meta.readmeSnippet}\n`;
  }
  if (meta.files.length > 0) {
    userPrompt += `- File Structure:\n${meta.files.join('\n')}\n`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  let raw = '';
  const attempts = 3;
  let delay = 1000;
  for (let i = 0; i < attempts; i++) {
    try {
      raw = await aiProvider.chat(byok.provider, byok.apiKey, byok.model, messages);
      break;
    } catch (err) {
      console.error(`[AI Explanation API] Attempt ${i + 1} failed: ${err.message}`);
      
      const isInstantFallbackErr = err.message.includes('429') || 
                                   err.message.includes('503') || 
                                   err.message.includes('quota') || 
                                   err.message.includes('key') || 
                                   err.message.includes('API key');
                                   
      if (isInstantFallbackErr || i === attempts - 1) {
        console.warn(`[AI Explanation API] Fast falling back to local heuristic analysis due to API constraints.`);
        return generateLocalFallbackSummary(meta);
      }
      
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const parsed = JSON.parse(text);
  return {
    success: true,
    summary: parsed.summary,
    techStack: parsed.techStack || [],
    keyFeatures: parsed.keyFeatures || [],
    details: parsed.details || '',
    implementationNotes: parsed.implementationNotes || ''
  };
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        reject(createHttpError('Request body is too large', 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(bodyStr));
      }
      catch { reject(createHttpError('Invalid JSON body', 400)); }
    });
    req.on('error', err => {
      if (!settled) reject(err);
    });
  });
}

function isAllowedDashboardOrigin(origin, port) {
  if (!origin) return true;
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}

function parseFolderPickerOutput(stdout) {
  const match = String(stdout || '').match(/^SELECTED:(.+)$/m);
  return match ? match[1].trim() : null;
}

function runFolderPicker(options = {}) {
  const execFileImpl = options.execFileImpl || execFile;
  const pickerScript = options.pickerScript || path.join(__dirname, 'folder-picker.ps1');

  return new Promise((resolve, reject) => {
    execFileImpl(
      'powershell',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', pickerScript],
      { windowsHide: true, timeout: 300000 },
      (err, stdout, stderr) => {
        const selectedPath = parseFolderPickerOutput(stdout);
        if (selectedPath) {
          resolve({ success: true, selectedPath });
          return;
        }
        if (err) {
          const detail = String(stderr || err.message || '').trim().slice(0, 300);
          reject(new Error(`폴더 선택 창을 여는데 실패했습니다: ${detail}`));
          return;
        }
        resolve({ success: false, cancelled: true });
      }
    );
  });
}

function startDashboard(projectDir, port = 7700, options = {}) {
  let currentProjectDir = path.resolve(projectDir);
  let lastRunResults = [];
  const repairProposals = new Map();
  const createProposal = options.createRepairProposal || createRepairProposal;
  const applyProposal = options.applyRepairProposal || applyRepairProposal;

  function removeExpiredRepairProposals() {
    const now = Date.now();
    for (const [proposalId, proposal] of repairProposals) {
      if (proposal.expiresAt <= now) repairProposals.delete(proposalId);
    }
  }

  const server = http.createServer(async (req, res) => {
    const activePort = server.address()?.port || port;
    if (!isAllowedDashboardOrigin(req.headers.origin, activePort)) {
      sendJson(res, { error: 'Forbidden origin' }, 403);
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(HTML_PATH, 'utf-8');
      sendHtml(res, html);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/list') {
      const diagnostics = listDiagnosticMeta(currentProjectDir);
      sendJson(res, diagnostics);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/errors') {
      const errors = listErrorPatterns(currentProjectDir);
      sendJson(res, errors);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/errors/')) {
      const filename = decodeURIComponent(url.pathname.slice('/api/errors/'.length));
      const content = readErrorPattern(currentProjectDir, filename);
      if (content === null) {
        sendText(res, 'Not found', 404);
      } else {
        sendText(res, content);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/run') {
      try {
        const results = await runDiagnostics(currentProjectDir);
        lastRunResults = results;
        const summary = {
          total: results.length,
          ok: results.filter(r => r.status === 'OK').length,
          warning: results.filter(r => r.status === 'WARNING').length,
          error: results.filter(r => r.status === 'ERROR').length,
        };
        const overallStatus = summary.error > 0 ? 'ERROR' : summary.warning > 0 ? 'WARNING' : 'OK';
        const healthPercent = summary.total > 0 ? Math.round((summary.ok / summary.total) * 100) : 100;
        sendJson(res, { results, summary, overallStatus, healthPercent });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/byok/config') {
      const byok = getByokConfig(currentProjectDir, { maskKey: true });
      const providers = aiProvider.listProviders();
      sendJson(res, { byok, providers });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/byok/save') {
      try {
        const body = await readBody(req);
        const { provider, apiKey, model } = body;
        saveByokConfig(currentProjectDir, { provider: provider || '', apiKey: apiKey || '', model: model || '' });
        const byok = getByokConfig(currentProjectDir, { maskKey: true });
        sendJson(res, { success: true, byok });
      } catch (err) {
        sendJson(res, { error: err.message }, err.statusCode || 400);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/repair/propose') {
      try {
        const body = await readBody(req);
        const { diagId } = body;
        if (!diagId) {
          sendJson(res, { error: 'diagId is required' }, 400);
          return;
        }

        const diagResult = lastRunResults.find(r => r.id === diagId);
        if (!diagResult) {
          sendJson(res, { error: `No recent result found for "${diagId}". Run diagnostics first.` }, 404);
          return;
        }

        if (diagResult.status === 'OK') {
          sendJson(res, { error: `Diagnostic "${diagId}" is already OK.` }, 400);
          return;
        }

        const proposal = await createProposal(currentProjectDir, diagResult);
        if (!proposal.success) {
          sendJson(res, proposal, 422);
          return;
        }

        removeExpiredRepairProposals();
        const proposalId = crypto.randomUUID();
        repairProposals.set(proposalId, {
          proposal,
          expiresAt: Date.now() + REPAIR_PROPOSAL_TTL_MS,
        });

        sendJson(res, {
          success: true,
          proposalId,
          diagId: proposal.diagId,
          summary: proposal.summary,
          originalFiles: proposal.originalFiles,
          repairedFiles: proposal.repairedFiles,
        });
      } catch (err) {
        sendJson(res, { error: err.message }, err.statusCode || 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/repair/apply') {
      try {
        const body = await readBody(req);
        const { proposalId } = body;
        if (!proposalId) {
          sendJson(res, { error: 'proposalId is required' }, 400);
          return;
        }

        removeExpiredRepairProposals();
        const storedProposal = repairProposals.get(proposalId);
        if (!storedProposal) {
          sendJson(res, { error: 'Repair proposal was not found or has expired.' }, 404);
          return;
        }
        repairProposals.delete(proposalId);

        const result = await applyProposal(currentProjectDir, storedProposal.proposal);

        if (result.rerunResult) {
          const idx = lastRunResults.findIndex(r => r.id === result.diagId);
          if (idx !== -1) lastRunResults[idx] = result.rerunResult;
        }

        sendJson(res, result, result.error ? 409 : 200);
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/repair') {
      sendJson(res, { error: 'Repair preview is required. Use /api/repair/propose first.' }, 410);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/project/list') {
      try {
        const coreRoot = path.resolve(__dirname, '..');
        const projectOptions = [
          { name: 'Vibe Clinic 본체', path: coreRoot }
        ];

        const examplesDir = path.join(coreRoot, 'examples');
        if (fs.existsSync(examplesDir)) {
          const subdirs = fs.readdirSync(examplesDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => ({
              name: `예제: ${d.name}`,
              path: path.join(examplesDir, d.name)
            }));
          projectOptions.push(...subdirs);
        }

        // 워크스페이스 형제 폴더 자동 탐지
        try {
          const parentDir = path.dirname(currentProjectDir);
          if (parentDir && fs.existsSync(parentDir)) {
            const siblings = fs.readdirSync(parentDir, { withFileTypes: true })
              .filter(d => d.isDirectory())
              .filter(d => !d.name.startsWith('.') && d.name !== 'node_modules')
              .filter(d => {
                const fullPath = path.join(parentDir, d.name);
                return !projectOptions.some(p => p.path === fullPath);
              })
              .slice(0, 50)
              .map(d => ({
                name: `프로젝트: ${d.name}`,
                path: path.join(parentDir, d.name)
              }));
            projectOptions.push(...siblings);
          }
        } catch {}

        sendJson(res, { currentProjectDir, projectOptions });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/project/select') {
      try {
        const result = await runFolderPicker();
        sendJson(res, result);
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/project/change') {
      try {
        const body = await readBody(req);
        if (!body.projectDir) {
          sendJson(res, { error: 'projectDir is required' }, 400);
          return;
        }

        const targetPath = path.resolve(body.projectDir);
        if (!fs.existsSync(targetPath)) {
          sendJson(res, { error: `지정한 경로가 존재하지 않습니다: ${body.projectDir}` }, 400);
          return;
        }
        if (!fs.statSync(targetPath).isDirectory()) {
          sendJson(res, { error: `지정한 경로가 폴더가 아닙니다: ${body.projectDir}` }, 400);
          return;
        }

        currentProjectDir = targetPath;
        lastRunResults = [];
        sendJson(res, { success: true, currentProjectDir });
      } catch (err) {
        console.error('[API Error] POST /api/project/change failed:', err);
        sendJson(res, { error: err.message }, err.statusCode || 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/project/init') {
      try {
        await initialize(currentProjectDir);
        sendJson(res, { success: true, currentProjectDir });
      } catch (err) {
        console.error('[API Error] POST /api/project/init failed:', err);
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/project/explain') {
      try {
        const result = await explainProject(currentProjectDir);
        sendJson(res, result);
      } catch (err) {
        console.error('[API Error] GET /api/project/explain failed:', err);
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    const listeningPort = server.address().port;
    const url = `http://localhost:${listeningPort}`;
    console.log(`\n  \x1b[36m🩺 Vibe Clinic Dashboard\x1b[0m`);
    console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Running at: \x1b[32m${url}\x1b[0m`);
    console.log(`  Project:    ${currentProjectDir}`);
    console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Press \x1b[33mCtrl+C\x1b[0m to stop\n`);

    if (options.openBrowser !== false) openBrowser(url);
  });

  return server;
}

function openBrowser(url) {
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, { windowsHide: true });
}

module.exports = {
  startDashboard,
  readBody,
  isAllowedDashboardOrigin,
  parseFolderPickerOutput,
  runFolderPicker,
  MAX_BODY_BYTES,
};
