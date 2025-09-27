// Nutrition VR — A-Frame minimal game
// - Hand-tracking pinch (events + fallback) for pick/place
// - Import food list from JSON
// - Tally nutrients and Export plate JSON
// - Plausible Analytics: GAME_ID="Nutrition"

//////////////////////
// Analytics Helper //
//////////////////////
const GAME_ID = "Nutrition";
function track(eventName, props={}) {
  try { if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } }); } catch(e){}
}

//////////////////////
// Simple WebAudio  //
//////////////////////
const SFX = (() => {
  let ctx;
  const ensure = () => { if (!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const tone = (f=880,d=0.12,t='sine',v=0.22)=>{
    const ac=ensure(), o=ac.createOscillator(), g=ac.createGain();
    o.type=t; o.frequency.value=f;
    const now=ac.currentTime;
    g.gain.setValueAtTime(0,now);
    g.gain.linearRampToValueAtTime(v,now+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,now+d);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now+d+0.02);
  };
  return { ui:()=>tone(1000,0.08,'square',0.2), ok:()=>tone(1200,0.1,'square',0.2), bad:()=>tone(240,0.2,'sawtooth',0.25) };
})();

//////////////////////
// HUD Refs         //
//////////////////////
const HUD = {
  catText: document.getElementById('catText'),
  plateCount: document.getElementById('plateCount'),
  kcal: document.getElementById('kcalText'),
  carb: document.getElementById('carbText'),
  prot: document.getElementById('protText'),
  fat: document.getElementById('fatText'),
  sugar: document.getElementById('sugarText'),
  na: document.getElementById('naText'),
  status: document.getElementById('status'),
  selCat: document.getElementById('selCat'),
  btnImport: document.getElementById('btnImport'),
  fileFoods: document.getElementById('fileFoods'),
  btnReset: document.getElementById('btnReset'),
  btnExport: document.getElementById('btnExport'),
};

//////////////////////
// Scene Roots      //
//////////////////////
const shelfRoot = document.getElementById('shelf');
const plateRoot = document.getElementById('plate');
const fingerCursor = document.getElementById('fingerCursor');
const handR = document.getElementById('handR');
const handL = document.getElementById('handL');

//////////////////////
// State / Data     //
//////////////////////
let foods = getDefaultFoods();     // รายการอาหาร (แก้/เพิ่มได้จาก Import)
let currentCat = 'all';

let picked = [];                  // สิ่งที่อยู่บน “จาน”
let totals = { kcal:0, carb:0, protein:0, fat:0, sugar:0, sodium:0 };

//////////////////////
// Hand-Tracking    //
//////////////////////
let pinchUsingEvents=false, isPinching=false, wasPinching=false;
function setPinching(v){ isPinching=v; fingerCursor.setAttribute('color', v?'#66ff88':'#ffffaa'); }
['pinchstarted','pinchended'].forEach(ev=>{
  handR.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
  handL.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
});
const PINCH_ON=0.025, PINCH_OFF=0.035;
function getJointWorldPos(handEnt, nameLike){
  if (!handEnt) return null;
  let node=null; handEnt.object3D.traverse(n=>{ if(n.name && n.name.toLowerCase().includes(nameLike)) node=n; });
  if (!node) return null; const v=new THREE.Vector3(); node.getWorldPosition(v); return v;
}
function indexTipWorld(){
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent) return null; return getJointWorldPos(ent,'index-finger-tip');
}
function pollPinchFallback(){
  if (pinchUsingEvents) return;
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent){ setPinching(false); return; }
  const tip = getJointWorldPos(ent,'index-finger-tip');
  const thb = getJointWorldPos(ent,'thumb-tip');
  if (!tip || !thb){ setPinching(false); return; }
  const d = tip.distanceTo(thb);
  if (!isPinching && d < PINCH_ON) setPinching(true);
  else if (isPinching && d > PINCH_OFF) setPinching(false);
}
function intersectsObj(worldPos, obj3D){
  obj3D.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(obj3D);
  return box.containsPoint(worldPos);
}

