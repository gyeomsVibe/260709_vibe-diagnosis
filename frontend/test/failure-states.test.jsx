/**
 * 실패 상태 렌더링 회귀 테스트
 *
 * 2026-07-24 하루에 새어 나간 결함 3건은 전부 이 계층에 있었다. 백엔드 테스트 48개와
 * 린트는 전부 통과한 상태였다. 공통점은 "정상 경로에는 존재하지 않고 실패했을 때만
 * 생기는 데이터"를 화면이 처음 만나 깨졌다는 것이다.
 * 그래서 이 파일의 모든 테스트는 실패 상태를 재현한 뒤 화면을 확인한다.
 */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import DiagnosticCard from '../src/components/DiagnosticCard'
import SettingsDrawer from '../src/components/SettingsDrawer'

afterEach(cleanup)

// AppV2 는 컨트롤러 훅 하나에서 모든 상태를 받는다. 훅을 대체하면 임의의 상태를 그릴 수 있다.
const clinicState = (overrides = {}) => ({
  diagnostics: [],
  lastResults: {},
  summary: { total: 0, ok: 0, warning: 0, error: 0 },
  metrics: { health: 0, coverage: 0, treatmentRate: 0 },
  hasRun: false,
  treatments: [],
  errorPatterns: [],
  projectExplain: null,
  currentProjectDir: '/tmp/project',
  overallStatus: 'OK',
  busy: { diagnostics: false, initialize: false, explain: false, propose: false, apply: false, cureAll: false },
  toast: { show: false, type: 'success', message: '' },
  repairStates: {},
  pendingProposal: null,
  manualRx: null,
  cureAllReport: null,
  selectedErrorPattern: null,
  folderBrowser: { open: false, path: '', parent: null, roots: [], dirs: [], loading: false, error: '' },
  providers: [],
  projects: [],
  customPath: '',
  byok: { provider: 'gemini', apiKey: '', model: '' },
  hasSavedKey: false,
  byokFeedback: null,
  runDiagnostics: vi.fn(),
  cureAll: vi.fn(),
  proposeRepair: vi.fn(),
  applyRepair: vi.fn(),
  explainProject: vi.fn(),
  readErrorPattern: vi.fn(),
  setSelectedErrorPattern: vi.fn(),
  setPendingProposal: vi.fn(),
  setManualRx: vi.fn(),
  setCureAllReport: vi.fn(),
  changeProject: vi.fn(),
  setCustomPath: vi.fn(),
  openFolderBrowser: vi.fn(),
  closeFolderBrowser: vi.fn(),
  browseFolder: vi.fn(),
  confirmFolder: vi.fn(),
  initializeProject: vi.fn(),
  setByok: vi.fn(),
  saveByok: vi.fn(),
  ...overrides,
})

let currentClinic = clinicState()
vi.mock('../src/hooks/useDashboardController', () => ({
  default: () => currentClinic,
}))

const { default: AppV2 } = await import('../src/AppV2')

const renderApp = (overrides) => {
  currentClinic = clinicState(overrides)
  return render(<AppV2 />)
}

describe('실패한 진단을 선택했을 때', () => {
  const failing = {
    diagnostics: [{ id: 'task-001', name: 'Basic Arithmetic', layer: 'TASK', linkedTask: 'TASK-001' }],
    lastResults: {
      'task-001': {
        status: 'ERROR',
        details: 'subtract(10,4) = 14, 기대값 6',
        confidence: 'CONFIRMED',
        // 계약상 객체 배열이다. 예전 코드는 이 객체를 그대로 자식으로 넣어 앱을 통째로 죽였다.
        causeHypotheses: [
          { cause: 'LOGIC_ASSERTION_FAILURE', likelihood: 'HIGH', signal: 'expected vs observed' },
        ],
      },
    },
    hasRun: true,
    summary: { total: 1, ok: 0, warning: 0, error: 1 },
  }

  test('원인 후보가 객체 배열이어도 앱이 죽지 않고 필드가 보인다', () => {
    renderApp(failing)
    // 카드를 선택해야 상세 패널이 그려진다.
    fireEvent.click(screen.getByText('Basic Arithmetic').closest('button'))

    expect(screen.getByText(/LOGIC_ASSERTION_FAILURE/)).toBeTruthy()
    expect(screen.getByText(/HIGH/)).toBeTruthy()
    expect(screen.getByText(/expected vs observed/)).toBeTruthy()
    // 객체가 그대로 문자열화되면 이 흔적이 남는다.
    expect(document.body.textContent).not.toContain('[object Object]')
  })

  test('원인 후보가 문자열 배열로 와도 죽지 않는다', () => {
    renderApp({
      ...failing,
      lastResults: {
        'task-001': { ...failing.lastResults['task-001'], causeHypotheses: ['그냥 문자열 원인'] },
      },
    })
    fireEvent.click(screen.getByText('Basic Arithmetic').closest('button'))
    expect(screen.getByText(/그냥 문자열 원인/)).toBeTruthy()
  })

  test('실패한 진단에는 재현 확신도가 표시된다', () => {
    renderApp(failing)
    fireEvent.click(screen.getByText('Basic Arithmetic').closest('button'))
    expect(screen.getAllByText('CONFIRMED').length).toBeGreaterThan(0)
  })
})

