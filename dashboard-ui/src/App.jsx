import React, { useState, useEffect, useRef } from 'react';
import { useIntersectionObserver } from './useIntersectionObserver';
import { 
  Activity, 
  Settings, 
  FolderOpen, 
  ChevronRight, 
  Play, 
  HelpCircle, 
  Save, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Terminal, 
  Sparkles,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

// --- Helper: Terminal Log Stream Chunk Renderer ---
function TerminalLogBox({ text }) {
  const [visibleText, setVisibleText] = useState('');
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!text) {
      setVisibleText('');
      return;
    }

    let index = 0;
    const chunkSize = 2500;
    setVisibleText('');

    const renderNextChunk = () => {
      if (index >= text.length) return;
      const nextIndex = Math.min(index + chunkSize, text.length);
      const chunk = text.slice(index, nextIndex);
      setVisibleText(prev => prev + chunk);
      index = nextIndex;
      animationFrameRef.current = requestAnimationFrame(renderNextChunk);
    };

    renderNextChunk();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [text]);

  return (
    <div className="terminal-view" style={{ maxHeight: '200px' }}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {visibleText || '상세 로그가 비어 있습니다.'}
      </pre>
    </div>
  );
}

// --- Component: Virtualized Diagnostic Card ---
function DiagnosticCard({ diag, result, isActive, onClick }) {
  const [ref, isIntersecting] = useIntersectionObserver();
  const status = result ? result.status : 'PENDING';
  const layerClass = `badge-${diag.layer?.toLowerCase() || 'task'}`;

  return (
    <div 
      ref={ref}
      onClick={onClick}
      className={`card-item glass ${isIntersecting ? '' : 'dom-hidden'} status-${status.toLowerCase()} ${isActive ? 'active' : ''}`}
    >
      {isIntersecting && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
              {diag.name || diag.id}
            </span>
            <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {result?.confidence === 'SUSPECTED' && (
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: '8px', padding: '1px 6px', whiteSpace: 'nowrap' }}>간헐 의심</span>
              )}
              {result?.confidence === 'CONFIRMED' && result?.status !== 'OK' && (
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--err)', background: 'var(--err-bg)', border: '1px solid var(--err-border)', borderRadius: '8px', padding: '1px 6px', whiteSpace: 'nowrap' }}>확진 (재현 2/2)</span>
              )}
              <span className={`card-badge ${layerClass}`}>{diag.layer}</span>
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'monospace' }}>
            {diag.id}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              backgroundColor: status === 'OK' ? 'var(--ok)' : status === 'WARNING' ? 'var(--warn)' : status === 'ERROR' ? 'var(--err)' : 'var(--text3)'
            }}></span>
            <span style={{ fontSize: '11px', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {result ? result.details : '진단 대기'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main App Component ---
function App() {
  const [projects, setProjects] = useState([]);
  const [currentProjectDir, setCurrentProjectDir] = useState('');
  const [customPath, setCustomPath] = useState('');
  
  const [byok, setByok] = useState({ provider: 'gemini', apiKey: '', model: 'gemini-3.5-flash' });
  const [providers, setProviders] = useState([]);
  const [byokEnabled, setByokEnabled] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [byokFeedback, setByokFeedback] = useState({ type: '', text: '' });
  const [apiAccordionOpen, setApiAccordionOpen] = useState(false);

  const [diagnostics, setDiagnostics] = useState([]);
  const [lastResults, setLastResults] = useState({});
  const [summary, setSummary] = useState({ total: 0, ok: 0, warning: 0, error: 0 });
  const [healthPercent, setHealthPercent] = useState(0);
  const [overallStatus, setOverallStatus] = useState('PENDING');

  const [projectExplain, setProjectExplain] = useState(null);
  const [isProjectExplaining, setIsProjectExplaining] = useState(false);
  
  const [errorPatterns, setErrorPatterns] = useState([]);
  const [selectedErrorPattern, setSelectedErrorPattern] = useState(null);
  
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedDiagId, setSelectedDiagId] = useState(null);
  const [repairStates, setRepairStates] = useState({});
  const [pendingProposal, setPendingProposal] = useState(null);
  const [manualRx, setManualRx] = useState(null); // 수동 처방전 (행동 처방)
  const [treatments, setTreatments] = useState([]); // P4 치료 원장 (최신순)

  // States for UI widgets
  const [isDrawerActive, setIsDrawerActive] = useState(false);
  const [isHelpActive, setIsHelpActive] = useState(false);
  const [isDiagRunning, setIsDiagRunning] = useState(false);
  const [isRepairProposing, setIsRepairProposing] = useState(false);
  const [isRepairApplying, setIsRepairApplying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCureAllRunning, setIsCureAllRunning] = useState(false); // 💉 전체 치료 진행 중
  const [cureAllReport, setCureAllReport] = useState(null);        // 💉 치료 리포트 모달 데이터

  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  // Fetch initial configuration
  useEffect(() => {
    fetchProjectList();
  }, []);

  useEffect(() => {
    if (currentProjectDir) {
      fetchDiagnostics();
      fetchErrorPatterns();
      fetchByokConfig();
      // AI 프로젝트 설명은 자동 호출하지 않음 — 429 쿼터 방지.
      // 사용자가 직접 "🔄 로컬 분석기 구동" 버튼을 눌러 실행.
      fetchTreatments();
    }
  }, [currentProjectDir]);

  const fetchTreatments = async () => {
    try {
      const res = await fetch('/api/treatments');
      const data = await res.json();
      if (Array.isArray(data)) setTreatments(data);
    } catch (err) {
      // 치료 원장은 없을 수 있음 — 조용히 무시
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const fetchProjectList = async () => {
    try {
      const res = await fetch('/api/project/list');
      const data = await res.json();
      if (data.projectOptions) {
        setProjects(data.projectOptions);
      }
      if (data.currentProjectDir) {
        setCurrentProjectDir(data.currentProjectDir);
        setCustomPath(data.currentProjectDir);
      }
    } catch (err) {
      showToast('프로젝트 목록 로드 실패', 'error');
    }
  };

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch('/api/list');
      const data = await res.json();
      setDiagnostics(data);
      // Initialize counters
      setSummary({ total: data.length, ok: 0, warning: 0, error: 0 });
    } catch (err) {
      showToast('진단 노드 목록 로드 실패', 'error');
    }
  };

  const fetchErrorPatterns = async () => {
    try {
      const res = await fetch('/api/errors');
      const data = await res.json();
      setErrorPatterns(data);
    } catch (err) {
      showToast('오류 패턴 로드 실패', 'error');
    }
  };

  const fetchByokConfig = async () => {
    try {
      const res = await fetch('/api/byok/config');
      const data = await res.json();
      if (data.byok) {
        // data.byok.apiKey is MASKED (e.g. "AQ.A****lash") — never put it in
        // the input: saving it back would overwrite the real key (401 원인).
        setByok({
          provider: data.byok.provider || 'gemini',
          apiKey: '',
          model: data.byok.model || 'gemini-3.5-flash'
        });
        setHasSavedKey(!!data.byok.apiKey);
        setByokEnabled(!!data.byok.apiKey);
      }
      if (data.providers) {
        setProviders(data.providers);
      }
    } catch (err) {
      showToast('API 구성 정보 조회 실패', 'error');
    }
  };

  const fetchProjectExplanation = async (force = false) => {
    setIsProjectExplaining(true);
    setProjectExplain(null);
    try {
      const res = await fetch(`/api/project/explain${force ? '?force=true' : ''}`);
      const data = await res.json();
      setProjectExplain(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProjectExplaining(false);
    }
  };

  const runDiagnostics = async () => {
    setIsDiagRunning(true);
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      const data = await res.json();
      if (data.results) {
        const resultsMap = {};
        data.results.forEach(r => {
          resultsMap[r.id] = r;
        });
        setLastResults(resultsMap);
      }
      if (data.summary) {
        setSummary(data.summary);
      }
      if (data.healthPercent !== undefined) {
        setHealthPercent(data.healthPercent);
      }
      if (data.overallStatus) {
        setOverallStatus(data.overallStatus);
      }
      showToast('진단 완료 🩺', 'success');
    } catch (err) {
      showToast('진단 구동 중 오류 발생', 'error');
    } finally {
      setIsDiagRunning(false);
    }
  };

  const changeProject = async (path) => {
    if (!path) return;
    try {
      const res = await fetch('/api/project/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir: path })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentProjectDir(path);
        setCustomPath(path);
        setRepairStates({});
        showToast('📁 프로젝트가 변경되었습니다.', 'success');
        // 신규 프로젝트로 전환되었으므로 모든 진단 데이터 리프레시
        await Promise.all([
          fetchProjectList(),
          fetchDiagnostics(),
          fetchErrorPatterns(),
          fetchByokConfig()
        ]);
        runDiagnostics();
      } else {
        showToast(data.error || '프로젝트 전환 실패', 'error');
      }
    } catch (err) {
      showToast('네트워크 오류', 'error');
    }
  };

  const selectFolder = async () => {
    try {
      showToast('📂 Windows 보조 선택기를 엽니다. 보이지 않으면 작업 표시줄을 확인하세요.', 'success');
      const res = await fetch('/api/project/select', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.selectedPath) {
        setCustomPath(data.selectedPath);
        await changeProject(data.selectedPath);
      } else if (data.cancelled) {
        showToast('⚠️ 폴더 선택이 취소되었습니다.', 'error');
      } else if (data.error) {
        showToast('❌ ' + data.error, 'error');
      }
    } catch (err) {
      showToast('Windows 폴더 탐색기 호출 실패', 'error');
    }
  };

  const saveByokConfig = async () => {
    try {
      const res = await fetch('/api/byok/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: byok.provider,
          apiKey: byok.apiKey,
          model: byok.model
        })
      });
      const data = await res.json();
      if (data.success) {
        setByokFeedback({ type: 'ok', text: '💾 저장 완료. 아래 "🔄 로컬 분석기 구동" 버튼으로 AI 분석을 실행하세요.' });
        fetchByokConfig();
        // 자동 분석 호출 제거 — 429 쿼터 방지. 사용자가 직접 버튼 클릭.
        showToast('설정 저장 완료', 'success');
      } else {
        setByokFeedback({ type: 'err', text: data.error || '저장 실패' });
      }
    } catch (err) {
      setByokFeedback({ type: 'err', text: '네트워크 연결 실패' });
    }
  };

  const initProject = async () => {
    setIsInitializing(true);
    try {
      const res = await fetch('/api/project/init', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('🩺 진단 도구 설치(초기화)가 완료되었습니다.', 'success');
        await Promise.all([fetchDiagnostics(), fetchErrorPatterns()]);
      } else {
        showToast(data.error || '진단 도구 설치에 실패했습니다.', 'error');
      }
    } catch (err) {
      showToast('진단 도구 설치 중 통신 오류가 발생했습니다.', 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  const requestRepair = async (diagId) => {
    showToast('🧠 AI가 코드를 분석하고 있습니다… 최대 25초 정도 걸릴 수 있습니다.', 'success');
    setIsRepairProposing(true);
    setRepairStates(prev => ({
      ...prev,
      [diagId]: { ...prev[diagId], status: 'repairing' }
    }));
    try {
      const res = await fetch('/api/repair/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagId })
      });
      const data = await res.json();
      if (data.success && data.kind === 'MANUAL') {
        // 파일 수정으로 못 고치는 병 — 행동 처방전을 띄우고 재진단으로 완치 확인.
        setManualRx(data);
        setRepairStates(prev => ({
          ...prev,
          [diagId]: { ...prev[diagId], status: 'idle' }
        }));
        showToast('🩺 수동 처방전이 발급되었습니다.', 'success');
        fetchTreatments();
      } else if (data.success) {
        setPendingProposal(data);
        setRepairStates(prev => ({
          ...prev,
          [diagId]: { ...prev[diagId], status: 'awaiting-approval' }
        }));
        showToast('AI 수리 제안 생성 완료', 'success');
      } else {
        setRepairStates(prev => ({
          ...prev,
          [diagId]: { ...prev[diagId], status: 'idle' }
        }));
        showToast(data.error || '수리 제안 생성 실패', 'error');
      }
    } catch (err) {
      setRepairStates(prev => ({
        ...prev,
        [diagId]: { ...prev[diagId], status: 'idle' }
      }));
      showToast('네트워크 통신 실패', 'error');
    } finally {
      setIsRepairProposing(false);
    }
  };

  const applyRepair = async () => {
    if (!pendingProposal) return;
    setIsRepairApplying(true);
    const diagId = pendingProposal.diagId;
    try {
      const res = await fetch('/api/repair/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: pendingProposal.proposalId })
      });
      const data = await res.json();
      if (data.success) {
        setRepairStates(prev => ({
          ...prev,
          [diagId]: { ...prev[diagId], status: 'repaired' }
        }));
        setPendingProposal(null);
        const verified = data.maturity === 'VERIFIED_RESULT';
        showToast(verified ? '완치 검증 완료! 🟢 (회귀 0)' : 'AI 치료 적용 성공! 🟢', 'success');

        // 재진단 + 치료 원장 갱신
        await runDiagnostics();
        fetchTreatments();
      } else if (data.maturity === 'ROLLED_BACK') {
        // P3 자동 롤백: 치료가 다른 진단을 부수거나 대상 미완치 → 원상복구됨.
        setPendingProposal(null);
        setRepairStates(prev => ({
          ...prev,
          [diagId]: { ...prev[diagId], status: 'idle' }
        }));
        showToast(`⚠️ 자동 롤백됨: ${data.error || '회귀가 감지되어 원상복구했습니다.'}`, 'error');
        await runDiagnostics();
        fetchTreatments();
      } else {
        showToast(data.error || '치료 적용 실패', 'error');
      }
    } catch (err) {
      showToast('치료 적용 중 통신 에러', 'error');
    } finally {
      setIsRepairApplying(false);
    }
  };

  // 💉 일괄 치료 오케스트레이터 — 실패 진단을 일괄 치료하고 분류 리포트를 반환한다.
  // 완치 판정 = 오직 VERIFIED_RESULT(재진단 OK + 회귀 0)만. 할루시네이션 치료 차단.
  const runCureAll = async () => {
    const failingCount = summary.error + summary.warning;
    if (failingCount === 0) return;
    if (!window.confirm(`실패한 진단 ${failingCount}건을 일괄 치료합니다.\n\n완치 인정 기준: 재진단 OK 검증 완료(VERIFIED_RESULT)만\n자동 롤백: 회귀 발생 시 원상복구됨\n\n계속하시겠습니까?`)) return;

    setIsCureAllRunning(true);
    showToast('💉 치료 중… 재진단 포함 최대 30초 소요', 'success');
    try {
      const res = await fetch('/api/repair/cure-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'auto' }),
      });
      const data = await res.json();
      // 서버는 report 객체를 최상위로 직접 반환한다 (data === report).
      // data.error 가 있으면 서버측 500 오류.
      if (!data.error && data.summary) {
        setCureAllReport(data);
        const { cured, rolledBack, manual, unprescribable } = data.summary;
        const msg = `✅ 완치 ${cured} · ⚠️ 롤백 ${rolledBack} · 📋 수동 ${manual} · 🔑 처방불가 ${unprescribable}`;
        showToast(msg, cured > 0 ? 'success' : 'error');
        // 치료 후 진단 결과 + 원장 갱신
        await runDiagnostics();
        fetchTreatments();
      } else {
        showToast(data.error || '치료 중 오류', 'error');
      }
    } catch (err) {
      showToast('치료 통신 오류', 'error');
    } finally {
      setIsCureAllRunning(false);
    }
  };

  const viewErrorPattern = async (filename) => {
    try {
      const res = await fetch(`/api/errors/${encodeURIComponent(filename)}`);
      const data = await res.text();
      setSelectedErrorPattern({ filename, content: data });
    } catch (err) {
      showToast('에러 마크다운 열기 실패', 'error');
    }
  };

  const filteredDiagnostics = diagnostics.filter(diag => {
    if (activeFilter === 'all') return true;
    const result = lastResults[diag.id];
    const status = result ? result.status : 'PENDING';
    return status.toLowerCase() === activeFilter.toLowerCase();
  });

  const selectedDiagResult = selectedDiagId ? lastResults[selectedDiagId] : null;
  const selectedDiagObj = diagnostics.find(d => d.id === selectedDiagId);

  return (
    <div className="container animate-fade-in">
      {/* Toast Notification */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type === 'error' ? 'error' : 'success'}`}>
        {toast.message}
      </div>

      {/* 💉 치료 리포트 모달 */}
      {cureAllReport && (
        <div className="modal-overlay" onClick={() => setCureAllReport(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>💉</span> 치료 리포트
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                  완치 인정 기준: 재진단 OK 검증(VERIFIED_RESULT)만 — 할루시네이션 치료 차단
                </p>
              </div>
              <button onClick={() => setCureAllReport(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* 요약 카운터 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: '✅ 실제 완치', value: cureAllReport.summary.cured, color: 'var(--ok)', bg: 'var(--ok-bg)', border: 'var(--ok-border)' },
                { label: '⚠️ 롤백', value: cureAllReport.summary.rolledBack, color: 'var(--warn)', bg: 'var(--warn-bg)', border: 'var(--warn-border)' },
                { label: '📋 수동 조치', value: cureAllReport.summary.manual, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
                { label: '🚫 약화 차단', value: cureAllReport.summary.blocked || 0, color: 'var(--err)', bg: 'var(--err-bg)', border: 'var(--err-border)' },
                { label: '🔑 처방불가', value: cureAllReport.summary.unprescribable, color: 'var(--text3)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '3px', lineHeight: 1.3 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* 완치 목록 */}
            {cureAllReport.cured.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ok)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ✅ 실제 완치 — 재진단 OK 검증 완료
                </h4>
                {cureAllReport.cured.map(c => (
                  <div key={c.diagId} style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-border)', borderRadius: '6px', padding: '10px 12px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text)' }}>{c.diagId}</span>
                      <span style={{ fontSize: '10px', color: 'var(--ok)', fontWeight: 700 }}>재진단 OK ✓</span>
                    </div>
                    {c.summary && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{c.summary}</div>}
                    {c.filesModified?.length > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'monospace' }}>
                        수정: {c.filesModified.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 롤백 목록 */}
            {cureAllReport.rolledBack.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warn)', marginBottom: '8px' }}>⚠️ 자동 롤백 — 회귀/미완치로 원상복구</h4>
                {cureAllReport.rolledBack.map(r => (
                  <div key={r.diagId} style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: '6px', padding: '10px 12px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>{r.diagId}</span>
                    {r.regressions?.length > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--warn)', marginTop: '4px' }}>회귀: {r.regressions.join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 수동 조치 목록 */}
            {cureAllReport.manual.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', marginBottom: '8px' }}>📋 수동 조치 필요 — 아래 처방전을 따르세요</h4>
                {cureAllReport.manual.map(m => (
                  <div key={m.diagId} style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', padding: '10px 12px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', marginBottom: '6px' }}>{m.diagId}</div>
                    {m.prescription?.map((step, i) => (
                      <div key={i} style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '3px' }}>· {step}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* 처방불가 목록 */}
            {cureAllReport.unprescribable.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', marginBottom: '8px' }}>🔑 처방불가 — AI 키 설정 또는 수동 처리 필요</h4>
                {cureAllReport.unprescribable.map(u => (
                  <div key={u.diagId} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{u.diagId}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setCureAllReport(null)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', fontSize: '13px', marginTop: '4px' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Header UI */}
      <header>
        <div className="logo">
          <span className="logo-icon">🩺</span>
          <div>
            <h1>
              Vibe Clinic
              <span className="logo-badge">코드 처방 엔진 🟢</span>
              <button 
                className="btn-secondary" 
                onClick={() => setIsHelpActive(true)}
                style={{ marginLeft: '12px', padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}
              >
                💡 치료 가이드
              </button>
            </h1>
            <span style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px', display: 'block' }}>
              Project: {currentProjectDir || '로딩 중...'}
            </span>
          </div>
        </div>

        <a className="btn-secondary" href="/v2" style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>V2 관제판</a>

        {/* 종합 건강도 링 게이지 & HSL Emerald Green Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', position: 'relative' }}>
              <svg width="48" height="48" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="22" stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="none"/>
                <circle cx="26" cy="26" r="22" 
                  stroke="var(--accent)" 
                  strokeWidth="4" 
                  fill="none"
                  strokeDasharray="138.2" 
                  strokeDashoffset={138.2 - (138.2 * healthPercent) / 100}
                  strokeLinecap="round" 
                  style={{ transition: 'stroke-dashoffset .8s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <span style={{
                fontSize: '11px', fontWeight: 700, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--ok)'
              }}>
                {healthPercent}%
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text2)' }}>종합 건강도</span>
              <span style={{ fontSize: '10px', color: 'var(--text3)' }}>
                {overallStatus === 'OK' ? '정상 동작 중' : overallStatus === 'ERROR' ? '치료 권장' : '진단 필요'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
            <span style={{
              fontSize: '11px', background: 'var(--ok-bg)', border: '1px solid var(--ok-border)', color: 'var(--ok)', padding: '2px 8px', borderRadius: '12px'
            }}>
              🟢 정상
            </span>
            <span style={{
              fontSize: '11px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn)', padding: '2px 8px', borderRadius: '12px'
            }}>
              🟡 경고
            </span>
          </div>
        </div>
      </header>

      {/* Bento Grid System */}
      <div className="bento-grid">
        
        {/* Left Column (3.5 cols): Configurations & Diagnostics Panel */}
        <div className="column-left">
          
          {/* Card 1: Project Selector */}
          <div className="bento-card glass">
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderOpen size={14} /> 대상 프로젝트 선택
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select 
                value={currentProjectDir} 
                onChange={(e) => changeProject(e.target.value)} 
                style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
              >
                {projects.map(p => (
                  <option key={p.path} value={p.path}>{p.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input 
                  type="text" 
                  value={customPath} 
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="직접 경로 입력" 
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px' }}
                />
                <button className="btn-secondary" onClick={() => changeProject(customPath)} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>이동</button>
                <button className="btn-secondary" onClick={selectFolder} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--text2)' }}>선택</button>
              </div>
            </div>
          </div>

          {/* Card 2: BYOK Configurations */}
          <div className="bento-card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={14} /> 내 AI 키 직접 연결 <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 400 }}>Bring Your Own Key</span>
              </h3>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={byokEnabled} 
                  onChange={(e) => setByokEnabled(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {byokEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>AI API KEY (Gemini)</label>
                  <input
                    type="password"
                    value={byok.apiKey}
                    onChange={(e) => setByok(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={hasSavedKey ? '🔒 저장된 키 사용 중 — 변경할 때만 새 키 입력' : '로컬 API 키 입력'}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>모델 구성</label>
                  <select 
                    value={byok.model} 
                    onChange={(e) => setByok(prev => ({ ...prev, model: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px' }}
                  >
                    <option value="gemini-3.5-flash">gemini-3.5-flash (추천/고속)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (고성능)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: byokFeedback.type === 'ok' ? 'var(--ok)' : 'var(--err)' }}>
                    {byokFeedback.text}
                  </span>
                  <button className="btn-primary" onClick={saveByokConfig} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Save size={12} /> 설정 저장
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
              <div 
                onClick={() => setApiAccordionOpen(!apiAccordionOpen)} 
                className="accordion-header"
              >
                <span>ℹ️ API 보안 가이드 및 암호화 모델</span>
                <span>{apiAccordionOpen ? '▼' : '▶'}</span>
              </div>
              {apiAccordionOpen && (
                <p style={{ fontSize: '10px', color: 'var(--text3)', lineHeight: '1.5', marginTop: '6px' }}>
                  입력된 API 키는 로컬 저장소 구성 파일(<code style={{background:'var(--surface3)', padding:'1px 3px'}}>config.json</code>)에만 암호화되어 관리되며, 외부 네트워크로 키 자체가 공유되지 않습니다.
                </p>
              )}
            </div>
          </div>

          {/* Card 3: AI Project Scanner Panel */}
          <div className="bento-card glass" style={{ borderLeft: '3px solid var(--accent)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} /> AI 프로젝트 분석 스캐너
            </h3>
            {isProjectExplaining ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>
                <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--text)', borderRadius: '50%', animation: 'spin .6s linear infinite' }}></span>
                프로젝트 코드베이스 정적 스캔 중...
              </div>
            ) : projectExplain && projectExplain.success ? (
              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.6' }}>
                {projectExplain.isFallback && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '10px', color: 'var(--text2)', marginBottom: '10px' }}>
                    🤖 로컬 스마트 분석 결과 대체
                  </div>
                )}
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '8px', fontSize: '13px' }}>
                  {projectExplain.summary}
                </div>
                <div style={{ color: 'var(--text2)', fontSize: '11.5px', marginBottom: '12px', lineHeight: '1.5' }}>
                  {projectExplain.details}
                </div>
                {projectExplain.implementationNotes && (
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '12px', padding: '10px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px' }}>📐 구현 방식</span>
                    <div style={{ marginTop: '4px', lineHeight: '1.45' }}>{projectExplain.implementationNotes}</div>
                  </div>
                )}
                
                {/* 깃허브 스타일 언어 분석 바 */}
                {projectExplain.languages && projectExplain.languages.length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      기술 스택 (Languages)
                    </div>
                    <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'var(--surface3)', marginBottom: '12px' }}>
                      {projectExplain.languages.map((lang, idx) => (
                        <div 
                          key={idx} 
                          style={{ width: `${lang.percentage}%`, backgroundColor: lang.color, height: '100%' }} 
                          title={`${lang.name}: ${lang.percentage}%`}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px' }}>
                      {projectExplain.languages.map((lang, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--text2)' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: lang.color, marginRight: '6px' }}></span>
                          {lang.name} <span style={{ color: 'var(--text3)', marginLeft: '4px' }}>{lang.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  className="btn-secondary" 
                  onClick={() => fetchProjectExplanation(true)} 
                  style={{ marginTop: '16px', width: '100%', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  🔄 다시 요약하기
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.6' }}>
                <div style={{ fontWeight: 600, color: 'var(--text3)', marginBottom: '6px' }}>
                  프로젝트 분석 대기 중
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px' }}>
                  아래 버튼을 눌러 프로젝트를 분석합니다.<br/>
                  🤖 AI 분석은 <b>내 AI 키 직접 연결</b>에서 키 등록 후 사용 가능하며,<br/>
                  키 없이도 <b>로컬 분석기</b>로 기본 정보를 확인할 수 있습니다.
                </p>
                {projectExplain?.error && (
                  <p style={{ fontSize: '10px', color: 'var(--err)', marginTop: '8px' }}>
                    상세 정보: {projectExplain.error}
                  </p>
                )}
                <button 
                  className="btn-secondary" 
                  onClick={() => fetchProjectExplanation(true)} 
                  style={{ marginTop: '4px', width: '100%', padding: '8px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  🔄 로컬 분석기 구동
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (8.5 cols): Toolbar, Main Bento (AI Treatment Dashboard) & Sub Grids */}
        <div className="column-right">
          
          {/* Diagnostic Control Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={runDiagnostics} 
                disabled={isDiagRunning || isCureAllRunning}
                style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isDiagRunning ? (
                  <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#090e14', borderRadius: '50%', animation: 'spin .6s linear infinite' }}></span>
                ) : <Play size={14} />}
                진단 실행 🩺
              </button>

              {/* 💉 전체 치료 버튼 — 실패 진단 ≥ 1일 때만 활성 */}
              <button
                id="btn-cure-all"
                onClick={runCureAll}
                disabled={isCureAllRunning || isDiagRunning || (summary.error + summary.warning === 0)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  cursor: (summary.error + summary.warning === 0 || isCureAllRunning || isDiagRunning) ? 'not-allowed' : 'pointer',
                  background: (summary.error + summary.warning === 0) ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.15)',
                  color: (summary.error + summary.warning === 0) ? 'var(--text3)' : '#fca5a5',
                  border: `1px solid ${(summary.error + summary.warning === 0) ? 'var(--border)' : 'rgba(239,68,68,0.35)'}`,
                  transition: 'all 0.2s ease',
                  boxShadow: (summary.error + summary.warning > 0 && !isCureAllRunning) ? '0 0 14px rgba(239,68,68,0.15)' : 'none',
                  opacity: (summary.error + summary.warning === 0) ? 0.45 : 1,
                }}
              >
                {isCureAllRunning ? (
                  <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(239,68,68,0.2)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin .6s linear infinite' }}></span>
                ) : <span style={{ fontSize: '15px' }}>💉</span>}
                {isCureAllRunning ? '치료 중…' : `치료 (${summary.error + summary.warning})`}
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className={`btn-secondary ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                전체 <span style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '10px' }}>{summary.total}</span>
              </button>
              <button className={`btn-secondary ${activeFilter === 'ok' ? 'active' : ''}`} onClick={() => setActiveFilter('ok')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--ok)', borderColor: activeFilter === 'ok' ? 'var(--ok)' : '' }}>
                완치(정상) <span style={{ background: 'rgba(16,185,129,0.1)', padding: '1px 6px', borderRadius: '10px' }}>{summary.ok}</span>
              </button>
              <button className={`btn-secondary ${activeFilter === 'warning' ? 'active' : ''}`} onClick={() => setActiveFilter('warning')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--warn)', borderColor: activeFilter === 'warning' ? 'var(--warn)' : '' }}>
                주의관찰 <span style={{ background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '10px' }}>{summary.warning}</span>
              </button>
              <button className={`btn-secondary ${activeFilter === 'error' ? 'active' : ''}`} onClick={() => setActiveFilter('error')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--err)', borderColor: activeFilter === 'error' ? 'var(--err)' : '' }}>
                치료시급 <span style={{ background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '10px' }}>{summary.error}</span>
              </button>
            </div>
          </div>

          {/* Bento Main (Large): AI 치료 현황 & 자동 복구 트렌드 */}
          <div className="bento-card glass" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> AI 치료 복구 성과지표
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>자동 완치율</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ok)', marginTop: '4px' }}>
                    {summary.total > 0 ? Math.round((summary.ok / summary.total) * 100) : 100}%
                  </div>
                </div>
                <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>누적 치료 횟수</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginTop: '4px' }}>
                    {Object.keys(repairStates).filter(k => repairStates[k].status === 'repaired').length}건
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.5' }}>
                현재 진단 노드 전체 <strong>{summary.total}개</strong> 중 정상 코드로 자동 검증 통과 완료된 항목은 <strong>{summary.ok}개</strong>입니다. 미통과 상태의 오류 요인들에 대해 AI 수리 제안 적용이 적극 필요합니다.
              </div>
            </div>

            {/* 실시간 치료 흐름 타임라인 (최근 3건 간략 요약) */}
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '12px' }}>
                최근 치료 트렌드 타임라인
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {treatments.length > 0 ? (
                  treatments.slice(0, 5).map((item, idx) => {
                    const label = item.maturity || (item.success ? 'APPLIED' : 'FAILED');
                    const color = label === 'VERIFIED_RESULT' ? 'var(--ok)'
                      : label === 'ROLLED_BACK' || label === 'FAILED' ? 'var(--err)'
                      : label === 'PRESCRIBED' ? 'var(--warn)' : 'var(--text2)';
                    const at = item.at ? new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <div key={idx} style={{ fontSize: '11.5px', color: 'var(--text2)', lineHeight: '1.4', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text3)', minWidth: '34px' }}>{at}</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: '6px', padding: '0 5px', whiteSpace: 'nowrap' }}>{label}</span>
                        <span><strong>{item.diagId}</strong>{item.strategy ? <span style={{ color: 'var(--text3)' }}> · {item.strategy}</span> : null}</span>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ fontSize: '11px', color: 'var(--text3)', padding: '12px 0' }}>치료 히스토리가 존재하지 않습니다.</p>
                )}
              </div>
            </div>
          </div>

          {/* Sub Grid (2 columns): Left: Diagnostics Chart, Right: Error File Patterns */}
          <div className="bento-row">
            
            {/* Left Box: Diagnostics Chart (Virtual Cards) */}
            <div className="bento-card glass" style={{ minHeight: '380px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>정밀 진단 차트</span>
                <span style={{ fontSize: '11px', color: 'var(--text3)', background: 'var(--surface3)', padding: '2px 8px', borderRadius: '10px' }}>{filteredDiagnostics.length}</span>
              </h3>

              <div className="cards-grid">
                {filteredDiagnostics.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text3)', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <span>이 프로젝트에 아직 진단 도구가 설치되지 않았습니다.</span>
                    <button
                      className="btn-primary"
                      onClick={initProject}
                      disabled={isInitializing}
                      style={{ padding: '10px 20px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isInitializing && (
                        <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#090e14', borderRadius: '50%', animation: 'spin .6s linear infinite' }}></span>
                      )}
                      🩺 Vibe Clinic 진단 도구 설치 (초기화)
                    </button>
                    <span style={{ fontSize: '11px' }}>설치하면 .vibe-clinic 폴더와 예제 진단 파일이 생성됩니다.</span>
                  </div>
                ) : (
                  filteredDiagnostics.map(diag => (
                    <DiagnosticCard 
                      key={diag.id}
                      diag={diag}
                      result={lastResults[diag.id]}
                      isActive={selectedDiagId === diag.id}
                      onClick={() => {
                        setSelectedDiagId(diag.id);
                        setIsDrawerActive(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right Box: Detected Error File Patterns */}
            <div className="bento-card glass" style={{ minHeight: '380px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>검출 오류 파일 패턴</span>
                <span style={{ fontSize: '11px', color: 'var(--text3)', background: 'var(--surface3)', padding: '2px 8px', borderRadius: '10px' }}>{errorPatterns.length}</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {errorPatterns.length === 0 ? (
                  <p style={{ fontSize: '11.5px', color: 'var(--text3)', textAlign: 'center', padding: '40px 0' }}>
                    검출된 에러 파일 패턴이 없습니다.
                  </p>
                ) : (
                  errorPatterns.map(filename => (
                    <div 
                      key={filename}
                      onClick={() => viewErrorPattern(filename)}
                      className="glass"
                      style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '8px', border: '1px solid var(--border)' }}
                    >
                      <span style={{ color: 'var(--err)', fontSize: '14px' }}>🚨</span>
                      <span style={{ flex: 1, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
                      <ChevronRight size={12} style={{ color: 'var(--text3)' }} />
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Bottom Full-wide Block: Logs & Histories */}
          <div className="bento-card glass">
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} /> 실시간 프로젝트 진단 로그 스트리머
            </h3>
            <TerminalLogBox text={
              Object.keys(lastResults)
                .map(k => {
                  const r = lastResults[k];
                  return `[${k}] STATUS: ${r.status}\nDETAILS: ${r.details}\n${r.stdout ? `STDOUT:\n${r.stdout}\n` : ''}${r.stderr ? `STDERR:\n${r.stderr}\n` : ''}`;
                })
                .join('\n────────────────────────────────────────\n')
            } />
          </div>

        </div>

      </div>

      {/* Side Sliding Drawer */}
      <div className={`side-drawer ${isDrawerActive ? 'active' : ''}`}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text)' }}>🩺 진단 분석 — {selectedDiagObj?.name || selectedDiagId}</h3>
          <button style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setIsDrawerActive(false)}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedDiagObj ? (
            <>
              <div style={{ fontSize: '12.5px', color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>영역 레이어:</strong> <span className={`card-badge badge-${selectedDiagObj.layer?.toLowerCase()}`}>{selectedDiagObj.layer}</span></div>
                <div><strong>검증 상태:</strong> <span style={{ color: selectedDiagResult?.status === 'OK' ? 'var(--ok)' : 'var(--err)', fontWeight: 700 }}>{selectedDiagResult?.status || 'PENDING'}</span>
                  {selectedDiagResult?.confidence && selectedDiagResult?.status !== 'OK' && (
                    <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, color: selectedDiagResult.confidence === 'CONFIRMED' ? 'var(--err)' : 'var(--warn)' }}>
                      {selectedDiagResult.confidence === 'CONFIRMED' ? '확진 — 재실행에서도 재현됨 (2/2)' : '간헐 의심 — 재실행에서는 통과 (1/2)'}
                    </span>
                  )}
                </div>
                <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <strong>의사 소견:</strong><br />
                  {selectedDiagResult?.details || '진단 대기 중'}
                </div>
                {selectedDiagResult?.causeHypotheses?.length > 0 && (
                  <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <strong>🔎 원인 후보 (가능성순):</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      {selectedDiagResult.causeHypotheses.map((h, i) => (
                        <div key={i} style={{ fontSize: '11px', color: 'var(--text3)' }}>
                          <span style={{ fontWeight: 700, color: h.likelihood === 'HIGH' ? 'var(--warn)' : 'var(--text2)' }}>{h.likelihood}</span>
                          {' · '}{h.cause}
                          <span style={{ opacity: 0.7 }}> — {h.signal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedDiagResult && (selectedDiagResult.status === 'ERROR' || selectedDiagResult.status === 'WARNING') && (
                <div style={{ marginTop: '12px' }}>
                  {repairStates[selectedDiagId]?.status === 'repairing' ? (
                    <button className="btn-primary" disabled style={{ width: '100%', padding: '10px', borderRadius: '4px', fontSize: '13px' }}>
                      🔧 AI 수리 제안 생성 중...
                    </button>
                  ) : repairStates[selectedDiagId]?.status === 'awaiting-approval' ? (
                    <button 
                      className="btn-primary animate-pulse" 
                      onClick={() => showToast('상단의 검토 모달을 확인해주세요', 'success')}
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', fontSize: '13px' }}
                    >
                      🔍 제안된 수리 검토하기
                    </button>
                  ) : (
                    <button 
                      className="btn-primary" 
                      onClick={() => requestRepair(selectedDiagId)} 
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Sparkles size={14} /> AI 치료 처방 요청
                    </button>
                  )}
                </div>
              )}

              <div style={{ marginTop: '12px' }}>
                <h4 style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>원시 터미널 로그</h4>
                <pre style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '4px', fontSize: '11px', color: 'var(--text2)', overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {selectedDiagResult?.errorMessage || selectedDiagResult?.stderr || selectedDiagResult?.stdout || '출력 로그 없음'}
                </pre>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text3)', fontSize: '12px' }}>정밀 진단 차트에서 항목 카드를 클릭해 주세요.</p>
          )}
        </div>
      </div>

      {/* Modal: Error Pattern Viewer */}
      {selectedErrorPattern && (
        <div className="modal-overlay active" onClick={() => setSelectedErrorPattern(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px' }}>🚨 오류 파일 사양 — {selectedErrorPattern.filename}</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }} onClick={() => setSelectedErrorPattern(null)}>
                <X size={16} />
              </button>
            </div>
            <pre style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6', overflowY: 'auto', maxHeight: '60vh', color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
              {selectedErrorPattern.content}
            </pre>
          </div>
        </div>
      )}

      {/* Modal: AI Repair Diff Review */}
      {pendingProposal && (
        <div className="modal-overlay active" onClick={() => setPendingProposal(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: 'var(--ok)' }}>
              🩺 AI 처방 및 코드 변경 제안
            </h3>
            <div style={{ margin: '12px 0', fontSize: '13px', lineHeight: '1.6', color: 'var(--text2)' }}>
              <strong>처방 요약:</strong> {pendingProposal.summary}
            </div>

            <h4 style={{ fontSize: '12px', margin: '14px 0 6px 0', color: 'var(--text)' }}>수정 예정 코드 내역 (Diff)</h4>
            <div className="terminal-view" style={{ maxHeight: '350px', background: '#080c10' }}>
              {/* repairedFiles is an ARRAY of { path, content, delete? } from /api/repair/propose */}
              {(pendingProposal.repairedFiles || []).map(file => (
                <div key={file.path} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: file.delete ? 'var(--err)' : 'var(--text3)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px' }}>
                    📄 {file.path}{file.delete ? ' — 🗑️ 삭제 예정 파일' : ''}
                  </div>
                  {!file.delete && (
                    <pre style={{ margin: 0, fontSize: '11.5px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {file.content}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setPendingProposal(null)} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}>
                보류
              </button>
              <button 
                className="btn-primary" 
                onClick={applyRepair}
                disabled={isRepairApplying}
                style={{ padding: '8px 20px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isRepairApplying && (
                  <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#090e14', borderRadius: '50%', animation: 'spin .6s linear infinite' }}></span>
                )}
                처방 적용 및 자동 빌드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Prescription (행동 처방전) */}
      {manualRx && (
        <div className="modal-overlay active" onClick={() => setManualRx(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '92%' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: 'var(--warn)' }}>
              📋 수동 처방전 — {manualRx.diagId}
            </h3>
            <p style={{ margin: '12px 0', fontSize: '13px', lineHeight: '1.6', color: 'var(--text2)' }}>
              {manualRx.summary}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {(manualRx.prescription || []).map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ minWidth: '20px', height: '20px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: '12.5px', lineHeight: '1.6', color: 'var(--text2)', wordBreak: 'break-all' }}>{step}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setManualRx(null)} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}>
                닫기
              </button>
              <button
                className="btn-primary"
                onClick={() => { setManualRx(null); runDiagnostics(); }}
                style={{ padding: '8px 20px', borderRadius: '6px', fontSize: '13px' }}
              >
                🩺 조치 완료 — 재진단 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Help Guide */}
      {isHelpActive && (
        <div className="modal-overlay active" onClick={() => setIsHelpActive(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
            <h3 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={16} /> Vibe Clinic 치료 가이드
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ width: '20px', height: '20px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>1</span>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 600 }}>프로젝트 이동</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>좌측 대상 프로젝트를 선택하거나 custom 경로를 입력해 이동합니다.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ width: '20px', height: '20px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>2</span>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 600 }}>정밀 진단 실행</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>'진단 실행 🩺' 버튼을 클릭하면 전체 테스트 노드 검증이 실시간 구동됩니다.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ width: '20px', height: '20px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>3</span>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 600 }}>AI 치료 처방 적용</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>치료시급 노드를 클릭하고 AI 치료 처방을 요청하면 패치가 검토되고 적용됩니다.</p>
                </div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => setIsHelpActive(false)} style={{ width: '100%', padding: '10px', borderRadius: '6px', fontSize: '13px', marginTop: '24px' }}>
              이해했습니다
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

