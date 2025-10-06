/* Nutrition Traffic VR
   - ไอเท็มอาหารวิ่งมาตาม “สายพาน”
   - ผู้เล่นเลือก “หมู่อาหาร” ให้ตรงก่อนถึงเส้นตัดสิน (judge line)
   - เหมาะ ป.5: มี Hint (สี/คำอธิบายหมู่), ปุ่มใหญ่, เล่นได้ทั้ง gaze/fuse และปุ่มจอ
   - Import เมนูจาก JSON / Export ผลลัพธ์เป็น JSON
   - ไม่มีไฟล์ภาพภายนอก ใช้กล่อง + ข้อความไทยอ่านง่าย
*/

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const hudText = $("#hudText");
const scoreEl = $("#score");
const okEl = $("#ok");
const missEl = $("#miss");
const timeBar = $("#timeBar");
const btnStart = $("#btnStart");
const btnReset = $("#btnReset");
const btnExport = $("#btnExport");
const modeSel = $("#mode");
const hintSel = $("#hints");
const importInput = $("#importFoods");

const root = document.getElementById("root");

// กลุ่มอาหาร 5 หมู่ + สี
const GROUPS = {
  grain:     { th: "ธัญพืช/แป้ง",   color: "#fde68a" },
  vegetable: { th: "ผัก",           color: "#bbf7d0" },
  fruit:     { th: "ผลไม้",         color: "#fecaca" },
  protein:   { th: "โปรตีน",        color: "#c7d2fe" },
  dairy:     { th: "นม/ผลิตภัณฑ์นม", color: "#e0e7ff" },
};
const GROUP_KEYS = Object.keys(GROUPS);

// เมนูตัวอย่าง (แก้/เพิ่มได้)
let FOODS = [
  { id:"rice", name:"ข้าวสวย", group:"grain", kcal:160, carb:35, protein:3, fat:0.5 },
  { id:"noodle", name:"ก๋วยเตี๋ยว", group:"grain", kcal:250, carb:45, protein:8, fat:5 },
  { id:"lettuce", name:"ผักกาดหอม", group:"vegetable", kcal:10, carb:2, protein:1, fat:0 },
  { id:"carrot", name:"แครอท", group:"vegetable", kcal:25, carb:6, protein:0.5, fat:0 },
  { id:"banana", name:"กล้วย", group:"fruit", kcal:100, carb:23, protein:1, fat:0.3 },
  { id:"orange", name:"ส้ม", group:"fruit", kcal:60, carb:15, protein:1, fat:0.1 },
  { id:"fish", name:"ปลาเผา", group:"protein", kcal:120, carb:0, protein:22, fat:4 },
  { id:"egg", name:"ไข่ต้ม", group:"protein", kcal:80, carb:0, protein:7, fat:5 },
  { id:"milk", name:"นมจืด", group:"dairy", kcal:110, carb:12, protein:6, fat:4 },
  { id:"yogurt", name:"โยเกิร์ต", group:"dairy", kcal:90, carb:14, protein:5, fat:2 }
];

// สถานะเกม
const state = {
  running:false,
  elapsed:0,
  duration:60,        // วินาที
  speed:0.9,          // ความเร็ววิ่งเข้าหากล้อง (มาก = เร็ว)
  spawnEvery:1.3,     // เวลาระหว่างเกิดไอเท็ม
  lastSpawn:0,
  items:[],
  selectedGroup:"grain",
  score:0, ok:0, miss:0,
  resultLog:[],
  hint:true,
  raf:0,
  startTs:0
};

// ปุ่มเลือกหมู่บนจอ
$$(".bins .b").forEach(b=>{
  b.addEventListener("click", ()=>{
    state.selectedGroup = b.dataset.g;
    flashHUD(`เลือกหมู่: ${GROUPS[state.selectedGroup].th}`, GROUPS[state.selectedGroup].color);
    beep(880,0.03,0.08);
  });
});

// เสียงง่าย ๆ
let actx=null, sfxGain=null;
function ensureAudio(){
  if(actx) return;
  const AC = window.AudioContext||window.webkitAudioContext;
  if(!AC) return;
  actx = new AC();
  sfxGain = actx.createGain();
  sfxGain.gain.value = 0.12;
  sfxGain.connect(actx.destination);
}
function beep(freq=800, dur=0.05, gain=0.12){
  ensureAudio(); if(!actx) return;
  const o=actx.createOscillator(), g=actx.createGain();
  o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(sfxGain);
  const t=actx.currentTime;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.start(t); o.stop(t+dur+0.01);
}

