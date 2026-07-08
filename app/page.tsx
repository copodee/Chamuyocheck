
'use client';

import { useMemo, useRef, useState } from 'react';

type Category = { name: string; score: number; explanation: string };
type FlaggedPhrase = { phrase: string; problem: string; severity: 'Baja'|'Media'|'Alta' };
type Financial = {
  detected: boolean;
  amount?: number | null;
  installment?: number | null;
  months?: number | null;
  totalPaid?: number | null;
  hiddenCost?: number | null;
  hiddenCostPercent?: number | null;
  monthlyImpliedRate?: number | null;
  annualEffectiveRate?: number | null;
  missingData?: string[];
  summary: string;
};
type Analysis = {
  score: number;
  risk: string;
  confidence: string;
  detectedType: string;
  centralQuestion: string;
  summary: string;
  prudentConclusion: string;
  verdict: string;
  categoryScores: Category[];
  specialistCommittee: Category[];
  flaggedPhrases: FlaggedPhrase[];
  issues: string[];
  questions: string[];
  missingInformation: string[];
  worstCase: string;
  improved: string;
  financial: Financial;
  pyramidRisk: Category;
  academicAI: Category;
  plagiarism: Category;
  sourceComparison: Category;
  legalSafeguard: string;
};

const examples: Record<string,string> = {
  text: 'Garantizamos que con nuestro curso online te harás millonario en 1 semana sin esfuerzo.',
  finance: 'Préstamo de $5.000.000. 120 cuotas de $180.000. Sin requisitos. Aprobación inmediata.',
  academic: 'Trabajo práctico de Historia: En la actualidad, es importante mencionar que la Revolución Industrial transformó profundamente la sociedad. En conclusión, este proceso tuvo múltiples consecuencias económicas y sociales.',
  pyramid: 'Generá ingresos pasivos invitando a tres personas. Rentabilidad mensual garantizada y sin vender productos. Mientras más referidos sumes, más ganás.',
  web: 'https://ejemplo.com/oferta-increible\nPegá también el texto visible de la página para un análisis más preciso.',
  youtube: 'https://youtube.com/watch?v=...\nPegá la descripción, transcripción o claims principales del video.',
  compare: 'Documento del alumno: El presente trabajo tiene como objetivo analizar...\n\nFuente usada: ...'
};

function money(n?: number | null) {
  if (n == null || !Number.isFinite(Number(n))) return 'No informado';
  return `$${Math.round(Number(n)).toLocaleString('es-AR')}`;
}

function percent(n?: number | null, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return 'No calculado';
  return `${Number(n).toFixed(digits)}%`;
}

function ScoreBar({ score }: { score: number }) {
  const width = Math.max(0, Math.min(100, score || 0));
  return <div className="bar"><div className="fill" style={{ ['--w' as any]: `${width}%` }} /></div>;
}

function CategoryCard({ c }: { c: Category }) {
  return (
    <div className="info-card">
      <div style={{display:'flex', justifyContent:'space-between', gap:12, alignItems:'start'}}>
        <h4>{c.name}</h4>
        <strong>{Math.round(c.score)}/100</strong>
      </div>
      <ScoreBar score={c.score} />
      <p>{c.explanation}</p>
    </div>
  );
}

