// Nutrition Traffic Light VR (Images, Fixed Z-Layers)
// แก้ปัญหาภาพโดนบังด้วยลำดับ Z ภายในการ์ด: back < border < image < text

const GAME_ID = "Nutrition-Traffic-Images";
function track(name, props={}){ try{ if(window.plausible) plausible(name,{props:{game:GAME_ID,...props}}) }catch(e){} }

const $ = id => document.getElementById(id);
const hudText = $('hudText');
const btn = { start: $('btnStart'), reset: $('btnReset') };
const gameRoot = document.getElementById('gameRoot');

let running = false;
let timeLeft = 60;
let score = 0;
let lives = 3;
let totalItems = 0;
let timerId = null;

// ชั้นเลเยอร์ภายในการ์ด/ป้าย (ค่าคงที่ ป้องกัน z-fighting/ถูกปิดทับ)
const ZL = { back: 0.000, border: 0.006, image: 0.010, text: 0.014 };

// ข้อมูลอาหาร (imgId ต้องตรงกับ id ใน <a-assets>)
const FOODS = [
  {name:'ข้าวกล้อง',        emoji:'🍚', tag:'green',  imgId:'#img-rice-brown'},
  {name:'ปลาอบ',            emoji:'🐟', tag:'green',  imgId:'#img-fish-bake'},
  {name:'ผัดผัก',           emoji:'🥗', tag:'green',  imgId:'#img-veggies'},
  {name:'ผลไม้รวม',         emoji:'🍎', tag:'green',  imgId:'#img-fruit-mix'},

  {name:'ไก่ย่าง',          emoji:'🍗', tag:'yellow', imgId:'#img-chicken-grill'},
  {name:'นมจืด',            emoji:'🥛', tag:'yellow', imgId:'#img-milk-plain'},
  {name:'แกงจืด',           emoji:'🍲', tag:'yellow', imgId:'#img-soup-clear'},
  {name:'ข้าวขาว',         emoji:'🍚', tag:'yellow', imgId:'#img-rice-white'},

  {name:'ของทอด',           emoji:'🍟', tag:'red',    imgId:'#img-fried'},
  {name:'น้ำอัดลม',         emoji:'🥤', tag:'red',    imgId:'#img-soda'},
  {name:'ขนมหวาน',         emoji:'🍰', tag:'red',    imgId:'#img-dessert'},
  {name:'มันฝรั่งทอดกรอบ',  emoji:'🍿', tag:'red',    imgId:'#img-chips'}
];

function randFood(){ return FOODS[Math.floor(Math.random()*FOODS.length)]; }
function setHUD(line1, line2=""){ hudText.style.whiteSpace='pre-line'; hudText.textContent = line1 + (line2?`\n${line2}`:''); }
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

// ป้ายหันหากล้องเสมอ
AFRAME.registerComponent('billboard',{
  tick(){ const cam=document.querySelector('[camera]'); if(!cam) return;
    const v=new THREE.Vector3(); cam.object3D.getWorldPosition(v); this.el.object3D.lookAt(v); }
});

// === สร้างฉากหลัก ===
let bins = {}; // {green, yellow, red}
let itemNode = null;

function buildScene(){
  clearChildren(gameRoot);

  // แถวถังสามสี
  const lane = document.createElement('a-entity');
  lane.setAttribute('position','0 -0.15 0');
  gameRoot.appendChild(lane);

  bins.green = makeBin('เขียว กินบ่อย',  '#16a34a', -1.0);
  bins.yellow= makeBin('เหลือง พอเหมาะ', '#f59e0b',  0.0);
  bins.red   = makeBin('แดง กินน้อย',    '#ef4444',  1.0);
  lane.appendChild(bins.green);
  lane.appendChild(bins.yellow);
  lane.appendChild(bins.red);

  // โหนดอาหารปัจจุบัน
  itemNode = document.createElement('a-entity');
  itemNode.setAttribute('position','0 0.55 0');
  gameRoot.appendChild(itemNode);
}

function makeBin(label, color, x){
  const bin = document.createElement('a-entity');
  bin.setAttribute('position', `${x} 0 0`);

  // พื้นหลังป้าย (back)
  const panel = document.createElement('a-plane');
  panel.classList.add('selectable');
  panel.setAttribute('width','1.2'); panel.setAttribute('height','0.62');
  panel.setAttribute('material', `color:${color}; shader:flat; transparent:true; opacity:0.38; alphaTest:0.01`);
  panel.setAttribute('billboard','');
  panel.setAttribute('position', `0 0 ${ZL.back}`);
  bin.appendChild(panel);

  // กรอบด้านใน (border)
  const inner = document.createElement('a-plane');
  inner.setAttribute('width','1.14'); inner.setAttribute('height','0.56');
  inner.setAttribute('material', 'color:#0f172a; shader:flat; transparent:true; opacity:0.98; alphaTest:0.01');
  inner.setAttribute('position', `0 0 ${ZL.border}`);
  bin.appendChild(inner);

  // ข้อความป้าย (text)
  const txt = document.createElement('a-entity');
  txt.setAttribute('text', `value:${label}; width: 5.2; align:center; color:#EAF2FF`);
  txt.setAttribute('position', `0 0 ${ZL.text}`);
  bin.appendChild(txt);

  // คลิก/ฟิวส์ เลือกถัง
  panel.addEventListener('click', ()=>{
    if(!running) return;
    gradeChoice(bin===bins.green?'green':bin===bins.yellow?'yellow':'red');
  });

  return bin;
}

// === แสดงอาหาร (ภาพจริง + fallback อีโมจิ ถ้าไฟล์หาย) ===
let currentFood = null;

