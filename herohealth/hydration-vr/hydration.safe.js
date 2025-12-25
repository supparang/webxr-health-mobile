// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION SAFE (Boss RAID Ultimate)
// - Works with: ../vr/mode-factory.js + hydration.quest.js + hydration.coach.js + hydration.audio.js
// - Events: hha:score / hha:time / hha:coach / quest:update / hha:celebrate / hha:end
// - Boss RAID:
//   * HP bar + real/decoy boss
//   * Combo Gate (ต้อง combo >= 3 ถึง "ทำดาเมจ" บอสจริง)
//   * Aim Gate (ต้องยิงใกล้กลาง)
//   * Phase3 Laser (ออก GREEN เกิน grace → ยิงทุกวิ)
//   * Wipe (ถ้า HP ไม่แตกตอนจบ → โดนปรับหนัก)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { createHydrationQuest } from './hydration.quest.js';
import { createHydrationCoach } from './hydration.coach.js';
import { createHydrationAudio } from './hydration.audio.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function $(id){ return DOC ? DOC.getElementById(id) : null; }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
function pct01(x){ return Math.round(clamp(x,0,1)*100); }

function parseQS(){
  const qs = new URLSearchParams(ROOT.location.search || '');
  const diff = String(qs.get('diff') || 'normal').toLowerCase();
  const run  = String(qs.get('run')  || 'play').toLowerCase();
  const seed = String(qs.get('seed') || '').trim();
  const time = clamp(qs.get('time') || 90, 20, 180);
  const debug = (qs.get('debug') === '1' || qs.get('debug') === 'true');
  return {
    diff: (diff==='easy'||diff==='hard'||diff==='normal') ? diff : 'normal',
    run:  (run==='research') ? 'research' : 'play',
    seed, time, debug
  };
}

function fatal(msg, err){
  console.error('[HydrationVR] FATAL:', msg, err||'');
  if(!DOC) return;
  let box = DOC.getElementById('hhaFatal');
  if(!box){
    box = DOC.createElement('div');
    box.id='hhaFatal';
    Object.assign(box.style,{
      position:'fixed', inset:'0', zIndex:'9999',
      background:'rgba(2,6,23,.92)', color:'#e5e7eb',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'18px', fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
    });
    box.innerHTML = `
      <div style="max-width:760px;border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:16px;background:rgba(15,23,42,.55)">
        <div style="font-weight:900;font-size:18px;margin-bottom:8px">เข้าเกมไม่ได้</div>
        <div id="hhaFatalMsg" style="white-space:pre-wrap;line-height:1.35;color:rgba(229,231,235,.92)"></div>
        <div style="margin-top:10px;color:rgba(148,163,184,.95);font-size:12px">
          Tip: ตรวจ path ของไฟล์ / ล้าง cache (Hard reload) / เช็ก Console
        </div>
      </div>`;
    DOC.body.appendChild(box);
  }
  const m = DOC.getElementById('hhaFatalMsg');
  if(m) m.textContent = String(msg||'Unknown error');
}

