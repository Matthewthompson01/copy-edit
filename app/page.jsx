"use client";
import React, { useMemo, useRef, useState } from "react";

const Btn = ({ className = "", children, variant = "default", size = "md", ...props }) => {
  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    default: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-md focus:ring-gray-500",
    primary: "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-lg focus:ring-blue-500 shadow-md",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm rounded-lg",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl"
  };
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00A0]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/  +/g, " ");
}

function lightCopyEdit(text) {
  let out = normalizeWhitespace(text.trim());
  out = out
    .replace(/\bteh\b/gi, "the")
    .replace(/\brecieve\b/gi, "receive")
    .replace(/\boccured\b/gi, "occurred")
    .replace(/\bdefinately\b/gi, "definitely");
  out = out.replace(/\s--\s/g, " — ");
  return out;
}

function analyzeRecommendations(text) {
  const tips = [];
  const sentences = text.replace(/\n/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.some((s) => s.split(/\s+/).length > 28)) tips.push("Break up long sentences for readability.");
  const adverbs = (text.match(/\b\w+ly\b/gi) || []).length;
  if (adverbs > 8) tips.push("Trim adverbs ending in -ly to tighten prose.");
  const paras = text.split(/\n\n+/);
  if (paras[0] && paras[0].split(/\s+/).length < 20) tips.push("Expand the introduction to set context.");
  if (paras[paras.length - 1] && paras[paras.length - 1].split(/\s+/).length < 15) tips.push("Add a stronger conclusion or CTA.");
  return tips;
}

// --- Simple word-level diff (LCS) ---
function tokenizeWords(s) {
  const tokens = [];
  const re = /(\S+)(\s*)/g;
  let m;
  while ((m = re.exec(s)) !== null) tokens.push((m[1] || "") + (m[2] || ""));
  const tail = s.replace(re, "");
  if (tail) tokens.push(tail);
  return tokens.length ? tokens : [s];
}

function lcsDiff(a, b) {
  const A = tokenizeWords(a);
  const B = tokenizeWords(b);
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { parts.push({ type: 'equal', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { parts.push({ type: 'remove', text: A[i++] }); }
    else { parts.push({ type: 'add', text: B[j++] }); }
  }
  while (i < n) parts.push({ type: 'remove', text: A[i++] });
  while (j < m) parts.push({ type: 'add', text: B[j++] });
  const merged = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && last.type === p.type) last.text += p.text; else merged.push({ ...p });
  }
  return merged;
}

function buildChangesAndScript(original, edited) {
  const parts = lcsDiff(original, edited);
  const outChanges = [];
  const outScript = [];
  let i = 0;
  let cid = 0;
  while (i < parts.length) {
    const p = parts[i];
    if (p.type === 'equal') {
      outScript.push({ kind: 'equal', text: p.text });
      i++; continue;
    }
    if (p.type === 'remove') {
      const before = p.text;
      let after = "";
      if (i + 1 < parts.length && parts[i + 1].type === 'add') {
        after = parts[i + 1].text; i += 2;
      } else { i += 1; }
      const id = String(cid++);
      outChanges.push({ id, before, after });
      outScript.push({ kind: 'change', id, before, after });
      continue;
    }
    if (p.type === 'add') {
      const id = String(cid++);
      outChanges.push({ id, before: "", after: p.text });
      outScript.push({ kind: 'change', id, before: "", after: p.text });
      i++; continue;
    }
  }
  return { changes: outChanges, script: outScript };
}

// Add custom scrollbar styles
const customScrollbarStyles = `
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 10px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  @keyframes slide-in-from-top-4 {
    from {
      opacity: 0;
      transform: translateY(-16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes slide-in-from-bottom-2 {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes slide-in-from-bottom-4 {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes zoom-in {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-in {
    animation-duration: 0.3s;
    animation-fill-mode: both;
  }
  .slide-in-from-top-4 {
    animation-name: slide-in-from-top-4;
  }
  .slide-in-from-bottom-2 {
    animation-name: slide-in-from-bottom-2;
  }
  .slide-in-from-bottom-4 {
    animation-name: slide-in-from-bottom-4;
  }
  .zoom-in {
    animation-name: zoom-in;
  }
  .duration-200 {
    animation-duration: 200ms;
  }
  .duration-300 {
    animation-duration: 300ms;
  }
  .duration-500 {
    animation-duration: 500ms;
  }
`;

