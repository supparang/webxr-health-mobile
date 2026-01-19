// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (PACK-FAIR)
// ✅ Global FX for ALL games (GoodJunk/Groups/Hydration/Plate)
// ✅ Uses body classes only (no game-specific CSS dependency)
// ✅ Listens to hha:* and quest:* events
// ✅ Storm / Boss / Rage / Mini / End
// ✅ Safe: idempotent, no hard dependency on other modules

(function (root) {
  'use strict';
  const WIN = root;
  const DOC = root.document;
  if (!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // -------- utils --------
  const on = (t, h, opt)=> WIN.addEventListener(t, h, opt||{ passive:true });
  const now = ()=> (performance?.now?.() ?? Date.now());
  const clamp = (v,a,b)=> v<a?a:(v>b?b:v);

  function add(cls){ DOC.body.classList.add(cls); }
  function rem(cls){ DOC.body.classList.remove(cls); }
  function has(cls){ return DOC.body.classList.contains(cls); }

  function pulse(cls, ms){
    add(cls);
    setTimeout(()=> rem(cls), ms);
  }

  // -------- FX State --------
  const S = {
    storm:false,
    boss:false,
    rage:false,
    lastMiniAt: 0,
    lastEndAt: 0,
  };

  // -------- helpers --------
  function enterStorm(){
    if(S.storm) return;
    S.storm = true;
    add('gj-storm'); // generic class (CSS may map)
    pulse('fx-storm-pulse', 380);
  }
  function exitStorm(){
    if(!S.storm) return;
    S.storm = false;
    rem('gj-storm');
  }

  function enterBoss(){
    if(S.boss) return;
    S.boss = true;
    add('gj-boss');
    pulse('fx-boss-pulse', 420);
  }
  function exitBoss(){
    if(!S.boss) return;
    S.boss = false;
    rem('gj-boss');
  }

  function enterRage(){
    if(S.rage) return;
    S.rage = true;
    add('gj-rage');
    pulse('fx-rage-pulse', 520);
  }
  function exitRage(){
    if(!S.rage) return;
    S.rage = false;
    rem('gj-rage');
  }

  function miniFlash(){
    const t = now();
    if(t - S.lastMiniAt < 600) return;
    S.lastMiniAt = t;
    pulse('fx-mini', 420);
  }

  function endFlash(){
    const t = now();
    if(t - S.lastEndAt < 800) return;
    S.lastEndAt = t;
    pulse('fx-end', 800);
  }

  // -------- Event Wiring --------

  // GAME START / END
  on('hha:start', ()=>{
    exitStorm(); exitBoss(); exitRage();
    rem('fx-mini'); rem('fx-end');
  });

  on('hha:end', ()=>{
    endFlash();
    exitStorm(); exitBoss(); exitRage();
  });

  // STORM (low time)
  // detail: { tLeftSec }
  on('hha:time', (ev)=>{
    const t = Number(ev?.detail?.tLeftSec);
    if(!Number.isFinite(t)) return;
    if(t <= 30) enterStorm();
    if(t > 32)  exitStorm();
  });

  // MISS / JUDGE
  // detail: { misses }
  on('hha:judge', (ev)=>{
    const m = Number(ev?.detail?.misses);
    if(!Number.isFinite(m)) return;

    // thresholds (FAIR default)
    // miss>=4 -> boss, miss>=5 -> rage
    if(m >= 4) enterBoss();
    else exitBoss();

    if(m >= 5) enterRage();
    else exitRage();
  });

  // MINI QUEST
  on('quest:update', (ev)=>{
    // when mini cleared -> flash
    const mini = ev?.detail?.mini;
    if(mini && mini.done) miniFlash();
  });

  // SCORE POP / CELEBRATE
  on('hha:celebrate', ()=>{
    pulse('fx-celebrate', 600);
  });

  // GENERIC FX TRIGGERS (optional hooks)
  on('fx:storm', ()=> enterStorm());
  on('fx:boss',  ()=> enterBoss());
  on('fx:rage',  ()=> enterRage());
  on('fx:mini',  ()=> miniFlash());
  on('fx:end',   ()=> endFlash());

  // -------- minimal inline CSS (safe) --------
  // These classes are intentionally tiny; games can style more if needed.
  const st = DOC.createElement('style');
  st.textContent = `
    /* FX Director minimal helpers (safe) */
    .fx-storm-pulse{ animation: fxPulse .38s ease; }
    .fx-boss-pulse { animation: fxPulse .42s ease; }
    .fx-rage-pulse { animation: fxPulse .52s ease; }
    .fx-mini       { animation: fxPulse .42s ease; }
    .fx-end        { animation: fxPulse .8s  ease; }
    .fx-celebrate  { animation: fxPulse .6s  ease; }
    @keyframes fxPulse{
      0%{ filter:none; }
      50%{ filter: saturate(1.06) contrast(1.02); }
      100%{ filter:none; }
    }
  `;
  DOC.head.appendChild(st);

})(window);