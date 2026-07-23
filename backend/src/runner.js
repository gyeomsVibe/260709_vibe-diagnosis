const fs = require('fs');
const path = require('path');
const { validateDiagnosticModule, validateResult } = require('./schema');
const triage = require('./triage');

const DIAG_DIR = '.vibe-clinic/diagnostics';
const DIAG_PATTERN = /\.clinic\.(js|cjs)$/;
const DEFAULT_TIMEOUT_MS = 30000;

function withTimeout(promise, ms, diagId) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Diagnostic "${diagId}" timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runSingleAttempt(mod, projectDir, startTime) {
  try {
    const result = await withTimeout(
      // `cwd` is provided as an alias of `projectDir` so diagnostics that read
      // either key resolve the project root correctly (never process.cwd()).
      Promise.resolve().then(() => mod.run({ projectDir, cwd: projectDir })),
      mod.timeout || DEFAULT_TIMEOUT_MS,
      mod.id
    );
    const resultError = validateResult(result, mod.id);

    if (resultError) {
      return {
        id: mod.id,
        name: mod.name,
        layer: mod.layer,
        ...resultError,
        duration: Date.now() - startTime,
      };
    }

    return {
      id: mod.id,
      name: mod.name,
      layer: mod.layer,
      linkedTask: mod.linkedTask || null,
      status: result.status,
      details: result.details || '',
      // 진단이 스스로 아는 조치 방법(행동 처방). 파일 수정으로 고칠 수 없는
      // 상태(예: 지갑 잔액 부족)는 이 필드가 수동 처방전의 1순위 근거가 된다.
      ...(result.prescription ? { prescription: result.prescription } : {}),
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      id: mod.id,
      name: mod.name,
      layer: mod.layer,
      status: 'ERROR',
      details: `Runtime error: ${err.message}`,
      errorMessage: err.stack || err.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 진단이 검사하는 대상 소스의 모듈 캐시를 비운다.
 *
 * 진단 파일만 캐시에서 지우면, 진단이 require 하는 피검사 소스는 첫 로드
 * 시점 그대로 남는다. 그러면 대시보드 서버가 살아 있는 동안 사용자가 코드를
 * 고치거나 치료가 파일을 수정해도 재진단이 옛 코드를 검사해 완치·회귀 판정이
 * 뒤집힌다. node_modules 는 실행 중 바뀌지 않으므로 유지해 로드 비용을 아낀다.
 */
function invalidateProjectModuleCache(projectDir) {
  const isWin = process.platform === 'win32';
  const norm = (p) => (isWin ? p.toLowerCase() : p);
  const rootPrefix = norm(path.resolve(projectDir)) + path.sep;
  const nodeModules = `${path.sep}node_modules${path.sep}`;

  for (const key of Object.keys(require.cache)) {
    const normalized = norm(key);
    if (!normalized.startsWith(rootPrefix)) continue;
    if (normalized.includes(nodeModules)) continue;
    delete require.cache[key];
  }
}

function discoverDiagnostics(projectDir) {
  const diagPath = path.join(projectDir, DIAG_DIR);

  if (!fs.existsSync(diagPath)) {
    return [];
  }

  return fs.readdirSync(diagPath)
    .filter(f => DIAG_PATTERN.test(f))
    .sort()
    .map(f => path.join(diagPath, f));
}

// 진단이 --filter 값과 맞는지 판단한다. 파일명(확장자 제외)과 진단 id 를 모두 보고,
// 어느 쪽이든 서로를 포함하면 통과시킨다. 원본 도구는 id 전체(ui-ux-diagnostic)로
// 필터했지만, 파일명 조각(ui-ux)이나 계열 접두사(task)로도 고를 수 있어야 실전에서 편하다.
// mod 가 없을 때(로드 실패)는 파일명만으로 판정한다.
function matchesFilter(baseName, mod, needle) {
  if (!needle) return true;
  const candidates = [
    baseName.toLowerCase(),
    mod && mod.id ? String(mod.id).toLowerCase() : '',
  ];
  return candidates.some(value => value && (value.includes(needle) || needle.includes(value)));
}

async function runDiagnostics(projectDir, filter = null) {
  const files = discoverDiagnostics(projectDir);
  const results = [];
  const needle = filter ? String(filter).toLowerCase() : null;

  if (files.length === 0) {
    return [{
      id: '_no_diagnostics',
      name: '진단 파일 없음 (No Diagnostics Found)',
      layer: 'SYSTEM',
      status: 'WARNING',
      details: `${DIAG_DIR}/ 안에 진단 파일(.clinic.js / .clinic.cjs)이 없습니다 — 진단 도구 설치(초기화)가 필요합니다.`,
      duration: 0,
    }];
  }

  // 피검사 소스를 매 실행마다 디스크에서 다시 읽도록 강제한다 (가짜 완치 방지).
  invalidateProjectModuleCache(projectDir);

  for (const filePath of files) {
    const startTime = Date.now();
    const baseName = path.basename(filePath).replace(/\.clinic\.(js|cjs)$/, '');
    let mod;

    try {
      delete require.cache[require.resolve(filePath)];
      mod = require(filePath);
    } catch (err) {
      // 로드 실패는 mod.id 를 알 수 없으므로 파일명으로만 필터를 판정한다.
      if (!matchesFilter(baseName, null, needle)) continue;
      results.push({
        id: baseName,
        name: path.basename(filePath),
        layer: 'UNKNOWN',
        status: 'ERROR',
        details: `Failed to load: ${err.message}`,
        errorMessage: err.stack || err.message,
        // Load failures are deterministic module errors, not flaky runs.
        confidence: 'CONFIRMED',
        duration: Date.now() - startTime,
      });
      continue;
    }

    if (!matchesFilter(baseName, mod, needle)) continue;

    const validation = validateDiagnosticModule(mod, filePath);
    if (!validation.valid) {
      results.push({
        id: mod.id || path.basename(filePath).replace(/\.clinic\.(js|cjs)$/, ''),
        name: mod.name || path.basename(filePath),
        layer: mod.layer || 'UNKNOWN',
        status: 'ERROR',
        details: `Schema violation: ${validation.errors.join('; ')}`,
        confidence: 'CONFIRMED',
        duration: Date.now() - startTime,
      });
      continue;
    }

    const firstAttempt = await runSingleAttempt(mod, projectDir, startTime);

    if (firstAttempt.status === 'OK' || mod.retriable === false) {
      results.push(firstAttempt);
      continue;
    }

    // Flaky Gate (MIA Evidence Gate): a failure only counts as CONFIRMED when
    // it reproduces on an immediate second run; otherwise it is SUSPECTED so
    // intermittent network/timing noise is not treated as a real defect.
    // Diagnostics with side effects can opt out via `retriable: false`.
    const secondAttempt = await runSingleAttempt(mod, projectDir, Date.now());

    if (secondAttempt.status === 'OK') {
      results.push({
        ...firstAttempt,
        confidence: 'SUSPECTED',
        details: `${firstAttempt.details} — 간헐 실패 의심 (재현 1/2: 재실행에서는 통과)`,
      });
    } else {
      results.push({
        ...secondAttempt,
        confidence: 'CONFIRMED',
        duration: firstAttempt.duration + secondAttempt.duration,
      });
    }
  }

  // 필터를 걸었는데 아무 진단도 맞지 않으면, 진단이 아예 없는 것과 구분해 안내한다.
  // (진단 파일은 있지만 --filter 값이 어디에도 안 맞은 경우)
  if (needle && results.length === 0) {
    return [{
      id: '_no_match',
      name: '필터에 맞는 진단 없음 (No Matching Diagnostics)',
      layer: 'SYSTEM',
      status: 'WARNING',
      details: `--filter "${filter}" 에 맞는 진단을 찾지 못했습니다. 진단 id 나 파일명의 일부로 다시 시도하세요.`,
      duration: 0,
    }];
  }

  // 원인 후보(triage) 부착: 실패 결과에만, 최대 3개.
  for (const result of results) {
    if (result.status !== 'OK' && !result.causeHypotheses) {
      result.causeHypotheses = triage.analyze(projectDir, result);
    }
  }

  return results;
}

module.exports = { runDiagnostics, discoverDiagnostics };
