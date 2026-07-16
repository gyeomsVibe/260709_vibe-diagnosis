import { ChevronRight } from 'lucide-react'

export default function DiagnosticCard({ diagnostic, result, selected, onSelect }) {
  const status = result?.status || 'PENDING'
  return (
    <button type="button" className={`diagnostic-card diagnostic-${status.toLowerCase()} ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <span className="diagnostic-state" aria-hidden="true" />
      <span className="diagnostic-main"><strong>{diagnostic.name || diagnostic.id}</strong><small>{diagnostic.id}</small></span>
      <span className="diagnostic-meta"><em>{diagnostic.layer || 'TASK'}</em>{result?.confidence && <small>{result.confidence}</small>}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  )
}