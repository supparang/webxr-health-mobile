/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (PRODUCTION / classic) — HARD+++
✅ FIX: ใช้ data-emoji + --x --y --s ให้ตรง CSS
✅ เปลี่ยนหลักเกมให้ “คิดจริง”:
   - good ของหมู่ปัจจุบัน = ✅ (fg-good)
   - good ของหมู่อื่น = ⚠️ กับดัก (fg-wrong) → COMBO แตก + MISS + ติด stun-lite
✅ เพิ่ม: drift (VR-feel) ด้วย RAF loop (เป้าไหลเบา ๆ)
✅ เพิ่ม: Quest 2 Goals + timed Mini (เหมือน Plate Rush) แบบโหด
✅ emits:
   - hha:score / hha:rank / hha:time
   - groups:group_change / groups:power
   - groups:quest_state (ให้ quests.js translate เป็น quest:update + coach)
   - hha:end summary + localStorage handled by html
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const FX = NS.FX || {
    panic(){},
    stunFlash(){},
    swapFlash(){},
    afterimage(){},
    tickHi(){},
    tickLow(){}
  };

  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function randInt(rng,a,b){ return a + Math.floor(rng()*(b-a+1)); }
  function pick(rng,arr){ return arr[Math.floor(rng()*arr.length)]; }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }

  function hashSeed(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }
  function mulberry32(a){
    return function(){
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readSafeInsets(){
    const cs = getComputedStyle(DOC.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
    return { sat, sab, sal, sar };
  }

  const GROUPS = [
    { id:1, label:'หมู่ 1 โปรตีน 💪', good:['🥚','🥛','🐟','🥜','🍗','🧀'] },
    { id:2, label:'หมู่ 2 คาร์บ 🌾',   good:['🍚','🍞','🥔','🍠','🥨','🍜'] },
    { id:3, label:'หมู่ 3 ผัก 🥦',     good:['🥦','🥬','🥕','🌽','🥒','🍅'] },
    { id:4, label:'หมู่ 4 ผลไม้ 🍎',   good:['🍎','🍌','🍊','🍇','🍉','🍓'] },
    { id:5, label:'หมู่ 5 ไขมัน 🫒',   good:['🫒','🥑','🧈','🥥','🥜','🧀'] }
  ];

  const JUNK_EMOJI  = ['🍟','🍔','🍕','🍩','🍭','🧁','🥤','🍿','🍫','🍪'];
  const DECOY_EMOJI = ['❓','🌀','🎭','🧩','🎲'];
  const BOSS_EMOJI  = ['👹','😈','🧟','🦂','🐲'];

  const DIFF = {
    easy: {
      timeDefault: 90,
      spawnEveryMs: [600, 900],
      lifeMs: [1400, 1900],
      size: [0.90, 1.08],
      junkRate: 0.16,
      decoyRate: 0.08,
      bossRate: 0.06,
      wrongGoodRate: 0.28, // โหดพอประมาณ
      bossHp: [3, 4],
      stunMs: 450,
      stunLiteMs: 260,
      powerThreshold: 7,
      score: { correct: 130, wrong: -120, junk: -110, decoy: -80, bossHit: 95, bossKill: 240 },
      missPenalty: 1,
      miniNeed: 6,
      miniTimeSec: 8,
      goal1Need: 18,
      goal2Need: 14, // streak
      drift: 14
    },
    normal: {
      timeDefault: 90,
      spawnEveryMs: [500, 820],
      lifeMs: [1100, 1650],
      size: [0.82, 1.04],
      junkRate: 0.22,
      decoyRate: 0.10,
      bossRate: 0.08,
      wrongGoodRate: 0.34,
      bossHp: [4, 6],
      stunMs: 650,
      stunLiteMs: 320,
      powerThreshold: 9,
      score: { correct: 140, wrong: -135, junk: -140, decoy: -90, bossHit: 105, bossKill: 300 },
      missPenalty: 1,
      miniNeed: 6,
      miniTimeSec: 8,
      goal1Need: 22,
      goal2Need: 16,
      drift: 18
    },
    hard: {
      timeDefault: 90,
      spawnEveryMs: [420, 720],
      lifeMs: [920, 1350],
      size: [0.76, 0.98],
      junkRate: 0.28,
      decoyRate: 0.12,
      bossRate: 0.10,
      wrongGoodRate: 0.40,
      bossHp: [6, 8],
      stunMs: 820,
      stunLiteMs: 380,
      powerThreshold: 11,
      score: { correct: 150, wrong: -155, junk: -170, decoy: -105, bossHit: 115, bossKill: 360 },
      missPenalty: 1,
      miniNeed: 7,
      miniTimeSec: 8,
      goal1Need: 26,
      goal2Need: 18,
      drift: 22
    }
  };

  function gradeFrom(acc, score){
    if (acc >= 92 && score >= 9000) return 'SSS';
    if (acc >= 88 && score >= 7400) return 'SS';
    if (acc >= 83) return 'S';
    if (acc >= 74) return 'A';
    if (acc >= 62) return 'B';
    return 'C';
  }

  const Engine = (function(){
    const state = {
      running:false,
      diff:'normal',
      runMode:'play',
      seed:'',
      rng: Math.random,

      layerEl:null,
      targets:new Map(),
      nextId:1,

      timeLeft:90,
      timeTotal:90,
      timerInt:null,
      spawnTo:null,

      rafId:0,
      lastRaf:0,

      score:0,
      combo:0,
      comboMax:0,
      misses:0,

      // accuracy
      correctHit:0,
      correctSpawn:0,
      correctExpire:0,
      wrongHit:0,
      wrongSpawn:0,
      junkHit:0,
      junkSpawn:0,
      decoyHit:0,
      bossKills:0,

      // group/power
      groupIndex:0,
      powerCharge:0,
      powerThreshold:9,

      // stun
      stunnedUntil:0,

      // panic
      panicOn:false,

      // input lock
      lastPointer:{x:0,y:0},
      lockedId:null,
      lockStartMs:0,
      lockNeedMs: 170,

      // quest
      goalsCleared:0,
      goalsTotal:2,
      goalIndex:0,
      goalNeed:0,
      goalProgress:0,
      bestStreak:0,

      miniActive:false,
      miniNeed:0,
      miniGot:0,
      miniTimeLeft:0,
      miniEndsAt:0,
      miniCleared:0,
      miniTotal:999,
      nextMiniAtSec: 12
    };

    function cfg(){ return DIFF[state.diff] || DIFF.normal; }
    function currentGroup(){ return GROUPS[state.groupIndex % GROUPS.length]; }

    function setLayerEl(el){
      state.layerEl = el;
      if (!el) return;
      el.addEventListener('pointerdown', onPointerDown, { passive:false });
      el.addEventListener('pointermove', onPointerMove, { passive:true });
    }

    function setTimeLeft(sec){
      sec = Math.max(1, (sec|0));
      state.timeLeft = sec;
      state.timeTotal = sec;
    }

    function resetStats(){
      state.targets.clear();
      state.nextId = 1;

      state.score=0; state.combo=0; state.comboMax=0; state.misses=0;

      state.correctHit=0; state.correctSpawn=0; state.correctExpire=0;
      state.wrongHit=0; state.wrongSpawn=0;
      state.junkHit=0; state.junkSpawn=0;
      state.decoyHit=0; state.bossKills=0;

      state.groupIndex=0;
      state.powerCharge=0;

      state.stunnedUntil=0;
      state.panicOn=false;

      state.lockedId=null;
      state.lockStartMs=0;

      // quest init
      state.goalsCleared=0;
      state.goalIndex=0;
      state.bestStreak=0;
      setGoalFromIndex();
      state.miniActive=false;
      state.miniCleared=0;
      state.nextMiniAtSec = 12;

      if (state.layerEl) state.layerEl.innerHTML = '';
    }

    function computePlayRect(){
      const w = root.innerWidth || DOC.documentElement.clientWidth || 360;
      const h = root.innerHeight || DOC.documentElement.clientHeight || 640;
      const insets = readSafeInsets();

      const hud = DOC.querySelector('.hud-top');
      const hudRect = hud ? hud.getBoundingClientRect() : { bottom: 0 };
      const hudBottom = Math.max(0, hudRect.bottom || 0);

      const pad = 12;
      const top = Math.min(h-140, Math.max(hudBottom + 10, 10 + insets.sat + 10));
      const left = 10 + insets.sal + pad;
      const right = w - (10 + insets.sar + pad);
      const bottom = h - (10 + insets.sab + pad);

      return { left, top, right, bottom, width: Math.max(10, right-left), height: Math.max(10, bottom-top), w, h };
    }

    function calcAccuracy(){
      // focus on correctness: correct hits vs (correct hit + wrong hit + correct expire)
      const denom = Math.max(1, state.correctHit + state.wrongHit + state.correctExpire);
      return Math.round((state.correctHit / denom) * 100);
    }

    function emitScore(){
      state.comboMax = Math.max(state.comboMax, state.combo);
      emit('hha:score', { score:state.score|0, combo:state.combo|0, misses:state.misses|0, comboMax:state.comboMax|0 });
      const acc = calcAccuracy();
      emit('hha:rank', { grade: gradeFrom(acc, state.score|0), accuracy: acc|0 });
    }

    function setGoalFromIndex(){
      const c = cfg();
      if (state.goalIndex === 0){
        state.goalNeed = c.goal1Need|0;
        state.goalProgress = 0;
      } else {
        state.goalNeed = c.goal2Need|0; // streak goal
        state.goalProgress = 0;
      }
      emitQuestState();
    }

    function startMini(){
      const c = cfg();
      state.miniActive = true;
      state.miniNeed = c.miniNeed|0;
      state.miniGot = 0;
      state.miniTimeLeft = c.miniTimeSec|0;
      state.miniEndsAt = nowMs() + (state.miniTimeLeft*1000);
      emitQuestState('mini_start');
      try{ FX.tickHi(); }catch(e){}
    }

    function stopMini(cleared){
      state.miniActive = false;
      state.miniTimeLeft = 0;
      state.miniEndsAt = 0;
      if (cleared){
        state.miniCleared += 1;
        emitQuestState('mini_clear');
        try{ FX.tickHi(); }catch(e){}
      } else {
        emitQuestState();
      }
    }

    function goalClear(){
      state.goalsCleared = Math.min(state.goalsTotal, state.goalsCleared + 1);
      emitQuestState('goal_clear');
      state.goalIndex = Math.min(state.goalsTotal-1, state.goalIndex + 1);
      setGoalFromIndex();
    }

    function emitQuestState(ping){
      const g = currentGroup();
      const goalTitle = (state.goalIndex === 0)
        ? `ยิง “${g.label}” ให้ถูก ${state.goalNeed} ครั้ง`
        : `STREAK: ยิงถูกติดกัน ${state.goalNeed} ครั้ง`;

      const goalNow = (state.goalIndex === 0) ? state.correctHit : state.bestStreak;
      const gp = clamp(Math.round((goalNow / Math.max(1,state.goalNeed))*100), 0, 100);

      let miniTitle = 'Mini: —';
      let miniProg = '0/0';
      let miniPct = 0;
      let miniTimerText = '';
      let miniUrgent = false;

      if (state.miniActive){
        miniTitle = `MINI RUSH: ยิงถูก ${state.miniNeed} ใน ${cfg().miniTimeSec}s (ห้ามพลาด)`;
        miniProg = `${state.miniGot}/${state.miniNeed}`;
        miniPct = clamp(Math.round((state.miniGot / Math.max(1,state.miniNeed))*100),0,100);
        const left = Math.max(0, Math.ceil((state.miniEndsAt - nowMs())/1000));
        miniTimerText = `เหลือ ${left}s`;
        miniUrgent = left <= 2;
      } else {
        // show next mini ETA
        const elapsed = (state.timeTotal - state.timeLeft);
        const eta = Math.max(0, state.nextMiniAtSec - elapsed);
        miniTitle = `Mini: Rush จะมาใน ~${eta}s`;
        miniProg = `${state.miniCleared}/∞`;
        miniPct = 0;
        miniTimerText = '';
      }

      emit('groups:quest_state', {
        ping: ping || '',
        title: 'GroupsVR',
        goalTitle,
        goalProgressText: `${Math.min(goalNow, state.goalNeed)}/${state.goalNeed}`,
        goalProgressPct: gp,

        miniTitle,
        miniProgressText: state.miniActive ? miniProg : miniProg,
        miniProgressPct: miniPct,
        miniTimerText,
        miniUrgent,

        goalsCleared: state.goalsCleared|0,
        goalsTotal: state.goalsTotal|0,
        miniCleared: state.miniCleared|0,
        miniTotal: state.miniTotal|0
      });
    }

    function powerAdd(n){
      const c = cfg();
      const th = state.powerThreshold || c.powerThreshold || 9;
      state.powerCharge = clamp(state.powerCharge + (n|0), 0, th);
      emit('groups:power', { charge: state.powerCharge|0, threshold: th|0 });

      if (state.powerCharge >= th){
        state.powerCharge = 0;
        emit('groups:power', { charge: 0, threshold: th|0 });
        swapGroup(+1);
      }
    }

    function swapGroup(dir){
      const prev = currentGroup();
      state.groupIndex = (state.groupIndex + (dir|0) + GROUPS.length) % GROUPS.length;
      const g = currentGroup();
      FX.swapFlash();
      emit('groups:group_change', { groupId: g.id, label: g.label, from: prev.id });
      emitQuestState();
    }

    function isStunned(){ return nowMs() < state.stunnedUntil; }

    function spawn(){
      if (!state.running) return;

      const c = cfg();
      const play = computePlayRect();

      // intensity tweak: panic -> faster spawn
      const panic = (state.timeLeft <= 12 && state.timeLeft > 0);
      const mul = panic ? 0.78 : 1.0;

      const r = state.rng();
      let type = 'good';
      if (r < c.bossRate) type = 'boss';
      else if (r < c.bossRate + c.decoyRate) type = 'decoy';
      else if (r < c.bossRate + c.decoyRate + c.junkRate) type = 'junk';

      // size
      const s = c.size[0] + state.rng()*(c.size[1]-c.size[0]);

      // position
      const half = (132*s)*0.5;
      const x = clamp(play.left + half + state.rng()*(play.width - 2*half), play.left + half, play.right - half);
      const y = clamp(play.top  + half + state.rng()*(play.height - 2*half), play.top  + half, play.bottom - half);

      // life
      const life = randInt(state.rng, c.lifeMs[0], c.lifeMs[1]);
      const expireAt = nowMs() + life;

      // decide good groupId (correct vs wrong)
      const cur = currentGroup();
      let groupId = cur.id;
      let emoji = '🍎';
      let isWrongGood = false;

      if (type === 'good'){
        const wrong = (state.rng() < c.wrongGoodRate);
        if (wrong){
          // pick other group
          const others = GROUPS.filter(g=>g.id !== cur.id);
          const g2 = pick(state.rng, others);
          groupId = g2.id;
          emoji = pick(state.rng, g2.good);
          isWrongGood = true;
        } else {
          groupId = cur.id;
          emoji = pick(state.rng, cur.good);
        }
      } else if (type === 'junk'){
        emoji = pick(state.rng, JUNK_EMOJI);
      } else if (type === 'decoy'){
        emoji = pick(state.rng, DECOY_EMOJI);
      } else if (type === 'boss'){
        emoji = pick(state.rng, BOSS_EMOJI);
      }

      const id = String(state.nextId++);
      const el = DOC.createElement('div');
      el.className = 'fg-target spawn float';
      el.dataset.id = id;
      el.dataset.type = type;
      el.dataset.emoji = emoji;            // for CSS ::before
      el.setAttribute('data-emoji', emoji);

      if (type === 'good'){
        if (isWrongGood) el.classList.add('fg-wrong');
        else el.classList.add('fg-good');
      }
      if (type === 'junk') el.classList.add('fg-junk');
      if (type === 'decoy') el.classList.add('fg-decoy');
      if (type === 'boss') el.classList.add('fg-boss');

      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--s', s.toFixed(3));

      let bossHp=0, bossHpMax=0, bossFillEl=null;
      if (type === 'boss'){
        bossHpMax = randInt(state.rng, c.bossHp[0], c.bossHp[1]);
        bossHp = bossHpMax;
        const bar = DOC.createElement('div');
        bar.className = 'bossbar';
        const fill = DOC.createElement('div');
        fill.className = 'bossbar-fill';
        bar.appendChild(fill);
        el.appendChild(bar);
        bossFillEl = fill;

        // announce
        emitQuestState('boss_spawn');
      }

      state.layerEl.appendChild(el);

      // stats spawn
      if (type === 'good'){
        if (isWrongGood) state.wrongSpawn++;
        else state.correctSpawn++;
      }
      if (type === 'junk') state.junkSpawn++;

      // drift vel
      const drift = c.drift || 16;
      const vx = (state.rng()*2 - 1) * (drift * 0.55);
      const vy = (state.rng()*2 - 1) * (drift * 0.55);

      state.targets.set(id, {
        id, el, type, emoji,
        x, y, s,
        groupId,
        wrongGood: isWrongGood,
        expireAt,
        dead:false,
        vx, vy,
        bossHp, bossHpMax, bossFillEl
      });

      setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(e){} }, 220);

      // next spawn
      const baseNext = randInt(state.rng, c.spawnEveryMs[0], c.spawnEveryMs[1]);
      const next = Math.max(220, Math.round(baseNext * mul));
      state.spawnTo = setTimeout(spawn, next);
    }

    function removeTarget(t, reason){
      if (!t || t.dead) return;
      t.dead = true;
      state.targets.delete(t.id);

      const el = t.el;
      if (el){
        el.classList.add('out');
        setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 220);
      }

      if (reason === 'expire'){
        // expire penalties only for correct-good (โหด+++ ให้กดดัน)
        if (t.type === 'good' && !t.wrongGood){
          state.correctExpire++;
          addMiss();
        }
      }
    }

    function addMiss(){
      state.misses += 1;
      state.combo = 0;
      emitScore();
    }

    function hitCorrect(t, c){
      state.correctHit++;
      state.combo++;
      state.bestStreak = Math.max(state.bestStreak, state.combo);

      state.score += c.score.correct + Math.min(260, state.combo*7);
      powerAdd(1);

      if (state.miniActive){
        state.miniGot++;
        if (state.miniGot >= state.miniNeed){
          stopMini(true);
        } else {
          emitQuestState(); // update mini bar
        }
      }

      // goal checks
      if (state.goalIndex === 0 && state.correctHit >= state.goalNeed) goalClear();
      if (state.goalIndex === 1 && state.bestStreak >= state.goalNeed) goalClear();

      emitScore();
      emitQuestState();
    }

    function hitWrongGood(t, c){
      state.wrongHit++;
      state.combo = 0;
      state.score += c.score.wrong; // negative
      addMiss();
      state.stunnedUntil = nowMs() + (c.stunLiteMs|0);
      FX.stunFlash();

      // mini fails immediately (ห้ามพลาด)
      if (state.miniActive) stopMini(false);

      emitQuestState('wrong_hit');
      emitScore();
    }

    function hitJunk(t, c){
      state.junkHit++;
      state.combo = 0;
      state.score += c.score.junk;
      addMiss();
      state.stunnedUntil = nowMs() + (c.stunMs|0);
      FX.stunFlash();

      if (state.miniActive) stopMini(false);

      emitQuestState();
      emitScore();
    }

    function hitDecoy(t, c){
      state.decoyHit++;
      state.combo = 0;
      state.score += c.score.decoy;
      addMiss();

      if (state.miniActive) stopMini(false);

      emitQuestState();
      emitScore();
    }

    function hitBoss(t){
      if (!t || t.dead) return;
      const c = cfg();
      t.bossHp = Math.max(0, (t.bossHp|0) - 1);

      state.combo++;
      state.bestStreak = Math.max(state.bestStreak, state.combo);
      state.score += c.score.bossHit + Math.min(280, state.combo*7);

      if (t.bossFillEl && t.bossHpMax){
        const pct = Math.max(0, (t.bossHp / t.bossHpMax) * 100);
        t.bossFillEl.style.width = pct.toFixed(1) + '%';
      }

      if (t.el && t.bossHpMax && t.bossHp <= Math.ceil(t.bossHpMax * 0.35)){
        t.el.classList.add('rage');
      }

      if (t.bossHp <= 0){
        state.bossKills++;
        state.score += c.score.bossKill;
        powerAdd(2);

        if (t.el){
          t.el.classList.add('hit');
          setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 220);
        }
        t.dead = true;
        state.targets.delete(t.id);

        // boss kill counts as “correct action” for mini if active
        if (state.miniActive){
          state.miniGot = Math.min(state.miniNeed, state.miniGot + 2);
          if (state.miniGot >= state.miniNeed) stopMini(true);
        }
      } else {
        // keep boss alive
      }

      emitQuestState();
      emitScore();
    }

    function findNearest(px, py, radius){
      let best=null, bestD=1e9;
      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        const dx=t.x-px, dy=t.y-py;
        const d=Math.sqrt(dx*dx+dy*dy);
        if (d < bestD){ bestD=d; best=t; }
      });
      return (best && bestD <= radius) ? best : null;
    }

    function tryLock(px, py){
      const t = findNearest(px, py, 120);
      if (!t){
        if (state.lockedId && state.targets.has(state.lockedId)){
          const old = state.targets.get(state.lockedId);
          if (old && old.el) old.el.classList.remove('lock');
        }
        state.lockedId=null;
        state.lockStartMs=0;
        return null;
      }
      if (state.lockedId !== t.id){
        if (state.lockedId && state.targets.has(state.lockedId)){
          const old = state.targets.get(state.lockedId);
          if (old && old.el) old.el.classList.remove('lock');
        }
        state.lockedId = t.id;
        state.lockStartMs = nowMs();
        if (t.el) t.el.classList.add('lock');
      }
      return t;
    }

    function onPointerMove(ev){
      if (!state.running) return;
      state.lastPointer.x = ev.clientX || 0;
      state.lastPointer.y = ev.clientY || 0;
      if (isStunned()) return;
      tryLock(state.lastPointer.x, state.lastPointer.y);
    }

    function onPointerDown(ev){
      if (!state.running) return;
      try{ ev.preventDefault(); }catch(e){}

      const px = ev.clientX || 0;
      const py = ev.clientY || 0;
      state.lastPointer.x = px;
      state.lastPointer.y = py;

      if (isStunned()) return;

      const t = findNearest(px, py, 110);
      if (t){
        // hit flow
        if (t.el){
          t.el.classList.add('hit');
          setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 220);
        }
        state.targets.delete(t.id);
        t.dead = true;

        FX.afterimage(t.x, t.y, t.emoji);

        const c = cfg();
        if (t.type === 'boss'){
          // boss shouldn't be removed on first hit; re-add by not deleting:
          // but we already deleted above — so handle boss separately:
          // restore for boss
          t.dead = false;
          state.targets.set(t.id, t);
          // undo remove anim
          if (t.el){
            t.el.classList.remove('hit');
          }
          hitBoss(t);
          return;
        }

        if (t.type === 'good'){
          if (t.wrongGood) hitWrongGood(t, c);
          else hitCorrect(t, c);
        } else if (t.type === 'junk'){
          hitJunk(t, c);
        } else if (t.type === 'decoy'){
          hitDecoy(t, c);
        }
        return;
      }

      // fallback: locked auto-hit if held enough
      if (state.lockedId && state.targets.has(state.lockedId)){
        const lt = state.targets.get(state.lockedId);
        const held = nowMs() - (state.lockStartMs || 0);
        if (held >= state.lockNeedMs && lt){
          // simulate hit at lock
          if (lt.type === 'boss'){
            hitBoss(lt);
          } else {
            // remove + effect
            if (lt.el){
              lt.el.classList.add('hit');
              setTimeout(()=>{ try{ lt.el.remove(); }catch(e){} }, 220);
            }
            state.targets.delete(lt.id);
            lt.dead = true;
            FX.afterimage(lt.x, lt.y, lt.emoji);

            const c = cfg();
            if (lt.type === 'good'){
              if (lt.wrongGood) hitWrongGood(lt, c);
              else hitCorrect(lt, c);
            } else if (lt.type === 'junk'){
              hitJunk(lt, c);
            } else if (lt.type === 'decoy'){
              hitDecoy(lt, c);
            }
          }
        }
      }
    }

    function tickSecond(){
      if (!state.running) return;

      state.timeLeft = Math.max(0, (state.timeLeft|0) - 1);
      emit('hha:time', { left: state.timeLeft|0 });

      const panic = state.timeLeft <= 12 && state.timeLeft > 0;
      if (panic !== state.panicOn){
        state.panicOn = panic;
        FX.panic(panic);
        if (panic) FX.tickLow();
      }

      // mini scheduler
      const elapsed = (state.timeTotal - state.timeLeft);
      if (!state.miniActive && elapsed >= state.nextMiniAtSec && state.timeLeft > 4){
        startMini();
        // schedule next mini later
        state.nextMiniAtSec = elapsed + 18 + randInt(state.rng, 0, 6);
      }

      // mini timer
      if (state.miniActive){
        const left = Math.max(0, Math.ceil((state.miniEndsAt - nowMs())/1000));
        state.miniTimeLeft = left;
        if (left <= 0) stopMini(false);
        emitQuestState();
        if (left <= 2) FX.tickLow();
      }

      // expire sweep
      const tnow = nowMs();
      const exp = [];
      state.targets.forEach((t)=>{ if(t && !t.dead && tnow >= t.expireAt) exp.push(t); });
      for (let i=0;i<exp.length;i++) removeTarget(exp[i], 'expire');

      if (state.timeLeft <= 0){
        stop(true);
      }
    }

    function rafLoop(ts){
      if (!state.running) return;
      if (!state.lastRaf) state.lastRaf = ts;
      const dt = Math.min(0.05, Math.max(0.008, (ts - state.lastRaf)/1000));
      state.lastRaf = ts;

      const play = computePlayRect();
      const panicMul = state.panicOn ? 1.55 : 1.0;

      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        // drift
        t.x += t.vx * dt * panicMul;
        t.y += t.vy * dt * panicMul;

        // bounce in play rect (respect size)
        const half = (132*t.s)*0.5;
        const minX = play.left + half, maxX = play.right - half;
        const minY = play.top + half,  maxY = play.bottom - half;

        if (t.x <= minX){ t.x = minX; t.vx = Math.abs(t.vx); }
        if (t.x >= maxX){ t.x = maxX; t.vx = -Math.abs(t.vx); }
        if (t.y <= minY){ t.y = minY; t.vy = Math.abs(t.vy); }
        if (t.y >= maxY){ t.y = maxY; t.vy = -Math.abs(t.vy); }

        if (t.el){
          t.el.style.setProperty('--x', t.x.toFixed(1)+'px');
          t.el.style.setProperty('--y', t.y.toFixed(1)+'px');
        }
      });

      state.rafId = root.requestAnimationFrame(rafLoop);
    }

    function start(diff, opts){
      opts = opts || {};
      state.diff = String(diff || 'normal').toLowerCase();
      if (!DIFF[state.diff]) state.diff = 'normal';

      state.runMode = String(opts.runMode || 'play').toLowerCase();
      state.seed = String(opts.seed || '');

      const seedNum = state.seed ? hashSeed(state.seed) : ((Math.random()*1e9)>>>0);
      state.rng = mulberry32(seedNum);

      const c = cfg();
      state.powerThreshold = (c.powerThreshold|0);

      if (!state.layerEl){
        console.warn('[GroupsVR] layer not set');
        return;
      }

      resetStats();
      state.running = true;

      // first group + power + rank/time
      emit('groups:group_change', { groupId: currentGroup().id, label: currentGroup().label, from: 0 });
      emit('groups:power', { charge:0, threshold: state.powerThreshold|0 });
      emit('hha:time', { left: state.timeLeft|0 });
      emitScore();
      emitQuestState();

      clearInterval(state.timerInt);
      state.timerInt = setInterval(tickSecond, 1000);

      clearTimeout(state.spawnTo);
      state.spawnTo = setTimeout(spawn, 220);

      // raf drift
      cancelAnimationFrame(state.rafId);
      state.lastRaf = 0;
      state.rafId = root.requestAnimationFrame(rafLoop);
    }

    function stop(ended){
      if (!state.running) return;
      state.running = false;

      clearInterval(state.timerInt);
      clearTimeout(state.spawnTo);
      state.timerInt = null;
      state.spawnTo = null;

      cancelAnimationFrame(state.rafId);
      state.rafId = 0;

      FX.panic(false);

      if (state.lockedId && state.targets.has(state.lockedId)){
        const t = state.targets.get(state.lockedId);
        if (t && t.el) t.el.classList.remove('lock');
      }

      if (ended){
        const acc = calcAccuracy();
        const grade = gradeFrom(acc, state.score|0);

        const summary = {
          timestampIso: new Date().toISOString(),
          projectTag: (new URLSearchParams(location.search)).get('projectTag') || 'HeroHealth',
          runMode: state.runMode,
          sessionId: (new URLSearchParams(location.search)).get('sessionId') || '',
          gameMode: 'groups',
          diff: state.diff,
          durationPlannedSec: state.timeTotal|0,
          durationPlayedSec: state.timeTotal|0,
          scoreFinal: state.score|0,
          comboMax: state.comboMax|0,
          misses: state.misses|0,
          goalsCleared: state.goalsCleared|0,
          goalsTotal: state.goalsTotal|0,
          miniCleared: state.miniCleared|0,
          miniTotal: state.miniTotal|0,
          correctHit: state.correctHit|0,
          correctSpawn: state.correctSpawn|0,
          correctExpire: state.correctExpire|0,
          wrongHit: state.wrongHit|0,
          wrongSpawn: state.wrongSpawn|0,
          junkHit: state.junkHit|0,
          junkSpawn: state.junkSpawn|0,
          decoyHit: state.decoyHit|0,
          bossKills: state.bossKills|0,
          accuracyGoodPct: acc|0,
          grade
        };

        emit('hha:rank', { grade, accuracy: acc|0 });
        emit('hha:end', summary);

        // logger marker
        try{
          root.dispatchEvent(new CustomEvent('hha:log_session', { detail: { phase:'end', game:'groups', grade, scoreFinal: summary.scoreFinal } }));
        }catch(e){}
      }
    }

    return { setLayerEl, setTimeLeft, start, stop };
  })();

  NS.GameEngine = Engine;
})(window);
