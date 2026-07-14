#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const rootDir = path.resolve(__dirname, '..');
const geminiMdPath = path.join(rootDir, 'GEMINI.md');
const localSkillPath = path.join(rootDir, '.claude', 'skills', 'vibe-check', 'SKILL.md');
const globalSkillPath = path.join(os.homedir(), '.claude', 'skills', 'vibe-check', 'SKILL.md');
const syncGlobal = process.argv.includes('--global');
const requiredTriggers = [
  '이 프로젝트 점검해서 교정해줘',
  '원터치 점검해줘',
  'vibe-check 해줘',
  '자가진단 MCP 적용해줘',
  '진단 돌리고 실패한 것 고쳐줘',
];

function readRequiredFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function validateTriggerAlignment() {
  const geminiContent = readRequiredFile(geminiMdPath, 'GEMINI.md');
  const localSkillContent = readRequiredFile(localSkillPath, 'Local vibe-check skill');

  if (!geminiContent.includes('Project-scoped adapter')) {
    throw new Error('GEMINI.md must remain a project-scoped adapter');
  }
  if (!/^---[\s\S]*?name:\s*vibe-check[\s\S]*?---/.test(localSkillContent)) {
    throw new Error('Local vibe-check skill frontmatter is invalid');
  }

  for (const trigger of requiredTriggers) {
    if (!geminiContent.includes(trigger)) {
      throw new Error(`GEMINI.md is missing trigger: ${trigger}`);
    }
    if (!localSkillContent.includes(trigger)) {
      throw new Error(`Local vibe-check skill is missing trigger: ${trigger}`);
    }
  }

  return localSkillContent;
}

function sync() {
  try {
    const localSkillContent = validateTriggerAlignment();
    console.log('✅ Project adapter and local vibe-check skill are aligned.');

    if (!syncGlobal) {
      console.log('ℹ️ Validation only: no files were changed. Use --global for explicit global skill synchronization.');
      return;
    }

    fs.mkdirSync(path.dirname(globalSkillPath), { recursive: true });
    fs.writeFileSync(globalSkillPath, localSkillContent, 'utf-8');
    console.log(`✅ Synchronized global Claude skill: ${globalSkillPath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

sync();
