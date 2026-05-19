/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle-v2-core.js
 * GoodJunk Battle v2 Core
 * VERSION: v2.4.20-core-final
 *
 * ใช้ร่วมกันใน:
 * - goodjunk-battle-v2-run-mobile.html
 * - goodjunk-battle-v2-run-pc.html
 * - goodjunk-battle-v2-run-cardboard.html
 *
 * รวม:
 * - 4 Skills UI: Junk Storm / Shield / Freeze / Heal
 * - Mobile Action Dock
 * - Skill Logic + Balance + Anti-spam
 * - Freeze/Storm Gameplay Bridge
 * - Opponent Combat Feedback
 * - Match State Sync Hardening
 * - Final QA Guard
 * ========================================================= */

(function GoodJunkBattleV2Core(){
  'use strict';

  const CORE_VERSION = 'v2.4.20-core-final';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const url = new URL(location.href);
  const params = url.searchParams;

  const VIEW = String(params.get('view') || 'pc').toLowerCase();
  const IS_MOBILE = VIEW === 'mobile' || (
    VIEW !== 'pc' &&
    window.matchMedia &&
    window.matchMedia('(max-width:760px)').matches
  );
  const IS_CARDBOARD = ['cardboard','cvr','vr'].includes(VIEW);

  const PLAYER_ID = String(
    window.GJ_PLAYER_ID ||
    window.MY_PLAYER_ID ||
    window.playerId ||
    params.get('pid') ||
    'anon'
  );

  const PLAYER_NAME = String(
    window.GJ_PLAYER_NAME ||
    window.MY_PLAYER_NAME ||
    window.playerName ||
    params.get('name') ||
    'Hero'
  );

  const ROOM_CODE = String(
    window.GJ_ROOM_CODE ||
    window.ROOM_CODE ||
    window.roomCode ||
    params.get('room') ||
    params.get('roomCode') ||
    params.get('code') ||
    ''
  );

  const CFG = {
    maxPower: 5,
    maxHearts: 3,

    stormCost: 1,
    shieldCost: 1,
    freezeCost: 2,
    healCost: 2,

    stormCooldownMs: 9000,
    shieldCooldownMs: 14000,
    freezeCooldownMs: 16000,
    healCooldownMs: 18000,

    stormDurationMs: 6500,
    shieldDurationMs: 7000,
    freezeDurationMs: 5200,

    stormJunkCount: 5,

    globalSkillGapMs: 2200,
    maxSkillPer10Sec: 3,
    maxStormPer30Sec: 2,
    maxFreezePer30Sec: 1,
    maxHealPer45Sec: 2,
    maxShieldPer30Sec: 2,

    heartbeatMs: 3500,
    offlineAfterMs: 12000,
    staleEffectAfterMs: 30000,
    rematchReadyExpireMs: 45000
  };

  const SKILLS = [
    {
      id: 'btnJunkStorm',
      key: 'junk-storm',
      icon: '⚡',
      label: 'Junk Storm',
      hint: 'โจมตีคู่แข่ง',
      cost: CFG.stormCost
    },
    {
      id: 'btnShield',
      key: 'shield',
      icon: '🛡️',
      label: 'Shield',
      hint: 'ป้องกัน',
      cost: CFG.shieldCost
    },
    {
      id: 'btnFreeze',
      key: 'freeze',
      icon: '❄️',
      label: 'Freeze',
      hint: 'ทำให้คู่แข่งช้าลง',
      cost: CFG.freezeCost
    },
    {
      id: 'btnHeal',
      key: 'heal',
      icon: '💚',
      label: 'Heal',
      hint: 'ฟื้นหัวใจ/ล้างสถานะ',
      cost: CFG.healCost
    }
  ];

  const junkIcons = ['🍩','🍟','🍔','🥤','🍰','🍭','🍬','🧁'];

  const state = {
    phase: 'play',
    matchId: '',
    score: 0,
    good: 0,
    junk: 0,
    miss: 0,
    hearts: CFG.maxHearts,
    maxHearts: CFG.maxHearts,
    power: 0,
    maxPower: CFG.maxPower,

    shieldUntil: 0,
    freezeUntil: 0,
    stormUntil: 0,

    cooldowns: {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    },

    locks: {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    },

    skillLog: [],
    appliedEffects: Object.create(null),
    feed: [],
    heartbeatTimer: null,
    roomListenerAttached: false,
    opponentLeftHandled: false,
    qaOpen: false
  };

  function now(){
    return Date.now();
  }

  function clamp(n, a, b){
    n = Number(n);
    if (!Number.isFinite(n)) n = a;
    return Math.max(a, Math.min(b, n));
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function emit(name, detail){
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function toast(msg){
    if (typeof window.showToast === 'function'){
      window.showToast(msg);
      return;
    }

    let el = $('#gjBattleSkillToast');
    if (!el){
      el = document.createElement('div');
      el.id = 'gjBattleSkillToast';
      el.className = 'gj-battle-skill-toast';
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1500);
  }

  function getArena(){
    return (
      $('#arena') ||
      $('.arena') ||
      $('.battle-arena') ||
      $('.game-arena') ||
      $('#gameArea') ||
      $('.game-area')
    );
  }

  function getDb(){
    return (
      window.GJ_DB ||
      window.db ||
      window.firebaseDb ||
      window.database ||
      null
    );
  }

  function getRoomRef(){
    if (window.GJ_ROOM_REF) return window.GJ_ROOM_REF;
    if (window.roomRef) return window.roomRef;
    if (window.ROOM_REF) return window.ROOM_REF;

    const db = getDb();
    if (db && ROOM_CODE && typeof db.ref === 'function'){
      return db.ref('goodjunk_battle_rooms/' + ROOM_CODE);
    }

    return null;
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function playerOnline(p){
    if (!p) return false;

    if (
      p.left === true ||
      p.quit === true ||
      p.disconnected === true ||
      p.status === 'left' ||
      p.status === 'offline'
    ){
      return false;
    }

    const lastSeen = Number(p.lastSeen || p.heartbeatAt || p.updatedAt || p.ts || 0);
    if (lastSeen && now() - lastSeen > CFG.offlineAfterMs) return false;

    return true;
  }

  function updateGlobalState(){
    const t = now();

    window.GJ_BATTLE_STATE = Object.assign({}, window.GJ_BATTLE_STATE || {}, {
      score: state.score,
      myScore: state.score,
      good: state.good,
      junk: state.junk,
      miss: state.miss,

      hearts: state.hearts,
      hp: state.hearts,
      maxHearts: state.maxHearts,
      maxHp: state.maxHearts,

      power: state.power,
      attackPower: state.power,
      maxPower: state.maxPower,

      shieldActive: t < state.shieldUntil,
      freezeActive: t < state.freezeUntil,
      stormActive: t < state.stormUntil,

      stormCooldown: Math.ceil(Math.max(0, state.cooldowns['junk-storm'] - t) / 1000),
      shieldCooldown: Math.ceil(Math.max(0, state.cooldowns.shield - t) / 1000),
      freezeCooldown: Math.ceil(Math.max(0, state.cooldowns.freeze - t) / 1000),
      healCooldown: Math.ceil(Math.max(0, state.cooldowns.heal - t) / 1000)
    });

    emit('gj:battle-state-updated', window.GJ_BATTLE_STATE);
  }

  function addPower(amount){
    state.power = clamp(state.power + Number(amount || 1), 0, state.maxPower);
    syncHud();
    updateGlobalState();
  }

  function spendPower(amount){
    state.power = clamp(state.power - Number(amount || 1), 0, state.maxPower);
    syncHud();
    updateGlobalState();
  }

  function damage(amount){
    if (isShieldActive()){
      toast('🛡️ Shield กันความเสียหาย!');
      addFeed('🛡️ Shield กันความเสียหายได้', 'shield');
      return;
    }

    state.hearts = clamp(state.hearts - Number(amount || 1), 0, state.maxHearts);
    state.miss += 1;

    if (state.power > 0) state.power -= 1;

    syncHud();
    updateGlobalState();

    if (state.hearts <= 0){
      endBattle('lose', 'heart-zero');
    }
  }

  function heal(){
    state.hearts = clamp(state.hearts + 1, 0, state.maxHearts);
    state.freezeUntil = 0;
    state.stormUntil = 0;
    syncHud();
    updateGlobalState();
  }

  function isShieldActive(){
    return now() < state.shieldUntil;
  }

  function isFreezeActive(){
    return now() < state.freezeUntil;
  }

  function isStormActive(){
    return now() < state.stormUntil;
  }

  function ensureActionsBar(){
    let bar =
      $('#battleActions') ||
      $('.battle-actions') ||
      $('.action-bar') ||
      $('.power-actions') ||
      $('.skill-bar');

    if (!bar){
      bar = document.createElement('div');
      bar.id = 'battleActions';
      bar.className = 'battle-actions action-bar gj-battle-actions-v4';

      const arena = getArena();
      if (arena && arena.parentNode){
        arena.parentNode.insertBefore(bar, arena.nextSibling);
      }else{
        document.body.appendChild(bar);
      }
    }

    bar.classList.add('gj-battle-actions-v4');
    return bar;
  }

  function skillHTML(skill){
    return `
      <span class="gj-skill-icon">${skill.icon}</span>
      <span class="gj-skill-main">${skill.label}</span>
      <span class="gj-skill-sub">${skill.hint}</span>
      <span class="gj-skill-cost">ใช้พลัง ${skill.cost}</span>
    `;
  }

  function ensureSkillButtons(){
    const bar = ensureActionsBar();

    SKILLS.forEach(skill => {
      let btn =
        $('#' + skill.id) ||
        $('[data-skill="' + skill.key + '"]') ||
        $('[data-action="' + skill.key + '"]');

      if (!btn){
        btn = document.createElement('button');
        btn.id = skill.id;
        btn.type = 'button';
        btn.className = 'gj-skill-btn gj-skill-' + skill.key;
        btn.dataset.skill = skill.key;
        btn.dataset.action = skill.key;
        btn.innerHTML = skillHTML(skill);
        bar.appendChild(btn);
      }

      btn.classList.add('gj-skill-btn', 'gj-skill-' + skill.key);
      btn.dataset.skill = skill.key;
      btn.dataset.action = skill.key;

      if (!btn.querySelector('.gj-skill-main')){
        btn.innerHTML = skillHTML(skill);
      }

      if (!btn.dataset.gjCoreBound){
        btn.dataset.gjCoreBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          useSkill(skill.key);
        });
      }
    });

    refreshSkillButtons();
  }

  function refreshSkillButtons(){
    const t = now();

    SKILLS.forEach(skill => {
      const btn = $('[data-skill="' + skill.key + '"]');
      if (!btn) return;

      let enabled = state.power >= skill.cost;
      let reason = 'ใช้พลัง ' + skill.cost;

      const cd = Math.max(0, state.cooldowns[skill.key] - t);
      const lock = Math.max(0, state.locks[skill.key] - t);
      const remain = Math.max(cd, lock);

      if (remain > 0){
        enabled = false;
        reason = 'รอ ' + Math.ceil(remain / 1000) + 's';
      }

      if (skill.key === 'shield' && isShieldActive()){
        enabled = false;
        reason = 'กำลังป้องกัน';
      }

      if (skill.key === 'heal' && state.hearts >= state.maxHearts && !isFreezeActive() && !isStormActive()){
        enabled = false;
        reason = 'หัวใจเต็ม';
      }

      btn.disabled = !enabled;
      btn.classList.toggle('is-ready', enabled);
      btn.classList.toggle('is-disabled', !enabled);

      const cost = btn.querySelector('.gj-skill-cost');
      if (cost) cost.textContent = reason;
    });

    syncMobileDock();
  }

  function recentSkills(ms, key){
    const cutoff = now() - ms;
    return state.skillLog.filter(x => {
      if (!x || x.ts < cutoff) return false;
      if (key && x.skill !== key) return false;
      return true;
    });
  }

  function canUseSkill(key){
    const skill = SKILLS.find(s => s.key === key);
    if (!skill) return false;

    if (state.power < skill.cost){
      toast('พลัง Battle ยังไม่พอ');
      return false;
    }

    if (now() < state.cooldowns[key] || now() < state.locks[key]){
      toast('⏳ รอก่อนใช้สกิลอีกครั้ง');
      return false;
    }

    if (recentSkills(10000).length >= CFG.maxSkillPer10Sec){
      toast('ใช้สกิลถี่เกินไป รออีกนิด');
      return false;
    }

    if (key === 'junk-storm' && recentSkills(30000, key).length >= CFG.maxStormPer30Sec){
      toast('Junk Storm ใช้ได้จำกัด');
      return false;
    }

    if (key === 'freeze' && recentSkills(30000, key).length >= CFG.maxFreezePer30Sec){
      toast('Freeze ใช้ได้จำกัดเพื่อความยุติธรรม');
      return false;
    }

    if (key === 'shield' && recentSkills(30000, key).length >= CFG.maxShieldPer30Sec){
      toast('Shield ใช้ถี่เกินไป');
      return false;
    }

    if (key === 'heal' && recentSkills(45000, key).length >= CFG.maxHealPer45Sec){
      toast('Heal ใช้ถี่เกินไป');
      return false;
    }

    return true;
  }

  function registerSkill(key){
    const t = now();
    state.skillLog.push({ skill: key, ts: t });
    state.skillLog = state.skillLog.filter(x => t - x.ts < 60000);

    if (key === 'junk-storm'){
      state.cooldowns[key] = t + CFG.stormCooldownMs;
      state.locks[key] = t + CFG.stormDurationMs;
    }

    if (key === 'shield'){
      state.cooldowns[key] = t + CFG.shieldCooldownMs;
      state.locks[key] = t + 7000;
    }

    if (key === 'freeze'){
      state.cooldowns[key] = t + CFG.freezeCooldownMs;
      state.locks[key] = t + 7200;
    }

    if (key === 'heal'){
      state.cooldowns[key] = t + CFG.healCooldownMs;
      state.locks[key] = t + 9000;
    }

    emit('gj:battle-skill-balanced-used', { skill: key, ts: t });
  }

  async function useSkill(key){
    if (!canUseSkill(key)) return false;

    const skill = SKILLS.find(s => s.key === key);
    if (!skill) return false;

    spendPower(skill.cost);
    registerSkill(key);

    if (key === 'junk-storm'){
      await pushEffect('junk-storm', {
        count: CFG.stormJunkCount,
        durationMs: CFG.stormDurationMs
      });
      toast('⚡ ส่ง Junk Storm ไปแล้ว!');
      addFeed('⚡ ส่ง Junk Storm ไปแล้ว!', 'storm');
      emit('gj:battle-skill-local', { skill: key });
    }

    if (key === 'shield'){
      state.shieldUntil = now() + CFG.shieldDurationMs;
      toast('🛡️ เปิด Shield แล้ว!');
      addFeed('🛡️ เปิด Shield แล้ว!', 'shield');
      emit('gj:battle-skill-local', { skill: key });
    }

    if (key === 'freeze'){
      await pushEffect('freeze', {
        durationMs: CFG.freezeDurationMs
      });
      toast('❄️ ส่ง Freeze ไปแล้ว!');
      addFeed('❄️ ส่ง Freeze ไปแล้ว!', 'freeze');
      emit('gj:battle-skill-local', { skill: key });
    }

    if (key === 'heal'){
      heal();
      toast('💚 Heal/Cleanse สำเร็จ!');
      addFeed('💚 Heal/Cleanse สำเร็จ!', 'heal');
      emit('gj:battle-skill-local', { skill: key });
    }

    syncHud();
    refreshSkillButtons();
    updateGlobalState();

    return true;
  }

  async function pushEffect(type, payload){
    const roomRef = getRoomRef();

    if (!roomRef){
      console.warn('[GoodJunk Battle Core] no roomRef; local only:', type);
      return false;
    }

    const effect = Object.assign({
      id: PLAYER_ID + '_' + type + '_' + now(),
      type,
      from: PLAYER_ID,
      fromName: PLAYER_NAME,
      ts: now(),
      matchId: state.matchId || window.GJ_MATCH_ID || ''
    }, payload || {});

    try{
      await roomRef.child('effects').push(effect);
      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] pushEffect failed', err);
      return false;
    }
  }

  function applyEffect(effect, key){
    if (!effect) return;

    const id = effect.id || key;
    if (state.appliedEffects[id]) return;
    state.appliedEffects[id] = true;

    if (String(effect.from || '') === PLAYER_ID) return;

    if (effect.type === 'junk-storm'){
      if (isShieldActive()){
        toast('🛡️ Shield กัน Junk Storm ได้!');
        addFeed('🛡️ Shield กัน Junk Storm ได้!', 'shield');
        emit('gj:battle-skill-received', { skill: 'blocked-junk-storm', effect });
      }else{
        state.stormUntil = now() + Number(effect.durationMs || CFG.stormDurationMs);
        startStorm(Number(effect.count || CFG.stormJunkCount), Number(effect.durationMs || CFG.stormDurationMs), effect);
        toast('⚡ คู่แข่งส่ง Junk Storm มา!');
        addFeed('⚡ โดน Junk Storm!', 'storm');
        emit('gj:battle-skill-received', { skill: 'junk-storm', effect });
      }
    }

    if (effect.type === 'freeze'){
      if (isShieldActive()){
        toast('🛡️ Shield กัน Freeze ได้!');
        addFeed('🛡️ Shield กัน Freeze ได้!', 'shield');
        emit('gj:battle-skill-received', { skill: 'blocked-freeze', effect });
      }else{
        state.freezeUntil = now() + Number(effect.durationMs || CFG.freezeDurationMs);
        startFreeze(Number(effect.durationMs || CFG.freezeDurationMs));
        toast('❄️ โดน Freeze!');
        addFeed('❄️ โดน Freeze!', 'freeze');
        emit('gj:battle-skill-received', { skill: 'freeze', effect });
      }
    }

    markEffectConsumed(key);
    syncHud();
    refreshSkillButtons();
    updateGlobalState();
  }

  async function markEffectConsumed(key){
    const roomRef = getRoomRef();
    if (!roomRef || !key) return;

    try{
      await roomRef.child('effects').child(key).update({
        consumed: true,
        consumedBy: PLAYER_ID,
        consumedAt: now()
      });
    }catch(e){}
  }

  function startFreeze(durationMs){
    state.freezeUntil = now() + Number(durationMs || CFG.freezeDurationMs);
    document.documentElement.classList.add('gj-freeze-active');

    const apply = () => {
      getMovableTargets().forEach(el => {
        el.classList.add('gj-freeze-slow-target');
      });
    };

    apply();

    clearInterval(startFreeze._tick);
    startFreeze._tick = setInterval(() => {
      if (!isFreezeActive()){
        clearInterval(startFreeze._tick);
        document.documentElement.classList.remove('gj-freeze-active');
        $$('.gj-freeze-slow-target').forEach(el => el.classList.remove('gj-freeze-slow-target'));
        return;
      }
      apply();
    }, 250);

    emit('gj:freeze-player', { durationMs });
  }

  function getMovableTargets(){
    const selectors = [
      '.target',
      '.food',
      '.junk',
      '.good',
      '.falling',
      '.item',
      '.sprite',
      '.enemy',
      '.gj-target',
      '.gj-item',
      '[data-kind]',
      '[data-type]',
      '[data-target]'
    ];

    const set = new Set();

    selectors.forEach(sel => {
      $$(sel).forEach(el => {
        if (el.closest('#gjBattleMobileActionDock')) return;
        if (el.closest('.battle-actions')) return;
        if (el.closest('.hud')) return;
        set.add(el);
      });
    });

    return Array.from(set);
  }

  function startStorm(count, durationMs, effect){
    count = Number(count || CFG.stormJunkCount);
    durationMs = Number(durationMs || CFG.stormDurationMs);

    state.stormUntil = now() + durationMs;
    document.documentElement.classList.add('gj-storm-active');

    let spawned = 0;
    clearInterval(startStorm._timer);

    startStorm._timer = setInterval(() => {
      if (now() > state.stormUntil || spawned >= count){
        clearInterval(startStorm._timer);
        setTimeout(() => {
          document.documentElement.classList.remove('gj-storm-active');
        }, 500);
        return;
      }

      spawnStormJunk(effect);
      spawned += 1;
    }, 520);

    emit('gj:spawn-junk-storm', { count, durationMs, effect });
  }

  function spawnStormJunk(effect){
    const arena = getArena();
    if (!arena) return;

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'gj-storm-junk target junk bad';
    item.textContent = junkIcons[Math.floor(Math.random() * junkIcons.length)];
    item.dataset.kind = 'junk';
    item.dataset.type = 'junk';
    item.dataset.battleStorm = '1';

    const size = Math.round(46 + Math.random() * 18);
    item.style.left = (6 + Math.random() * 84) + '%';
    item.style.top = (12 + Math.random() * 70) + '%';
    item.style.width = size + 'px';
    item.style.height = size + 'px';

    item.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      item.textContent = '💥';
      item.classList.add('gj-storm-junk-hit');

      damage(1);

      emit('gj:junk-hit', {
        source: 'battle-storm',
        damage: 1,
        effect
      });

      emit('hha:miss', {
        type: 'junk',
        source: 'battle-storm',
        damage: 1
      });

      setTimeout(() => item.remove(), 180);
    });

    arena.appendChild(item);

    if (isFreezeActive()){
      item.classList.add('gj-freeze-slow-target');
    }

    setTimeout(() => {
      if (item.parentNode){
        item.classList.add('gj-storm-junk-timeout');
        setTimeout(() => item.remove(), 240);
      }
    }, 4200);
  }

  function ensureHud(){
    if (!IS_MOBILE && !IS_CARDBOARD) return;

    let hud = $('#gjBattleCompactHud');
    if (!hud){
      hud = document.createElement('div');
      hud.id = 'gjBattleCompactHud';
      hud.className = 'gj-battle-compact-hud';
      hud.innerHTML = `
        <div class="gj-chud-item">
          <span class="gj-chud-label">คะแนน</span>
          <b id="gjChudScore">0</b>
        </div>
        <div class="gj-chud-item">
          <span class="gj-chud-label">หัวใจ</span>
          <b id="gjChudHearts">❤❤❤</b>
        </div>
        <div class="gj-chud-item">
          <span class="gj-chud-label">พลัง</span>
          <b id="gjChudPower">0/5</b>
        </div>
        <div class="gj-chud-item">
          <span class="gj-chud-label">เวลา</span>
          <b id="gjChudTime">--</b>
        </div>
      `;

      const arena = getArena();
      if (arena && arena.parentNode){
        arena.parentNode.insertBefore(hud, arena);
      }else{
        document.body.insertBefore(hud, document.body.firstChild);
      }
    }
  }

  function syncHud(){
    const heartText = '❤'.repeat(state.hearts) + '♡'.repeat(Math.max(0, state.maxHearts - state.hearts));

    const scoreEl = $('#gjChudScore');
    const heartsEl = $('#gjChudHearts');
    const powerEl = $('#gjChudPower');
    const timeEl = $('#gjChudTime');

    if (scoreEl) scoreEl.textContent = String(state.score);
    if (heartsEl) heartsEl.textContent = heartText;
    if (powerEl) powerEl.textContent = state.power + '/' + state.maxPower;

    const oldScore = $('#score') || $('#myScore') || $('[data-score]');
    const oldHearts = $('#hearts') || $('#battleHearts') || $('[data-hearts]');
    const oldPower = $('#battlePower') || $('#skillPower') || $('[data-battle-power]');

    if (oldScore) oldScore.textContent = String(state.score);
    if (oldHearts) oldHearts.textContent = heartText;
    if (oldPower) oldPower.textContent = 'พลัง ' + state.power + '/' + state.maxPower;

    let badge = $('#gjBattlePowerBadge');
    if (!badge){
      badge = document.createElement('div');
      badge.id = 'gjBattlePowerBadge';
      badge.className = 'gj-battle-power-badge';
      const bar = $('#battleActions') || $('.battle-actions');
      if (bar && bar.parentNode) bar.parentNode.insertBefore(badge, bar);
    }
    if (badge) badge.textContent = '⚔️ พลัง ' + state.power + '/' + state.maxPower;

    refreshSkillButtons();
  }

  function ensureMobileDock(){
    if (!IS_MOBILE || IS_CARDBOARD) return null;

    let dock = $('#gjBattleMobileActionDock');
    if (!dock){
      dock = document.createElement('div');
      dock.id = 'gjBattleMobileActionDock';
      dock.className = 'gj-mobile-action-dock';
      dock.innerHTML = `
        <button id="gjBattleDockToggle" class="gj-battle-dock-toggle" type="button">⌄ ย่อปุ่มโจมตี</button>
        <div class="gj-mobile-action-grid" id="gjBattleMobileActionGrid"></div>
      `;
      document.body.appendChild(dock);

      $('#gjBattleDockToggle', dock).addEventListener('click', () => {
        document.documentElement.classList.toggle('gj-battle-dock-collapsed');
        const collapsed = document.documentElement.classList.contains('gj-battle-dock-collapsed');
        $('#gjBattleDockToggle', dock).textContent = collapsed ? '⚔️ แสดงปุ่มโจมตี' : '⌄ ย่อปุ่มโจมตี';
      });
    }

    return dock;
  }

  function syncMobileDock(){
    if (!IS_MOBILE || IS_CARDBOARD) return;

    const dock = ensureMobileDock();
    const grid = $('#gjBattleMobileActionGrid', dock);
    if (!grid) return;

    SKILLS.forEach(skill => {
      const original = $('[data-skill="' + skill.key + '"]');
      if (!original) return;

      let clone = $('#dock_' + skill.key.replaceAll('-','_'), grid);
      if (!clone){
        clone = document.createElement('button');
        clone.id = 'dock_' + skill.key.replaceAll('-','_');
        clone.type = 'button';
        clone.className = 'gj-mobile-action-btn';
        clone.dataset.skill = skill.key;
        clone.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!original.disabled) original.click();
        });
        grid.appendChild(clone);
      }

      clone.innerHTML = original.innerHTML;
      clone.disabled = original.disabled;
      clone.classList.toggle('is-disabled', original.disabled);
      clone.classList.toggle('is-ready', !original.disabled);
    });

    const oldBar = $('#battleActions') || $('.battle-actions');
    if (oldBar) oldBar.classList.add('gj-original-actions-hidden-mobile');
  }

  function addFeed(text, cls){
    let feed = $('#gjBattleCombatFeed');
    if (!feed){
      feed = document.createElement('div');
      feed.id = 'gjBattleCombatFeed';
      feed.className = 'gj-battle-combat-feed';

      const arena = getArena();
      if (arena) arena.appendChild(feed);
      else document.body.appendChild(feed);
    }

    state.feed.unshift({
      text,
      cls: cls || 'battle',
      ts: now()
    });

    state.feed = state.feed.slice(0, 5);

    feed.innerHTML = state.feed.map(x => `
      <div class="gj-feed-item gj-feed-${escapeHtml(x.cls)}">
        <span class="gj-feed-text">${escapeHtml(x.text)}</span>
      </div>
    `).join('');

    clearTimeout(addFeed._t);
    addFeed._t = setTimeout(() => {
      state.feed = state.feed.filter(x => now() - x.ts < 6500);
      feed.innerHTML = state.feed.map(x => `
        <div class="gj-feed-item gj-feed-${escapeHtml(x.cls)}">
          <span class="gj-feed-text">${escapeHtml(x.text)}</span>
        </div>
      `).join('');
    }, 6800);
  }

  function bigFx(text, cls){
    let fx = $('#gjBattleBigCombatFx');
    if (!fx){
      fx = document.createElement('div');
      fx.id = 'gjBattleBigCombatFx';
      fx.className = 'gj-battle-big-combat-fx';
      document.body.appendChild(fx);
    }

    fx.className = 'gj-battle-big-combat-fx show ' + (cls || '');
    fx.innerHTML = `<div class="gj-bigfx-text">${escapeHtml(text)}</div>`;

    clearTimeout(bigFx._t);
    bigFx._t = setTimeout(() => {
      fx.className = 'gj-battle-big-combat-fx';
    }, 1100);
  }

  async function updateMyPlayer(patch){
    const roomRef = getRoomRef();
    if (!roomRef) return false;

    try{
      await roomRef.child('players').child(PLAYER_ID).update(Object.assign({
        name: PLAYER_NAME,
        lastSeen: now(),
        heartbeatAt: now(),
        updatedAt: now(),
        clientPatch: CORE_VERSION
      }, patch || {}));
      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] updateMyPlayer failed', err);
      return false;
    }
  }

  async function updateRoom(patch){
    const roomRef = getRoomRef();
    if (!roomRef) return false;

    try{
      await roomRef.update(Object.assign({
        updatedAt: now()
      }, patch || {}));
      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] updateRoom failed', err);
      return false;
    }
  }

  function startHeartbeat(){
    if (state.heartbeatTimer) return;

    updateMyPlayer({
      left: false,
      quit: false,
      disconnected: false,
      status: 'online'
    });

    state.heartbeatTimer = setInterval(() => {
      updateMyPlayer({
        left: false,
        quit: false,
        disconnected: false,
        status: 'online',
        currentUrl: location.href
      });
    }, CFG.heartbeatMs);

    window.addEventListener('beforeunload', markLeftSync);
    window.addEventListener('pagehide', markLeftSync);
  }

  function markLeftSync(){
    try{
      const roomRef = getRoomRef();
      if (!roomRef) return;

      roomRef.child('players').child(PLAYER_ID).update({
        left: true,
        quit: true,
        disconnected: true,
        status: 'left',
        rematchReady: false,
        readyRematch: false,
        nextReady: false,
        lastSeen: now(),
        heartbeatAt: now(),
        updatedAt: now()
      });
    }catch(e){}
  }

  async function markLeftAndGo(urlToGo){
    await updateMyPlayer({
      left: true,
      quit: true,
      disconnected: true,
      status: 'left',
      rematchReady: false,
      readyRematch: false,
      nextReady: false
    });

    location.href = urlToGo;
  }

  function getPlayers(room){
    return Object.entries(safeObj(room.players)).map(([id, data]) => Object.assign({ id }, safeObj(data)));
  }

  function getMeOpponent(room){
    const players = getPlayers(room);

    const me = players.find(p => String(p.id) === PLAYER_ID);
    const opponent = players.find(p => String(p.id) !== PLAYER_ID && playerOnline(p));
    const opponentAny = players.find(p => String(p.id) !== PLAYER_ID);

    return { players, me, opponent, opponentAny };
  }

  async function handleOpponentLeft(room){
    const { me, opponent, opponentAny } = getMeOpponent(room);
    if (!me || !opponentAny) return false;
    if (opponent) return false;

    const waitingRematch =
      me.rematchReady === true ||
      me.readyRematch === true ||
      me.nextReady === true ||
      me.status === 'rematch-ready';

    const phase = String(room.phase || room.status || state.phase || '').toLowerCase();

    if (waitingRematch || ['summary','result','ended','finished','gameover','rematch','opponent-left'].includes(phase)){
      if (!state.opponentLeftHandled){
        state.opponentLeftHandled = true;
        await updateMyPlayer({
          rematchReady: false,
          readyRematch: false,
          nextReady: false,
          status: 'online'
        });
        showOpponentLeftRematch();
      }
      return true;
    }

    if (['play','playing','running','battle','active'].includes(phase)){
      showOpponentLeftPlaying();
      await updateRoom({
        phase: 'opponent-left',
        status: 'opponent-left',
        endedAt: now(),
        winner: PLAYER_ID,
        reason: 'opponent-left'
      });
      return true;
    }

    return false;
  }

  function showOpponentLeftPlaying(){
    toast('คู่แข่งออกจาก Battle แล้ว');
    addFeed('คู่แข่งออกจาก Battle แล้ว', 'danger');
    bigFx('คู่แข่งออกจาก Battle แล้ว', 'danger');

    emit('gj:battle-opponent-left', {
      during: 'play',
      ts: now()
    });
  }

  function showOpponentLeftRematch(){
    toast('คู่แข่งออกแล้ว กรุณากลับ Lobby');
    addFeed('คู่แข่งออกแล้ว กรุณากลับ Lobby', 'danger');

    const title = $('#resultTitle') || $('[data-result-title]') || $('.result-title');
    if (title) title.textContent = 'คู่แข่งออกจาก Battle แล้ว';

    const note = $('#rematchStatus') || $('[data-rematch-status]') || $('.rematch-status') || $('.result-note');
    if (note){
      note.textContent = 'อีกฝ่ายออกจากห้องแล้ว • กลับ Lobby เพื่อเริ่ม Battle ใหม่';
      note.classList.add('opponent-left','danger');
    }

    const btn = $('#btnRematch') || $('[data-rematch-btn]') || $('.btn-rematch');
    if (btn){
      btn.disabled = false;
      btn.classList.remove('is-waiting');
      btn.classList.add('is-opponent-left');
      btn.textContent = '⚔️ กลับ Lobby เพื่อเริ่มใหม่';
      btn.onclick = ev => {
        ev.preventDefault();
        markLeftAndGo(buildLobbyUrl());
      };
    }

    emit('gj:battle-opponent-left', {
      during: 'rematch',
      ts: now()
    });
  }

  async function handleRematchReady(room){
    const roomRef = getRoomRef();
    if (!roomRef) return false;

    const phase = String(room.phase || room.status || '').toLowerCase();
    if (!['summary','result','ended','finished','gameover','rematch'].includes(phase)) return false;

    const players = getPlayers(room).filter(playerOnline);
    if (players.length < 2) return false;

    const ready = players.filter(p => {
      const r =
        p.rematchReady === true ||
        p.readyRematch === true ||
        p.nextReady === true ||
        p.status === 'rematch-ready';

      const readyAt = Number(p.rematchReadyAt || p.readyAt || p.updatedAt || 0);
      const fresh = !readyAt || now() - readyAt < CFG.rematchReadyExpireMs;

      return r && fresh;
    });

    if (ready.length < 2) return false;

    const newMatchId = 'm_' + now() + '_' + Math.random().toString(16).slice(2,8);
    const updates = {
      phase: 'play',
      status: 'play',
      matchId: newMatchId,
      roundId: newMatchId,
      startedAt: now(),
      endedAt: null,
      winner: null,
      reason: null,
      effects: null
    };

    players.forEach(p => {
      const base = 'players/' + p.id + '/';
      updates[base + 'score'] = 0;
      updates[base + 'hearts'] = CFG.maxHearts;
      updates[base + 'hp'] = CFG.maxHearts;
      updates[base + 'lives'] = CFG.maxHearts;
      updates[base + 'miss'] = 0;
      updates[base + 'good'] = 0;
      updates[base + 'junk'] = 0;
      updates[base + 'power'] = 0;
      updates[base + 'attackPower'] = 0;
      updates[base + 'result'] = null;
      updates[base + 'finished'] = false;
      updates[base + 'done'] = false;
      updates[base + 'rematchReady'] = false;
      updates[base + 'readyRematch'] = false;
      updates[base + 'nextReady'] = false;
      updates[base + 'rematchReadyAt'] = null;
      updates[base + 'status'] = 'online';
      updates[base + 'left'] = false;
      updates[base + 'quit'] = false;
      updates[base + 'disconnected'] = false;
      updates[base + 'updatedAt'] = now();
    });

    try{
      await roomRef.update(updates);

      resetLocalRound(newMatchId);
      toast('เริ่ม Battle รอบใหม่!');
      emit('gj:battle-rematch-start', { matchId: newMatchId });

      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] rematch failed', err);
      return false;
    }
  }

  function resetLocalRound(matchId){
    state.matchId = matchId || state.matchId || '';
    state.phase = 'play';
    state.score = 0;
    state.good = 0;
    state.junk = 0;
    state.miss = 0;
    state.hearts = CFG.maxHearts;
    state.power = 0;
    state.shieldUntil = 0;
    state.freezeUntil = 0;
    state.stormUntil = 0;
    state.cooldowns = {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    };
    state.locks = {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    };
    state.skillLog = [];
    state.appliedEffects = Object.create(null);
    state.opponentLeftHandled = false;

    syncHud();
    updateGlobalState();
  }

  async function onRoomValue(room){
    if (!room) return;

    window.GJ_CURRENT_ROOM = room;
    window.currentRoom = room;

    state.phase = String(room.phase || room.status || state.phase || 'play');
    state.matchId = String(room.matchId || room.roundId || state.matchId || '');
    window.GJ_BATTLE_PHASE = state.phase;
    window.GJ_MATCH_ID = state.matchId;

    await handleOpponentLeft(room);
    await handleRematchReady(room);

    const effects = safeObj(room.effects);
    Object.entries(effects).forEach(([key, eff]) => {
      if (!eff) return;
      if (eff.consumed === true && eff.consumedBy === PLAYER_ID) return;
      applyEffect(eff, key);
    });

    cleanStaleEffects(room);
  }

  async function cleanStaleEffects(room){
    const roomRef = getRoomRef();
    if (!roomRef) return;

    const effects = safeObj(room.effects);
    const updates = {};
    const cutoff = now() - CFG.staleEffectAfterMs;

    Object.entries(effects).forEach(([key, eff]) => {
      const ts = Number(eff && eff.ts || 0);
      if (ts && ts < cutoff) updates['effects/' + key] = null;
      if (eff && eff.consumed === true) updates['effects/' + key] = null;
    });

    if (!Object.keys(updates).length) return;

    try{
      await roomRef.update(updates);
    }catch(e){}
  }

  function attachRoomListener(){
    const roomRef = getRoomRef();
    if (!roomRef || typeof roomRef.on !== 'function') return;
    if (state.roomListenerAttached) return;

    state.roomListenerAttached = true;

    roomRef.on('value', snapshot => {
      const room = snapshot && typeof snapshot.val === 'function' ? snapshot.val() || {} : {};
      onRoomValue(room);
    });
  }

  function buildLobbyUrl(){
    return buildUrl('./goodjunk-battle-v2-lobby.html');
  }

  function buildModesUrl(){
    return buildUrl('../goodjunk-launcher.html');
  }

  function buildHubUrl(){
    const hub = params.get('hub');
    if (hub){
      try{ return new URL(hub, location.href).toString(); }catch(e){}
    }
    return buildUrl('../nutrition-zone.html');
  }

  function buildUrl(path){
    const out = new URL(path, location.href);

    [
      'pid','name','diff','time','view','zone','cat','game','gameId',
      'variant','mode','entry','theme','seed','api','log','studyId',
      'conditionGroup','hub'
    ].forEach(k => {
      const v = params.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    if (ROOM_CODE) out.searchParams.set('lastRoom', ROOM_CODE);

    return out.toString();
  }

  function patchNavigation(){
    const lobbySelectors = [
      '#btnBackLobby',
      '[data-back-lobby]',
      '.btn-back-lobby',
      '.back-lobby',
      '#backLobby'
    ];

    lobbySelectors.forEach(sel => {
      $$(sel).forEach(btn => {
        if (btn.dataset.gjCoreLobbyBound) return;
        btn.dataset.gjCoreLobbyBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          markLeftAndGo(buildLobbyUrl());
        }, true);
      });
    });

    const modeSelectors = [
      '#btnAllModes',
      '#btnModes',
      '[data-all-modes]',
      '[data-back-modes]',
      '.btn-all-modes',
      '.btn-modes',
      '.back-modes'
    ];

    modeSelectors.forEach(sel => {
      $$(sel).forEach(btn => {
        if (btn.dataset.gjCoreModesBound) return;
        btn.dataset.gjCoreModesBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          markLeftAndGo(buildModesUrl());
        }, true);
      });
    });

    const hubSelectors = [
      '#btnHub',
      '#backHub',
      '[data-back-hub]',
      '[data-hub]',
      '.btn-hub',
      '.back-hub'
    ];

    hubSelectors.forEach(sel => {
      $$(sel).forEach(btn => {
        if (btn.dataset.gjCoreHubBound) return;
        btn.dataset.gjCoreHubBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          markLeftAndGo(buildHubUrl());
        }, true);
      });
    });
  }

  function patchRematch(){
    const buttons = [
      $('#btnRematch'),
      $('[data-rematch-btn]'),
      $('.btn-rematch')
    ].filter(Boolean);

    buttons.forEach(btn => {
      if (btn.dataset.gjCoreRematchBound) return;
      btn.dataset.gjCoreRematchBound = '1';

      btn.addEventListener('click', () => {
        updateMyPlayer({
          rematchReady: true,
          readyRematch: true,
          nextReady: true,
          rematchReadyAt: now(),
          status: 'rematch-ready'
        });

        const note = $('#rematchStatus') || $('[data-rematch-status]') || $('.rematch-status') || $('.result-note');
        if (note) note.textContent = 'คุณพร้อมแล้ว • รออีกฝ่ายกด Battle อีกครั้ง';

        btn.disabled = true;
        btn.classList.add('is-waiting');
        btn.textContent = '✅ รออีกฝ่าย';
      }, true);
    });
  }

  function endBattle(result, reason){
    state.phase = 'summary';
    updateGlobalState();

    updateMyPlayer({
      score: state.score,
      hearts: state.hearts,
      good: state.good,
      junk: state.junk,
      miss: state.miss,
      result,
      finished: true,
      done: true,
      status: 'finished'
    });

    updateRoom({
      phase: 'summary',
      status: 'summary',
      endedAt: now(),
      reason: reason || result
    });

    emit('gj:battle-ended', { result, reason });
  }

  function bindGameEvents(){
    window.addEventListener('gj:good-collected', ev => {
      const d = ev.detail || {};
      state.good += 1;
      state.score += Number(d.score || 10);
      addPower(Number(d.power || 1));
      syncHud();
      updateGlobalState();
    });

    window.addEventListener('goodjunk:good', () => {
      state.good += 1;
      state.score += 10;
      addPower(1);
    });

    window.addEventListener('hha:score', ev => {
      const d = ev.detail || {};
      const type = String(d.type || d.kind || '').toLowerCase();

      if (!type || type.includes('good') || type.includes('score')){
        state.score += Number(d.score || d.points || 10);
        state.good += type.includes('good') ? 1 : 0;
        addPower(1);
      }

      syncHud();
      updateGlobalState();
    });

    window.addEventListener('gj:junk-hit', () => damage(1));
    window.addEventListener('goodjunk:junk', () => damage(1));
    window.addEventListener('hha:miss', ev => {
      const d = ev.detail || {};
      const type = String(d.type || d.kind || '').toLowerCase();
      if (!type || type.includes('junk') || type.includes('miss')) damage(1);
    });
  }

  function shouldHideDock(){
    const phase = String(state.phase || '').toLowerCase();
    if (['summary','result','ended','finished','gameover','rematch','opponent-left'].includes(phase)) return true;

    return [
      '.result-card',
      '.summary-card',
      '.battle-result',
      '.modal-card',
      '#resultPanel',
      '#summaryPanel',
      '#gameSummary',
      '.rematch-panel'
    ].some(sel => {
      const el = $(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 40 && r.height > 40;
    });
  }

  function layoutTick(){
    document.documentElement.classList.toggle('gj-battle-mobile', IS_MOBILE);
    document.documentElement.classList.toggle('gj-battle-cardboard', IS_CARDBOARD);

    const arena = getArena();
    if (arena){
      arena.classList.add('gj-battle-arena-core');
    }

    const dock = $('#gjBattleMobileActionDock');
    if (dock){
      dock.classList.toggle('gj-final-hide-dock', shouldHideDock());
    }

    patchNavigation();
    patchRematch();
    refreshSkillButtons();
  }

  function ensureQA(){
    const qa = String(params.get('qa') || params.get('debug') || '').toLowerCase();
    const show = qa === '1' || qa === 'true' || window.GJ_BATTLE_QA_FORCE === true;

    let btn = $('#gjBattleQAButton');
    let panel = $('#gjBattleQAPanel');

    if (!show){
      if (btn) btn.remove();
      if (panel) panel.remove();
      return;
    }

    if (!btn){
      btn = document.createElement('button');
      btn.id = 'gjBattleQAButton';
      btn.type = 'button';
      btn.className = 'gj-battle-qa-btn';
      btn.textContent = 'QA';
      document.body.appendChild(btn);

      btn.addEventListener('click', () => {
        state.qaOpen = !state.qaOpen;
        document.documentElement.classList.toggle('gj-qa-open', state.qaOpen);
        syncQA();
      });
    }

    if (!panel){
      panel = document.createElement('div');
      panel.id = 'gjBattleQAPanel';
      panel.className = 'gj-battle-qa-panel';
      panel.innerHTML = `
        <div class="gj-qa-head">
          <b>GoodJunk Battle QA</b>
          <button id="gjBattleQAClose" type="button">×</button>
        </div>
        <div class="gj-qa-body" id="gjBattleQABody"></div>
      `;
      document.body.appendChild(panel);

      $('#gjBattleQAClose', panel).addEventListener('click', () => {
        state.qaOpen = false;
        document.documentElement.classList.remove('gj-qa-open');
      });
    }

    syncQA();
  }

  function syncQA(){
    const body = $('#gjBattleQABody');
    if (!body) return;

    const skillsOK = SKILLS.every(s => !!$('[data-skill="' + s.key + '"]'));

    body.innerHTML = `
      <div class="gj-qa-grid">
        <span>core</span><b>${CORE_VERSION}</b>
        <span>pid</span><b>${escapeHtml(PLAYER_ID)}</b>
        <span>name</span><b>${escapeHtml(PLAYER_NAME)}</b>
        <span>room</span><b>${escapeHtml(ROOM_CODE || '-')}</b>
        <span>view</span><b>${escapeHtml(VIEW)}</b>
        <span>phase</span><b>${escapeHtml(state.phase)}</b>
        <span>match</span><b>${escapeHtml(state.matchId || '-')}</b>
        <span>score</span><b>${state.score}</b>
        <span>heart</span><b>${state.hearts}</b>
        <span>power</span><b>${state.power}/${state.maxPower}</b>
        <span>skills</span><b>${skillsOK ? 'OK' : 'MISSING'}</b>
      </div>
    `;
  }

  function injectCSS(){
    if ($('#gjBattleCoreCSS')) return;

    const css = document.createElement('style');
    css.id = 'gjBattleCoreCSS';
    css.textContent = `
      .gj-battle-actions-v4{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:10px!important;
        width:100%!important;
        margin:10px 0!important;
        padding:10px!important;
        border-radius:24px!important;
        border:3px solid rgba(255,190,105,.75)!important;
        background:rgba(255,252,238,.96)!important;
        box-shadow:0 10px 24px rgba(96,50,20,.12)!important;
      }

      .gj-skill-btn{
        position:relative!important;
        min-width:0!important;
        min-height:84px!important;
        padding:10px 8px!important;
        border-radius:20px!important;
        border:3px solid rgba(255,205,120,.95)!important;
        background:linear-gradient(180deg,#fff8da,#ffe073)!important;
        color:#87331f!important;
        font-weight:1000!important;
        line-height:1.1!important;
        box-shadow:0 7px 0 rgba(177,105,22,.22)!important;
        touch-action:manipulation!important;
      }

      .gj-skill-btn .gj-skill-icon{
        display:block!important;
        font-size:24px!important;
      }

      .gj-skill-btn .gj-skill-main{
        display:block!important;
        font-size:15px!important;
        font-weight:1000!important;
      }

      .gj-skill-btn .gj-skill-sub{
        display:block!important;
        font-size:11px!important;
        opacity:.78!important;
      }

      .gj-skill-btn .gj-skill-cost{
        display:inline-block!important;
        margin-top:5px!important;
        padding:3px 7px!important;
        border-radius:999px!important;
        background:rgba(255,255,255,.62)!important;
        font-size:10px!important;
        font-weight:900!important;
      }

      .gj-skill-shield{
        background:linear-gradient(180deg,#ecf8ff,#aee0ff)!important;
        border-color:rgba(120,198,255,.96)!important;
        color:#13527a!important;
      }

      .gj-skill-freeze{
        background:linear-gradient(180deg,#f0fbff,#bdf1ff)!important;
        border-color:rgba(107,220,255,.96)!important;
        color:#146075!important;
      }

      .gj-skill-heal{
        background:linear-gradient(180deg,#edfff3,#aaf0bf)!important;
        border-color:rgba(95,220,135,.96)!important;
        color:#236b35!important;
      }

      .gj-skill-btn[disabled],
      .gj-skill-btn.is-disabled{
        opacity:.48!important;
        filter:grayscale(.25)!important;
        box-shadow:none!important;
      }

      .gj-battle-power-badge{
        width:fit-content!important;
        margin:8px auto 4px!important;
        padding:7px 12px!important;
        border-radius:999px!important;
        background:rgba(255,246,214,.96)!important;
        border:2px solid rgba(255,188,88,.9)!important;
        color:#8b3b19!important;
        font-weight:1000!important;
        font-size:13px!important;
      }

      .gj-battle-skill-toast{
        position:fixed!important;
        left:50%!important;
        bottom:calc(150px + env(safe-area-inset-bottom))!important;
        transform:translateX(-50%) translateY(12px)!important;
        z-index:100000!important;
        max-width:min(92vw,420px)!important;
        padding:12px 16px!important;
        border-radius:999px!important;
        background:rgba(60,34,16,.92)!important;
        color:#fff!important;
        font-weight:900!important;
        text-align:center!important;
        opacity:0!important;
        pointer-events:none!important;
        transition:opacity .18s ease,transform .18s ease!important;
      }

      .gj-battle-skill-toast.show{
        opacity:1!important;
        transform:translateX(-50%) translateY(0)!important;
      }

      .gj-storm-junk{
        position:absolute!important;
        display:grid!important;
        place-items:center!important;
        border-radius:999px!important;
        border:3px solid rgba(255,120,72,.9)!important;
        background:linear-gradient(180deg,#fff2d9,#ffb36a)!important;
        font-size:26px!important;
        font-weight:1000!important;
        cursor:pointer!important;
        z-index:15!important;
        box-shadow:0 8px 18px rgba(130,50,12,.18)!important;
        animation:gjStormJunkPop .32s ease both, gjStormJunkWiggle .75s ease-in-out infinite alternate!important;
      }

      .gj-storm-junk-hit{
        animation:gjStormJunkHit .22s ease both!important;
      }

      .gj-storm-junk-timeout{
        opacity:0!important;
        transform:scale(.72)!important;
        transition:opacity .22s ease,transform .22s ease!important;
      }

      @keyframes gjStormJunkPop{
        from{opacity:0;transform:scale(.45) rotate(-10deg);}
        to{opacity:1;transform:scale(1) rotate(0deg);}
      }

      @keyframes gjStormJunkWiggle{
        from{transform:translateY(0) rotate(-4deg);}
        to{transform:translateY(-5px) rotate(5deg);}
      }

      @keyframes gjStormJunkHit{
        from{opacity:1;transform:scale(1);}
        to{opacity:0;transform:scale(1.35) rotate(18deg);}
      }

      html.gj-freeze-active .gj-freeze-slow-target{
        filter:saturate(.75) brightness(.96) drop-shadow(0 0 8px rgba(125,221,255,.65))!important;
        animation-duration:2.4s!important;
        transition-duration:2.4s!important;
      }

      html.gj-storm-active .arena,
      html.gj-storm-active .battle-arena,
      html.gj-storm-active #arena{
        box-shadow:inset 0 0 0 5px rgba(255,176,74,.48),0 0 30px rgba(255,144,42,.38)!important;
      }

      .gj-battle-combat-feed{
        position:absolute!important;
        left:10px!important;
        top:10px!important;
        z-index:35!important;
        display:flex!important;
        flex-direction:column!important;
        gap:5px!important;
        width:min(300px,72%)!important;
        pointer-events:none!important;
      }

      .gj-feed-item{
        width:fit-content!important;
        max-width:100%!important;
        padding:6px 9px!important;
        border-radius:999px!important;
        background:rgba(255,255,255,.88)!important;
        border:2px solid rgba(255,205,120,.82)!important;
        color:#633015!important;
        font-size:12px!important;
        font-weight:1000!important;
        box-shadow:0 8px 18px rgba(70,30,8,.13)!important;
      }

      .gj-feed-storm{background:rgba(255,244,204,.94)!important;color:#884010!important;}
      .gj-feed-freeze{background:rgba(232,250,255,.94)!important;color:#145970!important;}
      .gj-feed-shield{background:rgba(230,246,255,.94)!important;color:#10517c!important;}
      .gj-feed-heal{background:rgba(235,255,239,.94)!important;color:#246836!important;}
      .gj-feed-danger{background:rgba(255,236,230,.95)!important;color:#8d2816!important;}

      .gj-battle-big-combat-fx{
        position:fixed!important;
        left:50%!important;
        top:38%!important;
        transform:translate(-50%,-50%) scale(.85)!important;
        z-index:100001!important;
        min-width:min(88vw,360px)!important;
        max-width:92vw!important;
        padding:16px 18px!important;
        border-radius:28px!important;
        background:rgba(255,255,255,.94)!important;
        border:4px solid rgba(255,203,112,.92)!important;
        box-shadow:0 20px 45px rgba(85,42,12,.23)!important;
        text-align:center!important;
        opacity:0!important;
        pointer-events:none!important;
        transition:opacity .16s ease,transform .16s ease!important;
      }

      .gj-battle-big-combat-fx.show{
        opacity:1!important;
        transform:translate(-50%,-50%) scale(1)!important;
      }

      .gj-bigfx-text{
        font-size:clamp(18px,5vw,28px)!important;
        font-weight:1000!important;
        color:#653018!important;
      }

      @media(max-width:760px){
        html.gj-battle-mobile body{
          padding-bottom:calc(136px + env(safe-area-inset-bottom))!important;
          overflow-x:hidden!important;
          overflow-y:auto!important;
        }

        .gj-battle-actions-v4{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }

        .gj-skill-btn{
          min-height:64px!important;
          padding:8px 6px!important;
          border-radius:18px!important;
        }

        .gj-skill-btn .gj-skill-icon{
          display:inline-block!important;
          font-size:20px!important;
          margin-right:3px!important;
        }

        .gj-skill-btn .gj-skill-main{
          display:inline!important;
          font-size:clamp(14px,4vw,17px)!important;
        }

        .gj-skill-btn .gj-skill-sub{
          display:none!important;
        }

        .gj-skill-btn .gj-skill-cost{
          display:block!important;
          width:fit-content!important;
          margin:4px auto 0!important;
        }

        .gj-original-actions-hidden-mobile{
          display:none!important;
        }

        .gj-mobile-action-dock{
          position:fixed!important;
          left:6px!important;
          right:6px!important;
          bottom:max(6px,env(safe-area-inset-bottom))!important;
          z-index:99999!important;
          padding:7px!important;
          border-radius:20px!important;
          border:3px solid rgba(255,189,105,.92)!important;
          background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,248,231,.98))!important;
          box-shadow:0 12px 30px rgba(89,45,12,.20)!important;
        }

        .gj-battle-dock-toggle{
          width:100%!important;
          min-height:30px!important;
          margin:0 0 6px!important;
          border-radius:999px!important;
          border:2px solid rgba(255,200,100,.85)!important;
          background:rgba(255,255,255,.76)!important;
          color:#82401e!important;
          font-size:12px!important;
          font-weight:1000!important;
        }

        .gj-mobile-action-grid{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:7px!important;
        }

        .gj-mobile-action-btn{
          min-height:54px!important;
          padding:6px 5px!important;
          border-radius:16px!important;
          border:3px solid rgba(255,203,122,.92)!important;
          background:linear-gradient(180deg,#fff8d9,#ffe27a)!important;
          color:#87331f!important;
          font-size:clamp(13px,3.8vw,16px)!important;
          font-weight:1000!important;
        }

        html.gj-battle-dock-collapsed body{
          padding-bottom:calc(54px + env(safe-area-inset-bottom))!important;
        }

        html.gj-battle-dock-collapsed .gj-mobile-action-grid{
          display:none!important;
        }

        .gj-battle-compact-hud{
          position:sticky!important;
          top:max(4px,env(safe-area-inset-top))!important;
          z-index:9990!important;
          display:grid!important;
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:5px!important;
          width:100%!important;
          margin:4px 0 6px!important;
          padding:6px!important;
          border-radius:18px!important;
          border:2px solid rgba(255,198,92,.86)!important;
          background:rgba(255,252,239,.96)!important;
        }

        .gj-chud-item{
          min-width:0!important;
          padding:5px 3px!important;
          border-radius:13px!important;
          background:rgba(255,255,255,.68)!important;
          text-align:center!important;
        }

        .gj-chud-label{
          display:block!important;
          font-size:10px!important;
          font-weight:900!important;
          color:#8a5a2b!important;
        }

        .gj-chud-item b{
          display:block!important;
          margin-top:2px!important;
          font-size:clamp(13px,3.8vw,17px)!important;
          font-weight:1000!important;
          color:#5a3218!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }

        .arena,
        .battle-arena,
        .game-arena,
        #arena{
          height:clamp(300px,48dvh,430px)!important;
          min-height:300px!important;
          max-height:48dvh!important;
          overflow:hidden!important;
        }

        .gj-final-hide-dock{
          display:none!important;
        }
      }

      html.gj-battle-cardboard .gj-mobile-action-dock{
        display:none!important;
      }

      .gj-battle-qa-btn{
        position:fixed!important;
        right:8px!important;
        top:max(8px,env(safe-area-inset-top))!important;
        z-index:100002!important;
        width:34px!important;
        height:30px!important;
        border-radius:999px!important;
      }

      .gj-battle-qa-panel{
        position:fixed!important;
        right:8px!important;
        top:46px!important;
        z-index:100003!important;
        width:min(360px,calc(100vw - 16px))!important;
        max-height:min(70vh,520px)!important;
        overflow:auto!important;
        border-radius:18px!important;
        background:rgba(255,255,255,.96)!important;
        border:2px solid rgba(255,200,110,.92)!important;
        display:none!important;
      }

      html.gj-qa-open .gj-battle-qa-panel{
        display:block!important;
      }

      .gj-qa-head{
        display:flex!important;
        justify-content:space-between!important;
        align-items:center!important;
        padding:10px 12px!important;
        background:rgba(255,247,221,.92)!important;
      }

      .gj-qa-body{
        padding:10px 12px!important;
      }

      .gj-qa-grid{
        display:grid!important;
        grid-template-columns:80px minmax(0,1fr)!important;
        gap:5px 8px!important;
        font-size:11px!important;
      }

      .gj-qa-grid b{
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }
    `;

    document.head.appendChild(css);
  }

  function expose(){
    window.GJ_BATTLE_CORE = {
      version: CORE_VERSION,
      state,
      config: CFG,
      skills: SKILLS,
      useSkill,
      addPower,
      damage,
      heal,
      resetLocalRound,
      updateMyPlayer,
      updateRoom,
      getRoomRef,
      buildLobbyUrl,
      buildModesUrl,
      buildHubUrl,
      endBattle,
      syncHud,
      refreshSkillButtons
    };

    window.GJ_BATTLE_SKILL_LOGIC = window.GJ_BATTLE_CORE;
    window.GJ_BATTLE_SYNC = window.GJ_BATTLE_CORE;
    window.GJ_BATTLE_BALANCE = window.GJ_BATTLE_CORE;
  }

  function boot(){
    injectCSS();
    expose();

    ensureHud();
    ensureSkillButtons();
    ensureMobileDock();
    syncHud();
    updateGlobalState();

    bindGameEvents();
    startHeartbeat();
    attachRoomListener();
    patchNavigation();
    patchRematch();
    ensureQA();

    layoutTick();

    setInterval(() => {
      layoutTick();
      syncHud();
      refreshSkillButtons();
      ensureQA();
    }, 700);

    window.addEventListener('resize', () => {
      setTimeout(layoutTick, 80);
      setTimeout(layoutTick, 400);
    }, { passive:true });

    window.addEventListener('orientationchange', () => {
      setTimeout(layoutTick, 250);
      setTimeout(layoutTick, 900);
    }, { passive:true });

    console.info('[GoodJunk Battle Core]', CORE_VERSION, 'loaded', {
      view: VIEW,
      mobile: IS_MOBILE,
      cardboard: IS_CARDBOARD,
      room: ROOM_CODE,
      player: PLAYER_ID
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
