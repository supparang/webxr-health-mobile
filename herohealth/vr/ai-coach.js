// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (explainable micro-tips + rate-limit + safe UI)
// ✅ Exports: createAICoach
// ✅ Silent in research mode by default (deterministic-friendly)
// ✅ Shows small toast overlay (non-blocking) + emits hha:coach
//
// Usage:
//   import { createAICoach } from '../vr/ai-coach.js';
//   const AICOACH = createAICoach({ emit, game:'hydration', cooldownMs:3000 });
//   AICOACH.onStart(); AICOACH.onUpdate(ctx); AICOACH.onEnd(summary);

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

// -------------------- UI (toast) --------------------
function ensureCoachUI(){
  if (!DOC || DOC.getElement