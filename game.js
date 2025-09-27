// Nutrition Heroes VR — Import + Export Plate JSON

// ---------- SFX ----------
const SFX = (() => {
  let ctx; const ensure = () => { if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const tone = (f=880,d=0.12,t='sine',v=0.2)=>{ const ac=ensure(); const o=ac.createOscillator(), g=ac.createGain(); o.type=t; o.frequency.value=f;
    const now=ac.currentTime; g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(v,now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+d);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now+d+0.02); };
  return { ok:()=>tone(1200,0.10,'square',0.18), bad:()=>tone(240,0.2,'sawtooth',0.25), ui:()=>tone(900,0.08,'sine',0.16) };
})();

// ---------- Icon helper ----------
function makeIconPNG(emoji='🍽️', bg='#1f2937') {
  const size = 256; const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0,0,size,size);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(size*0.5,size*0.5,size*0.45,0,Math.PI*2); g.fill();
  g.font = `${Math.floor(size*0.55)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
  g.textAlign='center'; g.textBaseline='middle'; g.fillText(emoji, size/2, size/2+size*0.04);
  return c.toDataURL('image/png');
}

// ---------- Default foods ----------
let FOODS = [
  { id:'rice',   name:'ข้าวสวย',   group:'carb',   kcal:150, protein:3, sugar:0,  sodium:0,   color:'#fcd34d', emoji:'🍚', img:'' },
  { id:'brown',  name:'ข้าวกล้อง', group:'carb',   kcal:150, protein:3, sugar:0,  sodium:0,   color:'#f59e0b', emoji:'🥣', img:'' },
  { id:'chicken',name:'ไก่อบ',     group:'protein',kcal:180, protein:20,sugar:0,  sodium:250, color:'#fca5a5', emoji:'🍗', img:'' },
  { id:'fish',   name:'ปลาย่าง',   group:'protein',kcal:160, protein:22,sugar:0,  sodium:180, color:'#93c5fd', emoji:'🐟', img:'' },
  { id:'tofu',   name:'เต้าหู้',   group:'protein',kcal:110, protein:12,sugar:1,  sodium:120, color:'#fde68a', emoji:'🧈', img:'' },
  { id:'veg',    name:'ผัดผักรวม', group:'veg',    kcal:70,  protein:2, sugar:3,  sodium:180, color:'#86efac', emoji:'🥦', img:'' },
  { id:'salad',  name:'สลัดผัก',   group:'veg',    kcal:60,  protein:2, sugar:2,  sodium:80,  color:'#4ade80', emoji:'🥗', img:'' },
  { id:'banana', name:'กล้วยหอม',  group:'fruit',  kcal:90,  protein:1, sugar:12, sodium:1,   color:'#fde047', emoji:'🍌', img:'' },
  { id:'watermelon', name:'แตงโม',  group:'fruit',  kcal:50,  protein:1, sugar:9,  sodium:1,   color:'#fda4af', emoji:'🍉', img:'' },
  { id:'papaya', name:'มะละกอ',    group:'fruit',  kcal:55,  protein:1, sugar:8,  sodium:3,   color:'#fb923c', emoji:'🥭', img:'' },
  { id:'milk',   name:'นมจืด',     group:'dairy',  kcal:90,  protein:6, sugar:9,  sodium:70,  color:'#bfdbfe', emoji:'🥛', img:'' },
  { id:'soy',    name:'นมถั่วเหลืองไม่หวาน', group:'dairy', kcal:80, protein:7, sugar:3, sodium:90, color:'#bae6fd', emoji:'🫘', img:'' },
  { id:'soda',   name:'น้ำอัดลม',  group:'sugary', kcal:140, protein:0, sugar:35, sodium:25, color:'#60a5fa', emoji:'🥤', img:'' },
  { id:'fried',  name:'ของทอด',    group:'fatty',  kcal:250, protein:4, sugar:0,  sodium:350, color:'#f97316', emoji:'🍟', img:'' },
  { id:'instant',name:'บะหมี่กึ่งสำเร็จรูป',group:'salty', kcal:300, protein:6, sugar:2, sodium:1200,color:'#fb7185', emoji:'🍜', img:'' },
];

const GROUP_LABEL = {
  carb:'ข้าว-แป้ง', protein:'โปรตีน', veg:'ผัก', fruit:'ผลไม้', dairy:'นม', sugary:'หวาน', fatty:'มัน', salty:'เค็ม'
};
const MEALS = {
  breakfast: { label:'เช้า', min:400, max:500 },
  lunch:     { label:'กลางวัน', min:550, max:700 },
  dinner:    { label:'เย็น', min:450, max:600 }
};

// ---------- HUD ----------
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
  btnExport: document.getElementById('btnExport'),
  btnUndo: document.getElementById('btnUndo'),
  btnClear: document.getElementById('btnClear'),
  btnReset: document.getElementById('btnReset'),
  file: document.getElementById('foodFile'),
  btnImport: document.getElementById('btnImport')
};

// ---------- State ----------
let MODE = 'Practice';
let MEAL_KEY = 'breakfast';
let picked = [];
let totals = { kcal:0, protein:0, sugar:0, sodium:0, groups:new Set() };

// ---------- Scene ----------
const shelvesRoot = document.getElementById('shelves');
const plate = document.getElementById('plate');

AFRAME.registerComponent('nutrition-game', {
  init(){
    // prepare icons for default foods
    FOODS.forEach(f=>{ if(!f.img) f.imgData = makeIconPNG(f.emoji || '🍽️', f.color || '#1f2937'); });

    buildShelves();

    HUD.btnPractice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; SFX.ui(); };
    HUD.btnChallenge.onclick = ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; SFX.ui(); };
    HUD.selMeal.onchange = ()=>{
      MEAL_KEY = HUD.selMeal.value;
      const m = MEALS[MEAL_KEY];
      HUD.meal.textContent = m.label;
      HUD.goal.textContent = `${m.min}–${m.max} kcal`; SFX.ui();
    };

    HUD.btnFinish.onclick = finishPlate;
    HUD.btnExport.onclick = exportPlate;
    HUD.btnUndo.onclick = undoPick;
    HUD.btnClear.onclick = clearPlate;
    HUD.btnReset.onclick = resetAll;

    HUD.btnImport.onclick = importFoodsFromJSON;

    resetAll();
  }
});

// ---------- Build Shelves ----------
function buildShelves(){
  while(shelvesRoot.firstChild) shelvesRoot.removeChild(shelvesRoot.firstChild);

  const rows = [
    { y:1.2, z:-2.5, filter:['carb','protein','dairy'] },
    { y:0.6, z:-2.5, filter:['veg','fruit'] },
    { y:0.0, z:-2.5, filter:['sugary','fatty','salty'] }
  ];

  rows.forEach((row)=>{
    const board = document.createElement('a-box');
    board.setAttribute('color','#1f2937');
    board.setAttribute('width','4.8'); board.setAttribute('height','0.12'); board.setAttribute('depth','0.6');
    board.setAttribute('position', `0 ${row.y} ${row.z}`);
    shelvesRoot.appendChild(board);

    const items = FOODS.filter(f=> row.filter.includes(f.group));
    const n = items.length || 1;

    items.forEach((item, i)=>{
      const x = -2.1 + (i+0.5)*(4.2/n);
      const el = document.createElement('a-box');
      el.setAttribute('color', item.color || '#64748b');
      el.setAttribute('width','0.5'); el.setAttribute('height','0.26'); el.setAttribute('depth','0.42');
      el.setAttribute('position', `${x} ${row.y+0.23} ${row.z}`);
      el.setAttribute('class','food');
      el.setAttribute('nutrition-id', item.id);

      const img = document.createElement('a-image');
      const src = item.img ? item.img : (item.imgData || makeIconPNG(item.emoji || '🍽️', item.color || '#1f2937'));
      img.setAttribute('src', src);
      img.setAttribute('width','0.22'); img.setAttribute('height','0.22');
      img.setAttribute('position','0 0.08 0.21');
      el.appendChild(img);

      const label = document.createElement('a-entity');
      label.setAttribute('text', `value:${item.name}; align:center; color:#fff; width:2.6`);
      label.setAttribute('position', '0 0.19 0.25');
      el.appendChild(label);

      el.addEventListener('click', ()=>onPickFood(item.id, el));
      shelvesRoot.appendChild(el);
    });
  });
}

