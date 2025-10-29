// === Hero Health Academy — game/main.js (r4 stable HUD+Quests+Result) ===
import { HUD }            from './core/hud.js';
import { Quests }         from './core/quests.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { Leaderboard }    from './core/leaderboard.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText=(sel,txt)=>{ const el=$(sel); if(el) el.textContent=txt; };

const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running:false,
  timeLeft:45,
  timers:{ sec:0 },

  hud:null,
  score:null,
  power:null,
  leader:null,
};

boot();

function boot(){
  App.hud   = new HUD();
  App.score = new ScoreSystem();
  App.power = new PowerUpSystem();
  App.leader= new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

  App.score.setHandlers({
    change:(val,{delta,meta})=>{
      App.hud.setScore(val|0);
      if (meta?.kind){
        Quests.event('hit', { result: meta.kind, comboNow: App.score.combo|0, meta });
      }
    }
  });

  // Quest HUD binding + lang
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  bindMenu(); bindResultModal(); bindToggles();
  reflectMenu();

  // autoplay guard (เพื่อปลดล็อก audio ภายนอก)
  document.addEventListener('pointerdown',()=>{}, { once:true });
}

function bindMenu(){
  $('#m_goodjunk')?.addEventListener('click', ()=>setMode('goodjunk'));
  $('#m_groups')  ?.addEventListener('click', ()=>setMode('groups'));
  $('#m_hydration')?.addEventListener('click',()=>setMode('hydration'));
  $('#m_plate')   ?.addEventListener('click', ()=>setMode('plate'));

  $('#d_easy')  ?.addEventListener('click', ()=>setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=>setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=>setDiff('Hard'));

  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH')?'EN':'TH';
    setText('#langToggle', App.lang);
    Quests.setLang(App.lang);
  });

  $('#btn_start')?.addEventListener('click', startGame, { capture:true });
}

function bindResultModal(){
  document.querySelectorAll('#result [data-result]').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      const act = e.currentTarget.getAttribute('data-result');
      hideModal('#result');
      if (act==='replay') startGame(); else goHome();
    });
  });
  $('#btn_open_board')?.addEventListener('click',()=>{
    hideModal('#result'); showModal('#boardModal');
  });
  $('#lb_close')?.addEventListener('click',()=>hideModal('#boardModal'));
}

function bindToggles(){
  $('#soundToggle')?.addEventListener('click', ()=>{ /* plug to sfx if needed */ });
  $('#gfxToggle')  ?.addEventListener('click', ()=>{ const v=document.body.getAttribute('data-gfx')==='1'?'0':'1'; document.body.setAttribute('data-gfx',v); });
}

function reflectMenu(){
  $$('.tile').forEach(t=>t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', nameOf(App.mode));

  $$('#d_easy,#d_normal,#d_hard').forEach(c=>c.classList.remove('active'));
  (App.diff==='Easy'  ) && $('#d_easy')  ?.classList.add('active');
  (App.diff==='Normal') && $('#d_normal')?.classList.add('active');
  (App.diff==='Hard'  ) && $('#d_hard')  ?.classList.add('active');
  setText('#difficulty', App.diff);
}

function nameOf(m){
  return m==='goodjunk' ? 'Good vs Junk'
       : m==='groups'   ? '5 Food Groups'
       : m==='hydration'? 'Hydration'
       : m==='plate'    ? 'Healthy Plate' : m;
}

function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){ App.diff=d; App.secs = (d==='Easy')?50:(d==='Hard'?40:45); reflectMenu(); }

/* ===== Game loop ===== */
function startGame(){
  if (App.running) endGame(true);

  // reset HUD & states
  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);

  App.score.reset();
  App.power.dispose();

  // start quests (3 ชิ้น) + ตั้งเวลา
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  // spawn demo items (แบบ DOM-spawn ทดสอบทุกโหมด)
  ensureSpawnerFor(App.mode);

  App.running = true;
  App.hud.toast(App.lang==='TH'?'เริ่มเกม!':'Let’s go!', 900);
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // เควสต์ประเมินทุกวินาที (ส่งคะแนนปัจจุบัน)
  Quests.tick({ score: App.score.get() });

  if (App.timeLeft<=0) endGame(false);
}

