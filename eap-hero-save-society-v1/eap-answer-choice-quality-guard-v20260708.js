/* =========================================================
   EAP Hero Answer Choice Quality Guard v20260710
   V5 DIRECT-CARD COMPACT BOSS CLASH
   - Handles every visible A/B/C/D Boss Clash card individually.
   - Does NOT reorder DOM nodes after a question is visible.
   - Preserves click handlers, scoring, pass/fail, evidence, and Sheet sync.
   - Removes long-correct visual bias by shortening the correct evidence option too.
   - Repairs the follow-up justification screen so options are distinct, not repeated.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-EAP-ANSWER-CHOICE-QUALITY-GUARD-V5-DIRECT-CARD-COMPACT';
  const STYLE_ID = 'eap-answer-choice-quality-guard-style-v5';
  const CHOICE_CLASS = 'eap-choice-quality-tile';

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }

  function splitLabel(text){
    const m = clean(text).match(/^([A-D])\.\s*(.+)$/i);
    return m ? {label:m[1].toUpperCase(), body:m[2]} : {label:'', body:clean(text)};
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${CHOICE_CLASS}{
        min-height:64px!important;
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

  function kind(body){
    const t = clean(body).toLowerCase();
    if (/scenario gives one focused example|broader conclusion would need more evidence|not a full study|supported, but limited|limited: one focused example/.test(t)) return 'correct';
    if (/first detail|without checking|use the first detail|early detail|detail-only/.test(t)) return 'detail';
    if (/one example as the main idea|whole main idea|one focused example as the whole|example-only/.test(t)) return 'example';
    if (/longest|polished|sounds complete|looks complete|polished-looking/.test(t)) return 'polished';
    if (/every detail|equally important|list-style/.test(t)) return 'equal';
    if (/plausible answer|needs closer source evidence/.test(t)) return 'plausible';
    if (/no support|unsupported|broader than|goes beyond/.test(t)) return 'unsupported';
    return 'other';
  }

  const MAIN = {
    correct: 'Supported but limited: one example, not a broad claim.',
    detail: 'Detail only: uses a detail but misses the whole message.',
    example: 'Example only: treats one example as the main idea.',
    polished: 'Polished but weak: sounds complete, not source-based.',
    equal: 'List only: treats all details as equally important.',
    unsupported: 'Too broad: goes beyond what the source shows.',
    plausible: 'Relevant but weak: needs closer source evidence.',
    other: 'Plausible but weak: check the source evidence again.'
  };

  const JUSTIFY = [
    'It matches both the source evidence and the limitation.',
    'It sounds polished, but it does not prove the claim.',
    'It repeats a detail, but misses the source condition.',
    'It is related to the topic, but the evidence link is weak.'
  ];

  function isBossClashContext(){
    const appText = clean(document.getElementById('app')?.innerText || '');
    return /Boss Battle|Detail Trap Spider|Reason Gate|Justify your strike|Why is your answer academically correct|Fresh scenario|option order rotates/i.test(appText);
  }

  function shouldCompact(text){
    return /scenario gives one focused example|broader conclusion|not a full study|no support for this conclusion|longest|first detail|one example as the main idea|whole main idea|plausible answer|needs closer source evidence|polished-looking answer/i.test(text);
  }

  function isChoiceLeaf(el){
    const text = clean(el.textContent);
    if (!/^[A-D]\.\s+/.test(text)) return false;
    if (text.length < 12 || text.length > 600) return false;
    if (el.closest('#eap-classroom-map-compact-card,#eap-classroom-action-rail,#eap-session-content-brief,#eap-replay-challenge-panel')) return false;
    // Avoid parent containers that include several A/B/C/D choices.
    const childChoiceCount = Array.from(el.children || []).filter(ch => /^[A-D]\.\s+/.test(clean(ch.textContent))).length;
    if (childChoiceCount > 0) return false;
    return /source|evidence|main idea|detail|conclusion|limitation|support|scenario|answer|claim|text|condition|topic/i.test(text);
  }

  function compactChoiceText(text, visualIndex){
    const p = splitLabel(text);
    const label = p.label || String.fromCharCode(65 + visualIndex);
    const appText = clean(document.getElementById('app')?.innerText || '');
    if (/Why is your answer academically correct|Justify your strike/i.test(appText)) {
      return label + '. ' + JUSTIFY[visualIndex % JUSTIFY.length];
    }
    return label + '. ' + MAIN[kind(p.body)];
  }

  function visibleChoiceCards(){
    const app = document.getElementById('app') || document.body;
    const els = Array.from(app.querySelectorAll('button,[role="button"],.choice,.answer,.option,.card,.stat,div'));
    return els.filter(el => el && el.offsetParent !== null && isChoiceLeaf(el));
  }

  function apply(){
    injectStyle();
    if (!isBossClashContext()) return;

    const cards = visibleChoiceCards();
    cards.forEach((el, index) => {
      const current = clean(el.textContent);
      if (!shouldCompact(current) && el.dataset.eapChoiceCompactV5 === '1') return;
      if (!shouldCompact(current) && !/Why is your answer academically correct|Justify your strike/i.test(clean(document.getElementById('app')?.innerText || ''))) return;

      const original = el.dataset.eapOriginalChoiceText || current;
      const p = splitLabel(original);
      const label = p.label || splitLabel(current).label || String.fromCharCode(65 + index);
      const visualIndex = Math.max(0, label.charCodeAt(0) - 65);
      const next = compactChoiceText(original, visualIndex);

      if (current !== next) {
        el.dataset.eapOriginalChoiceText = original;
        el.textContent = next;
      }
      el.dataset.eapChoiceCompactV5 = '1';
      el.classList.add(CHOICE_CLASS);
      el.dataset.eapChoiceLabel = label;
      el.title = 'Choose by source evidence, not answer length';
    });
  }

  let pending = null;
  function schedule(){
    clearTimeout(pending);
    pending = setTimeout(apply, 60);
  }

  function start(){
    apply();
    [120, 300, 700, 1200, 2000].forEach(ms => setTimeout(apply, ms));
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    window.EAPAnswerChoiceQualityGuard = {
      version: VERSION,
      directCardCompact: true,
      stableNoReshuffle: true,
      refresh: apply
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