function imageExistsById(idSelector){
  const el = document.querySelector(idSelector);
  return !!(el && el.naturalWidth && el.naturalHeight);
}

function showNewFood(){
  if(!itemNode) return;
  clearChildren(itemNode);
  currentFood = randFood();
  totalItems += 1;

  const card = document.createElement('a-entity');
  card.setAttribute('position','0 0 0');

  // พื้นหลังการ์ด (back)
  const back = document.createElement('a-plane');
  back.setAttribute('width','1.8'); back.setAttribute('height','1.1');
  back.setAttribute('material','color:#101826; shader:flat; transparent:true; opacity:0.98; alphaTest:0.01');
  back.setAttribute('position', `0 0 ${ZL.back}`);
  card.appendChild(back);

  // กรอบรูป (border)
  const border = document.createElement('a-plane');
  border.setAttribute('width','1.44'); border.setAttribute('height','0.84');
  border.setAttribute('material','color:#0d1424; shader:flat; transparent:true; opacity:0.6; alphaTest:0.01');
  border.setAttribute('position', `0 0.10 ${ZL.border}`);
  card.appendChild(border);

  const hasImg = imageExistsById(currentFood.imgId);
  if(hasImg){
    // รูปอาหาร (image)
    const pic = document.createElement('a-image');
    pic.setAttribute('src', currentFood.imgId);
    pic.setAttribute('width','1.4'); pic.setAttribute('height','0.8');
    pic.setAttribute('position', `0 0.10 ${ZL.image}`);
    pic.setAttribute('material','shader:flat; transparent:true; alphaTest:0.01');
    card.appendChild(pic);
  }else{
    // Fallback อีโมจิ (text) ถ้ารูปไม่เจอ
    const emoji = document.createElement('a-entity');
    emoji.setAttribute('text', `value:${currentFood.emoji}; width: 6.4; align:center; color:#ffffff`);
    emoji.setAttribute('position', `0 0.10 ${ZL.text}`);
    card.appendChild(emoji);
  }

  // ชื่ออาหาร (text)
  const label = document.createElement('a-entity');
  label.setAttribute('text', `value:${currentFood.name}; width: 6.0; align:center; color:#EAF2FF`);
  label.setAttribute('position', `0 -0.28 ${ZL.text}`);
  card.appendChild(label);

  // คำแนะนำ (text)
  const guide = document.createElement('a-entity');
  guide.setAttribute('text', `value:เลือกถังที่เหมาะสม; width: 5.8; align:center; color:#9fb4ff`);
  guide.setAttribute('position', `0 -0.46 ${ZL.text}`);
  card.appendChild(guide);

  itemNode.appendChild(card);
  updateHUD();
}

// === ตรวจคำตอบ ===
function gradeChoice(choiceTag){
  if(!currentFood) return;
  const ok = currentFood.tag === choiceTag;
  if(ok){ score += 2; flashBin(choiceTag, true); track('Answer',{ok:true, tag:choiceTag}); }
  else { lives -= 1; flashBin(choiceTag, false); track('Answer',{ok:false, want:currentFood.tag, picked:choiceTag}); }

  if(lives <= 0){ finishGame(); return; }
  if(totalItems >= 20){ finishGame(); return; }
  showNewFood();
}

function flashBin(tag, ok){
  const bin = tag==='green'?bins.green:tag==='yellow'?bins.yellow:bins.red;
  const panel = bin.children[0];
  panel.setAttribute('animation__flash', `property: material.opacity; from: 0.38; to: ${ok?0.85:0.15}; dur: 160; dir: alternate; easing: easeOutQuad`);
  const txt = bin.children[2];
  txt.setAttribute('animation__scale', 'property: scale; to: 1.06 1.06 1; dur: 140; dir: alternate; easing: easeOutQuad');
}

// === HUD / Timer ===
function updateHUD(){
  const line1 = `เวลา  ${timeLeft} วิ   คะแนน  ${score}   หัวใจ  ${'❤️'.repeat(lives)}${'🤍'.repeat(Math.max(0,3-lives))}`;
  const line2 = `ชิ้นที่  ${totalItems}  จาก  20`;
  setHUD(line1, line2);
}
function startTimer(){
  timeLeft = 60;
  timerId = setInterval(()=>{
    if(!running) return;
    timeLeft -= 1; updateHUD();
    if(timeLeft<=0) finishGame();
  }, 1000);
}

// === Flow ===
function startGame(){
  running = true; score = 0; lives = 3; totalItems = 0;
  buildScene();
  showNewFood();
  startTimer();
  btn.start.textContent = 'Finish';
  track('GameStart',{});
}
function finishGame(){
  running = false;
  if(timerId){ clearInterval(timerId); timerId = null; }
  btn.start.textContent = 'Start';

  let stars = 1, face='🙂', msg='พยายามดี ลองใหม่อีกครั้ง';
  if(score >= 30){ stars=3; face='😊'; msg='ยอดเยี่ยม! จัดแยกได้ถูกต้องมาก'; }
  else if(score >= 20){ stars=2; face='😃'; msg='ดีมาก! ใกล้เคียงแล้ว'; }

  setHUD(`${face}  ${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}\n${msg}`, `คะแนนทั้งหมด  ${score}`);
  track('GameFinish',{score, items: totalItems, timeLeft});
}
function resetGame(){
  running = false;
  if(timerId){ clearInterval(timerId); timerId = null; }
  clearChildren(gameRoot);
  setHUD('พร้อมเริ่ม');
  btn.start.textContent = 'Start';
  track('Reset',{});
}

// ปุ่ม
btn.start.onclick = ()=>{ if(!running) startGame(); else finishGame(); };
btn.reset.onclick = resetGame;

// เริ่มต้น
resetGame();
