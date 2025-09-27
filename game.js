// Nutrition Heroes VR — Prototype (Practice/Challenge, Thai foods, no external assets)

// ---------- Simple WebAudio SFX ----------
const SFX = (() => {
  let ctx;
  const ensure = () => { if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const tone = (f=880,d=0.12,t='sine',v=0.2)=>{ const ac=ensure(); const o=ac.createOscillator(), g=ac.createGain(); o.type=t; o.frequency.value=f;
    const now=ac.currentTime; g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(v,now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+d);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now+d+0.02); };
  return { ok:()=>tone(1200,0.10,'square',0.18), bad:()=>tone(240,0.2,'sawtooth',0.25), ui:()=>tone(900,0.08,'sine',0.16) };
})();

// ---------- Data: Thai foods (per serving ~ school context) ----------
const FOODS = [
  // หมู่ข้าว-แป้ง
  { id:'rice', name:'ข้าวสวย', group:'carb', kcal:150, protein:3, sugar:0, sodium:0, color:'#fcd34d' },
  { id:'brown', name:'ข้าวกล้อง', group:'carb', kcal:150, protein:3, sugar:0, sodium:0, color:'#f59e0b' },
  // โปรตีน
  { id:'chicken', name:'ไก่อบ', group:'protein', kcal:180, protein:20, sugar:0, sodium:250, color:'#fca5a5' },
  { id:'fish', name:'ปลาย่าง', group:'protein', kcal:160, protein:22, sugar:0, sodium:180, color:'#93c5fd' },
  { id:'tofu', name:'เต้าหู้', group:'protein', kcal:110, protein:12, sugar:1, sodium:120, color:'#fde68a' },
  // ผัก
  { id:'veg', name:'ผัดผักรวม', group:'veg', kcal:70, protein:2, sugar:3, sodium:180, color:'#86efac' },
  { id:'salad', name:'สลัดผัก', group:'veg', kcal:60, protein:2, sugar:2, sodium:80, color:'#4ade80' },
  // ผลไม้
  { id:'banana', name:'กล้วยหอม', group:'fruit', kcal:90, protein:1, sugar:12, sodium:1, color:'#fde047' },
  { id:'watermelon', name:'แตงโม', group:'fruit', kcal:50, protein:1, sugar:9, sodium:1, color:'#fda4af' },
  { id:'papaya', name:'มะละกอ', group:'fruit', kcal:55, protein:1, sugar:8, sodium:3, color:'#fb923c' },
  // นม
  { id:'milk', name:'นมจืด', group:'dairy', kcal:90, protein:6, sugar:9, sodium:70, color:'#bfdbfe' },
  { id:'soy', name:'นมถั่วเหลืองไม่หวาน', group:'dairy', kcal:80, protein:7, sugar:3, sodium:90, color:'#bae6fd' },
  // หวาน-มัน-เค็ม (เตือน)
  { id:'soda', name:'น้ำอัดลม', group:'sugary', kcal:140, protein:0, sugar:35, sodium:25, color:'#60a5fa' },
  { id:'fried', name:'ของทอด', group:'fatty', kcal:250, protein:4, sugar:0, sodium:350, color:'#f97316' },
  { id:'instant', name:'บะหมี่กึ่งสำเร็จรูป', group:'salty', kcal:300, protein:6, sugar:2, sodium:1200, color:'#fb7185' },
];

const GROUP_LABEL = {
  carb:'ข้าว-แป้ง', protein:'โปรตีน', veg:'ผัก', fruit:'ผลไม้', dairy:'นม', sugary:'หวาน', fatty:'มัน', salty:'เค็ม'
};

// Meal targets (kcal range)
const MEALS = {
  breakfast: { label:'เช้า', min:400, max:500 },
  lunch:     { label:'กลางวัน', min:550, max:700 },
  dinner:    { label:'เย็น', min:450, max:600 }
};

// ---------- HUD Refs ----------
const HUD = {
  mode: document.getElementById('modeText'),
  meal: document.getElementById('mealText'),
  goal: document.getElementById('goalText'),
  kcal: document.getElementById('kcalText'),
  pro:  document.getElementById('proText'),
  sugar:document.getElementById('sugarText'),
  sodium:document.getElementById('sodText'),
  groups:document.getElementById('groupsText'),
  status:document.getElementById('status'),
  list: document.getElementById('pickedList'),
  btnPractice: document.getElementById('btnPractice'),
  btnChallenge: document.getElementById('btnChallenge'),
  selMeal: document.getElementById('selMeal'),
  btnFinish: document.getElementById('btnFinish'),
  btnUndo: document.getElementById('btnUndo'),
  btnClear: document.getElementById('btnClear'),
  btnReset: document.getElementById('btnReset')
};