export default function Page() {
  // Set default values for GPT mode
  React.useEffect(() => {
    setMode("gpt5");
    setEffort("medium");
  }, []);

  // Inject custom styles
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customScrollbarStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  const [input, setInput] = useState('Paste or write your draft here.\n\nChoose GPT-4o for full LLM copy‑edit, or Local for a quick cleanup. Then review red/green diffs and accept what you want.');
  const [changes, setChanges] = useState([]);
  const [accepted, setAccepted] = useState({});
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [decision, setDecision] = useState(null);
  const [script, setScript] = useState([]);
  const [mode, setMode] = useState("gpt5"); // "local" | "gpt5"
  const [effort, setEffort] = useState("minimal"); // minimal | low | medium | high
  const baselineRef = useRef("");

  function renderPreview() {
    if (!script.length) return baselineRef.current || input;
    let out = "";
    for (const s of script) out += s.kind === 'equal' ? s.text : (accepted[s.id] ? s.after : s.before);
    return out;
  }
  const preview = useMemo(renderPreview, [script, accepted, input]);

  async function onSuggest() {
    setLoading(true);
    // Clear previous decision-making info
    setAnalysis(null);
    setDecision(null);
    
    try {
      const original = input;
      baselineRef.current = original;

      if (mode === "gpt5") {
        const res = await fetch("/api/gpt5-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ original, effort })
        });
        if (res.ok) {
          const { edited, recommendations, analysis: analysisText, decision: decisionText } = await res.json();
          const { changes, script } = buildChangesAndScript(original, edited);
          setChanges(changes); 
          setAccepted({}); 
          setScript(script); 
          setRecs(recommendations || []);
          setAnalysis(analysisText);
          setDecision(decisionText);
          return;
        }
      }
      // fallback: local tidy
      const edited = lightCopyEdit(original);
      const { changes, script } = buildChangesAndScript(original, edited);
      setChanges(changes); setAccepted({}); setScript(script); setRecs(analyzeRecommendations(edited));
    } finally {
      setLoading(false);
    }
  }

  function toggleAccept(id) { setAccepted((p) => ({ ...p, [id]: !p[id] })); }
  function selectAll(val) { const all = {}; for (const c of changes) all[c.id] = val; setAccepted(all); }
  async function copyToClipboard(text) { try { await navigator.clipboard.writeText(text); alert("Final text copied."); } catch {} }
  function downloadTxt(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 text-gray-900">
        <div className="mx-auto max-w-7xl p-6 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Copy Edit Pro
            </h1>
            <p className="text-sm text-gray-600">AI-powered editing with intelligent decision making</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <Btn onClick={onSuggest} disabled={loading} variant="primary" size="lg" className="min-w-[140px]">
              {loading ? "🤖 AI Working..." : "🤖 AI Suggest"}
            </Btn>
          </div>
        </header>

        {/* Decision-making info section */}
        {(analysis || decision) && (
          <section className="animate-in slide-in-from-top-4 duration-500">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">AI Decision Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analysis && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-blue-800">Content Analysis</h3>
                    <div className="bg-blue-50/50 rounded-xl p-4 border-l-4 border-blue-400">
                      <p className="text-sm text-gray-700 leading-relaxed">{analysis}</p>
                    </div>
                  </div>
                )}
                {decision && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-purple-800">Editing Strategy</h3>
                    <div className="bg-purple-50/50 rounded-xl p-4 border-l-4 border-purple-400">
                      <p className="text-sm text-gray-700 leading-relaxed">{decision}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-6 space-y-4 transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Original Content</h2>
            <textarea
              className="w-full h-[500px] lg:h-[600px] rounded-2xl border-2 border-gray-200 p-6 text-lg leading-relaxed outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 resize-none bg-gray-50/50 hover:bg-white"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="✨ Paste your content here for AI-powered editing...

• Blog posts and articles
• Marketing copy
• Academic writing
• Professional communications"
            />
            {!!recs.length && (
              <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="text-amber-800 font-semibold mb-3">💡 Writing Tips</div>
                <ul className="space-y-2 text-sm text-amber-900">
                  {recs.map((r, i) => (
                    <li key={i}>
                      <span className="text-amber-600 mr-2">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-6 space-y-4 transition-all duration-300 hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Suggested Changes</h2>
                <p className="text-xs text-gray-500">{changes.length} edits found</p>
              </div>
              <div className="flex gap-2">
                <Btn onClick={() => selectAll(true)} variant="success" size="sm" title="Accept all shown changes">
                  ✅ Accept All
                </Btn>
                <Btn onClick={() => selectAll(false)} variant="secondary" size="sm" title="Reset acceptance">
                  🔄 Reset
                </Btn>
              </div>
            </div>
            {changes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <p className="text-lg font-medium">No changes yet</p>
                <p className="text-sm">Click the suggest button to get AI-powered edits</p>
              </div>
            ) : (
              <ul className="space-y-4 max-h-96 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {changes.map((c) => (
                  <li key={c.id} className={`relative border-2 rounded-2xl p-4 transition-all duration-200 ${accepted[c.id] ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-gray-50/30 hover:bg-white hover:shadow-md'}`}>
                    <div className="space-y-3">
                      <div className="text-sm leading-relaxed">
                        {c.before && (
                          <div className="mb-2">
                            <div className="text-xs font-medium text-red-600 mb-1">
                              Remove:
                            </div>
                            <div className="line-through text-red-700 bg-red-100/80 rounded-lg px-3 py-2 whitespace-pre-wrap border-l-4 border-red-400">{c.before}</div>
                          </div>
                        )}
                        {c.after && (
                          <div>
                            <div className="text-xs font-medium text-green-600 mb-1">
                              {c.before ? 'Replace with:' : 'Add:'}
                            </div>
                            <div className="text-green-800 bg-green-100/80 rounded-lg px-3 py-2 whitespace-pre-wrap border-l-4 border-green-400">{c.after}</div>
                          </div>
                        )}
                        {!c.before && !c.after && <em className="text-gray-500 italic">No changes detected</em>}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <label className={`inline-flex items-center gap-3 text-sm cursor-pointer group ${accepted[c.id] ? 'text-green-700' : 'text-gray-600'}`}>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500 transition-colors" 
                            checked={!!accepted[c.id]} 
                            onChange={() => toggleAccept(c.id)} 
                          />
                          <span className="font-medium group-hover:text-green-600 transition-colors">
                            {accepted[c.id] ? '✅ Accepted' : 'Accept this change'}
                          </span>
                        </label>
                        {accepted[c.id] && (
                          <div className="text-green-600 font-bold text-lg">✓</div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-6 space-y-4 transition-all duration-300 hover:shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Final Preview</h2>
              <p className="text-xs text-gray-500">Your content with accepted changes applied</p>
            </div>
            <div className="flex gap-3">
              <Btn 
                onClick={() => navigator.clipboard && navigator.clipboard.writeText(preview)} 
                variant="secondary" 
                size="sm"
              >
                📋 Copy
              </Btn>
              <Btn 
                onClick={() => { 
                  const blob = new Blob([preview], { type: "text/plain;charset=utf-8" }); 
                  const url = URL.createObjectURL(blob); 
                  const a = document.createElement("a"); 
                  a.href = url; 
                  a.download = "edited-content.txt"; 
                  a.click(); 
                  URL.revokeObjectURL(url); 
                }}
                variant="primary"
                size="sm"
              >
                💾 Export
              </Btn>
            </div>
          </div>
          <div className="relative">
            <div className="min-h-48 max-h-96 whitespace-pre-wrap leading-relaxed text-base border-2 border-gray-200 rounded-2xl p-6 bg-gradient-to-br from-gray-50 to-white overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 shadow-inner">
              {preview || (
                <div className="flex items-center justify-center h-32 text-gray-400">
                  <div className="text-center">
                    <p className="text-sm">Your final content will appear here</p>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-500 shadow-sm">
              {preview ? `${preview.split(' ').length} words` : '0 words'}
            </div>
          </div>
        </section>
        
        {/* Floating action indicator */}
        {changes.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl px-4 py-3 shadow-xl">
              <div className="text-sm">
                <div className="font-medium">✅ Changes Accepted</div>
                <div className="text-blue-100">{Object.keys(accepted).filter(id => accepted[id]).length} of {changes.length}</div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
