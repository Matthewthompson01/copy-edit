"use client";
import React, { useMemo, useRef, useState } from "react";

const Btn = ({ className = "", children, ...props }) => (
  <button
    className={"inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm shadow-sm border border-gray-300 bg-white hover:shadow " + className}
    {...props}
  >
    {children}
  </button>
);

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

export default function Page() {
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
    <div className="min-h-screen w-full bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Copy‑Edit Review Tool</h1>
          <div className="flex gap-2 items-center">
            <select className="rounded-xl border border-gray-300 px-2 py-1 text-sm" value={mode} onChange={(e)=>setMode(e.target.value)}>
              <option value="local">Local</option>
              <option value="gpt5">GPT-4o</option>
            </select>
            <select className="rounded-xl border border-gray-300 px-2 py-1 text-sm" value={effort} onChange={(e)=>setEffort(e.target.value)}>
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <Btn onClick={onSuggest} disabled={loading} className="bg-black text-white">
              {loading ? (mode === "gpt5" ? "Asking GPT-4o…" : "Suggesting…") : (mode === "gpt5" ? "Suggest (GPT-4o)" : "Suggest edits")}
            </Btn>
          </div>
        </header>

        {/* Decision-making info section */}
        {(analysis || decision) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analysis && (
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-medium mb-2 text-blue-800">Analysis</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{analysis}</p>
              </div>
            )}
            {decision && (
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-medium mb-2 text-purple-800">Decision & Approach</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{decision}</p>
              </div>
            )}
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <textarea
              className="w-full h-72 md:h-[28rem] rounded-xl border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-black/20"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your blog post or article here…"
            />
            {!!recs.length && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <div className="mb-2 text-amber-800 font-medium">Recommendations</div>
                <ul className="list-disc pl-5 space-y-1 text-sm text-amber-900">
                  {recs.map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Changes</h2>
              <div className="flex gap-2">
                <Btn onClick={() => selectAll(true)} title="Accept all shown changes">Accept all</Btn>
                <Btn onClick={() => selectAll(false)} title="Reset acceptance">Reset</Btn>
              </div>
            </div>
            {changes.length === 0 ? (
              <p className="text-sm text-gray-500">Run "Suggest" to see proposed changes.</p>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-auto pr-1">
                {changes.map((c) => (
                  <li key={c.id} className="border border-gray-200 rounded-xl p-3">
                    <div className="text-sm">
                      {c.before && (<div className="line-through text-red-700 bg-red-50 rounded px-1 inline-block whitespace-pre-wrap">{c.before}</div>)}
                      {c.before && c.after ? <span className="mx-2 text-gray-400">→</span> : null}
                      {c.after && (<div className="text-green-800 bg-green-50 rounded px-1 inline-block whitespace-pre-wrap">{c.after}</div>)}
                      {!c.before && !c.after && <em className="text-gray-500">(no-op)</em>}
                    </div>
                    <div className="mt-2">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4" checked={!!accepted[c.id]} onChange={() => toggleAccept(c.id)} />
                        Accept this change
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Preview (original + accepted changes)</h2>
            <div className="flex gap-2">
              <Btn onClick={() => navigator.clipboard && navigator.clipboard.writeText(preview)}>Copy</Btn>
              <Btn onClick={() => { const blob = new Blob([preview], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "final.txt"; a.click(); URL.revokeObjectURL(url); }}>Export Final</Btn>
            </div>
          </div>
          <div className="min-h-40 whitespace-pre-wrap leading-relaxed text-[15px] border border-gray-200 rounded-xl p-3">
            {preview}
          </div>
        </section>
      </div>
    </div>
  );
}
