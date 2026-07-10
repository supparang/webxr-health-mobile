/* =========================================================
   EAP Hero Four Choice Completer v20260710
   V1 CLASSROOM-SAFE
   - Student-facing UI safety patch for multiple-choice questions.
   - If a question renders only 3 visible answer options, add a 4th neutral
     distractor tile so the classroom screen never looks incomplete.
   - The added distractor is wired to an existing wrong option click, so it is
     selectable and safely scores as wrong. It never creates a new correct
     answer and never changes Sheet/evidence/unlock rules.
   - Observer-based; no engine rewrite.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260710-EAP-FOUR-CHOICE-COMPLETER-V1-CLASSROOM-SAFE';
  var STYLE_ID = 'eap-four-choice-completer-style-v1';
  var timer = null;

  var EXTRA_DISTRACTORS = [
    'D. Condition answer: sounds careful but misses the main idea.',
    'D. Support answer: mentions evidence but does not answer the question.',
    'D. Topic answer: stays related but does not compare the evidence clearly.',
    'D. Limit answer: gives a caution but loses the source message.'
  ];

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = '[data-eap-four-choice-added="1"]{outline:1px solid rgba(148,163,184,.35)}';
    document.head.appendChild(s);
  }
  function hash(v){
    var h=0, str=text(v);
    for(var i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0;
    return h;
  }
  function isQuestionScreen(root){
    var t=text(root && root.innerText || '');
    return /Which\s+(choice|response)|Why is your answer|Question\s+\d+|Fresh scenario/i.test(t) && /\bA\.|\bB\.|\bC\./.test(t);
  }
  function isOptionNode(el){
    if(!el || el.nodeType !== 1) return false;
    var t=text(el.innerText || el.textContent || '');
    if(!/^[A-D]\./.test(t)) return false;
    if(/Boss Battle|Session\s+\d+|Hero Contract|Choice Guard|Fresh scenario|Hint:/i.test(t)) return false;
    return t.length >= 8 && t.length <= 260;
  }
  function visible(el){
    if(!el || el.closest('[data-eap-four-choice-added="hidden-source"]')) return false;
    var st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && el.offsetParent !== null;
  }
  function candidates(scope){
    var nodes = Array.prototype.slice.call(scope.querySelectorAll('button,[role="button"],[onclick],.choice,.answer-choice,.answer-option,.option,.choice-card,.eap-choice-quality-tile'));
    return nodes.filter(function(n){ return visible(n) && isOptionNode(n); });
  }
  function groupByContainer(options){
    var map = [];
    options.forEach(function(opt){
      var c = opt.parentElement;
      for(var i=0;i<3 && c && c !== document.body;i++){
        var count = candidates(c).length;
        if(count >= 3 && count <= 4) break;
        c = c.parentElement;
      }
      if(!c) return;
      var item = map.find(function(x){ return x.container === c; });
      if(!item){ item = {container:c, options:[]}; map.push(item); }
      if(item.options.indexOf(opt) < 0) item.options.push(opt);
    });
    return map;
  }
  function pickWrongSource(list){
    return list.find(function(n){ return !/Source-based answer|Evidence-based answer|Balanced answer|Careful answer|matches the source|uses evidence/i.test(text(n.innerText || n.textContent)); }) || list[list.length-1];
  }
  function stripLeadingLabel(s){ return text(s).replace(/^[A-D]\.?\s*/,''); }
  function makeDistractorText(container){ return EXTRA_DISTRACTORS[hash(container.innerText || '') % EXTRA_DISTRACTORS.length]; }
  function addFourth(group){
    var container = group.container;
    if(container.querySelector('[data-eap-four-choice-added="1"]')) return;
    var opts = candidates(container).filter(function(n){ return !n.dataset.eapFourChoiceAdded; });
    var labels = opts.map(function(n){ return text(n.innerText || n.textContent).charAt(0).toUpperCase(); });
    if(opts.length !== 3) return;
    if(labels.indexOf('A') < 0 || labels.indexOf('B') < 0 || labels.indexOf('C') < 0 || labels.indexOf('D') >= 0) return;

    var sourceWrong = pickWrongSource(opts);
    var clone = sourceWrong.cloneNode(true);
    clone.dataset.eapFourChoiceAdded = '1';
    clone.dataset.eapChoiceLabel = 'D';
    clone.setAttribute('aria-label','D. Additional distractor option');

    var newText = makeDistractorText(container);
    var wrote = false;
    Array.prototype.slice.call(clone.querySelectorAll('*')).forEach(function(child){
      var childText = text(child.textContent || '');
      if(!wrote && /^[A-C]\./.test(childText)){
        child.textContent = newText;
        wrote = true;
      }
    });
    if(!wrote) clone.textContent = newText;

    clone.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      try{ sourceWrong.click(); }catch(_){ }
    }, true);

    container.appendChild(clone);
  }
  function run(){
    addStyle();
    var app = document.getElementById('app');
    if(!app || !isQuestionScreen(app)) return;
    var all = candidates(app);
    groupByContainer(all).forEach(addFourth);
  }
  function schedule(){ clearTimeout(timer); timer=setTimeout(run,80); }

  window.EAPFourChoiceCompleter = { version: VERSION, run: run };
  window.addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
})();