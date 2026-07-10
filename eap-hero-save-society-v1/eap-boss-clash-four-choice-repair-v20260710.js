/* =========================================================
   EAP Boss Clash / Question Four-Choice Repair v20260710
   V5 VISUAL-CARDS-ONLY
   - Safety repair for EAP multiple-choice screens.
   - Goal: A/B/C/D must be visibly present every time.
   - This version does NOT trust hidden/offscreen DOM text.
   - It reads labels only from visible choice cards inside the active question panel.
   - If any label is missing on screen, it inserts a visible safe distractor card.
   - Synthetic choices forward click to an existing distractor-like choice so the
     game remains playable and safely wrong.
   - UI-only. Does not change scoring rules, Sheet, evidence, unlock, or teacher review.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-BOSS-CLASH-FOUR-CHOICE-REPAIR-V5-VISUAL-CARDS-ONLY';
  const STYLE_ID = 'eap-boss-clash-four-choice-repair-style-v5';
  const LABELS = ['A','B','C','D'];
  const SAFE_TEXT = {
    A:'A. Related answer: mentions the topic, but the evidence link is incomplete.',
    B:'B. Related answer: mentions the topic, but the evidence link is incomplete.',
    C:'C. Related answer: mentions the topic, but the evidence link is incomplete.',
    D:'D. Related answer: mentions the topic, but the evidence link is incomplete.'
  };

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function app(){ return document.getElementById('app'); }
  function labelOfText(t){
    const m = clean(t).match(/^([A-D])\.\s+/i);
    return m ? m[1].toUpperCase() : '';
  }
  function labelOf(el){ return labelOfText(el && (el.innerText || el.textContent)); }
  function rect(el){ try { return el.getBoundingClientRect(); } catch(_) { return {width:0,height:0,top:0,left:0}; } }
  function visible(el){
    if (!el) return false;
    const cs = getComputedStyle(el);
    const r = rect(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.05 && r.width > 80 && r.height > 35;
  }
  function isQuestionScreen(){
    const text = clean(app()?.innerText || '');
    return /Boss Battle|Hero Contract|Detail Trap Spider|Boss HP|Question\s+\d+|Fresh scenario|Which\s+(choice|response|answer)|Which balanced judgement|Which B1\+ conclusion|Which response makes|Why is your answer/i.test(text)
      && /\b[A-D]\.\s+/.test(text);
  }
  function looksLikeChoice(el){
    const t = clean(el && (el.innerText || el.textContent));
    if (!/^[A-D]\.\s+/.test(t)) return false;
    if (t.length < 12 || t.length > 520) return false;
    if (el.closest('#eap-classroom-map-compact-card,#eap-classroom-action-rail,#eap-session-content-brief,#eap-replay-challenge-panel')) return false;
    if (/Boss Battle|Session\s+\d+|Hero Contract|Choice Guard|Fresh scenario|Hint:/i.test(t)) return false;
    return true;
  }
  function allChoiceNodes(root){
    return Array.from((root || app() || document.body).querySelectorAll('button,[role="button"],[onclick],.choice,.answer,.option,.card,.stat,div'))
      .filter(looksLikeChoice);
  }
  function questionPanels(){
    const root = app() || document.body;
    return Array.from(root.querySelectorAll('section,article,.panel,.card,main,div'))
      .filter(el => {
        const t = clean(el.innerText || el.textContent || '');
        if (!/Which\s+(choice|response|answer)|Which balanced judgement|Which B1\+ conclusion|Question\s+\d+/i.test(t)) return false;
        const n = allChoiceNodes(el).filter(visible).length;
        const r = rect(el);
        return n >= 2 && r.width > 420 && r.height > 180;
      })
      .sort((a,b) => rect(a).height - rect(b).height);
  }
  function activePanel(){ return questionPanels()[0] || null; }
  function visibleChoices(panel){
    return allChoiceNodes(panel).filter(el => {
      if (!visible(el)) return false;
      const r = rect(el);
      const pr = rect(panel);
      return r.top >= pr.top - 2 && r.bottom <= pr.bottom + 8 && r.left >= pr.left - 2 && r.right <= pr.right + 8;
    });
  }
  function missingFromVisible(choices){
    const present = new Set();
    choices.forEach(el => {
      const label = labelOf(el);
      if (label) present.add(label);
    });
    return LABELS.filter(label => !present.has(label));
  }
  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .eap-boss-choice-repair-card{
        min-height:64px!important;
        border:1px solid rgba(148,163,184,.42)!important;
        border-radius:14px!important;
        background:rgba(248,250,252,.96)!important;
        color:#0f172a!important;
        padding:14px 16px!important;
        font-weight:800!important;
        line-height:1.35!important;
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        cursor:pointer!important;
        text-align:left!important;
        box-sizing:border-box!important;
      }
      .eap-boss-choice-repair-card:hover{outline:2px solid rgba(14,165,233,.28)!important;}
      .eap-boss-choice-repair-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;margin-top:12px!important;}
      @media(max-width:760px){.eap-boss-choice-repair-grid{grid-template-columns:1fr!important;}}
    `;
    document.head.appendChild(style);
  }
  function findForwardTarget(choices){
    return choices.find(el => /broad|detail|polished|unsupported|misses|beyond|weak|no support|related answer|topic answer|example answer/i.test(clean(el.innerText || el.textContent))) || choices[0] || null;
  }
  function syntheticExists(panel,label){
    return !!panel.querySelector('[data-eap-choice-repair-synthetic="1"][data-eap-choice-repair-label="'+label+'"]');
  }
  function choiceParent(panel, choices){
    if (!choices.length) return null;
    const maps = new Map();
    choices.forEach(el => {
      let p = el.parentElement;
      for (let i=0; i<5 && p && p !== panel.parentElement; i+=1) {
        const count = Array.from(p.children || []).filter(ch => looksLikeChoice(ch) && visible(ch)).length;
        if (count >= 2 && count <= 5) break;
        p = p.parentElement;
      }
      if (p) maps.set(p, (maps.get(p) || 0) + 1);
    });
    let best = null, score = 0;
    maps.forEach((n,p) => { if (n > score) { best = p; score = n; } });
    return best;
  }
  function ensureRepairGrid(panel, choices){
    let parent = choiceParent(panel, choices);
    if (parent) return parent;
    let grid = panel.querySelector('.eap-boss-choice-repair-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'eap-boss-choice-repair-grid';
      panel.appendChild(grid);
    }
    return grid;
  }
  function addSynthetic(panel, missing, choices){
    if (!missing.length) return false;
    injectStyle();
    const parent = ensureRepairGrid(panel, choices);
    if (!parent) return false;
    const forward = findForwardTarget(choices);
    let changed = false;
    missing.forEach(label => {
      if (syntheticExists(panel,label)) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'eap-boss-choice-repair-card';
      el.dataset.eapChoiceRepairSynthetic = '1';
      el.dataset.eapChoiceRepairLabel = label;
      el.dataset.eapChoiceRepairVersion = VERSION;
      el.textContent = SAFE_TEXT[label];
      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (forward) forward.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window }));
      }, true);
      parent.appendChild(el);
      changed = true;
    });
    return changed;
  }
  function repair(){
    if (!isQuestionScreen()) return;
    const panel = activePanel();
    if (!panel) return;
    const choices = visibleChoices(panel).filter(el => !el.dataset.eapChoiceRepairSynthetic);
    const missing = missingFromVisible(choices.concat(Array.from(panel.querySelectorAll('[data-eap-choice-repair-synthetic="1"]')).filter(visible)));
    if (missing.length) addSynthetic(panel, missing, choices);
  }
  let timer = null;
  function schedule(){ clearTimeout(timer); timer = setTimeout(repair, 80); }
  function start(){
    repair();
    [60,120,240,500,900,1600,2600,4200,6500,9000].forEach(ms => setTimeout(repair, ms));
    new MutationObserver(schedule).observe(app() || document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true });
    window.EAPBossClashFourChoiceRepair = { version: VERSION, repair };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();