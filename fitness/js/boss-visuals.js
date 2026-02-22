// === /fitness/js/boss-visuals.js ===
// Universal DOM visuals for boss phases/attacks (safe overlay)

'use strict';

export function mountBossVisuals(){
  const root = document.createElement('div');
  root.id = 'hh-boss-viz';
  root.style.cssText = `
    position:fixed; inset:0; z-index:9997; pointer-events:none;
  `;

  root.innerHTML = `
    <div id="bv-storm" style="
      position:absolute; inset:-20px;
      background:radial-gradient(800px 500px at 50% 40%, rgba(244,63,94,.12), transparent 60%),
                 radial-gradient(900px 700px at 10% 0%, rgba(239,68,68,.10), transparent 55%),
                 radial-gradient(900px 700px at 90% 10%, rgba(251,191,36,.06), transparent 55%);
      opacity:0; transition:opacity .18s ease;
      filter:saturate(1.1);
    "></div>

    <div id="bv-storm-border" style="
      position:absolute; inset:0;
      box-shadow: inset 0 0 0 2px rgba(244,63,94,.22),
                  inset 0 0 120px rgba(244,63,94,.18);
      opacity:0; transition:opacity .18s ease;
      border-radius:0;
    "></div>

    <div id="bv-feint" style="
      position:absolute; inset:0;
      opacity:0; transition:opacity .18s ease;
      background:linear-gradient(120deg, rgba(148,163,184,.06), rgba(255,255,255,.10), rgba(148,163,184,.06));
      mix-blend-mode:screen;
      filter:blur(.2px);
    "></div>

    <div id="bv-feint-badge" style="
      position:absolute; top:74px; right:12px;
      opacity:0; transform:translateY(-6px);
      transition:opacity .18s ease, transform .18s ease;
      background:rgba(2,6,23,.70);
      border:1px solid rgba(255,255,255,.18);
      border-radius:999px;
      padding:8px 10px;
      color:rgba(255,255,255,.92);
      font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
      font-weight:900; letter-spacing:.2px;
    ">👻 หลอก!</div>

    <div id="bv-shield" style="
      position:absolute; left:12px; right:12px; bottom:14px;
      opacity:0; transform:translateY(10px);
      transition:opacity .18s ease, transform .18s ease;
      background:rgba(2,6,23,.68);
      border:1px solid rgba(255,255,255,.18);
      border-radius:16px;
      padding:10px 12px;
      font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
      color:rgba(255,255,255,.92);
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="font-weight:900;">🛡️ Shield Break</div>
        <div id="bv-shield-text" style="opacity:.92;">ทำถูกติดกัน <b id="bv-shield-need">2</b> ครั้ง</div>
        <div style="margin-left:auto; font-variant-numeric:tabular-nums;">
          <span id="bv-shield-got" style="font-weight:900;">0</span>/<span id="bv-shield-need2">2</span>
        </div>
      </div>
      <div style="height:10px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;margin-top:8px;">
        <div id="bv-shield-bar" style="height:100%;width:0%;background:rgba(59,130,246,.92);"></div>
      </div>
    </div>

    <style>
      @keyframes bvPulse {
        0% { transform:scale(1); opacity:.10; }
        50% { transform:scale(1.02); opacity:.22; }
        100% { transform:scale(1); opacity:.10; }
      }
      #bv-storm.pulse { animation: bvPulse .7s ease-in-out infinite; }
      @keyframes bvShimmer {
        0% { transform:translateX(-30%); opacity:.06; }
        50% { transform:translateX(0%); opacity:.16; }
        100% { transform:translateX(30%); opacity:.06; }
      }
      #bv-feint.shimmer { animation: bvShimmer .8s ease-in-out infinite; }
    </style>
  `;

  document.body.appendChild(root);

  const storm = root.querySelector('#bv-storm');
  const stormBorder = root.querySelector('#bv-storm-border');
  const feint = root.querySelector('#bv-feint');
  const feintBadge = root.querySelector('#bv-feint-badge');
  const shield = root.querySelector('#bv-shield');
  const shieldGot = root.querySelector('#bv-shield-got');
  const shieldNeed = root.querySelector('#bv-shield-need');
  const shieldNeed2 = root.querySelector('#bv-shield-need2');
  const shieldBar = root.querySelector('#bv-shield-bar');

  function setStorm(on){
    storm.style.opacity = on ? '1' : '0';
    stormBorder.style.opacity = on ? '1' : '0';
    storm.classList.toggle('pulse', !!on);
  }

  function setFeint(on){
    feint.style.opacity = on ? '1' : '0';
    feint.classList.toggle('shimmer', !!on);
    feintBadge.style.opacity = on ? '1' : '0';
    feintBadge.style.transform = on ? 'translateY(0px)' : 'translateY(-6px)';
  }

  function setShield(on, got=0, need=2){
    shield.style.opacity = on ? '1' : '0';
    shield.style.transform = on ? 'translateY(0px)' : 'translateY(10px)';
    shieldNeed.textContent = String(need);
    shieldNeed2.textContent = String(need);
    shieldGot.textContent = String(got);
    const p = need>0 ? Math.max(0, Math.min(1, got/need)) : 0;
    shieldBar.style.width = (p*100).toFixed(1) + '%';
  }

  // phase label could be added here too if you want

  return { setStorm, setFeint, setShield };
}