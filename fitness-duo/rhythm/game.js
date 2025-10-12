// Rhythm — Day6 (อ่านธีม runtime + Visual/Sparks + StartOffset)
(function(){
  const CFG = window.RHYTHM_CFG || {};
  const MAP = window.RHYTHM_BEATMAP || {bpm:(CFG.bpm||108), bars:[]};
  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const statusEl=document.getElementById('status');
  const btnStart=document.getElementById('btnStart');
  const btnReset=document.getElementById('btnReset');

  function getThemeName(){
    return (window.__OVERRIDE_THEME ||
            new URLSearchParams(location.search).get('theme') ||
            'city').toLowerCase();
  }

  // --------- State ----------
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, combo=0, best=0, fever=false, feverEnd=0, feverCount=0, inFinisher=false;
  let tutorial=true, tutEndAt=CFG.tutorialSecs ?? 10, THEME='city';

  const notes=[]; // {el,lane,t,hold,judged,dodge,headHit,tailDue,barEl}
  const laneX=i=>[-0.9,0,0.9][i];

  const bpm = MAP.bpm || CFG.bpm || 108;
  const duration = CFG.duration || 60;
  const beatSec = 60 / bpm;
  const START_OFFSET = (CFG.startOffsetSec ?? 1.6);
  const CALIB_MS = (CFG.calibrationOffsetMs ?? 0);
  const finisherSecs = CFG.finisherSecs || 10;

  let nextNoteIdx=0, flatNotes=[];
  let hitPerfect = (CFG.hitWindowMs?.perfect ?? 55) / 1000;
  let hitGood    = (CFG.hitWindowMs?.good ?? 110) / 1000;

  // --------- Audio / Ambient ----------
  let actx=null, master=null, ambGain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.18; master.connect(actx.destination);
    ambGain=actx.createGain(); ambGain.gain.value=0.08; ambGain.connect(actx.destination);
    ambientLoop();
  }
  function tick(f=880,d=0.05,g=0.18){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type='square'; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  function ambientLoop(){
    const motif = THEME==='jungle'?[220,277,330,392]: THEME==='space'?[190,226,285,340]: [240,300,360,420];
    let s=0; function step(){
      if(!running) return;
      const t=actx.currentTime;
      for(let i=0;i<4;i++){
        const o=actx.createOscillator(), g=actx.createGain();
        o.type = THEME==='space'?'triangle': (THEME==='jungle'?'sine':'square');
        o.frequency.value = motif[(i+s)%motif.length]; o.connect(g); g.connect(ambGain);
        const tt=t+i*0.26; g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(0.07,tt+0.01); g.gain.linearRampToValueAtTime(0,tt+0.18);
        o.start(tt); o.stop(tt+0.2);
      }
      s++; setTimeout(step, 900);
    } step();
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // --------- Particles (pool) ----------
  const pPool=[]; let pIdx=0; const MAX_P=56;
  function initParticles(){ for(let i=0;i<MAX_P;i++){ const e=document.createElement('a-entity');
    e.setAttribute('geometry','primitive: sphere; radius:0.02');
    e.setAttribute('material','color:#7dfcc6; shader:flat; opacity:0.95');
    e.setAttribute('visible','false'); root.appendChild(e);
    pPool.push({el:e, life:0, vx:0, vy:0, vz:0}); } }
  function spark(x,y,z,color='#7dfcc6'){
    const n=6; for(let i=0;i<n;i++){
      const p=pPool[pIdx++ % MAX_P]; p.el.setAttribute('material',`color:${color}; shader:flat; opacity:0.95`);
      p.el.object3D.position.set(x,y,z); p.el.setAttribute('visible','true');
      p.life=0.3+Math.random()*0.18; p.vx=(Math.random()*0.6-0.3); p.vy=(Math.random()*0.6); p.vz=(-0.4-Math.random()*0.6);
    }
  }
  function stepParticles(dt){ for(const p of pPool){ if(!p||p.life<=0) continue; p.life-=dt;
    if(p.life<=0){ p.el.setAttribute('visible','false'); continue; }
    const o=p.el.object3D.position; o.x+=p.vx*dt; o.y+=p.vy*dt; o.z+=p.vz*dt; p.vy-=dt*0.8; } }
  function shakeCamera(power=0.02, ms=120){
    const cam=document.querySelector('[camera]'); if(!cam) return;
    const o=cam.object3D.position.clone(); let t=0;
    const id=setInterval(()=>{ t+=16; cam.object3D.position.set(o.x+(Math.random()-0.5)*power, o.y+(Math.random()-0.5)*power, o.z);
      if(t>=ms){ clearInterval(id); cam.object3D.position.copy(o); } },16);
  }

  // --------- Legend/Banner/UI ----------
  let legend=null,banner=null,bannerTO=0;
  function ensureLegend(){
    if(legend) return;
    legend=document.createElement('a-entity');
    legend.setAttribute('position','-1.6 1.1 -2.8');
    legend.setAttribute('text','value:Legend:\nPerfect +300 • Good +160 • Dodge=ห้ามกด\nL(A/←) • C(S/↑) • R(D/→); width:3.6; align:left; color:#9fb1d1');
    root.appendChild(legend);
  }
  function showBanner(txt,color="#93c5fd",ms=1200){
    hideBanner();
    banner=document.createElement('a-entity');
    banner.setAttribute('geometry','primitive: plane; width: 2.6; height: 0.5');
    banner.setAttribute('material','color:#0b1220; opacity:0.92; shader:flat');
    banner.setAttribute('position','0 1.2 0.06');
    const t=document.createElement('a-entity'); t.setAttribute('text',`value:${txt}; width:4.8; align:center; color:${color}`);
    t.setAttribute('position','0 0 0.01'); banner.appendChild(t);
    root.appendChild(banner); tick(880,0.06,0.22); bannerTO=setTimeout(hideBanner,ms);
  }
  function hideBanner(){ if(banner){ banner.remove(); banner=null; } if(bannerTO){ clearTimeout(bannerTO); bannerTO=0; } }

  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    const fin = inFinisher ? ' • FINISHER x'+(CFG.finisherMultiplier||2) : '';
    hud.setAttribute('text',`value:[${THEME.toUpperCase()}] Score ${score} • Combo ${combo} (Best ${best})${f}${fin}\nให้โน้ตถึงวงฟ้าแล้วกดเลนให้ตรง (A/S/D หรือ L/C/R) — Dodge: ห้ามกด\n${msg||''}; width:5.9; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#93c5fd",y=1.05,ms=520){
    const e=document.createElement('a-entity');
    e.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    e.setAttribute('position',`0 ${y} 0.05`); root.appendChild(e);
    e.setAttribute('animation__up','property: position; to: 0 1.25 0.05; dur:360; easing:easeOutQuad');
    setTimeout(()=>e.remove(),ms);
  }

  // --------- Lane UI (สีตามธีม) ----------
  function laneColors(){
    if(THEME==='space') return ['#7c3aed','#334155','#06b6d4'];
    if(THEME==='jungle') return ['#14532d','#334155','#166534'];
    return ['#0ea5e9','#334155','#22c55e']; // city
  }
  function buildLaneUI(){
    const kids=[...root.children]; kids.forEach(k=>k.remove()); root.__laneUI=false;
    if(root.__laneUI) return; root.__laneUI=true;
    const lanes=laneColors();
    [-0.9,0,0.9].forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:0.98; height:1.35');
      bg.setAttribute('material',`color:${lanes[i]}; opacity:0.12; shader:flat`);
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

  // --------- Map flatten (offset/calib) ----------
  function buildFlatNotes(){
    const bars = MAP.bars||[]; const arr=[]; const calS=CALIB_MS/1000;
    for(const bar of bars){ for(const n of (bar.notes||[])){
      const tWorld = (n.t + START_OFFSET + calS);
      arr.push({lane:n.lane, t:tWorld, hold:n.hold||0, dodge: !!n.dodge});
    } }
    arr.sort((a,b)=>a.t-b.t); flatNotes=arr; nextNoteIdx=0;
  }

  // --------- Spawn & movement ----------
  function spawn(it){
    let geom, mat;
    if(it.dodge){ geom='ring; radiusInner:0.06; radiusOuter:0.18'; mat='color:#ef4444; shader:flat; opacity:0.98'; }
    else if(CFG.holdEnable && it.hold>0){ geom='box; width:0.34; height:0.34; depth:0.04'; mat='color:#22c55e; shader:flat; opacity:0.98'; }
    else { geom='circle; radius:0.16'; mat='color:hsl(200,70%,70%); shader:flat; opacity:0.98'; }
    const n=document.createElement('a-entity');
    n.classList.add('note'); n.setAttribute('geometry','primitive: '+geom); n.setAttribute('material',mat);
    n.object3D.position.set(laneX(it.lane),0,3.0); root.appendChild(n);

    let bar=null;
    if(CFG.holdEnable && it.hold>0){
      bar=document.createElement('a-entity');
      bar.setAttribute('geometry','primitive: plane; width:0.36; height:0.06');
      bar.setAttribute('material','color:#1f2937; opacity:0.9; shader:flat');
      bar.setAttribute('position','0 -0.22 0.01');
      const fill=document.createElement('a-entity');
      fill.setAttribute('geometry','primitive: plane; width:0.0; height:0.06');
      fill.setAttribute('material','color:#34d399; opacity:0.95; shader:flat');
      fill.setAttribute('position','-0.18 0 0.01');
      bar.appendChild(fill); n.appendChild(bar); n.__fill=fill; bar.setAttribute('visible','false');
    }

    notes.push({el:n, lane:it.lane, t:it.t, hold:it.hold, judged:false, dodge:it.dodge, headHit:false, tailDue:it.t+(it.hold||0), barEl:bar});
  }

  // --------- Score / Fever / Tighten ----------
  function baseMult(){ return (fever ? 1.5 : 1.0) * (inFinisher ? (CFG.finisherMultiplier||2) : 1.0); }
  function addScore(n){ score += Math.round(n * baseMult()); }
  function enterFever(){ fever=true; feverEnd=elapsed+(CFG.feverSecs||6); feverCount++; showBanner('FEVER! ✨','#7dfcc6',900); }
  function updateFever(){ if(fever && elapsed>=feverEnd){ fever=false; showBanner('Fever End','#cbd5e1',800); } }
  function applyTighten(){ const step = CFG.tightenPer6ComboMs||0; const reduce = Math.floor(combo/6)*step/1000;
    hitPerfect=((CFG.hitWindowMs?.perfect ?? 55)/1000)-reduce*0.5; hitGood=((CFG.hitWindowMs?.good ?? 110)/1000)-reduce;
    hitPerfect=Math.max(0.03,hitPerfect); hitGood=Math.max(0.07,hitGood); }

  // --------- Judge ----------
  function judge(lane){
    ensureAudio();
    let bestIt=null, bestErr=9;
    for(const it of notes){
      if(it.judged || it.lane!==lane) continue;
      if(CFG.holdEnable && it.hold>0 && it.headHit && elapsed < it.tailDue - hitGood) continue;
      const target = (CFG.holdEnable && it.hold>0 && it.headHit) ? it.tailDue : it.t;
      const err=Math.abs(target - elapsed); if(err<bestErr){ bestErr=err; bestIt=it; }
    }
    if(!bestIt){ combo=0; toast('Miss','#fecaca'); return; }

    if(bestIt.dodge){
      if(bestErr<=hitGood){ combo=0; toast('Dodge Fail','#fecaca'); tick(300,0.05,0.18); bestIt.judged=true; bestIt.el.setAttribute('visible','false'); shakeCamera(0.02,100); return; }
      combo=0; toast('Miss','#fecaca'); return;
    }

    if(CFG.holdEnable && bestIt.hold>0){
      if(!bestIt.headHit){
        if(bestErr>hitGood){ combo=0; toast('Miss','#fecaca'); return; }
        bestIt.headHit=true; bestIt.el.setAttribute('material','color:#4ade80; shader:flat; opacity:0.98');
        if(bestIt.barEl) bestIt.barEl.setAttribute('visible','true');
        spark(laneX(lane),0,0.06,'#34d399'); tick(950,0.05,0.2); toast('Hold...','#a7f3d0'); return;
      }else{
        if(bestErr>hitGood){ combo=0; toast('Hold Release Miss','#fecaca'); bestIt.judged=true; bestIt.el.setAttribute('visible','false'); return; }
        bestIt.judged=true; bestIt.el.setAttribute('visible','false');
        const okP = (bestErr<=hitPerfect);
        addScore(okP?450:320); combo++; best=Math.max(best,combo);
        spark(laneX(lane),0,0.06, okP?'#7dfcc6':'#a7f3d0'); tick(okP?1100:900,0.05,0.22);
        toast(okP?'Hold Perfect +450':'Hold Good +320', okP?'#7dfcc6':'#a7f3d0');
        if(!fever && combo>0 && combo%(CFG.feverEveryCombo||8)===0) enterFever();
        applyTighten(); shakeCamera(0.018,100); return;
      }
    }

    if(bestErr>hitGood){ combo=0; toast('Miss','#fecaca'); return; }
    bestIt.judged=true; bestIt.el.setAttribute('visible','false');
    const okP = (bestErr<=hitPerfect);
    addScore(okP?300:160); combo++; best=Math.max(best,combo);
    spark(laneX(lane),0,0.06, okP?'#7dfcc6':'#a7f3d0'); tick(okP?1000:820,0.05, okP?0.2:0.16);
    toast(okP?'Perfect +300':'Good +160', okP?'#7dfcc6':'#a7f3d0');
    if(!fever && combo>0 && combo%(CFG.feverEveryCombo||8)===0) enterFever();
    applyTighten(); if(okP) shakeCamera(0.016,90);
  }

  function dodgePassed(it){ addScore(80); toast('Dodge OK +80','#93c5fd',1.0,420); }

  // --------- Section / Finisher ----------
  let nextSectionBeat=0;
  function sectionBannerIfNeeded(){
    if(tutorial || CFG.showSectionBanners===false) return;
    const sec = CFG.sectionBeats || 8;
    const curBeat = Math.floor(elapsed/beatSec);
    if(curBeat >= nextSectionBeat && curBeat % sec === 0){
      showBanner('Section Change','#93c5fd',900); nextSectionBeat = curBeat + sec;
    }
  }
  function finisherIfNeeded(){
    const start = (duration - (CFG.finisherSecs||10));
    if(!inFinisher && elapsed >= start){ inFinisher = true; showBanner('FINISHER x'+(CFG.finisherMultiplier||2)+'!','#f59e0b',1400); }
  }

  // --------- Loop ----------
  function loop(){
    if(!running) return;
    const now=performance.now()/1000; const prev=elapsed; elapsed=now-t0; const dt=Math.max(0, elapsed-prev);

    const lead = tutorial ? 1.8 : (inFinisher ? 1.6 : 1.2);
    while(nextNoteIdx<flatNotes.length && flatNotes[nextNoteIdx].t <= elapsed + lead){ spawn(flatNotes[nextNoteIdx]); nextNoteIdx++; }

    const speedZ = (tutorial?1.4:1.65) + (fever?0.12:0) + (inFinisher?0.10:0);
    for(const it of notes){
      if(it.judged) continue;
      const dtz = it.t - elapsed;

      if(CFG.holdEnable && it.hold>0 && it.headHit && it.el.__fill){
        const total = it.hold; const done = Math.min(1, Math.max(0, (elapsed - it.t) / total));
        it.el.__fill.setAttribute('geometry', `primitive: plane; width:${0.36*done}; height:0.06`);
        it.el.__fill.setAttribute('position', `${-0.18 + 0.18*done} 0 0.01`);
      }

      it.el.object3D.position.z = Math.max(0, dtz*speedZ);

      if(dtz < -0.22 && !it.judged){
        if(it.dodge){ it.judged=true; it.el.setAttribute('visible','false'); dodgePassed(it); }
        else { combo=0; toast('Miss','#fecaca'); it.judged=true; it.el.setAttribute('visible','false'); }
      }
    }

    stepParticles(dt);
    updateFever(); if(!tutorial) sectionBannerIfNeeded(); finisherIfNeeded();
    if(tutorial && elapsed>=tutEndAt){ tutorial=false; showBanner('เริ่มจริงแล้ว!','#cbd5e1',900); }

    if(elapsed>=duration) return end('Stage Clear');
    setHUD(); raf=requestAnimationFrame(loop);
  }

  // --------- Flow ----------
  function buildFlatNotes(){
    const bars = MAP.bars||[]; const arr=[]; const calS=CALIB_MS/1000;
    for(const bar of bars){ for(const n of (bar.notes||[])){
      const tWorld = (n.t + START_OFFSET + calS);
      arr.push({lane:n.lane, t:tWorld, hold:n.hold||0, dodge: !!n.dodge});
    } }
    arr.sort((a,b)=>a.t-b.t); flatNotes=arr; nextNoteIdx=0;
  }
  function start(){
    THEME = getThemeName();
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; combo=0; best=0; fever=false; feverEnd=0; feverCount=0; inFinisher=false;
    notes.splice(0).forEach(n=>n.el?.remove());
    buildLaneUI(); ensureLegend(); initParticles(); buildFlatNotes();
    tutorial=true; tutEndAt=CFG.tutorialSecs ?? 10; nextSectionBeat=0;
    setHUD('Tutorial: ดูจังหวะช้า ๆ ก่อน'); tick(660,0.05,0.18);
    setTimeout(()=>tick(700,0.05,0.18),200);
    setTimeout(()=>tick(700,0.05,0.18),600);
    setTimeout(()=>tick(700,0.05,0.18),1000);
    setTimeout(()=>tick(900,0.06,0.22),1400);
    raf=requestAnimationFrame(loop);
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); hideBanner(); setHUD(`${msg} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); hideBanner(); notes.splice(0).forEach(n=>n.el?.remove());
    root.__laneUI=false; const kids=[...root.children]; kids.forEach(k=>k.remove()); setTimeout(()=>{ buildLaneUI(); ensureLegend(); setHUD('พร้อมเริ่ม'); },0); }

  // --------- Bind ----------
  function bind(){
    btnStart.onclick=()=>{ ensureAudio(); if(!running) start(); };
    btnReset.onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') judge(0);
      if(k==='s'||k==='arrowup')   judge(1);
      if(k==='d'||k==='arrowright')judge(2);
    });
    statusEl.textContent='พร้อมเริ่ม • เลือกธีมแล้วกด Start';
  }
  const scene=document.querySelector('a-scene');
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
