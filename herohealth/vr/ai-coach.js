// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// ✅ Prioritized tips (urgent > normal) + dedupe + context-aware
// ✅ Research-friendly: lowers frequency when runMode=research
//
// Expected state fields (flexible):
// { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
// You can pass anything; missing fields are handled.

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const clamp=(v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=0; return v<a?a:(v>b?b:v); };
const qs=(k,def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

function now(){ return performance.now ? performance.now() : Date.now(); }

function normText(s){
  return String(s||'').trim();
}

function safeEmit(emit, payload){
  try{ emit && emit('hha:coach', payload); }catch(_){}
}

function pickRunMode(){
  return String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
}

function pickLang(){
  const l = (DOC && DOC.documentElement && DOC.documentElement.lang) ? DOC.documentElement.lang : '';
  return String(l||'th').toLowerCase();
}

function makeId(str){
  // light hash for dedupe
  str=String(str||''); let h=2166136261;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(16);
}

function oncePerMap(limit=18){
  const map = new Map(); // id -> ts
  return {
    has(id){ return map.has(id); },
    add(id){
      map.set(id, Date.now());
      // prune old
      if (map.size > limit){
        const arr=[...map.entries()].sort((a,b)=>a[1]-b[1]);
        while(map.size>limit){ const k=arr.shift()?.[0]; if(k) map.delete(k); }
      }
    },
    clear(){ map.clear(); }
  };
}

// -------------------- Tip packs --------------------
function tipPackTH(game){
  // You can tune text per game
  const common = {
    calm: [
      { key:'aim_hold',  text:'🎯 เล็งค้างนิดนึงก่อนยิง จะลด MISS และคอมโบยาวขึ้น', why:'ลดการยิงพลาด', tag:'skill' },
      { key:'dontrush',  text:'🧠 อย่ารัวเกินไป เลือกยิงเป้าที่ชัวร์ก่อน', why:'คุมความแม่น', tag:'control' },
      { key:'combo',     text:'⚡ คอมโบกำลังมา! โฟกัส “ยิงติดกัน” คะแนนจะพุ่ง', why:'เพิ่มคะแนน/เกรด', tag:'combo' },
    ],
    excited: [
      { key:'storm_now', text:'🌀 STORM มาแล้ว! ตอนนี้เล่นโหมด “เอาตัวรอด” — เก็บ 🛡️ แล้วรอช่วงท้าย', why:'เตรียมผ่าน Mini', tag:'storm' },
      { key:'endwin',    text:'⏱️ END WINDOW! ตอนนี้ต้อง BLOCK ให้ได้ (ใช้ 🛡️)', why:'ผ่าน Mini/Boss', tag:'urgent' },
      { key:'boss',      text:'🌩️ BOSS WINDOW! เป้า 🌩️ โผล่ถี่ขึ้น — เก็บ 🛡️ แล้ว BLOCK ให้ครบ!', why:'เคลียร์บอส', tag:'boss' },
      { key:'shield_need',text:'🛡️ เก็บโล่ก่อน! มีโล่แล้วค่อยลุยพายุ', why:'กันโดน BAD', tag:'shield' },
    ],
    feedback: [
      { key:'frus_high', text:'😵 MISS เริ่มเยอะแล้ว—พัก 1 วินาที แล้วกลับมาเล็งช้า ๆ', why:'ลดความลน', tag:'frustration' },
      { key:'fatigue',   text:'🌿 ใกล้ท้ายเวลาแล้ว—เล่นให้เนียน ไม่ต้องรีบ', why:'รักษาคะแนน', tag:'fatigue' },
      { key:'praise',    text:'🔥 สวย! ฟอร์มดีมาก เก็บจังหวะนี้ไว้', why:'เสริมแรง', tag:'praise' },
    ]
  };

  if (String(game||'') === 'hydration'){
    return {
      ...common,
      hydration: [
        { key:'green', text:'💧 เป้าหมายหลัก: คุมให้อยู่ GREEN ให้นาน ๆ (สะสม)', why:'ผ่าน Stage 1', tag:'stage1' },
        { key:'leave_green', text:'🌀 จะผ่านพายุ ต้องทำให้น้ำ “ไม่ GREEN” (LOW/HIGH) ก่อน แล้วค่อย BLOCK ช่วงท้าย', why:'ผ่าน Stage 2', tag:'stage2' },
      ]
    };
  }

  return common;
}

// -------------------- Decision logic --------------------
function chooseTip({ pack, state, game }){
  const s = state || {};
  const inStorm = !!s.inStorm;
  const inEnd   = !!s.inEndWindow;
  const shield  = (s.shield|0);
  const misses  = (s.misses|0);
  const combo   = (s.combo|0);

  const skill = clamp(s.skill ?? 0.45, 0, 1);
  const fatigue = clamp(s.fatigue ?? 0.0, 0, 1);
  const frus = clamp(s.frustration ?? 0.0, 0, 1);

  // URGENT: end window => block now
  if (inEnd){
    if (shield <= 0){
      // still urgent: but explain what to do next
      return { ...pack.excited.find(x=>x.key==='endwin'), priority: 3, meta:{ need:'shield' } };
    }
    return { ...pack.excited.find(x=>x.key==='endwin'), priority: 3 };
  }

  // Storm: prefer shield / storm instructions
  if (inStorm){
    if (shield <= 0) return { ...pack.excited.find(x=>x.key==='shield_need'), priority: 2 };
    // boss hint when high pressure moment (we infer by low time or high misses+storm)
    if (misses >= 6 && shield > 0) return { ...pack.excited.find(x=>x.key==='boss') , priority: 2 };
    return { ...pack.excited.find(x=>x.key==='storm_now'), priority: 2 };
  }

  // Hydration specific: if waterZone GREEN and still early -> encourage Stage1
  if (String(game||'') === 'hydration'){
    const z = String(s.waterZone||'').toUpperCase();
    if (z === 'GREEN' && fatigue < 0.7){
      const t = (pack.hydration && pack.hydration.find(x=>x.key==='green')) || null;
      if (t) return { ...t, priority: 1 };
    }
    if (z === 'GREEN' && fatigue >= 0.7){
      // late-game: keep calm
      return { ...pack.feedback.find(x=>x.key==='fatigue'), priority: 1 };
    }
    if (z !== 'GREEN' && fatigue < 0.6){
      const t = (pack.hydration && pack.hydration.find(x=>x.key==='leave_green')) || null;
      if (t) return { ...t, priority: 1 };
    }
  }

  // High frustration => calming anti-tilt
  if (frus >= 0.62 || misses >= 18){
    return { ...pack.feedback.find(x=>x.key==='frus_high'), priority: 2 };
  }

  // Praise when good streak
  if (skill >= 0.78 && combo >= 10 && misses <= 6){
    return { ...pack.feedback.find(x=>x.key==='praise'), priority: 1 };
  }

  // Skill guidance
  if (skill < 0.45){
    return { ...pack.calm.find(x=>x.key==='aim_hold'), priority: 1 };
  }

  // Combo encouragement
  if (combo >= 6){
    return { ...pack.calm.find(x=>x.key==='combo'), priority: 1 };
  }

  // Default: don’t rush
  return { ...pack.calm.find(x=>x.key==='dontrush'), priority: 0 };
}

// -------------------- Public API --------------------
export function createAICoach(opts={}){
  const emit = opts.emit || ((name,detail)=>{ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} });
  const game = String(opts.game || qs('gameMode', qs('game','')) || '').toLowerCase();
  const lang = pickLang();

  const runMode = pickRunMode();
  const research = (runMode === 'research');

  // Rate limit
  const baseCooldown = clamp(opts.cooldownMs ?? 3200, 900, 12000);
  const cooldownMs = research ? Math.max(6500, baseCooldown*1.7) : baseCooldown;

  const seen = oncePerMap(24);

  const S = {
    started:false,
    lastTipAt: 0,
    lastTipId: '',
    lastState: null,
    lastPriority: 0,
    quiet: false
  };

  const pack = (lang.startsWith('th') ? tipPackTH(game) : tipPackTH(game)); // (ตอนนี้ทำ TH เป็นหลัก)

  function canSpeak(priority){
    if (S.quiet) return false;
    const t = now();
    const dt = t - (S.lastTipAt||0);
    // Urgent tips can break cooldown a bit
    const need = priority >= 3 ? Math.min(900, cooldownMs*0.25) : cooldownMs;
    return dt >= need;
  }

  function speak(tip){
    if (!tip || !tip.text) return false;

    const text = normText(tip.text);
    const why  = normText(tip.why || '');
    const id   = makeId(text + '|' + why);

    if (seen.has(id)) return false;

    S.lastTipAt = now();
    S.lastTipId = id;
    S.lastPriority = tip.priority|0;
    seen.add(id);

    safeEmit(emit, {
      type: 'tip',
      game,
      priority: tip.priority|0,
      tag: tip.tag || '',
      text,
      why
    });

    return true;
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    S.lastTipAt = 0;
    S.lastTipId = '';
    S.lastPriority = 0;
    S.quiet = false;
    // tiny greeting (but not too chatty in research)
    if (!research){
      safeEmit(emit, {
        type:'hello',
        game,
        priority: 0,
        text:'👋 พร้อมแล้ว! โฟกัส “ชัวร์ก่อนเร็ว” แล้วค่อยเร่งคอมโบ',
        why:'เริ่มเกมแบบนิ่ง ๆ ก่อน'
      });
      S.lastTipAt = now();
    }
  }

  function onUpdate(state){
    if (!S.started) return;

    const s = state || {};
    S.lastState = s;

    // Optional mute switch
    if (s.coachQuiet === true) S.quiet = true;
    if (s.coachQuiet === false) S.quiet = false;

    const tip = chooseTip({ pack, state:s, game });
    if (!tip) return;

    // research: only urgent + high frustration
    if (research){
      const frus = clamp(s.frustration ?? 0, 0, 1);
      const urgent = !!s.inEndWindow;
      if (!urgent && frus < 0.72) return;
    }

    if (!canSpeak(tip.priority|0)) return;
    speak(tip);
  }

  function onEnd(summary){
    // End summary nudge (1 line)
    try{
      const grade = String(summary?.grade || '').toUpperCase();
      const miss  = Number(summary?.misses||0);
      const acc   = Number(summary?.accuracyGoodPct||0);

      let msg='✅ จบแล้ว! รอบหน้าโฟกัสคุมจังหวะ + เก็บโล่ก่อนพายุ';
      let why='เก็บคะแนนให้เสถียร';

      if (grade==='SSS' || grade==='SS'){
        msg='🏆 โหดมาก! รอบหน้า “ลากคอมโบ” แล้วลองผ่านทุกพายุให้ได้';
        why='ดันขึ้น Legend';
      } else if (acc < 60){
        msg='🎯 รอบหน้าเล็งช้าลงนิดนึง จะช่วยให้ Accuracy พุ่ง';
        why='ลดการพลาด';
      } else if (miss > 18){
        msg='🧠 รอบหน้าลดการรัว เลือกยิงเป้าที่ชัวร์ก่อน';
        why='MISS จะลดเอง';
      }

      safeEmit(emit, { type:'end', game, priority:1, text:msg, why });
    }catch(_){}
  }

  return { onStart, onUpdate, onEnd };
}