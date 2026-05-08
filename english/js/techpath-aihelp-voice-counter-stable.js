/* =========================================================
 * /english/js/techpath-aihelp-voice-counter-stable.js
 * PATCH v20260508-AIHELP-VOICE-COUNTER-STABLE
 *
 * ✅ คืนตัวเลือกเสียง AI Help
 * ✅ เลือกเสียงแล้วใช้เสียงนั้นจริง
 * ✅ กด AI Help แล้วนับ 0/3 -> 1/3 -> 2/3 -> 3/3
 * ✅ ไม่ยุ่งกับ route / level / student / loading
 * ✅ ไม่บังปุ่มเล่นเกม
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-aihelp-voice-counter-stable-v20260508';
  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';
  const MAX_HELP = 3;

  let nativeSpeak = null;
  let nativeCancel = null;
  let lastCountAt = 0;

  function qs(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (e) {
      return d;
    }
  }

  function txt(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();
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

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';

    style.textContent = `
      #techPathAIHelpStable {
        position: fixed !important;
        right: 10px !important;
        bottom: 88px !important;
        z-index: 999998 !important;
        width: min(430px, calc(100vw - 20px)) !important;
        border-radius: 16px !important;
        border: 1px solid rgba(105,232,255,.38) !important;
        background: rgba(6,18,34,.96) !important;
        color: #eaffff !important;
        box-shadow: 0 18px 48px rgba(0,0,0,.36) !important;
        overflow: hidden !important;
        font: 800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #techPathAIHelpStable summary {
        cursor: pointer !important;
        padding: 10px 12px !important;
        color: #75eeff !important;
        font-weight: 1000 !important;
      }

      #techPathAIHelpStable .body {
        padding: 0 12px 12px !important;
      }

      #techPathAIHelpStable select {
        width: 100% !important;
        height: 40px !important;
        border-radius: 12px !important;
        border: 1px solid rgba(105,232,255,.32) !important;
        background: #101f32 !important;
        color: #eaffff !important;
        padding: 0 10px !important;
        font-weight: 900 !important;
      }

      #techPathAIHelpStable button {
        margin-top: 8px !important;
        width: 100% !important;
        height: 38px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #65e8ff !important;
        color: #06202a !important;
        font-weight: 1000 !important;
      }

      #techPathAIHelpStable .note {
        font-size: 12px !important;
        opacity: .78 !important;
        margin-top: 8px !important;
      }

      #techPathAIHelpUsedBadge {
        position: fixed !important;
        left: 12px !important;
        right: 12px !important;
        bottom: 92px !important;
        z-index: 999999 !important;
        display: none;
        padding: 10px 14px !important;
        border-radius: 16px !important;
        background: rgba(5,17,32,.96) !important;
        color: #eaffff !important;
        border: 1px solid rgba(105,232,255,.48) !important;
        box-shadow: 0 14px 44px rgba(0,0,0,.38) !important;
        font: 900 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif !important;
        text-align: center !important;
        pointer-events: none !important;
      }

      @media (max-width: 820px) {
        #techPathAIHelpStable {
          left: 10px !important;
          right: 10px !important;
          bottom: 86px !important;
          width: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getVoices() {
    try {
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    } catch (e) {
      return [];
    }
  }

  function isEnglish(v) {
    return String(v.lang || '').toLowerCase().startsWith('en');
  }

  function isUS(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    return /en-us|united states|google us|us english|samantha|alex|microsoft david|microsoft mark|microsoft zira|microsoft jenny|microsoft aria/i.test(s);
  }

  function voiceScore(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    let score = 0;

    if (isUS(v)) score += 1000;
    if (/Google US English/i.test(s)) score += 300;
    if (/Microsoft Jenny/i.test(s)) score += 280;
    if (/Microsoft Aria/i.test(s)) score += 270;
    if (/Microsoft Zira/i.test(s)) score += 250;
    if (/Samantha/i.test(s)) score += 240;
    if (/Microsoft David/i.test(s)) score += 180;
    if (/Microsoft Mark/i.test(s)) score += 160;

    return score;
  }

  function sortedVoices() {
    return getVoices()
      .filter(isEnglish)
      .sort(function (a, b) {
        const au = isUS(a) ? 0 : 1;
        const bu = isUS(b) ? 0 : 1;
        if (au !== bu) return au - bu;

        return voiceScore(b) - voiceScore(a);
      });
  }

  function selectedKey() {
    const select = document.getElementById('techPathAIHelpVoiceSelect');

    if (select && select.value) {
      try {
        localStorage.setItem(VOICE_KEY, select.value);
        localStorage.setItem(OLD_VOICE_KEY, select.value);
      } catch (e) {}

      return select.value;
    }

    try {
      return localStorage.getItem(VOICE_KEY) || localStorage.getItem(OLD_VOICE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function getSelectedVoice() {
    const key = selectedKey();
    const voices = sortedVoices();

    if (!voices.length) return null;

    if (key) {
      const exact = voices.find(function (v) {
        return v.voiceURI === key || v.name === key;
      });

      if (exact) return exact;
    }

    return voices.find(isUS) || voices[0] || null;
  }

  function buildVoicePicker() {
    if (document.getElementById('techPathAIHelpStable')) {
      populateVoicePicker();
      return;
    }

    const box = document.createElement('details');
    box.id = 'techPathAIHelpStable';
    box.open = false;

    box.innerHTML = `
      <summary>🔊 เลือกเสียง AI Help</summary>
      <div class="body">
        <select id="techPathAIHelpVoiceSelect">
          <option value="">Loading voices...</option>
        </select>
        <button type="button" id="techPathAIHelpTestVoice">Test Voice</button>
        <div class="note" id="techPathAIHelpVoiceNote"></div>
      </div>
    `;

    document.body.appendChild(box);

    document.getElementById('techPathAIHelpVoiceSelect').addEventListener('change', function () {
      try {
        localStorage.setItem(VOICE_KEY, this.value);
        localStorage.setItem(OLD_VOICE_KEY, this.value);
      } catch (e) {}

      populateVoicePicker();
      speakStable('Voice selected. AI Help will use this voice.');
    });

    document.getElementById('techPathAIHelpTestVoice').addEventListener('click', function () {
      speakStable('Hello. This is the selected voice for AI Help.', {
        noCount: true
      });
    });

    populateVoicePicker();
  }

  function populateVoicePicker() {
    const select = document.getElementById('techPathAIHelpVoiceSelect');
    const note = document.getElementById('techPathAIHelpVoiceNote');

    if (!select) return;

    const voices = sortedVoices();
    const current = getSelectedVoice();

    if (!voices.length) {
      select.innerHTML = '<option value="">No English voice found</option>';
      if (note) note.textContent = 'ยังไม่พบเสียง English ใน browser นี้';
      return;
    }

    select.innerHTML = voices.map(function (v) {
      const tag = isUS(v) ? '🇺🇸 US • ' : 'EN • ';
      const selected = current && current.voiceURI === v.voiceURI ? 'selected' : '';

      return `<option value="${esc(v.voiceURI)}" ${selected}>${esc(tag + v.name + ' (' + v.lang + ')')}</option>`;
    }).join('');

    if (current) {
      try {
        localStorage.setItem(VOICE_KEY, current.voiceURI);
        localStorage.setItem(OLD_VOICE_KEY, current.voiceURI);
      } catch (e) {}

      if (note) note.innerHTML = `เสียงที่ใช้: <b>${esc(current.name)}</b> (${esc(current.lang)})`;
    }
  }

  function sessionKey() {
    const s =
      qs('session') ||
      qs('s') ||
      window.LESSON_SESSION ||
      window.currentSession ||
      window.currentS ||
      'S01';

    const level = qs('level') || qs('diff') || window.LESSON_LEVEL || window.currentLevel || 'normal';
    const pid = qs('pid') || qs('studentId') || qs('student_id') || window.studentId || 'anon';

    return `TECHPATH_AIHELP_USED_${pid}_${String(s).toUpperCase()}_${level}`;
  }

  function getCount() {
    try {
      return Number(sessionStorage.getItem(sessionKey()) || '0') || 0;
    } catch (e) {
      return 0;
    }
  }

  function setCount(n) {
    n = Math.max(0, Math.min(MAX_HELP, Number(n) || 0));

    try {
      sessionStorage.setItem(sessionKey(), String(n));
    } catch (e) {}

    window.TECHPATH_AIHELP_USED = n;
    window.LESSON_AIHELP_USED = n;
    window.TECHPATH_AIHELP_LIMIT = {
      used: n,
      max: MAX_HELP,
      remaining: Math.max(0, MAX_HELP - n)
    };

    updateCounterUi(n);

    return n;
  }

  function incCount(source) {
    const now = Date.now();

    if (now - lastCountAt < 900) {
      return getCount();
    }

    lastCountAt = now;

    const next = setCount(getCount() + 1);

    window.dispatchEvent(new CustomEvent('techpath:aihelp-count-updated', {
      detail: {
        patch: PATCH_ID,
        source: source || 'unknown',
        used: next,
        max: MAX_HELP
      }
    }));

    return next;
  }

  function findAiHelpLimitCards() {
    return Array.from(document.querySelectorAll('section, article, div, li'))
      .filter(function (el) {
        const t = txt(el);
        if (!/AI Help Limit/i.test(t)) return false;

        const r = el.getBoundingClientRect?.();
        if (!r) return true;

        return r.width > 100 && r.height > 35 && r.height < 280;
      });
  }

  function updateTextNodes(root, rx, replacement) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach(function (node) {
      const s = node.nodeValue || '';

      if (rx.test(s)) {
        node.nodeValue = s.replace(rx, replacement);
      }
    });
  }

  function updateCounterUi(n) {
    const usedText = `${n}/${MAX_HELP}`;

    findAiHelpLimitCards().forEach(function (card) {
      updateTextNodes(card, /ใช้แล้ว\s*\d+\s*\/\s*\d+\s*ครั้ง/g, `ใช้แล้ว ${usedText} ครั้ง`);
      updateTextNodes(card, /\b\d+\s*\/\s*\d+\b/g, usedText);

      if (!new RegExp(`${n}\\s*/\\s*${MAX_HELP}`).test(txt(card))) {
        const add = document.createElement('div');
        add.className = 'techpath-aihelp-count-added';
        add.textContent = `ใช้แล้ว ${usedText} ครั้ง`;
        add.style.cssText = 'margin-top:4px;font-weight:900;color:#eaffff;opacity:.88;';
        card.appendChild(add);
      }
    });
  }

  function showBadge(message) {
    let badge = document.getElementById('techPathAIHelpUsedBadge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'techPathAIHelpUsedBadge';
      document.body.appendChild(badge);
    }

    badge.innerHTML = message;
    badge.style.display = 'block';

    clearTimeout(badge._t);
    badge._t = setTimeout(function () {
      badge.style.display = 'none';
    }, 2800);
  }

  function isEnglishText(text) {
    const s = String(text || '').trim();
    const en = (s.match(/[A-Za-z]/g) || []).length;
    const th = (s.match(/[\u0E00-\u0E7F]/g) || []).length;

    return en >= 3 && en >= th;
  }

  function shouldForceVoice(u) {
    if (!u) return false;

    const text = String(u.text || '');
    const lang = String(u.lang || '').toLowerCase();

    return lang.startsWith('en') || isEnglishText(text);
  }

  function fixUtterance(u) {
    if (!u || !shouldForceVoice(u)) return u;

    const voice = getSelectedVoice();

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    } else {
      u.lang = 'en-US';
    }

    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1;

    const oldStart = u.onstart;

    if (!u.__techPathStableVoiceBound) {
      u.__techPathStableVoiceBound = true;

      u.onstart = function (ev) {
        const v = getSelectedVoice();

        if (v) {
          showBadge(`🔊 AI Help: <b>${esc(v.name)}</b> (${esc(v.lang)})`);
        }

        if (typeof oldStart === 'function') {
          try {
            oldStart.call(this, ev);
          } catch (e) {}
        }
      };
    }

    return u;
  }

  function cleanSpeakText(text) {
    return String(text || '')
      .replace(/[🎯🏠▶️📊🎤📖👾🎧🏆⭐🔥⚡💡✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speakStable(text, options) {
    options = options || {};

    const msg = cleanSpeakText(text);
    if (!msg || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;

    if (!options.noCount) {
      incCount('speakStable');
    }

    const u = new SpeechSynthesisUtterance(msg);
    fixUtterance(u);

    try {
      if (nativeCancel) nativeCancel();
      else window.speechSynthesis.cancel();
    } catch (e) {}

    if (nativeSpeak) nativeSpeak(u);
    else window.speechSynthesis.speak(u);

    return true;
  }

  function patchNativeSpeak() {
    if (!window.speechSynthesis || !window.speechSynthesis.speak) return;

    if (!nativeSpeak) {
      nativeSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    }

    if (!nativeCancel && window.speechSynthesis.cancel) {
      nativeCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
    }

    if (window.speechSynthesis.speak.__techPathStablePatched) return;

    const wrapped = function (utterance) {
      try {
        fixUtterance(utterance);
      } catch (e) {}

      return nativeSpeak(utterance);
    };

    wrapped.__techPathStablePatched = true;
    window.speechSynthesis.speak = wrapped;
  }

  function isVoicePanel(el) {
    return !!(
      el &&
      el.closest &&
      el.closest('#techPathAIHelpStable')
    );
  }

  function isAiHelpButton(el) {
    if (!el || isVoicePanel(el)) return false;

    const label = txt(el).toLowerCase();
    const aria = String(el.getAttribute && el.getAttribute('aria-label') || '').toLowerCase();
    const s = label + ' ' + aria;

    if (/test voice|เลือกเสียง|voice/i.test(s)) return false;

    return (
      el.hasAttribute?.('data-ai-help') ||
      el.hasAttribute?.('data-aihelp') ||
      el.classList?.contains('ai-help-btn') ||
      s.includes('ai help') ||
      s.includes('hint') ||
      s.includes('coach')
    );
  }

  function bindAiHelpButtons() {
    Array.from(document.querySelectorAll('button, a, [role="button"]')).forEach(function (btn) {
      if (btn.dataset.techPathStableAihelpBound === '1') return;
      if (!isAiHelpButton(btn)) return;

      btn.dataset.techPathStableAihelpBound = '1';

      btn.addEventListener('click', function () {
        incCount('aihelp-button-click');
      }, true);
    });
  }

  function patchAiHelpGlobals() {
    const names = [
      'speakAIHelpUS',
      'speakAIHelp',
      'playAIHelpVoice',
      'playAiHelpVoice',
      'speakCoach',
      'speakHint'
    ];

    names.forEach(function (name) {
      const old = window[name];

      if (typeof old === 'function' && old.__techPathStableCounterWrapped) return;

      const wrapped = function () {
        const first = String(arguments[0] || '');

        if (!/voice selected|test voice|selected voice/i.test(first)) {
          incCount('aihelp-global-' + name);
        }

        return speakStable(first || 'Here is your AI help.', {
          noCount: true
        });
      };

      wrapped.__techPathStableCounterWrapped = true;
      window[name] = wrapped;
    });

    window.TechPathAIHelpStable = {
      version: PATCH_ID,
      speak: speakStable,
      getSelectedVoice,
      openVoice: function () {
        buildVoicePicker();
        document.getElementById('techPathAIHelpStable').open = true;
      },
      count: getCount,
      reset: function () {
        return setCount(0);
      },
      debug: function () {
        const v = getSelectedVoice();

        return {
          patch: PATCH_ID,
          voicePanel: !!document.getElementById('techPathAIHelpStable'),
          selectedVoice: v ? {
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI
          } : null,
          count: getCount(),
          max: MAX_HELP,
          counterCards: findAiHelpLimitCards().length,
          nativeSpeakPatched: !!(
            window.speechSynthesis &&
            window.speechSynthesis.speak &&
            window.speechSynthesis.speak.__techPathStablePatched
          )
        };
      }
    };
  }

  function init() {
    injectStyle();
    buildVoicePicker();
    patchNativeSpeak();
    patchAiHelpGlobals();
    bindAiHelpButtons();
    updateCounterUi(getCount());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;

    init();

    if (tries >= 30) clearInterval(timer);
  }, 500);

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      init();
      populateVoicePicker();
    };
  }

  try {
    const mo = new MutationObserver(function () {
      bindAiHelpButtons();
      updateCounterUi(getCount());
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(function () {
      try { mo.disconnect(); } catch (e) {}
    }, 20000);
  } catch (e) {}
})();
