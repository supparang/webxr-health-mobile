/* === /herohealth/vr-groups/groups.css ===
Food Groups VR — PRODUCTION UI/CSS (ALL-IN)
Targets (emoji), Afterimage, Reticle/Lock/Charge, HUD/Quest/Coach, Start/End overlays
*/

:root{
  --bg:#020617;
  --panel:rgba(2,6,23,.76);
  --panel2:rgba(15,23,42,.70);
  --stroke:rgba(148,163,184,.20);
  --text:#e5e7eb;
  --muted:#94a3b8;

  --good:#22c55e;
  --junk:#ef4444;
  --warn:#f59e0b;
  --cyan:#22d3ee;

  --shadow:0 18px 55px rgba(0,0,0,.50);

  /* Safe HUD clamp idea (use in JS if needed) */
  --safe-top:118px;
  --safe-bot:150px;
  --safe-left:28px;
  --safe-right:28px;

  /* Target feel */
  --target-font: 64px;
  --target-shadow: 0 10px 25px rgba(0,0,0,.45);
}

html,body{
  height:100%;
  margin:0;
  background:var(--bg);
  color:var(--text);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;
}
*{box-sizing:border-box;}
a{color:inherit}

/* A-Frame canvas behind */
.a-canvas, canvas{
  position:fixed !important;
  inset:0 !important;
  z-index:0 !important;
}

/* Gameplay overlay root */
.overlay{
  position:fixed;
  inset:0;
  z-index:10;
  pointer-events:none;
}

/* Targets layer (DOM) */
#fg-layer{
  position:fixed;
  inset:0;
  pointer-events:auto; /* targets clickable */
  touch-action:manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* -----------------------------
   TARGETS (emoji)
------------------------------*/
.fg-target{
  position:absolute;
  left:var(--x, 50%);
  top:var(--y, 52%);
  transform:translate(-50%,-50%) scale(var(--s,1));
  will-change:transform,left,top;
  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:999px;
  user-select:none;
  -webkit-user-select:none;
  font-size:var(--target-font);
  line-height:1;

  text-shadow: var(--target-shadow);
  filter: drop-shadow(0 14px 30px rgba(0,0,0,.45));

  transition: transform .12s ease, opacity .18s ease, filter .18s ease;
  opacity:0;
}
.fg-target.show{opacity:1;}
.fg-target.spawn{animation: fgPop .18s ease-out both;}
@keyframes fgPop{
  from{transform:translate(-50%,-50%) scale(.6); opacity:.2}
  to{transform:translate(-50%,-50%) scale(var(--s,1)); opacity:1}
}
.fg-target.hit{
  opacity:0;
  transform:translate(-50%,-50%) scale(.65) rotate(-8deg);
  filter: drop-shadow(0 10px 18px rgba(0,0,0,.25));
}
.fg-target.out{
  opacity:0;
  transform:translate(-50%,-50%) scale(.88);
  filter: drop-shadow(0 10px 18px rgba(0,0,0,.25));
}

/* Types */
.fg-good{
  background:
    radial-gradient(120px 120px at 30% 30%, rgba(34,197,94,.22), rgba(2,6,23,.02));
  border:1px solid rgba(34,197,94,.18);
  box-shadow: 0 0 0 2px rgba(34,197,94,.08) inset;
}
.fg-junk{
  background:
    radial-gradient(120px 120px at 30% 30%, rgba(239,68,68,.20), rgba(2,6,23,.02));
  border:1px solid rgba(239,68,68,.18);
  box-shadow: 0 0 0 2px rgba(239,68,68,.08) inset;
}
.fg-boss{
  border:1px solid rgba(245,158,11,.24);
  box-shadow: 0 0 0 2px rgba(245,158,11,.12) inset;
}
.fg-decoy{
  border:1px dashed rgba(34,211,238,.40);
  box-shadow: 0 0 0 2px rgba(34,211,238,.10) inset;
}

