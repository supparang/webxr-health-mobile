/* === /herohealth/vr-groups/GameEngine.js ===
GroupsVR — PRODUCTION Engine (Patch 25–27)
- Seeded pattern spawns (deterministic in research)
- Boss super move (trick once per boss)
- Research logging payload richer (counts + rt)
Emits:
  hha:score, hha:time, hha:rank, hha:judge, hha:coach, hha:end
  groups:power, groups:progress
Listens:
  hha:shoot (for view-cvr)
  hha:vr {state:'reset'} (recenter)
*/
(function(root){
  'use strict';
  root.GroupsVR = root.GroupsVR || {};

  const DOC = root.document;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return Date.now(); }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, {detail})); }catch{}
  }

  // ---------- Data: groups + emojis ----------
  const FOOD_GROUPS = [
    { key:'veg',  name:'🥦 ผัก',    good:['🥦','🥬','🥒','🥕','🍅','🫑'] },
    { key:'fruit',name:'🍎 ผลไม้',  good:['🍎','🍌','🍇','🍉','🍍','🍓'] },
    { key:'grain',name:'🍞 ธัญพืช', good:['🍞','🥐','🥖','🍚','🍜','🥔'] },
    { key:'prot', name:'🍗 โปรตีน', good:['🍗','🥚','🐟','🫘','🥜','🍤'] },
    { key:'dairy',name:'🥛 นม',     good:['🥛','🧀','🍦','🥣','🍼','🧈'] }
  ];
  const JUNK = ['🍟','🥤','🍩','🍔','🍕','🍪'];

  function pick(rng, arr){ return arr[(arr.length*rng())|0]; }

  // ---------- Aim-assist for cVR ----------
  function aimPickTarget(layerEl, lockPx){
    const els = Array.from(layerEl.querySelectorAll('.fg-target'));
    if (!els.length) return null;

    const cx = innerWidth/2, cy = innerHeight/2;
    let best = null, bestD = 1e18;

    for (const el of els){
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width/2;
      const ey = r.top  + r.height/2;
      const dx = ex - cx, dy = ey - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD){ bestD = d2; best = el; }
    }
    if (!best) return null;

    const d = Math.sqrt(bestD);
    if (d > lockPx) return null;
    return best;
  }

  // ---------- Engine ----------
  function makeEngine(){
    const E = {};
    let layerEl = null;

    // runtime
    let running = false;
    let tStart = 0;
    let tLeft = 90;
    let tickTmr = 0;
    let spawnTmr = 0;

    // mode
    let runMode = 'play';
    let diff = 'normal';
    let style = 'mix';
    let seed = 'seed';
    let view = 'mobile';

    // RNG & patterns
    let rng = Math.random;
    let patternGen = null;

    // quest + power
    let Q = null;
    let groupIndex = 0;
    let power = 0;
    let powerThr = 8;

    // pacing
    let spawnMs = 850;
    let ttlMs = 1400;

    // storm/boss
    let stormOn = false;
    let stormEndsAt = 0;
    let bossOn = false;
    let bossHp = 0;
    let bossHpMax = 0;
    let bossTrickUsed = false;
    let bossInvulnUntil = 0;

    // score
    let score = 0;
    let combo = 0;
    let misses = 0;

    // metrics
    const M = {
      nTargetGoodSpawned:0,
      nTargetWrongSpawned:0,
      nTargetJunkSpawned:0,
      nTargetDecoySpawned:0,
      nTargetBossSpawned:0,

      nHitGood:0,
      nHitWrong:0,
      nHitJunk:0,
      nHitBoss:0,

      nExpireGood:0,
      nExpireWrong:0,
      nExpireJunk:0,
      nExpireDecoy:0,
      nExpireBoss:0,

      rtGood:[], // ms
      rtBoss:[],

      perfectSwitches:0
    };

    // active targets
    const active = new Map(); // id -> {el,type,goodKey,spawnAt,ttlAt}

    function setLayerEl(el){ layerEl = el; }

    function resetAll(){
      running = false;
      clearTimeout(tickTmr);
      clearTimeout(spawnTmr);
      tickTmr = 0;
      spawnTmr = 0;

      active.clear();
      if (layerEl) layerEl.innerHTML = '';

      score=0; combo=0; misses=0;
      groupIndex = 0;
      power=0; powerThr = (diff==='easy'?7:(diff==='hard'?9:8));

      stormOn=false; bossOn=false;
      bossHp=0; bossHpMax=0; bossTrickUsed=false; bossInvulnUntil=0;

      for (const k in M){
        if (Array.isArray(M[k])) M[k]=[];
        else M[k]=0;
      }
    }

    function setCoach(text, mood){
      emit('hha:coach', { text:String(text||''), mood:String(mood||'neutral') });
    }
    function setScoreHUD(){
      emit('hha:score', { score, combo, misses });
    }
    function setTimeHUD(){
      emit('hha:time', { left:tLeft|0 });
    }

    function gradeFrom(acc, miss, scoreFinal){
      // SSS, SS, S, A, B, C
      if (acc>=96 && miss<=2 && scoreFinal>=2200) return 'SSS';
      if (acc>=93 && miss<=3 && scoreFinal>=1800) return 'SS';
      if (acc>=90 && miss<=4) return 'S';
      if (acc>=85) return 'A';
      if (acc>=78) return 'B';
      return 'C';
    }

    function updateRank(){
      const hits = M.nHitGood + M.nHitWrong + M.nHitJunk + M.nHitBoss;
      const acc = hits ? Math.round((M.nHitGood + M.nHitBoss) / hits * 100) : 0;
      const grade = gradeFrom(acc, misses, score);
      emit('hha:rank', { accuracy: acc, grade });
    }

    function setPowerHUD(){
      emit('groups:power', { charge:power, threshold:powerThr });
    }

    function curGroup(){
      return FOOD_GROUPS[groupIndex % FOOD_GROUPS.length];
    }

    function doPerfectSwitch(){
      // reward: score + combo boost
      M.perfectSwitches++;
      emit('groups:progress', { kind:'perfect_switch', total:M.perfectSwitches });
      if (Q && Q.onPerfectSwitch) Q.onPerfectSwitch();
      score += 180;
      combo += 2;
      setCoach('สลับหมู่สำเร็จ! +BONUS 🎉', 'happy');
      setScoreHUD(); updateRank();
    }

    function switchGroup(){
      groupIndex = (groupIndex + 1) % FOOD_GROUPS.length;
      power = 0;
      setPowerHUD();
      const g = curGroup();
      setCoach(`สลับเป็นหมู่: ${g.name}`, 'neutral');
    }

    function applyDifficultyBase(){
      // deterministic base by diff/runMode
      if (diff==='easy'){ spawnMs=920; ttlMs=1500; }
      else if (diff==='hard'){ spawnMs=760; ttlMs=1250; }
      else { spawnMs=840; ttlMs=1400; }

      if (stormOn){
        spawnMs = Math.max(520, spawnMs - 220);
        ttlMs   = Math.max(900, ttlMs  - 180);
      }
      if (bossOn){
        spawnMs = Math.max(560, spawnMs - 120);
      }
    }

    function adaptiveNudge(){
      // PLAY ONLY: simple fair adaptive
      if (runMode !== 'play') return;
      const hits = M.nHitGood + M.nHitWrong + M.nHitJunk + M.nHitBoss;
      const acc = hits ? (M.nHitGood + M.nHitBoss)/hits : 0.8;
      // if struggling -> slow down a bit
      if (acc < 0.72 || misses >= 8){
        spawnMs = clamp(spawnMs + 30, 620, 980);
        ttlMs   = clamp(ttlMs + 20, 980, 1700);
      }
      // if strong -> faster
      if (acc > 0.90 && combo >= 6){
        spawnMs = clamp(spawnMs - 25, 520, 980);
        ttlMs   = clamp(ttlMs - 18, 900, 1700);
      }
    }

    function safePatternMode(){
      // research: fixed mode based on style to keep deterministic
      if (style==='feel') return 'feel';
      if (style==='hard') return 'hard';
      if (style==='mix')  return 'mix';
      return 'mix';
    }

    function startStorm(){
      stormOn = true;
      stormEndsAt = now() + 12000;
      DOC.body.classList.add('groups-storm');
      emit('groups:progress', {kind:'storm_on'});
      setCoach('STORM! เป้าออกถี่ขึ้น ⚡', 'fever');
    }
    function endStorm(){
      stormOn = false;
      DOC.body.classList.remove('groups-storm','groups-storm-urgent');
      emit('groups:progress', {kind:'storm_off'});
      setCoach('พายุสงบแล้ว 😮‍💨', 'neutral');
    }

    function spawnBoss(){
      bossOn = true;
      bossTrickUsed = false;
      bossHpMax = (diff==='easy'?6:(diff==='hard'?10:8));
      bossHp = bossHpMax;
      emit('groups:progress', {kind:'boss_spawn', hp:bossHpMax});
      setCoach('BOSS มาแล้ว! ยิงให้ครบ 💥', 'fever');
      // spawn boss target
      createTarget('boss');
    }

    function maybeBossTrick(){
      if (!bossOn) return;
      if (bossTrickUsed) return;
      if (bossHp > Math.ceil(bossHpMax*0.55)) return; // trigger after some damage
      bossTrickUsed = true;

      bossInvulnUntil = now() + 1200; // invuln window
      emit('groups:progress', {kind:'boss_trick'});
      setCoach('BOSS หลอก! อย่ายิงมั่ว 😵‍💫', 'sad');

      // spawn 3 decoys burst
      for (let i=0;i<3;i++){
        createTarget('decoy', { decoyHard:true });
      }
      // visual urgent pulse
      DOC.body.classList.add('groups-storm-urgent');
      setTimeout(()=> DOC.body.classList.remove('groups-storm-urgent'), 900);
    }

    function posForNew(){
      const p = patternGen ? patternGen.next(safePatternMode()) : {x:50,y:50};
      return p;
    }

    function createEl(id, type, emoji){
      const el = DOC.createElement('div');
      el.className = 'fg-target spawn';
      el.dataset.id = id;
      el.dataset.type = type;
      el.setAttribute('data-emoji', emoji);

      if (type==='good') el.classList.add('fg-good');
      else if (type==='wrong') el.classList.add('fg-wrong');
      else if (type==='junk') el.classList.add('fg-junk');
      else if (type==='decoy') el.classList.add('fg-decoy');
      else if (type==='boss') el.classList.add('fg-boss');

      // scale by diff
      const s = (diff==='easy'?1.05:(diff==='hard'?0.92:1.0));
      el.style.setProperty('--s', String(s));

      const p = posForNew();
      el.style.setProperty('--x', p.x.toFixed(2)+'%');
      el.style.setProperty('--y', p.y.toFixed(2)+'%');

      return el;
    }

    function createTarget(type, extra){
      if (!layerEl) return null;
      const id = 't' + Math.random().toString(16).slice(2) + now().toString(16);

      const g = curGroup();
      let emoji = '⭐';

      if (type==='good'){
        emoji = pick(rng, g.good);
        M.nTargetGoodSpawned++;
      }else if (type==='wrong'){
        const other = pick(rng, FOOD_GROUPS.filter(x=>x.key!==g.key));
        emoji = pick(rng, other.good);
        M.nTargetWrongSpawned++;
      }else if (type==='junk'){
        emoji = pick(rng, JUNK);
        M.nTargetJunkSpawned++;
      }else if (type==='decoy'){
        emoji = pick(rng, ['⭐','💎','🌀','⚡']);
        M.nTargetDecoySpawned++;
      }else if (type==='boss'){
        emoji = pick(rng, ['👿','🧠','🦾','🦹‍♂️']);
        M.nTargetBossSpawned++;
      }

      const el = createEl(id, type, emoji);

      // tap hit for pc/mobile/vr
      el.addEventListener('click', ()=>{
        if (!running) return;
        onHitEl(el, 'tap');
      });

      const spawnAt = now();
      const ttlAt = spawnAt + ttlMs;

      active.set(id, {el, type, spawnAt, ttlAt});
      layerEl.appendChild(el);

      // expire
      setTimeout(()=>{
        const a = active.get(id);
        if (!a) return;
        // expire
        active.delete(id);
        try{ a.el.classList.add('out'); }catch{}
        try{ a.el.remove(); }catch{}
        onExpire(type);
      }, ttlMs + 40);

      return el;
    }

    function onExpire(type){
      combo = Math.max(0, combo-1);
      misses++;
      setScoreHUD(); updateRank();

      if (type==='good') M.nExpireGood++;
      else if (type==='wrong') M.nExpireWrong++;
      else if (type==='junk') M.nExpireJunk++;
      else if (type==='decoy') M.nExpireDecoy++;
      else if (type==='boss') M.nExpireBoss++;

      emit('hha:judge', {kind:'miss', text:'MISS'});
      if (Q) Q.tick && Q.tick();
    }

    function judge(kind, text){
      emit('hha:judge', {kind:String(kind), text:String(text||'')});
    }

    function onHit(type, rt){
      if (type==='good'){
        M.nHitGood++;
        if (rt!=null) M.rtGood.push(rt);
      }else if (type==='wrong'){
        M.nHitWrong++;
      }else if (type==='junk'){
        M.nHitJunk++;
      }else if (type==='boss'){
        M.nHitBoss++;
        if (rt!=null) M.rtBoss.push(rt);
      }
    }

    function onHitEl(el, via){
      const id = el.dataset.id;
      const a = active.get(id);
      if (!a) return;

      const type = a.type;
      const rt = now() - a.spawnAt;

      // remove quickly
      active.delete(id);
      el.classList.remove('spawn');
      el.classList.add('hit');
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 120);

      // invuln boss trick
      if (type==='boss' && now() < bossInvulnUntil){
        judge('bad','INVULN');
        combo = Math.max(0, combo-1);
        misses++;
        setScoreHUD(); updateRank();
        if (Q && Q.onWrongHit) Q.onWrongHit();
        return;
      }

      if (type==='good'){
        onHit('good', rt);
        score += 120 + combo*6;
        combo++;
        power++;
        if (Q && Q.onCorrectHit) Q.onCorrectHit();
        judge('good','GOOD');
        setCoach('ดีมาก! 🎯', (combo>=8?'happy':'neutral'));

        if (power >= powerThr){
          // perfect switch if mini flags allow (pressure)
          if (combo >= 4) doPerfectSwitch();
          switchGroup();
        }
        setPowerHUD();
      }
      else if (type==='wrong'){
        onHit('wrong', rt);
        score = Math.max(0, score-40);
        combo = Math.max(0, combo-2);
        misses++;
        if (Q && Q.onWrongHit) Q.onWrongHit();
        judge('bad','WRONG');
        setCoach('ผิดหมู่! ระวัง 😅','sad');
      }
      else if (type==='junk'){
        onHit('junk', rt);
        score = Math.max(0, score-70);
        combo = 0;
        misses++;
        if (Q && Q.onJunkHit) Q.onJunkHit();
        judge('bad','JUNK');
        setCoach('โดนขยะ! 😖','sad');
      }
      else if (type==='decoy'){
        onHit('wrong', rt);
        // decoy punishes more when boss trick
        const hard = el.dataset.decoyHard === '1';
        score = Math.max(0, score-(hard?85:50));
        combo = Math.max(0, combo-3);
        misses++;
        if (Q && Q.onWrongHit) Q.onWrongHit();
        judge('bad','DECOY');
        setCoach('โดนหลอก! 😵','sad');
      }
      else if (type==='boss'){
        onHit('boss', rt);
        bossHp = Math.max(0, bossHp-1);
        if (Q && Q.onBossHit) Q.onBossHit();
        judge('boss','BOSS');
        score += 160 + combo*7;
        combo++;
        setCoach(`โดนแล้ว! เหลือ ${bossHp}/${bossHpMax} 💥`, 'fever');

        // boss hurt fx
        try{ DOC.body.classList.add('boss-hurt'); setTimeout(()=>DOC.body.classList.remove('boss-hurt'), 150);}catch{}

        maybeBossTrick();

        if (bossHp<=0){
          bossOn = false;
          emit('groups:progress', {kind:'boss_down'});
          score += 350;
          setCoach('โค่น BOSS สำเร็จ!! 🏆','happy');
          // end storm after boss
          endStorm();
        }else{
          // spawn another boss target periodically to keep pressure
          if (bossHp % 2 === 0) createTarget('boss');
        }
      }

      setScoreHUD();
      updateRank();
    }

    // cVR shooting
    function onShoot(ev){
      if (!running) return;
      if (!layerEl) return;

      const d = ev && ev.detail ? ev.detail : {};
      const gLock = root.HHA_VRUI_CONFIG && root.HHA_VRUI_CONFIG.lockPx;
      const lockPx = clamp(Number(d.lockPx ?? gLock ?? 92), 40, 160);

      const el = aimPickTarget(layerEl, lockPx);
      if (el) onHitEl(el, 'shoot');
    }

    // recenter (for cardboard help)
    function onVR(ev){
      const d = ev && ev.detail ? ev.detail : {};
      if (String(d.state||'') !== 'reset') return;
      DOC.body.style.setProperty('--vx','0px');
      DOC.body.style.setProperty('--vy','0px');
      setCoach('RECENTER ✅', 'happy');
    }

    function spawnLogic(){
      if (!running) return;

      // urgent class
      if (stormOn){
        const left = stormEndsAt - now();
        DOC.body.classList.toggle('groups-storm-urgent', left <= 3000);
        if (left <= 0){
          // storm ends -> spawn boss once
          if (!bossOn){
            spawnBoss();
          }else{
            endStorm();
          }
        }
      }

      applyDifficultyBase();
      adaptiveNudge();

      // type weights
      const baseGood = 0.58;
      const baseWrong= 0.18;
      const baseJunk = 0.16;
      const baseDecoy= 0.08;

      let r = rng();
      let type = 'good';

      // storm increases junk/decoy
      let goodW=baseGood, wrongW=baseWrong, junkW=baseJunk, decoyW=baseDecoy;
      if (stormOn){ goodW-=0.07; junkW+=0.05; decoyW+=0.02; }
      if (bossOn){ goodW-=0.10; wrongW-=0.03; decoyW+=0.06; }

      const sum = goodW+wrongW+junkW+decoyW;
      goodW/=sum; wrongW/=sum; junkW/=sum; decoyW/=sum;

      if (bossOn && rng()<0.22){
        type = 'boss';
      }else if (r < goodW) type='good';
      else if (r < goodW+wrongW) type='wrong';
      else if (r < goodW+wrongW+junkW) type='junk';
      else type='decoy';

      const el = createTarget(type);
      if (el && type==='decoy' && bossTrickUsed) el.dataset.decoyHard = '1';

      spawnTmr = setTimeout(spawnLogic, spawnMs);
    }

    function tick(){
      if (!running) return;

      tLeft = Math.max(0, tLeft - 1);
      setTimeHUD();

      if (Q && Q.tick) Q.tick();

      // schedule storms in play
      if (runMode==='play'){
        // every ~22s start storm if not active
        const played = Math.round((now()-tStart)/1000);
        if (!stormOn && !bossOn && played>0 && played % 22 === 0){
          startStorm();
        }
      }else{
        // research: deterministic storms at fixed times by diff
        const total = Number(qs('time',90) || 90);
        const played = Math.round((now()-tStart)/1000);
        const marks = (diff==='easy') ? [20, 48] : (diff==='hard') ? [16, 38, 62] : [18, 44, 70];
        if (!stormOn && !bossOn && marks.includes(played) && played < total-10){
          startStorm();
        }
      }

      if (tLeft <= 0){
        stop('timeup');
        return;
      }

      tickTmr = setTimeout(tick, 1000);
    }

    function stop(reason){
      if (!running) return;
      running = false;

      clearTimeout(tickTmr);
      clearTimeout(spawnTmr);

      // compute metrics
      const hits = M.nHitGood + M.nHitWrong + M.nHitJunk + M.nHitBoss;
      const accGood = hits ? Math.round((M.nHitGood + M.nHitBoss) / hits * 100) : 0;

      const avg = (arr)=> arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
      const median = (arr)=>{
        if (!arr.length) return 0;
        const s = arr.slice().sort((a,b)=>a-b);
        const mid = (s.length/2)|0;
        return (s.length%2)? s[mid] : Math.round((s[mid-1]+s[mid])/2);
      };

      const rtAvg = avg(M.rtGood);
      const rtMed = median(M.rtGood);

      const grade = gradeFrom(accGood, misses, score);

      // quest state
      const qsState = Q && Q.getState ? Q.getState() : {goalsCleared:0,goalsTotal:0,miniCleared:0,miniTotal:0,perfectSwitches:0};

      emit('hha:end', {
        reason: String(reason||'end'),
        scoreFinal: score|0,
        comboMax: 0, // (ถ้าต้องการเพิ่ม tracking เพิ่มได้)
        misses: misses|0,

        goalsCleared: qsState.goalsCleared|0,
        goalsTotal: qsState.goalsTotal|0,
        miniCleared: qsState.miniCleared|0,
        miniTotal: qsState.miniTotal|0,
        perfectSwitches: qsState.perfectSwitches|0,

        // spawns
        nTargetGoodSpawned: M.nTargetGoodSpawned|0,
        nTargetWrongSpawned: M.nTargetWrongSpawned|0,
        nTargetJunkSpawned: M.nTargetJunkSpawned|0,
        nTargetDecoySpawned: M.nTargetDecoySpawned|0,
        nTargetBossSpawned: M.nTargetBossSpawned|0,

        // hits
        nHitGood: M.nHitGood|0,
        nHitWrong: M.nHitWrong|0,
        nHitJunk: M.nHitJunk|0,
        nHitBoss: M.nHitBoss|0,

        // expires
        nExpireGood: M.nExpireGood|0,
        nExpireWrong: M.nExpireWrong|0,
        nExpireJunk: M.nExpireJunk|0,
        nExpireDecoy: M.nExpireDecoy|0,
        nExpireBoss: M.nExpireBoss|0,

        accuracyGoodPct: accGood|0,
        avgRtGoodMs: rtAvg|0,
        medianRtGoodMs: rtMed|0,

        grade
      });
    }

    function start(diffIn, opts){
      opts = opts || {};
      diff = String(diffIn || 'normal').toLowerCase();
      runMode = String(opts.runMode || 'play').toLowerCase();
      style = String(opts.style || 'mix').toLowerCase();
      seed = String(opts.seed || 'seed');
      view = String(qs('view','mobile')||'mobile').toLowerCase();

      // seeded RNG
      const gen = root.GroupsVR && root.GroupsVR.Patterns && root.GroupsVR.Patterns.makePatternGen;
      if (gen){
        // create base rng via patterns module
        patternGen = gen({ seed, mode: style, safe:{
          left: 10, right: 10,
          top:  20, bottom: 14
        }});
        rng = patternGen.rng || Math.random;
      }else{
        rng = Math.random;
        patternGen = null;
      }

      resetAll();
      tLeft = clamp(Number(opts.time || 90), 30, 180);
      tStart = now();
      running = true;

      // quest
      const QF = root.GroupsVR && root.GroupsVR.Quests && root.GroupsVR.Quests.makeQuestDirector;
      Q = QF ? QF({ diff, runMode }) : null;

      // start
      setCoach(`เริ่มเกม! ยิงหมู่: ${curGroup().name}`, 'happy');
      setScoreHUD(); setTimeHUD(); setPowerHUD(); updateRank();

      root.addEventListener('hha:shoot', onShoot, {passive:true});
      root.addEventListener('hha:vr', onVR, {passive:true});

      // spawn loop + tick loop
      spawnLogic();
      tickTmr = setTimeout(tick, 1000);
    }

    E.setLayerEl = setLayerEl;
    E.start = start;
    E.stop = stop;

    return E;
  }

  root.GroupsVR.GameEngine = makeEngine();

})(typeof window!=='undefined'?window:globalThis);