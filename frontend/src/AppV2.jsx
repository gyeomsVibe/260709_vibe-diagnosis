import { useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, BookOpen, Bot, ChevronRight, CircleHelp, FileWarning,
  FolderOpen, Gauge, Home, Play, RefreshCw, Settings, Sparkles, Stethoscope, Terminal, TestTube2,
} from 'lucide-react'
import BrandMark from './components/BrandMark'
import DiagnosticCard from './components/DiagnosticCard'
import MetricRing from './components/MetricRing'
import LogViewer from './components/LogViewer'
import SettingsDrawer from './components/SettingsDrawer'
import Modal from './components/Modal'
import useDashboardController from './hooks/useDashboardController'

const NAVIGATION = [
  { id: 'overview', label: '개요', icon: Home },
  { id: 'diagnostics', label: '진단', icon: TestTube2 },
  { id: 'treatments', label: '치료', icon: Stethoscope },
  { id: 'errors', label: '오류', icon: FileWarning },
  { id: 'debug', label: '로그', icon: Terminal },
]

const TECH_STACK_COLORS = ['#f7df1e', '#61dafb', '#a855f7', '#38bdf8', '#34d399', '#fb7185']

function languagePercent(language, total) {
  const value = Number(language.percent ?? language.percentage)
  return Number.isFinite(value) && value > 0 ? value : 100 / Math.max(total, 1)
}

function statusLabel(status) {
  if (status === 'OK') return '정상'
  if (status === 'WARNING') return '주의'
  if (status === 'ERROR') return '오류'
  return '진단 전'
}

