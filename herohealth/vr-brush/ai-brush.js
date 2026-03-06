// === /herohealth/vr-brush/ai-brush.js ===
'use strict';
export function bootBrushAI(){
  const W = window, D = document;
  const aiQ = String((new URL(location.href)).searchParams.get('ai') || '1').toLowerCase();
  if (aiQ === '0' || W.__BRUSH_AI_OFF__) return { enabled:false };

  const pill = D.getElementById('coachPill');
  let lastAt = 0;
  const minGap = 6000;

  function showTip(text){
    const t = performance.now();
    if (t - lastAt < minGap) return;
    lastAt = t;
    if (pill) pill.textContent = `COACH: ${String(text).slice(0,32)}`;
  }

  function onAiEvent(e){
    try{ const d = e.detail || {}; if (d.tip) showTip(d.tip); }catch(_){}
  }

  W.addEventListener('brush:ai', onAiEvent);
  return { enabled:true, showTip, detach:()=>W.removeEventListener('brush:ai', onAiEvent) };
}