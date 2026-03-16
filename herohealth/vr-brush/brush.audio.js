// /herohealth/vr-brush/brush.audio.js
// HOTFIX v20260316c-BRUSH-AUDIO-SAFE-MOBILE

export function createBrushAudio({
  audioEnabled = true,
  voiceEnabled = true,
  speakRate = 1.0,
  speakPitch = 1.0,
  speakVolume = 0.9
} = {}){
  let unlocked = false;
  let audioCtx = null;
  let masterGain = null;
  let speechBroken = false;

  function safeAudioContextCtor(){
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function ensureAudio(){
    if(!audioEnabled) return false;

    try{
      if(!audioCtx){
        const Ctor = safeAudioContextCtor();
        if(!Ctor) return false;

        audioCtx = new Ctor();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.04;
        masterGain.connect(audioCtx.destination);
      }

      if(audioCtx?.state === 'suspended'){
        audioCtx.resume?.().catch(()=>{});
      }

      unlocked = true;
      return true;
    }catch{
      audioCtx = null;
      masterGain = null;
      return false;
    }
  }

  function beep({
    freq = 440,
    duration = 0.08,
    type = 'sine',
    gain = 0.06,
    attack = 0.005,
    release = 0.05
  } = {}){
    if(!audioEnabled) return false;
    if(!ensureAudio() || !audioCtx || !masterGain) return false;

    try{
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(gain, now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + 0.01, duration + release));

      osc.connect(g);
      g.connect(masterGain);

      osc.start(now);
      osc.stop(now + Math.max(0.03, duration + release + 0.02));
      return true;
    }catch{
      return false;
    }
  }

  function twoTone(a, b, gap = 0.06){
    if(!audioEnabled) return false;
    const ok1 = beep(a);
    setTimeout(()=> beep(b), Math.max(0, gap * 1000));
    return ok1;
  }

  function speak(text){
    if(!voiceEnabled || speechBroken) return false;
    if(!text || !('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return false;

    try{
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'th-TH';
      u.rate = speakRate;
      u.pitch = speakPitch;
      u.volume = speakVolume;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    }catch{
      speechBroken = true;
      return false;
    }
  }

  function stopSpeech(){
    try{
      if('speechSynthesis' in window){
        window.speechSynthesis.cancel();
      }
    }catch{}
  }

  function toggleAudio(force){
    if(typeof force === 'boolean'){
      audioEnabled = force;
      if(!audioEnabled) stopSpeech();
      return audioEnabled;
    }
    audioEnabled = !audioEnabled;
    if(!audioEnabled) stopSpeech();
    return audioEnabled;
  }

  function toggleVoice(force){
    if(typeof force === 'boolean'){
      voiceEnabled = force;
      if(!voiceEnabled) stopSpeech();
      return voiceEnabled;
    }
    voiceEnabled = !voiceEnabled;
    if(!voiceEnabled) stopSpeech();
    return voiceEnabled;
  }

  function getState(){
    return {
      audioEnabled,
      voiceEnabled,
      unlocked,
      hasAudioContext: !!audioCtx,
      speechBroken
    };
  }

  function playCue(name, speechText = ''){
    try{
      switch(String(name || '')){
        case 'audio-on':
          twoTone(
            { freq: 660, duration: 0.05, type:'sine', gain:0.05 },
            { freq: 880, duration: 0.08, type:'sine', gain:0.06 }
          );
          break;

        case 'demo-start':
          twoTone(
            { freq: 520, duration: 0.06, type:'triangle', gain:0.04 },
            { freq: 620, duration: 0.08, type:'triangle', gain:0.05 }
          );
          break;

        case 'learn-open':
        case 'learn-watch':
        case 'learn-start':
          beep({ freq: 540, duration: 0.07, type:'triangle', gain:0.04 });
          break;

        case 'dir-good':
          beep({ freq: 760, duration: 0.05, type:'sine', gain:0.04 });
          break;

        case 'dir-warn':
          beep({ freq: 280, duration: 0.08, type:'square', gain:0.035 });
          break;

        case 'wrong-zone':
          twoTone(
            { freq: 260, duration: 0.05, type:'square', gain:0.03 },
            { freq: 220, duration: 0.08, type:'square', gain:0.03 }
          );
          break;

        case 'zone-clear':
          twoTone(
            { freq: 620, duration: 0.05, type:'triangle', gain:0.04 },
            { freq: 760, duration: 0.08, type:'triangle', gain:0.05 }
          );
          break;

        case 'zone-perfect':
          twoTone(
            { freq: 740, duration: 0.05, type:'triangle', gain:0.045 },
            { freq: 980, duration: 0.10, type:'triangle', gain:0.055 }
          );
          break;

        case 'boss-laser':
          beep({ freq: 180, duration: 0.12, type:'sawtooth', gain:0.035 });
          break;

        case 'laser-hit':
          twoTone(
            { freq: 180, duration: 0.05, type:'square', gain:0.035 },
            { freq: 140, duration: 0.10, type:'square', gain:0.035 }
          );
          break;

        case 'boss-shock':
          beep({ freq: 860, duration: 0.08, type:'triangle', gain:0.045 });
          break;

        case 'shock-perfect':
          twoTone(
            { freq: 820, duration: 0.04, type:'triangle', gain:0.04 },
            { freq: 1120, duration: 0.10, type:'triangle', gain:0.055 }
          );
          break;

        case 'boss-decoy':
          beep({ freq: 430, duration: 0.10, type:'sine', gain:0.035 });
          break;

        case 'decoy-hit':
          twoTone(
            { freq: 320, duration: 0.04, type:'square', gain:0.03 },
            { freq: 260, duration: 0.09, type:'square', gain:0.03 }
          );
          break;

        case 'boss-phase':
          twoTone(
            { freq: 600, duration: 0.06, type:'sawtooth', gain:0.04 },
            { freq: 760, duration: 0.10, type:'sawtooth', gain:0.045 }
          );
          break;

        case 'boss-win':
          twoTone(
            { freq: 880, duration: 0.08, type:'triangle', gain:0.05 },
            { freq: 1180, duration: 0.14, type:'triangle', gain:0.06 }
          );
          break;

        case 'summary-open':
        case 'summary-learn':
        case 'summary-win':
          twoTone(
            { freq: 700, duration: 0.06, type:'triangle', gain:0.045 },
            { freq: 920, duration: 0.12, type:'triangle', gain:0.055 }
          );
          break;

        default:
          beep({ freq: 520, duration: 0.06, type:'sine', gain:0.035 });
          break;
      }

      if(speechText){
        speak(speechText);
      }

      return true;
    }catch{
      return false;
    }
  }

  return {
    ensureAudio,
    beep,
    speak,
    stopSpeech,
    toggleAudio,
    toggleVoice,
    getState,
    playCue
  };
}