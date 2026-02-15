// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (SAFE)
// ✅ One place to map game events -> HHA_FX / Particles effects
// ✅ Works even if particles.js not loaded (no-ops safely)
// ✅ Listens: hha:judge, hha:celebrate, quest:update (optional), hha:score (optional)
// ✅ Rate-limited to avoid spam / performance drop
//
// Suggested conventions (any game can emit):
// - hha:judge { label, kind, x, y, clientX, clientY, intensity }
//    kind: good | bad | miss | block | star | shield | diamond | goal | mini | boss | storm
// - hha:celebrate { kind:'mini'|'goal'|'end'|'boss'|'storm', grade, x, y }
// - quest:update { goal, mini }  (FX director will not spam; only optional)
// - hha:score { score } (optional tiny feedback)
//
// Config: window.HHA_FX_DIRECTOR_CONFIG = {
//   enabled: true,
//   maxFps: 30,
//   popCooldownMs: 70,
//   burstCooldownMs: 90,
//   confettiCooldownMs: 900,
//   reducedMotionRespect: true
// };

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const CFG = Object.assign({
    enabled: true,
    maxFps: 30,
    popCooldownMs: 70,
    burstCooldownMs: 90,
    confettiCooldownMs: 900,
    reducedMotionRespect: true
  }, root.HHA_FX_DIRECTOR_CONFIG || {});

  // ---------- helpers ----------
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, Number(v)||0));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function prefersReducedMotion(){
    try{
      if(!CFG.reducedMotionRespect) return false;
      return !!root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }catch(_){ return false; }
  }

  function FX(){
    // Preferred: HHA_FX (from particles.js)
    // Back-compat: Particles
    return root.HHA_FX || root.Particles || null;
  }

  function safeXY(detail){
    try{
      if(detail){
        if(Number.isFinite(detail.x) && Number.isFinite(detail.y)) return { x: detail.x, y: detail.y };
        if(Number.isFinite(detail.clientX) && Number.isFinite(detail.clientY)) return { x: detail.clientX, y: detail.clientY };
      }
    }catch(_){}
    // fallback = screen center
    try{
      const x = Math.floor(DOC.documentElement.clientWidth / 2);
      const y = Math.floor(DOC.documentElement.clientHeight * 0.42);
      return { x, y };
    }catch(_){
      return { x: 180, y: 220 };
    }
  }

  // ---------- simple rate limiter ----------
  const limiter = {
    lastPop: 0,
    lastBurst: 0,
    lastConfetti: 0,
    lastRing: 0,
    lastFlash: 0,
    lastScore: 0,
  };

  function ok(key, cooldownMs){
    const t = now();
    const last = limiter[key] || 0;
    if(t - last < cooldownMs) return false;
    limiter[key] = t;
    return true;
  }

  // ---------- style mapping ----------
  // Use HUE to tint (works with particles.js hue-rotate)
  const HUE = {
    good: 120,     // green
    bad: 10,       // red/orange
    miss: 0,       // red
    block: 200,    // blue
    star: 55,      // yellow
    shield: 190,   // cyan
    diamond: 280,  // violet
    goal: 95,      // lime
    mini: 40,      // warm
    boss: 320,     // magenta
    storm: 210,    // deep blue
    end: 160,      // green/cyan
  };

  function pop(text, x, y, opt){
    try{
      const P = FX();
      if(!P || typeof P.popText !== 'function') return;
      P.popText(x, y, text, opt || {});
    }catch(_){}
  }
  function emoji(e, x, y, opt){
    try{
      const P = FX();
      if(!P || typeof P.popEmoji !== 'function') return;
      P.popEmoji(x, y, e, opt || {});
    }catch(_){}
  }
  function burst(x, y, opt){
    try{
      const P = FX();
      if(!P || typeof P.burst !== 'function') return;
      P.burst(x, y, opt || {});
    }catch(_){}
  }
  function confetti(x, y, opt){
    try{
      const P = FX();
      if(!P || typeof P.confetti !== 'function') return;
      P.confetti(x, y, opt || {});
    }catch(_){}
  }
  function ring(x, y, opt){
    try{
      const P = FX();
      if(!P || typeof P.ring !== 'function') return;
      P.ring(x, y, opt || {});
    }catch(_){}
  }
  function flash(x, y, opt){
    try{
      const P = FX();
      if(!P || typeof P.flash !== 'function') return;
      P.flash(x, y, opt || {});
    }catch(_){}
  }

  // ---------- public play API ----------
  function play(kind, detail){
    if(!CFG.enabled) return;
    const reduced = prefersReducedMotion();

    const k = String(kind || '').toLowerCase() || 'good';
    const { x, y } = safeXY(detail);
    const intensity = clamp(detail?.intensity ?? 1, 0.6, 2.0);

    // Pop text label (lightweight)
    if(ok('lastPop', CFG.popCooldownMs)){
      const label = String(detail?.label || '').trim();
      if(label){
        pop(label, x, y, { size: Math.round(16 + 6*intensity), alpha: 0.98, hue: HUE[k] ?? 0 });
      }
    }

    if(reduced) return;

    // Core burst
    if(ok('lastBurst', CFG.burstCooldownMs)){
      const hue = HUE[k] ?? 0;

      if(k === 'good'){
        burst(x, y, { count: 10, size: 10, speed: 560, lifeMs: 520, hue });
        ring(x, y, { size: 22, hue });
        flash(x, y, { size: 24 });
        emoji('✨', x, y, { size: 28 });

      } else if(k === 'bad' || k === 'miss'){
        burst(x, y, { count: 12, size: 10, speed: 620, lifeMs: 520, hue });
        ring(x, y, { size: 24, hue });
        emoji('💥', x, y, { size: 30 });

      } else if(k === 'block'){
        burst(x, y, { count: 10, size: 10, speed: 520, lifeMs: 520, hue });
        ring(x, y, { size: 26, hue });
        emoji('🛡️', x, y, { size: 30 });

      } else if(k === 'star'){
        burst(x, y, { count: 14, size: 10, speed: 580, lifeMs: 560, hue });
        ring(x, y, { size: 28, hue });
        emoji('⭐', x, y, { size: 32 });

      } else if(k === 'shield'){
        burst(x, y, { count: 12, size: 10, speed: 560, lifeMs: 560, hue });
        ring(x, y, { size: 28, hue });
        emoji('🛡️', x, y, { size: 32 });

      } else if(k === 'diamond'){
        burst(x, y, { count: 18, size: 10, speed: 720, lifeMs: 620, hue });
        ring(x, y, { size: 30, hue });
        emoji('💎', x, y, { size: 34 });

      } else if(k === 'goal'){
        burst(x, y, { count: 18, size: 10, speed: 680, lifeMs: 620, hue });
        ring(x, y, { size: 34, hue });
        if(ok('lastConfetti', CFG.confettiCooldownMs)){
          confetti(x, y, { count: 18, spread: 260, lifeMs: 1000, hue });
        }

      } else if(k === 'mini'){
        burst(x, y, { count: 16, size: 10, speed: 650, lifeMs: 620, hue });
        ring(x, y, { size: 32, hue });
        emoji('🎉', x, y, { size: 34 });

      } else if(k === 'boss'){
        burst(x, y, { count: 22, size: 10, speed: 860, lifeMs: 700, hue });
        ring(x, y, { size: 40, hue });
        emoji('😈', x, y, { size: 34 });

      } else if(k === 'storm'){
        burst(x, y, { count: 22, size: 10, speed: 820, lifeMs: 720, hue });
        ring(x, y, { size: 38, hue });
        emoji('🌪️', x, y, { size: 34 });

      } else if(k === 'end'){
        burst(x, y, { count: 20, size: 10, speed: 740, lifeMs: 700, hue });
        ring(x, y, { size: 38, hue });
        if(ok('lastConfetti', CFG.confettiCooldownMs)){
          confetti(x, y, { count: 22, spread: 320, lifeMs: 1200, hue });
        }
      } else {
        burst(x, y, { count: 10, size: 10, speed: 560, lifeMs: 520, hue });
        ring(x, y, { size: 22, hue });
      }
    }
  }

  // ---------- event listeners ----------
  function onJudge(ev){
    try{
      const d = ev?.detail || null;
      const kind = (d && d.kind) ? d.kind : inferKindFromLabel(d?.label);
      play(kind, d || {});
    }catch(_){}
  }

  function inferKindFromLabel(label){
    const s = String(label || '').toUpperCase();
    if(s.includes('GOOD')) return 'good';
    if(s.includes('MISS')) return 'miss';
    if(s.includes('BLOCK')) return 'block';
    if(s.includes('STAR')) return 'star';
    if(s.includes('SHIELD')) return 'shield';
    if(s.includes('DIAMOND')) return 'diamond';
    if(s.includes('GOAL')) return 'goal';
    if(s.includes('MINI')) return 'mini';
    if(s.includes('BOSS')) return 'boss';
    if(s.includes('STORM')) return 'storm';
    if(s.includes('OOPS')) return 'bad';
    return 'good';
  }

  function onCelebrate(ev){
    try{
      const d = ev?.detail || {};
      const k = String(d.kind || 'end').toLowerCase();
      // Grade -> extra confetti (not spamming)
      if(k === 'end'){
        play('end', d);
        const grade = String(d.grade || '').toUpperCase();
        if(grade && ok('lastConfetti', CFG.confettiCooldownMs)){
          const {x,y} = safeXY(d);
          confetti(x, y, { count: grade==='S' ? 26 : 18, spread: grade==='S' ? 360 : 300, lifeMs: 1200, hue: 150 });
          pop(`GRADE ${grade}!`, x, y-42, { size: 22, alpha: 0.98, hue: 140 });
        }
        return;
      }
      play(k, d);
    }catch(_){}
  }

  function onQuestUpdate(ev){
    // Optional: DO NOT spam. Only show when goal/mini changes (best-effort)
    try{
      // Intentionally minimal; games already show HUD text
      // You can enable extra callouts by setting window.HHA_FX_DIRECTOR_CONFIG.questCallouts=true
      if(!root.HHA_FX_DIRECTOR_CONFIG?.questCallouts) return;

      const d = ev?.detail || {};
      const goal = d.goal || null;
      const mini = d.mini || null;

      const t = now();
      if(t - (limiter.__lastQuest || 0) < 1200) return;
      limiter.__lastQuest = t;

      const x = Math.floor(DOC.documentElement.clientWidth/2);
      const y = Math.floor(DOC.documentElement.clientHeight*0.28);

      if(goal?.title){
        pop(`GOAL: ${goal.title}`, x, y, { size: 16, alpha: 0.95, hue: HUE.goal });
      }
      if(mini?.title){
        pop(`MINI: ${mini.title}`, x, y+24, { size: 16, alpha: 0.92, hue: HUE.mini });
      }
    }catch(_){}
  }

  function onScore(ev){
    // Optional micro-feedback every ~1.1s
    try{
      if(!root.HHA_FX_DIRECTOR_CONFIG?.scoreTicks) return;
      const t = now();
      if(t - (limiter.lastScore||0) < 1100) return;
      limiter.lastScore = t;

      const score = ev?.detail?.score;
      if(score == null) return;

      const x = Math.floor(DOC.documentElement.clientWidth*0.12);
      const y = Math.floor(DOC.documentElement.clientHeight*0.18);
      pop(`+${score}`, x, y, { size: 14, alpha: 0.55, hue: 120 });
    }catch(_){}
  }

  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  root.addEventListener('quest:update', onQuestUpdate, { passive:true });
  root.addEventListener('hha:score', onScore, { passive:true });

  // ---------- export ----------
  root.HHA_FX_DIRECTOR = {
    play,
    config: CFG
  };

})(window);