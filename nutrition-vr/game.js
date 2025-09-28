// Nutrition VR — Easy Mode (P5) + Fixed Grid Slots + No Slash In UI

const GAME_ID = "Nutrition-Easy";
function track(eventName, props = {}) {
  try { if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } }); } catch(e){}
}

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

let MODE = 'Learning';
const GOAL_COUNT = 4;

// เมนูแบบย่อ ครอบคลุมหมวดหลัก
const MENU = [
  { id:'g01', name:'ข้าวสวย',       cat:'grain',   kcal:200, emoji:'🍚', color:'#60a5fa' },
  { id:'p01', name:'ไก่ย่าง',       cat:'protein', kcal:165, emoji:'🍗', color:'#f59e0b' },
  { id:'v01', name:'ผัดผักรวม',     cat:'veggie',  kcal:150, emoji:'🥗', color:'#22c55e' },
  { id:'f01', name:'ผลไม้รวม',     cat:'fruit',   kcal:90,  emoji:'🍎', color:'#84cc16' },
  { id:'d01', name:'นมจืด',        cat:'dairy',   kcal:130, emoji:'🥛', color:'#a78bfa' },
  { id:'h01', name:'ซุปเต้าหู้ใส',  cat:'healthy', kcal:110, emoji:'🍲', color:'#2dd4bf' },
  { id:'c01', name:'ของทอด',       cat:'caution', kcal:260, emoji:'🍟', color:'#ef4444' },
  { id:'s01', name:'ขนมหวาน',      cat:'caution', kcal:240, emoji:'🍰', color:'#ef4444' }
];

let selected = []; // [{id,name,cat,kcal,emoji,color,qty}]

function clearEntity(root){ while(root.firstChild) root.removeChild(root.firstChild); }
function speakHUD(line1, line2){ hudLine1.textContent = line1; hudLine2.textContent = line2; }

// ===== Grid helpers =====
function gridSlots(cols, rows, gapX, gapY, centerY) {
  const slots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c - (cols - 1) / 2) * gapX;
    const y = centerY - r * gapY;
    slots.push({ x, y });
  }
  return slots;
}
function drawSlotFrames(root, slots, w, h, z) {
  slots.forEach(s => {
    const frame = document.createElement('a-entity');
    frame.setAttribute('position', `${s.x} ${s.y} ${z}`);
    // กรอบ = แผ่นหลัง + เส้นขอบบาง ๆ
    const back = document.createElement('a-plane');
    back.setAttribute('width', String(w));
    back.setAttribute('height', String(h));
    back.setAttribute('color', '#0d1424');
    back.setAttribute('opacity', '0.45');
    back.setAttribute('material', 'shader: flat; transparent: true');
    frame.appendChild(back);

    const rim = document.createElement('a-ring');
    rim.setAttribute('radius-inner', String(Math.min(w,h)*0.47));
    rim.setAttribute('radius-outer', String(Math.min(w,h)*0.50));
    rim.setAttribute('rotation', '0 0 0');
    rim.setAttribute('color', '#1e293b');
    rim.setAttribute('opacity', '0.85');
    frame.appendChild(rim);

    root.appendChild(frame);
  });
}

