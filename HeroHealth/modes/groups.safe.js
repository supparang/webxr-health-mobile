// === modes/groups.safe.js ===
import { emojiImage } from './emoji-sprite.js';

export async function boot(opts = {}){
  const host = opts.host || document.getElementById('spawnHost') || document.body;
  const diff = String(opts.difficulty||'normal').toLowerCase();
  const duration = Number(opts.duration||60);
  let left = Math.max(1, Math.round(duration));

  const GROUPS = ['โปรตีน','คาร์บ','ผัก','ผลไม้','นม'];
  const POOL = {
    โปรตีน:['🐟','🍗','🥚','🫘','🥜'],
    คาร์บ:['🍚','🍞','🍝','🥖','🥯'],
    ผัก:['🥦','🥕','🥬','🌽','🍅'],
    ผลไม้:['🍎','🍌','🍇','🍓','🍍'],
    นม:['🥛','🧀','🍨'] // นม/ผลิตภัณฑ์นม
  };
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋'];

  // ตั้งเป้าทำ “ชุดครบ 5 หมู่” → 1/2/3 ชุด ตามระดับ
  const goalSets = { easy:1, normal:2, hard:3 }[diff] || 2;
  let setProgress = new Set(); // เก็บชื่อหมู่ที่ทำได้ในรอบปัจจุบัน

  let running=true, score=0, combo=0, misses=0, hits=0, spawns=0;

  function fire(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})) }catch{} }

  fire('hha:quest',{text:`จัดชุดอาหารครบ 5 หมู่ × ${goalSets} รอบ`});

  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function rand(a,b){ return a + Math.random()*(b-a); }
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

  // สุ่ม “หมู่” เป้าหมายรอบนี้
  let currentGroup = pick(GROUPS);
  function updateGroupQuest(){
    fire('hha:quest',{text:`หมู่เป้าหมาย: ${currentGroup} (${setProgress.size}/5) • รอบ ${Math.floor(totalSets)+1}/${goalSets}`});
  }
  let totalSets = 0; // จำนวนรอบที่สำเร็จแล้ว (ครบ 5 หมู่)

  function spawn(){
    if(!running) return;

    // 70% ออกอาหารหมู่ต่าง ๆ, 30% ขยะ
    const isJunk = Math.random()<0.30;
    let char, kind;
    if(isJunk){ char = pick(JUNK); kind='junk'; }
    else{
      const g = pick(GROUPS);
      char = pick(POOL[g]);
      kind = (g===currentGroup)?'good':'other';
    }

    const el = emojiImage(char, 0.68, 128);
    el.classList.add('clickable');
    spawns++;

    const X = rand(-0.5,0.5), Y = rand(-0.2,0.2), Z=-1.6;
    el.setAttribute('position', `${X} ${1.0+Y} ${Z}`);

    const life = ({easy:1900,normal:1600,hard:1300}[diff]||1600);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      // พลาด: ถ้าเป็นของหมู่เป้าหมายแล้วหาย → หัก
      if(kind==='good'){ combo=0; misses++; fire('hha:miss',{count:misses}); }
    }, life);

    el.addEventListener('click', ()=>{
      if(!el.parentNode) return;
      clearTimeout(ttl); el.parentNode.removeChild(el);

      if(kind==='junk'){ // โดนขยะ → โทษ
        combo=0; score=Math.max(0,score-10);
      }else if(kind==='good'){
        hits++; combo=clamp(combo+1,0,999); score+=20+combo*2;
        setProgress.add(currentGroup);
        if(setProgress.size>=5){
          totalSets+=1; setProgress.clear();
          if(totalSets>=goalSets){ end('win'); return; }
        }
        // เปลี่ยนหมู่เป้าหมายใหม่
        currentGroup = pick(GROUPS);
      }else{
        // เป็นอาหารหมู่อื่น แตะได้คะแนนน้อย
        hits++; combo=clamp(combo+1,0,999); score+=6;
      }
      fire('hha:score',{score, combo});
      updateGroupQuest();
    }, {passive:false});

    host.appendChild(el);

    const gapBase = ({easy:[600,820], normal:[480,640], hard:[360,520]}[diff]||[480,640]);
    const gap = Math.floor(rand(gapBase[0], gapBase[1]));
    setTimeout(spawn, gap);
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
    fire('hha:end',{ reason, title:'Food Groups', difficulty:diff,
      score, comboMax:combo, misses, hits, spawns, duration });
  }

  // เริ่ม
  updateGroupQuest(); spawn();

  return { stop(){ end('quit'); }, pause(){ running=false; }, resume(){ if(!running){ running=true; spawn(); } } };
}
export default { boot };
