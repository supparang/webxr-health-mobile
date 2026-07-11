/* =========================================================
   EAP Question Four-Choice Repair v20260710
   V8 ACTIVE-VISUAL-GRID DIRECT
   - Runs only on Boss Battle Question screens, never Reason Gate.
   - Finds the smallest visible card containing "Boss Battle" + "Question N".
   - Reads the visible A/B/C/D cards by their rendered text, regardless of
     nested spans or wrapper divs.
   - When exactly one label is missing, clones a real visible choice card,
     rewrites it as the missing distractor, and forwards its click to a known
     visible wrong choice. This keeps the grid complete without touching the
     correct native answer.
   - UI safety only: no score, Sheet, evidence, unlock, or route mutation.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-EAP-FOUR-CHOICE-REPAIR-V8-ACTIVE-VISUAL-GRID-DIRECT';
  const LABELS = ['A','B','C','D'];
  let timer = null;

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function rect(el){ try { return el.getBoundingClientRect(); } catch(_) { return {width:0,height:0,top:0,left:0}; } }
  function visible(el){
    if(!el) return false;
    const r = rect(el);
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.05 && r.width > 120 && r.height > 34;
  }
  function labelOf(el){
    const m = clean(el && (el.innerText || el.textContent)).match(/^([A-D])\.\s+/i);
    return m ? m[1].toUpperCase() : '';
  }
  function area(el){ const r = rect(el); return r.width * r.height; }

  function activeQuestionPanel(){
    const root = document.getElementById('app') || document.body;
    const nodes = Array.from(root.querySelectorAll('section,article,main,.panel,.card,div'));
    const hits = nodes.filter(function(el){
      if(!visible(el)) return false;
      const t = clean(el.innerText || el.textContent);
      if(!/Boss Battle/i.test(t) || !/Question\s+\d+/i.test(t)) return false;
      if(/Reason Gate/i.test(t)) return false;
      const r = rect(el);
      return r.width > 500 && r.height > 250;
    });
    hits.sort(function(a,b){ return area(a) - area(b); });
    return hits[0] || null;
  }

  function candidateChoices(panel){
    const all = Array.from(panel.querySelectorAll('button,[role="button"],[onclick],.choice,.answer,.option,.choice-card,.answer-option,div'));
    const grouped = new Map();

    all.forEach(function(el){
      if(!visible(el)) return;
      const label = labelOf(el);
      if(!label) return;
      const t = clean(el.innerText || el.textContent);
      if(t.length < 12 || t.length > 520) return;

      const old = grouped.get(label);
      /* Prefer the smallest visible element for each label. This selects the
         actual clickable card even when wrappers repeat the same text. */
      if(!old || area(el) < area(old)) grouped.set(label, el);
    });

    return LABELS.map(function(label){ return grouped.get(label); }).filter(Boolean);
  }

  function commonGridParent(cards){
    if(!cards.length) return null;
    let p = cards[0].parentElement;
    while(p && p !== document.body){
      if(cards.every(function(card){ return p.contains(card); })){
        const directOrWrapped = Array.from(p.children || []).filter(function(ch){
          if(labelOf(ch)) return true;
          return Array.from(ch.querySelectorAll ? ch.querySelectorAll('*') : []).some(function(n){ return !!labelOf(n); });
        });
        if(directOrWrapped.length >= 3) return p;
      }
      p = p.parentElement;
    }
    return cards[0].parentElement;
  }

  function missingLabel(cards){
    const present = new Set(cards.map(labelOf));
    return LABELS.find(function(label){ return !present.has(label); }) || '';
  }

  function knownWrong(cards){
    const wrongCue = /broad answer|detail answer|list answer|example answer|topic answer|polished answer|makes a claim beyond|misses the whole|no support|not evidence-based/i;
    return cards.find(function(card){ return wrongCue.test(clean(card.innerText || card.textContent)); }) || null;
  }

  function replaceCardText(card,label){
    const message = label + '. Related answer: mentions the topic but does not connect the evidence to a justified conclusion.';
    const descendants = Array.from(card.querySelectorAll('*')).sort(function(a,b){ return area(a)-area(b); });
    const target = descendants.find(function(el){ return /^[A-D]\.\s+/.test(clean(el.textContent)); });
    if(target) target.textContent = message;
    else card.textContent = message;
  }

  function repair(){
    const panel = activeQuestionPanel();
    if(!panel) return false;

    const cards = candidateChoices(panel).filter(function(card){ return !card.dataset.eapFourChoiceRepairV8; });
    if(cards.length !== 3) return false;

    const label = missingLabel(cards);
    if(!label || panel.querySelector('[data-eap-four-choice-repair-v8="'+label+'"]')) return false;

    const grid = commonGridParent(cards);
    const wrong = knownWrong(cards);
    if(!grid || !wrong) return false;

    const template = cards[0];
    const clone = template.cloneNode(true);
    clone.removeAttribute('id');
    clone.dataset.eapFourChoiceRepairV8 = label;
    clone.dataset.eapFourChoiceRepairVersion = VERSION;
    clone.setAttribute('aria-label',label + '. Additional distractor');
    clone.style.removeProperty('display');
    clone.style.removeProperty('visibility');
    clone.style.removeProperty('opacity');
    replaceCardText(clone,label);

    clone.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      wrong.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    },true);

    const ordered = cards.slice().sort(function(a,b){ return LABELS.indexOf(labelOf(a))-LABELS.indexOf(labelOf(b)); });
    const next = ordered.find(function(card){ return LABELS.indexOf(labelOf(card)) > LABELS.indexOf(label); });
    if(next && next.parentElement === grid) grid.insertBefore(clone,next);
    else grid.appendChild(clone);

    return true;
  }

  function schedule(){ clearTimeout(timer); timer = setTimeout(repair,40); }
  function start(){
    [0,40,80,140,240,400,700,1100,1800,3000].forEach(function(ms){ setTimeout(repair,ms); });
    new MutationObserver(schedule).observe(document.getElementById('app') || document.documentElement,{childList:true,subtree:true,characterData:true});
    window.EAPFourChoiceRepair = {version:VERSION,repair:repair};
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();