// Nutrition VR — Easy Mode (P.5)
// - ไม่ใช้รูป ใช้อีโมจิ + สีหมวดอาหาร
// - เลือก 4 อย่าง → กด Finish → ให้คะแนนดาว + หน้ายิ้ม + คำแนะนำง่าย ๆ
// - เล่นง่าย: เล็งแล้วจ้อง (fuse 1200ms) หรือกด OK

//////////////////////
// Analytics (เบา) //
//////////////////////
const GAME_ID = "Nutrition-Easy";
function track(eventName, props = {}) {
  try { if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } }); } catch(e){}
}

//////////////////////
// DOM Refs & HUD   //
//////////////////////
const $ = id => document.getElementById(id);
const shelfRoot = $('shelfRoot');
const plateRoot = $('plateRoot');
const hudLine1 = $('hudLine1');
const hudLine2 = $('hudLine2');
const modeBadge = $('modeBadge');
const goalBadge = $('goalBadge');

const BTN = {
  start: $('btnStart'),
  finish: $('btnFinish'),
  reset: $('btnReset'),
  learning: $('btnLearning'),
  challenge: $('btnChallenge')
};

//////////////////////
// Easy Game Config //
//////////////////////
let MODE = 'Learning'; // Learning | Challenge
const GOAL_COUNT = 4;

// เมนูแบบย่อ (6–8 รายการ) ครอบคลุมหมวดหลัก
// หมวด: grain, protein, veggie, fruit, dairy, healthy, caution
const MENU = [
  { id:'g01', name:'ข้าวสวย',         cat:'grain',  kcal:200, emoji:'🍚', color:'#60a5fa' },
  { id:'p01', name:'ไก่ย่าง',         cat:'protein',kcal:165, emoji:'🍗', color:'#f59e0b' },
  { id:'v01', name:'ผัดผักรวม',       cat:'veggie', kcal:150, emoji:'🥗', color:'#22c55e' },
  { id:'f01', name:'ผลไม้รวม',       cat:'fruit',  kcal:90,  emoji:'🍎', color:'#84cc16' },
  { id:'d01', name:'นมจืด',          cat:'dairy',  kcal:130, emoji:'🥛', color:'#a78bfa' },
  { id:'h01', name:'ซุปเต้าหู้ใส',    cat:'healthy',kcal:110, emoji:'🍲', color:'#2dd4bf' },
  { id:'c01', name:'ของทอด',         cat:'caution',kcal:260, emoji:'🍟', color:'#ef4444' },
  { id:'s01', name:'ขนมหวาน',        cat:'caution',kcal:240, emoji:'🍰', color:'#ef4444' }
];

let selected = []; // [{id,name,cat,kcal,emoji,color,qty}]

//////////////////////
// Utilities        //
//////////////////////
function clearEntity(root){ while(root.firstChild) root.removeChild(root.firstChild); }
function fmt(n){ return Math.round(n*10)/10; }

