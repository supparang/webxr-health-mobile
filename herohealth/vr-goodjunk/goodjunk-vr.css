/* === /herohealth/vr-goodjunk/goodjunk-vr.css ===
GoodJunkVR UI + FX (PRODUCTION)
✅ PC/Mobile/VR/cVR layout
✅ HUD-safe spawn vars: --gj-top-safe / --gj-bottom-safe
✅ FX classes (used by fx-director + game): fx-storm fx-boss-in fx-boss-hit fx-boss-down fx-rage fx-swap fx-fake fx-stun fx-block
*/

:root{
  color-scheme: dark;

  --bg:#020617;
  --panel: rgba(2,6,23,.78);
  --panel2: rgba(15,23,42,.68);
  --stroke: rgba(148,163,184,.22);
  --text:#e5e7eb;
  --muted:#94a3b8;
  --accent:#22c55e;
  --warn:#f59e0b;
  --bad:#ef4444;
  --cyan:#22d3ee;
  --violet:#a78bfa;

  --radius:22px;
  --pill:999px;

  /* safe area */
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);

  /* spawn safe (boot will measure and set these) */
  --gj-top-safe: 140px;
  --gj-bottom-safe: 130px;
}

*{ box-sizing:border-box; }
html,body{
  width:100%;
  height:100%;
  margin:0;
  overflow:hidden;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
}

/* ---------------- Topbar ---------------- */
.gj-topbar{
  position:fixed;
  left:0; right:0;
  top:0;
  z-index:190;
  padding: calc(10px + var(--sat)) calc(10px + var(--sar)) 10px calc(10px + var(--sal));
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  pointer-events:auto;
}

.gj-topbar .left, .gj-topbar .right{
  display:flex; gap:8px; align-items:center; flex-wrap:wrap;
}

.gj-chip{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 12px;
  border-radius: var(--pill);
  background: rgba(2,6,23,.55);
  border: 1px solid rgba(148,163,184,.18);
  color: var(--text);
  font-weight: 900;
  font-size: 12px;
  backdrop-filter: blur(10px);
}

.gj-btn{
  height:40px;
  padding:0 12px;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.22);
  background: rgba(2,6,23,.55);
  color: var(--text);
  font-weight: 1000;
  cursor:pointer;
}
.gj-btn:hover{ filter: brightness(1.08); }
.gj-btn.primary{
  border-color: rgba(34,197,94,.35);
  background: rgba(34,197,94,.16);
}

/* ---------------- HUD Top ---------------- */
.gj-hud-top, .gj-hud-top#hud{
  position:fixed;
  left:0; right:0;
  top: calc(58px + var(--sat));
  z-index:185;
  padding: 10px calc(10px + var(--sar)) 8px calc(10px + var(--sal));
  pointer-events:auto;
}

.hud-row{
  display:flex;
  gap:10px;
  align-items:stretch;
  flex-wrap:wrap;
}

.hud-pill{
  min-width: 92px;
  padding: 10px 12px;
  border-radius: 18px;
  background: var(--panel);
  border: 1px solid var(--stroke);
  backdrop-filter: blur(12px);
}
.hud-pill .hud-label{
  color: var(--muted);
  font-size: 11px;
  font-weight: 1000;
  letter-spacing:.4px;
}
.hud-pill .hud-value{
  font-size: 20px;
  font-weight: 1200;
  margin-top:4px;
}
.hud-pill.warn{
  border-color: rgba(245,158,11,.30);
}
.hud-pill.grade{
  border-color: rgba(168,85,247,.30);
}

.quest-row{
  margin-top:10px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
}
@media (max-width: 820px){
  .quest-row{ grid-template-columns: 1fr; }
}

.quest-card{
  border-radius: 20px;
  background: var(--panel2);
  border: 1px solid var(--stroke);
  padding: 12px;
  backdrop-filter: blur(12px);
}
.quest-card .q-title{
  font-weight: 1200;
  font-size: 13px;
}
.quest-card .q-desc{
  margin-top:6px;
  color: var(--text);
  font-weight: 900;
  font-size: 12px;
  opacity:.92;
}
.quest-card .q-bar{
  margin-top:10px;
  display:flex;
  justify-content:space-between;
  gap:10px;
  color: var(--muted);
  font-weight: 900;
  font-size: 12px;
}