// UI ↔ Mode
function applyMode(){
  const m = modeSel.value;
  if(m==="easy"){ state.speed=0.8; state.spawnEvery=1.5; state.duration=70; state.hint = (hintSel.value==="on"); }
  if(m==="normal"){ state.speed=1.0; state.spawnEvery=1.2; state.duration=60; state.hint = (hintSel.value==="on"); }
  if(m==="hard"){ state.speed=1.25; state.spawnEvery=1.0; state.duration=55; state.hint = (hintSel.value==="on"); }
  setHUD();
}
modeSel.addEventListener('change', applyMode);
hintSel.addEventListener('change', ()=>{ state.hint=(hintSel.value==="on"); setHUD(); });

// HUD
function setHUD(msg){
  const left = state.duration - Math.max(0, Math.floor(state.elapsed));
  const a = `Nutrition Traffic VR\nโหมด: ${modeSel.value.toUpperCase()} • หมู่ที่เลือก: ${GROUPS[state.selectedGroup].th}\nHint: ${state.hint?"On":"Off"} • เวลา: ${left}s`;
  hudText.textContent = msg ? `${msg}\n${a}` : a;
  scoreEl.textContent = state.score;
  okEl.textContent = state.ok;
  missEl.textContent = state.miss;
  const pct = Math.max(0, Math.min(100, (state.elapsed/state.duration)*100));
  timeBar.style.width = `${pct}%`;
}
function flashHUD(text, color="#7dfcc6"){
  const el = document.createElement('div');
  el.className = 'card';
  el.style.position='fixed'; el.style.right='12px'; el.style.bottom='12px';
  el.style.background='rgba(0,0,0,.7)'; el.style.border=`2px solid ${color}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(()=>{ el.remove(); }, 650);
}

// สร้างไอเท็มอาหาร (a-entity)
function makeFoodEntity(food){
  const node = document.createElement('a-entity');
  node.classList.add('food');

  // กล่องพื้น + สีตามหมู่
  node.setAttribute('geometry','primitive: box; width: 0.55; height: 0.32; depth: 0.18');
  node.setAttribute('material', `color: ${GROUPS[food.group].color}; opacity: 0.98; shader: flat`);

  // ข้อความชื่ออาหาร
  const t = document.createElement('a-entity');
  t.setAttribute('text', `value: ${food.name}; width: 2.8; align: center; color: #111827; wrapCount: 10`);
  t.setAttribute('position', `0 0 0.12`);
  node.appendChild(t);

  // (ถ้ามี Hint) แสดงชื่อหมู่
  if(state.hint){
    const gg = document.createElement('a-entity');
    gg.setAttribute('text', `value: ${GROUPS[food.group].th}; width: 2.6; align: center; color: #111827; wrapCount: 12`);
    gg.setAttribute('position', `0 -0.18 0.12`);
    node.appendChild(gg);
  }

  // เริ่มไกล ๆ แล้ววิ่งเข้าหาเส้นตัดสิน (z=0 คือถึงจุด)
  node.object3D.position.set(0, 0, 2.8);
  root.appendChild(node);
  return node;
}

// สุ่มอาหาร
function randFood(){
  return FOODS[Math.floor(Math.random() * FOODS.length)];
}

// เกมลูป
function startGame(){
  ensureAudio();
  state.running=true; state.elapsed=0; state.lastSpawn=0;
  state.items=[]; state.score=0; state.ok=0; state.miss=0; state.resultLog=[]; state.startTs=performance.now()/1000;
  root.innerHTML='';
  setHUD("เริ่มเกมแล้ว!");
  loop();
}
function resetGame(){
  state.running=false; cancelAnimationFrame(state.raf);
  state.items=[]; root.innerHTML='';
  state.elapsed=0; state.score=0; state.ok=0; state.miss=0; setHUD("รีเซ็ตแล้ว พร้อมเริ่ม");
}

function spawnItem(){
  const food = randFood();
  const el = makeFoodEntity(food);
  const it = { food, el, judged:false };
  state.items.push(it);
}

