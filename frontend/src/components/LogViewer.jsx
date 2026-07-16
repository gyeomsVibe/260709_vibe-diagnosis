import { useEffect, useState } from 'react'

const CHUNK_SIZE = 12_000

export default function LogViewer({ content }) {
  const text = String(content || '')
  const [start, setStart] = useState(() => Math.max(0, text.length - CHUNK_SIZE))

  useEffect(() => {
    setStart(Math.max(0, text.length - CHUNK_SIZE))
  }, [text])

  const hasEarlierContent = start > 0
  return (
    <div className="log-viewer">
      {hasEarlierContent && <button className="text-button log-more-button" type="button" onClick={() => setStart((current) => Math.max(0, current - CHUNK_SIZE))}>이전 로그 12KB 더 보기</button>}
      <pre className="terminal-output">{text.slice(start)}</pre>
      {hasEarlierContent && <p className="log-truncation-note">최신 로그부터 표시합니다. 이전 로그를 단계적으로 펼칠 수 있습니다.</p>}
    </div>
  )
}