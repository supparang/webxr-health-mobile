/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (PRODUCTION / classic script) — HHA Standard Patch
✅ window.GroupsVR.GameEngine (no module import)
✅ hha:time compat {left, sec, secLeft}
✅ hha:score compat {misses, miss}
✅ start() respects opts time + QS fallback
✅ Quest cache + replay (quest:update + hha:quest)
✅ End summary + store HHA_LAST_SUMMARY
✅ Optional logging hooks: hha:log_session / hha:log_event
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // Namespace
  const NS = (root.GroupsVR = root.GroupsVR || {});

  // -------------------- Query helpers (safe) --------------------
  const qs = new URLSearchParams((root.location && root.location.search) ? root.location.search : '');
  const getQS = (k, d='') => qs.has(k) ? String(qs.get(k) ?? '') : d;

  // -------------------- Utilities --------------------
  function nowMs() { return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function randInt(rng, a, b){ return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }

  // Seeded RNG (mulberry32)
  function hashSeed(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++){
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

  function emit(name, detail){
    try{
      root.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(e){}
  }

  // safe-area insets from CSS vars env()
  function readSafeInsets(){
    const cs = getComputedStyle(DOC.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
    return { sat, sab, sal, sar };
  }

  function pickEl(ids){
    for (let i=0;i<(ids||[]).length;i++){
      const el = DOC.getElementById(ids[i]);
      if (el) return el;
    }
    return null;
  }

  // -------------------- Minimal FX hooks (works even if groups-fx.js is missing) --------------------
  const FX = {
    panic(on){
      DOC.documentElement.classList.toggle('panic', !!on);
    },
    stunFlash(){
      DOC.documentElement.classList.add('stunflash');
      setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 220);
    },
    swapFlash(){
      DOC.documentElement.classList.add('swapflash');
      setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 220);
    },
    afterimage(xpx, ypx, emoji){
      const wrap = DOC.createElement('div');
      wrap.className = 'fg-afterimage a1';
      wrap.style.setProperty('--x', xpx + 'px');
      wrap.style.setProperty('--y', ypx + 'px');
      const inner = DOC.createElement('div');
      inner.className = 'fg-afterimage-inner';
      inner.textContent = emoji || '✨';
      wrap.appendChild(inner);
      DOC.body.appendChild(wrap);
      setTimeout(()=>{ try{ wrap.remove(); }catch(e){} }, 240);

      const wrap2 = DOC.createElement('div');
      wrap2.className = 'fg-afterimage a2';
      wrap2.style.setProperty('--x', xpx + 'px');
      wrap2.style.setProperty('--y', ypx + 'px');
      const inner2 = DOC.createElement('div');
      inner2.className = 'fg-afterimage-inner';
      inner2.textContent = emoji || '✨';
      wrap2.appendChild(inner2);
      DOC.body.appendChild(wrap2);
      setTimeout(()=>{ try{ wrap2.remove(); }catch(e){} }, 300);
    }
  };
  NS.FX = NS.FX || FX;

  // -------------------- HHA Standard: Quest cache + replay --------------------
  function cacheQuest(q){ try{ root.__HHA_LAST_QUEST__ = q; }catch(e){} }
  function replayQuest(){
    try{
      const q = root.__HHA_LAST_QUEST__;
      if (q){
        emit('quest:update', q);
        emit('hha:quest', q);
      }
    }catch(e){}
  }
  function emitQuest(q){
    cacheQuest(q);
    emit('quest:update', q);
    emit('hha:quest', q);
  }

  // -------------------- HHA Standard: last summary storage --------------------
  function storeLastSummary(sum){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(sum || {}));
      localStorage.setItem('hha_last_summary', JSON.stringify(sum || {}));
    }catch(e){}
  }

  // Optional: fallback end overlay wiring (if present in HTML)
  const END_UI = {
    overlay: pickEl(['gvr-end','hvr-end','end-overlay','endOverlay']),
    score:   pickEl(['end-score','gvr-end-score']),
    grade:   pickEl(['end-grade','gvr-end-grade']),
    combo:   pickEl(['end-combo','gvr-end-combo']),
    miss:    pickEl(['end-miss','gvr-end-miss']),
    goals:   pickEl(['end-goals','gvr-end-goals']),
    minis:   pickEl(['end-minis','gvr-end-minis']),
    btnRetry: pickEl(['btn-retry','gvr-btn-retry']),
    btnBack:  pickEl(['btn-backhub','btn-back','gvr-btn-backhub'])
  };

  function showEndOverlay(sum){
    if (!END_UI.overlay) return;
    if (END_UI.score) END_UI.score.textContent = String(sum.scoreFinal ?? 0);
    if (END_UI.grade) END_UI.grade.textContent = String(sum.grade ?? 'C');
    if (END_UI.combo) END_UI.combo.textContent = String(sum.comboMax ?? 0);
    if (END_UI.miss)  END_UI.miss.textContent  = String(sum.misses ?? 0);
    // groups ไม่มี goals/minis ก็แสดงเป็น "-" ได้
    if (END_UI.goals) END_UI.goals.textContent = String(sum.goalsCleared ?? '-') + '/' + String(sum.goalsTotal ?? '-');
    if (END_UI.minis) END_UI.minis.textContent = String(sum.miniCleared ?? '-') + '/' + String(sum.miniTotal ?? '-');
    END_UI.overlay.style.display = 'flex';
  }

  // bind end buttons (safe)
  if (END_UI.btnRetry){
    END_UI.btnRetry.addEventListener('click', ()=>{ try{ root.location.reload(); }catch(e){} }, { passive:true });
  }
  if (END_UI.btnBack){
    END_UI.btnBack.addEventListener('click', ()=>{
      const HUB_URL = String(getQS('hub','./hub.html') || './hub.html');
      try{
        const u = new URL(HUB_URL, root.location.href);
        u.searchParams.set('ts', String(Date.now()));
        root.location.href = u.toString();
      }catch(e){
        root.location.href = HUB_URL;
      }
    }, { passive:true });
  }

  // -------------------- HHA Standard: logging hooks (optional) --------------------
  function logSession(phase, extra){
    emit('hha:log_session', Object.assign({
      phase: phase || '',
      gameMode: 'groups',
      timestampIso: new Date().toISOString()
    }, extra || {}));
  }
  function logEvent(kind, extra){
    emit('hha:log_event', Object.assign({
      kind: kind || '',
      gameMode: 'groups',
      timestampIso: new Date().toISOString()
    }, extra || {}));
  }

  // -------------------- Content (Food Groups) --------------------
  const GROUPS = [
    { id:1, label:'หมู่ 1 โปรตีน 💪', good:['🥚','🥛','🐟','🥜','🍗','🧀'] },
    { id:2, label:'หมู่ 2 คาร์บ 🌾',   good:['🍚','🍞','🥔','🍠','🥨','🍜'] },
    { id:3, label:'หมู่ 3 ผัก 🥦',     good:['🥦','🥬','🥕','🌽','🥒','🍅'] },
    { id:4, label:'หมู่ 4 ผลไม้ 🍎',   good:['🍎','🍌','🍊','🍇','🍉','🍓'] },
    { id:5, label:'หมู่ 5 ไขมัน 🫒',   good:['🫒','🥑','🧈','🥥','🥜','🧀'] }
  ];

  const JUNK_EMOJI = ['🍟','🍔','🍕','🍩','🍭','🧁','🥤','🍿','🍫','🍪'];
  const DECOY_EMOJI = ['❓','🌀','🎭','🧩','🎲'];
  const BOSS_EMOJI  = ['👹','😈','🧟','🦂','🐲'];

  // -------------------- Difficulty Profiles --------------------
  const DIFF = {
    easy: {
      timeDefault: 90,
      spawnEveryMs: [650, 900],
      lifeMs: [1300, 1750],
      size: [0.88, 1.05],
      junkRate: 0.16,
      decoyRate: 0.08,
      bossRate: 0.06,
      bossHp: [3, 4],
      stunMs: 450,
      powerThreshold: 7,
      score: { good: 120, bossHit: 90, bossKill: 220, decoy: -60, junk: -90 },
      missPenalty: 1
    },
    normal: {
      timeDefault: 90,
      spawnEveryMs: [520, 800],
      lifeMs: [1050, 1550],
      size: [0.82, 1.02],
      junkRate: 0.22,
      decoyRate: 0.10,
      bossRate: 0.08,
      bossHp: [4, 6],
      stunMs: 650,
      powerThreshold: 9,
      score: { good: 130, bossHit: 95, bossKill: 260, decoy: -70, junk: -110 },
      missPenalty: 1
    },
    hard: {
      timeDefault: 90,
      spawnEveryMs: [430, 690],
      lifeMs: [900, 1300],
      size: [0.76, 0.98],
      junkRate: 0.28,
      decoyRate: 0.12,
      bossRate: 0.10,
      bossHp: [6, 8],
      stunMs: 820,
      powerThreshold: 11,
      score: { good: 140, bossHit: 105, bossKill: 320, decoy: -80, junk: -140 },
      missPenalty: 1
    }
  };

  function gradeFrom(acc, score){
    if (acc >= 92 && score >= 8500) return 'SSS';
    if (acc >= 88 && score >= 7000) return 'SS';
    if (acc >= 83) return 'S';
    if (acc >= 74) return 'A';
    if (acc >= 62) return 'B';
    return 'C';
  }

  // -------------------- Engine --------------------
  const Engine = (function(){
    const state = {
      running:false,
      diff:'normal',
      runMode:'play', // play / research
      seed:'',
      rng: Math.random,

      layerEl:null,
      targets:new Map(),
      nextId:1,

      // timing
      timeLeft:90,
      timeTotal:90,
      timerInt:null,
      spawnTo:null,

      // score
      score:0,
      combo:0,
      comboMax:0,
      misses:0,

      // accuracy core
      goodHit:0,
      goodSpawn:0,
      goodExpire:0,
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

      // input
      lastPointer: { x:0, y:0 },
      lockedId: null,
      lockStartMs: 0,
      lockNeedMs: 220
    };

    function cfg(){
      return DIFF[state.diff] || DIFF.normal;
    }

    function setLayerEl(el){
      state.layerEl = el;
      if (el){
        el.addEventListener('pointerdown', onPointerDown, { passive:false });
        el.addEventListener('pointermove', onPointerMove, { passive:true });
      }
    }

    function setTimeLeft(sec){
      sec = Math.max(1, (sec|0));
      state.timeLeft = sec;
      state.timeTotal = sec;
    }

    function resetStats(){
      state.targets.clear();
      state.nextId = 1;

      state.score = 0;
      state.combo = 0;
      state.comboMax = 0;
      state.misses = 0;

      state.goodHit = 0;
      state.goodSpawn = 0;
      state.goodExpire = 0;
      state.junkHit = 0;
      state.junkSpawn = 0;
      state.decoyHit = 0;
      state.bossKills = 0;

      state.groupIndex = 0;
      state.powerCharge = 0;

      state.stunnedUntil = 0;
      state.panicOn = false;

      state.lockedId = null;
      state.lockStartMs = 0;

      if (state.layerEl) state.layerEl.innerHTML = '';
    }

    function currentGroup(){
      return GROUPS[state.groupIndex % GROUPS.length];
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

      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(10, right - left),
        height: Math.max(10, bottom - top),
        w, h
      };
    }

    function spawn(){
      if (!state.running) return;

      const c = cfg();
      const play = computePlayRect();

      const r = state.rng();
      let type = 'good';
      if (r < c.bossRate) type = 'boss';
      else if (r < c.bossRate + c.decoyRate) type = 'decoy';
      else if (r < c.bossRate + c.decoyRate + c.junkRate) type = 'junk';

      const g = currentGroup();
      let emoji = pick(state.rng, g.good);
      if (type === 'junk') emoji = pick(state.rng, JUNK_EMOJI);
      if (type === 'decoy') emoji = pick(state.rng, DECOY_EMOJI);
      if (type === 'boss') emoji = pick(state.rng, BOSS_EMOJI);

      const s = c.size[0] + state.rng() * (c.size[1] - c.size[0]);

      const half = (132 * s) * 0.5;
      const x = clamp(play.left + half + state.rng()*(play.width - 2*half), play.left + half, play.right - half);
      const y = clamp(play.top  + half + state.rng()*(play.height - 2*half), play.top  + half, play.bottom - half);

      const life = randInt(state.rng, c.lifeMs[0], c.lifeMs[1]);
      const expireAt = nowMs() + life;

      const id = String(state.nextId++);
      const el = DOC.createElement('div');
      el.className = 'fg-target show spawn';
      el.dataset.id = id;
      el.dataset.type = type;

      if (type === 'good') el.classList.add('fg-good');
      if (type === 'junk') el.classList.add('fg-junk');
      if (type === 'decoy') el.classList.add('fg-decoy');
      if (type === 'boss') el.classList.add('fg-boss');

      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--s', s.toFixed(3));
      el.textContent = emoji;

      let bossHp = 0;
      let bossHpMax = 0;
      let bossFillEl = null;

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
      }

      state.layerEl.appendChild(el);

      if (type === 'good'){ state.goodSpawn++; }
      if (type === 'junk'){ state.junkSpawn++; }

      state.targets.set(id, {
        id, el, type, emoji,
        x, y, s,
        expireAt,
        dead:false,
        groupId: g.id,
        bossHp, bossHpMax, bossFillEl
      });

      // logging
      logEvent('spawn', { id, type, emoji, x: +x.toFixed(1), y: +y.toFixed(1), s: +s.toFixed(3), groupId: g.id });

      setTimeout(()=>{ if (el) el.classList.remove('spawn'); }, 220);

      const next = randInt(state.rng, c.spawnEveryMs[0], c.spawnEveryMs[1]);
      state.spawnTo = setTimeout(spawn, next);
    }

    function removeTarget(t, reason){
      if (!t || t.dead) return;
      t.dead = true;
      state.targets.delete(t.id);

      const el = t.el;
      if (el){
        el.classList.remove('spawn');
        el.classList.add('out');
        setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 220);
      }

      if (reason === 'expire'){
        logEvent('expire', { id: t.id, type: t.type, groupId: t.groupId });

        if (t.type === 'good'){
          state.goodExpire++;
          addMiss();
        }
      }
    }

    function addMiss(){
      state.misses += 1;
      state.combo = 0;
      emitScore();
    }

    function emitScore(){
      state.comboMax = Math.max(state.comboMax, state.combo);

      emit('hha:score', {
        score: state.score|0,
        combo: state.combo|0,
        misses: state.misses|0,
        miss: state.misses|0,          // ✅ compat
        comboMax: state.comboMax|0
      });

      const acc = calcAccuracy();
      const grade = gradeFrom(acc, state.score|0);
      emit('hha:rank', { grade, accuracy: acc|0 });

      // quest snapshot (lightweight)
      emitQuest(makeQuestSnapshot());
    }

    function calcAccuracy(){
      const denom = Math.max(1, state.goodHit + state.goodExpire);
      return Math.round((state.goodHit / denom) * 100);
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
      } else {
        emitQuest(makeQuestSnapshot());
      }
    }

    function swapGroup(dir){
      const prev = currentGroup();
      state.groupIndex = (state.groupIndex + (dir|0) + GROUPS.length) % GROUPS.length;
      const g = currentGroup();

      (NS.FX || FX).swapFlash();
      emit('groups:group_change', { groupId: g.id, label: g.label, from: prev.id });
      emit('groups:progress', { kind:'group_swap', groupId:g.id });

      logEvent('group_change', { from: prev.id, to: g.id });

      emitQuest(makeQuestSnapshot());
    }

    function isStunned(){
      return nowMs() < state.stunnedUntil;
    }

    function hitTarget(t){
      if (!t || t.dead) return;

      const c = cfg();
      const type = t.type;

      if (t.el){
        t.el.classList.remove('spawn');
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 220);
      }
      state.targets.delete(t.id);
      t.dead = true;

      (NS.FX || FX).afterimage(t.x, t.y, t.emoji);

      logEvent('hit', { id: t.id, type, emoji: t.emoji, groupId: t.groupId });

      if (type === 'good'){
        state.goodHit++;
        state.combo++;
        state.score += c.score.good + Math.min(220, state.combo * 6);
        powerAdd(1);
        emit('hha:judge', { text:'GOOD!', kind:'good' });
        emit('groups:progress', { kind:'good_hit', groupId: t.groupId });
      }
      else if (type === 'junk'){
        state.junkHit++;
        state.combo = 0;
        state.score += c.score.junk;
        addMiss();
        state.stunnedUntil = nowMs() + (c.stunMs|0);
        (NS.FX || FX).stunFlash();
        emit('groups:stun', { ms: c.stunMs|0 });
        emit('hha:judge', { text:'STUN!', kind:'bad' });
      }
      else if (type === 'decoy'){
        state.decoyHit++;
        state.combo = 0;
        state.score += c.score.decoy;
        addMiss();
        emit('hha:judge', { text:'DECOY!', kind:'warn' });
        emit('groups:progress', { kind:'decoy_hit' });
      }

      emitScore();
    }

    function hitBoss(t){
      if (!t || t.dead) return;

      const c = cfg();
      t.bossHp = Math.max(0, (t.bossHp|0) - 1);

      state.combo++;
      state.score += c.score.bossHit + Math.min(240, state.combo * 6);

      if (t.bossFillEl && t.bossHpMax){
        const pct = Math.max(0, (t.bossHp / t.bossHpMax) * 100);
        t.bossFillEl.style.width = pct.toFixed(1) + '%';
      }

      if (t.el && t.bossHpMax && t.bossHp <= Math.ceil(t.bossHpMax * 0.35)){
        t.el.classList.add('rage');
      }

      logEvent('boss_hit', { id: t.id, hp: t.bossHp|0, hpMax: t.bossHpMax|0 });

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

        emit('hha:judge', { text:'BOSS DOWN!', kind:'boss' });
        emit('groups:progress', { kind:'boss_kill' });

        logEvent('boss_kill', { id: t.id });
      } else {
        emit('hha:judge', { text:'HIT!', kind:'boss' });
      }

      emitScore();
    }

    function findNearestTarget(px, py, radiusPx){
      let best = null;
      let bestD = 1e9;

      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        const dx = (t.x - px);
        const dy = (t.y - py);
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < bestD){
          bestD = d;
          best = t;
        }
      });

      if (!best) return null;
      return (bestD <= radiusPx) ? best : null;
    }

    function tryLock(px, py){
      const t = findNearestTarget(px, py, 120);
      if (!t) {
        state.lockedId = null;
        state.lockStartMs = 0;
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
      if (!ev) return;
      state.lastPointer.x = ev.clientX || 0;
      state.lastPointer.y = ev.clientY || 0;

      if (isStunned()) return;
      tryLock(state.lastPointer.x, state.lastPointer.y);
    }

    function onPointerDown(ev){
      if (!state.running) return;
      if (!ev) return;

      try { ev.preventDefault(); } catch(e) {}

      const px = ev.clientX || 0;
      const py = ev.clientY || 0;
      state.lastPointer.x = px;
      state.lastPointer.y = py;

      if (isStunned()) return;

      const t = findNearestTarget(px, py, 110);
      if (t){
        if (t.type === 'boss') hitBoss(t);
        else hitTarget(t);
        return;
      }

      if (state.lockedId && state.targets.has(state.lockedId)){
        const lt = state.targets.get(state.lockedId);
        const held = nowMs() - (state.lockStartMs || 0);
        if (held >= state.lockNeedMs && lt){
          if (lt.type === 'boss') hitBoss(lt);
          else hitTarget(lt);
        }
      }
    }

    function makeQuestSnapshot(){
      const g = currentGroup();
      const acc = calcAccuracy();
      const grade = gradeFrom(acc, state.score|0);
      const th = state.powerThreshold|0;

      return {
        title: 'Food Groups VR',
        line1: `Group: ${g.label}`,
        line2: `Power: ${state.powerCharge|0}/${th} · Boss ${state.bossKills|0}`,
        line3: `Acc: ${acc}% · Grade ${grade} · Combo ${state.combo|0}`,
        line4: `Time: ${state.timeLeft|0}s · Miss ${state.misses|0}`
      };
    }

    function tickSecond(){
      if (!state.running) return;

      state.timeLeft = Math.max(0, (state.timeLeft|0) - 1);

      // ✅ compat time payload
      emit('hha:time', {
        left: state.timeLeft|0,
        sec: state.timeLeft|0,
        secLeft: state.timeLeft|0
      });

      const panic = state.timeLeft <= 12 && state.timeLeft > 0;
      if (panic !== state.panicOn){
        state.panicOn = panic;
        (NS.FX || FX).panic(panic);
      }

      const tnow = nowMs();
      const exp = [];
      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        if (tnow >= t.expireAt) exp.push(t);
      });
      for (let i=0;i<exp.length;i++) removeTarget(exp[i], 'expire');

      // keep quest alive even if nothing hits
      emitQuest(makeQuestSnapshot());

      if (state.timeLeft <= 0){
        stop(true);
      }
    }

    function start(diff, opts){
      opts = opts || {};
      state.diff = String(diff || getQS('diff','normal') || 'normal').toLowerCase();
      if (!DIFF[state.diff]) state.diff = 'normal';

      state.runMode = String(opts.runMode || getQS('run', getQS('runMode','play')) || 'play').toLowerCase();

      // ✅ seed (deterministic) — QS fallback: sessionId/studentKey/ts
      const seedFromQS =
        String(getQS('sessionId','') || getQS('studentKey','') || '') + '|' + String(getQS('ts', Date.now()));
      state.seed = String(opts.seed || getQS('seed','') || seedFromQS || '');

      // ✅ respect time from opts OR query
      const t =
        Number(opts.time ?? opts.duration ?? opts.durationPlannedSec ??
               getQS('time', getQS('durationPlannedSec', 0)));
      if (Number.isFinite(t) && t > 5) setTimeLeft(t|0);
      else setTimeLeft((cfg().timeDefault|0) || 90);

      // rng
      const seedNum = state.seed ? hashSeed(state.seed) : (Math.random()*1e9)>>>0;
      state.rng = mulberry32(seedNum);

      const c = cfg();
      state.powerThreshold = (c.powerThreshold|0);

      if (!state.layerEl){
        console.warn('[GroupsVR] layer not set');
        return;
      }

      resetStats();
      state.running = true;

      // start session log
      logSession('start', {
        diff: state.diff,
        runMode: state.runMode,
        seed: state.seed,
        durationPlannedSec: state.timeTotal|0
      });

      emit('groups:group_change', { groupId: currentGroup().id, label: currentGroup().label, from: 0 });
      emit('groups:power', { charge:0, threshold: state.powerThreshold|0 });

      // ✅ compat time initial
      emit('hha:time', { left: state.timeLeft|0, sec: state.timeLeft|0, secLeft: state.timeLeft|0 });

      emitScore();           // also emits quest
      replayQuest();         // ✅ in case HUD loads late

      clearInterval(state.timerInt);
      state.timerInt = setInterval(tickSecond, 1000);

      clearTimeout(state.spawnTo);
      state.spawnTo = setTimeout(spawn, 250);
    }

    function stop(ended){
      if (!state.running) return;
      state.running = false;

      clearInterval(state.timerInt);
      clearTimeout(state.spawnTo);
      state.timerInt = null;
      state.spawnTo = null;

      (NS.FX || FX).panic(false);

      if (state.lockedId && state.targets.has(state.lockedId)){
        const t = state.targets.get(state.lockedId);
        if (t && t.el) t.el.classList.remove('lock');
      }

      if (ended){
        const acc = calcAccuracy();
        const grade = gradeFrom(acc, state.score|0);

        const summary = {
          timestampIso: new Date().toISOString(),
          projectTag: String(getQS('projectTag','HeroHealth') || 'HeroHealth'),

          gameMode: 'groups',
          diff: state.diff,
          runMode: state.runMode,
          seed: state.seed,

          durationPlannedSec: state.timeTotal|0,
          durationPlayedSec: (state.timeTotal - state.timeLeft)|0,

          scoreFinal: state.score|0,
          comboMax: state.comboMax|0,
          misses: state.misses|0,

          goodHit: state.goodHit|0,
          goodSpawn: state.goodSpawn|0,
          goodExpire: state.goodExpire|0,
          junkHit: state.junkHit|0,
          junkSpawn: state.junkSpawn|0,
          decoyHit: state.decoyHit|0,
          bossKills: state.bossKills|0,

          accuracyGoodPct: acc|0,
          grade: grade
        };

        storeLastSummary(summary);     // ✅ HHA standard
        emit('hha:rank', { grade, accuracy: acc|0 });
        emit('hha:end', summary);      // ✅ payload standard

        // end session log
        logSession('end', summary);

        // fallback UI
        showEndOverlay(summary);

        // final quest snapshot
        emitQuest({
          title: 'Food Groups VR — END',
          line1: `Score: ${summary.scoreFinal} · Grade: ${summary.grade}`,
          line2: `Acc: ${summary.accuracyGoodPct}% · ComboMax: ${summary.comboMax}`,
          line3: `Miss: ${summary.misses} · Boss: ${summary.bossKills}`,
          line4: `Time: ${summary.durationPlayedSec}/${summary.durationPlannedSec}s`
        });
      } else {
        logSession('stop', { diff: state.diff, runMode: state.runMode, seed: state.seed });
      }
    }

    return {
      setLayerEl,
      setTimeLeft,
      start,
      stop
    };
  })();

  NS.GameEngine = Engine;
})(window);
