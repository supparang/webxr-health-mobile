/* =========================================================
   EAP Hero Answer Choice Quality Guard v20260710
   V3 BOSS-CLASH ANTI-LENGTH-BIAS
   - Does NOT reorder DOM nodes after a question is visible.
   - Preserves click handlers, scoring, pass/fail, evidence, and Sheet sync.
   - Normalizes visible choice wording in Boss Clash when distractors reveal
     bad test-taking patterns such as "choose the longest option".
   - Makes distractors plausible and similar in length so learners must use
     source evidence, not visual length.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-EAP-ANSWER-CHOICE-QUALITY-GUARD-V3-BOSS-ANTI-LENGTH-BIAS';
  const STYLE_ID = 'eap-answer-choice-quality-guard-style-v3';
  const CHOICE_CLASS = 'eap-choice-quality-tile';
  const GROUP_ATTR = 'data-eap-choice-quality-stable-key';

  const ACTION_WORDS = [
    'reading core','speaking support','writing support','listening support','mission brief','map','report','sheet',
    'ย่อแถบนี้','ขึ้นบน','กลับไป','สุ่ม scenario','scenario ใหม่','เริ่ม core','ต่อ support','boss reading','boss listening','boss writing','boss speaking'
  ];

  const PAD_PHRASES = [
    'This sounds possible, but it does not fully match the source evidence.',
    'It uses academic wording, but the evidence link is still incomplete.',
    'It mentions the topic, but the conclusion is not justified enough.',
    'It includes a detail, but it misses the limitation in the source.',
    'It looks careful, but it changes the meaning of the source.'
  ];

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function wordCount(value){ return clean(value).split(/\s+/).filter(Boolean).length; }

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
    const hasAcademic = texts.some(t => /source|evidence|main|idea|claim|summary|because|however|therefore|academic|goal|context|detail|limitation|justified|conclusion|support/i.test(t));
    const hasThaiChoice = texts.some(t => /หลักฐาน|ใจความ|ข้อสรุป|เหตุผล|คำตอบ|แหล่งข้อมูล|ข้อจำกัด/.test(t));
    return hasAcademic || hasThaiChoice || avg >= 18;
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${CHOICE_CLASS}{
        min-height:74px!important;
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
      .eap-choice-quality-note{display:none!important}
      @media(max-width:760px){.${CHOICE_CLASS}{min-height:62px!important}}
    `;
    document.head.appendChild(style);
  }

  function splitLabel(text){
    const m = clean(text).match(/^([A-D])\.\s*(.+)$/i);
    return m ? { label:m[1].toUpperCase(), body:m[2] } : { label:'', body:clean(text) };
  }

  function hasBadCue(text){
    return /(longest|first detail|without checking|one example as the main idea|no support for this conclusion|sounds complete|looks complete)/i.test(text);
  }

  function sanitizeBody(body, index){
    let s = clean(body);

    // Remove explicit test-taking cue. It teaches guessing, not reading.
    s = s.replace(/select the longest sentence only/ig, 'Choose a sentence that sounds complete');
    s = s.replace(/choose the longest answer every time/ig, 'Choose the answer that looks most complete');
    s = s.replace(/choose the first detail without checking the whole text/ig, 'Use the first detail before checking the whole text');
    s = s.replace(/treat one example as the main idea/ig, 'Treat one focused example as the whole main idea');

    // Make repeated weak distractors less obvious while keeping them incorrect.
    s = s.replace(/However, the source gives no support for this conclusion\.?/ig, 'However, the conclusion is still broader than the source evidence.');
    s = s.replace(/the source gives no support for this conclusion\.?/ig, 'the conclusion is still broader than the source evidence.');

    // If a distractor is too short or too obviously wrong, add a plausible academic-looking reason.
    if (wordCount(s) < 14 || hasBadCue(s)) {
      const pad = PAD_PHRASES[index % PAD_PHRASES.length];
      if (!s.endsWith('.')) s += '.';
      if (s.indexOf(pad) < 0 && wordCount(s) < 28) s += ' ' + pad;
    }

    return s;
  }

  function balanceVisibleWording(list){
    const raw = list.map(btn => clean(btn.textContent));
    if (!raw.some(hasBadCue)) return;

    const bodies = raw.map(splitLabel);
    const maxWords = Math.max(...bodies.map(x => wordCount(x.body)));
    bodies.forEach((item, index) => {
      let body = sanitizeBody(item.body, index);
      while (wordCount(body) < Math.max(14, maxWords - 5) && wordCount(body) < 34) {
        const pad = PAD_PHRASES[(index + wordCount(body)) % PAD_PHRASES.length];
        body += ' ' + pad;
      }
      const finalText = (item.label ? item.label + '. ' : '') + body;
      if (clean(list[index].textContent) !== finalText) {
        list[index].dataset.eapOriginalChoiceText = raw[index];
        list[index].textContent = finalText;
        list[index].dataset.eapChoiceBalanced = '1';
      }
    });
  }

  function processGroup(parent, list){
    if (!looksLikeChoices(list)) return;

    const texts = list.map(btn => clean(btn.textContent));
    const key = String(hash(texts.join('|')) + ':' + list.length);
    if (parent.getAttribute(GROUP_ATTR) === key && list.every(btn => btn.dataset.eapChoiceStable === '1')) return;

    parent.setAttribute(GROUP_ATTR, key);
    Array.from(parent.querySelectorAll(':scope > .eap-choice-quality-note')).forEach(note => note.remove());

    balanceVisibleWording(list);

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
    pending = setTimeout(apply, 120);
  }

  function start(){
    apply();
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
    window.EAPAnswerChoiceQualityGuard = {
      version: VERSION,
      stableNoReshuffle: true,
      balancesVisibleWording: true,
      neutralizesLongestOptionCue: true,
      refresh: apply
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
