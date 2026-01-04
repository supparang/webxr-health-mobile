/* === /herohealth/plate/plate-vr.css ===
Balanced Plate VR — PRODUCTION (HHA Standard UI + Safe spawn + VR feel)
✅ Targets are DOM buttons (.plateTarget) spawned by plate.safe.js
✅ Works with plate-vr.html inline HUD layout
✅ Plays nicely with vr-ui.js (view=cvr strict: target pointer-events off optional)
*/

/* ----------------- base / tokens ----------------- */
:root{
  --bg:#020617;
  --panel:rgba(2,6,23,.78);
  --panel2:rgba(15,23,42,.70);
  --stroke:rgba(148,163,184,.18);
  --text:#e5e7eb;
  --muted:#94a3b8;
  --accent:#22c55e;
  --warn:#f59e0b;
  --bad:#ef4444;
  --cyan:#22d3ee;
  --violet:#a78bfa;
  --radius:18px;
  --pill:999px;

  --sat: env(safe-area-inset-top, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);

  --t-shadow: 0 18px 44px rgba(0,0,0,.28);
  --glass: blur(10px);
}

*,
*::before,
*::after{
  box-sizing:border-box;
}

html, body{
  margin:0;
  padding:0;
  width:100%;
  height:100%;
  overflow:hidden;
  background:var(--bg);
  color:var(--text);
  font-family: system-ui, -apple-system, "Noto Sans Thai", "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button{
  font-family: inherit;
}

/* ----------------- stage layers ----------------- */
/* The run HTML already sets:
   a-scene z-index:0, .bg z-index:1, .stage z-index:2, #plate-layer z-index:10
*/
#plate-layer{
  /* Safety: ensure it remains above A-Frame and below HUD */
  touch-action:none;
  user-select:none;
  -webkit-user-select:none;
}

/* Hit overlay pulse (JS toggles classes) */
#hitFx{
  mix-blend-mode: screen;
  will-change: opacity;
}

/* ----------------- Target styling ----------------- */
.plateTarget{
  appearance:none;
  -webkit-appearance:none;
  border:none;
  cursor:pointer;
  padding:0;
  line-height:1;
  display:grid;
  place-items:center;

  /* Default visual (JS also sets inline style; this is fallback & ensures animations) */
  background: rgba(2,6,23,.55);
  border:1px solid rgba(148,163,184,.18);
  border-radius:999px;

  box-shadow: var(--t-shadow);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  transform: translateZ(0);
  will-change: transform, filter, opacity;
  -webkit-tap-highlight-color: transparent;
  outline:none;
}

.plateTarget:active{
  transform: translateZ(0) scale(0.98);
}

/* subtle glowing ring */
.plateTarget::before{
  content:"";
  position:absolute;
  inset:-6px;
  border-radius:999px;
  pointer-events:none;
  background:
    radial-gradient(circle at 50% 50%, rgba(34,197,94,.18), transparent 58%),
    radial-gradient(circle at 50% 50%, rgba(34,211,238,.10), transparent 64%);
  opacity:.75;
  filter: blur(0px);
}

.plateTarget[data-kind="junk"]::before{
  background:
    radial-gradient(circle at 50% 50%, rgba(239,68,68,.18), transparent 58%),
    radial-gradient(circle at 50% 50%, rgba(245,158,11,.10), transparent 64%);
}

.plateTarget[data-kind="shield"]::before{
  background:
    radial-gradient(circle at 50% 50%, rgba(167,139,250,.18), transparent 58%),
    radial-gradient(circle at 50% 50%, rgba(34,211,238,.10), transparent 64%);
}

/* Emoji sizing (JS sets font too; this normalizes) */
.plateTarget{
  font-weight: 1000;
  font-size: 28px;
  text-shadow: 0 2px 0 rgba(0,0,0,.25);
}

/* Good targets are a bit calmer */
.plateTarget[data-kind="good"]{
  filter: saturate(1.05);
}

/* Junk targets pop more */
.plateTarget[data-kind="junk"]{
  filter: saturate(1.25) brightness(1.05);
}

/* Shield: bluish */
.plateTarget[data-kind="shield"]{
  filter: saturate(1.1) brightness(1.06);
}

/* ----------------- Spawn / Life animations ----------------- */
@keyframes platePopIn{
  0%   { transform: translateZ(0) scale(.45); opacity:0; }
  65%  { transform: translateZ(0) scale(1.06); opacity:1; }
  100% { transform: translateZ(0) scale(1.0); opacity:1; }
}

@keyframes plateFloat{
  0%   { transform: translateZ(0) scale(1) translateY(0px); }
  50%  { transform: translateZ(0) scale(1) translateY(-3px); }
  100% { transform: translateZ(0) scale(1) translateY(0px); }
}