function ensureRaidStyle(){
  if(!DOC || DOC.getElementById('hhaRaidStyle')) return;
  const s = DOC.createElement('style');
  s.id='hhaRaidStyle';
  s.textContent = `
    #hha-vignette,#hha-warnline,#hha-laserflash{
      position:fixed; inset:0; pointer-events:none; z-index:9;
      opacity:0; transition:opacity .18s ease;
    }
    #hha-vignette{
      background:
        radial-gradient(1200px 680px at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,.82) 100%),
        radial-gradient(980px 560px at 50% 52%, rgba(239,68,68,0) 45%, rgba(239,68,68,.20) 95%);
      mix-blend-mode: screen;
    }
    #hha-warnline{
      background: linear-gradient(180deg,
        rgba(239,68,68,0),
        rgba(239,68,68,0) 32%,
        rgba(239,68,68,.18) 62%,
        rgba(239,68,68,0)
      );
    }
    #hha-laserflash{
      background:
        radial-gradient(1000px 640px at 50% 50%, rgba(255,255,255,.06), rgba(255,255,255,0) 62%),
        linear-gradient(90deg, rgba(239,68,68,0), rgba(239,68,68,.24), rgba(239,68,68,0));
      mix-blend-mode: screen;
    }
    body.hha-boss #hha-vignette{ opacity:.42; }
    body.hha-boss-danger #hha-warnline{ opacity:.78; animation:hhaWarnPulse .42s ease-in-out infinite; }
    body.hha-boss-peak #hha-vignette{ opacity:.55; }
    body.hha-boss-peak #hha-warnline{ opacity:.88; animation:hhaWarnPulse .28s ease-in-out infinite; }
    body.hha-laser #hha-laserflash{ opacity:.92; animation:hhaLaser .12s ease-in-out 1; }
    @keyframes hhaWarnPulse{ 0%{ filter:blur(0px);} 50%{ filter:blur(1px);} 100%{ filter:blur(0px);} }
    @keyframes hhaLaser{ 0%{opacity:0;} 35%{opacity:.95;} 100%{opacity:0;} }

    body.hha-boss-shake{ animation:hhaBossShake .18s ease-in-out 1; }
    @keyframes hhaBossShake{
      0%{ transform:translate3d(0,0,0); }
      25%{ transform:translate3d(-2px,1px,0); }
      55%{ transform:translate3d(2px,-1px,0); }
      100%{ transform:translate3d(0,0,0); }
    }

    /* Boss HP HUD */
    #hha-boss-hud{
      position:fixed; top:10px; left:50%;
      transform:translateX(-50%);
      z-index:8;
      width:min(520px, calc(100vw - 22px));
      pointer-events:none;
      opacity:0; transition:opacity .18s ease;
      border-radius:18px;
      background:rgba(2,6,23,.62);
      border:1px solid rgba(148,163,184,.22);
      box-shadow:0 16px 40px rgba(2,6,23,.65);
      overflow:hidden;
    }
    #hha-boss-hud.on{ opacity:1; }
    #hha-boss-top{
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 12px 8px 12px;
      color:rgba(229,231,235,.95);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      font-weight:900; letter-spacing:.2px;
    }
    #hha-boss-top .tag{
      display:flex; align-items:center; gap:8px;
      font-size:13px;
    }
    #hha-boss-top .tag .icon{ font-size:18px; }
    #hha-boss-top .meta{
      font-size:12px; color:rgba(148,163,184,.95); font-weight:800;
    }
    #hha-boss-bar{
      height:14px; margin:0 12px 12px 12px;
      background:rgba(148,163,184,.14);
      border-radius:999px;
      overflow:hidden;
      border:1px solid rgba(148,163,184,.16);
    }
    #hha-boss-fill{
      height:100%;
      width:100%;
      background:linear-gradient(90deg, rgba(239,68,68,.95), rgba(244,63,94,.82));
      border-radius:999px;
      box-shadow:0 0 18px rgba(239,68,68,.35);
      transition:width .10s linear;
    }
  `;
  DOC.head.appendChild(s);

  const mk = (id)=>{
    if(DOC.getElementById(id)) return;
    const d = DOC.createElement('div');
    d.id=id;
    DOC.body.appendChild(d);
  };
  mk('hha-vignette');
  mk('hha-warnline');
  mk('hha-laserflash');
}

function ensureBossHud(){
  if(!DOC) return null;
  let hud = DOC.getElementById('hha-boss-hud');
  if(hud && hud.isConnected) return hud;

  hud = DOC.createElement('div');
  hud.id = 'hha-boss-hud';
  hud.setAttribute('data-hha-exclude','1'); // กัน spawn ทับ HUD
  hud.innerHTML = `
    <div id="hha-boss-top">
      <div class="tag"><span class="icon">🌀</span><span id="hha-boss-title">BOSS RAID</span></div>
      <div class="meta"><span id="hha-boss-hp">HP 0/0</span> • <span id="hha-boss-phase">P0</span></div>
    </div>
    <div id="hha-boss-bar"><div id="hha-boss-fill"></div></div>
  `;
  DOC.body.appendChild(hud);
  return hud;
}

function setBossHud(on, hp, hpMax, phase){
  if(!DOC) return;
  const hud = ensureBossHud();
  if(!hud) return;
  hud.classList.toggle('on', !!on);
  const hpEl = DOC.getElementById('hha-boss-hp');
  const phEl = DOC.getElementById('hha-boss-phase');
  const fill = DOC.getElementById('hha-boss-fill');
  if(hpEl) hpEl.textContent = `HP ${Math.max(0,hp|0)}/${Math.max(1,hpMax|0)}`;
  if(phEl) phEl.textContent = `P${phase|0}`;
  if(fill){
    const p = (hpMax>0) ? clamp(hp/hpMax,0,1) : 0;
    fill.style.width = `${Math.round(p*100)}%`;
    if (p <= 0.18) fill.style.boxShadow = '0 0 24px rgba(244,63,94,.55)';
  }
}

