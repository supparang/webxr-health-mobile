// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (shared, event-driven)
// ✅ Standardizes VFX across all games
// ✅ Listens to HHA events and triggers Particles + body FX classes
// ✅ Storm/Boss/Rage rules (as agreed):
//    - timeLeft <= 30s => fx-storm
//    - miss >= 4      => fx-boss
//    - miss >= 5      => fx-rage
//
// Events supported:
// - hha:judge   { label, kind?, x?, y? }  => pop/score/burst + shake/vignette
// - hha:score   { score, delta? }        => small feedback
// - hha:time    { t }                    => storm toggle
// - quest:update{ goal, mini }           => optional subtle feedback
// - hha:celebrate { kind, grade? }       => celebrate
// - hha:end     { ... summary ... }      => end celebrate + freeze flags
// - hha:view / hha:enter-vr / hha:exit-vr => intensity per view
//
// Safe:
// - No hard dependency: if Particles missing, it quietly no-ops.
// - Avoids overriding game CSS; only adds/removes body classes.
// - Throttled to prevent spam.

(function () {
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const now = ()=> (WIN.performance ? performance.now() : Date.now());
  const qs = (k, d=null)=> { try{ return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };

  // ------------------------------------------------------------
  // Config (tunable)
  // ------------------------------------------------------------
  const CFG = Object.assign({
    stormAtSec: 30,
    bossAtMiss: 4,
    rageAtMiss: 5,

    // hit feedback
    judgeCooldownMs: 70,
    burstCooldownMs: 90,

    // motion
    shakeMs: 170,
    shakePowerBase: 5,

    // view multipliers
    viewMul: {
      pc: 1.0,
      mobile: 1.0,
      vr: 0.85,
      cvr: 0.85,
    },

    // default center if x/y not provided
    defaultXY: 'center', // 'center' | 'random'
  }, WIN.HHA_FX_CONFIG || {});

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const S = {
    view: (DOC.body?.dataset?.view) || (qs('view', null) || '').toLowerCase() || null,
    timeLeft: null,      // seconds
    miss: null,          // integer
    ended: false,

    lastJudgeAt: 0,
    lastBurstAt: 0,
    lastShakeAt: 0,

    // last pointer pos (for fallback)
    px: null,
    py: null,
  };

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function getView(){
    const b = DOC.body;
    const dv = (b && b.dataset && b.dataset.view) ? b.dataset.view : '';
    const v = String(dv || S.view || qs('view', null) || '').toLowerCase();
    if(v === 'pc' || v === 'vr' || v === 'cvr') return v;
    if(v === 'mobile') return 'mobile';
    // infer
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent||'') ? 'mobile' : 'pc';
  }

  function mul(){
    const v = getView();
    return CFG.viewMul[v] ?? 1.0;
  }

  function Particles(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }

  function viewport(){
    return {
      W: DOC.documentElement.clientWidth || 1,
      H: DOC.documentElement.clientHeight || 1,
    };
  }

  function pickXY(detail){
    const {W,H} = viewport();

    // explicit
    const x = Number(detail?.x ?? detail?.clientX);
    const y = Number(detail?.y ?? detail?.clientY);
    if(Number.isFinite(x) && Number.isFinite(y)) return { x: clamp(x,0,W), y: clamp(y,0,H) };

    // last pointer
    if(Number.isFinite(S.px) && Number.isFinite(S.py)) return { x: clamp(S.px,0,W), y: clamp(S.py,0,H) };

    // default
    if(CFG.defaultXY === 'random'){
      return { x: Math.random()*W, y: Math.random()*H };
    }
    return { x: W/2, y: H/2 };
  }

  function setBodyFlag(cls, on){
    const b = DOC.body;
    if(!b) return;
    if(on) b.classList.add(cls);
    else b.classList.remove(cls);
  }

  function applyPhaseFlags(){
    // storm
    if(S.timeLeft != null){
      setBodyFlag('fx-storm', (S.timeLeft <= CFG.stormAtSec));
      setBodyFlag('fx-storm2', (S.timeLeft <= 12)); // optional deeper storm
    }

    // boss / rage
    if(S.miss != null){
      setBodyFlag('fx-boss', (S.miss >= CFG.bossAtMiss));
      setBodyFlag('fx-rage', (S.miss >= CFG.rageAtMiss));
    }

    // freeze after end
    if(S.ended){
      setBodyFlag('fx-storm', false);
      setBodyFlag('fx-storm2', false);
      // boss/rage may remain as a "result state" (optional) — keep them
    }
  }

  // micro shake (CSS transform on body via class)
  function ensureShakeStyle(){
    if(DOC.getElementById('hhaFxDirectorStyle')) return;
    const st = DOC.createElement('style');
    st.id = 'hhaFxDirectorStyle';
    st.textContent = `
      body.fx-shake{
        animation: hhaShake var(--hha-shake-ms, 170ms) ease-in-out 1;
      }
      @keyframes hhaShake{
        0%{ transform: translate3d(0,0,0); }
        15%{ transform: translate3d(calc(var(--hha-shake-x, 4px)*-1), calc(var(--hha-shake-y, 3px)), 0); }
        35%{ transform: translate3d(calc(var(--hha-shake-x, 4px)), calc(var(--hha-shake-y, 3px)*-1), 0); }
        55%{ transform: translate3d(calc(var(--hha-shake-x, 4px)*-1), calc(var(--hha-shake-y, 3px)*-1), 0); }
        75%{ transform: translate3d(calc(var(--hha-shake-x, 4px)), calc(var(--hha-shake-y, 3px)), 0); }
        100%{ transform: translate3d(0,0,0); }
      }
    `;
    DOC.head.appendChild(st);
  }

  function shake(kind){
    if(S.ended) return;
    const t = now();
    if(t - S.lastShakeAt < 140) return;
    S.lastShakeAt = t;

    ensureShakeStyle();
    const b = DOC.body;
    if(!b) return;

    const m = mul();
    const base = CFG.shakePowerBase * m;

    const rage = b.classList.contains('fx-rage');
    const boss = b.classList.contains('fx-boss');
    const storm= b.classList.contains('fx-storm');

    let pow = base;
    if(storm) pow *= 1.10;
    if(boss)  pow *= 1.18;
    if(rage)  pow *= 1.28;

    if(kind === 'bad' || kind === 'junk') pow *= 1.25;
    if(kind === 'block') pow *= 0.85;
    if(kind === 'star' || kind === 'shield') pow *= 0.75;

    const sx = clamp((pow * (0.8 + Math.random()*0.6)), 2, 12);
    const sy = clamp((pow * (0.6 + Math.random()*0.6)), 2, 10);
    b.style.setProperty('--hha-shake-x', sx.toFixed(1) + 'px');
    b.style.setProperty('--hha-shake-y', sy.toFixed(1) + 'px');
    b.style.setProperty('--hha-shake-ms', clamp(CFG.shakeMs * (0.95 + Math.random()*0.2), 120, 260).toFixed(0) + 'ms');

    b.classList.remove('fx-shake');
    // restart animation
    void b.offsetWidth;
    b.classList.add('fx-shake');
    setTimeout(()=>{ try{ b.classList.remove('fx-shake'); }catch(_){ } }, 320);
  }

  function vignetteFlash(intensity){
    // Particles has vignette support (if particles.js ultra)
    try{
      const v = DOC.querySelector('.hha-fx-vignette');
      if(!v) return;
      const a = clamp(Number(intensity)||0.25, 0.12, 0.55);
      v.style.opacity = String(a);
      setTimeout(()=>{ try{ v.style.opacity = '0'; }catch(_){ } }, 170);
    }catch(_){}
  }

  function inferKindFromLabel(label){
    const s = String(label||'').toLowerCase();
    if(s.includes('oops') || s.includes('miss') || s.includes('fail')) return 'bad';
    if(s.includes('block')) return 'block';
    if(s.includes('star')) return 'star';
    if(s.includes('shield')) return 'shield';
    if(s.includes('diamond')) return 'diamond';
    if(s.includes('perfect') || s.includes('good') || s.includes('+')) return 'good';
    return 'good';
  }

  // ------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------
  function onJudge(ev){
    if(S.ended) return;
    const t = now();
    if(t - S.lastJudgeAt < CFG.judgeCooldownMs) return;
    S.lastJudgeAt = t;

    const d = ev?.detail || {};
    const label = d.label ?? d.text ?? d.msg ?? '';
    const kind = (d.kind || inferKindFromLabel(label)).toLowerCase();
    const P = Particles();
    const p = pickXY(d);

    // intensity scales with phases
    const b = DOC.body;
    const storm = b?.classList?.contains('fx-storm');
    const boss  = b?.classList?.contains('fx-boss');
    const rage  = b?.classList?.contains('fx-rage');

    const m = mul();
    let waveSize = 160 * m;
    let burstCount = 12 * m;
    let dur = 520;

    if(storm){ waveSize *= 1.08; burstCount *= 1.06; }
    if(boss){  waveSize *= 1.14; burstCount *= 1.12; dur += 40; }
    if(rage){  waveSize *= 1.22; burstCount *= 1.18; dur += 70; }

    // choose which effects
    try{
      if(P){
        // central burst on meaningful judge labels
        if(t - S.lastBurstAt >= CFG.burstCooldownMs){
          S.lastBurstAt = t;

          // default emoji by kind
          const emoji =
            (kind==='bad' || kind==='junk') ? '💥' :
            (kind==='block') ? '🛡️' :
            (kind==='star') ? '⭐' :
            (kind==='shield') ? '🛡️' :
            (kind==='diamond') ? '💎' :
            (String(label).includes('+')) ? '✨' : '✅';

          P.burstAt(p.x, p.y, {
            kind,
            emoji,
            count: Math.round(clamp(burstCount, 8, 26)),
            size: (kind==='bad'||kind==='junk') ? 26 : 22,
            durMs: dur,
            wave: true,
            waveSize: Math.round(clamp(waveSize, 120, 320)),
          });
        }

        // text pop
        if(label){
          const txt = String(label).slice(0, 24);
          if(P.scorePop && (txt.includes('+') || kind==='diamond')) P.scorePop(p.x, p.y, txt, kind);
          else if(P.popText) P.popText(p.x, p.y, txt, '');
        }
      }
    }catch(_){}

    // shake + vignette
    if(kind==='bad' || kind==='junk'){
      shake('bad');
      vignetteFlash(0.38 * m);
      try{
        // a small miss mark
        Particles()?.missX?.(p.x, p.y, { kind:'bad', emoji:'✖', durMs: 520 });
      }catch(_){}
    }else if(kind==='block'){
      shake('block');
      vignetteFlash(0.18 * m);
    }else{
      vignetteFlash(0.14 * m);
    }
  }

  function onScore(ev){
    if(S.ended) return;
    const d = ev?.detail || {};
    // optional: subtle feedback on big delta
    const delta = Number(d.delta);
    if(!Number.isFinite(delta)) return;
    if(Math.abs(delta) < 20) return;

    try{
      const P = Particles();
      if(!P || !P.scorePop) return;
      const p = pickXY(d);
      const kind = delta > 0 ? 'good' : 'bad';
      P.scorePop(p.x, p.y, (delta>0?`+${delta}`:`${delta}`), kind);
    }catch(_){}
  }

  function onTime(ev){
    const d = ev?.detail || {};
    const t = Number(d.t);
    if(Number.isFinite(t)) S.timeLeft = t;
    applyPhaseFlags();
  }

  function onQuestUpdate(_ev){
    // keep minimal (no spam); you can add subtle tick later if you want
  }

  function onEnd(ev){
    if(S.ended) return;
    S.ended = true;
    applyPhaseFlags();

    const d = ev?.detail || {};
    const grade = String(d.grade||'').toUpperCase();

    // end celebration
    try{
      const P = Particles();
      if(P && P.celebrate){
        const kind =
          (grade==='S') ? 'diamond' :
          (grade==='A') ? 'good' :
          (grade==='B') ? 'star' :
          (grade==='C') ? 'shield' : 'bad';
        P.celebrate({ kind, count: 18, durMs: 820, vignetteOpacity: 0.25, emoji: '🎉' });
      }
    }catch(_){}
  }

  function onView(ev){
    const d = ev?.detail || {};
    const v = String(d.view || '').toLowerCase();
    if(v) S.view = v;
  }

  // track last pointer for fallback XY
  function onPointer(ev){
    try{
      S.px = ev.clientX;
      S.py = ev.clientY;
    }catch(_){}
  }

  // ------------------------------------------------------------
  // Optional: allow games to push miss count (for boss/rage flags)
  // ------------------------------------------------------------
  function onMissUpdate(ev){
    const d = ev?.detail || {};
    const m = Number(d.miss ?? d.misses);
    if(Number.isFinite(m)){
      S.miss = Math.max(0, Math.floor(m));
      applyPhaseFlags();
    }
  }

  // some games may only emit hha:end summary with misses — capture it too
  function onEndSummaryMiss(ev){
    const d = ev?.detail || {};
    if(d && d.misses != null){
      const m = Number(d.misses);
      if(Number.isFinite(m)) S.miss = Math.max(0, Math.floor(m));
      applyPhaseFlags();
    }
  }

  // ------------------------------------------------------------
  // Bind
  // ------------------------------------------------------------
  WIN.addEventListener('pointerdown', onPointer, { passive:true });
  WIN.addEventListener('pointermove', onPointer, { passive:true });

  WIN.addEventListener('hha:judge', onJudge, { passive:true });
  WIN.addEventListener('hha:score', onScore, { passive:true });
  WIN.addEventListener('hha:time',  onTime,  { passive:true });
  WIN.addEventListener('quest:update', onQuestUpdate, { passive:true });
  WIN.addEventListener('hha:celebrate', function(ev){
    // passthrough
    try{
      const d = ev?.detail || {};
      const P = Particles();
      if(P && P.celebrate) P.celebrate(d);
    }catch(_){}
  }, { passive:true });

  WIN.addEventListener('hha:end', function(ev){
    onEndSummaryMiss(ev);
    onEnd(ev);
  }, { passive:true });

  // view bridge from vr-ui.js
  WIN.addEventListener('hha:view', onView, { passive:true });
  WIN.addEventListener('hha:enter-vr', ()=> onView({ detail:{ view: /android|iphone|ipad|ipod/i.test(navigator.userAgent||'') ? 'cvr' : 'vr' } }), { passive:true });
  WIN.addEventListener('hha:exit-vr',  ()=> onView({ detail:{ view: /android|iphone|ipad|ipod/i.test(navigator.userAgent||'') ? 'mobile' : 'pc' } }), { passive:true });

  // optional miss update channel (recommended for GoodJunk)
  WIN.addEventListener('hha:miss', onMissUpdate, { passive:true });

  // ------------------------------------------------------------
  // Boot-time inference (if query params exist)
  // ------------------------------------------------------------
  (function init(){
    S.view = getView();

    // If the game doesn't emit hha:miss, boss/rage can still be updated by
    // adding a tiny hook in safe.js: emit('hha:miss', { miss: state.miss })
    // We'll still keep storm based on hha:time.
    applyPhaseFlags();
  })();

})();