export default function Page() {
  const [mode, setMode] = useState('text');
  const [text, setText] = useState(examples.text);
  const [compareText, setCompareText] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<{name:string; type:string; size:number}[]>([]);
  const [drag, setDrag] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const placeholder = useMemo(() => {
    if (mode === 'pdf') return 'Arrastrá un PDF o pegá el texto del documento. En esta versión web el archivo se registra; para análisis profundo pegá el texto extraído si el PDF no se procesa automáticamente.';
    if (mode === 'image') return 'Arrastrá una captura de WhatsApp, Instagram o anuncio. Pegá también el texto visible si querés máxima precisión.';
    if (mode === 'youtube') return 'Pegá el link de YouTube y, si podés, la transcripción o las frases principales del video.';
    if (mode === 'web') return 'Pegá una URL y el texto visible de la página, oferta o landing.';
    if (mode === 'academic') return 'Pegá un trabajo académico. El detector de IA es una estimación, no una prueba.';
    if (mode === 'compare') return 'Pegá el documento principal. Abajo podés pegar la fuente, segundo documento o trabajo a comparar.';
    return 'Pegá una propuesta, posteo, préstamo, inversión, contrato, promesa comercial o discurso.';
  }, [mode]);

  function onFiles(list: FileList | null) {
    if (!list) return;
    const mapped = Array.from(list).map(f => ({ name: f.name, type: f.type || 'archivo', size: f.size }));
    setFiles(prev => [...prev, ...mapped].slice(0, 8));
  }

  async function analyze() {
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, compareText, url, files, mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setAnalysis(data);
      setTimeout(() => document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e:any) {
      alert(e.message || 'No se pudo analizar.');
    } finally {
      setLoading(false);
    }
  }

  const modes = [
    ['text','Texto'],
    ['pdf','PDF'],
    ['image','Imagen/captura'],
    ['youtube','YouTube'],
    ['web','Página web'],
    ['academic','Académico/IA'],
    ['compare','Comparar docs'],
    ['finance','Financiero'],
    ['pyramid','Pirámide']
  ];

  function loadExample(key: string) {
    setMode(key);
    setText(examples[key] || examples.text);
    if (key === 'compare') setCompareText('Fuente o segundo documento:\n');
    if (key === 'web') setUrl('https://ejemplo.com/oferta');
    if (key === 'youtube') setUrl('https://youtube.com/watch?v=');
  }

  return (
    <>
      <main className="shell">
        <nav className="nav">
          <div className="logo">Chamuyo<span>Check</span></div>
          <div className="nav-actions">
            <a className="pill" href="#resultado">Ver análisis</a>
            <button className="secondary">Pasarme a Pro</button>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-copy">
            <div className="badge">Sistema inteligente de auditoría de credibilidad</div>
            <h1>La IA que detecta el chamuyo <span className="grad">sin acusar:</span> audita, calcula y pregunta.</h1>
            <p className="lead">
              V6 analiza textos, PDFs, capturas, enlaces, videos, préstamos, inversiones, trabajos académicos y documentos comparados. No condena: mide respaldo, transparencia, costos ocultos, señales de IA, plagio estimativo y riesgos.
            </p>
            <div className="hero-buttons">
              <button className="primary" onClick={() => document.getElementById('panel')?.scrollIntoView({ behavior:'smooth' })}>Analizar ahora</button>
              <button className="secondary" onClick={() => loadExample('finance')}>Probar préstamo</button>
            </div>
            <div className="chips">
              <span className="chip">📄 PDF</span>
              <span className="chip">📷 Capturas</span>
              <span className="chip">🎥 YouTube</span>
              <span className="chip">🌐 Web</span>
              <span className="chip">📊 Indicadores</span>
              <span className="chip">🤖 IA académica</span>
              <span className="chip">📑 Comparador</span>
              <span className="chip">🔍 Plagio estimativo</span>
            </div>
          </div>

          <div id="panel" className="workspace">
            <div className="mode-tabs">
              {modes.map(([id,label]) => (
                <button key={id} className={`mode ${mode === id ? 'active' : ''}`} onClick={() => setMode(id)}>
                  {label}
                </button>
              ))}
            </div>

            <div
              className={`dropzone ${drag ? 'drag' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt,.doc,.docx" style={{display:'none'}} onChange={(e) => onFiles(e.target.files)} />
              <div className="drop-title">Arrastrá PDF, imagen, captura o documento</div>
              <div className="drop-help">También podés pegar texto, URL de YouTube o página web. Para máxima precisión, pegá el texto visible del archivo.</div>
              {!!files.length && (
                <div className="file-list">
                  {files.map((f,i) => <span className="file-tag" key={`${f.name}-${i}`}>{f.name}</span>)}
                </div>
              )}
            </div>

            {(mode === 'web' || mode === 'youtube') && (
              <input className="input" placeholder="Pegá el enlace..." value={url} onChange={e => setUrl(e.target.value)} />
            )}

            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} />

            {mode === 'compare' && (
              <div className="compare-grid">
                <textarea value={compareText} onChange={e => setCompareText(e.target.value)} placeholder="Pegá acá la fuente, el segundo documento o el trabajo a comparar." />
              </div>
            )}

            <div className="row">
              <button className="primary" onClick={analyze} disabled={loading}>{loading ? 'Analizando...' : 'Ayudame a decidir'}</button>
              <button className="secondary" onClick={() => loadExample('academic')}>Ejemplo académico</button>
              <button className="secondary" onClick={() => loadExample('pyramid')}>Ejemplo piramidal</button>
              <span className="small">Mínimo 20 caracteres. El resultado es orientativo.</span>
            </div>

            {analysis && (
              <div id="resultado" className="result-top">
                <div className="score-card">
                  <div className="score-title">Riesgo general</div>
                  <div className="big-score">{analysis.score}/100</div>
                  <ScoreBar score={analysis.score} />
                  <p><b>Tipo detectado:</b> {analysis.detectedType}</p>
                  <p><b>Riesgo:</b> {analysis.risk} · <b>Confianza:</b> {analysis.confidence}</p>
                </div>
                <div className="score-card">
                  <div className="score-title">Pregunta central</div>
                  <h3>{analysis.centralQuestion}</h3>
                  <p>{analysis.summary}</p>
                  <div className="notice"><b>Conclusión prudente:</b> {analysis.prudentConclusion}</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {analysis && (
          <section className="report">
            {analysis.financial?.detected && (
              <div className="section wide">
                <h2>Inteligencia matemática financiera</h2>
                <p>{analysis.financial.summary}</p>
                <div className="metric-grid">
                  <div className="metric">Monto publicado<b>{money(analysis.financial.amount)}</b></div>
                  <div className="metric">Cuota<b>{money(analysis.financial.installment)}</b></div>
                  <div className="metric">Plazo<b>{analysis.financial.months ? `${analysis.financial.months} meses` : 'No informado'}</b></div>
                  <div className="metric">Total a pagar<b>{money(analysis.financial.totalPaid)}</b></div>
                  <div className="metric">Costo sobre capital<b>{money(analysis.financial.hiddenCost)}</b></div>
                  <div className="metric">Tasa implícita<b>{percent(analysis.financial.monthlyImpliedRate)} mensual</b></div>
                </div>
                <p><b>Datos que faltan:</b> {(analysis.financial.missingData || []).join(', ')}</p>
              </div>
            )}

            <div className="section">
              <h2>Índices de auditoría</h2>
              <div className="cards">{analysis.categoryScores.map((c,i) => <CategoryCard c={c} key={i} />)}</div>
            </div>

            <div className="section">
              <h2>Comité de análisis</h2>
              <div className="cards">{analysis.specialistCommittee.map((c,i) => <CategoryCard c={c} key={i} />)}</div>
            </div>

            <div className="section">
              <h2>Frases bajo sospecha</h2>
              {analysis.flaggedPhrases.length ? analysis.flaggedPhrases.map((f,i) => (
                <div className="info-card" key={i}>
                  <div className="chip">{f.severity}</div>
                  <h4>“{f.phrase}”</h4>
                  <p>{f.problem}</p>
                </div>
              )) : <p>No se detectaron frases críticas específicas.</p>}
            </div>

            <div className="section">
              <h2>Alertas principales</h2>
              <ul>{analysis.issues.map((x,i) => <li key={i}>{x}</li>)}</ul>
              <h3>Información faltante</h3>
              <ul>{analysis.missingInformation.map((x,i) => <li key={i}>{x}</li>)}</ul>
            </div>

            <div className="section">
              <h2>Módulos especiales</h2>
              <div className="cards">
                <CategoryCard c={analysis.pyramidRisk} />
                <CategoryCard c={analysis.academicAI} />
                <CategoryCard c={analysis.plagiarism} />
                <CategoryCard c={analysis.sourceComparison} />
              </div>
            </div>

            <div className="section">
              <h2>Preguntas para decidir mejor</h2>
              <ul>{analysis.questions.map((x,i) => <li key={i}>{x}</li>)}</ul>
              <h3>Peor escenario razonable</h3>
              <p>{analysis.worstCase}</p>
              <h3>Versión más transparente</h3>
              <p>{analysis.improved}</p>
            </div>

            <div className="section wide">
              <h2>Resguardo legal del análisis</h2>
              <div className="notice">
                <p>{analysis.legalSafeguard}</p>
                <p>El sistema debe evitar afirmaciones categóricas como “es estafa”, “miente”, “es fraude”, “es plagio” o “fue hecho con IA” salvo prueba suficiente. Debe usar formulaciones prudentes: “presenta indicadores”, “requiere evidencia”, “podría inducir a error” o “conviene verificar”.</p>
              </div>
            </div>
          </section>
        )}

        <footer className="footer">
          ChamuyoCheck V6 · Auditoría automatizada orientativa. No reemplaza criterio humano ni asesoramiento profesional.
        </footer>
      </main>
    </>
  );
}
