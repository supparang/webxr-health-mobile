/* === /herohealth/vr/hha-layout.css ===
HHA Unified Layout — PC / Mobile / VR Cardboard (DOM-VR feel)
✅ Goal right, Coach bottom-right
✅ PlayRect vars for engines: --hha-play-top/bottom/left/right
✅ VR button + fullscreen-safe
*/

:root{
  color-scheme: dark;

  --bg:#020617;
  --panel:rgba(2,6,23,.78);
  --panel2:rgba(15,23,42,.72);
  --stroke:rgba(148,163,184,.18);
  --text:#e5e7eb;
  --muted:#94a3b8;

  --accent:#22c55e;
  --cyan:#22d3ee;
  --bad:#ef4444;
  --warn:#f59e0b;
  --violet:#a78bfa;

  --radius-lg:18px;
  --radius-md:14px;
  --radius-pill:999px;

  /* safe-area */
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);

  /* ✅ play-rect fallback (JS จะวัดแล้วเขียนทับ) */
  --hha-play-top: 150px;
  --hha-play-bottom: 190px;
  --hha-play-left: 16px;
  --hha-play-right: 16px;

  /* sizes */
  --hha-hud-gap: 10px;
  --hha-card-shadow: 0 18px 60px rgba(0,0,0,.45);
}

*{ box-sizing:border-box; }
html,body{
  margin:0;
  width:100%;
  height:100%;
  overflow:hidden;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  color:var(--text);
  background:
    radial-gradient(circle at top left, rgba(34,211,238,.14), transparent 55%),
    radial-gradient(circle at bottom right, rgba(167,139,250,.14), transparent 60%),
    var(--bg);
}

/* ======================
   Gameplay Layer
   ====================== */
.hha-layer{
  position:fixed;
  inset:0;
  z-index: 3;
  pointer-events:auto;

  transform: translate(var(--vx,0px), var(--vy,0px));
  will-change: transform;
  touch-action:none;
  user-select:none;
}

/* ======================
   HUD blocks
   ====================== */
.hha-card{
  background:var(--panel);
  border:1px solid var(--stroke);
  border-radius:var(--radius-lg);
  box-shadow:var(--hha-card-shadow);
  padding:12px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.hha-topbar{
  position:fixed;
  left:calc(10px + var(--sal));
  right:calc(10px + var(--sar));
  top:calc(10px + var(--sat));
  z-index: 20;
  pointer-events:none;

  display:grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--hha-hud-gap);
  align-items:start;
}

.hha-top-left,
.hha-top-mid,
.hha-top-right{ pointer-events:none; }

.hha-top-left .row,
.hha-top-right .row{
  display:flex;
  justify-content:space-between;
  gap:10px;
  padding:6px 0;
  border-bottom:1px dashed rgba(148,163,184,.18);
}
.hha-top-left .row:last-child,
.hha-top-right .row:last-child{ border-bottom:0; }

.hha-label{ font-weight:1000; font-size:12px; opacity:.9; }
.hha-value{ font-weight:1100; font-size:16px; }

.hha-top-mid{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  justify-content:center;
}
.hha-pill{
  pointer-events:none;
  padding:8px 12px;
  border-radius:var(--radius-pill);
  border:1px solid rgba(148,163,184,.18);
  background:rgba(2,6,23,.55);
  box-shadow:0 16px 40px rgba(0,0,0,.35);
  font-weight:1000;
  font-size:12px;
}

/* ======================
   Quest (RIGHT)
   ====================== */
.hha-quest{
  position:fixed;
  top:calc(72px + var(--sat));
  right:calc(10px + var(--sar));
  z-index: 21;
  pointer-events:none;

  width:min(360px, 48vw);
  display:grid;
  gap:10px;
}

.hha-qline .t{ font-weight:1000; font-size:12px; color:var(--muted); }
.hha-qline .b{
  margin-top:3px;
  font-weight:1100;
  font-size:13px;
  line-height:1.25;
}
.hha-bar{
  margin-top:8px;
  height:10px;
  border-radius:999px;
  background:rgba(148,163,184,.14);
  overflow:hidden;
}
.hha-bar > i{
  display:block;
  height:100%;
  width:0%;
  border-radius:999px;
  background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.85));
}
.hha-mini-time{
  margin-top:6px;
  font-size:12px;
  font-weight:1000;
  color:rgba(226,232,240,.88);
  display:none;
}
.hha-mini-urgent{
  border-color: rgba(239,68,68,.25) !important;
  box-shadow: 0 0 0 3px rgba(239,68,68,.12), var(--hha-card-shadow) !important;
}
.hha-mini-urgent .b{
  color:#fff;
  text-shadow:0 0 16px rgba(239,68,68,.30);
}

/* ======================
   Power (BOTTOM)
   ====================== */
