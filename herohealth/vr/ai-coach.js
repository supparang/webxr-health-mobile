// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable + Rate-limited + Cross-game)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// ✅ Explainable micro-tips: ส่งเหตุผล (why) + ตัวชี้วัด (signals)
// ✅ Rate limit: กันสแปมคำแนะนำ (default 3s)
// ✅ No randomness (deterministic for research)
//
// Emits (via emit fn you pass in):
// - hha:coach { type:'tip', game, tipId, title, text, why, signals, severity, ts }
// - hha:coach { type:'start'|'end', game, ts, summary? }

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return Date.now(); }

function pickBestTip(candidates){
  // เลือก tip ที่ priority สูงสุด, ถ้าเท่ากันให้เลือก severity สูงสุด
  let best=null;
  for (const t of candidates){
    if (!t || !t.ok) continue;
    if (!best) best=t;
    else if ((t.priority||0) > (best.priority||0)) best=t;
    else if ((t.priority||0)===(best.priority||0) && (t.severity||0) > (best.severity||0)) best=t;
  }
  return best;
}

function normalizeGame(game){
  const g = String(game||'').toLowerCase().trim();
  return g || 'generic';
}

export function createAICoach(opts = {}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = normalizeGame(opts.game);
  const cooldownMs = Math.max(600, Number(opts.cooldownMs || 3000));

  const S = {
    started:false,
    lastTipAt:0,
    lastTipId:'',
    seen: Object.create(null),      // tipId -> count
    lastState:null,
    t0:0
  };

  function canSpeak(tipId){
    const t = now();
    if ((t - S.lastTipAt) < cooldownMs) return false;
    // กันพูดซ้ำ id เดิมถี่เกิน
    if (tipId && tipId === S.lastTipId && (t - S.lastTipAt) < cooldownMs*1.6) return false;
    return true;
  }

  function speak(tip){
    if (!tip) return false;
    const tipId = String(tip.tipId || tip.id || '');
    if (!canSpeak(tipId)) return false;

    S.lastTipAt = now();
    S.lastTipId = tipId;
    S.seen[tipId] = (S.seen[tipId]|0) + 1;

    emit('hha:coach', {
      type:'tip',
      game,
      tipId,
      title: tip.title || 'Tip',
      text: tip.text || '',
      why: tip.why || '',
      signals: tip.signals || {},
      severity: tip.severity || 1,
      ts: new Date().toISOString()
    });
    return true;
  }

  function buildGenericTips(st){
    // state ที่คาดว่าจะมี:
    // skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo
    const skill = clamp(st.skill, 0, 1);
    const fatigue = clamp(st.fatigue, 0, 1);
    const frustration = clamp(st.frustration, 0, 1);
    const misses = Number(st.misses||0);
    const combo = Number(st.combo||0);

    const tips=[];

    // 1) Frustration high
    tips.push({
      tipId:`${game}:calm`,
      ok: frustration >= 0.72 && fatigue < 0.92,
      priority: 90,
      severity: 3,
      title: 'ช้าลงนิด—ยิงให้ชัวร์',
      text: 'ลองหยุดรัว 1–2 วินาที เล็งให้ตรงก่อน แล้วค่อยยิง จะลด MISS ลงเร็วมาก',
      why: 'ตอนนี้ความผิดพลาดค่อนข้างถี่ → โหมด “ชัวร์ก่อนเร็ว” ช่วยรีเซ็ตจังหวะ',
      signals: { frustration, fatigue, misses, combo }
    });

    // 2) Fatigue high
    tips.push({
      tipId:`${game}:rest`,
      ok: fatigue >= 0.82,
      priority: 80,
      severity: 2,
      title: 'พักสายตา 2 วิ',
      text: 'หายใจลึก ๆ แล้วกลับมาเล็งใหม่ ลดการหลุดเป้า',
      why: 'ความล้าสูงขึ้น → ความแม่นยำมักตกตาม',
      signals: { fatigue, skill, misses }
    });

    // 3) Skill low
    tips.push({
      tipId:`${game}:aim`,
      ok: skill <= 0.38 && frustration <= 0.75,
      priority: 70,
      severity: 2,
      title: 'เล็งค้างก่อนยิง',
      text: 'วางเป้าไว้กลางจอ/กลางนิ้ว แล้ว “ค่อยยิง” จะคุมคอมโบได้',
      why: 'ความแม่นยำโดยรวมยังต่ำ → เน้นจังหวะก่อน',
      signals: { skill, combo, misses }
    });

    // 4) Combo tip (positive reinforcement)
    tips.push({
      tipId:`${game}:combo`,
      ok: combo >= 10 && skill >= 0.6,
      priority: 40,
      severity: 1,
      title: 'คอมโบกำลังมา!',
      text: 'ดีมาก! รักษาจังหวะเดิม แล้วคอมโบจะดันคะแนนขึ้นเร็ว',
      why: 'คอมโบสูง + ทักษะดี → ย้ำพฤติกรรมที่ถูกต้อง',
      signals: { combo, skill }
    });

    return tips;
  }

  function buildHydrationTips(st){
    // tips เฉพาะ hydration
    const z = String(st.waterZone||'').toUpperCase();
    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const shield = Number(st.shield||0);
    const frustration = clamp(st.frustration, 0, 1);
    const skill = clamp(st.skill, 0, 1);

    const tips=[];

    // Storm: ก่อนเข้า end window
    tips.push({
      tipId:`hydration:storm:prep`,
      ok: game==='hydration' && inStorm && !inEnd && shield <= 0,
      priority: 95,
      severity: 3,
      title: 'Storm มาแล้ว—รีบเก็บ 🛡️',
      text: 'ตอนนี้อยู่ช่วงพายุ: โฟกัสเก็บ 🛡️ ก่อน เพื่อไป BLOCK ช่วงท้าย (End Window)',
      why: 'Storm active แต่ไม่มีโล่ → โอกาสผ่าน Mini ลดลง',
      signals: { inStorm, inEndWindow:inEnd, shield, waterZone:z }
    });

    // Storm: end window แต่ไม่มี shield
    tips.push({
      tipId:`hydration:storm:end:noshield`,
      ok: game==='hydration' && inStorm && inEnd && shield <= 0,
      priority: 110,
      severity: 3,
      title: 'End Window! แต่ไม่มี 🛡️',
      text: 'ถ้ายังไม่มีโล่ ให้ “หลบการยิง BAD” ก่อน แล้วรอรอบพายุถัดไป',
      why: 'End Window ต้อง BLOCK → ถ้าไม่มีโล่จะพลาด Mini ง่าย',
      signals: { inStorm, inEndWindow:inEnd, shield, waterZone:z }
    });

    // Water zone: ยัง GREEN ตอน Storm (ควรออก LOW/HIGH เพื่อผ่านเงื่อนไข mini)
    tips.push({
      tipId:`hydration:storm:need-zone`,
      ok: game==='hydration' && inStorm && z==='GREEN',
      priority: 85,
      severity: 2,
      title: 'Storm: ต้อง LOW/HIGH ก่อน',
      text: 'ตอนพายุให้ “ยอมออก GREEN” ไป LOW/HIGH แล้วค่อย BLOCK ช่วงท้าย',
      why: 'Mini ต้องมีเงื่อนไข zoneOK (LOW/HIGH) ก่อนจะผ่าน',
      signals: { inStorm, waterZone:z, shield }
    });

    // Boss window: ให้กันโล่ไว้
    tips.push({
      tipId:`hydration:boss:save-shield`,
      ok: game==='hydration' && inStorm && inEnd && shield >= 1 && skill >= 0.45,
      priority: 75,
      severity: 2,
      title: 'BOSS WINDOW: ใช้ 🛡️ ให้คุ้ม',
      text: 'ล็อกจังหวะยิง 🌩️ ทีละอัน อย่ารัว และกันโล่ไว้ให้ครบตามจำนวน',
      why: 'อยู่ช่วงท้ายพายุ + มีโล่ → เป็นจังหวะทำ Boss Clear',
      signals: { inStorm, inEndWindow:inEnd, shield, skill }
    });

    // ถ้าหงุดหงิดสูงระหว่าง storm
    tips.push({
      tipId:`hydration:storm:calm`,
      ok: game==='hydration' && inStorm && frustration >= 0.75,
      priority: 92,
      severity: 3,
      title: 'พายุทำให้พลาดง่าย—ช้าลงนิด',
      text: 'เลือกยิงเฉพาะที่ชัวร์: 🛡️ ก่อน แล้วค่อย BLOCK ช่วงท้าย',
      why: 'frustration สูงในช่วงพายุ → มักกดรัวจน MISS',
      signals: { frustration, inStorm, shield, waterZone:z }
    });

    return tips;
  }

  function buildTips(st){
    const tips = []
      .concat(buildHydrationTips(st))
      .concat(buildGenericTips(st));

    return tips;
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    S.t0 = now();
    emit('hha:coach', { type:'start', game, ts: new Date().toISOString() });
  }

  function onUpdate(state = {}){
    if (!S.started) return;
    S.lastState = state;

    const candidates = buildTips(state);
    const best = pickBestTip(candidates);
    if (best) speak(best);
  }

  function onEnd(summary){
    emit('hha:coach', { type:'end', game, ts: new Date().toISOString(), summary: summary || null });
  }

  return { onStart, onUpdate, onEnd };
}