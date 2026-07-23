const path = require('path');

const { version: VERSION } = require('../package.json');

const LAYER_LABELS = {
  TASK: 'TASK',
  FUNCTION: 'FUNC',
  SYSTEM: 'SYS ',
  UNKNOWN: '??? ',
};

const STATUS_ICONS = {
  OK: '\x1b[32m✅ OK     \x1b[0m',
  WARNING: '\x1b[33m⚠️  WARNING\x1b[0m',
  ERROR: '\x1b[31m❌ ERROR  \x1b[0m',
};

const STATUS_ICONS_PLAIN = {
  OK: 'OK',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
};

function padRight(str, len) {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function formatResults(results, projectDir) {
  let pkg;
  try {
    pkg = require(path.join(projectDir, 'package.json'));
  } catch {
    pkg = { name: path.basename(projectDir), version: '0.0.0' };
  }

  const lines = [];
  const divider = '\x1b[90m─────────────────────────────────────────────────────────────────\x1b[0m';

  lines.push('');
  lines.push(`  \x1b[1m\x1b[36mVibe Clinic v${VERSION}\x1b[0m — \x1b[1m${pkg.name}\x1b[0m`);
  lines.push(`  ${divider}`);
  lines.push('');

  let okCount = 0;
  let warnCount = 0;
  let errCount = 0;

  for (const r of results) {
    const layer = LAYER_LABELS[r.layer] || LAYER_LABELS.UNKNOWN;
    const icon = STATUS_ICONS[r.status] || STATUS_ICONS.ERROR;
    const id = padRight(r.id, 28);
    const details = r.details || '';

    lines.push(`  ${layer} │ ${id} │ ${icon} │ ${details}`);

    if (r.status === 'OK') okCount++;
    else if (r.status === 'WARNING') warnCount++;
    else errCount++;
  }

  lines.push('');
  lines.push(`  ${divider}`);

  const total = results.length;
  const summaryParts = [];
  summaryParts.push(`\x1b[32mOK: ${okCount}\x1b[0m`);
  summaryParts.push(`\x1b[33mWARN: ${warnCount}\x1b[0m`);
  summaryParts.push(`\x1b[31mERR: ${errCount}\x1b[0m`);

  lines.push(`  Total: ${total} nodes │ ${summaryParts.join(' │ ')}`);

  let overall;
  let healthPercent;
  if (errCount > 0) {
    healthPercent = Math.round(((okCount) / total) * 100);
    overall = `\x1b[31m❌ ERROR\x1b[0m — Health ${healthPercent}%`;
  } else if (warnCount > 0) {
    healthPercent = Math.round(((okCount) / total) * 100);
    overall = `\x1b[33m⚠️  WARNING\x1b[0m — Health ${healthPercent}%`;
  } else {
    overall = `\x1b[32m✅ OK\x1b[0m — Health 100%`;
  }

  lines.push(`  Overall: ${overall}`);
  lines.push('');

  return lines.join('\n');
}

// 진단 결과 배열에서 요약·전체상태·건강도를 계산한다. CLI(formatResultsJson)와
// 대시보드(/api/run)가 같은 계산을 두 벌 갖고 있다가 어긋나는 것을 막기 위해 한곳에 둔다.
// 빈 배열이면 total 0 → 0나누기 대신 healthPercent 100, overallStatus OK.
function summarize(results) {
  const summary = {
    total: results.length,
    ok: results.filter(r => r.status === 'OK').length,
    warning: results.filter(r => r.status === 'WARNING').length,
    error: results.filter(r => r.status === 'ERROR').length,
  };

  const overallStatus = summary.error > 0
    ? 'ERROR'
    : summary.warning > 0
      ? 'WARNING'
      : 'OK';

  const healthPercent = summary.total > 0
    ? Math.round((summary.ok / summary.total) * 100)
    : 100;

  return { summary, overallStatus, healthPercent };
}

function formatResultsJson(results) {
  const { summary, overallStatus, healthPercent } = summarize(results);

  return JSON.stringify({
    results: results.map(r => ({
      id: r.id,
      name: r.name,
      layer: r.layer,
      linkedTask: r.linkedTask || null,
      status: r.status,
      details: r.details,
      duration: r.duration,
    })),
    summary,
    overallStatus,
    healthPercent,
    timestamp: new Date().toISOString(),
  }, null, 2) + '\n';
}

module.exports = { formatResults, formatResultsJson, summarize };