//////////////////////
// Render Shelf     //
//////////////////////
function renderShelf(){
  clearEntity(shelfRoot);

  // พื้นหลังเพิ่มคอนทราสต์
  const backdrop = document.createElement('a-plane');
  backdrop.setAttribute('width','2.6');
  backdrop.setAttribute('height','1.6');
  backdrop.setAttribute('color','#0a0f1a');
  backdrop.setAttribute('position','0 0 -0.02');
  backdrop.setAttribute('material','shader: flat; opacity: 0.95');
  shelfRoot.appendChild(backdrop);

  // ชั้นวาง
  const shelf = document.createElement('a-box');
  shelf.setAttribute('width','2.4'); shelf.setAttribute('height','0.06'); shelf.setAttribute('depth','0.45');
  shelf.setAttribute('color','#0b1220'); shelf.setAttribute('position','0 -0.2 0');
  shelfRoot.appendChild(shelf);

  // การ์ดอาหาร (ใหญ่/ชัด, สีตามหมวด)
  const cols = 3, gapX = 0.75, gapY = 0.48;
  MENU.forEach((m, i)=>{
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols-1)/2) * gapX;
    const y = 0.55 - row * gapY;

    const card = document.createElement('a-entity');
    card.classList.add('clickable','food');
    card.setAttribute('geometry', 'primitive: plane; width: 0.68; height: 0.36');
    card.setAttribute('material', `color: ${m.color}; opacity: 0.25; shader: flat; transparent:true`);
    card.setAttribute('position', `${x} ${y} 0.01`);

    // กรอบกลางเข้ม ให้ตัวหนังสืออ่านง่าย
    const inner = document.createElement('a-plane');
    inner.setAttribute('width','0.64'); inner.setAttribute('height','0.32');
    inner.setAttribute('position','0 0 0.001');
    inner.setAttribute('color','#111827'); inner.setAttribute('opacity','0.98');
    inner.setAttribute('material','shader: flat; transparent:true');
    card.appendChild(inner);

    const emoji = document.createElement('a-entity');
    emoji.setAttribute('text', `value:${m.emoji}; width:2.2; align:center; color:#fff`);
    emoji.setAttribute('position','-0.20 0 0.002');
    card.appendChild(emoji);

    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${m.name}\n~${m.kcal} kcal; width:2.6; color:#F5F7FF; align:left; baseline:top`);
    label.setAttribute('position','-0.02 0.10 0.002');
    card.appendChild(label);

    // คลิก/ฟิวส์ = เพิ่มลงจาน (สูงสุด 2 ชิ้นต่อเมนู เพื่อกันสแปม)
    card.addEventListener('click', ()=> addItem(m));
    card.addEventListener('mouseenter', ()=> card.setAttribute('scale','1.05 1.05 1'));
    card.addEventListener('mouseleave', ()=> card.setAttribute('scale','1 1 1'));

    shelfRoot.appendChild(card);
  });

  // หัวข้อ
  const title = document.createElement('a-entity');
  title.setAttribute('text', 'value:เลือกอาหาร 4 อย่าง; width:5.2; color:#E8F0FF; align:center');
  title.setAttribute('position','0 0.95 0.01');
  shelfRoot.appendChild(title);
}

//////////////////////
// Render Plate     //
//////////////////////
function renderPlate(){
  clearEntity(plateRoot);

  const base = document.createElement('a-circle');
  base.setAttribute('radius','0.65'); base.setAttribute('color','#0b1220');
  base.setAttribute('rotation','-90 0 0'); base.setAttribute('position','0 -0.35 0');
  plateRoot.appendChild(base);

  const head = document.createElement('a-entity');
  head.setAttribute('text','value:จานของฉัน (แตะเพื่อลดจำนวน/เอาออก); width:5.5; color:#E8F0FF; align:center');
  head.setAttribute('position','0 0.55 0.02');
  plateRoot.appendChild(head);

  const cols = 2, gapX = 0.5, gapY = 0.36;
  selected.forEach((p, i)=>{
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
    emoji.setAttribute('text', `value:${p.emoji}; width:2.2; align:center; color:#fff`);
    emoji.setAttribute('position','-0.20 0 0.002');
    item.appendChild(emoji);

    const txt = `${p.name} ×${p.qty}`;
    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${txt}; width:2.6; color:#DDE7FF; align:left; baseline:top`);
    label.setAttribute('position','-0.06 0.08 0.002');
    item.appendChild(label);

    item.addEventListener('click', ()=> removeItem(p.id));
    item.addEventListener('mouseenter', ()=> item.setAttribute('scale','1.03 1.03 1'));
    item.addEventListener('mouseleave', ()=> item.setAttribute('scale','1 1 1'));
    plateRoot.appendChild(item);
  });
}

//////////////////////
// Add / Remove     //
//////////////////////
function addItem(m){
  // จำกัดรายการรวมไม่เกิน 6 ชิ้น (แต่ HUD ชวนให้ 4 อย่าง)
  const totalCount = selected.reduce((a,b)=>a+b.qty,0);
  if (totalCount >= 6) { speakHUD("เต็มแล้ว!", "ลองกด Finish เพื่อดูคะแนนนะ"); return; }

  const f = selected.find(x=>x.id===m.id);
  if (f){ if (f.qty >= 2) return; f.qty += 1; }
  else { selected.push({ ...m, qty:1 }); }

  renderPlate(); updateHUDProgress();
}
function removeItem(id){
  const idx = selected.findIndex(x=>x.id===id);
  if (idx>=0){
    if (selected[idx].qty>1) selected[idx].qty -= 1;
    else selected.splice(idx,1);
    renderPlate(); updateHUDProgress();
  }
}

