
(function(){
  const P = new URLSearchParams(location.search);
  const MODE = P.get('mode') || 'timed';
  const DIFF = P.get('diff') || 'normal';
  const TIME = Math.max(10, parseInt(P.get('time')||'60',10));
  const KB = (P.get('kb')||'off') === 'on';
  const cfg = {easy:{spawn:1200,speed:0.35,miss:8},normal:{spawn:850,speed:0.55,miss:6},hard:{spawn:620,speed:0.75,miss:4}}[DIFF]||{spawn:850,speed:0.55,miss:6};
  const S={score:0,timeLeft:(MODE==='timed')?TIME:-1,playing:false,paused:false,spawnT:null,tickT:null,missed:0};
  let $start,$pause,$end,$strip,$sum,$hudS,$hudT,$hudM,$sp,$rig,$cursor;

  function setHUD(){ $hudS&&$hudS.setAttribute('value',`Score: ${S.score}`); $hudT&&$hudT.setAttribute('value',`Time: ${S.timeLeft>-1?S.timeLeft:'∞'}`); $hudM&&$hudM.setAttribute('value',`Mode: ${MODE==='timed'?'Timed':'Endless'} (${cap(DIFF)})`); }
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

  function spawn(){ if(!S.playing||S.paused) return; const x=(Math.random()*3-1.5),z=-(1.6+Math.random()*2.8),y=0.8+Math.random()*0.6;
    const e=document.createElement('a-image'); e.setAttribute('src','#tex-target'); e.setAttribute('position',`${x} ${y} ${z}`); e.setAttribute('scale','0.7 0.7 0.7'); e.classList.add('clickable'); e.setAttribute('sb-target',{speed:cfg.speed}); $sp.appendChild(e); }
  AFRAME.registerComponent('sb-target',{schema:{speed:{type:'number',default:0.5}},init:function(){this.hit=false;this.el.addEventListener('click',()=>{if(!S.playing||S.paused||this.hit)return;this.hit=true;S.score+=5;setHUD();this.el.setAttribute('animation__pop',{property:'scale',to:'0.5 0.5 0.5',dur:140,dir:'alternate',loop:2});setTimeout(()=>this.el.remove(),140);});},tick:function(t,d){if(!S.playing||S.paused)return;const p=this.el.object3D.position;p.y+=this.data.speed*(d/1000);if(p.y>3.2){this.el.remove(); if(!this.hit){S.missed++; if(MODE==='endless'&&S.missed>=cfg.miss){end();}}}}});

  function start(){S.playing=true;S.paused=false;setHUD();$start.classList.add('hidden');$strip.classList.remove('hidden');S.spawnT=setInterval(spawn,cfg.spawn); if(MODE==='timed'){S.tickT=setInterval(()=>{if(S.paused)return;S.timeLeft--;setHUD();if(S.timeLeft<=0)end();},1000);}}
  function end(){S.playing=false;clearInterval(S.spawnT);clearInterval(S.tickT);Array.from($sp.children).forEach(c=>c.remove());const v=S.score>=80?'สุดยอด!':S.score>=40?'ดีมาก':'สู้ต่อ!';$sum.textContent=`${v} • Score ${S.score} • Missed ${S.missed}`;$end.classList.remove('hidden');$strip.classList.add('hidden');}
  function pause(){if(!S.playing)return;S.paused=true;$pause.classList.remove('hidden');}
  function resume(){S.paused=false;$pause.classList.add('hidden');}
  function toggle(){S.paused?resume():pause();}

  // --- Keyboard helpers ---
  function kbHit(){
    // simulate click on first intersected clickable
    const ray = $cursor.components.raycaster;
    if(!ray) return;
    const list = ray.intersections || [];
    for(const i of list){
      if(i.object && i.object.el && i.object.el.classList && i.object.el.classList.contains('clickable')){
        i.object.el.emit('click'); return;
      }
    }
  }
  function kbRotate(dx=0, dy=0){
    const r = $rig.getAttribute('rotation');
    $rig.setAttribute('rotation', {x: (r.x+dx), y:(r.y+dy), z:r.z});
  }

  window.addEventListener('load',()=>{$start=g('start');$pause=g('pause');$end=g('end');$strip=g('strip');$sum=g('end-summary');$hudS=g('hud-score');$hudT=g('hud-time');$hudM=g('hud-mode');$sp=g('spawner');$rig=g('rig');$cursor=g('cursor');
    window.SB_UI={start,pause:pause,resume:resume,togglePause:toggle}; setHUD();
    // KB bindings
    document.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ if($start&&!$start.classList.contains('hidden')) start(); }
      if(e.key===' '){ e.preventDefault(); if(S.playing && !S.paused) kbHit(); }
      if(e.key==='p' || e.key==='P'){ toggle(); }
      if(e.key==='Escape'){ location.href='index.html'; }
      if(KB){
        const stepY=3, stepX=2.5;
        if(e.key==='ArrowLeft')  kbRotate(0,-stepY);
        if(e.key==='ArrowRight') kbRotate(0, stepY);
        if(e.key==='ArrowUp')    kbRotate(-stepX,0);
        if(e.key==='ArrowDown')  kbRotate( stepX,0);
      }
    });
  });
  const g=id=>document.getElementById(id);
})();