// === groups.safe.js — Food Groups (stub/playable) ===
export async function boot(cfg = {}) {
  const host = cfg.host || document.getElementById('spawnHost') || document.body;
  const dur  = Number(cfg.duration || 60);
  const diff = String(cfg.difficulty || 'normal');

  // โทนสี/ชิ้นส่วนแตกเฉพาะโหมดนี้
  const SHARD_COLOR = '#38bdf8'; // ฟ้า

  // กลุ่มอาหาร: โปรตีน/ผักผลไม้/ธัญพืช/นม
  const GROUPS = {
    protein:   ['🥚','🍗','🐟','🫘'],
    veggie:    ['🥦','🥕','🌽','🍅','🍆'],
    grains:    ['🍞','🥖','🥯','🍚','🍙'],
    dairy:     ['🥛','🧀','🍦']
  };
  const BAD = ['🍩','🍪','🧁','🍫','🥤'];

  // ภารกิจ: เก็บให้ถูก “กลุ่มวันนี้”
  const keys = Object.keys(GROUPS);
  const today = keys[(Math.random()*keys.length)|0];
  let need = 12, got = 0;

  // HUD
  function questHUD(){
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{
      text:`Groups: เก็บ ${label(today)} ให้ครบ ${got}/${need}`
    }}));
  }
  function label(k){
    return {protein:'โปรตีน',veggie:'ผักผลไม้',grains:'ธัญพืช',dairy:'นม'}[k] || k;
  }

  // DOM layer
  const layer = document.createElement('div');
  layer.className='hha-layer';
  Object.assign(layer.style,{position:'fixed',inset:0,zIndex:650});
  document.body.appendChild(layer);

  let left = dur, running = true, spawnTimer=null, timeTimer=null;

  function vw(){return Math.max(320,innerWidth||320)}; function vh(){return Math.max(320,innerHeight||320)};
  function rndPos(){ return {x: Math.floor(vw()*0.2+Math.random()*vw()*0.6), y: Math.floor(vh()*0.28+Math.random()*vh()*0.5)} }
  function pick(a){ return a[(Math.random()*a.length)|0] }

  function shards(x,y,color=SHARD_COLOR,n=16){
    for(let i=0;i<n;i++){
      const s=document.createElement('div'); s.className='shard';
      Object.assign(s.style,{position:'absolute',width:'6px',height:'6px',borderRadius:'3px',background:color,opacity:.9});
      layer.appendChild(s);
      const ang=Math.random()*2*Math.PI, dist=20+Math.random()*36, dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist;
      const t0=performance.now(), dur=360+Math.random()*220;
      (function anim(t){const k=Math.min(1,(t-t0)/dur); s.style.left=(x+dx*k)+'px'; s.style.top=(y+dy*k)+'px'; s.style.opacity=String(1-k); if(k<1&&running) requestAnimationFrame(anim); else s.remove();})(t0);
    }
  }

  function spawn(){
    if(!running) return;
    const targetPool = Math.random()<0.7 ? GROUPS[today] : (Math.random()<0.8 ? [].concat(...Object.values(GROUPS)) : BAD);
    const ch = pick(targetPool);
    const pos = rndPos();
    const el = document.createElement('div');
    el.className='hha-tgt'; el.textContent=ch;
    el.style.left=pos.x+'px'; el.style.top=pos.y+'px'; el.style.fontSize='64px';
    el.onclick = ()=>{
      el.classList.add('hha-hit'); el.remove();
      if(GROUPS[today].includes(ch)){ got++; shards(pos.x,pos.y,SHARD_COLOR,18); window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:got*10,combo:got}})); }
      else { window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:1}})); }
      questHUD();
      if(got>=need){ end('win'); } else schedule();
    };
    layer.appendChild(el);
    setTimeout(()=>{ if(el.isConnected){ el.remove(); schedule(); } }, 1500);
  }
  function schedule(){ spawnTimer=setTimeout(spawn, 600+Math.random()*500); }

  function end(reason='done'){
    if(!running) return; running=false;
    try{clearTimeout(spawnTimer)}catch{}; try{clearInterval(timeTimer)}catch{};
    Array.from(layer.children).forEach(n=>n.remove()); layer.remove();
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score:got*10,combo:got,misses:0,hits:got,spawns:need,difficulty:diff,questsCleared: reason==='win'?1:0,questsTotal:1}}));
  }

  timeTimer=setInterval(()=>{ left=Math.max(0,left-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); if(left<=0) end('timeout'); },1000);
  questHUD(); schedule();

  return { stop:()=>end('quit'), pause(){running=false}, resume(){ if(!running){running=true;schedule();} } };
}
export default { boot };
