// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — ULTRA (PRODUCTION)
// ✅ Standard FX for ALL games via HHA events
// ✅ Injects minimal CSS (works even if game CSS missing)
// ✅ Uses Particles (../vr/particles.js) when present
// ✅ Listens on both window + document for robustness
// ✅ Storm / Boss / Rage hooks (supports GoodJunk rules):
//    - timeLeft <= 30s => storm start
//    - miss >= 4 => boss start
//    - miss >= 5 => rage start
// ✅ Supports boss HP profile (10/12/14) + phase2 6s (via detail)
// Events consumed (any of these sources ok):
// - hha:judge   detail: {type/kind/result,label,x,y,combo,deltaMiss, ...}
// - hha:score   detail: {score,delta,add,value,x,y}
// - hha:time    detail: {t,timeLeftSec,sec}
// - hha:miss    detail: {x,y}
// - hha:storm   detail: {on:boolean, phase?, intensity?}
// - hha:boss    detail: {on:boolean, hp?, hpMax?, phase?, rage?}
// - hha:end     detail: {grade,reason}
// - hha:celebrate detail: {kind}
// Optional helper: window.HHA_FX_TEST()

(function(){
  'use strict';
  const ROOT = window;
  const DOC  = document;
  if(!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const num = (v)=> { v = Number(v); return Number.isFinite(v) ? v : null; };

  // ---------- inject minimal CSS ----------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;

    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-20px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 140ms ease;
        filter: blur(.2px);
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 45%,
          rgba(0,0,0,.28) 72%,
          rgba(0,0,0,.62) 100%);
      }

      body.fx-hit-good .hha-fx-vignette{ opacity:.20; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity:.38; }
      body.fx-miss     .hha-fx-vignette{ opacity:.34; }
      body.fx-storm    .hha-fx-vignette{ opacity:.26; }
      body.fx-boss     .hha-fx-vignette{ opacity:.30; }
      body.fx-rage     .hha-fx-vignette{ opacity:.44; }

      /* subtle kick */
      body.fx-kick{ animation: hhaKick 110ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* storm wobble */
      body.fx-storm-wobble{ animation: hhaStormWobble 420ms ease; }
      @keyframes hhaStormWobble{
        0%{ transform: translate3d(0,0,0); }
        30%{ transform: translate3d(-1px,1px,0); }
        60%{ transform: translate3d(1px,-1px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* rage pulse */
      body.fx-rage-pulse{ animation: hhaRagePulse 520ms ease; }
      @keyframes hhaRagePulse{
        0%{ filter:none; }
        40%{ filter: contrast(1.08) brightness(1.06) saturate(1.08); }
        100%{ filter:none; }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 720ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.16) contrast(1.05); }
        100%{ filter:none; }
      }

      /* tiny status chip (optional) */
      .hha-fx-status{
        position:fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        z-index:9999;
        pointer-events:none;
        font: 900 11px/1 system-ui;
        color: rgba(226,232,240,.9);
        background: rgba(2,6,23,.55);
        border: 1px solid rgba(148,163,184,.18);
        padding: 8px 10px;
        border-radius: 999px;
        opacity:0;
        transform: translateY(8px);
        transition: opacity 160ms ease, transform 160ms ease;
      }
      body.fx-show-status .hha-fx-status{
        opacity:1; transform: translateY(0);
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);

    const status = DOC.createElement('div');
    status.className = 'hha-fx-status';
    status.id = 'hhaFxStatus';
    status.textContent = '';
    DOC.body.appendChild(status);
  })();

  // ---------- helpers ----------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }
  function setStatus(text, ms){
    const el = DOC.getElementById('hhaFxStatus');
    if(!el) return;
    el.textContent = String(text||'');
    DOC.body.classList.add('fx-show-status');
    setTimeout(()=>DOC.body.classList.remove('fx-show-status'), ms||680);
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }

  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if (x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || '').toString().toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('good') || t.includes('correct') || t.includes('hitgood')) return 'good';
    if (t.includes('bad')  || t.includes('junk') || t.includes('wrong')  || t.includes('hitjunk')) return 'bad';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('block')|| t.includes('guard')  || t.includes('shield')) return 'block';
    return t || 'good';
  }

  // small rate-limit to avoid flicker storms on mobile
  let lastPing = 0;
  function ping(kind){
    const t = performance.now();
    if (t - lastPing < 70) return;
    lastPing = t;
    const P = particles();
    if (P?.screenPing) P.screenPing(kind, 140);
  }

  function fxPop(x,y,text,cls,opts){
    const P = particles();
    if (P?.popText) P.popText(x,y,text,cls,opts);
  }
  function fxBurst(x,y,kind,opts){
    const P = particles();
    if (P?.burstAt) P.burstAt(x,y,kind,opts);
  }
  function fxRing(x,y,kind,opts){
    const P = particles();
    if (P?.ringPulse) P.ringPulse(x,y,kind,opts);
  }
  function fxCelebrate(kind,opts){
    const P = particles();
    if (P?.celebrate) P.celebrate(kind,opts);
  }

  // ---------- state tracking (storm/boss/rage) ----------
  const S = {
    stormOn:false,
    bossOn:false,
    rageOn:false,
    lastTimeSec: null,
    lastMiss: 0,
    bossHp: null,
    bossHpMax: null,
    bossPhase: 1,
    bossPhase2Sec: 6,
  };

  function applyStorm(on, detail){
    if(!!on === !!S.stormOn) return;
    S.stormOn = !!on;
    if (S.stormOn){
      addBodyCls('fx-storm', 1200);
      addBodyCls('fx-storm-wobble', 460);
      setStatus('⚡ STORM!', 720);
      ping('warn');
      fxRing(innerWidth/2, innerHeight*0.35, 'star', { size: 200 });
    }else{
      // no heavy cleanup; class is temporary anyway
      setStatus('✅ Storm Clear', 520);
    }
  }

  function applyBoss(on, detail){
    if(!!on === !!S.bossOn) return;
    S.bossOn = !!on;

    if(S.bossOn){
      addBodyCls('fx-boss', 1300);
      setStatus('👹 BOSS!', 760);
      ping('bad');
      fxRing(innerWidth/2, innerHeight*0.35, 'violet', { size: 240 });

      // accept hp profile from detail if provided
      if(detail){
        const hp = num(detail.hp);
        const hpMax = num(detail.hpMax);
        if(hp!=null) S.bossHp = hp;
        if(hpMax!=null) S.bossHpMax = hpMax;
        const ph = num(detail.phase);
        if(ph!=null) S.bossPhase = ph;
        const p2 = num(detail.phase2Sec);
        if(p2!=null) S.bossPhase2Sec = clamp(p2, 3, 12);
      }
    }else{
      setStatus('✅ Boss Down', 700);
      fxCelebrate('win', { count: 18 });
    }
  }

  function applyRage(on){
    if(!!on === !!S.rageOn) return;
    S.rageOn = !!on;
    if(S.rageOn){
      addBodyCls('fx-rage', 1600);
      addBodyCls('fx-rage-pulse', 560);
      setStatus('🔥 RAGE!', 800);
      ping('bad');
      fxRing(innerWidth/2, innerHeight*0.35, 'bad', { size: 260 });
    }else{
      setStatus('Rage off', 520);
    }
  }

  // ---------- core event handlers ----------
  function onJudge(detail){
    const d = detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    const combo = Number(d.combo || d.comboNow || d.comboCount || 0);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 170);
      addBodyCls('fx-kick', 110);
      ping('good');
      fxRing(x,y,'good',{ size: 120 });
      fxBurst(x,y,'good',{ scale: combo>=6 ? 1.25 : 1.0 });
      if (combo >= 8) fxPop(x,y,'COMBO!','cyan',{ size: 18 });

    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 200);
      addBodyCls('fx-kick', 110);
      ping('good');
      fxRing(x,y,'shield',{ size: 160 });
      fxBurst(x,y,'shield',{ scale: 1.3 });
      fxPop(x,y,'PERFECT!','violet',{ size: 22 });
      fxCelebrate('perfect',{ count: 14 });

    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 230);
      addBodyCls('fx-kick', 110);
      ping('bad');
      fxRing(x,y,'bad',{ size: 150 });
      fxBurst(x,y,'bad',{ scale: 1.15 });

    } else if (t === 'miss'){
      addBodyCls('fx-miss', 230);
      ping('bad');
      fxRing(x,y,'bad',{ size: 170 });
      fxPop(x,y,'MISS','bad',{ size: 18 });

    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 150);
      ping('good');
      fxRing(x,y,'shield',{ size: 140 });
      fxPop(x,y,'BLOCK','cyan',{ size: 16 });

    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y,'good',{});
    }

    // optional label (if game sends)
    if (d.label && typeof d.label === 'string' && d.label.length <= 18){
      // keep light
      fxPop(x, y-22, d.label, 'warn', { size: 14 });
    }
  }

  function onScore(detail){
    const d = detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.delta ?? d.add ?? d.value ?? d.score ?? 0);

    if (!Number.isFinite(sc) || sc === 0) return;
    // positive score pop
    const txt = sc > 0 ? `+${Math.round(sc)}` : `${Math.round(sc)}`;
    fxPop(x, y, txt, sc>0 ? 'good' : 'bad', { size: Math.abs(sc) >= 50 ? 22 : 16 });
  }

  function onMiss(detail){
    const d = detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 240);
    ping('bad');
    fxRing(x,y,'bad',{ size: 180 });
  }

  function onTime(detail){
    const d = detail || {};
    const t = num(d.t ?? d.timeLeftSec ?? d.sec);
    if(t==null) return;

    S.lastTimeSec = t;

    // ✅ GoodJunk rule: <= 30s -> storm start (only once)
    if(t <= 30 && !S.stormOn){
      applyStorm(true, { phase: 1, intensity: 1 });
      // also emit a canonical storm event for games that want it
      try{ ROOT.dispatchEvent(new CustomEvent('hha:storm',{ detail:{ on:true, t } })); }catch(_){}
      try{ DOC.dispatchEvent(new CustomEvent('hha:storm',{ detail:{ on:true, t } })); }catch(_){}
    }

    // tighten tension at 10..1 (light ping)
    if(t <= 10 && t > 0){
      // do not spam; only for integers
      const ti = Math.ceil(t);
      if (Math.abs(t - ti) < 0.03){
        fxPop(innerWidth/2, innerHeight*0.22, `${ti}`, 'warn', { size: 18 });
      }
    }
  }

  function onBoss(detail){
    // direct boss event from game (preferred)
    const d = detail || {};
    applyBoss(!!d.on, d);
    if (d.rage != null) applyRage(!!d.rage);

    // if hp provided, show micro status
    const hp = num(d.hp);
    const mx = num(d.hpMax);
    const ph = num(d.phase);
    if(hp!=null && mx!=null){
      S.bossHp = hp; S.bossHpMax = mx;
      if(ph!=null) S.bossPhase = ph;
      setStatus(`👹 BOSS HP ${hp}/${mx} (P${S.bossPhase})`, 620);
    }
  }

  function onStorm(detail){
    const d = detail || {};
    applyStorm(!!d.on, d);
  }

  function onEnd(detail){
    addBodyCls('fx-endblink', 760);
    fxCelebrate('win',{ count: 18 });
    const grade = detail?.grade ? String(detail.grade) : '';
    if(grade) fxPop(innerWidth/2, innerHeight*0.28, `GRADE ${grade}`, 'good', { size: 22 });
  }

  function onCelebrate(detail){
    const k = (detail?.kind || 'win').toString().toLowerCase();
    fxCelebrate(k, { count: k==='boss' ? 26 : 18 });
  }

  // ---------- auto boss/rage triggers (fallback for games that only emit miss) ----------
  // If game doesn't emit hha:boss, we can still infer from miss count if provided.
  function onScoreOrJudgeForMissInference(detail){
    const d = detail || {};
    const miss = num(d.miss ?? d.misses ?? d.missNow ?? d.missCount ?? d.totalMiss);
    if(miss==null) return;

    S.lastMiss = miss;

    // ✅ GoodJunk rule: miss >= 4 => boss, miss >= 5 => rage
    if(miss >= 4 && !S.bossOn){
      applyBoss(true, { hpMax: 10, hp: 10, phase: 1, phase2Sec: 6 });
      try{ ROOT.dispatchEvent(new CustomEvent('hha:boss',{ detail:{ on:true, hpMax:10, hp:10, phase:1, phase2Sec:6 } })); }catch(_){}
    }
    if(miss >= 5 && !S.rageOn){
      applyRage(true);
      try{ ROOT.dispatchEvent(new CustomEvent('hha:boss',{ detail:{ on:true, rage:true } })); }catch(_){}
    }
  }

  // ---------- robust add listeners on both targets ----------
  function listen(target, name, fn){
    try{ target.addEventListener(name, (e)=> fn(e?.detail || {}), { passive:true }); }catch(_){}
  }

  const targets = [ROOT, DOC];
  for(const T of targets){
    listen(T, 'hha:judge', (d)=>{ onJudge(d); onScoreOrJudgeForMissInference(d); });
    listen(T, 'hha:score', (d)=>{ onScore(d); onScoreOrJudgeForMissInference(d); });
    listen(T, 'hha:miss',  onMiss);
    listen(T, 'hha:time',  onTime);
    listen(T, 'hha:storm', onStorm);
    listen(T, 'hha:boss',  onBoss);
    listen(T, 'hha:end',   onEnd);
    listen(T, 'hha:celebrate', onCelebrate);
  }

  // ---------- dev probe ----------
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:8, label:'GOOD!' } }));
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+80, y:y-10 } })), 120);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20, label:'OOPS' } })), 260);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:time',{ detail:{ t:29 } })), 420); // storm
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:boss',{ detail:{ on:true, hpMax:12, hp:12, phase:1, phase2Sec:6 } })), 620);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:boss',{ detail:{ on:true, rage:true } })), 820);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:end',{ detail:{ grade:'A', reason:'timeup' } })), 1200);
  };

})();