/* === /herohealth/vr-groups/audio.js ===
Simple WebAudio SFX for GroupsVR (VOL+MUTE PATCH)
✅ tick / good / bad / boss / storm / overdrive
✅ setVolume(0..1), setMute(true/false), getVolume(), getMute()
Reads:
 - localStorage HHA_AUDIO_VOL (0..100)
 - localStorage HHA_AUDIO_MUTE (0/1)
 - URL params vol / mute (optional)
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});

  const LS_VOL = 'HHA_AUDIO_VOL';
  const LS_MUT = 'HHA_AUDIO_MUTE';

  let ctx = null;
  let master = null;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function readPrefs(){
    const v = clamp(qs('vol', null) ?? localStorage.getItem(LS_VOL) ?? 22, 0, 100);
    const m = String(qs('mute', null) ?? localStorage.getItem(LS_MUT) ?? '0');
    const mute = (m==='1' || m==='true');
    return { volPct: v, mute };
  }

  function ensure(){
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();

    const pref = readPrefs();
    master.gain.value = pref.mute ? 0.0 : (pref.volPct/100) * 0.35; // master scale
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock(){
    const c = ensure();
    if (!c) return false;
    if (c.state === 'suspended') c.resume().catch(()=>{});
    return true;
  }

  function setVolume(v01){
    ensure(); if (!master) return;
    const p = clamp(v01*100, 0, 100);
    const mute = getMute();
    if (!mute) master.gain.value = (p/100) * 0.35;
    try{ localStorage.setItem(LS_VOL, String(p|0)); }catch{}
  }
  function getVolume(){
    const pref = readPrefs();
    return clamp(pref.volPct/100, 0, 1);
  }
  function setMute(m){
    ensure(); if (!master) return;
    const vol = readPrefs().volPct;
    master.gain.value = m ? 0.0 : (vol/100) * 0.35;
    try{ localStorage.setItem(LS_MUT, m ? '1' : '0'); }catch{}
  }
  function getMute(){
    return !!readPrefs().mute;
  }

  function tone(freq, durMs, type, gain, sweepTo){
    const c = ensure();
    if (!c) return;
    unlock();
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + (durMs/1000));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain||0.12), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));
    o.connect(g); g.connect(master);
    o.start(t0);
    o.stop(t0 + (durMs/1000) + 0.02);
  }

  function tick(){ tone(880, 70, 'square', 0.08, 760); }
  function good(){ tone(660, 90, 'triangle', 0.10, 990); }
  function bad(){ tone(220, 130, 'sawtooth', 0.12, 160); }
  function boss(){ tone(180, 160, 'sawtooth', 0.14, 360); tone(480, 120, 'square', 0.10, 520); }
  function storm(){ tone(420, 120, 'square', 0.10, 250); }
  function overdrive(){ tone(520, 120, 'triangle', 0.12, 980); tone(980, 120, 'triangle', 0.10, 1200); }

  // auto-unlock on first gesture
  (function bindUnlock(){
    if (bindUnlock._done) return;
    bindUnlock._done = true;
    const fn = ()=>{ unlock(); root.removeEventListener('pointerdown', fn, true); root.removeEventListener('keydown', fn, true); };
    root.addEventListener('pointerdown', fn, true);
    root.addEventListener('keydown', fn, true);
  })();

  NS.Audio = { unlock, tick, good, bad, boss, storm, overdrive, setVolume, getVolume, setMute, getMute };
})(typeof window !== 'undefined' ? window : globalThis);