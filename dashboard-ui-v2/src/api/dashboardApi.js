async function request(path, { allowStatuses = [], ...options } = {}) {
  const response = await fetch(path, options)
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok && !allowStatuses.includes(response.status)) {
    const message = typeof payload === 'object' && payload?.error
      ? payload.error
      : `요청 실패 (${response.status})`
    throw new Error(message)
  }

  return payload
}

function post(path, body, options = {}) {
  return request(path, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const dashboardApi = {
  listProjects: () => request('/api/project/list'),
  listDiagnostics: () => request('/api/list'),
  listErrors: () => request('/api/errors'),
  readError: (filename) => request(`/api/errors/${encodeURIComponent(filename)}`),
  listTreatments: () => request('/api/treatments'),
  getByok: () => request('/api/byok/config'),
  explainProject: (force = false) => request(`/api/project/explain${force ? '?force=true' : ''}`),
  runDiagnostics: () => post('/api/run'),
  changeProject: (projectDir) => post('/api/project/change', { projectDir }),
  selectFolder: () => post('/api/project/select'),
  initializeProject: () => post('/api/project/init'),
  saveByok: (config) => post('/api/byok/save', config),
  proposeRepair: (diagId) => post('/api/repair/propose', { diagId }),
  // A regression-safe repair is intentionally reported as HTTP 409.
  // Keep that response body so the controller can show the rollback result
  // and refresh the diagnostic state instead of treating it as transport loss.
  applyRepair: (proposalId) => post('/api/repair/apply', { proposalId }, { allowStatuses: [409] }),
  cureAll: () => post('/api/repair/cure-all', { strategy: 'auto' }),
}
