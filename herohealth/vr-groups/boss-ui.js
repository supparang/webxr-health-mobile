/* === /herohealth/vr-groups/boss-ui.js ===
PACK 27: Boss Micro UI — PRODUCTION
✅ auto show when boss present (.fg-target.fg-boss)
✅ weak-state (<=35%) glow
✅ optional: listens to fx:boss / groups:progress
✅ optional: if engine emits judge payload with bossHp/bossHpMax -> updates precisely
Respects: FXPerf level (>=1)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function ensureUI(){
    let ui = DOC.querySelector('.boss-mini');
    if (ui) return ui;

    ui = DOC.createElement('div');
    ui.className = 'boss-mini';
    ui.innerHTML = `
      <div class="boss-top">
        <div class="boss-title">👾 BOSS</div>
        <div class="boss-tag" id="bossTag">HP</div>
      </div>
      <div class="boss-bar"><div class="boss-fill" id="bossFill"></div></div>
      <div class="boss-hint" id="bossHint">ยิงให้ถูกหมู่เพื่อแตกบอส</div>
    `;
    DOC.body.appendChild(ui);
    return ui;
  }

  function setUI(on){
    const ui = ensureUI();
    ui.classList.toggle('on', !!on);
  }

  function setPct(pct){
    const ui = ensureUI();
    const fill = ui.querySelector('#bossFill');
    const tag  = ui.querySelector('#bossTag');
    pct = clamp(pct, 0, 100);
    if (fill) fill.style.width = Math.round(pct) + '%';
    if (tag)  tag.textContent = 'HP ' + Math.round(pct) + '%';
    ui.classList.toggle('weak', pct <= 35);
  }

  function setHint(text){
    const ui = ensureUI();
    const hint = ui.querySelector('#bossHint');
    if (hint) hint.textContent = String(text||'');
  }

  function findBoss(){
    try{ return DOC.querySelector('.fg-target.fg-boss'); }catch{ return null; }
  }

  // Estimate HP from visual states if no direct hp:
  // - We can approximate from "weak" class: if weak -> 30%
  // - else keep last known
  let lastPct = 100;
  function updateFromDOM(){
    const boss = findBoss();
    if (!boss){
      setUI(false);
      lastPct = 100;
      return;
    }
    setUI(true);

    // If engine attaches data-hp/max, use it (optional patch)
    const hp  = Number(boss.getAttribute('data-hp'));
    const max = Number(boss.getAttribute('data-hpmax'));
    if (isFinite(hp) && isFinite(max) && max>0){
      const pct = clamp((hp/max)*100, 0, 100);
      lastPct = pct;
      setPct(pct);
      return;
    }

    // fallback: weak class hints
    const weak = boss.classList.contains('fg-boss-weak');
    if (weak){
      lastPct = Math.min(lastPct, 35);
      setPct(lastPct);
    }else{
      // keep stable (don’t jump)
      setPct(lastPct);
    }
  }

  // Mutation observe boss existence (cheap)
  const playLayer = DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  const mo = new MutationObserver(()=>{
    if (!allow(1)) return;
    updateFromDOM();
  });
  try{ mo.observe(playLayer, {childList:true, subtree:true}); }catch{}

  // Better updates if judge gives hp payload
  // Expected: hha:judge {kind:'boss', bossHp, bossHpMax} OR fx:boss {raw:{bossHp...}}
  function updateFromPayload(d){
    if (!d) return;
    const hp  = Number(d.bossHp ?? (d.raw && d.raw.bossHp));
    const max = Number(d.bossHpMax ?? (d.raw && d.raw.bossHpMax));
    if (isFinite(hp) && isFinite(max) && max>0){
      const pct = clamp((hp/max)*100, 0, 100);
      lastPct = pct;
      setUI(true);
      setPct(pct);
    }
  }

  root.addEventListener('fx:boss', (ev)=>{
    if (!allow(1)) return;
    const d = ev.detail||{};
    setUI(true);
    if (d.stage==='spawn'){
      lastPct = 100;
      setPct(100);
      setHint('บอสมาแล้ว! ยิงรัวแต่ให้ถูกหมู่ 👊');
    }
    updateFromPayload(d);
  }, {passive:true});

  root.addEventListener('fx:end', ()=>{
    if (!allow(1)) return;
    setUI(false);
    lastPct = 100;
  }, {passive:true});

  // Storm can change hint
  root.addEventListener('fx:storm', ()=>{
    if (!allow(1)) return;
    if (findBoss()) setHint('พายุ+บอส! ใจเย็น แล้วยิงให้ชัวร์ 🌪️');
  }, {passive:true});

  // initial
  if (allow(1)) updateFromDOM();

  // export
  NS.BossUI = { setPct, setUI, updateFromDOM };

})(typeof window!=='undefined' ? window : globalThis);