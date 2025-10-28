// === Hero Health Academy — game/main.js (UI wired + HUD + Quests + Coach + Spawner) ===
window.__HHA_BOOT_OK = true;

// ----- Imports -----
import { Quests }      from '/webxr-health-mobile/HeroHealth/game/core/quests.js';
import { Progress }    from '/webxr-health-mobile/HeroHealth/game/core/progression.js';
// (ถ้ามี SFX/Powerups/VRInput ของคุณ ให้ import เพิ่มตรงนี้)
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

// ----- Minimal SFX stub (ใช้ของจริงแทนได้) -----
const SFX = {
  play(name){ /* ต่อภายหลังกับ soundbank.js */ }
};

// ----- HUD (นาฬิกา/คะแนน/ชิพเควสต์/เป้า) -----
const HUD = (()=> {
  // inject clock/score badge ถ้ายังไม่มี
  function ensureBasics(){
    const wrap = $('#hudWrap');
    if (!wrap) return;
    if (!$('#hudCore')) {
      const box = document.createElement('div');
      box.id = 'hudCore';
      box.className = 'hud hud-passive';
      box.style.position = 'fixed';
      box.style.right = '10px';
      box.style.top = '10px';
      box.style.display = 'grid';
      box.style.gap = '6px';
      box.style.zIndex = '40';
      box.innerHTML = `
        <div id="clockBadge" class="badge">00:45</div>
        <div id="scoreBadge" class="badge">Score 0</div>
        <div id="questChips" class="chips"></div>
      `;
      document.body.appendChild(box);
    }
  }
  ensureBasics();

  function setClock(sec){
    const mm = String(Math.floor(sec/60)).padStart(2,'0');
    const ss = String(sec%60).padStart(2,'0');
    setText('#clockBadge', `${mm}:${ss}`);
  }
  function setScore(n){ setText('#scoreBadge', `Score ${n|0}`); }
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
  }
  function coachSay(text, ms=1500){
    const el = $('#coachHUD'); if(!el) return;
    el.style.pointerEvents = 'none';
    el.style.position='fixed'; el.style.left='50%'; el.style.top='calc(100% - 120px)';
    el.style.transform='translateX(-50%)'; el.style.zIndex='45';
    el.style.background='rgba(0,0,0,.55)'; el.style.padding='8px 12px';
    el.style.borderRadius='12px';
    el.textContent = text;
    el.style.display='block';
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.style.display='none'; }, ms);
  }

  return { setClock, setScore, setQuestChips, setTarget, coachSay };
})();

// ให้ Quests ผูก HUD ไว้เพื่อ refresh chips ได้
Quests.bindToMain({ hud: { setQuestChips: HUD.setQuestChips } });

