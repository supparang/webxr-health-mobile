// === /HeroHealth/game/main.js (2025-11-12 final link to /vr/hub.js) ===
import { HUD } from '../core/hud.js';
import { Engine } from '../core/engine.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import GameHub from '../vr/hub.js';  // ✅ ใช้ hub จาก /vr/hub.js

let hud = null;
let engine = null;
let hub = null;

// ------------------- Utils -------------------
function on(el, ev, fn, opts){ if(el && el.addEventListener) el.addEventListener(ev, fn, opts||false); }
function qs(s){ return document.querySelector(s); }
function qsa(s){ return document.querySelectorAll(s); }

// ------------------- Audio Unlock -------------------
function unlockAudioOnce(){
  try{
    if(window.__HHA_SFX && window.__HHA_SFX.ctx && window.__HHA_SFX.ctx.state==='suspended'){
      window.__HHA_SFX.ctx.resume();
    }
  }catch(_){}
}

// ------------------- HUD Ready -------------------
function announceHudReady(){
  try{
    window.dispatchEvent(new CustomEvent('hha:hud-ready',{detail:{anchorId:'hudTop',scoreBox:true}}));
  }catch(_){}
}

// ------------------- Boot -------------------
function bootApp(){
  // HUD
  try{
    hud = new HUD();
    const wrap = qs('.game-wrap') || document.body;
    hud.mount(wrap);
  }catch(e){ console.log('[main] HUD error', e); }

  // Fever UI
  try{
    ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);
  }catch(_){}

  // Engine
  try{
    engine = new Engine();
    if(engine.start) engine.start();
    on(window,'hha:pause',()=>engine.pause());
    on(window,'hha:resume',()=>engine.resume());
    on(document,'visibilitychange',()=>{
      if(!engine) return;
      if(document.hidden) engine.pause(); else engine.resume();
    });
  }catch(e){ console.log('[main] Engine error', e); }

  // HUD Sync
  on(window,'hha:time',(e)=>{
    const sec=(e?.detail?.sec)||0;
    if(hud) hud.setTimer(sec);
  });
  on(window,'hha:score',(e)=>{
    const d=e?.detail||{};
    if(hud){ if(d.score!=null) hud.setScore(d.score); if(d.combo!=null) hud.setCombo(d.combo); }
  });
  on(window,'hha:fever',(e)=>{
    const onF=!!(e?.detail?.active);
    try{ setFeverActive(onF); }catch(_){}
  });

  // HUD announce (หลายรอบกันพลาด)
  announceHudReady();
  let tries=0, id=setInterval(()=>{ announceHudReady(); if(++tries>15) clearInterval(id); },150);

  // unlock audio
  on(window,'pointerdown',unlockAudioOnce,{once:true});

  // GameHub
  try{
    hub = new GameHub();
    console.log('[main] Hub ready');
  }catch(e){
    console.warn('[main] Hub load fail', e);
  }

  // ปุ่มเริ่มเกม
  const btnStart=qs('#btnStart')||qs('[data-action="start"]');
  if(btnStart){
    on(btnStart,'click',(ev)=>{
      try{ev.preventDefault();}catch(_){}
      if(hub && hub.startGame) hub.startGame();
    });
  }

  // ปุ่มเลือกโหมด
  const modeBtns=qsa('[data-mode]');
  for(let i=0;i<modeBtns.length;i++){
    const btn=modeBtns[i];
    on(btn,'click',(ev)=>{
      try{ev.preventDefault();}catch(_){}
      const m=btn.getAttribute('data-mode')||'goodjunk';
      if(hub && hub.selectMode) hub.selectMode(m);
    });
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootApp);
else bootApp();

