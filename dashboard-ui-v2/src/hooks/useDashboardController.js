import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dashboardApi } from '../api/dashboardApi'

const EMPTY_SUMMARY = { total: 0, ok: 0, warning: 0, error: 0 }

export default function useDashboardController() {
  const [projects, setProjects] = useState([])
  const [currentProjectDir, setCurrentProjectDir] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [diagnostics, setDiagnostics] = useState([])
  const [lastResults, setLastResults] = useState({})
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [healthPercent, setHealthPercent] = useState(null)
  const [overallStatus, setOverallStatus] = useState('PENDING')
  const [hasRun, setHasRun] = useState(false)
  const [errorPatterns, setErrorPatterns] = useState([])
  const [selectedErrorPattern, setSelectedErrorPattern] = useState(null)
  const [treatments, setTreatments] = useState([])
  const [byok, setByok] = useState({ provider: 'gemini', apiKey: '', model: 'gemini-3.5-flash' })
  const [providers, setProviders] = useState([])
  const [hasSavedKey, setHasSavedKey] = useState(false)
  const [byokFeedback, setByokFeedback] = useState(null)
  const [projectExplain, setProjectExplain] = useState(null)
  const [pendingProposal, setPendingProposal] = useState(null)
  const [manualRx, setManualRx] = useState(null)
  const [cureAllReport, setCureAllReport] = useState(null)
  const [repairStates, setRepairStates] = useState({})
  const [busy, setBusy] = useState({ diagnostics: false, initialize: false, explain: false, propose: false, apply: false, cureAll: false })
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' })
  const toastTimerRef = useRef(null)

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ show: true, type, message })
    toastTimerRef.current = setTimeout(() => setToast((current) => ({ ...current, show: false })), 3200)
  }, [])

  useEffect(() => () => toastTimerRef.current && clearTimeout(toastTimerRef.current), [])

  const loadProjects = useCallback(async () => {
    try {
      const data = await dashboardApi.listProjects()
      setProjects(data.projectOptions || [])
      if (data.currentProjectDir) {
        setCurrentProjectDir(data.currentProjectDir)
        setCustomPath(data.currentProjectDir)
      }
    } catch (error) {
      showToast(error.message || '프로젝트 목록 로드 실패', 'error')
    }
  }, [showToast])

  const loadDiagnostics = useCallback(async () => {
    try {
      const data = await dashboardApi.listDiagnostics()
      setDiagnostics(Array.isArray(data) ? data : [])
      setSummary((current) => ({ ...current, total: Array.isArray(data) ? data.length : 0 }))
    } catch (error) {
      showToast(error.message || '진단 목록 로드 실패', 'error')
    }
  }, [showToast])

  const loadErrors = useCallback(async () => {
    try {
      const data = await dashboardApi.listErrors()
      setErrorPatterns(Array.isArray(data) ? data : [])
    } catch (error) {
      showToast(error.message || '오류 패턴 로드 실패', 'error')
    }
  }, [showToast])

  const loadTreatments = useCallback(async () => {
    try {
      const data = await dashboardApi.listTreatments()
      setTreatments(Array.isArray(data) ? data : [])
    } catch {
      setTreatments([])
    }
  }, [])

  const loadByok = useCallback(async () => {
    try {
      const data = await dashboardApi.getByok()
      const saved = data.byok || {}
      setByok({ provider: saved.provider || 'gemini', apiKey: '', model: saved.model || 'gemini-3.5-flash' })
      setHasSavedKey(Boolean(saved.apiKey))
      setProviders(Array.isArray(data.providers) ? data.providers : [])
    } catch (error) {
      showToast(error.message || 'AI 설정 로드 실패', 'error')
    }
  }, [showToast])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => {
    if (!currentProjectDir) return
    Promise.all([loadDiagnostics(), loadErrors(), loadTreatments(), loadByok()])
  }, [currentProjectDir, loadByok, loadDiagnostics, loadErrors, loadTreatments])

  const runDiagnostics = useCallback(async () => {
    setBusy((current) => ({ ...current, diagnostics: true }))
    try {
      const data = await dashboardApi.runDiagnostics()
      const resultMap = Object.fromEntries((data.results || []).map((result) => [result.id, result]))
      setLastResults(resultMap)
      setSummary(data.summary || EMPTY_SUMMARY)
      setHealthPercent(Number.isFinite(data.healthPercent) ? data.healthPercent : null)
      setOverallStatus(data.overallStatus || 'PENDING')
      setHasRun(true)
      showToast('진단이 완료되었습니다.')
      return data
    } catch (error) {
      showToast(error.message || '진단 실행 실패', 'error')
      return null
    } finally {
      setBusy((current) => ({ ...current, diagnostics: false }))
    }
  }, [showToast])

  const changeProject = useCallback(async (projectDir) => {
    if (!projectDir) return false
    try {
      const data = await dashboardApi.changeProject(projectDir)
      const nextPath = data.currentProjectDir || projectDir
      setCurrentProjectDir(nextPath)
      setCustomPath(nextPath)
      setLastResults({})
      setSummary(EMPTY_SUMMARY)
      setHealthPercent(null)
      setOverallStatus('PENDING')
      setHasRun(false)
      setRepairStates({})
      await Promise.all([loadDiagnostics(), loadErrors(), loadTreatments(), loadByok()])
      await runDiagnostics()
      showToast('프로젝트가 변경되었습니다.')
      return true
    } catch (error) {
      showToast(error.message || '프로젝트 전환 실패', 'error')
      return false
    }
  }, [loadByok, loadDiagnostics, loadErrors, loadTreatments, runDiagnostics, showToast])

  const selectFolder = useCallback(async () => {
    try {
      showToast('Windows 폴더 선택기를 엽니다.')
      const data = await dashboardApi.selectFolder()
      if (data.success && data.selectedPath) return changeProject(data.selectedPath)
      if (data.cancelled) showToast('폴더 선택이 취소되었습니다.', 'error')
      else if (data.error) showToast(data.error, 'error')
    } catch (error) {
      showToast(error.message || '폴더 선택기 호출 실패', 'error')
    }
    return false
  }, [changeProject, showToast])

  const initializeProject = useCallback(async () => {
    setBusy((current) => ({ ...current, initialize: true }))
    try {
      await dashboardApi.initializeProject()
      await Promise.all([loadDiagnostics(), loadErrors()])
      showToast('프로젝트 진단 도구 초기화가 완료되었습니다.')
    } catch (error) {
      showToast(error.message || '초기화 실패', 'error')
    } finally {
      setBusy((current) => ({ ...current, initialize: false }))
    }
  }, [loadDiagnostics, loadErrors, showToast])

  const saveByok = useCallback(async () => {
    try {
      await dashboardApi.saveByok(byok)
      setByokFeedback({ type: 'success', message: '저장 완료. AI 프로젝트 분석은 직접 실행해 주세요.' })
      await loadByok()
      showToast('AI 설정을 저장했습니다.')
    } catch (error) {
      setByokFeedback({ type: 'error', message: error.message || '저장 실패' })
    }
  }, [byok, loadByok, showToast])

  const explainProject = useCallback(async (force = false) => {
    setBusy((current) => ({ ...current, explain: true }))
    try {
      const data = await dashboardApi.explainProject(force)
      setProjectExplain(data)
    } catch (error) {
      setProjectExplain({ error: error.message })
      showToast(error.message || '프로젝트 분석 실패', 'error')
    } finally {
      setBusy((current) => ({ ...current, explain: false }))
    }
  }, [showToast])

  const readErrorPattern = useCallback(async (filename) => {
    try {
      const content = await dashboardApi.readError(filename)
      setSelectedErrorPattern({ filename, content })
    } catch (error) {
      showToast(error.message || '오류 패턴 열기 실패', 'error')
    }
  }, [showToast])

  const proposeRepair = useCallback(async (diagId) => {
    setBusy((current) => ({ ...current, propose: true }))
    setRepairStates((current) => ({ ...current, [diagId]: 'repairing' }))
    try {
      const data = await dashboardApi.proposeRepair(diagId)
      if (data.kind === 'MANUAL') {
        setManualRx(data)
        setRepairStates((current) => ({ ...current, [diagId]: 'idle' }))
      } else {
        setPendingProposal(data)
        setRepairStates((current) => ({ ...current, [diagId]: 'awaiting-approval' }))
      }
      showToast(data.kind === 'MANUAL' ? '수동 처방전이 발급되었습니다.' : '치료 제안이 준비되었습니다.')
    } catch (error) {
      setRepairStates((current) => ({ ...current, [diagId]: 'idle' }))
      showToast(error.message || '치료 제안 실패', 'error')
    } finally {
      setBusy((current) => ({ ...current, propose: false }))
    }
  }, [showToast])

  const applyRepair = useCallback(async () => {
    if (!pendingProposal) return
    setBusy((current) => ({ ...current, apply: true }))
    try {
      const data = await dashboardApi.applyRepair(pendingProposal.proposalId)
      setPendingProposal(null)
      if (data.maturity === 'ROLLED_BACK') {
        showToast(data.error || '회귀가 감지되어 자동 롤백했습니다.', 'error')
      } else {
        showToast(data.maturity === 'VERIFIED_RESULT' ? '완치 검증이 완료되었습니다.' : '치료를 적용했습니다.')
      }
      await Promise.all([runDiagnostics(), loadTreatments()])
    } catch (error) {
      showToast(error.message || '치료 적용 실패', 'error')
    } finally {
      setBusy((current) => ({ ...current, apply: false }))
    }
  }, [loadTreatments, pendingProposal, runDiagnostics, showToast])

  const cureAll = useCallback(async () => {
    setBusy((current) => ({ ...current, cureAll: true }))
    try {
      const data = await dashboardApi.cureAll()
      setCureAllReport(data)
      await Promise.all([runDiagnostics(), loadTreatments()])
      showToast('전체 치료 절차가 완료되었습니다.')
    } catch (error) {
      showToast(error.message || '전체 치료 실패', 'error')
    } finally {
      setBusy((current) => ({ ...current, cureAll: false }))
    }
  }, [loadTreatments, runDiagnostics, showToast])

  const metrics = useMemo(() => {
    const coverage = hasRun && diagnostics.length ? Math.round((Object.keys(lastResults).length / diagnostics.length) * 100) : null
    const completed = treatments.filter((item) => ['VERIFIED_RESULT', 'ROLLED_BACK', 'FAILED'].includes(item.maturity))
    const verified = completed.filter((item) => item.maturity === 'VERIFIED_RESULT').length
    return {
      health: hasRun ? healthPercent : null,
      coverage,
      treatmentRate: completed.length ? Math.round((verified / completed.length) * 100) : null,
    }
  }, [diagnostics.length, hasRun, healthPercent, lastResults, treatments])

  return {
    projects, currentProjectDir, customPath, setCustomPath, diagnostics, lastResults, summary, overallStatus, hasRun,
    errorPatterns, selectedErrorPattern, setSelectedErrorPattern, treatments, byok, setByok, providers, hasSavedKey,
    byokFeedback, projectExplain, pendingProposal, setPendingProposal, manualRx, setManualRx, cureAllReport,
    setCureAllReport, repairStates, busy, toast, metrics, runDiagnostics, changeProject, selectFolder,
    initializeProject, saveByok, explainProject, readErrorPattern, proposeRepair, applyRepair, cureAll,
  }
}
