// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable + Rate-limited + Research-friendly)
// ✅ createAICoach({ emit, game, cooldownMs, runMode? })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// ✅ Emits: hha:coach { level, title, msg, why, tipId, game }
// ✅ No dependencies; never throws

'use strict';

function clamp(v,a,b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}
function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

function pick(arr, idx){
  if (!arr || !arr.length) return null;
  return arr[Math.max(0, Math.min(arr.length-1, idx|0))];
}

function hashStr(s){
  s = String(s||'');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h>>>0);
}

export function createAICoach(cfg = {}){
  const emit = (typeof cfg.emit === 'function') ? cfg.emit : ()=>{};
  const game = String(cfg.game || 'game');
  const cooldownMs = clamp(cfg.cooldownMs ?? 2800, 900, 12000);

  // runMode hint (optional): 'play'/'research'
  // In research: reduce chatter and avoid "random-feel"
  const runMode = String(cfg.runMode || '').toLowerCase(); // optional
  const researchQuiet = (runMode === 'research');

  // internal state
  const C = {
    started:false,
    lastSayAt: -1e9,
    lastTipId: '',
    lastBucket: '',
    seen: Object.create(null),
    // we smooth signals
    emaSkill: 0.45,
    emaFrust: 0.18,
    emaFatigue: 0.08,
    // milestone locks
    saidIntro:false,
    saidStormPrep:false,
    saidEndWindow:false,
    saidBossOnce:false,
    saidFinal:false
  };

  function canSay(tipId){
    const t = nowMs();
    const cd = researchQuiet ? cooldownMs * 1.35 : cooldownMs;
    if (t - C.lastSayAt < cd) return false;

    // avoid repeating same tip too soon
    const k = String(tipId||'');
    if (k && C.seen[k] && (t - C.seen[k]) < (researchQuiet ? 18000 : 12000)) return false;

    return true;
  }

  function say(payload){
    try{
      const tipId = String(payload.tipId || payload.title || payload.msg || '');
      if (!canSay(tipId)) return false;

      const t = nowMs();
      C.lastSayAt = t;
      if (tipId) C.seen[tipId] = t;
      C.lastTipId = tipId;

      emit('hha:coach', Object.assign({ game }, payload));
      return true;
    }catch(_){
      return false;
    }
  }

  function bucketSkill(k){
    // 0..1
    if (k >= 0.82) return 'high';
    if (k >= 0.55) return 'mid';
    return 'low';
  }

  function buildWhyLines(parts){
    return (parts||[]).filter(Boolean).join(' • ');
  }

  // Tips library (short, kid-friendly, explainable)
  const TIPS = {
    intro: [
      { title:'เริ่มเลย!', msg:'โฟกัส “ยิงให้ชัวร์” ก่อน แล้วค่อยลากคอมโบยาว ๆ', why:'เริ่มเกม: สร้างจังหวะให้มือ/ตาเข้าที่', level:'info', tipId:'intro-aim' },
      { title:'ทริคคอมโบ', msg:'อย่ารัวมั่ว ๆ — ยิงให้โดนติด ๆ คอมโบจะพาเกรดขึ้นเอง', why:'คอมโบทำให้คะแนนโตเร็ว', level:'info', tipId:'intro-combo' },
    ],
    accuracyLow: [
      { title:'เล็งช้าลงนิด', msg:'ลดการรัว แล้ว “ค้างเล็ง” 0.2 วิค่อยยิง', why:'Accuracy ต่ำ → โดนพลาดบ่อย', level:'warn', tipId:'acc-low-hold' },
      { title:'เลือกเป้าชัวร์', msg:'เห็นเป้าชัด ๆ ค่อยยิง เป้าหลุด ๆ ปล่อยไปก่อน', why:'ลด MISS ได้ไวที่สุด', level:'warn', tipId:'acc-low-safe' },
    ],
    missHigh: [
      { title:'MISS เยอะไป!', msg:'หยุดรัว 1 จังหวะ แล้วกลับไปยิงเฉพาะที่ชัวร์', why:'MISS สูงทำให้เกรดตกและคะแนนรั่ว', level:'danger', tipId:'miss-high-slow' },
      { title:'โหมดเซฟ', msg:'โฟกัสยิงเป้า “ง่าย/ใกล้กลาง” ก่อน แล้วค่อยเสี่ยง', why:'ลดความเสี่ยงตอนกำลังเสียจังหวะ', level:'danger', tipId:'miss-high-center' },
    ],
    stormPrep: [
      { title:'ใกล้ STORM', msg:'เก็บ 🛡️ ไว้ก่อนพายุ! ตอนท้ายพายุจะได้ BLOCK', why:'STORM ต้องใช้ Shield ช่วง End Window', level:'info', tipId:'storm-prep-shield' },
      { title:'เตรียม MINI', msg:'ถ้าอยู่ GREEN ทั้งเวลา MINI จะผ่านยาก — ลองดันให้เป็น LOW/HIGH', why:'Mini ต้อง “ไม่ GREEN” + BLOCK', level:'info', tipId:'storm-prep-zone' },
    ],
    inStorm: [
      { title:'STORM มาแล้ว!', msg:'อย่าโดน 🥤 ตอนพายุ และพยายามทำให้น้ำ “LOW/HIGH”', why:'โดน BAD ตอนพายุ = mini fail', level:'warn', tipId:'storm-avoid-bad' },
      { title:'สร้างแรงกด', msg:'ถ้าน้ำ LOW/HIGH แล้ว ให้ “อยู่รอด” จนเข้า End Window', why:'Mini ต้องสะสม pressure + end-window', level:'warn', tipId:'storm-pressure' },
    ],
    endWindow: [
      { title:'END WINDOW!', msg:'ตอนนี้แหละ! ใช้ 🛡️ BLOCK ให้ติด (กันโดน 🥤/🌩️)', why:'เงื่อนไขสำคัญของ Mini', level:'danger', tipId:'endwindow-block' },
      { title:'ห้ามพลาดช่วงท้าย', msg:'ช้าลงนิด แต่ยิงให้โดน — ช่วงท้ายพายุให้ความคุ้มค่าสูงสุด', why:'พลาดท้ายพายุ = เสีย Mini', level:'danger', tipId:'endwindow-focus' },
    ],
    boss: [
      { title:'BOSS WINDOW', msg:'ตอนนี้ 🌩️ โผล่ถี่! เก็บ 🛡️ แล้ว BLOCK ให้ครบ', why:'Boss ต้อง BLOCK ตามจำนวน', level:'danger', tipId:'boss-block' },
      { title:'ตัดสินรอบนี้', msg:'ถ้ามี 🛡️ 1–2 อัน เก็บไว้ใช้ตอน Boss จะชัวร์สุด', why:'Boss สำเร็จ = คะแนนโบนัส + ผ่าน Stage3', level:'warn', tipId:'boss-save-shield' },
    ],
    praise: [
      { title:'โหดมาก!', msg:'Accuracy ดีมาก — ลากคอมโบต่อ เกรดจะพุ่ง', why:'กำลังเล่นนิ่งและแม่น', level:'good', tipId:'praise-acc' },
      { title:'คอมโบสวย!', msg:'คอมโบกำลังมา อย่าพลาดช่วงนี้นะ!', why:'คอมโบยาว = คะแนนกระโดด', level:'good', tipId:'praise-combo' },
    ],
    final: [
      { title:'สรุป', msg:'อยากอัปเกรด: เน้น Accuracy + ลด MISS แล้วผ่าน STORM อย่างน้อย 1 รอบ', why:'ตัวชี้วัดหลักของเกรด', level:'info', tipId:'final-next' },
    ]
  };

  function onStart(){
    if (C.started) return;
    C.started = true;

    if (!C.saidIntro){
      C.saidIntro = true;

      // Research: keep intro minimal
      const tip = researchQuiet ? TIPS.intro[0] : TIPS.intro[(hashStr(game) % TIPS.intro.length)];
      say(tip);
    }
  }

  function onUpdate(st = {}){
    try{
      // signals expected (hydration.safe.js already supplies)
      const skill = clamp(st.skill, 0, 1);
      const fatigue = clamp(st.fatigue, 0, 1);
      const frust = clamp(st.frustration, 0, 1);

      C.emaSkill = C.emaSkill*0.88 + skill*0.12;
      C.emaFatigue = C.emaFatigue*0.90 + fatigue*0.10;
      C.emaFrust = C.emaFrust*0.86 + frust*0.14;

      const inStorm = !!st.inStorm;
      const inEndWindow = !!st.inEndWindow;
      const shield = (st.shield|0);
      const misses = (st.misses|0);
      const combo = (st.combo|0);
      const waterZone = String(st.waterZone || '');

      const skBucket = bucketSkill(C.emaSkill);

      // --- Priority rules (highest first) ---
      // 1) End window = critical moment
      if (inStorm && inEndWindow){
        if (!C.saidEndWindow){
          C.saidEndWindow = true;
          const why = buildWhyLines([
            'อยู่ใน End Window',
            shield>0 ? `มี Shield ${shield}` : 'Shield = 0 (เสี่ยงโดน)',
          ]);
          say(Object.assign({}, TIPS.endWindow[0], { why }));
        } else {
          // occasionally remind if shield=0 and misses rising
          if (shield<=0 && misses>=8 && !researchQuiet){
            const why = buildWhyLines(['Shield = 0', `MISS ${misses}`]);
            say(Object.assign({}, TIPS.endWindow[1], { why, tipId:'endwindow-focus-2' }));
          }
        }
        return;
      }

      // reset endwindow flag after storm ends
      if (!inStorm) C.saidEndWindow = false;

      // 2) Boss window hint (only when storm and "boss-like" state inferred)
      // We don't know bossActive flag here; hydration.safe.js can pass it later if you want
      // For now: if inStorm and shield>=1 and misses moderate -> push boss prep once
      if (inStorm && shield>=1 && misses<=12 && !C.saidBossOnce && !researchQuiet){
        // soft suggestion (not spam)
        C.saidBossOnce = true;
        const why = buildWhyLines(['STORM อยู่', `Shield ${shield}`]);
        say(Object.assign({}, TIPS.boss[1], { why }));
        return;
      }

      // 3) Storm prep: when NOT in storm but has shields low and time progressed/fatigue rising
      if (!inStorm){
        // say once per session when fatigue indicates storm likely happened/coming
        if (!C.saidStormPrep && (C.emaFatigue >= 0.18)){
          C.saidStormPrep = true;
          const why = buildWhyLines([
            'กำลังเข้าสู่ช่วงเกมหลัก',
            shield>0 ? `Shield ${shield}` : 'ยังไม่มี Shield'
          ]);
          say(Object.assign({}, TIPS.stormPrep[0], { why }));
          return;
        }
      } else {
        // In storm general tip (not end window)
        if (!researchQuiet && misses>=6 && canSay('storm-avoid-bad')){
          const why = buildWhyLines([
            'อยู่ใน STORM',
            waterZone ? `Zone ${waterZone}` : null,
            `MISS ${misses}`
          ]);
          say(Object.assign({}, TIPS.inStorm[0], { why }));
          return;
        }
      }

      // 4) Miss spike
      if (misses >= 16 && skBucket !== 'high'){
        const idx = (misses >= 26) ? 0 : 1;
        const why = buildWhyLines([`MISS ${misses}`, `Skill ${skBucket}`]);
        say(Object.assign({}, TIPS.missHigh[idx], { why }));
        return;
      }

      // 5) Accuracy low proxy: low skill and combo not building
      if (skBucket === 'low' && combo <= 3){
        const why = buildWhyLines([
          'ยิงยังไม่นิ่ง',
          combo ? `Combo ${combo}` : 'Combo ยังไม่ขึ้น'
        ]);
        say(Object.assign({}, TIPS.accuracyLow[0], { why }));
        return;
      }

      // 6) Praise when playing well (avoid in research)
      if (!researchQuiet && skBucket === 'high' && combo >= 10 && misses <= 6){
        const tip = (combo >= 18) ? TIPS.praise[1] : TIPS.praise[0];
        const why = buildWhyLines([`Skill สูง`, `Combo ${combo}`, `MISS ${misses}`]);
        say(Object.assign({}, tip, { why }));
        return;
      }

    }catch(_){}
  }

  function onEnd(summary = {}){
    if (C.saidFinal) return;
    C.saidFinal = true;

    // keep end message short, always
    const g = String(summary.grade || '');
    const miss = Number(summary.misses || 0);
    const acc = Number(summary.accuracyGoodPct || 0);
    const stormOk = Number(summary.stormSuccess || 0);

    const why = buildWhyLines([
      g ? `Grade ${g}` : null,
      `Acc ${acc.toFixed ? acc.toFixed(0) : acc}%`,
      `MISS ${miss|0}`,
      `Mini ${stormOk|0}`
    ]);

    say(Object.assign({}, TIPS.final[0], { why, tipId:'final-summary' }));
  }

  return { onStart, onUpdate, onEnd };
}