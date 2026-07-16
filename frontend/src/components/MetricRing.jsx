export default function MetricRing({ label, value, detail, tone = 'cyan' }) {
  const numericValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null
  const style = numericValue === null ? undefined : { '--metric-value': `${numericValue * 3.6}deg` }
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-heading"><span>{label}</span><span className="live-dot" aria-label="실데이터 지표" title="실데이터 지표" /></div>
      <div className="metric-ring" style={style} aria-label={`${label}: ${numericValue === null ? '데이터 없음' : `${numericValue}%`}`}>
        <div className="metric-ring-core"><span className="metric-value">{numericValue === null ? '—' : `${numericValue}%`}</span><span className="metric-caption">{numericValue === null ? '데이터 없음' : 'LIVE SCORE'}</span></div>
      </div>
      <p>{detail}</p>
    </article>
  )
}
