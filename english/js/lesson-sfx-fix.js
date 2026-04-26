// === /english/js/lesson-sfx-fix.js ===
// PATCH v20260426a-LESSON-SFX-RESTORE
// Restore SFX for TechPath VR / English Lesson
// ✅ Correct / Wrong / Pass / Click sounds
// ✅ No external audio files needed
// ✅ Uses WebAudio synth tones
// ✅ Works with new mission panel + speaking/writing/listening/reading events
// ✅ Avoids duplicate SFX from repeated events

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-SFX-RESTORE';

  const CONFIG = {
    enabled: true,
    volume: 0.42,
    clickVolume: 0.18,
    debounceMs: 180
  };

  let audioCtx = null;
  let unlocked = false;
  let lastKey = '';
  let lastAt = 0;

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function isMutedByQuery() {
    const p = q();
    const sfx = safe(p.get('sfx') || p.get('sound') || '').toLowerCase();
    return ['0', 'off', 'false', 'mute', 'muted'].includes(sfx);
  }

  function getAudioContext() {
    if (isMutedByQuery()) return null;

    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function unlockAudio() {
    if (unlocked) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.value = 0.0001;
      osc.frequency.value = 440;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.02);

      unlocked = true;
    } catch (err) {}
  }

  function tone(freq, start, duration, gainValue, type = 'sine') {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, gainValue),
      ctx.currentTime + start + 0.012
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + start + duration
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.03);
  }

  function noiseBurst(start, duration, gainValue) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 900;

    gain.gain.setValueAtTime(gainValue, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(ctx.currentTime + start);
    source.stop(ctx.currentTime + start + duration + 0.02);
  }

  function playCorrect() {
    const v = CONFIG.volume;
    tone(660, 0.00, 0.09, v * 0.42, 'sine');
    tone(880, 0.08, 0.10, v * 0.48, 'sine');
    tone(1320, 0.17, 0.12, v * 0.36, 'triangle');
    flash('correct');
  }

  function playWrong() {
    const v = CONFIG.volume;
    tone(220, 0.00, 0.12, v * 0.42, 'sawtooth');
    tone(165, 0.11, 0.16, v * 0.34, 'sawtooth');
    noiseBurst(0.00, 0.08, v * 0.10);
    flash('wrong');
  }

  function playPass() {
    const v = CONFIG.volume;
    tone(523.25, 0.00, 0.10, v * 0.34, 'sine');
    tone(659.25, 0.09, 0.10, v * 0.40, 'sine');
    tone(783.99, 0.18, 0.12, v * 0.44, 'sine');
    tone(1046.5, 0.30, 0.16, v * 0.36, 'triangle');
    flash('pass');
  }

  function playClick() {
    const v = CONFIG.clickVolume;
    tone(520, 0.00, 0.035, v, 'triangle');
  }

  function playListen() {
    const v = CONFIG.clickVolume + 0.05;
    tone(440, 0.00, 0.05, v, 'sine');
    tone(660, 0.055, 0.07, v, 'sine');
  }

  function ensureCSS() {
    if (document.getElementById('lesson-sfx-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-sfx-css';
    style.textContent = `
      #lessonSfxFlash {
        position: fixed;
        inset: 0;
        z-index: 2147483644;
        pointer-events: none;
        opacity: 0;
        transition: opacity .18s ease;
      }

      #lessonSfxFlash.correct {
        background: radial-gradient(circle at center, rgba(34,197,94,.24), transparent 48%);
        opacity: 1;
      }

      #lessonSfxFlash.wrong {
        background: radial-gradient(circle at center, rgba(239,68,68,.26), transparent 48%);
        opacity: 1;
      }

      #lessonSfxFlash.pass {
        background:
          radial-gradient(circle at 30% 25%, rgba(250,204,21,.30), transparent 25%),
          radial-gradient(circle at 70% 35%, rgba(34,211,238,.25), transparent 25%),
          radial-gradient(circle at center, rgba(34,197,94,.18), transparent 55%);
        opacity: 1;
      }

      #lessonSfxToast {
        position: fixed;
        left: 50%;
        top: max(18px, env(safe-area-inset-top));
        transform: translateX(-50%) translateY(-10px);
        z-index: 2147483645;
        opacity: 0;
        pointer-events: none;
        padding: 10px 16px;
        border-radius: 999px;
        font: 1000 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #fff;
        background: rgba(15,23,42,.92);
        border: 1px solid rgba(125,211,252,.45);
        box-shadow: 0 16px 42px rgba(0,0,0,.30);
        transition: opacity .18s ease, transform .18s ease;
      }

      #lessonSfxToast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      #lessonSfxToast.correct {
        background: rgba(22,101,52,.94);
      }

      #lessonSfxToast.wrong {
        background: rgba(153,27,27,.94);
      }

      #lessonSfxToast.pass {
        background: rgba(30,64,175,.94);
      }
    `;

    document.head.appendChild(style);
  }

  function ensureFlash() {
    ensureCSS();

    let el = document.getElementById('lessonSfxFlash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lessonSfxFlash';
      document.body.appendChild(el);
    }

    return el;
  }

  function ensureToast() {
    ensureCSS();

    let el = document.getElementById('lessonSfxToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lessonSfxToast';
      document.body.appendChild(el);
    }

    return el;
  }

  function flash(type) {
    const flashEl = ensureFlash();
    const toast = ensureToast();

    flashEl.className = type;
    toast.className = `show ${type}`;

    if (type === 'correct') toast.textContent = '✅ Correct!';
    else if (type === 'wrong') toast.textContent = '❌ Try again';
    else if (type === 'pass') toast.textContent = '🏆 Mission Passed!';
    else toast.textContent = '';

    clearTimeout(flashEl._timer);
    clearTimeout(toast._timer);

    flashEl._timer = setTimeout(() => {
      flashEl.className = '';
    }, 220);

    toast._timer = setTimeout(() => {
      toast.className = '';
    }, 780);
  }

  function shouldDebounce(key) {
    const now = Date.now();

    if (key === lastKey && now - lastAt < CONFIG.debounceMs) {
      return true;
    }

    lastKey = key;
    lastAt = now;
    return false;
  }

  function resultKey(detail) {
    return [
      safe(detail.sid),
      safe(detail.skill || detail.type),
      safe(detail.itemId || detail.id),
      safe(detail.answer),
      safe(detail.passed),
      safe(detail.score)
    ].join('|');
  }

  function handleResultEvent(ev) {
    if (!CONFIG.enabled || isMutedByQuery()) return;

    const detail = ev?.detail || {};
    const key = resultKey(detail);

    if (shouldDebounce(`result:${key}`)) return;

    const passed = detail.passed === true || detail.correct === true || detail.isCorrect === true;
    const score = Number(detail.score || detail.accuracy || 0);

    if (passed || score >= Number(detail.passScore || 70)) {
      playCorrect();
    } else {
      playWrong();
    }
  }

  function handleMissionPass(ev) {
    if (!CONFIG.enabled || isMutedByQuery()) return;

    const detail = ev?.detail || {};
    const key = resultKey(detail);

    if (shouldDebounce(`pass:${key}`)) return;

    setTimeout(playPass, 180);
  }

  function bindClicks() {
    document.addEventListener('pointerdown', function (ev) {
      unlockAudio();

      const target = ev.target;
      if (!target || !target.closest) return;

      const btn = target.closest('button, .lesson-choice-btn, [role="button"]');
      if (!btn) return;

      if (btn.id === 'lessonListenMissionBtn' || /listen/i.test(btn.textContent || '')) {
        playListen();
      } else {
        playClick();
      }
    }, true);
  }

  function bindEvents() {
    const resultEvents = [
      'lesson:item-result',
      'lesson:answer-result',
      'lesson:choice-result',
      'lesson:listening-result',
      'lesson:reading-result',
      'lesson:writing-result',
      'lesson:speaking-result',
      'lesson:mission-result'
    ];

    resultEvents.forEach((name) => {
      window.addEventListener(name, handleResultEvent);
      document.addEventListener(name, handleResultEvent);
    });

    window.addEventListener('lesson:mission-pass', handleMissionPass);
    document.addEventListener('lesson:mission-pass', handleMissionPass);
  }

  function boot() {
    if (isMutedByQuery()) {
      console.log('[LessonSFX]', VERSION, 'muted by query');
      return;
    }

    ensureCSS();
    bindClicks();
    bindEvents();

    window.LESSON_SFX_FIX = {
      version: VERSION,
      config: CONFIG,
      playCorrect,
      playWrong,
      playPass,
      playClick,
      playListen,
      unlock: unlockAudio,
      mute() {
        CONFIG.enabled = false;
      },
      unmute() {
        CONFIG.enabled = true;
        unlockAudio();
      }
    };

    console.log('[LessonSFX]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
