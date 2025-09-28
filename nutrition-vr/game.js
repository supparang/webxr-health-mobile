// Nutrition VR — game.js
// เลือกเมนูจากชั้นวาง → ใส่จาน | Import รายการจาก JSON | Export จานที่จัดเสร็จเป็น JSON
// พร้อม OK click + Fuse(1200ms), ศีรษะเล็ง, ไอคอน PNG

//////////////////////
// Analytics Helper //
//////////////////////
const GAME_ID = "Nutrition";
function track(eventName, props = {}) {
  try { if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } }); } catch(e){}
}

//////////////////////
// DOM Refs & HUD   //
//////////////////////
const $ = id => document.getElementById(id);
const shelfRoot = $('shelfRoot');
const plateRoot = $('plateRoot');
const totalsText = $('totalsText');

const BTN = {
  start: $('btnStart'),
  reset: $('btnReset'),
  export: $('btnExport'),
  sample: $('btnSample'),
  file: $('fileInput')
};

let running = false;

//////////////////////
// Data Structures  //
//////////////////////
// โครงรายการอาหาร (ค่าเริ่มต้น — สามารถแทนที่ด้วย Import JSON)
let foods = [
  { id:'f001', name:'ข้าวสวย',     kcal:200, protein:4,  carb:44, fat:0.4, icon:'assets/icons/rice.png' },
  { id:'f002', name:'แกงจืดเต้าหู้', kcal:120, protein:8,  carb:6,  fat:6,   icon:'assets/icons/tofu-soup.png' },
  { id:'f003', name:'ผัดผักรวม',   kcal:150, protein:3,  carb:18, fat:7,   icon:'assets/icons/veggies.png' },
  { id:'f004', name:'ไก่ย่าง',     kcal:165, protein:25, carb:0,  fat:6,   icon:'assets/icons/chicken.png' },
  { id:'f005', name:'ไข่ต้ม',     kcal:78,  protein:6,  carb:0.6,fat:5,   icon:'assets/icons/egg.png' },
  { id:'f006', name:'ปลาย่าง',     kcal:160, protein:22, carb:0,  fat:7,   icon:'assets/icons/fish.png' },
  { id:'f007', name:'ผลไม้รวม',   kcal:90,  protein:1,  carb:22, fat:0.2, icon:'assets/icons/fruit.png' },
  { id:'f008', name:'นมจืด 1 กล่อง', kcal:130, protein:8, carb:12, fat:4.5, icon:'assets/icons/milk.png' }
];

// จานที่เลือก
let plate = []; // [{id,name,kcal,protein,carb,fat,icon,qty}]

//////////////////////
// Helpers          //
//////////////////////
function clearEntity(root){ while(root.firstChild) root.removeChild(root.firstChild); }
function fmt(n){ return Math.round(n*10)/10; }

//////////////////////
// Shelf Rendering  //
//////////////////////
function renderShelf(){
  clearEntity(shelfRoot);

  // พื้นชั้นวาง
  const shelf = document.createElement('a-box');
  shelf.setAttribute('width','2.4'); shelf.setAttribute('height','0.05'); shelf.setAttribute('depth','0.4');
  shelf.setAttribute('color','#0b1220'); shelf.setAttribute('position','0 -0.1 0');
  shelfRoot.appendChild(shelf);

  const cols = 4, gapX = 0.56, gapY = 0.42;
  foods.forEach((f, i)=>{
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols-1)/2) * gapX;
    const y = 0.45 - row * gapY;

    const card = createFoodCard(f);
    card.setAttribute('position', `${x} ${y} 0.02`); // อยู่เหนือชั้นเล็กน้อย
    shelfRoot.appendChild(card);
  });

  // ป้ายหัวข้อ
  const title = document.createElement('a-entity');
  title.setAttribute('text', 'value:เลือกเมนูจากชั้นวาง; width:5; color:#CFE8FF; align:center');
  title.setAttribute('position','0 0.9 0.02');
  shelfRoot.appendChild(title);
}

