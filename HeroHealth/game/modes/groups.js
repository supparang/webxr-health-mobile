// === Hero Health Academy — modes/groups.js (Food Group Frenzy; tuned for prod) ===
export const name = 'groups';

// ----- Groups (5 หมู่หลัก) -----
export const GROUPS = [
  { id:'fruits',    labelTH:'ผลไม้',       labelEN:'Fruits',      color:'#ef4444' },
  { id:'veggies',   labelTH:'ผัก',          labelEN:'Vegetables',  color:'#22c55e' },
  { id:'protein',   labelTH:'โปรตีน',       labelEN:'Protein',     color:'#3b82f6' },
  { id:'grains',    labelTH:'ธัญพืช',       labelEN:'Grains',      color:'#f59e0b' },
  { id:'dairy',     labelTH:'นม/ผลิตภัณฑ์', labelEN:'Dairy',       color:'#a855f7' },
];

// ----- Items (ตัวอย่างย่อ; โปรเจ็กต์จริงมี 20/กลุ่มอยู่แล้ว) -----
import { ITEMS20 as ITEMS_FRUITS }  from './groups_sets/fruits20.js';
import { ITEMS20 as ITEMS_VEGGIES } from './groups_sets/veggies20.js';
import { ITEMS20 as ITEMS_PROTEIN } from './groups_sets/protein20.js';
import { ITEMS20 as ITEMS_GRAINS }  from './groups_sets/grains20.js';
import { ITEMS20 as ITEMS_DAIRY }   from './groups_sets/dairy20.js';

const ITEMS = [
  ...ITEMS_FRUITS.map(x=>({...x, group:'fruits'})),
  ...ITEMS_VEGGIES.map(x=>({...x, group:'veggies'})),
  ...ITEMS_PROTEIN.map(x=>({...x, group:'protein'})),
  ...ITEMS_GRAINS.map(x=>({...x, group:'grains'})),
  ...ITEMS_DAIRY.map(x=>({...x, group:'dairy'})),
];

// ----- Tunables (เช็กลิสต์ 1–3) -----
const probTarget = 0.58;           // โอกาสสุ่มชิ้น “ตรงหมวดเป้าหมาย”
const LIFE_MS    = 3000;           // TTL เฉลี่ย 2.8–3.2s (ตรงข้อแนะนำ)
const NEED_BY_DIFF = { Easy:3, Normal:4, Hard:5 };

const POWER_DUR = { x2:8, freeze:3, magnet:2 };  // s

// ----- Mini-Quests (1 ง่าย + 1 กลาง + 1 ยาก ต่อเกม) -----
const QUESTS_POOL = [
  { id:'q_easy_collect6',   labelTH:'เก็บให้ถูก 6 ชิ้น',      labelEN:'Pick 6 correct items',   need:6, diff:'easy',  test:(ev)=>ev.result==='good' && ev.meta?.good },
  { id:'q_easy_combo8',     labelTH:'ทำคอมโบ x8',            labelEN:'Reach combo x8',         need:8, diff:'easy',  test:(ev)=>ev.comboNow>=8 },

  { id:'q_mid_noBad5',      labelTH:'ห้ามพลาด 5 ชิ้นติด',     labelEN:'No miss for 5 hits',     need:5, diff:'mid',   test:(ev)=>ev.result!=='bad' },
  { id:'q_mid_target2',     labelTH:'เคลียร์ 2 หมวด',         labelEN:'Clear 2 targets',        need:2, diff:'mid',   test:(ev)=>ev.type==='target_clear' },

  { id:'q_hard_speed5',     labelTH:'เก็บเร็ว 1.2s/ชิ้น ×5',  labelEN:'Fast pick 5 times',      need:5, diff:'hard',  test:(ev)=>ev.type==='fast_hit' },
  { id:'q_hard_combo15',    labelTH:'ทำคอมโบ x15',            labelEN:'Reach combo x15',        need:15,diff:'hard',  test:(ev)=>ev.comboNow>=15 },
];

const ST = {
  lang:'TH',
  targetId:'fruits',
  need:4,
  got:0,
  lastSwitchAt:0,
  lastSpawnAt:0,
  missions:[],
  missionProg:{},
  freezeUntil:0,
  magnetNext:false,
};

// ----- Public API -----
export function init(gameState, hud, diff){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  ST.need = NEED_BY_DIFF[gameState?.difficulty] ?? 4;
  ST.got = 0;
  ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
  showTargetHUD(true);
  updateTargetBadge();

  // เตรียมเควส: สุ่ม 1 ง่าย + 1 กลาง + 1 ยาก
  const easy = randPick(QUESTS_POOL.filter(q=>q.diff==='easy'), 1);
  const mid  = randPick(QUESTS_POOL.filter(q=>q.diff==='mid'), 1);
  const hard = randPick(QUESTS_POOL.filter(q=>q.diff==='hard'), 1);
  ST.missions = [...easy, ...mid, ...hard];
  ST.missionProg = Object.fromEntries(ST.missions.map(q=>[q.id,0]));
  publishMissionsHUD();
}

export function cleanup(){
  showTargetHUD(false);
}

// main.js จะเรียกใช้ทุกครั้งที่ spawn
export function pickMeta(diff, gameState){
  const now = performance.now();
  ST.lastSpawnAt = now;

  const pickTarget = Math.random() < probTarget;
  const pool = pickTarget
    ? ITEMS.filter(i=>i.group===ST.targetId)
    : ITEMS.filter(i=>i.group!==ST.targetId);

  const it = pool[(Math.random()*pool.length)|0];

  return {
    id: it.id,
    char: it.icon,
    label: ST.lang==='EN' ? it.labelEN : it.labelTH,
    aria: `${ST.lang==='EN'?it.labelEN:it.labelTH} (${groupLabel(ST.targetId)})`,
    good: (it.group===ST.targetId),
    life: LIFE_MS,
    groupId: it.group,
    decoy: !pickTarget
  };
}

