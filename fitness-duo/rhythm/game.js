// /rhythm/game.js — Stronger UI (lane colors + arrows + pre-start guide + bold hitline)
(function(){
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, combo=0, best=0, fever=false, feverEnd=0, feverCount=0;
  let notes=[], nextBeat=0, bpm=108, sectionBeats=8, hitWin=0.16, duration=50;

  const root=document.getElementById('root'), hud=document.getElementById('hud');
  const scene=document.getElementById('scene'), statusEl=document.getElementById('status');
  const lanePos=[-0.9,0,0.9];
  let laneUIBuilt=false, guideBoard=null;

  // Audio
  let actx=null, master=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination); }
  function click(f=880, dur=0.05, g=0.18){
    if(!actx) return; const o=actx.createOscillator(), v=actx.createGain(); o.type='square'; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur+0.02);
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  function setHUD(msg){
    const f=fever?' • FEVER!':''; const legend='กติกา: ให้โน้ตเลนเดียวกันถึง “วงฟ้า” แล้วกดเลนนั้น (A/S/D หรือ L/C/R)';
    hud.setAttribute('text',`value:${legend}\nScore ${score} • Combo ${combo} (Best ${best})${f}\n${msg||''}; width:5.4; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#93c5fd",y=1.05,ms=520){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`); t.setAttribute('position',`0 ${y} 0.05`);
    root.appendChild(t); t.setAttribute('animation__up','property: position; to: 0 1.25 0.05; dur: 360; easing: easeOutQuad'); setTimeout(()=>t.remove(),ms);
  }
  function laneX(i){ return lanePos[i]; }

  // ===== Lane UI (พื้นสี + ลูกศร) + Hit Line หนา =====
  function buildLaneUI(){
    if(laneUIBuilt) return; laneUIBuilt=true;
    const laneColors=['#0ea5e9','#334155','#22c55e'];
    lanePos.forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:0.98; height:1.35');
      bg.setAttribute('material',`color:${laneColors[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`);
      root.appendChild(bg);

      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['L(A/←)','C(S/↑)','R(D/→)'][i]}; width:2.2; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`); root.appendChild(tag);

      const arr=document.createElement('a-entity');
      arr.setAttribute('geometry','primitive: cone; radiusBottom:0.08; radiusTop:0; height:0.2');
      arr.setAttribute('material','color:#93c5fd; opacity:0.9; shader:flat');
      arr.setAttribute('position',`${x} -0.12 0.055`);
      arr.setAttribute('rotation','-90 0 0');
      arr.setAttribute('animation__bob','property: position; to: '+x+' -0.06 0.055; dir: alternate; dur: 600; loop: true; easing: easeInOutSine');
      root.appendChild(arr);
    });

    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.07; radiusOuter:0.09; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to: 1.07 1.07 1; dir: alternate; dur: 480; loop: true; easing: easeInOutSine');
    root.appendChild(hit);
  }
  function showGuideBoard(){
    if(guideBoard) return;
    guideBoard=document.createElement('a-entity');
    guideBoard.setAttribute('position','0 0.85 0.07');
    guideBoard.setAttribute('geometry','primitive: plane; width: 2.6; height: 1.0');
    guideBoard.setAttribute('material','color:#0b1220; opacity:0.92; shader:flat');

    const title=document.createElement('a-entity');
    title.setAttribute('text','value:วิธีเล่น Rhythm; width:4.5; align:center; color:#e2e8f0');
    title.setAttribute('position','0 0.38 0.01'); guideBoard.appendChild(title);

    const lines=[
      'ให้โน้ตเลนเดียวกันถึง “วงฟ้า” แล้วกด L/C/R (A/S/D)',
      'คะแนน: Perfect +300 • Good +160 • พลาดคอมโบหลุด'
    ];
    lines.forEach((t,i)=>{ const row=document.createElement('a-entity');
      row.setAttribute('text',`value:${t}; width:4.8; align:center; color:#cbd5e1`);
      row.setAttribute('position',`0 ${0.12 - i*0.22} 0.01`); guideBoard.appendChild(row);
    });

    // ตัวอย่างโน้ต (3 เลน)
    [0,1,2].forEach((ln,idx)=>{
      const demo=document.createElement('a-entity');
      demo.setAttribute('geometry','primitive: circle; radius:0.16');
      demo.setAttribute('material','color:hsl('+(200+idx*40)+',70%,70%); shader:flat; opacity:0.98');
      demo.setAttribute('position',`${laneX(ln)} 0.05 0.02`); guideBoard.appendChild(demo);
    });

    root.appendChild(guideBoard);
  }
  function hideGuideBoard(){ if(guideBoard){ guideBoard.remove(); guideBoard=null; } }

  // ===== Themes / Spawn =====
  const THEMES = [
    {shape:'circle; radius:0.16', mat:(h)=>`color:hsl(${h},75%,72%); shader:flat; opacity:0.98`, hues:[210,190,160]},
    {shape:'box; width:0.34; height:0.34; depth:0.04', mat:(h)=>`color:hsl(${h},70%,68%); shader:flat; opacity:0.98`, hues:[320,0,20]},
    {shape:'triangle; radius:0.20', mat:(h)=>`color:hsl(${h},70%,70%); shader:flat; opacity:0.98`, hues:[80,120,160]},
  ];
  let curTheme = 0, beatCount=0;

  function spawn(lane){
    const th=THEMES[curTheme]; const n=document.createElement('a-entity');
    n.classList.add('note'); n.setAttribute('geometry','primitive: '+th.shape);
    const h=th.hues[(Math.random()*th.hues.length)|0];
    n.setAttribute('material', th.mat(h));
    n.object3D.position.set(laneX(lane),0,3.0); root.appendChild(n);
    notes.push({el:n, lane, t:elapsed+1.6, judged:false});
  }

  function enterFever(){ fever=true; feverEnd=elapsed+6; feverCount++; toast('FEVER! ✨','#7dfcc6',1.1,720); }
  function updateFever(){ if(fever && elapsed>=feverEnd){ fever=false; toast('Fever End','#cbd5e1'); } }
  function addScore(n){ score += fever ? Math.round(n*1.5) : n; }

  function judge(lane){
    let bestIt=null, bestErr=9;
    for(const it of notes){ if(it.judged || it.lane!==lane) continue;
      const err=Math.abs(it.t - elapsed); if(err<bestErr){ bestErr=err; bestIt=it; } }
    if(!bestIt || bestErr>hitWin){ combo=0; toast('Miss','#fecaca'); return; }
    bestIt.judged=true; bestIt.el.setAttribute('visible','false');
    if(bestErr<=hitWin*0.35){ addScore(300); combo++; toast('Perfect +300','#7dfcc6'); click(1000,0.05,0.2); }
    else { addScore(160); combo++; toast('Good +160','#a7f3d0'); click(820,0.05,0.16); }
    best=Math.max(best,combo);
    if(!fever && combo>0 && combo%8===0) enterFever();
    if(combo%6===0) hitWin = Math.max(0.10, hitWin-0.004);
  }

  // ===== Flow =====
  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; combo=0; best=0; fever=false; feverEnd=0; feverCount=0; notes.length=0;
    nextBeat=0; curTheme=0; beatCount=0; hitWin=0.16; duration=50;
    buildLaneUI(); showGuideBoard();
    setHUD('เริ่ม! รอให้โน้ตถึง “วงฟ้า” แล้วกดเลนให้ตรง (A/S/D หรือแตะ L/C/R)');
    setTimeout(()=>{ hideGuideBoard(); toast('เริ่มจริงแล้ว!','#cbd5e1'); }, 1800);
    loop();
  }
  function end(title='จบเกม'){ running=false; cancelAnimationFrame(raf); setHUD(`${title} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); notes.forEach(n=>n.el?.remove()); notes.length=0; setHUD('พร้อมเริ่ม • กด Start'); showGuideBoard(); }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;

    while(nextBeat <= elapsed + 1.0){
      if(beatCount % sectionBeats === 0 && beatCount>0){
        curTheme = (curTheme+1) % THEMES.length; toast('เปลี่ยนท่อนเพลง','#cbd5e1',1.08,540);
      }
      const lane=(Math.random()*3|0);
      spawn(lane);
      if(Math.random()<0.28) spawn((lane+1)%3);
      click(660,0.035,0.08);
      nextBeat += 60/bpm; beatCount++;
    }

    const speedZ = 1.65 + (fever?0.12:0);
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dt*speedZ);
      if(dt<-0.22 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); combo=0; toast('Miss','#fecaca'); }
    }

    updateFever();
    if(elapsed>=duration) return end('Stage Clear');
    setHUD(); raf=requestAnimationFrame(loop);
  }

  // Controls
  function bindKeys(){
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') judge(0);
      if(k==='s'||k==='arrowup')   judge(1);
      if(k==='d'||k==='arrowright')judge(2);
    });
  }
  function buildPads(){
    if(document.getElementById('padL')) return;
    const make=(id,x,label,lane)=>{ const p=document.createElement('a-entity'); p.setAttribute('id',id);
      p.setAttribute('geometry','primitive: plane; width:0.95; height:0.55');
      p.setAttribute('material','color:#0f172a; opacity:0.95; shader:flat');
      p.setAttribute('position',`${x} -0.55 0.06`);
      const t=document.createElement('a-entity'); t.setAttribute('text',`value:${label}; width:3; align:center; color:#93c5fd`);
      t.setAttribute('position','0 0 0.01'); p.appendChild(t);
      p.addEventListener('click',()=>judge(lane)); root.appendChild(p);
    };
    make('padL', -0.95, 'L (A/←)',0); make('padC', 0, 'C (S/↑)',1); make('padR', 0.95, 'R (D/→)',2);
  }

  function bindUI(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
  }

  function boot(){ bindUI(); bindKeys(); buildPads(); statusEl.textContent='พร้อมเริ่ม • กด Start'; }
  if(!scene.hasLoaded){ scene.addEventListener('loaded', boot, {once:true}); } else boot();
})();