// ----- UI wiring (ทุกปุ่มใช้งานได้) -----
document.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('[data-action]');
  if(!btn) return;
  const act = btn.getAttribute('data-action');

  switch(act){
    case 'lang': {
      const lang = btn.getAttribute('data-lang')||'TH';
      STATE.lang = lang.toUpperCase();
      localStorage.setItem('hha_lang', STATE.lang);
      HUD.coachSay(STATE.lang==='TH'?'ภาษาไทย':'English');
      break;
    }
    case 'mode': {
      const m = btn.getAttribute('data-mode');
      if (MODES[m]) {
        STATE.mode = m;
        highlightSelection('mode', m);
        HUD.coachSay(m);
      }
      break;
    }
    case 'difficulty': {
      const d = btn.getAttribute('data-diff')||'Normal';
      STATE.difficulty = d;
      highlightSelection('difficulty', d);
      HUD.coachSay(`Difficulty: ${d}`);
      break;
    }
    case 'howto': {
      toast(STATE.lang==='TH'
        ? 'แตะ/คลิกสิ่งที่ใช่ สะสมคอมโบ หลบสิ่งผิดหมวด!'
        : 'Tap/click correct items, build combo, avoid wrong ones!');
      break;
    }
    case 'import': {
      doImport();
      break;
    }
    case 'export': {
      doExport();
      break;
    }
    case 'reset': {
      localStorage.removeItem('hha_save');
      toast('Progress cleared.');
      break;
    }
    case 'start': {
      startRun();
      break;
    }
    case 'restart': {
      hideResult(); startRun();
      break;
    }
    case 'back': {
      endRunAndBackToMenu();
      break;
    }
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

// ----- Run lifecycle -----
let _spawnTimer = null;

function startRun(){
  // UI states
  document.body.classList.remove('ui-mode-menu');
  $('#menuBar')?.setAttribute('style','display:none');
  $('#resultModal')?.setAttribute('style','display:none');

  // Reset state
  STATE.running = true;
  STATE.timeSec = 45;
  STATE.score   = 0;
  STATE.combo   = 0;
  STATE.bestCombo = 0;
  STATE.ctx = { };
  HUD.setClock(STATE.timeSec);
  HUD.setScore(STATE.score);
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
  _spawnTimer = setInterval(spawnOne, 700);

  // Focus play area for keyboard space test (optional)
  $('#gameLayer')?.focus?.();
}

function onTick(){
  if (!STATE.running) return;
  if (Date.now() < (STATE.freezeUntil||0)) {
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
    $('#resultModal')?.setAttribute('style','display:block');
  }

  // บันทึกความคืบหน้า
  try { Progress?.save?.(summary); } catch {}
}

function hideResult(){ $('#resultModal')?.setAttribute('style','display:none'); }

function endRunAndBackToMenu(){
  endRun(false);
  $('#resultModal')?.setAttribute('style','display:none');
  $('#menuBar')?.setAttribute('style','');
  document.body.classList.add('ui-mode-menu');
}

// ----- Difficulty profile -----
function diffOf(key){
  switch(key){
    case 'Easy':   return { life: 3500 };
    case 'Hard':   return { life: 2300 };
    default:       return { life: 3000 };
  }
}

// ----- Spawner (สร้าง “ไอคอนอาหาร” ให้คลิก) -----
function spawnOne(){
  if (!STATE.running) return;
  if (Date.now() < (STATE.freezeUntil||0)) return;

  const host = $('#spawnHost'); if (!host) return;

  // ให้โหมดสร้างเมตา
  const mode = MODES[STATE.mode] || MODES.goodjunk;
  let meta;
  try { meta = mode.pickMeta?.(diffOf(STATE.difficulty), STATE) || {}; } catch(e){ meta = {}; }

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'spawn-emoji';
  el.setAttribute('aria-label', meta.aria || meta.label || 'item');
  el.textContent = meta.char || '🍏';

  // random position (ในเขตปลอด HUD ด้านบน/ล่างเล็กน้อย)
  const pad = 18;
  const box = $('#gameLayer').getBoundingClientRect();
  const x = rndInt(pad, box.width  - pad*2);
  const y = rndInt(pad+24, box.height - pad*2 - 24);
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
  try { result = (MODES[STATE.mode]?.onHit)?.(meta, { score:{ add: addScore }, sfx:SFX }, STATE, { setTarget: HUD.setTarget }) || 'ok'; } catch(e){}

  // FX hit
  try { (MODES[STATE.mode]?.fx?.onHit)?.(el.offsetLeft, el.offsetTop, meta, STATE); } catch {}

  // combo & score
  if (result==='good' || result==='perfect'){
    STATE.combo = Math.min(999, STATE.combo+1);
    STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);
    const base = (result==='perfect'? 20: 10);
    const bonus = Math.floor(STATE.combo/10); // เล็กน้อยตามคอมโบ
    addScore(base + bonus);
  } else if (result==='bad') {
    STATE.combo = 0;
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

// ----- Accessibility: ป้องกันเมนูบังคลิกตอนเล่น -----
function setUIModePlaying(on){
  const menu = $('#menuBar');
  if(!menu) return;
  if (on) menu.style.display='none';
}

// debug expose (optional)
window.HHA = { STATE, startRun, endRun };
