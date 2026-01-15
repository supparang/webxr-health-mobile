/* === C: /herohealth/vr-groups/groups-vr.boot.js ===
Food Groups VR — BOOT (PRODUCTION)
✅ Detect view if missing (pc/mobile/vr/cvr)
✅ Tap-to-start overlay unlock (mobile audio/gesture)
✅ Start ONCE (guard)
✅ Pass params to SAFE engine (B): GroupsVR.GameEngine.start(diff,{...})
✅ Wire UI from events:
   hha:time, hha:score, hha:rank, hha:coach, quest:update, groups:power, hha:end
*/

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  // ---------------- helpers ----------------
  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function qn(k, def){
    const v = Number(qs(k, def));
    return isFinite(v) ? v : def;
  }
  function qbool(k, def=false){
    const v = String(qs(k, def ? '1':'0')).toLowerCase();
    return (v==='1'||v==='true'||v==='yes'||v==='on');
  }

  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

  function detectView(){
    // priority: explicit param
    const pv = String(qs('view','')||'').toLowerCase();
    if (pv) {
      if (pv.includes('cvr')) return 'cvr';
      if (pv.includes('vr'))  return 'vr';
      if (pv.includes('pc'))  return 'pc';
      return 'mobile';
    }

    // auto detect
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.innerWidth < 860);
    // cVR/VR usually provided by param; we default to pc/mobile only
    return isMobile ? 'mobile' : 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    if(!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(view==='pc'?'view-pc':view==='vr'?'view-vr':view==='cvr'?'view-cvr':'view-mobile');
  }

  function $(sel){ return DOC.querySelector(sel); }

  // ---------------- Tap-to-start overlay ----------------
  function ensureTapOverlay(){
    let ov = $('.tapStartOverlay');
    if (ov) return ov;

    ov = DOC.createElement('div');
    ov.className = 'tapStartOverlay';
    ov.style.cssText = `
      position:fixed; inset:0; z-index:120;
      display:flex; align-items:center; justify-content:center;
      background: rgba(2,6,23,.72);
      backdrop-filter: blur(10px);
      color:#e5e7eb;
      padding: 18px;
    `;

    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(520px, 100%);
      border-radius: 24px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.86);
      box-shadow: 0 24px 70px rgba(0,0,0,.55);
      padding: 18px;
      text-align:center;
    `;

    const h = DOC.createElement('div');
    h.textContent = 'แตะเพื่อเริ่มเกม';
    h.style.cssText = 'font-weight:1000; font-size:20px; letter-spacing:.2px;';

    const p = DOC.createElement('div');
    p.textContent = 'แตะหนึ่งครั้งเพื่อเริ่ม (ปลดล็อกเสียง/เต็มจอในมือถือ)';
    p.style.cssText = 'margin-top:8px; color:rgba(148,163,184,.95); font-weight:800; font-size:13px;';

    const btn = DOC.createElement('button');
    btn.type = 'button';
    btn.textContent = 'TAP TO START';
    btn.style.cssText = `
      margin-top:14px;
      width:min(320px, 100%);
      padding: 14px 14px;
      border-radius: 18px;
      border: 1px solid rgba(34,197,94,.35);
      background: rgba(34,197,94,.18);
      color:#e5e7eb;
      font-weight:1000;
      font-size:14px;
      cursor:pointer;
    `;

    const note = DOC.createElement('div');
    note.textContent = 'Tip: เล็งก่อนยิง จะลด Miss ได้มาก';
    note.style.cssText = 'margin-top:10px; color:rgba(148,163,184,.90); font-weight:800; font-size:12px;';

    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(btn);
    card.appendChild(note);
    ov.appendChild(card);
    DOC.body.appendChild(ov);

    return ov;
  }

  async function tryFullscreen(view){
    // best effort: only on mobile/cvr/vr
    if (!(view==='mobile' || view==='cvr' || view==='vr')) return;
    const el = DOC.documentElement;
    try{
      if (el.requestFullscreen) await el.requestFullscreen();
    }catch(_){}
  }

  // ---------------- UI wiring (IDs expected in A) ----------------
  function wireUI(){
    // HUD
    const elTime   = $('#timeLeft');
    const elScore  = $('#scoreVal');
    const elCombo  = $('#comboVal');
    const elMiss   = $('#missVal');

    // Rank
    const elRank   = $('#rankVal');
    const elAcc    = $('#accVal');

    // Quest
    const elGoalTitle = $('#goalTitle');
    const elGoalNow   = $('#goalNow');
    const elGoalTotal = $('#goalTotal');
    const elGoalFill  = $('#goalFill');

    const elMiniTitle = $('#miniTitle');
    const elMiniNow   = $('#miniNow');
    const elMiniTotal = $('#miniTotal');
    const elMiniFill  = $('#miniFill');
    const elMiniSub   = $('#miniSub');   // optional
    const elGoalSub   = $('#goalSub');   // optional

    // Power
    const elPowerFill = $('#powerFill');
    const elPowerText = $('#powerText');

    // Coach
    const elCoachText = $('#coachText');
    const elCoachImg  = $('#coachImg');

    // Overlay end
    const ovEnd = $('#endOverlay');
    const endScore = $('#endScore');
    const endAcc   = $('#endAcc');
    const endMiss  = $('#endMiss');
    const endGrade = $('#endGrade');
    const btnReplay = $('#btnReplay');
    const btnBack   = $('#btnBack');

    // events
    WIN.addEventListener('hha:time', (e)=>{
      const left = e?.detail?.left ?? 0;
      if (elTime) elTime.textContent = String(left);
    });

    WIN.addEventListener('hha:score', (e)=>{
      const d = e?.detail || {};
      if (elScore) elScore.textContent = String(d.score ?? 0);
      if (elCombo) elCombo.textContent = String(d.combo ?? 0);
      if (elMiss)  elMiss.textContent  = String(d.misses ?? 0);
    });

    WIN.addEventListener('hha:rank', (e)=>{
      const d = e?.detail || {};
      if (elRank) elRank.textContent = String(d.grade ?? 'C');
      if (elAcc)  elAcc.textContent  = String(d.accuracy ?? 0) + '%';
    });

    WIN.addEventListener('quest:update', (e)=>{
      const d = e?.detail || {};
      if (elGoalTitle) elGoalTitle.textContent = d.goalTitle ?? '—';
      if (elGoalNow)   elGoalNow.textContent   = String(d.goalNow ?? 0);
      if (elGoalTotal) elGoalTotal.textContent = String(d.goalTotal ?? 1);
      if (elGoalFill)  elGoalFill.style.width  = String(d.goalPct ?? 0) + '%';
      if (elGoalSub)   elGoalSub.textContent   = `Goal ${Number(d.goalIndex||0)+1}/${d.goalsTotal||1}`;

      if (elMiniTitle) elMiniTitle.textContent = d.miniTitle ?? '—';
      if (elMiniNow)   elMiniNow.textContent   = String(d.miniNow ?? 0);
      if (elMiniTotal) elMiniTotal.textContent = String(d.miniTotal ?? 1);
      if (elMiniFill)  elMiniFill.style.width  = String(d.miniPct ?? 0) + '%';

      // mini urgent flag
      const urgent = (Number(d.miniTimeLeftSec||0) > 0 && Number(d.miniTimeLeftSec||0) <= 3);
      DOC.body.classList.toggle('mini-urgent', urgent);
      if (elMiniSub){
        if (Number(d.miniTimeLeftSec||0) > 0) elMiniSub.textContent = `เหลือ ${d.miniTimeLeftSec}s`;
        else elMiniSub.textContent = `ผ่าน ${d.miniCountCleared||0}/${d.miniCountTotal||0}`;
      }
    });

    WIN.addEventListener('groups:power', (e)=>{
      const d = e?.detail || {};
      const ch = Number(d.charge||0);
      const th = Math.max(1, Number(d.threshold||1));
      const pct = clamp((ch / th) * 100, 0, 100);
      if (elPowerFill) elPowerFill.style.width = pct.toFixed(0) + '%';
      if (elPowerText) elPowerText.textContent = (ch>=th) ? 'พร้อมสลับหมู่!' : `พลัง ${ch}/${th}`;
    });

    WIN.addEventListener('hha:coach', (e)=>{
      const d = e?.detail || {};
      if (elCoachText) elCoachText.textContent = String(d.text||'');
      // mood -> image swap (optional)
      if (elCoachImg){
        const mood = String(d.mood||'neutral');
        // ใช้ไฟล์ชุดเดียวกับ HeroHealth (/herohealth/img/coach-*.png)
        const base = '../img/';
        const map = { happy:'coach-happy.png', neutral:'coach-neutral.png', sad:'coach-sad.png', fever:'coach-fever.png' };
        elCoachImg.src = base + (map[mood] || map.neutral);
      }
    });

    WIN.addEventListener('hha:end', (e)=>{
      const d = e?.detail || {};
      if (endScore) endScore.textContent = String(d.scoreFinal ?? 0);
      if (endAcc)   endAcc.textContent   = String(d.accuracyGoodPct ?? 0) + '%';
      if (endMiss)  endMiss.textContent  = String(d.misses ?? 0);
      if (endGrade) endGrade.textContent = String(d.grade ?? 'C');

      if (ovEnd){
        ovEnd.classList.remove('hidden');
      }
    });

    // buttons
    if (btnReplay){
      btnReplay.addEventListener('click', ()=>{
        // replay same url but refresh seed if not research
        const u = new URL(location.href);
        const rm = String(qs('runMode', qs('run','play'))||'play').toLowerCase();
        if (rm !== 'research') u.searchParams.set('seed', String(Date.now()));
        location.href = u.toString();
      });
    }

    if (btnBack){
      btnBack.addEventListener('click', ()=>{
        const hub = qs('hub','');
        if (hub) location.href = hub;
        else history.back();
      });
    }
  }

  // ---------------- start pipeline ----------------
  let started = false;

  function startGame(){
    if (started) return;
    started = true;

    const view = detectView();
    setBodyView(view);

    // wire UI once
    try{ wireUI(); }catch(_){}

    // engine presence
    const eng = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
    if (!eng || !eng.start){
      console.error('GroupsVR engine missing: load groups.safe.js before boot');
      alert('Engine ไม่พบ (groups.safe.js) — ตรวจลำดับ <script>');
      return;
    }

    // required layer (playLayer)
    const layer = $('.playLayer') || $('#playLayer');
    if (layer && eng.setLayerEl) eng.setLayerEl(layer);

    // params -> engine
    const diff = String(qs('diff','normal')).toLowerCase();
    const runMode = String(qs('runMode', qs('run','play')) || 'play').toLowerCase();
    const time = clamp(qn('time', 90), 5, 180);
    const seed = String(qs('seed', Date.now()));
    const ai = qbool('ai', true); // default true in play, but runMode can disable by itself

    // AI switch: only for play
    if (!(runMode==='play')) {
      // ensure param is treated off
      // (engine already says research/practice => AI OFF)
    } else {
      // allow A to attach AIHooks if exists and ai=1
      if (!ai) {
        // no action here; A/ai-hooks can read param and not attach
      }
    }

    eng.start(diff, { view, runMode, time, seed, ai });
  }

  function boot(){
    // tap-to-start always (mobile requirement)
    const view = detectView();
    setBodyView(view);

    const ov = ensureTapOverlay();
    const btn = ov.querySelector('button');

    const once = async ()=>{
      // kill overlay
      try{ ov.remove(); }catch(_){}
      await tryFullscreen(view);
      startGame();
    };

    // allow tap anywhere + button
    ov.addEventListener('pointerdown', once, { once:true });
    if (btn) btn.addEventListener('click', once, { once:true });

    // If PC: auto-start quickly, but keep overlay dismissable
    if (view === 'pc'){
      setTimeout(()=>{
        if (!started){
          try{ ov.remove(); }catch(_){}
          startGame();
        }
      }, 250);
    }
  }

  // DOM ready
  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();