//////////////////////
// HUD Helpers      //
//////////////////////
function speakHUD(line1, line2){
  hudLine1.textContent = line1;
  hudLine2.textContent = line2;
}
function updateHUDProgress(){
  const count = selected.reduce((a,b)=>a+b.qty,0);
  const cats = new Set();
  selected.forEach(s=>cats.add(s.cat));
  const needed = Math.max(0, GOAL_COUNT - count);

  const checkIcons = categoryHints(cats);
  speakHUD(
    `เลือกแล้ว: ${count} ชิ้น\n${checkIcons}`,
    needed>0 ? `เหลืออีก ${needed} ชิ้น` : `ครบแล้ว! กด Finish ได้เลย`
  );
}
function categoryHints(catSet){
  // แสดงติ๊กถูก/ยังขาดของหมวดหลัก
  const need = ['grain','protein','veggie','fruit'];
  const mapLabel = {grain:'ธัญพืช', protein:'โปรตีน', veggie:'ผัก', fruit:'ผลไม้'};
  return need.map(k => catSet.has(k) ? `✅ ${mapLabel[k]}` : `⬜ ${mapLabel[k]}`).join('  ');
}

//////////////////////
// Scoring (Easy)   //
//////////////////////
// 3 ดาว: มีครบ 4 หมวดหลัก + แคลอรี่รวม ~350–650 + ไม่มี caution เกิน 1
// 2 ดาว: มีครบอย่างน้อย 3 หมวด + แคลอรี่ 300–800 + caution ≤1
// 1 ดาว: อย่างอื่น
function scorePlate(){
  const totalKcal = selected.reduce((a,b)=>a + b.kcal*b.qty, 0);
  const counts = {grain:0,protein:0,veggie:0,fruit:0,dairy:0,healthy:0,caution:0};
  selected.forEach(s=>{ counts[s.cat] = (counts[s.cat]||0) + s.qty; });

  const has4 = ['grain','protein','veggie','fruit'].every(k=>counts[k]>0);
  const has3 = ['grain','protein','veggie','fruit'].filter(k=>counts[k]>0).length >= 3;

  let stars = 1, face='😐', msg='ดีแล้ว! ลองเพิ่มผัก/ผลไม้ดูนะ';
  if (has4 && totalKcal>=350 && totalKcal<=650 && counts.caution<=1){ stars=3; face='😊'; msg='สุดยอด! จานสมดุลมาก'; }
  else if (has3 && totalKcal>=300 && totalKcal<=800 && counts.caution<=1){ stars=2; face='🙂'; msg='ดีมาก! เกือบสมดุล ลองเติมส่วนที่ขาด'; }
  else { stars=1; face='😐'; msg='พอใช้ได้ ลองลดของทอด/ขนมหวาน และเพิ่มผักผลไม้'; }

  return { stars, face, msg, totalKcal, counts };
}

function showResult(){
  const {stars, face, msg, totalKcal, counts} = scorePlate();
  const starStr = '⭐'.repeat(stars) + (stars<3 ? '☆'.repeat(3-stars) : '');
  const summary =
    `${face}  ${starStr}\n` +
    `${msg}\n` +
    `พลังงานรวม ≈ ${Math.round(totalKcal)} kcal`;

  // คำใบ้ง่าย ๆ ว่าขาดอะไร
  const needList = ['grain','protein','veggie','fruit'].filter(k=>!counts[k]);
  const mapLabel = {grain:'ธัญพืช', protein:'โปรตีน', veggie:'ผัก', fruit:'ผลไม้'};
  const hint = needList.length ? `ขาด: ${needList.map(k=>mapLabel[k]).join(', ')}` : 'ครบหมวดหลักแล้ว';

  speakHUD(summary, hint);
}

//////////////////////
// Flow Control     //
//////////////////////
function startGame(){
  selected = [];
  renderShelf();
  renderPlate();
  speakHUD("เลือกอาหาร 4 อย่างนะ!", "ยังไม่ได้เลือก");
  track('GameStart', { mode: MODE });
}
function finishGame(){
  showResult();
  track('GameFinish', { mode: MODE, count: selected.reduce((a,b)=>a+b.qty,0) });
}
function resetGame(){
  selected = [];
  renderPlate();
  updateHUDProgress();
  track('Reset', {});
}

BTN.start.onclick = startGame;
BTN.finish.onclick = finishGame;
BTN.reset.onclick = resetGame;

BTN.learning.onclick = ()=>{ MODE='Learning'; modeBadge.textContent='Learning'; track('Mode', {mode:MODE}); };
BTN.challenge.onclick= ()=>{ MODE='Challenge'; modeBadge.textContent='Challenge'; track('Mode', {mode:MODE}); };

// Boot once
startGame();
