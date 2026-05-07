/* =========================================================
   /vocab/vocab.voice.js
   TechPath Vocab Arena — American AI Help Voice
   PATCH: v20260503a

   Goal:
   - Speak AI Help in American English
   - Prefer en-US voices
   - Safe fallback if browser has no voice
   - Works on PC / Mobile / iOS with user gesture
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-voice-v20260503a";

  let VOICES = [];
  let READY = false;
  let ENABLED = true;
  let RATE = 0.92;
  let PITCH = 1.02;
  let VOLUME = 1.0;

  const STORAGE_KEY = "VOCAB_AI_HELP_VOICE_ENABLED";

  function log(){
    try{
      console.log.apply(console, ["[VOCAB VOICE]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function readEnabled(){
    try{
      const saved = localStorage.getItem(STORAGE_KEY);
      if(saved === "0") return false;
      if(saved === "1") return true;
    }catch(e){}

    return true;
  }

  function saveEnabled(v){
    ENABLED = !!v;

    try{
      localStorage.setItem(STORAGE_KEY, ENABLED ? "1" : "0");
    }catch(e){}

    updateButton();
  }

  function stripHtml(html){
    const div = DOC.createElement("div");
    div.innerHTML = String(html || "");
    return String(div.textContent || div.innerText || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function loadVoices(){
    if(!("speechSynthesis" in WIN)) return [];

    VOICES = WIN.speechSynthesis.getVoices() || [];
    READY = VOICES.length > 0;

    return VOICES;
  }

  function getPreferredVoice(){
    loadVoices();

    if(!VOICES.length) return null;

    const preferredNames = [
      "Google US English",
      "Microsoft Aria",
      "Microsoft Jenny",
      "Microsoft Guy",
      "Samantha",
      "Ava",
      "Alex",
      "Victoria",
      "en-US"
    ];

    for(const name of preferredNames){
      const found = VOICES.find(v =>
        String(v.name || "").toLowerCase().includes(String(name).toLowerCase()) &&
        String(v.lang || "").toLowerCase().startsWith("en-us")
      );

      if(found) return found;
    }

    const enUs = VOICES.find(v =>
      String(v.lang || "").toLowerCase().startsWith("en-us")
    );

    if(enUs) return enUs;

    const en = VOICES.find(v =>
      String(v.lang || "").toLowerCase().startsWith("en")
    );

    return en || VOICES[0] || null;
  }

  function cancel(){
    try{
      if("speechSynthesis" in WIN){
        WIN.speechSynthesis.cancel();
      }
    }catch(e){}
  }

  function speak(text, options){
    options = options || {};

    if(!ENABLED) return false;
    if(!("speechSynthesis" in WIN)) return false;

    const cleanText = stripHtml(text);
    if(!cleanText) return false;

    cancel();

    const utter = new SpeechSynthesisUtterance(cleanText);

    utter.lang = "en-US";
    utter.rate = Number(options.rate || RATE);
    utter.pitch = Number(options.pitch || PITCH);
    utter.volume = Number(options.volume || VOLUME);

    const voice = getPreferredVoice();
    if(voice){
      utter.voice = voice;
      utter.lang = voice.lang || "en-US";
    }

    try{
      WIN.speechSynthesis.speak(utter);
      return true;
    }catch(e){
      return false;
    }
  }

  function speakAiHelp(html){
    const text = stripHtml(html)
      .replace(/^AI Help/i, "AI Help.")
      .replace(/ช่วยคิด ไม่เฉลยตรง ๆ/g, "")
      .replace(/โจทย์นี้/g, "This question")
      .replace(/คำศัพท์/g, "vocabulary")
      .replace(/แนวคิดหลักเกี่ยวกับคำนี้:/g, "Key idea:")
      .replace(/ใช้ AI Help แล้วคะแนนข้อนี้จะลดเล็กน้อย/g, "Using AI Help may slightly reduce the score.");

    return speak(text, {
      rate: 0.9,
      pitch: 1.02,
      volume: 1.0
    });
  }

  function speakCorrect(term, meaning){
    return speak(`Correct. ${term} means ${meaning}.`, {
      rate: 0.95
    });
  }

  function speakWrong(term, meaning){
    return speak(`Not quite. ${term} means ${meaning}.`, {
      rate: 0.92
    });
  }

  function ensureButton(){
    if(DOC.getElementById("vocabVoiceToggleBtn")) return;

    const hud = DOC.getElementById("vocabPowerHud");
    if(!hud) return;

    const btn = DOC.createElement("button");
    btn.id = "vocabVoiceToggleBtn";
    btn.className = "vocab-power-btn vocab-voice-btn";
    btn.type = "button";
    btn.addEventListener("click", function(){
      saveEnabled(!ENABLED);

      if(ENABLED){
        speak("American AI Help voice is on.");
      }else{
        cancel();
      }
    });

    hud.appendChild(btn);
    updateButton();
  }

  function updateButton(){
    const btn = DOC.getElementById("vocabVoiceToggleBtn");
    if(!btn) return;

    btn.textContent = ENABLED
      ? "🔊 AI Voice: US"
      : "🔇 AI Voice: Off";

    btn.setAttribute("aria-pressed", ENABLED ? "true" : "false");
  }

  function unlockOnFirstTap(){
    const once = function(){
      try{
        loadVoices();

        if("speechSynthesis" in WIN){
          const u = new SpeechSynthesisUtterance("");
          u.lang = "en-US";
          WIN.speechSynthesis.speak(u);
          WIN.speechSynthesis.cancel();
        }
      }catch(e){}

      DOC.removeEventListener("click", once, true);
      DOC.removeEventListener("touchstart", once, true);
    };

    DOC.addEventListener("click", once, true);
    DOC.addEventListener("touchstart", once, true);
  }

  function boot(){
    ENABLED = readEnabled();
    loadVoices();

    if("speechSynthesis" in WIN){
      WIN.speechSynthesis.onvoiceschanged = function(){
        loadVoices();
        log("voices loaded", VOICES.map(v => ({
          name: v.name,
          lang: v.lang
        })));
      };
    }

    unlockOnFirstTap();

    setTimeout(ensureButton, 800);
    setTimeout(ensureButton, 1800);

    WIN.VocabVoice = {
      version: VERSION,
      speak,
      speakAiHelp,
      speakCorrect,
      speakWrong,
      cancel,
      getPreferredVoice,
      getVoices: function(){
        return loadVoices();
      },
      setEnabled: saveEnabled,
      isEnabled: function(){
        return ENABLED;
      }
    };

    WIN.VocabModules = WIN.VocabModules || {};
    WIN.VocabModules.voice = true;

    WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
    WIN.__VOCAB_MODULES__.voice = true;

    log("loaded", VERSION);
  }

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", boot, { once: true });
  }else{
    boot();
  }
})();