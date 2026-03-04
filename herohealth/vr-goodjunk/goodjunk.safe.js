// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (FX + Coach + hha:shoot + deterministic + end-event hardened + HUD-safe spawn)
// ✅ Help Pause Hook (__GJ_SET_PAUSED__) for always-on Help overlay
// ✅ End Summary: show "Go Cooldown (daily-first per-game)" button when needed
// ✅ AI Hooks wired (spawn/hit/expire/tick/end) — prediction only (NO adaptive)
// ✅ AI HUD: hazardRisk + next watchout
// ✅ ACC + median RT: shots/hits/accPct + medianRtGoodMs (GOOD hit only) for tie-break
// ✅ hha:score event: score/miss/acc/medianRT/combos/fever/shield (throttled)
// ✅ Battle RTDB (optional, only ?battle=1): sync hha:score + decide winner by score→acc→miss→medianRT
// FULL v20260302-SAFE-HELPPAUSE-AIHUD-ACC-MEDRT-BATTLE-SPAWNSAFE
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI  = cfg.ai || null;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const $ = (id)=> DOC.getElementById(id);

  // ---------- BATTLE (optional) ----------
  let battle = null;
  async function initBattleMaybe(pid, gameKey){
    const on = String(qs('battle','0')) === '1';
    if(!on) return null;
    try{
      const mod = await import('../vr/battle-rtdb.js');
      battle = await mod.initBattle({
        enabled: true,
        room: qs('room', ''),
        pid,
        gameKey,
        autostartMs: Number(qs('autostart','3000'))||3000,
        forfeitMs: Number(qs('forfeit','5000'))||5000
      });
      return battle;
    }catch(e){
      console.warn('[GoodJunk] battle init failed (ok)', e);
      return null;
    }
  }

  // ---------- COOL DOWN BUTTON (PER-GAME DAILY) ----------
  function hhDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(