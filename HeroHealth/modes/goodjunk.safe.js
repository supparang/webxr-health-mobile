// === Good vs Junk — SAFE + Shards + Fever (theme: goodjunk) ===
import { Particles } from '../vr/particles.js';

let running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
let spawnTimer=null, timeTimer=null, remain=0;
let FEVER=false, FEVER_COMBO_NEED=10;

const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

// ── sprite (local, no global) ─────────────────────────────────────────────────
const spriteLocal = (emo, px=160)=>{
  const key=emo+'@'+px;
  spriteLocal.cache = spriteLocal.cache || {};
  if(spriteLocal.cache[key]) return spriteLocal.cache[key];
  const c=document.createElement('canvas'); c.width=c.height=px;
  const ctx=c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(px*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.30)'; ctx.shadowBlur=px*0.07;
  ctx.fillText(emo,px/2,px/2);
  return (spriteLocal.cache[key]=c.toDataURL('image/png'));
};

function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
function popupText(txt, x, y, color){
  const t=document.createElement('a-entity');
  t.setAttribute('troika-text',`value: ${txt}; color: ${color||'#fff'}; fontSize:0.09;`);
  t.setAttribute('position',`${x} ${y+0.05} -1.18`);
  host.appendChild(t);
  t.setAttribute('animation__rise',`property: position; to: ${x} ${y+0.32} -1.18; dur: 520; easing: ease-out`);
  t.setAttribute('animation__fade',`property: opacity; to: 0; dur: 520; easing: linear`);
  setTimeout(()=>{ try{t.remove();}catch{} },560);
}

function feverStart(){
  if(FEVER) return; FEVER=true;
  emit('hha:fever',{state:'start',level:100,active:true});
}
function feverEnd(){
  if(!FEVER) return; FEVER=false;
  emit('hha:fever',{state:'end',level:0,active:false});
}

// ── target factory ────────────────────────────────────────────────────────────
function makeTarget(emoji, isGood, diff){
  const root=document.createElement('a-entity');

  const img=document.createElement('a-image');
  img.setAttribute('src', spriteLocal(emoji,192));
  const px = (Math.random()*1.6 - 0.8);
  const py = (Math.random()*0.7 + 0.6);      // ล่าง-กลางจอ
  const pz = -1.2;
  img.setAttribute('position', `${px} ${py} ${pz}`);
  img.setAttribute('width', 0.42);
  img.setAttribute('height',0.42);
  img.classList.add('clickable');
  root.appendChild(img);

  const glow=document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material',`color:${isGood?'#22c55e':'#ef4444'}; opacity:0.22; transparent:true`);
  glow.setAttribute('position','0 0 -0.01');
  root.appendChild(glow);

  const destroy=()=>{ try{ root.remove(); }catch{} };

  let clicked=false;
  const hit=()=>{
    if(clicked||!running) return; clicked=true;
    destroy();

    if(isGood){
      const base = 20 + combo*2;
      const plus = FEVER ? base*2 : base; // x2 ใน fever
      score += plus;
      combo += 1; maxCombo=Math.max(maxCombo,combo); hits++;
      if(!FEVER && combo>=FEVER_COMBO_NEED) feverStart();

      Particles.burstShards(host, {x:px,y:py,z:pz}, {theme:'goodjunk'});
      popupText('+'+plus, px, py, '#eaffff');
      emit('hha:score',{score,combo});
    }else{
      // เลี่ยงขยะ = ไม่คลิกจนหมดอายุ → จะไม่หัก ที่นี่ถือว่า “โทษ” เฉพาะกรณีกดโดน
      combo=0;
      score=Math.max(0, score-15);
      misses++;
      Particles.burstShards(host, {x:px,y:py,z:pz}, {theme:'goodjunk'});
      popupText('-15', px, py, '#ffb4b4');
      emit('hha:score',{score,combo});
      emit('hha:miss',{count:misses});
    }
  };
  img.addEventListener('click',hit,{passive:false});
  img.addEventListener('touchstart',hit,{passive:false});

  // อายุเป้า
  let ttl=1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1400;
  setTimeout(()=>{
    if(!root.parentNode||clicked||!running) return;
    // หมดอายุ: ถ้าเป็น GOOD → โทษ, ถ้า JUNK → นับ “เลี่ยงขยะ” (ไม่โทษ)
    destroy(); spawns++;
    if(isGood){ combo=0; score=Math.max(0,score-10); misses++; emit('hha:miss',{count:misses}); emit('hha:score',{score,combo}); }
    // JUNK timeout → ถือว่าหลบได้, เพิ่มควิสต์ภายนอกได้จาก event นี้
    emit('hha:quest',{text:'เลี่ยงขยะได้ดี!'});
  }, ttl);

  return root;
}

// ── main loop ────────────────────────────────────────────────────────────────
function spawnLoop(diff){
  if(!running) return;
  const goodPick = Math.random() > 0.35;
  const emoji = goodPick ? GOOD[(Math.random()*GOOD.length)|0]
                         : JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emoji, goodPick, diff));
  spawns++;

  let gap=520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap=Math.max(300, Math.round(gap*0.85));
  spawnTimer=setTimeout(()=>spawnLoop(diff), gap);
}

export async function boot(cfg={}){
  host = cfg.host || document.getElementById('spawnHost');
  const diff = String(cfg.difficulty||'normal');
  remain = (+cfg.duration||60);

  running=true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0; FEVER=false;
  emit('hha:score',{score:0,combo:0});
  emit('hha:quest',{text:'Mini Quest — เก็บของดีติดกัน '+FEVER_COMBO_NEED+' ชิ้น เพื่อเปิด FEVER!' });
  emit('hha:fever',{state:'change', level:0, active:false});
  emit('hha:time',{sec:remain});

  // timer
  clearInterval(timeTimer);
  timeTimer=setInterval(()=>{
    if(!running) return;
    remain--; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    if(remain<=0){ endGame('timeout'); }
  },1000);

  // start
  spawnLoop(diff);

  function endGame(reason='done'){
    if(!running) return; running=false;
    try{ clearTimeout(spawnTimer); }catch{}
    try{ clearInterval(timeTimer); }catch{}
    feverEnd();

    emit('hha:end',{
      reason, score, combo:maxCombo, misses, hits, spawns,
      duration:(+cfg.duration||60), title:'Good vs Junk', difficulty: diff,
      questsCleared: 0, questsTotal:3
    });
  }

  return {
    stop(){ endGame('stop'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnLoop(diff);} }
  };
}
export default { boot };
