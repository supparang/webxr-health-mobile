
(function(){
  const Q = new URLSearchParams(location.search);
  const tempoSel = Q.get('tempo')||'normal';
  const KB = (Q.get('kb')||'on') === 'on';
  const BPM = tempoSel==='easy'?80:tempoSel==='hard'?120:100;
  const beatMs = 60000/BPM;
  const chart = Array.from({length:32}).map((_,i)=>({t:i*beatMs, side:(Math.random()<0.5?'L':'R')}));
  const S={score:0,combo:0,playing:false};
  let $start,$end,$sum,$hud,$sp;

  function setHUD(){ $hud&&$hud.setAttribute('value',`Score: ${S.score} | Combo: ${S.combo}`); }

  function spawn(side){
    const isL = side==='L';
    const laneX = isL? -0.8 : 0.8;
    const img = isL? '#L' : '#R';
    const e = document.createElement('a-image');
    e.setAttribute('src', img);
    e.setAttribute('position', `${laneX} 2.0 -1.79`);
    e.setAttribute('scale', '0.6 0.6 0.6');
    e.classList.add('clickable');
    e.setAttribute('rb-note', {side:side});
    $sp.appendChild(e);
  }

  AFRAME.registerComponent('rb-note', {
    schema:{side:{type:'string'}},
    init:function(){
      this.hit=false;
      this.el.addEventListener('click',()=>this.tryHit());
    },
    tick:function(t,dt){
      if(!S.playing) return;
      const p=this.el.object3D.position;
      p.y -= 0.8*(dt/1000);
      if(p.y < 0.6){ if(!this.hit){ S.combo=0; setHUD(); } this.el.remove(); }
    },
    tryHit:function(){
      if(this.hit||!S.playing) return;
      const y=this.el.object3D.position.y;
      const diff=Math.abs(y-1.0);
      let gain=0;
      if(diff<0.05){ gain=300; S.combo++; toast(this.el,'Perfect'); }
      else if(diff<0.12){ gain=150; S.combo++; toast(this.el,'Good'); }
      else { gain=0; S.combo=0; toast(this.el,'Miss'); }
      S.score += gain + Math.min(100, S.combo*5);
      setHUD();
      this.hit=true; this.el.remove();
    }
  });

  function toast(el,text){
    const t=document.createElement('a-text');
    const p=el.object3D.position;
    t.setAttribute('value',text); t.setAttribute('position',`${p.x} ${p.y+0.2} -1.78`);
    t.setAttribute('color','#fff'); t.setAttribute('width','2');
    document.querySelector('a-scene').appendChild(t);
    setTimeout(()=>t.remove(),400);
  }

  function start(){
    S.playing=true; $start.classList.add('hidden'); setHUD();
    let i=0;
    const timer=setInterval(()=>{
      if(i>=chart.length){ clearInterval(timer); setTimeout(end, 1600); return; }
      spawn(chart[i].side); i++;
    }, beatMs);
  }

  function end(){ S.playing=false; $sum.textContent = `Score ${S.score}`; $end.classList.remove('hidden'); }

  function keyHit(side){
    // Pick the nearest note in that lane around y≈1.0
    const list = Array.from($sp.children).filter(el=>el.getAttribute('src') === (side==='L'?'#L':'#R'));
    let best = null, bestDiff = 999;
    list.forEach(el=>{
      const y = el.object3D.position.y;
      const diff = Math.abs(y-1.0);
      if(diff < bestDiff){ best=el; bestDiff=diff; }
    });
    if(best){ best.emit('click'); }
  }

  window.addEventListener('load',()=>{
    $start=id('start'); $end=id('end'); $sum=id('sum'); $hud=id('hud'); $sp=id('spawner');
    window.RB={start}; setHUD();
    document.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ if($start&&!$start.classList.contains('hidden')) start(); }
      if(e.key==='Escape'){ location.href='index.html'; }
      if(!S.playing) return;
      if(!KB) return;
      if(e.key==='ArrowLeft') keyHit('L');
      if(e.key==='ArrowRight') keyHit('R');
      if(e.key===' ') e.preventDefault();
    });
  });
  const id=x=>document.getElementById(x);
})();
