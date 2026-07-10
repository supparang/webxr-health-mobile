/* =========================================================
   EAP Hero Answer Choice Quality Guard v20260710
   V4 FORCE-COMPACT BOSS-CLASH OPTIONS
   - Handles Boss Clash cards even when they are not <button> elements.
   - Does NOT reorder DOM nodes after a question is visible.
   - Preserves click handlers, scoring, pass/fail, evidence, and Sheet sync.
   - Rewrites visible A/B/C/D wording into compact evidence-based options.
   - Removes "longest option" and repeated "no support" patterns.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-EAP-ANSWER-CHOICE-QUALITY-GUARD-V4-FORCE-COMPACT-BOSS';
  const STYLE_ID = 'eap-answer-choice-quality-guard-style-v4';
  const CHOICE_CLASS = 'eap-choice-quality-tile';
  const GROUP_ATTR = 'data-eap-choice-quality-stable-key';

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function wordCount(value){ return clean(value).split(/\s+/).filter(Boolean).length; }
  function hash(text){
    let h = 2166136261;
    text = String(text || '');
    for (let i=0;i<text.length;i++) { h ^= text.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
    return h >>> 0;
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${CHOICE_CLASS}{
        min-height:70px!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        text-align:left!important;
        line-height:1.32!important;
        gap:8px!important;
      }
      .${CHOICE_CLASS}::before{
        content:attr(data-eap-choice-label);
        flex:0 0 auto;
        width:24px;height:24px;border-radius:999px;
        display:inline-flex;align-items:center;justify-content:center;
        background:rgba(15,118,110,.12);color:#0f766e;font-weight:950;font-size:12px;
      }
      @media(max-width:760px){.${CHOICE_CLASS}{min-height:58px!important}}
    `;
    document.head.appendChild(style);
  }

  function splitLabel(text){
    const m = clean(text).match(/^([A-D])\.\s*(.+)$/i);
    return m ? {label:m[1].toUpperCase(), body:m[2]} : {label:'', body:clean(text)};
  }

  function classify(body){
    const t = clean(body).toLowerCase();
    if (/scenario gives one focused example|broader conclusion would need more evidence|not a full study|limitation/.test(t)) return 'correct';
    if (/first detail|without checking|early detail/.test(t)) return 'detail';
    if (/one example as the main idea|whole main idea/.test(t)) return 'example';
    if (/longest|polished|sounds complete|looks complete/.test(t)) return 'polished';
    if (/every detail|equally important/.test(t)) return 'equal';
    if (/no support|unsupported|broader than/.test(t)) return 'unsupported';
    return 'other';
  }

  const SHORT = {
    correct: 'Supported, but limited: one focused example, not a broad conclusion.',
    detail: 'Detail-only answer: uses one detail but misses the whole message.',
    example: 'Example-only answer: treats one example as the full main idea.',
    polished: 'Polished-looking answer: sounds complete but is not source-based.',
    equal: 'List-style answer: treats all details as equally important.',
    unsupported: 'Unsupported answer: goes beyond what the source evidence shows.',
    other: 'Plausible answer: sounds relevant but needs closer source evidence.'
  };

  function compactText(original, index){
    const p = splitLabel(original);
    const kind = classify(p.body);
    const label = p.label || String.fromCharCode(65 + index);
    return label + '. ' + SHORT[kind];
  }

  function hasBossPattern(text){
    return /(longest|first detail|one example as the main idea|no support for this conclusion|scenario gives one focused example|broader conclusion would need more evidence|not a full study|whole main idea|equally important)/i.test(text);
  }

  function visibleChoiceElements(){
    const app = document.getElementById('app') || document.body;
    const all = Array.from(app.querySelectorAll('button,[role="button"],.choice,.answer,.option,.card,.stat,div'));
    return all.filter(el => {
      if (!el || el.offsetParent === null) return false;
      if (el.closest('#eap-classroom-map-compact-card,#eap-classroom-action-rail,#eap-session-content-brief,#eap-replay-challenge-panel')) return false;
      const t = clean(el.textContent);
      if (!/^[A-D]\.\s+/.test(t)) return false;
      if (t.length < 18 || t.length > 520) return false;
      // Avoid parent containers that contain multiple choices.
      const childChoices = Array.from(el.children || []).filter(ch => /^[A-D]\.\s+/.test(clean(ch.textContent))).length;
      if (childChoices > 1) return false;
      return /source|evidence|main idea|detail|conclusion|limitation|support|scenario|text/i.test(t);
    });
  }

  function groupedChoices(){
    const els = visibleChoiceElements();
    const byParent = new Map();
    els.forEach(el => {
      const p = el.parentElement;
      if (!p) return;
      const list = byParent.get(p) || [];
      list.push(el);
      byParent.set(p, list);
    });
    return Array.from(byParent.entries())
      .map(([parent, list]) => [parent, list.sort((a,b) => clean(a.textContent).localeCompare(clean(b.textContent)))])
      .filter(([parent, list]) => list.length >= 3 && list.length <= 4);
  }

  function processGroup(parent, list){
    const raw = list.map(el => clean(el.textContent));
    if (!raw.some(hasBossPattern)) return;
    const key = String(hash(raw.join('|')) + ':' + list.length + ':v4');
    if (parent.getAttribute(GROUP_ATTR) === key && list.every(el => el.dataset.eapChoiceCompact === '1')) return;
    parent.setAttribute(GROUP_ATTR, key);

    list.forEach((el, index) => {
      const original = clean(el.textContent);
      const next = compactText(original, index);
      el.dataset.eapOriginalChoiceText = original;
      el.dataset.eapChoiceCompact = '1';
      el.textContent = next;
      el.classList.add(CHOICE_CLASS);
      el.dataset.eapChoiceLabel = splitLabel(next).label || String.fromCharCode(65 + index);
      el.title = 'Choose by source evidence, not answer length';
    });
  }

  function processButtonGroups(){
    // Backward-compatible path for real buttons.
    const app = document.getElementById('app') || document.body;
    const buttons = Array.from(app.querySelectorAll('button,[role="button"]')).filter(btn => /^[A-D]\.\s+/.test(clean(btn.textContent)));
    const parents = new Map();
    buttons.forEach(btn => {
      const p = btn.parentElement;
      const list = parents.get(p) || [];
      list.push(btn);
      parents.set(p, list);
    });
    Array.from(parents.entries()).filter(([p,list]) => list.length >= 3 && list.length <= 4).forEach(([p,list]) => processGroup(p,list));
  }

  let pending = null;
  function apply(){
    injectStyle();
    groupedChoices().forEach(([parent, list]) => processGroup(parent, list));
    processButtonGroups();
  }

  function schedule(){
    clearTimeout(pending);
    pending = setTimeout(apply, 80);
  }

  function start(){
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 900);
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    window.EAPAnswerChoiceQualityGuard = {
      version: VERSION,
      forceCompactBossClash: true,
      stableNoReshuffle: true,
      refresh: apply
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