/* ---------------- HUD Bottom ---------------- */
.gj-hud-bot{
  position:fixed;
  left:0; right:0;
  bottom:0;
  z-index:185;
  padding: 10px calc(10px + var(--sar)) calc(10px + var(--sab)) calc(10px + var(--sal));
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
  pointer-events:auto;
}
@media (max-width: 820px){
  .gj-hud-bot{ grid-template-columns: 1fr; }
}

.meter{
  border-radius: 20px;
  background: var(--panel);
  border: 1px solid var(--stroke);
  padding: 12px;
  backdrop-filter: blur(12px);
}
.meter-title{
  color: var(--muted);
  font-weight: 1200;
  font-size: 12px;
}
.meter-bar{
  margin-top:10px;
  height: 12px;
  border-radius: 999px;
  background: rgba(148,163,184,.12);
  overflow:hidden;
}
.meter-fill{
  height:100%;
  width:0%;
  background: linear-gradient(90deg, rgba(34,197,94,.9), rgba(34,197,94,.35));
}
.meter-num{
  margin-top:8px;
  font-weight: 1100;
  color: var(--text);
}
.meter-shield{
  margin-top:8px;
  font-weight: 1100;
}
.meter-tip{
  margin-top:8px;
  color: var(--muted);
  font-weight: 900;
  font-size: 12px;
}

/* ---------------- Playfield ---------------- */
.gj-field, #playfield{
  position:fixed;
  inset:0;
  z-index:50;
  overflow:hidden;
  touch-action: manipulation;
}

.gj-layer{
  position:absolute;
  inset:0;
  pointer-events:auto;
}
.gj-layer-r{
  display:none;
  pointer-events:auto;
}

/* cVR: split screen feel (optional) */
body.view-cvr .gj-layer-r{
  display:block;
  clip-path: inset(0 0 0 50%);
}
body.view-cvr .gj-layer{
  clip-path: inset(0 50% 0 0);
}

/* Hide HUD */
body.hud-hidden .gj-hud-top,
body.hud-hidden .gj-hud-bot{
  display:none !important;
}

/* ---------------- Targets ---------------- */
.gj-target{
  position:absolute;
  transform: translate(-50%,-50%);
  user-select:none;
  cursor:pointer;
  will-change: transform, opacity, filter;
  text-shadow: 0 12px 28px rgba(0,0,0,.55);
}

.gj-target.spawn{
  animation: gjIn 140ms ease-out 1;
}
@keyframes gjIn{
  from{ transform: translate(-50%,-50%) scale(.85); opacity:.2; filter: blur(1px); }
  to{ transform: translate(-50%,-50%) scale(1); opacity:1; filter:none; }
}

.gj-target.gone{
  animation: gjOut 120ms ease-in 1 forwards;
}
@keyframes gjOut{
  from{ transform: translate(-50%,-50%) scale(1); opacity:1; }
  to{ transform: translate(-50%,-55%) scale(.88); opacity:0; }
}

/* Decoy look */
.gj-decoy{
  filter: drop-shadow(0 0 12px rgba(168,85,247,.55));
  animation: gjDecoyFlicker 360ms ease-in-out infinite;
}
@keyframes gjDecoyFlicker{
  0%{ transform: translate(-50%,-50%) scale(1); opacity:1; }
  50%{ transform: translate(-50%,-52%) scale(1.05); opacity:.9; }
  100%{ transform: translate(-50%,-50%) scale(1); opacity:1; }
}

