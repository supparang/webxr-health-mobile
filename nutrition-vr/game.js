// Nutrition Traffic Light VR — P5
// กลไก: อาหารทีละชิ้น → เลือกถัง เขียว เหลือง แดง ด้วย gaze fuse หรือ OK
// คะแนนง่าย ๆ ดาวและหน้ายิ้มตอนจบ ไม่ใช้ไฟล์ภาพ

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

// ===== ชุดข้อมูลอาหารแบบไฟจราจร =====
// tag: green ต้องการบ่อย, yellow พอเหมาะ, red น้อย ๆ
const FOODS = [
  {name:'ข้าวกล้อง', emoji:'🍚', tag:'green'},
  {name:'ปลาอบ', emoji:'🐟', tag:'green'},
  {name:'ผัดผัก', emoji:'🥗', tag:'green'},
  {name:'ผลไม้', emoji:'🍎', tag:'green'},
  {name:'นมจืด', emoji:'🥛', tag:'yellow'},
  {name:'ไก่ย่าง', emoji:'🍗', tag:'yellow'},
  {name:'แกงจืด', emoji:'🍲', tag:'yellow'},
  {name:'ข้าวขาว', emoji:'🍚', tag:'yellow'},
  {name:'ของทอด', emoji:'🍟', tag:'red'},
  {name:'น้ำอัดลม', emoji:'🥤', tag:'red'},
  {name:'ขนมหวาน', emoji:'🍰', tag:'red'},
  {name:'มันฝรั่งทอดกรอบ', emoji:'🍿', tag:'red'}
];

function randFood(){ return FOODS[Math.floor(Math.random()*FOODS.length)]; }
function setHUD(line1, line2=""){ hudText.style.whiteSpace='pre-line'; hudText.textContent = line1 + (line2?`\n${line2}`:''); }
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

// billboard: ให้ป้ายหันหาเลนส์เสมอ
AFRAME.registerComponent('billboard',{ tick(){ const cam=document.querySelector('[camera]'); if(!cam) return; const v=new THREE.Vector3(); cam.object3D.getWorldPosition(v); this.el.object3D.lookAt(v);} });

// ===== สร้างเลย์เอาต์ฉาก: ป้ายถัง 3 สี + โซนไอเท็ม =====
let bins = {}; // {green:entity, yellow:entity, red:entity}
let itemNode = null;

function buildScene(){
  clearChildren(gameRoot);

  // ช่องวางถัง: ซ้าย เขียว กลาง เหลือง ขวา แดง
  const lane = document.createElement('a-entity');
  lane.setAttribute('position','0 0 0');
  gameRoot.appendChild(lane);

  bins.green = makeBin('เขียว กินบ่อย', '#16a34a', -0.9);
  bins.yellow= makeBin('เหลือง พอเหมาะ', '#f59e0b', 0.0);
  bins.red   = makeBin('แดง กินน้อย', '#ef4444', 0.9);
  lane.appendChild(bins.green);
  lane.appendChild(bins.yellow);
  lane.appendChild(bins.red);

  // โหนดสำหรับอาหารปัจจุบันตรงกลางด้านบนเล็กน้อย
  itemNode = document.createElement('a-entity');
  itemNode.setAttribute('position','0 0.45 0');
  gameRoot.appendChild(itemNode);
}
function makeBin(label, color, x){
  const bin = document.createElement('a-entity');
  bin.setAttribute('position', `${x} -0.35 0`);

  // พื้นป้าย
  const panel = document.createElement('a-plane');
  panel.classList.add('selectable');
  panel.setAttribute('width','0.9'); panel.setAttribute('height','0.5');
  panel.setAttribute('material', `color:${color}; opacity:0.35; shader:flat; transparent:true`);
  panel.setAttribute('billboard','');
  panel.setAttribute('position','0 0 0');
  bin.appendChild(panel);

  // เส้นขอบเข้ม
  const inner = document.createElement('a-plane');
  inner.setAttribute('width','0.86'); inner.setAttribute('height','0.46');
  inner.setAttribute('material', 'color:#0f172a; shader:flat; transparent:true; opacity:0.98');
  inner.setAttribute('position','0 0 0.01');
  bin.appendChild(inner);

  // ข้อความใหญ่
  const txt = document.createElement('a-entity');
  txt.setAttribute('text', `value:${label}; width:3.2; align:center; color:#EAF2FF`);
  txt.setAttribute('position','0 0 0.02');
  bin.appendChild(txt);

  // คลิกที่ป้าย = เลือกถังนั้น
  panel.addEventListener('click', ()=>{ if(running) gradeChoice(bin === bins.green ? 'green' : bin === bins.yellow ? 'yellow' : 'red'); });

  return bin;
}

