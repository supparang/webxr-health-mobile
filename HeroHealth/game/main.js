// ===== Imports =====
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { SFX } from './core/sfx.js';
import { Leaderboard } from './core/leaderboard.js';
import { MissionSystem } from './core/mission.js';
import { PowerUpSystem } from './core/powerup.js';
import { ScoreSystem } from './core/score.js';
import { FloatingFX } from './core/fx.js';
import { Coach } from './core/coach.js';
import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

// ===== Config =====
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200, hydWaterRate:0.78 },
  Normal: { time:60, spawn:700, life:3000, hydWaterRate:0.66 },
  Hard:   { time:50, spawn:560, life:1900, hydWaterRate:0.55 }
};

// ===== Systems =====
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:4 });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();

const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  ctx: {},
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  soundOn: (localStorage.getItem('hha_sound') ?? '1') === '1',
  fever: false,
  mission: null,   // {key, target, remainSec, progress}
  rank: localStorage.getItem('hha_rank') || 'C'
};

const eng = new Engine(THREE, document.getElementById('c'));
const fx  = new FloatingFX(eng);
const coach = new Coach({ lang: state.lang });
const $ = (s)=>document.querySelector(s);

// Boost คะแนนตาม PowerUp
score.setBoostFn(()=> power.scoreBoost || 0);
// Hook คอมโบ/ฟีเวอร์
score.setHandlers({
  onCombo:(x)=>{
    // แจ้งโค้ช และเข้าสู่ FEVER เมื่อคอมโบถึง 10x
    coach.onCombo?.(x);
    if(!state.fever && x>=10){
      state.fever = true;
      document.body.classList.add('fever-bg');
      coach.onFever?.();
      try{ sfx.play('sfx-powerup'); }catch{}
      power.apply('boost'); // เพิ่มคะแนนชั่วคราว
      setTimeout(()=>{
        state.fever = false;
        document.body.classList.remove('fever-bg');
      }, 7000);
    }
  }
});

