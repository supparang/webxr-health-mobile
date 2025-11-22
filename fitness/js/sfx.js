// === js/sfx.js — Simple SFX Manager (cooldown + random pitch + volume curve) ===
'use strict';

/**
 * ใช้แบบ:
 *   window.SFX.play('hit',   { group: 'hit',   intensity: 0.8 });
 *   window.SFX.play('boss',  { group: 'boss',  intensity: 1.0 });
 *   window.SFX.play('fever', { group: 'fever', intensity: 1.0 });
 */

(function(){
  const SOURCES = {
    hit:   './sfx/hit.mp3',
    boss:  './sfx/boss-intro.mp3',
    fever: './sfx/fever.mp3'
  };

  const cache = {
    sounds: Object.create(null),
    lastPlay: Object.create(null)
  };

  function clamp(v, min, max){
    return v < min ? min : (v > max ? max : v);
  }

  function getAudio(id){
    let snd = cache.sounds[id];
    if (!snd){
      const src = SOURCES[id];
      if (!src) return null;
      snd = new Audio(src);
      snd.preload = 'auto';
      cache.sounds[id] = snd;
    }
    // clone เพื่อให้เล่นซ้อนกันได้
    return snd.cloneNode();
  }

  /**
   * opts:
   *   - group:    กลุ่ม cooldown (เช่น 'hit', 'boss')
   *   - minGap:   ช่วงห่างขั้นต่ำระหว่างเสียงใน group (ms)
   *   - baseVolume: 0..1
   *   - intensity: 0..1 เอาไปปรับ volume curve
   *   - baseRate:    ค่า playbackRate หลัก
   *   - pitchSpread: ระยะสุ่ม pitch รอบ baseRate (เช่น 0.07)
   */
  function play(id, opts){
    opts = opts || {};
    const group = opts.group || id;
    const minGap = opts.minGap != null ? opts.minGap : 70;

    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    const last = cache.lastPlay[group] || 0;
    if (now - last < minGap){
      return; // cooldown
    }
    cache.lastPlay[group] = now;

    const audio = getAudio(id);
    if (!audio) return;

    const baseVol = opts.baseVolume != null ? opts.baseVolume : 0.7;
    const intensity = clamp(opts.intensity != null ? opts.intensity : 0.6, 0, 1);

    // volume curve: ให้ไม่เบาเกินไปตอน intensity ต่ำ
    const vol = baseVol * (0.4 + intensity * 0.6);
    audio.volume = clamp(vol, 0, 1);

    const baseRate = opts.baseRate != null ? opts.baseRate : 1.0;
    const spread   = opts.pitchSpread != null ? opts.pitchSpread : 0.07;
    const jitter   = (Math.random() * 2 - 1) * spread;

    audio.playbackRate = baseRate + jitter;
    if (audio.playbackRate < 0.5) audio.playbackRate = 0.5;

    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === 'function'){
      p.catch(()=>{ /* ignore autoplay error */ });
    }
  }

  window.SFX = { play };
})();
