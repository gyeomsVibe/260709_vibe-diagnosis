const vscode = require('vscode');
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DASHBOARD_PORT = 7700;

let statusBarItem;
let outputChannel;
let diagnosticCollection;

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Vibe Clinic');
  diagnosticCollection = vscode.languages.createDiagnosticCollection('vibe-clinic');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'vibeClinic.run';
  statusBarItem.text = '$(heart) Vibe Clinic';
  statusBarItem.tooltip = 'Run Vibe Clinic';
  statusBarItem.show();

  const runCmd = vscode.commands.registerCommand('vibeClinic.run', () => runDiagnostics(false, false));
  const runJsonCmd = vscode.commands.registerCommand('vibeClinic.runJson', () => runDiagnostics(true));
  const initCmd = vscode.commands.registerCommand('vibeClinic.init', initDiagnostics);
  const dashCmd = vscode.commands.registerCommand('vibeClinic.dashboard', openDashboard);
  const dashFolderCmd = vscode.commands.registerCommand('vibeClinic.dashboardForFolder', openDashboardForFolder);
  const repairCmd = vscode.commands.registerCommand('vibeClinic.repair', autoRepair);

  context.subscriptions.push(runCmd, runJsonCmd, initCmd, dashCmd, dashFolderCmd, repairCmd, outputChannel, diagnosticCollection, statusBarItem);

  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    const fs = require('fs');
    const diagDir = path.join(workspaceRoot, '.vibe-clinic');
    if (fs.existsSync(diagDir)) {
      runDiagnostics(false, true);
    }
  }
}

function deactivate() {
  if (statusBarItem) statusBarItem.dispose();
  if (outputChannel) outputChannel.dispose();
  if (diagnosticCollection) diagnosticCollection.dispose();
}

function getWorkspaceRoot() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  return folders[0].uri.fsPath;
}

// Resolve how to invoke the vibe-clinic CLI. Always shell-free (node + script path).
// Resolution order:
// 0) user setting "vibeClinic.cliPath" -> node <cliPath>  (works in ANY project)
// 1) dev checkout of this repo
// 2) workspace root 'bin/vibe-clinic.js' (local CLI)
// 3) project-local node_modules 'vibe-clinic/bin/vibe-clinic.js' install
// If none is found, returns null. We never fall back to `npx vibe-clinic`, because
// no npm package of that name exists (the package is "vibe-clinic").
function resolveVibeClinicInvocation(workspaceRoot, cliArgs) {
  const configured = vscode.workspace.getConfiguration('vibeClinic').get('cliPath');
  if (typeof configured === 'string' && configured.trim() && fs.existsSync(configured.trim())) {
    return { file: 'node', args: [configured.trim(), ...cliArgs] };
  }

  try {
    const mainPkg = require('../../package.json');
    if (mainPkg && mainPkg.name === 'vibe-clinic') {
      return { file: 'node', args: [path.resolve(__dirname, '..', '..', 'bin', 'vibe-clinic.js'), ...cliArgs] };
    }
  } catch {}

  if (workspaceRoot) {
    const localRepoBin = path.join(workspaceRoot, 'bin', 'vibe-clinic.js');
    if (fs.existsSync(localRepoBin)) {
      return { file: 'node', args: [localRepoBin, ...cliArgs] };
    }

    const localBin = path.join(workspaceRoot, 'node_modules', 'vibe-clinic', 'bin', 'vibe-clinic.js');
    if (fs.existsSync(localBin)) {
      return { file: 'node', args: [localBin, ...cliArgs] };
    }
  }

  return null;
}

const CLI_NOT_FOUND_MESSAGE =
  'vibe-clinic CLI를 찾을 수 없습니다. VS Code 설정 "vibeClinic.cliPath"에 bin/vibe-clinic.js의 절대 경로를 지정하거나, vibe-clinic 저장소에서 실행하세요.';

function runVibeClinic(workspaceRoot, cliArgs, options, callback) {
  const inv = resolveVibeClinicInvocation(workspaceRoot, cliArgs);
  if (!inv) {
    const err = new Error(CLI_NOT_FOUND_MESSAGE);
    err.code = 'CLI_NOT_FOUND';
    callback(err, '', '');
    return null;
  }
  return execFile(inv.file, inv.args, { windowsHide: true, ...options }, callback);
}

