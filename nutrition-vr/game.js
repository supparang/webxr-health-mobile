// Nutrition Traffic Light VR — Fixed visibility (big text/emoji, clear Z layers)

const GAME_ID = "Nutrition-Traffic";
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

// ===== Data =====
// tag: green = กินบ่อย, yellow = พอเหมาะ, red = น้อย ๆ
const FOODS = [
  {name:'ข้าวกล้อง', emoji:'🍚', tag:'green'},
  {name:'ปลาอบ', emoji:'🐟', tag:'green'},
  {name:'ผัดผัก', emoji:'🥗', tag:'green'},
  {name:'ผลไม้', emoji:'🍎', tag:'green'},

  {name:'ไก่ย่าง', emoji:'🍗', tag:'yellow'},
  {name:'นมจืด', emoji:'🥛', tag:'yellow'},
  {name:'แกงจืด', emoji:'🍲', tag:'yellow'},
  {name:'ข้าวขาว', emoji:'🍚', tag:'yellow'},

  {name:'ของทอด', emoji:'🍟', tag:'red'},
  {name:'น้ำอัดลม', emoji:'🥤', tag:'red'},
  {name:'ขนมหวาน', emoji:'🍰', tag:'red'},
  {name:'มันฝรั่งทอดกรอบ', emoji:'🍿', tag:'red'}
];

// ===== Utils =====
function randFood(){ return FOODS[Math.floor(Math.random()*FOODS.length)]; }
function setHUD(line1, line2=""){ hudText.style.whiteSpace='pre-line'; hudText.textContent = line1 + (line2?`\n${line2}`:''); }
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

// billboard: ให้ป้ายหันหากล้องเสมอ
AFRAME.registerComponent('billboard',{
  tick(){ const cam=document.querySelector('[camera]'); if(!cam) return;
    const v=new THREE.Vector3(); cam.object3D.getWorldPosition(v); this.el.object3D.lookAt(v); }
});

// ===== Build Scene =====
let bins = {}; // {green, yellow, red}
let itemNode = null;
const ZL = { back: 0.000, inner: 0.010, text: 0.012 }; // ชั้นระยะ Z ภายในการ์ด/ป้าย

function buildScene(){
  clearChildren(gameRoot);

  // แถวถังสามสี (อยู่ที่ระยะ -2 เมตร แล้ว แต่ gameRoot ยกให้แล้ว)
  const lane = document.createElement('a-entity');
  lane.setAttribute('position','0 -0.15 0');
  gameRoot.appendChild(lane);

  bins.green = makeBin('เขียว กินบ่อย', '#16a34a', -1.0);
  bins.yellow= makeBin('เหลือง พอเหมาะ', '#f59e0b',  0.0);
  bins.red   = makeBin('แดง กินน้อย', '#ef4444',  1.0);
  lane.appendChild(bins.green);
  lane.appendChild(bins.yellow);
  lane.appendChild(bins.red);

  // อาหารชิ้นปัจจุบัน (อยู่กลางจอ เหนือขึ้นนิด)
  itemNode = document.createElement('a-entity');
  itemNode.setAttribute('position','0 0.55 0');
  gameRoot.appendChild(itemNode);
}

function makeBin(label, color, x){
  const bin = document.createElement('a-entity');
  bin.setAttribute('position', `${x} 0 0`);

  // พื้นหลังป้ายใหญ่ (อ่านชัด)
  const panel = document.createElement('a-plane');
  panel.classList.add('selectable');
  panel.setAttribute('width','1.2'); panel.setAttribute('height','0.62');
  panel.setAttribute('material', `color:${color}; opacity:0.38; shader:flat; transparent:true`);
  panel.setAttribute('billboard','');
  panel.setAttribute('position', `0 0 ${ZL.back}`);
  bin.appendChild(panel);

  // แผ่นในเข้ม
  const inner = document.createElement('a-plane');
  inner.setAttribute('width','1.14'); inner.setAttribute('height','0.56');
  inner.setAttribute('material', 'color:#0f172a; shader:flat; transparent:true; opacity:0.98');
  inner.setAttribute('position', `0 0 ${ZL.inner}`);
  bin.appendChild(inner);

  // ข้อความใหญ่
  const txt = document.createElement('a-entity');
  txt.setAttribute('text', `value:${label}; width: 5.2; align:center; color:#EAF2FF`);
  txt.setAttribute('position', `0 0 ${ZL.text}`);
  bin.appendChild(txt);

  // คลิก/ฟิวส์
  panel.addEventListener('click', ()=>{
    if(!running) return;
    gradeChoice(bin===bins.green?'green':bin===bins.yellow?'yellow':'red');
  });

  return bin;
}

// ===== Item show =====
let currentFood = null;

function showNewFood(){
  if(!itemNode) return;
  clearChildren(itemNode);
  currentFood = randFood();
  totalItems += 1;

  const card = document.createElement('a-entity');
  card.setAttribute('position','0 0 0');

  // การ์ดใหญ่ชัด
  const back = document.createElement('a-plane');
  back.setAttribute('width','1.6'); back.setAttribute('height','0.8');
  back.setAttribute('material','color:#111827; shader:flat; transparent:true; opacity:0.98');
  back.setAttribute('position', `0 0 ${ZL.back}`);
  card.appendChild(back);

  const emoji = document.createElement('a-entity');
  emoji.setAttribute('text', `value:${currentFood.emoji}; width: 6; align:center; color:#ffffff`);
  emoji.setAttribute('position', `-0.5 0 ${ZL.text}`);
  card.appendChild(emoji);

  const label = document.createElement('a-entity');
  label.setAttribute('text', `value:${currentFood.name}; width: 5.5; align:left; color:#EAF2FF`);
  label.setAttribute('position', `-0.1 0.16 ${ZL.text}`);
  card.appendChild(label);

  const guide = document.createElement('a-entity');
  guide.setAttribute('text', `value:เลือกถังที่เหมาะสม; width: 5.5; align:left; color:#9fb4ff`);
  guide.setAttribute('position', `-0.1 -0.20 ${ZL.text}`);
  card.appendChild(guide);

  itemNode.appendChild(card);
  updateHUD();
}

// ===== Grade =====
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
  // กระพริบข้อความนิด ๆ
  const txt = bin.children[2];
  txt.setAttribute('animation__scale', 'property: scale; to: 1.06 1.06 1; dur: 140; dir: alternate; easing: easeOutQuad');
}

// ===== HUD / Timer =====
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

// ===== Flow =====
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

// Buttons
btn.start.onclick = ()=>{ if(!running) startGame(); else finishGame(); };
btn.reset.onclick = resetGame;

// Boot
resetGame();
