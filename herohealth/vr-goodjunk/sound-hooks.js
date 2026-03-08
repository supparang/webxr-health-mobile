// === /herohealth/vr-goodjunk/sound-hooks.js ===
// GoodJunk Sound Hooks — safe optional audio layer
// PATCH v20260308-GJ-SOUND-HOOKS
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; }
}

export function createSoundHooks(options={}){
  const enabled = options.enabled !== false && String(qs('sound','1')) !== '0';
  const volume = clamp(options.volume ?? qs('volume','0.6'), 0, 1);
  let unlocked = false;

  function safeBeep(freq=440, dur=0.08, type='sine', gain=0.025){
    if(!enabled) return;
    try{
      const AudioCtx = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AudioCtx) return;
      const ctx = createSoundHooks.__ctx || (createSoundHooks.__ctx = new AudioCtx());
      if(ctx.state === 'suspended' && unlocked) ctx.resume?.();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = 0.0001;

      osc.connect(g);
      g.connect(ctx.destination);

      const amp = clamp(gain * volume, 0, 0.15);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp), now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.start(now);
      osc.stop(now + dur + 0.02);
    }catch(_){}
  }

  function unlock(){
    unlocked = true;
    try{
      const AudioCtx = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AudioCtx) return;
      const ctx = createSoundHooks.__ctx || (createSoundHooks.__ctx = new AudioCtx());
      ctx.resume?.();
    }catch(_){}
  }

  function play(name, meta={}){
    if(!enabled) return;
    switch(String(name||'')){
      case 'hit-good':
        safeBeep(620, 0.06, 'triangle', 0.03);
        break;
      case 'hit-junk':
        safeBeep(180, 0.10, 'sawtooth', 0.035);
        break;
      case 'bonus':
        safeBeep(760, 0.05, 'triangle', 0.03);
        setTimeout(()=>safeBeep(980, 0.06, 'triangle', 0.03), 35);
        break;
      case 'shield':
        safeBeep(420, 0.08, 'square', 0.028);
        break;
      case 'boss-hit':
        safeBeep(240, 0.07, 'sawtooth', 0.03);
        setTimeout(()=>safeBeep(180, 0.08, 'triangle', 0.028), 40);
        break;
      case 'combo':
        safeBeep(660 + (Number(meta.tier||0)*40), 0.07, 'triangle', 0.03);
        break;
      case 'fever':
        safeBeep(820, 0.05, 'triangle', 0.03);
        setTimeout(()=>safeBeep(1020, 0.05, 'triangle', 0.03), 30);
        setTimeout(()=>safeBeep(1240, 0.06, 'triangle', 0.03), 70);
        break;
      case 'warning':
        safeBeep(260, 0.07, 'square', 0.028);
        break;
      case 'win':
        safeBeep(660, 0.08, 'triangle', 0.03);
        setTimeout(()=>safeBeep(880, 0.09, 'triangle', 0.03), 60);
        setTimeout(()=>safeBeep(1180, 0.12, 'triangle', 0.03), 140);
        break;
      case 'lose':
        safeBeep(320, 0.10, 'sawtooth', 0.03);
        setTimeout(()=>safeBeep(240, 0.14, 'sawtooth', 0.03), 90);
        break;
      default:
        break;
    }
  }

  return {
    enabled,
    unlock,
    play
  };
}

export function createDefaultSoundHooksFromQuery(){
  return createSoundHooks({});
}

WIN.GJCreateSoundHooks = createSoundHooks;
WIN.GJCreateDefaultSoundHooksFromQuery = createDefaultSoundHooksFromQuery;