/* =========================================================
   EAP Hero Answer Choice Quality Guard v20260708
   - Prevents classroom-visible choice patterns from becoming too easy.
   - Shuffles visible answer-choice buttons once per question render.
   - Equalizes answer tiles and flags length-cue risk.
   - Does not change answer semantics, event handlers, score, pass/fail, or Sheet sync.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-ANSWER-CHOICE-QUALITY-GUARD-V1';
  const STYLE_ID = 'eap-answer-choice-quality-guard-style';
  const NOTE_CLASS = 'eap-choice-quality-note';
  const CHOICE_CLASS = 'eap-choice-quality-tile';
  const GROUP_ATTR = 'data-eap-choice-quality-key';

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

  function rng(seed){
    let s = seed >>> 0;
    return function(){
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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
      .${NOTE_CLASS}{
        margin:8px 0 7px;padding:8px 10px;border-radius:12px;
        background:#eff6ff;border:1px solid #bfdbfe;color:#17375e;
        font-family:Arial,'Noto Sans Thai',sans-serif;font-size:12px;font-weight:850;line-height:1.35;
      }
      .${NOTE_CLASS}.warn{background:#fff7ed;border-color:#fed7aa;color:#7c2d12}
      @media(max-width:760px){.${CHOICE_CLASS}{min-height:52px!important}.${NOTE_CLASS}{font-size:11px;padding:7px 9px}}
    `;
    document.head.appendChild(style);
  }

  function shuffleExisting(parent, list, key){
    const r = rng(hash(key));
    const sorted = list.map((node, index) => ({ node, index, sort:r() }))
      .sort((a,b) => a.sort - b.sort)
      .map(item => item.node);
    sorted.forEach(node => parent.appendChild(node));
    return sorted;
  }

  function lengthRisk(texts){
    const lengths = texts.map(t => clean(t).length);
    const max = Math.max.apply(null, lengths);
    const min = Math.min.apply(null, lengths);
    const avg = lengths.reduce((a,b)=>a+b,0) / Math.max(1, lengths.length);
    return { max, min, avg, risky: max >= Math.max(38, min * 1.65, avg * 1.45) };
  }

  function addNote(parent, risky){
    let note = parent.querySelector(':scope > .' + NOTE_CLASS);
    if (!note) {
      note = document.createElement('div');
      note.className = NOTE_CLASS;
      parent.insertBefore(note, parent.firstChild);
    }
    note.classList.toggle('warn', !!risky);
    note.textContent = risky
      ? '⚠️ Choice Guard: ตัวเลือกถูกสุ่มลำดับและปรับขนาดแล้ว อย่าเดาจากข้อที่ยาวที่สุด ให้เลือกจาก evidence ใน source เท่านั้น'
      : '✅ Choice Guard: ตัวเลือกถูกสุ่มลำดับแล้ว ให้ยึด evidence ไม่ใช่ตำแหน่งหรือความยาวของคำตอบ';
  }

  function processGroup(parent, list){
    if (!looksLikeChoices(list)) return;
    const texts = list.map(btn => clean(btn.textContent));
    const key = hash(texts.join('|')) + ':' + list.length;
    if (parent.getAttribute(GROUP_ATTR) !== String(key)) {
      parent.setAttribute(GROUP_ATTR, String(key));
      list = shuffleExisting(parent, list, String(key));
    }
    const risk = lengthRisk(texts);
    addNote(parent, risk.risky);
    Array.from(parent.querySelectorAll('button,[role="button"]'))
      .filter(btn => !shouldIgnore(btn))
      .forEach((btn, index) => {
        btn.classList.add(CHOICE_CLASS);
        btn.dataset.eapChoiceLabel = String.fromCharCode(65 + index);
        btn.title = 'Choice ' + String.fromCharCode(65 + index) + ': choose by source evidence, not answer length';
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
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    window.EAPAnswerChoiceQualityGuard = { version:VERSION, refresh:apply };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();