function runDiagnostics(jsonMode, isAuto) {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    if (!isAuto) vscode.window.showWarningMessage('Vibe Clinic: No workspace folder open.');
    return;
  }

  statusBarItem.text = '$(sync~spin) Diagnosing...';

  runVibeClinic(workspaceRoot, ['run', '--json', '--cwd', workspaceRoot], { timeout: 30000 }, (error, stdout, stderr) => {
    // CLI not available (e.g. a project with .vibe-clinic/ but no CLI on this
    // machine). Degrade quietly on auto-run; guide the user only on explicit run.
    if (error && error.code === 'CLI_NOT_FOUND') {
      statusBarItem.text = '$(circle-slash) Vibe Clinic';
      statusBarItem.tooltip = CLI_NOT_FOUND_MESSAGE;
      statusBarItem.backgroundColor = undefined;
      if (!isAuto) {
        outputChannel.clear();
        outputChannel.appendLine(CLI_NOT_FOUND_MESSAGE);
        outputChannel.show();
        vscode.window.showWarningMessage('Vibe Clinic: ' + CLI_NOT_FOUND_MESSAGE);
      }
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      statusBarItem.text = '$(error) Vibe Clinic';
      statusBarItem.tooltip = 'Vibe Clinic: 진단 출력을 해석하지 못했습니다.';
      if (!isAuto) {
        outputChannel.clear();
        outputChannel.appendLine('Failed to parse diagnostic output:');
        outputChannel.appendLine(stdout || '(empty)');
        if (stderr) outputChannel.appendLine(stderr);
        outputChannel.show();
      }
      return;
    }

    diagnosticCollection.clear();
    outputChannel.clear();

    if (jsonMode) {
      outputChannel.appendLine(JSON.stringify(parsed, null, 2));
      outputChannel.show();
    }

    renderResults(parsed, workspaceRoot);
  });
}

function runDiagnosticsAsync(workspaceRoot) {
  return new Promise((resolve, reject) => {
    runVibeClinic(workspaceRoot, ['run', '--json', '--cwd', workspaceRoot], { timeout: 30000 }, (error, stdout, stderr) => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(stderr || stdout || 'Failed to parse diagnostic output'));
      }
    });
  });
}

function postDashboard(pathName, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const options = {
      hostname: '127.0.0.1',
      port: DASHBOARD_PORT,
      path: pathName,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ message: data });
          }
        } else {
          reject(new Error(`${pathName} returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('Dashboard server is not running. Run "Vibe Clinic: Open Dashboard" first.'));
      } else {
        reject(err);
      }
    });
    req.write(body);
    req.end();
  });
}

async function autoRepair() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Vibe Clinic: No workspace folder open.');
    return;
  }

  let parsed;
  try {
    parsed = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Vibe Clinic: Running diagnostics...' },
      () => runDiagnosticsAsync(workspaceRoot)
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Vibe Clinic: Diagnostics failed — ${err.message}`);
    return;
  }

  const failedItems = (parsed.results || []).filter(
    (r) => r.status === 'ERROR' || r.status === 'WARNING'
  );

  if (failedItems.length === 0) {
    vscode.window.showInformationMessage('Vibe Clinic: All diagnostics passed. Nothing to repair.');
    renderResults(parsed, workspaceRoot);
    return;
  }

  const statusIcons = { ERROR: '\u274c', WARNING: '\u26a0\ufe0f' };
  const picks = failedItems.map((r) => ({
    label: `${statusIcons[r.status] || ''} ${r.id}`,
    description: r.status,
    detail: r.details,
    diagId: r.id
  }));

  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select a diagnostic to auto-repair',
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selected) return;

  launchDashboard(workspaceRoot);
  outputChannel.clear();
  outputChannel.appendLine(`Repair review requested — ${selected.diagId}`);
  outputChannel.appendLine('\u2500'.repeat(55));
  outputChannel.appendLine('Review the AI repair proposal in the dashboard before applying any file changes.');
  outputChannel.show();
  vscode.window.showInformationMessage(`Vibe Clinic: Review the repair proposal for ${selected.diagId} in the dashboard before applying it.`);
}