/* ---------------- Missions Peek ---------------- */
.gj-peek{
  position:fixed; inset:0;
  z-index:195;
  display:flex;
  align-items:center;
  justify-content:center;
  background: rgba(2,6,23,.70);
  backdrop-filter: blur(10px);
  opacity:0;
  pointer-events:none;
  transition: opacity 160ms ease;
}
body.show-missions .gj-peek{
  opacity:1;
  pointer-events:auto;
}
.peek-card{
  width:min(520px, 92vw);
  border-radius: 22px;
  background: rgba(2,6,23,.78);
  border: 1px solid rgba(148,163,184,.22);
  padding: 14px;
  box-shadow: 0 18px 55px rgba(0,0,0,.45);
}
.peek-title{
  font-weight: 1200;
  font-size: 16px;
}
.peek-sub,.peek-mini{
  margin-top:8px;
  color: var(--text);
  font-weight: 1100;
}
.peek-tip{
  margin-top:10px;
  color: var(--muted);
  font-weight: 900;
  font-size: 12px;
}

/* ---------------- Low time overlay ---------------- */
.gj-lowtime-overlay{
  position:fixed; inset:0;
  z-index:188;
  pointer-events:none;
  display:flex;
  align-items:center;
  justify-content:center;
}
.gj-lowtime-ring,
.gj-lowtime-num{
  opacity:0;
  transform: scale(.96);
  transition: opacity 160ms ease, transform 160ms ease;
}
body.gj-lowtime .gj-lowtime-ring,
body.gj-lowtime5 .gj-lowtime-num{
  opacity:1;
  transform: scale(1);
}
.gj-lowtime-ring{
  width:min(320px, 60vw);
  height:min(320px, 60vw);
  border-radius: 999px;
  border: 3px dashed rgba(245,158,11,.55);
  box-shadow: 0 0 0 10px rgba(245,158,11,.08);
  animation: gjRing 900ms linear infinite;
}
@keyframes gjRing{ to{ transform: rotate(360deg) scale(1); } }

.gj-lowtime-num{
  position:absolute;
  font-size: 88px;
  font-weight: 1300;
  color: rgba(245,158,11,.95);
  text-shadow: 0 12px 40px rgba(0,0,0,.55);
}

/* ---------------- End overlay ---------------- */
.gj-end{
  position:fixed; inset:0;
  z-index:210;
  display:none;
  align-items:center;
  justify-content:center;
  background: rgba(2,6,23,.86);
  backdrop-filter: blur(10px);
  padding: calc(18px + var(--sat)) 16px calc(18px + var(--sab));
  pointer-events:auto;
}
.gj-end[aria-hidden="false"]{ display:flex; }

