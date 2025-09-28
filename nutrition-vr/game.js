// Nutrition VR — No-Image Edition (Multiline HUD)
// - ไม่อ้างอิงไฟล์รูป ใช้อีโมจิแทน
// - HUD โภชนาการแยกเป็น 2 บรรทัด
// - OK click + Fuse(1200ms), Import/Export JSON

const GAME_ID = "Nutrition";
function track(eventName, props = {}) {
  try { if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } }); } catch(e){}
}

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

// ---------- อาหารเริ่มต้น (ไม่มี icon) ----------
let foods = [
  { id:'f001', name:'ข้าวสวย',       kcal:200, protein:4,  carb:44, fat:0.4 },
  { id:'f002', name:'แกงจืดเต้าหู้',   kcal:120, protein:8,  carb:6,  fat:6   },
  { id:'f003', name:'ผัดผักรวม',     kcal:150, protein:3,  carb:18, fat:7   },
  { id:'f004', name:'ไก่ย่าง',       kcal:165, protein:25, carb:0,  fat:6   },
  { id:'f005', name:'ไข่ต้ม',       kcal:78,  protein:6,  carb:0.6,fat:5   },
  { id:'f006', name:'ปลาย่าง',       kcal:160, protein:22, carb:0,  fat:7   },
  { id:'f007', name:'ผลไม้รวม',     kcal:90,  protein:1,  carb:22, fat:0.2 },
  { id:'f008', name:'นมจืด 1 กล่อง', kcal:130, protein:8,  carb:12, fat:4.5 }
];

let plate = []; // [{...food, qty}]

function clearEntity(root){ while(root.firstChild) root.removeChild(root.firstChild); }
function fmt(n){ return Math.round(n*10)/10; }

// ---------- อีโมจิแทนไอคอน ----------
function foodEmoji(name=''){
  const n = name.toLowerCase();
  if (n.includes('ข้าว')) return '🍚';
  if (n.includes('ปลา')) return '🐟';
  if (n.includes('ไก่')) return '🍗';
  if (n.includes('หมู')) return '🥩';
  if (n.includes('ผัก') || n.includes('สลัด')) return '🥗';
  if (n.includes('เต้าหู้') || n.includes('ซุป')) return '🍲';
  if (n.includes('ไข่')) return '🥚';
  if (n.includes('ผลไม้') || n.includes('กล้วย') || n.includes('แอปเปิ้ล')) return '🍎';
  if (n.includes('นม')) return '🥛';
  return '🍽️';
}

// ---------- ชั้นวาง (ใหญ่/ชัด + แผงหลัง) ----------
function renderShelf(){
  clearEntity(shelfRoot);

  const backdrop = document.createElement('a-plane');
  backdrop.setAttribute('width','2.6');
  backdrop.setAttribute('height','1.6');
  backdrop.setAttribute('color','#0a0f1a');
  backdrop.setAttribute('position','0 0 -0.02');
  backdrop.setAttribute('material','shader: flat; opacity: 0.95');
  shelfRoot.appendChild(backdrop);

  const shelf = document.createElement('a-box');
  shelf.setAttribute('width','2.4'); shelf.setAttribute('height','0.06'); shelf.setAttribute('depth','0.45');
  shelf.setAttribute('color','#0b1220'); shelf.setAttribute('position','0 -0.2 0');
  shelfRoot.appendChild(shelf);

  const cols = 3, gapX = 0.75, gapY = 0.48;
  foods.forEach((f, i)=>{
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols-1)/2) * gapX;
    const y = 0.55 - row * gapY;

    const card = createFoodCard(f);
    card.setAttribute('position', `${x} ${y} 0.01`);
    shelfRoot.appendChild(card);
  });

  const title = document.createElement('a-entity');
  title.setAttribute('text', 'value:เลือกเมนูจากชั้นวาง; width:5; color:#E8F0FF; align:center');
  title.setAttribute('position','0 0.95 0.01');
  shelfRoot.appendChild(title);
}

// ---------- การ์ดอาหาร (ไม่มี <a-image> ใช้ emoji + ข้อความ) ----------
function createFoodCard(food){
  const card = document.createElement('a-entity');
  card.classList.add('clickable','food');

  card.setAttribute('geometry', 'primitive: plane; width: 0.68; height: 0.36');
  card.setAttribute('material', 'color: #111827; opacity: 0.98; shader: flat; transparent:true');

  const shadow = document.createElement('a-plane');
  shadow.setAttribute('width','0.72'); shadow.setAttribute('height','0.40');
  shadow.setAttribute('position','0 0 -0.001');
  shadow.setAttribute('color','#000'); shadow.setAttribute('opacity','0.25');
  shadow.setAttribute('material','shader: flat');
  card.appendChild(shadow);

  const emoji = document.createElement('a-entity');
  emoji.setAttribute('text', `value:${foodEmoji(food.name)}; width:2.2; align:center; color:#fff`);
  emoji.setAttribute('position','-0.20 0 0.002');
  card.appendChild(emoji);

  const txt = `${food.name}\n${fmt(food.kcal)} kcal`;
  const label = document.createElement('a-entity');
  label.setAttribute('text', `value:${txt}; width:2.8; color:#F5F7FF; align:left; baseline:top`);
  label.setAttribute('position','-0.02 0.10 0.002');
  card.appendChild(label);

  card.addEventListener('click', ()=> addToPlate(food));
  card.addEventListener('mouseenter', ()=> card.setAttribute('scale','1.05 1.05 1'));
  card.addEventListener('mouseleave', ()=> card.setAttribute('scale','1 1 1'));

  return card;
}

