// === modes/hydration.quest.js ===
import { emojiImage } from './emoji-sprite.js';

export async function boot(opts = {}){
  const host = opts.host || document.getElementById('spawnHost') || document.body;
  const diff = String(opts.difficulty||'normal').toLowerCase();
  const duration = Number(opts.duration||60);
  let left = Math.max(1, Math.round(duration));

  // ดี: น้ำ/แก้วน้ำ/หัวก๊อก | แย่: น้ำหวาน/น้ำอัดลม
  const GOOD = ['💧','🫗','🚰','🥤']; // 🥤 ใช้เป็น “แก้วเปล่า/น้ำเปล่า” สมมติ
  const BAD  = ['🥤','🧃','🧋','🍹','🥤']; // sugary
  // NOTE: ใช้ 🥤 ซ้ำใน GOOD/BAD? เพื่อความชัดเจน: เราจะสุ่มแบบ bias — GOOD ใช้ 💧🫗🚰 เป็นหลัก

  // เกจน้ำ (0..100) ต้องรักษาให้อยู่ช่วง 40..70 เพื่อ “พอดี”
  let water=50, running=true, score=0, combo=0, misses=0, hits=0, spawns=0;

  function fire(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})) }catch{} }
  fire('hha:quest',{text:'รักษาเกจน้ำให้อยู่โซนพอดี (GREEN) นานที่สุด!'});

  function rand(a,b){ return a + Math.random()*(b-a); }
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

  // อัปเดตเกจบน Fever bar ให้ reuse UI (แปลงน้ำเป็น 0..100)
  function updateGauge(){ fire('hha:fever', {state:'change', level: water, active:false}); }

  function spawn(){
    if(!running) return;

    const isGood = Math.random()<0.68; // ส่วนใหญ่ควรเชิญชวนน้ำดี
    const char = isGood ? pick(['💧','🫗','🚰']) : pick(['🧃','🧋','🍹','🥤']);
    const kind = isGood ? 'good' : 'bad';

    const el = emojiImage(char, 0.7, 128); el.classList.add('clickable'); spawns++;
    const X = rand(-0.5,0.5), Y = rand(-0.2,0.2), Z=-1.6;
    el.setAttribute('position', `${X} ${1.0+Y} ${Z}`);

    const life = ({easy:1900,normal:1600,hard:1300}[diff]||1600);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      // ถ้าของดีหายไปเอง → เกจน้ำ -4 และ combo รีเซ็ต
      if(kind==='good'){ water = clamp(water-4,0,100); combo=0; misses++; fire('hha:miss',{count:misses}); updateGauge(); }
    }, life);

    el.addEventListener('click', ()=>{
      if(!el.parentNode) return;
      clearTimeout(ttl); el.parentNode.removeChild(el);

      if(kind==='good'){
        hits++; combo=clamp(combo+1,0,999); score+=15+combo;
        water = clamp(water+6,0,100);
      }else{
        // ของไม่ดี: ถ้าน้ำต่ำอยู่แล้ว (water<40) → โทษแรง
        if(water < 40){ score = Math.max(0, score-20); combo=0; }
        else { score = Math.max(0, score-8); combo=0; }
        water = clamp(water-8,0,100);
      }
      fire('hha:score',{score, combo});
      updateGauge();
    }, {passive:false});

    host.appendChild(el);

    const gapBase = ({easy:[620,820], normal:[500,680], hard:[380,540]}[diff]||[500,680]);
    setTimeout(spawn, Math.floor(rand(gapBase[0], gapBase[1])));
  }

  // เวลาเดิน + water drift เล็ก ๆ
  const timer = setInterval(()=>{
    if(!running) return;
    left = Math.max(0, left-1);
    // น้ำค่อย ๆ จางไปหา 50 (homeostasis)
    const drift = (50 - water)*0.04; water = clamp(water + drift,0,100);
    updateGauge();
    fire('hha:time',{sec:left});
    if(left<=0) end('timeout');
  },1000);

  function end(reason){
    if(!running) return; running=false;
    try{ clearInterval(timer); }catch{}
    fire('hha:end',{ reason, title:'Hydration', difficulty:diff,
      score, comboMax:combo, misses, hits, spawns, duration });
  }

  // go!
  updateGauge(); spawn();

  return { stop(){ end('quit'); }, pause(){ running=false; }, resume(){ if(!running){ running=true; spawn(); } } };
}
export default { boot };
