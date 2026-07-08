/* =========================================================
   EAP Hero Answer Choice Quality Guard v20260708
   V2 STABLE / NON-INTRUSIVE
   - Does NOT move/reorder DOM nodes after a question is visible.
   - Does NOT insert a note tile inside the answer grid.
   - Keeps equal answer tile styling and A/B/C/D labels only.
   - Choice randomization must come from the question engine/item bank before render,
     not from a live MutationObserver after the learner is trying to click.
   - UI-only: does not change answer semantics, event handlers, score, pass/fail, or Sheet sync.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-ANSWER-CHOICE-QUALITY-GUARD-V2-STABLE-NO-RESHUFFLE';
  const STYLE_ID = 'eap-answer-choice-quality-guard-style-v2';
  const CHOICE_CLASS = 'eap-choice-quality-tile';
  const GROUP_ATTR = 'data-eap-choice-quality-stable-key';

  const ACTION_WORDS = [
    'reading core','speaking support','writing support','listening support','mission brief','map','report','sheet',
    'ย่อแถบนี้','ขึ้นบน','กลับไป','สุ่ม scenario','scenario ใหม่','เริ่ม core','ต่อ support','boss reading','boss listening','boss writing','boss speaking'
  ];

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }

  function hash(text){
    let h = 2166136261;
    text = String(text || '');
    for (let i=0;i<text.length;i++) {
      h ^= text.charCodeAt(i);
      h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24);
    }
    return h >>> 0;
  }

  function shouldIgnore(button){
    if (!button || button.disabled || button.offsetParent === null) return true;
    if (button.closest('#eap-classroom-map-compact-card,#eap-classroom-action-rail,#eap-session-content-brief,#eap-replay-challenge-panel')) return true;
    if (button.dataset.eapStartSkill || button.dataset.eapAction || button.dataset.cmc || button.dataset.cmcSkill || button.dataset.eapRcAction) return true;
    const text = clean(button.textContent).toLowerCase();
    if (!text || text.length < 5) return true;
    if (ACTION_WORDS.some(word => text.indexOf(word) >= 0)) return true;
    if (/^(a|b|c|d|yes|no|ok|next|back|submit|save|close)$/i.test(text)) return true;
    if (/^(เริ่ม|ต่อ|กลับ|ปิด|เปิด|บันทึก|ส่ง|ตกลง)$/i.test(text)) return true;
    return false;
  }

  function candidateParents(){
    const app = document.getElementById('app') || document.body;
    const buttons = Array.from(app.querySelectorAll('button,[role="button"]')).filter(btn => !shouldIgnore(btn));
    const parents = new Map();
    buttons.forEach(btn => {
      const parent = btn.parentElement;
      if (!parent) return;
      const list = parents.get(parent) || [];
      list.push(btn);
      parents.set(parent, list);
    });
    return Array.from(parents.entries()).filter(([parent, list]) => list.length >= 3 && list.length <= 6);
  }

  function looksLikeChoices(list){
    const texts = list.map(btn => clean(btn.textContent)).filter(Boolean);
    if (texts.length < 3) return false;
    const avg = texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
    const unique = new Set(texts.map(t => t.toLowerCase())).size;
    if (unique < texts.length) return false;
    if (avg < 10) return false;
    const hasAcademic = texts.some(t => /source|evidence|main|idea|claim|summary|because|however|therefore|academic|goal|context|detail|limitation/i.test(t));
    const hasThaiChoice = texts.some(t => /หลักฐาน|ใจความ|ข้อสรุป|เหตุผล|คำตอบ|แหล่งข้อมูล|ข้อจำกัด/.test(t));
    return hasAcademic || hasThaiChoice || avg >= 18;
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${CHOICE_CLASS}{
        min-height:56px!important;
        display:flex!important;
        align-items:center!important;
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
      .eap-choice-quality-note{display:none!important}
      @media(max-width:760px){.${CHOICE_CLASS}{min-height:52px!important}}
    `;
    document.head.appendChild(style);
  }

  function processGroup(parent, list){
    if (!looksLikeChoices(list)) return;

    const texts = list.map(btn => clean(btn.textContent));
    const key = String(hash(texts.join('|')) + ':' + list.length);

    /* Critical fix:
       We mark the rendered question as seen, but we do not reorder the DOM.
       Reordering after render was making choices move under the learner's cursor/tap. */
    parent.setAttribute(GROUP_ATTR, key);

    /* Remove old intrusive note if V1 already injected it into this grid. */
    Array.from(parent.querySelectorAll(':scope > .eap-choice-quality-note')).forEach(note => note.remove());

    list.forEach((btn, index) => {
      btn.classList.add(CHOICE_CLASS);
      btn.dataset.eapChoiceLabel = String.fromCharCode(65 + index);
      btn.title = 'Choice ' + String.fromCharCode(65 + index) + ': choose by source evidence, not answer length';
      btn.dataset.eapChoiceStable = '1';
    });
  }

  let pending = null;
  function apply(){
    injectStyle();
    candidateParents().forEach(([parent, list]) => processGroup(parent, list));
  }

  function schedule(){
    clearTimeout(pending);
    pending = setTimeout(apply, 180);
  }

  function start(){
    apply();
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
    window.EAPAnswerChoiceQualityGuard = {
      version: VERSION,
      stableNoReshuffle: true,
      refresh: apply
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();