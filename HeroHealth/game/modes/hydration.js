export const name = 'hydration';

/* Safe FX bootstrap (shared with groups.js) */
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{}, popText: ()=>{} };
    (async () => {
      try {
        const m = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

const Z = { LOW:'LOW', OK:'OK', HIGH:'HIGH' };
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

let _hud=null, _state=null;

function zoneOf(v){ if (v < 35) return Z.LOW; if (v > 70) return Z.HIGH; return Z.OK; }
function setHUDText(){
  const el = document.getElementById('targetBadge');
  if (!el || !_state) return;
  const mapTH = {LOW:'ต่ำ',OK:'พอดี',HIGH:'สูง'};
  const z = _state.zone;
  el.textContent = `${(_state.lang==='EN'?z:(mapTH[z]||z))} • ${_state.meter|0}`;
  const wrap = document.getElementById('targetWrap');
  if (wrap) wrap.style.display='inline-flex';
}
function toast(msg){
  let el=document.getElementById('toast'); if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);}
  el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1000);
}

/* legacy-ish hooks (to mirror groups.js structure) */
export function init(state={}, hud=null){
  _hud=hud; _state=state;
  state.lang=(state.lang||localStorage.getItem('hha_lang')||'TH').toUpperCase();
  state.meter=50; state.zone=Z.OK; state._secAcc=0; state._uiBuilt=false;
  setHUDText();
}
export function cleanup(){ _hud=null; _state=null; }
export function tick(){ /* per-second handled in update() */ }

/* In this mode, we don’t spawn emojis; we render two action buttons. */
function buildUI(host){
  if (!host || _state?._uiBuilt) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;left:50%;top:24px;transform:translateX(-50%);display:flex;gap:10px;z-index:90';
  bar.innerHTML = `
    <button id="btn_water" class="chip">💧 Water</button>
    <button id="btn_sweet" class="chip">🍬 Sweet</button>
  `;
  host.appendChild(bar);

  const water = bar.querySelector('#btn_water');
  const sweet = bar.querySelector('#btn_sweet');

  water?.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const before = _state.zone;
    _state.meter = clamp(_state.meter + 9, 0, 100);
    _state.zone  = zoneOf(_state.meter);
    // Bus for quests
    window.HHA?.bus?.hydrationClick?.('water', before);
    window.HHA?.bus?.scoreTick?.?.(); // allow main to re-eval acc/score per click if needed
    // Scoring rule: GOOD when raising from LOW, OK otherwise neutral, BAD if already HIGH
    if (before===Z.LOW) {
      window.HHA?.bus?.hit?.({ kind:'good', points:10, meta:{ zoneBefore:before, kind:'water' } });
      try{ window.HHA_FX.popText(`+10 💧`, { x:ev.clientX, y:ev.clientY, ms:700 }); }catch{}
    } else if (before===Z.HIGH) {
      document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),160);
      window.HHA?.bus?.miss?.({ meta:{ zoneBefore:before, kind:'water' } });
    }
    if (before!==_state.zone) window.HHA?.bus?.hydrationCross?.(before, _state.zone);
    setHUDText();
  }, { passive:false });

  sweet?.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const before = _state.zone;
    _state.meter = clamp(_state.meter - 14, 0, 100);
    _state.zone  = zoneOf(_state.meter);
    window.HHA?.bus?.hydrationClick?.('sweet', before);
    // GOOD when treating from HIGH → lower; BAD in LOW; neutral in OK
    if (before===Z.HIGH) {
      window.HHA?.bus?.hit?.({ kind:'good', points:10, meta:{ zoneBefore:before, kind:'sweet' } });
      try{ window.HHA_FX.popText(`+10 🍬`, { x:ev.clientX, y:ev.clientY, ms:700 }); }catch{}
    } else if (before===Z.LOW) {
      document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),160);
      window.HHA?.bus?.miss?.({ meta:{ zoneBefore:before, kind:'sweet' } });
    }
    if (before!==_state.zone) window.HHA?.bus?.hydrationCross?.(before, _state.zone);
    setHUDText();
  }, { passive:false });

  _state._uiBuilt = true;
}

export function create({ engine, hud, coach }){
  const host = document.getElementById('spawnHost');
  const state = {
    running:false, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    meter:50, zone:Z.OK, _secAcc:0, _uiBuilt:false, stats:{ okSec:0, highCount:0 }
  };
  _state = state; _hud = hud;

  function start(){
    stop(); state.running=true; state.meter=50; state.zone=Z.OK; state._secAcc=0; state.stats={ okSec:0, highCount:0 };
    buildUI(host); setHUDText(); coach?.onStart?.();
    toast(state.lang==='EN' ? 'Stay in OK zone!' : 'รักษาโซนพอดีให้นานที่สุด');
  }
  function stop(){ state.running=false; try{ /* keep UI persistent; it’s light */ }catch{} }

  function update(dt, Bus){
    if (!state.running) return;
    state._secAcc += dt;
    if (state._secAcc >= 1){
      state._secAcc = 0;

      // Gentle drift toward OK; random wobble
      if (state.zone===Z.LOW)  state.meter = clamp(state.meter + 3, 0, 100);
      if (state.zone===Z.HIGH) state.meter = clamp(state.meter - 4, 0, 100);
      if (Math.random() < 0.25) state.meter = clamp(state.meter + (Math.random()*4-2), 0, 100);

      const before = state.zone;
      state.zone = zoneOf(state.meter);
      if (before !== state.zone) Bus?.hydrationCross?.(before, state.zone);
      // Tick event for quests (“OK time”)
      Bus?.hydrationTick?.(state.zone);
      if (state.zone === Z.OK) state.stats.okSec++;
      if (state.zone === Z.HIGH) state.stats.highCount++;
      setHUDText();
    }
  }
  function cleanup(){ stop(); }

  // No emoji spawn/powers for hydration in this minimal spec
  return { start, stop, update, cleanup };
}