// ===== I18N =====
const I18N = {
  TH:{brand:'HERO HEALTH ACADEMY',
    score:'คะแนน', combo:'คอมโบ', time:'เวลา', target:'หมวด', quota:'โควตา', hydro:'สมดุลน้ำ',
    mode:'โหมด', diff:'ความยาก',
    modes:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'},
    btn:{start:'▶ เริ่มเกม', pause:'⏸ พัก', restart:'↻ เริ่มใหม่', help:'❓ วิธีเล่น', ok:'โอเค', replay:'↻ เล่นอีกครั้ง', home:'🏠 หน้าหลัก'},
    gfx:{quality:'กราฟิก: ปกติ', low:'กราฟิก: ประหยัด'},
    sound:{on:'🔊 เสียง: เปิด', off:'🔇 เสียง: ปิด'},
    helpTitle:'วิธีเล่น',
    helpBody:{
      goodjunk:'เก็บอาหารดี (เช่น 🥦🍎) หลีกเลี่ยงของขยะ (🍔🍟🥤)\nคลิก/แตะ/จ้องค้างเพื่อเก็บคะแนน',
      groups:'ดู 🎯 หมวดเป้าหมายบน HUD แล้วเก็บอิโมจิในหมวดนั้นเท่านั้น\nถูก +7 ผิด -2 ทุกๆ 3 ชิ้นจะเปลี่ยนหมวด',
      hydration:'รักษาแถบน้ำ 45–65% ให้พอดี\nเก็บ 💧 +5 (คะแนน +5) / ของหวาน 🧋 -6 (คะแนน -3)\nน้ำเกิน+เก็บน้ำ หรือ น้ำน้อย+เก็บหวาน = โทษหนัก',
      plate:'เติมตามโควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1\nครบชุด +14 เกินโควตา -1s'
    },
    summary:'สรุปผล',
    mission:'ภารกิจ 45s',
    badge:'เหรียญ'
  },
  EN:{brand:'HERO HEALTH ACADEMY',
    score:'Score', combo:'Combo', time:'Time', target:'Target', quota:'Quota', hydro:'Hydration',
    mode:'Mode', diff:'Difficulty',
    modes:{goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'},
    btn:{start:'▶ Start', pause:'⏸ Pause', restart:'↻ Restart', help:'❓ How to Play', ok:'OK', replay:'↻ Replay', home:'🏠 Home'},
    gfx:{quality:'Graphics: Quality', low:'Graphics: Performance'},
    sound:{on:'🔊 Sound: On', off:'🔇 Sound: Off'},
    helpTitle:'How to Play',
    helpBody:{
      goodjunk:'Collect healthy items (🥦🍎) and avoid junk (🍔🍟🥤).\nClick/Tap/Gaze to score.',
      groups:'Follow the 🎯 target group on HUD.\nRight +7, wrong -2. Target rotates every 3 hits.',
      hydration:'Keep hydration 45–65%.\n💧 +5 (score +5) / 🧋 -6 (score -3)\nHigh+💧 or Low+🧋 = heavy penalty.',
      plate:'Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1.\nPerfect +14, Overfill: -1s'
    },
    summary:'Summary',
    mission:'45s Mission',
    badge:'Badge'
  }
};

// ===== UI =====
function applyLang(){
  const L = I18N[state.lang];
  $('#brandTitle')?.( $('#brandTitle').textContent = L.brand );
  $('#t_score')?.( $('#t_score').textContent = L.score );
  $('#t_combo')?.( $('#t_combo').textContent = L.combo );
  $('#t_time') ?. ( $('#t_time').textContent  = L.time );
  $('#t_target')?.( $('#t_target').textContent= L.target );
  $('#t_quota') ?. ( $('#t_quota').textContent = L.quota );
  $('#t_hydro') ?. ( $('#t_hydro').textContent = L.hydro );
  $('#t_mode')  ?. ( $('#t_mode').textContent  = L.mode );
  $('#t_diff')  ?. ( $('#t_diff').textContent  = L.diff );
  $('#modeName')?.( $('#modeName').textContent= L.modes[state.modeKey] );
  $('#difficulty')?.( $('#difficulty').textContent= L.diffs[state.difficulty] );

  $('#btn_start')  && ( $('#btn_start').textContent  = L.btn.start );
  $('#btn_pause')  && ( $('#btn_pause').textContent  = L.btn.pause );
  $('#btn_restart')&& ( $('#btn_restart').textContent= L.btn.restart );
  $('#btn_help')   && ( $('#btn_help').textContent   = L.btn.help );
  $('#btn_ok')     && ( $('#btn_ok').textContent     = L.btn.ok );
  $('#btn_replay') && ( $('#btn_replay').textContent = L.btn.replay );
  $('#btn_home')   && ( $('#btn_home').textContent   = L.btn.home );

  $('#m_goodjunk') && ( $('#m_goodjunk').textContent = '🥗 ' + L.modes.goodjunk );
  $('#m_groups')   && ( $('#m_groups').textContent   = '🍽️ ' + L.modes.groups );
  $('#m_hydration')&& ( $('#m_hydration').textContent= '💧 ' + L.modes.hydration );
  $('#m_plate')    && ( $('#m_plate').textContent    = '🍱 ' + L.modes.plate );

  $('#d_easy')   && ( $('#d_easy').textContent   = L.diffs.Easy );
  $('#d_normal') && ( $('#d_normal').textContent = L.diffs.Normal );
  $('#d_hard')   && ( $('#d_hard').textContent   = L.diffs.Hard );

  $('#gfxToggle')   && ( $('#gfxToggle').textContent   = '🎛️ ' + (state.gfx==='low' ? L.gfx.low : L.gfx.quality) );
  $('#soundToggle') && ( $('#soundToggle').textContent = state.soundOn ? L.sound.on : L.sound.off );

  $('#h_help')     && ( $('#h_help').textContent     = L.helpTitle );
  $('#h_summary')  && ( $('#h_summary').textContent  = L.summary );

  coach.setLang?.(state.lang);
}
function applyGFX(){
  const L = I18N[state.lang];
  if(state.gfx==='low'){
    eng.renderer.setPixelRatio(0.75);
    document.body.classList.add('low-gfx');
    $('#gfxToggle') && ( $('#gfxToggle').textContent = '🎛️ ' + L.gfx.low );
  }else{
    eng.renderer.setPixelRatio(window.devicePixelRatio || 1);
    document.body.classList.remove('low-gfx');
    $('#gfxToggle') && ( $('#gfxToggle').textContent = '🎛️ ' + L.gfx.quality );
  }
}
function applySound(){
  const L = I18N[state.lang];
  sfx.setEnabled?.(state.soundOn);
  if(!sfx.setEnabled) sfx.enabled = state.soundOn;
  $('#soundToggle') && ( $('#soundToggle').textContent = state.soundOn ? L.sound.on : L.sound.off );
  localStorage.setItem('hha_sound', state.soundOn ? '1' : '0');
}
function updateHUD(){
  $('#score') && ( $('#score').textContent = score.score|0 );
  $('#combo') && ( $('#combo').textContent = 'x' + (score.combo||0) );
  $('#time')  && ( $('#time').textContent  = state.timeLeft|0 );
}
function showMissionToast(txt){
  fx.spawn3D(null, txt, 'good');
  try{ sfx.play('sfx-perfect'); }catch{}
}

// ===== Gameplay =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey]; if(!mode) return;
  const meta = mode.pickMeta(diff, state);
  const el = document.createElement('button');
  el.className = 'item';
  el.textContent = meta.char || '?';

  // Safe area
  const menuSafe = 18, topMin = 12, topMax = 100 - menuSafe;
  el.style.left = (10 + Math.random()*80) + 'vw';
  el.style.top  = (topMin + Math.random()*(topMax - topMin)) + 'vh';

  el.onclick = () => {
    mode.onHit(meta, {score, sfx, power, fx}, state, hud);
    state.ctx.hits = (state.ctx.hits||0) + 1;

    // Coach & SFX
    if(meta.good || meta.ok){ coach.onGood?.(); try{ sfx.play('sfx-good'); }catch{}; }
    else { coach.onBad?.(state.modeKey); try{ sfx.play('sfx-bad'); }catch{}; }

    updateHUD();
    el.remove();
  };
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), (diff.life||2500));
}

