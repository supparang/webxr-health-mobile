// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, 5 Mini-Quests (สุ่มมา 3), Power-ups (x2 / Freeze) + โค้ชเชียร์

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze'];
const ENABLE_TRAPS = true;
const TRAP_RATE = 0.06;

const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF = { Easy:2600, Normal:2200, Hard:1900 };

// Mini-Quests pool (เราจะสุ่มมา 3 ตอนเริ่ม)
const QUEST_POOL = [
  { type:'collect', labelTH:'เก็บของดีให้ครบ', make:(diff)=>({ need: diff==='Hard'?14: diff==='Easy'?8:10 }) },
  { type:'avoid',   labelTH:'เลี่ยงของขยะให้นาน', make:(diff)=>({ need: diff==='Hard'?14: diff==='Easy'?8:10, remain:0 }) },
  { type:'perfect', labelTH:'PERFECT ให้ครบ', make:(diff)=>({ need: diff==='Hard'?6: diff==='Easy'?3:4 }) },
  { type:'combo',   labelTH:'ไปให้ถึงคอมโบ', make:(diff)=>({ need: diff==='Hard'?20: diff==='Easy'?10:14 }) },
  { type:'streak',  labelTH:'เก็บดีติดกัน', make:(diff)=>({ need: diff==='Hard'?10: diff==='Easy'?5:7, streak:0 }) },
];

const QUEST_TIME = 45; // วินาที/เควส

const pick = (arr)=>arr[(Math.random()*arr.length)|0];
const sampleN = (arr, n)=>{
  const a = arr.slice(); const out=[];
  while(a.length && out.length<n){ out.push(a.splice((Math.random()*a.length)|0,1)[0]); }
  return out;
};
const iconOf = (p)=> (p==='scorex2'?'✖️2': (p==='freeze'?'🧊':'✨'));

function lifeAdaptive(diff, state, mul=1){
  const g = state.ctx?.gj;
  const hits = g?.hits || 0, miss = g?.miss || 0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.0;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

// ===== HUD helper: mission line =====
function setMissionLine(text, show=true){
  const el = document.getElementById('missionLine');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (text != null) el.textContent = text;
}
function questLabel(q){
  const TH = {
    collect:(q)=>`🎯 เก็บดี ${q.progress||0}/${q.need}`,
    avoid:(q)=>  `🎯 เลี่ยงขยะ ${Math.max(0,q.remain|0)}s`,
    perfect:(q)=>`🎯 PERFECT ${q.progress||0}/${q.need}`,
    combo:(q)=>  `🎯 คอมโบ x${q.comboNow||0}/x${q.need}`,
    streak:(q)=> `🎯 ติดกัน ${q.streak||0}/${q.need}`,
  };
  const EN = {
    collect:(q)=>`🎯 Collect ${q.progress||0}/${q.need}`,
    avoid:(q)=>  `🎯 Avoid ${Math.max(0,q.remain|0)}s`,
    perfect:(q)=>`🎯 PERFECT ${q.progress||0}/${q.need}`,
    combo:(q)=>  `🎯 Combo x${q.comboNow||0}/x${q.need}`,
    streak:(q)=> `🎯 In a row ${q.streak||0}/${q.need}`,
  };
  const lang = (localStorage.getItem('hha_lang')||'TH');
  const fn = (lang==='TH'?TH:EN)[q.type];
  return fn ? fn(q) : '—';
}

// ===== Public API =====
export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  const gj = {
    hits:0, miss:0,
    lastTs:0,
    questIdx:0,
    quests: sampleN(QUEST_POOL, 3).map(q=>{
      const data = { type:q.type, progress:0, done:false, fail:false, remain:QUEST_TIME };
      Object.assign(data, q.make(state.difficulty));
      return data;
    })
  };
  state.ctx.gj = gj;

  // เริ่มเควสแรก + โค้ชเชียร์
  const cur = gj.quests[gj.questIdx];
  if (cur && state?.fever !== undefined) {
    setMissionLine(`${questLabel(cur)} • ${cur.remain|0}s`, true);
  }
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  // พาวเวอร์
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // กับดัก
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    return { type:'trap', char: pick(TRAPS), good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // อาหาร
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state, hud){
  const { sfx, power, fx, coach } = sys || {};
  const gj = state.ctx?.gj;

  if (!gj) return 'ok';

  // พาวเวอร์
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){ try{ power?.apply?.('boost'); }catch{} fx?.popText?.('SCORE ×2',{color:'#b0ff66'}); }
    else if (meta.power === 'freeze'){ const now = performance?.now?.()||Date.now(); state.freezeUntil = now + 2000; fx?.popText?.('FREEZE!',{color:'#66e0ff'}); }
    return 'power';
  }

  // กับดัก
  if (meta.type === 'trap'){
    try{ sfx?.bad?.(); }catch{} fx?.popText?.('TRAP!',{color:'#ff9b9b'});
    gj.miss++;
    // เควสเลี่ยงขยะรีเซ็ตเวลาที่เหลือ
    const cur = gj.quests[gj.questIdx];
    if (cur?.type==='avoid' && !cur.done && !cur.fail){
      cur.remain = cur.need; // เริ่มนับใหม่
      coach?.onQuestProgress?.(Object.assign({}, cur));
    }
    // streak พัง
    if (cur?.type==='streak') cur.streak = 0;
    return 'bad';
  }

  // อาหาร
  if (meta.type === 'food'){
    if (meta.good){
      gj.hits++;

      // perfect?
      let perfect = false;
      if (meta.ts){
        const dt = (performance?.now?.()||Date.now()) - meta.ts;
        if (dt <= PERFECT_WINDOW_MS) perfect = true;
      }

      // เควสอัปเดต
      const cur = gj.quests[gj.questIdx];
      if (cur && !cur.done && !cur.fail){
        if (cur.type === 'collect'){
          cur.progress++; coach?.onQuestProgress?.(Object.assign({} , cur));
        } else if (cur.type === 'perfect' && perfect){
          cur.progress++; coach?.onQuestProgress?.(Object.assign({}, cur));
        } else if (cur.type === 'combo'){
          cur.comboNow = state?.combo || 0;
          if (cur.comboNow >= cur.need) { cur.progress = cur.need; }
          coach?.onQuestProgress?.(Object.assign({}, cur));
        } else if (cur.type === 'streak'){
          cur.streak = (cur.streak || 0) + 1;
          if (cur.streak > cur.progress) cur.progress = cur.streak;
          coach?.onQuestProgress?.(Object.assign({}, cur));
        }
        // สำเร็จ?
        if ((cur.type==='collect' || cur.type==='perfect' || cur.type==='streak') && cur.progress >= cur.need){
          cur.done = true; coach?.onQuestComplete?.(Object.assign({}, cur));
          advanceQuest(gj, coach);
        }
        if (cur.type==='combo' && (state?.combo||0) >= cur.need){
          cur.done = true; cur.progress = cur.need; coach?.onQuestComplete?.(Object.assign({}, cur));
          advanceQuest(gj, coach);
        }
      }

      try{ sfx?.good?.(); }catch{}
      if (perfect){ fx?.popText?.('PERFECT',{color:'#ccff88'}); return 'perfect'; }
      fx?.popText?.('GOOD',{color:'#7fffd4'}); return 'good';
    } else {
      gj.miss++;
      const cur = gj.quests[gj.questIdx];
      // streak พัง
      if (cur?.type==='streak') cur.streak = 0;
      // combo quest — แจ้งความคืบหน้า
      if (cur?.type==='combo'){ cur.comboNow = state?.combo || 0; coach?.onQuestProgress?.(Object.assign({}, cur)); }
      try{ sfx?.bad?.(); }catch{} fx?.popText?.('JUNK!',{color:'#ff9b9b'}); return 'bad';
    }
  }

  return 'ok';
}