/* lock highlight */
.fg-target.lock{
  outline: 2px solid rgba(34,211,238,.35);
  outline-offset: 4px;
  animation: lockPulse .55s ease-in-out infinite;
}
@keyframes lockPulse{
  0%,100%{transform:translate(-50%,-50%) scale(var(--s,1))}
  50%{transform:translate(-50%,-50%) scale(calc(var(--s,1) * 1.04))}
}

/* rage glow */
.fg-target.rage{
  animation: rageGlow .25s ease-in-out infinite alternate;
}
@keyframes rageGlow{
  from{filter: drop-shadow(0 16px 34px rgba(245,158,11,.35));}
  to{filter: drop-shadow(0 20px 44px rgba(245,158,11,.55));}
}

/* Boss HP bar */
.bossbar{
  position:absolute;
  left:50%;
  bottom:-12px;
  transform:translateX(-50%);
  width:68%;
  height:8px;
  border-radius:99px;
  background:rgba(148,163,184,.18);
  border:1px solid rgba(148,163,184,.20);
  overflow:hidden;
}
.bossbar-fill{
  height:100%;
  width:100%;
  background:linear-gradient(90deg, rgba(245,158,11,.95), rgba(34,197,94,.85));
}

/* -----------------------------
   AFTERIMAGE (feint FX)
------------------------------*/
.fg-afterimage{
  position:absolute;
  left:0; top:0;
  pointer-events:none;
  z-index:5;
  opacity:.0;
  animation: afterFade .42s ease-out forwards;
}
.fg-afterimage-inner{
  transform:translate(-50%,-50%) scale(.92);
  font-size:56px;
  line-height:1;
  filter: blur(.2px);
  text-shadow: 0 12px 30px rgba(0,0,0,.35);
  opacity:.75;
}
.fg-afterimage.a1 .fg-afterimage-inner{opacity:.75}
.fg-afterimage.a2 .fg-afterimage-inner{opacity:.55}
@keyframes afterFade{
  0%{opacity:.0}
  10%{opacity:.85}
  100%{opacity:0; transform: translate3d(0,-6px,0)}
}

/* -----------------------------
   HUD
------------------------------*/
.hud{
  position:fixed;
  inset:0;
  z-index:20;
  pointer-events:none;
}
.topbar{
  position:fixed;
  left:10px;
  right:10px;
  top:10px;
  display:flex;
  gap:10px;
  align-items:stretch;
}
.card{
  background:var(--panel);
  border:1px solid var(--stroke);
  border-radius:16px;
  box-shadow:var(--shadow);
  padding:10px 12px;
  backdrop-filter:blur(10px);
  min-width:0;
}
.card h4{
  margin:0 0 6px 0;
  font-size:12px;
  letter-spacing:.2px;
  color:var(--muted);
  font-weight:800;
  text-transform:uppercase;
}
.row{
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
  font-size:14px;
}
.pill{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.18);
  background:rgba(15,23,42,.55);
  font-weight:900;
  white-space:nowrap;
}
.pill b{font-weight:1000}
.pill.good{border-color:rgba(34,197,94,.22)}
.pill.warn{border-color:rgba(245,158,11,.25)}
.pill.bad{border-color:rgba(239,68,68,.25)}
.pill.cyan{border-color:rgba(34,211,238,.25)}
.muted{color:var(--muted); font-weight:700}

/* Quest panel */
.quest{
  position:fixed;
  left:10px;
  bottom:12px;
  width:min(520px, calc(100% - 20px));
}
.qline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin:6px 0;
  font-size:14px;
  font-weight:950;
}
.qprog{
  display:flex;
  align-items:center;
  gap:8px;
  color:var(--muted);
  font-weight:1000;
  white-space:nowrap;
}
.bar{
  height:10px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.18);
  background:rgba(148,163,184,.12);
  overflow:hidden;
  margin-top:8px;
}
.bar > i{
  display:block;
  height:100%;
  width:0%;
  background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.88));
}
.subbar > i{
  background:linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.88));
}
.qtag{
  display:inline-flex;
  align-items:center;
  gap:8px;
  font-size:12px;
  font-weight:950;
  color:var(--muted);
}

