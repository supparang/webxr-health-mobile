// === /herohealth/vr/ai-hooks.js ===
// HeroHealth — AI Hooks (OFF by default, deterministic-friendly)
// Provides window.HHA_AI with:
// - enabled? (global gate)
// - getTuning(ctx): difficulty director (spawn rate/size/pBad/etc)
// - coach(ctx): micro tips (rate-limited) -> emits hha:coach
// - pattern(ctx): seeded pattern choices (spawn strategy hints)
// NOTE: In research mode: forced OFF unless explicitly allowAI=1

(function(root){
  'use strict';

  const DOC = root.document;
  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch(_){return d;} };

  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const isResearch = (run === 'research');

  // Hard gate: research OFF unless allowAI=1
  const allowAI = String(qs('allowAI','0')) === '1';
  const enabledByQuery = String(qs('ai','0')) === '1';

  const H = {};
  H.isResearch = isResearch;
  H.allowAI = allowAI;

  // Global enabled: default OFF; play can enable via ?ai=1
  H.enabled = (!isResearch && enabledByQuery) || (isResearch && allowAI && enabledByQuery);

  // Subsystems switches (still gated by H.enabled)
  H.useDifficulty = String(qs('aiDiff','1')) !== '0';
  H.useCoach      = String(qs('aiCoach','1')) !== '0';
  H.usePattern    = String(qs('aiPattern','1')) !== '0';

  // Basic emit helper
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------- Difficulty Director ----------
  // returns multiplicative tuning values (1 = no change)
  H.getTuning = function(ctx){
    // ctx: {skill, fatigue, frustration, inStorm, stage, diff, seed, timeLeftSec}
    if (!H.enabled || !H.useDifficulty) return null;

    // Fair + smooth: only small deltas
    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0.0, 0, 1);
    const frustr = clamp(ctx.frustration ?? 0.0, 0, 1);

    // Make it gentler if fatigue/frustration high
    const ease = clamp((fatigue*0.55 + frustr*0.65), 0, 1);

    // Harder when skill high, easier when ease high
    // spawnMul <1 => faster spawn ; sizeMul <1 => smaller
    const spawnMul = clamp(1.08 - 0.22*skill + 0.22*ease, 0.85, 1.25);
    const sizeMul  = clamp(1.06 - 0.18*skill + 0.18*ease, 0.88, 1.22);
    const badMul   = clamp(1.00 + 0.18*skill - 0.22*ease, 0.80, 1.20);

    const out = { spawnMul, sizeMul, badMul };

    emit('hha:ai', { type:'difficulty', ...out });
    return out;
  };

  // ---------- Coach Micro-tips ----------
  // returns string tip or null
  let lastCoachAt = 0;
  H.coach = function(ctx){
    if (!H.enabled || !H.useCoach) return null;

    const now = performance.now();
    const cooldownMs = 3200;
    if (now - lastCoachAt < cooldownMs) return null;
    lastCoachAt = now;

    const { skill, frustration, inStorm, inEndWindow, waterZone, shield, stage } = ctx;

    let tip=null;
    if (stage === 1 && waterZone !== 'GREEN') tip = 'โฟกัสยิง 💧 ให้กลับเข้า GREEN เพื่อสะสมเวลา Stage1';
    else if (inStorm && !inEndWindow && (shield|0) <= 0) tip = 'เก็บ 🛡️ ไว้ก่อน! ท้ายพายุ (End Window) ต้องใช้ BLOCK';
    else if (inEndWindow && (shield|0) > 0) tip = 'ตอนนี้ End Window! แตะ/ยิงเพื่อ BLOCK (ใช้ 🛡️ ให้คุ้ม)';
    else if ((frustration ?? 0) > 0.65) tip = 'ช้าลงนิดนึง เล็งให้ชัวร์ แล้วค่อยยิง จะลด MISS ได้เร็วมาก';
    else if ((skill ?? 0.5) > 0.75) tip = 'ฟอร์มดีมาก! ลากคอมโบต่อเนื่อง เกรดพุ่งแน่นอน';

    if (tip){
      emit('hha:coach', { type:'ai_tip', tip });
    }
    return tip;
  };

  // ---------- Pattern Generator (seeded) ----------
  // returns lightweight pattern hints (for future use)
  H.pattern = function(ctx){
    if (!H.enabled || !H.usePattern) return null;

    // deterministic-ish by using ctx.rng if provided
    const r = (typeof ctx.rng === 'function') ? ctx.rng() : Math.random();

    // Example pattern hint: spawnBias or ring vs spread, etc.
    const hint =
      r < 0.33 ? { spawnBias:'center' } :
      r < 0.66 ? { spawnBias:'mid' } :
                 { spawnBias:'edges' };

    emit('hha:ai', { type:'pattern', ...hint });
    return hint;
  };

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  root.HHA_AI = H;
})(typeof window !== 'undefined' ? window : globalThis);