//////////////////////
// A-Frame Loop     //
//////////////////////
AFRAME.registerComponent('nutrition-game', {
  init(){
    this.last = performance.now()/1000;

    HUD.selCat.onchange = ()=>{ currentCat = HUD.selCat.value; HUD.catText.textContent = HUD.selCat.options[HUD.selCat.selectedIndex].text; buildShelf(); SFX.ui(); };
    HUD.btnImport.onclick = ()=> HUD.fileFoods.click();
    HUD.fileFoods.onchange = onImportFoodJSON;
    HUD.btnReset.onclick = resetPlate;
    HUD.btnExport.onclick = exportPlate;

    buildShelf();
    buildPlate();

    track('GameStart');
  },
  tick(){
    const t = performance.now()/1000, dt=t-this.last; this.last=t;
    // finger follow
    pollPinchFallback();
    const tip = indexTipWorld();
    if (tip){ fingerCursor.object3D.position.copy(tip); fingerCursor.setAttribute('visible', true); }
    else    { fingerCursor.setAttribute('visible', false); }

    // pinch edge → pick or remove
    if (!wasPinching && isPinching){
      // hit test foods (shelf)
      const boxes = Array.from(shelfRoot.querySelectorAll('.food'));
      let hit = boxes.find(el => tip && intersectsObj(tip, el.object3D));
      if (hit){ addToPlate(hit.getAttribute('data-id')); wasPinching=isPinching; return; }

      // hit test plate items (remove)
      const items = Array.from(plateRoot.querySelectorAll('.pitem'));
      hit = items.find(el => tip && intersectsObj(tip, el.object3D));
      if (hit){ removeFromPlate(hit.getAttribute('data-instance-id')); }
    }
    wasPinching = isPinching;
  }
});
document.getElementById('game').setAttribute('nutrition-game','');

//////////////////////
// Build Shelf      //
//////////////////////
function buildShelf(){
  while(shelfRoot.firstChild) shelfRoot.removeChild(shelfRoot.firstChild);

  // ชั้นวาง
  const shelf = document.createElement('a-box');
  shelf.setAttribute('color','#0f172a'); shelf.setAttribute('width','4.8'); shelf.setAttribute('height','2.2'); shelf.setAttribute('depth','0.2');
  shelf.setAttribute('position','0 1.3 -2.2'); shelfRoot.appendChild(shelf);

  const title=document.createElement('a-entity');
  title.setAttribute('text',`value:เลือกอาหาร; align:center; color:#CFE8FF; width:6`);
  title.setAttribute('position','0 2.2 -2.21'); shelfRoot.appendChild(title);

  // กริดกล่องอาหาร
  const list = foods.filter(f => currentCat==='all' || f.category===currentCat);
  const cols=4;
  list.forEach((f,i)=>{
    const r=(i/cols|0), c=(i%cols);
    const x=-1.8 + c*1.2, y=1.8 - r*0.75;

    const box=document.createElement('a-box');
    box.setAttribute('color','#1e293b'); box.setAttribute('width','1.0'); box.setAttribute('height','0.6'); box.setAttribute('depth','0.25');
    box.setAttribute('position',`${x} ${y} -2.1`); box.setAttribute('opacity','0.9');
    box.setAttribute('class','food'); box.setAttribute('data-id', f.id);
    box.addEventListener('click', ()=>addToPlate(f.id));
    shelfRoot.appendChild(box);

    // ป้ายชื่อ
    const label=document.createElement('a-entity');
    label.setAttribute('text',`value:${f.name}; align:center; color:#fff; width:2.2`);
    label.setAttribute('position','0 -0.18 0.14');
    box.appendChild(label);

    // ไอคอน (png url / data: / หรือทำจากอีโมจิ)
    const icon=document.createElement('a-image');
    icon.setAttribute('width','0.8'); icon.setAttribute('height','0.36'); icon.setAttribute('position','0 0.08 0.13');
    icon.setAttribute('src', f.icon ? f.icon : makeIconPNG(f.emoji || '🍽️', '#0b1020'));
    box.appendChild(icon);

    // macro mini (kcal)
    const kcal=document.createElement('a-entity');
    kcal.setAttribute('text',`value:${f.kcal} kcal; align:center; color:#93c5fd; width:2`);
    kcal.setAttribute('position','0 -0.38 0.14');
    box.appendChild(kcal);
  });
}

//////////////////////
// Build Plate      //
//////////////////////
let plateItems = []; // instances: { iid, foodId }

function buildPlate(){
  while(plateRoot.firstChild) plateRoot.removeChild(plateRoot.firstChild);

  // โต๊ะ/จาน
  const table = document.createElement('a-cylinder');
  table.setAttribute('radius','0.7'); table.setAttribute('height','0.1'); table.setAttribute('color','#0f172a');
  table.setAttribute('position','0 0.8 -1.1'); plateRoot.appendChild(table);

  const plate = document.createElement('a-cylinder');
  plate.setAttribute('radius','0.55'); plate.setAttribute('height','0.04'); plate.setAttribute('color','#e5e7eb');
  plate.setAttribute('position','0 0.88 -1.1'); plateRoot.appendChild(plate);

  // วงแบ่งจาน (แนว MyPlate: คาร์บ/โปรตีน/ผัก/ผลไม้) — แค่ไกด์สายตา
  const guide = document.createElement('a-ring');
  guide.setAttribute('radius-inner','0.25'); guide.setAttribute('radius-outer','0.54');
  guide.setAttribute('color','#cbd5e1'); guide.setAttribute('opacity','0.35');
  guide.setAttribute('position','0 0.89 -1.1'); guide.setAttribute('rotation','-90 0 0');
  plateRoot.appendChild(guide);
}

