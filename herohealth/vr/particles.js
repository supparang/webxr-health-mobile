// === /herohealth/vr/particles.js ===
// HeroHealth FX Layer (DOM)
// - score pop + burst
// - toast
// - ✅ HEAVY Celebration: big banner + confetti storm + fanfare + screen shake + sparkle ring
// Works as IIFE, exposes: window.GAME_MODULES.Particles (and window.Particles)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // -----------------------------
  // Layer
  // -----------------------------
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '99997',
        pointerEvents: 'none',
        overflow: 'hidden'
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  // -----------------------------
  // Styles
  // -----------------------------
  function ensureStyle() {
    if (doc.getElementById('hha-fx-style')) return;
    const s = doc.createElement('style');
    s.id = 'hha-fx-style';
    s.textContent = `
      .hha-fx-pop{
        position:fixed;
        transform:translate(-50%,-50%);
        font-weight:900;
        font-size:18px;
        letter-spacing:.02em;
        filter:drop-shadow(0 10px 20px rgba(0,0,0,.55));
        opacity:0;
        animation:hhaPop .55s ease-out forwards;
        will-change:transform, opacity;
        pointer-events:none;
        z-index:99998;
      }
      @keyframes hhaPop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.7); }
        10%{ opacity:1; transform:translate(-50%,-60%) scale(1.06); }
        100%{ opacity:0; transform:translate(-50%,-120%) scale(1); }
      }

      .hha-fx-burst{
        position:fixed;
        width:10px;height:10px;
        transform:translate(-50%,-50%);
        pointer-events:none;
        z-index:99998;
      }
      .hha-fx-shard{
        position:absolute;
        left:50%;top:50%;
        width:8px;height:8px;
        border-radius:6px;
        transform:translate(-50%,-50%);
        opacity:.95;
        filter:drop-shadow(0 10px 18px rgba(0,0,0,.55));
        animation:hhaShard 520ms ease-out forwards;
      }
      @keyframes hhaShard{
        0%{ transform:translate(-50%,-50%) scale(.7); opacity:.0; }
        10%{ opacity:.95; }
        100%{ transform:translate(var(--dx), var(--dy)) scale(.0); opacity:0; }
      }

      /* --------- TOAST ---------- */
      .hha-fx-toast{
        position:fixed;
        left:50%;
        bottom:84px;
        transform:translate(-50%, 14px);
        min-width:min(560px, 92vw);
        max-width:min(860px, 92vw);
        padding:12px 14px;
        border-radius:16px;
        border:1px solid rgba(148,163,184,0.35);
        background:rgba(2,6,23,0.78);
        backdrop-filter:blur(14px);
        box-shadow:0 20px 50px rgba(0,0,0,.55);
        color:#e5e7eb;
        font-weight:800;
        letter-spacing:.02em;
        opacity:0;
        animation:hhaToast 2.2s ease forwards;
        pointer-events:none;
        z-index:99999;
      }
      @keyframes hhaToast{
        0%{ opacity:0; transform:translate(-50%, 16px); }
        12%{ opacity:1; transform:translate(-50%, 0px); }
        78%{ opacity:1; transform:translate(-50%, 0px); }
        100%{ opacity:0; transform:translate(-50%, 14px); }
      }

      /* --------- HEAVY CELEBRATION ---------- */
      .hha-cele-wrap{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:99999;
      }
      .hha-cele-dim{
        position:absolute;
        inset:0;
        background:radial-gradient(circle at 50% 56%, rgba(34,197,94,.22), rgba(2,6,23,0) 60%),
                   radial-gradient(circle at 50% 56%, rgba(250,204,21,.18), rgba(2,6,23,0) 68%);
        opacity:0;
        animation:hhaDim 1.25s ease-out forwards;
      }
      @keyframes hhaDim{
        0%{ opacity:0; }
        15%{ opacity:1; }
        100%{ opacity:0; }
      }

      .hha-cele-banner{
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%, -62%) scale(.86);
        width:min(740px, 92vw);
        border-radius:22px;
        border:1px solid rgba(148,163,184,0.38);
        background:radial-gradient(circle at top left, rgba(11,17,32,.92), rgba(2,6,23,.92) 65%);
        box-shadow:0 30px 90px rgba(0,0,0,.65);
        padding:14px 16px 12px;
        text-align:center;
        opacity:0;
        animation:hhaBanner 1.25s ease-out forwards;
      }
      @keyframes hhaBanner{
        0%{ opacity:0; transform:translate(-50%, -64%) scale(.84); }
        10%{ opacity:1; transform:translate(-50%, -66%) scale(1.02); }
        22%{ transform:translate(-50%, -66%) scale(1); }
        80%{ opacity:1; }
        100%{ opacity:0; transform:translate(-50%, -70%) scale(.98); }
      }
      .hha-cele-title{
        font-weight:1000;
        letter-spacing:.06em;
        font-size:20px;
        text-transform:uppercase;
      }
      .hha-cele-sub{
        margin-top:6px;
        font-weight:800;
        font-size:14px;
        color:rgba(229,231,235,.92);
      }
      .hha-cele-badges{
        margin-top:10px;
        display:flex;
        gap:8px;
        justify-content:center;
        flex-wrap:wrap;
      }
      .hha-cele-chip{
        font-weight:900;
        font-size:12px;
        letter-spacing:.06em;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,0.35);
        background:rgba(15,23,42,0.82);
        color:#e5e7eb;
      }

      /* confetti */
      .hha-conf{
        position:absolute;
        top:-10vh;
        left:var(--x);
        width:var(--w);
        height:var(--h);
        border-radius:6px;
        opacity:.95;
        transform:rotate(var(--r));
        filter:drop-shadow(0 14px 22px rgba(0,0,0,.55));
        animation:hhaConf var(--t) linear forwards;
      }
      @keyframes hhaConf{
        0%{ transform:translate3d(0,-10vh,0) rotate(var(--r)); opacity:0; }
        8%{ opacity:.95; }
        100%{ transform:translate3d(var(--dx), 120vh, 0) rotate(calc(var(--r) + 500deg)); opacity:0; }
      }

      /* sparkle ring at center */
      .hha-spark{
        position:absolute;
        left:50%;
        top:56%;
        width:min(360px, 60vw);
        height:min(360px, 60vw);
        transform:translate(-50%,-50%) scale(.92);
        border-radius:999px;
        border:2px solid rgba(255,255,255,0.14);
        box-shadow:0 0 26px rgba(255,255,255,0.18),
                   0 0 56px rgba(34,197,94,0.22),
                   inset 0 0 30px rgba(250,204,21,0.14);
        opacity:0;
        animation:hhaSpark 1.1s ease-out forwards;
      }
      @keyframes hhaSpark{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.84); }
        16%{ opacity:1; transform:translate(-50%,-50%) scale(1.02); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.12); }
      }

      /* screen shake */
      .hha-shake{
        animation:hhaShake 520ms ease-in-out 1;
      }
      @keyframes hhaShake{
        0%{ transform:translate3d(0,0,0); }
        10%{ transform:translate3d(-2px, 1px, 0); }
        20%{ transform:translate3d(2px, -1px, 0); }
        30%{ transform:translate3d(-3px, 2px, 0); }
        40%{ transform:translate3d(3px, -2px, 0); }
        50%{ transform:translate3d(-2px, -1px, 0); }
        60%{ transform:translate3d(2px, 1px, 0); }
        100%{ transform:translate3d(0,0,0); }
      }
    `;
    doc.head.appendChild(s);
  }

  ensureStyle();
  const layer = ensureLayer();

  // -----------------------------
  // Audio (safe / tiny)
  // -----------------------------
  let audioCtx = null;

  function getAudio(){
    try{
      audioCtx = audioCtx || new (root.AudioContext || root.webkitAudioContext)();
      return audioCtx;
    }catch{
      return null;
    }
  }

  function tone(freq, dur, type='sine', gain=0.04){
    const A = getAudio();
    if (!A) return;
    try{
      const o = A.createOscillator();
      const g = A.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(A.destination);
      o.start();
      o.stop(A.currentTime + dur);
    }catch{}
  }

  function fanfare(kind){
    // short “gamey” fanfare sequences
    // keep very short, mobile friendly
    if (kind === 'goal'){
      tone(659, 0.07, 'triangle', 0.05);
      setTimeout(()=>tone(784, 0.07, 'triangle', 0.05), 90);
      setTimeout(()=>tone(988, 0.10, 'triangle', 0.055), 180);
    } else if (kind === 'mini'){
      tone(784, 0.06, 'sine', 0.045);
      setTimeout(()=>tone(988, 0.07, 'sine', 0.045), 90);
    } else if (kind === 'fever'){
      tone(523, 0.06, 'square', 0.035);
      setTimeout(()=>tone(659, 0.06, 'square', 0.035), 70);
      setTimeout(()=>tone(784, 0.08, 'square', 0.04), 140);
    } else if (kind === 'end'){
      tone(392, 0.08, 'triangle', 0.05);
      setTimeout(()=>tone(523, 0.08, 'triangle', 0.05), 110);
      setTimeout(()=>tone(659, 0.10, 'triangle', 0.055), 220);
    } else {
      tone(880, 0.07, 'triangle', 0.045);
      setTimeout(()=>tone(988, 0.08, 'triangle', 0.045), 90);
    }
  }

  // -----------------------------
  // FX API
  // -----------------------------
  function scorePop(x, y, delta, label){
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop';
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';

    let txt = '';
    if (typeof delta === 'number') {
      const sign = delta > 0 ? '+' : '';
      txt = `${sign}${delta}`;
    }
    const tag = label ? ` • ${label}` : '';
    el.textContent = `${txt}${tag}`.trim();

    // label-based color without hardcoding palette too much
    if (label === 'JUNK' || label === 'MISS') el.style.color = '#fb923c';
    else if (label === 'BLOCK') el.style.color = '#60a5fa';
    else if (label === 'POWER' || label === 'GOLD') el.style.color = '#facc15';
    else el.style.color = '#4ade80';

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 700);
  }

  function burstAt(x, y, label){
    const wrap = doc.createElement('div');
    wrap.className = 'hha-fx-burst';
    wrap.style.left = (x|0) + 'px';
    wrap.style.top  = (y|0) + 'px';

    const n = 14;
    for (let i=0;i<n;i++){
      const s = doc.createElement('div');
      s.className = 'hha-fx-shard';

      const ang = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 56;
      const dx = Math.cos(ang) * r;
      const dy = Math.sin(ang) * r;

      s.style.setProperty('--dx', dx.toFixed(1)+'px');
      s.style.setProperty('--dy', dy.toFixed(1)+'px');

      if (label === 'JUNK' || label === 'MISS') s.style.background = 'rgba(251,146,60,.95)';
      else if (label === 'BLOCK') s.style.background = 'rgba(96,165,250,.95)';
      else if (label === 'POWER' || label === 'GOLD') s.style.background = 'rgba(250,204,21,.95)';
      else s.style.background = 'rgba(74,222,128,.95)';

      s.style.width = (6 + Math.random()*7).toFixed(0)+'px';
      s.style.height = (6 + Math.random()*7).toFixed(0)+'px';

      wrap.appendChild(s);
    }

    layer.appendChild(wrap);
    setTimeout(()=>{ try{ wrap.remove(); }catch{} }, 650);
  }

  function toast(text){
    const el = doc.createElement('div');
    el.className = 'hha-fx-toast';
    el.textContent = String(text || '').slice(0, 220);
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 2400);
  }

  // -----------------------------
  // HEAVY Celebration
  // -----------------------------
  let celeLock = 0;

  function shakeScreen(){
    try{
      const w = doc.getElementById('hvr-wrap') || doc.body;
      w.classList.remove('hha-shake');
      // force reflow
      void w.offsetWidth;
      w.classList.add('hha-shake');
      setTimeout(()=>{ try{ w.classList.remove('hha-shake'); }catch{} }, 650);
    }catch{}
  }

  function makeConfetti(parent, intensity){
    const count = clamp(intensity || 1, 0.6, 2.5);
    const n = Math.round(120 * count); // heavy
    for (let i=0;i<n;i++){
      const c = doc.createElement('div');
      c.className = 'hha-conf';

      const x = (Math.random()*100).toFixed(2) + 'vw';
      const w = (6 + Math.random()*10).toFixed(0) + 'px';
      const h = (8 + Math.random()*14).toFixed(0) + 'px';
      const r = (Math.random()*360).toFixed(0) + 'deg';
      const t = (1.6 + Math.random()*1.2).toFixed(2) + 's';
      const dx = ((Math.random()*2-1)*18).toFixed(1) + 'vw';

      // random bright-ish colors
      const colors = ['#4ade80','#22c55e','#facc15','#fb923c','#60a5fa','#a78bfa','#f472b6','#34d399'];
      const col = colors[(Math.random()*colors.length)|0];

      c.style.setProperty('--x', x);
      c.style.setProperty('--w', w);
      c.style.setProperty('--h', h);
      c.style.setProperty('--r', r);
      c.style.setProperty('--t', t);
      c.style.setProperty('--dx', dx);
      c.style.background = col;

      parent.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch{} }, 2600);
    }
  }

  function celebrate(kind='goal', opts={}){
    const now = Date.now();
    if (now - celeLock < 450) return; // anti spam
    celeLock = now;

    const intensity = Number(opts.intensity ?? 1);
    const title = String(opts.title || '').trim();
    const sub   = String(opts.sub || '').trim();
    const chips = Array.isArray(opts.chips) ? opts.chips.slice(0,6) : [];

    let t = title;
    let s = sub;

    if (!t){
      if (kind === 'goal') t = '🎉 GOAL CLEARED!';
      else if (kind === 'mini') t = '✨ MINI QUEST CLEARED!';
      else if (kind === 'fever') t = '🔥 FEVER MODE!';
      else if (kind === 'end') t = '🏁 STAGE COMPLETE!';
      else t = '🎊 NICE!';
    }
    if (!s){
      if (kind === 'goal') s = 'ได้รางวัล! แต้ม + เกราะ + Storm Wave 🌊';
      else if (kind === 'mini') s = 'ได้รางวัล! แต้ม + เวลาเพิ่ม ⏱️';
      else if (kind === 'fever') s = 'แตะให้ไว! คะแนนคูณ x2!';
      else if (kind === 'end') s = 'สรุปผลพร้อมรางวัลทั้งหมด';
      else s = 'ทำได้ดีมาก!';
    }

    // wrap
    const wrap = doc.createElement('div');
    wrap.className = 'hha-cele-wrap';

    const dim = doc.createElement('div');
    dim.className = 'hha-cele-dim';
    wrap.appendChild(dim);

    const spark = doc.createElement('div');
    spark.className = 'hha-spark';
    wrap.appendChild(spark);

    const banner = doc.createElement('div');
    banner.className = 'hha-cele-banner';

    const titleEl = doc.createElement('div');
    titleEl.className = 'hha-cele-title';
    titleEl.textContent = t;

    const subEl = doc.createElement('div');
    subEl.className = 'hha-cele-sub';
    subEl.textContent = s;

    banner.appendChild(titleEl);
    banner.appendChild(subEl);

    const badgeRow = doc.createElement('div');
    badgeRow.className = 'hha-cele-badges';

    const defaultChips = [];
    if (kind === 'goal') defaultChips.push('🎯 GOAL','🛡️ BONUS','🌊 STORM');
    if (kind === 'mini') defaultChips.push('✨ MINI','⏱️ TIME+','🔥 FEVER+');
    if (kind === 'fever') defaultChips.push('🔥 FEVER','x2 SCORE','🛡️ SHIELD');
    if (kind === 'end') defaultChips.push('🏁 FINISH','🎁 REWARDS','⭐ GRADE');

    const chipList = chips.length ? chips : defaultChips;

    chipList.slice(0,6).forEach(tx=>{
      const c = doc.createElement('div');
      c.className = 'hha-cele-chip';
      c.textContent = tx;
      badgeRow.appendChild(c);
    });

    banner.appendChild(badgeRow);
    wrap.appendChild(banner);

    layer.appendChild(wrap);

    // confetti storm
    makeConfetti(wrap, (kind === 'end' ? 1.8 : (kind === 'goal' ? 1.4 : 1.1)) * intensity);

    // sound + shake
    fanfare(kind);
    shakeScreen();

    // auto remove
    setTimeout(()=>{ try{ wrap.remove(); }catch{} }, 1500);
  }

  // -----------------------------
  // Export
  // -----------------------------
  const API = {
    scorePop,
    burstAt,
    toast,
    celebrate
  };

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;
  root.Particles = API;

})(typeof window !== 'undefined' ? window : globalThis);
