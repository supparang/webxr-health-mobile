// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (FIXED)
// ✅ Listens on BOTH window + document (important!)
// ✅ Reacts to: hha:judge, hha:score, hha:miss, hha:celebrate, hha:end
// ✅ Extra: hha:storm / hha:boss / hha:rage (GoodJunk triggers)
// Requires: ../vr/particles.js (PRODUCTION recommended)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // --- inject css + vignette ---
  (function(){
    const id='hha-fx-director-style';
    if(DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id=id;
    st.textContent=`
      .hha-fx-vignette{position:fixed;inset:-20px;pointer-events:none;z-index:9997;opacity:0;transition:opacity 160ms ease;}
      .hha-fx-vignette::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.34) 74%, rgba(0,0,0,.62) 100%);}
      body.fx-hit-good .hha-fx-vignette{opacity:.22;}
      body.fx-hit-bad  .hha-fx-vignette{opacity:.40;}
      body.fx-miss     .hha-fx-vignette{opacity:.36;}

      body.fx-kick{animation:hhaKick 120ms ease;}
      @keyframes hhaKick{0%{transform:translate3d(0,0,0)}40%{transform:translate3d(.9px,-.9px,0)}100%{transform:translate3d(0,0,0)}}

      body.fx-endblink{animation:hhaEndBlink 760ms ease;}
      @keyframes hhaEndBlink{0%{filter:none}30%{filter:brightness(1.15) contrast(1.06)}100%{filter:none}}

      /* extra intensity */
      body.fx-storm{animation:hhaStormPulse 900ms ease-in-out infinite;}
      @keyframes hhaStormPulse{0%,100%{filter:contrast(1)}50%{filter:contrast(1.06)}}

      body.fx-boss{animation:hhaBossThrob 520ms ease-in-out infinite;}
      @keyframes hhaBossThrob{0%,100%{filter:brightness(1)}50%{filter:brightness(1.08)}}

      body.fx-rage{animation:hhaRageShake 240ms linear infinite;}
      @keyframes hhaRageShake{
        0%{transform:translate3d(0,0,0)}
        25%{transform:translate3d(0.8px,-0.8px,0)}
        50%{transform:translate3d(-0.8px,0.6px,0)}
        75%{transform:translate3d(0.6px,0.8px,0)}
        100%{transform:translate3d(0,0,0)}
      }
    `;
    DOC.head.appendChild(st);
    const vg=DOC.createElement('div');
    vg.className='hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  function addBodyCls(c,ms){
    try{
      DOC.body.classList.add(c);
      if(ms) setTimeout(()=>DOC.body.classList.remove(c), ms);
    }catch(_){}
  }

  function num(v){ v=Number(v); return Number.isFinite(v)?v:null; }
  function pickXY(d){
    const x = num(d?.x) ?? num(d?.px) ?? num(d?.clientX) ?? (innerWidth/2);
    const y = num(d?.y) ?? num(d?.py) ?? num(d?.clientY) ?? (innerHeight/2);
    return {x,y};
  }
  function pickType(d){
    const t = String(d?.type||d?.kind||d?.result||d?.judge||d?.hitType||d?.label||'').toLowerCase();
    if(t.includes('perfect')) return 'perfect';
    if(t.includes('good')||t.includes('correct')||t.includes('hitgood')) return 'good';
    if(t.includes('bad')||t.includes('junk')||t.includes('wrong')||t.includes('hitjunk')||t.includes('oops')) return 'bad';
    if(t.includes('miss')||t.includes('expire')) return 'miss';
    if(t.includes('block')||t.includes('guard')||t.includes('shield')) return 'block';
    return t || 'good';
  }
  function P(){ return WIN.Particles || WIN.GAME_MODULES?.Particles || null; }
  function burst(x,y,k){ try{ P()?.burstAt?.(x,y,k); }catch(_){ } }
  function shock(x,y,r){ try{ P()?.shockwave?.(x,y,{r}); }catch(_){ burst(x,y,'good'); } }
  function pop(x,y,txt,cls){ try{ P()?.popText?.(x,y,txt,cls); }catch(_){ } }
  function celebrate(){ try{ P()?.celebrate?.(); }catch(_){ } }

  function onJudge(ev){
    const d = ev?.detail || {};
    const {x,y} = pickXY(d);
    const t = pickType(d);

    if(t==='good'){
      addBodyCls('fx-hit-good',180);
      addBodyCls('fx-kick',120);
      shock(x,y,56);
      const combo = Number(d.combo||d.comboNow||d.comboCount||0);
      if(combo>=5) burst(x,y,'good');
    }else if(t==='perfect'){
      addBodyCls('fx-hit-good',220);
      addBodyCls('fx-kick',120);
      shock(x,y,74);
      pop(x,y,'PERFECT!','perfect');
    }else if(t==='bad'){
      addBodyCls('fx-hit-bad',240);
      addBodyCls('fx-kick',120);
      shock(x,y,66);
      burst(x,y,'bad');
    }else if(t==='miss'){
      addBodyCls('fx-miss',240);
      shock(x,y,70);
    }else if(t==='block'){
      addBodyCls('fx-hit-good',160);
      burst(x,y,'shield');
      pop(x,y,'BLOCK','score');
    }else{
      addBodyCls('fx-hit-good',140);
      burst(x,y,'good');
    }
  }

  function onScore(ev){
    const d = ev?.detail || {};
    const {x,y} = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if(Number.isFinite(sc) && sc !== 0){
      pop(x,y,(sc>0?`+${sc}`:`${sc}`), sc>=50?'big':'score');
    }
  }

  function onMiss(ev){
    const d = ev?.detail || {};
    const {x,y} = pickXY(d);
    addBodyCls('fx-miss',260);
    shock(x,y,78);
    burst(x,y,'bad');
  }

  function onEnd(){
    addBodyCls('fx-endblink',760);
    setTimeout(()=>celebrate(),220);
  }

  function onStorm(){ addBodyCls('fx-storm'); burst(innerWidth/2, innerHeight*0.35, 'star'); shock(innerWidth/2, innerHeight*0.35, 90); }
  function onBoss(){ addBodyCls('fx-boss'); pop(innerWidth/2, innerHeight*0.33, 'BOSS!', 'big'); }
  function onRage(){ addBodyCls('fx-rage'); pop(innerWidth/2, innerHeight*0.33, 'RAGE!', 'big'); }

  function listen(target){
    target.addEventListener('hha:judge', onJudge, {passive:true});
    target.addEventListener('hha:score', onScore, {passive:true});
    target.addEventListener('hha:miss',  onMiss,  {passive:true});
    target.addEventListener('hha:celebrate', ()=>celebrate(), {passive:true});
    target.addEventListener('hha:end',   onEnd,   {passive:true});

    // extra states
    target.addEventListener('hha:storm', onStorm, {passive:true});
    target.addEventListener('hha:boss',  onBoss,  {passive:true});
    target.addEventListener('hha:rage',  onRage,  {passive:true});
  }

  // ✅ IMPORTANT: listen both
  listen(WIN);
  listen(DOC);

  // debug helper
  WIN.HHA_FX_TEST = function(){
    const x=innerWidth/2, y=innerHeight/2;
    WIN.dispatchEvent(new CustomEvent('hha:judge',{detail:{type:'good',x,y,combo:6}}));
    setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:score',{detail:{score:25,x:x+80,y:y-10}})),120);
    setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:judge',{detail:{type:'bad',x:x-80,y:y+10}})),250);
    setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:storm')),420);
    setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:boss')),650);
    setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:rage')),880);
    setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:end')),1150);
  };
})();