const timers = { spawn:0, tick:0 };

function spawnLoop(){
  if(!state.running) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(diff);
  const accel = Math.max(0.5, 1 - (score.score/400));
  const next  = Math.max(220, diff.spawn * accel * power.timeScale);
  timers.spawn = setTimeout(spawnLoop, next);
}

function start(){
  end(true);
  hud.hideHydration(); hud.hideTarget(); hud.hidePills();

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true;
  state.timeLeft = diff.time;
  state.ctx = { hits:0, perfectPlates:0, hyd:50 };
  state.fever = false;
  score.reset();
  updateHUD();

  MODES[state.modeKey].init?.(state, hud, diff);
  if(state.modeKey!=='hydration') hud.hideHydration();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget();
  if(state.modeKey!=='plate') hud.hidePills();

  // เริ่ม Challenge Mission 45s ตามโหมด
  state.mission = mission.start(state.modeKey);
  coach.onStart?.(state.modeKey);
  try{ sfx.play('sfx-good'); }catch{}
  tick(); spawnLoop();
}

function end(silent=false){
  state.running = false;
  clearTimeout(timers.spawn);
  clearTimeout(timers.tick);
  hud.hideHydration(); hud.hideTarget(); hud.hidePills();

  // ประเมินภารกิจท้ายรอบ (เผื่อยังไม่ประเมิน)
  if(state.mission && !state.mission.done){
    mission.evaluate(state, score, (res)=>{
      if(res.success){
        awardBadge('time_master');
      }
    });
  }

  if(!silent){
    const L = I18N[state.lang];
    try{ board.submit(state.modeKey, state.difficulty, score.score); }catch{}
    const top = (board.getTop?.(5) || []).map((r,i)=>`${i+1}. ${r.mode} • ${r.diff} – ${r.score}`).join('<br>');
    $('#resCore')   && ( $('#resCore').innerHTML = `${L.score}: <b>${score.score}</b> | ${L.mode}: <b>${L.modes[state.modeKey]}</b>` );
    $('#resBoard')  && ( $('#resBoard').innerHTML = `<h4>🏆 TOP</h4>${top}` );
    $('#result')    && ( $('#result').style.display = 'flex' );
    coach.onEnd?.(score.score, score.score>=200?'A':(score.score>=120?'B':'C'));
  }
}

