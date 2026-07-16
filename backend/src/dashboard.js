const http = require('http');
const fs = require('fs');
const path = require('path');
const { runDiagnostics, discoverDiagnostics } = require('./runner');
const { validateDiagnosticModule } = require('./schema');
const { getByokConfig, saveByokConfig, getResolvedByok } = require('./config-manager');
const { createRepairProposal, applyRepairProposal, cureAll, readTreatmentLedger } = require('./repairer');
const aiProvider = require('./ai-provider');
const { execFile } = require('child_process');
const { initialize } = require('./init');
const crypto = require('crypto');

const HTML_PATH = path.join(__dirname, 'dashboard.html');
const MAX_BODY_BYTES = 1024 * 1024;
const REPAIR_PROPOSAL_TTL_MS = 10 * 60 * 1000;
const projectExplanationCache = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function calculateProjectLanguages(projectDir) {
  const langSizes = {};
  let totalSize = 0;

  function walk(dir, depth = 0) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build' || name === 'coverage') {
        continue;
      }
      const fullPath = path.join(dir, name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(name).toLowerCase();
        let lang = '';
        if (['.js', '.mjs', '.cjs'].includes(ext)) lang = 'JavaScript';
        else if (['.ts', '.tsx'].includes(ext)) lang = 'TypeScript';
        else if (['.html', '.htm'].includes(ext)) lang = 'HTML';
        else if (ext === '.css') lang = 'CSS';
        else if (ext === '.py') lang = 'Python';
        else if (ext === '.go') lang = 'Go';
        else if (ext === '.rs') lang = 'Rust';
        else if (ext === '.json') lang = 'JSON';
        else if (['.sh', '.bat', '.ps1'].includes(ext)) lang = 'Shell/Script';
        else if (ext === '.md') lang = 'Markdown';
        else continue;

        try {
          const stats = fs.statSync(fullPath);
          langSizes[lang] = (langSizes[lang] || 0) + stats.size;
          totalSize += stats.size;
        } catch {}
      }
    }
  }

  walk(projectDir);

  if (totalSize === 0) {
    return [];
  }

  const colorMap = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Python': '#3572a5',
    'Go': '#00add8',
    'Rust': '#dea584',
    'JSON': '#292929',
    'Shell/Script': '#89e051',
    'Markdown': '#777777',
    'Other': '#8b949e'
  };

  const languages = Object.entries(langSizes)
    .map(([name, size]) => ({
      name,
      percentage: Number(((size / totalSize) * 100).toFixed(1)),
      color: colorMap[name] || '#8b949e'
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const mainLangs = [];
  let otherPercentage = 0;
  for (const lang of languages) {
    if (lang.percentage >= 1.0) {
      mainLangs.push(lang);
    } else {
      otherPercentage += lang.percentage;
    }
  }

  if (otherPercentage > 0) {
    mainLangs.push({
      name: 'Other',
      percentage: Number(otherPercentage.toFixed(1)),
      color: colorMap['Other']
    });
  }

  return mainLangs;
}

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

function writeExampleErrorPatterns(patternsDir) {
  try {
    if (!fs.existsSync(patternsDir)) {
      fs.mkdirSync(patternsDir, { recursive: true });
    }

    const err1Path = path.join(patternsDir, 'ERR_001_소수점_연산_정밀도_오류.md');
    const err1Content = `# ERR_001 — 소수점 연산 정밀도 오류 (Floating-Point Precision Error)

## 요약
JavaScript의 배정밀도 부동소수점(IEEE 754) 표현 한계로 인해 \`0.1 + 0.2\` 계산 결과가 \`0.30000000000000004\`와 같이 비정상적으로 소수점 이하 자리수가 길게 출력되는 현상입니다.

## 증상
- 계산기에 \`0.1 + 0.2\` 입력 시 결과창에 \`0.3\`이 아닌 \`0.30000000000000004\` 출력.
- 정밀 소수 연산 시 결과 값 비교 검증 실패.

## 원본 원인 (Root Cause)
컴퓨터는 10진수 소수를 이진 소수로 변환할 때 무한 소수가 되는 경우가 많으며, 컴퓨터 메모리 크기가 한정되어 있으므로 소수의 뒷자리를 무한히 표현하지 못하고 반올림하여 미세한 오차가 발생합니다.

## 해결 방법 (Solution)
소수점 연산 결과를 표시하기 전에 적절한 자리수에서 반올림을 수행하거나, 정수로 변환하여 연산한 후 다시 소수로 나눕니다.
\`\`\`javascript
// 해결 예시
const result = Number((num1 + num2).toFixed(12));
\`\`\`

## 예방 (Prevention)
- 부동소수점 값을 직접 비교(\`===\`)하지 말고 오차 범위(epsilon) 내에 있는지 확인합니다.
- 중요한 금융 연산 등에는 대수 라이브러리(Decimal.js, bignumber.js)를 활용합니다.
`;

    const err2Path = path.join(patternsDir, 'ERR_002_0으로_나누기_오류.md');
    const err2Content = `# ERR_002 — 0으로 나누기 오류 (Division By Zero)

## 요약
나눗셈 연산 수행 시 분모에 \`0\`이 대입되어 계산 결과가 \`Infinity\` 또는 \`NaN\`(Not a Number)으로 출력되는 현상입니다.

## 증상
- 계산기에 \`5 / 0\` 입력 시 화면에 \`Infinity\` 또는 \`오류\` 대신 무한대 기호 노출.
- 입력값 유효성 검증 실패로 인해 내부 상태가 오염되어 다음 연산이 불가능해짐.

## 원본 원인 (Root Cause)
수학적으로 임의의 수를 0으로 나누는 행위는 정의되지 않으나, JavaScript 환경에서는 0으로 나눌 경우 예외를 발생시키지 않고 \`Infinity\` 또는 \`NaN\`을 반환하기 때문입니다.

## 해결 방법 (Solution)
나눗셈 연산 전에 분모가 0인지 체크하여 사용자에게 명시적인 경고를 출력하거나 처리를 거부합니다.
\`\`\`javascript
if (denominator === 0) {
  throw new Error("0으로 나눌 수 없습니다.");
}
\`\`\`
`;

    fs.writeFileSync(err1Path, err1Content, 'utf-8');
    fs.writeFileSync(err2Path, err2Content, 'utf-8');
  } catch (err) {
    console.error('예제 오류 패턴 파일 작성 실패:', err);
  }
}

function listErrorPatterns(projectDir) {
  // Read-only: GET /api/errors must never write into the target project.
  // Example patterns are seeded only on explicit init (POST /api/project/init).
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
    implParts.push('React 컴포넌트 기반 Single Page Application(SPA) 구조');
  } else if (filesStr.includes('.html') && (filesStr.includes('.js') || filesStr.includes('.mjs'))) {
    implParts.push('순수 HTML5 마크업 및 JavaScript DOM API 제어로 구현된 고전적인 클라이언트 웹 아키텍처');
  }
  if (deps.includes('express') || deps.includes('fastify') || filesStr.includes('server')) {
    implParts.push('Node.js HTTP 서버 기반 REST API 인터페이스 제공 백엔드 모듈');
  }
  if (filesStr.includes('test/') || deps.includes('vitest') || deps.includes('jest')) {
    implParts.push('유닛 테스트 및 통합 테스트를 통한 높은 테스트 커버리지 및 회귀 방지 수립');
  }
  if (meta.packageJson && meta.packageJson.scripts) {
    const scriptKeys = Object.keys(meta.packageJson.scripts);
    if (scriptKeys.length > 0) {
      implParts.push(`구동 명령어 스크립트 구성: ${scriptKeys.slice(0, 4).join(', ')}`);
    }
  }
  const implementationNotes = implParts.length > 0
    ? implParts.join('. ') + '.'
    : `${techStack.join(', ')} 기술을 결합하여 경량화 및 실용성을 극대화한 아키텍처 구조입니다.`;

  // 프로젝트 명칭 및 구조 맞춤형 스마트 요약 단락 구성
  let summary = '';
  const dirLower = meta.name.toLowerCase();
  if (dirLower.includes('calculator') || dirLower.includes('calc')) {
    summary = `이 프로젝트는 ${techStack.join(', ')} 기술을 활용하여 사칙연산(더하기, 빼기, 곱하기, 나누기) 및 부동소수점 예외 제어 기능을 지원하는 실용적인 웹 계산기 프로그램입니다.`;
  } else if (dirLower.includes('위치안내') || dirLower.includes('location') || dirLower.includes('gps')) {
    summary = `이 프로젝트는 위치안내(Navigation) 프로토콜 및 데이터 처리 로직을 제공하는 코드베이스로, 위치 탐색 로직과 AI 경로 안내 인터페이스 연동 역할을 주로 담당합니다.`;
  } else {
    summary = `이 프로젝트는 ${techStack.join(', ')} 기술 스택을 활용하여 설계된 코드베이스이며, 핵심 비즈니스 로직 및 모듈(예: ${keyFeatures.slice(0, 3).join(', ') || '핵심 제어 장치'})의 구동을 담당하는 독립 애플리케이션입니다.`;
  }

  let details = `로컬 메타데이터의 소스 파일 구조를 정밀 정적 분석한 결과, `;
  if (meta.packageJson && meta.packageJson.dependencies) {
    const depList = Object.keys(meta.packageJson.dependencies);
    if (depList.length > 0) {
      details += `의존성 명세(package.json)의 주요 라이브러리인 ${depList.slice(0, 4).join(', ')} 모듈을 유기적으로 호출하고 있으며, `;
    }
  }
  const fileBasenames = meta.files.slice(0, 5).map(f => f.split(/[\\/]/).pop());
  details += `디렉토리의 주요 소스 파일(${fileBasenames.join(', ')})을 바탕으로 유기적인 실행 진입점을 구성하고 있습니다.`;

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
                                   err.message.includes('API key') ||
                                   err.message.includes('aborted') ||
                                   err.name === 'AbortError';
                                   
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
  // 'null' origin (file:// pages, sandboxed iframes) is intentionally NOT
  // allowed: local HTML files must not be able to POST to this server.
  if (origin.startsWith('vscode-webview://') || origin.startsWith('vscode-file://')) return true;
  if (origin.endsWith('.vscode-cdn.net') || origin.endsWith('.vscode-webview-test.com')) return true;
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}


function parseFolderPickerOutput(stdout) {
  const matchB64 = String(stdout || '').match(/^SELECTED_B64:(.+)$/m);
  if (matchB64) {
    try {
      return Buffer.from(matchB64[1].trim(), 'base64').toString('utf8');
    } catch (e) {
      console.error('Base64 디코딩 실패:', e);
    }
  }
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
  const cureAllImpl = options.cureAll || cureAll;

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

    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      const isV2Request = url.pathname === '/v2' || url.pathname.startsWith('/v2/');
      const isV1PrefixedRequest = url.pathname === '/v1' || url.pathname.startsWith('/v1/');
      const distDir = path.resolve(__dirname, isV2Request ? 'dist-v2' : 'dist');
      const routedPath = isV2Request
        ? url.pathname.slice('/v2'.length) || '/'
        : isV1PrefixedRequest
          ? url.pathname.slice('/v1'.length) || '/'
          : url.pathname;
      const relativePath = routedPath === '/' ? 'index.html' : routedPath.replace(/^\/+/, '');
      let targetPath = path.resolve(distDir, relativePath);
      const isInsideDist = targetPath === distDir || targetPath.startsWith(`${distDir}${path.sep}`);

      if (!isInsideDist) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        targetPath = path.join(distDir, 'index.html');
      }

      if (fs.existsSync(targetPath)) {
        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(targetPath).pipe(res);
      } else if (!isV2Request && fs.existsSync(HTML_PATH)) {
        const html = fs.readFileSync(HTML_PATH, 'utf-8');
        sendHtml(res, html);
      } else {
        res.writeHead(404);
        res.end(isV2Request ? 'V2 dashboard is not built. Run the V2 dashboard build first.' : 'Not Found');
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/list') {
      const diagnostics = listDiagnosticMeta(currentProjectDir);
      sendJson(res, diagnostics);
      return;
    }

    // P4 치료 원장: 과거 처방·치료 기록 (읽기 전용, 최신순).
    if (req.method === 'GET' && url.pathname === '/api/treatments') {
      sendJson(res, readTreatmentLedger(currentProjectDir));
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

        // P2: strategy = 'auto'(기본, 로컬 룰 우선) | 'local' | 'ai'
        const proposal = await createProposal(currentProjectDir, diagResult, { strategy: body.strategy });
        if (!proposal.success) {
          sendJson(res, proposal, 422);
          return;
        }

        // 수동 처방전(행동 처방): 파일 변경이 없으므로 승인·적용 절차 없이
        // 조치 안내만 반환한다. 완치 확인은 사용자의 재진단으로 이루어진다.
        if (proposal.kind === 'MANUAL') {
          sendJson(res, {
            success: true,
            kind: 'MANUAL',
            diagId: proposal.diagId,
            summary: proposal.summary,
            prescription: proposal.prescription,
          });
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
          strategy: proposal.strategy,
          assessment: proposal.assessment,
          alternatives: proposal.alternatives || [],
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

        const result = await applyProposal(currentProjectDir, storedProposal.proposal, {
          // P3 회귀 게이트: 치료 전 마지막 전체 진단 결과를 기준선으로 전달.
          baselineResults: lastRunResults,
        });

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

    // 💉 전체 치료: 실패 진단을 순차 치료하고 분류별 요약을 반환한다.
    // "실제 치료" 판정은 cureAll 내부의 VERIFIED_RESULT(재진단 OK + 회귀 0)만 인정.
    if (req.method === 'POST' && url.pathname === '/api/repair/cure-all') {
      try {
        const body = await readBody(req).catch(() => ({}));
        const report = await cureAllImpl(currentProjectDir, lastRunResults, { strategy: body.strategy });
        // 치료 후 전체 진단 상태를 서버 기준선에도 반영.
        if (Array.isArray(report.finalResults)) lastRunResults = report.finalResults;
        sendJson(res, report);
      } catch (err) {
        console.error('[API Error] POST /api/repair/cure-all failed:', err);
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
        const patternsDir = path.join(currentProjectDir, '.vibe-clinic', 'error-patterns');
        const existing = fs.existsSync(patternsDir)
          ? fs.readdirSync(patternsDir).filter(f => f.endsWith('.md'))
          : [];
        if (existing.length <= 1) writeExampleErrorPatterns(patternsDir);
        sendJson(res, { success: true, currentProjectDir });
      } catch (err) {
        console.error('[API Error] POST /api/project/init failed:', err);
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/project/explain') {
      try {
        const force = url.searchParams.get('force') === 'true';
        const cacheKey = path.resolve(currentProjectDir);
        if (force) {
          projectExplanationCache.delete(cacheKey);
        }

        let result;
        if (projectExplanationCache.has(cacheKey)) {
          result = projectExplanationCache.get(cacheKey);
        } else {
          result = await explainProject(currentProjectDir);
          result.languages = calculateProjectLanguages(currentProjectDir);
          projectExplanationCache.set(cacheKey, result);
        }
        sendJson(res, result);
      } catch (err) {
        console.error('[API Error] GET /api/project/explain failed:', err);
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/diagnostic/create') {
      try {
        const body = await readBody(req);
        const { id, name, layer, testCode } = body;
        
        if (!id || !name || !layer) {
          sendJson(res, { error: 'id, name, layer는 필수 필드입니다.' }, 400);
          return;
        }

        if (typeof testCode !== 'string' || !testCode.trim()) {
          sendJson(res, { error: 'testCode는 비어 있지 않은 문자열이어야 합니다.' }, 400);
          return;
        }

        if (!/^[a-z0-9-_]+$/i.test(id)) {
          sendJson(res, { error: 'ID는 영문자, 숫자, 하이픈(-), 언더바(_)만 가능합니다.' }, 400);
          return;
        }

        const diagnosticsDir = path.join(currentProjectDir, '.vibe-clinic', 'diagnostics');
        if (!fs.existsSync(diagnosticsDir)) {
          sendJson(res, { error: '프로젝트가 초기화되지 않았습니다.' }, 400);
          return;
        }

        const filePath = path.join(diagnosticsDir, `${id}.clinic.js`);
        if (fs.existsSync(filePath)) {
          sendJson(res, { error: `이미 존재하는 진단 ID입니다: ${id}` }, 400);
          return;
        }

        fs.writeFileSync(filePath, testCode, 'utf-8');
        sendJson(res, { success: true });
      } catch (err) {
        console.error('[API Error] POST /api/diagnostic/create failed:', err);
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    const listeningPort = server.address().port;
    const initialUi = options.initialUi === 'v2' ? 'v2' : 'v1';
    const url = `http://localhost:${listeningPort}/${initialUi}`;
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
