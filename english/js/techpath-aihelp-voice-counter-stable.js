/* =========================================================
 * /english/js/techpath-aihelp-voice-counter-stable.js
 * PATCH v20260510f-AIHELP-VOICE-COUNTER-STABLE-HIDE-NOVELTY
 *
 * ใช้ไฟล์นี้ตัวเดียวสำหรับ AI Help:
 * ✅ มีรายการเสียงให้เลือกเองได้จริง
 * ✅ เลือกเสียงแล้วใช้เสียงนั้นจริง
 * ✅ ซ่อน/กรองเสียงตลก เสียงเอฟเฟกต์ เสียงแปลก เช่น Bubbles, Bells, Jester, Bad News
 * ✅ มีปุ่ม Auto Best US Voice สำหรับเลือกเสียง American English ที่ดีที่สุดอัตโนมัติ
 * ✅ มี preset โทนเสียง Teacher / Clear US / Coach
 * ✅ AI Help ใช้เสียงที่เลือกไว้จริงทุกครั้ง
 * ✅ กด AI Help แล้วนับ 0/3 -> 1/3 -> 2/3 -> 3/3
 * ✅ ครบ 3 ครั้งแล้วกันไม่ให้ใช้ AI Help เพิ่ม
 * ✅ ไม่ยุ่งกับ route / level / student / loading
 * ✅ ไม่บังปุ่มเล่นเกม
 *
 * IMPORTANT:
 * อย่าโหลดไฟล์ voice/counter ตัวอื่นซ้อนกับไฟล์นี้
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-aihelp-voice-counter-stable-v20260510f-hide-novelty';

  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';
  const PRESET_KEY = 'TECHPATH_AIHELP_VOICE_PRESET';

  const MAX_HELP = 3;

  /*
   * false = ให้ผู้ใช้เลือกเสียงเองจาก dropdown ได้จริง
   * ถ้าต้องการเสียง US ที่ดีที่สุด ให้กดปุ่ม "Auto Best US Voice"
   */
  const FORCE_BEST_US_VOICE = false;

  const VOICE_QUALITY_PRESETS = {
    teacher: {
      label: 'Teacher Voice',
      rate: 0.93,
      pitch: 1.03,
      volume: 1
    },
    clear: {
      label: 'Clear US Voice',
      rate: 0.94,
      pitch: 1.0,
      volume: 1
    },
    coach: {
      label: 'Coach Voice',
      rate: 0.96,
      pitch: 0.98,
      volume: 1
    }
  };

  const DEFAULT_VOICE_PRESET = 'teacher';

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

  function normSession(v) {
    const raw = String(v || '').trim().toUpperCase();

    if (/^S(0[1-9]|1[0-5])$/.test(raw)) return raw;

    const m = raw.match(/(\d{1,2})/);
    if (m) {
      const n = Math.max(1, Math.min(15, Number(m[1]) || 1));
      return 'S' + String(n).padStart(2, '0');
    }

    return 'S01';
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
        z-index: 9999998 !important;
        width: min(440px, calc(100vw - 20px)) !important;
        border-radius: 16px !important;
        border: 1px solid rgba(105,232,255,.38) !important;
        background: rgba(6,18,34,.96) !important;
        color: #eaffff !important;
        box-shadow: 0 18px 48px rgba(0,0,0,.36) !important;
        overflow: hidden !important;
        font: 800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif !important;
        pointer-events: auto !important;
      }

      #techPathAIHelpStable,
      #techPathAIHelpStable * {
        pointer-events: auto !important;
      }

      #techPathAIHelpStable summary {
        cursor: pointer !important;
        padding: 10px 12px !important;
        color: #75eeff !important;
        font-weight: 1000 !important;
        user-select: none !important;
        position: relative !important;
        z-index: 9999999 !important;
        touch-action: manipulation !important;
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
        outline: none !important;
        position: relative !important;
        z-index: 9999999 !important;
        touch-action: manipulation !important;
      }

      #techPathAIHelpStable select + select {
        margin-top: 8px !important;
      }

      #techPathAIHelpStable button {
        margin-top: 8px !important;
        width: 100% !important;
        min-height: 38px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #65e8ff !important;
        color: #06202a !important;
        font-weight: 1000 !important;
        position: relative !important;
        z-index: 9999999 !important;
        touch-action: manipulation !important;
      }

      #techPathAIHelpStable button.secondary {
        background: rgba(255,255,255,.13) !important;
        color: #eaffff !important;
        border: 1px solid rgba(255,255,255,.16) !important;
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
        z-index: 9999999 !important;
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

      .techpath-aihelp-count-added {
        margin-top: 4px !important;
        font-weight: 900 !important;
        color: #eaffff !important;
        opacity: .88 !important;
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
    return String(v && v.lang ? v.lang : '').toLowerCase().startsWith('en');
  }

  function isUS(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;
    const lang = String(v && v.lang ? v.lang : '').toLowerCase();

    return (
      lang === 'en-us' ||
      /united states|google us|us english|samantha|alex|jenny|aria|ava|zira|david|guy|mark/i.test(s)
    );
  }

  function isBadAccent(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;

    return /en-gb|united kingdom|british|en-au|australia|australian|en-in|india|indian/i.test(s);
  }

  function isNoveltyVoice(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;

    /*
     * กรองเสียงเอฟเฟกต์/เสียงตลก/เสียงประหลาดที่ไม่เหมาะกับบทเรียน
     * โดยเฉพาะ Chrome/macOS voices เช่น Bubbles, Bells, Jester, Bad News
     */
    return /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|hysterical|jester|junior|organ|superstar|trinoids|whisper|zarvox|deranged|pipe organ|wobble|zarvox|flo|fred|grandma|grandpa|reed|rocko|sandy|shelley|ralph|kathy|princess|vicki|victoria/i.test(s);
  }

  function voiceScore(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;
    const lang = String(v && v.lang ? v.lang : '').toLowerCase();

    let score = 0;

    if (lang === 'en-us') score += 5000;
    if (/united states/i.test(s)) score += 2500;
    if (/us english/i.test(s)) score += 1500;
    if (/\bus\b/i.test(s)) score += 900;

    if (/Google US English/i.test(s)) score += 3200;

    if (/Microsoft Jenny/i.test(s)) score += 3000;
    if (/Microsoft Aria/i.test(s)) score += 2900;
    if (/Microsoft Ava/i.test(s)) score += 2800;
    if (/Microsoft Ana/i.test(s)) score += 2600;
    if (/Samantha/i.test(s)) score += 2500;
    if (/Microsoft Zira/i.test(s)) score += 2300;
    if (/Alex/i.test(s)) score += 2100;

    /*
     * เสียงผู้ชายชัด แต่บางเครื่องแข็ง/แหบกว่า จึงให้รองลงมา
     */
    if (/Microsoft Guy/i.test(s)) score += 1800;
    if (/Microsoft David/i.test(s)) score += 1500;
    if (/Microsoft Mark/i.test(s)) score += 1300;

    if (isBadAccent(v)) score -= 10000;
    if (isNoveltyVoice(v)) score -= 20000;

    if (/default/i.test(s)) score -= 500;
    if (/compact/i.test(s)) score -= 500;
    if (/novelty/i.test(s)) score -= 800;

    return score;
  }

  function sortedVoices() {
    const voices = getVoices().filter(isEnglish);

    /*
     * ปกติให้ตัด novelty voices ออกจาก dropdown
     * ถ้าเครื่องมีแต่เสียง novelty จริง ๆ จึง fallback กลับไปใช้ voices ทั้งหมด
     */
    const clean = voices.filter(function (v) {
      return !isNoveltyVoice(v);
    });

    return (clean.length ? clean : voices)
      .sort(function (a, b) {
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

  function saveSelectedVoice(voice) {
    if (!voice) return;

    try {
      localStorage.setItem(VOICE_KEY, voice.voiceURI || voice.name);
      localStorage.setItem(OLD_VOICE_KEY, voice.voiceURI || voice.name);
    } catch (e) {}
  }

  function getBestUSVoice() {
    const voices = sortedVoices();
    return voices[0] || null;
  }

  function getSelectedVoice() {
    const voices = sortedVoices();

    if (!voices.length) return null;

    if (FORCE_BEST_US_VOICE) {
      const best = voices[0] || null;
      saveSelectedVoice(best);
      return best;
    }

    const key = selectedKey();

    if (key) {
      const exact = voices.find(function (v) {
        return v.voiceURI === key || v.name === key;
      });

      if (exact) return exact;

      const loose = voices.find(function (v) {
        const name = String(v.name || '');
        const uri = String(v.voiceURI || '');

        return (
          key.includes(name) ||
          name.includes(key) ||
          key.includes(uri) ||
          uri.includes(key)
        );
      });

      if (loose) return loose;
    }

    const best = voices[0] || null;
    saveSelectedVoice(best);
    return best;
  }

  function getVoicePresetKey() {
    try {
      const saved = localStorage.getItem(PRESET_KEY) || DEFAULT_VOICE_PRESET;
      return VOICE_QUALITY_PRESETS[saved] ? saved : DEFAULT_VOICE_PRESET;
    } catch (e) {
      return DEFAULT_VOICE_PRESET;
    }
  }

  function getVoicePreset() {
    return VOICE_QUALITY_PRESETS[getVoicePresetKey()] || VOICE_QUALITY_PRESETS.teacher;
  }

  function buildVoicePicker() {
    if (document.getElementById('techPathAIHelpStable')) {
      populateVoicePicker();
      bindVoicePickerControls();
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

        <select id="techPathAIHelpVoicePreset">
          <option value="teacher">👩 Teacher Voice — นุ่ม ชัด เหมาะกับการสอน</option>
          <option value="clear">🇺🇸 Clear US Voice — ชัด กลาง ๆ</option>
          <option value="coach">🧑‍🏫 Coach Voice — กระชับ มั่นใจ</option>
        </select>

        <button type="button" id="techPathAIHelpAutoVoice">🇺🇸 Auto Best US Voice</button>
        <button type="button" class="secondary" id="techPathAIHelpTestVoice">Test Voice</button>
        <div class="note" id="techPathAIHelpVoiceNote"></div>
      </div>
    `;

    document.body.appendChild(box);

    bindVoicePickerControls();
    populateVoicePicker();
  }

  function bindVoicePickerControls() {
    const voiceSelect = document.getElementById('techPathAIHelpVoiceSelect');
    const presetSelect = document.getElementById('techPathAIHelpVoicePreset');
    const autoButton = document.getElementById('techPathAIHelpAutoVoice');
    const testButton = document.getElementById('techPathAIHelpTestVoice');

    if (voiceSelect && voiceSelect.dataset.bound !== '1') {
      voiceSelect.dataset.bound = '1';

      voiceSelect.addEventListener('change', function () {
        try {
          localStorage.setItem(VOICE_KEY, this.value);
          localStorage.setItem(OLD_VOICE_KEY, this.value);
        } catch (e) {}

        populateVoicePicker();

        speakStable('Voice selected. AI Help will use this voice.', {
          noCount: true
        });
      });
    }

    if (presetSelect && presetSelect.dataset.bound !== '1') {
      presetSelect.dataset.bound = '1';
      presetSelect.value = getVoicePresetKey();

      presetSelect.addEventListener('change', function () {
        try {
          localStorage.setItem(PRESET_KEY, this.value || DEFAULT_VOICE_PRESET);
        } catch (e) {}

        populateVoicePicker();

        speakStable('Voice style selected. AI Help will use this speaking style.', {
          noCount: true
        });
      });
    }

    if (autoButton && autoButton.dataset.bound !== '1') {
      autoButton.dataset.bound = '1';

      autoButton.addEventListener('click', function () {
        const best = getBestUSVoice();

        if (!best) {
          showBadge('⚠️ ยังไม่พบเสียง English ใน browser นี้');
          return;
        }

        saveSelectedVoice(best);

        try {
          localStorage.setItem(PRESET_KEY, 'teacher');
        } catch (e) {}

        const select = document.getElementById('techPathAIHelpVoiceSelect');
        if (select) select.value = best.voiceURI || best.name;

        populateVoicePicker();

        speakStable('Auto best American English voice selected.', {
          noCount: true
        });
      });
    }

    if (testButton && testButton.dataset.bound !== '1') {
      testButton.dataset.bound = '1';

      testButton.addEventListener('click', function () {
        speakStable('Hello. This is the selected voice for AI Help. Speak clearly and focus on the key words.', {
          noCount: true
        });
      });
    }
  }

  function populateVoicePicker() {
    const select = document.getElementById('techPathAIHelpVoiceSelect');
    const presetSelect = document.getElementById('techPathAIHelpVoicePreset');
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
      const tag = isUS(v) && !isBadAccent(v) ? '🇺🇸 US • ' : 'EN • ';
      const selected = current && current.voiceURI === v.voiceURI ? 'selected' : '';

      return `<option value="${esc(v.voiceURI)}" ${selected}>${esc(tag + v.name + ' (' + v.lang + ')')}</option>`;
    }).join('');

    if (presetSelect) {
      presetSelect.value = getVoicePresetKey();
    }

    if (current) {
      const preset = getVoicePreset();

      if (note) {
        note.innerHTML =
          `เสียงที่ใช้: <b>${esc(current.name)}</b> (${esc(current.lang)})<br>` +
          `โทนเสียง: <b>${esc(preset.label)}</b> • rate ${preset.rate} / pitch ${preset.pitch}`;
      }
    }
  }

  function sessionKey() {
    const rawSession =
      qs('session') ||
      qs('s') ||
      window.LESSON_SESSION ||
      window.currentSession ||
      window.currentS ||
      'S01';

    const session = normSession(rawSession);
    const level = qs('level') || qs('diff') || window.LESSON_LEVEL || window.currentLevel || 'normal';
    const pid = qs('pid') || qs('studentId') || qs('student_id') || window.studentId || 'anon';

    return `TECHPATH_AIHELP_USED_${pid}_${session}_${level}`;
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
        max: MAX_HELP,
        sessionKey: sessionKey()
      }
    }));

    return next;
  }

  function findAiHelpLimitCards() {
    return Array.from(document.querySelectorAll('section, article, div, li'))
      .filter(function (el) {
        const t = txt(el);
        if (!/AI Help Limit|AI Coach|AI Help/i.test(t)) return false;

        const r = el.getBoundingClientRect?.();
        if (!r) return true;

        return r.width > 100 && r.height > 35 && r.height < 320;
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

      const exists = card.querySelector('.techpath-aihelp-count-added');

      if (!new RegExp(`${n}\\s*/\\s*${MAX_HELP}`).test(txt(card))) {
        if (!exists) {
          const add = document.createElement('div');
          add.className = 'techpath-aihelp-count-added';
          add.textContent = `ใช้แล้ว ${usedText} ครั้ง`;
          card.appendChild(add);
        } else {
          exists.textContent = `ใช้แล้ว ${usedText} ครั้ง`;
        }
      } else if (exists) {
        exists.textContent = `ใช้แล้ว ${usedText} ครั้ง`;
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
    const preset = getVoicePreset();

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    } else {
      u.lang = 'en-US';
    }

    u.rate = preset.rate;
    u.pitch = preset.pitch;
    u.volume = preset.volume;

    if (!u.__techPathStableVoiceBound) {
      u.__techPathStableVoiceBound = true;

      const oldStart = u.onstart;

      u.onstart = function (ev) {
        const v = getSelectedVoice();
        const p = getVoicePreset();

        if (v) {
          showBadge(`🔊 AI Help: <b>${esc(v.name)}</b> (${esc(v.lang)}) • ${esc(p.label)}`);
        }

        window.dispatchEvent(new CustomEvent('techpath:aihelp-voice-used', {
          detail: {
            patch: PATCH_ID,
            voiceName: v ? v.name : '',
            voiceLang: v ? v.lang : '',
            preset: p.label,
            rate: p.rate,
            pitch: p.pitch,
            text: u.text || ''
          }
        }));

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
      if (getCount() >= MAX_HELP) {
        showBadge(`⚠️ ใช้ AI Help ครบแล้ว (${MAX_HELP}/${MAX_HELP})`);
        return false;
      }

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

    if (/test voice|เลือกเสียง|voice|selected voice/i.test(s)) return false;

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

      btn.addEventListener('click', function (ev) {
        if (getCount() >= MAX_HELP) {
          ev.preventDefault();
          ev.stopPropagation();
          showBadge(`⚠️ ใช้ AI Help ครบแล้ว (${MAX_HELP}/${MAX_HELP})`);
          return false;
        }

        incCount('aihelp-button-click');
        return true;
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

        if (!/voice selected|test voice|selected voice|voice style selected|auto best american/i.test(first)) {
          if (getCount() >= MAX_HELP) {
            showBadge(`⚠️ ใช้ AI Help ครบแล้ว (${MAX_HELP}/${MAX_HELP})`);
            return false;
          }

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
      getBestUSVoice,
      getVoicePreset,
      openVoice: function () {
        buildVoicePicker();
        document.getElementById('techPathAIHelpStable').open = true;
      },
      closeVoice: function () {
        const el = document.getElementById('techPathAIHelpStable');
        if (el) el.open = false;
      },
      count: getCount,
      reset: function () {
        return setCount(0);
      },
      clearSelectedVoice: function () {
        try {
          localStorage.removeItem(VOICE_KEY);
          localStorage.removeItem(OLD_VOICE_KEY);
        } catch (e) {}

        const select = document.getElementById('techPathAIHelpVoiceSelect');
        if (select) select.value = '';

        populateVoicePicker();
        return getSelectedVoice();
      },
      setBestUSVoice: function () {
        const best = getBestUSVoice();

        if (best) {
          saveSelectedVoice(best);

          try {
            localStorage.setItem(PRESET_KEY, 'teacher');
          } catch (e) {}

          populateVoicePicker();
        }

        return best;
      },
      setPreset: function (presetKey) {
        if (!VOICE_QUALITY_PRESETS[presetKey]) presetKey = DEFAULT_VOICE_PRESET;

        try {
          localStorage.setItem(PRESET_KEY, presetKey);
        } catch (e) {}

        populateVoicePicker();
        return getVoicePreset();
      },
      debug: function () {
        const v = getSelectedVoice();
        const p = getVoicePreset();

        return {
          patch: PATCH_ID,
          forceBestUSVoice: FORCE_BEST_US_VOICE,
          voicePanel: !!document.getElementById('techPathAIHelpStable'),
          selectedVoice: v ? {
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            score: voiceScore(v)
          } : null,
          preset: p,
          count: getCount(),
          max: MAX_HELP,
          sessionKey: sessionKey(),
          counterCards: findAiHelpLimitCards().length,
          voices: sortedVoices().map(function (voice) {
            return {
              name: voice.name,
              lang: voice.lang,
              voiceURI: voice.voiceURI,
              score: voiceScore(voice)
            };
          }),
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