// ---------- Game State ----------
let MODE = 'Practice';
let MEAL_KEY = 'breakfast';
let picked = [];   // array of food ids
let totals = { kcal:0, protein:0, sugar:0, sodium:0, groups:new Set() };

// ---------- Scene & Spawn ----------
const shelvesRoot = document.getElementById('shelves');
const plate = document.getElementById('plate');

AFRAME.registerComponent('nutrition-game', {
  init(){
    // Build shelves
    buildShelves();

    // Buttons
    HUD.btnPractice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; SFX.ui(); };
    HUD.btnChallenge.onclick = ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; SFX.ui(); };
    HUD.selMeal.onchange = ()=>{
      MEAL_KEY = HUD.selMeal.value;
      const m = MEALS[MEAL_KEY];
      HUD.meal.textContent = m.label;
      HUD.goal.textContent = `${m.min}–${m.max} kcal`;
      SFX.ui();
    };

    HUD.btnFinish.onclick = finishPlate;
    HUD.btnUndo.onclick = undoPick;
    HUD.btnClear.onclick = clearPlate;
    HUD.btnReset.onclick = resetAll;

    resetAll();
  }
});

// Build simple shelf rows and clickable food boxes
function buildShelves(){
  // Clear existing
  while(shelvesRoot.firstChild) shelvesRoot.removeChild(shelvesRoot.firstChild);

  // 3 rows of shelves
  const rows = [
    { y:1.2, z:-2.5, filter:['carb','protein','dairy'] },
    { y:0.6, z:-2.5, filter:['veg','fruit'] },
    { y:0.0, z:-2.5, filter:['sugary','fatty','salty'] }
  ];
  rows.forEach((row,ri)=>{
    // shelf board
    const board = document.createElement('a-box');
    board.setAttribute('color','#1f2937');
    board.setAttribute('width','4.5'); board.setAttribute('height','0.12'); board.setAttribute('depth','0.6');
    board.setAttribute('position', `0 ${row.y} ${row.z}`);
    shelvesRoot.appendChild(board);

    // foods on this row
    const items = FOODS.filter(f=> row.filter.includes(f.group));
    const n = items.length;
    items.forEach((item, i)=>{
      const x = -2.0 + (i+0.5)*(4.0/n);
      const el = document.createElement('a-box');
      el.setAttribute('color', item.color);
      el.setAttribute('width','0.5'); el.setAttribute('height','0.25'); el.setAttribute('depth','0.4');
      el.setAttribute('position', `${x} ${row.y+0.22} ${row.z}`);
      el.setAttribute('class','food');
      el.setAttribute('nutrition-id', item.id);

      const label = document.createElement('a-entity');
      label.setAttribute('text', `value:${item.name}; align:center; color:#fff; width:3`);
      label.setAttribute('position', '0 0.2 0.25');
      el.appendChild(label);

      el.addEventListener('click', ()=>onPickFood(item.id, el));
      shelvesRoot.appendChild(el);
    });
  });
}

// ---------- Picking / Plate ----------
function onPickFood(id, el){
  picked.push(id);
  const food = FOODS.find(f=>f.id===id);
  totals.kcal += food.kcal;
  totals.protein += food.protein;
  totals.sugar += food.sugar;
  totals.sodium += food.sodium;
  if (['carb','protein','veg','fruit','dairy'].includes(food.group)) totals.groups.add(food.group);

  // Clone a token onto the plate
  const token = document.createElement('a-box');
  token.setAttribute('width','0.22'); token.setAttribute('height','0.1'); token.setAttribute('depth','0.2');
  token.setAttribute('color', food.color);
  // scatter tokens on plate in circle
  const idx = picked.length-1;
  const angle = (idx % 10) * (Math.PI*2/10);
  const r = 0.35;
  const px = Math.cos(angle)*r;
  const pz = -1 + Math.sin(angle)*r;
  token.setAttribute('position', `${px} 0.37 ${pz}`);
  const lbl = document.createElement('a-entity');
  lbl.setAttribute('text', `value:${food.name}; align:center; color:#111; width:2`);
  lbl.setAttribute('position','0 0.08 0.11');
  token.appendChild(lbl);
  plate.parentNode.appendChild(token);

  updateHUD();
  SFX.ok();
}

