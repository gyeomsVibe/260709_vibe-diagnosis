const fs = require('fs');
const path = require('path');

/**
 * 증상 → 원인 후보(cause hypotheses) 규칙 엔진.
 *
 * MIA 원칙 "원인 후보 2~3개로 좁히기"를 코드로 집행한다. 처방(repairer)이
 * 증상 문자열을 직접 매칭하던 로직을 이 모듈로 일원화해, Node 버전에 따라
 * 같은 원인이 다른 증상 문구로 나타나는 문제(예: ESM 로드 실패가 Node 22+
 * 에서는 "Schema violation"으로 보고됨)를 한 곳에서만 관리한다.
 *
 * 반환 형식: [{ cause, likelihood: 'HIGH'|'MEDIUM'|'LOW', signal }]
 * cause 코드는 안정적 식별자로, 처방 엔진과 치료 원장이 참조한다.
 */

const CAUSES = {
  ESM_CJS_MISMATCH: 'ESM_CJS_MISMATCH',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  TIMEOUT: 'TIMEOUT',
  NETWORK_OR_QUOTA: 'NETWORK_OR_QUOTA',
  INVALID_DIAGNOSTIC_MODULE: 'INVALID_DIAGNOSTIC_MODULE',
  LOGIC_ASSERTION_FAILURE: 'LOGIC_ASSERTION_FAILURE',
  UNKNOWN: 'UNKNOWN',
};

function isEsmProject(projectDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    return pkg.type === 'module';
  } catch {
    return false;
  }
}

/**
 * 실패한 진단 결과 1건에 대해 원인 후보를 최대 3개, 가능성 순으로 반환한다.
 * OK 결과에는 빈 배열을 반환한다.
 */
function analyze(projectDir, result) {
  if (!result || result.status === 'OK') return [];

  const details = String(result.details || '');
  const errMsg = String(result.errorMessage || '');
  const text = `${details}\n${errMsg}`;
  const hypotheses = [];
  const add = (cause, likelihood, signal) => {
    if (!hypotheses.some(h => h.cause === cause)) hypotheses.push({ cause, likelihood, signal });
  };

  // 1) CommonJS 진단 파일 vs "type": "module" 프로젝트 충돌.
  //    구버전 Node: "module is not defined in ES module scope"로 로드 실패.
  //    Node 22+ (require-esm): 로드는 되지만 exports가 비어 Schema violation.
  const esmText = /ES module scope|module is not defined|require\(\) of ES Module/i.test(text);
  const esmStructural = isEsmProject(projectDir)
    && /Schema violation|Failed to load|module\.exports must be an object/i.test(text);
  if (esmText) add(CAUSES.ESM_CJS_MISMATCH, 'HIGH', 'error text mentions ES module scope');
  else if (esmStructural) add(CAUSES.ESM_CJS_MISMATCH, 'HIGH', 'project is type:module and a .clinic.js failed to load/validate');

  // 2) 의존 모듈 미설치
  const missing = text.match(/Cannot find module '([^']+)'/);
  if (missing) add(CAUSES.MISSING_DEPENDENCY, 'HIGH', `Cannot find module '${missing[1]}'`);

  // 3) 진단별 제한 시간 초과
  if (/timed out after \d+ms/i.test(text)) {
    add(CAUSES.TIMEOUT, 'HIGH', 'per-diagnostic timeout fired');
    add(CAUSES.NETWORK_OR_QUOTA, 'MEDIUM', 'timeouts are often caused by hung network calls');
  }

  // 4) 네트워크/쿼터 계열
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|RPC timeout|\b429\b|\b503\b|quota/i.test(text)) {
    add(CAUSES.NETWORK_OR_QUOTA, 'HIGH', 'network/quota error signature in output');
  }

  // 5) 진단 모듈 자체 결함 (스키마 위반, 로드 실패) — ESM으로 설명되지 않는 경우
  if (/Schema violation|Failed to load/i.test(text)) {
    add(CAUSES.INVALID_DIAGNOSTIC_MODULE, esmText || esmStructural ? 'LOW' : 'MEDIUM',
      'diagnostic module failed to load or violated the schema');
  }

  // 6) 로직/어서션 실패 (대상 코드의 진짜 결함 신호)
  if (/기대값|expected|assert|AssertionError|throw/i.test(text)) {
    add(CAUSES.LOGIC_ASSERTION_FAILURE, hypotheses.length === 0 ? 'HIGH' : 'MEDIUM',
      'result text compares an expected value against an observed one');
  }

  if (hypotheses.length === 0) {
    add(CAUSES.UNKNOWN, 'LOW', 'no known cause signature matched');
  }

  return hypotheses.slice(0, 3);
}

function hasCause(projectDir, result, cause) {
  const hypotheses = Array.isArray(result?.causeHypotheses)
    ? result.causeHypotheses
    : analyze(projectDir, result);
  return hypotheses.some(h => h.cause === cause);
}

module.exports = { analyze, hasCause, isEsmProject, CAUSES };