// ===== Render Shelf =====
function renderShelf(){
  clearEntity(shelfRoot);

  // พื้นหลัง
  const backdrop = document.createElement('a-plane');
  backdrop.setAttribute('width','2.6');
  backdrop.setAttribute('height','1.6');
  backdrop.setAttribute('color','#0a0f1a');
  backdrop.setAttribute('position','0 0 -0.02');        // Z: -0.02
  backdrop.setAttribute('material','shader: flat; opacity: 0.95');
  shelfRoot.appendChild(backdrop);

  // แท่นชั้นวาง
  const shelf = document.createElement('a-box');
  shelf.setAttribute('width','2.4'); shelf.setAttribute('height','0.06'); shelf.setAttribute('depth','0.45');
  shelf.setAttribute('color','#0b1220'); shelf.setAttribute('position','0 -0.2 0'); // Z: 0
  shelfRoot.appendChild(shelf);

  // สล็อตตายตัว
  const slots = gridSlots(3, 3, 0.75, 0.48, 0.55);
  drawSlotFrames(shelfRoot, slots, 0.68, 0.36, 0.004);   // กรอบ Z: 0.004 (หลังการ์ดเล็กน้อย)

  // วางการ์ดตรงกลางสล็อตด้วยคอนเทนเนอร์ (หลีกเลี่ยง scale/hover ที่ทำให้ดูเพี้ยน)
  MENU.forEach((m, i)=>{
    const s = slots[i % slots.length];

    const card = document.createElement('a-entity');
    card.classList.add('clickable','food');
    card.setAttribute('position', `${s.x} ${s.y} 0.010`);   // การ์ด Z: 0.010

    // แผ่นกรอบสีหมวด จาง ๆ
    const frame = document.createElement('a-plane');
    frame.setAttribute('width','0.68'); frame.setAttribute('height','0.36');
    frame.setAttribute('color', m.color); frame.setAttribute('opacity', '0.25');
    frame.setAttribute('material','shader: flat; transparent:true');
    frame.setAttribute('position','0 0 0.000');            // Z ภายใน: 0
    card.appendChild(frame);

    // แผ่นในเข้ม ช่วยให้อ่านชัด
    const inner = document.createElement('a-plane');
    inner.setAttribute('width','0.64'); inner.setAttribute('height','0.32');
    inner.setAttribute('color','#111827'); inner.setAttribute('opacity','0.98');
    inner.setAttribute('material','shader: flat; transparent:true');
    inner.setAttribute('position','0 0 0.001');            // Z ภายใน: 0.001
    card.appendChild(inner);

    // อีโมจิ + ป้าย จัดให้อยู่ในเฟรมเสมอ
    const emoji = document.createElement('a-entity');
    emoji.setAttribute('text', `value:${m.emoji}; width:2.0; align:center; color:#fff`);
    emoji.setAttribute('position','-0.20 0 0.002');        // Z ภายใน: 0.002
    card.appendChild(emoji);

    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${m.name}\nประมาณ ${m.kcal} แคล; width:2.6; color:#F5F7FF; align:left; baseline:top`);
    label.setAttribute('position','-0.02 0.10 0.002');
    card.appendChild(label);

    // hover = เปลี่ยนสี inner (ไม่เปลี่ยน scale)
    card.addEventListener('mouseenter', ()=> inner.setAttribute('color','#0f1a33'));
    card.addEventListener('mouseleave', ()=> inner.setAttribute('color','#111827'));
    card.addEventListener('click', ()=> addItem(m));

    shelfRoot.appendChild(card);
  });

  const title = document.createElement('a-entity');
  title.setAttribute('text', 'value:เลือกอาหาร 4 อย่าง; width:5.2; color:#E8F0FF; align:center');
  title.setAttribute('position','0 0.95 0.012');           // Z: หน้าสุดเล็กน้อย
  shelfRoot.appendChild(title);
}

// ===== Render Plate =====
function renderPlate(){
  clearEntity(plateRoot);

  const base = document.createElement('a-circle');
  base.setAttribute('radius','0.65'); base.setAttribute('color','#0b1220');
  base.setAttribute('rotation','-90 0 0'); base.setAttribute('position','0 -0.35 0'); // Z: 0
  plateRoot.appendChild(base);

  const head = document.createElement('a-entity');
  head.setAttribute('text','value:จานของฉัน แตะเพื่อลดจำนวนหรือเอาออก; width:5.5; color:#E8F0FF; align:center');
  head.setAttribute('position','0 0.55 0.012');
  plateRoot.appendChild(head);

  const slots = gridSlots(2, 3, 0.50, 0.36, 0.22);
  drawSlotFrames(plateRoot, slots, 0.58, 0.28, 0.004);     // กรอบ Z: 0.004

  selected.forEach((p, i)=>{
    const s = slots[i % slots.length];

    const item = document.createElement('a-entity');
    item.classList.add('clickable','plate-item');
    item.setAttribute('position', `${s.x} ${s.y} 0.010`);  // รายการ Z: 0.010

    const panel = document.createElement('a-plane');
    panel.setAttribute('width','0.58'); panel.setAttribute('height','0.28');
    panel.setAttribute('color','#0f172a'); panel.setAttribute('opacity','0.98');
    panel.setAttribute('material','shader:flat; transparent:true');
    panel.setAttribute('position','0 0 0.000');
    item.appendChild(panel);

    const emoji = document.createElement('a-entity');
    emoji.setAttribute('text', `value:${p.emoji}; width:2.0; align:center; color:#fff`);
    emoji.setAttribute('position','-0.20 0 0.001');
    item.appendChild(emoji);

    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${p.name}  ×${p.qty}; width:2.6; color:#DDE7FF; align:left; baseline:top`);
    label.setAttribute('position','-0.06 0.08 0.001');
    item.appendChild(label);

    item.addEventListener('mouseenter', ()=> panel.setAttribute('color','#12203a'));
    item.addEventListener('mouseleave', ()=> panel.setAttribute('color','#0f172a'));
    item.addEventListener('click', ()=> removeItem(p.id));

    plateRoot.appendChild(item);
  });
}

