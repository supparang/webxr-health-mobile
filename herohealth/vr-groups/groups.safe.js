/* === /herohealth/vr-groups/groups.safe.js ===
Food Groups VR — Standalone DOM Engine (PRODUCTION)
✅ Exposes: window.GroupsVR.GameEngine (setLayerEl, start, stop)
✅ Input:
   - PC/Mobile: click/tap target
   - cVR: shoot from crosshair via window event 'hha:shoot' (vr-ui.js)
✅ Emits:
   - hha:score  {score, combo, misses}
   - hha:time   {left}
   - hha:rank   {accuracy, grade}
   - hha:coach  {text, mood}
   - quest:update {goalTitle, goalNow, goalTotal, goalPct, miniTitle, miniNow, miniTotal, miniPct, miniTimeLeftSec}
   - groups:power {charge, threshold}
   - groups:progress {kind, ...}
   - hha:judge {kind:'good'|'bad'|'miss'|'boss', ...}
   - hha:end   summary detail
✅ Modes:
   - runMode=play: adaptive allowed (light)
   - runMode=research: deterministic, adaptive OFF
*/

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  const NS = WIN.GroupsVR;

  const VERSION = 'groups.safe.js@2026-01-02';

  // ---------------- helpers ----------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function nowMs(){ return (WIN.performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail||{} })); }catch(_){}
  }
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a){
    let t = a >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr){
    return arr[(rng()*arr.length) | 0];
  }
  function lerp(a,b,t){ return a + (b-a)*t; }

  function getViewport(){
    return { w: WIN.innerWidth || 360, h: WIN.innerHeight || 640 };
  }

  // ---------------- content: groups & emoji ----------------
  const GROUPS = [
    { key:'grains',  th:'ข้าว-แป้ง',   icon:'🍞', emojis:['🍞','🥐','🥖','🥯','🥨','🍚','🍙','🍜','🍝','🥞'] },
    { key:'veg',     th:'ผัก',        icon:'🥦', emojis:['🥦','🥬','🥒','🥕','🌽','🍆','🍅','🥗','🫛','🧄'] },
    { key:'fruit',   th:'ผลไม้',      icon:'🍎', emojis:['🍎','🍌','🍇','🍊','🍉','🍓','🥭','🍍','🍑','🍐'] },
    { key:'protein', th:'เนื้อ-ไข่-ถั่ว', icon:'🍗', emojis:['🍗','🥚','🍖','🐟','🦐','🫘','🥜','🍳','🍤','🧆'] },
    { key:'dairy',   th:'นม',         icon:'🥛', emojis:['🥛','🧀','🍦','🥤','🍶','🧋','🍨','🥣','🍼'] }
  ];

  const JUNK = { key:'junk', th:'ขยะ/หวานมันเค็ม', icon:'🍟', emojis:['🍟','🍔','🍕','🌭','🍩','🍪','🍫','🍿','🥤','🍰'] };
  const STAR = { key:'star', icon:'⭐', emojis:['⭐','🌟','✨'] };
  const DIAMOND = { key:'diamond', icon:'💎', emojis:['💎','🔷','🔶'] };
  const SHIELD = { key:'shield', icon:'🛡️', emojis:['🛡️','🧿'] };

  // ---------------- difficulty tuning ----------------
  function diffPreset(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy'){
      return {
        spawnMs: 820,
        lifeMs: 1700,
        junkRate: 0.16,
        wrongRate:0.22,
        bonusRate:0.08,
        bossHp: 10,
        stormSec: 10,
        stormSpawnMul: 0.70,
        missLimit: 12,
        powerThr: 7,
      };
    }
    if (diff==='hard'){
      return {
        spawnMs: 520,
        lifeMs: 1200,
        junkRate: 0.24,
        wrongRate:0.28,
        bonusRate:0.12,
        bossHp: 16,
        stormSec: 12,
        stormSpawnMul: 0.62,
        missLimit: 9,
        powerThr: 8,
      };
    }
    return {
      spawnMs: 650,
      lifeMs: 1400,
      junkRate: 0.20,
      wrongRate:0.25,
      bonusRate:0.10,
      bossHp: 13,
      stormSec: 11,
      stormSpawnMul: 0.66,
      missLimit: 10,
      powerThr: 8,
    };
  }

  // ---------------- Quest Director (simple but rich) ----------------
  function makeQuest(){
    // 3-stage: (1) switch group N times (power), (2) storm survive, (3) boss clear
    const Q = {
      stage: 1,
      goalNow: 0,
      goalTotal: 3,      // number of successful switches
      miniNow: 0,
      miniTotal: 6,
      miniLeftSec: 0,
      miniActive: false,
      miniOkHits: 0,
      miniOkNeeded: 6,
      lastPushMs: 0,
      push(force){
        const t = nowMs();
        if (!force && (t - Q.lastPushMs < 120)) return;
        Q.lastPushMs = t;

        let goalTitle = '';
        if (Q.stage===1) goalTitle = `สลับหมู่ให้ได้ ${Q.goalTotal} ครั้ง (ใช้ Power ครบแล้วจะสลับหมู่)`;
        else if (Q.stage===2) goalTitle = `พายุอาหาร! อยู่รอดให้ได้`;
        else goalTitle = `บอสมาแล้ว! เก็บให้ครบ`;

        let miniTitle = Q.miniActive
          ? `ทำให้ถูก ${Q.miniOkHits}/${Q.miniOkNeeded} ภายในเวลา`
          : '—';

        emit('quest:update', {
          goalTitle,
          goalNow: Q.goalNow,
          goalTotal: Q.goalTotal,
          goalPct: clamp(Q.goalNow / Math.max(1,Q.goalTotal) * 100, 0, 100),

          miniTitle,
          miniNow: Q.miniOkHits,
          miniTotal: Q.miniOkNeeded,
          miniPct: clamp(Q.miniOkHits / Math.max(1,Q.miniOkNeeded) * 100, 0, 100),
          miniTimeLeftSec: Q.miniActive ? Q.miniLeftSec : 0
        });
      },
      startMini(){
        Q.miniActive = true;
        Q.miniOkHits = 0;
        Q.miniOkNeeded = 6;
        Q.miniLeftSec = 6;
        Q.push(true);
      },
      tickMini(){
        if (!Q.miniActive) return;
        Q.miniLeftSec = Math.max(0, Q.miniLeftSec - 1);
        if (Q.miniLeftSec<=0){
          Q.miniActive = false;
          Q.miniOkHits = 0;
        }
        Q.push(true);
      },
      hitCorrect(){
        if (!Q.miniActive) return;
        Q.miniOkHits++;
        if (Q.miniOkHits >= Q.miniOkNeeded){
          Q.miniActive = false;
          Q.miniOkHits = Q.miniOkNeeded;
        }
        Q.push(true);
      },
      advanceStage(){
        Q.stage++;
        Q.push(true);
      }
    };
    return Q;
  }

  // ---------------- Target system ----------------
  function createTargetEl(emoji, cls){
    const el = DOC.createElement('div');
    el.className = 'fg-target spawn ' + (cls||'');
    el.setAttribute('data-emoji', emoji);
    // position/scale via css vars
    return el;
  }

  function setTargetPos(el, x, y, s){
    el.style.setProperty('--x', x + 'px');
    el.style.setProperty('--y', y + 'px');
    el.style.setProperty('--s', String(s ?? 1));
  }

  // ---------------- Engine ----------------
  function Engine(){
    // state
    const S = {
      running:false,
      layerEl:null,

      runMode:'play',
      view:'mobile',
      diff:'normal',
      style:'mix',
      seed:'',

      rng: Math.random,
      cfg: diffPreset('normal'),

      // time
      timeTotal: 90,
      timeLeft: 90,
      tTick: 0,

      // score
      score:0,
      combo:0,
      comboMax:0,
      misses:0,
      nSpawn:0,
      nHit:0,
      nHitGood:0,
      nHitWrong:0,
      nHitJunk:0,
      nHitBoss:0,
      nExpire:0,

      // power / group
      power:0,
      powerThr:8,
      groupIdx:0,

      // stage
      stormOn:false,
      stormLeftSec:0,
      bossOn:false,
      bossHp:0,

      // timers
      spawnTimer:0,
      lifeTimer:0,

      // targets
      targets: [], // {id, el, kind, groupKey, bornMs, lifeMs, isBoss}
      nextId: 1,

      // shoot handling
      shootHandler: null,

      // quest
      Q: makeQuest(),

      // coach
      coachLastMs: 0,
    };

    function setLayerEl(el){
      S.layerEl = el;
      return true;
    }

    function resetForStart(){
      // clear
      S.targets.forEach(t=>{
        try{ t.el.remove(); }catch(_){}
      });
      S.targets.length = 0;

      S.running = true;
      S.score = 0;
      S.combo = 0;
      S.comboMax = 0;
      S.misses = 0;
      S.nSpawn = 0;
      S.nHit = 0;
      S.nHitGood = 0;
      S.nHitWrong = 0;
      S.nHitJunk = 0;
      S.nHitBoss = 0;
      S.nExpire = 0;

      S.power = 0;
      S.powerThr = S.cfg.powerThr;

      S.stormOn = false;
      S.stormLeftSec = 0;
      S.bossOn = false;
      S.bossHp = 0;

      S.Q = makeQuest();
      S.Q.push(true);

      // initial group
      S.groupIdx = (S.rng()*GROUPS.length)|0;

      // update HUD immediately
      emit('hha:score', {score:S.score, combo:S.combo, misses:S.misses});
      emit('hha:time', {left:S.timeLeft});
      emit('groups:power', {charge:S.power, threshold:S.powerThr});
      emit('hha:rank', {accuracy:0, grade:'C'});
      coach(`เริ่มเลย! จับหมู่: ${GROUPS[S.groupIdx].icon} ${GROUPS[S.groupIdx].th}`, 'happy', true);
    }

    function coach(text, mood, force){
      const t = nowMs();
      if (!force && (t - S.coachLastMs < 900)) return;
      S.coachLastMs = t;
      emit('hha:coach', {text, mood: mood||'neutral'});
    }

    function computeAccuracy(){
      const denom = Math.max(1, S.nHitGood + S.nHitWrong + S.nHitJunk);
      return Math.round((S.nHitGood / denom) * 100);
    }

    function gradeFrom(acc, miss){
      // light rule
      if (acc >= 90 && miss <= 4) return 'A';
      if (acc >= 80 && miss <= 7) return 'B';
      if (acc >= 65) return 'C';
      return 'D';
    }

    function updateRank(){
      const acc = computeAccuracy();
      const grade = gradeFrom(acc, S.misses);
      emit('hha:rank', {accuracy: acc, grade});
    }

    function end(reason){
      if (!S.running) return;
      S.running = false;

      clearTimeout(S.spawnTimer);
      clearInterval(S.tTick);

      // remove remaining targets
      S.targets.forEach(t=>{
        try{ t.el.remove(); }catch(_){}
      });
      S.targets.length = 0;

      const acc = computeAccuracy();
      const grade = gradeFrom(acc, S.misses);

      const summary = {
        gameVersion: VERSION,
        reason: reason || 'end',

        scoreFinal: S.score,
        comboMax: S.comboMax,
        misses: S.misses,
        accuracyGoodPct: acc,
        grade,

        runMode: S.runMode,
        view: S.view,
        diff: S.diff,
        style: S.style,
        durationPlayedSec: (S.timeTotal - S.timeLeft),

        nTargetSpawned: S.nSpawn,
        nHitTotal: S.nHit,
        nHitGood: S.nHitGood,
        nHitWrong: S.nHitWrong,
        nHitJunk: S.nHitJunk,
        nHitBoss: S.nHitBoss,
        nExpire: S.nExpire,

        powerThreshold: S.powerThr,
        switchesDone: S.Q.goalNow,
        stage: S.Q.stage,
      };

      coach('จบเกมแล้ว! ดูผลสรุปได้เลย ✅', (grade==='A'||grade==='B')?'happy':'neutral', true);
      emit('hha:end', summary);

      // detach shoot listener
      if (S.shootHandler){
        WIN.removeEventListener('hha:shoot', S.shootHandler);
        S.shootHandler = null;
      }
    }

    function incMiss(kind){
      S.misses++;
      S.combo = 0;
      emit('hha:score', {score:S.score, combo:S.combo, misses:S.misses});
      emit('hha:judge', {kind:'miss', missKind: kind||'miss'});
      updateRank();

      if (S.misses >= S.cfg.missLimit){
        end('missLimit');
        return;
      }

      if (S.misses >= S.cfg.missLimit - 2){
        coach('ระวัง! ใกล้พลาดครบลิมิตแล้ว ❗', 'fever');
      }
    }

    function addScore(delta){
      S.score = Math.max(0, (S.score + (delta|0))|0);
    }

    function addPower(p){
      S.power = clamp(S.power + (p|0), 0, S.powerThr);
      emit('groups:power', {charge:S.power, threshold:S.powerThr});

      if (S.power >= S.powerThr){
        // switch group
        S.power = 0;
        emit('groups:power', {charge:S.power, threshold:S.powerThr});
        S.groupIdx = (S.groupIdx + 1 + ((S.rng()*3)|0)) % GROUPS.length;
        S.Q.goalNow++;
        S.Q.push(true);

        emit('groups:progress', {kind:'perfect_switch', group: GROUPS[S.groupIdx].key});
        coach(`สลับหมู่แล้ว! ต่อไป: ${GROUPS[S.groupIdx].icon} ${GROUPS[S.groupIdx].th}`, 'happy');

        if (S.Q.stage===1 && S.Q.goalNow >= S.Q.goalTotal){
          // storm stage
          S.Q.advanceStage();
          startStorm();
        }
      }
    }

    function startStorm(){
      if (!S.running || S.stormOn) return;
      S.stormOn = true;
      S.stormLeftSec = S.cfg.stormSec;

      DOC.body.classList.add('groups-storm');
      emit('groups:progress', {kind:'storm_on', sec:S.stormLeftSec});
      coach('พายุมาแล้ว! โฟกัสให้มากขึ้น 🌪️', 'fever', true);

      // storm urgent pulse near end
      const stormTimer = setInterval(()=>{
        if (!S.running){ clearInterval(stormTimer); return; }
        S.stormLeftSec = Math.max(0, S.stormLeftSec - 1);
        emit('groups:progress', {kind:'storm_tick', sec:S.stormLeftSec});
        if (S.stormLeftSec<=3 && S.stormLeftSec>0){
          DOC.body.classList.add('groups-storm-urgent');
        }
        if (S.stormLeftSec<=0){
          clearInterval(stormTimer);
          DOC.body.classList.remove('groups-storm-urgent');
          DOC.body.classList.remove('groups-storm');
          S.stormOn = false;
          emit('groups:progress', {kind:'storm_off'});
          coach('ผ่านพายุแล้ว! เตรียมเจอบอส 🧿', 'happy', true);
          if (S.Q.stage===2){
            S.Q.advanceStage();
            spawnBoss();
          }
        }
      }, 1000);
    }

    function spawnBoss(){
      if (!S.running || S.bossOn) return;
      S.bossOn = true;
      S.bossHp = S.cfg.bossHp;

      emit('groups:progress', {kind:'boss_spawn', hp:S.bossHp});
      coach('บอสมาแล้ว! ยิงให้โดนหลาย ๆ ครั้ง 💎', 'fever', true);

      // spawn a boss target immediately
      spawnOne({forceKind:'boss'});
    }

    function safeSpawnPoint(){
      const layer = S.layerEl || DOC.body;
      const r = layer.getBoundingClientRect ? layer.getBoundingClientRect() : {left:0, top:0, width:(WIN.innerWidth||360), height:(WIN.innerHeight||640)};
      const W = r.width, H = r.height;

      // safe margins: avoid HUD top and power bottom
      const topPad = Math.max(120, H*0.18);
      const botPad = Math.max(120, H*0.18);

      // allow more room on small screens
      const leftPad = Math.max(22, W*0.06);
      const rightPad= leftPad;

      let x = lerp(r.left + leftPad, r.left + W - rightPad, S.rng());
      let y = lerp(r.top + topPad, r.top + H - botPad, S.rng());

      // if very small playable region, relax
      if ((W - leftPad - rightPad) < 140 || (H - topPad - botPad) < 180){
        x = lerp(r.left + 18, r.left + W - 18, S.rng());
        y = lerp(r.top + 92, r.top + H - 92, S.rng());
      }

      // convert to layer-local px
      x = x - r.left;
      y = y - r.top;

      return { x, y, W, H };
    }

    function decideKind(){
      // kinds: good / wrong / junk / bonus / boss
      if (S.bossOn && S.bossHp>0){
        // mix boss with normal targets (but low chance)
        if (S.rng() < 0.18) return 'boss';
      }
      const r = S.rng();
      const junk = S.cfg.junkRate;
      const wrong = S.cfg.wrongRate;
      const bonus = S.cfg.bonusRate;

      if (r < bonus) return 'bonus';
      if (r < bonus + junk) return 'junk';
      if (r < bonus + junk + wrong) return 'wrong';
      return 'good';
    }

    function spawnOne(opts){
      if (!S.running) return;
      const layer = S.layerEl || DOC.body;
      if (!layer) return;

      const kind = (opts && opts.forceKind) ? opts.forceKind : decideKind();
      const pos = safeSpawnPoint();

      // scale
      let s = 1.0;
      if (S.view==='mobile') s = 1.0;
      if (S.view==='pc') s = 0.95;
      if (S.view==='cvr') s = 1.0;

      // emoji by kind
      let emoji = '❓';
      let cls = '';
      let groupKey = '';

      if (kind === 'boss'){
        cls = 'fg-boss';
        emoji = pick(S.rng, DIAMOND.emojis);
        groupKey = 'boss';
        s = 1.08;
      } else if (kind === 'bonus'){
        // star/shield/diamond (small rate)
        const rr = S.rng();
        if (rr < 0.55){
          emoji = pick(S.rng, STAR.emojis);
          cls = 'fg-good';
          groupKey = 'star';
        } else if (rr < 0.82){
          emoji = pick(S.rng, SHIELD.emojis);
          cls = 'fg-decoy';
          groupKey = 'shield';
        } else {
          emoji = pick(S.rng, DIAMOND.emojis);
          cls = 'fg-decoy';
          groupKey = 'diamond';
        }
      } else if (kind === 'junk'){
        emoji = pick(S.rng, JUNK.emojis);
        cls = 'fg-junk';
        groupKey = 'junk';
      } else if (kind === 'wrong'){
        // wrong group emoji
        const other = GROUPS[(S.groupIdx + 1 + ((S.rng()*(GROUPS.length-1))|0)) % GROUPS.length];
        emoji = pick(S.rng, other.emojis);
        cls = 'fg-wrong';
        groupKey = other.key;
      } else {
        const g = GROUPS[S.groupIdx];
        emoji = pick(S.rng, g.emojis);
        cls = 'fg-good';
        groupKey = g.key;
      }

      const el = createTargetEl(emoji, cls);
      setTargetPos(el, pos.x, pos.y, s);

      const id = S.nextId++;
      const lifeMs = Math.round(S.cfg.lifeMs * (S.stormOn ? 0.90 : 1.0));
      const born = nowMs();

      const T = { id, el, kind, groupKey, bornMs: born, lifeMs, isBoss: (kind==='boss') };

      // click/tap for pc/mobile (cvr has pointer-events none by CSS, but still safe)
      el.addEventListener('click', (ev)=>{
        ev.preventDefault();
        hitTarget(T, 'tap');
      }, {passive:false});

      S.targets.push(T);
      layer.appendChild(el);
      S.nSpawn++;

      // life timer
      setTimeout(()=>{
        if (!S.running) return;
        // already removed?
        const idx = S.targets.findIndex(t=>t.id===id);
        if (idx<0) return;

        // expire
        S.targets.splice(idx,1);
        try{
          el.classList.add('out');
          setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 120);
        }catch(_){}

        S.nExpire++;
        if (kind==='good' || kind==='boss'){
          // expire good/boss counts as miss pressure
          incMiss('expire');
        } else {
          // expire junk/wrong is ok (no miss)
        }
      }, lifeMs);
    }

    function spawnLoop(){
      clearTimeout(S.spawnTimer);
      if (!S.running) return;

      let ms = S.cfg.spawnMs;
      if (S.stormOn) ms = Math.round(ms * S.cfg.stormSpawnMul);
      // small style variation
      if (S.style === 'focus') ms = Math.round(ms * 1.08);
      if (S.style === 'chaos') ms = Math.round(ms * 0.92);

      // light adaptive in play mode only
      if (S.runMode==='play'){
        const acc = computeAccuracy();
        if (acc >= 88 && S.misses<=3) ms = Math.round(ms * 0.93);
        if (acc <= 60 && S.misses>=6) ms = Math.round(ms * 1.08);
      }

      spawnOne();
      S.spawnTimer = setTimeout(spawnLoop, clamp(ms, 260, 1200));
    }

    function hitTarget(T, src){
      if (!S.running) return;
      // already removed?
      const idx = S.targets.findIndex(t=>t.id===T.id);
      if (idx<0) return;

      // remove immediately (prevent double hit)
      S.targets.splice(idx,1);

      try{
        T.el.classList.add('hit');
        setTimeout(()=>{ try{ T.el.remove(); }catch(_){} }, 140);
      }catch(_){}

      S.nHit++;

      if (T.isBoss){
        S.nHitBoss++;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);

        addScore(80 + Math.min(120, S.combo*4));
        emit('hha:judge', {kind:'boss', src});
        S.bossHp = Math.max(0, S.bossHp - 1);
        emit('groups:progress', {kind:'boss_hit', hp:S.bossHp});

        if (T.el && T.el.classList) T.el.classList.add('fg-boss-hurt');

        if (S.bossHp<=0){
          // boss defeated
          S.bossOn = false;
          coach('บอสแพ้แล้ว! เยี่ยมมาก 🏆', 'happy', true);
          emit('groups:progress', {kind:'boss_clear'});
          end('bossClear');
        } else if (S.bossHp<=3){
          coach('ใกล้ชนะแล้ว! อีกนิดเดียว 💥', 'fever');
        }

        emit('hha:score', {score:S.score, combo:S.combo, misses:S.misses});
        updateRank();
        return;
      }

      if (T.kind === 'junk'){
        S.nHitJunk++;
        // junk hit is a mistake
        incMiss('junk');
        addScore(-40);
        emit('hha:judge', {kind:'bad', sub:'junk', src});
        coach('อันนี้ไม่ใช่! เลี่ยงของขยะ 🍟', 'sad');
      }
      else if (T.kind === 'wrong'){
        S.nHitWrong++;
        incMiss('wrong');
        addScore(-25);
        emit('hha:judge', {kind:'bad', sub:'wrong', src});
        coach('ผิดหมู่! มองสัญลักษณ์หมู่ให้ดี 👀', 'neutral');
      }
      else if (T.kind === 'bonus'){
        // bonus types via groupKey
        if (T.groupKey==='star'){
          S.combo++;
          addScore(120);
          addPower(2);
          emit('hha:judge', {kind:'good', sub:'star', src});
          coach('⭐ ดีมาก! ได้แต้มโบนัส', 'happy');
        } else if (T.groupKey==='shield'){
          addScore(60);
          emit('hha:judge', {kind:'good', sub:'shield', src});
          coach('🛡️ โล่! ได้แต้มเพิ่ม', 'happy');
        } else {
          addScore(150);
          addPower(3);
          emit('hha:judge', {kind:'good', sub:'diamond', src});
          coach('💎 เพชร! โคตรดี', 'happy', true);
        }
        S.comboMax = Math.max(S.comboMax, S.combo);
      }
      else {
        // good
        S.nHitGood++;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);

        const base = 35;
        const bonus = Math.min(60, S.combo*2);
        addScore(base + bonus);
        addPower(1);
        emit('hha:judge', {kind:'good', sub:'group', src});
        S.Q.hitCorrect();

        // start mini sometimes
        if (!S.Q.miniActive && S.runMode==='play' && (S.rng()<0.10)){
          S.Q.startMini();
          coach('มินิเควสต์! ทำให้ถูกให้ครบก่อนหมดเวลา ⚡', 'fever', true);
        }
      }

      // if mini ended successfully
      if (!S.Q.miniActive && S.Q.miniOkHits>=S.Q.miniOkNeeded){
        addScore(120);
        coach('ผ่านมินิเควสต์! +แต้ม 🎉', 'happy', true);
      }

      emit('hha:score', {score:S.score, combo:S.combo, misses:S.misses});
      updateRank();
    }

    // cVR shooting: aim assist to nearest target around screen center
    function shootFromCrosshair(){
      if (!S.running) return;

      // prefer detail lockPx from vr-ui config if present
      const lockPx = Number((WIN.HHA_VRUI_CONFIG && WIN.HHA_VRUI_CONFIG.lockPx) || 92) || 92;

      const vp = getViewport();
      const cx = vp.w * 0.5;
      const cy = vp.h * 0.5;

      // layer rect
      const layer = S.layerEl || DOC.body;
      const r = layer.getBoundingClientRect ? layer.getBoundingClientRect() : {left:0, top:0};

      let best = null;
      let bestD2 = Infinity;

      for (const T of S.targets){
        const el = T.el;
        if (!el) continue;

        // approximate center from CSS vars (px within layer)
        const x = parseFloat(el.style.getPropertyValue('--x') || '0') + r.left;
        const y = parseFloat(el.style.getPropertyValue('--y') || '0') + r.top;

        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2){
          bestD2 = d2;
          best = T;
        }
      }

      if (best && bestD2 <= lockPx*lockPx){
        hitTarget(best, 'shoot');
      } else {
        // miss click (optional): do not always punish; but in cVR give tiny feedback
        emit('hha:judge', {kind:'miss', missKind:'shoot'});
      }
    }

    function start(diff, opts){
      opts = opts || {};
      S.diff = String(diff||opts.diff||'normal');
      S.runMode = String(opts.runMode || 'play').toLowerCase()==='research' ? 'research' : 'play';
      S.style = String(opts.style || 'mix');
      S.timeTotal = clamp(opts.time ?? 90, 15, 180);
      S.timeLeft = S.timeTotal;

      S.seed = String(opts.seed ?? qs('seed', '') ?? '');
      const seedN = hashSeed(S.seed || (Date.now()+''));
      S.rng = mulberry32(seedN);

      S.cfg = diffPreset(S.diff);
      S.powerThr = S.cfg.powerThr;

      // research => no adaptive (still deterministic)
      if (S.runMode === 'research'){
        // keep as-is: we already avoid adaptive adjustments in spawnLoop for research
      }

      // view from query (if engine called without)
      S.view = String(opts.view || qs('view','mobile') || 'mobile').toLowerCase();

      // ensure layer exists
      if (!S.layerEl){
        S.layerEl = DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
      }

      resetForStart();
      emit('hha:start', {game:'GroupsVR', version:VERSION, runMode:S.runMode, diff:S.diff, view:S.view, seed:S.seed});

      // time tick
      clearInterval(S.tTick);
      S.tTick = setInterval(()=>{
        if (!S.running) return;
        S.timeLeft = Math.max(0, S.timeLeft - 1);
        emit('hha:time', {left:S.timeLeft});

        // quest mini tick
        if (S.Q && S.Q.miniActive) S.Q.tickMini();

        // mild “storm spawn boss later” safety: if time low and boss not started, force boss
        if (S.timeLeft === Math.max(8, Math.round(S.timeTotal*0.25)) && !S.stormOn && !S.bossOn && S.Q.stage===1){
          // if player too slow, push storm anyway
          S.Q.goalNow = Math.max(S.Q.goalNow, 1);
          S.Q.push(true);
        }

        if (S.timeLeft<=0){
          end('time');
        }
      }, 1000);

      // spawn loop
      spawnLoop();

      // cVR shoot listener (always attach; harmless in pc/mobile)
      if (S.shootHandler){
        WIN.removeEventListener('hha:shoot', S.shootHandler);
      }
      S.shootHandler = function(){
        if (String(S.view) !== 'cvr') return;
        shootFromCrosshair();
      };
      WIN.addEventListener('hha:shoot', S.shootHandler);

      // initial “mode” coach
      if (S.runMode==='research'){
        coach('โหมดวิจัย: seed คงที่ + ปิด adaptive ✅', 'neutral', true);
      }
    }

    function stop(){
      end('stop');
    }

    return { setLayerEl, start, stop };
  }

  // expose
  NS.GameEngine = NS.GameEngine || Engine();

})();