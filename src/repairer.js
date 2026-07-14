const fs = require('fs');
const path = require('path');
const { chat } = require('./ai-provider');
const { getResolvedByok } = require('./config-manager');
const { runDiagnostics, discoverDiagnostics } = require('./runner');

const BACKUP_EXT = '.bak';

const SYSTEM_PROMPT = `You are a code repair specialist for a Node.js project.
You receive a diagnostic failure with context and must fix the root cause.

RULES:
- Return ONLY a valid JSON object, no markdown fences, no explanation outside JSON.
- Each file change must include the COMPLETE file content, not patches or diffs.
- Only modify files that directly fix the diagnostic failure.
- Do NOT add comments to the source code.
- File paths must be relative to the project root.
- If the issue cannot be fixed by modifying files, set "files" to an empty array and explain in "summary".

Response format:
{
  "files": [
    { "path": "relative/path/to/file", "content": "complete file content here" }
  ],
  "summary": "Brief explanation of what was fixed and why"
}`;

function collectContext(projectDir, diagResult) {
  const ctx = { diagnostic: diagResult, projectFiles: [], diagSource: null, errorPattern: null };

  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      ctx.packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
  } catch {}

  const diagFiles = discoverDiagnostics(projectDir);
  const matchingDiag = diagFiles.find(f => path.basename(f, '.clinic.js') === diagResult.id);
  if (matchingDiag && fs.existsSync(matchingDiag)) {
    ctx.diagSource = fs.readFileSync(matchingDiag, 'utf-8');
  }

  const patternsDir = path.join(projectDir, '.vibe-clinic', 'error-patterns');
  if (fs.existsSync(patternsDir)) {
    const patterns = fs.readdirSync(patternsDir).filter(f => f.endsWith('.md'));
    const matching = patterns.find(f => f.toLowerCase().includes(diagResult.id.toLowerCase()));
    if (matching) {
      ctx.errorPattern = fs.readFileSync(path.join(patternsDir, matching), 'utf-8');
    }
  }

  try {
    ctx.projectFiles = listProjectFiles(projectDir, '', 2);
  } catch {}

  return ctx;
}

function listProjectFiles(dir, prefix, depth) {
  if (depth <= 0) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build') continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (entry.isDirectory()) {
      result.push(rel + '/');
      result.push(...listProjectFiles(path.join(dir, name), rel, depth - 1));
    } else {
      result.push(rel);
    }
  }
  return result;
}

function buildPrompt(ctx) {
  let prompt = `DIAGNOSTIC FAILURE:\n`;
  prompt += `- ID: ${ctx.diagnostic.id}\n`;
  prompt += `- Name: ${ctx.diagnostic.name}\n`;
  prompt += `- Layer: ${ctx.diagnostic.layer}\n`;
  prompt += `- Status: ${ctx.diagnostic.status}\n`;
  prompt += `- Details: ${ctx.diagnostic.details}\n\n`;

  if (ctx.diagSource) {
    prompt += `DIAGNOSTIC SOURCE CODE (.clinic.js):\n\`\`\`javascript\n${ctx.diagSource}\n\`\`\`\n\n`;
  }

  if (ctx.errorPattern) {
    prompt += `ERROR PATTERN DOCUMENTATION:\n${ctx.errorPattern}\n\n`;
  }

  if (ctx.packageJson) {
    prompt += `PACKAGE.JSON:\n\`\`\`json\n${JSON.stringify(ctx.packageJson, null, 2)}\n\`\`\`\n\n`;
  }

  if (ctx.projectFiles.length > 0) {
    prompt += `PROJECT STRUCTURE:\n${ctx.projectFiles.join('\n')}\n\n`;
  }

  prompt += `Fix this diagnostic failure. Return ONLY the JSON response.`;
  return prompt;
}

function parseAiResponse(raw) {
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed.files)) {
    throw new Error('AI response missing "files" array');
  }
  if (typeof parsed.summary !== 'string') {
    throw new Error('AI response missing "summary" string');
  }

  for (const file of parsed.files) {
    if (!file.path || typeof file.content !== 'string') {
      throw new Error('Invalid file entry in AI response');
    }
  }

  return parsed;
}

function createBackup(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const backupPath = filePath + BACKUP_EXT;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function applyChanges(projectDir, files) {
  const modified = [];
  const backups = [];

  for (const file of files) {
    const absPath = path.resolve(projectDir, file.path);

    const rel = path.relative(path.resolve(projectDir), absPath);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Path traversal detected: ${file.path}`);
    }

    const backup = createBackup(absPath);
    if (backup) backups.push(backup);

    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(absPath, file.content, 'utf-8');
    modified.push(file.path);
  }

  return { modified, backups };
}

function clearModuleCache(projectDir, relativePaths) {
  for (const rel of relativePaths) {
    const absPath = path.resolve(projectDir, rel);
    try {
      const resolved = require.resolve(absPath);
      delete require.cache[resolved];
    } catch {}
  }
}

async function rerunSingleDiagnostic(projectDir, diagId, modifiedFiles = []) {
  try {
    clearModuleCache(projectDir, modifiedFiles);
    const results = await runDiagnostics(projectDir);
    return results.find(r => r.id === diagId) || null;
  } catch {
    return null;
  }
}

async function repairDiagnostic(projectDir, diagResult) {
  const byok = getResolvedByok(projectDir);

  if (!byok.provider || !byok.apiKey || !byok.model) {
    return {
      success: false,
      diagId: diagResult.id,
      filesModified: [],
      backupFiles: [],
      summary: '',
      rerunResult: null,
      error: 'BYOK not configured. Set provider, apiKey, and model.',
    };
  }

  try {
    const ctx = collectContext(projectDir, diagResult);
    const userPrompt = buildPrompt(ctx);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const raw = await chat(byok.provider, byok.apiKey, byok.model, messages);
    const parsed = parseAiResponse(raw);

    if (parsed.files.length === 0) {
      return {
        success: false,
        diagId: diagResult.id,
        filesModified: [],
        backupFiles: [],
        summary: parsed.summary,
        rerunResult: null,
        error: 'AI determined no file changes could fix this issue.',
      };
    }

    const { modified, backups } = applyChanges(projectDir, parsed.files);
    const rerunResult = await rerunSingleDiagnostic(projectDir, diagResult.id, modified);

    return {
      success: rerunResult?.status === 'OK',
      diagId: diagResult.id,
      filesModified: modified,
      backupFiles: backups,
      summary: parsed.summary,
      rerunResult,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      diagId: diagResult.id,
      filesModified: [],
      backupFiles: [],
      summary: '',
      rerunResult: null,
      error: err.message,
    };
  }
}

module.exports = { repairDiagnostic };
