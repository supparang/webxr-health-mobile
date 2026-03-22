// /herohealth/bath-v2/bath.audio.js
// Bath v2 audio helpers
// child-friendly speech + light sfx stubs
// works with current bath.js

export const BATH_AUDIO = {
  readyHelp: 'แตะของที่ต้องใช้ก่อนนะ',
  scrubHelp: 'เลือกสบู่ แล้วถูจุดที่เรืองแสง',
  rinseHelp: 'เลือกฝักบัว แล้วล้างฟองออกให้หมดนะ',
  dryHelp: 'เลือกผ้าเช็ดตัว แล้วเช็ดให้แห้งนะ',
  bossHelp: 'ทำทีละขั้นนะ หนูทำได้'
};

const audioState = {
  enabled: true,
  lastText: '',
  lastSpeakAt: 0,
  minGapMs: 450,
  preferredLangs: ['th-TH', 'th_TH', 'th'],
  voice: null,
  unlocked: false
};

function hasSpeechApi() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof SpeechSynthesisUtterance !== 'undefined';
}

function normalizeText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function nowMs() {
  return Date.now();
}

function getVoicesSafe() {
  if (!hasSpeechApi()) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

function pickBestVoice() {
  const voices = getVoicesSafe();
  if (!voices.length) return null;

  const langMatch = voices.find(v =>
    audioState.preferredLangs.some(lang =>
      String(v.lang || '').toLowerCase().startsWith(lang.toLowerCase().replace('_', '-'))
    )
  );
  if (langMatch) return langMatch;

  const localMatch = voices.find(v =>
    /th/i.test(String(v.lang || '')) || /thai/i.test(String(v.name || ''))
  );
  if (localMatch) return localMatch;

  return voices[0] || null;
}

function ensureVoiceLoaded() {
  if (!hasSpeechApi()) return null;
  if (audioState.voice) return audioState.voice;

  audioState.voice = pickBestVoice();
  return audioState.voice;
}

export function setBathAudioEnabled(flag) {
  audioState.enabled = !!flag;
  if (!audioState.enabled) stopBathSpeech();
}

export function getBathAudioEnabled() {
  return !!audioState.enabled;
}

export function preloadBathVoices() {
  if (!hasSpeechApi()) return;
  ensureVoiceLoaded();

  try {
    window.speechSynthesis.onvoiceschanged = () => {
      audioState.voice = pickBestVoice();
    };
  } catch {}
}

export function unlockBathAudio() {
  audioState.unlocked = true;
  preloadBathVoices();
}

export function canSpeakBathText(text, enabled = true) {
  if (!enabled || !audioState.enabled) return false;
  if (!hasSpeechApi()) return false;

  const t = normalizeText(text);
  if (!t) return false;

  const elapsed = nowMs() - audioState.lastSpeakAt;
  if (t === audioState.lastText && elapsed < audioState.minGapMs) return false;

  return true;
}

export function speakBathText(text, enabled = true, opts = {}) {
  const t = normalizeText(text);
  if (!canSpeakBathText(t, enabled)) return false;

  const {
    interrupt = true,
    rate = 0.98,
    pitch = 1.08,
    volume = 1,
    lang = 'th-TH'
  } = opts;

  try {
    if (interrupt) {
      window.speechSynthesis.cancel();
    }

    const utter = new SpeechSynthesisUtterance(t);
    utter.lang = lang;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = volume;

    const voice = ensureVoiceLoaded();
    if (voice) utter.voice = voice;

    audioState.lastText = t;
    audioState.lastSpeakAt = nowMs();

    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export function speakBathCoachLine(text, enabled = true) {
  return speakBathText(text, enabled, {
    interrupt: true,
    rate: 0.98,
    pitch: 1.1,
    volume: 1,
    lang: 'th-TH'
  });
}

export function speakBathHint(text, enabled = true) {
  return speakBathText(text, enabled, {
    interrupt: true,
    rate: 0.95,
    pitch: 1.05,
    volume: 1,
    lang: 'th-TH'
  });
}

export function speakBathCelebration(text, enabled = true) {
  return speakBathText(text, enabled, {
    interrupt: true,
    rate: 1.02,
    pitch: 1.15,
    volume: 1,
    lang: 'th-TH'
  });
}

export function stopBathSpeech() {
  if (!hasSpeechApi()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}

export function resetBathSpeechMemory() {
  audioState.lastText = '';
  audioState.lastSpeakAt = 0;
}

export function pauseBathSpeech() {
  if (!hasSpeechApi()) return;
  try {
    window.speechSynthesis.pause();
  } catch {}
}

export function resumeBathSpeech() {
  if (!hasSpeechApi()) return;
  try {
    window.speechSynthesis.resume();
  } catch {}
}

// optional tiny beep stub for future use
// currently no external audio files required
export function playBathSfx(name, enabled = true) {
  if (!enabled || !audioState.enabled) return false;
  // placeholder: hook real sfx later if needed
  // examples: 'correct', 'wrong', 'sparkle', 'phaseClear'
  return !!name;
}

// initialize voice list early when module loads
preloadBathVoices();