.gj-end .card{
  width:min(760px, 94vw);
  border-radius: 22px;
  background: rgba(2,6,23,.84);
  border: 1px solid rgba(148,163,184,.22);
  padding: 18px;
  box-shadow: 0 18px 55px rgba(0,0,0,.45);
}
.gj-end .title{
  font-size: 22px;
  font-weight: 1200;
}
.gj-end .sub{
  margin-top:6px;
  color: var(--muted);
  font-weight: 900;
  font-size: 12px;
}
.gj-end .grid{
  margin-top:12px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
}
.gj-end .stat{
  border-radius: 18px;
  background: rgba(15,23,42,.58);
  border: 1px solid rgba(148,163,184,.18);
  padding: 12px;
}
.gj-end .stat span{
  color: var(--muted);
  font-weight: 1000;
  font-size: 12px;
}
.gj-end .stat b{
  display:block;
  margin-top:6px;
  font-size: 22px;
  font-weight: 1200;
}
.gj-end .actions{
  margin-top:14px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.gj-end .btn{
  flex:1;
  min-width:220px;
  height:54px;
  border-radius:16px;
  border:1px solid rgba(148,163,184,.22);
  background: rgba(2,6,23,.55);
  color: var(--text);
  font-weight:1200;
  font-size:16px;
  cursor:pointer;
}
.gj-end .btn.alt{
  border-color: rgba(34,197,94,.35);
  background: rgba(34,197,94,.16);
}

/* ==========================================================
   FX PACK (Boss/Storm/Rage/Swap/Fake/Stun/Block)
========================================================== */

/* Storm overlay */
body.fx-storm::before{
  content:"";
  position:fixed; inset:-10%;
  pointer-events:none;
  background:
    radial-gradient(circle at 20% 20%, rgba(56,189,248,.16), transparent 55%),
    radial-gradient(circle at 80% 40%, rgba(239,68,68,.16), transparent 60%),
    radial-gradient(circle at 50% 90%, rgba(168,85,247,.14), transparent 60%);
  opacity:.9;
  z-index:120;
  animation: gjStormPulse 900ms ease-in-out infinite;
}
@keyframes gjStormPulse{
  0%{ opacity:.35; transform: scale(1); }
  50%{ opacity:.95; transform: scale(1.02); }
  100%{ opacity:.45; transform: scale(1); }
}
body.fx-storm .gj-layer{ animation: gjShake 220ms linear infinite; }
@keyframes gjShake{
  0%{ transform: translate3d(0,0,0); }
  25%{ transform: translate3d(1px,0,0); }
  50%{ transform: translate3d(0,1px,0); }
  75%{ transform: translate3d(-1px,0,0); }
  100%{ transform: translate3d(0,-1px,0); }
}

/* Rage (stronger pressure) */
body.fx-rage{
  animation: gjRageFlash 480ms ease-in-out infinite;
}
@keyframes gjRageFlash{
  0%{ filter:none; }
  50%{ filter: saturate(1.25) contrast(1.10) brightness(1.05); }
  100%{ filter:none; }
}
body.fx-rage::after{
  content:"";
  position:fixed; inset:0;
  pointer-events:none;
  z-index:121;
  background: radial-gradient(circle at 50% 50%, transparent 55%, rgba(239,68,68,.38) 80%, rgba(0,0,0,.72) 100%);
  opacity:.85;
}

/* Swap tint */
body.fx-swap{ animation: gjSwapWobble 520ms ease-in-out 1; }
@keyframes gjSwapWobble{
  0%{ filter:none; }
  30%{ filter: saturate(1.35) contrast(1.12) hue-rotate(40deg); }
  70%{ filter: saturate(1.25) contrast(1.08) hue-rotate(-35deg); }
  100%{ filter:none; }
}

/* Fake-out vignette */
body.fx-fake::after{
  content:"";
  position:fixed; inset:0;
  pointer-events:none;
  z-index:122;
  background: radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,.45) 78%, rgba(0,0,0,.72) 100%);
  opacity:.95;
  animation: gjFade 520ms ease-out 1;
}
@keyframes gjFade{ from{opacity:0;} to{opacity:.95;} }

/* Stun */
body.fx-stun .gj-layer{
  filter: blur(1.2px) contrast(1.08);
  animation: gjStun 380ms ease-out 1;
}
@keyframes gjStun{
  0%{ transform: scale(1); }
  30%{ transform: scale(.995); }
  100%{ transform: scale(1); }
}

/* Boss entrance / hit / down */
body.fx-boss-in .gj-chip{ animation: gjBossGlow 520ms ease-out 1; }
@keyframes gjBossGlow{
  0%{ filter: drop-shadow(0 0 0 rgba(239,68,68,0)); }
  60%{ filter: drop-shadow(0 0 16px rgba(239,68,68,.55)); }
  100%{ filter: drop-shadow(0 0 0 rgba(239,68,68,0)); }
}
body.fx-boss-hit{ animation: gjImpact 220ms ease-in-out 1; }
@keyframes gjImpact{
  0%{ transform:none; }
  35%{ transform: scale(1.01); }
  100%{ transform:none; }
}
body.fx-boss-down::before{
  content:"";
  position:fixed; inset:0;
  pointer-events:none;
  z-index:123;
  background: radial-gradient(circle at 50% 40%, rgba(34,197,94,.18), transparent 60%);
  animation: gjDown 650ms ease-out 1;
}
@keyframes gjDown{
  0%{ opacity:0; transform: scale(.96); }
  40%{ opacity:1; transform: scale(1.02); }
  100%{ opacity:0; transform: scale(1.05); }
}

/* Block flash */
body.fx-block{ animation: gjBlock 260ms ease-out 1; }
@keyframes gjBlock{
  0%{ filter:none; }
  50%{ filter: brightness(1.14) contrast(1.06); }
  100%{ filter:none; }
}