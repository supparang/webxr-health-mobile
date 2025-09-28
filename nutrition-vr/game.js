// Nutrition VR — Easy Mode (P5) — Precise Slot Centering

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

/* ---------- Layout Constants (ใช้ค่าคงที่ทั้งหมด) ---------- */
const SLOT = {
  shelf: { cols:3, rows:3, gapX:0.75, gapY:0.48, centerY:0.55, W:0.68, H:0.36 },
  plate: { cols:2, rows:3, gapX:0.50, gapY:0.36, centerY:0.22, W:0.58, H:0.28 }
};
const Z = { backdrop:-0.020, shelfBase:0.000, slotFrame:0.004, card:0.010, inner:0.011, content:0.012, title:0.013 };
const CARD_INNER = { W:0.64, H:0.32 };
const EMOJI_X = -0.20;     // ขยับซ้ายคงที่ (หน่วยเมตรในฉาก)
const LABEL_POS = { x:-0.02, y:0.10 };

/* ---------- เมนู (อิโมจิแทนรูป) ---------- */
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

/* ---------- Utils ---------- */
function clearEntity(root){ while(root.firstChild) root.removeChild(root.firstChild); }
function speakHUD(line1, line2){ hudLine1.textContent = line1; hudLine2.textContent = line2; }
function gridSlots({cols,rows,gapX,gapY,centerY}) {
  const out = [];
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    const x = (c - (cols-1)/2) * gapX;
    const y = centerY - r * gapY;
    // ปัดทศนิยมให้สวย (ลด jitter floating)
    out.push({ x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) });
  }
  return out;
}
function drawSlotFrames(root, slots, W, H) {
  slots.forEach(({x,y})=>{
    const frame = document.createElement('a-entity');
    frame.setAttribute('position', `${x} ${y} ${Z.slotFrame}`);

    const back = document.createElement('a-plane');
    back.setAttribute('width', String(W));
    back.setAttribute('height', String(H));
    back.setAttribute('color', '#0d1424');
    back.setAttribute('opacity', '0.45');
    back.setAttribute('material', 'shader: flat; transparent: true');
    back.setAttribute('position', `0 0 0`);
    frame.appendChild(back);

    const rim = document.createElement('a-plane');
    rim.setAttribute('width', String(W));
    rim.setAttribute('height', String(H));
    rim.setAttribute('color', '#1e293b');
    rim.setAttribute('opacity', '0.65');
    rim.setAttribute('material', 'shader: flat; wireframe: true; transparent: true');
    rim.setAttribute('position', `0 0 0.0005`);
    frame.appendChild(rim);

    root.appendChild(frame);
  });
}
function placeAtSlot(el, slot, z=Z.card){ el.setAttribute('position', `${slot.x} ${slot.y} ${z}`); }

/* ---------- Shelf ---------- */
function renderShelf(){
  clearEntity(shelfRoot);

  // ฉากหลัง + แท่นชั้น
  const backdrop = document.createElement('a-plane');
  backdrop.setAttribute('width','2.6'); backdrop.setAttribute('height','1.6');
  backdrop.setAttribute('color','#0a0f1a');
  backdrop.setAttribute('position', `0 0 ${Z.backdrop}`);
  backdrop.setAttribute('material','shader: flat; opacity: 0.95');
  shelfRoot.appendChild(backdrop);

  const shelf = document.createElement('a-box');
  shelf.setAttribute('width','2.4'); shelf.setAttribute('height','0.06'); shelf.setAttribute('depth','0.45');
  shelf.setAttribute('color','#0b1220'); shelf.setAttribute('position', `0 -0.2 ${Z.shelfBase}`);
  shelfRoot.appendChild(shelf);

  // สร้างสล็อตคงที่ + วาดกรอบ
  const shelfSlots = gridSlots(SLOT.shelf);
  drawSlotFrames(shelfRoot, shelfSlots, SLOT.shelf.W, SLOT.shelf.H);

  // วางการ์ดแบบศูนย์กลางตรงสล็อต
  MENU.forEach((m, i)=>{
    const s = shelfSlots[i % shelfSlots.length];

    const card = document.createElement('a-entity');
    card.classList.add('clickable','food');
    placeAtSlot(card, s, Z.card);

    // กรอบหมวด (จาง)
    const frame = document.createElement('a-plane');
    frame.setAttribute('width', String(SLOT.shelf.W));
    frame.setAttribute('height', String(SLOT.shelf.H));
    frame.setAttribute('color', m.color);
    frame.setAttribute('opacity', '0.25');
    frame.setAttribute('material','shader: flat; transparent: true');
    frame.setAttribute('position', `0 0 0`);
    card.appendChild(frame);

    // แผ่นใน (เข้ม) ให้อ่านชัด
    const inner = document.createElement('a-plane');
    inner.setAttribute('width', String(CARD_INNER.W));
    inner.setAttribute('height', String(CARD_INNER.H));
    inner.setAttribute('color', '#111827');
    inner.setAttribute('opacity', '0.98');
    inner.setAttribute('material','shader: flat; transparent: true');
    inner.setAttribute('position', `0 0 ${Z.inner - Z.card}`);
    card.appendChild(inner);

    // อีโมจิ + ป้าย (จัดยึดแน่นด้วยค่าคงที่)
    const emoji = document.createElement('a-entity');
    emoji.setAttribute('text', `value:${m.emoji}; width:2.0; align:center; color:#fff`);
    emoji.setAttribute('position', `${EMOJI_X} 0 ${Z.content - Z.card}`);
    card.appendChild(emoji);

    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${m.name}\nประมาณ ${m.kcal} แคล; width:2.6; color:#F5F7FF; align:left; baseline:top`);
    label.setAttribute('position', `${LABEL_POS.x} ${LABEL_POS.y} ${Z.content - Z.card}`);
    card.appendChild(label);

    // ไม่มี hover scale เพื่อไม่ให้เพี้ยนตำแหน่ง
    card.addEventListener('click', ()=> addItem(m));

    shelfRoot.appendChild(card);
  });

  const title = document.createElement('a-entity');
  title.setAttribute('text', 'value:เลือกอาหาร 4 อย่าง; width:5.2; color:#E8F0FF; align:center');
  title.setAttribute('position', `0 0.95 ${Z.title}`);
  shelfRoot.appendChild(title);
}

