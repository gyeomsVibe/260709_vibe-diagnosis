const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'config.json';
const DIAG_ROOT = '.vibe-clinic';

const DEFAULT_CONFIG = {
  projectName: '',
  diagnosticsDir: 'diagnostics',
  errorPatternsDir: 'error-patterns',
  layers: ['TASK', 'FUNCTION', 'SYSTEM'],
  byok: {
    provider: '',
    apiKey: '',
    model: '',
  },
};

function configPath(projectDir) {
  return path.join(projectDir, DIAG_ROOT, CONFIG_FILE);
}

function loadConfig(projectDir) {
  const filePath = configPath(projectDir);
  if (!fs.existsSync(filePath)) return { ...DEFAULT_CONFIG };

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { ...DEFAULT_CONFIG, ...raw, byok: { ...DEFAULT_CONFIG.byok, ...raw.byok } };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(projectDir, config) {
  const filePath = configPath(projectDir);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// A masked key looks like "AQ.A****lash" (slice(0,4) + '****' + slice(-4))
// or plain '****' — see getByokConfig(). The dashboard shows masked keys, so
// one must never be written back as if it were the real credential.
function isMaskedApiKey(key) {
  return typeof key === 'string' && (key === '****' || /^.{4}\*{4}.{4}$/.test(key));
}

function saveByokConfig(projectDir, byok) {
  const config = loadConfig(projectDir);
  const incoming = { ...byok };

  // Preserve the previously stored key when the caller sends an empty value
  // or a masked placeholder — otherwise a "save settings" click on a form
  // prefilled with the masked key would destroy the real credential.
  if (!incoming.apiKey || isMaskedApiKey(incoming.apiKey)) {
    delete incoming.apiKey;
  }

  config.byok = { ...config.byok, ...incoming };
  saveConfig(projectDir, config);
  ensureGitignore(projectDir);
  return config;
}

function getByokConfig(projectDir, { maskKey = false } = {}) {
  const config = loadConfig(projectDir);
  const byok = resolveByokWithEnv(config.byok);

  if (maskKey && byok.apiKey) {
    const key = byok.apiKey;
    byok.apiKey = key.length > 8
      ? key.slice(0, 4) + '****' + key.slice(-4)
      : '****';
  }

  return byok;
}

function resolveByokWithEnv(byok) {
  return {
    provider: process.env.VIBE_CLINIC_PROVIDER || byok.provider || '',
    apiKey: process.env.VIBE_CLINIC_API_KEY || byok.apiKey || '',
    model: process.env.VIBE_CLINIC_MODEL || byok.model || '',
  };
}

function getResolvedByok(projectDir) {
  const config = loadConfig(projectDir);
  return resolveByokWithEnv(config.byok);
}

function ensureGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const entry = '.vibe-clinic/config.json';

  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  if (content.split('\n').some(line => line.trim() === entry)) return;

  const newline = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, content + newline + entry + '\n', 'utf-8');
}

module.exports = {
  loadConfig,
  saveConfig,
  saveByokConfig,
  getByokConfig,
  getResolvedByok,
  ensureGitignore,
};
