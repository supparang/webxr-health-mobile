/* =========================================================
   EAP Question Four-Choice Repair v20260710
   V6 DETERMINISTIC VISIBLE-OPTION GRID
   - Guarantees A/B/C/D on every active EAP multiple-choice screen.
   - Reads only the three visible answer cards inside the active question panel.
   - Finds the missing label, then inserts one visible distractor card into the
     same grid. The synthetic distractor forwards to an existing wrong answer.
   - Never changes the existing correct answer, scoring logic, Sheet, evidence,
     unlock, teacher review, or route state.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-EAP-FOUR-CHOICE-REPAIR-V6-DETERMINISTIC-GRID';
  const STYLE_ID = 'eap-four-choice-repair-style-v6';
  const LABELS = ['A','B','C','D'];

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function labelOf(el){
    const m = clean(el && (el.innerText || el.textContent)).match(/^([A-D])\.\s+/i);
    return m ? m[1].toUpperCase() : '';
  }
  function visible(el){
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.05 && r.width > 120 && r.height > 40;
  }
  function looksLikeChoice(el){
    const t = clean(el && (el.innerText || el.textContent));
    if (!/^[A-D]\.\s+/.test(t)) return false;
    if (t.length < 12 || t.length > 520) return false;
    if (/Boss Battle|Session\s+\d+|Hero Contract|Fresh scenario|Choice Guard/i.test(t)) return false;
    return true;
  }
  function activeQuestionPanel(){
    const root = document.getElementById('app') || document.body;
    const candidates = Array.from(root.querySelectorAll('section,article,.panel,.card,main,div')).filter(el => {
      if (!visible(el)) return false;
      const t = clean(el.innerText || el.textContent);
      if (!/Question\s+\d+|Which\s+(choice|response|answer)|Which balanced judgement|Which B1\+ conclusion|Why is your answer/i.test(t)) return false;
      const choices = visibleChoiceCards(el);
      return choices.length >= 2 && choices.length <= 4;
    });
    candidates.sort((a,b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height);
    return candidates[0] || null;
  }
  function visibleChoiceCards(root){
    const all = Array.from((root || document).querySelectorAll('button,[role="button"],[onclick],.choice,.answer,.option,.choice-card,.answer-option,div'));
    const out = [];
    const seen = new Set();
    all.forEach(el => {
      if (!visible(el) || !looksLikeChoice(el)) return;
      const label = labelOf(el);
      if (!label || seen.has(label)) return;
      const childChoice = Array.from(el.children || []).some(ch => looksLikeChoice(ch));
      if (childChoice) return;
      seen.add(label);
      out.push(el);
    });
    return out;
  }
  function commonParent(nodes){
    if (!nodes.length) return null;
    let p = nodes[0].parentElement;
    while (p && p !== document.body) {
      if (nodes.every(n => p.contains(n))) return p;
      p = p.parentElement;
    }
    return nodes[0].parentElement;
  }
  function wrongTarget(choices){
    return choices.find(el => /broad answer|detail answer|polished answer|topic answer|misses|beyond the evidence|no support|incomplete/i.test(clean(el.innerText || el.textContent))) || choices[0] || null;
  }
  function missingLabel(choices){
    const present = new Set(choices.map(labelOf));
    return LABELS.find(x => !present.has(x)) || '';
  }
  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .eap-four-choice-repair-v6{
        min-height:64px!important;border:1px solid #d7e4f1!important;border-radius:14px!important;
        background:#f8fafc!important;color:#0f172a!important;padding:14px 16px!important;
        font-weight:800!important;line-height:1.35!important;text-align:left!important;
        display:block!important;visibility:visible!important;opacity:1!important;cursor:pointer!important;
        box-sizing:border-box!important;width:100%!important;
      }
      .eap-four-choice-repair-v6:hover{outline:2px solid rgba(14,165,233,.28)!important;}
    `;
    document.head.appendChild(s);
  }
  function distractorText(label){
    return label + '. Related answer: mentions the topic but does not fully connect the evidence to the conclusion.';
  }
  function repair(){
    const panel = activeQuestionPanel();
    if (!panel) return;

    const choices = visibleChoiceCards(panel).filter(el => !el.dataset.eapFourChoiceRepairV6);
    if (choices.length !== 3) return;

    const label = missingLabel(choices);
    if (!label) return;
    if (panel.querySelector('[data-eap-four-choice-repair-v6="'+label+'"]')) return;

    const parent = commonParent(choices);
    const forward = wrongTarget(choices);
    if (!parent || !forward) return;

    addStyle();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eap-four-choice-repair-v6';
    btn.dataset.eapFourChoiceRepairV6 = label;
    btn.dataset.eapFourChoiceRepairVersion = VERSION;
    btn.textContent = distractorText(label);
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      forward.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true,view:window}));
    }, true);

    parent.appendChild(btn);
  }

  let timer = null;
  function schedule(){ clearTimeout(timer); timer = setTimeout(repair, 60); }
  function start(){
    [0,80,180,350,700,1200,2200,4000].forEach(ms => setTimeout(repair, ms));
    new MutationObserver(schedule).observe(document.getElementById('app') || document.documentElement, {
      childList:true, subtree:true, characterData:true
    });
    window.EAPFourChoiceRepair = { version: VERSION, repair: repair };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();