// === /herohealth/hydration-vr/hydration-modes.js ===
// Hydration Arena Modes Layer
// PATCH v20260502-HYDRATION-ARENA-MODES-V1
//
// Adds:
// ✅ 5 modes: solo / duet / race / battle / coop
// ✅ Auto Role assignment
// ✅ Mode-specific mission framing
// ✅ Battle mission-unlock attack system
// ✅ Race water-goal sprint panel
// ✅ Coop team tank + crisis panel
// ✅ Duet role-sync panel
// ✅ Summary augmentation
// ✅ Safe non-breaking DOM overlay; does not require editing hydration-vr.js internals

'use strict';

(function HydrationArenaModes(){
  const VERSION = '20260502-HYDRATION-ARENA-MODES-V1';

  const MODE_ALIASES = {
    solo: 'solo',
    single: 'solo',
    play: 'solo',

    duet: 'duet',
    buddy: 'duet',
    pair: 'duet',

    race: 'race',
    sprint: 'race',

    battle: 'battle',
    storm: 'battle',
    arena: 'battle',

    coop: 'coop',
    co_op: 'coop',
    team: 'coop',
    rescue: 'coop'
  };

  const ROLE_MAP = {
    solo: ['hero'],
    duet: ['collector', 'guardian'],
    race: ['sprinter', 'booster', 'safe_runner'],
    battle: ['storm_maker', 'shield_keeper'],
    coop: ['collector', 'guardian', 'cleaner', 'booster']
  };

  const ROLE_INFO = {
    hero: {
      icon: '💧',
      title: 'Hydration Hero',
      short: 'ฮีโร่ดูแลน้ำ',
      mission: 'เก็บน้ำดี เก็บโล่ บล็อกสายฟ้า และรักษาระดับน้ำให้รอดจนจบ'
    },
    collector: {
      icon: '💧',
      title: 'Water Collector',
      short: 'คนเก็บน้ำ',
      mission: 'เก็บน้ำดี เติม Team Water และสร้างคอมโบให้ทีม'
    },
    guardian: {
      icon: '🛡️',
      title: 'Shield Guardian',
      short: 'ผู้พิทักษ์โล่',
      mission: 'เก็บโล่ บล็อกสายฟ้า และลดความเสี่ยงของทีม'
    },
    cleaner: {
      icon: '🧼',
      title: 'Clean Drop Cleaner',
      short: 'ผู้เคลียร์ของหลอก',
      mission: 'ล้างของหลอก เคลียร์ภัย และช่วยให้ทีมเล่นง่ายขึ้น'
    },
    booster: {
      icon: '⚡',
      title: 'Boost Runner',
      short: 'สายบูสต์',
      mission: 'เก็บโบนัส เพิ่มเวลา เพิ่มพลัง และเร่งคอมโบทีม'
    },
    sprinter: {
      icon: '🏃',
      title: 'Water Sprinter',
      short: 'นักวิ่งน้ำ',
      mission: 'เติม Water ให้ถึงเป้าหมายเร็วที่สุด'
    },
    safe_runner: {
      icon: '🌈',
      title: 'Safe Runner',
      short: 'สายปลอดภัย',
      mission: 'วิ่งให้ไว แต่ต้องลด Miss และรักษา Water ให้มั่นคง'
    },
    storm_maker: {
      icon: '🌩️',
      title: 'Storm Maker',
      short: 'ผู้สร้างพายุ',
      mission: 'ทำภารกิจเพื่อปลดล็อกพายุ แล้วส่งไปท้าทายคู่แข่ง'
    },
    shield_keeper: {
      icon: '🛡️',
      title: 'Shield Keeper',
      short: 'ผู้กันพายุ',
      mission: 'เก็บโล่ บล็อกพายุ และสวนกลับเมื่อป้องกันสำเร็จ'
    }
  };

  const MODE_INFO = {
    solo: {
      icon: '💧',
      title: 'Solo Survival',
      label: 'Solo',
      sub: 'เอาตัวรอดคนเดียว เก็บน้ำดี ป้องกันสายฟ้า และรักษาระดับน้ำให้สูงจนจบ'
    },
    duet: {
      icon: '🤝',
      title: 'Duet Buddy',
      label: 'Duet',
      sub: 'เล่นเป็นคู่ แบ่งหน้าที่คนเก็บน้ำและคนป้องกันภัย'
    },
    race: {
      icon: '🏁',
      title: 'Water Sprint Race',
      label: 'Race',
      sub: 'แข่งเติม Water ให้ถึงเป้าหมายก่อน หมดเวลาให้ดูอันดับจาก Water และคะแนน'
    },
    battle: {
      icon: '🌩️',
      title: 'Storm Battle',
      label: 'Battle',
      sub: 'ทำภารกิจ ปลดล็อกสกิลพายุ แล้วส่งไปท้าทายคู่แข่ง'
    },
    coop: {
      icon: '🚰',
      title: 'Team Water Rescue',
      label: 'Coop',
      sub: 'ร่วมมือกันรักษาถังน้ำรวม ผ่าน Crisis และช่วยทีมให้รอด'
    }
  };

  const BATTLE_ATTACKS = {
    cloud_fog: {
      icon: '🌫️',
      name: 'Cloud Fog',
      desc: 'ส่งเมฆบังจอบางส่วน',
      missionText: 'ทำ Combo x5',
      stat: 'combo',
      target: 5,
      durationMs: 4200,
      cooldownMs: 8000,
      effectClass: 'hydr-attack-cloud'
    },
    lightning_lane: {
      icon: '⚡',
      name: 'Lightning Lane',
      desc: 'ส่งสายฟ้าลง 1 เลน',
      missionText: 'บล็อกสายฟ้า 2 ครั้ง',
      stat: 'block',
      target: 2,
      durationMs: 3400,
      cooldownMs: 9000,
      effectClass: 'hydr-attack-lightning'
    },
    fake_water: {
      icon: '💧',
      name: 'Fake Water',
      desc: 'เพิ่มน้ำหลอกให้คู่แข่ง',
      missionText: 'ทำ Combo x8',
      stat: 'combo',
      target: 8,
      durationMs: 5200,
      cooldownMs: 10000,
      effectClass: 'hydr-attack-fake'
    },
    storm_rush: {
      icon: '🌪️',
      name: 'Storm Rush',
      desc: 'ทำให้ bubble ฝั่งคู่แข่งเร็วขึ้น',
      missionText: 'คะแนน 350+ และ Miss ไม่เกิน 2',
      stat: 'score_safe',
      target: 350,
      maxMiss: 2,
      durationMs: 4800,
      cooldownMs: 11000,
      effectClass: 'hydr-attack-rush'
    },
    dry_wind: {
      icon: '🧂',
      name: 'Dry Wind',
      desc: 'ลด Water ช้า ๆ ถ้าไม่มีโล่',
      missionText: 'Water 70%+',
      stat: 'water',
      target: 70,
      durationMs: 4600,
      cooldownMs: 11000,
      effectClass: 'hydr-attack-dry'
    },
    final_storm: {
      icon: '🌩️',
      name: 'Final Storm',
      desc: 'พายุใหญ่ ใช้ได้ครั้งเดียวต่อรอบ',
      missionText: 'ปลดล็อก Attack อย่างน้อย 3 ชนิด',
      stat: 'unlocked_attacks',
      target: 3,
      durationMs: 6000,
      cooldownMs: 999999,
      once: true,
      effectClass: 'hydr-attack-final'
    }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function clamp(n, a, b){
    n = Number(n);
    if(!Number.isFinite(n)) n = 0;
    return Math.max(a, Math.min(b, n));
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function textOf(id, fallback = ''){
    const el = document.getElementById(id);
    return el ? String(el.textContent || '').trim() : fallback;
  }

  function numOf(id, fallback = 0){
    const raw = textOf(id, '');
    const m = raw.replace(/[,%]/g, '').match(/-?\d+(\.\d+)?/);
    if(!m) return fallback;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : fallback;
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = String(value);
  }

  function qs(){
    try { return new URL(location.href).searchParams; }
    catch(e){ return new URLSearchParams(); }
  }

  function getParam(name, fallback = ''){
    const p = qs();
    return p.get(name) ?? fallback;
  }

  function normalizeMode(raw){
    raw = String(raw || '').trim().toLowerCase();
    return MODE_ALIASES[raw] || 'solo';
  }

  function getMode(){
    return normalizeMode(
      getParam('mode') ||
      getParam('entry') ||
      getParam('recommendedMode') ||
      getParam('run') ||
      'solo'
    );
  }

  function getSeed(){
    const raw = getParam('seed') || getParam('room') || getParam('roomId') || Date.now();
    const s = String(raw);
    let h = 0;
    for(let i = 0; i < s.length; i++){
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h || Number(raw) || 1);
  }

  function getPlayerIndex(){
    const explicit =
      getParam('playerIndex') ||
      getParam('pidx') ||
      getParam('slot') ||
      '';

    if(explicit !== ''){
      return clamp(parseInt(explicit, 10) || 0, 0, 9);
    }

    const pid = getParam('pid') || getParam('student_id') || getParam('name') || 'anon';
    let h = 0;
    for(let i = 0; i < pid.length; i++){
      h = ((h << 5) - h + pid.charCodeAt(i)) | 0;
    }

    const mode = getMode();
    const max = (ROLE_MAP[mode] || ROLE_MAP.solo).length;
    return Math.abs(h) % Math.max(1, max);
  }

  function assignRole(mode, playerIndex, seed){
    const roles = ROLE_MAP[mode] || ROLE_MAP.solo;
    if(mode === 'solo') return 'hero';

    const stableRole = getParam('role', '').trim().toLowerCase();
    if(stableRole && ROLE_INFO[stableRole]) return stableRole;

    if(mode === 'duet'){
      return roles[playerIndex % roles.length];
    }

    const offset = seed % roles.length;
    return roles[(playerIndex + offset) % roles.length];
  }

  function currentStats(){
    return {
      score: numOf('uiScore', 0),
      miss: numOf('uiMiss', 0),
      expire: numOf('uiExpire', 0),
      block: numOf('uiBlock', 0),
      water: numOf('uiWater', 0),
      combo: numOf('uiCombo', 0),
      shield: numOf('uiShield', 0),
      grade: textOf('uiGrade', 'D'),
      timeText: textOf('uiTime', '00:00'),
      phase: textOf('uiPhase', '-')
    };
  }

  const state = {
    version: VERSION,
    mode: getMode(),
    seed: getSeed(),
    playerIndex: getPlayerIndex(),
    role: null,
    startedAt: Date.now(),
    lastStats: {},
    battle: {
      unlocked: {},
      used: {},
      ready: {},
      cooldownUntil: {},
      finalUsed: false,
      attackLog: []
    },
    race: {
      goal: 100,
      finished: false,
      finishedAt: null,
      bestWater: 0
    },
    coop: {
      tank: 80,
      crisis: false,
      crisisCount: 0,
      crisisSaved: 0,
      lastCrisisAt: 0
    },
    duet: {
      sync: 0,
      roleContribution: 0
    },
    summaryInjected: false
  };

  state.role = assignRole(state.mode, state.playerIndex, state.seed);

  function injectStyle(){
    if(document.getElementById('hydrArenaModeStyle')) return;

    const style = document.createElement('style');
    style.id = 'hydrArenaModeStyle';
    style.textContent = `
      .hydr-arena-panel{
        display:grid;
        gap:12px;
      }

      .hydr-arena-head{
        display:flex;
        gap:12px;
        align-items:center;
        justify-content:space-between;
        flex-wrap:wrap;
      }

      .hydr-arena-title{
        display:flex;
        gap:10px;
        align-items:center;
        min-width:0;
      }

      .hydr-arena-icon{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        border-radius:18px;
        font-size:26px;
        background:linear-gradient(180deg,rgba(103,232,249,.28),rgba(37,99,235,.22));
        border:1px solid rgba(255,255,255,.14);
        box-shadow:0 12px 28px rgba(0,0,0,.14);
      }

      .hydr-arena-copy{
        min-width:0;
      }

      .hydr-arena-copy .k{
        font-size:12px;
        color:#bfdbfe;
        font-weight:1000;
        letter-spacing:.04em;
      }

      .hydr-arena-copy .v{
        font-size:18px;
        line-height:1.15;
        font-weight:1100;
      }

      .hydr-arena-copy .s{
        margin-top:2px;
        font-size:12px;
        color:#dbeafe;
        line-height:1.35;
      }

      .hydr-arena-chips{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .hydr-arena-chip{
        padding:8px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.12);
        font-size:12px;
        font-weight:1000;
        color:#fff;
      }

      .hydr-arena-dynamic{
        display:grid;
        gap:10px;
      }

      .hydr-mode-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .hydr-mode-box{
        padding:10px 12px;
        border-radius:18px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.10);
        min-height:72px;
      }

      .hydr-mode-box .k{
        color:#bfdbfe;
        font-size:11px;
        font-weight:1000;
      }

      .hydr-mode-box .v{
        margin-top:4px;
        font-size:18px;
        font-weight:1100;
      }

      .hydr-progress{
        width:100%;
        height:12px;
        border-radius:999px;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.10);
        overflow:hidden;
      }

      .hydr-progress > i{
        display:block;
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#22d3ee,#60a5fa,#34d399);
        transition:width .18s ease;
      }

      .hydr-progress.warn > i{
        background:linear-gradient(90deg,#fb7185,#fbbf24);
      }

      .hydr-battle-attacks{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .hydr-attack-card{
        display:grid;
        gap:7px;
        padding:10px;
        border-radius:18px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.10);
        min-height:132px;
      }

      .hydr-attack-card.ready{
        outline:2px solid rgba(52,211,153,.42);
        background:rgba(52,211,153,.10);
      }

      .hydr-attack-card.cooldown{
        opacity:.72;
      }

      .hydr-attack-card.used-final{
        opacity:.55;
        filter:grayscale(.4);
      }

      .hydr-attack-top{
        display:flex;
        gap:8px;
        align-items:flex-start;
      }

      .hydr-attack-icon{
        width:34px;
        height:34px;
        border-radius:14px;
        display:grid;
        place-items:center;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.10);
        flex:0 0 auto;
      }

      .hydr-attack-name{
        font-size:13px;
        font-weight:1100;
        line-height:1.1;
      }

      .hydr-attack-desc{
        margin-top:2px;
        color:#bfdbfe;
        font-size:11px;
        line-height:1.2;
      }

      .hydr-attack-mission{
        font-size:11px;
        color:#dbeafe;
        line-height:1.25;
      }

      .hydr-attack-btn{
        min-height:34px;
        border-radius:12px;
        color:#fff;
        font-weight:1100;
        background:linear-gradient(180deg,#22d3ee,#2563eb);
        box-shadow:0 8px 18px rgba(37,99,235,.20);
      }

      .hydr-attack-btn[disabled]{
        cursor:not-allowed;
        opacity:.55;
        background:rgba(255,255,255,.10);
        box-shadow:none;
      }

      .hydr-role-toast{
        position:fixed;
        inset:0;
        z-index:1800;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(2,6,23,.50);
        backdrop-filter:blur(10px);
        animation:hydrRoleBg 3.2s ease forwards;
        pointer-events:none;
      }

      .hydr-role-card{
        width:min(92vw,520px);
        padding:18px;
        border-radius:28px;
        background:linear-gradient(180deg,rgba(13,24,47,.96),rgba(9,17,36,.96));
        border:1px solid rgba(255,255,255,.16);
        box-shadow:0 24px 64px rgba(0,0,0,.34);
        text-align:center;
        animation:hydrRolePop 3.2s ease forwards;
      }

      .hydr-role-big{
        font-size:52px;
        line-height:1;
      }

      .hydr-role-title{
        margin-top:8px;
        font-size:26px;
        font-weight:1100;
      }

      .hydr-role-sub{
        margin-top:6px;
        color:#bfdbfe;
        line-height:1.45;
        font-size:14px;
      }

      @keyframes hydrRoleBg{
        0%,78%{ opacity:1; }
        100%{ opacity:0; visibility:hidden; }
      }

      @keyframes hydrRolePop{
        0%{ opacity:0; transform:translateY(14px) scale(.94); }
        12%,76%{ opacity:1; transform:translateY(0) scale(1); }
        100%{ opacity:0; transform:translateY(-14px) scale(.98); }
      }

      .hydr-attack-vfx{
        position:absolute;
        inset:0;
        z-index:30;
        pointer-events:none;
        overflow:hidden;
        border-radius:28px;
      }

      .hydr-attack-vfx .label{
        position:absolute;
        left:50%;
        top:18%;
        transform:translateX(-50%);
        padding:10px 14px;
        border-radius:999px;
        background:rgba(7,18,38,.84);
        border:1px solid rgba(255,255,255,.14);
        color:#fff;
        font-size:13px;
        font-weight:1100;
        box-shadow:0 12px 28px rgba(0,0,0,.24);
        animation:hydrVfxLabel 1.6s ease forwards;
      }

      @keyframes hydrVfxLabel{
        0%{ opacity:0; transform:translateX(-50%) translateY(8px); }
        18%,80%{ opacity:1; transform:translateX(-50%) translateY(0); }
        100%{ opacity:0; transform:translateX(-50%) translateY(-12px); }
      }

      .hydr-cloud{
        position:absolute;
        width:180px;
        height:90px;
        border-radius:999px;
        background:rgba(255,255,255,.26);
        filter:blur(2px);
        animation:hydrCloudMove 4.2s ease-in-out forwards;
      }

      .hydr-cloud::before,
      .hydr-cloud::after{
        content:"";
        position:absolute;
        border-radius:999px;
        background:rgba(255,255,255,.30);
      }

      .hydr-cloud::before{
        width:82px;
        height:82px;
        left:26px;
        top:-32px;
      }

      .hydr-cloud::after{
        width:92px;
        height:92px;
        right:24px;
        top:-36px;
      }

      @keyframes hydrCloudMove{
        from{ opacity:0; transform:translateX(-20px); }
        15%,82%{ opacity:1; }
        to{ opacity:0; transform:translateX(40px); }
      }

      .hydr-lightning-line{
        position:absolute;
        top:0;
        bottom:0;
        width:5px;
        background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(250,204,21,.86),transparent);
        box-shadow:0 0 18px rgba(255,255,255,.7),0 0 28px rgba(250,204,21,.48);
        animation:hydrLightning 1.1s ease-in-out 3;
      }

      @keyframes hydrLightning{
        0%,100%{ opacity:.25; transform:scaleY(.78); }
        50%{ opacity:1; transform:scaleY(1); }
      }

      .hydr-fake-drop{
        position:absolute;
        width:64px;
        height:64px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:rgba(251,191,36,.22);
        border:1px solid rgba(255,255,255,.18);
        font-size:28px;
        animation:hydrFakeDrop 4.2s ease forwards;
      }

      @keyframes hydrFakeDrop{
        0%{ opacity:0; transform:scale(.7); }
        16%,82%{ opacity:1; transform:scale(1); }
        100%{ opacity:0; transform:scale(.92) translateY(-20px); }
      }

      .hydr-rush-lines{
        position:absolute;
        inset:0;
        background:
          repeating-linear-gradient(115deg,rgba(255,255,255,.0) 0 18px,rgba(255,255,255,.18) 18px 22px);
        animation:hydrRush 4.2s linear forwards;
      }

      @keyframes hydrRush{
        from{ opacity:0; background-position:0 0; }
        18%,82%{ opacity:1; }
        to{ opacity:0; background-position:220px 0; }
      }

      .hydr-dry-wind{
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at 22% 24%,rgba(251,191,36,.18),transparent 22%),
          radial-gradient(circle at 72% 68%,rgba(251,113,133,.16),transparent 24%),
          linear-gradient(90deg,rgba(251,191,36,.08),rgba(251,113,133,.08));
        animation:hydrDry 4.4s ease forwards;
      }

      @keyframes hydrDry{
        0%{ opacity:0; filter:saturate(1); }
        18%,82%{ opacity:1; filter:saturate(.75); }
        100%{ opacity:0; filter:saturate(1); }
      }

      .hydr-final-storm{
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at 50% 30%,rgba(250,204,21,.25),transparent 24%),
          radial-gradient(circle at 30% 70%,rgba(34,211,238,.22),transparent 26%),
          radial-gradient(circle at 75% 72%,rgba(251,113,133,.18),transparent 28%),
          rgba(2,6,23,.16);
        animation:hydrFinalStorm 5.8s ease forwards;
      }

      @keyframes hydrFinalStorm{
        0%{ opacity:0; transform:scale(1); }
        14%,86%{ opacity:1; transform:scale(1.02); }
        100%{ opacity:0; transform:scale(1); }
      }

      .hydr-mini-ribbon{
        position:fixed;
        left:50%;
        top:18px;
        transform:translateX(-50%);
        z-index:1700;
        max-width:min(92vw,520px);
        padding:10px 14px;
        border-radius:999px;
        background:rgba(7,18,38,.88);
        border:1px solid rgba(255,255,255,.14);
        color:#fff;
        font-size:13px;
        font-weight:1100;
        text-align:center;
        box-shadow:0 12px 28px rgba(0,0,0,.22);
        animation:hydrRibbon 2.1s ease forwards;
        pointer-events:none;
      }

      @keyframes hydrRibbon{
        0%{ opacity:0; transform:translateX(-50%) translateY(-10px); }
        12%,82%{ opacity:1; transform:translateX(-50%) translateY(0); }
        100%{ opacity:0; transform:translateX(-50%) translateY(-12px); }
      }

      @media (max-width: 720px){
        .hydr-mode-grid,
        .hydr-battle-attacks{
          grid-template-columns:1fr;
        }

        .hydr-arena-head{
          align-items:flex-start;
        }

        .hydr-arena-chips{
          width:100%;
          justify-content:flex-start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createPanel(){
    if(document.getElementById('hydrArenaModePanel')) return;

    const info = MODE_INFO[state.mode] || MODE_INFO.solo;
    const role = ROLE_INFO[state.role] || ROLE_INFO.hero;

    const wrap = document.createElement('section');
    wrap.id = 'hydrArenaModePanel';
    wrap.className = 'panel pad hydr-arena-panel';
    wrap.innerHTML = `
      <div class="hydr-arena-head">
        <div class="hydr-arena-title">
          <div class="hydr-arena-icon">${esc(info.icon)}</div>
          <div class="hydr-arena-copy">
            <div class="k">HYDRATION ARENA MODE</div>
            <div class="v">${esc(info.title)}</div>
            <div class="s">${esc(info.sub)}</div>
          </div>
        </div>

        <div class="hydr-arena-chips">
          <div class="hydr-arena-chip">Mode: <span id="hydrModeChip">${esc(info.label)}</span></div>
          <div class="hydr-arena-chip">Role: <span id="hydrRoleChip">${esc(role.icon)} ${esc(role.short)}</span></div>
          <div class="hydr-arena-chip">Seed: <span id="hydrSeedChip">${esc(String(state.seed).slice(-5))}</span></div>
        </div>
      </div>

      <div id="hydrArenaDynamic" class="hydr-arena-dynamic"></div>
    `;

    const grid = $('.grid-main');
    const page = $('.hydr-page') || document.body;

    if(grid && grid.parentElement){
      grid.parentElement.insertBefore(wrap, grid);
    }else{
      page.insertBefore(wrap, page.firstChild);
    }
  }

  function showRoleToast(){
    const role = ROLE_INFO[state.role] || ROLE_INFO.hero;
    const info = MODE_INFO[state.mode] || MODE_INFO.solo;

    const old = document.getElementById('hydrRoleToast');
    if(old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'hydrRoleToast';
    toast.className = 'hydr-role-toast';
    toast.innerHTML = `
      <div class="hydr-role-card">
        <div class="hydr-role-big">${esc(role.icon)}</div>
        <div class="hydr-role-title">คุณคือ ${esc(role.title)}</div>
        <div class="hydr-role-sub">
          โหมด ${esc(info.label)}<br>
          ${esc(role.mission)}
        </div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
  }

  function ribbon(message){
    const el = document.createElement('div');
    el.className = 'hydr-mini-ribbon';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  function applyHeaderText(){
    const modeInfo = MODE_INFO[state.mode] || MODE_INFO.solo;
    const role = ROLE_INFO[state.role] || ROLE_INFO.hero;

    setText('hhPlayerHint', `Hydration Arena • ${modeInfo.label}`);
    setText('hhViewText', `${getParam('view', 'mobile')} • ${modeInfo.label}`);

    const playerName = document.getElementById('hhPlayerName');
    if(playerName && !playerName.dataset.hydArenaNameApplied){
      const name = getParam('name') || getParam('nick') || getParam('student_name') || playerName.textContent || 'Player';
      playerName.textContent = `${name} • ${role.icon} ${role.short}`;
      playerName.dataset.hydArenaNameApplied = '1';
    }
  }

  function applyMissionLabels(){
    const rows = $$('.mission-row');

    const setRow = (idx, label, chip) => {
      const row = rows[idx];
      if(!row) return;
      const first = row.children[0];
      const badge = row.children[2];
      if(first) first.textContent = label;
      if(badge) badge.textContent = chip || 'MISSION';
    };

    if(state.mode === 'solo'){
      setRow(0, 'เก็บน้ำดีให้ถึงเป้า', 'SURVIVE');
      setRow(1, 'บล็อกสายฟ้า', 'SHIELD');
      setRow(2, 'ทำคอมโบ', 'COMBO');
    }

    if(state.mode === 'duet'){
      setRow(0, 'Role Mission ของฉัน', 'ROLE');
      setRow(1, 'ช่วยทีมป้องกันภัย', 'TEAM');
      setRow(2, 'Team Sync Combo', 'SYNC');
    }

    if(state.mode === 'race'){
      setRow(0, 'เติม Water ให้ถึงเส้นชัย', 'RACE');
      setRow(1, 'เก็บ Boost / Shield', 'BOOST');
      setRow(2, 'Miss ให้น้อยที่สุด', 'FAST');
    }

    if(state.mode === 'battle'){
      setRow(0, 'ปลดล็อกสกิลพายุ', 'UNLOCK');
      setRow(1, 'ป้องกัน / สวนกลับ', 'COUNTER');
      setRow(2, 'Combo เพื่อชาร์จพลัง', 'STORM');
    }

    if(state.mode === 'coop'){
      setRow(0, 'เติม Team Tank', 'TEAM');
      setRow(1, 'บล็อก Crisis', 'RESCUE');
      setRow(2, 'ทุกคนช่วยกันทำคอมโบ', 'COOP');
    }
  }

  function renderDynamicBase(){
    const root = document.getElementById('hydrArenaDynamic');
    if(!root) return;

    const role = ROLE_INFO[state.role] || ROLE_INFO.hero;

    if(state.mode === 'solo'){
      root.innerHTML = `
        <div class="hydr-mode-grid">
          <div class="hydr-mode-box">
            <div class="k">ROLE</div>
            <div class="v">${esc(role.icon)} ${esc(role.short)}</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">GOAL</div>
            <div class="v">Water 70%+</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">STYLE</div>
            <div class="v">Survival</div>
          </div>
        </div>
      `;
    }

    if(state.mode === 'duet'){
      root.innerHTML = `
        <div class="hydr-mode-grid">
          <div class="hydr-mode-box">
            <div class="k">MY ROLE</div>
            <div class="v">${esc(role.icon)} ${esc(role.short)}</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">TEAM SYNC</div>
            <div class="v"><span id="hydrDuetSync">0</span>%</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">ROLE CONTRIBUTION</div>
            <div class="v"><span id="hydrDuetContrib">0</span></div>
          </div>
        </div>
        <div class="hydr-progress"><i id="hydrDuetSyncBar"></i></div>
      `;
    }

    if(state.mode === 'race'){
      root.innerHTML = `
        <div class="hydr-mode-grid">
          <div class="hydr-mode-box">
            <div class="k">RACE STYLE</div>
            <div class="v">${esc(role.icon)} ${esc(role.short)}</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">WATER GOAL</div>
            <div class="v"><span id="hydrRaceGoal">100</span>%</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">RACE STATUS</div>
            <div class="v" id="hydrRaceStatus">Racing</div>
          </div>
        </div>
        <div class="hydr-progress"><i id="hydrRaceBar"></i></div>
      `;
    }

    if(state.mode === 'coop'){
      root.innerHTML = `
        <div class="hydr-mode-grid">
          <div class="hydr-mode-box">
            <div class="k">MY ROLE</div>
            <div class="v">${esc(role.icon)} ${esc(role.short)}</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">TEAM TANK</div>
            <div class="v"><span id="hydrTeamTank">80</span>%</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">CRISIS</div>
            <div class="v" id="hydrCrisisText">Safe</div>
          </div>
        </div>
        <div class="hydr-progress" id="hydrTeamTankProgress"><i id="hydrTeamTankBar"></i></div>
      `;
    }

    if(state.mode === 'battle'){
      root.innerHTML = `
        <div class="hydr-mode-grid">
          <div class="hydr-mode-box">
            <div class="k">MY ROLE</div>
            <div class="v">${esc(role.icon)} ${esc(role.short)}</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">UNLOCKED</div>
            <div class="v"><span id="hydrBattleUnlocked">0</span> / 6</div>
          </div>
          <div class="hydr-mode-box">
            <div class="k">ATTACK USED</div>
            <div class="v"><span id="hydrBattleUsed">0</span></div>
          </div>
        </div>
        <div class="hydr-battle-attacks" id="hydrBattleAttacks"></div>
      `;
      renderBattleAttacks();
    }
  }

  function getAttackProgress(attack, stats){
    if(attack.stat === 'combo'){
      return {
        now: clamp(stats.combo, 0, attack.target),
        target: attack.target,
        ok: stats.combo >= attack.target
      };
    }

    if(attack.stat === 'block'){
      return {
        now: clamp(stats.block, 0, attack.target),
        target: attack.target,
        ok: stats.block >= attack.target
      };
    }

    if(attack.stat === 'water'){
      return {
        now: clamp(stats.water, 0, attack.target),
        target: attack.target,
        ok: stats.water >= attack.target
      };
    }

    if(attack.stat === 'score_safe'){
      return {
        now: clamp(stats.score, 0, attack.target),
        target: attack.target,
        ok: stats.score >= attack.target && stats.miss <= attack.maxMiss
      };
    }

    if(attack.stat === 'unlocked_attacks'){
      const count = Object.keys(state.battle.unlocked).filter(k => k !== 'final_storm').length;
      return {
        now: clamp(count, 0, attack.target),
        target: attack.target,
        ok: count >= attack.target && !state.battle.finalUsed
      };
    }

    return { now: 0, target: attack.target || 1, ok: false };
  }

  function renderBattleAttacks(){
    const box = document.getElementById('hydrBattleAttacks');
    if(!box) return;

    const stats = currentStats();
    const now = Date.now();

    box.innerHTML = Object.entries(BATTLE_ATTACKS).map(([id, atk]) => {
      const progress = getAttackProgress(atk, stats);
      const isUnlocked = !!state.battle.unlocked[id] || progress.ok;
      const cooldownLeft = Math.max(0, (state.battle.cooldownUntil[id] || 0) - now);
      const isCooldown = cooldownLeft > 0;
      const isFinalUsed = atk.once && state.battle.finalUsed;
      const ready = isUnlocked && !isCooldown && !isFinalUsed;

      state.battle.ready[id] = ready;
      if(isUnlocked) state.battle.unlocked[id] = true;

      const pct = clamp((progress.now / Math.max(1, progress.target)) * 100, 0, 100);
      const label = isFinalUsed
        ? 'ใช้แล้ว'
        : isCooldown
          ? `Cooldown ${Math.ceil(cooldownLeft / 1000)}s`
          : ready
            ? 'ใช้สกิล'
            : 'ยังล็อก';

      return `
        <div class="hydr-attack-card ${ready ? 'ready' : ''} ${isCooldown ? 'cooldown' : ''} ${isFinalUsed ? 'used-final' : ''}" data-attack="${esc(id)}">
          <div class="hydr-attack-top">
            <div class="hydr-attack-icon">${esc(atk.icon)}</div>
            <div>
              <div class="hydr-attack-name">${esc(atk.name)}</div>
              <div class="hydr-attack-desc">${esc(atk.desc)}</div>
            </div>
          </div>

          <div class="hydr-attack-mission">
            ${ready ? '✅ Ready!' : '🔒 ' + esc(atk.missionText)}
            <br>
            Progress: ${esc(String(progress.now))} / ${esc(String(progress.target))}
          </div>

          <div class="hydr-progress"><i style="width:${pct}%"></i></div>

          <button
            class="hydr-attack-btn"
            type="button"
            data-use-attack="${esc(id)}"
            ${ready ? '' : 'disabled'}
          >${esc(label)}</button>
        </div>
      `;
    }).join('');

    const unlockedCount = Object.keys(state.battle.unlocked).length;
    const usedCount = Object.keys(state.battle.used).reduce((sum, k) => sum + (state.battle.used[k] || 0), 0);

    setText('hydrBattleUnlocked', unlockedCount);
    setText('hydrBattleUsed', usedCount);
  }

  function bindBattleButtons(){
    document.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-use-attack]') : null;
      if(!btn) return;

      const id = btn.getAttribute('data-use-attack');
      if(!id) return;

      ev.preventDefault();
      useBattleAttack(id);
    }, true);
  }

  function useBattleAttack(id){
    if(state.mode !== 'battle') return;

    const atk = BATTLE_ATTACKS[id];
    if(!atk) return;

    const now = Date.now();
    if(!state.battle.ready[id]) return;
    if((state.battle.cooldownUntil[id] || 0) > now) return;
    if(atk.once && state.battle.finalUsed) return;

    if(atk.once){
      state.battle.finalUsed = true;
    }

    state.battle.used[id] = (state.battle.used[id] || 0) + 1;
    state.battle.cooldownUntil[id] = now + atk.cooldownMs;
    state.battle.attackLog.push({
      id,
      name: atk.name,
      ts: new Date().toISOString(),
      mode: state.mode,
      role: state.role
    });

    window.dispatchEvent(new CustomEvent('hha:hydration:battle-attack', {
      detail: {
        id,
        attack: atk,
        mode: state.mode,
        role: state.role,
        playerIndex: state.playerIndex,
        seed: state.seed,
        at: Date.now()
      }
    }));

    showAttackVfx(id, atk);
    ribbon(`${atk.icon} ส่ง ${atk.name} ไปท้าทายคู่แข่งแล้ว!`);

    renderBattleAttacks();
  }

  function showAttackVfx(id, atk){
    const stage = document.getElementById('stage');
    if(!stage) return;

    const layer = document.createElement('div');
    layer.className = `hydr-attack-vfx ${atk.effectClass || ''}`;
    layer.innerHTML = `<div class="label">${esc(atk.icon)} ${esc(atk.name)} Activated!</div>`;

    if(id === 'cloud_fog'){
      for(let i = 0; i < 4; i++){
        const c = document.createElement('div');
        c.className = 'hydr-cloud';
        c.style.left = `${10 + i * 23}%`;
        c.style.top = `${26 + (i % 2) * 18}%`;
        c.style.animationDelay = `${i * 120}ms`;
        layer.appendChild(c);
      }
    }

    if(id === 'lightning_lane'){
      for(let i = 0; i < 2; i++){
        const line = document.createElement('div');
        line.className = 'hydr-lightning-line';
        line.style.left = `${36 + i * 22}%`;
        line.style.animationDelay = `${i * 220}ms`;
        layer.appendChild(line);
      }
    }

    if(id === 'fake_water'){
      for(let i = 0; i < 6; i++){
        const d = document.createElement('div');
        d.className = 'hydr-fake-drop';
        d.textContent = i % 2 ? '💧' : '🫧';
        d.style.left = `${14 + (i * 14) % 72}%`;
        d.style.top = `${36 + (i % 3) * 16}%`;
        d.style.animationDelay = `${i * 130}ms`;
        layer.appendChild(d);
      }
    }

    if(id === 'storm_rush'){
      const rush = document.createElement('div');
      rush.className = 'hydr-rush-lines';
      layer.appendChild(rush);
    }

    if(id === 'dry_wind'){
      const dry = document.createElement('div');
      dry.className = 'hydr-dry-wind';
      layer.appendChild(dry);
    }

    if(id === 'final_storm'){
      const final = document.createElement('div');
      final.className = 'hydr-final-storm';
      layer.appendChild(final);

      for(let i = 0; i < 3; i++){
        const line = document.createElement('div');
        line.className = 'hydr-lightning-line';
        line.style.left = `${22 + i * 26}%`;
        line.style.animationDelay = `${i * 180}ms`;
        layer.appendChild(line);
      }
    }

    stage.appendChild(layer);
    setTimeout(() => layer.remove(), Math.max(1200, atk.durationMs || 3000));
  }

  function updateRace(stats){
    if(state.mode !== 'race') return;

    state.race.bestWater = Math.max(state.race.bestWater, stats.water);
    const pct = clamp((stats.water / state.race.goal) * 100, 0, 100);

    const bar = document.getElementById('hydrRaceBar');
    if(bar) bar.style.width = `${pct}%`;

    setText('hydrRaceGoal', state.race.goal);

    if(!state.race.finished && stats.water >= state.race.goal){
      state.race.finished = true;
      state.race.finishedAt = Date.now();
      setText('hydrRaceStatus', 'Finished!');
      ribbon('🏁 เข้าเส้นชัยแล้ว! Water Goal สำเร็จ');
      window.dispatchEvent(new CustomEvent('hha:hydration:race-finish', {
        detail: {
          finishedAt: state.race.finishedAt,
          elapsedMs: state.race.finishedAt - state.startedAt,
          water: stats.water,
          score: stats.score,
          miss: stats.miss
        }
      }));
    }else if(!state.race.finished){
      setText('hydrRaceStatus', stats.water >= 80 ? 'Final Sprint' : 'Racing');
    }
  }

  function updateDuet(stats){
    if(state.mode !== 'duet') return;

    let contribution = 0;

    if(state.role === 'collector'){
      contribution = stats.water + stats.combo * 2;
    }else if(state.role === 'guardian'){
      contribution = stats.block * 12 + stats.shield * 6;
    }else{
      contribution = stats.score / 10;
    }

    state.duet.roleContribution = Math.round(contribution);

    const sync = clamp(
      Math.round((stats.water * 0.55) + (stats.block * 8) + (stats.combo * 3) - (stats.miss * 6)),
      0,
      100
    );

    state.duet.sync = sync;

    setText('hydrDuetSync', sync);
    setText('hydrDuetContrib', state.duet.roleContribution);

    const bar = document.getElementById('hydrDuetSyncBar');
    if(bar) bar.style.width = `${sync}%`;
  }

  function updateCoop(stats){
    if(state.mode !== 'coop') return;

    const base =
      stats.water * 0.70 +
      stats.block * 4 +
      stats.shield * 2 +
      stats.combo * 1.2 -
      stats.miss * 5 -
      stats.expire * 2;

    const nextTank = clamp(Math.round(base), 0, 100);
    const wasCrisis = state.coop.crisis;

    state.coop.tank = nextTank;
    state.coop.crisis = nextTank < 30;

    if(state.coop.crisis && !wasCrisis){
      state.coop.crisisCount++;
      state.coop.lastCrisisAt = Date.now();
      ribbon('🚨 Crisis! ช่วยกันเติม Team Tank ด่วน');
    }

    if(!state.coop.crisis && wasCrisis){
      state.coop.crisisSaved++;
      ribbon('🌈 Rescue สำเร็จ! ทีมผ่าน Crisis แล้ว');
    }

    setText('hydrTeamTank', state.coop.tank);
    setText('hydrCrisisText', state.coop.crisis ? 'Crisis!' : state.coop.tank >= 70 ? 'Strong' : 'Safe');

    const bar = document.getElementById('hydrTeamTankBar');
    if(bar) bar.style.width = `${state.coop.tank}%`;

    const progress = document.getElementById('hydrTeamTankProgress');
    if(progress){
      progress.classList.toggle('warn', state.coop.tank < 30);
    }
  }

  function updateSolo(stats){
    if(state.mode !== 'solo') return;

    if(stats.water < 30 && state.lastStats.water >= 30){
      ribbon('⚠️ Water ต่ำแล้ว เก็บน้ำดีหรือโล่ด่วน!');
    }

    if(stats.combo >= 10 && (state.lastStats.combo || 0) < 10){
      ribbon('🔥 Combo x10! เล่นได้ยอดเยี่ยม');
    }
  }

  function updateBattle(stats){
    if(state.mode !== 'battle') return;
    renderBattleAttacks();

    if(stats.combo >= 5 && (state.lastStats.combo || 0) < 5){
      ribbon('🌫️ Combo x5! Cloud Fog ใกล้พร้อมแล้ว');
    }

    if(stats.block >= 2 && (state.lastStats.block || 0) < 2){
      ribbon('⚡ ป้องกันดี! Lightning Lane พร้อมใช้งาน');
    }
  }

  function updateGlobalState(stats){
    window.HHA_HYDRATION_MODE_STATE = {
      version: VERSION,
      mode: state.mode,
      role: state.role,
      roleInfo: ROLE_INFO[state.role],
      playerIndex: state.playerIndex,
      seed: state.seed,
      stats,
      battle: state.battle,
      race: state.race,
      coop: state.coop,
      duet: state.duet
    };
  }

  function injectSummaryIfNeeded(stats){
    const end = document.getElementById('end');
    if(!end) return;

    const visible = end.getAttribute('aria-hidden') === 'false';
    if(!visible){
      state.summaryInjected = false;
      return;
    }

    if(state.summaryInjected) return;
    state.summaryInjected = true;

    const modeInfo = MODE_INFO[state.mode] || MODE_INFO.solo;
    const role = ROLE_INFO[state.role] || ROLE_INFO.hero;

    setText('endSub', `${modeInfo.label} • ${role.icon} ${role.short} • ${getParam('view', 'mobile')}`);
    setText('endPhaseMini', `${modeInfo.icon} ${modeInfo.title}`);

    if(state.mode === 'solo'){
      setText('endPhaseSummary', `Solo Survival • Water ${stats.water}% • Combo ${stats.combo} • Block ${stats.block}`);
      setText('endReward', stats.water >= 70 ? '💧 Hydration Hero สำเร็จ!' : '💧 ลองรักษาระดับน้ำให้สูงขึ้นอีกนิด');
    }

    if(state.mode === 'duet'){
      setText('endPhaseSummary', `Duet Buddy • Team Sync ${state.duet.sync}% • Contribution ${state.duet.roleContribution}`);
      setText('endReward', state.duet.sync >= 70 ? '🤝 คู่หูประสานงานดีมาก!' : '🤝 รอบหน้าแบ่งหน้าที่ให้ชัดขึ้นอีกนิด');
    }

    if(state.mode === 'race'){
      const elapsed = state.race.finishedAt ? Math.round((state.race.finishedAt - state.startedAt) / 1000) : null;
      setText('endPhaseSummary', state.race.finished
        ? `Race Finished • ใช้เวลา ${elapsed}s • Best Water ${state.race.bestWater}%`
        : `Race Result • Best Water ${state.race.bestWater}%`
      );
      setText('endReward', state.race.finished ? '🏁 เข้าเส้นชัยสำเร็จ!' : '🏁 รอบหน้าลองเก็บ Boost ให้ไวขึ้น');
    }

    if(state.mode === 'battle'){
      const unlocked = Object.keys(state.battle.unlocked).length;
      const used = Object.keys(state.battle.used).reduce((sum, k) => sum + (state.battle.used[k] || 0), 0);
      setText('endPhaseSummary', `Storm Battle • Unlock ${unlocked}/6 • Attack Used ${used} • Block ${stats.block}`);
      setText('endReward', used >= 3 ? '🌩️ Storm Master!' : '🌩️ ปลดล็อกสกิลเพิ่มเพื่อกดดันคู่แข่ง');
    }

    if(state.mode === 'coop'){
      setText('endPhaseSummary', `Coop Rescue • Team Tank ${state.coop.tank}% • Crisis Saved ${state.coop.crisisSaved}`);
      setText('endReward', state.coop.tank >= 70 ? '🚰 ทีมรักษาถังน้ำได้ยอดเยี่ยม!' : '🚰 รอบหน้าช่วยกันผ่าน Crisis ให้มากขึ้น');
    }

    setText('endBadge', `${role.icon} Role: ${role.title}`);
    setText('endRewardMini', role.mission);
  }

  function tick(){
    const stats = currentStats();

    updateSolo(stats);
    updateDuet(stats);
    updateRace(stats);
    updateBattle(stats);
    updateCoop(stats);
    updateGlobalState(stats);
    injectSummaryIfNeeded(stats);

    state.lastStats = stats;
  }

  function exposeApi(){
    window.HHAHydrationModes = {
      version: VERSION,
      state,
      assignRole,
      getStats: currentStats,
      useBattleAttack,
      showAttackVfx,
      ribbon,
      refresh: tick
    };
  }

  function init(){
    injectStyle();
    createPanel();
    applyHeaderText();
    applyMissionLabels();
    renderDynamicBase();
    bindBattleButtons();
    exposeApi();

    setTimeout(showRoleToast, 450);

    tick();
    setInterval(tick, 350);

    window.dispatchEvent(new CustomEvent('hha:hydration:modes-ready', {
      detail: {
        version: VERSION,
        mode: state.mode,
        role: state.role,
        seed: state.seed,
        playerIndex: state.playerIndex
      }
    }));

    console.info('[hydration-modes] ready', {
      version: VERSION,
      mode: state.mode,
      role: state.role,
      playerIndex: state.playerIndex,
      seed: state.seed
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }else{
    init();
  }
})();
