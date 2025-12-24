// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION FIX (AUTO-RUN + SAFE MARGINS + FATAL OVERLAY)
// Requires HTML IDs: gj-layer, start-overlay, btn-start-2d, btn-start-vr,
// sel-diff, sel-challenge, btn-exit, btn-replay, sum-overlay, sum-score, sum-combo, sum-good, sum-miss
// Optional: btn-vr, hud-*, fx-chroma, game-cam

'use strict';

import { boot as gameBoot } from './goodjunk.safe.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc = ROOT.document;

function $(id){ return doc ? doc.getElementById(id) : null; }
function qs(sel){ return doc ? doc.querySelector(sel) : null; }

function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

function parseQS(){
  const p = new URLSearchParams(location.search);
  const diff = (p.get('diff') || '').toLowerCase() || null;
  const time = Number(p.get('time') || 0) || null;
  const run  = (p.get('run') || '').toLowerCase() || null;
  const challenge = (p.get('challenge') || p.get('ch') || '').toLowerCase() || null;
  return { diff, time, run, challenge };
}

function showFatal(msg){
  try{
    let box = $('hhaFatal');
    if (!box){
      box = doc.createElement('div');
      box.id = 'hhaFatal';
      box.style.cssText = `
        position:fixed; inset:12px; z-index:99999;
        background:rgba(2,6,23,.92);
        border:1px solid rgba(239,68,68,.35);
        border-radius:16px;
        padding:12px 12px 10px;
        color:#fff;
        font-family: ui-sans-serif, system-ui;
        overflow:auto;
        white-space:pre-wrap;
      `;
      doc.body.appendChild(box);
    }
    box.textContent = '❌ GoodJunkVR FATAL\n\n' + String(msg || 'Unknown error');
  }catch(_){}
}

function hookFatal(){
  ROOT.addEventListener('error', (e)=>{
    showFatal(e?.error?.stack || e?.message || e);
  });
  ROOT.addEventListener('unhandledrejection', (e)=>{
    showFatal(e?.reason?.stack || e?.reason || e);
  });
}

function setAimAndOffset(){
  try{
    const layer = $('gj-layer');
    if (!layer) return;

    const r = layer.getBoundingClientRect();
    ROOT.__GJ_LAYER_OFFSET__ = { x: r.left || 0, y: r.top || 0 };

    // aim point ตามที่ safe.js ใช้เป็นค่า default
    ROOT.__GJ_AIM_POINT__ = {
      x: (ROOT.innerWidth * 0.5) | 0,
      y: (ROOT.innerHeight * 0.62) | 0
    };
  }catch(_){}
}

function computeSafeMargins(){
  // safeMargins = “กันพื้นที่ HUD” (เป็นจำนวน px ที่สงวนไว้จากขอบจอ)
  // safe.js จะสร้าง rect = [left..right] [top..bottom] จาก margins เหล่านี้
  const pad = 12;

  const topHud = $('hud-pill');
  const meta = qs('.hud-meta');
  const rightPanel = qs('.hud-right');
  const bottomQuest = $('hud-quest-wrap');

  let top = 130;
  let bottom = 170;
  let left = 26;
  let right = 26;

  try{
    if (meta){
      const r = meta.getBoundingClientRect();
      top = Math.max(top, (r.bottom + 10) | 0);
    } else if (topHud){
      const r = topHud.getBoundingClientRect();
      top = Math.max(top, (r.bottom + 10) | 0);
    }

    if (bottomQuest){
      const r = bottomQuest.getBoundingClientRect();
      // bottom margin = ระยะจาก top ของ quest ถึงขอบล่าง
      bottom = Math.max(bottom, ((ROOT.innerHeight - r.top) + 10) | 0);
    }

    if (rightPanel){
      const r = rightPanel.getBoundingClientRect();
      right = Math.max(right, ((ROOT.innerWidth - r.left) + pad) | 0);
    }

    // เผื่อ log badge / coach bubble ฝั่งซ้าย
    left = Math.max(left, pad + 14);
  }catch(_){}

  // กันไม่ให้ margins โหดเกินจนไม่มีพื้นที่เล่น
  top = clamp(top, 80, Math.max(120, ROOT.innerHeight - 220));
  bottom = clamp(bottom, 120, Math.max(160, ROOT.innerHeight - 180));
  left = clamp(left, 16, Math.max(20, ROOT.innerWidth - 120));
  right = clamp(right, 16, Math.max(20, ROOT.innerWidth - 120));

  return { top, bottom, left, right };
}

function bindFX(){
  const cam = $('game-cam');
  const chroma = $('fx-chroma');

  ROOT.addEventListener('hha:fx', (ev)=>{
    const d = ev?.detail || {};
    const type = String(d.type || '');
    if (type === 'kick' && cam){
      cam.style.setProperty('--kickAmp', `${Math.round(8 + 8*(Number(d.intensity)||1))}px`);
      cam.style.setProperty('--kickRot', `${Math.round(3 + 3*(Number(d.intensity)||1))}deg`);
      cam.classList.remove('kick');
      // reflow
      void cam.offsetWidth;
      cam.classList.add('kick');
      setTimeout(()=> cam.classList.remove('kick'), 280);
    }
    if (type === 'chroma' && chroma){
      chroma.classList.remove('hero');
      chroma.classList.add('show');
      setTimeout(()=> chroma.classList.remove('show'), clamp(d.ms || 180, 80, 600));
    }
    if (type === 'hero' && chroma){
      chroma.classList.add('hero');
      chroma.classList.add('show');
      setTimeout(()=> chroma.classList.remove('show'), clamp(d.ms || 220, 80, 900));
      setTimeout(()=> chroma.classList.remove('hero'), 400);
    }
  }, { passive:true });
}