function renderResults(parsed, workspaceRoot) {
  const { results, summary, overallStatus, healthPercent } = parsed;

  const statusIcons = { OK: '\u2705', WARNING: '\u26a0\ufe0f', ERROR: '\u274c' };
  const layerLabels = { TASK: 'TASK', FUNCTION: 'FUNC', SYSTEM: 'SYS ' };

  outputChannel.appendLine('');
  outputChannel.appendLine('  Vibe Clinic Results');
  outputChannel.appendLine('  ' + '\u2500'.repeat(55));
  outputChannel.appendLine('');

  const vsDiagnostics = [];

  for (const r of results) {
    const layer = layerLabels[r.layer] || '??? ';
    const icon = statusIcons[r.status] || '\u274c';
    const id = r.id.padEnd(28);
    outputChannel.appendLine(`  ${layer} \u2502 ${id} \u2502 ${icon} ${r.status.padEnd(7)} \u2502 ${r.details}`);

    if (r.status === 'ERROR' || r.status === 'WARNING') {
      const severity = r.status === 'ERROR'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

      const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `[${r.layer}] ${r.name}: ${r.details}`,
        severity
      );
      diag.source = 'Vibe Clinic';
      diag.code = r.id;
      vsDiagnostics.push(diag);
    }
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('  ' + '\u2500'.repeat(55));
  outputChannel.appendLine(`  Total: ${summary.total} \u2502 OK: ${summary.ok} \u2502 WARN: ${summary.warning} \u2502 ERR: ${summary.error}`);
  outputChannel.appendLine(`  Overall: ${statusIcons[overallStatus]} ${overallStatus} \u2014 Health ${healthPercent}%`);
  outputChannel.appendLine('');
  outputChannel.show();

  if (vsDiagnostics.length > 0) {
    const configUri = vscode.Uri.file(path.join(workspaceRoot, '.vibe-clinic', 'config.json'));
    diagnosticCollection.set(configUri, vsDiagnostics);
  }

  if (overallStatus === 'OK') {
    statusBarItem.text = `$(check) Health ${healthPercent}%`;
    statusBarItem.backgroundColor = undefined;
  } else if (overallStatus === 'WARNING') {
    statusBarItem.text = `$(warning) Health ${healthPercent}%`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = `$(error) Health ${healthPercent}%`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }
}

function initDiagnostics() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Vibe Clinic: No workspace folder open.');
    return;
  }

  runVibeClinic(workspaceRoot, ['init'], { cwd: workspaceRoot, timeout: 15000 }, (error, stdout, stderr) => {
    outputChannel.clear();
    outputChannel.appendLine(stdout || '');
    if (stderr) outputChannel.appendLine(stderr);
    outputChannel.show();

    if (!error) {
      vscode.window.showInformationMessage('Vibe Clinic: Initialized .vibe-clinic/ successfully!');
    } else {
      vscode.window.showErrorMessage('Vibe Clinic: Init failed. Check output for details.');
    }
  });
}

function openDashboard() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Vibe Clinic: No workspace folder open.');
    return;
  }

  launchDashboard(workspaceRoot);
}

async function openDashboardForFolder() {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Open Vibe Clinic Dashboard',
    title: 'Select a folder to inspect with Vibe Clinic',
  });
  if (!selected || selected.length === 0) return;

  launchDashboard(selected[0].fsPath);
}

function launchDashboard(workspaceRoot) {
  const dashArgs = ['dashboard', '--cwd', workspaceRoot, '--port', String(DASHBOARD_PORT)];
  const inv = resolveVibeClinicInvocation(workspaceRoot, dashArgs);

  if (!inv) {
    vscode.window.showWarningMessage('Vibe Clinic: ' + CLI_NOT_FOUND_MESSAGE);
    return;
  }

  const child = spawn(inv.file, inv.args, {
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  vscode.window.showInformationMessage(`Vibe Clinic: Dashboard opened at http://localhost:${DASHBOARD_PORT}`);
}

module.exports = { activate, deactivate };