export function tick(state, sys, hud){
  const { coach } = sys || {};
  const gj = state.ctx?.gj; if (!gj) return;

  const cur = gj.quests[gj.questIdx];
  if (!cur){ setMissionLine(null, false); return; }

  // นับเวลา
  cur.remain = Math.max(0, (cur.remain|0) - 1);

  // avoid: ถ้ายังหลีกขยะได้ต่อเนื่อง ลดเวลา (เรารีเซ็ตตอนโดน bad ไปแล้วใน onHit)
  if (cur.type === 'avoid'){
    // แค่ลดตาม tick ก็พอ
    if (cur.remain <= 0){ cur.done = true; cur.progress = cur.need; coach?.onQuestComplete?.(Object.assign({}, cur)); advanceQuest(gj, coach); }
    else coach?.onQuestProgress?.(Object.assign({}, cur));
  } else {
    // type อื่นหมดเวลา = fail
    if (!cur.done && cur.remain === 0){
      cur.fail = true; coach?.onQuestFail?.(Object.assign({}, cur)); advanceQuest(gj, coach);
    }
  }

  // HUD บรรทัดภารกิจ
  setMissionLine(`${questLabel(cur)} • ${cur.remain|0}s`, true);
}

export function cleanup(){ setMissionLine(null, false); }

// ===== helpers =====
function advanceQuest(gj, coach){
  gj.questIdx++;
  const next = gj.quests[gj.questIdx];
  if (next){
    // init state เฉพาะเควส
    next.progress = next.progress|0;
    if (next.type==='avoid'){ next.remain = next.need; }
    if (next.type==='streak'){ next.streak = 0; }
    coach?.onQuestStart?.(Object.assign({}, next));
  } else {
    // เควสครบ 3 แล้ว
    const lang = (localStorage.getItem('hha_lang')||'TH');
    const msg = lang==='TH' ? '🎉 เควสครบแล้ว! โกยคะแนนต่อเลย!' : '🎉 All quests done! Farm more points!';
    coach?.say?.(msg, { stayMs: 1600 });
    setMissionLine(null, false);
  }
}