function fillSummary(payload){
  try{
    $('sum-score') && ($('sum-score').textContent = String(payload?.score ?? 0));
    $('sum-combo') && ($('sum-combo').textContent = String(payload?.comboMax ?? 0));
    $('sum-good')  && ($('sum-good').textContent  = String(payload?.goodHits ?? 0));
    $('sum-miss')  && ($('sum-miss').textContent  = String(payload?.misses ?? 0));
  }catch(_){}
}

let API = null;

function startGame({ diff, time, run, challenge, wantVR }){
  const layer = $('gj-layer');
  if (!layer) throw new Error('[Boot] #gj-layer missing');

  // reset overlays
  const startOv = $('start-overlay');
  if (startOv) startOv.style.display = 'none';

  const sumOv = $('sum-overlay');
  if (sumOv) sumOv.classList.remove('show');

  // เซ็ต offset/aim ให้ถูกก่อน boot
  setAimAndOffset();

  // คำนวณ safeMargins กัน HUD ทับ
  const safeMargins = computeSafeMargins();

  // ยิงผ่านการแตะพื้นที่ว่างใน layer (safe.js จะ bind เองได้อยู่แล้ว)
  API = gameBoot({
    diff,
    time,
    run,
    challenge,
    layerEl: layer,
    safeMargins
  });

  // เข้า VR ถ้าต้องการ
  if (wantVR){
    const scene = qs('a-scene');
    try{
      if (scene && scene.enterVR) scene.enterVR();
    }catch(_){}
  }
}

function bindStartUI(){
  const qs0 = parseQS();

  const selDiff = $('sel-diff');
  const selCh   = $('sel-challenge');
  const b2d = $('btn-start-2d');
  const bvr = $('btn-start-vr');

  // apply URL defaults ถ้ามี
  if (selDiff && qs0.diff) selDiff.value = qs0.diff;
  if (selCh   && qs0.challenge) selCh.value = qs0.challenge;

  const duration = qs0.time || 80;
  const runMode  = qs0.run || 'play';

  function go(wantVR){
    const diff = (selDiff ? selDiff.value : 'normal') || 'normal';
    const challenge = (selCh ? selCh.value : 'rush') || 'rush';
    startGame({ diff, time: duration, run: runMode, challenge, wantVR });
  }

  if (b2d){
    b2d.addEventListener('click', (e)=>{
      e.preventDefault();
      go(false);
    }, { passive:false });
  }
  if (bvr){
    bvr.addEventListener('click', (e)=>{
      e.preventDefault();
      go(true);
    }, { passive:false });
  }

  // ปุ่ม Enter VR ที่อยู่ panel ขวา (ถ้ามี)
  const btnVR = $('btn-vr');
  if (btnVR){
    btnVR.addEventListener('click', (e)=>{
      e.preventDefault();
      try{
        const scene = qs('a-scene');
        if (scene && scene.enterVR) scene.enterVR();
      }catch(_){}
    }, { passive:false });
  }
}

function bindSummaryUI(){
  const sumOv = $('sum-overlay');
  const bExit = $('btn-exit');
  const bReplay = $('btn-replay');

  if (bExit){
    bExit.addEventListener('click', (e)=>{
      e.preventDefault();
      // กลับเมนู
      if (API && API.stop) API.stop();
      API = null;
      if (sumOv) sumOv.classList.remove('show');
      const startOv = $('start-overlay');
      if (startOv) startOv.style.display = '';
    }, { passive:false });
  }

  if (bReplay){
    bReplay.addEventListener('click', (e)=>{
      e.preventDefault();
      // เล่นใหม่แบบเดิม (อ่านจาก select)
      if (API && API.stop) API.stop();
      API = null;
      if (sumOv) sumOv.classList.remove('show');
      const selDiff = $('sel-diff');
      const selCh   = $('sel-challenge');
      const diff = (selDiff ? selDiff.value : 'normal') || 'normal';
      const challenge = (selCh ? selCh.value : 'rush') || 'rush';
      const qs0 = parseQS();
      startGame({ diff, time: (qs0.time || 80), run: (qs0.run || 'play'), challenge, wantVR:false });
    }, { passive:false });
  }

  ROOT.addEventListener('hha:end', (ev)=>{
    const d = ev?.detail || {};
    fillSummary(d);
    if (sumOv) sumOv.classList.add('show');
  }, { passive:true });
}

function bindResize(){
  const fn = ()=>{
    setAimAndOffset();
  };
  ROOT.addEventListener('resize', fn, { passive:true });
  ROOT.addEventListener('orientationchange', fn, { passive:true });
  // บางมือถือเลื่อน address bar ทำให้ viewport เปลี่ยน
  ROOT.addEventListener('scroll', fn, { passive:true });
}

function init(){
  hookFatal();
  bindFX();
  bindStartUI();
  bindSummaryUI();
  bindResize();
  setAimAndOffset();

  // ถ้าอยากให้ “เข้าเล่นทันที” จากลิงก์ (run=autoplay) ก็รองรับไว้
  const qs0 = parseQS();
  const auto = (new URLSearchParams(location.search).get('autoplay') || '').toLowerCase();
  if (auto === '1' || auto === 'true'){
    // ใช้ค่าจาก query ถ้ามี ไม่งั้นใช้ select
    const diff = qs0.diff || ($('sel-diff') ? $('sel-diff').value : 'normal') || 'normal';
    const challenge = qs0.challenge || ($('sel-challenge') ? $('sel-challenge').value : 'rush') || 'rush';
    startGame({ diff, time:(qs0.time||80), run:(qs0.run||'play'), challenge, wantVR:false });
  }
}

// ✅ AUTO-RUN init
try{
  if (doc.readyState === 'loading'){
    ROOT.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
}catch(err){
  showFatal(err?.stack || err);
}