// ===== แสดงอาหารชิ้นใหม่ =====
let currentFood = null;

function showNewFood(){
  if(!itemNode) return;
  clearChildren(itemNode);
  currentFood = randFood();
  totalItems += 1;

  const card = document.createElement('a-entity');
  card.setAttribute('position','0 0 0');

  const back = document.createElement('a-plane');
  back.setAttribute('width','1.2'); back.setAttribute('height','0.6');
  back.setAttribute('material','color:#111827; shader:flat; transparent:true; opacity:0.98');
  back.setAttribute('position','0 0 0');
  card.appendChild(back);

  const emoji = document.createElement('a-entity');
  emoji.setAttribute('text', `value:${currentFood.emoji}; width:3.2; align:center; color:#fff`);
  emoji.setAttribute('position','-0.35 0 0.01');
  card.appendChild(emoji);

  const label = document.createElement('a-entity');
  label.setAttribute('text', `value:${currentFood.name}; width:3.2; align:left; color:#EAF2FF`);
  label.setAttribute('position','-0.05 0.1 0.01');
  card.appendChild(label);

  const guide = document.createElement('a-entity');
  guide.setAttribute('text', `value:เลือกถังที่เหมาะสม; width:3.2; align:left; color:#9fb4ff`);
  guide.setAttribute('position','-0.05 -0.12 0.01');
  card.appendChild(guide);

  itemNode.appendChild(card);
  updateHUD();
}

// ===== ตรวจคำตอบ =====
function gradeChoice(choiceTag){
  if(!currentFood) return;
  const ok = currentFood.tag === choiceTag;
  if(ok){ score += 2; flashBin(choiceTag, true); track('Answer',{ok:true, tag:choiceTag}); }
  else { lives -= 1; flashBin(choiceTag, false); track('Answer',{ok:false, want:currentFood.tag, picked:choiceTag}); }

  if(lives <= 0){ return finishGame(); }
  if(totalItems >= 20){ return finishGame(); }
  showNewFood();
}

function flashBin(tag, ok){
  const bin = tag==='green'?bins.green:tag==='yellow'?bins.yellow:bins.red;
  const panel = bin.children[0];
  panel.setAttribute('animation__flash', `property: material.opacity; from: ${ok?0.35:0.35}; to: ${ok?0.8:0.15}; dur: 160; dir: alternate; easing: easeOutQuad`);
  // แจ้งเตือนบน HUD สั้น ๆ
  if(ok){ setHUDline2('ถูกต้อง เก่งมาก'); setTimeout(()=>setHUDline2(''), 400); }
  else { setHUDline2('ยังไม่เหมาะ ลองคิดใหม่'); setTimeout(()=>setHUDline2(''), 600); }
}
function setHUDline2(suffix){
  const lines = hudText.textContent.split('\n');
  lines[1] = suffix || '';
  hudText.textContent = lines.join('\n').trim();
}

// ===== HUD =====
function updateHUD(){
  hudText.style.whiteSpace = 'pre-line';
  const line1 = `เวลา  ${timeLeft} วินาที   คะแนน  ${score}   หัวใจ  ${'❤️'.repeat(lives)}${'🤍'.repeat(Math.max(0,3-lives))}`;
  const line2 = `ชิ้นที่  ${totalItems}  จาก  20`;
  setHUD(line1, line2);
}

// ===== เวลาและโฟลว์ =====
function startTimer(){
  timeLeft = 60;
  timerId = setInterval(()=>{
    if(!running) return;
    timeLeft -= 1; updateHUD();
    if(timeLeft <= 0) finishGame();
  }, 1000);
}

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

  // ดาวง่าย ๆ: คะแนน ≥30 = 3 ดาว, ≥20 = 2 ดาว, อื่น ๆ = 1 ดาว
  let stars = 1, face='🙂', msg='พยายามดี ลองฝึกใหม่อีกครั้ง';
  if(score >= 30){ stars=3; face='😊'; msg='เยี่ยมมาก จำแนกอาหารได้ถูกต้อง'; }
  else if(score >= 20){ stars=2; face='😃'; msg='ดีมาก ใกล้สมดุลแล้ว'; }

  setHUD(`${face}  ${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}\n${msg}`, `คะแนนทั้งหมด  ${score}`);
  track('GameFinish',{score, items: totalItems, timeLeft});
}
function resetGame(){
  running = false;
  if(timerId){ clearInterval(timerId); timerId = null; }
  clearChildren(gameRoot);
  setHUD('พร้อมเริ่ม','');
  btn.start.textContent = 'Start';
  track('Reset',{});
}

// ===== ปุ่ม UI =====
btn.start.onclick = ()=>{ if(!running) startGame(); else finishGame(); };
btn.reset.onclick = resetGame;

// boot
resetGame();
