// === /herohealth/vr-groups/director.js ===
// GroupsVR AI Difficulty Director — SAFE (play only)
// ✅ Adjusts spawn/life/size/wrong/junk multipliers (bounded)
// ✅ Uses Predictor output (ai:pred) + live performance
// ✅ research/practice: OFF hard
// Emits: ai:dd {spawnMul, lifeMul, sizeMul, wrongMul, junkMul}

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  const STATE = {
    enabled: false,
    runMode: 'play',
    lastPred: null,
    lastScore: { score:0, combo:0, misses:0 },
    lastRank:  { accuracy:0, grade:'C' },
    lastQuest: { miniOn:false, miniLeft:0 },
    pressure: 0,
    stormOn: false,
    bossActive: false,
    timer: null
  };

  function stop(){
    STATE.enabled = false;
    if(STATE.timer){ clearInterval(STATE.timer); STATE.timer=null; }
    // reset tuning to neutral
    try{
      const E = NS.GameEngine;
      E && E.setDifficultyTuning && E.setDifficultyTuning({
        spawnMul:1, lifeMul:1, sizeMul:1, wrongMul:1, junkMul:1
      });
    }catch(_){}
  }

  function attach(cfg){
    cfg = cfg || {};
    const rm = String(cfg.runMode||'play').toLowerCase();
    STATE.runMode = rm;
    STATE.enabled = !!cfg.enabled && (rm==='play');

    // hard safety
    if(rm==='research' || rm==='practice') STATE.enabled = false;

    if(!STATE.enabled){ stop(); return; }

    if(STATE.timer){ clearInterval(STATE.timer); STATE.timer=null; }
    STATE.timer = setInterval(tick, 1000);
  }

  function tick(){
    if(!STATE.enabled || STATE.runMode!=='play') return;

    const pred = STATE.lastPred || { mistakeRisk:0.5, junkRisk:0.5, miniSuccessProb:0.5 };

    const combo  = Number(STATE.lastScore.combo||0);
    const misses = Number(STATE.lastScore.misses||0);
    const acc    = Number(STATE.lastRank.accuracy||0);

    const pressure = Number(STATE.pressure||0);
    const stormOn  = !!STATE.stormOn;
    const bossOn   = !!STATE.bossActive;

    const miniOn   = !!STATE.lastQuest.miniOn;
    const miniLeft = Number(STATE.lastQuest.miniLeft||0);

    // --- Core idea ---
    // • ถ้าเสี่ยงพลาดสูง -> ผ่อน (ช้าลง + ใหญ่ขึ้น + ลด junk/wrong)
    // • ถ้าเล่นนิ่ง/คอมโบสูง/เสี่ยงต่ำ -> บีบ (เร็วขึ้น + เล็กลงนิด + เพิ่ม junk/wrong)
    // • มี storm/boss/mini -> ห้ามบีบเกิน (กัน “โหดซ้อนโหด”)

    const risk = clamp(pred.mistakeRisk, 0, 1);
    const jr   = clamp(pred.junkRisk, 0, 1);

    // base multipliers
    let spawnMul = 1.0;
    let lifeMul  = 1.0;
    let sizeMul  = 1.0;
    let wrongMul = 1.0;
    let junkMul  = 1.0;

    // soften when high risk / pressure
    if(risk >= 0.78 || pressure>=3){
      spawnMul = 1.14;      // ช้าลง
      lifeMul  = 1.10;      // อยู่ได้นานขึ้น
      sizeMul  = 1.08;      // ใหญ่ขึ้น
      wrongMul = 0.88;      // ลดหลอก
      junkMul  = 0.86;
    } else if(risk >= 0.64 || pressure===2){
      spawnMul = 1.08;
      lifeMul  = 1.06;
      sizeMul  = 1.05;
      wrongMul = 0.92;
      junkMul  = 0.92;
    } else if(risk <= 0.35 && combo >= 8 && acc >= 78){
      // tighten when low risk + good streak
      spawnMul = 0.93;      // ถี่ขึ้น
      lifeMul  = 0.95;
      sizeMul  = 0.98;
      wrongMul = 1.08;
      junkMul  = 1.10;
    } else if(risk <= 0.42 && combo >= 5){
      spawnMul = 0.96;
      lifeMul  = 0.98;
      sizeMul  = 1.00;
      wrongMul = 1.04;
      junkMul  = 1.05;
    }

    // additional tuning by junkRisk
    if(jr >= 0.72){
      junkMul *= 0.92; // ถ้าโดน junk ง่าย ลดลงอีกนิด
    } else if(jr <= 0.38 && combo >= 6){
      junkMul *= 1.06;
    }

    // avoid stacking hard during storm/boss/mini
    const hardStack = (stormOn || bossOn || (miniOn && miniLeft<=6));
    if(hardStack){
      spawnMul = Math.max(spawnMul, 0.98); // ห้ามเร่งมาก
      wrongMul = Math.min(wrongMul, 1.06);
      junkMul  = Math.min(junkMul, 1.08);
      lifeMul  = Math.max(lifeMul, 0.98);
    }

    // if misses already high, never tighten
    if(misses >= 10){
      spawnMul = Math.max(spawnMul, 1.06);
      sizeMul  = Math.max(sizeMul, 1.04);
      wrongMul = Math.min(wrongMul, 0.94);
      junkMul  = Math.min(junkMul, 0.94);
    }

    // bounds
    spawnMul = clamp(spawnMul, 0.88, 1.20);
    lifeMul  = clamp(lifeMul,  0.86, 1.22);
    sizeMul  = clamp(sizeMul,  0.92, 1.12);
    wrongMul = clamp(wrongMul, 0.78, 1.20);
    junkMul  = clamp(junkMul,  0.72, 1.25);

    // apply to engine
    try{
      const E = NS.GameEngine;
      E && E.setDifficultyTuning && E.setDifficultyTuning({ spawnMul, lifeMul, sizeMul, wrongMul, junkMul });
    }catch(_){}

    emit('ai:dd', { spawnMul, lifeMul, sizeMul, wrongMul, junkMul });
  }

  // listeners
  root.addEventListener('ai:pred', (ev)=>{
    STATE.lastPred = ev.detail || null;
  }, {passive:true});

  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    STATE.lastScore = { score:d.score||0, combo:d.combo||0, misses:d.misses||0 };
  }, {passive:true});

  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    STATE.lastRank = { accuracy:d.accuracy||0, grade:d.grade||'C' };
  }, {passive:true});

  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const miniOn = (d.miniTimeLeftSec && Number(d.miniTimeLeftSec)>0);
    STATE.lastQuest = { miniOn, miniLeft: Number(d.miniTimeLeftSec||0) };
  }, {passive:true});

  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if(k==='pressure') STATE.pressure = Number(d.level||0)|0;
    if(k==='storm_on') STATE.stormOn = true;
    if(k==='storm_off') STATE.stormOn = false;
    if(k==='boss_spawn') STATE.bossActive = true;
    if(k==='boss_down')  STATE.bossActive = false;
  }, {passive:true});

  root.addEventListener('hha:end', ()=> stop(), {passive:true});

  NS.AIDirector = { attach, stop };
})(window);