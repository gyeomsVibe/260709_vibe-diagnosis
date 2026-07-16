const VALID_STATUSES = ['OK', 'WARNING', 'ERROR'];
const VALID_LAYERS = ['TASK', 'FUNCTION', 'SYSTEM'];

function validateDiagnosticModule(mod, filePath) {
  const errors = [];

  if (!mod || typeof mod !== 'object') {
    return { valid: false, errors: [`${filePath}: module.exports must be an object`] };
  }

  if (!mod.id || typeof mod.id !== 'string') {
    errors.push('missing or invalid "id" (must be a non-empty string)');
  }

  if (!mod.name || typeof mod.name !== 'string') {
    errors.push('missing or invalid "name" (must be a non-empty string)');
  }

  if (!mod.layer || !VALID_LAYERS.includes(mod.layer)) {
    errors.push(`invalid "layer" (must be one of: ${VALID_LAYERS.join(', ')})`);
  }

  if (typeof mod.run !== 'function') {
    errors.push('missing "run" function');
  }

  return {
    valid: errors.length === 0,
    errors: errors.map(e => `${filePath}: ${e}`),
  };
}

function validateResult(result, diagId) {
  if (!result || typeof result !== 'object') {
    return {
      status: 'ERROR',
      details: `Diagnostic "${diagId}" returned invalid result (expected object)`,
    };
  }

  if (!VALID_STATUSES.includes(result.status)) {
    return {
      status: 'ERROR',
      details: `Diagnostic "${diagId}" returned invalid status "${result.status}" (must be OK, WARNING, or ERROR)`,
    };
  }

  return null;
}

module.exports = { validateDiagnosticModule, validateResult, VALID_STATUSES, VALID_LAYERS };
