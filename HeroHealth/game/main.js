// === Hero Health Academy — game/main.js (UI wired + HUD + Quests + Coach + Spawner) ===
window.__HHA_BOOT_OK = true;

// ----- Imports -----
import { Quests }      from '/webxr-health-mobile/HeroHealth/game/core/quests.js';
import { Progress }    from '/webxr-health-mobile/HeroHealth/game/core/progression.js';

import * as goodjunk   from '/webxr-health-mobile/HeroHealth/game/modes/goodjunk.js';
import * as groups     from '/webxr-health-mobile/HeroHealth/game/modes/groups.js';
import * as hydration  from '/webxr-health-mobile/HeroHealth/game/modes/hydration.js';
import * as plate      from '/webxr-health-mobile/HeroHealth/game/modes/plate.js';

// ----- Helpers -----
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };
const clamp = (n,a,b)=>Math.max(a, Math.min(b,n));
const rndInt=(a,b)=> (a + Math.floor(Math.random()*(b-a+1)));
const nowMs = ()=> performance?.now?.() || Date.now();

const MODES = { goodjunk, groups, hydration, plate };

// ----- Global state -----
const STATE = {
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  mode: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeSec: 45,
  timerId: null,
  score: 0,
  combo: 0,
  bestCombo: 0,
  freezeUntil: 0,
  ctx: {}
};

// ----- Minimal SFX stub -----
const SFX = { play(name){ try{ $('#'+name)?.currentTime=0, $('#'+name)?.play(); }catch{} } };

