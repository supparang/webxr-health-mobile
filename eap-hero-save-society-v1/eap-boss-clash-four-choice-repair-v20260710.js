/* =========================================================
   EAP Question Four-Choice Repair v20260710
   V11 STABLE LABEL-POSITION GRID
   - Runs only on Boss Battle Question screens; never Reason Gate.
   - Restores a missing A/B/C/D choice when the engine renders only three.
   - Locks every question to A/B on row 1 and C/D on row 2.
   - Works even when the engine places cards inside different wrapper nodes.
   - Mobile uses one full-width column in A/B/C/D order.
   - Does not alter existing answer meaning, scoring, evidence, Sheet sync,
     unlock, route state, or teacher-review data.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260710-EAP-FOUR-CHOICE-REPAIR-V11-STABLE-LABEL-GRID';
  var LABELS = ['A','B','C','D'];
  var timer = null;
  var interval = null;

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function rect(el){ try { return el.getBoundingClientRect(); } catch(_) { return {width:0,height:0,top:0,left:0}; } }
  function visible(el){
    if(!el || !el.isConnected) return false;
    var r = rect(el);
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.05 && r.width > 150 && r.height > 38;
  }
  function labelOf(el){
    var m = clean(el && (el.innerText || el.textContent)).match(/^([A-D])\.\s+/i);
    return m ? m[1].toUpperCase() : '';
  }
  function area(el){ var r = rect(el); return r.width * r.height; }

  function isQuestionScreen(){
    var app = document.getElementById('app');
    var text = clean(app && app.innerText);
    return /Boss Battle/i.test(text) && /Question\s+\d+/i.test(text) && !/Reason Gate/i.test(text);
  }

  function visibleChoiceCards(){
    var app = document.getElementById('app') || document.body;
    var all = Array.from(app.querySelectorAll('button,[role="button"],[onclick],.choice,.answer,.option,.choice-card,.answer-option,div'));
    var byLabel = {};

    all.forEach(function(el){
      if(!visible(el)) return;
      var label = labelOf(el);
      if(!label) return;
      var text = clean(el.innerText || el.textContent);
      if(text.length < 12 || text.length > 520) return;
      var r = rect(el);
      if(r.top < 250) return;
      if(!byLabel[label] || area(el) < area(byLabel[label])) byLabel[label] = el;
    });

    return LABELS.map(function(label){ return byLabel[label]; }).filter(Boolean);
  }

  function lowestCommonAncestor(cards){
    if(!cards.length) return null;
    var p = cards[0].parentElement;
    while(p && p !== document.body){
      if(cards.every(function(card){ return p.contains(card); })){
        var r = rect(p);
        if(r.width > 500 && r.height < 650) return p;
      }
      p = p.parentElement;
    }
    return null;
  }

  function directChildUnder(ancestor, node){
    var child = node;
    while(child && child.parentElement !== ancestor) child = child.parentElement;
    return child && child.parentElement === ancestor ? child : null;
  }

  function missingLabel(cards){
    var present = new Set(cards.map(labelOf));
    return LABELS.find(function(label){ return !present.has(label); }) || '';
  }

  function wrongTarget(cards){
    var wrongCue = /broad answer|detail answer|list answer|example answer|topic answer|polished answer|makes a claim beyond|misses the whole|no support|not evidence-based|treats all details/i;
    return cards.find(function(card){ return wrongCue.test(clean(card.innerText || card.textContent)); }) || cards[0] || null;
  }

  function installStyle(){
    if(document.getElementById('eap-four-choice-repair-v11-style')) return;
    var style = document.createElement('style');
    style.id = 'eap-four-choice-repair-v11-style';
    style.textContent = [
      '.eap-four-choice-grid-v11{',
      'display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;',
      'grid-template-rows:repeat(2,minmax(86px,auto))!important;',
      'gap:12px!important;align-items:stretch!important;width:100%!important;',
      '}',
      '.eap-four-choice-flatten-v11{display:contents!important;}',
      '.eap-four-choice-card-v11{',
      'width:100%!important;height:100%!important;min-height:86px!important;',
      'box-sizing:border-box!important;margin:0!important;',
      'display:flex!important;align-items:center!important;justify-content:flex-start!important;',
      'visibility:visible!important;opacity:1!important;',
      'border:1px solid #d7e4f1!important;border-radius:14px!important;',
      'background:#f8fafc!important;color:#0f172a!important;',
      'padding:14px 16px!important;text-align:left!important;',
      'font:800 16px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif!important;',
      'cursor:pointer!important;position:relative!important;z-index:2!important;',
      'align-self:stretch!important;',
      '}',
      '.eap-four-choice-card-v11:hover{outline:2px solid rgba(14,165,233,.28)!important;}',
      '@media(max-width:760px){',
      '.eap-four-choice-grid-v11{grid-template-columns:1fr!important;grid-template-rows:none!important;grid-auto-rows:auto!important;gap:10px!important;}',
      '.eap-four-choice-card-v11{min-height:68px!important;height:auto!important;}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function clearOldClasses(root, cards){
    if(root){
      root.classList.remove('eap-four-choice-grid-v10');
      Array.from(root.querySelectorAll('.eap-four-choice-flatten-v11')).forEach(function(el){ el.classList.remove('eap-four-choice-flatten-v11'); });
    }
    cards.forEach(function(card){
      card.classList.remove('eap-four-choice-card-v10');
      card.style.removeProperty('grid-column');
      card.style.removeProperty('grid-row');
    });
  }

  function normalizeGrid(cards){
    if(cards.length !== 4) return false;
    var grid = lowestCommonAncestor(cards);
    if(!grid) return false;

    installStyle();
    clearOldClasses(grid, cards);
    grid.classList.add('eap-four-choice-grid-v11');
    grid.dataset.eapFourChoiceGridVersion = VERSION;

    var positions = {
      A:{col:'1',row:'1'},
      B:{col:'2',row:'1'},
      C:{col:'1',row:'2'},
      D:{col:'2',row:'2'}
    };

    cards.forEach(function(card){
      var label = labelOf(card);
      var slot = positions[label];
      var direct = directChildUnder(grid, card);

      if(direct && direct !== card){
        var choiceCount = Array.from(direct.querySelectorAll('button,[role="button"],[onclick],.choice,.answer,.option,.choice-card,.answer-option,div'))
          .filter(function(el){ return labelOf(el); }).length;
        if(choiceCount <= 1) direct.classList.add('eap-four-choice-flatten-v11');
      }

      card.classList.add('eap-four-choice-card-v11');
      card.dataset.eapFourChoiceCardVersion = VERSION;
      if(slot){
        card.style.setProperty('grid-column',slot.col,'important');
        card.style.setProperty('grid-row',slot.row,'important');
      }
    });

    return true;
  }

  function makeButton(label, wrong){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eap-four-choice-card-v11';
    btn.dataset.eapFourChoiceRepairV11 = label;
    btn.dataset.eapFourChoiceRepairVersion = VERSION;
    btn.textContent = label + '. Related answer: mentions the topic but does not connect the evidence to a justified conclusion.';
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      wrong.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }, true);
    return btn;
  }

  function repair(){
    if(!isQuestionScreen()) return false;

    var allCards = visibleChoiceCards();
    if(allCards.length === 4){
      normalizeGrid(allCards);
      document.documentElement.dataset.eapFourChoiceRepairVersion = VERSION;
      return true;
    }

    var cards = allCards.filter(function(card){ return !card.dataset.eapFourChoiceRepairV11; });
    if(cards.length !== 3) return false;

    var label = missingLabel(cards);
    if(!label) return false;

    var app = document.getElementById('app') || document.body;
    if(app.querySelector('[data-eap-four-choice-repair-v11="'+label+'"]')){
      normalizeGrid(visibleChoiceCards());
      return true;
    }

    var grid = lowestCommonAncestor(cards);
    var wrong = wrongTarget(cards);
    if(!grid || !wrong) return false;

    installStyle();
    var btn = makeButton(label, wrong);
    grid.appendChild(btn);

    var completed = visibleChoiceCards();
    normalizeGrid(completed);

    document.documentElement.dataset.eapFourChoiceRepairVersion = VERSION;
    document.documentElement.dataset.eapFourChoiceRepairLast = label;
    return true;
  }

  function schedule(){ clearTimeout(timer); timer = setTimeout(repair, 25); }
  function start(){
    [0,25,60,100,180,300,500,800,1200,2000,3500].forEach(function(ms){ setTimeout(repair,ms); });
    new MutationObserver(schedule).observe(document.getElementById('app') || document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});
    interval = setInterval(repair,250);
    window.EAPFourChoiceRepair = {version:VERSION,repair:repair,normalizeGrid:normalizeGrid};
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