.hha-power{
  position:fixed;
  left:calc(10px + var(--sal));
  right:calc(10px + var(--sar));
  bottom:calc(10px + var(--sab));
  z-index: 20;
  pointer-events:none;
}
.hha-power .bar{
  height:14px;
  border-radius:999px;
  background:rgba(15,23,42,.65);
  border:1px solid rgba(148,163,184,.18);
  overflow:hidden;
}
.hha-power .bar > i{
  display:block;
  height:100%;
  width:0%;
  background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.90));
}
.hha-power .meta{
  margin-top:8px;
  display:flex;
  justify-content:space-between;
  font-size:12px;
  font-weight:1000;
  color:var(--muted);
}

/* ======================
   Coach (BOTTOM-RIGHT)
   ====================== */
.hha-coach{
  position:fixed;
  right:calc(10px + var(--sar));
  bottom:calc(74px + var(--sab)); /* ลอยเหนือ Power */
  z-index: 22;
  pointer-events:none;

  display:flex;
  gap:10px;
  align-items:flex-end;
}
.hha-coach-card{
  width:240px;
  background:rgba(2,6,23,.60);
  border:1px solid rgba(148,163,184,.14);
  border-radius:var(--radius-lg);
  padding:10px;
  box-shadow:0 16px 40px rgba(0,0,0,.25);
}
.hha-coach-line{
  font-size:12px;
  font-weight:900;
  color:rgba(226,232,240,.92);
  line-height:1.45;
  min-height:34px;
}
.hha-fever{
  margin-top:8px;
  height:10px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.14);
  background:rgba(15,23,42,.65);
  overflow:hidden;
}
.hha-fever > i{
  display:block;
  height:100%;
  width:0%;
  background:rgba(239,68,68,.85);
}
.hha-shield{
  margin-top:8px;
  display:none;
  align-items:center;
  gap:6px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.14);
  background:rgba(15,23,42,.60);
  font-size:12px;
  font-weight:1000;
  color:rgba(226,232,240,.92);
}
.hha-coach-img{
  width:78px;
  height:78px;
  border-radius:18px;
  border:1px solid rgba(148,163,184,.14);
  background:rgba(15,23,42,.55);
  overflow:hidden;
  box-shadow:0 16px 40px rgba(0,0,0,.25);
}
.hha-coach-img img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

/* ======================
   VR Button (Cardboard mode)
   ====================== */
.hha-vrbtn{
  position:fixed;
  right:calc(12px + var(--sar));
  bottom:calc(12px + var(--sab));
  z-index: 40;
  pointer-events:auto;
}
.hha-vrbtn button{
  border:0;
  border-radius:14px;
  padding:10px 12px;
  font-weight:1100;
  cursor:pointer;
  color:#061018;
  background:linear-gradient(135deg, rgba(34,197,94,.95), rgba(34,211,238,.80));
  box-shadow:0 16px 40px rgba(0,0,0,.35);
}
.hha-vrbtn button.ghost{
  background:rgba(15,23,42,.72);
  border:1px solid rgba(148,163,184,.18);
  color:var(--text);
}

/* ======================
   Start/End Overlay (optional)
   ====================== */
.hha-overlay{
  position:fixed;
  inset:0;
  z-index: 200;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:calc(14px + var(--sat)) calc(14px + var(--sar)) calc(14px + var(--sab)) calc(14px + var(--sal));
  background:rgba(2,6,23,.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.hha-overlay .panel{
  width:min(760px, 92vw);
  background:rgba(2,6,23,.72);
  border:1px solid rgba(148,163,184,.20);
  border-radius:22px;
  padding:18px 18px 14px;
  box-shadow:0 18px 55px rgba(0,0,0,.55);
}

/* ======================
   Responsive
   ====================== */
@media (max-width: 920px){
  .hha-topbar{
    grid-template-columns: 1fr;
  }
  .hha-quest{
    top:calc(162px + var(--sat));
    width:min(360px, 92vw);
    right:calc(10px + var(--sar));
  }
}

@media (max-width: 520px){
  .hha-quest{
    width:min(320px, 92vw);
    top:calc(158px + var(--sat));
  }
  .hha-coach-card{
    width:min(220px, 70vw);
  }
  .hha-coach{
    bottom:calc(82px + var(--sab));
  }
}

/* ======================
   Cardboard mode tweaks
   ====================== */
body.view-cvr .hha-card{ box-shadow:0 12px 34px rgba(0,0,0,.35); }
body.view-cvr .hha-quest{ width:min(320px, 44vw); opacity:.98; }
body.view-cvr .hha-coach-card{ width:min(220px, 42vw); }
body.view-cvr .hha-topbar{ opacity:.95; }

/* reduce motion */
@media (prefers-reduced-motion: reduce){
  *{ animation:none !important; transition:none !important; }
}