function createFoodCard(food){
  const card = document.createElement('a-entity');
  card.classList.add('clickable','food');
  card.setAttribute('geometry', 'primitive: plane; width: 0.46; height: 0.26');
  card.setAttribute('material', 'color: #111827; opacity: 0.95; shader: flat; transparent:true');

  // ไอคอน (ถ้าไม่มีไฟล์ PNG ก็จะแสดงเป็นพื้นสีกล่องเฉย ๆ)
  const icon = document.createElement('a-image');
  if (food.icon) icon.setAttribute('src', food.icon);
  icon.setAttribute('width','0.18'); icon.setAttribute('height','0.18');
  icon.setAttribute('position','-0.12 0 0.001');
  card.appendChild(icon);

  const txt = `${food.name}\n${fmt(food.kcal)} kcal`;
  const label = document.createElement('a-entity');
  label.setAttribute('text', `value:${txt}; width:1.8; color:#e5e7eb; align:left`);
  label.setAttribute('position','0.02 0.03 0.001');
  card.appendChild(label);

  card.addEventListener('click', ()=> addToPlate(food));
  card.addEventListener('mouseenter', ()=> card.setAttribute('scale','1.04 1.04 1'));
  card.addEventListener('mouseleave', ()=> card.setAttribute('scale','1 1 1'));

  return card;
}

//////////////////////
// Plate Rendering  //
//////////////////////
function renderPlate(){
  clearEntity(plateRoot);

  // ฐานจาน
  const base = document.createElement('a-circle');
  base.setAttribute('radius','0.55'); base.setAttribute('color','#0b1220');
  base.setAttribute('rotation','-90 0 0'); base.setAttribute('position','0 -0.35 0');
  plateRoot.appendChild(base);

  // ป้าย
  const head = document.createElement('a-entity');
  head.setAttribute('text','value:จานของฉัน (คลิกรายการเพื่อลดจำนวน/เอาออก); width:5; color:#CFE8FF; align:center');
  head.setAttribute('position','0 0.45 0.02');
  plateRoot.appendChild(head);

  const cols = 3, gapX = 0.38, gapY = 0.30;
  plate.forEach((p, i)=>{
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols-1)/2) * gapX;
    const y = 0.18 - row * gapY;

    const item = document.createElement('a-entity');
    item.classList.add('clickable','plate-item');
    item.setAttribute('geometry','primitive: plane; width: 0.34; height: 0.20');
    item.setAttribute('material','color:#0f172a; opacity:0.96; shader:flat; transparent:true');
    item.setAttribute('position', `${x} ${y} 0.02`);

    const icon = document.createElement('a-image');
    if (p.icon) icon.setAttribute('src', p.icon);
    icon.setAttribute('width','0.14'); icon.setAttribute('height','0.14');
    icon.setAttribute('position','-0.08 0 0.001');
    item.appendChild(icon);

    const txt = `${p.name} ×${p.qty}\n${fmt(p.kcal*p.qty)} kcal`;
    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${txt}; width:1.6; color:#cbd5e1; align:left`);
    label.setAttribute('position','0.02 0.02 0.001');
    item.appendChild(label);

    // คลิกเพื่อลดจำนวน 1 (ถ้าเหลือ 1 จะลบออก)
    item.addEventListener('click', ()=> removeFromPlate(p.id));

    plateRoot.appendChild(item);
  });
}

//////////////////////
// Plate Logic      //
//////////////////////
function addToPlate(food){
  const f = plate.find(x=>x.id===food.id);
  if (f) f.qty += 1;
  else plate.push({ ...food, qty:1 });

  renderPlate();
  updateTotalsHUD();
  track('AddFood', { id: food.id, name: food.name });
}

