/* =========================================================
   EAP Question Four-Choice Repair v20260710
   V7 GEOMETRY-BASED ACTIVE GRID
   - Final classroom safety layer for the authored Gold question engine.
   - Runs only on the active Boss Battle question card, never on Reason Gate.
   - Reads the three visible native answer cards by geometry and label.
   - Inserts exactly one missing A/B/C/D distractor into the same grid.
   - The added option forwards to a known visible distractor, so it is safely wrong.
   - Does not alter the existing correct answer, score model, Sheet, evidence,
     unlock, teacher review, route state, or authored source data.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-EAP-FOUR-CHOICE-REPAIR-V7-GEOMETRY-ACTIVE-GRID';
  const STYLE_ID = 'eap-four-choice-repair-style-v7';
  const LABELS = ['A','B','C','D'];

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function rect(el){ try { return el.getBoundingClientRect(); } catch(_) { return {width:0,height:0,top:0,left:0}; } }
  function visible(el){
    if(!el) return false;
    const r = rect(el);
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.05 && r.width > 180 && r.height > 38;
  }
  function labelOf(el){
    const m = clean(el && (el.innerText || el.textContent)).match(/^([A-D])\.\s+/i);
    return m ? m[1].toUpperCase() : '';
  }
  function leafChoice(el){
    if(!visible(el)) return false;
    const t = clean(el.innerText || el.textContent);
    if(!/^[A-D]\.\s+/.test(t) || t.length < 12 || t.length > 520) return false;
    const nested = Array.from(el.children || []).some(ch => /^[A-D]\.\s+/.test(clean(ch.innerText || ch.textContent)));
    return !nested;
  }
  function activeBattleCard(){
    const root = document.getElementById('app') || document.body;
    const nodes = Array.from(root.querySelectorAll('section,article,main,.panel,.card,div'));
    const matches = nodes.filter(el => {
      if(!visible(el)) return false;
      const t = clean(el.innerText || el.textContent);
      if(!/Boss Battle/i.test(t) || !/Question\s+\d+/i.test(t)) return false;
      if(/Reason Gate/i.test(t) && !/Boss Battle/i.test(t)) return false;
      const count = choiceCards(el).length;
      return count >= 2 && count <= 4;
    });
    matches.sort((a,b) => rect(a).height - rect(b).height);
    return matches[0] || null;
  }
  function choiceCards(scope){
    const selectors = 'button,[role="button"],[onclick],.choice,.answer,.option,.choice-card,.answer-option,div';
    const all = Array.from((scope || document).querySelectorAll(selectors));
    const byLabel = new Map();
    all.forEach(el => {
      if(!leafChoice(el)) return;
      const label = labelOf(el);
      if(!label) return;
      const r = rect(el);
      const old = byLabel.get(label);
      if(!old || (r.width * r.height) < (rect(old).width * rect(old).height)) byLabel.set(label, el);
    });
    return Array.from(byLabel.values());
  }
  function lowestCommonParent(nodes){
    if(!nodes.length) return null;
    let p = nodes[0].parentElement;
    while(p && p !== document.body){
      if(nodes.every(n => p.contains(n))) {
        const childrenWithChoice = Array.from(p.children || []).filter(ch => leafChoice(ch) || ch.querySelector && Array.from(ch.querySelectorAll('*')).some(leafChoice));
        if(childrenWithChoice.length >= 2) return p;
      }
      p = p.parentElement;
    }
    return nodes[0].parentElement;
  }
  function missingLabel(choices){
    const present = new Set(choices.map(labelOf));
    return LABELS.find(label => !present.has(label)) || '';
  }
  function wrongTarget(choices){
    const bad = /broad answer|detail answer|list answer|example answer|topic answer|polished answer|misses|beyond the evidence|no support|not evidence-based/i;
    return choices.find(el => bad.test(clean(el.innerText || el.textContent))) || choices.find(el => !/evidence-based|source-based|balanced answer|careful answer/i.test(clean(el.innerText || el.textContent))) || null;
  }
  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .eap-four-choice-repair-v7{
        min-height:64px!important;
        width:100%!important;
        box-sizing:border-box!important;
        border:1px solid #d7e4f1!important;
        border-radius:14px!important;
        background:#f8fafc!important;
        color:#0f172a!important;
        padding:14px 16px!important;
        font:800 16px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif!important;
        text-align:left!important;
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        cursor:pointer!important;
      }
      .eap-four-choice-repair-v7:hover{outline:2px solid rgba(14,165,233,.28)!important;}
    `;
    document.head.appendChild(s);
  }
  function distractorText(label){
    const text = {
      A:'A. Related answer: mentions the topic but does not connect the evidence to a justified conclusion.',
      B:'B. Related answer: mentions the topic but does not connect the evidence to a justified conclusion.',
      C:'C. Related answer: mentions the topic but does not connect the evidence to a justified conclusion.',
      D:'D. Related answer: mentions the topic but does not connect the evidence to a justified conclusion.'
    };
    return text[label];
  }
  function repair(){
    const panel = activeBattleCard();
    if(!panel) return false;
    if(/Reason Gate/i.test(clean(panel.innerText || panel.textContent))) return false;

    const choices = choiceCards(panel).filter(el => !el.dataset.eapFourChoiceRepairV7);
    if(choices.length !== 3) return false;

    const label = missingLabel(choices);
    if(!label || panel.querySelector('[data-eap-four-choice-repair-v7="'+label+'"]')) return false;

    const parent = lowestCommonParent(choices);
    const forward = wrongTarget(choices);
    if(!parent || !forward) return false;

    addStyle();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eap-four-choice-repair-v7';
    btn.dataset.eapFourChoiceRepairV7 = label;
    btn.dataset.eapFourChoiceRepairVersion = VERSION;
    btn.textContent = distractorText(label);
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      forward.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }, true);

    const ordered = choices.slice().sort((a,b) => LABELS.indexOf(labelOf(a)) - LABELS.indexOf(labelOf(b)));
    const next = ordered.find(el => LABELS.indexOf(labelOf(el)) > LABELS.indexOf(label));
    if(next && next.parentElement === parent) parent.insertBefore(btn,next);
    else parent.appendChild(btn);
    return true;
  }

  let timer = null;
  function schedule(){ clearTimeout(timer); timer = setTimeout(repair,50); }
  function start(){
    [0,60,120,250,500,900,1500,2500,4000].forEach(ms => setTimeout(repair,ms));
    new MutationObserver(schedule).observe(document.getElementById('app') || document.documentElement,{childList:true,subtree:true,characterData:true});
    window.EAPFourChoiceRepair = {version:VERSION,repair:repair};
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();