window.__HHA_BOOT_OK='main.js';
// === Result Modal Overlay (คะแนน + ภารกิจสำเร็จ) ===
(function(){
  var overlay = null, listBox = null, scoreEl = null, comboEl = null, timeEl = null, goalEl = null, titleEl = null;
  var btnAgain = null, btnMenu = null, btnClose = null;
  var _hubRef = null; // จะอ้างถึง hub ใน main.js ถ้ามี

  // รับ hub จาก main.js ถ้าถูกประกาศไว้แบบตัวแปรบนสุด
  try { if (typeof hub !== 'undefined') _hubRef = hub; } catch(_){}

  // inject CSS ครั้งเดียว
  function injectStyles(){
    if (document.getElementById('hha-result-style')) return;
    var st = document.createElement('style');
    st.id = 'hha-result-style';
    st.textContent = [
      '.hha-result-overlay{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);} ',
      '.hha-result-card{width:min(840px,92vw);max-height:86vh;overflow:auto;background:#0b1220cc;backdrop-filter:blur(8px);border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,.45);border-radius:18px;padding:20px;color:#e2e8f0;font:600 14px system-ui,Segoe UI,Inter,sans-serif;} ',
      '.hha-result-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;} ',
      '.hha-result-title{font-weight:900;font-size:20px;letter-spacing:.3px;} ',
      '.hha-result-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 6px;} ',
      '.hha-kpi{background:#0f172acc;border:1px solid #334155;border-radius:12px;padding:12px;} ',
      '.hha-kpi b{display:block;font-size:12px;color:#93c5fd;font-weight:800;margin-bottom:6px;} ',
      '.hha-kpi .v{font-size:22px;font-weight:900;color:#f8fafc;} ',
      '.hha-goal-ok{color:#22c55e;} .hha-goal-ng{color:#ef4444;} ',
      '.hha-quest-wrap{margin-top:12px;border-top:1px dashed #334155;padding-top:12px;} ',
      '.hha-quest-wrap h3{margin:0 0 8px 0;font-weight:900;font-size:16px;color:#93c5fd;} ',
      '.hha-quest-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;} ',
      '.hha-quest{display:flex;align-items:center;gap:10px;background:#0f172acc;border:1px solid #263244;border-radius:12px;padding:10px;} ',
      '.hha-quest .check{width:22px;height:22px;flex:0 0 22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;} ',
      '.hha-quest.done .check{background:#16a34a;color:#fff;border:1px solid #15803d;} ',
      '.hha-quest.fail .check{background:#334155;color:#94a3b8;border:1px solid #475569;} ',
      '.hha-quest .txt{flex:1 1 auto;} ',
      '.hha-quest .meta{color:#94a3b8;font-weight:700;font-size:12px;} ',
      '.hha-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;} ',
      '.hha-btn{appearance:none;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;} ',
      '.hha-btn:hover{border-color:#94a3b8;} ',
      '.hha-btn.primary{background:#2563eb;border-color:#1d4ed8;color:white;} ',
      '.hha-badge-win{background:#16a34a1a;border:1px solid #22c55e;color:#86efac;padding:4px 8px;border-radius:999px;font-weight:900;} ',
      '.hha-badge-time{background:#334155;color:#cbd5e1;padding:4px 8px;border-radius:999px;font-weight:800;border:1px solid #475569;} ',
      '@media (max-width:640px){ .hha-result-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .hha-quest-list{grid-template-columns:1fr;} }'
    ].join('');
    document.head.appendChild(st);
  }

  // สร้าง DOM overlay ครั้งเดียว
  function ensureOverlay(){
    if (overlay) return;
    injectStyles();

    overlay = document.createElement('div');
    overlay.className = 'hha-result-overlay';
    overlay.id = 'hhaResultOverlay';

    var card = document.createElement('div');
    card.className = 'hha-result-card';

    var head = document.createElement('div');
    head.className = 'hha-result-head';

    titleEl = document.createElement('div');
    titleEl.className = 'hha-result-title';
    titleEl.textContent = 'สรุปผลการเล่น';

    var badgeTime = document.createElement('div');
    badgeTime.className = 'hha-badge-time';
    badgeTime.id = 'hhaResTimeBadge';
    badgeTime.textContent = 'TIME 0s';

    head.appendChild(titleEl);
    head.appendChild(badgeTime);

    var grid = document.createElement('div');
    grid.className = 'hha-result-grid';

    var k1 = document.createElement('div'); k1.className = 'hha-kpi';
    var k2 = document.createElement('div'); k2.className = 'hha-kpi';
    var k3 = document.createElement('div'); k3.className = 'hha-kpi';
    var k4 = document.createElement('div'); k4.className = 'hha-kpi';

    var b1 = document.createElement('b'); b1.textContent = 'คะแนนรวม';
    var b2 = document.createElement('b'); b2.textContent = 'คอมโบสูงสุด';
    var b3 = document.createElement('b'); b3.textContent = 'เป้าหมาย';
    var b4 = document.createElement('b'); b4.textContent = 'พลาด (miss)';

    scoreEl = document.createElement('div'); scoreEl.className = 'v'; scoreEl.textContent = '0';
    comboEl = document.createElement('div'); comboEl.className = 'v'; comboEl.textContent = '0';
    goalEl  = document.createElement('div'); goalEl.className  = 'v'; goalEl.innerHTML = '<span class="hha-goal-ng">ยังไม่ถึง</span>';
    var missEl = document.createElement('div'); missEl.className = 'v'; missEl.textContent = '0';

    k1.appendChild(b1); k1.appendChild(scoreEl);
    k2.appendChild(b2); k2.appendChild(comboEl);
    k3.appendChild(b3); k3.appendChild(goalEl);
    k4.appendChild(b4); k4.appendChild(missEl);

    grid.appendChild(k1); grid.appendChild(k2); grid.appendChild(k3); grid.appendChild(k4);

    var qwrap = document.createElement('div');
    qwrap.className = 'hha-quest-wrap';

    var qh = document.createElement('h3');
    qh.textContent = 'ภารกิจที่สุ่มให้รอบนี้';
    qwrap.appendChild(qh);

    listBox = document.createElement('div');
    listBox.className = 'hha-quest-list';
    qwrap.appendChild(listBox);

    var actions = document.createElement('div');
    actions.className = 'hha-actions';

    btnAgain = document.createElement('button');
    btnAgain.className = 'hha-btn primary';
    btnAgain.textContent = 'เล่นอีกครั้ง';

    btnMenu = document.createElement('button');
    btnMenu.className = 'hha-btn';
    btnMenu.textContent = 'กลับเมนู';

    btnClose = document.createElement('button');
    btnClose.className = 'hha-btn';
    btnClose.textContent = 'ปิด';

    actions.appendChild(btnAgain);
    actions.appendChild(btnMenu);
    actions.appendChild(btnClose);

    card.appendChild(head);
    card.appendChild(grid);
    card.appendChild(qwrap);
    card.appendChild(actions);

    overlay.appendChild(card);
    (document.querySelector('.game-wrap') || document.body).appendChild(overlay);

    // ปุ่มกด
    btnAgain.addEventListener('click', function(ev){
      try{ ev.preventDefault(); }catch(_){}
      hide();
      // ให้ Hub เริ่มเกมใหม่ (โหมดเดิม, พารามิเตอร์เดิมจาก Hub)
      try { if (_hubRef && _hubRef.startGame) _hubRef.startGame(); } catch(_){}
    });

    btnMenu.addEventListener('click', function(ev){
      try{ ev.preventDefault(); }catch(_){}
      hide();
      // ปล่อยให้ Hub เปิดเมนูใน _endGame() อยู่แล้ว — ถ้าต้อง force:
      // try { window.dispatchEvent(new CustomEvent('hha:show-menu')); } catch(_){}
    });

    btnClose.addEventListener('click', function(ev){
      try{ ev.preventDefault(); }catch(_){}
      hide();
    });

    // คลิกพื้นหลังเพื่อปิด
    overlay.addEventListener('click', function(e){
      try{
        if (e.target === overlay) hide();
      }catch(_){}
    });

    // เก็บ ref สำหรับอัปเดต miss ด้วย
    overlay._missEl = missEl;
    overlay._timeBadge = badgeTime;
  }

  function fmt(n){ n = Number(n)||0; return n.toLocaleString(); }

  function buildQuestItem(label, level, done, prog, target){
    var row = document.createElement('div');
    row.className = 'hha-quest ' + (done?'done':'fail');

    var ck = document.createElement('div'); ck.className = 'check';
    ck.textContent = done ? '✓' : '•';

    var txt = document.createElement('div'); txt.className = 'txt';
    txt.textContent = label || '';

    var meta = document.createElement('div'); meta.className = 'meta';
    var lv = level ? ('[' + level + '] ') : '';
    if (target>0){
      meta.textContent = lv + '(' + (Number(prog)||0) + '/' + (Number(target)||0) + ')';
    } else {
      meta.textContent = lv;
    }

    row.appendChild(ck);
    row.appendChild(txt);
    row.appendChild(meta);
    return row;
  }

  function clearChildren(el){
    try{
      while (el && el.firstChild) el.removeChild(el.firstChild);
    }catch(_){}
  }

  function show(detail){
    ensureOverlay();
    if (!overlay) return;

    // Title
    try {
      var modeName = detail && detail.mode ? String(detail.mode) : 'Result';
      var diff = detail && detail.difficulty ? String(detail.difficulty) : '';
      titleEl.textContent = 'สรุปผล: ' + modeName + (diff ? (' ('+diff+')') : '');
    } catch(_){}

    // KPIs
    try { scoreEl.textContent = fmt(detail && detail.score); } catch(_){}
    try { comboEl.textContent = fmt(detail && (detail.comboMax!=null?detail.comboMax:detail.combo)); } catch(_){}
    try { overlay._missEl.textContent = fmt(detail && detail.misses); } catch(_){}

    try {
      var ok = !!(detail && detail.goalCleared);
      var tgt = (detail && detail.goalTarget!=null) ? Number(detail.goalTarget) : null;
      goalEl.innerHTML = ok ? '<span class="hha-goal-ok">ถึงเป้า'+(tgt!=null?(' ('+fmt(tgt)+')'):'')+'</span>'
                            : '<span class="hha-goal-ng">ยังไม่ถึง'+(tgt!=null?(' ('+fmt(tgt)+')'):'')+'</span>';
    } catch(_){}

    // เวลา (badge)
    try {
      var dur = detail && detail.duration!=null ? Number(detail.duration) : 0;
      overlay._timeBadge.textContent = 'TIME ' + fmt(dur) + 's';
    } catch(_){}

    // Quests list
    try {
      clearChildren(listBox);
      var arr = (detail && detail.questsSummary && detail.questsSummary.slice) ? detail.questsSummary.slice(0, 12) : null;
      if (arr && arr.length){
        for (var i=0;i<arr.length;i++){
          var q = arr[i] || {};
          var row = buildQuestItem(String(q.label||''), String(q.level||''), !!q.done, Number(q.prog)||0, Number(q.target)||0);
          listBox.appendChild(row);
        }
      } else {
        var empty = document.createElement('div');
        empty.className = 'hha-quest fail';
        var ck = document.createElement('div'); ck.className = 'check'; ck.textContent = '•';
        var txt = document.createElement('div'); txt.className = 'txt'; txt.textContent = 'ไม่มีข้อมูลเควสต์จากรอบนี้';
        var meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = '';
        empty.appendChild(ck); empty.appendChild(txt); empty.appendChild(meta);
        listBox.appendChild(empty);
      }
    } catch(_){}

    overlay.style.display = 'flex';
  }

  function hide(){
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  // แสดง overlay เมื่อจบเกม
  window.addEventListener('hha:end', function(e){
    try{
      var d = e && e.detail ? e.detail : {};
      show(d);
    }catch(_){}
  });

})();
// === Result Modal Overlay (คะแนน + ภารกิจสำเร็จ + Quest Count Badge) ===
(function(){
  var overlay = null, listBox = null, scoreEl = null, comboEl = null, goalEl = null, titleEl = null;
  var btnAgain = null, btnMenu = null, btnClose = null;
  var _hubRef = null; 
  try { if (typeof hub !== 'undefined') _hubRef = hub; } catch(_){}

  function injectStyles(){
    if (document.getElementById('hha-result-style')) return;
    var st = document.createElement('style');
    st.id = 'hha-result-style';
    st.textContent = [
      '.hha-result-overlay{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);} ',
      '.hha-result-card{width:min(840px,92vw);max-height:86vh;overflow:auto;background:#0b1220cc;backdrop-filter:blur(8px);border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,.45);border-radius:18px;padding:20px;color:#e2e8f0;font:600 14px system-ui,Segoe UI,Inter,sans-serif;} ',
      '.hha-result-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;} ',
      '.hha-result-title{font-weight:900;font-size:20px;letter-spacing:.3px;} ',
      '.hha-head-badges{display:flex;gap:8px;align-items:center;} ',
      '.hha-badge{background:#334155;color:#cbd5e1;padding:4px 8px;border-radius:999px;font-weight:800;border:1px solid #475569;} ',
      '.hha-badge-time{} ',
      '.hha-badge-quest{background:#1e293b;color:#a5b4fc;border-color:#4f46e5;} ',
      '.hha-result-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 6px;} ',
      '.hha-kpi{background:#0f172acc;border:1px solid #334155;border-radius:12px;padding:12px;} ',
      '.hha-kpi b{display:block;font-size:12px;color:#93c5fd;font-weight:800;margin-bottom:6px;} ',
      '.hha-kpi .v{font-size:22px;font-weight:900;color:#f8fafc;} ',
      '.hha-goal-ok{color:#22c55e;} .hha-goal-ng{color:#ef4444;} ',
      '.hha-quest-wrap{margin-top:12px;border-top:1px dashed #334155;padding-top:12px;} ',
      '.hha-quest-wrap h3{margin:0 0 8px 0;font-weight:900;font-size:16px;color:#93c5fd;} ',
      '.hha-quest-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;} ',
      '.hha-quest{display:flex;align-items:center;gap:10px;background:#0f172acc;border:1px solid #263244;border-radius:12px;padding:10px;} ',
      '.hha-quest .check{width:22px;height:22px;flex:0 0 22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;} ',
      '.hha-quest.done .check{background:#16a34a;color:#fff;border:1px solid #15803d;} ',
      '.hha-quest.fail .check{background:#334155;color:#94a3b8;border:1px solid #475569;} ',
      '.hha-quest .txt{flex:1 1 auto;} ',
      '.hha-quest .meta{color:#94a3b8;font-weight:700;font-size:12px;} ',
      '.hha-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;} ',
      '.hha-btn{appearance:none;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;} ',
      '.hha-btn:hover{border-color:#94a3b8;} ',
      '.hha-btn.primary{background:#2563eb;border-color:#1d4ed8;color:white;} ',
      '@media (max-width:640px){ .hha-result-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .hha-quest-list{grid-template-columns:1fr;} }'
    ].join('');
    document.head.appendChild(st);
  }

  function ensureOverlay(){
    if (overlay) return;
    injectStyles();

    overlay = document.createElement('div');
    overlay.className = 'hha-result-overlay';
    overlay.id = 'hhaResultOverlay';

    var card = document.createElement('div'); card.className = 'hha-result-card';

    var head = document.createElement('div'); head.className = 'hha-result-head';
    titleEl = document.createElement('div'); titleEl.className = 'hha-result-title'; titleEl.textContent = 'สรุปผลการเล่น';

    var badges = document.createElement('div'); badges.className = 'hha-head-badges';
    var badgeTime = document.createElement('div'); badgeTime.className = 'hha-badge hha-badge-time'; badgeTime.id = 'hhaResTimeBadge'; badgeTime.textContent = 'TIME 0s';
    var badgeQuests = document.createElement('div'); badgeQuests.className = 'hha-badge hha-badge-quest'; badgeQuests.id = 'hhaResQuestBadge'; badgeQuests.textContent = 'QUESTS 0/0';

    badges.appendChild(badgeQuests);
    badges.appendChild(badgeTime);

    head.appendChild(titleEl);
    head.appendChild(badges);

    var grid = document.createElement('div'); grid.className = 'hha-result-grid';
    var k1 = document.createElement('div'); k1.className = 'hha-kpi';
    var k2 = document.createElement('div'); k2.className = 'hha-kpi';
    var k3 = document.createElement('div'); k3.className = 'hha-kpi';
    var k4 = document.createElement('div'); k4.className = 'hha-kpi';

    var b1 = document.createElement('b'); b1.textContent = 'คะแนนรวม';
    var b2 = document.createElement('b'); b2.textContent = 'คอมโบสูงสุด';
    var b3 = document.createElement('b'); b3.textContent = 'เป้าหมาย';
    var b4 = document.createElement('b'); b4.textContent = 'พลาด (miss)';

    scoreEl = document.createElement('div'); scoreEl.className = 'v'; scoreEl.textContent = '0';
    comboEl = document.createElement('div'); comboEl.className = 'v'; comboEl.textContent = '0';
    goalEl  = document.createElement('div'); goalEl.className  = 'v'; goalEl.innerHTML = '<span class="hha-goal-ng">ยังไม่ถึง</span>';
    var missEl = document.createElement('div'); missEl.className = 'v'; missEl.textContent = '0';

    k1.appendChild(b1); k1.appendChild(scoreEl);
    k2.appendChild(b2); k2.appendChild(comboEl);
    k3.appendChild(b3); k3.appendChild(goalEl);
    k4.appendChild(b4); k4.appendChild(missEl);

    grid.appendChild(k1); grid.appendChild(k2); grid.appendChild(k3); grid.appendChild(k4);

    var qwrap = document.createElement('div'); qwrap.className = 'hha-quest-wrap';
    var qh = document.createElement('h3'); qh.textContent = 'ภารกิจที่สุ่มให้รอบนี้';
    listBox = document.createElement('div'); listBox.className = 'hha-quest-list';
    qwrap.appendChild(qh); qwrap.appendChild(listBox);

    var actions = document.createElement('div'); actions.className = 'hha-actions';
    btnAgain = document.createElement('button'); btnAgain.className = 'hha-btn primary'; btnAgain.textContent = 'เล่นอีกครั้ง';
    btnMenu  = document.createElement('button'); btnMenu.className  = 'hha-btn'; btnMenu.textContent = 'กลับเมนู';
    btnClose = document.createElement('button'); btnClose.className = 'hha-btn'; btnClose.textContent = 'ปิด';
    actions.appendChild(btnAgain); actions.appendChild(btnMenu); actions.appendChild(btnClose);

    card.appendChild(head);
    card.appendChild(grid);
    card.appendChild(qwrap);
    card.appendChild(actions);

    overlay.appendChild(card);
    (document.querySelector('.game-wrap') || document.body).appendChild(overlay);

    btnAgain.addEventListener('click', function(ev){
      try{ ev.preventDefault(); }catch(_){}
      hide();
      try { if (_hubRef && _hubRef.startGame) _hubRef.startGame(); } catch(_){}
    });
    btnMenu.addEventListener('click', function(ev){
      try{ ev.preventDefault(); }catch(_){}
      hide();
    });
    btnClose.addEventListener('click', function(ev){
      try{ ev.preventDefault(); }catch(_){}
      hide();
    });
    overlay.addEventListener('click', function(e){ try{ if (e.target === overlay) hide(); }catch(_){}; });

    overlay._missEl = missEl;
    overlay._timeBadge = badgeTime;
    overlay._questBadge = badgeQuests;
  }

  function fmt(n){ n = Number(n)||0; return n.toLocaleString(); }
  function clearChildren(el){ try{ while (el && el.firstChild) el.removeChild(el.firstChild); }catch(_){} }

  function buildQuestItem(label, level, done, prog, target){
    var row = document.createElement('div');
    row.className = 'hha-quest ' + (done?'done':'fail');

    var ck = document.createElement('div'); ck.className = 'check';
    ck.textContent = done ? '✓' : '•';

    var txt = document.createElement('div'); txt.className = 'txt';
    txt.textContent = label || '';

    var meta = document.createElement('div'); meta.className = 'meta';
    var lv = level ? ('[' + level + '] ') : '';
    if ((Number(target)||0) > 0){
      meta.textContent = lv + '(' + (Number(prog)||0) + '/' + (Number(target)||0) + ')';
    } else {
      meta.textContent = lv;
    }

    row.appendChild(ck); row.appendChild(txt); row.appendChild(meta);
    return row;
  }

  function computeQuestCounts(detail){
    var x = 0, y = 0;

    // 1) ใช้ค่าที่โหมดส่งมาโดยตรงถ้ามี
    if (detail && typeof detail.questsCleared === 'number' && typeof detail.questsTotal === 'number'){
      x = Number(detail.questsCleared)||0;
      y = Math.max(0, Number(detail.questsTotal)||0);
      return {x:x,y:y};
    }

    // 2) คำนวณจาก questsSummary
    var arr = (detail && detail.questsSummary && detail.questsSummary.slice) ? detail.questsSummary.slice() : null;
    if (arr && arr.length){
      y = arr.length;
      for (var i=0;i<arr.length;i++){
        var q = arr[i]||{};
        if (q && q.done) x++;
      }
      return {x:x,y:y};
    }

    // 3) ไม่พบข้อมูล
    return {x:0,y:0};
  }

  function show(detail){
    ensureOverlay();
    if (!overlay) return;

    try {
      var modeName = detail && detail.mode ? String(detail.mode) : 'Result';
      var diff = detail && detail.difficulty ? String(detail.difficulty) : '';
      titleEl.textContent = 'สรุปผล: ' + modeName + (diff ? (' ('+diff+')') : '');
    } catch(_){}

    try { scoreEl.textContent = fmt(detail && detail.score); } catch(_){}
    try { 
      var cmx = (detail && detail.comboMax!=null) ? detail.comboMax : (detail && detail.combo!=null ? detail.combo : 0);
      comboEl.textContent = fmt(cmx);
    } catch(_){}
    try { overlay._missEl.textContent = fmt(detail && detail.misses); } catch(_){}

    try {
      var ok = !!(detail && detail.goalCleared);
      var tgt = (detail && detail.goalTarget!=null) ? Number(detail.goalTarget) : null;
      goalEl.innerHTML = ok ? '<span class="hha-goal-ok">ถึงเป้า'+(tgt!=null?(' ('+fmt(tgt)+')'):'')+'</span>'
                            : '<span class="hha-goal-ng">ยังไม่ถึง'+(tgt!=null?(' ('+fmt(tgt)+')'):'')+'</span>';
    } catch(_){}

    try {
      var dur = detail && detail.duration!=null ? Number(detail.duration) : 0;
      overlay._timeBadge.textContent = 'TIME ' + fmt(dur) + 's';
    } catch(_){}

    // ✅ อัปเดต Quest badge: QUESTS x/y
    try {
      var c = computeQuestCounts(detail);
      overlay._questBadge.textContent = 'QUESTS ' + fmt(c.x) + '/' + fmt(c.y);
    } catch(_){}

    // รายการเควสต์
    try {
      clearChildren(listBox);
      var arr = (detail && detail.questsSummary && detail.questsSummary.slice) ? detail.questsSummary.slice(0, 12) : null;
      if (arr && arr.length){
        for (var i=0;i<arr.length;i++){
          var q = arr[i] || {};
          var row = buildQuestItem(String(q.label||''), String(q.level||''), !!q.done, Number(q.prog)||0, Number(q.target)||0);
          listBox.appendChild(row);
        }
      } else {
        var empty = document.createElement('div');
        empty.className = 'hha-quest fail';
        var ck = document.createElement('div'); ck.className = 'check'; ck.textContent = '•';
        var txt = document.createElement('div'); txt.className = 'txt'; txt.textContent = 'ไม่มีข้อมูลเควสต์จากรอบนี้';
        var meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = '';
        empty.appendChild(ck); empty.appendChild(txt); empty.appendChild(meta);
        listBox.appendChild(empty);
      }
    } catch(_){}

    overlay.style.display = 'flex';
  }

  function hide(){ if (overlay) overlay.style.display = 'none'; }

  window.addEventListener('hha:end', function(e){
    try{ show(e && e.detail ? e.detail : {}); }catch(_){}
  });

})();