function undoPick(){
  if (!picked.length) return;
  picked.pop();
  // remove last token from scene (simple approach: remove last added box near plate height)
  const nodes = Array.from(plate.parentNode.children).reverse();
  const lastToken = nodes.find(n => n.tagName==='A-BOX' && Math.abs(parseFloat((n.getAttribute('position')||'0 0 0').split(' ')[1]) - 0.37) < 0.05);
  if (lastToken) lastToken.parentNode.removeChild(lastToken);
  recalcTotals();
  updateHUD();
  SFX.ui();
}

function clearPlate(){
  picked = [];
  // remove tokens near plate
  Array.from(plate.parentNode.children).forEach(n=>{
    if (n.tagName==='A-BOX'){
      const y = parseFloat((n.getAttribute('position')||'0 0 0').split(' ')[1]);
      if (Math.abs(y - 0.37) < 0.05) n.parentNode.removeChild(n);
    }
  });
  recalcTotals();
  updateHUD();
  SFX.ui();
}

function recalcTotals(){
  totals = { kcal:0, protein:0, sugar:0, sodium:0, groups:new Set() };
  picked.forEach(id=>{
    const f = FOODS.find(x=>x.id===id);
    totals.kcal += f.kcal; totals.protein += f.protein; totals.sugar += f.sugar; totals.sodium += f.sodium;
    if (['carb','protein','veg','fruit','dairy'].includes(f.group)) totals.groups.add(f.group);
  });
}

// ---------- HUD & Scoring ----------
function updateHUD(){
  HUD.kcal.textContent = totals.kcal|0;
  HUD.pro.textContent = `${totals.protein|0} g`;
  HUD.sugar.textContent = `${totals.sugar|0} g`;
  HUD.sodium.textContent = `${totals.sodium|0} mg`;
  const groupsArr = Array.from(totals.groups).map(g=>GROUP_LABEL[g]);
  HUD.groups.textContent = groupsArr.length ? groupsArr.join(', ') : '—';
  HUD.list.innerHTML = picked.map((id,i)=>{
    const f = FOODS.find(x=>x.id===id);
    return `${i+1}. ${f.name} (${GROUP_LABEL[f.group]}) +${f.kcal} kcal`;
  }).join('<br>');
}

function finishPlate(){
  const meal = MEALS[MEAL_KEY];
  const inRange = totals.kcal >= meal.min && totals.kcal <= meal.max;
  const have5 = ['carb','protein','veg','fruit','dairy'].every(g=> totals.groups.has(g));
  const sugarWarn = totals.sugar > 24;     // ~เกณฑ์ต่อวันเด็ก (อิงแนวแนะนำทั่วไป)
  const sodiumWarn = totals.sodium > 1500; // เตือนถ้าเกิน 1500 mg

  let stars = 1;
  if (have5 && inRange) stars = 3;
  else if (have5 || inRange) stars = 2;

  // status message
  let msg = `สรุปผล: ⭐ x${stars} — `;
  msg += have5 ? 'ครบ 5 หมู่, ' : 'ยังไม่ครบ 5 หมู่, ';
  msg += inRange ? 'พลังงานอยู่ในช่วงเป้าหมาย' : 'พลังงานนอกช่วงเป้าหมาย';

  if (sugarWarn || sodiumWarn){
    msg += ' — ควรระวัง ';
    if (sugarWarn) msg += 'น้ำตาลสูง ';
    if (sodiumWarn) msg += 'โซเดียมสูง';
  }

  HUD.status.textContent = msg;
  if (stars>=3 && !sugarWarn && !sodiumWarn) SFX.ok(); else SFX.bad();
}

// ---------- Reset ----------
function resetAll(){
  MODE = 'Practice'; HUD.mode.textContent = 'Practice';
  MEAL_KEY = 'breakfast'; HUD.selMeal.value = 'breakfast';
  const m = MEALS[MEAL_KEY]; HUD.meal.textContent = m.label; HUD.goal.textContent = `${m.min}–${m.max} kcal`;
  clearPlate();
  HUD.status.textContent = 'คลิกอาหารเพื่อเพิ่มลงจาน • กด Finish เพื่อสรุป';
}

// Attach component
document.getElementById('game').setAttribute('nutrition-game','');
