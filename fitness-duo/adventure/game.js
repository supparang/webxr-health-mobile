// /adventure/game.js — Readable HUD + Labels + Tutorial + HitLine
(function(){
  // ===== State =====
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, lives=3, lane=1, combo=0, bestCombo=0;
  let fever=false, feverEnd=0, shield=0;
  let items=[], duration=58, tutorial=true;
  const root = document.getElementById('root');
  const hud  = document.getElementById('hud');
  const scene= document.getElementById('scene');
  const statusEl=document.getElementById('status');

  // ===== Audio (ปลดล็อกหลังแตะครั้งแรก) =====
  let actx=null, sfx=null;
  function ensureAudio(){ if(actx) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); sfx=actx.createGain(); sfx.gain.value=0.16; sfx.connect(actx.destination);
  }
  function beep(f=660,d=0.06,type='square',g=0.22){
    if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type=type; o.frequency.value=f; o.connect(v); v.connect(sfx);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.01);
    v.gain.linearRampToValueAtTime(0,t+d); o.start(t); o.stop(t+d+0.02);
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ===== HUD / Guides =====
  function setHUD(msg){
    const f = fever ? ' • FEVER!' : '';
    const legend = 'เก็บ: ✅ เขียว / ⭐ ทอง / 🛡️ กันชน / ⏱️ เพิ่มเวลา  |  หลบ: ⚠️ แดง';
    hud.setAttribute('text',
      `value:${legend}\nScore ${score} • Lives ${lives} • Combo ${combo} (Best ${bestCombo})${f}\n${msg||''}; width:5.2; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#7dfcc6",y=0.95,ms=560){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    t.setAttribute('position',`0 ${y} 0.05`);
    root.appendChild(t);
    t.setAttribute('animation__up','property: position; to: 0 1.15 0.05; dur: 400; easing: easeOutQuad');
    setTimeout(()=>t.remove(),ms);
  }
  function flash(color="#ef4444"){
    const f=document.createElement('a-entity');
    f.setAttribute('geometry','primitive: plane; width: 6; height: 3.2');
    f.setAttribute('material',`color:${color}; opacity:0.18; shader:flat`);
    f.setAttribute('position','0 0 0.03');
    root.appendChild(f);
    setTimeout(()=>f.remove(),120);
  }
  function shake(intensity=0.035, ms=160){
    const end=performance.now()+ms;
    const tick=()=>{ const p=(end-performance.now())/ms;
      if(p<=0){ root.object3D.position.set(0,0,0); return; }
      root.object3D.position.x=(Math.random()*2-1)*intensity*p;
      root.object3D.position.y=(Math.random()*2-1)*intensity*p;
      requestAnimationFrame(tick);
    }; tick();
  }
  function laneX(i){ return [-1.2,0,1.2][i]; }

  // ===== Hit Line (เส้นเป้าตัด) =====
  function buildHitLine(){
    const line=document.createElement('a-entity');
    line.setAttribute('geometry','primitive: ring; radiusInner:0.05; radiusOuter:0.055; segmentsTheta:64');
    line.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    line.setAttribute('position','0 0 0.06');
    line.setAttribute('animation__pulse','property: scale; to: 1.05 1.05 1; dir: alternate; dur: 480; loop: true; easing: easeInOutSine');
    root.appendChild(line);

    // ทำ “โซนเลน” ให้เห็นตำแหน่ง
    [-1.2,0,1.2].forEach((x,i)=>{
      const p=document.createElement('a-entity');
      p.setAttribute('geometry','primitive: plane; width:1.1; height:0.05');
      p.setAttribute('material','color:#1f2937; opacity:0.65; shader:flat');
      p.setAttribute('position',`${x} -0.28 0.055`);
      const t=document.createElement('a-entity');
      t.setAttribute('text',`value:${['ซ้าย','กลาง','ขวา'][i]}; width:2.5; align:center; color:#9fb1d1`);
      t.setAttribute('position','0 -0.05 0.01');
      p.appendChild(t);
      root.appendChild(p);
    });
  }

  // ===== สร้างป้ายชื่อบนวัตถุ (Billboard) =====
  function addLabel(entity, text, color){
    const label=document.createElement('a-entity');
    label.setAttribute('text',`value:${text}; width:2.8; align:center; color:${color}`);
    label.setAttribute('position','0 0.32 0.01');
    entity.appendChild(label);
  }

  // ===== Patterns & Spawner =====
  const WAVES = ["mix","zigzag","rush","gauntlet"];
  function spawn(kind,lane,time){
    const n=document.createElement('a-entity');
    n.classList.add('itm'); n.dataset.kind=kind; n.dataset.t=time; n.dataset.lane=lane; n.dataset.hit="0";
    let geo, col, labelTxt='', labelCol='#e2e8f0';
    if(kind==='orb'){ geo='sphere; radius:0.16'; col='#22c55e'; labelTxt='✅ พลังงาน'; labelCol='#86efac'; }
    else if(kind==='gold'){ geo='sphere; radius:0.2'; col='#f59e0b'; labelTxt='⭐ ทอง (+100)'; labelCol='#fde68a'; }
    else if(kind==='ob'){ geo='box; width:0.7; height:0.5; depth:0.3'; col='#ef4444'; labelTxt='⚠️ สิ่งกีดขวาง'; labelCol='#fecaca'; }
    else if(kind==='shield'){ geo='torus; radius:0.22; radiusTubular:0.03'; col='#7dfcc6'; labelTxt='🛡️ กันชน'; labelCol='#7dfcc6'; }
    else if(kind==='time'){ geo='cylinder; radius:0.16; height:0.12'; col='#fcd34d'; labelTxt='⏱️ +เวลา'; labelCol='#fde68a'; }
    n.setAttribute('geometry','primitive: '+geo);
    n.setAttribute('material',`color:${col}; shader:flat; opacity:0.98; metalness:0; roughness:1`);
    n.object3D.position.set(laneX(lane), 0, 3.2);
    addLabel(n,labelTxt,labelCol);
    root.appendChild(n);
    items.push({el:n, t:time, lane, kind, judged:false});
  }
  function genTutorial(){
    // 6 วินาทีแรก: เดินเรื่องช้าๆ + ป้ายลูกศร
    items.forEach(n=>n.el?.remove()); items.length=0;
    let tt=0.8;
    spawn('orb', 1, tt); tt+=1.2;
    spawn('ob',  1, tt); tt+=1.2;
    spawn('gold',0, tt); tt+=1.0;
    spawn('shield',2,tt); tt+=1.0;
    spawn('time', 1, tt);

    // ลูกศรชี้เลน
    [-1.2,0,1.2].forEach((x,i)=>{
      const arr=document.createElement('a-entity');
      arr.setAttribute('geometry','primitive: cone; radiusBottom:0.08; radiusTop:0; height:0.22');
      arr.setAttribute('material','color:#93c5fd; opacity:0.9; shader:flat');
      arr.setAttribute('position',`${x} -0.1 0.05`);
      arr.setAttribute('rotation','-90 0 0');
      root.appendChild(arr);
      setTimeout(()=>arr.remove(), 5500);
    });
  }
  function genWaves(){
    items.forEach(n=>n.el?.remove()); items.length=0;
    const sec = 8; let t=0.9;
    while(t<duration){
      const wave = WAVES[(Math.random()*WAVES.length)|0];
      const end = Math.min(duration, t+sec);
      if(wave==="mix"){
        for(let tt=t; tt<end; tt+=0.85+(Math.random()*0.2-0.08)){
          const ln=(Math.random()*3|0); spawn(Math.random()<0.64?'orb':'ob',ln,tt);
          if(Math.random()<0.14) spawn('shield',(Math.random()*3|0),tt+0.18);
          if(Math.random()<0.10) spawn('time',(Math.random()*3|0),tt+0.26);
          if(Math.random()<0.08) spawn('gold',(Math.random()*3|0),tt+0.34);
        }
      }else if(wave==="zigzag"){
        let ln=0, dir=1;
        for(let tt=t; tt<end; tt+=0.55){
          spawn('ob', ln, tt);
          ln+=dir; if(ln===2||ln===0) dir*=-1;
          if(Math.random()<0.6) spawn('orb', (ln+1)%3, tt+0.18);
        }
      }else if(wave==="rush"){
        for(let tt=t; tt<end; tt+=0.42){
          const ln=(Math.random()*3|0);
          spawn(Math.random()<0.5?'ob':'orb', ln, tt);
        }
      }else if(wave==="gauntlet"){
        const ln=(Math.random()*3|0);
        for(let tt=t; tt<end; tt+=0.5){
          spawn((tt*10|0)%2===0?'ob':'orb', ln, tt);
        }
      }
      t=end;
    }
    for(let tt=duration-8; tt<duration; tt+=0.38){
      const ln=(Math.random()*3|0); spawn(Math.random()<0.6?'ob':'orb', ln, tt);
      if(Math.random()<0.12) spawn('gold',(Math.random()*3|0),tt+0.2);
    }
  }

  // ===== Gameplay =====
  function addScore(n,label,color){
    score += fever ? Math.round(n*1.5) : n;
    if(label) toast(label,color);
  }
  function setLane(i){ lane=Math.max(0,Math.min(2,i)); }
  function collect(kind){
    if(kind==='orb'){ addScore(20,'✅ +20','#22c55e'); combo++; beep(760,0.04,'triangle',0.2); }
    if(kind==='gold'){ addScore(100,'⭐ +100','#f59e0b'); combo+=2; beep(980,0.06,'square',0.22); }
    if(kind==='shield'){ shield = Math.min(2, shield+1); toast('🛡️ Shield +1','#7dfcc6'); beep(520,0.05,'sine',0.2); }
    if(kind==='time'){ duration=Math.min(70,duration+2); toast('⏱️ +เวลา','#fde68a'); beep(680,0.05,'sine',0.2); }
    bestCombo=Math.max(bestCombo,combo);
    if(!fever && combo>0 && combo%10===0){ fever=true; feverEnd=elapsed+7; toast('FEVER! ✨','#7dfcc6',1.0,720); }
  }
  function hitObstacle(){
    if(shield>0){ shield--; toast('🛡️ Block','#7dfcc6'); beep(420,0.06,'sawtooth',0.22); return; }
    lives--; combo=0; toast('⚠️ ชน -1 ชีวิต','#ef4444'); flash('#ef4444'); shake(); beep(180,0.1,'sawtooth',0.26);
    if(lives<=0){ return end('Game Over'); }
  }
  function updateFever(){ if(fever && elapsed>=feverEnd){ fever=false; toast('Fever End','#cbd5e1'); } }
  function curSpeed(){
    const base= tutorial?1.6 : 2.2;
    const timeBoost=Math.min(1.0,elapsed*0.016);
    const comboBoost=Math.min(0.8,Math.floor(combo/8)*0.12);
    const feverBoost = fever?0.18:0;
    return base + timeBoost + comboBoost + feverBoost;
  }

  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; lives=3; lane=1; combo=0; bestCombo=0; fever=false; feverEnd=0; shield=0; duration=58; tutorial=true;
    buildHitLine();
    genTutorial(); // เริ่มแบบช้า 6 วิ
    setHUD('เริ่ม! A/S/D หรือ ←↑→ • “ให้วัตถุถึงวงกลมเป้าสีฟ้า” • เก็บ ✅ / หลบ ⚠️');
    setTimeout(()=>{ tutorial=false; genWaves(); toast('เริ่มจริงแล้ว!','#cbd5e1'); }, 6000);
    loop();
  }
  function end(title='จบเกม'){ running=false; cancelAnimationFrame(raf); setHUD(`${title} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); items.forEach(n=>n.el?.remove()); items.length=0;
    score=0; lives=3; lane=1; combo=0; bestCombo=0; fever=false; shield=0; duration=58; tutorial=true;
    setHUD('พร้อมเริ่ม • กด Start'); }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;
    const speedZ = curSpeed();

    for(const it of items){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dt*speedZ);
      // “ถึงเส้น” = |dt| < ~0.34
      if(Math.abs(dt)<=0.34){
        if(parseInt(it.lane,10)===lane){
          if(it.kind==='ob'){ it.judged=true; it.el.setAttribute('visible','false'); hitObstacle(); }
          else{ it.judged=true; it.el.setAttribute('visible','false'); collect(it.kind); }
        }
      }else if(dt<-0.36 && !it.judged){
        it.judged=true; it.el.setAttribute('visible','false');
        if(it.kind!=='ob'){ combo = Math.max(0, combo-1); }
      }
    }
    updateFever();
    setHUD('เลน: ซ้าย(A/←) • กลาง(S/↑) • ขวา(D/→)');
    if(elapsed>=duration) return end('Stage Clear');
    raf=requestAnimationFrame(loop);
  }

  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    window.addEventListener('keydown',(e)=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') setLane(0);
      if(k==='s'||k==='arrowup')   setLane(1);
      if(k==='d'||k==='arrowright')setLane(2);
    });
    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
