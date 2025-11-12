// === /HeroHealth/game/main.js (2025-11-12 HUD wiring: score/combo/time + fever dock) ===
import '../vr/hub.js'; // ให้ hub.js bootstrap เสมอ
import { ensureFeverBar } from '../vr/ui-fever.js';

(function(){
  const $  = s => document.querySelector(s);

  // ---- DOM refs (ตาม index.vr.html ปัจจุบัน) ----
  const elScore = $('#hudScore');
  const elCombo = $('#hudCombo');

  // เพิ่ม time bubble ขวาบนของกล่องคะแนน
  let timeBubble = document.getElementById('hudTimeBubble');
  if (!timeBubble) {
    const wrap = document.querySelector('[data-hud="scorebox"]') || $('#hudTop');
    timeBubble = document.createElement('div');
    timeBubble.id = 'hudTimeBubble';
    timeBubble.textContent = '60s';
    timeBubble.style.cssText =
      'position:absolute; right:14px; top:10px; padding:2px 10px;'+
      'border-radius:999px; background:#0b1220cc; color:#cbd5e1;'+
      'border:1px solid #334155; font:800 12px system-ui; pointer-events:none;';
    (wrap || document.body).appendChild(timeBubble);
  }

  // ---- local game state (นับเองจากอีเวนต์ของ factory) ----
  let score = 0;
  let combo = 0;

  function paintScore(){
    if (elScore) elScore.textContent = String(score);
    if (elCombo) elCombo.textContent = String(combo);
  }
  paintScore();

  // ---- fever bar: ย้ายไปใต้กล่องคะแนนโดยฟังสัญญาณ hud-ready จาก hub ----
  try { ensureFeverBar(); } catch(e){}

  // ---- EVENT WIRING (จาก /vr/mode-factory.js) ----
  // hha:time {sec}
  window.addEventListener('hha:time', (e)=>{
    const sec = (e && e.detail && typeof e.detail.sec !== 'undefined') ? e.detail.sec|0 : 0;
    if (timeBubble) timeBubble.textContent = (sec>0?sec:0) + 's';
  });

  // hha:score {delta, good}
  window.addEventListener('hha:score', (e)=>{
    const d = e && e.detail ? e.detail : null;
    const delta = d && typeof d.delta==='number' ? d.delta : 0;
    const good  = !!(d && d.good);

    score = Math.max(0, score + delta);
    combo = good ? (combo + 1) : 0;   // ถ้ากดพลาดให้คอมโบรีเซ็ต
    paintScore();
  });

  // เมื่อจบเกม รีเซ็ต pointer ของชั้นยิงเป้าแล้วปล่อยให้ hub แสดงผลสรุปต่อ
  window.addEventListener('hha:end', ()=>{
    // ป้องกันค้างค่าเวลา 0s
    if (timeBubble && !/s$/.test(timeBubble.textContent)) timeBubble.textContent = '0s';
  });

  // บางธีม/เว็บวิว load เร็วเกิน ให้ hub ส่ง hud-ready หลายครั้ง → ตอบรับด้วย ensureFeverBar ซ้ำได้
  window.addEventListener('hha:hud-ready', ()=>{ try{ ensureFeverBar(); }catch(_){} });

})();
