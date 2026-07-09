const fs = require('fs');
const path = require('path');
const { ensureGitignore } = require('./config-manager');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

const MCP_CONFIG = {
  command: 'npx',
  args: ['-y', 'vibe-diagnosis-mcp'],
};

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

  if (settings.mcpServers['vibe-diagnosis']) {
    return false;
  }

  settings.mcpServers['vibe-diagnosis'] = MCP_CONFIG;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return true;
}

function initialize(targetDir) {
  const diagRoot = path.join(targetDir, '.vibe-diagnosis');
  const diagnosticsDir = path.join(diagRoot, 'diagnostics');
  const errorPatternsDir = path.join(diagRoot, 'error-patterns');

  if (fs.existsSync(diagRoot)) {
    ensureGitignore(targetDir);
    const mcpEnsured = setupGeminiMcp(targetDir);
    console.log(`\n  \x1b[33m⚠️  .vibe-diagnosis/ already exists in ${targetDir}\x1b[0m`);
    console.log(`  Existing files were not touched.`);
    console.log(`  .gitignore entry ensured${mcpEnsured ? ', MCP config added to .gemini/settings.json' : ', MCP config already present'}.\n`);
    return;
  }

  fs.mkdirSync(diagnosticsDir, { recursive: true });
  fs.mkdirSync(errorPatternsDir, { recursive: true });

  const configSrc = path.join(TEMPLATE_DIR, 'config.json');
  const configDest = path.join(diagRoot, 'config.json');
  fs.copyFileSync(configSrc, configDest);

  const exampleSrc = path.join(TEMPLATE_DIR, 'example.diag.js');
  const exampleDest = path.join(diagnosticsDir, 'example.diag.js');
  fs.copyFileSync(exampleSrc, exampleDest);

  const errorPatternSrc = path.join(TEMPLATE_DIR, 'error-pattern.md');
  const errorPatternDest = path.join(errorPatternsDir, 'ERR_000_template.md');
  fs.copyFileSync(errorPatternSrc, errorPatternDest);

  ensureGitignore(targetDir);

  const mcpAdded = setupGeminiMcp(targetDir);

  console.log(`\n  \x1b[32m✅ Initialized .vibe-diagnosis/ in ${targetDir}\x1b[0m`);
  console.log('');
  console.log('  Created:');
  console.log('    .vibe-diagnosis/');
  console.log('    ├── config.json');
  console.log('    ├── diagnostics/');
  console.log('    │   └── example.diag.js');
  console.log('    └── error-patterns/');
  console.log('        └── ERR_000_template.md');

  if (mcpAdded) {
    console.log('');
    console.log('    .gemini/');
    console.log('    └── settings.json  ← \x1b[36mMCP auto-configured\x1b[0m');
  }

  console.log('');
  console.log('  Next steps:');
  console.log('    1. Edit diagnostics/example.diag.js or create new .diag.js files');
  console.log('    2. Run: npx vibe-diag run');
  console.log('    3. Configure BYOK in dashboard: npx vibe-diag dashboard');
  console.log('');
}


module.exports = { initialize };
