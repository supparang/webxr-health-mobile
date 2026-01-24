// === /herohealth/vr-groups/audio.js ===
// Minimal SFX: good/bad/miss/boss/storm (safe if assets missing)

(function(){
  'use strict';
  const W = window;
  const NS = W.GroupsVR = W.GroupsVR || {};

  const S = {
    enabled: true,
    vol: 0.55,
    cache: {}
  };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  // allow mute via ?mute=1
  if (String(qs('mute','0')||'0') === '1') S.enabled = false;

  function get(name){
    if (S.cache[name]) return S.cache[name];
    const a = new Audio();
    a.preload = 'auto';
    a.volume = S.vol;

    // you can replace these paths later
    const map = {
      good:  './sfx-good.mp3',
      bad:   './sfx-bad.mp3',
      miss:  './sfx-miss.mp3',
      boss:  './sfx-boss.mp3',
      storm: './sfx-storm.mp3'
    };
    a.src = map[name] || '';
    S.cache[name] = a;
    return a;
  }

  function play(name){
    if (!S.enabled) return;
    try{
      const a = get(name);
      if (!a || !a.src) return;
      a.currentTime = 0;
      a.play().catch(()=>{});
    }catch(_){}
  }

  W.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    if (k==='good' || k==='perfect') play('good');
    else if (k==='bad') play('bad');
    else if (k==='miss') play('miss');
    else if (k==='boss') play('boss');
    else if (k==='storm') play('storm');
  }, {passive:true});

  NS.Audio = { play };
})();