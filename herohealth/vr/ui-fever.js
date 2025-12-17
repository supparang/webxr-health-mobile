// === /herohealth/vr/ui-fever.js ===
// FEVER Gauge + Global State (Quest-ready)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

  const FEVER_MAX = 100;
  const FEVER_DURATION = 6000; // ms

  function clamp(v){ return Math.max(0, Math.min(FEVER_MAX, v)); }

  function ensureBar(){
    let bar = doc.getElementById('fever-fill');
    if (!bar){
      const wrap = doc.querySelector('.fever-bar-fill');
      bar = wrap || null;
    }
    return bar;
  }

  function setBar(){
    const bar = ensureBar();
    if (!bar) return;
    bar.style.width = fever + '%';
  }

  function dispatch(state){
    root.dispatchEvent(new CustomEvent('hha:fever',{
      detail:{ state }
    }));
  }

  function startFever(){
    if (feverActive) return;
    feverActive = true;
    fever = FEVER_MAX;
    setBar();
    dispatch('start');

    feverTimer = setTimeout(endFever, FEVER_DURATION);
  }

  function endFever(){
    if (!feverActive) return;
    feverActive = false;
    fever = 0;
    setBar();
    dispatch('end');
  }

  // ===== PUBLIC API =====
  root.FeverUI = {

    add(v){
      if (feverActive) return;
      fever = clamp(fever + (v || 0));
      setBar();
      if (fever >= FEVER_MAX){
        startFever();
      }
    },

    reset(){
      fever = 0;
      feverActive = false;
      if (feverTimer) clearTimeout(feverTimer);
      setBar();
    },

    isActive(){
      return feverActive;
    },

    getValue(){
      return fever;
    }
  };

})(window);
