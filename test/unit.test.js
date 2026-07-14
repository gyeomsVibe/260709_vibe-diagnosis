const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { validateDiagnosticModule, validateResult } = require('../src/schema');
const { discoverDiagnostics, runDiagnostics } = require('../src/runner');
const { formatResultsJson } = require('../src/reporter');
const { getResolvedByok, getByokConfig, saveByokConfig } = require('../src/config-manager');
const { initialize } = require('../src/init');

const CALC_DIR = path.join(__dirname, '..', 'examples', 'calculator');

test('validateDiagnosticModule accepts a well-formed module', () => {
  const mod = { id: 'x', name: 'X', layer: 'TASK', run: async () => ({ status: 'OK' }) };
  const result = validateDiagnosticModule(mod, 'x.clinic.js');
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.errors, []);
});

test('validateDiagnosticModule rejects missing fields and bad layer', () => {
  const result = validateDiagnosticModule({ layer: 'NOPE' }, 'x.clinic.js');
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('id')));
  assert.ok(result.errors.some(e => e.includes('name')));
  assert.ok(result.errors.some(e => e.includes('layer')));
  assert.ok(result.errors.some(e => e.includes('run')));
});

test('validateResult flags null and invalid status, passes valid ones', () => {
  assert.notStrictEqual(validateResult(null, 'id'), null);
  assert.notStrictEqual(validateResult({ status: 'BOGUS' }, 'id'), null);
  assert.strictEqual(validateResult({ status: 'OK' }, 'id'), null);
  assert.strictEqual(validateResult({ status: 'WARNING' }, 'id'), null);
  assert.strictEqual(validateResult({ status: 'ERROR' }, 'id'), null);
});

test('discoverDiagnostics finds the calculator example diagnostics', () => {
  const files = discoverDiagnostics(CALC_DIR);
  assert.strictEqual(files.length, 3);
  assert.ok(files.every(f => f.endsWith('.clinic.js')));
});

test('runDiagnostics returns all-OK for the calculator example', async () => {
  const results = await runDiagnostics(CALC_DIR);
  assert.strictEqual(results.length, 3);
  assert.ok(results.every(r => r.status === 'OK'), JSON.stringify(results));
});

test('runDiagnostics returns a WARNING placeholder when no diagnostics exist', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-empty-'));
  try {
    const results = await runDiagnostics(empty);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'WARNING');
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('runDiagnostics provides ctx.cwd as an alias of ctx.projectDir', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-ctx-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  fs.writeFileSync(
    path.join(diagDir, 'ctx.clinic.js'),
    `module.exports = { id: 'ctx', name: 'Ctx', layer: 'TASK', run: (ctx) => ({
       status: (ctx.cwd && ctx.cwd === ctx.projectDir) ? 'OK' : 'ERROR',
       details: 'cwd=' + ctx.cwd + ' projectDir=' + ctx.projectDir,
     }) };`
  );
  try {
    const results = await runDiagnostics(dir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'OK', results[0].details);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runDiagnostics captures a stack trace in errorMessage when a diagnostic throws', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-log-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  fs.writeFileSync(
    path.join(diagDir, 'boom.clinic.js'),
    `module.exports = { id: 'boom', name: 'Boom', layer: 'TASK', async run() { throw new Error('kaboom'); } };`
  );
  try {
    const results = await runDiagnostics(dir);
    assert.strictEqual(results[0].status, 'ERROR');
    assert.ok(results[0].errorMessage, 'errorMessage should be present');
    assert.ok(/kaboom/.test(results[0].errorMessage));
    assert.ok(/\bat\b/.test(results[0].errorMessage), 'should include a stack frame');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runDiagnostics enforces a per-diagnostic timeout', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-timeout-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  fs.writeFileSync(
    path.join(diagDir, 'hang.clinic.js'),
    `module.exports = { id: 'hang', name: 'Hang', layer: 'TASK', timeout: 100, run: () => new Promise(() => {}) };`
  );
  try {
    const results = await runDiagnostics(dir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'ERROR');
    assert.ok(/timed out/i.test(results[0].details));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('initialize creates only Vibe Clinic paths and a local MCP config', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-clinic-init-'));
  const originalLog = console.log;
  console.log = () => {};
  try {
    initialize(dir);
    assert.ok(fs.existsSync(path.join(dir, '.vibe-clinic', 'diagnostics', 'example.clinic.js')));
    assert.ok(!fs.existsSync(path.join(dir, '.vibe-diagnosis')));
    const settings = JSON.parse(fs.readFileSync(path.join(dir, '.gemini', 'settings.json'), 'utf8'));
    assert.strictEqual(settings.mcpServers['vibe-clinic'].command, process.execPath);
    assert.ok(settings.mcpServers['vibe-clinic'].args[0].endsWith(path.join('mcp-server', 'index.js')));
  } finally {
    console.log = originalLog;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('formatResultsJson computes summary, overall status, and health', () => {
  const json = JSON.parse(formatResultsJson([
    { id: 'a', name: 'A', layer: 'TASK', status: 'OK', details: '' },
    { id: 'b', name: 'B', layer: 'TASK', status: 'WARNING', details: '' },
  ]));
  assert.strictEqual(json.summary.total, 2);
  assert.strictEqual(json.summary.ok, 1);
  assert.strictEqual(json.summary.warning, 1);
  assert.strictEqual(json.overallStatus, 'WARNING');
  assert.strictEqual(json.healthPercent, 50);
});

test('getResolvedByok prefers environment variables over saved config', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-byok-'));
  const saved = process.env.VIBE_CLINIC_PROVIDER;
  process.env.VIBE_CLINIC_PROVIDER = 'openai';
  try {
    saveByokConfig(dir, { provider: 'gemini', apiKey: 'k', model: 'm' });
    const resolved = getResolvedByok(dir);
    assert.strictEqual(resolved.provider, 'openai');
    assert.strictEqual(resolved.apiKey, 'k');
    assert.strictEqual(resolved.model, 'm');
  } finally {
    if (saved === undefined) delete process.env.VIBE_CLINIC_PROVIDER;
    else process.env.VIBE_CLINIC_PROVIDER = saved;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getByokConfig masks the API key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-mask-'));
  try {
    saveByokConfig(dir, { provider: 'openai', apiKey: 'sk-1234567890abcd', model: 'gpt-4o' });
    const masked = getByokConfig(dir, { maskKey: true });
    assert.ok(masked.apiKey.includes('****'));
    assert.ok(!masked.apiKey.includes('567890'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
