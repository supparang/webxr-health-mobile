// === Hero Health Academy — game/modes/hydration.js (Mini Quests tiered + Badges + FX) ===
export const name = 'hydration';

/* 
  กติกาหลัก (ตามที่กำหนด):
  - ถ้า "ระดับน้ำสูง" แล้วคลิก "น้ำ" → หักคะแนน + หักคอมโบ (bad)
  - ถ้า "ระดับน้ำสูง" แล้วคลิก "น้ำหวาน" → ให้คะแนน (good/ok) + ไม่หักคอมโบ
  - ถ้า "ระดับน้ำต่ำ" แล้วคลิก "น้ำหวาน" → หักคะแนน + หักคอมโบ (bad)
  - (ทั่วไป) คลิกน้ำจะเพิ่มระดับน้ำ, คลิกน้ำหวานจะไม่ช่วย (และใน High จะลดลงเล็กน้อยเพื่อดึงกลับ Mid)
  
  เพิ่ม: Mini Quests 5 อย่าง แบ่ง Easy/Medium/Hard แล้ว "สุ่ม 3 อย่าง/เกม" โดยบังคับ 1 ง่าย + 1 กลาง + 1 ยาก
  พร้อมแสดง chip ใน HUD (#questChips) และมี Badge + เอฟเฟกต์เมื่อผ่านเควส
*/

// ---------- UI helpers ----------
const $ = (s)=>document.querySelector(s);
function t(th, en, lang){ return lang==='EN' ? en : th; }

// ---------- Zones ----------
const ZONE = { LOW:'low', MID:'mid', HIGH:'high' };
const Z_LIMIT = { LOW:34, HIGH:66 }; // <35 = LOW, 35–66 = MID, >66 = HIGH

// ---------- Items ----------
const ITEMS = [
  { id:'water',  kind:'water',  char:'💧', life: 2600 },
  { id:'sweet',  kind:'sweet',  char:'🥤', life: 2600 },
  { id:'juice',  kind:'sweet',  char:'🧃', life: 2600 }, // ผสม decoy/สับขนิดนิดหน่อย
];

// ---------- Mini-Quest pools (tiers) ----------
/* เควส 5 อย่าง
   1) stay_mid: อยู่โซนพอดีต่อเนื่อง X วินาที
   2) no_sugar: ไม่กดเครื่องดื่มหวานตลอดทั้งเกม
   3) right_water: กดน้ำถูกจังหวะ (Low/Mid) ครบ N ครั้ง
   4) no_high_water: ห้ามกดน้ำตอน High เลย
   5) recover_mid: พาเกจกลับเข้ากลางจากนอกโซน N รอบ
*/
const QUEST_POOL = {
  easy: [
    { id:'stay_mid',     labelTH:'คงระดับพอดีต่อเนื่อง 6 วิ',   labelEN:'Stay in Mid for 6s',     type:'timer', need:6 },
    { id:'right_water',  labelTH:'กดน้ำถูกจังหวะ 5 ครั้ง',       labelEN:'Right Water ×5',        type:'counter', need:5 },
    { id:'recover_mid',  labelTH:'พากลับเข้าพอดี 2 รอบ',        labelEN:'Recover to Mid ×2',     type:'counter', need:2 },
  ],
  medium: [
    { id:'stay_mid',     labelTH:'คงระดับพอดีต่อเนื่อง 10 วิ',  labelEN:'Stay in Mid for 10s',    type:'timer', need:10 },
    { id:'right_water',  labelTH:'กดน้ำถูกจังหวะ 7 ครั้ง',       labelEN:'Right Water ×7',         type:'counter', need:7 },
    { id:'recover_mid',  labelTH:'พากลับเข้าพอดี 3 รอบ',        labelEN:'Recover to Mid ×3',      type:'counter', need:3 },
  ],
  hard: [
    { id:'stay_mid',      labelTH:'คงระดับพอดีต่อเนื่อง 14 วิ', labelEN:'Stay in Mid for 14s',    type:'timer',   need:14 },
    { id:'right_water',   labelTH:'กดน้ำถูกจังหวะ 9 ครั้ง',      labelEN:'Right Water ×9',         type:'counter', need:9 },
    { id:'no_high_water', labelTH:'ห้ามกดน้ำตอน High',           labelEN:'No Water in High zone',  type:'flag',    need:1 },
    { id:'no_sugar',      labelTH:'ไม่กดน้ำหวานทั้งเกม',         labelEN:'No Sugar drink at all',  type:'flag',    need:1 },
  ]
};

