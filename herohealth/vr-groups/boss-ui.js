/* === /herohealth/vr-groups/boss-ui.js ===
PACK 34: Boss HP UI — PRODUCTION
✅ Shows boss bar when boss target exists
✅ Reads from GroupsVR.GameEngine.targets (bossHp/bossHpMax)
✅ Adds classes: boss-ui-on / boss-ui-low
✅ Emits: fx:boss-hp (optional)
Respects FXPerf (>=1)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const $  = (q)=> DOC.querySelector(q);

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function ensureUI(){
    let wrap = $('.bossUI');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'bossUI';
    wrap.innerHTML = `
      <div class="bossCard">
        <div class="bossHead">
          <div class="bossTitle">👾 BOSS</div>
          <div class="bossHpText"><span id="bossHpNow">0</span>/<span id="bossHpMax">0</span></div>
        </div>
        <div class="bossBar"><div class="bossFill" id="bossFill"></div></div>
        <div class="bossHint" id="bossHint">ยิงให้ถูกหมู่เพื่อแตกบอส!</div>
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  let lastBeatAt = 0;

  function tick(){
    if (!allow(1)) { requestAnimationFrame(tick); return; }

    const E = NS.GameEngine;
    const list = (E && Array.isArray(E.targets)) ? E.targets : [];

    let boss = null;
    for (let i=0;i<list.length;i++){
      const tg = list[i];
      if (tg && String(tg.kind||'') === 'boss'){
        boss = tg; break;
      }
    }

    const hasBoss = !!boss;
    DOC.body.classList.toggle('boss-ui-on', hasBoss);

    if (hasBoss){
      ensureUI();
      const hp = Math.max(0, Number(boss.bossHp||0));
      const mx = Math.max(1, Number(boss.bossHpMax||boss.bossHpMax||8));
      const pct = Math.max(0, Math.min(100, Math.round((hp/mx)*100)));

      const nowEl = DOC.getElementById('bossHpNow');
      const maxEl = DOC.getElementById('bossHpMax');
      const fill  = DOC.getElementById('bossFill');
      if (nowEl) nowEl.textContent = String(hp|0);
      if (maxEl) maxEl.textContent = String(mx|0);
      if (fill)  fill.style.width  = pct + '%';

      const low = (pct <= 35);
      DOC.body.classList.toggle('boss-ui-low', low);

      emit('fx:boss-hp', { hp, mx, pct });

      // subtle heartbeat/haptic when low (rate-limited)
      const t = (root.performance && performance.now) ? performance.now() : Date.now();
      if (low && t - lastBeatAt > 980){
        lastBeatAt = t;
        try{
          DOC.body.classList.add('boss-heart');
          setTimeout(()=>DOC.body.classList.remove('boss-heart'), 160);
        }catch(_){}
        if (allow(2)){
          try{ navigator.vibrate && navigator.vibrate([18,40,18]); }catch(_){}
        }
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

})(typeof window!=='undefined' ? window : globalThis);