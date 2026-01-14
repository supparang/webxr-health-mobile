// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Kids-friendly + Anti-spam + Cross-game)
//
// Usage:
//   import { createAICoach } from '../vr/ai-coach.js';
//   const AICOACH = createAICoach({ emit, game:'hydration', cooldownMs:3000 });
//   AICOACH.onStart(); AICOACH.onUpdate(state); AICOACH.onEnd(summary);
//
// Emits:
//   emit('hha:coach', { game, tone, msg, tag, at, meta })
//
// URL controls (optional):
//   ?coach=0            disable coach
//   ?kids=1             kids-friendly messages (default detect by param)
//   ?coachVerb=0.85     verbosity 0..1 (lower = fewer)
//   ?coachCd=3000       cooldown override
//   ?run=research       (you already do) => less chatter automatically

'use strict';

export function createAICoach(opts = {}){
  const WIN = (typeof window !== 'undefined') ? window : globalThis;
  const DOC = WIN.document;

  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : ((name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } });

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now=()=> Date.now();

  const game = String(opts.game || 'game').toLowerCase();

  // ---- feature flags ----
  const coachQ = String(qs('coach','1')).toLowerCase();
  const enabled = !(coachQ==='0' || coachQ==='false' || coachQ==='off') && (opts.enabled !== false);

  const kidsQ = String(qs('kids', opts.kids ? '1' : '0')).toLowerCase();
  const kids = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

  const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const inResearch = (run === 'research' || run === 'study');

  // Verbosity: fewer messages in research by default
  const verbBase = clamp(parseFloat(qs('coachVerb', String(opts.verbosity ?? (inResearch ? 0.35 : 0.70)))), 0.05, 1.0);

  // Cooldown
  const cdMs = clamp(parseInt(qs('coachCd', String(opts.cooldownMs ?? 3000)), 10) || 3000, 800, 12000);

  // Hard limits
  const maxPerRun = clamp(parseInt(qs('coachMax', String(opts.maxPerRun ?? (inResearch ? 6 : 12))),10) || 12, 2, 25);
  const minGapImportantMs = 900; // prevent double-fire in same moment

  // ---- state ----
  const S = {
    started:false,
    lastAt:0,
    lastImportantAt:0,
    count:0,
    lastTag:'',
    lastMsg:'',
    // Keep a short memory to avoid repeating
    hist: [],
    // last computed buckets
    lastStage: 0,
    lastZone: '',
    lastStorm: false,
    lastEndWindow: false,
    lastShield: -1
  };

  function chance(p){
    // deterministic-ish: tie to time bucket so not too random in research
    if (!inResearch) return Math.random() < p;
    const t = Math.floor((now() / 3000)); // 3s bucket
    const h = (t * 2654435761) >>> 0;
    const r = (h % 1000) / 1000;
    return r < p;
  }

  function alreadySaidSimilar(tag){
    if (!tag) return false;
    if (S.lastTag === tag) return true;
    return S.hist.includes(tag);
  }

  function pushHist(tag){
    if (!tag) return;
    S.hist.push(tag);
    if (S.hist.length > 10) S.hist.shift();
  }

  function say(msg, meta = {}){
    if (!enabled) return false;
    if (!msg) return false;
    if (S.count >= maxPerRun) return false;

    const t = now();
    if (t - S.lastAt < cdMs) return false;

    // extra guard for important bursts
    if (meta.important && (t - S.lastImportantAt) < minGapImportantMs) return false;

    S.lastAt = t;
    if (meta.important) S.lastImportantAt = t;

    S.count++;
    S.lastMsg = msg;
    S.lastTag = meta.tag || '';

    if (meta.tag) pushHist(meta.tag);

    emit('hha:coach', {
      game,
      tone: kids ? 'kids' : 'normal',
      msg,
      tag: meta.tag || '',
      at: t,
      meta: Object.assign({}, meta)
    });

    return true;
  }

  // ---- message library ----
  const MSG = {
    start: kids
      ? ['พร้อมนะ! เล็งกลางจอแล้วค่อยยิง 😊', 'เริ่มเลย! อย่ารัวนะ ยิงให้ชัวร์!', 'ไป! เก็บคอมโบยาว ๆ กัน ✨']
      : ['เริ่มเกมแล้ว—เล็งนิ่ง ๆ แล้วค่อยยิง', 'เริ่มเลย! โฟกัสคอมโบ', 'เริ่มเกม: คุมจังหวะยิงให้ชัวร์'],
    good: kids
      ? ['ดีมาก!', 'เยี่ยม!', 'ชัวร์มาก!', 'คอมโบขึ้นแล้ว!']
      : ['ดี!', 'แม่น!', 'คอมโบกำลังมา', 'จังหวะดี'],
    miss: kids
      ? ['ค่อย ๆ เล็งก่อนนะ', 'ลองหยุดรัว แล้วค่อยยิง', 'ไม่เป็นไร เอาใหม่!']
      : ['เล็งนิ่งขึ้นอีกนิด', 'ลดการรัว—ยิงให้ชัวร์', 'รีเซ็ตจังหวะแล้วไปต่อ'],
    green: kids
      ? ['อยู่ GREEN แล้ว! เก็บไว้ให้นาน ๆ', 'GREEN สวย! อย่าหลุดนะ']
      : ['GREEN แล้ว—รักษาโซนไว้', 'คุม GREEN ให้ต่อเนื่อง'],
    low: kids
      ? ['LOW แล้ว! ยิง 💧 เพิ่มหน่อย', 'น้ำต่ำไป—เติม 💧!']
      : ['LOW: เติม 💧 เพื่อกลับเข้า GREEN', 'น้ำต่ำ—ยิงเป้าดีเพิ่ม'],
    high: kids
      ? ['HIGH แล้ว! หยุดเติมเยอะนะ', 'น้ำสูงไป—ระวัง!']
      : ['HIGH: ระวังอย่าเติมเกิน', 'น้ำสูง—คุมกลับเข้า GREEN'],
    stormSoon: kids
      ? ['ใกล้พายุแล้ว! เก็บ 🛡️ ไว้', 'พายุจะมา เตรียม 🛡️!']
      : ['ใกล้ STORM: เก็บ 🛡️ ไว้', 'เตรียม STORM—สะสมโล่'],
    storm: kids
      ? ['STORM มาแล้ว! ทำ MINI ให้ผ่านนะ!', 'พายุ! ห้ามโดน BAD นะ!']
      : ['STORM: เข้า MINI แล้ว—อย่าโดน BAD', 'เริ่มพายุ: ทำเงื่อนไข MINI'],
    endWindow: kids
      ? ['ช่วงท้ายแล้ว! BLOCK ตอนนี้!', 'ตอนนี้แหละ! ใช้ 🛡️ BLOCK!']
      : ['End Window: BLOCK ตอนนี้', 'ช่วงท้ายพายุ—ใช้โล่บล็อก'],
    boss: kids
      ? ['BOSS! ต้อง BLOCK 🌩️ ให้ครบ!', 'บอสมา! ใช้ 🛡️ เลย!']
      : ['BOSS WINDOW: BLOCK 🌩️ ให้ครบ', 'บอส: บล็อกให้ถึงเป้า'],
    shield0: kids
      ? ['โล่หมดแล้ว ระวัง BAD!', 'ไม่มี 🛡️ แล้ว เล่นช้า ๆ นะ']
      : ['โล่หมด—ระวังโดน BAD', 'ไม่มีโล่: คุมความเสี่ยง'],
    shieldUp: kids
      ? ['ได้ 🛡️ แล้ว เก็บไว้บล็อกช่วงท้าย!', 'โล่เพิ่ม! ดีเลย!']
      : ['ได้โล่—เก็บไว้ใช้ท้ายพายุ', 'โล่เพิ่ม—ดีมาก'],
    stage2: kids
      ? ['Stage 2! ผ่านพายุให้ได้ 1 ครั้ง!', 'ไป Stage 2 แล้ว! สู้!']
      : ['เข้าสู่ Stage 2: ผ่าน MINI อย่างน้อย 1 ครั้ง', 'Stage 2: ลุย MINI'],
    stage3: kids
      ? ['Stage 3! เคลียร์บอสกัน!', 'สุดท้ายแล้ว! บอสมาแน่!']
      : ['Stage 3: เคลียร์ BOSS', 'เข้าสู่ Stage 3—บอส'],
  };

  function pick(arr){
    if (!arr || !arr.length) return '';
    const i = Math.floor((inResearch ? ((now()/1000)|0) : Math.random()*9999) % arr.length);
    return arr[i];
  }

  // ---- decision helpers ----
  function maybe(msgArr, p, tag, meta){
    if (alreadySaidSimilar(tag)) return false;
    if (!chance(p)) return false;
    return say(pick(msgArr), Object.assign({ tag }, meta||{}));
  }

  function onStart(){
    S.started = true;
    S.lastAt = 0;
    S.lastImportantAt = 0;
    S.count = 0;
    S.lastTag = '';
    S.lastMsg = '';
    S.hist = [];
    S.lastStage = 0;
    S.lastZone = '';
    S.lastStorm = false;
    S.lastEndWindow = false;
    S.lastShield = -1;

    if (!enabled) return;
    // Start line: high chance unless research
    const p = inResearch ? 0.35 : 0.85;
    maybe(MSG.start, p, 'start', { important:true });
  }

  // Expect state from your games, e.g. hydration.safe.js sends:
  // { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo, stage }
  function onUpdate(st = {}){
    if (!enabled || !S.started) return;

    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const frustration = clamp(st.frustration ?? 0, 0, 1);

    const inStorm = !!st.inStorm;
    const inEndWindow = !!st.inEndWindow;
    const zone = String(st.waterZone ?? '').toUpperCase();
    const shield = (st.shield|0);
    const misses = (st.misses|0);
    const combo = (st.combo|0);
    const stage = (st.stage|0);

    // global throttle by verbosity
    const baseP = verbBase;

    // Stage transitions (important)
    if (stage && stage !== S.lastStage){
      S.lastStage = stage;
      if (stage === 2) say(pick(MSG.stage2), { tag:'stage2', important:true });
      if (stage === 3) say(pick(MSG.stage3), { tag:'stage3', important:true });
    }

    // Zone hints (only when zone changes)
    if (zone && zone !== S.lastZone){
      S.lastZone = zone;
      if (zone === 'GREEN') maybe(MSG.green, 0.55*baseP + 0.10, 'zone_green');
      else if (zone === 'LOW') maybe(MSG.low, 0.70*baseP + 0.12, 'zone_low', { important: kids });
      else if (zone === 'HIGH') maybe(MSG.high, 0.70*baseP + 0.12, 'zone_high', { important: kids });
    }

    // Shield change
    if (shield !== S.lastShield){
      const prev = S.lastShield;
      S.lastShield = shield;
      if (shield <= 0 && prev > 0){
        maybe(MSG.shield0, 0.70*baseP + 0.10, 'shield0', { important:true });
      } else if (shield > prev){
        maybe(MSG.shieldUp, 0.55*baseP + 0.10, 'shieldUp');
      }
    }

    // Storm enter/exit
    if (inStorm !== S.lastStorm){
      S.lastStorm = inStorm;
      if (inStorm){
        say(pick(MSG.storm), { tag:'storm_start', important:true });
      }
    }

    // End window cue (very important)
    if (inEndWindow && !S.lastEndWindow){
      S.lastEndWindow = true;
      say(pick(MSG.endWindow), { tag:'endWindow', important:true });
    }
    if (!inEndWindow && S.lastEndWindow) S.lastEndWindow = false;

    // Boss cue (if provided)
    if (st.inBoss && chance(0.65*baseP + 0.15) && !alreadySaidSimilar('boss')){
      say(pick(MSG.boss), { tag:'boss', important:true });
    }

    // Performance nudges (anti-spam)
    // If frustration high -> calm advice
    if (frustration >= 0.72 && chance(0.55*baseP) && !alreadySaidSimilar('calm')){
      say(kids ? 'ใจเย็น ๆ เล็งก่อนยิงนะ 😊' : 'คุมจังหวะก่อนยิง', { tag:'calm' });
    }

    // Misses rising + low skill -> miss tips
    if (misses >= 8 && skill <= 0.45 && chance(0.45*baseP) && !alreadySaidSimilar('miss_tip')){
      say(pick(MSG.miss), { tag:'miss_tip' });
    }

    // Combo praise (rare)
    if (combo >= 10 && chance(0.25*baseP) && !alreadySaidSimilar('combo_praise')){
      say(kids ? 'ว้าว! คอมโบยาวมาก!' : 'คอมโบสวย', { tag:'combo_praise' });
    }

    // Fatigue cue (rare)
    if (fatigue >= 0.78 && chance(0.25*baseP) && !alreadySaidSimilar('fatigue')){
      say(kids ? 'ใกล้จบแล้ว! สู้ ๆ!' : 'ใกล้จบแล้ว—คุมให้ชัวร์', { tag:'fatigue' });
    }
  }

  function onEnd(summary = {}){
    if (!enabled) return;
    // optional: attach last coach msg to summary if caller wants
    try{
      summary._coachLast = S.lastMsg || '';
      summary._coachCount = S.count|0;
    }catch(_){}
    // End message is optional (avoid extra spam)
    if (!inResearch && chance(0.35*verbBase)){
      say(kids ? 'จบแล้ว! เก่งมาก 😊' : 'จบเกม—ดูสรุปผลได้เลย', { tag:'end', important:false });
    }
  }

  return { onStart, onUpdate, onEnd, enabled };
}