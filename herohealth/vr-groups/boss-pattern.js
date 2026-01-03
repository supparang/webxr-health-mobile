// === /herohealth/vr-groups/boss-pattern.js ===
// PACK 64: Boss Pattern Lock (ring/wave) + Tell overlay
// - When boss spawns -> lock pattern for 2.8s: ring or wave (seeded-ish via seed string)
// - Research: keep visual tell only (no spawn pressure)
// Requires: groups.safe.js emits groups:progress {kind:'boss_spawn'} and boss_phase events

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (performance.now?performance.now():Date.now()); }

  // tiny seed -> rng
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h>>>0;
  }
  function makeRng(u32){
    let s=(u32>>>0)||1;
    return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296);
  }

  // tell UI
  function ensureTell(){
    let el = DOC.querySelector('.boss-tell');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'boss-tell';
    el.innerHTML = `<div class="bt-card"><div class="bt-title">👹 BOSS PATTERN</div><div class="bt-sub" id="btSub">—</div></div>`;
    DOC.body.appendChild(el);
    return el;
  }
  function showTell(text, ms){
    const el = ensureTell();
    const sub = el.querySelector('#btSub');
    if (sub) sub.textContent = String(text||'');
    el.classList.add('on');
    setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, ms||1100);
  }

  // pattern state
  const S = {
    on:false,
    until:0,
    mode:'ring',          // ring | wave
    phase:0,
  };

  // expose for engine spawn bias
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.BossPattern = {
    isOn: ()=> S.on && now() < S.until,
    mode: ()=> S.mode,
    // returns preferred spawn coordinate near ring/wave
    // engine may ignore; safe if not used
    suggestXY: (rect)=>{
      if (!S.on) return null;
      rect = rect || {xMin:10,xMax:350,yMin:120,yMax:620,W:360,H:640};
      const cx = rect.W*0.5, cy = rect.H*0.52;
      if (S.mode === 'ring'){
        // ring around center
        const ang = (Math.random()*Math.PI*2);
        const rad = clamp(Math.min(rect.W,rect.H)*0.22, 80, 170);
        return { x: clamp(cx + Math.cos(ang)*rad, rect.xMin, rect.xMax),
                 y: clamp(cy + Math.sin(ang)*rad, rect.yMin, rect.yMax) };
      }
      // wave: horizontal bands
      const t = now()/1000;
      const band = (Math.sin(t*2.3)+1)*0.5; // 0..1
      const y = rect.yMin + band*(rect.yMax-rect.yMin);
      const x = rect.xMin + Math.random()*(rect.xMax-rect.xMin);
      return { x, y };
    }
  };

  // decide mode from seed
  const seed = String(qs('seed','')||'');
  const rng = makeRng(hashSeed(seed+'::bossPattern'));
  function pickMode(){
    const r = rng();
    return (r < 0.52) ? 'ring' : 'wave';
  }

  function arm(mode, ms){
    S.on = true;
    S.mode = mode;
    S.until = now() + (ms||2800);
    DOC.body.classList.add('fx-boss-pattern');
    DOC.body.classList.toggle('boss-ring', mode==='ring');
    DOC.body.classList.toggle('boss-wave', mode==='wave');

    setTimeout(()=>{
      if (now() >= S.until){
        S.on = false;
        DOC.body.classList.remove('fx-boss-pattern','boss-ring','boss-wave');
      }
    }, (ms||2800) + 60);
  }

  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();
    if (kind === 'boss_spawn'){
      const mode = pickMode();
      arm(mode, 2800);
      showTell(mode==='ring' ? 'เล็ง “วงแหวน” รอบกลางจอ!' : 'เล็ง “คลื่น” เป็นแนวนอน!', 1200);
      return;
    }
    if (kind === 'boss_phase'){
      const ph = Number(d.phase||0);
      S.phase = ph;
      if (ph === 1) showTell('PHASE 1: เร็วขึ้นนิดนึง ⚡', 900);
      if (ph === 2) showTell('PHASE 2: ใกล้แตกแล้ว! 💥', 900);
    }
  }, {passive:true});

})();