function endGame(isAbort=false){
  if (!App.running) return;
  App.running=false;
  clearInterval(App.timers.sec);

  const scoreNow = App.score.get()|0;
  const quests   = Quests.endRun({ score: scoreNow });

  setText('#resultText', (App.lang==='TH'?'คะแนน: ':'Score: ') + scoreNow);
  // mini-top (แสดงเควสต์ที่ทำสำเร็จ)
  const done = quests.filter(q=>q.done);
  const fail = quests.filter(q=>q.fail && !q.done);
  const mini = [
    done.length ? `✅ ${done.length} quest(s)` : '',
    fail.length ? `❌ ${fail.length} missed`   : ''
  ].filter(Boolean).join('  •  ');
  $('#pbRow') && ( $('#pbRow').textContent = mini );
  showModal('#result');

  App.power.dispose();
}

/* ===== Spawner แบบง่าย (ใช้ได้ทุกโหมดให้มีอีเวนต์เข้า Score/Quests) ===== */
function ensureSpawnerFor(mode){
  const host = document.getElementById('spawnHost');
  if (!host) return;
  host.innerHTML = '';

  const POOL_GOOD = ['🥦','🍎','🍇','🍌','🥗','🐟'];
  const POOL_BAD  = ['🍔','🍟','🍩','🧋','🥤','🍕'];

  let spawnCd = 0;

  // ต่อท่อคลิก
  host.addEventListener('click',(e)=>{
    const btn = e.target.closest?.('.spawn-emoji'); if(!btn) return;
    const kind = btn.dataset.kind || 'good';
    const meta = { good: kind==='good', isTarget:(mode!=='goodjunk' && kind==='good') , golden: btn.dataset.golden==='1' };
    if (kind==='good'){
      App.score.addKind(meta.golden?'perfect':'good', meta);
    }else{
      App.score.addKind('bad', meta);
      App.hud.flashDanger();
    }
    try{ btn.remove(); }catch{}
  });

  // ลูปเล็ก ๆ สร้างไอคอน
  function frame(){
    if (!App.running) return;
    spawnCd -= 0.016;
    if (spawnCd<=0){
      spawnOne(host, (mode==='goodjunk')?0.66:0.78);
      spawnCd = 0.34 + Math.random()*0.28;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function spawnOne(host, goodBias=0.7){
    const b = document.createElement('button');
    b.type='button';
    b.className='spawn-emoji';
    const rect = document.getElementById('gameLayer')?.getBoundingClientRect?.() || { width: 800, height: 400 };
    const pad = 30;
    const x = Math.round(pad + Math.random()*(Math.max(1, rect.width)  - pad*2));
    const y = Math.round(pad + Math.random()*(Math.max(1, rect.height) - pad*2));
    b.style.left = x+'px'; b.style.top = y+'px';

    const isGood = Math.random() < goodBias;
    b.dataset.kind = isGood ? 'good' : 'bad';
    const golden = isGood && Math.random()<0.1;
    if (golden){ b.dataset.golden='1'; b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))'; }
    b.textContent = isGood ? POOL_GOOD[(Math.random()*POOL_GOOD.length)|0]
                           : POOL_BAD [(Math.random()*POOL_BAD.length )|0];
    host.appendChild(b);
    // อายุสั้น → miss สำหรับของดี
    const life = 2200;
    setTimeout(()=>{ if (!document.body.contains(b)){ return; }
      if (isGood){ /* นับเป็นพลาดเล็ก ๆ (ไม่ลดคะแนนใน demo) */ }
      try{ b.remove(); }catch{}
    }, life);
  }
}

/* ===== Modals ===== */
function showModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='flex'; }
function hideModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='none'; }
function goHome(){ document.getElementById('menuBar')?.scrollIntoView({behavior:'smooth'}); }

/* debug expose */
try{ window.__HHA_APP__=App; }catch{}
