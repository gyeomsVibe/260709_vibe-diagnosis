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

async function runDiagnostics(projectDir) {
  const files = discoverDiagnostics(projectDir);
  const results = [];

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

  for (const filePath of files) {
    const startTime = Date.now();
    let mod;

    try {
      delete require.cache[require.resolve(filePath)];
      mod = require(filePath);
    } catch (err) {
      results.push({
        id: path.basename(filePath).replace(/\.clinic\.(js|cjs)$/, ''),
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

  // 원인 후보(triage) 부착: 실패 결과에만, 최대 3개.
  for (const result of results) {
    if (result.status !== 'OK' && !result.causeHypotheses) {
      result.causeHypotheses = triage.analyze(projectDir, result);
    }
  }

  return results;
}

module.exports = { runDiagnostics, discoverDiagnostics };
