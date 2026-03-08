/* === /herohealth/gate/games/goodjunk/warmup.js ===
   HeroHealth Gate Mini-game
   GAME: goodjunk
   MODE: warmup
   PATCH v20260308-GATE-GOODJUNK-WARMUP
*/

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-goodjunk';
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function el(tag, cls='', text=''){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(text) n.textContent = text;
  return n;
}

function shuffle(arr, rng=Math.random){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function calcRank(acc){
  if(acc >= 90) return 'S';
  if(acc >= 75) return 'A';
  if(acc >= 60) return 'B';
  if(acc >= 40) return 'C';
  return 'D';
}

function buildBuffs({ score, accuracy, speed, junkAvoidPct }){
  return {
    wType: 'goodjunk',
    score,
    accuracy,
    speed,
    calm: Math.max(0, Math.min(100, Math.round(accuracy * 0.7 + speed * 0.3))),
    rank: calcRank(accuracy),
    wPct: Math.min(25, Math.round(accuracy / 4)),
    wCrit: Math.min(20, Math.round(speed / 5)),
    wDmg: Math.min(18, Math.round((accuracy + speed) / 12)),
    wHeal: Math.min(20, Math.round((accuracy * 0.7 + speed * 0.3) / 5)),
    goodChoicePct: accuracy,
    junkAvoidPct
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 11);

  const goodFoods = [
    '🍎 แอปเปิล','🥕 แครอท','🥛 นม','🍌 กล้วย',
    '🥬 ผักใบเขียว','🐟 ปลา','🥚 ไข่','🍉 แตงโม'
  ];
  const junkFoods = [
    '🍟 เฟรนช์ฟรายส์','🍩 โดนัท','🥤 น้ำอัดลม','🍔 เบอร์เกอร์',
    '🍭 ลูกอม','🧁 คัพเค้ก','🍫 ช็อกโกแลต','🧋 ชานมหวาน'
  ];

  let score = 0;
  let miss = 0;
  let correct = 0;
  let shown = 0;
  let junkAvoid = 0;
  let ended = false;

  const totalRounds = 14;
  const plannedTime = Number(ctx.time || 18);
  let timeLeft = plannedTime;

  root.innerHTML = '';
  const wrap = el('div', 'gj-wrap');
  const hero = el('div', 'gj-hero');
  const stage = el('div', 'gj-stage');
  const panelTop = el('div', 'gj-panel');
  const panelBottom = el('div', 'gj-panel');

  hero.innerHTML = `
    <div class="gj-kicker">NUTRITION ZONE • GOODJUNK • WARMUP</div>
    <div class="gj-title">แตะของดี หลบของหวาน</div>
    <div class="gj-sub">แตะอาหารที่มีประโยชน์ และหลีกเลี่ยง junk food เพื่อเตรียมความพร้อมก่อนเข้าเกมหลัก</div>
  `;

  const target = el('div', 'gj-target', 'เตรียมพร้อม…');
  const prompt = el('div', 'gj-prompt', 'Good = แตะ / Junk = ปล่อยผ่าน');
  const choices = el('div', 'gj-choices');
  const note = el('div', 'gj-note', 'ยิ่งเลือกถูกและนิ่ง บัฟก่อนเข้าเกมจริงยิ่งดี');

  panelTop.appendChild(target);
  panelBottom.appendChild(prompt);
  panelBottom.appendChild(choices);
  panelBottom.appendChild(note);
  stage.appendChild(panelTop);
  stage.appendChild(panelBottom);
  wrap.appendChild(hero);
  wrap.appendChild(stage);
  root.appendChild(wrap);

  api.logger?.push?.('mini_start', {
    game: 'goodjunk',
    mode: 'warmup',
    seed: ctx.seed
  });

  api.setStats({
    time: time