// ----- HUD (ใช้ element ที่มีใน index.html) -----
const HUD = (()=> {
  function setClock(sec){
    // badge (ถ้ามี)
    const mm = String(Math.floor(sec/60)).padStart(2,'0');
    const ss = String(sec%60).padStart(2,'0');
    setText('#clockBadge', `${mm}:${ss}`);
    // fields เดิม
    setText('#time', sec|0);
  }
  function setScore(n){
    setText('#scoreBadge', `Score ${n|0}`);
    setText('#score', n|0);
  }
  function setCombo(c){
    setText('#combo', 'x'+(c|0));
  }
  function setQuestChips(list){
    const host = $('#questChips'); if(!host) return;
    host.innerHTML = (list||[]).map(q=>{
      const prog = clamp((q.progress/q.need)*100, 0, 100)|0;
      return `<div class="chip" title="${q.label||q.key}">
        <span>${q.icon||'⭐'}</span>
        <b>${q.progress}/${q.need}</b>
        <i style="display:block;height:4px;background:${q.done?'#66bb6a':'#29b6f6'};width:${prog}%;border-radius:4px"></i>
      </div>`;
    }).join('');
  }
  function setTarget(key, have, need){
    const badge = $('#targetBadge'); if(!badge) return;
    const nameTH = ({veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'})[key] || key || '—';
    badge.textContent = `${nameTH} • ${have|0}/${need|0}`;
    const wrap = $('#targetWrap'); if (wrap) wrap.style.display = 'inline-flex';
  }
  function coachSay(text, ms=1500){
    const box = $('#coachHUD'); const txt = $('#coachText');
    if(!box || !txt) return;
    box.style.pointerEvents = 'none';
    box.style.position='fixed'; box.style.left='50%'; box.style.top='96px';
    box.style.transform='translateX(-50%)'; box.style.zIndex='45';
    box.style.display='flex';
    txt.textContent = text;
    clearTimeout(box._t);
    box._t = setTimeout(()=>{ box.style.display='none'; }, ms);
  }
  return { setClock, setScore, setCombo, setQuestChips, setTarget, coachSay };
})();

// ให้ Quests ผูก HUD ไว้เพื่อ refresh chips ได้
Quests.bindToMain({ hud: { setQuestChips: HUD.setQuestChips } });

// ----- UI wiring (ปุ่มทั้งหมด) -----
document.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('[data-action]');
  if(!btn) return;
  const act = btn.getAttribute('data-action');

  switch(act){
    case 'lang': {
      const lang = (btn.getAttribute('data-lang')||'TH').toUpperCase();
      STATE.lang = lang; localStorage.setItem('hha_lang', STATE.lang);
      toast(STATE.lang==='TH'?'ภาษาไทย':'English');
      break;
    }
    case 'mode': {
      const m = btn.getAttribute('data-mode');
      if (MODES[m]) {
        STATE.mode = m;
        highlightSelection('mode', m);
        setText('#modeName', btn.textContent.trim());
        HUD.coachSay(STATE.lang==='TH'?'โหมด: '+btn.textContent.trim():'Mode: '+m);
      }
      break;
    }
    case 'difficulty': {
      const d = btn.getAttribute('data-diff')||'Normal';
      STATE.difficulty = d;
      highlightSelection('difficulty', d);
      setText('#difficulty', ({Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'})[d]||d);
      HUD.coachSay(`Difficulty: ${d}`);
      break;
    }
    case 'howto': {
      showHelpFor(STATE.mode);
      break;
    }
    case 'import': doImport(); break;
    case 'export': doExport(); break;
    case 'reset':  localStorage.removeItem('hha_save'); toast('Progress cleared.'); break;
    case 'start':  startRun(); break;
    case 'restart': hideResult(); startRun(); break;
    case 'back':   endRunAndBackToMenu(); break;

    // โมดัล
    case 'helpClose': closeHelp(); break;
  }
});

function highlightSelection(kind, value){
  $$(`[data-action="${kind}"]`).forEach(b=>{
    const v = b.getAttribute(kind==='mode'?'data-mode':'data-diff');
    b.classList.toggle('active', v===value);
  });
}

function toast(msg){
  const el = $('#toast'); if(!el) return;
  el.textContent = msg; el.style.display='block';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ el.classList.remove('show'); el.style.display='none'; }, 1200);
}

// ----- Help Modal -----
function showHelpFor(mode){
  const m = mode||'goodjunk';
  const mapTH = {
    goodjunk: 'แตะของดี ✅ หลีกเลี่ยงของขยะ ❌ เก็บคอมโบให้ได้มากที่สุด!',
    groups:   'ทำตามหมวดเป้าหมาย 🎯 ที่แสดงบน HUD แตะให้ครบโควตาแล้วเปลี่ยนเป้า',
    hydration:'คุมแถบน้ำให้อยู่ในโซน OK 💧 จิบพอดี หลีกเลี่ยงเกิน',
    plate:    'ใส่อาหารให้ถูกหมวดตามโควตา 🍱 เกินโควตาจะโดนลงโทษชั่วคราว'
  };
  const mapEN = {
    goodjunk: 'Tap healthy ✅ avoid junk ❌ keep your combo!',
    groups:   'Follow the target group 🎯 shown on HUD, fill quota then cycle',
    hydration:'Keep hydration in the OK zone 💧 sip smartly, avoid over',
    plate:    'Place items into correct quotas 🍱 over-quota triggers penalty'
  };
  const body = $('#helpBody'); const wrap = $('#help');
  if (body && wrap){
    body.textContent = (STATE.lang==='TH'?mapTH:mapEN)[m] || '';
    wrap.style.display='flex';
  }
}
function closeHelp(){ const wrap = $('#help'); if(wrap) wrap.style.display='none'; }

// ----- Run lifecycle -----
let _spawnTimer = null;

function startRun(){
  // UI states
  $('#menuBar')?.setAttribute('style','display:none');
  $('#resultModal')?.setAttribute('style','display:none');
  $('#targetWrap')?.setAttribute('style','display:none');
  $('#plateTracker')?.setAttribute('style','display:none');
  $('#hydroWrap')?.setAttribute('style','display:none');

  // Reset state
  STATE.running = true;
  STATE.timeSec = 45;
  STATE.score   = 0;
  STATE.combo   = 0;
  STATE.bestCombo = 0;
  STATE.ctx = { };
  HUD.setClock(STATE.timeSec);
  HUD.setScore(STATE.score);
  HUD.setCombo(STATE.combo);
  HUD.setQuestChips([]);

  // Init mode
  const mode = MODES[STATE.mode] || MODES.goodjunk;
  try { mode.init?.(STATE, { setTarget: HUD.setTarget }, diffOf(STATE.difficulty)); } catch(e){ console.error(e); }

  // Quests
  Quests.beginRun(STATE.mode, STATE.difficulty, STATE.lang, STATE.timeSec);

  // Coach
  HUD.coachSay(STATE.lang==='TH'?'เริ่มกันเลย!':'Let’s go!');

  // Start timer
  if (STATE.timerId) clearInterval(STATE.timerId);
  STATE.timerId = setInterval(onTick, 1000);

  // Start spawner
  if (_spawnTimer) clearInterval(_spawnTimer);
  _spawnTimer = setInterval(spawnOne, 720);

  // Focus play area
  $('#gameLayer')?.focus?.();
}

function onTick(){
  if (!STATE.running) return;

  if (nowMs() < (STATE.freezeUntil||0)) {
    HUD.setClock(STATE.timeSec);
    Quests.tick({ score: STATE.score|0 });
    return;
  }

  STATE.timeSec = Math.max(0, STATE.timeSec - 1);
  HUD.setClock(STATE.timeSec);
  Quests.tick({ score: STATE.score|0 });

  // โมดูลที่มี tick
  try { (MODES[STATE.mode]?.tick)?.(STATE, { sfx:SFX }, { setTarget: HUD.setTarget }); } catch(e){}

  if (STATE.timeSec<=0){
    endRun(true);
  }
}

function endRun(showResult){
  STATE.running = false;
  clearInterval(STATE.timerId); STATE.timerId=null;
  clearInterval(_spawnTimer); _spawnTimer=null;

  // ให้โหมด cleanup
  try { (MODES[STATE.mode]?.cleanup)?.(STATE, { setTarget: HUD.setTarget }); } catch(e){}

  const summary = {
    score: STATE.score|0,
    bestCombo: STATE.bestCombo|0,
    time: 45,
    mode: STATE.mode,
    difficulty: STATE.difficulty
  };

  const quests = Quests.endRun(summary);

  if (showResult){
    const body = $('#resultBody');
    if (body){
      body.innerHTML = `
        <div>Score: <b>${summary.score}</b></div>
        <div>Best Combo: <b>${summary.bestCombo}</b></div>
        <div>Quests:
          <ul style="margin:.25rem 0 0 1rem">
            ${quests.map(q=>`<li>${q.label||q.id} — ${q.done?'✅':'❌'}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    $('#resultModal')?.setAttribute('style','display:flex');
  }

  // Save
  try { Progress?.save?.(summary); } catch {}
}

function hideResult(){ $('#resultModal')?.setAttribute('style','display:none'); }

function endRunAndBackToMenu(){
  endRun(false);
  $('#resultModal')?.setAttribute('style','display:none');
  $('#menuBar')?.setAttribute('style','');
}

// ----- Difficulty profile -----
function diffOf(key){
  switch(key){
    case 'Easy':   return { life: 3500 };
    case 'Hard':   return { life: 2300 };
    default:       return { life: 3000 };
  }
}

// ----- Spawner -----
function spawnOne(){
  if (!STATE.running) return;
  if (nowMs() < (STATE.freezeUntil||0)) return;

  const host = $('#spawnHost'); if (!host) return;
  const box  = $('#gameLayer')?.getBoundingClientRect?.(); if (!box) return;

  // ให้โหมดสร้างเมตา
  const mode = MODES[STATE.mode] || MODES.goodjunk;
  let meta;
  try { meta = mode.pickMeta?.(diffOf(STATE.difficulty), STATE) || {}; } catch(e){ meta = {}; }

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'spawn-emoji';
  el.setAttribute('aria-label', meta.aria || meta.label || 'item');
  el.textContent = meta.char || '🍏';

  // random position (กันขอบ)
  const pad = 22;
  const x = rndInt(pad, Math.max(pad, box.width  - pad*2));
  const y = rndInt(pad+24, Math.max(pad+24, box.height - pad*2 - 24));
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;

  // lifetime
  const life = clamp(Number(meta.life)>0?Number(meta.life): 3000, 600, 5000);
  const tdie = setTimeout(()=> el.remove(), life);

  // FX on spawn
  try { (MODES[STATE.mode]?.fx?.onSpawn)?.(el, STATE); } catch {}

  el.addEventListener('click', ()=>{
    clearTimeout(tdie);
    handleHit(meta, el);
  }, { passive:true });

  host.appendChild(el);
}

// ----- Hit handling -----
function handleHit(meta, el){
  // ให้โหมดคำนวณผลลัพธ์
  let result = 'ok';
  try {
    result = (MODES[STATE.mode]?.onHit)?.(
      meta,
      { score:{ add: addScore }, sfx:SFX },
      STATE,
      { setTarget: HUD.setTarget }
    ) || 'ok';
  } catch(e){}

  // FX hit
  try { (MODES[STATE.mode]?.fx?.onHit)?.(el.offsetLeft, el.offsetTop, meta, STATE); } catch {}

  // combo & score
  if (result==='good' || result==='perfect'){
    STATE.combo = Math.min(999, STATE.combo+1);
    STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);
    HUD.setCombo(STATE.combo);
    const base = (result==='perfect'? 20: 10);
    const bonus = Math.floor(STATE.combo/10);
    addScore(base + bonus);
  } else if (result==='bad') {
    STATE.combo = 0;
    HUD.setCombo(STATE.combo);
  }

  // Quests event
  Quests.event('hit', { result, meta, comboNow: STATE.combo, _ctx:{ score: STATE.score|0 } });

  // remove
  el.remove();
}

function addScore(n){
  STATE.score = Math.max(0, (STATE.score|0) + (n|0));
  HUD.setScore(STATE.score);
}

// ----- Import / Export -----
function doExport(){
  try {
    const data = Progress?.export?.() || { score: STATE.score, bestCombo: STATE.bestCombo, ts: Date.now() };
    const s = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`;
    const a = document.createElement('a');
    a.href = s; a.download = `HHA_progress_${Date.now()}.json`; a.click();
    toast('Exported.');
  } catch {
    toast('Export failed.');
  }
}
function doImport(){
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='.json,application/json';
  inp.onchange = async ()=>{
    const f = inp.files?.[0]; if (!f) return;
    try{
      const txt = await f.text();
      const data = JSON.parse(txt);
      if (Progress?.import) Progress.import(data);
      localStorage.setItem('hha_save', JSON.stringify(data));
      toast('Imported.');
    }catch{ toast('Import failed.'); }
  };
  inp.click();
}

// ----- Menu default highlight -----
highlightSelection('mode', STATE.mode);
highlightSelection('difficulty', STATE.difficulty);

// ----- Debug expose -----
window.HHA = { STATE, startRun, endRun };