// ===== Add / Remove =====
function addItem(m){
  const totalCount = selected.reduce((a,b)=>a+b.qty,0);
  if (totalCount >= 6) { speakHUD("เต็มแล้ว", "กด Finish เพื่อดูคะแนนนะ"); return; }
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

// ===== HUD =====
function categoryHints(catSet){
  const need = ['grain','protein','veggie','fruit'];
  const mapLabel = {grain:'ธัญพืช', protein:'โปรตีน', veggie:'ผัก', fruit:'ผลไม้'};
  return need.map(k => catSet.has(k) ? `ครบ  ${mapLabel[k]}` : `ยังขาด  ${mapLabel[k]}`).join('\n');
}
function updateHUDProgress(){
  const count = selected.reduce((a,b)=>a+b.qty,0);
  const cats = new Set(); selected.forEach(s=>cats.add(s.cat));
  const needed = Math.max(0, GOAL_COUNT - count);
  const checks = categoryHints(cats);
  speakHUD(
    `เลือกแล้ว  ${count} ชิ้น\n${checks}`,
    needed>0 ? `เหลืออีก  ${needed} ชิ้น` : `ครบแล้ว  กด Finish ได้เลย`
  );
}

// ===== Scoring (Easy) =====
function scorePlate(){
  const totalKcal = selected.reduce((a,b)=>a + b.kcal*b.qty, 0);
  const counts = {grain:0,protein:0,veggie:0,fruit:0,dairy:0,healthy:0,caution:0};
  selected.forEach(s=>{ counts[s.cat] = (counts[s.cat]||0) + s.qty; });

  const has4 = ['grain','protein','veggie','fruit'].every(k=>counts[k]>0);
  const has3 = ['grain','protein','veggie','fruit'].filter(k=>counts[k]>0).length >= 3;

  let stars = 1, face='🙂', msg='พอใช้ได้ ลองลดของทอดและเพิ่มผักผลไม้';
  if (has4 && totalKcal>=350 && totalKcal<=650 && counts.caution<=1){ stars=3; face='😊'; msg='เยี่ยมมาก จานสมดุลเลย'; }
  else if (has3 && totalKcal>=300 && totalKcal<=800 && counts.caution<=1){ stars=2; face='😃'; msg='ดีมาก ใกล้สมดุลแล้ว'; }

  return { stars, face, msg, totalKcal, counts };
}
function showResult(){
  const {stars, face, msg, totalKcal, counts} = scorePlate();
  const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  const needList = ['grain','protein','veggie','fruit'].filter(k=>!counts[k]);
  const mapLabel = {grain:'ธัญพืช', protein:'โปรตีน', veggie:'ผัก', fruit:'ผลไม้'};
  const hint = needList.length ? `ขาด  ${needList.map(k=>mapLabel[k]).join('  ')}` : 'ครบหมวดหลักแล้ว';
  speakHUD(
    `${face}  ${starStr}\n${msg}\nพลังงานรวม ประมาณ ${Math.round(totalKcal)} แคล`,
    hint
  );
}

// ===== Flow =====
function startGame(){ selected = []; renderShelf(); renderPlate(); speakHUD("เลือกอาหาร 4 อย่างนะ", "ยังไม่ได้เลือก"); track('GameStart', { mode: MODE }); }
function finishGame(){ showResult(); track('GameFinish', { mode: MODE, count: selected.reduce((a,b)=>a+b.qty,0) }); }
function resetGame(){ selected = []; renderPlate(); updateHUDProgress(); track('Reset', {}); }

BTN.start.onclick = startGame;
BTN.finish.onclick = finishGame;
BTN.reset.onclick = resetGame;
BTN.learning.onclick = ()=>{ MODE='Learning'; modeBadge.textContent='Learning'; };
BTN.challenge.onclick= ()=>{ MODE='Challenge'; modeBadge.textContent='Challenge'; };

startGame();
