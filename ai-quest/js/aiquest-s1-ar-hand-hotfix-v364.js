/* =========================================================
   AI Quest S1 AR Hand Hotfix v4.0.6
   Desktop: Hand Easy Mode remains available.
   Phone: Touch-first Compact AR Assist; no automatic hand-tracking loop.
========================================================= */
(() => {
  'use strict';

  const V = 'v4.0.6-s1-hand-touch-first-mobile';
  const VER = '0.4.1646424915';
  const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VER}`;
  const SRC = `${BASE}/hands.js`;
  const $ = (id) => document.getElementById(id);
  const CFG = {dwell:1850,cooldown:1400,pinch:.075,pad:34,magnet:92};

  let hands = null;
  let running = false;
  let starting = false;
  let raf = 0;
  let lastPinch = false;
  let target = null;
  let targetAt = 0;
  let lastAction = 0;
  let smoothX = null;
  let smoothY = null;
  let failures = 0;
  let token = 0;

  const mobile = () => window.matchMedia?.('(max-width:600px)').matches;
  const panel = () => $('s1ar368') || $('s1ar366') || $('s1ArPanelV366');
  const video = () => $('s1video368') || $('s1arvideo366') || $('s1ArVideoV366');
  const open = () => Boolean(panel()?.classList.contains('open'));

  function css(){
    if ($('s1hstyle406')) return;
    const style = document.createElement('style');
    style.id = 's1hstyle406';
    style.textContent = `
      .s1hc406{position:fixed;left:0;top:0;width:45px;height:45px;border:3px solid #67e8f9;border-radius:50%;z-index:100030;pointer-events:none;transform:translate(-50%,-50%);display:none;background:#02061722;box-shadow:0 0 0 11px #22d3ee2b,0 0 30px #22d3ee88}
      .s1hc406.pinch{border-color:#86efac;box-shadow:0 0 0 14px #86efac44,0 0 36px #86efacaa}
      .s1hr406{position:fixed;left:0;top:0;width:74px;height:74px;border-radius:50%;z-index:100029;pointer-events:none;transform:translate(-50%,-50%);display:none;background:conic-gradient(#86efac var(--p,0deg),#ffffff28 0deg);-webkit-mask:radial-gradient(circle,transparent 54%,#000 56%);mask:radial-gradient(circle,transparent 54%,#000 56%)}
      .s1hs406{position:fixed;left:12px;top:calc(67px + env(safe-area-inset-top,0px));z-index:100031;display:none;max-width:min(92vw,620px);padding:9px 13px;border-radius:999px;color:#e0f2fe;background:#0f172aed;border:1px solid #ffffff33;font:900 12px system-ui;backdrop-filter:blur(12px)}
      .s1retry406{margin-left:8px;padding:4px 8px;border-radius:999px;border:1px solid #67e8f977;background:#164e6388;color:#cffafe;font:800 11px system-ui;cursor:pointer}
      @media(max-width:600px){.s1hs406,.s1hc406,.s1hr406{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ui(){
    css();
    [['s1hc406','s1hc406'],['s1hr406','s1hr406'],['s1hs406','s1hs406']].forEach(([id,className]) => {
      if ($(id)) return;
      const node = document.createElement('div');
      node.id = id;
      node.className = className;
      document.body.appendChild(node);
    });
  }

  function status(message,retry=false){
    const node = $('s1hs406');
    if (!node) return;
    if (mobile()) { node.style.display = 'none'; return; }
    node.style.display = open() ? 'block' : 'none';
    node.textContent = message || '';
    if (retry) {
      const old = $('s1retry406');
      if (old) old.remove();
      const button = document.createElement('button');
      button.id = 's1retry406';
      button.className = 's1retry406';
      button.type = 'button';
      button.textContent = 'ลองตรวจมืออีกครั้ง';
      button.onclick = () => start(true);
      node.appendChild(button);
    }
  }

  function clearTarget(){
    target?.classList.remove('hand-target-v368');
    target = null;
    targetAt = 0;
    $('s1hr406')?.style.setProperty('--p','0deg');
  }

  function hide(){
    ['s1hc406','s1hr406'].forEach((id) => { const node = $(id); if (node) node.style.display = 'none'; });
    clearTarget();
  }

  function buttons(){
    return [
      ...document.querySelectorAll('#s1answers368 .ans:not([disabled])'),
      $('s1next368'),$('s1again368'),$('s1back368')
    ].filter((node) => node && !node.disabled && node.offsetParent !== null);
  }

  function hit(x,y){
    const direct = document.elementFromPoint(x,y)?.closest?.('#s1answers368 .ans:not([disabled]),#s1next368:not([disabled]),#s1again368:not([disabled]),#s1back368:not([disabled])');
    if (direct) return direct;
    let nearest = null;
    let best = Infinity;
    buttons().forEach((button) => {
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(x-centerX,y-centerY);
      const nearby = x >= rect.left-CFG.pad && x <= rect.right+CFG.pad && y >= rect.top-CFG.pad && y <= rect.bottom+CFG.pad;
      if ((nearby || distance < CFG.magnet) && distance < best) { nearest = button; best = distance; }
    });
    return nearest;
  }

  function activate(button,mode){
    const now = Date.now();
    if (!button || button.disabled || now-lastAction < CFG.cooldown) return;
    lastAction = now;
    const label = String(button.textContent || '').trim().replace(/\s+/g,' ').slice(0,48);
    clearTarget();
    try { button.focus({preventScroll:true}); } catch (_) {}
    button.click();
    status((mode === 'pinch' ? '✓ Pinch เลือก: ' : '✓ ชี้ค้างเลือก: ') + label);
  }

  function load(){
    return new Promise((resolve,reject) => {
      if (window.Hands) return resolve(window.Hands);
      const prior = [...document.scripts].find((script) => String(script.src || '').includes('@mediapipe/hands'));
      if (prior) {
        prior.addEventListener('load',() => window.Hands ? resolve(window.Hands) : reject(new Error('Hands API missing')),{once:true});
        prior.addEventListener('error',() => reject(new Error('MediaPipe load failed')),{once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = SRC;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => window.Hands ? resolve(window.Hands) : reject(new Error('Hands API missing'));
      script.onerror = () => reject(new Error('MediaPipe load failed'));
      document.head.appendChild(script);
    });
  }

  async function start(force=false){
    ui();
    if (mobile() && !force) return; // Phone stays touch-first unless a future explicit hand button calls force=true.
    if (!open() || starting || (running && !force)) return;
    const node = video();
    if (!node?.srcObject || node.readyState < 2) {
      status('Hand: กล้องยังไม่พร้อม • ใช้ mouse/touch ได้ทันที',true);
      return;
    }
    starting = true;
    failures = 0;
    const mine = ++token;
    status('Hand: กำลังเปิดตัวตรวจจับ…');
    try {
      const Hands = await load();
      if (!open() || mine !== token) return;
      hands = new Hands({locateFile:(file) => `${BASE}/${file}`});
      hands.setOptions({maxNumHands:1,modelComplexity:0,minDetectionConfidence:.42,minTrackingConfidence:.42});
      hands.onResults(results);
      running = true;
      status('Hand Easy Mode: ยกมือให้อยู่กลางกล้อง • ชี้ค้าง 1.8 วินาที หรือหนีบนิ้วเพื่อเลือก');
      loop(mine);
    } catch (error) {
      running = false;
      console.warn('[AIQuest S1 Hand] start failed',error);
      status('Hand เปิดไม่สำเร็จในเครื่องนี้ • ใช้ mouse/touch ได้ตามปกติ',true);
    } finally {
      starting = false;
    }
  }

  async function loop(mine){
    if (!running || !open() || mine !== token) return;
    const node = video();
    try {
      if (node?.readyState >= 2 && hands) await hands.send({image:node});
      failures = 0;
    } catch (error) {
      failures++;
      if (failures >= 2) {
        running = false;
        console.warn('[AIQuest S1 Hand] stopped after errors',error);
        status('Hand หยุดเพื่อป้องกันเกมค้าง • ใช้ mouse/touch ได้ตามปกติ',true);
        hide();
        return;
      }
    }
    raf = requestAnimationFrame(() => loop(mine));
  }

  function results(output){
    if (!running || !open()) { hide(); return; }
    const landmarks = output.multiHandLandmarks?.[0];
    if (!landmarks?.[8] || !landmarks?.[4]) {
      hide();
      status('Hand: ยังไม่พบมือ • ยกมือให้อยู่ในกรอบกล้อง');
      return;
    }
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const rawX = (1-indexTip.x)*innerWidth;
    const rawY = indexTip.y*innerHeight;
    smoothX = smoothX == null ? rawX : smoothX*.52 + rawX*.48;
    smoothY = smoothY == null ? rawY : smoothY*.52 + rawY*.48;
    const pinching = Math.hypot(indexTip.x-thumbTip.x,indexTip.y-thumbTip.y,(indexTip.z||0)-(thumbTip.z||0)) < CFG.pinch;
    const cursor = $('s1hc406');
    const ring = $('s1hr406');
    cursor.style.display = 'block';
    cursor.style.left = smoothX+'px';
    cursor.style.top = smoothY+'px';
    cursor.classList.toggle('pinch',pinching);
    ring.style.display = 'block';
    ring.style.left = smoothX+'px';
    ring.style.top = smoothY+'px';
    const button = hit(smoothX,smoothY);
    if (!button) {
      clearTarget();
      status('Hand Easy Mode: เลื่อนปลายนิ้วเข้าใกล้ช่องคำตอบ');
      lastPinch = pinching;
      return;
    }
    if (button !== target) {
      clearTarget();
      target = button;
      targetAt = Date.now();
      target.classList.add('hand-target-v368');
    }
    const elapsed = Date.now()-targetAt;
    ring.style.setProperty('--p',Math.min(360,Math.round(elapsed/CFG.dwell*360))+'deg');
    const label = String(button.textContent || '').trim().replace(/\s+/g,' ').slice(0,50);
    status(pinching ? `Hand: pinch เพื่อเลือก ${label}` : `Hand Easy Mode: เล็ง “${label}” • วงเต็มใน ${Math.max(0,(CFG.dwell-elapsed)/1000).toFixed(1)} วิ`);
    if (pinching && !lastPinch) activate(button,'pinch');
    else if (elapsed >= CFG.dwell) activate(button,'dwell');
    lastPinch = pinching;
  }

  function stop(){
    token++;
    running = false;
    starting = false;
    cancelAnimationFrame(raf);
    raf = 0;
    smoothX = null;
    smoothY = null;
    lastPinch = false;
    hide();
    const node = $('s1hs406');
    if (node) node.style.display = 'none';
  }

  function watch(){
    ui();
    let wasOpen = false;
    setInterval(() => {
      const active = open();
      if (active && !wasOpen) {
        wasOpen = true;
        if (!mobile()) setTimeout(() => start(false),700);
      } else if (!active && wasOpen) {
        wasOpen = false;
        stop();
      }
    },350);
  }

  window.AIQUEST_S1_HAND_HOTFIX = {version:V,start,stop,config:CFG};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',watch);
  else watch();
  console.log('[AIQuest] '+V+' loaded');
})();
