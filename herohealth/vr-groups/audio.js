/* === /herohealth/vr-groups/audio.js ===
Audio — SAFE (optional)
✅ play(name) with best-effort (no crash if missing)
✅ setEnabled(true/false)
*/

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  const audioMap = {
    good:  './sfx/good.mp3',
    bad:   './sfx/bad.mp3',
    boss:  './sfx/boss.mp3',
    clear: './sfx/clear.mp3',
    tick:  './sfx/tick.mp3'
  };

  let enabled = false; // default OFF to avoid autoplay policies

  function make(url){
    try{
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = 0.35;
      return a;
    }catch(_){ return null; }
  }

  const cache = {};

  function get(name){
    const url = audioMap[name];
    if (!url) return null;
    if (cache[name]) return cache[name];
    cache[name] = make(url);
    return cache[name];
  }

  function play(name){
    if (!enabled) return false;
    const a = get(name);
    if (!a) return false;
    try{
      a.currentTime = 0;
      a.play();
      return true;
    }catch(_){ return false; }
  }

  function setEnabled(on){
    enabled = !!on;
  }

  NS.Audio = { play, setEnabled, map: audioMap };

})(typeof window !== 'undefined' ? window : globalThis);