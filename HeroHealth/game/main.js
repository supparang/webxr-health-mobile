// === /HeroHealth/game/main.js (2025-11-12 LATEST cohesive) ===
// - Parses URL (?mode, ?diff, ?duration, ?autostart)
// - Binds Start button (VR + DOM) → boot selected mode → ctrl.start()
// - Updates HUD: time (mm:ss), score, combo via hha:time / hha:score
// - Shows result overlay with Quest badge + "กลับ Hub" + "เล่นอีกครั้ง"
// - Announces HUD ready (for fever bar docking) and layer ready (from factory)

(function(){
  'use strict';

  // ---------- Helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  function getParams(){
    const qp = new URLSearchParams(location.search);
    return {
      mode     : (qp.get('mode')||'goodjunk').toLowerCase(),
      diff     : (qp.get('diff')||'normal').toLowerCase(),
      duration : Math.max(10, +(qp.get('duration')||60)),
      autostart: qp.get('autostart') === '1'
    };
  }
  function fmtSec(sec){
    sec = (sec|0); if(sec<0) sec = 0;
    const m = Math.floor(sec/60), s = sec%60;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }

  // Map โหมด → ไฟล์ใน /HeroHealth/modes
  function modePath(mode){
    switch(mode){
      case 'goodjunk':  return './modes/goodjunk.safe.js';
      case 'groups':    return './modes/groups.safe.js';
      case 'hydration': return './modes/hydration.quest.js';
      case 'plate':     return './modes/plate.safe.js';
      default:          return './modes/goodjunk.safe.js';
    }
  }

  // ---------- HUD bindings ----------
  let hud = {
    scoreEl: null,
    comboEl: null,
    timeEl : null,
    score:  0,
    combo:  0
  };

  function bindHUD(){
    hud.scoreEl = $('#hudScore');
    hud.comboEl = $('#hudCombo');
    hud.timeEl  = $('#hudTime');

    // เวลา (mm:ss) จาก factory
    window.addEventListener('hha:time', (e)=>{
      const sec = (e?.detail?.sec|0);
      if (hud.timeEl) hud.timeEl.textContent = fmtSec(sec);
    });

    // คะแนน/คอมโบ: ใช้ delta จาก factory (hha:score)
    window.addEventListener('hha:score', (e)=>{
      const d = +((e && e.detail && e.detail.delta) || 0);
      const good = !!(e && e.detail && e.detail.good);
      hud.score = Math.max(0, hud.score + d);
      hud.combo = good ? (hud.combo+1) : 0;
      if (hud.scoreEl) hud.scoreEl.textContent = hud.score.toLocaleString();
      if (hud.comboEl) hud.comboEl.textContent = String(hud.combo);
    });

    // แจ้งให้ระบบย่อย (ui-fever.js) รู้ว่า HUD พร้อมสำหรับ dock
    try{ window.dispatchEvent(new CustomEvent('hha:hud-ready')); }catch(_){}
  }

  // ---------- Result Overlay ----------
  function paintQuestBadge(badge, x, y){
    const r = y ? (x/y) : 0;
    badge.style.borderColor = (r>=1)?'#16a34a':(r>=0.5?'#f59e0b':'#ef4444');
    badge.style.background  = (r>=1)?'#16a34a22':(r>=0.5?'#f59e0b22':'#ef444422');
    badge.style.color       = (r>=1)?'#bbf7d0':(r>=0.5?'#fde68a':'#fecaca');
  }

  function showResult(detail, opts){
    const old = $('#resultOverlay'); if (old) old.remove();
    const o = document.createElement('div'); o.id='resultOverlay';
    o.innerHTML = `
      <div class="card">
        <h2>สรุปผล</h2>
        <div class="stars">★★★★★</div>
        <div class="stats">
          <div>โหมด: ${detail.mode||opts.mode}</div>
          <div>ระดับ: ${detail.difficulty||opts.diff}</div>
          <div>คะแนน: ${(+detail.score||0).toLocaleString()}</div>
          <div>คอมโบสูงสุด: ${detail.comboMax ?? 0}</div>
          <div>พลาด: ${detail.misses ?? 0}</div>
          <div>เวลา: ${fmtSec(detail.duration ?? opts.duration)}</div>
          <div class="questBadge">Mini Quests ${detail.questsCleared ?? 0}/${detail.questsTotal ?? 0}</div>
        </div>
        <div class="btns">
          <button id="btnHub">กลับ Hub</button>
          <button id="btnRetry">เล่นอีกครั้ง</button>
        </div>
      </div>
    `;
    document.body.appendChild(o);
    const badge = o.querySelector('.questBadge');
    paintQuestBadge(badge, +(detail.questsCleared||0), +(detail.questsTotal||0));

    // ปุ่มกลับ Hub (คงค่า mode/diff ปัจจุบัน)
    o.querySelector('#btnHub').onclick = ()=>{
      const url = `./hub.html?mode=${encodeURIComponent(opts.mode)}&diff=${encodeURIComponent(opts.diff)}`;
      location.href = url;
    };
    o.querySelector('#btnRetry').onclick = ()=>location.reload();
  }

  // result overlay style (เบาๆ)
  (function injectResultCSS(){
    if (document.getElementById('hha-result-style')) return;
    const css = document.createElement('style'); css.id='hha-result-style';
    css.textContent = `
      #resultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;}
      #resultOverlay .card{background:#1e293b;border-radius:16px;padding:24px;min-width:280px;color:#fff;text-align:center;box-shadow:0 0 20px #000a;}
      #resultOverlay .stats{display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px;}
      .questBadge{margin-top:8px;padding:4px 8px;border:2px solid #444;border-radius:8px;display:inline-block;font-weight:600;}
      .btns{margin-top:16px;display:flex;justify-content:center;gap:12px;}
      .btns button{padding:6px 12px;border-radius:8px;border:none;font-weight:700;cursor:pointer}
      .btns #btnHub{background:#0f172a;color:#fff;}
      .btns #btnRetry{background:#22c55e;color:#fff;}
    `;
    document.head.appendChild(css);
  })();

  // ---------- Boot & Start ----------
  let ctrl = null;
  let started = false;

  async function launch(opts){
    if (started) return;
    started = true;

    // ซ่อนแผงเริ่ม & ปุ่ม start
    try{ $('#startPanel')?.setAttribute('visible','false'); }catch(_){}
    try{ $('#btnStart')?.classList.add('hidden'); $('#btnStart').style.display='none'; }catch(_){}

    // โหลดโมดตามโหมด
    const path = modePath(opts.mode);
    let mod = null;
    try{
      mod = await import(path);
    }catch(e){
      console.error('[main] load mode failed:', path, e);
      started = false;
      alert('เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n'+path);
      return;
    }

    // boot โหมด (จะผูก hha:* events ภายใน)
    try{
      ctrl = await mod.boot({
        difficulty: opts.diff,
        duration  : opts.duration
      });
    }catch(e){
      console.error('[main] boot failed:', e);
      started = false;
      alert('โหมดเริ่มทำงานไม่สำเร็จ');
      return;
    }

    // Start
    try{ ctrl.start(); }catch(_){}

    // เมื่อ factory end → แสดงสรุปผล
    const onEndOnce = (e)=>{
      try{ window.removeEventListener('hha:end', onEndOnce); }catch(_){}
      const detail = (e && e.detail) ? e.detail : {};
      showResult(detail, opts);
    };
    window.addEventListener('hha:end', onEndOnce, { once:true });
  }

  function wireStartButtons(opts){
    const domBtn = $('#btnStart');
    const vrBtn  = $('#vrStartBtn');

    const go = (ev)=>{
      try{ ev?.preventDefault?.(); }catch(_){}
      launch(opts);
    };

    domBtn?.addEventListener('click', go);
    vrBtn ?.addEventListener('click', go);

    // ออโต้สตาร์ท (จาก hub)
    if (opts.autostart) {
      // ให้ layout เสถียรก่อน
      requestAnimationFrame(()=>requestAnimationFrame(()=>launch(opts)));
    }
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    const opts = getParams();

    // อัปเดตป้าย "เริ่ม: MODE" บน VR panel
    try{
      const startLbl = $('#startLbl');
      if (startLbl) startLbl.setAttribute('troika-text', `value: เริ่ม: ${opts.mode.toUpperCase()}`);
    }catch(_){}

    bindHUD();
    wireStartButtons(opts);
  });

})();