// ---------- จาน (อีโมจิ + ตัวหนังสือใหญ่) ----------
function renderPlate(){
  clearEntity(plateRoot);

  const base = document.createElement('a-circle');
  base.setAttribute('radius','0.65'); base.setAttribute('color','#0b1220');
  base.setAttribute('rotation','-90 0 0'); base.setAttribute('position','0 -0.35 0');
  plateRoot.appendChild(base);

  const head = document.createElement('a-entity');
  head.setAttribute('text','value:จานของฉัน (คลิกรายการเพื่อลดจำนวน/เอาออก); width:5.5; color:#E8F0FF; align:center');
  head.setAttribute('position','0 0.55 0.02');
  plateRoot.appendChild(head);

  const cols = 2, gapX = 0.5, gapY = 0.36;
  plate.forEach((p, i)=>{
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols-1)/2) * gapX;
    const y = 0.22 - row * gapY;

    const item = document.createElement('a-entity');
    item.classList.add('clickable','plate-item');
    item.setAttribute('geometry','primitive: plane; width: 0.58; height: 0.28');
    item.setAttribute('material','color:#0f172a; opacity:0.98; shader:flat; transparent:true');
    item.setAttribute('position', `${x} ${y} 0.02`);

    const emoji = document.createElement('a-entity');
    emoji.setAttribute('text', `value:${foodEmoji(p.name)}; width:2.2; align:center; color:#fff`);
    emoji.setAttribute('position','-0.20 0 0.002');
    item.appendChild(emoji);

    const txt = `${p.name} ×${p.qty}\n${fmt(p.kcal*p.qty)} kcal`;
    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${txt}; width:2.6; color:#DDE7FF; align:left; baseline:top`);
    label.setAttribute('position','-0.06 0.08 0.002');
    item.appendChild(label);

    item.addEventListener('click', ()=> removeFromPlate(p.id));
    item.addEventListener('mouseenter', ()=> item.setAttribute('scale','1.03 1.03 1'));
    item.addEventListener('mouseleave', ()=> item.setAttribute('scale','1 1 1'));
    plateRoot.appendChild(item);
  });
}

// ---------- ตะกร้าใส่-เอาออก ----------
function addToPlate(food){
  const f = plate.find(x=>x.id===food.id);
  if (f) f.qty += 1;
  else plate.push({ ...food, qty:1 });
  renderPlate(); updateTotalsHUD();
  track('AddFood', { id: food.id, name: food.name });
}
function removeFromPlate(foodId){
  const idx = plate.findIndex(p=>p.id===foodId);
  if (idx>=0){
    if (plate[idx].qty>1) plate[idx].qty -= 1;
    else plate.splice(idx,1);
    renderPlate(); updateTotalsHUD();
    track('RemoveFood', { id: foodId });
  }
}

// ---------- HUD รวมโภชนาการ (แยกบรรทัด) ----------
function updateTotalsHUD(){
  const total = plate.reduce((a, p)=>{
    a.kcal   += (p.kcal||0)   * p.qty;
    a.protein+= (p.protein||0)* p.qty;
    a.carb   += (p.carb||0)   * p.qty;
    a.fat    += (p.fat||0)    * p.qty;
    return a;
  }, {kcal:0,protein:0,carb:0,fat:0});

  // ทำให้ขึ้นบรรทัดใหม่เสมอ
  totalsText.style.whiteSpace = 'pre-line';
  totalsText.textContent =
    `${fmt(total.kcal)} kcal\n` +
    `P:${fmt(total.protein)}g  C:${fmt(total.carb)}g  F:${fmt(total.fat)}g`;

  return total;
}

// ---------- Import / Export ----------
BTN.file.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON ต้องเป็นอาเรย์ของอาหาร');
    foods = data.map(x=>({
      id: String(x.id || crypto.randomUUID()),
      name: String(x.name || 'เมนู'),
      kcal: +x.kcal||0, protein:+x.protein||0, carb:+x.carb||0, fat:+x.fat||0
    }));
    renderShelf();
    track('ImportMenu', { count: foods.length });
    alert('อัปเดตเมนูเรียบร้อย (ไม่ใช้รูป)');
  }catch(err){
    alert('นำเข้าเมนูไม่สำเร็จ: ' + err.message);
  } finally { e.target.value = ''; }
});

BTN.sample.onclick = ()=>{
  const sample = [
    { id:'r01', name:'ข้าวกล้อง', kcal:220, protein:5, carb:46, fat:1 },
    { id:'c01', name:'ต้มจืดสาหร่าย', kcal:95, protein:6, carb:5, fat:4 },
    { id:'m01', name:'หมูอบ', kcal:210, protein:20, carb:6, fat:12 },
    { id:'v01', name:'ยำวุ้นเส้น', kcal:160, protein:9, carb:24, fat:3 },
    { id:'f01', name:'กล้วย', kcal:89, protein:1.1, carb:23, fat:0.3 }
  ];
  foods = sample; renderShelf(); alert('โหลดเมนูตัวอย่างแล้ว (แบบไม่ใช้รูป)');
};

BTN.export.onclick = ()=>{
  const total = updateTotalsHUD();
  const payload = {
    version: '1.2-noimg-ml',
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

// ---------- Start / Reset ----------
BTN.start.onclick = ()=>{ running=true; renderShelf(); renderPlate(); updateTotalsHUD(); track('GameStart', {}); };
BTN.reset.onclick = ()=>{ plate=[]; renderPlate(); updateTotalsHUD(); track('ResetPlate', {}); };

// boot
renderShelf(); renderPlate(); updateTotalsHUD();