/* Coach bubble */
.coach{
  position:fixed;
  right:10px;
  bottom:12px;
  width:min(520px, calc(100% - 20px));
  display:flex;
  gap:10px;
  align-items:flex-end;
}
.coach .avatar{
  width:62px;
  height:62px;
  border-radius:16px;
  border:1px solid var(--stroke);
  background:rgba(2,6,23,.45);
  box-shadow:var(--shadow);
  overflow:hidden;
  flex:0 0 auto;
}
.coach .avatar img{
  width:100%;
  height:100%;
  object-fit:cover;
}
.coach .bubble{
  flex:1 1 auto;
  background:var(--panel2);
  border:1px solid var(--stroke);
  border-radius:18px;
  padding:10px 12px;
  box-shadow:var(--shadow);
  backdrop-filter:blur(10px);
  font-weight:1000;
  font-size:14px;
}

/* -----------------------------
   RETICLE + LOCK/CHARGE RINGS
------------------------------*/
.reticle{
  position:fixed;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:25;
  pointer-events:none;
}
.ret{
  position:relative;
  width:86px;
  height:86px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.20);
  background: radial-gradient(closest-side, rgba(2,6,23,.12), rgba(2,6,23,0));
  box-shadow: 0 0 0 2px rgba(148,163,184,.10) inset;
  transform:translateZ(0);
}
.ret:before, .ret:after{
  content:'';
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  width:2px;
  height:18px;
  background:rgba(148,163,184,.38);
  border-radius:2px;
}
.ret:after{
  width:18px;
  height:2px;
}
.ret.ok{
  border-color:rgba(34,197,94,.28);
  box-shadow:0 0 0 2px rgba(34,197,94,.14) inset;
}
.ret.miss{
  border-color:rgba(239,68,68,.30);
  box-shadow:0 0 0 2px rgba(239,68,68,.14) inset;
  animation: missShake .25s ease;
}
@keyframes missShake{
  0%{transform:translate(0,0)}
  25%{transform:translate(-2px,1px)}
  55%{transform:translate(2px,-1px)}
  100%{transform:translate(0,0)}
}

/* lock ring floats to target position (JS sets left/top) */
.lockRing{
  position:fixed;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  width:104px;
  height:104px;
  border-radius:999px;
  border:2px solid rgba(34,211,238,.26);
  box-shadow: 0 0 0 2px rgba(34,211,238,.10) inset;
  opacity:0;
  pointer-events:none;
  z-index:26;
}
.lockRing.on{opacity:1;}
.lockRing .prog,
.lockRing .charge{
  position:absolute;
  inset:10px;
  border-radius:999px;
  border:3px solid transparent;
  border-top-color: rgba(34,211,238,.85);
  transform:rotate(-90deg);
  opacity:.92;
}
.lockRing .charge{
  inset:18px;
  border-top-color: rgba(245,158,11,.95);
  opacity:.88;
}