// ---------- Interactions ----------
function onPickFood(id){
  picked.push(id);
  const f = FOODS.find(x=>x.id===id);
  totals.kcal += f.kcal; totals.protein += f.protein; totals.sugar += f.sugar; totals.sodium += f.sodium;
  if (['carb','protein','veg','fruit','dairy'].includes(f.group)) totals.groups.add(f.group);

  const token = document.createElement('a-box');
  token.setAttribute('width','0.22'); token.setAttribute('height','0.1'); token.setAttribute('depth','0.2');
  token.setAttribute('color', f.color || '#9ca3af');
  const idx = picked.length-1, angle = (idx % 10)*(Math.PI*2/10), r = 0.35;
  const px = Math.cos(angle)*r, pz = -1 + Math.sin(angle)*r;
  token.setAttribute('position', `${px} 0.37 ${pz}`);

  const icon = document.createElement('a-image');
  icon.setAttribute('src', f.img || f.imgData || makeIconPNG(f.emoji||'🍽️', f.color||'#1f2937'));
  icon.setAttribute('width','0.16'); icon.setAttribute('height','0.16');
  icon.setAttribute('position','0 0.06 0.11');
  token.appendChild(icon);

  const lbl = document.createElement('a-entity');
  lbl.setAttribute('text', `value:${f.name}; align:center; color:#111; width:2`);
  lbl.setAttribute('position','0 0.08 0.11');
  token.appendChild(lbl);

  plate.parentNode.appendChild(token);
  updateHUD(); SFX.ok();
}

