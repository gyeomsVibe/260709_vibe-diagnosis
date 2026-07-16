import navyMark from '../assets/vibe-clinic-star-navy.png'
import redMark from '../assets/vibe-clinic-star-red.png'

// 최종 브랜드 규칙(계획 문서 55 §1.2):
//  - navy(기본): 일반 헤더·기본 상태.  red(긴급): 치료 시급·긴급 확인에만 제한.
// 합성 원본(vibe-clinic-brand-final.png)은 시각 기준 원본으로만 보존하며
// 앱은 분리된 단일 마크 자산을 사용한다 (CSS 크롭 핵 금지).
const MARKS = { navy: navyMark, red: redMark }

export default function BrandMark({ variant = 'navy', compact = false }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup-compact' : ''}`}>
      <span className={`brand-symbol brand-symbol-${variant}`} aria-hidden="true"><img src={MARKS[variant] || navyMark} alt="" /></span>
      {!compact && <span className="brand-copy"><strong>Vibe Clinic</strong><small>CODE HEALTH CONTROL</small></span>}
    </div>
  )
}