// ---------- Internal state ----------
const ST = {
  lang: 'TH',
  level: 50,               // 0..100
  zone: ZONE.MID,
  lastZone: ZONE.MID,
  didSweet: false,         // สำหรับ no_sugar
  didWaterInHigh: false,   // สำหรับ no_high_water
  wasOutOfMid: false,      // ใช้ตรวจ recover_mid การเปลี่ยนจากนอกโซน -> กลับ Mid
  recoveredCount: 0,
  rightWaterHits: 0,       // เคาน์เตอร์กดน้ำถูกจังหวะ
  stayMidTimer: 0,         // วินาทีต่อเนื่องใน Mid
  missions: [],            // เควส 3 ชิ้นที่สุ่มได้ (1 ง่าย + 1 กลาง + 1 ยาก)
  done: new Set(),         // qid ที่สำเร็จแล้ว
  /// visual control
  hydrateBarEl: null,
  hydrateLblEl: null,
  fireFxEl: null,
};

// ---------- Power durations (not used by hydration bar here, but kept for consistency) ----------
export function getPowerDurations(){
  return { x2:8, freeze:3, magnet:0 };
}

// ---------- Life cycle ----------
export function init(gameState, hud, diff){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  ST.level = 50; ST.zone = ZONE.MID; ST.lastZone = ZONE.MID;
  ST.didSweet = false; ST.didWaterInHigh = false;
  ST.wasOutOfMid = false; ST.recoveredCount = 0;
  ST.rightWaterHits = 0; ST.stayMidTimer = 0;
  ST.done.clear();

  // ตั้งค่า HUD น้ำ
  const wrap = $('#hydroWrap'); if (wrap) wrap.style.display = 'block';
  ST.hydrateBarEl = $('#hydroBar');
  ST.hydrateLblEl = $('#hydroLabel');
  ensureFireFx();

  // เลือกเควส 3 อย่าง: 1 ง่าย + 1 กลาง + 1 ยาก (สุ่มจาก pool ของแต่ละชั้น)
  ST.missions = pickTieredMissions();
  renderQuestChips(ST.missions);

  updateHydroHUD(true);
}

export function cleanup(){
  const wrap = $('#hydroWrap'); if (wrap) wrap.style.display = 'none';
  const host = $('#questChips'); if (host) host.innerHTML = '';
  removeFireFx();
}

// dtSec ถูกเรียกจาก main.js ทุกวินาที (เราไม่ต้องใช้อ็อบเจ็กต์ systems/hud ที่นี่โดยตรง)
export function tick(state, systems, hud){
  // อัปเดต stay_mid ต่อเนื่อง
  if (ST.zone === ZONE.MID){
    ST.stayMidTimer += 1;
  } else {
    ST.stayMidTimer = 0;
  }
  // ตรวจ recover_mid (หลุดจาก mid แล้วกลับเข้าสู่ mid = +1)
  if (ST.lastZone !== ST.zone){
    if (ST.lastZone !== ZONE.MID && ST.zone === ZONE.MID){
      ST.recoveredCount += 1;
      checkQuestProgress('recover_mid');
    }
    ST.lastZone = ST.zone;
  }

  // อัปเดตภารกิจแบบ timer/counter/flag
  checkQuestProgress('stay_mid');
  checkQuestProgress('right_water');
  checkQuestProgress('no_high_water'); // จะสำเร็จเมื่อจบเกมและไม่ผิด? เราให้สำเร็จทันทีถ้าเวลาหมด ในที่นี้คุมไม่ได้จากโหมด → ให้เช็คเมื่อจบใน cleanup ก็ได้
  checkQuestProgress('no_sugar');

  updateHydroHUD();
}

