// === js/sfx.js — Simple SFX Manager (Shadow Breaker / VR Fitness) (2025-11-28) ===
'use strict';

/**
 * วิธีใช้จาก engine:
 *   window.SFX.play('hit',   { group: 'hit',   intensity: 0.8 });
 *   window.SFX.play('boss',  { group: 'boss',  intensity: 1.0 });
 *   window.SFX.play('fever', { group: 'fever', intensity: 1.0 });
 *
 * รองรับทั้ง:
 *   - <audio id="sfx-hit"   src="./sfx/hit.mp3">
 *   - <audio id="sfx-boss"  src="./sfx/boss-intro.mp3">
 *   - <audio id="sfx-fever" src="./sfx/fever.mp3">
 *   ถ้าไม่มี tag เหล่านี้ จะ fallback ไปใช้ Audio(src จาก SOURCES)
 */

(function(){
  // แผนที่ไฟล์สำรอง (ใช้กรณีไม่เจอ <audio> tag)
  const SOURCES = {
    hit:   './sfx/hit.mp3',
    boss:  './sfx/boss-intro.mp3',
    fever: './sfx/fever.mp3'
  };

  // mapping จาก id → audio element id ใน DOM
  const AUDIO_IDS = {
    hit:   'sfx-hit',
    boss:  'sfx-boss',
    fever: 'sfx-fever'
  };

  const cache = {
    baseNodes: Object.create(null), // id → <audio> base (จาก DOM หรือ Audio())
    lastPlay:  Object.create(null)  // group → last timestamp
  };

  function clamp(v, min, max){
    return v < min ? min : (v > max ? max : v);
  }

  /**
   * คืน base audio node (ไม่ใช่ตัวที่เล่นจริง) แล้วค่อย clone อีกที
   */
  function getBaseAudio(id){
    if (cache.baseNodes[id]) return cache.baseNodes[id];

    // 1) พยายามหา <audio id="sfx-hit"> ที่มีอยู่ใน DOM ก่อน
    const domId = AUDIO_IDS[id];
    if (domId && typeof document !== 'undefined') {
      const tag = document.getElementById(domId);
      if (tag) {
        tag.preload = tag.preload || 'auto';
        cache.baseNodes[id] = tag;
        return tag;
      }
    }

    // 2) ถ้าไม่มีใน DOM ให้ใช้ Audio(src) ตาม SOURCES
    const src = SOURCES[id];
    if (!src || typeof Audio === 'undefined') return null;

    const audio = new Audio(src);
    audio.preload = 'auto';
    cache.baseNodes[id] = audio;
    return audio;
  }

  /**
   * คืน audio node ที่พร้อมเล่น (clone จาก base เพื่อให้เล่นซ้อนกันได้)
   */
  function getAudio(id){
    const base = getBaseAudio(id);
    if (!base) return null;

    // cloneNode(true) เพื่อไม่ลาก event ใด ๆ ตามมาด้วย
    const node = base.cloneNode(true);
    // เผื่อบาง browser ไม่ copy preload
    node.preload = 'auto';
    return node;
  }

  /**
   * opts:
   *   - group:       กลุ่ม cooldown (เช่น 'hit', 'boss', 'fever')
   *   - minGap:      ช่วงห่างขั้นต่ำระหว่างเสียงใน group (ms) default ~70ms
   *   - baseVolume:  0..1 ระดับเสียงหลัก (default 0.7)
   *   - intensity:   0..1 เอาไป map กับ volume curve
   *   - baseRate:    playbackRate หลัก (default 1.0)
   *   - pitchSpread: ระยะสุ่ม pitch รอบ baseRate (เช่น 0.07)
   */
  function play(id, opts){
    opts = opts || {};
    const group  = opts.group || id;
    const minGap = opts.minGap != null ? opts.minGap : 70;

    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    const last = cache.lastPlay[group] || 0;
    if (now - last < minGap){
      // ยังไม่ครบ cooldown → ไม่เล่นเสียง
      return;
    }
    cache.lastPlay[group] = now;

    const audio = getAudio(id);
    if (!audio) return;

    const baseVol   = opts.baseVolume != null ? opts.baseVolume : 0.7;
    const intensity = clamp(
      opts.intensity != null ? opts.intensity : 0.6,
      0, 1
    );

    // volume curve: ให้ไม่เบามากแม้ intensity ต่ำ
    // baseVol * (0.4 .. 1.0)
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
      p.catch(()=>{ /* ignore autoplay error / user gesture required */ });
    }
  }

  // เผย global object
  window.SFX = { play };
})();