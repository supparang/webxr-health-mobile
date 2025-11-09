// === modes/goodjunk.safe.js ===
import { emojiImage } from './emoji-sprite.js';

export async function boot(opts = {}){
  // --- พารามิเตอร์จาก index ---
  const host = opts.host || document.getElementById('spawnHost') || document.querySelector('a-scene') || document.body;
  const diff = String(opts.difficulty || 'normal').toLowerCase();
  const duration = Number(opts.duration || 60);

  // --- Pools (ของดี/ของขยะ + โบนัส) ---
  const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🍐','🍍','🍉','🥝','🥛','🍞','🐟','🥗'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const STAR = '⭐';
  const DIAM = '💎';
  const SHIELD = '🛡️';

  // --- กติกาเวลาตามระดับ ส่งมาจาก index แล้ว (90/60/45) ---
  let left = Math.max(1, Math.round(duration));

  // --- สปีดตามระดับ ---
  const cfg = {
    easy   : { rateMin: 550, rateMax: 850, life: 1800, goodRate: 0.75 },
    normal : { rateMin: 420, rateMax: 700, life: 1600, goodRate: 0.65 },
    hard   : { rateMin: 300, rateMax: 520, life: 1400, goodRate: 0.55 }
  }[diff] || { rateMin: 420, rateMax: 700, life: 1600, goodRate: 0.65 };

  // --- สถานะเกม ---
  let running = true;
  let score = 0, combo = 0, misses = 0, hits = 0, spawns = 0;
  let fever = 0, feverActive = false, shield = 0;

  // แจ้ง HUD เวลา
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch(e){} }
  fire('hha:quest', { text: 'Quest 1/3: ของดี 20 ชิ้น (0/20)' });

  // เควสต์ทีละใบ (3 จาก 10)
  const QUEST_POOL = [
    { id:'good20',   text:'ของดี 20 ชิ้น',       check:s=>s.good>=20 },
    { id:'avoid10',  text:'หลีกขยะ 10 ครั้ง',    check:s=>s.avoid>=10 },
    { id:'score500', text:'ทำคะแนน 500+',       check:s=>s.score>=500 },
    { id:'combo15',  text:'คอมโบ 15',           check:s=>s.comboMax>=15 },
    { id:'star3',    text:'เก็บดาว 3 ดวง',       check:s=>s.star>=3 },
    { id:'diamond1', text:'เก็บเพชร 1 เม็ด',     check:s=>s.diam>=1 },
    { id:'shield1',  text:'รับโล่ 1 ชิ้น',       check:s=>s.shield>=1 },
    { id:'good30',   text:'ของดี 30 ชิ้น',       check:s=>s.good>=30 },
    { id:'avoid5',   text:'หลีกขยะ 5 ครั้ง',     check:s=>s.avoid>=5 },
    { id:'combo10',  text:'คอมโบ 10',           check:s=>s.comboMax>=10 }
  ];
  function draw3(){
    const pool = QUEST_POOL.slice();
    const pick = () => pool.splice(Math.floor(Math.random()*pool.length),1)[0];
    return [pick(), pick(), pick()];
  }
  const quests = draw3();
  let qIndex = 0;
  const statsQ = { good:0, avoid:0, score:0, comboMax:0, star:0, diam:0, shield:0 };

  function updateQuestHUD(){
    const q = quests[qIndex];
    fire('hha:quest', { text: `Quest ${qIndex+1}/3: ${q.text}` });
  }
  updateQuestHUD();

  // --- ยูทิล ---
  function rand(a,b){ return a + Math.random()*(b-a); }
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

  // --- สปอน 1 เป้า (อีโมจิ) ---
  function spawnOne(){
    if(!running) return;

    const roll = Math.random();
    let char, kind='good';
    if (roll < 0.03) { char = DIAM; kind='bonusD'; }
    else if (roll < 0.08) { char = STAR; kind='bonusS'; }
    else if (roll < 0.11) { char = SHIELD; kind='shield'; }
    else if (roll < cfg.goodRate + 0.11) { char = pick(GOOD); kind='good'; }
    else { char = pick(JUNK); kind='junk'; }

    const el = emojiImage(char, 0.65, 128);
    el.classList.add('clickable');
    spawns++;

    // ตำแหน่ง (กลางจอช่วงกว้าง 60% แนวตั้ง 35% กลาง)
    const X = rand(-0.5, 0.5);  // เมตร
    const Y = rand(-0.2, 0.2);
    const Z = -1.6;
    el.setAttribute('position', `${X} ${1.0+Y} ${Z}`);

    // อายุเป้า
    const life = cfg.life;
    const ttl = setTimeout(()=> {
      if (!el.parentNode) return; // โดนคลิกไปแล้ว
      el.parentNode.removeChild(el);
      // พลาด = ของดี หรือโบนัสหาย → ลงโทษ (ถ้า junk หายไปเฉย ๆ = นับ avoid)
      if (kind==='good' || kind==='bonusD' || kind==='bonusS' || kind==='shield'){
        combo = 0; misses++;
        fire('hha:miss', {count: misses});
      } else {
        // junk หาย → นับหลบ
        statsQ.avoid++; checkQuest();
      }
    }, life);

    el.addEventListener('click', ()=>{
      if (!el.parentNode) return;
      clearTimeout(ttl);
      el.parentNode.removeChild(el);

      if (kind==='junk'){
        // โดนขยะ → หัก + ตัดคอมโบ (ถ้ามีโล่ ป้องกัน 1 ครั้ง)
        if (shield>0){ shield--; popText(el,'SHIELD!', '#60a5fa'); }
        else { score -= 10; combo = 0; }
        fire('hha:score', {score, combo});
      } else {
        // ของดี/โบนัส
        hits++; combo = clamp(combo+1,0,999);
        let delta = 10;
        if (kind==='bonusS'){ delta = 30; statsQ.star++; fever = clamp(fever+25, 0, 100); }
        if (kind==='bonusD'){ delta = 50; statsQ.diam++; fever = clamp(fever+50, 0, 100); }
        if (kind==='shield'){ delta = 15; shield = clamp(shield+1,0,3); statsQ.shield++; }
        if (kind==='good'){ statsQ.good++; }

        score += delta;
        statsQ.score = score;
        statsQ.comboMax = Math.max(statsQ.comboMax, combo);
        fire('hha:score', {score, combo});
        popText(el, `+${delta}`, '#34d399');
        emitShards(el, kind); // เอฟเฟกต์แตกกระจาย
        // อัปเดต FEVER
        fire('hha:fever', { state:'change', level: fever, active: feverActive });

        checkQuest();
      }
    }, {passive:false});

    host.appendChild(el);
  }

  // เอฟเฟกต์แตกกระจาย + คะแนน
  function popText(srcEl, text, color){
    const t = document.createElement('a-text');
    t.setAttribute('value', text);
    t.setAttribute('color', color || '#fff');
    t.setAttribute('align', 'center');
    t.setAttribute('position', srcEl.getAttribute('position'));
    t.setAttribute('scale', '0.8 0.8 0.8');
    host.appendChild(t);
    setTimeout(()=>{ try{ host.removeChild(t); }catch{} }, 550);
  }

  function emitShards(srcEl, kind){
    const pos = srcEl.getAttribute('position');
    const n = (kind==='junk') ? 6 : (kind==='bonusD'?14:(kind==='bonusS'?10:8));
    for (let i=0;i<n;i++){
      const p = document.createElement('a-sphere');
      p.setAttribute('radius', 0.015);
      const c = (kind==='junk') ? '#ef4444' : (kind==='bonusD' ? '#60a5fa' : (kind==='bonusS' ? '#f59e0b' : '#22c55e'));
      p.setAttribute('color', c);
      const ox = (Math.random()-.5)*0.6;
      const oy = (Math.random()-.5)*0.6 + 0.2;
      const oz = (Math.random()-.5)*0.2;
      p.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      p.setAttribute('animation__fly', `property: position; to: ${pos.x+ox} ${pos.y+oy} ${pos.z+oz}; dur:${300+Math.random()*400}; easing:easeOutQuad`);
      p.setAttribute('animation__fade', 'property: material.opacity; to:0; dur:500; easing:linear; delay:150');
      host.appendChild(p);
      setTimeout(()=>{ try{ host.removeChild(p); }catch{} }, 800);
    }
  }

  // เควสต์ทีละใบ
  function checkQuest(){
    const q = quests[qIndex];
    if (!q) return;
    if (q.check(statsQ)){
      qIndex++;
      if (qIndex >= 3){
        // เคลียร์ครบ 3 ใบ → เติม Fever และอวยพร
        fever = 100;
        fire('hha:fever', {state:'start', level: 100, active:true});
        popText({getAttribute:()=>({x:0,y:1.1,z:-1.6})}, 'MINI QUEST CLEAR!', '#f59e0b');
      }else{
        updateQuestHUD();
      }
    }
  }

  // เวลา + สปอนลูป
  const tickTime = setInterval(()=>{
    if(!running) return;
    left = Math.max(0, left-1);
    fire('hha:time',{sec:left});
    if(left<=0) end('timeout');
  },1000);

  function plan(){ if(!running) return;
    const wait = Math.floor(rand(cfg.rateMin, cfg.rateMax));
    setTimeout(()=>{ spawnOne(); plan(); }, wait);
  }
  plan();

  function end(reason){
    if(!running) return;
    running = false;
    try{ clearInterval(tickTime); }catch{}
    fire('hha:end', {
      reason,
      score,
      comboMax: statsQ.comboMax,
      misses,
      hits,
      spawns,
      duration
    });
  }

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; plan(); } }
  };
}
export default { boot };