export function onHit(meta, systems, gameState, hud){
  const now = performance.now();
  const fast = (now - ST.lastSpawnAt) <= 1200; // เร็วตามเควสยาก

  if (meta.good){
    ST.got++;
    updateTargetBadge();
    systems.coach?.say?.(t('ใช่เลย!', 'Nice!', ST.lang));
    if (fast) pushQuestEvent({type:'fast_hit'});
    pushQuestEvent({result:'good', meta, comboNow:gameState.combo});

    if (ST.magnetNext){ ST.magnetNext=false; } // ใช้แล้วหมด
    if (ST.got >= ST.need){
      ST.got = 0;
      ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
      updateTargetBadge();
      systems.sfx?.play?.('powerup');
      systems.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
      pushQuestEvent({type:'target_clear'});
    }
    return 'good';
  } else {
    systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
    pushQuestEvent({result:'bad', meta, comboNow:gameState.combo});
    return 'bad';
  }
}

export function tick(state, systems){
  // freeze (หยุด spawn ใน main.js แล้ว; ที่นี่ไม่มีงานเพิ่ม)
}

export function cleanupMissionsForTest(){ ST.missions=[]; ST.missionProg={}; }

// ----- Powers for main.js (ข้อ 3) -----
export const powers = {
  x2Target(){ // คูณแต้มเฉพาะไอเท็มตรงหมวด (ให้ main.js คูณผ่าน fever.mul? ใช้คะแนน base+combo พอ)
    // แนะนำให้ main.js ใช้ fever.mul อยู่แล้ว; ถ้าต้องเฉพาะหมวด ให้เพิ่ม flag ใน state.ctx ก็ได้
    // ที่นี่พ่วงโค้ช/เสียงเป็นหลัก
    try{ document.getElementById('sfx-powerup')?.play(); }catch{}
  },
  freezeTarget(){
    ST.freezeUntil = performance.now() + POWER_DUR.freeze*1000;
  },
  magnetNext(){
    ST.magnetNext = true; // ชิ้นถัดไปที่ตรงหมวดจะ “ดูดความสนใจ” (ตรรกะ UI จัดการจากผู้เล่น)
  }
};

export function getPowerDurations(){ return POWER_DUR; }

// ----- HUD helpers -----
function showTargetHUD(show){
  const wrap = document.getElementById('targetWrap');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}
function updateTargetBadge(){
  const g = GROUPS.find(x=>x.id===ST.targetId);
  const badge = document.getElementById('targetBadge');
  if (badge){
    badge.textContent = t(g.labelTH, g.labelEN, ST.lang) + `  (${ST.got}/${ST.need})`;
    badge.style.fontWeight = '800';
    badge.setAttribute('aria-live','polite');
  }
  const tLabel = document.getElementById('t_target');
  if (tLabel) tLabel.textContent = t('หมวด', 'Target', ST.lang);
}
function publishMissionsHUD(){
  // ให้ main.js เป็นคนวาดชิป; ที่นี่แจ้งผ่าน Progress (เผื่อระบบรวม)
  const list = ST.missions.map(q=>({ id:q.id, label: t(q.labelTH,q.labelEN,ST.lang), need:q.need, prog: ST.missionProg[q.id]||0 }));
  try{ window?.Progress?.emit?.('run_start', { missions:list }); }catch{}
}

// ----- Quests progress -----
function pushQuestEvent(ev){
  // อัปเดตทุกเควสที่ test() ผ่าน
  for (const q of ST.missions){
    if (q.test(ev)){
      ST.missionProg[q.id] = Math.min(q.need, (ST.missionProg[q.id]||0)+1);
      try{
        window?.Progress?.emit?.('mission_tick', { id:q.id, prog:ST.missionProg[q.id], need:q.need });
        if (ST.missionProg[q.id] >= q.need){
          window?.Progress?.emit?.('mission_done', { id:q.id });
          popBadgeFX(q);
        }
      }catch{}
    }
  }
  // แจ้ง HUD ใน main.js ให้รีเฟรชชิป
  try{ window?.Progress?.emit?.('run_start', { missions: ST.missions.map(q=>({id:q.id,label:t(q.labelTH,q.labelEN,ST.lang),need:q.need,prog:ST.missionProg[q.id]})) }); }catch{}
}

function popBadgeFX(q){
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;left:50%;top:28%;transform:translate(-50%,-50%);
    font:900 22px/1.2 ui-rounded,system-ui;color:#4ade80;text-shadow:0 2px 10px #000b;z-index:160;pointer-events:none;
    background:rgba(6,44,24,.6);border:1px solid #1f9d55;border-radius:14px;padding:10px 14px;`;
  el.textContent = t('สำเร็จเควส: ', 'Quest Complete: ', ST.lang) + t(q.labelTH, q.labelEN, ST.lang);
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .35s, transform .35s'; el.style.opacity='0'; el.style.transform='translate(-50%,-60%)'; }, 900);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 1300);
}

// ----- Utils -----
function t(th, en, lang){ return lang==='EN' ? en : th; }
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length? cand[(Math.random()*cand.length)|0] : prev;
}
function randPick(arr, n){
  const a = arr.slice(); const out = [];
  while (a.length && out.length<n){ out.push(a.splice((Math.random()*a.length)|0,1)[0]); }
  return out;
}
function groupLabel(id){
  const g = GROUPS.find(x=>x.id===id); if (!g) return id;
  return ST.lang==='EN' ? g.labelEN : g.labelTH;
}
