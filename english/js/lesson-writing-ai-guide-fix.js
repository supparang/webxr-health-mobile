// === /english/js/lesson-writing-ai-guide-fix.js ===
// PATCH v20260426c-LESSON-WRITING-AI-GUIDE-PROGRESSIVE
// Local AI Writing Coach for TechPath VR
// ✅ no external API
// ✅ progressive guide by difficulty
// ✅ easy/A2        = full guide + scaffold + model example
// ✅ normal/A2+     = guide + checklist + AI check, no auto full answer
// ✅ hard/B1        = rubric/checklist + AI check, no model answer
// ✅ challenge/B1+  = no AI guide, challenge mode
// ✅ works with lesson-mission-panel-fix.js writing missions

(function () {
  'use strict';

  const VERSION = 'v20260426c-LESSON-WRITING-AI-GUIDE-PROGRESSIVE';

  const LEVEL_GUIDE = {
    easy: {
      cefr: 'A2',
      title: 'A2 Writing Guide',
      goal: 'เขียนประโยคสั้น ๆ ให้ครบใจความ',
      frame: 'I study ________. I can ________.',
      checklist: [
        'มีประธาน เช่น I / My / This',
        'มี verb ชัดเจน เช่น study / use / build / like',
        'อย่างน้อย 1 ประโยค',
        'ใช้คำง่ายและตรงโจทย์'
      ],
      phrases: ['I study...', 'I can...', 'My project is...', 'This app is...'],
      supportLabel: 'Full Support'
    },

    normal: {
      cefr: 'A2+',
      title: 'A2+ Writing Guide',
      goal: 'เขียน 2 ประโยคสั้น ๆ มีบริบท CS/AI',
      frame: 'I am building ________. It helps ________.',
      checklist: [
        'ประโยคแรกบอกสิ่งที่ทำ',
        'ประโยคที่สองบอกประโยชน์',
        'มีคำเกี่ยวกับ project / app / student / system',
        'ใช้คำเชื่อมง่าย ๆ เช่น and / because'
      ],
      phrases: ['I am building...', 'It helps...', 'My project...', 'because...'],
      supportLabel: 'Guided Practice'
    },

    hard: {
      cefr: 'B1',
      title: 'B1 Writing Guide',
      goal: 'เขียนอธิบายปัญหา วิธีแก้ และเหตุผลสั้น ๆ',
      frame: 'The problem is ________. Our system ________. This helps users ________.',
      checklist: [
        'บอก problem หรือ topic',
        'บอก solution หรือสิ่งที่ระบบทำ',
        'อธิบาย benefit หรือ result',
        'ใช้คำเชื่อม เช่น because / so / however'
      ],
      phrases: ['The problem is...', 'Our system...', 'This helps...', 'because...', 'so...'],
      supportLabel: 'Rubric Support'
    },

    challenge: {
      cefr: 'B1+',
      title: 'B1+ Challenge',
      goal: 'เขียนเองแบบท้าทาย โดยไม่มี AI guide',
      frame: 'Many users ________. Our project solves this by ________. As a result, ________.',
      checklist: [
        'เปิดด้วยบริบทหรือปัญหา',
        'อธิบาย feature / solution',
        'สรุป benefit หรือ next step',
        'ใช้คำเชื่อมระดับ B1+ เช่น however / therefore / as a result'
      ],
      phrases: ['Many users...', 'Our project solves...', 'As a result...', 'However...', 'Therefore...'],
      supportLabel: 'Challenge'
    }
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizeDifficulty(v) {
    const raw = safe(v).toLowerCase();

    if (['easy', 'e', 'a2'].includes(raw)) return 'easy';
    if (['normal', 'medium', 'a2+'].includes(raw)) return 'normal';
    if (['hard', 'b1'].includes(raw)) return 'hard';
    if (['challenge', 'expert', 'b1+'].includes(raw)) return 'challenge';

    return 'normal';
  }

  function normalizeText(text) {
    return safe(text)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function wordCount(text) {
    const n = normalizeText(text);
    return n ? n.split(/\s+/).filter(Boolean).length : 0;
  }

  function sentenceCount(text) {
    const s = safe(text);
    if (!s) return 0;

    const parts = s
      .split(/[.!?]+/)
      .map(x => x.trim())
      .filter(Boolean);

    return Math.max(parts.length, s.length > 4 ? 1 : 0);
  }

  function getMissionState() {
    try {
      if (window.LESSON_MISSION_PANEL_FIX?.getState) {
        return window.LESSON_MISSION_PANEL_FIX.getState();
      }
    } catch (err) {}

    return {};
  }

  function getWritingItem() {
    const st = getMissionState();

    if (st && st.skill === 'writing' && st.item) {
      const difficulty = normalizeDifficulty(st.difficulty || st.item.difficulty || 'normal');

      // ✅ Progressive support:
      // easy / normal / hard = มี AI guide
      // challenge = ไม่มี AI guide เพื่อให้เป็นด่านท้าทายจริง
      if (!['easy', 'normal', 'hard'].includes(difficulty)) {
        return null;
      }

      return {
        item: st.item,
        difficulty,
        sid: st.sid || st.item._sid || ''
      };
    }

    return null;
  }

  function escapeHtml(text) {
    return safe(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function ensureCSS() {
    if ($('#lesson-writing-ai-guide-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-writing-ai-guide-css';
    style.textContent = `
      #lessonWritingAiGuide {
        border: 1px solid #bfdbfe;
        border-radius: 18px;
        background: linear-gradient(180deg,#ffffff,#eff6ff);
        padding: 12px;
        color: #0f172a;
        box-shadow: 0 10px 24px rgba(15,23,42,.08);
      }

      #lessonWritingAiGuide * {
        box-sizing: border-box;
      }

      .ai-guide-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 10px;
      }

      .ai-guide-title {
        font-weight: 1000;
        color: #1d4ed8;
        line-height: 1.25;
      }

      .ai-guide-title small {
        display: block;
        color: #475569;
        font-size: 12px;
        margin-top: 2px;
        font-weight: 800;
      }

      .ai-guide-level {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 12px;
        font-weight: 1000;
        white-space: nowrap;
      }

      .ai-guide-box {
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        border-radius: 14px;
        padding: 10px;
        margin-top: 8px;
        font-weight: 800;
        line-height: 1.45;
      }

      .ai-guide-box b {
        color: #0f172a;
      }

      .ai-keyword-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }

      .ai-keyword {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 12px;
        font-weight: 1000;
      }

      .ai-keyword.used {
        background: #dcfce7;
        color: #166534;
      }

      .ai-keyword.missing {
        background: #fee2e2;
        color: #991b1b;
      }

      .ai-guide-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      .ai-guide-btn {
        border: 0;
        border-radius: 999px;
        padding: 10px 12px;
        cursor: pointer;
        font-weight: 1000;
        background: #dbeafe;
        color: #1d4ed8;
      }

      .ai-guide-btn.primary {
        background: #22c55e;
        color: #052e16;
      }

      .ai-guide-btn.warn {
        background: #fef3c7;
        color: #92400e;
      }

      .ai-guide-btn:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      #lessonWritingAiFeedback {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #334155;
        font-weight: 900;
        line-height: 1.45;
      }

      #lessonWritingAiFeedback.pass {
        background: #dcfce7;
        border-color: #86efac;
        color: #166534;
      }

      #lessonWritingAiFeedback.warn {
        background: #fef3c7;
        border-color: #fde68a;
        color: #92400e;
      }

      #lessonWritingAiFeedback.fail {
        background: #fee2e2;
        border-color: #fecaca;
        color: #991b1b;
      }

      .ai-guide-progress {
        height: 10px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
        margin-top: 8px;
      }

      .ai-guide-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg,#22c55e,#0ea5e9);
        transition: width .25s ease;
      }

      .ai-guide-note {
        margin-top: 8px;
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.4;
      }

      html.lesson-mode-cardboard #lessonWritingAiGuide {
        display: none !important;
      }

      @media (max-width: 640px) {
        .ai-guide-head {
          flex-direction: column;
        }

        .ai-guide-actions {
          display: grid;
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function buildKeywordHtml(keywords, usedSet) {
    if (!keywords.length) {
      return '<span style="font-weight:800;color:#64748b">ไม่มี keyword เฉพาะ</span>';
    }

    return keywords.map((kw) => {
      const used = usedSet.has(normalizeText(kw));

      return `<span class="ai-keyword ${used ? 'used' : 'missing'}">${used ? '✅' : '＋'} ${escapeHtml(kw)}</span>`;
    }).join('');
  }

  function buildChecklistHtml(list) {
    return list.map(x => `<li>${escapeHtml(x)}</li>`).join('');
  }

  function buildScaffold(diff, item) {
    const guide = LEVEL_GUIDE[diff] || LEVEL_GUIDE.normal;
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];

    if (diff === 'easy') {
      return keywords.length
        ? `I study ${keywords[0] || 'computer science'}. I can ${keywords[1] || 'write simple code'}.`
        : guide.frame;
    }

    // normal / hard ไม่ใช้ปุ่ม insert scaffold แล้ว
    return guide.frame;
  }

  function insertTextToWritingBox(text, mode) {
    const input = $('#lessonWritingInput');
    if (!input) return;

    if (mode === 'append' && input.value.trim()) {
      input.value = `${input.value.trim()} ${text}`;
    } else {
      input.value = text;
    }

    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function analyzeAnswer(item, diff) {
    const input = $('#lessonWritingInput');
    const answer = input ? input.value : '';
    const norm = normalizeText(answer);

    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const normalizedKeywords = keywords.map(k => normalizeText(k));

    const usedKeywords = normalizedKeywords.filter(k => k && norm.includes(k));
    const missingKeywords = keywords.filter(k => !norm.includes(normalizeText(k)));

    const wc = wordCount(answer);
    const sc = sentenceCount(answer);

    const minWords = Number(
      item.minWords ||
      (diff === 'easy' ? 5 : diff === 'normal' ? 10 : diff === 'hard' ? 18 : 25)
    );

    const minMatch = Number(
      item.minMatch ||
      (diff === 'easy' ? 1 : diff === 'normal' ? 2 : diff === 'hard' ? 3 : 4)
    );

    const hasConnector = /\band\b|\bbecause\b|\bso\b|\btherefore\b|\bas a result\b|\bhowever\b/i.test(answer);
    const hasProblem = /\bproblem\b|\bissue\b|\bbug\b|\bdifficult\b|\bchallenge\b|\bneed\b/i.test(answer);
    const hasSolution = /\bsolve\b|\bsolution\b|\bhelp\b|\bsupport\b|\bimprove\b|\bfix\b|\bbuild\b|\bsystem\b|\bapp\b/i.test(answer);
    const hasBenefit = /\bbenefit\b|\bresult\b|\buseful\b|\bfaster\b|\bbetter\b|\bclear\b|\beasy\b|\bprogress\b/i.test(answer);

    let featureNeed = [];

    if (diff === 'normal') {
      if (sc < 2) featureNeed.push('เพิ่มให้เป็น 2 ประโยค');
      if (!hasConnector) featureNeed.push('เพิ่มคำเชื่อมง่าย ๆ เช่น and/because');
    }

    if (diff === 'hard') {
      if (!hasProblem) featureNeed.push('เพิ่ม problem/topic');
      if (!hasSolution) featureNeed.push('เพิ่ม solution/action');
      if (!hasConnector) featureNeed.push('เพิ่มเหตุผลด้วย because/so');
    }

    const wordScore = Math.min(35, Math.round((wc / Math.max(minWords, 1)) * 35));
    const keywordScore = Math.min(40, Math.round((usedKeywords.length / Math.max(minMatch, 1)) * 40));

    let featureScore = 25;

    if (diff === 'easy') {
      featureScore = 25;
    } else if (diff === 'normal') {
      featureScore = Math.max(0, 25 - featureNeed.length * 10);
    } else if (diff === 'hard') {
      featureScore = Math.max(0, 25 - featureNeed.length * 8);
    }

    const score = Math.max(0, Math.min(100, wordScore + keywordScore + featureScore));

    const passedBasic = wc >= minWords && usedKeywords.length >= minMatch;
    const passedLevel = featureNeed.length === 0 || diff === 'easy';
    const ready = passedBasic && passedLevel;

    return {
      answer,
      score,
      ready,
      wc,
      sc,
      minWords,
      minMatch,
      usedKeywords,
      missingKeywords,
      featureNeed,
      keywords
    };
  }

  function updateFeedback() {
    const current = getWritingItem();
    const box = $('#lessonWritingAiFeedback');
    const fill = $('#lessonWritingAiProgressFill');

    if (!current || !box) return;

    const { item, difficulty } = current;
    const result = analyzeAnswer(item, difficulty);

    if (fill) {
      fill.style.width = `${result.score}%`;
    }

    const usedSet = new Set(result.usedKeywords);
    const keywordWrap = $('#lessonWritingAiKeywords');

    if (keywordWrap) {
      keywordWrap.innerHTML = buildKeywordHtml(result.keywords, usedSet);
    }

    if (!result.answer.trim()) {
      box.className = '';
      box.id = 'lessonWritingAiFeedback';

      if (difficulty === 'easy') {
        box.textContent = 'AI Guide: เริ่มเขียนตาม sentence frame หรือกด “ใส่โครงคำตอบ” แล้วปรับให้เป็นคำตอบของตนเอง';
      } else if (difficulty === 'normal') {
        box.textContent = 'AI Guide: เขียน 2 ประโยคสั้น ๆ แล้วกด AI ตรวจก่อนส่ง';
      } else {
        box.textContent = 'AI Guide: เขียน problem + solution + reason แล้วกด AI ตรวจก่อนส่ง';
      }

      return;
    }

    if (result.ready) {
      box.className = 'pass';
      box.id = 'lessonWritingAiFeedback';
      box.innerHTML =
        `✅ พร้อมส่งแล้ว • ${result.wc}/${result.minWords} คำ • keyword ${result.usedKeywords.length}/${result.minMatch} • readiness ${result.score}%`;
      return;
    }

    const tips = [];

    if (result.wc < result.minWords) {
      tips.push(`เพิ่มอีก ${result.minWords - result.wc} คำ`);
    }

    if (result.usedKeywords.length < result.minMatch) {
      tips.push(`เพิ่ม keyword เช่น ${result.missingKeywords.slice(0, 3).join(', ') || 'project, app, student'}`);
    }

    if (result.featureNeed.length) {
      tips.push(result.featureNeed.slice(0, 3).join(', '));
    }

    box.className = result.score >= 60 ? 'warn' : 'fail';
    box.id = 'lessonWritingAiFeedback';
    box.innerHTML =
      `AI แนะนำ: ${escapeHtml(tips.join(' • ') || 'เพิ่มรายละเอียดให้ชัดขึ้น')} • readiness ${result.score}%`;
  }

  function removeGuide() {
    const existing = $('#lessonWritingAiGuide');

    if (existing) existing.remove();
  }

  function injectGuide() {
    const current = getWritingItem();
    const input = $('#lessonWritingInput');

    if (!current || !input) {
      removeGuide();
      return;
    }

    ensureCSS();

    const { item, difficulty, sid } = current;
    const guide = LEVEL_GUIDE[difficulty] || LEVEL_GUIDE.normal;

    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const minWords = Number(
      item.minWords ||
      (difficulty === 'easy' ? 5 : difficulty === 'normal' ? 10 : difficulty === 'hard' ? 18 : 25)
    );

    const minMatch = Number(
      item.minMatch ||
      (difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : difficulty === 'hard' ? 3 : 4)
    );

    const model = safe(
      item.modelAnswer ||
      String(item.starter || '').replace(/^Starter:\s*/i, '') ||
      ''
    );

    const allowInsertFrame = difficulty === 'easy';
    const allowModelAnswer = difficulty === 'easy';

    const existing = $('#lessonWritingAiGuide');
    const currentId = safe(item.id || `${sid}-${difficulty}`);

    if (existing && existing.dataset.itemId === currentId && existing.dataset.difficulty === difficulty) {
      updateFeedback();
      return;
    }

    if (existing) existing.remove();

    const guideEl = document.createElement('section');
    guideEl.id = 'lessonWritingAiGuide';
    guideEl.dataset.itemId = currentId;
    guideEl.dataset.difficulty = difficulty;

    const supportNote =
      difficulty === 'easy'
        ? 'ระดับ Easy มี scaffold และตัวอย่าง เพื่อช่วยเริ่มต้น'
        : difficulty === 'normal'
          ? 'ระดับ Normal มี guide และ AI check แต่ไม่ใส่คำตอบแทน'
          : 'ระดับ Hard มี rubric/checklist เพื่อช่วยตรวจความครบถ้วน';

    guideEl.innerHTML = `
      <div class="ai-guide-head">
        <div class="ai-guide-title">
          🤖 AI Writing Guide
          <small>${escapeHtml(guide.goal)}</small>
        </div>
        <div class="ai-guide-level">${escapeHtml(guide.cefr)} • ${escapeHtml(difficulty.toUpperCase())} • ${escapeHtml(guide.supportLabel)}</div>
      </div>

      <div class="ai-guide-box">
        <b>${escapeHtml(guide.title)}</b>
        <ol style="margin:8px 0 0;padding-left:22px">
          ${buildChecklistHtml(guide.checklist)}
        </ol>
      </div>

      <div class="ai-guide-box">
        <b>Sentence frame:</b><br>
        <span>${escapeHtml(guide.frame)}</span>
      </div>

      <div class="ai-guide-box">
        <b>Target:</b> อย่างน้อย ${minWords} คำ และใช้ keyword อย่างน้อย ${minMatch} คำ
        <div id="lessonWritingAiKeywords" class="ai-keyword-wrap">
          ${buildKeywordHtml(keywords, new Set())}
        </div>
      </div>

      <div class="ai-guide-box">
        <b>Useful phrases:</b><br>
        ${guide.phrases.map(p => `<span class="ai-keyword">${escapeHtml(p)}</span>`).join('')}
      </div>

      <div class="ai-guide-actions">
        ${
          allowInsertFrame
            ? '<button class="ai-guide-btn primary" id="lessonAiInsertFrameBtn" type="button">✨ ใส่โครงคำตอบ</button>'
            : ''
        }
        <button class="ai-guide-btn" id="lessonAiCheckBtn" type="button">🤖 AI ตรวจก่อนส่ง</button>
        <button class="ai-guide-btn warn" id="lessonAiConnectorBtn" type="button">＋ เพิ่มคำเชื่อม</button>
      </div>

      ${
        model && allowModelAnswer
          ? `<details class="ai-guide-box">
               <summary style="cursor:pointer;font-weight:1000;color:#92400e">💡 ดูตัวอย่างคำตอบ</summary>
               <div style="margin-top:8px;color:#78350f">${escapeHtml(model)}</div>
             </details>`
          : ''
      }

      <div class="ai-guide-note">
        ${escapeHtml(supportNote)}
      </div>

      <div class="ai-guide-progress">
        <div class="ai-guide-progress-fill" id="lessonWritingAiProgressFill"></div>
      </div>

      <div id="lessonWritingAiFeedback">
        AI Guide: เริ่มเขียนตาม sentence frame แล้วระบบจะช่วยตรวจให้ทันที
      </div>
    `;

    input.parentNode.insertBefore(guideEl, input);

    $('#lessonAiInsertFrameBtn')?.addEventListener('click', () => {
      if (difficulty !== 'easy') return;

      insertTextToWritingBox(buildScaffold(difficulty, item), 'replace');
      updateFeedback();
    });

    $('#lessonAiCheckBtn')?.addEventListener('click', updateFeedback);

    $('#lessonAiConnectorBtn')?.addEventListener('click', () => {
      const connector =
        difficulty === 'easy'
          ? ' and '
          : difficulty === 'normal'
            ? ' because '
            : ' This helps users ';

      insertTextToWritingBox(connector, 'append');
      updateFeedback();
    });

    input.removeEventListener('input', updateFeedback);
    input.addEventListener('input', updateFeedback);

    updateFeedback();

    console.log('[LessonWritingAIGuide]', VERSION, {
      sid,
      difficulty,
      itemId: currentId
    });
  }

  function bindEvents() {
    [
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:view-mode-ready',
      'lesson:ai-difficulty-updated'
    ].forEach((name) => {
      window.addEventListener(name, () => setTimeout(injectGuide, 80));
      document.addEventListener(name, () => setTimeout(injectGuide, 80));
    });
  }

  function startObserver() {
    if (!document.body) return;

    const obs = new MutationObserver(() => {
      const input = $('#lessonWritingInput');

      if (input) {
        setTimeout(injectGuide, 30);
      } else {
        removeGuide();
      }
    });

    obs.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function boot() {
    ensureCSS();
    bindEvents();
    startObserver();

    setTimeout(injectGuide, 300);
    setTimeout(injectGuide, 900);
    setTimeout(injectGuide, 1800);

    window.LESSON_WRITING_AI_GUIDE_FIX = {
      version: VERSION,
      inject: injectGuide,
      remove: removeGuide,
      analyze: () => {
        const current = getWritingItem();
        if (!current) return null;
        return analyzeAnswer(current.item, current.difficulty);
      }
    };

    console.log('[LessonWritingAIGuide]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
