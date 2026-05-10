/* =========================================================
 * /english/js/techpath-aihelp-voice-counter-stable.js
 * CLEAN REBUILD
 * PATCH v20260510k-VOICE-ONLY-CLEAN
 *
 * หน้าที่ไฟล์นี้:
 * ✅ เลือกเสียง AI Help ได้
 * ✅ บังคับ Web Speech API ให้ใช้เสียงที่เลือกจริง
 * ✅ เลือกเสียง US / English ที่เหมาะกับบทเรียนก่อน
 * ✅ ซ่อนเสียงแปลก/เสียงตลก เช่น Bubbles, Bells, Jester, Bad News
 * ✅ ไม่แตะ AI Help counter แล้ว
 * ✅ lesson.html เป็นเจ้าของ counter ผ่าน registerAiHelpUse()
 *
 * IMPORTANT:
 * ห้ามโหลดไฟล์ voice/counter ตัวอื่นซ้อนกับไฟล์นี้
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-aihelp-voice-only-clean-v20260510k';

  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';
  const PRESET_KEY = 'TECHPATH_AIHELP_VOICE_PRESET';

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
  let nativeSpeakPatched = false;

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

  function cleanSpeakText(text) {
    return String(text || '')
      .replace(/[🎯🏠▶️📊🎤📖👾🎧🏆⭐🔥⚡💡✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
        touch-action: manipulation !important;
      }

      #techPathAIHelpStable .body {
        padding: 0 12px 12px !important;
      }

      #techPathAIHelpStable select {
        width: 100% !important;
        height: 42px !important;
        border-radius: 12px !important;
        border: 1px solid rgba(105,232,255,.32) !important;
        background: #101f32 !important;
        color: #eaffff !important;
        padding: 0 10px !important;
        font-weight: 900 !important;
        outline: none !important;
        touch-action: manipulation !important;
      }

      #techPathAIHelpStable select + select {
        margin-top: 8px !important;
      }

      #techPathAIHelpStable button {
        margin-top: 8px !important;
        width: 100% !important;
        min-height: 40px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #65e8ff !important;
        color: #06202a !important;
        font-weight: 1000 !important;
        touch-action: manipulation !important;
      }

      #techPathAIHelpStable button.secondary {
        background: rgba(255,255,255,.13) !important;
        color: #eaffff !important;
        border: 1px solid rgba(255,255,255,.16) !important;
      }

      #techPathAIHelpStable .note {
        font-size: 12px !important;
        opacity: .82 !important;
        margin-top: 8px !important;
      }

      #techPathAIHelpVoiceBadge {
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

  function showBadge(message) {
    let badge = document.getElementById('techPathAIHelpVoiceBadge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'techPathAIHelpVoiceBadge';
      document.body.appendChild(badge);
    }

    badge.innerHTML = message;
    badge.style.display = 'block';

    clearTimeout(badge._t);
    badge._t = setTimeout(function () {
      badge.style.display = 'none';
    }, 2200);
  }

  function getVoices() {
    try {
      if (!window.speechSynthesis) return [];
      return window.speechSynthesis.getVoices() || [];
    } catch (e) {
      return [];
    }
  }

  function isEnglish(v) {
    return String(v && v.lang ? v.lang : '').toLowerCase().startsWith('en');
  }

  function isBadAccent(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;
    return /en-gb|united kingdom|british|en-au|australia|australian|en-in|india|indian/i.test(s);
  }

  function isUS(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;
    const lang = String(v && v.lang ? v.lang : '').toLowerCase();

    return (
      lang === 'en-us' ||
      /united states|google us|us english|samantha|alex|jenny|aria|ava|zira|david|guy|mark/i.test(s)
    );
  }

  function isNoveltyVoice(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;

    return /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|hysterical|jester|junior|organ|superstar|trinoids|whisper|zarvox|deranged|pipe organ|wobble|flo|fred|grandma|grandpa|reed|rocko|sandy|shelley|ralph|kathy|princess|vicki|victoria/i.test(s);
  }

  function voiceScore(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;
    const lang = String(v && v.lang ? v.lang : '').toLowerCase();

    let score = 0;

    if (lang === 'en-us') score += 5000;
    if (/united states/i.test(s)) score += 2500;
    if (/us english/i.test(s)) score += 1500;
    if (/\bus\b/i.test(s)) score += 900;

    if (/Google US English/i.test(s)) score += 3500;
    if (/Samantha/i.test(s)) score += 3200;

    if (/Microsoft Jenny/i.test(s)) score += 3100;
    if (/Microsoft Aria/i.test(s)) score += 3000;
    if (/Microsoft Ava/i.test(s)) score += 2900;
    if (/Microsoft Ana/i.test(s)) score += 2700;
    if (/Microsoft Zira/i.test(s)) score += 2500;
    if (/Alex/i.test(s)) score += 2300;

    if (/Microsoft Guy/i.test(s)) score += 1900;
    if (/Microsoft David/i.test(s)) score += 1600;
    if (/Microsoft Mark/i.test(s)) score += 1400;

    if (isBadAccent(v)) score -= 10000;
    if (isNoveltyVoice(v)) score -= 20000;

    if (/default/i.test(s)) score -= 500;
    if (/compact/i.test(s)) score -= 500;
    if (/novelty/i.test(s)) score -= 800;

    return score;
  }

  function sortedVoices() {
    const voices = getVoices().filter(isEnglish);
    const clean = voices.filter(function (v) {
      return !isNoveltyVoice(v);
    });

    return (clean.length ? clean : voices)
      .sort(function (a, b) {
        return voiceScore(b) - voiceScore(a);
      });
  }

  function saveSelectedVoice(voice) {
    if (!voice) return;

    try {
      localStorage.setItem(VOICE_KEY, voice.voiceURI || voice.name);
      localStorage.setItem(OLD_VOICE_KEY, voice.voiceURI || voice.name);
    } catch (e) {}
  }

  function getSavedVoiceKey() {
    try {
      return localStorage.getItem(VOICE_KEY) || localStorage.getItem(OLD_VOICE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function getBestUSVoice() {
    const voices = sortedVoices();
    return voices[0] || null;
  }

  function getSelectedVoice() {
    const voices = sortedVoices();

    if (!voices.length) return null;

    const select = document.getElementById('techPathAIHelpVoiceSelect');

    if (select && select.value) {
      const selected = voices.find(function (v) {
        return v.voiceURI === select.value || v.name === select.value;
      });

      if (selected) {
        saveSelectedVoice(selected);
        return selected;
      }
    }

    const saved = getSavedVoiceKey();

    if (saved) {
      const exact = voices.find(function (v) {
        return v.voiceURI === saved || v.name === saved;
      });

      if (exact) return exact;

      const loose = voices.find(function (v) {
        const name = String(v.name || '');
        const uri = String(v.voiceURI || '');

        return (
          saved.includes(name) ||
          name.includes(saved) ||
          saved.includes(uri) ||
          uri.includes(saved)
        );
      });

      if (loose) return loose;
    }

    const best = getBestUSVoice();
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
        const voices = sortedVoices();
        const selected = voices.find(function (v) {
          return v.voiceURI === voiceSelect.value || v.name === voiceSelect.value;
        });

        saveSelectedVoice(selected);
        populateVoicePicker();

        speakStable('Voice selected. AI Help will use this voice.');
      });
    }

    if (presetSelect && presetSelect.dataset.bound !== '1') {
      presetSelect.dataset.bound = '1';
      presetSelect.value = getVoicePresetKey();

      presetSelect.addEventListener('change', function () {
        try {
          localStorage.setItem(PRESET_KEY, presetSelect.value || DEFAULT_VOICE_PRESET);
        } catch (e) {}

        populateVoicePicker();
        speakStable('Voice style selected.');
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
        speakStable('Auto best American English voice selected.');
      });
    }

    if (testButton && testButton.dataset.bound !== '1') {
      testButton.dataset.bound = '1';

      testButton.addEventListener('click', function () {
        speakStable('Hello. This is the selected voice for AI Help. Speak clearly and focus on the key words.');
      });
    }
  }

  function populateVoicePicker() {
    const select = document.getElementById('techPathAIHelpVoiceSelect');
    const presetSelect = document.getElementById('techPathAIHelpVoicePreset');
    const note = document.getElementById('techPathAIHelpVoiceNote');

    if (!select) return;

    const voices = sortedVoices();

    if (!voices.length) {
      select.innerHTML = '<option value="">No English voice found</option>';
      if (note) note.textContent = 'ยังไม่พบเสียง English ใน browser นี้';
      return;
    }

    const current = getSelectedVoice();

    select.innerHTML = voices.map(function (v) {
      const tag = isUS(v) && !isBadAccent(v) ? '🇺🇸 US • ' : 'EN • ';
      const selected = current && current.voiceURI === v.voiceURI ? 'selected' : '';

      return `<option value="${esc(v.voiceURI)}" ${selected}>${esc(tag + v.name + ' (' + v.lang + ')')}</option>`;
    }).join('');

    if (presetSelect) {
      presetSelect.value = getVoicePresetKey();
    }

    if (current && note) {
      const preset = getVoicePreset();

      note.innerHTML =
        `เสียงที่ใช้: <b>${esc(current.name)}</b> (${esc(current.lang)})<br>` +
        `โทนเสียง: <b>${esc(preset.label)}</b> • rate ${preset.rate} / pitch ${preset.pitch}`;
    }
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

    if (!u.__techPathVoiceBound) {
      u.__techPathVoiceBound = true;

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
            mode: 'voice-only',
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

  function speakStable(text) {
    const msg = cleanSpeakText(text);

    if (!msg || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      return false;
    }

    const u = new SpeechSynthesisUtterance(msg);
    fixUtterance(u);

    try {
      if (nativeCancel) nativeCancel();
      else window.speechSynthesis.cancel();
    } catch (e) {}

    try {
      if (nativeSpeak) nativeSpeak(u);
      else window.speechSynthesis.speak(u);

      return true;
    } catch (e) {
      console.warn('[TechPath Voice] speak failed', e);
      return false;
    }
  }

  function patchNativeSpeak() {
    if (!window.speechSynthesis || !window.speechSynthesis.speak) return;

    if (!nativeSpeak) {
      nativeSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    }

    if (!nativeCancel && window.speechSynthesis.cancel) {
      nativeCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
    }

    if (nativeSpeakPatched || window.speechSynthesis.speak.__techPathVoicePatched) return;

    const wrappedSpeak = function (utterance) {
      try {
        fixUtterance(utterance);
      } catch (e) {}

      return nativeSpeak(utterance);
    };

    wrappedSpeak.__techPathVoicePatched = true;
    window.speechSynthesis.speak = wrappedSpeak;
    nativeSpeakPatched = true;
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

      if (typeof old === 'function' && old.__techPathVoiceWrapped) return;

      const wrapped = function () {
        const first = String(arguments[0] || '');

        return speakStable(first || 'Here is your AI help.');
      };

      wrapped.__techPathVoiceWrapped = true;
      window[name] = wrapped;
    });

    window.TechPathAIHelpStable = {
      version: PATCH_ID,
      mode: 'voice-only-clean',
      speak: speakStable,
      getSelectedVoice: getSelectedVoice,
      getBestUSVoice: getBestUSVoice,
      getVoicePreset: getVoicePreset,

      openVoice: function () {
        buildVoicePicker();
        const el = document.getElementById('techPathAIHelpStable');
        if (el) el.open = true;
      },

      closeVoice: function () {
        const el = document.getElementById('techPathAIHelpStable');
        if (el) el.open = false;
      },

      count: function () {
        return window.LESSON_AIHELP_USED || window.TECHPATH_AIHELP_USED || 0;
      },

      reset: function () {
        return true;
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
          mode: 'voice-only-clean',
          voicePanel: !!document.getElementById('techPathAIHelpStable'),
          selectedVoice: v ? {
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            score: voiceScore(v)
          } : null,
          preset: p,
          lessonCounter: {
            LESSON_AIHELP_USED: window.LESSON_AIHELP_USED,
            TECHPATH_AIHELP_USED: window.TECHPATH_AIHELP_USED,
            TECHPATH_AIHELP_LIMIT: window.TECHPATH_AIHELP_LIMIT
          },
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
            window.speechSynthesis.speak.__techPathVoicePatched
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      populateVoicePicker();
      patchNativeSpeak();
    };
  }

  setTimeout(init, 300);
  setTimeout(init, 1200);
  setTimeout(function () {
    populateVoicePicker();
  }, 2200);
})();