// ---------- Spawning ----------
export function pickMeta(diff, gameState){
  // โอกาสให้น้ำโผล่มากกว่าเล็กน้อยเมื่ออยู่นอก Mid เพื่อช่วยแก้
  const wantFix = (ST.zone === ZONE.LOW) ? 0.72 : (ST.zone === ZONE.HIGH ? 0.40 : 0.55);
  const pickWater = Math.random() < wantFix;
  const pool = pickWater ? ITEMS.filter(i=>i.kind==='water') : ITEMS.filter(i=>i.kind==='sweet');
  const it = pool[(Math.random()*pool.length)|0];

  // กำหนดคะแนนพื้นฐาน/ผลลัพธ์จาก zone ณ ตอน spawn (onHit คำนวณซ้ำอีกที)
  const meta = {
    id: it.id,
    kind: it.kind,
    char: it.char,
    life: (diff?.life||3000),
    // บางทีแสดงเป็น decoy เมื่ออยู่นอกจังหวะ (แค่ใส่คลาสช่วยให้ผู้เล่นจำ)
    decoy: (it.kind==='sweet' && ST.zone===ZONE.LOW) || (it.kind==='water' && ST.zone===ZONE.HIGH)
  };
  return meta;
}

// ---------- Hit logic ----------
export function onHit(meta, systems, gameState, hud){
  const z = ST.zone;

  if (meta.kind === 'water'){
    // ปรับระดับน้ำ
    const add = (z===ZONE.LOW) ? +14 : (z===ZONE.MID ? +8 : +0); // ใน High กดน้ำ = ไม่เพิ่ม เพื่อบังคับโทษ
    ST.level = clamp01(ST.level + add);
    recalcZone();

    // Scoring & quests
    if (z === ZONE.HIGH){
      // ห้ามกดน้ำตอน High → โดนหักคะแนนและคอมโบ
      ST.didWaterInHigh = true;
      systems.coach?.say?.(t('สูงไปแล้ว หยุดก่อน!', 'Too high! Hold it!', ST.lang));
      flashHydro('bad');
      updateHydroHUD();
      missionFlagTouch('no_high_water'); // จะ fail flag
      return 'bad';
    } else {
      // น้ำถูกจังหวะ (LOW/MID) นับเป็นความก้าวหน้าเควส
      if (z === ZONE.LOW || z === ZONE.MID){
        ST.rightWaterHits += 1;
        systems.coach?.say?.(t('เยี่ยม ดื่มพอดี!', 'Nice timing!', ST.lang));
        flashHydro('good');
        checkQuestProgress('right_water', true);
      }
      updateHydroHUD();
      return 'good';
    }
  }

  // kind === 'sweet'
  if (meta.kind === 'sweet'){
    ST.didSweet = true;

    if (z === ZONE.HIGH){
      // กำลังสูง → อนุโลมกดหวานได้ (ไม่หักคอมโบ) และช่วยลดให้ลงกลางเล็กน้อย
      ST.level = clamp01(ST.level - 10);
      recalcZone();
      systems.coach?.say?.(t('ระบายลงนิด โอเค!', 'Okay, easing down!', ST.lang));
      flashHydro('ok');
      updateHydroHUD();
      return 'ok'; // ไม่หักคอมโบ (main.js จะไม่เรียก addCombo('bad'))
    } else if (z === ZONE.LOW){
      // ระดับต่ำ → กดหวาน ผิดแนวทาง
      systems.coach?.say?.(t('ตอนนี้หวานไม่ช่วยนะ', 'This won’t help now', ST.lang));
      flashHydro('bad');
      updateHydroHUD();
      return 'bad';
    } else { // MID
      // กลาง → ถือว่าไม่ช่วย ให้ผลลัพธ์เบา ๆ
      systems.coach?.say?.(t('ยังโอเค แต่อย่าบ่อย', 'Okay, but not too much', ST.lang));
      flashHydro('ok');
      updateHydroHUD();
      return 'ok';
    }
  }

  return 'ok';
}

// ---------- Quest logic & Badges ----------
function pickTieredMissions(){
  const pick = (arr)=> structuredClone(arr[(Math.random()*arr.length)|0]);

  const easy   = pick(QUEST_POOL.easy);
  const medium = pick(QUEST_POOL.medium);
  const hard   = pick(QUEST_POOL.hard);

  // เพิ่ม flag type (no_sugar/no_high_water) ให้เริ่มสถานะ “ยังไม่ผิด”
  return [easy, medium, hard].map(q=>{
    return { ...q, prog:0, passed:true }; // passed เอาไว้สำหรับ flag (ยังไม่ผิด)
  });
}