function judgeItem(it){
  if(it.judged) return;
  it.judged = true;
  const correct = (state.selectedGroup === it.food.group);
  if(correct){
    state.score += 10; state.ok += 1; beep(1000,0.05,0.12);
    toast3D("ถูกต้อง +10","#7dfcc6");
  }else{
    state.miss += 1; beep(260,0.06,0.14);
    toast3D("หมู่ไม่ตรง","#fecaca");
  }
  state.resultLog.push({
    id: it.food.id, name: it.food.name, chosen: state.selectedGroup, correct: it.food.group,
    t: Date.now()
  });
  // pop + remove
  try{ it.el.setAttribute("animation__pop","property: scale; to: 1.15 1.15 1.15; dur: 90; dir: alternate"); }catch(e){}
  setTimeout(()=>{ if(it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el); }, 110);
}

function toast3D(text,color="#7dfcc6"){
  const el=document.createElement('a-entity');
  el.setAttribute('text',`value:${text}; width:4; align:center; color:#fff`);
  el.setAttribute('position','0 0.8 0.05');
  el.setAttribute('material',`color:${color}; opacity:0`);
  root.appendChild(el);
  try{
    el.setAttribute('animation__up','property: position; to: 0 1.0 0.05; dur: 380; easing:easeOutCubic');
    el.setAttribute('animation__fade','property: opacity; to: 1; dur: 120; dir: alternate');
  }catch(e){}
  setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 420);
}

function loop(){
  if(!state.running) return;
  const now = performance.now()/1000;
  state.elapsed = now - state.startTs;

  // spawn
  if(now - state.lastSpawn >= state.spawnEvery){
    spawnItem(); state.lastSpawn = now;
  }

  // move items
  const speed = state.speed; // z ลดลงตามเวลา
  for(const it of state.items){
    if(!it.el) continue;
    const pos = it.el.object3D.position;
    pos.z = Math.max(0, pos.z - speed * (1/60));  // ประมาณ 60fps
    // ถึงเส้นตัดสิน?
    if(!it.judged && pos.z <= 0.02){
      judgeItem(it);
    }
  }
  // ลบของที่จบแล้ว
  state.items = state.items.filter(x=> x.el && x.el.parentNode && !x.judged);

  // อัปเดต HUD + จบเกม
  setHUD();
  if(state.elapsed >= state.duration){
    state.running=false; endGame();
    return;
  }
  state.raf = requestAnimationFrame(loop);
}

function endGame(){
  beep(1200,0.07,0.16);
  setHUD(`จบเกม! คะแนนรวม: ${state.score}\nถูก: ${state.ok} • พลาด: ${state.miss}`);
}

// ปุ่ม UI
btnStart.addEventListener('click', ()=>{ if(!state.running){ applyMode(); startGame(); }});
btnReset.addEventListener('click', ()=> resetGame());

// เลือกหมู่ด้วยคีย์บอร์ด (ซ้าย→ขวา 1..5)
window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();
  const idx = ["1","2","3","4","5"].indexOf(k);
  if(idx>=0){ state.selectedGroup = GROUP_KEYS[idx]; flashHUD(`เลือกหมู่: ${GROUPS[state.selectedGroup].th}`, GROUPS[state.selectedGroup].color); beep(700+idx*60,0.03,0.09);}
});

// Import JSON เมนู
importInput.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  try{
    const text = await file.text();
    const obj = JSON.parse(text);
    if(Array.isArray(obj.foods)){ FOODS = obj.foods; flashHUD(`อัปเดตเมนู ${FOODS.length} รายการ`, "#7dfcc6"); }
    else if(Array.isArray(obj)){ FOODS = obj; flashHUD(`อัปเดตเมนู ${FOODS.length} รายการ`, "#7dfcc6"); }
    else throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
  }catch(err){
    flashHUD("อ่านไฟล์ไม่สำเร็จ","red");
    console.error(err);
  }finally{
    importInput.value="";
  }
});

// Export ผลลัพธ์
btnExport.addEventListener('click', ()=>{
  const payload = {
    game:"nutrition-traffic-vr",
    mode: modeSel.value,
    hint: state.hint,
    score: state.score,
    ok: state.ok,
    miss: state.miss,
    log: state.resultLog,
    ts: Date.now()
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `nutrition-traffic-result-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// เริ่มต้น
applyMode();
setHUD("พร้อมเริ่ม — เลือกหมู่ด้วยปุ่มด้านล่างหรือกด 1..5 บนคีย์บอร์ด");
