// === modes/plate.quest.js ===
import { emojiImage } from './emoji-sprite.js';

export async function boot(opts = {}){
  const host = opts.host || document.getElementById('spawnHost') || document.body;
  const diff = String(opts.difficulty||'normal').toLowerCase();
  const duration = Number(opts.duration||60);
  let left = Math.max(1, Math.round(duration));

  // เป้าหมาย: จัด “จานสุขภาพ” ให้ครบสัดส่วน (โปรตีน/คาร์บ/ผัก/ผลไม้/นม)
  const POOL = {
    protein:['🐟','🍗','🥚','🫘','🥜'],
    carb:['🍚','🍞','🍝','🥖'],
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍌','🍇','🍓','🍍'],
    dairy:['🥛','🧀','🍨']
  };
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋'];

  // กติกาแบบง่าย: แตะอาหาร “ดี” ได้คะแนนมากกว่า และสุ่ม “สัดส่วนที่ต้องการ” ทีละช่วง
  const targetOrder = ['veg','carb','protein','fruit','dairy']; // ลูป
  let idx = 0; // ต้องการชนิดนี้เป็นพิเศษ
  let running=true, score=0, combo=0, misses=0, hits=0, spawns=0;

  function fire(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})) }catch{} }
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function rand(a,b){ return a + Math.random()*(b-a); }
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

  function needLabel(key){
    return {veg:'ผัก',carb:'คาร์บ/ธัญพืช',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'}[key]||key;
  }
  function updateQuest(){ fire('hha:quest',{text:`จัด: ${needLabel(targetOrder[idx])} ให้ถูกชนิด!`}); }
  updateQuest();

  function spawn(){
    if(!running) return;

    const roll = Math.random();
    let char, kind='good', key=null;

    if(roll < 0.65){
      // 65%: ออกของดี (แต่ไม่เสมอไปว่าจะเป็นชนิดที่ต้องการ)
      key = pick(Object.keys(POOL));
      char = pick(POOL[key]);
      kind = (key===targetOrder[idx]) ? 'target' : 'good';
    } else {
      char = pick(JUNK); kind='junk';
    }

    const el = emojiImage(char, 0.68, 128); el.classList.add('clickable'); spawns++;
    const X = rand(-0.5,0.5), Y = rand(-0.2,0.2), Z=-1.6;
    el.setAttribute('position', `${X} ${1.0+Y} ${Z}`);

    const life = ({easy:1900,normal:1600,hard:1300}[diff]||1600);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      if(kind==='target'){ combo=0; misses++; fire('hha:miss',{count:misses}); }
    }, life);

    el.addEventListener('click', ()=>{
      if(!el.parentNode) return;
      clearTimeout(ttl); el.parentNode.removeChild(el);

      if(kind==='junk'){
        combo=0; score=Math.max(0,score-10);
      }else if(kind==='target'){
        hits++; combo=clamp(combo+1,0,999); score+=25+combo*2;
        idx = (idx+1) % targetOrder.length;
        updateQuest();
      }else{ // good อื่น ๆ
        hits++; combo=clamp(combo+1,0,999); score+=10+Math.floor(combo/2);
      }
      fire('hha:score',{score, combo});
    }, {passive:false});

    host.appendChild(el);

    const gapBase = ({easy:[600,820], normal:[480,660], hard:[360,520]}[diff]||[480,660]);
    setTimeout(spawn, Math.floor(rand(gapBase[0], gapBase[1])));
  }

  const timer = setInterval(()=>{
    if(!running) return;
    left = Math.max(0, left-1);
    fire('hha:time',{sec:left});
    if(left<=0) end('timeout');
  },1000);

  function end(reason){
    if(!running) return; running=false;
    try{ clearInterval(timer); }catch{}
    fire('hha:end',{ reason, title:'Healthy Plate', difficulty:diff,
      score, comboMax:combo, misses, hits, spawns, duration });
  }

  // go!
  spawn();

  return { stop(){ end('quit'); }, pause(){ running=false; }, resume(){ if(!running){ running=true; spawn(); } } };
}
export default { boot };
