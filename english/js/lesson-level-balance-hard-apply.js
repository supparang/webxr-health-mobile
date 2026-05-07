/* =========================================================
 * /english/js/lesson-level-balance-hard-apply.js
 * PATCH v20260506b-LEVEL-BALANCE-HARD-APPLY
 *
 * ใช้เมื่อ LessonLevelBalance โหลดแล้ว แต่ engine ยังแสดงโจทย์ bank เดิม
 *
 * ✅ บังคับ prompt ที่เห็นจริงให้สั้น/ยาวตาม diff
 * ✅ บังคับ sample transcript ให้เหมาะกับ level
 * ✅ บังคับ Listen Sample / Play US Audio ให้พูด sample ใหม่
 * ✅ บังคับ AI Help ให้พูด hint ใหม่
 * ✅ รองรับ S1 ที่เห็นในภาพ: CS + AI + future career/problem solving
 * ✅ ไม่แก้ engine หลักแบบถาวร ปลอดภัยสำหรับ test
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-level-balance-hard-apply-v20260506b';

  const LEVELS = {
    easy: {
      speakingWords: [3, 7],
      writingWords: [3, 8],
      hintLabel: 'easy'
    },
    normal: {
      speakingWords: [8, 14],
      writingWords: [8, 14],
      hintLabel: 'normal'
    },
    hard: {
      speakingWords: [15, 24],
      writingWords: [15, 24],
      hintLabel: 'hard'
    },
    challenge: {
      speakingWords: [25, 35],
      writingWords: [25, 35],
      hintLabel: 'challenge'
    }
  };

  /*
   * S01 ในหน้าจอปัจจุบันเป็นโจทย์แนว:
   * CS + AI + future career + problem solving
   * จึงทำ level-specific prompt/sample ให้ตรงกับบทเรียนจริง
   */
  const HARD_APPLY_BANK = {
    S01: {
      skill: 'speaking',
      title: 'Speaking: CS and AI Career',
      easy: {
        label: 'SPEAKING PROMPT',
        prompt: 'Say one reason CS and AI are useful.',
        subPrompt: 'พูดสั้น ๆ 1 เหตุผล',
        sample: 'AI helps me solve problems.',
        requiredKeywords: ['ai', 'solve problems'],
        hint: 'Say one simple reason. For example, AI helps you solve problems.'
      },
      normal: {
        label: 'SPEAKING PROMPT',
        prompt: 'Say why CS and AI help your future career.',
        subPrompt: 'มีคำว่า career และ problem solving',
        sample: 'CS and AI help my future career and problem solving.',
        requiredKeywords: ['cs', 'ai', 'future career', 'problem solving'],
        hint: 'Use two key ideas: future career and problem solving.'
      },
      hard: {
        label: 'SPEAKING PROMPT',
        prompt: 'Explain why CS and AI are useful for your career.',
        subPrompt: 'ตอบ 2 เหตุผล: career + building systems / solving problems',
        sample: 'CS and AI help my future career because I can build smart systems and solve real problems.',
        requiredKeywords: ['cs', 'ai', 'future career', 'build', 'problems'],
        hint: 'Include career, building systems, and solving problems.'
      },
      challenge: {
        label: 'SPEAKING PROMPT',
        prompt: 'Give a professional answer about CS, AI, and your future career.',
        subPrompt: 'ตอบแบบมืออาชีพ มี career + smart systems + business problems',
        sample: 'Computer science and AI are useful because they help me build smart systems, solve business problems, and prepare for my future career.',
        requiredKeywords: ['computer science', 'ai', 'smart systems', 'business problems', 'future career'],
        hint: 'Use a professional structure: field, benefit, problem solving, and career goal.'
      }
    },

    S04: {
      skill: 'speaking',
      title: 'Stand-up Update',
      easy: {
        label: 'SPEAKING PROMPT',
        prompt: 'Give one short progress update.',
        subPrompt: 'พูดเฉพาะสิ่งที่ทำแล้ว',
        sample: 'I tested the login form.',
        requiredKeywords: ['tested', 'login form'],
        hint: 'Say what you finished.'
      },
      normal: {
        label: 'SPEAKING PROMPT',
        prompt: 'Give progress and next task.',
        subPrompt: 'ต้องมี progress + next task',
        sample: 'I tested the login form. I will test the dashboard.',
        requiredKeywords: ['tested', 'login form', 'dashboard'],
        hint: 'Say progress first, then next task.'
      },
      hard: {
        label: 'SPEAKING PROMPT',
        prompt: 'Give progress, next task, and what you need.',
        subPrompt: 'ต้องมี progress + next task + need',
        sample: 'I tested the login form. I will test the dashboard. I need sample data.',
        requiredKeywords: ['tested', 'login form', 'dashboard', 'sample data'],
        hint: 'Use three parts: progress, next task, and need.'
      },
      challenge: {
        label: 'SPEAKING PROMPT',
        prompt: 'Give a complete stand-up update to your team.',
        subPrompt: 'ต้องมี yesterday + today + blocker/need',
        sample: 'Yesterday, I tested the login form. Today, I will test the dashboard. I need sample data to continue.',
        requiredKeywords: ['yesterday', 'tested', 'login form', 'today', 'dashboard', 'sample data'],
        hint: 'Use stand-up structure: yesterday, today, and blocker or need.'
      }
    },

    S09: {
      skill: 'speaking-boss',
      title: 'Data Analyst Boss Speaking',
      easy: {
        label: 'SPEAKING PROMPT',
        prompt: 'Say one data result.',
        subPrompt: 'พูดผลลัพธ์สั้น ๆ',
        sample: 'Sales increased today.',
        requiredKeywords: ['sales', 'increased'],
        hint: 'Say the data result clearly.'
      },
      normal: {
        label: 'SPEAKING PROMPT',
        prompt: 'Report one data result with a number.',
        subPrompt: 'ต้องมี metric + result',
        sample: 'Sales increased by ten percent today.',
        requiredKeywords: ['sales', 'increased', 'ten percent'],
        hint: 'Include the metric and the result.'
      },
      hard: {
        label: 'SPEAKING PROMPT',
        prompt: 'Report a data result and a possible reason.',
        subPrompt: 'ต้องมี result + reason',
        sample: 'Sales increased by ten percent because the promotion worked.',
        requiredKeywords: ['sales', 'increased', 'ten percent', 'promotion'],
        hint: 'Say the result and the reason.'
      },
      challenge: {
        label: 'SPEAKING PROMPT',
        prompt: 'Give a precise analyst response to unlock the hacked system.',
        subPrompt: 'ต้องมี metric + cause + evidence',
        sample: 'Sales increased by ten percent today, mainly because the promotion improved user clicks on the product page.',
        requiredKeywords: ['sales', 'increased', 'ten percent', 'promotion', 'user clicks'],
        hint: 'Use metric, cause, and evidence.'
      }
    },

    S14: {
      skill: 'speaking',
      title: 'Complex Technical Sentence',
      easy: {
        label: 'SPEAKING PROMPT',
        prompt: 'Say one technical action.',
        subPrompt: 'พูด 1 ประโยคสั้น',
        sample: 'I fixed the bug.',
        requiredKeywords: ['fixed', 'bug'],
        hint: 'Use one clear sentence.'
      },
      normal: {
        label: 'SPEAKING PROMPT',
        prompt: 'Say what you fixed and tested.',
        subPrompt: 'ต้องมี fixed + tested',
        sample: 'I fixed the bug and tested the app.',
        requiredKeywords: ['fixed', 'bug', 'tested', 'app'],
        hint: 'Mention the fix and the test.'
      },
      hard: {
        label: 'SPEAKING PROMPT',
        prompt: 'Say a technical update with problem, action, and test.',
        subPrompt: 'ต้องมี problem + action + validation',
        sample: 'I found a bug in the dashboard, fixed it, and tested the app again.',
        requiredKeywords: ['bug', 'dashboard', 'fixed', 'tested'],
        hint: 'Include where the problem was, what you fixed, and how you tested it.'
      },
      challenge: {
        label: 'SPEAKING PROMPT',
        prompt: 'Say a longer professional technical update clearly.',
        subPrompt: 'ต้องมี problem + technical fix + validation',
        sample: 'I found a bug in the dashboard filter, fixed the data query, and tested the app again with sample users.',
        requiredKeywords: ['dashboard filter', 'data query', 'tested', 'sample users'],
        hint: 'Speak slowly. Include problem, technical fix, and validation.'
      }
    }
  };

  function qs(name, fallback) {
    try {
      const v = new URLSearchParams(location.search).get(name);
      return v == null || v === '' ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function normLevel(v) {
    const s = String(v || '').toLowerCase().trim();
    if (LEVELS[s]) return s;

    const d = String(qs('diff', 'normal') || '').toLowerCase().trim();
    if (LEVELS[d]) return d;

    return 'normal';
  }

  function normSession(v) {
    let s = String(v || '').trim();

    if (!s) {
      s = qs('s', '') || qs('session', '') || qs('sessionNo', '') || '1';
    }

    s = String(s).toUpperCase().replace(/^SESSION/i, 'S').replace(/\s+/g, '');

    const m = s.match(/^S?(\d{1,2})$/i);
    if (m) {
      const n = Math.max(1, Math.min(15, Number(m[1])));
      return 'S' + String(n).padStart(2, '0');
    }

    if (/^S\d\d$/.test(s)) return s;

    return 'S01';
  }

  function textOf(el) {
    return String(el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function getCurrentPromptText() {
    const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,div,span'))
      .filter(isVisible)
      .map(el => ({
        el,
        text: textOf(el),
        size: parseFloat(getComputedStyle(el).fontSize || '0')
      }))
      .filter(x =>
        x.text.length >= 20 &&
        x.text.length <= 220 &&
        !/AI COACH|HINT LIMIT|Question\s+\d|Session Bank|Minimum Time|Mission Battle/i.test(x.text)
      )
      .sort((a, b) => b.size - a.size);

    return candidates.length ? candidates[0].text : '';
  }

  function getBalancedItem() {
    const session = normSession(qs('s', '') || qs('session', '') || window.LESSON_SESSION || window.currentSession || '1');
    const level = normLevel(qs('diff', '') || window.LESSON_DIFF || window.currentDiff || 'normal');
    const currentPrompt = getCurrentPromptText();

    // S01 ในภาพเป็นโจทย์ CS/AI career จึงใช้ bank ใหม่ตัวนี้โดยตรง
    if (
      session === 'S01' ||
      /CS\s+and\s+AI|computer science|future career|problem solving/i.test(currentPrompt)
    ) {
      return Object.assign(
        {
          session: 'S01',
          level,
          source: 'hard-apply-bank'
        },
        HARD_APPLY_BANK.S01[level]
      );
    }

    if (HARD_APPLY_BANK[session] && HARD_APPLY_BANK[session][level]) {
      return Object.assign(
        {
          session,
          level,
          source: 'hard-apply-bank'
        },
        HARD_APPLY_BANK[session][level]
      );
    }

    // fallback ไปใช้ LessonLevelBalance ที่มีอยู่
    if (window.LessonLevelBalance && typeof window.LessonLevelBalance.pickItem === 'function') {
      const lbItem = window.LessonLevelBalance.pickItem(session, level, 0);
      if (lbItem) {
        return Object.assign(
          {
            session,
            level,
            source: 'LessonLevelBalance'
          },
          {
            label: /speaking/i.test(lbItem.skill || '') ? 'SPEAKING PROMPT' : 'MISSION PROMPT',
            prompt: lbItem.prompt || lbItem.audioText || lbItem.title || '',
            subPrompt: lbItem.subPrompt || getLevelSubPrompt(lbItem.skill, level),
            sample: lbItem.sample || lbItem.answer || lbItem.audioText || '',
            requiredKeywords: lbItem.requiredKeywords || [],
            hint: lbItem.aiHelp || 'Focus on the keywords and answer clearly.',
            skill: lbItem.skill
          }
        );
      }
    }

    return null;
  }

  function getLevelSubPrompt(skill, level) {
    const l = LEVELS[normLevel(level)] || LEVELS.normal;

    if (/speaking/i.test(skill || '')) {
      return `เหมาะกับระดับ ${normLevel(level)}: ${l.speakingWords[0]}–${l.speakingWords[1]} words`;
    }

    if (/writing/i.test(skill || '')) {
      return `เหมาะกับระดับ ${normLevel(level)}: ${l.writingWords[0]}–${l.writingWords[1]} words`;
    }

    return `เหมาะกับระดับ ${normLevel(level)}`;
  }

  function findPromptMainElement() {
    const all = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,div,span'))
      .filter(isVisible)
      .map(el => {
        const cs = getComputedStyle(el);
        return {
          el,
          text: textOf(el),
          size: parseFloat(cs.fontSize || '0'),
          weight: parseFloat(cs.fontWeight || '400') || 400
        };
      })
      .filter(x => {
        const t = x.text;
        if (t.length < 20 || t.length > 240) return false;
        if (/SPEAKING PROMPT|READING PROMPT|LISTENING PROMPT|WRITING PROMPT/i.test(t)) return false;
        if (/Your speech transcript|Submit|Speak Answer|AI Help|Listen Sample|Play US Audio/i.test(t)) return false;
        if (/AI COACH|HINT LIMIT|Session Bank|Question\s+\d|Minimum Time|Mission Battle/i.test(t)) return false;
        return x.size >= 22 || x.weight >= 800;
      })
      .sort((a, b) => {
        if (b.size !== a.size) return b.size - a.size;
        return b.weight - a.weight;
      });

    return all.length ? all[0].el : null;
  }

  function findPromptSubElement(mainEl) {
    if (!mainEl) return null;

    const parent = mainEl.parentElement || document.body;
    const all = Array.from(parent.querySelectorAll('p,div,span,small'))
      .filter(isVisible)
      .map(el => ({
        el,
        text: textOf(el),
        size: parseFloat(getComputedStyle(el).fontSize || '0')
      }))
      .filter(x => {
        const t = x.text;
        if (x.el === mainEl) return false;
        if (t.length < 4 || t.length > 120) return false;
        if (/SPEAKING PROMPT|READING PROMPT|LISTENING PROMPT|WRITING PROMPT/i.test(t)) return false;
        if (/Submit|Speak Answer|AI Help|Listen Sample|Play US Audio/i.test(t)) return false;
        if (/AI COACH|HINT LIMIT|Question\s+\d|Session Bank/i.test(t)) return false;
        return x.size >= 11 && x.size <= 20;
      });

    // ตัว subtitle มักอยู่หลัง prompt และอยู่ใน parent เดียวกัน
    return all.length ? all[0].el : null;
  }

  function markTextAreaUserTouched() {
    const tas = Array.from(document.querySelectorAll('textarea'));
    tas.forEach(ta => {
      if (ta.dataset.levelBalanceTouchedBound === '1') return;
      ta.dataset.levelBalanceTouchedBound = '1';

      ta.addEventListener('input', function () {
        ta.dataset.userTouched = '1';
      });

      ta.addEventListener('focus', function () {
        ta.dataset.focusedOnce = '1';
      });
    });
  }

  function looksLikeOldSample(v) {
    const s = String(v || '').toLowerCase();
    return (
      /computer science and ai are useful/.test(s) ||
      /yesterday,\s*i tested the login form/.test(s) ||
      /i tested the login form\. today/.test(s) ||
      /sales increased by ten percent today,\s*mainly/.test(s) ||
      /dashboard filter,\s*fixed the data query/.test(s)
    );
  }

  function applyTranscriptSample(item) {
    const ta = document.querySelector('textarea');
    if (!ta || !item || !item.sample) return;

    ta.placeholder = item.sample;

    // ถ้าเป็น sample เดิมที่ engine ใส่มาเอง ให้เปลี่ยนเป็น sample ตาม level
    // แต่ถ้าผู้เรียนเริ่มพิมพ์/พูดเองแล้ว ห้ามทับ
    if (ta.dataset.userTouched === '1') return;
    if (document.activeElement === ta && ta.dataset.focusedOnce === '1') return;

    const v = String(ta.value || '').trim();

    if (!v || looksLikeOldSample(v) || ta.dataset.levelBalanceAutoSample === '1') {
      ta.value = item.sample;
      ta.dataset.levelBalanceAutoSample = '1';

      try {
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }
  }

  function speakText(text) {
    const msg = String(text || '').trim();
    if (!msg) return false;

    if (window.LessonVoiceLock && typeof window.LessonVoiceLock.speak === 'function') {
      window.LessonVoiceLock.speak(msg);
      return true;
    }

    if (typeof window.speakAIHelpUS === 'function') {
      window.speakAIHelpUS(msg);
      return true;
    }

    if (window.LessonUSVoice && typeof window.LessonUSVoice.speak === 'function') {
      window.LessonUSVoice.speak(msg);
      return true;
    }

    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(msg);
        u.lang = 'en-US';
        u.rate = 0.86;
        u.pitch = 1.02;
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) {}
    }

    return false;
  }

  function bindButtons() {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));

    buttons.forEach(btn => {
      if (btn.dataset.levelBalanceButtonBound === '1') return;

      const label = textOf(btn).toLowerCase();
      const isSample =
        label.includes('listen sample') ||
        label.includes('play us audio') ||
        label.includes('ฟัง') ||
        label.includes('ตัวอย่าง');

      const isAIHelp =
        label.includes('ai help') ||
        label.includes('ai coach') ||
        label.includes('hint');

      if (!isSample && !isAIHelp) return;

      btn.dataset.levelBalanceButtonBound = '1';

      btn.addEventListener('click', function (ev) {
        const item = getBalancedItem();
        if (!item) return;

        if (isSample && item.sample) {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          speakText(item.sample);
          showToast('🔊 Sample: ' + item.sample);
          return;
        }

        if (isAIHelp && item.hint) {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          speakText(item.hint);
          showToast('💡 AI Help: ' + item.hint);
        }
      }, true);
    });
  }

  function showToast(msg) {
    let box = document.getElementById('lessonLevelBalanceHardApplyToast');

    if (!box) {
      box = document.createElement('div');
      box.id = 'lessonLevelBalanceHardApplyToast';
      box.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:82px',
        'z-index:999999',
        'padding:10px 14px',
        'border-radius:16px',
        'background:rgba(5,17,32,.96)',
        'color:#eaffff',
        'border:1px solid rgba(105,232,255,.48)',
        'font:800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'box-shadow:0 14px 42px rgba(0,0,0,.35)',
        'display:none'
      ].join(';');

      document.body.appendChild(box);
    }

    box.innerHTML = esc(msg);
    box.style.display = 'block';

    clearTimeout(box._t);
    box._t = setTimeout(function () {
      box.style.display = 'none';
    }, 3600);
  }

  function applyToDom() {
    const item = getBalancedItem();
    if (!item || !item.prompt) return false;

    window.LESSON_CURRENT_BALANCED_ITEM = item;
    window.currentBalancedQuestion = item;

    const mainEl = findPromptMainElement();
    if (mainEl && mainEl.textContent !== item.prompt) {
      mainEl.textContent = item.prompt;
      mainEl.dataset.levelBalanceHardApplied = PATCH_ID;
    }

    const subEl = findPromptSubElement(mainEl);
    if (subEl && item.subPrompt) {
      subEl.textContent = item.subPrompt;
      subEl.dataset.levelBalanceHardApplied = PATCH_ID;
    }

    applyTranscriptSample(item);

    return true;
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      [data-level-balance-hard-applied] {
        transition: color .15s ease, text-shadow .15s ease;
      }

      .lesson-level-balance-hard-chip {
        display:inline-flex;
        align-items:center;
        gap:6px;
        border-radius:999px;
        border:1px solid rgba(105,232,255,.38);
        background:rgba(105,232,255,.12);
        color:#eaffff;
        padding:5px 9px;
        font:900 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  function exposeDebug() {
    window.LessonLevelBalanceHardApply = {
      version: PATCH_ID,
      apply: applyToDom,
      getItem: getBalancedItem,
      speakSample: function () {
        const item = getBalancedItem();
        if (item) speakText(item.sample);
        return item;
      },
      speakHint: function () {
        const item = getBalancedItem();
        if (item) speakText(item.hint);
        return item;
      },
      debug: function () {
        const item = getBalancedItem();
        console.log('[LessonLevelBalanceHardApply]', item);
        return item;
      }
    };
  }

  function init() {
    injectStyle();
    exposeDebug();
    markTextAreaUserTouched();
    bindButtons();
    applyToDom();

    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;

      markTextAreaUserTouched();
      bindButtons();
      applyToDom();

      if (tries >= 25) clearInterval(timer);
    }, 250);

    try {
      const mo = new MutationObserver(function () {
        markTextAreaUserTouched();
        bindButtons();
        applyToDom();
      });

      mo.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      setTimeout(function () {
        try { mo.disconnect(); } catch (e) {}
      }, 15000);
    } catch (e) {}

    console.log('[LessonLevelBalanceHardApply] ready', PATCH_ID);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
