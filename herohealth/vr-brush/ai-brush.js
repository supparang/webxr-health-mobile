// === /herohealth/vr-brush/ai-brush.js ===
// Explainable AI Coach (rate-limited) for Brush
// Emits/Consumes: window.dispatchEvent(new CustomEvent('brush:ai', {detail:{tip, causes:[...], meta:{...}}}))
// FULL v20260306-AI-BRUSH-EXPLAIN
'use strict';

export function bootBrushAI(){
  const W = window, D = document;
  const aiQ = String((new URL(location.href)).searchParams.get('ai') || '1').toLowerCase();
  if (aiQ === '0' || W.__BRUSH_AI_OFF__) return { enabled:false };

  const pill = D.getElementById('coachPill');
  let lastAt = 0;
  const minGap = 6500;

  function showTip(text){
    const t = performance.now();
    if (t - lastAt < minGap) return;
    lastAt = t;
    if (pill) pill.textContent = `COACH: ${String(text).slice(0,42)}`;
  }

  function fmtCauses(causes){
    if (!Array.isArray(causes) || !causes.length) return '';
    const top2 = causes.slice(0,2).map(c=>c.label).join(' + ');
    return top2;
  }

  function onAiEvent(e){
    try{
      const d = e.detail || {};
      const tip = d.tip ? String(d.tip) : '';
      const causes = fmtCauses(d.causes || []);
      const msg = causes ? `${tip} (${causes})` : tip;
      if (msg) showTip(msg);
    }catch(_){}
  }

  W.addEventListener('brush:ai', onAiEvent);
  return { enabled:true, showTip, detach:()=>W.removeEventListener('brush:ai', onAiEvent) };
}