function undoPick(){
  if (!picked.length) return;
  picked.pop();
  const nodes = Array.from(plate.parentNode.children).reverse();
  const lastToken = nodes.find(n => n.tagName==='A-BOX' && Math.abs(parseFloat((n.getAttribute('position')||'0 0 0').split(' ')[1]) - 0.37) < 0.05);
  if (lastToken) lastToken.parentNode.removeChild(lastToken);
  recalcTotals(); updateHUD(); SFX.ui();
}
function clearPlate(){
  picked = [];
  Array.from(plate.parentNode.children).forEach(n=>{
    if (n.tagName==='A-BOX'){
      const y = parseFloat((n.getAttribute('position')||'0 0 0').split(' ')[1]);
      if (Math.abs(y - 0.37) < 0.05) n.parentNode.removeChild(n);
    }
  });
  recalcTotals(); updateHUD(); SFX.ui();
}
function recalcTotals(){
  totals = { kcal:0, protein:0, sugar:0, sodium:0, groups:new Set() };
  picked.forEach(id=>{
    const f = FOODS.find(x=>x.id===id);
    totals.kcal += f.kcal; totals.protein += f.protein; totals.sugar += f.sugar; totals.sodium += f.sodium;
    if (['carb','protein','veg','fruit','dairy'].includes(f.group)) totals.groups.add(f.group);
  });
}

// ---------- HUD / Scoring ----------
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

function buildSummary(){
  const meal = MEALS[MEAL_KEY];
  const inRange = totals.kcal >= meal.min && totals.kcal <= meal.max;
  const have5 = ['carb','protein','veg','fruit','dairy'].every(g=> totals.groups.has(g));
  const sugarWarn = totals.sugar > 24;
  const sodiumWarn = totals.sodium > 1500;
  let stars = 1;
  if (have5 && inRange) stars = 3; else if (have5 || inRange) stars = 2;
  return { inRange, have5, sugarWarn, sodiumWarn, stars };
}

