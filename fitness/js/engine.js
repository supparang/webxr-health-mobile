// === /fitness/js/engine.js ===
// PATCH: make AI import robust + prevent boot crash when AI not present
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
// other imports you already have (loggers, stats, director, coach, pattern, etc.) stay the same

// ✅ Robust AI handle
let RB_AI = null;
try {
  // works when ai-predictor.js exports RB_AI (after patch)
  const mod = await import('./ai-predictor.js');
  RB_AI = mod && (mod.RB_AI || mod.default) ? (mod.RB_AI || mod.default) : null;
} catch (e) {
  // fallback: global
  try { RB_AI = window.RB_AI || null; } catch {}
}

// ---- helper: show fatal overlay if engine crashes early ----
function fatal(err){
  console.error(err);
  try{
    const box = document.createElement('div');
    box.style.position='fixed';
    box.style.inset='12px';
    box.style.zIndex='99999';
    box.style.background='rgba(2,6,23,.88)';
    box.style.border='1px solid rgba(148,163,184,.25)';
    box.style.borderRadius='18px';
    box.style.padding='14px';
    box.style.color='#e5e7eb';
    box.style.fontFamily='system-ui';
    box.innerHTML = `<div style="font-weight:900;font-size:16px;margin-bottom:8px;">Shadow Breaker — ERROR</div>
      <div style="opacity:.9;white-space:pre-wrap;font-size:13px;line-height:1.35;">${String(err && (err.stack||err.message||err))}</div>`;
    document.body.appendChild(box);
  }catch{}
}

try{
  // ==== YOUR EXISTING BOOT CODE ====
  // สำคัญ: ตรงจุดที่คุณเรียก AI ให้เรียกแบบกัน null:
  //
  // if (RB_AI && RB_AI.isAssistEnabled && RB_AI.isAssistEnabled()) { ... }
  // const pred = RB_AI?.predict?.(snapshot)
  //
  // และห้ามให้ “AI import fail” ทำให้ทั้งเกมไม่ start

  // ตัวอย่างสั้น ๆ:
  const layer = document.getElementById('sb-target-layer');
  const renderer = new DomRendererShadow(layer, {
    onTargetHit: (id, pt)=> {
      // ... your hit pipeline ...
      // renderer.playHitFx(id,{clientX:pt.clientX, clientY:pt.clientY, grade:'good', scoreDelta:10});
    }
  });

  // ... the rest of your engine logic ...

}catch(err){
  fatal(err);
}