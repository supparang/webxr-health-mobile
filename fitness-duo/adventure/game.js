// Adventure — Day6 (refactor ให้เลือกธีม runtime ผ่าน getThemeName)
(function(){
  const CFG = window.ADVENTURE_CFG || {};
  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const statusEl=document.getElementById('status');
  const btnStart=document.getElementById('btnStart');
  const btnReset=document.getElementById('btnReset');

  // ---------- Theme helpers ----------
  function getThemeName(){
    return (window.__OVERRIDE_THEME ||
            new URLSearchParams(location.search).get('theme') ||
            'jungle').toLowerCase();
  }
  function getThemeCfg(name){
    const map={
      jungle:{ lane:['#14532d','#334155','#166534'], sky:'#0b1220', power:'vine'  },
      city:  { lane:['#0ea5e9','#334155','#22c55e'], sky:'#0b1220', power:'dash'  },
      space: { lane:['#7c3aed','#334155','#06b6d4'], sky:'#050914', power:'warp'  }
    };
    return map[name] || map.jungle;
  }

  // ---------- State ----------
  let running=false, raf=0, t0=0, elapsed=0;
  let lane=1, score=0, lives=3, combo=0, best=0;
  let duration=CFG.duration||120, fever=false, feverEnd=0;
  let tutorial=true, tutEndAt=CFG.tutorialSecs ?? 10;
  let shields=0, magnetUntil=0, dashBoostUntil=0, warpUntil=0;
  let nextPowerAt=8, THEME='jungle', Theme=getThemeCfg('jungle');
  const items=[];
  const laneX=i=>[-1.2,0,1.2][i];
  const WIN = CFG.hitWindowZ || 0.34;

  // ---------- Audio ----------
  let actx=null, master=null, musicGain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination);
    musicGain=actx.createGain(); musicGain.gain.value=0.08; musicGain.connect(actx.destination);
    startAmbient(); }
  function tone(f=700,d=0.05,g=0.18,tp='square'){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type=tp; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  function startAmbient(){
    if(!actx) return;
    const scale = THEME==='jungle'?[220,277,330,392]: THEME==='city'?[240,300,360,420]: [200,252,300,400];
    const wave  = THEME==='jungle'?'triangle': THEME==='city'?'sine':'square';
    let step=0; function loop(){
      if(!running) return;
      const t=actx.currentTime;
      for(let i=0;i<6;i++){
        const o=actx.createOscillator(), g=actx.createGain(); o.type=wave;
        const f=scale[(i+step)%scale.length]* (THEME==='space' && i%3===0 ? 0.5 : 1);
        o.frequency.value=f; o.connect(g); g.connect(musicGain);
        const tt=t+i*0.22; g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(0.08,tt+0.01); g.gain.linearRampToValueAtTime(0,tt+0.18);
        o.start(tt); o.stop(tt+0.2);
      }
      step++; setTimeout(loop, 800);
    } loop();
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---------- Particles (pool) ----------
  const pPool=[]; let pIdx=0; const MAX_P=48;
  function initParticles(){
    for(let i=0;i<MAX_P;i++){
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius:0.02');
      e.setAttribute('material','color:#93c5fd; shader:flat; opacity:0.95');
      e.setAttribute('visible','false'); root.appendChild(e);
      pPool.push({el:e, life:0, vx:0, vy:0, vz:0});
    }
  }
  function spark(x,y,z,color='#93c5fd'){ const n=6; for(let i=0;i<n;i++){
    const p=pPool[pIdx++ % MAX_P]; p.el.setAttribute('material',`color:${color}; shader:flat; opacity:0.95`);
    p.el.object3D.position.set(x,y,z); p.el.setAttribute('visible','true');
    p.life=0.32+Math.random()*0.2; p.vx=(Math.random()*0.6-0.3); p.vy=(Math.random()*0.6); p.vz=(-0.4-Math.random()*0.6); } }
  function stepParticles(dt){ for(const p of pPool){ if(!p||p.life<=0) continue; p.life-=dt;
    if(p.life<=0){ p.el.setAttribute('visible','false'); continue; }
    const o=p.el.object3D.position; o.x+=p.vx*dt; o.y+=p.vy*dt; o.z+=p.vz*dt; p.vy-=dt*0.8; } }

  // ---------- UI ----------
  function buildLaneUI(){
    // ล้างของเก่าถ้ากด reset
    const kids=[...root.children]; kids.forEach(k=>k.remove()); root.__laneUI=false;
    if(root.__laneUI) return; root.__laneUI=true;
    const colors = Theme.lane;
    [-1.2,0,1.2].forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:1.05; height:1.35');
      bg.setAttribute('material',`color:${colors[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`); root.appendChild(bg);
      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['ซ้าย','กลาง','ขวา'][i]} (${['A/←','S/↑','D/→'][i]}); width:2.4; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`); root.appendChild(tag);
    });
    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.06; radiusOuter:0.08; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.98; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to:1.08 1.08 1; dir:alternate; dur:460; loop:true');
    root.appendChild(hit);
  }
  function shakeCamera(power=0.02, ms=120){
    const cam=document.querySelector('[camera]'); if(!cam) return;
    const o=cam.object3D.position.clone(); let t=0;
    const id=setInterval(()=>{ t+=16; cam.object3D.position.set(o.x+(Math.random()-0.5)*power, o.y+(Math.random()-0.5)*power, o.z);
      if(t>=ms){ clearInterval(id); cam.object3D.position.copy(o); } },16);
  }
  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    hud.setAttribute('text',`value:[${THEME.toUpperCase()}] Score ${score} • Lives ${lives} • Combo ${combo} (Best ${best})${f}\nเก็บ: เขียว/ทอง/บัฟ • หลบ/ฟัน: แดง\n${msg||''}; width:5.8; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#7dfcc6",y=0.98,ms=560){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    t.setAttribute('position',`0 ${y} 0.05`);
    root.appendChild(t);
    t.setAttribute('animation__up','property: position; to: 0 1.16 0.05; dur: 400; easing: easeOutQuad');
    setTimeout(()=>t.remove(),ms);
  }

  // ---------- Spawner / Pattern ----------
  function spawn(kind,l,t){
    const e=document.createElement('a-entity');
    let geo, col;
    if(kind==='orb'){ geo='sphere; radius:0.16'; col='#22c55e'; }
    else if(kind==='star'){ geo='sphere; radius:0.2'; col='#f59e0b'; }
    else if(kind==='shield'){ geo='torus; radius:0.22; radiusTubular:0.03'; col='#7dfcc6'; }
    else if(kind==='magnet'){ geo='octahedron; radius:0.22'; col='#60a5fa'; }
    else if(kind==='time'){ geo='cylinder; radius:0.16; height:0.12'; col='#fcd34d'; }
    else { kind='obstacle'; geo='box; width:0.7; height:0.5; depth:0.3'; col='#ef4444'; }
    e.setAttribute('geometry','primitive: '+geo);
    e.setAttribute('material',`color:${col}; shader:flat; opacity:0.98`);
    e.object3D.position.set(laneX(l),0,3.25);
    root.appendChild(e);
    items.push({el:e,t,kind,lane:l,judged:false});
  }
  function buildPattern(){
    items.splice(0).forEach(n=>n.el.remove());
    const bias=Object.assign({orb:0.55,star:0.12,shield:0.08,magnet:0.06,time:0.05,obstacle:0.14}, CFG.spawnBias||{});
    const keys=Object.keys(bias); const pick=()=>{ const r=Math.random(); let a=0; for(const k of keys){ a+=bias[k]; if(r<=a) return k; } return 'orb'; };
    let t = tutorial ? 0.8 : 0.9;
    while(t<duration){
      const l=(Math.random()*3|0), kind=pick();
      spawn(kind,l,t);
      if(Math.random()<0.20) spawn('obstacle',(Math.random()*3|0), t+0.22);
      t += (tutorial?1.1:0.86) + (Math.random()*0.22 - 0.08);
    }
  }
  function buildTutorial(){
    items.splice(0).forEach(n=>n.el.remove());
    let t=0.8;
    spawn('orb',1,t); t+=1.2;
    spawn('obstacle',1,t); t+=1.2;
    spawn('star',0,t); t+=1.0;
    spawn('shield',2,t); t+=1.0;
    spawn('time',1,t);
    toast('สลับเลน A/S/D หรือ ←↑→','#cbd5e1',0.9,1600);
  }

  // ---------- Theme Power ----------
  function themePowerTick(){
    if(!running || tutorial) return;
    if(elapsed >= nextPowerAt){
      if(Theme.power==='vine'){
        if(shields<2){ shields++; toast('🌿 Vine Shield +1','#7dfcc6'); tone(520,0.06,0.2,'sine'); }
        nextPowerAt += 20;
      }else if(Theme.power==='dash'){
        toast('⚡ Dash Surge','#93c5fd'); tone(900,0.08,0.22,'square');
        dashBoostUntil = elapsed + 8; nextPowerAt += 25;
      }else if(Theme.power==='warp'){
        toast('🌀 Time Warp (+15% window)','#a78bfa'); tone(740,0.08,0.2,'triangle');
        warpUntil = elapsed + 7; nextPowerAt += 22;
      }
    }
  }
  function effectiveWin(){ return (elapsed<warpUntil) ? WIN*1.15 : WIN; }

  // ---------- Gameplay ----------
  function addScore(n){ score += fever ? Math.round(n*1.5) : n; }
  function collect(kind){
    const px=laneX(lane); spark(px,0,0.06, kind==='star'?'#f59e0b':'#34d399');
    if(kind==='orb'){ addScore(20); combo++; tone(760,0.04,0.2,'triangle'); }
    else if(kind==='star'){ addScore(90); combo+=2; tone(980,0.06,0.22,'square'); shakeCamera(0.02,120); }
    else if(kind==='shield'){ shields=Math.min(2,shields+1); toast('🛡️ Shield +1'); tone(520,0.05,0.2,'sine'); }
    else if(kind==='magnet'){ magnetUntil=elapsed+5; toast('🧲 Magnet 5s','#93c5fd'); tone(620,0.05,0.2,'sine'); }
    else if(kind==='time'){ duration=Math.min((CFG.duration||120), duration+2); toast('⏱️ +เวลา','#fde68a'); tone(680,0.05,0.2,'sine'); }
    best=Math.max(best,combo);
    if(!fever && combo>0 && combo%(CFG.feverCombo||10)===0){ fever=true; feverEnd=elapsed+(CFG.feverSecs||6); }
  }
  function hitObstacle(){
    spark(laneX(lane),0,0.06,'#ef4444'); shakeCamera(0.035,140);
    if(shields>0){ shields--; toast('🛡️ Block','#7dfcc6'); tone(420,0.06,0.22,'sawtooth'); return; }
    lives--; combo=0; toast('⚠️ ชน -1','#ef4444'); tone(180,0.1,0.26,'sawtooth');
    if(lives<=0){ return end('Game Over'); }
  }
  function pullByMagnet(it){ if(elapsed>magnetUntil) return;
    if(it.kind==='orb' || it.kind==='star'){ const dx = (0 - laneX(it.lane)) * 0.03; it.el.object3D.position.x += dx; } }
  function curSpeed(){
    const base = tutorial ? 1.6 : (CFG.baseSpeed||2.0);
    const timeBoost = Math.min(1.0, Math.max(0, (elapsed - (tutorial?0:tutEndAt)) * 0.016));
    const comboBoost = Math.min(0.8, Math.floor(combo/8)*0.12);
    const feverBoost = fever?0.18:0;
    const dash = elapsed<dashBoostUntil ? 0.35 : 0;
    return base + timeBoost + comboBoost + feverBoost + dash;
  }

  // ---------- Loop ----------
  function loop(){
    if(!running) return;
    const now=performance.now()/1000; const prev=elapsed; elapsed=now-t0; const dt=Math.max(0, elapsed-prev);
    const speed=curSpeed(); const WIN_E=effectiveWin();

    for(const it of items){
      if(it.judged) continue;
      const dtz = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dtz*speed);
      pullByMagnet(it);
      if(Math.abs(dtz)<=WIN_E){
        if(it.lane===lane){
          it.judged=true; it.el.setAttribute('visible','false');
          if(it.kind==='obstacle') hitObstacle(); else collect(it.kind);
        }
      }else if(dtz<-WIN_E-0.02 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); }
    }

    if(fever && elapsed>=feverEnd){ fever=false; }
    themePowerTick(); stepParticles(dt);

    if(tutorial && elapsed>=tutEndAt){ tutorial=false; buildPattern(); }
    if(elapsed>=duration) return end('Stage Clear');

    setHUD('A/S/D หรือ ←↑→ เพื่อเปลี่ยนเลน'); raf=requestAnimationFrame(loop);
  }

  // ---------- Flow ----------
  function buildTutorial(){
    items.splice(0).forEach(n=>n.el.remove());
    let t=0.8; spawn('orb',1,t); t+=1.2; spawn('obstacle',1,t); t+=1.2; spawn('star',0,t); t+=1.0; spawn('shield',2,t); t+=1.0; spawn('time',1,t);
  }
  function start(){
    // อ่านธีมขณะเริ่ม (runtime)
    THEME = getThemeName(); Theme = getThemeCfg(THEME);
    running=true; t0=performance.now()/1000; elapsed=0;
    lane=1; score=0; lives=3; combo=0; best=0;
    duration=CFG.duration||120; fever=false; shields=0; magnetUntil=0; dashBoostUntil=0; warpUntil=0; nextPowerAt=8;
    buildLaneUI(); initParticles(); buildTutorial(); setHUD('Tutorial เริ่ม • ทำตามไกด์');
    tone(660,0.05,0.18,'sine'); setTimeout(()=>tone(700,0.05,0.18,'square'),220);
    setTimeout(()=>tone(700,0.05,0.18,'square'),620); setTimeout(()=>tone(900,0.06,0.22,'square'),1020);
    loop();
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); setHUD(`${msg} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); items.splice(0).forEach(n=>n.el.remove());
    root.__laneUI=false; const kids=[...root.children]; kids.forEach(k=>k.remove());
    setTimeout(()=>{ buildLaneUI(); setHUD('พร้อมเริ่ม'); },0); }

  // ---------- Bind ----------
  function bind(){
    btnStart.onclick=()=>{ ensureAudio(); if(!running) start(); };
    btnReset.onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') lane=0;
      if(k==='s'||k==='arrowup')   lane=1;
      if(k==='d'||k==='arrowright')lane=2;
    });
    statusEl.textContent='พร้อมเริ่ม • เลือกธีมแล้วกด Start';
  }
  const scene=document.querySelector('a-scene');
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