function formatDate(value) {
  if (!value) return '기록 시간 없음'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ko-KR')
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${String(status || 'pending').toLowerCase()}`}>{statusLabel(status)}</span>
}

function TrendChart({ treatments }) {
  const items = treatments.slice(0, 10).reverse()
  if (!items.length) return <div className="empty-chart">치료 원장 데이터가 없습니다.</div>
  const width = 520
  const height = 150
  const step = items.length > 1 ? width / (items.length - 1) : width
  const score = (item) => item.maturity === 'VERIFIED_RESULT' ? 1 : item.maturity === 'ROLLED_BACK' ? 0.45 : 0.18
  const points = items.map((item, index) => `${index * step},${height - score(item) * 112 - 18}`).join(' ')
  return (
    <div className="trend-chart" aria-label="최근 치료 검증 추세">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity=".35" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs>
        <line x1="0" y1="25" x2={width} y2="25" className="chart-grid" />
        <line x1="0" y1="75" x2={width} y2="75" className="chart-grid" />
        <line x1="0" y1="125" x2={width} y2="125" className="chart-grid" />
        <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#trendFill)" />
        <polyline points={points} className="chart-line" />
        {items.map((item, index) => <circle key={`${item.at || index}-${item.diagId || index}`} cx={index * step} cy={height - score(item) * 112 - 18} r="4" className={item.maturity === 'VERIFIED_RESULT' ? 'chart-point-ok' : 'chart-point-warn'} />)}
      </svg>
      <div className="chart-legend"><span><i className="legend-ok" />검증 완치</span><span><i className="legend-warn" />롤백·미완료</span></div>
    </div>
  )
}

function PanelHeader({ eyebrow, title, action }) {
  return <header className="panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</header>
}

export default function AppV2() {
  const clinic = useDashboardController()
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedDiagId, setSelectedDiagId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const filteredDiagnostics = useMemo(() => clinic.diagnostics.filter((diagnostic) => {
    if (activeFilter === 'all') return true
    return (clinic.lastResults[diagnostic.id]?.status || 'PENDING').toLowerCase() === activeFilter
  }), [activeFilter, clinic.diagnostics, clinic.lastResults])
  const selectedDiagnostic = clinic.diagnostics.find((item) => item.id === selectedDiagId)
  const selectedResult = selectedDiagId ? clinic.lastResults[selectedDiagId] : null
  const failingCount = clinic.summary.error + clinic.summary.warning
  const latestLog = selectedResult?.errorMessage || selectedResult?.stderr || selectedResult?.stdout || '진단 항목을 선택하면 원시 실행 로그가 표시됩니다.'
  const techStack = clinic.projectExplain?.languages || []

  const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const confirmCureAll = () => {
    if (!failingCount) return
    if (window.confirm(`실패한 진단 ${failingCount}건을 치료합니다. 회귀가 감지되면 자동 롤백합니다. 계속할까요?`)) clinic.cureAll()
  }

  return (
    <div className="clinic-app">
      <a className="skip-link" href="#main-content">본문으로 이동</a>
      <aside className="side-rail" aria-label="대시보드 탐색">
        <a href="/v2" className="rail-brand" aria-label="Vibe Clinic V2 홈"><BrandMark compact variant="navy" /></a>
        <nav>{NAVIGATION.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => jumpTo(id)} title={label} aria-label={label}><Icon size={19} /></button>)}</nav>
        <div className="rail-bottom">
          <button type="button" onClick={() => setSettingsOpen(true)} title="설정" aria-label="설정 열기"><Settings size={19} /></button>
          <button type="button" onClick={() => setHelpOpen(true)} title="도움말" aria-label="도움말 열기"><CircleHelp size={19} /></button>
        </div>
      </aside>

      <main id="main-content" className="main-stage">
        <header className="topbar">
          <div><BrandMark variant="navy" /><p className="project-path" title={clinic.currentProjectDir}>{clinic.currentProjectDir || '프로젝트 정보를 불러오는 중입니다.'}</p></div>
          <div className="topbar-actions">
            <a className="version-switch" href="/v1">V1 대시보드</a>
            <StatusBadge status={clinic.overallStatus} />
            <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="설정 열기" title="설정"><Settings size={18} /></button>
          </div>
        </header>

        <section id="overview" className="command-strip" aria-label="진단 실행 제어">
          <div><p className="eyebrow">실시간 관제</p><h1>코드 건강 관제센터</h1><p>실제 진단과 치료 기록만 바탕으로 현재 상태를 보여드립니다.</p></div>
          <div className="command-actions">
            <button className="button button-primary" type="button" onClick={clinic.runDiagnostics} disabled={clinic.busy.diagnostics}><Play size={17} />{clinic.busy.diagnostics ? '진단 중…' : '진단 실행'}</button>
            <button className="button button-danger" type="button" onClick={confirmCureAll} disabled={!failingCount || clinic.busy.cureAll}><Stethoscope size={17} />{clinic.busy.cureAll ? '치료 중…' : `치료${failingCount ? ` ${failingCount}` : ''}`}</button>
          </div>
        </section>

        <section className="metric-grid" aria-label="핵심 지표">
          <MetricRing label="코드 건강도" value={clinic.metrics.health} detail={clinic.hasRun ? `${clinic.summary.ok}/${clinic.summary.total}개 진단 정상` : '진단 실행 후 계산'} tone="cyan" />
          <MetricRing label="진단 실행 범위" value={clinic.metrics.coverage} detail={clinic.hasRun ? `${Object.keys(clinic.lastResults).length}/${clinic.diagnostics.length}개 실행 완료` : '진단 실행 범위 기준'} tone="violet" />
          <MetricRing label="검증된 치료" value={clinic.metrics.treatmentRate} detail={clinic.treatments.length ? '치료 기록 중 검증 완료 비율' : '검증 치료 기록 없음'} tone="blue" />
        </section>

        <section className="dashboard-grid">
          <article id="diagnostics" className="panel panel-diagnostics">
            <PanelHeader eyebrow="실시간 코드 진단" title="정밀 진단" action={<button className="text-button" type="button" onClick={clinic.runDiagnostics} disabled={clinic.busy.diagnostics}><RefreshCw size={15} />새로 실행</button>} />
            <div className="filter-row" role="group" aria-label="진단 상태 필터">
              {['all', 'ok', 'warning', 'error', 'pending'].map((filter) => <button key={filter} type="button" className={activeFilter === filter ? 'active' : ''} onClick={() => setActiveFilter(filter)}>{filter === 'all' ? `전체 ${clinic.diagnostics.length}` : `${statusLabel(filter.toUpperCase())} ${clinic.diagnostics.filter((item) => (clinic.lastResults[item.id]?.status || 'PENDING').toLowerCase() === filter).length}`}</button>)}
            </div>
            <div className="diagnostic-list">{filteredDiagnostics.length ? filteredDiagnostics.map((diagnostic) => <DiagnosticCard key={diagnostic.id} diagnostic={diagnostic} result={clinic.lastResults[diagnostic.id]} selected={diagnostic.id === selectedDiagId} onSelect={() => setSelectedDiagId(diagnostic.id)} />) : <div className="empty-state">해당 상태의 진단이 없습니다.</div>}</div>
          </article>

          <article id="treatments" className="panel panel-trends">
            <PanelHeader eyebrow="치료 성과 흐름" title="치료 검증 추세" action={<span className="data-source">기록 기반</span>} />
            <TrendChart treatments={clinic.treatments} />
            <div className="ledger-list">{clinic.treatments.slice(0, 4).map((item, index) => <div className="ledger-item" key={`${item.at || index}-${item.diagId || index}`}><span className={`ledger-dot maturity-${String(item.maturity || 'unknown').toLowerCase()}`} /><div><strong>{item.diagId || '진단 ID 없음'}</strong><small>{formatDate(item.at)}</small></div><em>{item.maturity || item.strategy || '기록'}</em></div>)}{!clinic.treatments.length && <div className="empty-state">치료 기록이 쌓이면 추세를 표시합니다.</div>}</div>
          </article>

          <article id="errors" className="panel panel-errors">
            <PanelHeader eyebrow="오류 징후 탐지" title="오류 패턴" action={<span className="count-badge">{clinic.errorPatterns.length}</span>} />
            <div className="error-list">{clinic.errorPatterns.map((filename) => <button type="button" key={typeof filename === 'string' ? filename : filename.name} onClick={() => clinic.readErrorPattern(typeof filename === 'string' ? filename : filename.name)}><AlertTriangle size={15} /><span>{typeof filename === 'string' ? filename : filename.name}</span><ChevronRight size={14} /></button>)}{!clinic.errorPatterns.length && <div className="empty-state">등록된 오류 패턴이 없습니다.</div>}</div>
          </article>

          <article className="panel panel-project">
            <PanelHeader eyebrow="프로젝트 분석" title="AI 프로젝트 분석" action={<button className="text-button" type="button" onClick={() => clinic.explainProject(Boolean(clinic.projectExplain))} disabled={clinic.busy.explain}><Bot size={15} />{clinic.busy.explain ? '분석 중…' : '분석 실행'}</button>} />
            {clinic.projectExplain?.success ? <div className="project-analysis"><p>{clinic.projectExplain.summary}</p>{clinic.projectExplain.details && <small>{clinic.projectExplain.details}</small>}{techStack.length > 0 && <section className="tech-stack" aria-label="기술 스택"><strong>기술 스택</strong><div className="tech-stack-bar">{techStack.map((language, index) => { const percent = languagePercent(language, techStack.length); return <span key={language.name || language.label || index} style={{ flex: Math.max(percent, 4), backgroundColor: TECH_STACK_COLORS[index % TECH_STACK_COLORS.length] }} title={`${language.name || language.label || '기술'} ${Math.round(percent)}%`} /> })}</div><div className="tech-stack-list">{techStack.map((language, index) => { const percent = languagePercent(language, techStack.length); return <span key={language.name || language.label || index}><i style={{ backgroundColor: TECH_STACK_COLORS[index % TECH_STACK_COLORS.length] }} />{language.name || language.label || '기술'} <b>{Math.round(percent)}%</b></span> })}</div></section>}</div> : <div className="project-analysis project-analysis-empty"><p>프로젝트 구조와 기술 스택을 직접 분석합니다.</p><small>AI 사용량을 보호하기 위해 자동 실행하지 않습니다. 필요할 때만 분석 실행을 눌러 주세요.</small></div>}
          </article>

          <article id="debug" className="panel panel-debug">
            <PanelHeader eyebrow="상세 실행 기록" title={selectedDiagnostic ? selectedDiagnostic.name || selectedDiagnostic.id : '실시간 실행 로그'} action={selectedResult && <StatusBadge status={selectedResult.status} />} />
            {/* confidence 는 실패 재현성 지표라 정상 진단에는 없다. 없을 때 '미확인'을
                띄우면 정상인 진단이 검증되지 않은 것처럼 읽히므로 아예 표시하지 않는다. */}
            {selectedDiagnostic && <div className="debug-summary"><span>{selectedDiagnostic.id}</span><span>{selectedDiagnostic.layer}</span>{selectedResult?.confidence && <span>{selectedResult.confidence}</span>}</div>}
            {selectedResult?.details && <p className="debug-details">{selectedResult.details}</p>}
            {/* 계약상 causeHypotheses 는 { cause, likelihood, signal } 객체 배열이다.
                객체를 그대로 렌더링하면 React 가 throw 해 대시보드 전체가 언마운트된다. */}
            {selectedResult?.causeHypotheses?.length > 0 && <ul className="hypothesis-list">{selectedResult.causeHypotheses.map((hypothesis, index) => <li key={`${hypothesis?.cause ?? 'cause'}-${index}`}>{typeof hypothesis === 'string' ? hypothesis : <><strong>{hypothesis.likelihood}</strong>{' · '}{hypothesis.cause}{hypothesis.signal && <span className="hypothesis-signal"> — {hypothesis.signal}</span>}</>}</li>)}</ul>}
            <LogViewer content={latestLog} />
            {selectedResult && ['ERROR', 'WARNING'].includes(selectedResult.status) && <button className="button button-primary repair-button" type="button" onClick={() => clinic.proposeRepair(selectedDiagId)} disabled={clinic.busy.propose || clinic.repairStates[selectedDiagId] === 'repairing'}><Sparkles size={16} />{clinic.repairStates[selectedDiagId] === 'repairing' ? '치료 제안 생성 중…' : 'AI 치료 처방 요청'}</button>}
          </article>
        </section>
      </main>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} clinic={clinic} />

      <div className={`toast ${clinic.toast.show ? 'is-visible' : ''} toast-${clinic.toast.type}`} role="status" aria-live="polite">{clinic.toast.message}</div>

      <Modal open={Boolean(clinic.selectedErrorPattern)} title={clinic.selectedErrorPattern?.filename || '오류 패턴'} onClose={() => clinic.setSelectedErrorPattern(null)} wide><pre className="document-view">{clinic.selectedErrorPattern?.content}</pre></Modal>
      <Modal open={Boolean(clinic.pendingProposal)} title="AI 치료 변경 제안" description={clinic.pendingProposal?.summary} onClose={() => clinic.setPendingProposal(null)} wide><div className="proposal-files">{(clinic.pendingProposal?.repairedFiles || []).map((file) => <section key={file.path}><h3>{file.delete ? '삭제 예정' : '수정 예정'} · {file.path}</h3>{!file.delete && <pre>{file.content}</pre>}</section>)}</div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => clinic.setPendingProposal(null)}>보류</button><button className="button button-primary" type="button" onClick={clinic.applyRepair} disabled={clinic.busy.apply}><Sparkles size={16} />{clinic.busy.apply ? '적용·검증 중…' : '승인 후 적용'}</button></div></Modal>
      <Modal open={Boolean(clinic.manualRx)} title={`수동 처방전 · ${clinic.manualRx?.diagId || ''}`} description={clinic.manualRx?.summary} onClose={() => clinic.setManualRx(null)}>{(clinic.manualRx?.prescription || []).map((step, index) => <div className="prescription-step" key={`${step}-${index}`}><span>{index + 1}</span><p>{step}</p></div>)}<div className="modal-actions"><button className="button button-primary" type="button" onClick={() => { clinic.setManualRx(null); clinic.runDiagnostics() }}>조치 완료 후 재진단</button></div></Modal>
      <Modal open={Boolean(clinic.cureAllReport)} title="치료 검증 리포트" onClose={() => clinic.setCureAllReport(null)} wide>{clinic.cureAllReport?.summary && <div className="report-grid">{Object.entries(clinic.cureAllReport.summary).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>}<pre className="document-view compact">{JSON.stringify(clinic.cureAllReport?.results || clinic.cureAllReport?.items || [], null, 2)}</pre></Modal>
      {/* 웹 내장 폴더 탐색 모달 (OS 대화창 대체 — 항상 대시보드 안에 뜬다) */}
      <Modal open={clinic.folderBrowser.open} title="대상 프로젝트 폴더 탐색" description={clinic.folderBrowser.path || '드라이브를 선택하세요'} onClose={clinic.closeFolderBrowser}>
        {clinic.folderBrowser.error && <p className="feedback error">{clinic.folderBrowser.error}</p>}
        {clinic.folderBrowser.loading ? (
          <div className="empty-state">폴더 목록을 불러오는 중…</div>
        ) : (
          <div className="folder-browser-list">
            {clinic.folderBrowser.parent && (
              <button type="button" className="folder-browser-item" onClick={() => clinic.browseFolder(clinic.folderBrowser.parent)}>
                <FolderOpen size={15} /><span>.. (상위 폴더)</span>
              </button>
            )}
            {(clinic.folderBrowser.roots.length ? clinic.folderBrowser.roots : clinic.folderBrowser.dirs).map((entry) => (
              <button type="button" className="folder-browser-item" key={entry.path} onClick={() => clinic.browseFolder(entry.path)}>
                <FolderOpen size={15} /><span>{entry.name}</span><ChevronRight size={14} />
              </button>
            ))}
            {!clinic.folderBrowser.roots.length && !clinic.folderBrowser.dirs.length && !clinic.folderBrowser.error && (
              <div className="empty-state">하위 폴더가 없습니다.</div>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={clinic.closeFolderBrowser}>취소</button>
          <button className="button button-primary" type="button" disabled={!clinic.folderBrowser.path} onClick={clinic.confirmFolderBrowser}>
            이 폴더를 대상 프로젝트로 선택
          </button>
        </div>
      </Modal>

      <Modal open={helpOpen} title="Vibe Clinic V2 사용 안내" onClose={() => setHelpOpen(false)}><ol className="help-list"><li><Gauge size={18} /><div><strong>실데이터 지표</strong><p>진단 전에는 임의 점수 대신 데이터 없음으로 표시합니다.</p></div></li><li><Activity size={18} /><div><strong>진단과 치료</strong><p>진단 카드를 선택하면 원인·로그·치료 요청을 한곳에서 확인합니다.</p></div></li><li><BookOpen size={18} /><div><strong>V1 병행 운영</strong><p>상단 V1 대시보드 버튼으로 언제든 기존 화면으로 돌아갈 수 있습니다.</p></div></li></ol></Modal>
    </div>
  )
}