/* ---------- Plate ---------- */
function renderPlate(){
  clearEntity(plateRoot);

  const base = document.createElement('a-circle');
  base.setAttribute('radius','0.65'); base.setAttribute('color','#0b1220');
  base.setAttribute('rotation','-90 0 0'); base.setAttribute('position', `0 -0.35 ${Z.shelfBase}`);
  plateRoot.appendChild(base);

  const head = document.createElement('a-entity');
  head.setAttribute('text','value:จานของฉัน  แตะเพื่อลดจำนวนหรือเอาออก; width:5.5; color:#E8F0FF; align:center');
  head.setAttribute('position', `0 0.55 ${Z.title}`);
  plateRoot.appendChild(head);

  const plateSlots = gridSlots(SLOT.plate);
  drawSlotFrames(plateRoot, plateSlots, SLOT.plate.W, SLOT.plate.H);

  selected.forEach((p, i)=>{
    const s = plateSlots[i % plateSlots.length];

    const item = document.createElement('a-entity');
    item.classList.add('clickable','plate-item');
    placeAtSlot(item, s, Z.card);

    const panel = document.createElement('a-plane');
    panel.setAttribute('width', String(SLOT.plate.W));
    panel.setAttribute('height', String(SLOT.plate.H));
    panel.setAttribute('color','#0f172a'); panel.setAttribute('opacity','0.98');
    panel.setAttribute('material','shader:flat; transparent:true');
    panel.setAttribute('position', `0 0 0`);
    item.appendChild(panel);

    const emoji = document.createElement('a-entity');
    emoji.setAttribute('text', `value:${p.emoji}; width:2.0; align:center; color:#fff`);
    emoji.setAttribute('position', `${EMOJI_X} 0 ${Z.content - Z.card}`);
    item.appendChild(emoji);

    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${p.name}  ×${p.qty}; width:2.6; color:#DDE7FF; align:left; baseline:top`);
    label.setAttribute('position', `${LABEL_POS.x} ${LABEL_POS.y} ${Z.content - Z.card}`);
    item.appendChild(label);

    item.addEventListener('click', ()=> removeItem(p.id));
    plateRoot.appendChild(item);
  });
}

/* ---------- Add / Remove ---------- */
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

/* ---------- HUD / Progress ---------- */
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

/* ---------- Scoring ---------- */
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

/* ---------- Flow ---------- */
function startGame(){ selected = []; renderShelf(); renderPlate(); speakHUD("เลือกอาหาร 4 อย่างนะ", "ยังไม่ได้เลือก"); track('GameStart', { mode: MODE }); }
function finishGame(){ showResult(); track('GameFinish', { mode: MODE, count: selected.reduce((a,b)=>a+b.qty,0) }); }
function resetGame(){ selected = []; renderPlate(); updateHUDProgress(); track('Reset', {}); }

BTN.start.onclick = startGame;
BTN.finish.onclick = finishGame;
BTN.reset.onclick = resetGame;
BTN.learning.onclick = ()=>{ MODE='Learning'; modeBadge.textContent='Learning'; };
BTN.challenge.onclick= ()=>{ MODE='Challenge'; modeBadge.textContent='Challenge'; };

startGame();