function findMission(id){ return ST.missions.find(m=>m.id===id); }

function checkQuestProgress(id, burst=false){
  const m = findMission(id); if (!m || ST.done.has(m.id)) return;

  if (m.id === 'stay_mid'){
    m.prog = Math.max(m.prog||0, ST.stayMidTimer|0);
    if (m.prog >= (m.need||999)) doneMission(m);
  } 
  else if (m.id === 'right_water'){
    m.prog = ST.rightWaterHits|0;
    if (m.prog >= (m.need||999)) doneMission(m);
  }
  else if (m.id === 'recover_mid'){
    m.prog = ST.recoveredCount|0;
    if (m.prog >= (m.need||999)) doneMission(m);
  }
  else if (m.id === 'no_high_water'){
    // flag: ถ้าผิดกติกา → mark failed (passed=false). จะไม่มีคำว่า “สำเร็จทันที”
    if (ST.didWaterInHigh) m.passed = false;
    // ให้สำเร็จเมื่อเวลาใกล้หมด? เราโชว์ความคืบหน้าเป็น 0/1 แล้วทำสำเร็จตอน endRun
  }
  else if (m.id === 'no_sugar'){
    if (ST.didSweet) m.passed = false;
  }

  renderQuestChips();
}

export function finalizeMissionsOnEnd(){
  // สำหรับ flag (no_sugar, no_high_water) ให้ตัดสินตอนจบรอบ
  for (const m of ST.missions){
    if (ST.done.has(m.id)) continue;
    if (m.id==='no_sugar' || m.id==='no_high_water'){
      if (m.passed){ m.prog = 1; doneMission(m); }
    }
  }
  renderQuestChips();
}

function doneMission(m){
  ST.done.add(m.id);
  // เอฟเฟกต์ + Badge
  toastOK( t('เควสสำเร็จ!', 'Mission Complete!', ST.lang) + ' ' + (ST.lang==='EN'? m.labelEN : m.labelTH) );
  try{ document.getElementById('sfx-powerup')?.play(); }catch{}
  // Award badge (ปลอดภัยหากไม่มีระบบ Progress)
  try{
    window.Progress?.awardBadge?.('hydration_'+m.id, { label: (ST.lang==='EN'? m.labelEN : m.labelTH) });
    window.Progress?.event?.('mission_done', { mode:'hydration', id:m.id });
  }catch{}
  renderQuestChips();
}

// ---------- HUD: quests chips ----------
function renderQuestChips(list){
  const host = $('#questChips'); if (!host) return;
  if (list) ST.missions = list;

  host.innerHTML = '';
  for (const m of ST.missions){
    const need = m.need||1;
    const cur  = Math.min(m.prog||0, need);
    const done = ST.done.has(m.id);
    const label = (ST.lang==='EN'? m.labelEN : m.labelTH) || m.id;

    const chip = document.createElement('div');
    chip.className = 'questChip' + (done?' done':'');
    chip.dataset.qid = m.id;
    chip.innerHTML = `
      <span class="qLabel">${label}</span>
      <span class="qProg">${cur}/${need}</span>
      <div class="qBar"><i style="width:${Math.min(100,(cur/need)*100)}%"></i></div>`;
    host.appendChild(chip);
  }
}

// ---------- Hydro HUD ----------
function updateHydroHUD(force=false){
  if (!ST.hydrateBarEl || !ST.hydrateLblEl) return;

  const w = Math.max(0, Math.min(100, ST.level|0));
  ST.hydrateBarEl.style.width = w + '%';

  // สีตามโซน + ไฟลุกเมื่อ High
  let bg = 'linear-gradient(90deg,#60a5fa,#34d399)'; // mid
  if (ST.zone === ZONE.LOW) bg = 'linear-gradient(90deg,#60a5fa,#f43f5e)';
  if (ST.zone === ZONE.HIGH) bg = 'linear-gradient(90deg,#fbbf24,#f97316)';
  ST.hydrateBarEl.style.background = bg;

  const label = (
    ST.zone===ZONE.LOW  ? t('ต่ำ', 'Low', ST.lang) :
    ST.zone===ZONE.MID  ? t('พอดี', 'Mid', ST.lang) :
                          t('สูง', 'High', ST.lang)
  ) + ` (${w}%)`;

  ST.hydrateLblEl.textContent = label;

  // ไฟลุกตอน High
  if (ST.zone === ZONE.HIGH) showFireFx(); else hideFireFx();
}

