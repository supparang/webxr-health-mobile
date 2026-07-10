/* =========================================================
   EAP Boss Clash Four-Choice Repair v20260710
   - Safety repair for Boss Clash screens only.
   - Goal: A/B/C/D must be visible every time.
   - Does NOT rewrite existing visible choices.
   - First tries to reveal a hidden choice.
   - If the engine really rendered only 3 choices, inserts one safe distractor card.
   - Keeps existing click handlers on original choices. Synthetic fallback choice
     forwards click to an existing distractor-like choice so the game remains playable.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-BOSS-CLASH-FOUR-CHOICE-REPAIR-V1';
  const STYLE_ID = 'eap-boss-clash-four-choice-repair-style';
  const LABELS = ['A','B','C','D'];
  const SAFE_TEXT = {
    A:'A. Related answer: mentions the topic, but the evidence link is incomplete.',
    B:'B. Related answer: mentions the topic, but the evidence link is incomplete.',
    C:'C. Related answer: mentions the topic, but the evidence link is incomplete.',
    D:'D. Related answer: mentions the topic, but the evidence link is incomplete.'
  };

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function app(){ return document.getElementById('app'); }
  function isBossClash(){
    const text = clean(app()?.innerText || '');
    return /Boss Battle|Hero Contract|Detail Trap Spider|Boss HP|Which balanced judgement|Which B1\+ conclusion|Which response makes/i.test(text);
  }
  function labelOf(el){
    const m = clean(el && el.textContent).match(/^([A-D])\.\s+/i);
    return m ? m[1].toUpperCase() : '';
  }
  function looksLikeChoice(el){
    const text = clean(el && el.textContent);
    if (!/^[A-D]\.\s+/.test(text)) return false;
    if (text.length < 12 || text.length > 500) return false;
    if (el.closest('#eap-classroom-map-compact-card,#eap-classroom-action-rail,#eap-session-content-brief,#eap-replay-challenge-panel')) return false;
    const childChoiceCount = Array.from(el.children || []).filter(ch => /^[A-D]\.\s+/.test(clean(ch.textContent))).length;
    return childChoiceCount === 0;
  }
  function visible(el){
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0 && el.getClientRects().length > 0;
  }
  function allChoiceNodes(){
    const root = app() || document.body;
    return Array.from(root.querySelectorAll('button,[role="button"],.choice,.answer,.option,.card,.stat,div'))
      .filter(looksLikeChoice);
  }
  function visibleChoices(){ return allChoiceNodes().filter(visible); }
  function missingLabels(list){
    const present = new Set(list.map(labelOf).filter(Boolean));
    return LABELS.filter(x => !present.has(x));
  }
  function likelyChoiceParent(list){
    const map = new Map();
    list.forEach(el => {
      const p = el.parentElement;
      if (!p) return;
      map.set(p, (map.get(p) || 0) + 1);
    });
    let best = null, count = 0;
    map.forEach((n,p) => { if (n > count) { best = p; count = n; } });
    return best;
  }
  function revealHidden(missing){
    let changed = false;
    allChoiceNodes().forEach(el => {
      const label = labelOf(el);
      if (!missing.includes(label) || visible(el)) return;
      el.style.setProperty('display','block','important');
      el.style.setProperty('visibility','visible','important');
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('position','relative','important');
      el.style.setProperty('left','auto','important');
      el.style.setProperty('top','auto','important');
      el.style.setProperty('transform','none','important');
      el.dataset.eapChoiceRepairRevealed = VERSION;
      changed = true;
    });
    return changed;
  }
  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .eap-boss-choice-repair-card{
        min-height:64px!important;
        border:1px solid rgba(148,163,184,.35)!important;
        border-radius:14px!important;
        background:rgba(248,250,252,.88)!important;
        color:#0f172a!important;
        padding:14px 16px!important;
        font-weight:800!important;
        line-height:1.35!important;
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        cursor:pointer!important;
      }
      .eap-boss-choice-repair-card:hover{outline:2px solid rgba(14,165,233,.28)!important;}
    `;
    document.head.appendChild(style);
  }
  function findForwardTarget(choices){
    return choices.find(el => /broad|detail|polished|unsupported|misses|beyond|weak|no support/i.test(clean(el.textContent))) || choices[0] || null;
  }
  function addSynthetic(missing, choices){
    if (!missing.length || choices.length < 3) return false;
    injectStyle();
    const parent = likelyChoiceParent(choices);
    if (!parent) return false;
    const already = parent.querySelector('[data-eap-choice-repair-synthetic="1"]');
    if (already) return false;
    const label = missing[0];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'eap-boss-choice-repair-card';
    el.dataset.eapChoiceRepairSynthetic = '1';
    el.dataset.eapChoiceRepairVersion = VERSION;
    el.textContent = SAFE_TEXT[label] || (label + '. Related answer: mentions the topic, but the evidence link is incomplete.');
    const forward = findForwardTarget(choices);
    el.addEventListener('click', function(){
      if (forward) forward.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window }));
    });
    parent.appendChild(el);
    return true;
  }
  function repair(){
    if (!isBossClash()) return;
    let choices = visibleChoices();
    if (choices.length >= 4 && missingLabels(choices).length === 0) return;
    let missing = missingLabels(choices);
    if (revealHidden(missing)) choices = visibleChoices();
    missing = missingLabels(choices);
    if (choices.length < 4 || missing.length) addSynthetic(missing, choices);
  }
  let timer = null;
  function schedule(){ clearTimeout(timer); timer = setTimeout(repair, 80); }
  function start(){
    repair();
    [150, 400, 900, 1600].forEach(ms => setTimeout(repair, ms));
    const root = app() || document.documentElement;
    new MutationObserver(schedule).observe(root, { childList:true, subtree:true });
    window.EAPBossClashFourChoiceRepair = { version: VERSION, repair };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
