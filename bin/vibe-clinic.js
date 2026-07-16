#!/usr/bin/env node

const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const flags = {
  json: args.includes('--json'),
  all: args.includes('--all'),
  cwd: null,
  port: 7700,
  ui: 'v1',
};

const cwdIndex = args.indexOf('--cwd');
if (cwdIndex !== -1 && args[cwdIndex + 1]) {
  flags.cwd = path.resolve(args[cwdIndex + 1]);
}

const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
  flags.port = parseInt(args[portIndex + 1], 10) || 7700;
}

const uiIndex = args.indexOf('--ui');
if (uiIndex !== -1 && args[uiIndex + 1]) {
  const requestedUi = args[uiIndex + 1].toLowerCase();
  if (!['v1', 'v2'].includes(requestedUi)) {
    console.error('Error: --ui must be v1 or v2');
    process.exit(1);
  }
  flags.ui = requestedUi;
}

const targetDir = flags.cwd || process.cwd();

async function main() {
  switch (command) {
    case 'init': {
      const { initialize } = require('../src/init');
      await initialize(targetDir);
      break;
    }
    case 'run': {
      const { runDiagnostics } = require('../src/runner');
      const { formatResults, formatResultsJson } = require('../src/reporter');

      const results = await runDiagnostics(targetDir);

      if (flags.json) {
        process.stdout.write(formatResultsJson(results));
      } else {
        process.stdout.write(formatResults(results, targetDir));
      }

      const hasError = results.some(r => r.status === 'ERROR');
      if (hasError) process.exitCode = 1;
      break;
    }
    case 'dashboard': {
      const { startDashboard } = require('../src/dashboard');
      startDashboard(targetDir, flags.port, { initialUi: flags.ui });
      break;
    }
    case 'config': {
      await handleConfig();
      break;
    }
    case 'repair': {
      await handleRepair();
      break;
    }
    default: {
      const pkg = require('../package.json');
      console.log(`\n  Vibe Clinic v${pkg.version}\n`);
      console.log('  Usage:');
      console.log('    vibe-clinic init                Initialize .vibe-clinic/ in current project');
      console.log('    vibe-clinic run                 Run all diagnostics');
      console.log('    vibe-clinic run --json           Output results as JSON');
      console.log('    vibe-clinic dashboard            Open web dashboard (default port 7700)');
      console.log('    vibe-clinic dashboard --port 8080  Use custom port');
      console.log('    vibe-clinic dashboard --ui v2      Open the redesigned V2 dashboard');
      console.log('    vibe-clinic config get           Show current BYOK configuration');
      console.log('    vibe-clinic config set <key> <value>  Set BYOK config (provider, apiKey, model)');
      console.log('    vibe-clinic repair <diagId>      Auto-repair a specific diagnostic with AI');
      console.log('    vibe-clinic repair --all         Auto-repair all failing diagnostics');
      console.log('');
      console.log('  Options:');
      console.log('    --cwd <path>                   Target another project directory');
      console.log('                                   e.g. vibe-clinic run --cwd examples/calculator\n');
    }
  }
}