function finishPlate(){
  const { inRange, have5, sugarWarn, sodiumWarn, stars } = buildSummary();
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

// ---------- Export JSON ----------
function exportPlate(){
  // เตรียมอ็อบเจกต์ข้อมูลจาน
  const meal = MEALS[MEAL_KEY];
  const { inRange, have5, sugarWarn, sodiumWarn, stars } = buildSummary();
  const items = picked.map(id=>{
    const f = FOODS.find(x=>x.id===id);
    return {
      id: f.id, name: f.name, group: f.group,
      kcal: f.kcal, protein: f.protein, sugar: f.sugar, sodium: f.sodium
    };
  });
  const payload = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    mode: MODE,
    mealKey: MEAL_KEY,
    mealLabel: meal.label,
    target: { min: meal.min, max: meal.max },
    items,
    totals: {
      kcal: totals.kcal|0,
      protein: totals.protein|0,
      sugar: totals.sugar|0,
      sodium: totals.sodium|0,
      groups: Array.from(totals.groups)
    },
    summary: { stars, inRange, have5, warnings: { sugarHigh: sugarWarn, sodiumHigh: sodiumWarn } }
  };

  // ดาวน์โหลดเป็นไฟล์ .json
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
  const y = new Date();
  const pad = n => String(n).padStart(2,'0');
  const filename = `plate_${MEAL_KEY}_${y.getFullYear()}${pad(y.getMonth()+1)}${pad(y.getDate())}_${pad(y.getHours())}${pad(y.getMinutes())}${pad(y.getSeconds())}.json`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);

  HUD.status.textContent = `Export แล้ว: ${filename}`;
  SFX.ok();
}

// ---------- Reset ----------
function resetAll(){
  MODE = 'Practice'; HUD.mode.textContent = 'Practice';
  MEAL_KEY = 'breakfast'; HUD.selMeal.value = 'breakfast';
  const m = MEALS[MEAL_KEY]; HUD.meal.textContent = m.label; HUD.goal.textContent = `${m.min}–${m.max} kcal`;
  clearPlate();
  HUD.status.textContent = 'คลิกอาหารเพื่อเพิ่มลงจาน • กด Finish หรือ Export เพื่อบันทึก';
}

// ---------- Import JSON ----------
async function importFoodsFromJSON(){
  const file = HUD.file.files && HUD.file.files[0];
  if (!file){ HUD.status.textContent = 'โปรดเลือกไฟล์ JSON ก่อน'; SFX.bad(); return; }
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    const valid = validateFoodsJSON(data);
    if (!valid.ok){ HUD.status.textContent = 'รูปแบบ JSON ไม่ถูกต้อง: ' + valid.error; SFX.bad(); return; }

    FOODS = data.foods.map(normalizeFood);
    FOODS.forEach(f=>{ if(!f.img) f.imgData = makeIconPNG(f.emoji || '🍽️', f.color || '#1f2937'); });

    clearPlate();
    buildShelves();
    updateHUD();
    HUD.status.textContent = `นำเข้าอาหาร ${FOODS.length} รายการสำเร็จ`;
    SFX.ok();
  }catch(e){
    HUD.status.textContent = 'อ่านไฟล์ไม่ได้หรือ JSON ไม่ถูกต้อง';
    console.error(e); SFX.bad();
  }
}
function validateFoodsJSON(j){
  if (!j || typeof j !== 'object') return {ok:false, error:'ไม่พบอ็อบเจกต์ JSON'};
  if (!Array.isArray(j.foods)) return {ok:false, error:'ต้องมีฟิลด์ "foods" เป็นอาเรย์'};
  for (const f of j.foods){
    const req = ['id','name','group','kcal','protein','sugar','sodium'];
    for (const k of req){ if (!(k in f)) return {ok:false, error:`รายการอาหารขาดฟิลด์ "${k}"`}; }
    if (!['carb','protein','veg','fruit','dairy','sugary','fatty','salty'].includes(f.group))
      return {ok:false, error:`group ไม่ถูกต้อง (${f.group})`};
  }
  return {ok:true};
}
function normalizeFood(f){
  return {
    id: String(f.id),
    name: String(f.name),
    group: String(f.group),
    kcal: Number(f.kcal)||0,
    protein: Number(f.protein)||0,
    sugar: Number(f.sugar)||0,
    sodium: Number(f.sodium)||0,
    color: f.color || '#64748b',
    emoji: f.emoji || '🍽️',
    img: f.img || ''
  };
}

// Attach
document.getElementById('game').setAttribute('nutrition-game','');
