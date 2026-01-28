// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// ✅ Export: createAICoach({ emit, game, cooldownMs, enabled })
// ✅ Auto-disable in research mode by default (run=research)
// ✅ Emits: hha:coach { type:'tip'|'status', game, text, reason, ts }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function nowMs(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : (()=>{});
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 900, 12000);

  // ✅ default: disable in research
  const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const enabled = (typeof opts.enabled === 'boolean')
    ? opts.enabled
    : (run !== 'research');

  const S = {
    enabled,
    lastTipAt: -1e9,
    lastKey: '',
    startedAt: 0,
    tick: 0
  };

  function say(text, reason, key){
    if (!S.enabled) return;

    const t = nowMs();
    if (t - S.lastTipAt < cooldownMs) return;

    // กัน spam ซ้ำประโยคเดิม
    const k = String(key || reason || text).slice(0,80);