function removeFromPlate(foodId){
  const idx = plate.findIndex(p=>p.id===foodId);
  if (idx>=0){
    if (plate[idx].qty>1) plate[idx].qty -= 1;
    else plate.splice(idx,1);
    renderPlate();
    updateTotalsHUD();
    track('RemoveFood', { id: foodId });
  }
}

function updateTotalsHUD(){
  const total = plate.reduce((a, p)=>{
    a.kcal   += (p.kcal||0)   * p.qty;
    a.protein+= (p.protein||0)* p.qty;
    a.carb   += (p.carb||0)   * p.qty;
    a.fat    += (p.fat||0)    * p.qty;
    return a;
  }, {kcal:0,protein:0,carb:0,fat:0});
  totalsText.textContent = `${fmt(total.kcal)} kcal | P:${fmt(total.protein)}g C:${fmt(total.carb)}g F:${fmt(total.fat)}g`;
  return total;
}

//////////////////////
// Import / Export  //
//////////////////////
BTN.file.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON ต้องเป็นอาเรย์ของอาหาร');
    // คาดหวังโครง: {id,name,kcal,protein,carb,fat,icon}
    foods = data.map(x=>({
      id: String(x.id||crypto.randomUUID()),
      name: String(x.name||'เมนู'),
      kcal: +x.kcal||0, protein:+x.protein||0, carb:+x.carb||0, fat:+x.fat||0,
      icon: x.icon ? String(x.icon) : ''
    }));
    renderShelf();
    track('ImportMenu', { count: foods.length });
    alert('อัปเดตเมนูเรียบร้อย');
  }catch(err){
    alert('นำเข้าเมนูไม่สำเร็จ: ' + err.message);
  } finally {
    e.target.value = ''; // clear input
  }
});

BTN.sample.onclick = ()=>{
  // ตัวอย่างโครง JSON ที่โรงเรียนสามารถใช้
  const sample = [
    { id:'r01', name:'ข้าวกล้อง', kcal:220, protein:5, carb:46, fat:1, icon:'assets/icons/brown-rice.png' },
    { id:'c01', name:'ต้มจืดสาหร่าย', kcal:95, protein:6, carb:5, fat:4, icon:'assets/icons/seaweed-soup.png' },
    { id:'m01', name:'หมูอบ', kcal:210, protein:20, carb:6, fat:12, icon:'assets/icons/pork.png' },
    { id:'v01', name:'ยำวุ้นเส้น', kcal:160, protein:9, carb:24, fat:3, icon:'assets/icons/glass-noodle.png' },
    { id:'f01', name:'กล้วย', kcal:89, protein:1.1, carb:23, fat:0.3, icon:'assets/icons/banana.png' }
  ];
  foods = sample;
  renderShelf();
  alert('โหลดเมนูตัวอย่างแล้ว');
};

BTN.export.onclick = ()=>{
  const total = updateTotalsHUD();
  const payload = {
    version: '1.0',
    game: GAME_ID,
    exportedAt: new Date().toISOString(),
    items: plate.map(p=>({ id:p.id, name:p.name, qty:p.qty, kcal:p.kcal, protein:p.protein, carb:p.carb, fat:p.fat })),
    total
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const now=new Date(); const pad=n=>String(n).padStart(2,'0');
  const filename=`nutrition_plate_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
  track('ExportPlate', { count: plate.length, kcal: total.kcal });
};

//////////////////////
// Start / Reset    //
//////////////////////
BTN.start.onclick = ()=>{
  running = true;
  renderShelf();
  renderPlate();
  updateTotalsHUD();
  track('GameStart', {});
};

BTN.reset.onclick = ()=>{
  plate = [];
  renderPlate();
  updateTotalsHUD();
  track('ResetPlate', {});
};

// เริ่มต้นแสดงผล (ยังไม่จำเป็นต้องกด Start ก็เห็นชั้นวางได้)
renderShelf();
renderPlate();
updateTotalsHUD();