function attachDragLook(){
  const bounds = $('hvr-bounds');
  const world  = $('hvr-world');
  if(!bounds || !world) return { reset(){}, setEnabled(){} };

  let ox=0, oy=0, down=false, sx=0, sy=0, bx=0, by=0;
  let enabled=true;
  const maxX = () => Math.max(18, (bounds.clientWidth||1) * 0.10);
  const maxY = () => Math.max(18, (bounds.clientHeight||1) * 0.12);

  function apply(){
    const mx=maxX(), my=maxY();
    ox = clamp(ox, -mx, mx);
    oy = clamp(oy, -my, my);
    world.style.transform = `translate3d(${Math.round(ox)}px, ${Math.round(oy)}px, 0)`;
  }
  function reset(){ ox=0; oy=0; apply(); }
  function setEnabled(v){ enabled=!!v; }

  bounds.addEventListener('pointerdown', (e)=>{
    if(!enabled) return;
    const t=e.target;
    if(t && (t.id==='btnStop'||t.id==='btnVR')) return;
    down=true; sx=e.clientX; sy=e.clientY; bx=ox; by=oy;
  }, {passive:true});

  bounds.addEventListener('pointermove', (e)=>{
    if(!enabled || !down) return;
    ox = bx + (e.clientX - sx)*0.55;
    oy = by + (e.clientY - sy)*0.55;
    apply();
  }, {passive:true});

  bounds.addEventListener('pointerup', ()=>{ down=false; }, {passive:true});
  bounds.addEventListener('pointercancel', ()=>{ down=false; }, {passive:true});

  ROOT.addEventListener('hha:resetView', reset);
  return { reset, setEnabled };
}

// Emoji pools
const EMOJI = {
  good: ['💧','🚰','🥛','🧊','🍉','🍊','🍇','🍏','🥥'],
  bad:  ['🥤','🧃','🧋','🍺','🍹','🥛‍🍫','🍶'],
  trick:['💧','🚰'],
  power:['🛡️','⭐','⚡']
};

const BOSS_EMOJI = ['🌀']; // ใช้เหมือนกันทั้งบอสจริง/บอสหลอก (เพื่อหลอกจริง ๆ)

