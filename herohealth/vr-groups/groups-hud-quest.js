/* === /herohealth/vr-groups/groups-hud-quest.js ===
Food Groups VR — HUD Quest Binder (PRODUCTION / classic script)
✅ listens: quest:update
✅ updates:
   - #hud-goal-title, #hud-goal-val
   - #hud-mini-title, #hud-mini-val
✅ optional top bars (qbar):
   - creates inside .hud-mid if missing:
       .qbar.goal  -> .qbar-fill.goal + timer (optional)
       .qbar.mini  -> .qbar-fill.mini + timer (miniSecLeft)
✅ safe: elements missing => skip
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function qs(sel){ return DOC.querySelector(sel); }

  // --- main HUD refs (existing in your HTML) ---
  const elGoalTitle = DOC.getElementById('hud-goal-title');
  const elGoalVal   = DOC.getElementById('hud-goal-val');
  const elMiniTitle = DOC.getElementById('hud-mini-title');
  const elMiniVal   = DOC.getElementById('hud-mini-val');

  // --- optional bar container ---
  const hudMid = qs('.hud-mid');

  // Create qbar blocks (optional) if HUD mid exists
  function ensureQBars(){
    if (!hudMid) return null;

    // Do not duplicate
    let wrap = hudMid.querySelector('.qbars-wrap');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'qbars-wrap';
    // minimal spacing (CSS already has .qbar styles)
    wrap.style.marginTop = '8px';

    // GOAL bar
    const goalBar = DOC.createElement('div');
    goalBar.className = 'qbar qbar-goal';
    goalBar.innerHTML = `
      <div class="q-badge" style="min-width:56px;text-align:center;">GOAL</div>
      <div class="qbar-track"><div class="qbar-fill goal" id="qbarGoalFill"></div></div>
      <div class="qbar-timer" id="qbarGoalTxt">0/0</div>
    `;

    // MINI bar
    const miniBar = DOC.createElement('div');
    miniBar.className = 'qbar qbar-mini';
    miniBar.innerHTML = `
      <div class="q-badge mini" style="min-width:56px;text-align:center;">MINI</div>
      <div class="qbar-track"><div class="qbar-fill mini" id="qbarMiniFill"></div></div>
      <div class="qbar-timer" id="qbarMiniTxt">0/0</div>
    `;

    wrap.appendChild(goalBar);
    wrap.appendChild(miniBar);

    // Insert right before .quest-wrap if exists, else append to hudMid
    const questWrap = hudMid.querySelector('.quest-wrap');
    if (questWrap) hudMid.insertBefore(wrap, questWrap);
    else hudMid.appendChild(wrap);

    return wrap;
  }

  const qwrap = ensureQBars();
  const qbarGoalFill = DOC.getElementById('qbarGoalFill');
  const qbarMiniFill = DOC.getElementById('qbarMiniFill');
  const qbarGoalTxt  = DOC.getElementById('qbarGoalTxt');
  const qbarMiniTxt  = DOC.getElementById('qbarMiniTxt');

  // Update helper
  function setText(el, text){
    if (!el) return;
    el.textContent = String(text == null ? '' : text);
  }

  function pct(now, total){
    total = Math.max(1, total|0);
    now = clamp(now|0, 0, total);
    return (now / total) * 100;
  }

  function setFill(el, percent){
    if (!el) return;
    const p = clamp(percent, 0, 100);
    el.style.width = p.toFixed(1) + '%';
  }

  // Main listener
  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};

    const goalTitle = (d.goalTitle != null ? String(d.goalTitle) : '—');
    const goalNow   = (d.goalNow|0);
    const goalTotal = (d.goalTotal|0);

    const miniTitle = (d.miniTitle != null ? String(d.miniTitle) : '—');
    const miniNow   = (d.miniNow|0);
    const miniTotal = (d.miniTotal|0);

    const miniSecLeft = (d.miniSecLeft == null ? null : (d.miniSecLeft|0));

    // ---- text HUD ----
    setText(elGoalTitle, goalTitle);
    setText(elGoalVal, `${goalNow}/${Math.max(0,goalTotal|0)}`);

    setText(elMiniTitle, miniTitle);
    setText(elMiniVal, `${miniNow}/${Math.max(0,miniTotal|0)}`);

    // ---- bars (optional) ----
    if (qwrap){
      setFill(qbarGoalFill, pct(goalNow, goalTotal));
      setFill(qbarMiniFill, pct(miniNow, miniTotal));

      // Right text: show timer if exists, else show now/total
      if (qbarGoalTxt) qbarGoalTxt.textContent = `${goalNow}/${Math.max(0,goalTotal|0)}`;

      if (qbarMiniTxt){
        if (typeof miniSecLeft === 'number'){
          // show both: remaining sec + progress
          qbarMiniTxt.textContent = `${miniSecLeft}s • ${miniNow}/${Math.max(0,miniTotal|0)}`;

          // panic class when close to 3s
          const html = DOC.documentElement;
          if (miniSecLeft <= 3) html.classList.add('panic');
          else html.classList.remove('panic');
        } else {
          qbarMiniTxt.textContent = `${miniNow}/${Math.max(0,miniTotal|0)}`;
          DOC.documentElement.classList.remove('panic');
        }
      }
    }
  }, { passive:true });

})(window);