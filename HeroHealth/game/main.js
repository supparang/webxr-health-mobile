// === /HeroHealth/game/main.js (2025-11-12 HUD wiring stable) ===
import '../vr/hub.js';                 // bootstrap Hub เสมอ
import { ensureFeverBar } from '../vr/ui-fever.js';

(function(){
  const $ = s=>document.querySelector(s);
  const elScore = $('#hudScore');
  const elCombo = $('#hudCombo');

  // time bubble ขวาบนของกล่องคะแนน
  let timeBubble = document.getElementById('hudTimeBubble');
  if(!timeBubble){
    const wrap = document.querySelector('[data-hud="scorebox"]') || $('#hudTop');
    timeBubble = document.createElement('div');
    timeBubble.id = 'hudTimeBubble';
    timeBubble.textContent = '60s';
    timeBubble.style.cssText =
      'position:absolute; right:14px; top:10px; padding:2px 10px;'+
      'border-radius:999px; background:#0b1220cc; color:#cbd5e1;'+
      'border:1px solid #334155; font:800 12px system-ui; pointer-events:none;';
    (wrap||document.body).appendChild(timeBubble);
  }

  let score=0, combo=0;
  function paint(){ if(elScore) elScore.textContent=String(score); if(elCombo) elCombo.textContent=String(combo); }
  paint();

  // ย้าย fever bar ไปใต้คะแนน/คอมโบทันทีที่ HUD พร้อม
  try{ ensureFeverBar(); }catch(_){}
  window.addEventListener('hha:hud-ready', ()=>{ try{ ensureFeverBar(); }catch(_){}});

  // เวลานับถอยหลังจาก factory
  window.addEventListener('hha:time', (e)=>{
    const sec = (e && e.detail && e.detail.sec!=null)? (e.detail.sec|0) : 0;
    if (timeBubble) timeBubble.textContent = sec+'s';
  });

  // คะแนน/คอมโบจาก factory
  window.addEventListener('hha:score', (e)=>{
    const d = e && e.detail ? e.detail : null;
    const delta = (d && typeof d.delta==='number') ? d.delta : 0;
    const good  = !!(d && d.good);
    score = Math.max(0, score + delta);
    combo = good ? (combo+1) : 0;
    paint();
  });

  // จบเกม → การันตีเวลาขึ้น 0s
  window.addEventListener('hha:end', ()=>{
    if(timeBubble) timeBubble.textContent='0s';
  });
})();
