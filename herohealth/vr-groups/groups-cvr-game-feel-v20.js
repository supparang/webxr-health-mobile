// === /herohealth/vr-groups/groups-cvr-game-feel-v20.js ===
// HeroHealth Groups cVR — v2.0 Game Feel Polish
// Adds:
// - Clear "look here" guide for the correct gate
// - Less cluttered HUD during cVR
// - Friendly micro-coach text
// - Better feedback for correct / blocked / decoy / power
// - Soft gate pulse without changing scoring
// - cVR readability and comfort polish
// Safe add-on: does not modify core scoring.
// PATCH v20260515-GROUPS-CVR-V20-GAME-FEEL-POLISH

(function () {
  'use strict';

  const VERSION = 'v2.0-cvr-game-feel-polish-20260515';

  if (window.__HHA_GROUPS_CVR_GAME_FEEL_V20__) return;
  window.__HHA_GROUPS_CVR_GAME_FEEL_V20__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastItemSig: '',
    lastNeedKey: '',
    lastNeedId: '',
    lastKind: '',
    lastScore: 0,
    lastCorrect: 0,
    lastMiss: 0,
    lastHits: 0,
    lastBlocked: 0,
    lastCoachAt: 0,
    lastPulseAt: 0,
    guideTimer: null,
    uiTimer: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function coreApi() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function directApi() {
    return WIN.HHA_GROUPS_CVR_DIRECT_SHOOT_V18 || null;
  }

  function qaApi() {
    return WIN.HHA_GROUPS_CVR_QA_BALANCE_V19 || null;
  }

  function gs() {
    try {
      const core = coreApi();
      if (core && typeof core.getState === 'function') return core.getState() || {};
    } catch (e) {}
    return {};
  }

  function ds() {
    try {
      const direct = directApi();
      if (direct && typeof direct.getState === 'function') return direct.getState() || {};
    } catch (e) {}
    return {};
  }

  function isPlaying() {
    const s = gs();
    return s && s.mode === 'game' && !s.ended;
  }

  function currentItem() {
    const s = gs();
    return s && s.current ? s.current : null;
  }

  function currentKind() {
    const item = currentItem();
    return item && item.kind ? item.kind : '';
  }

  function needGroup() {
    const item = currentItem();
    if (!item || !item.group) return null;
    return item.group;
  }

  function itemSig() {
    const item = currentItem();
    if (!item) return 'none';

    return [
      item.kind || '',
      item.icon || '',
      item.power || '',
      item.group && item.group.key || '',
      item.group && item.group.id || ''
    ].join('|');
  }

  function injectStyle() {
    if ($('groups-cvr-v20-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v20-style';

    style.textContent = `
      body.playing .hud{
        top:calc(10px + env(safe-area-inset-top,0px)) !important;
        left:8px !important;
        right:8px !important;
        grid-template-columns:minmax(0,1fr) auto !important;
        gap:6px !important;
      }

      body.playing .mission-card{
        border-radius:18px !important;
        padding:8px 10px !important;
        background:rgba(255,255,255,.86) !important;
        box-shadow:0 10px 24px rgba(35,81,107,.10) !important;
      }

      body.playing .mission-title{
        font-size:clamp(14px,3.4vw,22px) !important;
        line-height:1.08 !important;
      }

      body.playing .mission-sub{
        font-size:clamp(10px,2.8vw,13px) !important;
        opacity:.88 !important;
      }

      body.playing .chips{
        gap:4px !important;
      }

      body.playing .chip{
        padding:6px 9px !important;
        font-size:clamp(11px,2.9vw,13px) !important;
      }

      body.playing .bottom-hint{
        bottom:calc(68px + env(safe-area-inset-bottom,0px)) !important;
        left:50% !important;
        right:auto !important;
        width:min(560px,calc(100vw - 28px)) !important;
        transform:translateX(-50%) !important;
        border-radius:999px !important;
        padding:9px 12px !important;
        background:rgba(255,255,255,.88) !important;
        box-shadow:0 12px 32px rgba(35,81,107,.13) !important;
        font-size:clamp(13px,3.5vw,20px) !important;
        line-height:1.15 !important;
      }

      .cvr-v20-coach{
        position:fixed;
        left:50%;
        top:calc(86px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:2147483500;
        width:min(560px,calc(100vw - 26px));
        border-radius:999px;
        padding:9px 14px;
        background:rgba(255,255,255,.92);
        color:#244e68;
        box-shadow:0 18px 48px rgba(35,81,107,.16);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(15px,4vw,23px);
        line-height:1.15;
        font-weight:1000;
        text-align:center;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v20-coach.show{
        animation:cvrV20Coach .95s ease both;
      }

      .cvr-v20-coach.good{
        background:#f5fff1;
        color:#31724b;
      }

      .cvr-v20-coach.warn{
        background:#fff5ca;
        color:#806000;
      }

      .cvr-v20-coach.bad{
        background:#fff0f0;
        color:#9b3d3d;
      }

      .cvr-v20-coach.power{
        background:#eaf8ff;
        color:#1f6b8e;
      }

      @keyframes cvrV20Coach{
        0%{opacity:0; transform:translateX(-50%) translateY(8px) scale(.96);}
        16%{opacity:1; transform:translateX(-50%) translateY(0) scale(1.02);}
        78%{opacity:1; transform:translateX(-50%) translateY(0) scale(1);}
        100%{opacity:0; transform:translateX(-50%) translateY(-12px) scale(.98);}
      }

      .cvr-v20-mini{
        position:fixed;
        right:10px;
        bottom:calc(128px + env(safe-area-inset-bottom,0px));
        z-index:2147483450;
        display:none;
        max-width:min(230px,42vw);
        border-radius:24px;
        padding:10px 12px;
        background:rgba(255,255,255,.88);
        color:#244e68;
        box-shadow:0 16px 42px rgba(35,81,107,.14);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(12px,3.2vw,16px);
        line-height:1.2;
        font-weight:950;
        pointer-events:none;
      }

      body.playing .cvr-v20-mini{
        display:block;
      }

      .cvr-v20-mini b{
        display:block;
        font-size:1.18em;
        line-height:1.05;
      }

      .cvr-v20-mini span{
        color:#7193a8;
        font-size:.82em;
      }

      .cvr-v20-flash{
        position:fixed;
        inset:0;
        z-index:2147481000;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v20-flash.good{
        background:radial-gradient(circle at 50% 52%,rgba(126,217,87,.25),rgba(126,217,87,0) 58%);
        animation:cvrV20Flash .38s ease both;
      }

      .cvr-v20-flash.warn{
        background:radial-gradient(circle at 50% 52%,rgba(255,217,102,.25),rgba(255,217,102,0) 58%);
        animation:cvrV20Flash .38s ease both;
      }

      .cvr-v20-flash.bad{
        background:radial-gradient(circle at 50% 52%,rgba(255,125,125,.22),rgba(255,125,125,0) 58%);
        animation:cvrV20Flash .38s ease both;
      }

      @keyframes cvrV20Flash{
        0%{opacity:0;}
        25%{opacity:1;}
        100%{opacity:0;}
      }

      body.playing #cvrV13Controls,
      body.playing #cvrV13ComfortCard{
        opacity:.82 !important;
      }

      body.playing #cvrV13Controls button,
      body.playing #cvrV13ComfortCard button{
        transform:scale(.92);
      }

      @media (max-width:520px){
        .cvr-v20-mini{
          right:8px;
          bottom:calc(120px + env(safe-area-inset-bottom,0px));
          max-width:40vw;
          padding:8px 10px;
        }

        .cvr-v20-coach{
          top:calc(76px + env(safe-area-inset-top,0px));
          font-size:clamp(13px,3.6vw,19px);
          padding:7px 12px;
        }
      }

      @media (max-height:680px){
        body.playing .bottom-hint{
          bottom:calc(58px + env(safe-area-inset-bottom,0px)) !important;
          font-size:clamp(12px,3.2vw,17px) !important;
          padding:7px 10px !important;
        }

        .cvr-v20-mini{
          bottom:calc(108px + env(safe-area-inset-bottom,0px));
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV20Coach')) {
      const el = DOC.createElement('div');
      el.id = 'cvrV20Coach';
      el.className = 'cvr-v20-coach';
      DOC.body.appendChild(el);
    }

    if (!$('cvrV20Mini')) {
      const el = DOC.createElement('div');
      el.id = 'cvrV20Mini';
      el.className = 'cvr-v20-mini';
      el.innerHTML = '<b>🎯 เล็งเป้า</b><span>หันหน้าไปประตูที่ถูก</span>';
      DOC.body.appendChild(el);
    }

    if (!$('cvrV20Flash')) {
      const el = DOC.createElement('div');
      el.id = 'cvrV20Flash';
      el.className = 'cvr-v20-flash';
      DOC.body.appendChild(el);
    }
  }

  function coach(text, kind, minGap) {
    const gap = minGap || 700;
    const t = Date.now();

    if (t - state.lastCoachAt < gap) return;
    state.lastCoachAt = t;

    const el = $('cvrV20Coach');
    if (!el) return;

    el.className = 'cvr-v20-coach ' + (kind || '');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function flash(kind) {
    const el = $('cvrV20Flash');
    if (!el) return;

    el.className = 'cvr-v20-flash ' + (kind || '');
    void el.offsetWidth;
  }

  function getCorrectGate() {
    const g = needGroup();
    if (!g || !g.key) return null;

    return DOC.querySelector(`.clickable[data-role="gate"][data-group="${g.key}"]`);
  }

  function removeGuideRings() {
    DOC.querySelectorAll('.cvr-v20-guide-ring').forEach(el => {
      try {
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (e) {}
    });
  }

  function addGuideRingToGate(gate) {
    if (!gate || !gate.isConnected) return;

    let ring = gate.querySelector('.cvr-v20-guide-ring');
    if (ring) return;

    ring = DOC.createElement('a-ring');
    ring.classList.add('cvr-v20-guide-ring');
    ring.setAttribute('position', '0 0 0.018');
    ring.setAttribute('radius-inner', '0.49');
    ring.setAttribute('radius-outer', '0.535');
    ring.setAttribute('color', '#ffffff');
    ring.setAttribute('material', 'shader:flat; opacity:.92; transparent:true');
    ring.setAttribute('animation__pulse', 'property: scale; from: 1 1 1; to: 1.08 1.08 1.08; dur: 520; dir: alternate; loop: true; easing: easeInOutSine');

    try {
      gate.appendChild(ring);
    } catch (e) {}
  }

  function pulseCorrectGate(reason) {
    if (!isPlaying()) return;

    const item = currentItem();
    if (!item) return;

    const kind = currentKind();

    removeGuideRings();

    if (kind === 'food' || kind === 'golden') {
      const gate = getCorrectGate();
      const g = needGroup();

      if (!gate || !g) return;

      addGuideRingToGate(gate);

      try {
        gate.setAttribute('scale', '1.14 1.14 1.14');
        setTimeout(() => {
          if (gate.isConnected) gate.setAttribute('scale', '1 1 1');
        }, 520);
      } catch (e) {}

      const label = kind === 'golden'
        ? `⭐ Golden! หมู่ ${g.id} ${g.label}`
        : `ไปประตูหมู่ ${g.id} ${g.label}`;

      coach(label, kind === 'golden' ? 'good' : '', 650);
      updateMini(`🚪 หมู่ ${g.id}`, g.label);
      return;
    }

    if (kind === 'power') {
      coach('⚡ เล็งที่ Power แล้วแตะยิง', 'power', 650);
      updateMini('⚡ Power', 'ยิงที่ตัวพลัง');
      return;
    }

    if (kind === 'decoy') {
      coach('🚫 ตัวหลอก อย่ายิง!', 'bad', 650);
      updateMini('🚫 ห้ามยิง', 'ปล่อยให้ผ่านไป');
    }
  }

  function updateMini(title, sub) {
    const el = $('cvrV20Mini');
    if (!el) return;

    el.innerHTML = `<b>${title || '🎯 เล็งเป้า'}</b><span>${sub || 'หันหน้าไปเป้าหมาย'}</span>`;
  }

  function polishBottomHint() {
    const hint = $('bottomHint');
    if (!hint || !isPlaying()) return;

    const kind = currentKind();
    const g = needGroup();

    if ((kind === 'food' || kind === 'golden') && g) {
      hint.textContent = kind === 'golden'
        ? `⭐ Golden: เล็งประตูหมู่ ${g.id} ${g.label}`
        : `เล็งประตูหมู่ ${g.id} ${g.label}`;
    } else if (kind === 'power') {
      hint.textContent = '⚡ เล็ง Power แล้วแตะยิง';
    } else if (kind === 'decoy') {
      hint.textContent = '🚫 ตัวหลอก อย่ายิง • ปล่อยให้ผ่านไป';
    }
  }

  function detectChanges() {
    if (!isPlaying()) return;

    const s = gs();
    const d = ds();
    const sig = itemSig();
    const kind = currentKind();
    const g = needGroup();

    if (sig !== state.lastItemSig) {
      state.lastItemSig = sig;
      state.lastKind = kind;
      state.lastNeedKey = g && g.key || '';
      state.lastNeedId = g && g.id || '';

      setTimeout(() => {
        pulseCorrectGate('new-item');
        polishBottomHint();
      }, 120);
    }

    const score = Number(s.score || 0);
    const correct = Number(s.correct || 0);
    const miss = Number(s.miss || 0);
    const hits = Number(d.hits || 0);
    const blocked = Number(d.blocked || 0);

    if (hits > state.lastHits || correct > state.lastCorrect || score > state.lastScore) {
      state.lastHits = hits;
      state.lastCorrect = correct;
      state.lastScore = score;

      flash('good');
      coach('เยี่ยม! ยิงเข้าแล้ว', 'good', 600);
      removeGuideRings();
      return;
    }

    if (blocked > state.lastBlocked) {
      state.lastBlocked = blocked;

      flash('warn');

      const need = needGroup();
      const k = currentKind();

      if (k === 'decoy') {
        coach('ตัวหลอก อย่ายิงนะ', 'bad', 600);
      } else if (need) {
        coach(`ลองใหม่: หมู่ ${need.id} ${need.label}`, 'warn', 600);
      } else {
        coach('เล็งให้ตรงเป้าก่อน', 'warn', 600);
      }

      setTimeout(() => pulseCorrectGate('blocked'), 120);
      return;
    }

    if (miss > state.lastMiss) {
      state.lastMiss = miss;
      flash('bad');
      coach('ไม่เป็นไร ลองใหม่!', 'bad', 600);
      setTimeout(() => pulseCorrectGate('miss'), 220);
    }
  }

  function softenEventBossUi() {
    /*
      v14 event/boss UI can feel crowded in cVR.
      This only makes it visually quieter; scoring/events remain unchanged.
    */
    const candidates = [
      '#cvrV14Card',
      '#cvrV14Event',
      '#cvrV14Boss',
      '.cvr-v14-card',
      '.cvr-v14-event',
      '.cvr-v14-boss'
    ];

    candidates.forEach(sel => {
      DOC.querySelectorAll(sel).forEach(el => {
        try {
          el.style.maxWidth = 'min(520px, calc(100vw - 36px))';
          el.style.opacity = '0.88';
          el.style.transform = 'scale(.94)';
          el.style.transformOrigin = 'top center';
          el.style.pointerEvents = 'none';
        } catch (e) {}
      });
    });
  }

  function fitFireButton() {
    const btns = [
      $('cvrV18dFireBtn'),
      $('cvrV18cFireBtn'),
      $('cvrV18bFireBtn'),
      $('cvrV18FireBtn')
    ].filter(Boolean);

    btns.forEach(btn => {
      try {
        btn.style.bottom = 'calc(10px + env(safe-area-inset-bottom,0px))';
        btn.style.minWidth = '138px';
        btn.style.height = '48px';
        btn.style.fontSize = '16px';
      } catch (e) {}
    });
  }

  function loop() {
    detectChanges();
    polishBottomHint();
    softenEventBossUi();
    fitFireButton();
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_GAME_FEEL_V20 = {
      version: VERSION,
      coach,
      flash,
      pulseCorrectGate,
      removeGuideRings,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          current: currentItem(),
          kind: currentKind(),
          needGroup: needGroup(),
          lastItemSig: state.lastItemSig,
          lastHits: state.lastHits,
          lastBlocked: state.lastBlocked
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    expose();

    state.uiTimer = setInterval(loop, 300);
    state.guideTimer = setInterval(() => {
      if (!isPlaying()) return;
      pulseCorrectGate('interval-guide');
    }, 3200);

    WIN.addEventListener('groups-cvr:v18d-direct-shoot', () => {
      setTimeout(loop, 80);
    });

    WIN.addEventListener('groups-cvr:v18c-direct-shoot', () => {
      setTimeout(loop, 80);
    });

    console.info('[Groups cVR v2.0] game feel polish installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
