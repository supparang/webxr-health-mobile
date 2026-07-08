/* CSAI2601 UX Quest • Anti-Length Bias v1
 * Prevents the visible heuristic "longest option = correct".
 * Runs after field-aware/boss-aware option rewrites and normalizes option text length.
 * Correctness IDs stay untouched; scoring and sheet sync remain unchanged.
 */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();

  const TOPIC_TAGS = {
    W1:['task','goal','feedback','proof'],
    W2:['evidence','assumption','user','test'],
    W3:['mental model','load','feedback','repair'],
    W4:['question','pain point','persona','observe'],
    W5:['insight','root cause','HMW','concept'],
    W6:['sitemap','navigation','path','recovery'],
    W7:['priority','layout','CTA','mobile'],
    W8:['chain','mismatch','revision','rationale'],
    W9:['pattern','state','naming','system'],
    W10:['responsive','a11y','focus','check'],
    W11:['color','type','contrast','spacing'],
    W12:['state','microcopy','recovery','prevent'],
    W13:['task link','interaction','error path','prototype'],
    W14:['finding','severity','fix','retest'],
    W15:['narrative','evidence','proof','defense'],
    B1:['UX','HCD','psychology','proof'],
    B2:['persona','problem','flow','wireframe'],
    B3:['pattern','responsive','a11y','visual'],
    B4:['state','prototype','evidence','retest']
  };

  const NEUTRAL_EXTEND = [
    'ตรวจจากหลักฐานในสถานการณ์นี้',
    'ดูผลต่อ task และ next step',
    'เทียบกับ user goal ใน case',
    'พิจารณาว่าโยงกับ evidence ไหม',
    'อ่านให้ครบก่อนเลือกคำตอบ',
    'ดูว่าลด friction จริงหรือไม่',
    'ใช้เหตุผลจาก case ไม่ใช่ความชอบ',
    'ตรวจว่าผู้ใช้ทำงานต่อได้ไหม'
  ];

  function h(s){ let x=0; String(s||'').split('').forEach(c=>{ x=((x<<5)-x+c.charCodeAt(0))|0; }); return Math.abs(x); }
  function compact(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
  function sentenceLimit(s, max){
    s = compact(s);
    if (s.length <= max) return s;
    const cut = s.slice(0, max + 1);
    const pos = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('→'), cut.lastIndexOf('/'), cut.lastIndexOf(','));
    return compact((pos > 22 ? cut.slice(0, pos) : cut.slice(0, max)).replace(/[,:;→\-/]+$/,'')) + '…';
  }
  function isCorrect(btn){ return /^c\d+/i.test(String(btn?.dataset?.choice || '')); }
  function currentRound(){
    const m = text($('.hud .meter b')).match(/^(\d+)\s*\/\s*\d+/);
    return m ? Number(m[1]) : 1;
  }
  function visibleSeed(){ return [nodeId(), currentRound(), text($('.top .pill')), text($('.case h1'))].join('|'); }
  function tagFor(i){ const tags = TOPIC_TAGS[nodeId()] || TOPIC_TAGS.W1; return tags[i % tags.length]; }
  function extendFor(i, seed){ return NEUTRAL_EXTEND[(h(seed) + i) % NEUTRAL_EXTEND.length]; }

  function normalizeOption(btn, i, targetLen, seed){
    const b = $('b', btn);
    if (!b) return;
    if (!btn.dataset.originalLabel) btn.dataset.originalLabel = text(b);
    let label = sentenceLimit(btn.dataset.originalLabel, 46);
    const tag = tagFor(i);
    let finalText = label;
    if (finalText.length < targetLen - 12) finalText += ` • ${extendFor(i, seed)}`;
    finalText = sentenceLimit(finalText, Math.max(52, Math.min(68, targetLen + 10)));
    b.textContent = finalText;
    btn.dataset.lengthBalanced = isCorrect(btn) ? 'correct-balanced' : 'distractor-balanced';
    btn.setAttribute('data-choice-tag', tag);
  }

  function auditAndBalance(){
    const q = $('.question');
    if (!q || $('.verify') || $('.feedback')) return;
    const buttons = $$('.question > .options .option[data-choice]');
    if (buttons.length < 4) return;
    const seed = visibleSeed();
    const mark = `${nodeId()}|${currentRound()}|${text($('.top .pill'))}|${buttons.map(b=>String(b.dataset.choice||'')).join(',')}`;
    if (q.dataset.antiLengthMark === mark) return;

    const originalLengths = buttons.map((btn) => text($('b', btn)).length);
    const correctIndex = buttons.findIndex(isCorrect);
    const correctLength = correctIndex >= 0 ? originalLengths[correctIndex] : -1;
    const maxLen = Math.max(...originalLengths);
    const minLen = Math.min(...originalLengths);
    const targetLen = Math.max(42, Math.min(58, Math.round((maxLen + minLen) / 2) + 8));

    buttons.forEach((btn, i) => normalizeOption(btn, i, targetLen, seed));

    const balancedLengths = buttons.map((btn) => text($('b', btn)).length);
    const balancedMax = Math.max(...balancedLengths);
    const balancedMin = Math.min(...balancedLengths);
    q.dataset.antiLengthMark = mark;
    q.dataset.lengthSpreadBefore = String(maxLen - minLen);
    q.dataset.correctWasLongest = String(correctLength === maxLen);
    q.dataset.lengthSpreadAfter = String(balancedMax - balancedMin);
  }

  function injectStyle(){
    if ($('#uxq-anti-length-bias-style')) return;
    const s = document.createElement('style');
    s.id = 'uxq-anti-length-bias-style';
    s.textContent = `
      .question .option[data-choice-tag]{display:grid;align-content:start;gap:5px}
      .question .option[data-choice-tag] b{min-height:3.15em;display:block;line-height:1.32}
      .question .option[data-choice-tag]::after{content:attr(data-choice-tag);justify-self:start;border:1px solid rgba(181,205,255,.25);border-radius:999px;padding:3px 7px;color:#cfe0ff;background:rgba(255,255,255,.06);font-size:.72rem;font-weight:850;letter-spacing:.02em}
    `;
    document.head.appendChild(s);
  }

  let timer = 0;
  function schedule(){ clearTimeout(timer); timer = setTimeout(() => { injectStyle(); auditAndBalance(); }, 35); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true }); else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
})();
