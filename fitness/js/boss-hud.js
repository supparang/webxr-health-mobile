// === /fitness/js/boss-hud.js ===
// Universal Boss HUD (DOM overlay). No dependencies.

'use strict';

export function mountBossHUD(){
  const el = document.createElement('div');
  el.id = 'hh-boss-hud';
  el.style.cssText = `
    position:fixed; left:12px; right:12px; top:12px; z-index:9998;
    display:none; pointer-events:none;
    font-family:system-ui,-apple-system,"Noto Sans Thai",sans-serif;
  `;
  el.innerHTML = `
    <div style="background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.18);
                border-radius:14px; padding:10px 12px; display:flex; gap:12px; align-items:center;">
      <div style="font-weight:900;">👾 BOSS</div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; font-size:12px; opacity:.9;">
          <div id="bh-phase">phase</div>
          <div id="bh-time">--</div>
        </div>
        <div style="height:10px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden; margin-top:6px;">
          <div id="bh-bar" style="height:100%; width:100%; background:rgba(244,63,94,.92);"></div>
        </div>
      </div>
      <div style="font-variant-numeric:tabular-nums;">
        <span id="bh-hp">--</span>/<span id="bh-hpmax">--</span>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const bar = el.querySelector('#bh-bar');
  const hp = el.querySelector('#bh-hp');
  const hpmax = el.querySelector('#bh-hpmax');
  const phase = el.querySelector('#bh-phase');
  const time = el.querySelector('#bh-time');

  function show(on){ el.style.display = on ? 'block' : 'none'; }
  function set(st){
    if(!st) return;
    const p = Math.max(0, Math.min(1, (st.hpMax? st.hp/st.hpMax : 1)));
    bar.style.width = (p*100).toFixed(1) + '%';
    hp.textContent = String(st.hp ?? '--');
    hpmax.textContent = String(st.hpMax ?? '--');
    phase.textContent = String(st.phase || '');
    if(st.remainMs != null){
      time.textContent = `${Math.ceil(st.remainMs/1000)}s`;
    }
  }

  return { show, set };
}