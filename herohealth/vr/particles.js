// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + target burst
// + Celebration FX สำหรับ Quest (Goal / Mini / All Complete)
// ✅ UPGRADE: LINE-sticker Judge + MISS slide+screen shake + PERFECT confetti+ping
// ✅ PATCH: รองรับ hha:celebrate + quest:* + hha:fx (burst/score/judge) + กัน bind ซ้ำ

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_PARTICLES_BOUND__) {
    root.GAME_MODULES = root.GAME_MODULES || {};
    root.GAME_MODULES.Particles = root.GAME_MODULES.Particles || root.Particles || {};
    return;
  }
  root.__HHA_PARTICLES_BOUND__ = true;

  // ---------- helpers ----------
  function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: 700,
        overflow: 'hidden'
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  function ensureStyles(){
    if (doc.getElementById('hha-fx-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-fx-style';
    st.textContent = `
      /* ==== SCREEN SHAKE (whole viewport) ==== */
      .hha-screen-shake{
        animation: hha-screen-shake 360ms ease-in-out;
        transform-origin: 50% 50%;
      }
      @keyframes hha-screen-shake{
        0%{ transform: translate(0,0) }
        12%{ transform: translate(calc(var(--hha-shake) * -1), calc(var(--hha-shake) * 0.4)) }
        24%{ transform: translate(calc(var(--hha-shake) *  0.9), calc(var(--hha-shake) * -0.5)) }
        36%{ transform: translate(calc(var(--hha-shake) * -0.7), calc(var(--hha-shake) * 0.6)) }
        48%{ transform: translate(calc(var(--hha-shake) *  0.6), calc(var(--hha-shake) * 0.1)) }
        60%{ transform: translate(calc(var(--hha-shake) * -0.4), calc(var(--hha-shake) * -0.2)) }
        72%{ transform: translate(calc(var(--hha-shake) *  0.25), calc(var(--hha-shake) * 0.15)) }
        100%{ transform: translate(0,0) }
      }

      /* ---- SCORE POP ---- */
      .hha-pop{
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(15,23,42,0.82);
        border: 2px solid rgba(148,163,184,0.22);
        box-shadow: 0 16px 40px rgba(0,0,0,0.45);
        font-weight: 1000;
        font-size: 14px;
        letter-spacing: .02em;
        color: #e5e7eb;
        opacity: 0;
        animation: hha-pop-up .55s ease-out forwards;
        white-space: nowrap;
        backdrop-filter: blur(8px);
        transform: translate(-50%,-50%);
      }
      .hha-pop.good{ border-color: rgba(34,197,94,0.55); color:#bbf7d0; }
      .hha-pop.junk, .hha-pop.haz{ border-color: rgba(249,115,22,0.55); color:#fed7aa; }
      .hha-pop.power{ border-color: rgba(59,130,246,0.55); color:#bfdbfe; }
      .hha-pop.boss{ border-color: rgba(250,204,21,0.75); color:#fef3c7; }

      @keyframes hha-pop-up{
        0%{ transform: translate(-50%,-50%) scale(.85); opacity: 0; }
        18%{ opacity: 1; transform: translate(-50%,-54%) scale(1.08); }
        100%{ transform: translate(-50%,-68%) scale(0.98); opacity: 0; }
      }

      /* ---- JUDGE STICKER (LINE style) ---- */
      .hha-judge{
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 11px 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.96);
        color: #0f172a;
        font-weight: 1000;
        font-size: 15px;
        letter-spacing: .02em;
        opacity: 0;
        transform: translate(-50%,-50%) scale(.6);
        transform-origin: 50% 65%;
        border: 4px solid rgba(15,23,42,0.98);
        box-shadow:
          0 20px 46px rgba(0,0,0,0.46),
          0 3px 0 rgba(15,23,42,0.95);
        backdrop-filter: blur(6px);
        white-space: nowrap;
        pointer-events:none;
      }
      .hha-judge:before{
        content:"";
        position:absolute;
        left: 10px;
        top: 8px;
        width: 48%;
        height: 38%;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0));
        pointer-events:none;
      }
      .hha-judge:after{
        content:"";
        position:absolute;
        left: 16px;
        bottom: -12px;
        width: 18px;
        height: 18px;
        background: rgba(255,255,255,0.96);
        border-left: 4px solid rgba(15,23,42,0.98);
        border-bottom: 4px solid rgba(15,23,42,0.98);
        transform: rotate(45deg);
        border-bottom-left-radius: 7px;
      }

      .hha-judge .badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: 4px solid rgba(15,23,42,0.98);
        box-shadow: 0 3px 0 rgba(15,23,42,0.95);
        font-size: 18px;
        line-height: 1;
        background: rgba(255,255,255,0.98);
        transform: rotate(-6deg);
        flex: 0 0 auto;
      }
      .hha-judge .txt{
        position: relative;
        top: 1px;
        text-shadow: 0 1px 0 rgba(255,255,255,0.7);
      }

      /* theme tints */
      .hha-judge.good{ background: rgba(236,253,245,0.98); }
      .hha-judge.junk{ background: rgba(255,237,213,0.98); }
      .hha-judge.haz { background: rgba(254,226,226,0.98); }
      .hha-judge.power{ background: rgba(219,234,254,0.98); }
      .hha-judge.boss{ background: rgba(254,249,195,0.98); }

      /* NORMAL bounce */
      .hha-judge{
        animation: hha-judge-bounce 640ms cubic-bezier(.2,1.35,.25,1) forwards;
      }
      .hha-judge .txt{
        animation: hha-text-wobble 640ms cubic-bezier(.2,1.35,.25,1) forwards;
      }
      @keyframes hha-text-wobble{
        0%{ transform: translateY(2px) scale(.85); }
        40%{ transform: translateY(-1px) scale(1.10); }
        70%{ transform: translateY(0px) scale(0.98); }
        100%{ transform: translateY(-1px) scale(1.00); }
      }
      @keyframes hha-judge-bounce{
        0%{ opacity: 0; transform: translate(-50%,-50%) scale(.55) rotate(-4deg); }
        22%{ opacity: 1; transform: translate(-50%,-56%) scale(1.16) rotate(3deg); }
        48%{ transform: translate(-50%,-60%) scale(0.98) rotate(-1deg); }
        100%{ opacity: 0; transform: translate(-50%,-82%) scale(.96) rotate(0deg); }
      }

      /* MISS: SLIDE + SHAKE (แฉลบซ้ายขวา) */
      .hha-judge.miss{
        animation: hha-judge-miss-slide 720ms cubic-bezier(.15,1.25,.25,1) forwards;
      }
      .hha-judge.miss .txt{ animation: hha-text-wobble 520ms cubic-bezier(.2,1.35,.25,1) forwards; }

      @keyframes hha-judge-miss-slide{
        0%{ opacity: 0; transform: translate(-50%,-50%) scale(.62) rotate(-8deg); }
        16%{ opacity: 1; transform: translate(-50%,-54%) scale(1.14) rotate(6deg); }
        28%{ transform: translate(calc(-50% - 62px), calc(-58% - 2px)) rotate(-10deg) scale(1.10); }
        38%{ transform: translate(calc(-50% + 72px), calc(-58% + 3px)) rotate(12deg) scale(1.08); }
        48%{ transform: translate(calc(-50% - 58px), calc(-58% - 1px)) rotate(-10deg) scale(1.06); }
        58%{ transform: translate(calc(-50% + 42px), calc(-60% + 1px)) rotate(8deg) scale(1.02); }
        70%{ transform: translate(-50%,-64%) rotate(-2deg) scale(1.00); }
        100%{ opacity: 0; transform: translate(-50%,-86%) rotate(0deg) scale(.96); }
      }

      /* BURST DOTS (compat) */
      .hha-fx-dot{
        position:absolute;
        border-radius:999px;
        pointer-events:none;
      }

      /* PERFECT: confetti stars */
      .hha-confetti{
        position: fixed;
        pointer-events:none;
        transform: translate(-50%,-50%);
        z-index: 701;
      }
      .hha-confetti-star{
        position:absolute;
        left: 0;
        top: 0;
        font-size: 16px;
        opacity: 0;
        filter: drop-shadow(0 10px 16px rgba(0,0,0,0.35));
        animation: hha-confetti-fall 720ms ease-out forwards;
      }
      @keyframes hha-confetti-fall{
        0%{ opacity: 0; transform: translate(0,0) rotate(0deg) scale(.8); }
        16%{ opacity: 1; }
        100%{ opacity: 0; transform: translate(var(--cx), var(--cy)) rotate(160deg) scale(1.08); }
      }

      /* Sparkle twinkle */
      .hha-sparkle{
        position: fixed;
        pointer-events:none;
        transform: translate(-50%,-50%);
        z-index: 701;
      }
      .hha-star{
        position:absolute;
        left: 0;
        top: 0;
        font-size: 18px;
        opacity: 0;
        filter: drop-shadow(0 10px 16px rgba(0,0,0,0.35));
        animation: hha-star 520ms ease-out forwards;
      }
      @keyframes hha-star{
        0%{ opacity: 0; transform: translate(0,0) scale(.5) rotate(0deg); }
        20%{ opacity: 1; }
        100%{ opacity: 0; transform: translate(var(--sx), var(--sy)) scale(1.15) rotate(55deg); }
      }

      /* QUEST banner (existing) */
      .hha-fx-score{
        pointer-events:none;
      }
    `;
    doc.head.appendChild(st);
  }

  function toPx(x, y, opts){
    opts = opts || {};
    const W = root.innerWidth || 1;
    const H = root.innerHeight || 1;

    if (opts.px) return { x: clamp(x, 0, W), y: clamp(y, 0, H) };

    const nx = (x > 1.5) ? (x / 100) : x; // 0..1 or 0..100
    const ny = (y > 1.5) ? (y / 100) : y;
    return { x: clamp(nx, 0, 1) * W, y: clamp(ny, 0, 1) * H };
  }

  // ---------- screen shake ----------
  let shakeBusy = false;
  function screenShake(intensity, ms){
    const layer = ensureLayer();
    ensureStyles();
    if (shakeBusy) return;
    shakeBusy = true;

    layer.classList.add('hha-screen-shake');
    layer.style.setProperty('--hha-shake', clamp(intensity||14, 6, 18) + 'px');

    setTimeout(function(){
      layer.classList.remove('hha-screen-shake');
      shakeBusy = false;
    }, clamp(ms||360, 220, 520));
  }

  // ---------- sound ping ----------
  let audioCtx = null;
  function pingSound(){
    try{
      audioCtx = audioCtx || new (root.AudioContext || root.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(function(){});

      const now = audioCtx.currentTime;

      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      const g  = audioCtx.createGain();

      o1.type = 'sine';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(1200, now);
      o2.frequency.setValueAtTime(1800, now);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      o1.connect(g); o2.connect(g); g.connect(audioCtx.destination);
      o1.start(now); o2.start(now + 0.005);
      o1.stop(now + 0.22); o2.stop(now + 0.22);
    }catch(_){}
  }

  // ---------- core fx ----------
  function burstAt(x, y, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    ensureStyles();

    const p = toPx(x, y, opts);
    x = p.x; y = p.y;

    const color = opts.color || '#22c55e';
    const good = !!opts.good;
    const kind = String(opts.kind||'').toLowerCase();

    const n =
      typeof opts.count === 'number' && opts.count > 0
        ? opts.count
        : good ? 32 : 20;

    const isPerfect = String(opts.judgment||'').toUpperCase().includes('PERFECT');

    for (let i = 0; i < n; i++) {
      const dot = doc.createElement('div');
      dot.className = 'hha-fx-dot';
      const size = good ? 7 + Math.random() * 7 : 5 + Math.random() * 5;

      Object.assign(dot.style, {
        left: x + 'px',
        top: y + 'px',
        width: size + 'px',
        height: size + 'px',
        background: color,
        boxShadow: '0 0 14px rgba(0,0,0,0.9)',
        opacity: '1',
        transform: 'translate(-50%, -50%) scale(0.9)',
        transition: 'transform 0.55s ease-out, opacity 0.55s ease-out'
      });

      layer.appendChild(dot);

      const ang = Math.random() * Math.PI * 2;
      const distBase = good ? 90 : 65;
      const dist = distBase + Math.random() * 50;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      requestAnimationFrame(function () {
        dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.98)';
        dot.style.opacity = '0';
      });

      setTimeout(function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 580);
    }

    // extra sparkle/confetti for PERFECT when burst called with kind good
    if (isPerfect || kind === 'perfect') {
      sparklesAt(x, y, { px:true, count: 10, radius: 92 });
      confettiStarsAt(x, y, { px:true, count: 22, radius: 160 });
    }
  }

  function scorePop(x, y, value, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    ensureStyles();

    const p = toPx(x, y, opts);
    x = p.x; y = p.y;

    const good = !!opts.good;
    const judgment = String(opts.judgment || '').toUpperCase();

    const wrap = doc.createElement('div');
    wrap.className = 'hha-fx-score';

    const parts = [];
    if (value !== undefined && value !== null && value !== '') parts.push(String(value));
    if (judgment) parts.push(judgment);
    wrap.textContent = parts.join(' ');

    Object.assign(wrap.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, -50%) scale(0.9)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '20px',
      fontWeight: '900',
      color: good ? '#bbf7d0' : '#fed7aa',
      textShadow: '0 0 20px rgba(0,0,0,0.95)',
      padding: '6px 12px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.96)',
      border: '2px solid rgba(148,163,184,0.35)',
      whiteSpace: 'nowrap',
      opacity: '0',
      transition: 'transform 0.45s ease-out, opacity 0.45s ease-out',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      pointerEvents: 'none'
    });

    layer.appendChild(wrap);

    const burstColor = good ? '#22c55e' : '#f97316';
    burstAt(x, y, { px:true, color: burstColor, good: good });

    requestAnimationFrame(function () {
      wrap.style.transform = 'translate(-50%, -90%) scale(1.08)';
      wrap.style.opacity = '1';
    });
    setTimeout(function () {
      wrap.style.transform = 'translate(-50%, -135%) scale(0.98)';
      wrap.style.opacity = '0';
    }, 260);

    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 520);
  }

  function badgeFor(label){
    const t = String(label||'').toUpperCase();
    if (t.includes('PERFECT')) return '🌟';
    if (t.includes('GOOD')) return '😊';
    if (t.includes('MISS')) return '💥';
    if (t.includes('BLOCK')) return '🛡️';
    if (t.includes('SHIELD')) return '🥗';
    if (t.includes('CLEANSE')) return '🍋';
    if (t.includes('GOLD')) return '⭐';
    if (t.includes('BOSS')) return '👾';
    if (t.includes('RISK') || t.includes('HAZ')) return '⚠️';
    if (t.includes('POWER')) return '✨';
    if (t.includes('CLEAR')) return '✅';
    return '🎯';
  }

  function makeDiv(className, xPx, yPx) {
    const el = doc.createElement('div');
    el.className = className;
    Object.assign(el.style, {
      position: 'fixed',
      left: xPx + 'px',
      top: yPx + 'px',
      transform: 'translate(-50%,-50%)',
      pointerEvents: 'none',
      willChange: 'transform, opacity'
    });
    return el;
  }

  function sparklesAt(x, y, opts){
    opts = opts || {};
    const layer = ensureLayer();
    ensureStyles();

    const p = toPx(x, y, opts);
    const sp = makeDiv('hha-sparkle', p.x, p.y);
    layer.appendChild(sp);

    const n = clamp(opts.count || 8, 5, 14);
    const radius = clamp(opts.radius || 80, 50, 140);

    for (let i=0;i<n;i++){
      const star = doc.createElement('div');
      star.className = 'hha-star';
      star.textContent = (i % 3 === 0) ? '✨' : (i % 3 === 1) ? '⭐' : '💫';

      const a = (Math.PI*2) * (i/n) + (Math.random()*0.45);
      const rr = radius * (0.55 + Math.random()*0.65);
      const sx = Math.cos(a) * rr;
      const sy = Math.sin(a) * rr;

      star.style.setProperty('--sx', sx + 'px');
      star.style.setProperty('--sy', sy + 'px');
      star.style.animationDelay = (Math.random()*80) + 'ms';
      sp.appendChild(star);
    }

    setTimeout(function(){ try{ sp.remove(); }catch(_){} }, 650);
  }

  function confettiStarsAt(x, y, opts){
    opts = opts || {};
    const layer = ensureLayer();
    ensureStyles();

    const p = toPx(x, y, opts);
    const cf = makeDiv('hha-confetti', p.x, p.y);
    layer.appendChild(cf);

    const n = clamp(opts.count || 18, 10, 30);
    const radius = clamp(opts.radius || 140, 90, 220);

    for (let i=0;i<n;i++){
      const c = doc.createElement('div');
      c.className = 'hha-confetti-star';
      c.textContent =
        (i % 5 === 0) ? '⭐' :
        (i % 5 === 1) ? '✨' :
        (i % 5 === 2) ? '💫' :
        (i % 5 === 3) ? '🌟' : '✴️';

      const a = (Math.PI*2) * Math.random();
      const rr = radius * (0.35 + Math.random()*0.85);
      const cx = Math.cos(a) * rr;
      const cy = (Math.sin(a) * rr) + (60 + Math.random()*120);

      c.style.setProperty('--cx', cx + 'px');
      c.style.setProperty('--cy', cy + 'px');
      c.style.fontSize = (14 + Math.random()*12) + 'px';
      c.style.animationDelay = (Math.random()*90) + 'ms';
      cf.appendChild(c);
    }

    setTimeout(function(){ try{ cf.remove(); }catch(_){} }, 820);
  }

  function judgeAt(x, y, text, opts){
    opts = opts || {};
    const layer = ensureLayer();
    ensureStyles();

    const p = toPx(x, y, opts);
    x = p.x; y = p.y;

    const dx = Number(opts.dx)||0;
    const dy = Number(opts.dy)||0;

    const kind = String(opts.kind||'').toLowerCase();
    const label = String(text||'').toUpperCase();
    if (!label) return;

    const wrap = makeDiv('hha-judge ' + kind, x + dx, y + dy);

    const isMiss = label.includes('MISS');
    const isPerfect = label.includes('PERFECT');

    if (isMiss) wrap.classList.add('miss');

    const badge = doc.createElement('span');
    badge.className = 'badge';
    badge.textContent = badgeFor(label);

    const t = doc.createElement('span');
    t.className = 'txt';
    t.textContent = label;

    wrap.appendChild(badge);
    wrap.appendChild(t);
    layer.appendChild(wrap);

    if (isMiss){
      screenShake(14, 360);
    }
    if (isPerfect){
      sparklesAt(x, y, { px:true, count: 10, radius: 92 });
      confettiStarsAt(x, y, { px:true, count: 22, radius: 160 });
      pingSound();
    }

    setTimeout(function(){ try{ wrap.remove(); }catch(_){} }, 760);
  }

  // ---------- Quest celebrates (keep your existing behavior) ----------
  function celebrateQuestFX(kind, index, total, label) {
    ensureLayer();
    ensureStyles();
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * 0.5;

    const k = String(kind || 'goal').toLowerCase();
    const color = k === 'goal' ? '#22c55e' : '#38bdf8';
    const title = (k === 'goal')
      ? ('GOAL ' + index + '/' + total)
      : ('MINI ' + index + '/' + total);

    burstAt(cx, cy, { px:true, color: color, good: true, count: 32 });
    scorePop(cx, cy, 'MISSION CLEAR!', { px:true, judgment: title, good: true });

    if (label) {
      const layer = ensureLayer();
      const sub = doc.createElement('div');
      sub.textContent = String(label);
      Object.assign(sub.style, {
        position: 'absolute',
        left: '50%',
        top: '60%',
        transform: 'translate(-50%, -50%)',
        padding: '6px 12px',
        borderRadius: '999px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '13px',
        fontWeight: '800',
        color: '#e5e7eb',
        background: 'rgba(2,6,23,0.88)',
        border: '1px solid rgba(148,163,184,0.35)',
        textShadow: '0 0 18px rgba(0,0,0,0.9)',
        opacity: '0',
        transition: 'opacity .25s ease-out, transform .25s ease-out',
        maxWidth: '78vw',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents:'none'
      });
      layer.appendChild(sub);
      requestAnimationFrame(function () {
        sub.style.opacity = '1';
        sub.style.transform = 'translate(-50%, -50%) translateY(-2px)';
      });
      setTimeout(function () {
        sub.style.opacity = '0';
        sub.style.transform = 'translate(-50%, -50%) translateY(-10px)';
      }, 520);
      setTimeout(function () {
        if (sub.parentNode) sub.parentNode.removeChild(sub);
      }, 820);
    }
  }

  function celebrateAllQuestsFX(detail) {
    ensureLayer();
    ensureStyles();
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * 0.32;

    const colors = ['#facc15', '#22c55e', '#38bdf8'];
    colors.forEach(function (c, idx) {
      setTimeout(function () {
        burstAt(cx, cy, { px:true, color: c, good: true, count: 34 });
      }, idx * 220);
    });

    const layer = ensureLayer();
    const banner = doc.createElement('div');
    banner.textContent = 'ALL QUESTS CLEAR! 🌟';
    Object.assign(banner.style, {
      position: 'absolute',
      left: '50%',
      top: '30%',
      transform: 'translate(-50%, -50%) scale(0.88)',
      padding: '10px 18px',
      borderRadius: '999px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '18px',
      fontWeight: '900',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: '#fef3c7',
      background:
        'radial-gradient(circle at top left, rgba(250,250,250,0.18), transparent 55%), rgba(8,47,73,0.96)',
      border: '2px solid rgba(250,204,21,0.85)',
      textShadow: '0 0 22px rgba(0,0,0,0.9)',
      boxShadow: '0 22px 60px rgba(15,23,42,0.95)',
      opacity: '0',
      transition: 'opacity .4s ease-out, transform .4s ease-out',
      pointerEvents:'none'
    });
    layer.appendChild(banner);

    requestAnimationFrame(function () {
      banner.style.opacity = '1';
      banner.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    setTimeout(function () {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -50%) scale(0.94)';
    }, 1100);
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 1500);
  }

  // keep your color mapper (used by old hha:judge hook)
  function colorByLabel(label) {
    label = String(label || '').toUpperCase();
    if (label === 'GOOD' || label === 'PERFECT' || label === 'HIT') return { c:'#22c55e', g:true };
    if (label === 'FEVER') return { c:'#facc15', g:true };
    if (label === 'GOLD') return { c:'#facc15', g:true };
    if (label === 'BOSS') return { c:'#38bdf8', g:true };
    if (label === 'SLOW' || label === 'STREAK' || label === 'AVOID') return { c:'#a5b4fc', g:true };
    if (label === 'BLOCK') return { c:'#60a5fa', g:true };
    if (label === 'TRAP') return { c:'#fb7185', g:false };
    return { c:'#f97316', g:false };
  }

  // ---------- Event listeners ----------
  if (root && root.addEventListener) {
    // NEW: preferred channel from engines (Plate uses this)
    root.addEventListener('hha:fx', function(e){
      try{
        const d = e.detail || {};
        if (d.x == null || d.y == null) return;
        const type = String(d.type||'');
        if (type === 'burst') burstAt(d.x, d.y, d);
        else if (type === 'score') scorePop(d.x, d.y, d.text || '', Object.assign({}, d, { px:false }));
        else if (type === 'judge') judgeAt(d.x, d.y, d.text || '', d);
      }catch(_){}
    });

    // keep old: when someone emits hha:judge with x/y
    root.addEventListener('hha:judge', function (e) {
      try {
        const d = e.detail || {};
        const label = String(d.label || '').toUpperCase();
        if (!label) return;

        // if engine provides x/y: show sticker too
        if (typeof d.x === 'number' && typeof d.y === 'number'){
          judgeAt(d.x, d.y, label, { px:true, kind: (d.kind||'') });
          return;
        }

        // otherwise keep only burst mapping (legacy)
        const hasPos = (typeof d.x === 'number' && typeof d.y === 'number');
        if (!hasPos) return;
        const cc = colorByLabel(label);
        burstAt(d.x, d.y, { px:true, color: cc.c, good: cc.g, count: cc.g ? 28 : 18, judgment: label });
      } catch (_) {}
    });

    // quest celebrates (legacy)
    root.addEventListener('quest:celebrate', function (e) {
      try {
        const d = e.detail || {};
        celebrateQuestFX(d.kind || 'goal', (d.index || 0) | 0, (d.total || 0) | 0, d.label || '');
      } catch (_) {}
    });

    root.addEventListener('quest:all-complete', function (e) {
      try { celebrateAllQuestsFX((e && e.detail) || {}); } catch (_) {}
    });

    // hha:celebrate (legacy)
    root.addEventListener('hha:celebrate', function (e) {
      try {
        const d = e.detail || {};
        const type = String(d.type || d.kind || '').toLowerCase();
        if (type === 'all') { celebrateAllQuestsFX(d); return; }
        celebrateQuestFX(type || 'goal', (d.index || 0) | 0, (d.total || 0) | 0, d.label || '');
      } catch (_) {}
    });

    root.addEventListener('hha:all-complete', function (e) {
      try { celebrateAllQuestsFX((e && e.detail) || {}); } catch (_) {}
    });
  }

  // ---------- API surface ----------
  const api = {
    scorePop: function(x, y, value, opts){
      // keep old signature: expects pixels
      return scorePop(x, y, value, Object.assign({ px:true }, opts||{}));
    },
    burstAt: function(x, y, opts){
      return burstAt(x, y, Object.assign({ px:true }, opts||{}));
    },
    judgeAt: function(x, y, text, opts){
      return judgeAt(x, y, text, Object.assign({ px:true }, opts||{}));
    },
    celebrateQuestFX,
    celebrateAllQuestsFX,
    screenShake,
    pingSound
  };

  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;

})(window);
