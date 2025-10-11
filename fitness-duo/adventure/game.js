// Adventure — Sprint & Slash (Day 3–4: Tutorial Auto, Legend, Event Banners)
(function(){
  const CFG = window.ADVENTURE_CFG || {};
  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const statusEl=document.getElementById('status');

  // ---------- State ----------
  let running=false, raf=0, t0=0, elapsed=0;
  let lane=1, score=0, lives=3, combo=0, best=0;
  let duration=CFG.duration||120, fever=false, feverEnd=0;
  let tutorial=true, tutEndAt=0;     // NEW: tutorial gate
  let shields=0, magnetUntil=0;
  const items=[];                    // {el,t,kind,lane,judged}
  const laneX=i=>[-1.2,0,1.2][i];
  const WIN = CFG.hitWindowZ || 0.34;

  // ---------- Audio (optional) ----------
  let actx=null, master=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination); }
  function tone(f=700,d=0.05,g=0.18,tp='square'){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type=tp; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---------- Legend (permanent guide, top-left) ----------
  let legend=null;
  function ensureLegend(){
    if(legend) return;
    legend=document.createElement('a-entity');
    legend.setAttribute('position','-1.6 1.1 -2.8');
    legend.setAttribute('text','value:Legend:\n✅/⭐ เก็บ • ⚠️ หลบ/ฟัน\nซ้าย A/← • กลาง S/↑ • ขวา D/→; width:3.6; align:left; color:#9fb1d1');
    root.appendChild(legend);
  }

  // ---------- Event Banner ----------
  let banner=null, bannerTO=0;
  function showBanner(txt,color="#fde68a",ms=1400){
    hideBanner();
    banner=document.createElement('a-entity');
    banner.setAttribute('geometry','primitive: plane; width: 2.4; height: 0.48');
    banner.setAttribute('material',`color:#0b1220; opacity:0.92; shader:flat`);
    banner.setAttribute('position','0 1.2 0.06');
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:4.6; align:center; color:${color}`);
    t.setAttribute('position','0 0 0.01');
    banner.appendChild(t); root.appendChild(banner);
    tone(900,0.08,0.22,'square');
    bannerTO=setTimeout(hideBanner, ms);
  }
  function hideBanner(){ if(banner){ banner.remove(); banner=null; } if(bannerTO) { clearTimeout(bannerTO); bannerTO=0; } }

  // ---------- UI ----------
  function buildLaneUI(){
    if(root.__laneUI) return; root.__laneUI=true;
    const colors = CFG.laneColors || ['#0ea5e9','#334155','#22c55e'];
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
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.06; radiusOuter:0.075; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to:1.06 1.06 1; dir:alternate; dur:480; loop:true');
    root.appendChild(hit);
  }
  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    hud.setAttribute('text',`value:Score ${score} • Lives ${lives} • Combo ${combo} (Best ${best})${f}\nเก็บ: เขียว/ทอง/บัฟ • หลบ/ฟัน: แดง\n${msg||''}; width:5.8; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#7dfcc6",y=0.98,ms=560){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    t.setAttribute('position',`0 ${y} 0.05`);
    root.appendChild(t);
    t.setAttribute('animation__up','property: position; to: 0 1.16 0.05; dur: 400; easing: easeOutQuad');
    setTimeout(()=>t.remove(),ms);
  }

  // ---------- Spawner ----------
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

  // base random pattern
  function buildPattern(){
    items.splice(0).forEach(n=>n.el.remove());
    const bias=Object.assign({orb:0.55,star:0.12,shield:0.08,magnet:0.06,time:0.05,obstacle:0.14}, CFG.spawnBias||{});
    const keys=Object.keys(bias); const pick=()=>{ const r=Math.random(); let a=0; for(const k of keys){ a+=bias[k]; if(r<=a) return k; } return 'orb'; };

    let t = tutorial ? 0.8 : 0.9;
    while(t<duration){
      const l=(Math.random()*3|0), kind=pick();
      spawn(kind,l,t);
      if(Math.random()<0.22) spawn('obstacle',(Math.random()*3|0), t+0.22);
      t += (tutorial?1.1:0.86) + (Math.random()*0.22 - 0.08);
    }
  }

  // ---------- Tutorial Sequence (10s) ----------
  function buildTutorial(){
    // สแปวนตัวอย่างอ่านง่าย + ลูกศรชี้เลน
    items.splice(0).forEach(n=>n.el.remove());
    let t=0.8;
    spawn('orb',1,t); t+=1.2;
    spawn('obstacle',1,t); t+=1.2;
    spawn('star',0,t); t+=1.0;
    spawn('shield',2,t); t+=1.0;
    spawn('time',1,t);

    // คำแนะนำลอย
    showBanner('Tutorial — ทำตามไกด์', '#93c5fd', 1400);
    toast('เล็งให้ถึง “วงฟ้า”','#cbd5e1',1.05,1200);
    toast('สลับเลนด้วย A/S/D หรือ ←↑→','#cbd5e1',0.8,1600);
  }

  // ---------- Gameplay ----------
  function addScore(n){ score += fever ? Math.round(n*1.5) : n; }
  function collect(kind){
    if(kind==='orb'){ addScore(20); combo++; tone(760,0.04,0.2,'triangle'); }
    else if(kind==='star'){ addScore(80); combo+=2; tone(980,0.06,0.22,'square'); }
    else if(kind==='shield'){ shields=Math.min(2,shields+1); toast('🛡️ Shield +1'); tone(520,0.05,0.2,'sine'); }
    else if(kind==='magnet'){ magnetUntil=elapsed+5; toast('🧲 Magnet 5s','#93c5fd'); tone(620,0.05,0.2,'sine'); }
    else if(kind==='time'){ duration=Math.min((CFG.duration||120), duration+2); toast('⏱️ +เวลา','#fde68a'); tone(680,0.05,0.2,'sine'); }
    best=Math.max(best,combo);
    if(!fever && combo>0 && combo%(CFG.feverCombo||10)===0){ fever=true; feverEnd=elapsed+(CFG.feverSecs||6); showBanner('FEVER! ✨','#7dfcc6',900); }
  }
  function hitObstacle(){
    if(shields>0){ shields--; toast('🛡️ Block','#7dfcc6'); tone(420,0.06,0.22,'sawtooth'); return; }
    lives--; combo=0; toast('⚠️ ชน -1','#ef4444'); tone(180,0.1,0.26,'sawtooth');
    if(lives<=0){ return end('Game Over'); }
  }
  function updateBuffs(){ if(fever && elapsed>=feverEnd){ fever=false; showBanner('Fever End','#cbd5e1',800); } }
  function currentSpeed(){
    const base = tutorial ? 1.6 : (CFG.baseSpeed||2.0);
    const timeBoost = Math.min(1.0, Math.max(0, (elapsed - (tutorial?0:tutEndAt)) * 0.016));
    const comboBoost = Math.min(0.8, Math.floor(combo/8)*0.12);
    const feverBoost = fever?0.18:0;
    return base + timeBoost + comboBoost + feverBoost;
  }
  function pullByMagnet(it){
    if(elapsed>magnetUntil) return;
    if(it.kind==='orb' || it.kind==='star'){ const dx = (0 - laneX(it.lane)) * 0.03; it.el.object3D.position.x += dx; }
  }

  // ---------- Events Timing ----------
  function checkEvents(){
    if(!tutorial){
      for(const ev of (CFG.miniEvents||[])){
        if(Math.abs(elapsed-ev.at)<=0.03) showBanner(ev.type==='star_rush'?'Star Rush!':'Obstacle Parade!','#fde68a',1200);
      }
      if(Math.abs(elapsed-(CFG.microBossAt||100))<=0.03) showBanner('Finale!','#fca5a5',1200);
    }
  }

  // ---------- Flow ----------
  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;

    const speed=currentSpeed();
    for(const it of items){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dt*speed);
      pullByMagnet(it);
      if(Math.abs(dt)<=WIN){
        if(it.lane===lane){
          it.judged=true; it.el.setAttribute('visible','false');
          if(it.kind==='obstacle') hitObstacle(); else collect(it.kind);
        }
      }else if(dt<-WIN-0.02 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); }
    }

    updateBuffs();
    checkEvents();

    if(tutorial && elapsed>=tutEndAt){
      tutorial=false;
      showBanner('เริ่มจริงแล้ว!','#cbd5e1',1000);
      // เปลี่ยนเป็นแพทเทิร์นจริง
      buildPattern();
    }

    if(elapsed>=duration) return end('Stage Clear');
    setHUD('A/S/D หรือ ←↑→ เพื่อเปลี่ยนเลน'); raf=requestAnimationFrame(loop);
  }

  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    lane=1; score=0; lives=3; combo=0; best=0; duration=CFG.duration||120; fever=false; shields=0; magnetUntil=0;
    tutorial=true; tutEndAt = 10;  // 10 วินาทีแรก = โหมดสอน
    buildLaneUI(); ensureLegend(); buildTutorial(); setHUD('Tutorial เริ่ม • ทำตามไกด์'); tone(660,0.05,0.18,'sine');
    // Count-in 1-2-3-4
    setTimeout(()=>tone(700,0.05,0.18,'square'),200);
    setTimeout(()=>tone(700,0.05,0.18,'square'),600);
    setTimeout(()=>tone(700,0.05,0.18,'square'),1000);
    setTimeout(()=>tone(900,0.06,0.22,'square'),1400);
    loop();
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); hideBanner(); setHUD(`${msg} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); hideBanner(); items.splice(0).forEach(n=>n.el.remove()); lane=1; score=0; lives=3; combo=0; best=0; tutorial=true; setHUD('พร้อมเริ่ม'); }

  // ---------- Bind ----------
  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') lane=0;
      if(k==='s'||k==='arrowup')   lane=1;
      if(k==='d'||k==='arrowright')lane=2;
    });
    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  const scene=document.querySelector('a-scene');
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