function ensureFireFx(){
  if (ST.fireFxEl) return;
  const el = document.createElement('div');
  el.className = 'hydro-firefx';
  el.style.cssText = `
    position:relative; width:100%; height:0; 
  `;
  const wrap = $('#hydroWrap');
  if (wrap) wrap.appendChild(el);
  ST.fireFxEl = el;
}
function showFireFx(){
  if (!ST.fireFxEl) return;
  if (!ST.fireFxEl.querySelector('.flame')){
    const f = document.createElement('div');
    f.className='flame';
    f.style.cssText = `
      position:absolute; right:0; top:-18px; width:22px; height:22px; 
      border-radius:50%; filter:blur(6px);
      background: radial-gradient(closest-side,#ffd54a,#ff6d00);
      animation: hydroFlame .5s ease-in-out infinite alternate;
    `;
    ST.fireFxEl.appendChild(f);
    injectFlameKF();
  }
}
function hideFireFx(){
  if (!ST.fireFxEl) return;
  const f = ST.fireFxEl.querySelector('.flame'); if (f) f.remove();
}
function removeFireFx(){
  if (ST.fireFxEl){ try{ ST.fireFxEl.remove(); }catch{} ST.fireFxEl=null; }
}
function injectFlameKF(){
  if (document.getElementById('kfHydroFlame')) return;
  const st = document.createElement('style');
  st.id = 'kfHydroFlame';
  st.textContent = `@keyframes hydroFlame { from{transform:translateY(0) scale(0.9)} to{transform:translateY(-3px) scale(1.1)} }`;
  document.head.appendChild(st);
}

function flashHydro(kind){
  const bar = ST.hydrateBarEl?.parentElement?.parentElement; // .bar > #hydroBar
  if (!bar) return;
  const cs = bar.style.transition;
  bar.style.transition = 'filter .12s ease, transform .12s ease';
  bar.style.filter = (kind==='bad')?'brightness(1.25) saturate(1.15) hue-rotate(20deg)':'brightness(1.25) saturate(1.1)';
  bar.style.transform = (kind==='bad')? 'scale(1.015)': 'scale(1.008)';
  setTimeout(()=>{ bar.style.filter=''; bar.style.transform=''; bar.style.transition=cs; }, 180);
}

// ---------- utils ----------
function clamp01(v){ return Math.max(0, Math.min(100, v)); }
function recalcZone(){
  const v = ST.level|0;
  ST.zone = (v <= Z_LIMIT.LOW) ? ZONE.LOW : (v >= Z_LIMIT.HIGH ? ZONE.HIGH : ZONE.MID);
}
function toastOK(msg){
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; left:50%; top:18%; transform:translateX(-50%); 
    background:rgba(25,40,70,.88); border:1px solid #3b84f6; color:#dff1ff;
    padding:10px 14px; font:800 14px/1.3 ui-rounded,system-ui; border-radius:12px; 
    z-index:180; opacity:0; translate:0 6px; transition:opacity .18s, translate .18s;
    text-shadow:0 2px 8px #000a;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.translate='0 -6px'; setTimeout(()=>{ try{el.remove();}catch{} }, 200); }, 900);
}

// ---------- Optional: โหมดไม่มี power bar ของ hydration ----------
export const powers = {
  // เผื่ออนาคตต้องการรองรับปุ่ม power bar ทั่วไป
  x2Target(){ /* not used in hydration now */ },
  freezeTarget(){ /* not used in hydration now */ },
  magnetNext(){ /* not used in hydration now */ },
};

// ---------- Hook จาก main.js ตอนจบเกม (ถ้ามีการเรียก) ----------
export function onEndGame(){
  finalizeMissionsOnEnd();
}
