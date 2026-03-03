// === /herohealth/vr-brush/ai-brush.js ===
'use strict';

export function bootBrushAI(){
  const W = window, D = document;
  const aiQ = String((new URL(location.href)).searchParams.get('ai') || '1').toLowerCase();
  if (aiQ === '0' || W.__BRUSH_AI_OFF__) return { enabled:false };

  const hud = D.getElementById('hud');
  const rows = hud ? hud.querySelectorAll('.hud-row') : null;
  let pill = D.getElementById('aiPill');

  if (!pill && rows && rows[1]){
    pill = D.createElement('div');
    pill.className = 'pill';
    pill.id = 'aiPill';
    pill.textContent = 'AI: READY';
    rows[1].appendChild(pill);
  }

  let lastAt = 0;
  const minGap = 8000;

  function showTip(text){
    const t = performance.now();
    if (t - lastAt < minGap) return;
    lastAt = t;
    if (pill) pill.textContent = `AI: ${String(text).slice(0,26)}`;
  }

  function onAiEvent(e){
    try{
      const d = e.detail || {};
      if (d.tip) showTip(d.tip);
    }catch(_){}
  }

  W.addEventListener('brush:ai', onAiEvent);
  return { enabled:true, showTip, detach:()=>W.removeEventListener('brush:ai', onAiEvent) };
}