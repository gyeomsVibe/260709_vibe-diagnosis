import { useEffect, useRef } from 'react'
import { Bot, FolderOpen, ShieldCheck, Wrench, X } from 'lucide-react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function normalizeProvider(provider) {
  if (typeof provider === 'string') return { value: provider, label: provider }
  return { value: provider?.name || provider?.id || '', label: provider?.label || provider?.name || provider?.id || '알 수 없음' }
}

export default function SettingsDrawer({ open, onClose, clinic }) {
  const panelRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    previousFocusRef.current = document.activeElement
    const panel = panelRef.current
    panel?.querySelector(FOCUSABLE)?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((item) => !item.disabled)
      if (!items.length) return
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocusRef.current?.focus?.() }
  }, [onClose, open])

  if (!open) return null
  const providers = clinic.providers.length ? clinic.providers.map(normalizeProvider) : [{ value: 'gemini', label: 'Gemini' }, { value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }]
  return (
    <div className="drawer-backdrop is-open" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={panelRef} className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="panel-header"><div><p className="eyebrow">CONTROL SETTINGS</p><h2 id="settings-title">프로젝트 설정</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="설정 닫기" title="닫기"><X size={18} /></button></header>
        <section className="settings-section"><h3><FolderOpen size={16} />대상 프로젝트</h3><label>등록 프로젝트<select value={clinic.currentProjectDir} onChange={(event) => clinic.changeProject(event.target.value)}><option value="">프로젝트 선택</option>{clinic.projects.map((project) => <option key={project.path} value={project.path}>{project.name}</option>)}</select></label><label>직접 경로<input value={clinic.customPath} onChange={(event) => clinic.setCustomPath(event.target.value)} /></label><div className="button-row"><button className="button button-secondary" type="button" onClick={() => clinic.changeProject(clinic.customPath)}>경로 이동</button><button className="button button-secondary" type="button" onClick={clinic.selectFolder}><FolderOpen size={15} />폴더 선택</button></div><button className="button button-secondary full" type="button" onClick={clinic.initializeProject} disabled={clinic.busy.initialize}><Wrench size={15} />{clinic.busy.initialize ? '초기화 중…' : '진단 도구 초기화·보강'}</button></section>
        <section className="settings-section"><h3><Bot size={16} />BYOK AI 분석기</h3><label>제공자<select value={clinic.byok.provider} onChange={(event) => clinic.setByok((current) => ({ ...current, provider: event.target.value }))}>{providers.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label><label>API 키<input type="password" autoComplete="off" value={clinic.byok.apiKey} placeholder={clinic.hasSavedKey ? '저장된 키 유지 — 변경할 때만 입력' : 'API 키 입력'} onChange={(event) => clinic.setByok((current) => ({ ...current, apiKey: event.target.value }))} /></label><label>모델<input value={clinic.byok.model} onChange={(event) => clinic.setByok((current) => ({ ...current, model: event.target.value }))} /></label>{clinic.byokFeedback && <p className={`feedback ${clinic.byokFeedback.type}`}>{clinic.byokFeedback.message}</p>}<button className="button button-primary full" type="button" onClick={clinic.saveByok}><ShieldCheck size={15} />설정 저장</button></section>
      </aside>
    </div>
  )
}