function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();

  // นับถอยหลังภารกิจ 45s + ประเมินสำเร็จ/ล้มเหลวแบบเรียลไทม์
  if(state.mission){
    state.mission.remainSec = Math.max(0, state.mission.remainSec - 1);
    mission.evaluate(state, score, (res)=>{
      if(res.success && !state.mission.done){
        state.mission.done = true;
        showMissionToast('🏁 Mission Complete');
        awardBadge('time_master');
      }
    });
    if(state.mission.remainSec===0 && !state.mission.done){
      state.mission.done = true;
      fx.spawn3D(null, '⌛ Mission Failed', 'bad');
    }
  }

  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){
    document.body.classList.add('flash');
    try{ document.getElementById('sfx-tick').play(); }catch{}
  }else{
    document.body.classList.remove('flash');
  }
  timers.tick = setTimeout(tick, 1000);
}

// ===== Badges & Rank =====
function getBadges(){
  try{ return JSON.parse(localStorage.getItem('hha_badges')||'{}'); }catch{ return {}; }
}
function saveBadges(b){ localStorage.setItem('hha_badges', JSON.stringify(b)); }
function awardBadge(key){
  const b = getBadges();
  if(!b[key]){
    b[key] = true;
    saveBadges(b);
    fx.spawn3D(null, `🏅 ${key.toUpperCase()}`, 'good');
    try{ sfx.play('sfx-perfect'); }catch{}
    // อัปเกรด rank แบบง่าย
    const total = Object.keys(b).length;
    let r = 'C';
    if(total>=3) r='B';
    if(total>=6) r='A';
    if(total>=9) r='S';
    state.rank = r;
    localStorage.setItem('hha_rank', r);
  }
}

// ===== Events =====
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock(), { once:true, passive:true });
});
document.addEventListener('click', (e)=>{
  const b = e.target.closest('#menuBar button'); if(!b) return;
  const a = b.getAttribute('data-action');
  const v = b.getAttribute('data-value');

  if(a==='mode'){ state.modeKey = v; applyLang(); }
  if(a==='diff'){ state.difficulty = v; applyLang(); }
  if(a==='start') start();
  if(a==='pause') state.running = !state.running;
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){
    const L = I18N[state.lang];
    const help = document.getElementById('help');
    const body = document.getElementById('helpBody');
    if(help && body){ body.textContent = L.helpBody[state.modeKey] || ''; help.style.display = 'flex'; }
  }
});
document.getElementById('help')?.addEventListener('click', (e)=>{
  if(e.target.matches('[data-action="helpClose"], #help')) e.currentTarget.style.display = 'none';
});
document.getElementById('result')?.addEventListener('click', (e)=>{
  const a = e.target.getAttribute('data-result');
  if(a==='replay'){ e.currentTarget.style.display='none'; start(); }
  if(a==='home'){ e.currentTarget.style.display='none'; }
});
document.getElementById('langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  applyLang();
});
document.getElementById('gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  applyGFX();
});
document.getElementById('soundToggle')?.addEventListener('click', ()=>{
  state.soundOn = !state.soundOn; applySound();
  if(state.soundOn){ try{ sfx.play('sfx-good',{volume:0.9}); }catch{} }
});

// ===== Boot =====
applyLang(); applyGFX(); applySound();
window.__HHA_BOOT_OK = true;
