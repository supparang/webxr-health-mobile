/* === /herohealth/vr-goodjunk/goodjunk-vibration-gentle-v850n.js === */
/* FULL PATCH v20260608-GOODJUNK-VIBRATION-GENTLE-V850N */
/*
  ลดอาการสั่นถี่เกินไปบนมือถือ
  - จำกัดความถี่ navigator.vibrate
  - ตัด pattern ยาวให้สั้นลง
  - ปิดสั่นเมื่อเปิด summary/cooldown
  - ยังเหลือ feedback เบา ๆ ตอน hit สำคัญ
*/

(function(){
  'use strict';

  var PATCH = 'v20260608-GOODJUNK-VIBRATION-GENTLE-V850N';

  if(window.GJ_VIBRATION_GENTLE_V850N_LOADED){
    console.warn('[GoodJunk Vibration Gentle] already loaded');
    return;
  }
  window.GJ_VIBRATION_GENTLE_V850N_LOADED = true;

  if(!('vibrate' in navigator)){
    console.info('[GoodJunk Vibration Gentle] vibrate not supported');
    return;
  }

  var originalVibrate = navigator.vibrate.bind(navigator);
  var lastVibrateAt = 0;
  var disabled = false;

  /*
    ปรับตรงนี้ได้:
    0 = ปิดสั่นทั้งหมด
    1 = เบามาก
    2 = ปานกลาง
  */
  var LEVEL = 1;

  function now(){
    return Date.now();
  }

  function isSummaryOpen(){
    return !!(
      window.GJ_SUMMARY_OPENED ||
      window.GJ_SUMMARY_LOCKED ||
      document.getElementById('gjSummaryV850mOverlay') ||
      document.querySelector('.gj-summary-overlay,.gj-result-overlay,.gj-reward-overlay,#gjRewardOverlay,#gjrOverlay')
    );
  }

  function normalizePattern(pattern){
    if(disabled || LEVEL <= 0 || isSummaryOpen()){
      return 0;
    }

    if(pattern === 0 || pattern === false || pattern === null || pattern === undefined){
      return 0;
    }

    var arr = Array.isArray(pattern) ? pattern.slice() : [Number(pattern) || 0];

    arr = arr
      .map(function(v){
        v = Number(v) || 0;
        return Math.max(0, Math.min(v, 80));
      })
      .filter(function(v){
        return v > 0;
      });

    if(!arr.length) return 0;

    /*
      LEVEL 1: ให้เป็น tap สั้น ๆ เท่านั้น
      กัน combo / boss / toast สั่นรัว
    */
    if(LEVEL === 1){
      var max = Math.max.apply(null, arr);

      if(max >= 60) return 35;
      if(max >= 30) return 24;
      return 16;
    }

    /*
      LEVEL 2: อนุญาต pattern สั้น แต่ไม่เกิน 3 จังหวะ
    */
    arr = arr.slice(0, 3);
    return arr;
  }

  function gentleVibrate(pattern){
    var t = now();

    /*
      กันสั่นถี่: อย่างน้อย 450ms ต่อครั้ง
    */
    if(t - lastVibrateAt < 450){
      return false;
    }

    var safe = normalizePattern(pattern);

    if(!safe){
      return false;
    }

    lastVibrateAt = t;

    try{
      return originalVibrate(safe);
    }catch(e){
      return false;
    }
  }

  try{
    navigator.vibrate = gentleVibrate;
  }catch(e){
    console.warn('[GoodJunk Vibration Gentle] cannot override navigator.vibrate', e);
  }

  window.GJ_VIBRATION_GENTLE = {
    patch: PATCH,
    setLevel: function(level){
      LEVEL = Math.max(0, Math.min(2, Number(level) || 0));
      console.info('[GoodJunk Vibration Gentle] level =', LEVEL);
    },
    disable: function(){
      disabled = true;
      try{ originalVibrate(0); }catch(e){}
    },
    enable: function(){
      disabled = false;
    },
    stop: function(){
      try{ originalVibrate(0); }catch(e){}
    }
  };

  [
    'gj:summary-v850m-opened',
    'gj:reward-summary-shown',
    'gj:game-over',
    'gj:game:end',
    'gj:cooldown-start',
    'pagehide',
    'beforeunload',
    'visibilitychange'
  ].forEach(function(name){
    window.addEventListener(name, function(){
      if(name === 'visibilitychange' && !document.hidden) return;
      try{ originalVibrate(0); }catch(e){}
    }, true);
  });

  console.info('[GoodJunk Vibration Gentle] installed', {
    patch: PATCH,
    level: LEVEL
  });
})();