function layoutPlate(){
  // จัดวางไอเท็มรอบ ๆ จาน (วงกลม)
  const R = 0.43;
  plateItems.forEach((it,idx)=>{
    const angle = (idx/Math.max(1,plateItems.length)) * Math.PI*2;
    const x = Math.cos(angle)*R, y = Math.sin(angle)*R;
    const node = document.getElementById(it.iid);
    if (node) node.setAttribute('position', `${x.toFixed(3)} ${ (0.95 + (idx%2)*0.02).toFixed(3)} -1.1`);
  });
}

function addToPlate(foodId){
  const f = foods.find(x=>x.id===foodId);
  if (!f) return;
  const iid = `p_${foodId}_${Date.now()}_${Math.floor(Math.random()*999)}`;
  plateItems.push({ iid, foodId });
  picked.push(f);

  // สร้างชิ้นอาหารบนจาน
  const item = document.createElement('a-image');
  item.setAttribute('id', iid);
  item.setAttribute('width','0.32'); item.setAttribute('height','0.18');
  item.setAttribute('class','pitem');
  item.setAttribute('position',`0 0.95 -1.1`);
  item.setAttribute('src', f.icon ? f.icon : makeIconPNG(f.emoji || '🍽️', '#e5e7eb'));
  item.addEventListener('click', ()=>removeFromPlate(iid));
  plateRoot.appendChild(item);

  // ขอบ/เงาใต้ไอเท็ม (สวยงาม)
  const shadow = document.createElement('a-ring');
  shadow.setAttribute('radius-inner','0.09'); shadow.setAttribute('radius-outer','0.13'); shadow.setAttribute('opacity','0.25');
  shadow.setAttribute('color','#000'); shadow.setAttribute('position',`0 0.90 -1.1`); shadow.setAttribute('rotation','-90 0 0');
  item.appendChild(shadow);

  SFX.ok();
  layoutPlate();
  recalcTotals();
}

function removeFromPlate(iid){
  const idx = plateItems.findIndex(x=>x.iid===iid);
  if (idx<0) return;
  const foodId = plateItems[idx].foodId;
  plateItems.splice(idx,1);

  const pidx = picked.findIndex(f=>f.id===foodId);
  if (pidx>=0) picked.splice(pidx,1);

  const node = document.getElementById(iid);
  if (node && node.parentNode) node.parentNode.removeChild(node);

  SFX.ui();
  layoutPlate();
  recalcTotals();
}

function resetPlate(){
  plateItems = []; picked = [];
  buildPlate();
  recalcTotals();
  SFX.ui();
}

//////////////////////
// Totals + HUD     //
//////////////////////
function recalcTotals(){
  totals = { kcal:0, carb:0, protein:0, fat:0, sugar:0, sodium:0 };
  picked.forEach(f=>{
    totals.kcal   += f.kcal||0;
    totals.carb   += f.carb||0;
    totals.protein+= f.protein||0;
    totals.fat    += f.fat||0;
    totals.sugar  += f.sugar||0;
    totals.sodium += f.sodium||0;
  });
  HUD.plateCount.textContent = String(picked.length);
  HUD.kcal.textContent  = `${round(totals.kcal)} kcal`;
  HUD.carb.textContent  = `${round(totals.carb)} g`;
  HUD.prot.textContent  = `${round(totals.protein)} g`;
  HUD.fat.textContent   = `${round(totals.fat)} g`;
  HUD.sugar.textContent = `${round(totals.sugar)} g`;
  HUD.na.textContent    = `${round(totals.sodium)} mg`;

  // สถานะง่าย ๆ สำหรับ ป.5 (เตือนน้ำตาล/โซเดียม/พลังงาน)
  const tips = [];
  if (totals.sugar > 24) tips.push('น้ำตาลสูง');
  if (totals.sodium > 1500) tips.push('โซเดียมสูง');
  if (totals.kcal > 700) tips.push('พลังงานสูง');
  HUD.status.innerHTML = tips.length ? `คำเตือน: <span class="bad">${tips.join(', ')}</span>` : 'ดีมาก! เลือกอาหารให้หลากหลายครบหมวด';
}

