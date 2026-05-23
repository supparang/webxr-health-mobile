(function GoodJunkBattleV250Core(){
  'use strict';

  const CORE_VERSION = 'v2.5.0-clean-core-runtime';
  const ROOM_PATH = 'herohealth/goodjunk/battleV2Rooms';

  const DEFAULT_FIREBASE_CONFIG =
    window.HHA_FIREBASE_CONFIG ||
    window.HEROHEALTH_FIREBASE_CONFIG ||
    window.firebaseConfig ||
    window.FIREBASE_CONFIG ||
    {
      apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
      authDomain: "herohealth-d7f8c.firebaseapp.com",
      databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "herohealth-d7f8c",
      storageBucket: "herohealth-d7f8c.firebasestorage.app",
      messagingSenderId: "680817376848",
      appId: "1:680817376848:web:eed21b522b0703f6bd9b55"
    };

  const GOOD_ITEMS = [
    { emoji:'🥦', name:'Broccoli', th:'บรอกโคลี' },
    { emoji:'🥕', name:'Carrot', th:'แครอท' },
    { emoji:'🍎', name:'Apple', th:'แอปเปิล' },
    { emoji:'🍌', name:'Banana', th:'กล้วย' },
    { emoji:'🥛', name:'Milk', th:'นม' },
    { emoji:'🥚', name:'Egg', th:'ไข่' },
    { emoji:'🍚', name:'Rice', th:'ข้าว' },
    { emoji:'🐟', name:'Fish', th:'ปลา' },
    { emoji:'🥗', name:'Salad', th:'สลัด' },
    { emoji:'🫘', name:'Beans', th:'ถั่ว' }
  ];

  const JUNK_ITEMS = [
    { emoji:'🍟', name:'Fries', th:'เฟรนช์ฟรายส์' },
    { emoji:'🍩', name:'Donut', th:'โดนัท' },
    { emoji:'🍭', name:'Candy', th:'ลูกอม' },
    { emoji:'🥤', name:'Soda', th:'น้ำอัดลม' },
    { emoji:'🍰', name:'Cake', th:'เค้ก' },
    { emoji:'🍔', name:'Burger', th:'เบอร์เกอร์' },
    { emoji:'🍕', name:'Pizza', th:'พิซซ่า' },
    { emoji:'🍪', name:'Cookie', th:'คุกกี้' }
  ];

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function now(){
    return Date.now();
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function clamp(n, min, max){
    return Math.max(min, Math.min(max, n));
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function normalizeRoomCode(raw){
    const out = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);

    if (!out || /^-+$/.test(out) || /^_+$/.test(out)){
      return '';
    }

    return out;
  }

  function normalizeView(v){
    v = String(v || '').toLowerCase().trim();

    if (v === 'cvr' || v === 'vr' || v === 'cardboard-vr') return 'cardboard';
    if (v === 'cardboard') return 'cardboard';
    if (v === 'mobile' || v === 'phone' || v === 'touch') return 'mobile';
    if (v === 'pc' || v === 'desktop') return 'pc';

    const mobile =
      (window.matchMedia && window.matchMedia('(max-width:760px)').matches) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    return mobile ? 'mobile' : 'pc';
  }

  function xmur3(str){
    let h = 1779033703 ^ str.length;

    for (let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }

    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function sfc32(a, b, c, d){
    return function(){
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;

      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;

      return (t >>> 0) / 4294967296;
    };
  }

  function makeRng(seedText){
    const seed = xmur3(String(seedText || 'goodjunk-battle-v250'));
    return sfc32(seed(), seed(), seed(), seed());
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail:Object.assign({
          version:CORE_VERSION,
          at:now()
        }, detail || {})
      }));
    }catch(_){}
  }

  function getParams(){
    return new URL(location.href).searchParams;
  }

  function getPid(params){
    return String(
      params.get('pid') ||
      localStorage.getItem('GJ_BATTLE_PID') ||
      localStorage.getItem('HHA_GJ_PID') ||
      'anon'
    ).trim() || 'anon';
  }

  function getName(params){
    return String(
      params.get('name') ||
      localStorage.getItem('GJ_BATTLE_NAME') ||
      localStorage.getItem('HHA_GJ_NAME') ||
      'Hero'
    ).trim() || 'Hero';
  }

  function getDiffConfig(diff){
    diff = String(diff || 'normal').toLowerCase();

    if (diff === 'easy'){
      return {
        spawnMs:980,
        maxTargets:5,
        goodRate:.72,
        targetLifeMs:3200,
        junkPenalty:3,
        goodScore:10,
        freezeMs:2800
      };
    }

    if (diff === 'hard'){
      return {
        spawnMs:650,
        maxTargets:8,
        goodRate:.58,
        targetLifeMs:2300,
        junkPenalty:5,
        goodScore:12,
        freezeMs:3800
      };
    }

    return {
      spawnMs:780,
      maxTargets:7,
      goodRate:.65,
      targetLifeMs:2700,
      junkPenalty:4,
      goodScore:10,
      freezeMs:3300
    };
  }

  function createFirebaseAdapter(runtime){
    const adapter = {
      db:null,
      auth:null,
      uid:'',
      roomRef:null,
      roomListenerOn:false,

      async init(){
        if (
          window.GJ_BATTLE_V25_BRIDGE &&
          typeof window.GJ_BATTLE_V25_BRIDGE.init === 'function'
        ){
          const ok = await window.GJ_BATTLE_V25_BRIDGE.init();

          this.db = window.GJ_BATTLE_V25_BRIDGE.db || window.GJ_DB || null;
          this.auth = window.GJ_BATTLE_V25_BRIDGE.auth || null;
          this.uid = window.GJ_BATTLE_V25_BRIDGE.uid || '';

          return !!ok && !!this.db;
        }

        try{
          if (window.GJ_DB && typeof window.GJ_DB.ref === 'function'){
            this.db = window.GJ_DB;
            this.auth = window.GJ_BATTLE_AUTH || null;
            this.uid = window.GJ_BATTLE_AUTH_UID || '';
            return true;
          }

          if (!window.firebase || typeof firebase.initializeApp !== 'function'){
            throw new Error('Firebase SDK not loaded');
          }

          if (!firebase.apps || !firebase.apps.length){
            firebase.initializeApp(DEFAULT_FIREBASE_CONFIG);
          }

          this.auth = firebase.auth();
          this.db = firebase.database();

          if (this.auth && !this.auth.currentUser){
            await this.auth.signInAnonymously();
          }

          this.uid = this.auth && this.auth.currentUser ? this.auth.currentUser.uid : '';

          window.GJ_DB = this.db;
          window.GJ_BATTLE_DB = this.db;
          window.GJ_BATTLE_AUTH = this.auth;
          window.GJ_BATTLE_AUTH_UID = this.uid;
          window.GJ_BATTLE_DB_READY = true;
          window.GJ_BATTLE_AUTH_READY = true;

          return true;
        }catch(err){
          console.warn('[GoodJunk Battle Core] Firebase init failed', err);
          return false;
        }
      },

      getRoomRef(roomCode){
        const code = normalizeRoomCode(roomCode);
        if (!code || !this.db || typeof this.db.ref !== 'function') return null;
        return this.db.ref(ROOM_PATH + '/' + code);
      },

      async attachRoom(roomCode, onValue){
        const code = normalizeRoomCode(roomCode);
        if (!code) return false;

        const ref = this.getRoomRef(code);
        if (!ref || typeof ref.on !== 'function') return false;

        if (this.roomRef && typeof this.roomRef.off === 'function'){
          try{
            this.roomRef.off('value');
          }catch(_){}
        }

        this.roomRef = ref;
        this.roomListenerOn = true;

        ref.on('value', function(snapshot){
          const room = snapshot && typeof snapshot.val === 'function'
            ? snapshot.val() || {}
            : {};

          onValue(room);
        }, function(err){
          console.warn('[GoodJunk Battle Core] room listener error', err);
        });

        return true;
      },

      async updatePlayer(patch){
        if (!this.roomRef || !runtime.state.pid) return false;

        try{
          await this.roomRef.child('players').child(runtime.state.pid).update(patch);
          return true;
        }catch(err){
          console.warn('[GoodJunk Battle Core] updatePlayer failed', err);
          return false;
        }
      },

      async updateRoom(patch){
        if (!this.roomRef) return false;

        try{
          await this.roomRef.update(patch);
          return true;
        }catch(err){
          console.warn('[GoodJunk Battle Core] updateRoom failed', err);
          return false;
        }
      },

      async pushEffect(effect){
        if (!this.roomRef) return false;

        const id =
          effect.id ||
          (
            'fx_' +
            now() +
            '_' +
            Math.random().toString(16).slice(2, 8)
          );

        const payload = Object.assign({}, effect, {
          id,
          at:now(),
          matchId:runtime.state.matchId,
          from:runtime.state.pid
        });

        try{
          await this.roomRef.child('effects').child(id).set(payload);
          return true;
        }catch(err){
          console.warn('[GoodJunk Battle Core] pushEffect failed', err);
          return false;
        }
      },

      detach(){
        if (this.roomRef && typeof this.roomRef.off === 'function'){
          try{
            this.roomRef.off('value');
          }catch(_){}
        }

        this.roomListenerOn = false;
      }
    };

    return adapter;
  }

  function createRuntime(userOptions){
    const params = getParams();
    const options = Object.assign({}, window.GJ_BATTLE_V25_CONFIG || {}, userOptions || {});

    const state = {
      version:CORE_VERSION,

      pid:getPid(params),
      name:getName(params),
      room:normalizeRoomCode(params.get('room') || params.get('roomCode') || params.get('code')),
      matchId:String(params.get('matchId') || params.get('roundId') || params.get('runId') || ''),
      view:normalizeView(params.get('view') || params.get('device') || options.view || ''),
      diff:String(params.get('diff') || options.diff || 'normal').toLowerCase(),
      duration:Math.max(20, safeNum(params.get('time') || options.time || 90, 90)),
      seed:String(params.get('seed') || options.seed || (now() + '_' + Math.random())),

      score:0,
      good:0,
      junk:0,
      miss:0,
      hearts:3,
      power:0,
      combo:0,
      maxCombo:0,
      timeLeft:0,

      started:false,
      ended:false,
      paused:false,
      frozenUntil:0,
      shieldUntil:0,
      lastSpawnAt:0,
      lastSyncAt:0,
      lastTickAt:0,
      startAt:0,
      endAt:0,

      opponent:null,
      opponentScore:0,
      opponentFinished:false,
      opponentName:'คู่แข่ง',
      roomData:null,

      seenEffects:{},
      targetSeq:0,
      timers:[],
      rng:null
    };

    const runtime = {
      version:CORE_VERSION,
      options,
      state,
      adapter:null,
      ui:{},
      diffCfg:getDiffConfig(state.diff),

      init,
      start,
      stop,
      endGame,
      spawnTarget,
      hitTarget,
      shootCrosshair,
      findNearestTargetToCenter,
      syncNow,
      useSkill,
      buildLobbyUrl,
      buildLauncherUrl,
      buildNutritionZoneUrl,
      buildHubUrl,
      resetForReplay
    };

    runtime.adapter = createFirebaseAdapter(runtime);

    return runtime;

    async function init(){
      if (!state.room || !state.matchId){
        console.warn('[GoodJunk Battle Core] missing room or matchId', {
          room:state.room,
          matchId:state.matchId
        });
      }

      state.timeLeft = state.duration;
      state.rng = makeRng([
        state.seed,
        state.room,
        state.matchId,
        state.pid,
        state.view
      ].join('|'));

      cacheUi();
      injectStyle();
      ensureSummaryOverlay();
      ensureCardboardCrosshair();
      bindUi();
      renderAll();

      const ok = await runtime.adapter.init();

      if (ok && state.room){
        await runtime.adapter.attachRoom(state.room, onRoomUpdate);
      }

      window.GJ_BATTLE_RUNTIME = runtime;
      window.GJ_BATTLE_V25_RUNTIME = runtime;

      emit('gj:battle-runtime-ready', {
        room:state.room,
        matchId:state.matchId,
        view:state.view
      });

      return runtime;
    }

    function cacheUi(){
      runtime.ui = {
        root:$('#gameRoot') || document.body,
        arena:$('#arena') || $('.arena') || $('#gameArena') || $('.game-arena') || document.body,

        timer:$('#timer') || $('[data-time]'),
        score:$('#score') || $('[data-score]'),
        good:$('#goodCount') || $('[data-good]'),
        junk:$('#junkCount') || $('[data-junk]'),
        miss:$('#missCount') || $('[data-miss]'),
        hearts:$('#hearts') || $('[data-hearts]'),
        power:$('#battlePower') || $('#attackCount') || $('[data-power]'),
        powerFill:$('#powerFill') || $('[data-power-fill]'),

        playerName:$('#myName') || $('[data-my-name]'),
        opponentName:$('#opponentName') || $('[data-opponent-name]'),
        opponentScore:$('#opponentScore') || $('[data-opponent-score]'),
        opponentStatus:$('#opponentStatus') || $('[data-opponent-status]'),
        roomBadge:$('#roomBadge') || $('[data-room-badge]'),
        matchBadge:$('#matchBadge') || $('[data-match-badge]'),

        btnStorm:$('#btnStorm') || $('#btnSkillStorm') || $('[data-skill="storm"]'),
        btnShield:$('#btnShield') || $('#btnSkillShield') || $('[data-skill="shield"]'),
        btnFreeze:$('#btnFreeze') || $('#btnSkillFreeze') || $('[data-skill="freeze"]'),
        btnHeal:$('#btnHeal') || $('#btnSkillHeal') || $('[data-skill="heal"]'),

        btnReplay:$('#btnReplay') || $('#btnPlayAgain') || $('[data-action="replay"]'),
        btnLobby:$('#btnLobby') || $('#btnBackLobby') || $('[data-action="lobby"]'),
        btnModes:$('#btnModes') || $('#btnAllModes') || $('[data-action="modes"]'),
        btnZone:$('#btnZone') || $('#btnNutritionZone') || $('[data-action="zone"]'),
        btnHub:$('#btnHub') || $('[data-action="hub"]'),

        summaryOverlay:$('#summaryOverlay') || $('#resultOverlay') || $('[data-summary-overlay]'),
        summaryCard:$('#summaryCard') || $('[data-summary-card]'),
        summaryTitle:$('#summaryTitle') || $('[data-summary-title]'),
        summaryBody:$('#summaryBody') || $('[data-summary-body]')
      };

      if (!runtime.ui.arena.classList.contains('gj-battle-arena')){
        runtime.ui.arena.classList.add('gj-battle-arena');
      }

      document.documentElement.dataset.gjBattleView = state.view;
      document.documentElement.dataset.gjBattleCore = CORE_VERSION;
    }

    function injectStyle(){
      if ($('#gjBattleV25CoreStyle')) return;

      const style = document.createElement('style');
      style.id = 'gjBattleV25CoreStyle';

      style.textContent = `
        .gj-battle-arena{
          position:relative;
          overflow:hidden;
          touch-action:none;
          user-select:none;
          -webkit-user-select:none;
        }

        .gj-battle-target{
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          display:grid;
          place-items:center;
          text-align:center;
          border-radius:22px;
          border:4px solid rgba(255,220,168,.96);
          background:rgba(255,254,248,.94);
          color:#753119;
          box-shadow:0 10px 22px rgba(40,40,70,.15);
          cursor:pointer;
          pointer-events:auto;
          touch-action:none;
          z-index:30;
          padding:8px 7px;
          min-width:84px;
          min-height:94px;
          font-weight:1000;
          transition:transform .12s ease, opacity .12s ease;
        }

        .gj-battle-target.good{
          border-color:rgba(85,217,120,.88);
          background:linear-gradient(180deg,#f3ffef,#ffffff);
        }

        .gj-battle-target.junk{
          border-color:rgba(255,123,105,.88);
          background:linear-gradient(180deg,#fff0ed,#ffffff);
        }

        .gj-battle-target .emoji{
          font-size:38px;
          line-height:1;
          margin-bottom:3px;
        }

        .gj-battle-target .name{
          font-size:12px;
          line-height:1.1;
          max-width:76px;
          overflow:hidden;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
        }

        .gj-battle-target.hit{
          opacity:0;
          transform:translate(-50%,-50%) scale(1.24);
          pointer-events:none;
        }

        .gj-floating-score{
          position:absolute;
          z-index:80;
          transform:translate(-50%,-50%);
          font-size:22px;
          font-weight:1000;
          pointer-events:none;
          text-shadow:0 2px 0 rgba(255,255,255,.85);
        }

        .gj-floating-score.good{
          color:#267a3a;
        }

        .gj-floating-score.bad{
          color:#9a2c22;
        }

        .gj-cardboard-crosshair{
          position:fixed;
          left:50%;
          top:50%;
          width:42px;
          height:42px;
          transform:translate(-50%,-50%);
          z-index:9990;
          pointer-events:none;
          display:none;
        }

        .gj-cardboard-crosshair::before,
        .gj-cardboard-crosshair::after{
          content:'';
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          background:rgba(117,49,25,.85);
          box-shadow:0 0 0 2px rgba(255,255,255,.65);
        }

        .gj-cardboard-crosshair::before{
          width:34px;
          height:4px;
          border-radius:999px;
        }

        .gj-cardboard-crosshair::after{
          width:4px;
          height:34px;
          border-radius:999px;
        }

        html[data-gj-battle-view="cardboard"] .gj-cardboard-crosshair{
          display:block;
        }

        .gj-battle-summary-overlay{
          position:fixed;
          inset:0;
          z-index:10000;
          display:none;
          align-items:center;
          justify-content:center;
          padding:16px;
          background:rgba(40,28,18,.34);
          backdrop-filter:blur(8px);
        }

        .gj-battle-summary-overlay.show{
          display:flex;
        }

        .gj-battle-summary-card{
          width:min(94vw,500px);
          max-height:calc(100dvh - 28px);
          overflow:auto;
          -webkit-overflow-scrolling:touch;
          padding:22px 18px;
          border-radius:32px;
          border:5px solid rgba(255,199,125,.95);
          background:rgba(255,254,248,.98);
          box-shadow:0 22px 58px rgba(55,25,10,.24);
          text-align:center;
          color:#753119;
        }

        .gj-battle-summary-card h2{
          margin:0 0 10px;
          font-size:clamp(34px,8vw,54px);
          line-height:1;
          font-weight:1000;
        }

        .gj-battle-summary-grid{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:9px;
          margin:14px 0;
        }

        .gj-battle-summary-box{
          padding:12px 10px;
          border-radius:20px;
          border:3px solid rgba(255,220,168,.95);
          background:rgba(255,248,225,.72);
          font-weight:950;
        }

        .gj-battle-summary-box b{
          display:block;
          font-size:clamp(26px,7vw,38px);
          line-height:1;
          margin-bottom:3px;
        }

        .gj-battle-summary-actions{
          display:grid;
          grid-template-columns:1fr;
          gap:9px;
          margin-top:14px;
        }

        .gj-battle-summary-actions button{
          min-height:50px;
          border-radius:18px;
          border:3px solid rgba(255,199,125,.92);
          background:linear-gradient(180deg,#fff8da,#ffe17a);
          color:#753119;
          font:1000 16px system-ui,sans-serif;
          cursor:pointer;
        }

        @media(max-width:760px){
          .gj-battle-target{
            min-width:62px;
            min-height:72px;
            max-width:76px;
            max-height:88px;
            border-radius:17px;
            border-width:3px;
            padding:5px 4px;
          }

          .gj-battle-target .emoji{
            font-size:30px;
          }

          .gj-battle-target .name{
            max-width:66px;
            font-size:10.5px;
            line-height:1.06;
          }

          .gj-battle-summary-grid{
            grid-template-columns:1fr 1fr;
            gap:7px;
          }
        }

        @media(max-width:390px){
          .gj-battle-summary-grid{
            grid-template-columns:1fr;
          }
        }
      `;

      document.head.appendChild(style);
    }

    function ensureSummaryOverlay(){
      if (runtime.ui.summaryOverlay) return;

      const overlay = document.createElement('div');
      overlay.id = 'summaryOverlay';
      overlay.className = 'gj-battle-summary-overlay';
      overlay.innerHTML = `
        <div id="summaryCard" class="gj-battle-summary-card">
          <h2 id="summaryTitle">Battle Summary</h2>
          <div id="summaryBody"></div>
        </div>
      `;

      document.body.appendChild(overlay);

      runtime.ui.summaryOverlay = overlay;
      runtime.ui.summaryCard = $('#summaryCard', overlay);
      runtime.ui.summaryTitle = $('#summaryTitle', overlay);
      runtime.ui.summaryBody = $('#summaryBody', overlay);
    }

    function ensureCardboardCrosshair(){
      if (state.view !== 'cardboard') return;
      if ($('#gjCardboardCrosshair')) return;

      const cross = document.createElement('div');
      cross.id = 'gjCardboardCrosshair';
      cross.className = 'gj-cardboard-crosshair';
      document.body.appendChild(cross);
    }

    function bindUi(){
      const arena = runtime.ui.arena;

      if (state.view === 'cardboard'){
        ['pointerdown','touchstart','click'].forEach(function(type){
          arena.addEventListener(type, function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            shootCrosshair();
          }, {
            passive:false,
            capture:true
          });

          document.addEventListener(type, function(ev){
            if (state.ended || !state.started) return;
            if (ev.target && ev.target.closest && ev.target.closest('button,a,input,select')) return;

            ev.preventDefault();
            shootCrosshair();
          }, {
            passive:false,
            capture:true
          });
        });
      }

      bindSkill(runtime.ui.btnStorm, 'storm');
      bindSkill(runtime.ui.btnShield, 'shield');
      bindSkill(runtime.ui.btnFreeze, 'freeze');
      bindSkill(runtime.ui.btnHeal, 'heal');

      bindNav(runtime.ui.btnReplay, function(){
        resetForReplay();
      });

      bindNav(runtime.ui.btnLobby, function(){
        location.href = buildLobbyUrl();
      });

      bindNav(runtime.ui.btnModes, function(){
        location.href = buildLauncherUrl();
      });

      bindNav(runtime.ui.btnZone, function(){
        location.href = buildNutritionZoneUrl();
      });

      bindNav(runtime.ui.btnHub, function(){
        location.href = buildHubUrl();
      });

      window.addEventListener('pagehide', function(){
        if (state.ended) return;

        runtime.adapter.updatePlayer({
          status:'left',
          phase:'left',
          left:true,
          quit:true,
          disconnected:true,
          updatedAt:now(),
          lastSeen:now()
        });
      });
    }

    function bindNav(el, handler){
      if (!el || el.dataset.gjBattleCoreBound === '1') return;

      el.dataset.gjBattleCoreBound = '1';
      el.addEventListener('click', function(ev){
        ev.preventDefault();
        handler();
      });
    }

    function bindSkill(el, skill){
      if (!el || el.dataset.gjBattleSkillBound === '1') return;

      el.dataset.gjBattleSkillBound = '1';

      el.addEventListener('click', function(ev){
        ev.preventDefault();
        useSkill(skill);
      });
    }

    function start(){
      if (state.started || state.ended) return runtime;

      state.started = true;
      state.startAt = now();
      state.lastTickAt = now();
      state.lastSpawnAt = 0;
      state.lastSyncAt = 0;

      clearArenaTargets();

      runtime.adapter.updatePlayer({
        status:'in-game',
        phase:'play',
        currentPage:'run',
        currentUrl:location.href,
        matchId:state.matchId,
        roundId:state.matchId,
        left:false,
        quit:false,
        disconnected:false,
        lastSeen:now(),
        heartbeatAt:now(),
        updatedAt:now()
      });

      const tickTimer = setInterval(tick, 250);
      const spawnTimer = setInterval(spawnLoop, 160);
      const syncTimer = setInterval(syncLoop, 650);

      state.timers.push(tickTimer, spawnTimer, syncTimer);

      renderAll();

      emit('gj:battle-started', {
        room:state.room,
        matchId:state.matchId,
        view:state.view
      });

      return runtime;
    }

    function stop(){
      state.timers.forEach(function(id){
        clearInterval(id);
      });

      state.timers = [];
    }

    function tick(){
      if (!state.started || state.ended || state.paused) return;

      const elapsed = Math.floor((now() - state.startAt) / 1000);
      state.timeLeft = Math.max(0, state.duration - elapsed);

      if (state.timeLeft <= 0 || state.hearts <= 0){
        endGame(state.hearts <= 0 ? 'no-hearts' : 'time-up');
        return;
      }

      renderAll();
    }

    function spawnLoop(){
      if (!state.started || state.ended || state.paused) return;

      const currentTargets = $all('.gj-battle-target:not(.hit)', runtime.ui.arena);
      const frozen = now() < state.frozenUntil;
      const spawnMs = frozen ? runtime.diffCfg.spawnMs * 1.65 : runtime.diffCfg.spawnMs;

      if (currentTargets.length >= runtime.diffCfg.maxTargets) return;
      if (now() - state.lastSpawnAt < spawnMs) return;

      state.lastSpawnAt = now();
      spawnTarget();
    }

    function syncLoop(){
      if (!state.started || state.ended) return;
      syncNow('loop');
    }

    function clearArenaTargets(){
      $all('.gj-battle-target', runtime.ui.arena).forEach(function(el){
        el.remove();
      });
    }

    function pickItem(kind){
      const arr = kind === 'junk' ? JUNK_ITEMS : GOOD_ITEMS;
      return arr[Math.floor(state.rng() * arr.length)] || arr[0];
    }

    function spawnTarget(forceKind){
      if (!runtime.ui.arena || state.ended) return null;

      const kind = forceKind || (state.rng() < runtime.diffCfg.goodRate ? 'good' : 'junk');
      const item = pickItem(kind);
      const id = 't_' + (++state.targetSeq) + '_' + now();

      const pos = getSpawnPosition();

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'gj-battle-target target ' + kind;
      el.dataset.kind = kind;
      el.dataset.type = kind;
      el.dataset.targetId = id;
      el.dataset.spawnAt = String(now());

      el.style.left = pos.x + '%';
      el.style.top = pos.y + '%';

      el.innerHTML = `
        <div class="emoji">${escapeHtml(item.emoji)}</div>
        <div class="name">${escapeHtml(item.th || item.name)}</div>
      `;

      ['pointerdown','mousedown','touchstart','click'].forEach(function(type){
        el.addEventListener(type, function(ev){
          ev.preventDefault();
          ev.stopImmediatePropagation();
          hitTarget(el, type);
        }, {
          passive:false,
          capture:true
        });
      });

      runtime.ui.arena.appendChild(el);

      const lifeMs = getTargetLife(kind);

      setTimeout(function(){
        if (!el || !el.isConnected || el.classList.contains('hit') || state.ended) return;

        el.classList.add('hit');

        /*
         * Good หมดเวลา = miss
         * Junk หมดเวลา = ไม่เสีย เพราะไม่ได้แตะ junk
         * ตามนิยาม GoodJunk: miss = good expired + junk hit
         */
        if (kind === 'good'){
          state.miss += 1;
          state.combo = 0;
          floatingText('Miss', el, false);
          syncNow('good-expired');
        }

        renderAll();

        setTimeout(function(){
          el.remove();
        }, 120);
      }, lifeMs);

      emit('gj:battle-target-spawn', {
        id,
        kind,
        item,
        x:pos.x,
        y:pos.y
      });

      return el;
    }

    function getTargetLife(kind){
      let life = runtime.diffCfg.targetLifeMs;

      if (state.view === 'cardboard'){
        life += 650;
      }

      if (kind === 'junk'){
        life += 450;
      }

      if (now() < state.frozenUntil){
        life += 600;
      }

      return life;
    }

    function getSpawnPosition(){
      let safe;

      if (state.view === 'mobile'){
        safe = {
          minX:12,
          maxX:82,
          minY:22,
          maxY:64
        };
      }else if (state.view === 'cardboard'){
        safe = {
          minX:18,
          maxX:82,
          minY:22,
          maxY:68
        };
      }else{
        safe = {
          minX:8,
          maxX:88,
          minY:18,
          maxY:78
        };
      }

      return {
        x:Math.round((safe.minX + state.rng() * (safe.maxX - safe.minX)) * 10) / 10,
        y:Math.round((safe.minY + state.rng() * (safe.maxY - safe.minY)) * 10) / 10
      };
    }

    function hitTarget(target, source){
      if (!target || !target.isConnected || target.classList.contains('hit')) return false;
      if (state.ended) return false;

      const kind =
        target.dataset.kind ||
        target.dataset.type ||
        (target.classList.contains('junk') ? 'junk' : 'good');

      target.classList.add('hit');

      if (kind === 'good'){
        const gain = runtime.diffCfg.goodScore + Math.min(6, state.combo);
        state.score += gain;
        state.good += 1;
        state.combo += 1;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.power = clamp(state.power + 1, 0, 5);

        floatingText('+' + gain, target, true);

        emit('gj:good-collected', {
          score:gain,
          combo:state.combo,
          power:state.power,
          source:source || 'hit'
        });
      }else{
        state.junk += 1;

        if (now() < state.shieldUntil){
          floatingText('BLOCK', target, true);
          emit('gj:junk-blocked', {
            source:source || 'hit'
          });
        }else{
          state.miss += 1;
          state.hearts = Math.max(0, state.hearts - 1);
          state.score = Math.max(0, state.score - runtime.diffCfg.junkPenalty);
          state.combo = 0;

          floatingText('-❤', target, false);

          emit('gj:junk-hit', {
            damage:1,
            penalty:runtime.diffCfg.junkPenalty,
            source:source || 'hit'
          });
        }
      }

      renderAll();
      syncNow('hit-target');

      setTimeout(function(){
        target.remove();
      }, 110);

      if (state.hearts <= 0){
        setTimeout(function(){
          endGame('no-hearts');
        }, 180);
      }

      return true;
    }

    function floatingText(text, target, good){
      if (!runtime.ui.arena || !target) return;

      const a = runtime.ui.arena.getBoundingClientRect();
      const r = target.getBoundingClientRect();

      if (!a.width || !a.height) return;

      const x = ((r.left + r.width / 2 - a.left) / a.width) * 100;
      const y = ((r.top + r.height / 2 - a.top) / a.height) * 100;

      const el = document.createElement('div');
      el.className = 'gj-floating-score ' + (good ? 'good' : 'bad');
      el.textContent = text;
      el.style.left = x + '%';
      el.style.top = y + '%';

      runtime.ui.arena.appendChild(el);

      try{
        el.animate([
          { opacity:1, transform:'translate(-50%,-50%) scale(1)' },
          { opacity:0, transform:'translate(-50%,-145%) scale(1.16)' }
        ], {
          duration:680,
          easing:'ease-out',
          fill:'forwards'
        });
      }catch(_){}

      setTimeout(function(){
        el.remove();
      }, 740);
    }

    function findNearestTargetToCenter(){
      const targets = $all('.gj-battle-target:not(.hit)', runtime.ui.arena);
      if (!targets.length) return null;

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      let best = null;
      let bestDist = Infinity;

      targets.forEach(function(t){
        const r = t.getBoundingClientRect();
        if (!r.width || !r.height) return;

        const tx = r.left + r.width / 2;
        const ty = r.top + r.height / 2;
        const d = Math.hypot(tx - cx, ty - cy);

        if (d < bestDist){
          best = t;
          bestDist = d;
        }
      });

      const threshold = state.view === 'cardboard' ? 92 : 72;

      return best && bestDist <= threshold ? best : null;
    }

    function shootCrosshair(){
      const target = findNearestTargetToCenter();

      if (!target){
        emit('gj:crosshair-miss', {
          view:state.view
        });
        return false;
      }

      return hitTarget(target, 'crosshair');
    }

    function useSkill(skill){
      if (state.ended) return false;

      skill = String(skill || '').toLowerCase();

      if (skill === 'shield'){
        if (state.power < 2){
          floatingSystemText('ต้องมีพลัง 2 เพื่อใช้ Shield');
          return false;
        }

        state.power -= 2;
        state.shieldUntil = now() + 5200;
        floatingSystemText('🛡️ Shield ON');
        renderAll();
        syncNow('skill-shield');
        return true;
      }

      if (skill === 'heal'){
        if (state.power < 3){
          floatingSystemText('ต้องมีพลัง 3 เพื่อ Heal');
          return false;
        }

        state.power -= 3;
        state.hearts = clamp(state.hearts + 1, 0, 3);
        floatingSystemText('💚 Heal +1');
        renderAll();
        syncNow('skill-heal');
        return true;
      }

      if (skill === 'freeze'){
        if (state.power < 3){
          floatingSystemText('ต้องมีพลัง 3 เพื่อ Freeze');
          return false;
        }

        state.power -= 3;
        runtime.adapter.pushEffect({
          type:'freeze',
          durationMs:runtime.diffCfg.freezeMs
        });

        floatingSystemText('❄️ Freeze ส่งไปแล้ว');
        renderAll();
        syncNow('skill-freeze');
        return true;
      }

      if (skill === 'storm'){
        if (state.power < 4){
          floatingSystemText('ต้องมีพลัง 4 เพื่อ Junk Storm');
          return false;
        }

        state.power -= 4;

        runtime.adapter.pushEffect({
          type:'storm',
          count:3
        });

        floatingSystemText('⚡ Junk Storm!');
        renderAll();
        syncNow('skill-storm');
        return true;
      }

      return false;
    }

    function floatingSystemText(text){
      const arena = runtime.ui.arena || document.body;

      const el = document.createElement('div');
      el.className = 'gj-floating-score good';
      el.textContent = text;
      el.style.left = '50%';
      el.style.top = '44%';
      el.style.zIndex = '120';

      arena.appendChild(el);

      try{
        el.animate([
          { opacity:1, transform:'translate(-50%,-50%) scale(1)' },
          { opacity:0, transform:'translate(-50%,-150%) scale(1.12)' }
        ], {
          duration:900,
          easing:'ease-out',
          fill:'forwards'
        });
      }catch(_){}

      setTimeout(function(){
        el.remove();
      }, 960);
    }

    function onRoomUpdate(room){
      if (!room || !Object.keys(room).length) return;

      state.roomData = room;

      const players = safeObj(room.players);
      const my = players[state.pid] || {};
      const opponentEntry = Object.entries(players).find(function(pair){
        return pair[0] !== state.pid && pair[1] && pair[1].left !== true;
      });

      if (opponentEntry){
        const raw = opponentEntry[1] || {};
        state.opponent = raw;
        state.opponentName = raw.name || raw.playerName || raw.displayName || 'คู่แข่ง';
        state.opponentScore = safeNum(raw.score || raw.points, 0);
        state.opponentFinished = !!(raw.finished || raw.done);
      }

      applyEffects(room.effects);

      const phase = String(room.phase || room.status || room.state || '').toLowerCase();

      if (phase === 'summary' && !state.ended){
        endGame('room-summary');
      }

      renderAll();
    }

    function applyEffects(effects){
      effects = safeObj(effects);

      Object.entries(effects).forEach(function(pair){
        const id = pair[0];
        const fx = safeObj(pair[1]);

        if (state.seenEffects[id]) return;
        if (!fx || fx.from === state.pid) return;
        if (fx.matchId && state.matchId && fx.matchId !== state.matchId) return;

        state.seenEffects[id] = true;

        if (fx.type === 'freeze'){
          state.frozenUntil = Math.max(
            state.frozenUntil,
            now() + safeNum(fx.durationMs, runtime.diffCfg.freezeMs)
          );

          floatingSystemText('❄️ ถูก Freeze!');
        }

        if (fx.type === 'storm'){
          const count = clamp(safeNum(fx.count, 3), 1, 5);

          for (let i = 0; i < count; i++){
            setTimeout(function(){
              spawnTarget('junk');
            }, i * 220);
          }

          floatingSystemText('⚡ Junk Storm มาแล้ว!');
        }
      });
    }

    async function syncNow(reason){
      if (!runtime.adapter || !runtime.adapter.roomRef) return false;

      const patch = {
        name:state.name,
        playerName:state.name,
        displayName:state.name,
        pid:state.pid,
        view:state.view,
        device:state.view,
        score:state.score,
        points:state.score,
        good:state.good,
        junk:state.junk,
        miss:state.miss,
        hearts:state.hearts,
        hp:state.hearts,
        lives:state.hearts,
        power:state.power,
        attackPower:state.power,
        combo:state.combo,
        maxCombo:state.maxCombo,
        timeLeft:state.timeLeft,
        status:state.ended ? 'finished' : 'in-game',
        phase:state.ended ? 'summary' : 'play',
        matchId:state.matchId,
        roundId:state.matchId,
        currentPage:state.ended ? 'summary' : 'run',
        left:false,
        quit:false,
        disconnected:false,
        finished:!!state.ended,
        done:!!state.ended,
        updatedAt:now(),
        lastSeen:now(),
        heartbeatAt:now(),
        syncReason:reason || 'sync'
      };

      return runtime.adapter.updatePlayer(patch);
    }

    async function endGame(reason){
      if (state.ended) return runtime;

      state.ended = true;
      state.endAt = now();
      stop();
      clearArenaTargets();

      await syncNow(reason || 'ended');

      const result = computeResult();

      await runtime.adapter.updatePlayer({
        result,
        status:'finished',
        phase:'summary',
        finished:true,
        done:true,
        endedAt:now(),
        endReason:reason || 'ended',
        updatedAt:now()
      });

      await maybeUpdateRoomSummary();

      renderSummary(result, reason || 'ended');

      emit('gj:battle-ended', {
        result,
        score:state.score,
        opponentScore:state.opponentScore,
        reason
      });

      return runtime;
    }

    function computeResult(){
      if (!state.opponent){
        return 'finished';
      }

      if (state.score > state.opponentScore) return 'win';
      if (state.score < state.opponentScore) return 'lose';
      return 'draw';
    }

    async function maybeUpdateRoomSummary(){
      const players = safeObj(state.roomData && state.roomData.players);
      const values = Object.values(players);

      const allFinished =
        values.length >= 2 &&
        values.every(function(p){
          return p && (p.finished || p.done || String(p.status || '') === 'finished');
        });

      if (!allFinished && state.timeLeft > 0) return false;

      return runtime.adapter.updateRoom({
        phase:'summary',
        status:'summary',
        state:'summary',
        summaryAt:now(),
        updatedAt:now()
      });
    }

    function renderSummary(result, reason){
      ensureSummaryOverlay();

      const overlay = runtime.ui.summaryOverlay;
      const title = runtime.ui.summaryTitle;
      const body = runtime.ui.summaryBody;

      const resultText =
        result === 'win' ? 'ชนะ!' :
        result === 'lose' ? 'แพ้รอบนี้' :
        result === 'draw' ? 'เสมอ!' :
        'จบ Battle';

      if (title){
        title.textContent = resultText;
      }

      if (body){
        body.innerHTML = `
          <div style="font-weight:950;color:#9a6a42;margin-bottom:8px;">
            ${escapeHtml(state.name)} vs ${escapeHtml(state.opponentName || 'คู่แข่ง')}
          </div>

          <div class="gj-battle-summary-grid">
            <div class="gj-battle-summary-box">
              <b>${state.score}</b>
              คะแนนของฉัน
            </div>
            <div class="gj-battle-summary-box">
              <b>${state.opponentScore || 0}</b>
              คะแนนคู่แข่ง
            </div>
            <div class="gj-battle-summary-box">
              <b>${state.good}</b>
              Good
            </div>
            <div class="gj-battle-summary-box">
              <b>${state.miss}</b>
              Miss
            </div>
            <div class="gj-battle-summary-box">
              <b>${state.maxCombo}</b>
              Max Combo
            </div>
            <div class="gj-battle-summary-box">
              <b>${state.hearts}</b>
              Hearts
            </div>
          </div>

          <div style="font-size:13px;font-weight:850;color:#9a6a42;line-height:1.35;">
            เหตุผลจบเกม: ${escapeHtml(reason || 'ended')}<br>
            Room: ${escapeHtml(state.room)} • Match: ${escapeHtml(state.matchId)}
          </div>

          <div class="gj-battle-summary-actions">
            <button type="button" data-action="lobby">กลับ Battle Lobby</button>
            <button type="button" data-action="modes">โหมดทั้งหมด</button>
            <button type="button" data-action="zone">Nutrition Zone</button>
            <button type="button" data-action="hub">Hub</button>
          </div>
        `;

        $all('[data-action]', body).forEach(function(btn){
          const action = btn.getAttribute('data-action');

          btn.addEventListener('click', function(){
            if (action === 'lobby') location.href = buildLobbyUrl();
            if (action === 'modes') location.href = buildLauncherUrl();
            if (action === 'zone') location.href = buildNutritionZoneUrl();
            if (action === 'hub') location.href = buildHubUrl();
          });
        });
      }

      overlay.classList.add('show');
    }

    function resetForReplay(){
      location.href = buildLobbyUrl();
    }

    function renderAll(){
      renderHud();
      renderSkills();
    }

    function renderHud(){
      if (runtime.ui.timer) runtime.ui.timer.textContent = String(Math.ceil(state.timeLeft));
      if (runtime.ui.score) runtime.ui.score.textContent = String(state.score);
      if (runtime.ui.good) runtime.ui.good.textContent = 'Good ' + state.good;
      if (runtime.ui.junk) runtime.ui.junk.textContent = 'Junk ' + state.junk;
      if (runtime.ui.miss) runtime.ui.miss.textContent = 'Miss ' + state.miss;

      if (runtime.ui.hearts){
        const h = clamp(state.hearts, 0, 3);
        runtime.ui.hearts.textContent = '❤'.repeat(h) + '♡'.repeat(3 - h);
      }

      if (runtime.ui.power){
        runtime.ui.power.textContent = 'Power ' + state.power + '/5';
      }

      if (runtime.ui.powerFill){
        runtime.ui.powerFill.style.width = ((state.power / 5) * 100) + '%';
      }

      if (runtime.ui.playerName) runtime.ui.playerName.textContent = state.name;
      if (runtime.ui.opponentName) runtime.ui.opponentName.textContent = state.opponentName || 'คู่แข่ง';
      if (runtime.ui.opponentScore) runtime.ui.opponentScore.textContent = String(state.opponentScore || 0);

      if (runtime.ui.opponentStatus){
        runtime.ui.opponentStatus.textContent = state.opponentFinished ? 'Finished' : 'Playing';
      }

      if (runtime.ui.roomBadge) runtime.ui.roomBadge.textContent = 'Room ' + (state.room || '-');
      if (runtime.ui.matchBadge) runtime.ui.matchBadge.textContent = 'Match ' + (state.matchId || '-');

      window.GJ_BATTLE_STATE = {
        version:CORE_VERSION,
        pid:state.pid,
        name:state.name,
        room:state.room,
        matchId:state.matchId,
        view:state.view,
        score:state.score,
        myScore:state.score,
        points:state.score,
        good:state.good,
        junk:state.junk,
        miss:state.miss,
        hearts:state.hearts,
        hp:state.hearts,
        lives:state.hearts,
        power:state.power,
        attackPower:state.power,
        combo:state.combo,
        maxCombo:state.maxCombo,
        timeLeft:state.timeLeft,
        ended:state.ended
      };
    }

    function renderSkills(){
      setSkillEnabled(runtime.ui.btnShield, state.power >= 2);
      setSkillEnabled(runtime.ui.btnHeal, state.power >= 3 && state.hearts < 3);
      setSkillEnabled(runtime.ui.btnFreeze, state.power >= 3);
      setSkillEnabled(runtime.ui.btnStorm, state.power >= 4);
    }

    function setSkillEnabled(el, enabled){
      if (!el) return;

      el.disabled = !enabled;
      el.classList.toggle('is-ready', !!enabled);
    }

    function copyCommonParams(out){
      [
        'studyId',
        'conditionGroup',
        'api',
        'log'
      ].forEach(function(k){
        const v = params.get(k);
        if (v !== null && v !== '') out.searchParams.set(k, v);
      });

      out.searchParams.set('pid', state.pid);
      out.searchParams.set('name', state.name);
      out.searchParams.set('diff', state.diff);
      out.searchParams.set('time', String(state.duration));
      out.searchParams.set('view', state.view);
      out.searchParams.set('device', state.view);
      out.searchParams.set('zone', 'nutrition');
      out.searchParams.set('cat', 'nutrition');
      out.searchParams.set('game', 'goodjunk');
      out.searchParams.set('gameId', 'goodjunk');

      if (params.get('hub')){
        out.searchParams.set('hub', params.get('hub'));
      }

      return out;
    }

    function buildLobbyUrl(){
      const out = new URL('./goodjunk-battle-v2-lobby.html', location.href);

      copyCommonParams(out);

      if (state.room){
        out.searchParams.set('room', state.room);
        out.searchParams.set('roomCode', state.room);
      }

      out.searchParams.set('from', 'battle-core-summary');
      out.searchParams.set('t', String(now()));

      return out.toString();
    }

    function buildLauncherUrl(){
      const out = new URL('../goodjunk-launcher.html', location.href);
      copyCommonParams(out);

      out.searchParams.delete('room');
      out.searchParams.delete('roomCode');
      out.searchParams.delete('matchId');
      out.searchParams.delete('roundId');
      out.searchParams.delete('runId');

      out.searchParams.set('from', 'battle-core-summary');
      out.searchParams.set('t', String(now()));

      return out.toString();
    }

    function buildNutritionZoneUrl(){
      const out = new URL('../nutrition-zone.html', location.href);
      copyCommonParams(out);

      out.searchParams.delete('room');
      out.searchParams.delete('roomCode');
      out.searchParams.delete('matchId');
      out.searchParams.delete('roundId');
      out.searchParams.delete('runId');

      out.searchParams.set('from', 'battle-core-summary');
      out.searchParams.set('t', String(now()));

      return out.toString();
    }

    function buildHubUrl(){
      const hub = params.get('hub');

      if (hub){
        try{
          const out = new URL(hub, location.href);
          if (!out.searchParams.get('pid')) out.searchParams.set('pid', state.pid);
          if (!out.searchParams.get('name')) out.searchParams.set('name', state.name);
          if (!out.searchParams.get('view')) out.searchParams.set('view', state.view);
          return out.toString();
        }catch(_){}
      }

      const out = new URL('../hub.html', location.href);
      copyCommonParams(out);

      return out.toString();
    }
  }

  let singleton = null;

  async function autoBoot(){
    if (window.GJ_BATTLE_V25_DISABLE_AUTOBOOT) return;

    const path = location.pathname || '';

    if (!/goodjunk-battle-v2-run-(pc|mobile|cardboard)\.html/i.test(path)){
      return;
    }

    singleton = createRuntime();
    await singleton.init();
    singleton.start();
  }

  window.GJ_BATTLE_V25_CORE = {
    version:CORE_VERSION,
    createRuntime,
    getRuntime:function(){
      return singleton;
    },
    normalizeRoomCode,
    normalizeView,
    makeRng
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoBoot, { once:true });
  }else{
    autoBoot();
  }

  console.info('[GoodJunk Battle Core]', CORE_VERSION, 'loaded');
})();