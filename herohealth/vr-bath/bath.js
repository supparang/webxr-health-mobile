'use strict';

(() => {
  const D = document;
  const W = window;

  /* =========================
   * Helpers
   * ========================= */
  const $ = (s, el = D) => el.querySelector(s);
  const $$ = (s, el = D) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function qstr(k, d = '') {
    try {
      const u = new URL(location.href);
      const v = u.searchParams.get(k);
      return (v == null || v === '') ? d : v;
    } catch { return d; }
  }
  function qbool(k, d = false) {
    const v = String(qstr(k, d ? '1' : '0')).toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(v);
  }

  const DIFF = (qstr('diff', 'normal') || 'normal').toLowerCase();
  const VIEW = (qstr('view', 'front') || 'front').toLowerCase();
  const DEBUG = qbool('debug', false);

  const CFG = {
    easy:   { time: 95, wetNeed: 12, soapNeed: 10, scrubHits: [2,3], rinseNeed: 10, dryNeed: 8, hiddenCount: 6, bossChance: 0.45, sweatRise: 0.35 },
    normal: { time: 80, wetNeed: 15, soapNeed: 13, scrubHits: [2,4], rinseNeed: 12, dryNeed: 10, hiddenCount: 8, bossChance: 0.70, sweatRise: 0.55 },
    hard:   { time: 68, wetNeed: 18, soapNeed: 16, scrubHits: [3,4], rinseNeed: 14, dryNeed: 12, hiddenCount:10, bossChance: 1.00, sweatRise: 0.85 },
  }[DIFF] || null;

  /* =========================
   * UI refs
   * ========================= */
  const UI = {
    phasePill: $('#phasePill'),
    timePill: $('#timePill'),
    cleanPill: $('#cleanPill'),
    comboPill: $('#comboPill'),
    missPill: $('#missPill'),
    questPill: $('#questPill'),
    meterPill: $('#meterPill'),
    viewPill: $('#viewPill'),

    stage: $('#stage'),
    bathLayer: $('#bath-layer'),
    bodyWrap: $('#body-wrap'),
    targetLayer: $('#target-layer'),
    bodySilhouette: $('#body-silhouette'),
    crosshairFallback: $('#crosshair-fallback'),

    btnStart: $('#btnStart'),
    btnFlip: $('#btnFlip'),
    btnHelp: $('#btnHelp'),
    btnCloseHelp: $('#btnCloseHelp'),
    btnReplay: $('#btnReplay'),
    btnBack: $('#btnBack'),

    panelHelp: $('#panelHelp'),
    panelEnd: $('#panelEnd'),
    endSummary: $('#endSummary'),
    heatmap: $('#heatmap'),
  };

  // optional nodes if you already patched HTML
  const fxLayer = $('#bathFxLayer');
  const fxCanvas = $('#bathFxCanvas');
  const fxFloatLayer = $('#bathFloatLayer');
  const fxBossChip = $('#bathBossChip');
  const fxHeatVignette = $('#bathHeatVignette');
  const bathBodyCanvas = $('#bathBodyCanvas');

  /* =========================
   * Game state
   * ========================= */
  const S = {
    running: false,
    ended: false,
    phase: 'prep', // prep, wet, soap, scrub, rinse, drydress, summary
    phaseStartedAt: 0,
    startedAt: 0,
    lastTs: 0,
    timeLeft: CFG ? CFG.time : 80,

    score: 0,
    combo: 0,
    comboExpireAt: 0,
    miss: 0,
    sweat: 0, // use as heat meter 0..100
    cleanPct: 0,

    view: (VIEW === 'back' ? 'BACK' : 'FRONT'),

    progress: {
      wetHits: 0,
      soapHits: 0,
      rinseHits: 0,
      dryHits: 0,
    },

    hiddenSpots: [],
    hiddenRevealedCount: 0,
    hiddenCleanedCount: 0,

    boss: null, // { alive, x,y,hp,hpMax, timeoutAt, label }
    questText: '—',

    pointerDown: false,
    lastPointer: { x: 0, y: 0 },
  };

  const PHASE_ORDER = ['prep', 'wet', 'soap', 'scrub', 'rinse', 'drydress', 'summary'];

  /* =========================
   * Hidden Spots (top-down normalized positions)
   * Front / Back sets
   * ========================= */
  const HIDDEN_FRONT = [
    { id:'neck', label:'คอ', x:0.50, y:0.24, r:0.045 },
    { id:'armpitL', label:'รักแร้ซ้าย', x:0.34, y:0.35, r:0.045 },
    { id:'armpitR', label:'รักแร้ขวา', x:0.66, y:0.35, r:0.045 },
    { id:'elbowL', label:'ข้อพับแขนซ้าย', x:0.25, y:0.47, r:0.040 },
    { id:'elbowR', label:'ข้อพับแขนขวา', x:0.75, y:0.47, r:0.040 },
    { id:'toeL', label:'ซอกนิ้วเท้าซ้าย', x:0.44, y:0.87, r:0.045 },
    { id:'toeR', label:'ซอกนิ้วเท้าขวา', x:0.56, y:0.87, r:0.045 },
    { id:'kneeL', label:'หัวเข่าซ้าย', x:0.44, y:0.67, r:0.040 },
    { id:'kneeR', label:'หัวเข่าขวา', x:0.56, y:0.67, r:0.040 },
  ];
  const HIDDEN_BACK = [
    { id:'behindEarL', label:'หลังหูซ้าย', x:0.40, y:0.18, r:0.040 },
    { id:'behindEarR', label:'หลังหูขวา', x:0.60, y:0.18, r:0.040 },
    { id:'neckBack', label:'คอด้านหลัง', x:0.50, y:0.25, r:0.045 },
    { id:'armpitL', label:'รักแร้ซ้าย', x:0.34, y:0.35, r:0.045 },
    { id:'armpitR', label:'รักแร้ขวา', x:0.66, y:0.35, r:0.045 },
    { id:'kneeBackL', label:'หลังเข่าซ้าย', x:0.44, y:0.69, r:0.042 },
    { id:'kneeBackR', label:'หลังเข่าขวา', x:0.56, y:0.69, r:0.042 },
    { id:'toeL', label:'ซอกนิ้วเท้าซ้าย', x:0.44, y:0.87, r:0.045 },
    { id:'toeR', label:'ซอกนิ้วเท้าขวา', x:0.56, y:0.87, r:0.045 },
  ];

  /* =========================
   * FX helpers (works even if no FX layer patch)
   * ========================= */
  let fxCtx = null;
  let fxDpr = 1;
  const FX = {
    pulses: [],
    floats: [],
    trails: [],
    rings: [],
  };

  function resizeFxCanvas() {
    if (!fxCanvas || !UI.bodyWrap) return;
    const r = UI.bodyWrap.getBoundingClientRect();
    fxDpr = Math.min(2, W.devicePixelRatio || 1);
    fxCanvas.width = Math.max(1, Math.round(r.width * fxDpr));
    fxCanvas.height = Math.max(1, Math.round(r.height * fxDpr));
    fxCanvas.style.width = `${r.width}px`;
    fxCanvas.style.height = `${r.height}px`;
    fxCtx = fxCanvas.getContext('2d');
  }
  function normToPx(nx, ny) {
    const r = UI.bodyWrap.getBoundingClientRect();
    return { x: nx * r.width, y: ny * r.height };
  }
  function fxPulse(nx, ny, kind='warn') {
    if (!fxCanvas) return;
    const p = normToPx(nx, ny);
    FX.pulses.push({ x:p.x, y:p.y, r:8, life:1, kind });
  }
  function fxRing(nx, ny, kind='good') {
    if (!fxCanvas) return;
    const p = normToPx(nx, ny);
    FX.rings.push({ x:p.x, y:p.y, r:10, life:1, kind });
  }
  function fxFloat(text, nx, ny, tone='good') {
    if (!fxFloatLayer) return;
    const p = normToPx(nx, ny);
    const div = D.createElement('div');
    div.className = `bath-float-text ${tone}`;
    div.textContent = text;
    div.style.left = `${p.x}px`;
    div.style.top = `${p.y}px`;
    fxFloatLayer.appendChild(div);
    setTimeout(()=>div.remove(), 900);
  }
  function fxTrail(x, y) {
    if (!fxCanvas) return;
    FX.trails.push({
      x, y,
      vx: rand(-0.5, 0.5),
      vy: rand(-0.8, -0.1),
      size: rand(3, 7),
      life: 1,
      decay: rand(0.03, 0.06)
    });
  }

  function renderFx(dtMs) {
    if (!fxCtx || !fxCanvas) return;
    const r = UI.bodyWrap.getBoundingClientRect();
    const w = r.width, h = r.height;
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    fxCtx.save();
    fxCtx.scale(fxDpr, fxDpr);

    // Heat vignette
    if (fxHeatVignette) {
      let o = 0;
      if (S.sweat >= 85) o = 0.85;
      else if (S.sweat >= 70) o = 0.55;
      else if (S.sweat >= 40) o = 0.28;
      fxHeatVignette.style.opacity = String(o);
    }

    // Boss chip
    if (fxBossChip) {
      if (S.boss && S.boss.alive) {
        const sec = Math.max(0, Math.ceil((S.boss.timeoutAt - performance.now()) / 1000));
        fxBossChip.textContent = `⚠️ ${S.boss.label} • HP ${S.boss.hp}/${S.boss.hpMax} • ${sec}s`;
        fxBossChip.classList.remove('hidden');
      } else {
        fxBossChip.classList.add('hidden');
      }
    }

    // trails
    for (let i = FX.trails.length - 1; i >= 0; i--) {
      const t = FX.trails[i];
      t.x += t.vx * dtMs * 0.06;
      t.y += t.vy * dtMs * 0.06;
      t.life -= t.decay * (dtMs / 16);
      if (t.life <= 0) { FX.trails.splice(i,1); continue; }
      fxCtx.beginPath();
      fxCtx.fillStyle = `rgba(147,197,253,${0.12 + t.life*0.25})`;
      fxCtx.arc(t.x, t.y, t.size * (0.4 + t.life), 0, Math.PI*2);
      fxCtx.fill();
    }

    // pulses
    for (let i = FX.pulses.length - 1; i >= 0; i--) {
      const p = FX.pulses[i];
      p.life -= 0.03 * (dtMs / 16);
      p.r += 2.6 * (dtMs / 16);
      if (p.life <= 0) { FX.pulses.splice(i,1); continue; }
      let col = '245,158,11';
      if (p.kind === 'boss') col = '239,68,68';
      if (p.kind === 'good') col = '16,185,129';
      fxCtx.beginPath();
      fxCtx.strokeStyle = `rgba(${col},${0.5*p.life})`;
      fxCtx.lineWidth = p.kind === 'boss' ? 4 : 3;
      fxCtx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      fxCtx.stroke();
    }

    // rings
    for (let i = FX.rings.length - 1; i >= 0; i--) {
      const g = FX.rings[i];
      g.life -= 0.04 * (dtMs / 16);
      g.r += 2.8 * (dtMs / 16);
      if (g.life <= 0) { FX.rings.splice(i,1); continue; }
      let col = '16,185,129';
      if (g.kind === 'bosshit') col = '239,68,68';
      fxCtx.beginPath();
      fxCtx.strokeStyle = `rgba(${col},${0.55*g.life})`;
      fxCtx.lineWidth = 3;
      fxCtx.arc(g.x, g.y, g.r, 0, Math.PI*2);
      fxCtx.stroke();
    }

    // Boss timer ring on boss position
    if (S.boss && S.boss.alive) {
      const p = normToPx(S.boss.x, S.boss.y);
      const rem = Math.max(0, S.boss.timeoutAt - performance.now());
      const total = S.boss.durationMs || 12000;
      const frac = clamp(rem / total, 0, 1);
      const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.08;

      fxCtx.beginPath();
      fxCtx.strokeStyle = 'rgba(239,68,68,.95)';
      fxCtx.lineWidth = 3;
      fxCtx.arc(p.x, p.y, 20 * pulse, 0, Math.PI * 2);
      fxCtx.stroke();

      fxCtx.beginPath();
      fxCtx.strokeStyle = 'rgba(251,191,36,.95)';
      fxCtx.lineWidth = 4;
      fxCtx.arc(p.x, p.y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      fxCtx.stroke();
    }

    fxCtx.restore();
  }

  /* =========================
   * Main Canvas renderer (optional if patched HTML includes bathBodyCanvas)
   * ========================= */
  let bodyCtx = null;
  let bodyDpr = 1;

  function resizeBodyCanvas() {
    if (!bathBodyCanvas || !UI.bodyWrap) return;
    const r = UI.bodyWrap.getBoundingClientRect();
    bodyDpr = Math.min(2, W.devicePixelRatio || 1);
    bathBodyCanvas.width = Math.max(1, Math.round(r.width * bodyDpr));
    bathBodyCanvas.height = Math.max(1, Math.round(r.height * bodyDpr));
    bathBodyCanvas.style.width = `${r.width}px`;
    bathBodyCanvas.style.height = `${r.height}px`;
    bodyCtx = bathBodyCanvas.getContext('2d');
  }

  function renderBodyCanvas() {
    if (!bodyCtx || !bathBodyCanvas) return;
    const r = UI.bodyWrap.getBoundingClientRect();
    const w = r.width, h = r.height;

    bodyCtx.clearRect(0, 0, bathBodyCanvas.width, bathBodyCanvas.height);
    bodyCtx.save();
    bodyCtx.scale(bodyDpr, bodyDpr);

    // BG tint by phase
    let phaseTint = 'rgba(15,23,42,.35)';
    if (S.phase === 'wet') phaseTint = 'rgba(59,130,246,.10)';
    if (S.phase === 'soap') phaseTint = 'rgba(255,255,255,.06)';
    if (S.phase === 'scrub') phaseTint = 'rgba(245,158,11,.06)';
    if (S.phase === 'rinse') phaseTint = 'rgba(16,185,129,.08)';
    if (S.phase === 'drydress') phaseTint = 'rgba(251,191,36,.06)';
    bodyCtx.fillStyle = phaseTint;
    bodyCtx.fillRect(0, 0, w, h);

    // hidden spots hints
    for (const s of S.hiddenSpots) {
      const x = s.x * w, y = s.y * h;
      const rr = Math.max(10, s.r * Math.min(w, h));
      if (!s.revealed && !DEBUG) continue;

      if (s.cleaned) {
        bodyCtx.beginPath();
        bodyCtx.fillStyle = 'rgba(16,185,129,.85)';
        bodyCtx.arc(x, y, rr * 0.75, 0, Math.PI * 2);
        bodyCtx.fill();
      } else {
        const pulse = 1 + Math.sin((performance.now() + s.phaseOffset) * 0.008) * 0.08;
        bodyCtx.beginPath();
        bodyCtx.fillStyle = 'rgba(245,158,11,.26)';
        bodyCtx.arc(x, y, rr * 1.45 * pulse, 0, Math.PI * 2);
        bodyCtx.fill();

        bodyCtx.beginPath();
        bodyCtx.fillStyle = 'rgba(245,158,11,.60)';
        bodyCtx.arc(x, y, rr * pulse, 0, Math.PI * 2);
        bodyCtx.fill();

        // remaining hit count
        bodyCtx.fillStyle = 'rgba(255,255,255,.95)';
        bodyCtx.font = 'bold 12px system-ui';
        bodyCtx.textAlign = 'center';
        bodyCtx.fillText(String(Math.max(0, s.needHits - s.hitCount)), x, y + 4);
      }
    }

    bodyCtx.restore();
  }

  /* =========================
   * Targets (DOM spawn layer)
   * ========================= */
  let targetSeq = 0;

  function clearTargets() {
    UI.targetLayer.innerHTML = '';
  }

  function spawnTarget(kind, opts = {}) {
    const el = D.createElement('button');
    el.className = `tgt tgt-${kind}`;
    el.type = 'button';
    el.dataset.kind = kind;
    el.dataset.id = `t${++targetSeq}`;

    const x = clamp(opts.x ?? rand(0.10, 0.90), 0.05, 0.95);
    const y = clamp(opts.y ?? rand(0.12, 0.92), 0.08, 0.96);
    const size = opts.size ?? (kind === 'boss' ? 58 : rand(28, 42));

    el.style.position = 'absolute';
    el.style.left = `${x * 100}%`;
    el.style.top = `${y * 100}%`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%, -50%)';
    el.style.borderRadius = '999px';
    el.style.border = '1px solid rgba(255,255,255,.35)';
    el.style.cursor = 'pointer';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.fontWeight = '800';
    el.style.userSelect = 'none';
    el.style.webkitTapHighlightColor = 'transparent';

    // look by kind
    if (kind === 'wet') {
      el.textContent = '💧';
      el.style.background = 'rgba(59,130,246,.85)';
      el.style.boxShadow = '0 4px 16px rgba(59,130,246,.35)';
    } else if (kind === 'soap') {
      el.textContent = '🫧';
      el.style.background = 'rgba(255,255,255,.90)';
      el.style.color = '#111827';
      el.style.boxShadow = '0 4px 16px rgba(255,255,255,.25)';
    } else if (kind === 'fakeSoap') {
      el.textContent = '☁️';
      el.style.background = 'rgba(148,163,184,.8)';
      el.style.boxShadow = '0 4px 16px rgba(148,163,184,.25)';
    } else if (kind === 'rinse') {
      el.textContent = '🚿';
      el.style.background = 'rgba(16,185,129,.85)';
      el.style.boxShadow = '0 4px 16px rgba(16,185,129,.35)';
    } else if (kind === 'dry') {
      el.textContent = '🧻';
      el.style.background = 'rgba(245,158,11,.9)';
      el.style.boxShadow = '0 4px 16px rgba(245,158,11,.35)';
    } else if (kind === 'boss') {
      el.textContent = '🦠';
      el.style.background = 'rgba(239,68,68,.92)';
      el.style.boxShadow = '0 8px 24px rgba(239,68,68,.45)';
      el.style.zIndex = '5';
    }

    const ttl = opts.ttl ?? 1400;
    const bornAt = performance.now();

    let expired = false;
    const timer = setTimeout(() => {
      if (expired || S.ended) return;
      expired = true;
      onTargetExpired(el);
      el.remove();
    }, ttl);

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (S.ended || !S.running) return;
      if (expired) return;
      expired = true;
      clearTimeout(timer);
      onTargetHit(el);
      el.remove();
    }, { passive: false });

    UI.targetLayer.appendChild(el);

    // animate slight pulse
    el.animate(
      [{ transform: 'translate(-50%,-50%) scale(0.9)' }, { transform: 'translate(-50%,-50%) scale(1.0)' }],
      { duration: 120, easing: 'ease-out', fill: 'forwards' }
    );

    return el;
  }

  function onTargetHit(el) {
    const kind = el.dataset.kind;
    const p = getElNormPos(el);

    if (kind === 'wet') {
      if (S.phase !== 'wet') return wrongAction(p.x, p.y, 'ผิดลำดับ');
      S.progress.wetHits++;
      addScore(2, p.x, p.y);
      comboUp();
      fxFloat('💧 เปียก!', p.x, p.y, 'good');
      fxRing(p.x, p.y, 'good');
      S.sweat = clamp(S.sweat - 1.5, 0, 100);
      return;
    }

    if (kind === 'soap') {
      if (S.phase !== 'soap') return wrongAction(p.x, p.y, 'ผิดลำดับ');
      S.progress.soapHits++;
      addScore(3, p.x, p.y);
      comboUp();
      fxFloat('🫧 ฟอก!', p.x, p.y, 'good');
      fxRing(p.x, p.y, 'good');
      return;
    }

    if (kind === 'fakeSoap') {
      if (S.phase !== 'soap') return wrongAction(p.x, p.y, 'ฟองปลอม!');
      missUp(p.x, p.y, 'ฟองปลอม!');
      comboBreak();
      S.sweat = clamp(S.sweat + 4, 0, 100);
      return;
    }

    if (kind === 'rinse') {
      if (S.phase !== 'rinse') return wrongAction(p.x, p.y, 'ผิดลำดับ');
      S.progress.rinseHits++;
      addScore(2, p.x, p.y);
      comboUp();
      fxFloat('🚿 ล้าง!', p.x, p.y, 'good');
      return;
    }

    if (kind === 'dry') {
      if (S.phase !== 'drydress') return wrongAction(p.x, p.y, 'ผิดลำดับ');
      S.progress.dryHits++;
      addScore(2, p.x, p.y);
      comboUp();
      fxFloat('🧻 แห้ง!', p.x, p.y, 'good');
      S.sweat = clamp(S.sweat - 1.0, 0, 100);
      return;
    }

    if (kind === 'boss') {
      if (!S.boss || !S.boss.alive || S.phase !== 'scrub') return;
      S.boss.hp = Math.max(0, S.boss.hp - 1);
      addScore(5, p.x, p.y);
      comboUp();
      fxRing(p.x, p.y, 'bosshit');
      fxFloat('💥 HIT!', p.x, p.y, 'warn');
      if (S.boss.hp <= 0) {
        S.boss.alive = false;
        addScore(20, p.x, p.y);
        fxPulse(p.x, p.y, 'good');
        fxFloat('🏆 BOSS DOWN!', p.x, p.y, 'good');
        S.sweat = clamp(S.sweat - 12, 0, 100);
      }
      return;
    }
  }

  function onTargetExpired(el) {
    const kind = el.dataset.kind;
    const p = getElNormPos(el);

    // Miss เฉพาะ target สำคัญ
    if (['wet','soap','rinse','dry'].includes(kind)) {
      missUp(p.x, p.y, 'MISS');
      comboBreak();
      S.sweat = clamp(S.sweat + 2.5, 0, 100);
    }

    if (kind === 'boss' && S.boss && S.boss.alive) {
      // timeout handled in loop too, but keep safe
      S.boss.alive = false;
      missUp(p.x, p.y, '☣️ กระจาย!');
      S.sweat = clamp(S.sweat + 10, 0, 100);
    }
  }

  function getElNormPos(el) {
    const r = UI.bodyWrap.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const x = ((e.left + e.width / 2) - r.left) / r.width;
    const y = ((e.top + e.height / 2) - r.top) / r.height;
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  }

  /* =========================
   * Hidden spot scrub interaction (tap/drag on body)
   * ========================= */
  function getPointerNormFromEvent(e) {
    const r = UI.bodyWrap.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    return {
      x: clamp((clientX - r.left) / Math.max(1, r.width), 0, 1),
      y: clamp((clientY - r.top) / Math.max(1, r.height), 0, 1),
      px: clientX - r.left,
      py: clientY - r.top,
    };
  }

  function pointHitSpot(nx, ny, s) {
    const dx = nx - s.x;
    const dy = ny - s.y;
    const rr = s.r * 1.25; // touch-friendly
    return dx * dx + dy * dy <= rr * rr;
  }

  function handleScrubPointer(nx, ny, px, py) {
    if (S.phase !== 'scrub') return;
    if (fxCanvas) fxTrail(px, py);

    let hitAny = false;

    for (const s of S.hiddenSpots) {
      if (!s.revealed || s.cleaned) continue;
      if (!pointHitSpot(nx, ny, s)) continue;

      hitAny = true;
      s.hitCount++;
      comboUp();

      if (s.hitCount >= s.needHits) {
        s.cleaned = true;
        S.hiddenCleanedCount++;
        addScore(8, s.x, s.y);
        fxRing(s.x, s.y, 'good');
        fxFloat('✨ สะอาด!', s.x, s.y, 'good');
      } else {
        addScore(1, s.x, s.y);
        fxFloat(`🧽 ${s.hitCount}/${s.needHits}`, s.x, s.y, 'warn');
      }

      // boss if on same spot
      if (S.boss && S.boss.alive && S.boss.spotId === s.id) {
        S.boss.hp = Math.max(0, S.boss.hp - 1);
        fxRing(s.x, s.y, 'bosshit');
        if (S.boss.hp <= 0) {
          S.boss.alive = false;
          addScore(18, s.x, s.y);
          fxPulse(s.x, s.y, 'good');
          fxFloat('🏆 BOSS DOWN!', s.x, s.y, 'good');
        }
      }
      break;
    }

    if (!hitAny && Math.random() < 0.06) {
      // scrub พลาดบ้าง
      comboBreak();
    }
  }

  /* =========================
   * Phase control
   * ========================= */
  function setPhase(next) {
    S.phase = next;
    S.phaseStartedAt = performance.now();
    clearTargets();

    if (next === 'prep') {
      S.questText = 'เตรียมตัว 3 วินาที';
    } else if (next === 'wet') {
      S.questText = `ยิง/แตะน้ำให้ครบ ${CFG.wetNeed}`;
      spawnPhaseTargets('wet');
    } else if (next === 'soap') {
      S.questText = `ฟองจริง ${CFG.soapNeed} (ระวังฟองปลอม)`;
      spawnPhaseTargets('soap');
    } else if (next === 'scrub') {
      S.questText = 'ล่าจุดอับ และถูซ้ำให้ครบ';
      revealHiddenSpots();
      maybeSpawnBoss();
    } else if (next === 'rinse') {
      S.questText = `ล้างฟองตกค้าง ${CFG.rinseNeed}`;
      spawnPhaseTargets('rinse');
    } else if (next === 'drydress') {
      S.questText = `เช็ดให้แห้ง ${CFG.dryNeed} แล้วจบ`;
      spawnPhaseTargets('dry');
    } else if (next === 'summary') {
      S.questText = 'สรุปผล';
    }

    updateHUD();
  }

  function nextPhase() {
    const i = PHASE_ORDER.indexOf(S.phase);
    const next = PHASE_ORDER[Math.min(PHASE_ORDER.length - 1, i + 1)];
    setPhase(next);
  }

  function autoPhaseCheck() {
    if (S.phase === 'prep') {
      if ((performance.now() - S.phaseStartedAt) >= 3000) nextPhase();
      return;
    }
    if (S.phase === 'wet' && S.progress.wetHits >= CFG.wetNeed) return nextPhase();
    if (S.phase === 'soap' && S.progress.soapHits >= CFG.soapNeed) return nextPhase();
    if (S.phase === 'scrub' && S.hiddenCleanedCount >= Math.ceil(S.hiddenSpots.length * 0.8)) return nextPhase();
    if (S.phase === 'rinse' && S.progress.rinseHits >= CFG.rinseNeed) return nextPhase();
    if (S.phase === 'drydress' && S.progress.dryHits >= CFG.dryNeed) return endGame(true);
  }

  function spawnPhaseTargets(kind) {
    const burstCount = {
      wet: 4,
      soap: 4,
      rinse: 4,
      dry: 4
    }[kind] || 4;

    for (let i = 0; i < burstCount; i++) {
      spawnOneForPhase(kind, i * 120);
    }
  }

  function spawnOneForPhase(kind, delay = 0) {
    setTimeout(() => {
      if (!S.running || S.ended || S.phase === 'summary') return;

      if (kind === 'wet' && S.phase === 'wet') {
        spawnTarget('wet', { ttl: rand(1000, 1600) });
        return;
      }
      if (kind === 'soap' && S.phase === 'soap') {
        const fake = Math.random() < (DIFF === 'hard' ? 0.35 : DIFF === 'normal' ? 0.25 : 0.15);
        spawnTarget(fake ? 'fakeSoap' : 'soap', { ttl: rand(900, 1500) });
        return;
      }
      if (kind === 'rinse' && S.phase === 'rinse') {
        spawnTarget('rinse', { ttl: rand(1000, 1600) });
        return;
      }
      if (kind === 'dry' && S.phase === 'drydress') {
        spawnTarget('dry', { ttl: rand(1100, 1700) });
        return;
      }
    }, delay);
  }

  function phaseSpawnerTick() {
    if (!S.running || S.ended) return;
    if (S.phase === 'wet' && Math.random() < 0.08) spawnOneForPhase('wet');
    if (S.phase === 'soap' && Math.random() < 0.09) spawnOneForPhase('soap');
    if (S.phase === 'rinse' && Math.random() < 0.08) spawnOneForPhase('rinse');
    if (S.phase === 'drydress' && Math.random() < 0.08) spawnOneForPhase('dry');
  }

  /* =========================
   * Hidden spots + boss
   * ========================= */
  function buildHiddenSpots() {
    const base = (S.view === 'BACK') ? HIDDEN_BACK : HIDDEN_FRONT;
    const copy = base.map(s => ({
      ...s,
      hitCount: 0,
      needHits: randInt(CFG.scrubHits[0], CFG.scrubHits[1]),
      revealed: false,
      cleaned: false,
      phaseOffset: rand(0, 10000)
    }));

    // pick N by diff
    shuffle(copy);
    S.hiddenSpots = copy.slice(0, Math.min(CFG.hiddenCount, copy.length));
    S.hiddenRevealedCount = 0;
    S.hiddenCleanedCount = 0;
  }

  function revealHiddenSpots() {
    // reveal in waves for excitement
    const arr = S.hiddenSpots.slice();
    shuffle(arr);
    arr.forEach((s, idx) => {
      const t = 300 + idx * rand(180, 380);
      setTimeout(() => {
        if (!S.running || S.ended || S.phase !== 'scrub') return;
        s.revealed = true;
        S.hiddenRevealedCount++;
        fxPulse(s.x, s.y, 'warn');
        fxFloat('👀 จุดอับ!', s.x, s.y, 'warn');
      }, t);
    });
  }

  function maybeSpawnBoss() {
    if (Math.random() > CFG.bossChance) return;
    const candidates = S.hiddenSpots.filter(s => !s.cleaned);
    if (!candidates.length) return;
    const spot = candidates[Math.floor(Math.random() * candidates.length)];
    S.boss = {
      alive: true,
      x: spot.x,
      y: spot.y,
      hp: (DIFF === 'hard' ? 10 : DIFF === 'normal' ? 8 : 6),
      hpMax: (DIFF === 'hard' ? 10 : DIFF === 'normal' ? 8 : 6),
      spotId: spot.id,
      label: (Math.random() < 0.5 ? 'Stink Monster' : 'Oil Slick Boss'),
      durationMs: (DIFF === 'hard' ? 14000 : 12000),
      timeoutAt: performance.now() + (DIFF === 'hard' ? 14000 : 12000),
    };
    fxPulse(S.boss.x, S.boss.y, 'boss');
    fxFloat('🧪 MINI-BOSS!', S.boss.x, S.boss.y, 'bad');

    // optional visible boss target (clickable DOM) for extra action
    spawnTarget('boss', { x: S.boss.x, y: S.boss.y, size: 58, ttl: S.boss.durationMs });
  }

  function bossTick() {
    if (!S.boss || !S.boss.alive) return;
    if (performance.now() >= S.boss.timeoutAt) {
      S.boss.alive = false;
      missUp(S.boss.x, S.boss.y, '☣️ กระจาย!');
      S.sweat = clamp(S.sweat + 12, 0, 100);
      comboBreak();
    }
  }

  /* =========================
   * Scoring / combo / miss
   * ========================= */
  function addScore(n, nx, ny) {
    S.score += Math.round(n * (1 + Math.min(0.5, S.combo * 0.03)));
    if (typeof nx === 'number' && typeof ny === 'number') {
      if (n >= 5) fxFloat(`+${Math.round(n)}`, nx, ny, 'good');
    }
  }

  function comboUp() {
    const now = performance.now();
    if (S.comboExpireAt && now <= S.comboExpireAt) S.combo++;
    else S.combo = 1;
    S.comboExpireAt = now + 850;
  }

  function comboBreak() {
    S.combo = 0;
    S.comboExpireAt = 0;
  }

  function missUp(nx, ny, text = 'MISS') {
    S.miss++;
    fxFloat(text, nx, ny, 'bad');
  }

  function wrongAction(nx, ny, text = 'ผิดลำดับ') {
    S.miss++;
    S.sweat = clamp(S.sweat + 4, 0, 100);
    comboBreak();
    fxFloat(`⚠️ ${text}`, nx, ny, 'bad');
  }

  /* =========================
   * HUD
   * ========================= */
  function updateHUD() {
    if (UI.phasePill) UI.phasePill.textContent = `PHASE: ${S.phase.toUpperCase()}`;
    if (UI.timePill) UI.timePill.textContent = `TIME: ${Math.ceil(S.timeLeft)}`;
    if (UI.cleanPill) UI.cleanPill.textContent = `CLEAN: ${Math.round(S.cleanPct)}%`;
    if (UI.comboPill) UI.comboPill.textContent = `COMBO: ${S.combo}`;
    if (UI.missPill) UI.missPill.textContent = `MISS: ${S.miss}`;
    if (UI.questPill) UI.questPill.textContent = `QUEST: ${S.questText}`;
    if (UI.meterPill) UI.meterPill.textContent = `SWEAT: ${Math.round(S.sweat)}%`;
    if (UI.viewPill) UI.viewPill.textContent = `VIEW: ${S.view}`;
  }

  function recalcCleanPct() {
    const weights = {
      wet: Math.min(1, S.progress.wetHits / CFG.wetNeed) * 18,
      soap: Math.min(1, S.progress.soapHits / CFG.soapNeed) * 20,
      scrub: (S.hiddenSpots.length ? (S.hiddenCleanedCount / S.hiddenSpots.length) : 0) * 35,
      rinse: Math.min(1, S.progress.rinseHits / CFG.rinseNeed) * 15,
      dry: Math.min(1, S.progress.dryHits / CFG.dryNeed) * 12
    };
    S.cleanPct = clamp(weights.wet + weights.soap + weights.scrub + weights.rinse + weights.dry, 0, 100);
  }

  /* =========================
   * End summary + heatmap
   * ========================= */
  function calcGrade(score) {
    if (score >= 90 && S.miss <= 4 && S.sweat <= 45) return 'A+';
    if (score >= 80 && S.miss <= 6) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    return 'D';
  }

  function renderHeatmap() {
    if (!UI.heatmap) return;
    UI.heatmap.innerHTML = '';

    for (const s of S.hiddenSpots) {
      const item = D.createElement('div');
      const status = s.cleaned ? 'clean' : (s.revealed ? 'missed' : 'hidden');
      item.className = `hm-item ${status}`;
      item.innerHTML = `
        <span class="hm-dot"></span>
        <span class="hm-label">${escapeHtml(s.label)}</span>
        <span class="hm-stat">${status === 'clean' ? 'สะอาด' : status === 'missed' ? 'พลาด' : 'ซ่อน'}</span>
      `;
      UI.heatmap.appendChild(item);
    }
  }

  function showEndPanel(win) {
    S.phase = 'summary';
    updateHUD();

    const grade = calcGrade(Math.round(S.cleanPct));
    const cleaned = S.hiddenCleanedCount;
    const total = Math.max(1, S.hiddenSpots.length);

    if (UI.endSummary) {
      UI.endSummary.innerHTML = `
        ${win ? '✅ จบเกมสำเร็จ' : '⏰ หมดเวลา'}<br/>
        คะแนนปฏิบัติความสะอาด <b>${Math.round(S.cleanPct)}</b>% |
        Score <b>${Math.round(S.score)}</b> |
        Grade <b>${grade}</b><br/>
        จุดอับสะอาด <b>${cleaned}/${total}</b> |
        Combo สูงสุด (ประมาณ) <b>${S.combo}</b> |
        Miss <b>${S.miss}</b> |
        Sweat <b>${Math.round(S.sweat)}</b>%
      `;
    }

    renderHeatmap();
    UI.panelEnd?.classList.remove('hidden');

    // save last summary (HHA style minimal)
    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game: 'bath',
        cleanPct: Math.round(S.cleanPct),
        score: Math.round(S.score),
        grade,
        hiddenCleaned: cleaned,
        hiddenTotal: total,
        miss: S.miss,
        sweat: Math.round(S.sweat),
        ts: Date.now()
      }));
    } catch {}
  }

  /* =========================
   * Loop
   * ========================= */
  let rafId = 0;
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (!S.running || S.ended) return;

    const dt = Math.min(33, S.lastTs ? (ts - S.lastTs) : 16);
    S.lastTs = ts;

    // timer
    S.timeLeft = Math.max(0, S.timeLeft - dt / 1000);

    // sweat rises with time, more in scrub
    let rise = CFG.sweatRise;
    if (S.phase === 'scrub') rise *= 1.35;
    if (S.phase === 'prep') rise *= 0.5;
    S.sweat = clamp(S.sweat + rise * (dt / 1000) * 10, 0, 100);

    // hidden regrow feel (simple): at high sweat, unclean revealed spots get "harder"
    if (S.phase === 'scrub' && S.sweat >= 70 && Math.random() < 0.01) {
      const cand = S.hiddenSpots.filter(x => x.revealed && !x.cleaned);
      if (cand.length) {
        const s = cand[Math.floor(Math.random() * cand.length)];
        s.needHits = Math.min(s.needHits + 1, 5);
        fxFloat('☣️ คราบฟื้นตัว', s.x, s.y, 'bad');
        comboBreak();
      }
    }

    // boss timeout
    bossTick();

    // combo timeout
    if (S.comboExpireAt && ts > S.comboExpireAt) {
      S.combo = 0;
      S.comboExpireAt = 0;
    }

    // phase spawns
    phaseSpawnerTick();

    // clean pct + hud
    recalcCleanPct();
    updateHUD();

    // renders
    renderBodyCanvas();
    renderFx(dt);

    // phase progression
    autoPhaseCheck();

    // timeout end
    if (S.timeLeft <= 0) {
      endGame(false);
    }
  }

  /* =========================
   * Start / End / Reset
   * ========================= */
  function startGame() {
    cancelAnimationFrame(rafId);

    S.running = true;
    S.ended = false;
    S.phase = 'prep';
    S.phaseStartedAt = performance.now();
    S.startedAt = performance.now();
    S.lastTs = 0;
    S.timeLeft = CFG.time;

    S.score = 0;
    S.combo = 0;
    S.comboExpireAt = 0;
    S.miss = 0;
    S.sweat = 0;
    S.cleanPct = 0;

    S.progress.wetHits = 0;
    S.progress.soapHits = 0;
    S.progress.rinseHits = 0;
    S.progress.dryHits = 0;

    S.view = (UI.viewPill?.textContent || '').includes('BACK') ? 'BACK' : S.view;
    buildHiddenSpots();
    S.boss = null;

    S.questText = 'เตรียมตัว 3 วินาที';

    UI.panelEnd?.classList.add('hidden');
    clearTargets();

    if (UI.btnStart) UI.btnStart.textContent = 'กำลังเล่น...';

    updateHUD();
    resizeBodyCanvas();
    resizeFxCanvas();
    renderBodyCanvas();

    rafId = requestAnimationFrame(loop);
  }

  function endGame(win) {
    if (S.ended) return;
    S.ended = true;
    S.running = false;
    clearTargets();
    cancelAnimationFrame(rafId);

    if (UI.btnStart) UI.btnStart.textContent = 'เริ่มเล่น';
    showEndPanel(win);
  }

  /* =========================
   * Input wiring
   * ========================= */
  function bindInputs() {
    UI.btnStart?.addEventListener('click', () => {
      if (!S.running) startGame();
    });

    UI.btnReplay?.addEventListener('click', () => {
      UI.panelEnd?.classList.add('hidden');
      startGame();
    });

    UI.btnBack?.addEventListener('click', () => {
      const hub = qstr('hub', '../hub.html');
      location.href = hub;
    });

    UI.btnHelp?.addEventListener('click', () => UI.panelHelp?.classList.remove('hidden'));
    UI.btnCloseHelp?.addEventListener('click', () => UI.panelHelp?.classList.add('hidden'));

    UI.btnFlip?.addEventListener('click', () => {
      S.view = (S.view === 'FRONT') ? 'BACK' : 'FRONT';
      updateHUD();

      // if playing scrub, rebuild hidden spots for current view (optional challenge)
      if (S.running && !S.ended && ['prep','wet','soap'].includes(S.phase)) {
        buildHiddenSpots();
      }
      renderBodyCanvas();
    });

    // Body scrub input (pointer)
    UI.bodyWrap?.addEventListener('pointerdown', (e) => {
      S.pointerDown = true;
      const p = getPointerNormFromEvent(e);
      S.lastPointer = { x: p.x, y: p.y };
      if (S.phase === 'scrub') handleScrubPointer(p.x, p.y, p.px, p.py);
    }, { passive: true });

    UI.bodyWrap?.addEventListener('pointermove', (e) => {
      if (!S.pointerDown) return;
      const p = getPointerNormFromEvent(e);
      S.lastPointer = { x: p.x, y: p.y };
      if (S.phase === 'scrub') handleScrubPointer(p.x, p.y, p.px, p.py);
    }, { passive: true });

    W.addEventListener('pointerup', () => {
      S.pointerDown = false;
    }, { passive: true });

    // cVR fallback crosshair visual only
    if (UI.crosshairFallback) {
      const isCVR = (qstr('view','').toLowerCase() === 'cvr');
      UI.crosshairFallback.style.display = isCVR ? 'block' : 'none';
    }

    // keyboard debug shortcuts
    if (DEBUG) {
      W.addEventListener('keydown', (e) => {
        if (e.key === 'n') nextPhase();
        if (e.key === 'b') maybeSpawnBoss();
        if (e.key === 'e') endGame(true);
      });
    }

    W.addEventListener('resize', () => {
      resizeBodyCanvas();
      resizeFxCanvas();
    }, { passive: true });
  }

  /* =========================
   * Utils
   * ========================= */
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  /* =========================
   * Boot
   * ========================= */
  function boot() {
    if (!CFG) {
      console.error('Bath config missing');
      return;
    }

    // view pill init
    if (UI.viewPill) UI.viewPill.textContent = `VIEW: ${S.view}`;

    // basic styles for targets if css not yet patched
    ensureTargetBaseStyles();

    bindInputs();
    resizeBodyCanvas();
    resizeFxCanvas();
    buildHiddenSpots();
    recalcCleanPct();
    updateHUD();
    renderBodyCanvas();

    // expose debug
    W.HHBathDebug = Object.assign(W.HHBathDebug || {}, {
      start: startGame,
      end: (ok=true) => endGame(!!ok),
      nextPhase,
      boss: () => maybeSpawnBoss(),
      revealAll: () => { S.hiddenSpots.forEach(s => s.revealed = true); renderBodyCanvas(); },
      cleanAll: () => { S.hiddenSpots.forEach(s => { s.revealed = true; s.cleaned = true; s.hitCount = s.needHits; }); S.hiddenCleanedCount = S.hiddenSpots.length; recalcCleanPct(); updateHUD(); renderBodyCanvas(); },
      state: () => S
    });

    console.log('[Bath] booted', { diff: DIFF, view: VIEW, debug: DEBUG });
  }

  function ensureTargetBaseStyles() {
    if (D.getElementById('bath-target-inline-style')) return;
    const st = D.createElement('style');
    st.id = 'bath-target-inline-style';
    st.textContent = `
      #target-layer { position:absolute; inset:0; z-index:3; pointer-events:none; }
      #target-layer .tgt { pointer-events:auto; }
      #crosshair-fallback {
        position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
        width:22px; height:22px; border-radius:999px;
        border:2px solid rgba(255,255,255,.85);
        box-shadow:0 0 0 1px rgba(0,0,0,.35) inset;
        z-index:6; pointer-events:none; display:none;
      }
      #crosshair-fallback::before, #crosshair-fallback::after {
        content:''; position:absolute; background:rgba(255,255,255,.9);
      }
      #crosshair-fallback::before { left:50%; top:-6px; width:2px; height:34px; transform:translateX(-50%); }
      #crosshair-fallback::after { top:50%; left:-6px; width:34px; height:2px; transform:translateY(-50%); }
    `;
    D.head.appendChild(st);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();