/* -----------------------------
   START / END OVERLAYS
------------------------------*/
.start{
  position:fixed;
  inset:0;
  z-index:50;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  background: radial-gradient(900px 500px at 40% 20%, rgba(34,211,238,.08), rgba(2,6,23,.92));
}
.startCard{
  width:min(780px, 100%);
  border-radius:22px;
  border:1px solid rgba(148,163,184,.22);
  background:rgba(2,6,23,.78);
  box-shadow:0 30px 90px rgba(0,0,0,.62);
  backdrop-filter:blur(14px);
  padding:16px;
}
.startHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:10px;
}
.startHead h1{
  margin:0;
  font-size:18px;
  font-weight:1000;
  letter-spacing:.2px;
}
.startHead p{
  margin:6px 0 0 0;
  color:var(--muted);
  font-weight:750;
  font-size:13px;
}
.grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
  margin-top:10px;
}
.field{
  background:rgba(15,23,42,.55);
  border:1px solid rgba(148,163,184,.18);
  border-radius:16px;
  padding:10px;
}
.field label{
  display:block;
  font-size:12px;
  color:var(--muted);
  font-weight:950;
  margin-bottom:6px;
}
.field input,
.field select{
  width:100%;
  border-radius:12px;
  border:1px solid rgba(148,163,184,.18);
  background:rgba(2,6,23,.70);
  color:var(--text);
  padding:10px 10px;
  font-size:14px;
  font-weight:900;
  outline:none;
}
.actions{
  display:flex;
  gap:10px;
  justify-content:flex-end;
  flex-wrap:wrap;
  margin-top:12px;
}
.btn{
  pointer-events:auto;
  border:1px solid rgba(148,163,184,.18);
  border-radius:14px;
  padding:10px 12px;
  background:rgba(15,23,42,.65);
  color:var(--text);
  font-weight:1000;
  cursor:pointer;
}
.btn.primary{
  border-color:rgba(34,197,94,.22);
  background:linear-gradient(180deg, rgba(34,197,94,.22), rgba(15,23,42,.75));
}
.btn.warn{
  border-color:rgba(245,158,11,.25);
  background:linear-gradient(180deg, rgba(245,158,11,.18), rgba(15,23,42,.75));
}
.small{
  font-size:12px;
  color:var(--muted);
  font-weight:800;
  margin-top:8px;
}

/* END overlay */
.end{
  position:fixed;
  inset:0;
  z-index:60;
  display:none;
  align-items:center;
  justify-content:center;
  padding:18px;
  background: radial-gradient(900px 500px at 40% 20%, rgba(34,197,94,.10), rgba(2,6,23,.92));
}
.end.show{display:flex;}
.endCard{
  width:min(720px, 100%);
  border-radius:22px;
  border:1px solid rgba(148,163,184,.22);
  background:rgba(2,6,23,.80);
  box-shadow:0 30px 90px rgba(0,0,0,.62);
  backdrop-filter:blur(14px);
  padding:16px;
}
.endCard h2{
  margin:0 0 8px 0;
  font-size:18px;
  font-weight:1000;
}
.endGrid{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  gap:10px;
  margin-top:10px;
}
.stat{
  background:rgba(15,23,42,.55);
  border:1px solid rgba(148,163,184,.18);
  border-radius:16px;
  padding:10px;
}
.stat .k{color:var(--muted); font-size:12px; font-weight:950; margin-bottom:6px;}
.stat .v{font-size:18px; font-weight:1000;}
.rankBig{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-top:10px;
  gap:10px;
  background:rgba(15,23,42,.55);
  border:1px solid rgba(148,163,184,.18);
  border-radius:18px;
  padding:12px;
}
.rankBig .g{font-size:28px; font-weight:1100; letter-spacing:.6px;}
.rankBig .m{color:var(--muted); font-weight:900; font-size:12px; text-align:right;}

/* -----------------------------
   RESPONSIVE
------------------------------*/
@media (max-width: 520px){
  :root{ --target-font: 56px; }
  .topbar{ gap:8px; left:8px; right:8px; top:8px; }
  .card{ padding:9px 10px; border-radius:14px; }
  .quest{ left:8px; bottom:10px; width:calc(100% - 16px); }
  .coach{ right:8px; bottom:10px; width:calc(100% - 16px); }
  .grid{ grid-template-columns:1fr; }
  .endGrid{ grid-template-columns:1fr; }
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce){
  .fg-target.spawn{animation:none}
  .fg-target.lock{animation:none}
  .fg-target.rage{animation:none}
  .ret.miss{animation:none}
  .fg-afterimage{animation:none; opacity:.35}
}