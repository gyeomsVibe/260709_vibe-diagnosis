const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { Readable } = require('stream');

const { validateDiagnosticModule, validateResult } = require('../src/schema');
const { discoverDiagnostics, runDiagnostics } = require('../src/runner');
const { formatResultsJson } = require('../src/reporter');
const { getResolvedByok, getByokConfig, saveByokConfig } = require('../src/config-manager');
const { initialize } = require('../src/init');
const { createRepairProposal, applyRepairProposal } = require('../src/repairer');
const {
  startDashboard,
  readBody,
  isAllowedDashboardOrigin,
  parseFolderPickerOutput,
  runFolderPicker,
  MAX_BODY_BYTES,
} = require('../src/dashboard');

const CALC_DIR = path.join(__dirname, '..', 'examples', 'calculator');

function requestDashboard(port, requestOptions = {}) {
  return new Promise((resolve, reject) => {
    const body = requestOptions.body ? JSON.stringify(requestOptions.body) : null;
    const headers = { ...(requestOptions.headers || {}) };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestOptions.path || '/',
      method: requestOptions.method || 'GET',
      headers,
    }, response => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          body: data ? JSON.parse(data) : null,
        });
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

test('dashboard accepts only direct or same-origin requests', () => {
  assert.strictEqual(isAllowedDashboardOrigin(undefined, 7700), true);
  assert.strictEqual(isAllowedDashboardOrigin('http://localhost:7700', 7700), true);
  assert.strictEqual(isAllowedDashboardOrigin('http://127.0.0.1:7700', 7700), true);
  // 'null' origin (file:// pages, sandboxed iframes) must be blocked:
  // a local HTML file must not be able to POST to the dashboard APIs.
  assert.strictEqual(isAllowedDashboardOrigin('null', 7700), false);
  assert.strictEqual(isAllowedDashboardOrigin('vscode-webview://', 7700), true);
  assert.strictEqual(isAllowedDashboardOrigin('vscode-file://', 7700), true);
  assert.strictEqual(isAllowedDashboardOrigin('https://test.vscode-cdn.net', 7700), true);
  assert.strictEqual(isAllowedDashboardOrigin('https://example.com', 7700), false);
  assert.strictEqual(isAllowedDashboardOrigin('http://localhost:9999', 7700), false);
});

