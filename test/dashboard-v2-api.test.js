const assert = require('node:assert/strict')
const test = require('node:test')
const { pathToFileURL } = require('node:url')

const apiUrl = pathToFileURL(require('node:path').join(__dirname, '..', 'dashboard-ui-v2', 'src', 'api', 'dashboardApi.js')).href

async function loadApi() {
  return import(`${apiUrl}?test=${Date.now()}-${Math.random()}`)
}

test('V2 keeps the HTTP 409 rollback payload for repair results', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    maturity: 'ROLLED_BACK',
    error: 'Regression detected',
  }), { status: 409, headers: { 'content-type': 'application/json' } })

  try {
    const { dashboardApi } = await loadApi()
    const result = await dashboardApi.applyRepair('proposal-1')
    assert.equal(result.maturity, 'ROLLED_BACK')
    assert.equal(result.error, 'Regression detected')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('V2 still rejects unexpected failed API responses', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Bad request' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  })

  try {
    const { dashboardApi } = await loadApi()
    await assert.rejects(() => dashboardApi.applyRepair('proposal-1'), /Bad request/)
  } finally {
    globalThis.fetch = originalFetch
  }
})