//////////////////////
// Import / Export  //
//////////////////////
function onImportFoodJSON(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.foods)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง ต้องมี fields: { foods: [...] }');
      foods = normalizeFoods(data.foods);
      buildShelf();
      SFX.ok();
      HUD.status.textContent = `โหลดอาหาร ${foods.length} รายการแล้ว`;
      track('ImportFoods', { count: foods.length });
    }catch(err){
      SFX.bad();
      HUD.status.textContent = 'Import ไม่สำเร็จ: ' + err.message;
    }finally{
      HUD.fileFoods.value = '';
    }
  };
  reader.readAsText(file);
}

function exportPlate(){
  const payload = {
    version: '1.0',
    game: GAME_ID,
    exportedAt: new Date().toISOString(),
    items: picked.map(f=>({ id:f.id, name:f.name, category:f.category, qty:1 })),
    totals: {...totals}
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const now = new Date(); const pad=n=>String(n).padStart(2,'0');
  const filename = `nutrition_plate_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);

  track('GameFinish', { items: picked.length, kcal: round(totals.kcal) });
}

//////////////////////
// Helpers          //
//////////////////////
function round(x){ return Math.round((+x||0)*10)/10; }
function normalizeFoods(arr){
  // รองรับ icon เป็น URL หรือ data:image/*; ถ้าไม่มีให้ใช้ emoji fallback
  return arr.map((f,i)=>({
    id: f.id || `f_${i}`,
    name: f.name || `Food ${i+1}`,
    category: f.category || 'main',
    emoji: f.emoji || '🍽️',
    icon: f.icon || null,
    kcal: +f.kcal || 0,
    carb: +f.carb || 0,
    protein: +f.protein || 0,
    fat: +f.fat || 0,
    sugar: +f.sugar || 0,
    sodium: +f.sodium || 0
  }));
}

function makeIconPNG(emoji='🍽️', bg='#111827'){
  const size=256,c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  g.fillStyle=bg; g.fillRect(0,0,size,size);
  g.fillStyle='rgba(255,255,255,.08)'; g.beginPath(); g.arc(size/2,size/2,size*0.45,0,Math.PI*2); g.fill();
  g.font=`${Math.floor(size*0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(emoji,size/2,size/2+size*0.04);
  return c.toDataURL('image/png');
}

function getDefaultFoods(){
  // ตัวอย่างรายการอาหารไทยพื้นฐาน (ต่อเสิร์ฟ)
  return normalizeFoods([
    {id:'rice',      name:'ข้าวสวย',        category:'main',   emoji:'🍚', kcal:160, carb:36, protein:3, fat:0.3, sugar:0, sodium:0},
    {id:'friedrice', name:'ข้าวผัด',        category:'main',   emoji:'🍛', kcal:420, carb:55, protein:10, fat:16, sugar:4, sodium:900},
    {id:'omelet',    name:'ไข่เจียว',       category:'protein',emoji:'🍳', kcal:220, carb:2,  protein:12, fat:18, sugar:1, sodium:300},
    {id:'pork',      name:'หมูผัดผัก',      category:'protein',emoji:'🥘', kcal:250, carb:8,  protein:18, fat:14, sugar:4, sodium:650},
    {id:'veg',       name:'ผักลวก',         category:'veg',    emoji:'🥦', kcal:60,  carb:8,  protein:3,  fat:1,  sugar:3, sodium:80},
    {id:'somtum',    name:'ส้มตำ',          category:'veg',    emoji:'🥗', kcal:120, carb:20, protein:3,  fat:2,  sugar:8, sodium:700},
    {id:'banana',    name:'กล้วย',          category:'fruit',  emoji:'🍌', kcal:105, carb:27, protein:1.3,fat:0.3,sugar:14,sodium:1},
    {id:'watermelon',name:'แตงโม',          category:'fruit',  emoji:'🍉', kcal:50,  carb:12, protein:1,  fat:0.2,sugar:9, sodium:2},
    {id:'milk',      name:'นมจืด',          category:'drink',  emoji:'🥛', kcal:110, carb:12, protein:8,  fat:4,  sugar:12,sodium:100},
    {id:'tea',       name:'ชานมหวาน',       category:'drink',  emoji:'🧋', kcal:250, carb:38, protein:3,  fat:8,  sugar:36,sodium:120},
    {id:'bread',     name:'ขนมปัง',         category:'snack',  emoji:'🍞', kcal:80,  carb:15, protein:3,  fat:1,  sugar:2, sodium:120},
    {id:'snack',     name:'ขนมกรุบกรอบ',   category:'snack',  emoji:'🍘', kcal:150, carb:16, protein:2,  fat:9,  sugar:2, sodium:180}
  ]);
}