test('dashboard blocks foreign origins and non-directory projects', async () => {
  const originalLog = console.log;
  console.log = () => {};
  const server = startDashboard(CALC_DIR, 0, { openBrowser: false });
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-'));
  const filePath = path.join(temporaryDir, 'not-a-folder.txt');
  fs.writeFileSync(filePath, 'x');

  try {
    if (!server.listening) {
      await new Promise(resolve => server.once('listening', resolve));
    }
    const port = server.address().port;

    const forbidden = await requestDashboard(port, {
      path: '/api/list',
      headers: { Origin: 'https://example.com' },
    });
    assert.strictEqual(forbidden.statusCode, 403);

    const sameOrigin = await requestDashboard(port, {
      path: '/api/list',
      headers: { Origin: `http://localhost:${port}` },
    });
    assert.strictEqual(sameOrigin.statusCode, 200);

    const invalidProject = await requestDashboard(port, {
      path: '/api/project/change',
      method: 'POST',
      body: { projectDir: filePath },
    });
    assert.strictEqual(invalidProject.statusCode, 400);
    assert.match(invalidProject.body.error, /폴더가 아닙니다/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    console.log = originalLog;
  }
});

test('dashboard applies a repair only after an approved one-time proposal', async () => {
  const originalLog = console.log;
  console.log = () => {};
  let applyCalls = 0;
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-repair-'));
  const diagnosticDir = path.join(temporaryDir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagnosticDir, { recursive: true });
  fs.writeFileSync(
    path.join(diagnosticDir, 'broken.clinic.js'),
    `module.exports = { id: 'broken', name: 'Broken', layer: 'TASK', run: async () => ({ status: 'ERROR', details: 'broken' }) };`
  );

  const server = startDashboard(temporaryDir, 0, {
    openBrowser: false,
    createRepairProposal: async (projectDir, diagnostic) => ({
      success: true,
      diagId: diagnostic.id,
      summary: 'Preview only',
      projectDir,
      originalFiles: [],
      repairedFiles: [],
    }),
    applyRepairProposal: async (projectDir, proposal) => {
      applyCalls++;
      return {
        success: true,
        diagId: proposal.diagId,
        filesModified: [],
        backupFiles: [],
        summary: 'Applied after approval',
        rerunResult: { id: proposal.diagId, status: 'OK' },
        error: null,
        originalFiles: proposal.originalFiles,
        repairedFiles: proposal.repairedFiles,
      };
    },
  });

  try {
    if (!server.listening) {
      await new Promise(resolve => server.once('listening', resolve));
    }
    const port = server.address().port;
    await requestDashboard(port, { path: '/api/run', method: 'POST' });

    const proposal = await requestDashboard(port, {
      path: '/api/repair/propose',
      method: 'POST',
      body: { diagId: 'broken' },
    });
    assert.strictEqual(proposal.statusCode, 200, JSON.stringify(proposal.body));
    assert.ok(proposal.body.proposalId);
    assert.strictEqual(applyCalls, 0);

    const legacyRoute = await requestDashboard(port, {
      path: '/api/repair',
      method: 'POST',
      body: { diagId: 'broken' },
    });
    assert.strictEqual(legacyRoute.statusCode, 410);
    assert.strictEqual(applyCalls, 0);

    const applied = await requestDashboard(port, {
      path: '/api/repair/apply',
      method: 'POST',
      body: { proposalId: proposal.body.proposalId },
    });
    assert.strictEqual(applied.statusCode, 200);
    assert.strictEqual(applied.body.success, true);
    assert.strictEqual(applyCalls, 1);

    const replay = await requestDashboard(port, {
      path: '/api/repair/apply',
      method: 'POST',
      body: { proposalId: proposal.body.proposalId },
    });
    assert.strictEqual(replay.statusCode, 404);
    assert.strictEqual(applyCalls, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    console.log = originalLog;
  }
});

test('repair proposals do not write until approval and reject stale files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-repair-preview-'));
  const diagnosticDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  const sourcePath = path.join(dir, 'app.js');
  fs.mkdirSync(diagnosticDir, { recursive: true });
  fs.writeFileSync(sourcePath, 'module.exports = 1;\n');
  fs.writeFileSync(
    path.join(diagnosticDir, 'demo.clinic.js'),
    `module.exports = { id: 'demo', name: 'Demo', layer: 'TASK', run: async () => ({ status: 'OK', details: 'ok' }) };`
  );

  const diagnostic = { id: 'demo', name: 'Demo', layer: 'TASK', status: 'ERROR', details: 'broken' };
  const dependencies = {
    getByok: () => ({ provider: 'test', apiKey: 'test-key', model: 'test-model' }),
    chat: async () => JSON.stringify({
      files: [{ path: 'app.js', content: 'module.exports = 2;\n' }],
      summary: 'Update app export',
    }),
  };

  try {
    const proposal = await createRepairProposal(dir, diagnostic, dependencies);
    assert.strictEqual(proposal.success, true);
    assert.strictEqual(fs.readFileSync(sourcePath, 'utf8'), 'module.exports = 1;\n');
    assert.strictEqual(fs.existsSync(sourcePath + '.bak'), false);

    fs.writeFileSync(sourcePath, 'module.exports = 3;\n');
    const stale = await applyRepairProposal(dir, proposal);
    assert.strictEqual(stale.success, false);
    assert.match(stale.error, /stale/i);
    assert.strictEqual(fs.readFileSync(sourcePath, 'utf8'), 'module.exports = 3;\n');
    assert.strictEqual(fs.existsSync(sourcePath + '.bak'), false);

    const freshProposal = await createRepairProposal(dir, diagnostic, dependencies);
    const applied = await applyRepairProposal(dir, freshProposal);
    assert.strictEqual(applied.success, true);
    assert.strictEqual(fs.readFileSync(sourcePath, 'utf8'), 'module.exports = 2;\n');
    assert.strictEqual(fs.readFileSync(sourcePath + '.bak', 'utf8'), 'module.exports = 3;\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dashboard rejects oversized JSON request bodies', async () => {
  const request = Readable.from([Buffer.alloc(MAX_BODY_BYTES + 1, 'x')]);
  await assert.rejects(
    readBody(request),
    err => err.statusCode === 413 && /too large/i.test(err.message)
  );
});

test('folder picker output parser returns only selected paths', () => {
  assert.strictEqual(parseFolderPickerOutput('SELECTED:C:\\workspace\\app\n'), 'C:\\workspace\\app');
  assert.strictEqual(parseFolderPickerOutput(''), null);
  assert.strictEqual(parseFolderPickerOutput('DRYRUN_OK\n'), null);
});

// Real PowerShell smoke test: the mocked runner tests above can never catch
// script-level parse errors (e.g. statements placed before param()), so run
// the actual script once in -DryRun mode. No UI is shown in DryRun.
test('folder picker script passes a real -DryRun smoke check', { skip: process.platform !== 'win32' }, () => {
  const { execFileSync } = require('child_process');
  const script = path.join(__dirname, '..', 'src', 'folder-picker.ps1');
  const stdout = execFileSync(
    'powershell',
    ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', script, '-DryRun'],
    { encoding: 'utf8', timeout: 30000, windowsHide: true }
  );
  assert.match(stdout, /DRYRUN_OK/);
});

test('folder picker runner handles selection, cancellation, and errors', async () => {
  const selected = await runFolderPicker({
    execFileImpl(file, args, options, callback) {
      assert.strictEqual(file, 'powershell');
      assert.ok(args.includes('-STA'));
      assert.strictEqual(options.windowsHide, true);
      callback(null, 'SELECTED:C:\\workspace\\app\n', '');
    },
  });
  assert.deepStrictEqual(selected, { success: true, selectedPath: 'C:\\workspace\\app' });

  const cancelled = await runFolderPicker({
    execFileImpl(file, args, options, callback) {
      callback(null, '', '');
    },
  });
  assert.deepStrictEqual(cancelled, { success: false, cancelled: true });

  await assert.rejects(
    runFolderPicker({
      execFileImpl(file, args, options, callback) {
        callback(new Error('timeout'), '', 'picker timed out');
      },
    }),
    /picker timed out/
  );
});

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

test('saveByokConfig never overwrites a real key with a masked or empty value', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-maskguard-'));
  try {
    saveByokConfig(dir, { provider: 'gemini', apiKey: 'real-secret-key-123', model: 'gemini-3.5-flash' });

    // Re-saving the masked display value (what the dashboard shows) must keep the real key.
    const masked = getByokConfig(dir, { maskKey: true }).apiKey;
    saveByokConfig(dir, { provider: 'gemini', apiKey: masked, model: 'gemini-3.5-flash' });
    assert.strictEqual(getByokConfig(dir).apiKey, 'real-secret-key-123');

    // Saving with an empty key (form left blank) must also keep the real key.
    saveByokConfig(dir, { provider: 'gemini', apiKey: '', model: 'gemini-2.5-pro' });
    const after = getByokConfig(dir);
    assert.strictEqual(after.apiKey, 'real-secret-key-123');
    assert.strictEqual(after.model, 'gemini-2.5-pro');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dashboard handles /api/project/init POST request to initialize current project', async () => {
  const originalLog = console.log;
  console.log = () => {};
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-init-api-'));
  const server = startDashboard(temporaryDir, 0, { openBrowser: false });

  try {
    if (!server.listening) {
      await new Promise(resolve => server.once('listening', resolve));
    }
    const port = server.address().port;

    const response = await requestDashboard(port, {
      path: '/api/project/init',
      method: 'POST',
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.body.success, true);
    assert.ok(fs.existsSync(path.join(temporaryDir, '.vibe-clinic', 'diagnostics', 'example.clinic.js')));
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    console.log = originalLog;
  }
});

test('dashboard handles /api/project/explain GET request and returns AI explanation', async () => {
  const originalLog = console.log;
  console.log = () => {};

  const aiProvider = require('../src/ai-provider');
  const originalChat = aiProvider.chat;

  aiProvider.chat = async () => {
    return JSON.stringify({
      summary: "Mocked project summary",
      techStack: ["Node.js", "Javascript"],
      keyFeatures: ["Diagnostic run", "API Explain"],
      details: "This is a mocked project description for testing purposes."
    });
  };

  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-explain-api-'));
  saveByokConfig(temporaryDir, { provider: 'openai', apiKey: 'sk-mock-key', model: 'gpt-4o' });

  const server = startDashboard(temporaryDir, 0, { openBrowser: false });

  try {
    if (!server.listening) {
      await new Promise(resolve => server.once('listening', resolve));
    }
    const port = server.address().port;

    const response = await requestDashboard(port, {
      path: '/api/project/explain',
      method: 'GET',
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.summary, "Mocked project summary");
    assert.deepStrictEqual(response.body.techStack, ["Node.js", "Javascript"]);
  } finally {
    aiProvider.chat = originalChat;
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    console.log = originalLog;
  }
});

test('dashboard handles /api/diagnostic/create POST request to write new clinic file', async () => {
  const originalLog = console.log;
  console.log = () => {};
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-diag-create-'));
  
  // Initialize vibe clinic structure first
  const diagRoot = path.join(temporaryDir, '.vibe-clinic');
  const diagnosticsDir = path.join(diagRoot, 'diagnostics');
  fs.mkdirSync(diagnosticsDir, { recursive: true });

  const server = startDashboard(temporaryDir, 0, { openBrowser: false });

  try {
    if (!server.listening) {
      await new Promise(resolve => server.once('listening', resolve));
    }
    const port = server.address().port;

    const response = await requestDashboard(port, {
      path: '/api/diagnostic/create',
      method: 'POST',
      body: {
        id: 'func-test-new-api',
        name: 'New Api Check',
        layer: 'FUNCTION',
        testCode: 'module.exports = { id: "func-test-new-api", run: async () => ({ status: "OK", details: "Success" }) };'
      }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.body.success, true);
    
    const createdPath = path.join(diagnosticsDir, 'func-test-new-api.clinic.js');
    assert.ok(fs.existsSync(createdPath));
    const content = fs.readFileSync(createdPath, 'utf-8');
    assert.ok(content.includes('func-test-new-api'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    console.log = originalLog;
  }
});

test('runDiagnostics correctly loads and executes .clinic.cjs diagnostic files', async () => {
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-cjs-loader-test-'));
  const diagnosticsDir = path.join(temporaryDir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagnosticsDir, { recursive: true });

  const testFile = path.join(diagnosticsDir, 'test-module.clinic.cjs');
  fs.writeFileSync(testFile, `
    module.exports = {
      id: 'test-module',
      name: 'CommonJS Test Module',
      layer: 'FUNCTION',
      run: async () => ({ status: 'OK', details: 'CJS Loader Works' })
    };
  `, 'utf-8');

  try {
    const results = await runDiagnostics(temporaryDir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'test-module');
    assert.strictEqual(results[0].status, 'OK');
    assert.strictEqual(results[0].details, 'CJS Loader Works');
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
});

test('createRepairProposal falls back to local repair proposal for ESM loading errors', async () => {
  const { createRepairProposal } = require('../src/repairer');
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-esm-repair-test-'));
  const diagnosticsDir = path.join(temporaryDir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagnosticsDir, { recursive: true });

  const testFile = path.join(diagnosticsDir, 'esm-module.clinic.js');
  fs.writeFileSync(testFile, 'module.exports = {};', 'utf-8');

  const diagResult = {
    id: 'esm-module',
    name: 'esm-module.clinic.js',
    layer: 'UNKNOWN',
    status: 'ERROR',
    details: 'Failed to load: module is not defined in ES module scope...',
    errorMessage: 'ReferenceError: module is not defined in ES module scope...'
  };

  try {
    // Propose repair under quota failure (no config)
    const proposal = await createRepairProposal(temporaryDir, diagResult, {
      getByok: () => ({}) // Empty config to trigger local fallback
    });

    assert.strictEqual(proposal.success, true);
    assert.strictEqual(proposal.diagId, 'esm-module');
    assert.ok(proposal.summary.includes('CommonJS') || proposal.summary.includes('cjs'));
    
    // Propose renaming files
    const deleteOp = proposal.repairedFiles.find(f => f.path.endsWith('.js'));
    const createOp = proposal.repairedFiles.find(f => f.path.endsWith('.cjs'));

    assert.ok(deleteOp);
    assert.strictEqual(deleteOp.delete, true);
    assert.ok(createOp);
    assert.strictEqual(createOp.content, 'module.exports = {};');
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
});

// ─── MIA P1: Flaky Gate & Triage ───────────────────────────────────────────

test('flaky gate marks a once-only failure as SUSPECTED and keeps the failing status', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-flaky-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  const diagSource = [
    'let calls = 0;',
    'module.exports = {',
    "  id: 'flaky-diag', name: 'Flaky', layer: 'TASK',",
    '  run() {',
    '    calls += 1;',
    "    if (calls === 1) return { status: 'ERROR', details: 'first run fails' };",
    "    return { status: 'OK', details: 'second run passes' };",
    '  },',
    '};',
  ].join('\n');
  fs.writeFileSync(path.join(diagDir, 'flaky.clinic.js'), diagSource, 'utf-8');
  try {
    const results = await runDiagnostics(dir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'ERROR');
    assert.strictEqual(results[0].confidence, 'SUSPECTED');
    assert.ok(results[0].details.includes('간헐 실패 의심'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('flaky gate confirms a reproducible failure and attaches cause hypotheses', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-confirmed-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  const diagSource = [
    'module.exports = {',
    "  id: 'always-broken', name: 'Broken', layer: 'TASK',",
    "  run() { return { status: 'ERROR', details: \"Cannot find module 'left-pad'\" }; },",
    '};',
  ].join('\n');
  fs.writeFileSync(path.join(diagDir, 'broken.clinic.js'), diagSource, 'utf-8');
  try {
    const results = await runDiagnostics(dir);
    assert.strictEqual(results[0].status, 'ERROR');
    assert.strictEqual(results[0].confidence, 'CONFIRMED');
    assert.ok(Array.isArray(results[0].causeHypotheses));
    assert.ok(results[0].causeHypotheses.some(h => h.cause === 'MISSING_DEPENDENCY'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('retriable:false diagnostics are never re-run by the flaky gate', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-noretry-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  const diagSource = [
    "const fs = require('fs');",
    "const path = require('path');",
    'module.exports = {',
    "  id: 'run-once', name: 'Once', layer: 'TASK', retriable: false,",
    '  run(ctx) {',
    "    fs.appendFileSync(path.join(ctx.projectDir, 'calls.log'), 'x');",
    "    return { status: 'ERROR', details: 'side-effectful failure' };",
    '  },',
    '};',
  ].join('\n');
  fs.writeFileSync(path.join(diagDir, 'once.clinic.js'), diagSource, 'utf-8');
  try {
    const results = await runDiagnostics(dir);
    assert.strictEqual(results[0].status, 'ERROR');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'calls.log'), 'utf-8'), 'x');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('triage maps failure signatures to cause hypotheses', () => {
  const triage = require('../src/triage');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-triage-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x","type":"module"}', 'utf-8');
    const hs = triage.analyze(dir, { status: 'ERROR', details: 'Schema violation: module.exports must be an object' });
    assert.ok(hs.some(h => h.cause === 'ESM_CJS_MISMATCH'));

    const net = triage.analyze(dir, { status: 'WARNING', details: 'RPC timeout after 4000ms (balanceOf)' });
    assert.ok(net.some(h => h.cause === 'NETWORK_OR_QUOTA'));

    assert.deepStrictEqual(triage.analyze(dir, { status: 'OK', details: 'fine' }), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── MIA P3: Regression Gate & Auto Rollback ───────────────────────────────

function makeRegressionFixture() {
  const crypto = require('crypto');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-regress-'));
  const diagDir = path.join(dir, '.vibe-clinic', 'diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fileA.txt'), 'broken', 'utf-8');
  fs.writeFileSync(path.join(dir, 'fileB.txt'), 'good', 'utf-8');
  const diagTemplate = (id, file, want) => [
    "const fs = require('fs');",
    "const path = require('path');",
    'module.exports = {',
    `  id: '${id}', name: '${id}', layer: 'TASK', retriable: false,`,
    '  run(ctx) {',
    `    const v = fs.readFileSync(path.join(ctx.projectDir, '${file}'), 'utf-8');`,
    `    return v === '${want}'`,
    "      ? { status: 'OK', details: 'content as expected' }",
    "      : { status: 'ERROR', details: 'unexpected content: ' + v };",
    '  },',
    '};',
  ].join('\n');
  fs.writeFileSync(path.join(diagDir, 'diag-a.clinic.js'), diagTemplate('diag-a', 'fileA.txt', 'fixed'), 'utf-8');
  fs.writeFileSync(path.join(diagDir, 'diag-b.clinic.js'), diagTemplate('diag-b', 'fileB.txt', 'good'), 'utf-8');
  const snap = rel => {
    const content = fs.readFileSync(path.join(dir, rel), 'utf-8');
    return { path: rel, content, exists: true, hash: crypto.createHash('sha256').update(content).digest('hex') };
  };
  return { dir, snap };
}

test('a repair that breaks another diagnostic is rolled back automatically', async () => {
  const { dir, snap } = makeRegressionFixture();
  try {
    const baseline = await runDiagnostics(dir); // diag-a ERROR, diag-b OK

    const proposal = {
      success: true,
      diagId: 'diag-a',
      summary: 'fixes A but corrupts B',
      projectDir: path.resolve(dir),
      originalFiles: [snap('fileA.txt'), snap('fileB.txt')],
      repairedFiles: [
        { path: 'fileA.txt', content: 'fixed' },
        { path: 'fileB.txt', content: 'corrupted-by-repair' },
      ],
    };

    const result = await applyRepairProposal(dir, proposal, { baselineResults: baseline });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.maturity, 'ROLLED_BACK');
    assert.ok(result.regressions.some(r => r.id === 'diag-b'));
    // Files must be restored to their pre-repair contents.
    assert.strictEqual(fs.readFileSync(path.join(dir, 'fileA.txt'), 'utf-8'), 'broken');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'fileB.txt'), 'utf-8'), 'good');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a clean repair with a baseline is labeled VERIFIED_RESULT', async () => {
  const { dir, snap } = makeRegressionFixture();
  try {
    const baseline = await runDiagnostics(dir);

    const proposal = {
      success: true,
      diagId: 'diag-a',
      summary: 'fixes A only',
      projectDir: path.resolve(dir),
      originalFiles: [snap('fileA.txt')],
      repairedFiles: [{ path: 'fileA.txt', content: 'fixed' }],
    };

    const result = await applyRepairProposal(dir, proposal, { baselineResults: baseline });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.maturity, 'VERIFIED_RESULT');
    assert.deepStrictEqual(result.regressions, []);
    assert.strictEqual(result.rerunResult.status, 'OK');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'fileA.txt'), 'utf-8'), 'fixed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

