/* === /herohealth/vr-groups/groups-hud-quest.js ===
Bind Quest UI for GroupsVR
- listens: quest:update
- renders: Goal bar + Mini bar (top center)
*/

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensure(){
    let wrap = doc.querySelector('.fg-questwrap');
    if (wrap) return wrap;

    wrap = doc.createElement('div');
    wrap.className = 'fg-questwrap';
    wrap.innerHTML = `
      <div class="fg-quest fg-goal">
        <div class="fg-qtop">
          <span class="fg-qlabel" id="fgGoalTitle">Goal</span>
          <span class="fg-qcount"><b id="fgGoalNow">0</b>/<b id="fgGoalTot">0</b></span>
        </div>
        <div class="fg-qbar"><i id="fgGoalBar"></i></div>
        <div class="fg-qdesc" id="fgGoalDesc"></div>
      </div>

      <div class="fg-quest fg-mini">
        <div class="fg-qtop">
          <span class="fg-qlabel" id="fgMiniTitle">Mini</span>
          <span class="fg-qcount"><b id="fgMiniNow">0</b>/<b id="fgMiniTot">0</b></span>
        </div>
        <div class="fg-qbar"><i id="fgMiniBar"></i></div>
        <div class="fg-qdesc" id="fgMiniDesc">—</div>
        <div class="fg-qsub" id="fgMiniSub"></div>
      </div>
    `;
    doc.body.appendChild(wrap);
    return wrap;
  }

  function setBar(barEl, now, tot){
    now = Number(now)||0;
    tot = Math.max(1, Number(tot)||1);
    const p = Math.max(0, Math.min(1, now/tot));
    barEl.style.width = (p*100).toFixed(1) + '%';
  }

  function onQuest(e){
    const d = (e && e.detail) || {};
    const goal = d.goal || {};
    const mini = d.mini || {};

    ensure();

    const $ = (id)=>doc.getElementById(id);

    if (goal.title) $('fgGoalTitle').textContent = String(goal.title);
    $('fgGoalNow').textContent = String(goal.now ?? 0);
    $('fgGoalTot').textContent = String(goal.total ?? 0);
    $('fgGoalDesc').textContent = String(goal.desc ?? '');
    setBar($('fgGoalBar'), goal.now ?? 0, goal.total ?? 1);

    if (mini.title) $('fgMiniTitle').textContent = String(mini.title);
    $('fgMiniNow').textContent = String(mini.now ?? 0);
    $('fgMiniTot').textContent = String(mini.total ?? 0);

    // mini desc/sub
    $('fgMiniDesc').textContent = (mini.title && mini.title.startsWith('Mini:')) ? String(mini.title) : String(mini.title || 'Mini');
    $('fgMiniSub').textContent =
      (Number.isFinite(Number(mini.cleared)) && Number.isFinite(Number(mini.max)))
        ? `Mini สำเร็จแล้ว ${mini.cleared}/${mini.max}`
        : '';

    setBar($('fgMiniBar'), mini.now ?? 0, mini.total ?? 1);
  }

  root.addEventListener('quest:update', onQuest);

})(typeof window !== 'undefined' ? window : globalThis);