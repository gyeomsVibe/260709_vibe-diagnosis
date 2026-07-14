const fs = require('fs');
const path = require('path');
const { ensureGitignore } = require('./config-manager');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'vibe-clinic.js');
const MCP_SERVER_PATH = path.join(__dirname, '..', 'mcp-server', 'index.js');

function getMcpConfig() {
  return {
    command: process.execPath,
    args: [MCP_SERVER_PATH],
  };
}

function setupGeminiMcp(targetDir) {
  const geminiDir = path.join(targetDir, '.gemini');
  const settingsPath = path.join(geminiDir, 'settings.json');

  fs.mkdirSync(geminiDir, { recursive: true });

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  if (settings.mcpServers['vibe-clinic']) {
    return false;
  }

  settings.mcpServers['vibe-clinic'] = getMcpConfig();
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return true;
}

function initialize(targetDir) {
  const diagRoot = path.join(targetDir, '.vibe-clinic');
  const diagnosticsDir = path.join(diagRoot, 'diagnostics');
  const errorPatternsDir = path.join(diagRoot, 'error-patterns');

  if (fs.existsSync(diagRoot)) {
    ensureGitignore(targetDir);
    const mcpEnsured = setupGeminiMcp(targetDir);
    console.log(`\n  \x1b[33m⚠️  .vibe-clinic/ already exists in ${targetDir}\x1b[0m`);
    console.log(`  Existing files were not touched.`);
    console.log(`  .gitignore entry ensured${mcpEnsured ? ', MCP config added to .gemini/settings.json' : ', MCP config already present'}.\n`);
    return;
  }

  fs.mkdirSync(diagnosticsDir, { recursive: true });
  fs.mkdirSync(errorPatternsDir, { recursive: true });

  const configSrc = path.join(TEMPLATE_DIR, 'config.json');
  const configDest = path.join(diagRoot, 'config.json');
  fs.copyFileSync(configSrc, configDest);

  const exampleSrc = path.join(TEMPLATE_DIR, 'example.clinic.js');
  const exampleDest = path.join(diagnosticsDir, 'example.clinic.js');
  fs.copyFileSync(exampleSrc, exampleDest);

  const errorPatternSrc = path.join(TEMPLATE_DIR, 'error-pattern.md');
  const errorPatternDest = path.join(errorPatternsDir, 'ERR_000_template.md');
  fs.copyFileSync(errorPatternSrc, errorPatternDest);

  ensureGitignore(targetDir);

  const mcpAdded = setupGeminiMcp(targetDir);

  console.log(`\n  \x1b[32m✅ Initialized .vibe-clinic/ in ${targetDir}\x1b[0m`);
  console.log('');
  console.log('  Created:');
  console.log('    .vibe-clinic/');
  console.log('    ├── config.json');
  console.log('    ├── diagnostics/');
  console.log('    │   └── example.clinic.js');
  console.log('    └── error-patterns/');
  console.log('        └── ERR_000_template.md');

  if (mcpAdded) {
    console.log('');
    console.log('    .gemini/');
    console.log('    └── settings.json  ← \x1b[36mMCP auto-configured\x1b[0m');
  }

  console.log('');
  console.log('  Next steps:');
  console.log('    1. Edit diagnostics/example.clinic.js or create new .clinic.js files');
  console.log(`    2. Run: node "${CLI_PATH}" run --cwd "${targetDir}"`);
  console.log(`    3. Dashboard: node "${CLI_PATH}" dashboard --cwd "${targetDir}"`);
  console.log('');
}

module.exports = { initialize };