.plateTarget{
  animation: platePopIn .16s ease-out both, plateFloat 1.25s ease-in-out infinite;
}

@keyframes plateExpire{
  0%   { opacity:1; transform: translateZ(0) scale(1); filter: none; }
  100% { opacity:0; transform: translateZ(0) scale(.72); filter: blur(1px) brightness(.95); }
}

/* Optional: when JS wants to mark expiring (not required) */
.plateTarget.is-expiring{
  animation: plateFloat .9s ease-in-out infinite, plateExpire .22s ease-in forwards;
}

/* ----------------- HUD micro polish ----------------- */
.hudTop .card,
#miniPanel .questCard,
#coachPanel .questCard,
#bossHud .bossCard,
#stormHud .stormCard,
.panelCard{
  backdrop-filter: var(--glass);
  -webkit-backdrop-filter: var(--glass);
}

/* Ensure HUD doesn't capture touches except buttons inside */
.hudTop,
#miniPanel,
#coachPanel,
#bossHud,
#stormHud{
  pointer-events:none;
}
.hudTop .card,
#miniPanel .questCard,
#coachPanel .questCard,
#bossHud .bossCard,
#stormHud .stormCard{
  pointer-events:auto;
}

/* Keep coach image crisp */
#coachImg{
  image-rendering: auto;
}

/* ----------------- View modes ----------------- */
body.view-pc #plate-layer{
  cursor: crosshair;
}

/* Mobile: a bit bigger touch targets feeling (JS size still drives) */
body.view-mobile .plateTarget{
  font-size: 30px;
}

/* VR & cVR: remove hover/active weirdness */
body.view-vr .plateTarget:active,
body.view-cvr .plateTarget:active{
  transform: translateZ(0) scale(1);
}

/* cVR strict mode: optional "shoot-only" — disable direct touches on targets
   (vr-ui.js will dispatch hha:shoot; plate.safe.js will pick nearest target)
*/
body.view-cvr #plate-layer{
  touch-action:none;
}
body.view-cvr .plateTarget{
  pointer-events: none;
}

/* ----------------- Boss / Storm FX (simple safe) ----------------- */
#bossFx, #stormFx{
  overflow:hidden;
}

/* Storm swirl */
#stormFx{
  background:
    radial-gradient(circle at 20% 30%, rgba(34,211,238,.10), transparent 42%),
    radial-gradient(circle at 80% 70%, rgba(34,211,238,.10), transparent 42%),
    conic-gradient(from 0deg, rgba(34,211,238,.08), transparent, rgba(34,211,238,.08), transparent);
  opacity: .0;
  transition: opacity .18s ease;
  mix-blend-mode: screen;
}
#stormFx.storm-panic{
  animation: stormPanic .22s ease-in-out infinite;
}
@keyframes stormPanic{
  0%{ filter:brightness(1.05); }
  50%{ filter:brightness(1.28); }
  100%{ filter:brightness(1.05); }
}

/* Boss pulse */
#bossFx{
  background:
    radial-gradient(circle at 50% 60%, rgba(167,139,250,.12), transparent 55%),
    radial-gradient(circle at 50% 40%, rgba(239,68,68,.10), transparent 62%);
  opacity: .0;
  transition: opacity .18s ease;
  mix-blend-mode: screen;
}
#bossFx.boss-on{
  opacity: .85;
}
#stormFx[style*="display: block"]{
  opacity: .75;
}
#bossFx.boss-panic{
  animation: bossPanic .18s ease-in-out infinite;
}
@keyframes bossPanic{
  0%{ filter:brightness(1.05) saturate(1.05); }
  50%{ filter:brightness(1.32) saturate(1.15); }
  100%{ filter:brightness(1.05) saturate(1.05); }
}

/* ----------------- Result overlay tweaks ----------------- */
#resultBackdrop{
  animation: resultIn .18s ease-out both;
}
@keyframes resultIn{
  0%{ opacity:0; transform: translateY(10px); }
  100%{ opacity:1; transform: translateY(0px); }
}

/* ----------------- Responsive adjustments ----------------- */
@media (max-width: 920px){
  .plateTarget{
    /* on small screens, keep float subtle */
    animation: platePopIn .16s ease-out both, plateFloat 1.1s ease-in-out infinite;
  }
}

@media (max-width: 420px){
  .plateTarget{
    font-size: 32px;
  }
}

/* ----------------- Reduced motion support ----------------- */
@media (prefers-reduced-motion: reduce){
  .plateTarget{
    animation: none !important;
  }
  #resultBackdrop{
    animation: none !important;
  }
  #bossFx.boss-panic,
  #stormFx.storm-panic{
    animation: none !important;
  }
}