export function bootHydration(){
  try{
    if(!DOC) return;

    ensureRaidStyle();

    const { diff, run, seed, time, debug } = parseQS();
    const isResearch = (run === 'research');

    // ถ้ายังไม่ใส่ run=... ให้รอ overlay เริ่มเกมใน HTML
    const hasRunParams = (new URLSearchParams(location.search)).has('run');
    const startOverlay = $('hvr-start');
    if (startOverlay) startOverlay.style.display = hasRunParams ? 'none' : 'flex';
    if (!hasRunParams) return;

    const Particles =
      (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
      ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

    const audio = createHydrationAudio ? createHydrationAudio({ volume: isResearch ? 0.12 : 0.22 }) : {
      unlock: async()=>{}, tick:()=>{}, good:()=>{}, miss:()=>{}, power:()=>{}, celebrate:()=>{}
    };

    // unlock audio on first touch
    const unlockOnce = async ()=>{
      try{ await audio.unlock?.(); }catch{}
      DOC.removeEventListener('pointerdown', unlockOnce);
    };
    DOC.addEventListener('pointerdown', unlockOnce, { passive:true });

    const quest = createHydrationQuest ? createHydrationQuest({ diff, run }) : { start(){}, tick(){}, onHit(){}, getState(){return{};} };
    const coach = createHydrationCoach ? createHydrationCoach({ run }) : { say(){}, onTick(){}, onHit(){}, onQuest(){} };

    let stopped=false, ended=false;

    // ---- core state ----
    const state = {
      run, diff, seed, time,
      score:0,
      combo:0,
      comboMax:0,
      miss:0,
      shield:0,
      fever:0,    // 0..1
      water:0.50, // 0..1
      zone:'GREEN'
    };

    function setZone(){
      const w=state.water;
      state.zone = (w>=0.40 && w<=0.62) ? 'GREEN' : (w<0.40 ? 'LOW' : 'HIGH');
    }
    function bumpFever(d){ state.fever = clamp(state.fever + d, 0, 1); }
    function bumpWater(d){ state.water = clamp(state.water + d, 0, 1); setZone(); }

    function gradeFromScore(score, miss){
      const s = Number(score)||0;
      const m = Number(miss)||0;
      const eff = s - m*8;
      if (eff >= 560) return 'SSS';
      if (eff >= 450) return 'SS';
      if (eff >= 360) return 'S';
      if (eff >= 270) return 'A';
      if (eff >= 190) return 'B';
      return 'C';
    }
    function progressToS(score){
      const s = clamp(Number(score)||0, 0, 360);
      return (s / 360) * 100;
    }

    function emitScore(){
      emit('hha:score', {
        score: state.score|0,
        comboMax: state.comboMax|0,
        miss: state.miss|0,
        grade: gradeFromScore(state.score, state.miss),
        waterZone: state.zone,
        waterPct: pct01(state.water),
        feverPct: pct01(state.fever),
        shield: state.shield|0,
        progressPct: progressToS(state.score)
      });
    }

    function pulseBossShake(){
      DOC.body.classList.remove('hha-boss-shake');
      void DOC.body.offsetWidth;
      DOC.body.classList.add('hha-boss-shake');
    }
    function laserFlash(){
      DOC.body.classList.remove('hha-laser');
      void DOC.body.offsetWidth;
      DOC.body.classList.add('hha-laser');
      setTimeout(()=>{ try{ DOC.body.classList.remove('hha-laser'); }catch{} }, 160);
    }

    // ============================
    // BOSS RAID CONFIG
    // ============================
    const RAID = {
      // ช่วงเวลาบอส (ท้ายเกม)
      raidSec: (diff==='easy'? 18 : diff==='hard'? 22 : 20),
      // phase split
      p1_end:  Math.round((diff==='easy'? 12 : diff==='hard'? 14 : 13)), // warning
      p2_end:  Math.round((diff==='easy'? 7  : diff==='hard'? 8  : 7)),  // boss spawn
      // HP
      hpMax:   (diff==='easy'? 10 : diff==='hard'? 16 : 13),
      // combo gate
      comboGateMin: 3,
      // aim gate (hitDistNorm)
      aimGate: (diff==='easy'? 0.52 : diff==='hard'? 0.42 : 0.47),
      graze:   (diff==='easy'? 0.78 : diff==='hard'? 0.70 : 0.74),

      // spawn convert chance
      bossChanceP2: (isResearch ? 0.18 : (diff==='easy'? 0.30 : diff==='hard'? 0.44 : 0.36)),
      bossChanceP3: (isResearch ? 0.22 : (diff==='easy'? 0.40 : diff==='hard'? 0.58 : 0.48)),

      // decoy chance (play only)
      decoyChance: (isResearch ? 0.00 : (diff==='easy'? 0.22 : diff==='hard'? 0.36 : 0.30)),

      // damage
      dmgBase: (diff==='easy'? 1 : diff==='hard'? 1 : 1),
      dmgPerfectBonus: (diff==='easy'? 1 : diff==='hard'? 2 : 1),
      dmgGreenBonus: 1, // ถ้าอยู่ GREEN ตอนยิงบอสจริง

      // scoring
      bossHitScore: (diff==='easy'? 24 : diff==='hard'? 32 : 29),
      bossPerfectScoreBonus: (diff==='easy'? 14 : diff==='hard'? 18 : 16),
      bossGrazePenalty: (diff==='easy'? 12 : diff==='hard'? 16 : 14),
      bossExpirePenalty:(diff==='easy'? 12 : diff==='hard'? 18 : 15),

      // combo gate fail
      gateFailPenalty:(diff==='easy'? 7 : diff==='hard'? 10 : 8),
      gateFailFever:  (diff==='easy'? 0.06 : diff==='hard'? 0.08 : 0.07),

      // decoy hit penalty
      decoyPenalty:(diff==='easy'? 16 : diff==='hard'? 22 : 19),
      decoyFever:  (diff==='easy'? 0.10 : diff==='hard'? 0.14 : 0.12),

      // drain & laser
      graceOutSec:(diff==='easy'? 3 : diff==='hard'? 2 : 3),
      drainPerSec:(diff==='easy'? 6 : diff==='hard'? 9 : 7),
      feverPerSec:(diff==='easy'? 0.032 : diff==='hard'? 0.045 : 0.038),

      laserPenalty:(diff==='easy'? 14 : diff==='hard'? 22 : 18),
      laserFever:  (diff==='easy'? 0.045 : diff==='hard'? 0.06 : 0.052),
      laserWaterPush:(diff==='easy'? 0.014 : diff==='hard'? 0.018 : 0.016),

      // Wipe
      wipePenalty:(diff==='easy'? 65 : diff==='hard'? 95 : 80),
      wipeFever:  (diff==='easy'? 0.18 : diff==='hard'? 0.26 : 0.22),

      // speed multipliers
      mulP1: 0.86,
      mulP2: 0.72,
      mulP3: 0.60
    };

    const boss = {
      on:false,
      entered:false,
      phase:0,     // 0 none, 1 warning, 2 boss, 3 final
      hp:RAID.hpMax,
      hpMax:RAID.hpMax,
      cleared:false,
      outStreak:0,

      hits:0,
      missed:0,
      grazed:0,
      gateFails:0,
      decoyHits:0,
      lasers:0
    };

    function enterBoss(){
      if(boss.entered) return;
      boss.entered=true;
      boss.on=true;
      boss.phase=1;
      boss.hp=boss.hpMax=RAID.hpMax;
      DOC.body.classList.add('hha-boss');
      setBossHud(true, boss.hp, boss.hpMax, boss.phase);
      coach.say?.(`🔥 BOSS RAID เริ่มแล้ว! สะสมคอมโบให้ถึง ${RAID.comboGateMin} เพื่อทำดาเมจบอส!`, 'happy', true);
      try{ audio.tick?.(true); }catch{}
      try{ Particles.celebrate?.('boss'); }catch{}
    }

    function setPhase(p){
      if(!boss.on) return;
      if(p === boss.phase) return;
      boss.phase = p;
      setBossHud(true, boss.hp, boss.hpMax, boss.phase);

      if(p===2){
        coach.say?.(`🌀 บอสโผล่! กติกา: คอมโบ ≥ ${RAID.comboGateMin} + เล็งกลาง! (มีตัวหลอก!)`, 'neutral', true);
      } else if(p===3){
        DOC.body.classList.add('hha-boss-peak');
        coach.say?.('⚡ FINAL RAID! ออก GREEN เกินกำหนด → เลเซอร์ยิงทุกวิ!', 'sad', true);
      }
      try{ audio.tick?.(true); }catch{}
    }

    function stopBossHud(){
      setBossHud(false, 0, 1, 0);
      DOC.body.classList.remove('hha-boss','hha-boss-danger','hha-boss-peak','hha-laser');
    }

    function applyBossDamage(dmg){
      dmg = Math.max(0, dmg|0);
      if(!dmg) return false;
      boss.hp = Math.max(0, boss.hp - dmg);
      setBossHud(true, boss.hp, boss.hpMax, boss.phase);
      if(boss.hp <= 0 && !boss.cleared){
        boss.cleared = true;
        coach.say?.('🎉 บอสแตกแล้ว! เก่งมาก!', 'happy', true);
        emit('hha:celebrate', { kind:'goal', id:'boss_raid' });
        try{ Particles.celebrate?.('goal'); }catch{}
        try{ audio.celebrate?.(); }catch{}
      }
      return true;
    }

    function endGame(){
      if(ended) return;
      ended=true;

      try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
      stopBossHud();

      const wipe = (boss.entered && !boss.cleared);
      if(wipe){
        state.score -= RAID.wipePenalty;
        bumpFever(+RAID.wipeFever);
        coach.say?.(`💥 WIPE! บอสไม่แตก → -${RAID.wipePenalty}`, 'sad', true);
      }

      const grade = gradeFromScore(state.score, state.miss);
      emit('hha:end', {
        title:'จบเกม Hydration 💧',
        score: state.score|0,
        miss: state.miss|0,
        comboMax: state.comboMax|0,
        grade,
        progressPct: progressToS(state.score),
        boss: {
          entered: boss.entered,
          cleared: boss.cleared,
          hp: boss.hp,
          hpMax: boss.hpMax,
          phase: boss.phase,
          wipe,
          hits: boss.hits,
          missed: boss.missed,
          grazed: boss.grazed,
          gateFails: boss.gateFails,
          decoyHits: boss.decoyHits,
          lasers: boss.lasers
        }
      });

      emitScore();
    }

    // -------------------------------
    // Spawn speed control
    // -------------------------------
    function spawnIntervalMul(){
      if(isResearch) return 1;

      const feverMul = clamp(1 - state.fever*0.45, 0.55, 1.0);

      let bossMul = 1.0;
      if (boss.on){
        bossMul = (boss.phase===1) ? RAID.mulP1 : (boss.phase===2 ? RAID.mulP2 : RAID.mulP3);
      }
      return clamp(feverMul * bossMul, 0.45, 1.0);
    }

    // -------------------------------
    // decorateTarget: convert some targets to boss/decoy
    // -------------------------------
    function decorateTarget(el, parts, data){
      try{
        if(!boss.on) return;
        if(boss.phase < 2) return;
        if(boss.cleared) return;

        const chance = (boss.phase===2) ? RAID.bossChanceP2 : RAID.bossChanceP3;
        if(Math.random() > chance) return;

        const isDecoy = (!isResearch && Math.random() < RAID.decoyChance);
        data.ch = BOSS_EMOJI[0];
        data.isGood = true;
        data.isPower = false;
        data.itemType = isDecoy ? 'bossDecoy' : 'boss';

        try{ el.setAttribute('data-item-type', data.itemType); }catch{}

        // Skin: real vs decoy (คนเล่นจะสังเกตยากนิด ๆ)
        const baseGrad = isDecoy
          ? 'radial-gradient(circle at 30% 25%, #a855f7, #3b0764)'
          : 'radial-gradient(circle at 30% 25%, #ef4444, #7f1d1d)';
        el.style.background = baseGrad;

        const glow = isDecoy
          ? '0 0 0 2px rgba(167,139,250,0.75), 0 0 24px rgba(167,139,250,0.55)'
          : '0 0 0 2px rgba(239,68,68,0.75), 0 0 26px rgba(239,68,68,0.85)';
        el.style.boxShadow = '0 14px 30px rgba(15,23,42,0.9),' + glow;

        if(parts?.icon){
          parts.icon.textContent = data.ch;
          parts.icon.style.filter = 'drop-shadow(0 4px 6px rgba(15,23,42,0.95))';
        }

        // Badge: decoy แอบมี "?" เล็ก ๆ (ยังหลอกได้)
        if (parts?.badge){
          parts.badge.textContent = isDecoy ? '❓' : '⚔️';
          parts.badge.style.opacity = isDecoy ? '0.78' : '0.82';
        }

      }catch{}
    }

    // -------------------------------
    // Judge (scoring/logic)
    // -------------------------------
    function judge(ch, ctx){
      const type = String(ctx.itemType||'good');
      const hitX = Number(ctx.clientX ?? 0);
      const hitY = Number(ctx.clientY ?? 0);
      const perfect = !!ctx.hitPerfect;
      const norm = Number(ctx.hitDistNorm ?? 1);

      // ===== Boss Decoy =====
      if(type === 'bossDecoy'){
        boss.decoyHits++;
        state.score -= RAID.decoyPenalty;
        state.combo = 0;
        bumpFever(+RAID.decoyFever);
        DOC.body.classList.add('hha-boss-danger');
        pulseBossShake();

        try{ Particles.burstAt?.(hitX, hitY, 'DECOY'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, `DECOY -${RAID.decoyPenalty}`, 0); }catch{}
        try{ audio.miss?.(); }catch{}
        coach.say?.('โดนตัวหลอก! 😈 เล็งให้เป๊ะ + รักษา GREEN!', 'sad', true);

        quest.onHit?.({ isGood:false, isPower:false, itemType:'bossDecoy', perfect:false });
        emitScore();
        return { scoreDelta: -RAID.decoyPenalty, good:false, decoy:true };
      }

      // ===== Boss Real =====
      if(type === 'boss'){
        // Combo Gate
        if((state.combo|0) < RAID.comboGateMin){
          boss.gateFails++;
          state.score -= RAID.gateFailPenalty;
          state.combo = 0;
          bumpFever(+RAID.gateFailFever);
          DOC.body.classList.add('hha-boss-danger');
          pulseBossShake();

          try{ Particles.burstAt?.(hitX, hitY, 'GATE'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `GATE -${RAID.gateFailPenalty}`, 0); }catch{}
          try{ audio.miss?.(); }catch{}
          coach.say?.(`คอมโบยังไม่ถึง ${RAID.comboGateMin}! เก็บน้ำดีก่อนแล้วค่อยยิงบอส`, 'sad', true);

          quest.onHit?.({ isGood:false, isPower:false, itemType:'boss', gateFail:true });
          emitScore();
          return { scoreDelta: -RAID.gateFailPenalty, good:false, gateFail:true };
        }

        // Aim Gate
        if(norm <= RAID.aimGate){
          boss.hits++;

          const inGreen = (state.zone === 'GREEN');
          const dmg = RAID.dmgBase + (perfect ? RAID.dmgPerfectBonus : 0) + (inGreen ? RAID.dmgGreenBonus : 0);
          applyBossDamage(dmg);

          const add = RAID.bossHitScore + (perfect ? RAID.bossPerfectScoreBonus : 0) + (inGreen ? 6 : 0);
          state.score += add;

          // reward: stabilize water + reduce fever
          const pull = (0.52 - state.water) * (inGreen ? 0.34 : 0.26);
          bumpWater(pull + 0.03);
          bumpFever(perfect ? -0.10 : -0.07);

          // boss hit gives combo boost
          state.combo = clamp(state.combo + 2, 0, 9999);
          state.comboMax = Math.max(state.comboMax, state.combo);

          try{ Particles.burstAt?.(hitX, hitY, perfect ? 'BOSS_PERFECT' : 'BOSS'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `+${add}`, 1); }catch{}
          try{ audio.good?.(true); }catch{}
          coach.onHit?.({ boss:true, perfect });

          quest.onHit?.({ isGood:true, isPower:false, itemType:'boss', perfect:true });
          emitScore();
          return { scoreDelta: add, good:true, boss:true };
        }

        // Graze (ยิงโดนขอบ ๆ)
        if(norm >= RAID.graze){
          boss.grazed++;
          state.score -= RAID.bossGrazePenalty;
          state.miss += 1;
          state.combo = 0;

          bumpFever(+0.10);
          bumpWater(state.zone==='LOW' ? -0.02 : +0.02);

          DOC.body.classList.add('hha-boss-danger');
          pulseBossShake();

          try{ Particles.burstAt?.(hitX, hitY, 'GRAZE'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `-${RAID.bossGrazePenalty}`, 0); }catch{}
          try{ audio.miss?.(); }catch{}
          coach.say?.('โดนบอสไม่ชัวร์! เล็งกลางให้เป๊ะ!', 'sad', true);

          quest.onHit?.({ isGood:false, isPower:false, itemType:'boss', grazed:true });
          emitScore();
          return { scoreDelta: -RAID.bossGrazePenalty, good:false, boss:true, grazed:true };
        }

        // Soft tap: ให้แต้มน้อยถ้าอยู่ GREEN
        if(state.zone==='GREEN'){
          state.score += 6;
          bumpFever(-0.02);
          try{ Particles.scorePop?.(hitX, hitY, '+6', 1); }catch{}
          emitScore();
          return { scoreDelta: 6, good:true, boss:true, soft:true };
        }

        emitScore();
        return { scoreDelta: 0, good:false, boss:true, soft:true };
      }

      // ===== Power =====
      if(type === 'power'){
        if (ch === '🛡️') state.shield = clamp(state.shield + 1, 0, 5);
        else if (ch === '⚡'){
          state.fever = clamp(state.fever - 0.18, 0, 1);
          bumpWater((0.52 - state.water) * 0.45);
        } else {
          state.score += 25;
          bumpWater(+0.03);
        }

        state.combo = clamp(state.combo + 1, 0, 9999);
        state.comboMax = Math.max(state.comboMax, state.combo);

        try{ Particles.burstAt?.(hitX, hitY, 'POWER'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, '+25', 1); }catch{}
        try{ audio.power?.(); }catch{}
        coach.onHit?.({ power:true });

        quest.onHit?.({ isGood:true, isPower:true, itemType:'power', perfect });
        emitScore();
        return { scoreDelta: 25, good:true, power:true };
      }

      // ===== Bad / Trick =====
      const isTrap = (type === 'fakeGood');
      if(!ctx.isGood || isTrap){
        if(state.shield > 0){
          state.shield--;
          bumpFever(+0.02);
          state.combo = 0;

          try{ Particles.burstAt?.(hitX, hitY, 'BLOCK'); }catch{}
          try{ audio.tick?.(false); }catch{}
          coach.onHit?.({ blocked:true });

          quest.onHit?.({ isGood:false, isPower:false, itemType:type, blocked:true });
          emitScore();
          return { scoreDelta: 0, good:false, blocked:true };
        }

        const bossPenalty = boss.on ? (boss.phase===3 ? 6 : 4) : 0;
        const penalty = 12 + bossPenalty;

        state.score -= penalty;
        state.miss  += 1;
        state.combo = 0;

        bumpFever(boss.on ? +0.15 : +0.12);
        bumpWater(boss.on ? +0.10 : +0.08);

        DOC.body.classList.add('hha-boss-danger');
        pulseBossShake();

        try{ Particles.burstAt?.(hitX, hitY, 'BAD'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, `-${penalty}`, 0); }catch{}
        try{ audio.miss?.(); }catch{}
        coach.onHit?.({ bad:true });

        quest.onHit?.({ isGood:false, isPower:false, itemType:type, perfect, blocked:false });
        emitScore();
        return { scoreDelta: -penalty, good:false };
      }

      // ===== Good =====
      const bossBonus = boss.on ? (boss.phase===3 ? 4 : 2) : 0;
      const add = (10 + bossBonus) + (perfect ? (boss.on ? 7 : 5) : 0);
      state.score += add;

      state.combo = clamp(state.combo + 1, 0, 9999);
      state.comboMax = Math.max(state.comboMax, state.combo);

      bumpWater((0.52 - state.water) * (boss.on ? 0.28 : 0.22) + (boss.on ? 0.026 : 0.02));
      bumpFever(perfect ? (boss.on ? -0.04 : -0.03) : (boss.on ? -0.022 : -0.015));

      try{ Particles.burstAt?.(hitX, hitY, perfect ? 'PERFECT' : 'GOOD'); }catch{}
      try{ Particles.scorePop?.(hitX, hitY, `+${add}`, 1); }catch{}
      try{ audio.good?.(perfect); }catch{}
      coach.onHit?.({ good:true, perfect });

      quest.onHit?.({ isGood:true, isPower:false, itemType:'good', perfect });
      emitScore();
      return { scoreDelta: add, good:true, perfect };
    }

    function onExpire(info){
      const it = String(info?.itemType || '');
      const isGood = !!info?.isGood;

      if(it === 'boss'){
        boss.missed++;
        state.score -= RAID.bossExpirePenalty;
        state.miss += 1;
        state.combo = 0;
        bumpFever(+0.10);
        DOC.body.classList.add('hha-boss-danger');
        pulseBossShake();
        try{ audio.miss?.(); }catch{}
        try{ Particles.scorePop?.((ROOT.innerWidth||0)*0.5, (ROOT.innerHeight||0)*0.35, `-${RAID.bossExpirePenalty}`, 0); }catch{}
        coach.say?.('บอสหลุด! ยิงให้ทัน!', 'sad', true);
        emitScore();
        return;
      }
      if(it === 'bossDecoy'){
        // ปล่อย decoy หมดอายุไม่ลงโทษ (ลงโทษเฉพาะยิงผิด)
        return;
      }
      if(isGood){
        state.miss += 1;
        state.combo = 0;
        bumpFever(boss.on ? +0.06 : +0.05);
        bumpWater(boss.on ? -0.05 : -0.04);
        emitScore();
      }
    }

    // ---- View look ----
    const look = attachDragLook();

    // ---- factory cfg ----
    const allowAdaptive = !isResearch;
    const allowTrick    = !isResearch;
    const allowPower    = !isResearch;
    const allowStorm    = !isResearch;

    const factoryCfg = {
      modeKey:'hydration',
      difficulty: diff,
      duration: time,

      spawnHost:'#hvr-layer',
      boundsHost:'#hvr-bounds',

      spawnAroundCrosshair:false,
      spawnStrategy:'grid9',
      minSeparation:0.98,
      maxSpawnTries:18,

      pools:{ good:EMOJI.good, bad:EMOJI.bad, trick: allowTrick ? EMOJI.trick : [] },
      goodRate:(diff==='easy'? 0.68 : diff==='hard'? 0.60 : 0.64),

      powerups: allowPower ? EMOJI.power : [],
      powerRate: allowPower ? 0.12 : 0,
      powerEvery: allowPower ? 6 : 999,
      trickRate: allowTrick ? 0.10 : 0.0,

      allowAdaptive,
      seed: (isResearch && seed) ? seed : null,

      spawnIntervalMul: (allowStorm ? spawnIntervalMul : 1),

      decorateTarget,
      judge,
      onExpire
    };

    // ---- quest start ----
    quest.start?.();
    setZone();
    emitScore();

    // ---- time tick ----
    let lastTickSec = 999;
    function urgentFx(sec){
      const urgent = (sec <= 10 && sec > 0);
      DOC.body.classList.toggle('hha-urgent', urgent);
      if(urgent && sec !== lastTickSec){
        lastTickSec = sec;
        try{ audio.tick?.(true); }catch{}
        if(sec <= 5) pulseBossShake();
      }
      if(!urgent) lastTickSec = 999;
    }

    // Boss tick logic (drain + laser + phase)
    ROOT.addEventListener('hha:time', (ev)=>{
      const sec = Number(ev?.detail?.sec ?? 0);
      urgentFx(sec);

      // Start RAID when sec <= raidSec
      if(!boss.entered && sec <= RAID.raidSec && sec > 0) enterBoss();

      // Update phase
      if(boss.on && sec > 0){
        const left = sec; // remaining
        // phase defined by remaining seconds inside raid window
        // p1: raidSec..p1_end, p2: p1_end..p2_end, p3: p2_end..0
        if(left <= RAID.p2_end) setPhase(3);
        else if(left <= RAID.p1_end) setPhase(2);
        else setPhase(1);

        // Show boss HUD
        setBossHud(true, boss.hp, boss.hpMax, boss.phase);

        // Drain/Laser when out of GREEN
        const inGreen = (state.zone === 'GREEN');
        if(inGreen){
          boss.outStreak = 0;
          DOC.body.classList.remove('hha-boss-danger');
        }else{
          boss.outStreak++;

          if(boss.outStreak >= Math.max(1, RAID.graceOutSec - 1)){
            DOC.body.classList.add('hha-boss-danger');
          }

          if(boss.outStreak > RAID.graceOutSec){
            state.score -= RAID.drainPerSec;
            bumpFever(+RAID.feverPerSec);

            if(boss.phase === 3){
              // Laser every second in phase3 when outStreak>grace
              boss.lasers++;
              state.score -= RAID.laserPenalty;
              bumpFever(+RAID.laserFever);
              bumpWater(state.zone==='LOW' ? -RAID.laserWaterPush : +RAID.laserWaterPush);

              laserFlash();
              pulseBossShake();
              try{ audio.tick?.(true); }catch{}
              try{
                Particles.scorePop?.((ROOT.innerWidth||0)*0.5,(ROOT.innerHeight||0)*0.30,`LASER -${RAID.laserPenalty}`,0);
              }catch{}
              coach.say?.('⚡ LASER! กลับ GREEN เดี๋ยวนี้!', 'sad', true);
            }else{
              if(boss.outStreak % 2 === 0) pulseBossShake();
              try{ audio.tick?.(true); }catch{}
            }
            emitScore();
          }
        }
      }

      // quest + coach tick
      quest.tick?.(sec, { zone: state.zone, boss: boss.on, phase: boss.phase, bossHp: boss.hp, bossHpMax: boss.hpMax });
      coach.onTick?.({ sec, zone: state.zone, feverPct: pct01(state.fever), boss: boss.on, phase: boss.phase, hp: boss.hp });

      if(sec <= 0) endGame();
    });

    // Boot factory
    factoryBoot(factoryCfg).then((h)=>{
      // Tap to shoot crosshair
      DOC.addEventListener('pointerdown', (e)=>{
        if(stopped || ended) return;
        const t=e.target;
        if(t && (t.id==='btnStop'||t.id==='btnVR'||t.id==='endReplay'||t.id==='endClose')) return;
        try{ h?.shootCrosshair?.(); }catch{}
      }, { passive:true });

    }).catch((err)=>{
      fatal('Failed to boot hydration.safe.js\n' + String(err?.message||err), err);
    });

    // Extra: stop event ends game
    ROOT.addEventListener('hha:stop', ()=>{
      if(ended) return;
      endGame();
    });

    if(debug) console.log('[HydrationVR RAID] boot', { diff, run, time, seed, RAID });

  }catch(err){
    fatal('Hydration.safe.js crashed\n' + String(err?.message||err), err);
  }
}

export default { bootHydration };
