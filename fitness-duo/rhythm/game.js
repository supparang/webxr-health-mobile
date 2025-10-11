// Rhythm — Beat Boxer (Day 3–4: Tutorial Auto, Legend, Section Banners, Count-in)
(function(){
  const CFG = window.RHYTHM_CFG || {};
  const MAP = window.RHYTHM_BEATMAP || {bpm:(CFG.bpm||108), bars:[]};

  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const statusEl=document.getElementById('status');

  // --------- State ----------
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, combo=0, best=0, fever=false, feverEnd=0, feverCount=0;
  let tutorial=true, tutEndAt=0;         // NEW
  const notes=[];                         // {el,lane,t,hold,judged}
  const laneX=i=>[-0.9,0,0.9][i];
  const bpm = MAP.bpm || CFG.bpm || 108;
  const duration = CFG.duration || 60;
  const beatSec = 60 / bpm;
  const hitPerfect = (CFG.hitWindowMs?.perfect ?? 55) / 1000;
  const hitGood = (CFG.hitWindowMs?.good ?? 110) / 1000;
  let nextNoteIdx=0, flatNotes=[];

  // --------- Audio ----------
  let actx=null, master=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination); }
  function tick(f=880,d=0.05,g=0.18){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type='square'; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // --------- Legend ----------
  let legend=null;
  function ensureLegend(){
    if(legend) return;
    legend=document.createElement('a-entity');
    legend.setAttribute('position','-1.6 1.1 -2.8');
    legend.setAttribute('text','value:Legend:\nPerfect +300 • Good +160\nL(A/←) • C(S/↑) • R(D/→); width:3.6; align:left; color:#9fb1d1');
    root.appendChild(legend);
  }

  // --------- Section Banner ----------
  let banner=null, bannerTO=0;
  function showBanner(txt,color="#93c5fd",ms=1200){
    hideBanner();
    banner=document.createElement('a-entity');
    banner.setAttribute('geometry','primitive: plane; width: 2.4; height: 0.48');
    banner.setAttribute('material','color:#0b1220; opacity:0.92; shader:flat');
    banner.setAttribute('position','0 1.2 0.06');
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:4.6; align:center; color:${color}`);
    t.setAttribute('position','0 0 0.01'); banner.appendChild(t);
    root.appendChild(banner); tick(880,0.06,0.22);
    bannerTO=setTimeout(hideBanner,ms);
  }
  function hideBanner(){ if(banner){ banner.remove(); banner=null; } if(bannerTO){ clearTimeout(bannerTO); bannerTO=0; } }

  // --------- UI ----------
  function buildLaneUI(){
    if(root.__laneUI) return; root.__laneUI=true;
    const colors=['#0ea5e9','#334155','#22c55e'];
    [-0.9,0,0.9].forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:0.98; height:1.35');
      bg.setAttribute('material',`color:${colors[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`); root.appendChild(bg);

      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['L(A/←)','C(S/↑)','R(D/→)'][i]}; width:2.2; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`); root.appendChild(tag);

      const pad=document.createElement('a-entity');
      pad.setAttribute('geometry','primitive: plane; width:0.95; height:0.55');
      pad.setAttribute('material','color:#0f172a; opacity:0.95; shader:flat');
      pad.setAttribute('position',`${x} -0.55 0.06`);
      const t=document.createElement('a-entity'); t.setAttribute('text',`value:${['L','C','R'][i]}; width:3; align:center; color:#93c5fd`);
      t.setAttribute('position','0 0 0.01'); pad.appendChild(t);
      pad.addEventListener('click',()=>judge(i)); root.appendChild(pad);
    });
    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.07; radiusOuter:0.09; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to: 1.07 1.07 1; dir: alternate; dur: 480; loop: true');
    root.appendChild(hit);
  }
  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    hud.setAttribute('text',`value:Score ${score} • Combo ${combo} (Best ${best})${f}\nให้โน้ตถึงวงฟ้าแล้วกดเลนให้ตรง (A/S/D หรือ L/C/R)\n${msg||''}; width:5.8; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#93c5fd",y=1.05,ms=520){
    const e=document.createElement('a-entity');
    e.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    e.setAttribute('position',`0 ${y} 0.05`); root.appendChild(e);
    e.setAttribute('animation__up','property: position; to: 0 1.25 0.05; dur:360; easing:easeOutQuad');
    setTimeout(()=>e.remove(),ms);
  }

  // --------- Map Flatten ----------
  function buildFlatNotes(){
    const bars = MAP.bars||[];
    const arr=[];
    for(const bar of bars){ for(const n of (bar.notes||[])){ arr.push({lane:n.lane, t:n.t, hold:n.hold||0}); } }
    arr.sort((a,b)=>a.t-b.t); flatNotes=arr; nextNoteIdx=0;
  }

  // --------- Spawn ----------
  function spawn(it){
    const shape = (it.hold>0) ? 'box; width:0.34; height:0.34; depth:0.04' : 'circle; radius:0.16';
    const n=document.createElement('a-entity');
    n.classList.add('note'); n.setAttribute('geometry','primitive: '+shape);
    n.setAttribute('material','color:hsl(200,70%,70%); shader:flat; opacity:0.98');
    n.object3D.position.set(laneX(it.lane),0,3.0);
    root.appendChild(n);
    notes.push({el:n, lane:it.lane, t:it.t, hold:it.hold, judged:false});
  }

  // --------- Scoring ----------
  function addScore(n){ score += fever ? Math.round(n*1.5) : n; }
  function enterFever(){ fever=true; feverEnd=elapsed+(CFG.feverSecs||6); feverCount++; showBanner('FEVER! ✨','#7dfcc6',900); }
  function updateFever(){ if(fever && elapsed>=feverEnd){ fever=false; showBanner('Fever End','#cbd5e1',800); } }

  function judge(lane){
    let bestIt=null, bestErr=9;
    for(const it of notes){ if(it.judged || it.lane!==lane) continue;
      const err=Math.abs(it.t - elapsed); if(err<bestErr){ bestErr=err; bestIt=it; } }
    if(!bestIt || bestErr>hitGood){ combo=0; toast('Miss','#fecaca'); return; }
    bestIt.judged=true; bestIt.el.setAttribute('visible','false');
    if(bestErr<=hitPerfect){ addScore(300); combo++; toast('Perfect +300','#7dfcc6'); tick(1000,0.05,0.2); }
    else { addScore(160); combo++; toast('Good +160','#a7f3d0'); tick(820,0.05,0.16); }
    best=Math.max(best,combo);
    if(!fever && combo>0 && combo%(CFG.feverEveryCombo||8)===0) enterFever();
  }

  // --------- Section banners on every 8 beats ----------
  let nextSectionBeat=0;
  function sectionBannerIfNeeded(){
    const sec = CFG.sectionBeats || 8;
    const curBeat = Math.floor(elapsed/beatSec);
    if(curBeat >= nextSectionBeat && curBeat % sec === 0){
      showBanner('Section Change','#93c5fd',900);
      nextSectionBeat = curBeat + sec;
    }
  }

  // --------- Flow ----------
  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;

    // Tutorial phase: spawnแถว L-C-R ช้า ๆ
    if(tutorial){
      while(nextNoteIdx<flatNotes.length && flatNotes[nextNoteIdx].t <= (elapsed+1.2)){
        spawn(flatNotes[nextNoteIdx]); nextNoteIdx++;
      }
    }else{
      while(nextNoteIdx<flatNotes.length && flatNotes[nextNoteIdx].t <= (elapsed+1.0)){
        spawn(flatNotes[nextNoteIdx]); nextNoteIdx++;
      }
    }

    const speedZ = (tutorial?1.4:1.65) + (fever?0.12:0);
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dt*speedZ);
      if(dt<-0.22 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); combo=0; toast('Miss','#fecaca'); }
    }

    updateFever();
    if(!tutorial) sectionBannerIfNeeded();

    if(tutorial && elapsed>=tutEndAt){
      tutorial=false; showBanner('เริ่มจริงแล้ว!','#cbd5e1',900);
    }

    if(elapsed>=duration) return end('Stage Clear');
    setHUD(); raf=requestAnimationFrame(loop);
  }

  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; combo=0; best=0; fever=false; feverEnd=0; feverCount=0;
    notes.splice(0).forEach(n=>n.el?.remove());
    buildLaneUI(); ensureLegend(); buildFlatNotes();
    tutorial=true; tutEndAt=10; nextSectionBeat=0;
    setHUD('Tutorial: ดูจังหวะช้า ๆ ก่อน'); tick(660,0.05,0.18);
    // Count-in 1-2-3-4
    setTimeout(()=>tick(700,0.05,0.18),200);
    setTimeout(()=>tick(700,0.05,0.18),600);
    setTimeout(()=>tick(700,0.05,0.18),1000);
    setTimeout(()=>tick(900,0.06,0.22),1400);
    loop();
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); hideBanner(); setHUD(`${msg} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); hideBanner(); notes.splice(0).forEach(n=>n.el?.remove()); setHUD('พร้อมเริ่ม'); }

  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') judge(0);
      if(k==='s'||k==='arrowup')   judge(1);
      if(k==='d'||k==='arrowright')judge(2);
    });
    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  const scene=document.querySelector('a-scene');
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
