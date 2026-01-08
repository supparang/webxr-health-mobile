// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (V2)
// ✅ time<=30 => fx-storm
// ✅ miss>=4  => fx-boss-in (sticky)
// ✅ miss>=5  => fx-rage (sticky)
// ✅ listens: hha:time, hha:miss, hha:judge, hha:score, hha:end, hha:celebrate

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR_V2__) return;
  ROOT.__HHA_FX_DIRECTOR_V2__ = true;

  // ---------- helpers ----------
  const add = (c)=>{ try{ DOC.body.classList.add(c); }catch(_){ } };
  const rem = (c)=>{ try{ DOC.body.classList.remove(c); }catch(_){ } };
  const pulse = (c, ms=220)=>{ add(c); setTimeout(()=>rem(c), ms); };

  function num(v){ v = Number(v); return Number.isFinite(v) ? v : null; }

  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if (x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || d.label || '').toString().toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('bad') || t.includes('junk') || t.includes('oops')) return 'bad';
    if (t.includes('good') || t.includes('correct')) return 'good';
    return 'good';
  }

  function P(){ return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null; }
  function pop(x,y,txt,cls){ try{ P()?.popText?.(x,y,txt,cls); }catch(_){ } }
  function scorePop(x,y,txt){ try{ P()?.scorePop?.(x,y,txt); }catch(_){ } }
  function burst(x,y,kind){ try{ P()?.burstAt?.(x,y,kind); }catch(_){ } }

  // ---------- sticky states (storm/boss/rage) ----------
  const sticky = { storm:false, boss:false, rage:false };
  function setStorm(on){
    if(on && !sticky.storm){ sticky.storm = true; add('fx-storm'); }
    if(!on && sticky.storm){ sticky.storm = false; rem('fx-storm'); }
  }
  function setBoss(on){
    if(on && !sticky.boss){ sticky.boss = true; add('fx-boss-in'); }
    if(!on && sticky.boss){ sticky.boss = false; rem('fx-boss-in'); }
  }
  function setRage(on){
    if(on && !sticky.rage){ sticky.rage = true; add('fx-rage'); }
    if(!on && sticky.rage){ sticky.rage = false; rem('fx-rage'); }
  }

  // ---------- thresholds (HHA Standard) ----------
  const CFG = {
    stormSec: 30,
    bossMiss: 4,
    rageMiss: 5,
  };

  // ---------- listeners ----------
  function onTime(e){
    const d = e?.detail || {};
    // accept: t or timeLeftSec
    const t = num(d.t) ?? num(d.timeLeftSec);
    if(t == null) return;
    setStorm(t <= CFG.stormSec);
  }

  function onMiss(e){
    const d = e?.detail || {};
    // accept: miss or misses
    const m = num(d.miss) ?? num(d.misses);
    if(m == null) return;
    setBoss(m >= CFG.bossMiss);
    setRage(m >= CFG.rageMiss);
    if(m >= CFG.bossMiss) pulse('fx-boss-hit', 220);
  }

  function onJudge(e){
    const d = e?.detail || {};
    const {x,y} = pickXY(d);
    const t = pickType(d);

    if(t === 'good'){
      pulse('fx-block', 0); // no-op safe (keeps style consistent)
      burst(x,y,'good');
      // optional combo text if provided
      const combo = num(d.combo) ?? num(d.comboNow) ?? num(d.comboCount) ?? 0;
      if(combo >= 8) pop(x,y,'🔥 COMBO!', 'combo');
    } else if(t === 'perfect'){
      pulse('fx-block', 0);
      burst(x,y,'good');
      pop(x,y,'PERFECT!', 'perfect');
    } else if(t === 'bad'){
      pulse('fx-boss-hit', 220);
      burst(x,y,'bad');
    } else if(t === 'miss'){
      pulse('fx-boss-hit', 200);
      burst(x,y,'bad');
      pop(x,y,'MISS', 'miss');
    } else if(t === 'block'){
      pulse('fx-block', 260);
      burst(x,y,'block');
      pop(x,y,'BLOCK!', 'block');
    }
  }

  function onScore(e){
    const d = e?.detail || {};
    const {x,y} = pickXY(d);
    const sc = num(d.delta) ?? num(d.add) ?? num(d.score) ?? 0;
    if(sc) scorePop(x, y, sc>0?`+${sc}`:`${sc}`);
  }

  function onEnd(){
    // end: clear sticky to avoid carry-over if user reloads inside SPA container
    setStorm(false); setBoss(false); setRage(false);
    pulse('fx-boss-down', 650);
    try{ ROOT.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ kind:'end' } })); }catch(_){}
  }

  DOC.addEventListener('hha:time', onTime, { passive:true });
  DOC.addEventListener('hha:miss', onMiss, { passive:true });
  DOC.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:score', onScore, { passive:true });
  DOC.addEventListener('hha:end', onEnd, { passive:true });

  // also listen on window (บางเกม emit ที่ window)
  ROOT.addEventListener('hha:time', onTime, { passive:true });
  ROOT.addEventListener('hha:miss', onMiss, { passive:true });
  ROOT.addEventListener('hha:judge', onJudge, { passive:true });
  ROOT.addEventListener('hha:score', onScore, { passive:true });
  ROOT.addEventListener('hha:end', onEnd, { passive:true });

  // dev probe
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    ROOT.dispatchEvent(new CustomEvent('hha:time', { detail:{ t: 29 }}));
    ROOT.dispatchEvent(new CustomEvent('hha:miss', { detail:{ miss: 4 }}));
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:9 } }));
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:miss', { detail:{ miss: 5 }})), 260);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:end', { detail:{} })), 680);
  };

})();