describe('정상 진단을 선택했을 때', () => {
  test('confidence 가 없으므로 "미확인" 을 띄우지 않는다', () => {
    renderApp({
      diagnostics: [{ id: 'ok-1', name: 'Healthy Check', layer: 'TASK' }],
      lastResults: { 'ok-1': { status: 'OK', details: '정상' } },
      hasRun: true,
      summary: { total: 1, ok: 1, warning: 0, error: 0 },
    })
    fireEvent.click(screen.getByText('Healthy Check').closest('button'))
    // 정상인 진단이 "미확인" 으로 보이면 검증되지 않은 것처럼 읽힌다.
    expect(document.body.textContent).not.toContain('미확인')
  })
})

describe('전체 치료 리포트', () => {
  test('실제 분류 필드를 읽어 진단 ID 와 사유를 보여준다', () => {
    renderApp({
      cureAllReport: {
        summary: { total: 2, cured: 1, rolledBack: 0, manual: 1, blocked: 0, unprescribable: 0, held: 0 },
        cured: [{ diagId: 'calc-engine', verifiedStatus: 'OK', summary: '완치 검증됨', filesModified: ['calculator.js'] }],
        manual: [{ diagId: 'quota-limit', summary: '수동 조치 필요', prescription: ['한도를 올린다'] }],
        rolledBack: [], blocked: [], unprescribable: [], held: [],
        finalResults: [],
      },
    })

    // 예전 코드는 존재하지 않는 results/items 를 찾아 항상 빈 배열만 찍었다.
    expect(screen.getByText('calc-engine')).toBeTruthy()
    expect(screen.getByText('quota-limit')).toBeTruthy()
    expect(screen.getByText(/완치 검증됨/)).toBeTruthy()
    expect(screen.getByText(/한도를 올린다/)).toBeTruthy()
  })

  test('분류가 모두 비면 빈 상태를 안내한다', () => {
    renderApp({
      cureAllReport: {
        summary: { total: 0, cured: 0, rolledBack: 0, manual: 0, blocked: 0, unprescribable: 0, held: 0 },
        cured: [], rolledBack: [], manual: [], blocked: [], unprescribable: [], held: [],
      },
    })
    expect(screen.getByText(/분류된 치료 결과가 없습니다/)).toBeTruthy()
  })
})

describe('진단 카드', () => {
  test('연결된 작업(linkedTask)을 보여준다', () => {
    render(<DiagnosticCard diagnostic={{ id: 'a', name: 'A', layer: 'TASK', linkedTask: 'TASK-001' }} onSelect={() => {}} />)
    expect(screen.getByText(/TASK-001/)).toBeTruthy()
  })

  test('연결된 작업이 없으면 아무것도 덧붙이지 않는다', () => {
    render(<DiagnosticCard diagnostic={{ id: 'a', name: 'A', layer: 'TASK' }} onSelect={() => {}} />)
    expect(document.body.textContent).not.toContain('🔗')
  })
})

describe('설정 드로어의 AI 서비스 선택', () => {
  test('표시명이 아니라 id 를 저장값으로 쓴다', () => {
    const clinic = clinicState({
      providers: [
        { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-2.0-flash' },
        { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-sonnet-5' },
      ],
      byok: { provider: 'gemini', apiKey: '', model: '' },
    })
    render(<SettingsDrawer open onClose={() => {}} clinic={clinic} />)

    const select = screen.getByRole('combobox', { name: /AI 서비스/ })
    const options = within(select).getAllByRole('option')
    const values = options.map((option) => option.value)

    // 표시명을 저장하면 백엔드의 PROVIDERS[provider] 조회가 실패해 AI 기능이 통째로 죽는다.
    expect(values).toContain('gemini')
    expect(values).toContain('anthropic')
    expect(values).not.toContain('Google Gemini')
    // 사람에게는 표시명이 보여야 한다.
    expect(options.map((option) => option.textContent)).toContain('Google Gemini')
  })

  test('선택한 서비스의 기본 모델을 입력 힌트로 보여준다', () => {
    const clinic = clinicState({
      providers: [{ id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-sonnet-5' }],
      byok: { provider: 'anthropic', apiKey: '', model: '' },
    })
    render(<SettingsDrawer open onClose={() => {}} clinic={clinic} />)
    expect(screen.getByPlaceholderText('claude-sonnet-5')).toBeTruthy()
  })
})
