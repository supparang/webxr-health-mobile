// Rhythm — Theme Runtime + Sky Swap + Tutorial + Notes Spawn (ย่อให้กระชับ ใช้งานได้จริง)
(function(){
  const root = document.getElementById('root');
  const hud  = document.getElementById('hud');
  const skyEl= document.getElementById('sky');
  const btnStart = document.getElementById('btnStart');
  const btnReset = document.getElementById('btnReset');
  const statusEl = document.getElementById('status');

  // ---------- Theme ----------
  function getThemeName(){
    return (window.__OVERRIDE_THEME ||
            new URLSearchParams(location.search).get('theme') ||
            'city').toLowerCase();
  }
  function themeSkyId(name){ return name==='jungle'?'#bg-jungle' : (name==='space' ? '#bg-space' : '#bg-city'); }
  function swapSky(name){
    try{ if(skyEl){ skyEl.setAttribute('src', themeSkyId(name)); skyEl.setAttribute('color', name==='space' ? '#050914' : '#0b1220'); } }
    catch(e){ console.warn('swapSky rhythm', e); }
  }

  // ---------- State ----------
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, combo=0, best=0, fever=false, feverEnd=0, inFinisher=false;
  let tutorial=true, tutEndAt=10, THEME='city';

  const notes=[]; // {el,lane,t,judged,dodge}
  const laneX=i=>[-0.9,0,0.9][i];
  const duration=60; const bpm=108; const beatSec=60/bpm;
  const START_OFFSET=1.6;
  const HIT_P=0.055, HIT_G=0.11;

  let nextNoteIdx=0, flatNotes=[];

  // ---------- Audio ----------
  let actx=null, master=null, ambGain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.18; master.connect(actx.destination);
    ambGain=actx.createGain(); ambGain.gain.value=0.08; ambGain.connect(actx.destination); ambient(); }
  function tick(f=880,d=0.05,g=0.18){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type='square'; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  function ambient(){
    const motif = THEME==='jungle'?[220,277,330,392]: THEME==='space'?[190,226,285,340]: [240,300,360,420];
    let s=0; (function loopAmb(){
      if(!running) return;
      const t=actx.currentTime;
      for(let i=0;i<4;i++){
        const o=actx.createOscillator(), g=actx.createGain();
        o.type = THEME==='space'?'triangle': (THEME==='jungle'?'sine':'square');
        o.frequency.value = motif[(i+s)%motif.length]; o.connect(g); g.connect(ambGain);
        const tt=t+i*0.26; g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(0.07,tt+0.01); g.gain.linearRampToValueAtTime(0,tt+0.18);
        o.start(tt); o.stop(tt+0.2);
      }
      s++; setTimeout(loopAmb, 900);
    })();
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---------- Particles ----------
  const pPool=[]; let pIdx=0; const MAXP=56;
  function initParticles(){ for(let i=0;i<MAXP;i++){ const e=document.createElement('a-entity');
    e.setAttribute('geometry','primitive:sphere; radius:0.02'); e.setAttribute('material','color:#7dfcc6; shader:flat; opacity:0.95');
    e.setAttribute('visible','false'); root.appendChild(e); pPool.push({el:e,life:0,vx:0,vy:0,vz:0}); } }
  function spark(x,y,z,c='#7dfcc6'){ const n=6; for(let i=0;i<n;i++){ const p=pPool[pIdx++%MAXP];
    p.el.setAttribute('material',`color:${c}; shader:flat; opacity:0.95`); p.el.object3D.position.set(x,y,z); p.el.setAttribute('visible','true');
    p.life=0.3+Math.random()*0.18; p.vx=(Math.random()*0.6-0.3); p.vy=(Math.random()*0.6); p.vz=(-0.4-Math.random()*0.6); } }
  function stepParticles(dt){ for(const p of pPool){ if(!p||p.life<=0) continue; p.life-=dt;
    if(p.life<=0){ p.el.setAttribute('visible','false'); continue; }
    const o=p.el.object3D.position; o.x+=p.vx*dt; o.y+=p.vy*dt; o.z+=p.vz*dt; p.vy-=dt*0.8; } }

  // ---------- UI ----------
  function laneColors(){
    if(THEME==='space') return ['#7c3aed','#334155','#06b6d4'];
    if(THEME==='jungle') return ['#14532d','#334155','#166534'];
    return ['#0ea5e9','#334155','#22c55e'];
  }
  function buildLaneUI(){
    [...root.children].forEach(k=>k.remove()); root.__laneUI=false;
    const lanes=laneColors();
    [-0.9,0,0.9].forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive:plane; width:0.98; height:1.35');
      bg.setAttribute('material',`color:${lanes[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`); root.appendChild(bg);
      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['L(A/←)','C(S/↑)','R(D/→)'][i]}; width:2.2; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`); root.appendChild(tag);
      const pad=document.createElement('a-entity');
      pad.setAttribute('geometry','primitive:plane; width:0.95; height:0.55');
      pad.setAttribute('material','color:#0f172a; opacity:0.95; shader:flat');
      pad.setAttribute('position',`${x} -0.55 0.06`);
      const t=document.createElement('a-entity'); t.setAttribute('text',`value:${['L','C','R'][i]}; width:3; align:center; color:#93c5fd`);
      t.setAttribute('position','0 0 0.01'); pad.appendChild(t);
      pad.addEventListener('click',()=>judge(i)); root.appendChild(pad);
    });
    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive:ring; radiusInner:0.07; radiusOuter:0.09; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to:1.07 1.07 1; dir:alternate; dur:480; loop:true');
    root.appendChild(hit);
  }
  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    const fin = inFinisher ? ' • FINISHER x2' : '';
    hud.setAttribute('text',`value:[${THEME.toUpperCase()}] Score ${score} • Combo ${combo} (Best ${best})${f}${fin}\nให้โน้ตถึงวงฟ้าแล้วกดเลนให้ตรง (A/S/D หรือ L/C/R)\n${msg||''}; width:5.9; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#93c5fd",y=1.05,ms=520){
    const e=document.createElement('a-entity');
    e.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    e.setAttribute('position',`0 ${y} 0.05`); root.appendChild(e);
    e.setAttribute('animation__up','property: position; to: 0 1.25 0.05; dur:360; easing:easeOutQuad');
    setTimeout(()=>e.remove(),ms);
  }

  // ---------- Beatmap (เดโม: สร้างโน้ตจาก BPM)
  function buildFlatNotes(){
    const arr=[]; let t=START_OFFSET+0.8; let beat=0;
    // Tutorial 8 beats: กลาง-ซ้าย-ขวา สลับ + dodge ปน
    for(let i=0;i<8;i++){ const lane = i%3; arr.push({lane, t:t + i*beatSec*0.9, dodge:false}); }
    t += 8*beatSec*0.9;
    // Main: 32 notes ปน dodge
    for(let i=0;i<32;i++){
      const lane=(Math.random()*3|0); const isDodge = Math.random()<0.2;
      arr.push({lane, t:t + i*beatSec*0.8, dodge:isDodge});
    }
    flatNotes=arr.sort((a,b)=>a.t-b.t); nextNoteIdx=0;
  }

  // ---------- Spawn / movement ----------
  function spawn(it){
    let geom, mat;
    if(it.dodge){ geom='ring; radiusInner:0.06; radiusOuter:0.18'; mat='color:#ef4444; shader:flat; opacity:0.98'; }
    else { geom='circle; radius:0.16'; mat='color:hsl(200,70%,70%); shader:flat; opacity:0.98'; }
    const n=document.createElement('a-entity');
    n.classList.add('note'); n.setAttribute('geometry','primitive:'+geom); n.setAttribute('material',mat);
    n.object3D.position.set(laneX(it.lane),0,3.0); root.appendChild(n);
    notes.push({el:n, lane:it.lane, t:it.t, judged:false, dodge:it.dodge});
  }

  function judge(lane){
    ensureAudio();
    let best=null, bestErr=9;
    for(const it of notes){
      if(it.judged || it.lane!==lane) continue;
      const err=Math.abs(it.t - elapsed); if(err<bestErr){ best=it; bestErr=err; }
    }
    if(!best){ combo=0; toast('Miss','#fecaca'); return; }
    if(best.dodge && bestErr<=HIT_G){ combo=0; toast('Dodge Fail','#fecaca'); tick(300,0.05,0.18); best.judged=true; best.el.setAttribute('visible','false'); return; }

    if(bestErr>HIT_G){ combo=0; toast('Miss','#fecaca'); return; }
    best.judged=true; best.el.setAttribute('visible','false');
    const perfect = bestErr<=HIT_P;
    score += perfect?300:160; combo++; best=Math.max(best,combo);
    spark(laneX(lane),0,0.06, perfect?'#7dfcc6':'#a7f3d0'); tick(perfect?1000:820,0.05, perfect?0.2:0.16);
    toast(perfect?'Perfect +300':'Good +160', perfect?'#7dfcc6':'#a7f3d0');
    if(!fever && combo>0 && combo%8===0){ fever=true; feverEnd=elapsed+6; toast('FEVER! ✨','#7dfcc6'); }
  }

  // ---------- Loop ----------
  function loop(){
    if(!running) return;
    const now=performance.now()/1000; const prev=elapsed; const dt=(elapsed=now-t0)-prev;

    const lead = tutorial?1.8:1.2;
    while(nextNoteIdx<flatNotes.length && flatNotes[nextNoteIdx].t <= elapsed + lead){
      spawn(flatNotes[nextNoteIdx]); nextNoteIdx++;
    }

    const speedZ = (tutorial?1.4:1.65) + (fever?0.12:0) + (inFinisher?0.10:0);
    for(const it of notes){
      if(it.judged) continue;
      const dtz = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dtz*speedZ);
      if(dtz < -0.22 && !it.judged){
        if(it.dodge){ score += 80; toast('Dodge OK +80','#93c5fd',1.0,420); }
        else { combo=0; toast('Miss','#fecaca'); }
        it.judged=true; it.el.setAttribute('visible','false');
      }
    }

    if(fever && elapsed>=feverEnd) fever=false;
    stepParticles(Math.max(0,dt));
    if(tutorial && elapsed>=tutEndAt){ tutorial=false; }
    if(elapsed>=duration) return end('Stage Clear');
    setHUD(); raf=requestAnimationFrame(loop);
  }

  // ---------- Flow ----------
  function start(){
    THEME = getThemeName(); swapSky(THEME);
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; combo=0; best=0; fever=false; feverEnd=0; inFinisher=false;
    notes.splice(0).forEach(n=>n.el?.remove());
    buildLaneUI(); initParticles(); buildFlatNotes();
    setHUD('Tutorial: ดูจังหวะช้า ๆ ก่อน'); tick(660,0.05,0.18); setTimeout(()=>tick(700,0.05,0.18),200);
    setTimeout(()=>tick(700,0.05,0.18),600); setTimeout(()=>tick(700,0.05,0.18),1000); setTimeout(()=>tick(900,0.06,0.22),1400);
    raf=requestAnimationFrame(loop);
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); setHUD(`${msg} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); notes.splice(0).forEach(n=>n.el?.remove());
    root.__laneUI=false; [...root.children].forEach(k=>k.remove()); setTimeout(()=>{ buildLaneUI(); setHUD('พร้อมเริ่ม'); },0); }

  // ---------- Bind ----------
  function bind(){
    btnStart.onclick=()=>{ ensureAudio(); if(!running) start(); };
    btnReset.onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') judge(0);
      if(k==='s'||k==='arrowup')   judge(1);
      if(k==='d'||k==='arrowright')judge(2);
    });
    statusEl && (statusEl.textContent='พร้อมเริ่ม • เลือกธีมแล้วกด Start');
  }
  const scene=document.querySelector('a-scene');
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
