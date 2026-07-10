/* CSAI2601 UX Quest • All-node Choice Fairness Guard v1
   Scope: W1-W15 and B1-B4.
   Goal: remove visual spoilers from answer choices before students answer:
   - no unusually long correct option
   - no one-option-only artifact/decision-chain clue
   - no subtext clue stack inside choices
   - reason/evidence stays in Reason Check after the choice
*/
(() => {
  'use strict';

  const VERSION = 'v20260709-all-node-choice-fairness-v1';
  const NODE_RE = /^(W(?:[1-9]|1[0-5])|B[1-4])$/i;
  const qs = new URLSearchParams(location.search);
  const NODE = String(qs.get('node') || qs.get('id') || 'W1').toUpperCase();
  if (!NODE_RE.test(NODE)) return;

  const THRESHOLD_LONG = 68;
  const THRESHOLD_RATIO = 1.45;
  const CLUE_TERMS = [
    'artifact','decision chain','chain','หลักฐาน','evidence','ส่งต่อ','Visual Style Guide','style guide',
    'ถูกต้องที่สุด','ดีที่สุด','ครบถ้วน','ตรงกับ','ครอบคลุม','พิสูจน์','proof','เชื่อมกับ','โยงกับ',
    'ตาม goal','ตาม context','task outcome','task success','user goal','human review','citation',
    'accessibility','contrast','typography','spacing','color token','status meaning'
  ];

  const CONCEPTS = [
    [/friction|ติดขัด|สะดุด|ทำงานหลัก/i, 'ชี้จุดติดขัดจาก task'],
    [/goal|เป้าหมาย/i, 'จับเป้าหมายผู้ใช้จริง'],
    [/impact|ผลกระทบ|สำเร็จ/i, 'แยกผลกระทบต่อ task'],
    [/fix|แก้|ปรับ/i, 'เลือกแนวแก้ที่วัดได้'],
    [/proof|test|ทดสอบ|วัด/i, 'วัดผลหลังปรับจริง'],
    [/evidence|หลักฐาน|สัมภาษณ์|สังเกต/i, 'ใช้หลักฐานจากผู้ใช้'],
    [/HCD|human|persona/i, 'ยึดผู้ใช้ก่อนออกแบบ'],
    [/assumption|สมมติฐาน/i, 'แยกสมมติฐานออก'],
    [/cognitive|load|ภาระคิด/i, 'ลดภาระการคิด'],
    [/feedback|ตอบกลับ/i, 'ให้ feedback ชัดเจน'],
    [/prevention|ป้องกัน/i, 'ป้องกันข้อผิดพลาด'],
    [/flow|ขั้นตอน|ลำดับ/i, 'จัด flow ตามงานหลัก'],
    [/wireframe|layout|grid|card/i, 'จัด layout ตาม priority'],
    [/CTA|ปุ่ม|action/i, 'วาง CTA ตามเป้าหมาย'],
    [/responsive|mobile|touch/i, 'ปรับ mobile ให้แตะง่าย'],
    [/pattern|component|state/i, 'ใช้ pattern สม่ำเสมอ'],
    [/color|status|token/i, 'กำหนดสีตามสถานะ'],
    [/typography|font|heading/i, 'จัด hierarchy ตัวอักษร'],
    [/contrast|readability|อ่าน/i, 'เพิ่ม contrast ให้อ่านได้'],
    [/spacing|ระยะห่าง|white space/i, 'ตั้ง spacing ให้ช่วยอ่าน'],
    [/prototype|link|interaction/i, 'เชื่อม prototype ตาม task'],
    [/evaluation|severity|retest/i, 'จัดลำดับปัญหาจากผลกระทบ'],
    [/portfolio|defense|rationale/i, 'อธิบายเหตุผลด้วยหลักฐาน'],
    [/RAG|citation|retrieval|source/i, 'ตรวจแหล่งอ้างอิงก่อนใช้'],
  ];

  const BAD_PATTERNS = [
    [/สวย|ทันสมัย|ชอบ|น่าสนใจ|สีสด|animation|อนิเมชัน/i, 'ยึดความสวยก่อนงานจริง'],
    [/ยาว|อธิบาย|ทุกหน้า|ทุกจุด|ทั้งหมด|เยอะ/i, 'เพิ่มข้อมูลมากขึ้นก่อน'],
    [/ไม่ต้อง|ข้าม|ไม่ตรวจ|เดา|ตามใจ/i, 'ข้ามการตรวจหลักฐาน'],
    [/ทีม|สะดวก|เร็วที่สุด|ทำง่าย/i, 'เลือกตามความสะดวกทีม'],
    [/รอ|ท้าย|หลังสุด/i, 'เลื่อนไปจัดการภายหลัง'],
    [/mockup|ชอบภาพ|โหวต|ความชอบ/i, 'ตัดสินจากความชอบ'],
    [/เก่า|เดิม|เหมือนเดิม/i, 'ใช้แบบเดิมโดยไม่ตรวจ'],
  ];

  const FALLBACKS = {
    W1: ['ชี้ปัญหาจากพฤติกรรม', 'ดูผลต่อ task หลัก', 'เลือกแนวแก้ที่วัดได้', 'ตรวจผลหลังปรับ'],
    W2: ['จัด evidence ตามลำดับ', 'แยก assumption ออก', 'ถามผู้ใช้ให้ตรงประเด็น', 'สรุป insight จากข้อมูล'],
    W3: ['ลด cognitive load', 'ทำ feedback ให้ชัด', 'ป้องกัน error ก่อนเกิด', 'เลือก repair ที่ตรงงาน'],
    W4: ['เลือกคำถามวิจัย', 'จับ pain point จริง', 'แยกข้อมูลกับความเห็น', 'สรุป evidence ที่ใช้ได้'],
    W5: ['หา root cause', 'เขียน problem frame', 'เลือก HMW ที่แคบพอ', 'ต่อยอดเป็นแนวคิด'],
    W6: ['จัดขั้นตอนงานหลัก', 'หา bottleneck ใน flow', 'แยก happy/error path', 'ลดจุดหลงทาง'],
    W7: ['จัด priority ของหน้า', 'เลือก layout รองรับ goal', 'วาง CTA ให้ชัด', 'ปรับ mobile ให้แตะง่าย'],
    W8: ['ต่อ evidence chain', 'ชี้ mismatch สำคัญ', 'เลือก revision ก่อน', 'อธิบาย rationale'],
    W9: ['ใช้ component เดียวกัน', 'กำหนด state ชัด', 'ตั้ง naming rule', 'แก้ inconsistency'],
    W10:['จัด responsive breakpoint', 'เพิ่ม touch target', 'ตรวจ accessibility', 'แก้ layout ล้นจอ'],
    W11:['กำหนดสีตามสถานะ', 'จัด hierarchy ตัวอักษร', 'เพิ่ม contrast ให้อ่านได้', 'บันทึกกติกาใน guide'],
    W12:['ทำ state ให้ครบ', 'เขียน microcopy ชัด', 'ป้องกัน error', 'ช่วยผู้ใช้ recovery'],
    W13:['เชื่อม link ตาม task', 'ทดสอบ interaction', 'เตรียม error path', 'อธิบาย flow ของ prototype'],
    W14:['จัด severity ตาม impact', 'เลือก fix ที่สำคัญก่อน', 'วาง retest หลังแก้', 'บันทึก evidence log'],
    W15:['เรียงเรื่องจากหลักฐาน', 'ชี้ผลลัพธ์ของ design', 'ตอบคำถาม defense', 'สรุป next step'],
    B1: ['ระบุ problem จากหลักฐาน', 'จับ user goal', 'เลือก fix ที่ตรง impact', 'วาง proof หลังแก้'],
    B2: ['ต่อ persona กับ flow', 'เลือก wireframe ที่ตรง task', 'จัด CTA ตาม priority', 'อธิบาย decision'],
    B3: ['ใช้ pattern สม่ำเสมอ', 'ตรวจ responsive', 'แก้ accessibility', 'คุม visual system'],
    B4: ['จัด component state', 'เชื่อม prototype', 'ประเมิน severity', 'วาง iteration plan']
  };

  function cleanSpaces(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function removeCluePhrases(text) {
    let s = cleanSpaces(text);
    s = s.replace(/เลือก(?:คำตอบ|แนวทาง|วิธี|หลักฐาน)?(?:ที่|ซึ่ง)?/gi, '');
    s = s.replace(/(?:โดย|เพื่อ|เพราะ|เนื่องจาก|พร้อมทั้ง|แล้วส่งต่อ|ส่งต่อเข้า|ต่อด้วย|และส่งต่อ).*$/i, '');
    s = s.replace(/\s*[•→].*$/g, '');
    s = s.replace(/\([^)]{8,}\)/g, '');
    s = s.replace(/\b(?:artifact|decision chain|Visual Style Guide|style guide)\b/gi, '');
    s = cleanSpaces(s);
    return s;
  }

  function compactMeaning(raw, index) {
    const text = cleanSpaces(raw);
    for (const [re, label] of CONCEPTS) if (re.test(text)) return label;
    for (const [re, label] of BAD_PATTERNS) if (re.test(text)) return label;
    let s = removeCluePhrases(text);
    if (!s || s.length < 6) s = (FALLBACKS[NODE] || FALLBACKS.W1)[index % 4];
    if (s.length > 44) s = s.slice(0, 42).replace(/[\s,;:/-]+$/,'') + '…';
    return s;
  }

  function hasSpoiler(texts) {
    const lengths = texts.map(t => cleanSpaces(t).length);
    const sorted = lengths.slice().sort((a,b) => a-b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1;
    const max = Math.max(...lengths);
    if (max > THRESHOLD_LONG || max / Math.max(1, median) > THRESHOLD_RATIO) return true;
    const lowered = texts.map(t => t.toLowerCase());
    return CLUE_TERMS.some(term => lowered.filter(t => t.includes(term.toLowerCase())).length === 1);
  }

  function uniqueBalanced(labels) {
    const used = new Set();
    const fallback = FALLBACKS[NODE] || FALLBACKS.W1;
    return labels.map((label, i) => {
      let out = cleanSpaces(label);
      if (!out || used.has(out.toLowerCase())) out = fallback[i % fallback.length];
      let n = 2;
      while (used.has(out.toLowerCase())) out = `${fallback[i % fallback.length]} ${n++}`;
      used.add(out.toLowerCase());
      return out;
    });
  }

  function setOptionText(option, text) {
    option.dataset.uxqFairOriginal = option.dataset.uxqFairOriginal || cleanSpaces(option.textContent);
    const label = option.querySelector('.choice-label, .label, .badge, b, strong');
    const letter = option.getAttribute('data-label') || option.dataset.label || label?.textContent?.trim()?.match(/^[A-D]$/i)?.[0] || '';
    option.textContent = '';
    const head = document.createElement('span');
    head.className = 'uxqFairLetter';
    head.textContent = letter || String.fromCharCode(65 + Array.from(option.parentElement?.children || []).indexOf(option));
    const body = document.createElement('span');
    body.className = 'uxqFairText';
    body.textContent = text;
    option.append(head, body);
  }

  function mark(container, reason) {
    if (container.querySelector('.uxqFairnessBadge')) return;
    const badge = document.createElement('div');
    badge.className = 'uxqFairnessBadge';
    badge.textContent = `✅ choice fairness: ${reason}`;
    const target = container.querySelector('.instruction, .prompt, .question-title, h2, h3') || container.firstElementChild;
    if (target?.parentElement) target.parentElement.insertBefore(badge, target.nextSibling);
  }

  function processQuestion(question) {
    if (!question || question.dataset.uxqFairApplied === VERSION) return;
    if (question.closest('.result, .summary, .debrief, .artifact, textarea')) return;
    const options = Array.from(question.querySelectorAll('button.option, .option, button.choice, .choice, [data-choice]'))
      .filter(el => !el.closest('.verify, .result, .debrief, .artifact') && el.offsetParent !== null);
    if (options.length < 4) return;

    const originalTexts = options.slice(0,4).map(o => cleanSpaces(o.dataset.uxqFairOriginal || o.textContent));
    const needs = hasSpoiler(originalTexts) || options.some(o => /\n|\s{2,}/.test(o.textContent));
    if (!needs) {
      question.dataset.uxqFairApplied = VERSION;
      mark(question, 'balanced');
      return;
    }

    const labels = uniqueBalanced(originalTexts.map(compactMeaning));
    options.slice(0,4).forEach((opt, i) => setOptionText(opt, labels[i]));
    question.dataset.uxqFairApplied = VERSION;
    question.dataset.uxqFairVersion = VERSION;
    mark(question, 'no spoiler / equal length');

    window.UXQ_CHOICE_FAIRNESS_AUDIT = window.UXQ_CHOICE_FAIRNESS_AUDIT || [];
    window.UXQ_CHOICE_FAIRNESS_AUDIT.push({ node:NODE, version:VERSION, before:originalTexts, after:labels, ts:new Date().toISOString() });
  }

  function scan() {
    document.querySelectorAll('.question, .game, .stage, .round, main').forEach(processQuestion);
  }

  function css() {
    if (document.getElementById('uxqAllChoiceFairnessCSS')) return;
    const style = document.createElement('style');
    style.id = 'uxqAllChoiceFairnessCSS';
    style.textContent = `
      .uxqFairnessBadge{display:inline-flex;align-items:center;gap:.35rem;margin:.55rem 0 .8rem;padding:.36rem .7rem;border:1px solid rgba(94,234,212,.55);background:rgba(20,184,166,.14);color:#bbf7d0;border-radius:999px;font-weight:900;font-size:.82rem;letter-spacing:-.01em}
      button.option .uxqFairLetter,.option .uxqFairLetter,button.choice .uxqFairLetter,.choice .uxqFairLetter,[data-choice] .uxqFairLetter{display:inline-grid;place-items:center;min-width:2.1rem;height:1.6rem;margin-right:.55rem;border:1px solid rgba(103,232,249,.6);background:rgba(8,145,178,.2);color:#a5f3fc;border-radius:999px;font-weight:1000;font-size:.78rem;line-height:1}
      button.option .uxqFairText,.option .uxqFairText,button.choice .uxqFairText,.choice .uxqFairText,[data-choice] .uxqFairText{display:inline;overflow-wrap:anywhere;word-break:normal;line-height:1.35}
      button.option,.option,button.choice,.choice,[data-choice]{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;min-height:7.4rem!important;display:flex!important;align-items:flex-start!important;gap:.15rem!important}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    css();
    scan();
    let timer = 0;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 60); };
    new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true, characterData:true });
    window.addEventListener('click', () => setTimeout(scan, 80), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