async function handleConfig() {
  const subCmd = args[1];
  const { getByokConfig, saveByokConfig, getResolvedByok } = require('../src/config-manager');

  if (subCmd === 'get') {
    const byok = getByokConfig(targetDir, { maskKey: true });
    const resolved = getResolvedByok(targetDir);
    const envOverrides = [];
    if (process.env.VIBE_CLINIC_PROVIDER) envOverrides.push('provider');
    if (process.env.VIBE_CLINIC_API_KEY) envOverrides.push('apiKey');
    if (process.env.VIBE_CLINIC_MODEL) envOverrides.push('model');

    console.log(`\n  \x1b[36m🤖 BYOK Configuration\x1b[0m`);
    console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Provider:  \x1b[37m${byok.provider || '(not set)'}\x1b[0m`);
    console.log(`  API Key:   \x1b[37m${byok.apiKey || '(not set)'}\x1b[0m`);
    console.log(`  Model:     \x1b[37m${byok.model || '(not set)'}\x1b[0m`);
    if (envOverrides.length > 0) {
      console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
      console.log(`  \x1b[33m⚡ Env override:\x1b[0m ${envOverrides.join(', ')}`);
    }
    console.log('');
    return;
  }

  if (subCmd === 'set') {
    const key = args[2];
    const value = args[3];

    const validKeys = ['provider', 'apiKey', 'model'];
    if (!key || !validKeys.includes(key)) {
      console.log(`\n  \x1b[31m❌ Invalid key.\x1b[0m Valid keys: ${validKeys.join(', ')}\n`);
      process.exitCode = 1;
      return;
    }
    if (!value) {
      console.log(`\n  \x1b[31m❌ Value is required.\x1b[0m Usage: vibe-clinic config set ${key} <value>\n`);
      process.exitCode = 1;
      return;
    }

    saveByokConfig(targetDir, { [key]: value });
    const display = key === 'apiKey' && value.length > 8
      ? value.slice(0, 4) + '****' + value.slice(-4)
      : value;
    console.log(`\n  \x1b[32m✅ Set ${key} = ${display}\x1b[0m\n`);
    return;
  }

  console.log('\n  Usage:');
  console.log('    vibe-clinic config get               Show BYOK configuration');
  console.log('    vibe-clinic config set provider <name>  Set provider (openai|anthropic|gemini|openrouter)');
  console.log('    vibe-clinic config set apiKey <key>     Set API key');
  console.log('    vibe-clinic config set model <name>     Set model name\n');
}

async function handleRepair() {
  const { runDiagnostics } = require('../src/runner');
  const { repairDiagnostic } = require('../src/repairer');
  const diagId = flags.all ? null : args[1];

  if (!diagId && !flags.all) {
    console.log('\n  Usage:');
    console.log('    vibe-clinic repair <diagId>    Repair a specific diagnostic');
    console.log('    vibe-clinic repair --all       Repair all failing diagnostics\n');
    return;
  }

  console.log(`\n  \x1b[36m🔧 Running diagnostics...\x1b[0m`);
  const results = await runDiagnostics(targetDir);
  const failing = results.filter(r => r.status === 'ERROR' || r.status === 'WARNING');

  if (failing.length === 0) {
    console.log(`  \x1b[32m✅ All diagnostics passed! Nothing to repair.\x1b[0m\n`);
    return;
  }

  let targets;
  if (flags.all) {
    targets = failing;
  } else {
    const target = failing.find(r => r.id === diagId);
    if (!target) {
      const match = results.find(r => r.id === diagId);
      if (match && match.status === 'OK') {
        console.log(`  \x1b[32m✅ "${diagId}" is already OK.\x1b[0m\n`);
      } else {
        console.log(`  \x1b[31m❌ Diagnostic "${diagId}" not found.\x1b[0m`);
        console.log(`  Available: ${results.map(r => r.id).join(', ')}\n`);
        process.exitCode = 1;
      }
      return;
    }
    targets = [target];
  }

  console.log(`  Found ${failing.length} failing, repairing ${targets.length}...\n`);

  let successCount = 0;
  for (const target of targets) {
    const icon = target.status === 'ERROR' ? '🔴' : '🟡';
    process.stdout.write(`  ${icon} ${target.id.padEnd(30)} `);

    const result = await repairDiagnostic(targetDir, target);

    if (result.success) {
      console.log(`\x1b[32m✅ Fixed\x1b[0m  ${result.summary}`);
      successCount++;
    } else if (result.error) {
      console.log(`\x1b[31m❌ Failed\x1b[0m ${result.error}`);
    } else {
      console.log(`\x1b[33m⚠️  Partial\x1b[0m ${result.summary}`);
    }

    if (result.filesModified.length > 0) {
      console.log(`    Files: ${result.filesModified.join(', ')}`);
    }
    if (result.backupFiles.length > 0) {
      console.log(`    Backups: ${result.backupFiles.map(f => path.basename(f)).join(', ')}`);
    }
  }

  console.log(`\n  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
  console.log(`  Repaired: ${successCount}/${targets.length}`);
  if (successCount < targets.length) process.exitCode = 1;
  console.log('');
}

main().catch(err => {
  console.error('\n  Fatal:', err.message);
  process.exitCode = 1;
});
