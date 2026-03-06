// === /webxr-health-mobile/herohealth/germ-detective/germ-detective.js ===
// Germ Detective CORE — PRODUCTION SAFE (PC/Mobile/cVR) — FINAL + FX + TRICK
// PATCH v20260305-GD-CORE-FINAL-B-FXTRICK
//
// ✅ Added FX: pop score / pulse / shake
// ✅ Added Trick Event (seeded): contamination spike once per round (stage>=2)
// ✅ Emits: hha:event(trick_contamination, fx_pop)
// NOTE: No networking / No Apps Script required.

export default function GameApp(opts = {}) {
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------- helpers ----------
  function qsParam(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ??