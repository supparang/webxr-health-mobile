// === game/main.js (per-target pop: perfect/combo/fever/miss + combo/fever logic) ===
window.__HHA_BOOT_OK = 'main';
(function () {
  const $  = (s)=>document.querySelector(s);

  let ScoreSystem, SFXClass, Quests, Progress, CoachClass;
  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ good(){} bad(){} perfect(){} power(){} }; }
    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){}, bindToMain(){return{refresh(){}}} }; }
    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){} }; }
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { CoachClass = class{ constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); } onStart(){} onGood(){} onBad(){} onTimeLow(){} onEnd(){} onPerfect(){} }; }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(k){ const m = await import(MODE_PATH(k)); return { update:m.update, init:m.init, create:m.create, cleanup:m.cleanup, name:m.name||k }; }

  // ---------- FX ----------
  const FX = {
    popText(txt, {x,y}, style='score'){
      const el = document.createElement('div');
      const base = 'position:fixed;transform:translate(-50%,-50%);pointer-events:none;z-index:97;transition:all .6s ease-out;';
      const css = {
        score:  'font:900 18px ui-rounded;color:#fff;text-shadow:0 2px 10px #000;',
        perfect:'font:900 16px ui-rounded;color:#fef08a;text-shadow:0 2px 10px #000;',
        combo:  'font:900 14px ui-rounded;color:#a7f3d0;text-shadow:0 2px 10px #000;',
        fever:  'font:900 18px ui-rounded;color:#ffedd5;text-shadow:0 0 18px #f97316;',
        miss:   'font:900 14px ui-rounded;color:#fecaca;text-shadow:0 2px 10px #000;'
      }[style] || 'font:900 16px ui-rounded;color:#fff;text-shadow:0 2px 10px #000;';
      el.style.cssText = `${base}${css};left:${x|0}px;top:${y|0}px;opacity:1`;
      el.textContent = txt;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top = (y-36)+'px'; el.style.opacity = '0'; });
      setTimeout(()=>el.remove(), 700);
    },
    setPower(p01){
      const fill = $('#powerFill'); if (!fill) return;
      fill.style.width = Math.max(0, Math.min(1, p01))*100 + '%';
    }
  };

  // ---------- Runtime ----------
  let R = { playing:false, modeKey:'goodjunk', diff:'Normal', remain:45, raf:0, _secMark:0, _dtMark:0,
            sys:{score:null,sfx:null}, modeAPI:null, modeInst:null, coach:null,
            fever:false, feverAt:8, feverDecay:0.015, power:0 };

  function setBadges(){
    const sV = $('#scoreVal'); if (sV) sV.textContent = R.sys?.score?.get?.()||0;
    const mB = $('#modeBadge'); if (mB) mB.textContent = R.modeKey;
    const dB = $('#diffBadge'); if (dB) dB.textContent = R.diff;
  }

  function updateComboUI(e){
    // เติมเกจตามคอมโบ (normalize 0..1 ที่ 15 คอมโบ)
    const combo = R.sys.score.combo|0;
    const p = Math.min(1, combo/15);
    R.power = p;
    FX.setPower(p);

    if (!R.fever && combo >= R.feverAt){
      R.fever = true;
      if (e?.ui) FX.popText('FEVER!', e.ui, 'fever');
    }
  }
  function breakCombo(e){
    if ((R.sys?.score?.combo|0) > 0 && e?.ui){
      FX.popText('MISS', e.ui, 'miss'); // โชว์เฉพาะกรณี lose (มี ui)
    }
    R.sys.score.combo = 0;
    R.fever = false;
    R.power = 0;
    FX.setPower(0);
  }

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){ // { points, ui:{x,y}, kind:'good'|'perfect' }
        const pts = e?.points|0;
        if (pts){
          R.sys.score.add(pts);
          R.sys.score.combo = (R.sys.score.combo|0)+1;
          if ((R.sys.score.combo|0) > (R.sys.score.bestCombo|0)) R.sys.score.bestCombo = R.sys.score.combo|0;
        }
        setBadges();

        if (e?.ui){
          // คะแนน
          FX.popText(`+${pts}`, e.ui, 'score');
          // ป้าย perfect
          if (e?.kind === 'perfect'){ FX.popText('PERFECT', e.ui, 'perfect'); }
          // คอมโบ
          const c = R.sys.score.combo|0;
          FX.popText(`COMBO ×${c}`, {x:e.ui.x, y:e.ui.y-22}, 'combo');
        }
        updateComboUI(e);

        try{ Quests.event('hit', { result:e?.kind||'good', meta:e?.meta||{}, comboNow:R.sys.score.combo|0, fever:R.fever }); }catch{}
      },
      miss(e){ // แสดงเฉพาะกรณี lose:true และมีพิกัด
        if (e?.lose && e?.ui){ breakCombo(e); }
        else { // ไม่เสียแต้ม/ไม่มี ui -> ไม่แสดงอะไร
          R.sys.score.combo = 0; R.fever = false; R.power = 0; FX.setPower(0);
        }
      },
      power(k){ /* optional: แสดงป้าย power ถ้าต้องการ */ }
    };
  }

  function gameTick(){
    if (!R.playing) return;
    const tNow = performance.now();
    const secGone = Math.floor((tNow - R._secMark)/1000);
    if (secGone>=1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      if (R.remain===10) R.coach?.onTimeLow?.();
    }

    // fever decay ช้า ๆ เมื่อไม่มี hit
    if (R.fever){
      R.power = Math.max(0, R.power - R.feverDecay);
      FX.setPower(R.power);
      if (R.power<=0.01){ R.fever=false; }
    }

    try{
      const dt = (tNow - (R._dtMark||tNow))/1000; R._dtMark = tNow;
      if (typeof R.modeAPI?.update === 'function')        R.modeAPI.update(dt, busFor());
      else if (R.modeInst?.update)                        R.modeInst.update(dt, busFor());
      else if (R.modeAPI?.tick)                           R.modeAPI.tick({}, R.sys, {});
    }catch(e){ console.warn('[mode.update] error', e); }

    if (R.remain<=0) return endGame();
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if (!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    try{ Quests.endRun({ score:R.sys?.score?.get?.()||0 }); }catch{}
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(); }catch{}
    document.getElementById('menuBar')?.removeAttribute('data-hidden');
    R.coach?.onEnd?.(R.sys?.score?.get?.()||0);
    window.HHA._busy=false;
  }

  async function startGame(){
    if (window.HHA?._busy) return; window.HHA._busy=true;
    await loadCore(); Progress?.init?.();

    const body = document.body;
    R.modeKey = body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = body.getAttribute('data-diff') || 'Normal';

    // match time (เรียบง่าย)
    const base = { goodjunk:45, groups:60, hydration:50, plate:55 }[R.modeKey] || 45;
    R.remain = base + (R.diff==='Easy'?+5 : R.diff==='Hard'?-5:0);

    let api; try{ api = await loadMode(R.modeKey); } catch(e){ console.error(e); window.HHA._busy=false; return; }
    R.modeAPI = api; R.modeInst=null;

    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.score.combo = 0; R.sys.score.bestCombo = 0;
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') }); R.coach.onStart?.();
    try{ Quests.bindToMain?.({ coach:R.coach }); Quests.beginRun?.(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.remain); }catch{}

    if (api.create){ R.modeInst = api.create({ coach:R.coach }); R.modeInst.start?.({time:R.remain}); }
    else if (api.init){ api.init({}, {}, { time:R.remain, life:1600 }); }

    // reset fever UI
    R.fever=false; R.power=0; FX.setPower(0);

    document.getElementById('menuBar')?.setAttribute('data-hidden','1');
    setBadges();

    R.playing=true; R._secMark=performance.now(); R._dtMark=performance.now();
    R.raf = requestAnimationFrame(gameTick);
  }

  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Ensure canvas never blocks UI
  setTimeout(()=>{ const c = document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }},0);

  // Strong bind Start
  (function bindStartStrong(){
    const b = document.getElementById('btn_start'); if(!b) return;
    const clone = b.cloneNode(true); b.replaceWith(clone);
    const opts = { capture:true, passive:false };
    ['click','pointerup','touchend'].forEach(ev=> clone.addEventListener(ev,(e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); },opts));
    clone.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); }},opts);
  })();
})();
