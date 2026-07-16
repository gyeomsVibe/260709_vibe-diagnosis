// API 계약 테스트 — shared/api-contract.md 의 단일 진실원을 자동 검증한다.
// 백엔드 변경이 계약을 깨면 이 테스트가 차단한다. 계약을 바꿀 때는
// shared/api-contract.md 를 먼저 수정·합의한 뒤 이 테스트를 함께 갱신할 것.
// (GUI 폴더 선택기 /api/project/select 와 실 AI 호출은 여기서 검증하지 않는다.)

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { startDashboard } = require('../src/dashboard');

function startServerOn(projectDir) {
  return new Promise((resolve) => {
    const originalLog = console.log;
    console.log = () => {};
    const server = startDashboard(projectDir, 0, { openBrowser: false });
    server.on('listening', () => {
      console.log = originalLog;
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test('API contract: response shapes match shared/api-contract.md', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-contract-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  fs.writeFileSync(path.join(diagDir, 'ok.clinic.js'),
    "module.exports = { id: 'contract-ok', name: 'Contract OK', layer: 'TASK', run() { return { status: 'OK', details: '정상' }; } };",
    'utf-8');

  const { server, base } = await startServerOn(dir);
  try {
    // GET /api/list → Array<{id,name,layer,valid,...}>
    const list = await (await fetch(`${base}/api/list`)).json();
    assert.ok(Array.isArray(list));
    assert.ok(list.every(d => typeof d.id === 'string' && typeof d.name === 'string' && 'layer' in d && 'valid' in d));

    // POST /api/run → {results,summary,overallStatus,healthPercent}
    const run = await (await fetch(`${base}/api/run`, { method: 'POST' })).json();
    assert.ok(Array.isArray(run.results));
    for (const key of ['total', 'ok', 'warning', 'error']) assert.strictEqual(typeof run.summary[key], 'number');
    assert.ok(['OK', 'WARNING', 'ERROR'].includes(run.overallStatus));
    assert.strictEqual(typeof run.healthPercent, 'number');
    assert.ok(run.results.every(r => ['OK', 'WARNING', 'ERROR'].includes(r.status) && typeof r.details === 'string'));

    // GET /api/errors → string[] (읽기 전용 — 파일을 새로 쓰지 않는다)
    const patternsDir = path.join(dir, '.vibe-clinic', 'error-patterns');
    const before = fs.existsSync(patternsDir) ? fs.readdirSync(patternsDir).length : 0;
    const errors = await (await fetch(`${base}/api/errors`)).json();
    assert.ok(Array.isArray(errors));
    const after = fs.existsSync(patternsDir) ? fs.readdirSync(patternsDir).length : 0;
    assert.strictEqual(after, before, 'GET /api/errors must be read-only');

    // GET /api/treatments → Array
    const treatments = await (await fetch(`${base}/api/treatments`)).json();
    assert.ok(Array.isArray(treatments));

    // GET /api/byok/config → {byok:{provider,model}, providers}
    const byok = await (await fetch(`${base}/api/byok/config`)).json();
    assert.ok(byok.byok && 'provider' in byok.byok && 'model' in byok.byok);
    assert.ok(Array.isArray(byok.providers));

    // GET /api/project/list → {currentProjectDir, projectOptions:[{name,path}]}
    const projects = await (await fetch(`${base}/api/project/list`)).json();
    assert.strictEqual(typeof projects.currentProjectDir, 'string');
    assert.ok(Array.isArray(projects.projectOptions));
    assert.ok(projects.projectOptions.every(p => typeof p.name === 'string' && typeof p.path === 'string'));

    // POST /api/project/change (없는 경로) → 400 {error}
    const badChange = await fetch(`${base}/api/project/change`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir: path.join(dir, 'no-such-dir') }),
    });
    assert.strictEqual(badChange.status, 400);
    assert.strictEqual(typeof (await badChange.json()).error, 'string');

    // POST /api/repair/propose (실행 이력 없는 diagId) → 404
    const propose404 = await fetch(`${base}/api/repair/propose`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagId: 'no-such-diag' }),
    });
    assert.strictEqual(propose404.status, 404);

    // POST /api/repair/apply (없는 proposalId) → 404
    const apply404 = await fetch(`${base}/api/repair/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: 'bogus' }),
    });
    assert.strictEqual(apply404.status, 404);

    // POST /api/repair (폐기) → 410
    const gone = await fetch(`${base}/api/repair`, { method: 'POST' });
    assert.strictEqual(gone.status, 410);

    // POST /api/diagnostic/create (testCode 누락) → 400
    const badCreate = await fetch(`${base}/api/diagnostic/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'x1', name: 'x', layer: 'TASK' }),
    });
    assert.strictEqual(badCreate.status, 400);

    // POST /api/repair/cure-all → {summary:{...}, finalResults}
    const cure = await (await fetch(`${base}/api/repair/cure-all`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })).json();
    for (const key of ['total', 'cured', 'rolledBack', 'manual', 'blocked', 'unprescribable', 'held']) {
      assert.strictEqual(typeof cure.summary[key], 'number', `cure-all summary.${key}`);
    }
    assert.ok(Array.isArray(cure.finalResults));

    // Origin: null → 403 (보안 계약)
    const nullOrigin = await fetch(`${base}/api/list`, { headers: { Origin: 'null' } });
    assert.strictEqual(nullOrigin.status, 403);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
