/* =========================================================
   GOODJUNK MOBILE POWERUPS EARNED FINAL
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-powerups-earned-final-patch.js
   PATCH: v20260526-GOODJUNK-MOBILE-POWERUPS-EARNED-FINAL
   PURPOSE:
   - เปลี่ยนการได้ตัวช่วยจาก “สุ่ม” เป็น “สะสมจากผลงาน”
   - Shield ได้จาก GOOD streak / Combo
   - Magnet ได้จาก GOOD รวม / ภารกิจย่อย
   - Fever ได้จาก Combo สูง / GOOD streak สูง
   - ปุ่มตัวช่วยกดแล้วต้องมีผลจริง
   - ไม่แตะ cooldown / summary / return flow
========================================================= */

(function(){
  'use strict';

  if (window.__GJ_MOBILE_POWERUPS_EARNED_FINAL__) return;
  window.__GJ_MOBILE_POWERUPS_EARNED_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-POWERUPS-EARNED-FINAL';

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();

  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (!isMobile) return;

  const CFG = {
    shieldCombo: 4,
    shieldGoodStreak: 4,

    magnetGoodTotal: 6,
    magnetMission: 1,

    feverCombo: 8,
    feverGoodStreak: 8,

    magnetDurationMs: 7000,
    feverDurationMs: 8500,
    shieldMaxStack: 1,
    magnetMaxStack: 1,
    feverMaxStack: 1
  };

  const S = {
    goodTotal: 0,
    goodStreak: 0,
    missStreakBreak: 0,
    comboMaxSeen: 0,
    missionDoneSeen: 0,

    shieldReady: 0,
    magnetReady: 0,
    feverReady: 0,

    shieldActive: false,
    magnetActiveUntil: 0,
    feverActiveUntil: 0,

    lastScore: 0,
    lastGood: 0,
    lastJunk: 0,
    lastFake: 0,
    lastMiss: 0,
    lastCombo: 0,

    patchedAt: Date.now()
  };

  function $(id){
    return document.getElementById(id);
  }

  function now(){
    return Date.now();
  }

  function api(){
    return window.GoodJunkSoloBoss ||
           window.GJ_SOLO_BOSS ||
           window.GJ_SOLO_BOSS_GAME ||
           window.GJ_GAME ||
           null;
  }

  function getSummaryLikeState(){
    const out = {};

    try{
      const a = api();

      if (a && typeof a.getState === 'function'){
        Object.assign(out, a.getState() || {});
      }

      if (a && typeof a.state === 'object'){
        Object.assign(out, a.state || {});
      }
    }catch(_){}

    try{
      out.score = Number(
        out.score ??
        textNumber('#gjmScore') ??
        textNumber('[data-score]') ??
        S.lastScore ??
        0
      );

      out.combo = Number(
        out.combo ??
        textNumber('#gjmCombo') ??
        S.lastCombo ??
        0
      );

      out.goodHits = Number(
        out.goodHits ??
        out.good ??
        out.correct ??
        S.lastGood ??
        0
      );

      out.junkHits = Number(
        out.junkHits ??
        out.junk ??
        S.lastJunk ??
        0
      );

      out.fakeHits = Number(
        out.fakeHits ??
        out.fake ??
        S.lastFake ??
        0
      );

      out.misses = Number(
        out.misses ??
        out.miss ??
        S.lastMiss ??
        0
      );
    }catch(_){}

    return out;
  }

  function textNumber(selector){
    try{
      const el = document.querySelector(selector);
      if (!el) return null;
      const raw = String(el.textContent || '').replace(/[^\d.-]/g, '');
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }catch(_){
      return null;
    }
  }

  function toast(msg){
    let t = document.getElementById('gjPowerToastEarned');

    if (!t){
      t = document.createElement('div');
      t.id = 'gjPowerToastEarned';
      t.style.position = 'fixed';
      t.style.left = '50%';
      t.style.bottom = 'calc(86px + env(safe-area-inset-bottom,0px))';
      t.style.transform = 'translateX(-50%)';
      t.style.zIndex = '2147482000';
      t.style.width = 'min(420px, calc(100vw - 28px))';
      t.style.borderRadius = '999px';
      t.style.padding = '11px 15px';
      t.style.background = 'rgba(15,23,42,.88)';
      t.style.color = '#fff';
      t.style.border = '2px solid rgba(255,255,255,.76)';
      t.style.boxShadow = '0 14px 34px rgba(15,23,42,.24)';
      t.style.backdropFilter = 'blur(8px)';
      t.style.fontSize = '13px';
      t.style.fontWeight = '1000';
      t.style.textAlign = 'center';
      t.style.opacity = '0';
      t.style.pointerEvents = 'none';
      t.style.transition = 'opacity .18s ease, transform .18s ease';
      document.body.appendChild(t);
    }

    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(10px)';
    }, 1450);
  }

  function bigFx(text, tone){
    let fx = document.getElementById('gjPowerBigFxEarned');

    if (!fx){
      fx = document.createElement('div');
      fx.id = 'gjPowerBigFxEarned';
      fx.style.position = 'fixed';
      fx.style.left = '50%';
      fx.style.top = '46%';
      fx.style.transform = 'translate(-50%,-50%) scale(.82)';
      fx.style.zIndex = '2147482000';
      fx.style.minWidth = 'min(380px, calc(100vw - 36px))';
      fx.style.borderRadius = '28px';
      fx.style.padding = '14px 18px';
      fx.style.textAlign = 'center';
      fx.style.color = '#fff';
      fx.style.fontSize = 'clamp(26px, 8vw, 50px)';
      fx.style.lineHeight = '1';
      fx.style.fontWeight = '1000';
      fx.style.letterSpacing = '-.05em';
      fx.style.textShadow = '0 4px 16px rgba(15,23,42,.28)';
      fx.style.opacity = '0';
      fx.style.pointerEvents = 'none';
      fx.style.transition = 'opacity .15s ease, transform .15s ease';
      document.body.appendChild(fx);
    }

    const bg =
      tone === 'shield' ? 'linear-gradient(135deg,#38bdf8,#2563eb)' :
      tone === 'magnet' ? 'linear-gradient(135deg,#f97316,#ef4444)' :
      tone === 'fever'  ? 'linear-gradient(135deg,#facc15,#f97316)' :
      'linear-gradient(135deg,#22c55e,#2563eb)';

    fx.textContent = text;
    fx.style.background = bg;
    fx.style.border = '3px solid rgba(255,255,255,.85)';
    fx.style.opacity = '1';
    fx.style.transform = 'translate(-50%,-50%) scale(1.04)';

    clearTimeout(bigFx._timer);
    bigFx._timer = setTimeout(function(){
      fx.style.opacity = '0';
      fx.style.transform = 'translate(-50%,-58%) scale(.92)';
    }, 760);
  }

  function ensurePanel(){
    let panel = document.getElementById('gjEarnedPowerPanel');

    if (!panel){
      panel = document.createElement('section');
      panel.id = 'gjEarnedPowerPanel';
      panel.setAttribute('aria-label', 'GoodJunk powerups');
      panel.innerHTML = `
        <button class="gjp-card" id="gjUseShieldBtn" type="button" data-power="shield">
          <b>🛡️</b>
          <span>Shield</span>
          <small id="gjShieldState">ยังไม่พร้อม</small>
        </button>
        <button class="gjp-card" id="gjUseMagnetBtn" type="button" data-power="magnet">
          <b>🧲</b>
          <span>Magnet</span>
          <small id="gjMagnetState">ยังไม่พร้อม</small>
        </button>
        <button class="gjp-card" id="gjUseFeverBtn" type="button" data-power="fever">
          <b>⚡</b>
          <span>Fever</span>
          <small id="gjFeverState">ยังไม่พร้อม</small>
        </button>
      `;

      document.body.appendChild(panel);

      const style = document.createElement('style');
      style.id = 'gj-earned-power-style';
      style.textContent = `
        #gjEarnedPowerPanel{
          position:fixed;
          right:calc(8px + env(safe-area-inset-right,0px));
          top:calc(92px + env(safe-area-inset-top,0px));
          z-index:100040;
          display:grid;
          gap:8px;
          width:min(150px, 35vw);
          pointer-events:auto;
        }

        #gjEarnedPowerPanel .gjp-card{
          border:2px solid rgba(255,255,255,.86);
          border-radius:18px;
          min-height:58px;
          display:grid;
          grid-template-columns:38px 1fr;
          grid-template-rows:auto auto;
          column-gap:8px;
          align-items:center;
          padding:7px 8px;
          background:rgba(255,255,255,.82);
          box-shadow:0 12px 26px rgba(15,23,42,.14);
          color:#172033;
          cursor:pointer;
          backdrop-filter:blur(8px);
          text-align:left;
          opacity:.72;
        }

        #gjEarnedPowerPanel .gjp-card b{
          grid-row:1 / span 2;
          width:36px;
          height:36px;
          border-radius:14px;
          display:grid;
          place-items:center;
          background:#fff7ed;
          font-size:23px;
          line-height:1;
        }

        #gjEarnedPowerPanel .gjp-card span{
          font-size:13px;
          font-weight:1000;
          line-height:1;
        }

        #gjEarnedPowerPanel .gjp-card small{
          margin-top:3px;
          font-size:10px;
          font-weight:900;
          color:#64748b;
          line-height:1.1;
        }

        #gjEarnedPowerPanel .gjp-card.ready{
          opacity:1;
          border-color:#86efac;
          background:linear-gradient(180deg,#ffffff,#ecfdf5);
          box-shadow:0 0 0 2px rgba(34,197,94,.18), 0 12px 26px rgba(15,23,42,.16);
        }

        #gjEarnedPowerPanel .gjp-card.active{
          opacity:1;
          border-color:#fde68a;
          background:linear-gradient(180deg,#fff7ed,#fef3c7);
          animation:gjPowerPulse .65s ease-in-out infinite alternate;
        }

        #gjEarnedPowerPanel .gjp-card.disabled{
          opacity:.52;
          filter:grayscale(.45);
        }

        @keyframes gjPowerPulse{
          from{ transform:scale(1); }
          to{ transform:scale(1.035); }
        }

        @media(max-width:720px){
          #gjEarnedPowerPanel{
            top:calc(82px + env(safe-area-inset-top,0px));
            right:calc(6px + env(safe-area-inset-right,0px));
            width:132px;
            gap:6px;
          }

          #gjEarnedPowerPanel .gjp-card{
            min-height:50px;
            grid-template-columns:33px 1fr;
            border-radius:15px;
            padding:6px;
          }

          #gjEarnedPowerPanel .gjp-card b{
            width:31px;
            height:31px;
            border-radius:12px;
            font-size:20px;
          }

          #gjEarnedPowerPanel .gjp-card span{
            font-size:12px;
          }

          #gjEarnedPowerPanel .gjp-card small{
            font-size:9px;
          }
        }
      `;

      document.head.appendChild(style);
    }

    return panel;
  }

  function setBtnState(id, readyCount, active, label){
    const btn = $(id);
    if (!btn) return;

    btn.classList.toggle('ready', readyCount > 0 && !active);
    btn.classList.toggle('active', !!active);
    btn.classList.toggle('disabled', readyCount <= 0 && !active);

    const small = btn.querySelector('small');

    if (small){
      if (active) small.textContent = 'กำลังใช้';
      else if (readyCount > 0) small.textContent = 'พร้อมใช้';
      else small.textContent = label || 'ยังไม่พร้อม';
    }
  }

  function updatePanel(){
    ensurePanel();

    const t = now();

    const magnetActive = S.magnetActiveUntil > t;
    const feverActive = S.feverActiveUntil > t;

    setBtnState('gjUseShieldBtn', S.shieldReady, S.shieldActive, 'Combo x4');
    setBtnState('gjUseMagnetBtn', S.magnetReady, magnetActive, 'GOOD 6');
    setBtnState('gjUseFeverBtn', S.feverReady, feverActive, 'Combo x8');

    try{
      localStorage.setItem('GJ_MOBILE_POWERUPS_EARNED_STATE', JSON.stringify({
        patch: PATCH,
        goodTotal: S.goodTotal,
        goodStreak: S.goodStreak,
        comboMaxSeen: S.comboMaxSeen,
        shieldReady: S.shieldReady,
        magnetReady: S.magnetReady,
        feverReady: S.feverReady,
        shieldActive: S.shieldActive,
        magnetActiveUntil: S.magnetActiveUntil,
        feverActiveUntil: S.feverActiveUntil,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function earnShield(reason){
    if (S.shieldReady >= CFG.shieldMaxStack || S.shieldActive) return;

    S.shieldReady = CFG.shieldMaxStack;
    toast('🛡️ ได้ Shield จาก ' + reason);
    bigFx('SHIELD READY!', 'shield');
  }

  function earnMagnet(reason){
    if (S.magnetReady >= CFG.magnetMaxStack || S.magnetActiveUntil > now()) return;

    S.magnetReady = CFG.magnetMaxStack;
    toast('🧲 ได้ Magnet จาก ' + reason);
    bigFx('MAGNET READY!', 'magnet');
  }

  function earnFever(reason){
    if (S.feverReady >= CFG.feverMaxStack || S.feverActiveUntil > now()) return;

    S.feverReady = CFG.feverMaxStack;
    toast('⚡ ได้ Fever จาก ' + reason);
    bigFx('FEVER READY!', 'fever');
  }

  function observePerformance(){
    const st = getSummaryLikeState();

    const score = Number(st.score || 0);
    const combo = Number(st.combo || 0);
    const good = Number(st.goodHits || st.good || 0);
    const junk = Number(st.junkHits || st.junk || 0);
    const fake = Number(st.fakeHits || st.fake || 0);
    const miss = Number(st.misses || st.miss || 0);
    const missionDone = Number(st.missionDone || st.mission || 0);

    if (good > S.lastGood){
      const diff = good - S.lastGood;
      S.goodTotal += diff;
      S.goodStreak += diff;
    }

    if (junk > S.lastJunk || fake > S.lastFake || miss > S.lastMiss){
      S.goodStreak = 0;
      S.missStreakBreak++;
    }

    if (combo > S.comboMaxSeen){
      S.comboMaxSeen = combo;
    }

    if (
      S.goodStreak >= CFG.shieldGoodStreak ||
      combo >= CFG.shieldCombo
    ){
      earnShield('Combo x4 / GOOD ต่อเนื่อง');
    }

    if (
      S.goodTotal >= CFG.magnetGoodTotal ||
      missionDone > S.missionDoneSeen
    ){
      earnMagnet('เก็บ GOOD ครบ 6 ชิ้น');
    }

    if (
      S.goodStreak >= CFG.feverGoodStreak ||
      combo >= CFG.feverCombo
    ){
      earnFever('Combo x8 / GOOD ต่อเนื่องสูง');
    }

    S.lastScore = score;
    S.lastCombo = combo;
    S.lastGood = good;
    S.lastJunk = junk;
    S.lastFake = fake;
    S.lastMiss = miss;
    S.missionDoneSeen = Math.max(S.missionDoneSeen, missionDone);

    updatePanel();
  }

  function findGoodItemsNearCenter(){
    const items = Array.from(document.querySelectorAll(
      '.gjpu-item,.gjm-item,.food-card,.gj-food,.food-item,[data-kind="good"],[data-type="good"],[data-good="1"]'
    ));

    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const cx = vw / 2;
    const cy = vh / 2;

    return items
      .map(function(el){
        const r = el.getBoundingClientRect();
        const ix = r.left + r.width / 2;
        const iy = r.top + r.height / 2;
        const d = Math.hypot(ix - cx, iy - cy);

        return {el: el, d: d};
      })
      .filter(function(x){
        return x.d < Math.min(vw, vh) * 0.42;
      })
      .sort(function(a,b){
        return a.d - b.d;
      })
      .slice(0, 3)
      .map(function(x){
        return x.el;
      });
  }

  function clickElement(el){
    if (!el) return false;

    try{
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        view: window,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true
      }));
    }catch(_){}

    try{
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
      return true;
    }catch(_){}

    try{
      el.click();
      return true;
    }catch(_){}

    return false;
  }

  function useShield(){
    if (S.shieldReady <= 0 && !S.shieldActive){
      toast('Shield ยังไม่พร้อม: ทำ Combo x4 หรือ GOOD ต่อเนื่อง 4 ครั้ง');
      return;
    }

    S.shieldReady = 0;
    S.shieldActive = true;

    try{
      window.GJ_MOBILE_SHIELD_ACTIVE = true;
      document.body.setAttribute('data-gj-shield-active', '1');
    }catch(_){}

    toast('🛡️ Shield ทำงาน: กันพลาด 1 ครั้ง');
    bigFx('SHIELD ON!', 'shield');
    updatePanel();
  }

  function useMagnet(){
    if (S.magnetReady <= 0 && S.magnetActiveUntil <= now()){
      toast('Magnet ยังไม่พร้อม: เก็บ GOOD รวม 6 ชิ้นก่อน');
      return;
    }

    S.magnetReady = 0;
    S.magnetActiveUntil = now() + CFG.magnetDurationMs;

    toast('🧲 Magnet ทำงาน: ช่วยดูด GOOD ใกล้กลางจอ');
    bigFx('MAGNET ON!', 'magnet');
    updatePanel();

    let tick = 0;

    const timer = setInterval(function(){
      tick++;

      if (now() > S.magnetActiveUntil || tick > 12){
        clearInterval(timer);
        updatePanel();
        return;
      }

      const targets = findGoodItemsNearCenter();
      targets.forEach(function(el, i){
        setTimeout(function(){
          clickElement(el);
        }, i * 130);
      });
    }, 560);
  }

  function useFever(){
    if (S.feverReady <= 0 && S.feverActiveUntil <= now()){
      toast('Fever ยังไม่พร้อม: ทำ Combo x8 หรือ GOOD ต่อเนื่อง 8 ครั้ง');
      return;
    }

    S.feverReady = 0;
    S.feverActiveUntil = now() + CFG.feverDurationMs;

    try{
      window.GJ_MOBILE_FEVER_ACTIVE = true;
      document.body.setAttribute('data-gj-fever-active', '1');
    }catch(_){}

    toast('⚡ Fever ทำงาน: เพิ่มแรงโจมตีและคะแนนชั่วคราว');
    bigFx('FEVER TIME!', 'fever');

    setTimeout(function(){
      try{
        window.GJ_MOBILE_FEVER_ACTIVE = false;
        document.body.removeAttribute('data-gj-fever-active');
      }catch(_){}
      updatePanel();
      toast('Fever หมดเวลาแล้ว');
    }, CFG.feverDurationMs);

    updatePanel();
  }

  function patchPowerButtons(){
    ensurePanel();

    const shield = $('gjUseShieldBtn');
    const magnet = $('gjUseMagnetBtn');
    const fever = $('gjUseFeverBtn');

    if (shield && !shield.__gjEarnedBound){
      shield.__gjEarnedBound = true;
      shield.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        useShield();
      }, true);
    }

    if (magnet && !magnet.__gjEarnedBound){
      magnet.__gjEarnedBound = true;
      magnet.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        useMagnet();
      }, true);
    }

    if (fever && !fever.__gjEarnedBound){
      fever.__gjEarnedBound = true;
      fever.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        useFever();
      }, true);
    }
  }

  function patchMissProtection(){
    document.addEventListener('click', function(ev){
      if (!S.shieldActive) return;

      const target = ev.target && ev.target.closest
        ? ev.target.closest('[data-kind="junk"],[data-type="junk"],[data-kind="fake"],[data-type="fake"],.junk,.fake')
        : null;

      if (!target) return;

      S.shieldActive = false;
      window.GJ_MOBILE_SHIELD_ACTIVE = false;
      document.body.removeAttribute('data-gj-shield-active');

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      toast('🛡️ Shield กันพลาดให้แล้ว');
      bigFx('BLOCK!', 'shield');
      updatePanel();

      return false;
    }, true);
  }

  function patchFeverScoreHint(){
    document.addEventListener('click', function(ev){
      if (S.feverActiveUntil <= now()) return;

      const target = ev.target && ev.target.closest
        ? ev.target.closest('[data-kind="good"],[data-type="good"],[data-good="1"],.good,.gjpu-item')
        : null;

      if (!target) return;

      try{
        target.setAttribute('data-gj-fever-hit', '1');
      }catch(_){}

      bigFx('x2 HIT!', 'fever');
    }, true);
  }

  function boot(){
    document.body.setAttribute('data-gj-powerups-earned-final', PATCH);

    ensurePanel();
    patchPowerButtons();
    patchMissProtection();
    patchFeverScoreHint();

    let count = 0;
    const timer = setInterval(function(){
      count++;

      patchPowerButtons();
      observePerformance();

      if (count > 7200){
        clearInterval(timer);
      }
    }, 420);

    window.GJ_MOBILE_POWERUPS_EARNED_CHECK = function(){
      const snap = {
        patch: PATCH,
        isMobile: isMobile,
        state: Object.assign({}, S),
        currentGameState: getSummaryLikeState(),
        panel: !!document.getElementById('gjEarnedPowerPanel'),
        shieldButton: document.getElementById('gjShieldState') && document.getElementById('gjShieldState').textContent,
        magnetButton: document.getElementById('gjMagnetState') && document.getElementById('gjMagnetState').textContent,
        feverButton: document.getElementById('gjFeverState') && document.getElementById('gjFeverState').textContent
      };

      console.log('[GJ_MOBILE_POWERUPS_EARNED_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Powerups Earned Final]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }

})();
