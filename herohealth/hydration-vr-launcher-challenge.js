// === /herohealth/hydration-vr-launcher-challenge.js ===
// Hydration Launcher Challenge Entry Patch
// PATCH v20260427-HYDRATION-LAUNCHER-CHALLENGE-ENTRY
//
// หน้าที่:
// ✅ เพิ่มปุ่มเข้า Normal / Challenge / Hero บน launcher
// ✅ ไม่ทับ launcher เดิม
// ✅ preserve query: pid/name/studyId/time/seed/view/hub/run/log
// ✅ ส่งเข้า main game โดยตรง: /herohealth/hydration-vr/hydration-vr.html
// ✅ ใช้ diff=normal / challenge / hero เพื่อเปิด Challenge Pack

'use strict';

const PATCH = 'v20260427-HYDRATION-LAUNCHER-CHALLENGE-ENTRY';

(function installHydrationLauncherChallenge(){
  if (window.__HHA_HYDRATION_LAUNCHER_CHALLENGE__) return;
  window.__HHA_HYDRATION_LAUNCHER_CHALLENGE__ = true;

  injectStyles();
  injectChallengeEntry();

  console.log('[hydration-launcher-challenge] installed', PATCH);
})();

function qs(k, d=''){
  try{
    return new URL(location.href).searchParams.get(k) ?? d;
  }catch(_){
    return d;
  }
}

function buildRunUrl(diff){
  const u = new URL('./hydration-vr/hydration-vr.html', location.href);
  const src = new URL(location.href).searchParams;

  const keys = [
    'pid',
    'name',
    'studyId',
    'time',
    'seed',
    'view',
    'hub',
    'run',
    'log',
    'logger',
    'api',
    'mode',
    'zone',
    'game',
    'gameId',
    'cat'
  ];

  keys.forEach(k => {
    const v = src.get(k);
    if (v != null && v !== '') u.searchParams.set(k, v);
  });

  u.searchParams.set('diff', diff);
  u.searchParams.set('run', src.get('run') || 'play');
  u.searchParams.set('game', src.get('game') || 'hydration');
  u.searchParams.set('gameId', src.get('gameId') || 'hydration');
  u.searchParams.set('zone', src.get('zone') || 'fitness');
  u.searchParams.set('cat', src.get('cat') || 'hydration');
  u.searchParams.set('challenge', diff === 'hero' ? 'hero' : diff === 'challenge' ? '1' : '0');
  u.searchParams.set('ts', String(Date.now()));

  if (!u.searchParams.get('time')) {
    u.searchParams.set('time', diff === 'hero' ? '150' : diff === 'challenge' ? '120' : '90');
  }

  if (!u.searchParams.get('view')) {
    u.searchParams.set('view', 'mobile');
  }

  if (!u.searchParams.get('seed')) {
    u.searchParams.set('seed', String(Date.now()));
  }

  return u.toString();
}

function injectStyles(){
  if (document.getElementById('hhaHydrationLauncherChallengeStyle')) return;

  const st = document.createElement('style');
  st.id = 'hhaHydrationLauncherChallengeStyle';
  st.textContent = `
#hhaHydrationChallengeEntry{
  position:relative;
  z-index:50;
  width:min(980px, calc(100vw - 24px));
  margin:14px auto;
  padding:14px;
  border-radius:24px;
  background:linear-gradient(180deg,rgba(7,18,38,.84),rgba(12,24,52,.86));
  border:1px solid rgba(255,255,255,.14);
  box-shadow:0 22px 54px rgba(0,0,0,.26);
  color:#eff7ff;
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
  backdrop-filter:blur(12px);
}

#hhaHydrationChallengeEntry .head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}

#hhaHydrationChallengeEntry .title{
  font-size:18px;
  font-weight:1000;
  line-height:1.1;
}

#hhaHydrationChallengeEntry .sub{
  margin-top:5px;
  color:#bfdbfe;
  font-size:12px;
  line-height:1.35;
}

#hhaHydrationChallengeEntry .tag{
  padding:6px 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:1000;
  background:rgba(251,191,36,.15);
  border:1px solid rgba(251,191,36,.34);
  color:#fef3c7;
  white-space:nowrap;
}

#hhaHydrationChallengeEntry .grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
}

.hha-hydr-ch-card{
  min-height:132px;
  text-align:left;
  padding:12px;
  border-radius:20px;
  color:#fff;
  background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.12);
  box-shadow:0 12px 26px rgba(0,0,0,.16);
  cursor:pointer;
  transition:transform .12s ease, border-color .12s ease, background .12s ease;
}

.hha-hydr-ch-card:active{
  transform:scale(.985);
}

.hha-hydr-ch-card:hover{
  border-color:rgba(103,232,249,.44);
  background:rgba(255,255,255,.11);
}

.hha-hydr-ch-card .emoji{
  font-size:28px;
}

.hha-hydr-ch-card .name{
  margin-top:6px;
  font-size:15px;
  font-weight:1000;
}

.hha-hydr-ch-card .desc{
  margin-top:5px;
  color:#bfdbfe;
  font-size:12px;
  line-height:1.35;
}

.hha-hydr-ch-card.normal{
  border-color:rgba(52,211,153,.28);
}

.hha-hydr-ch-card.challenge{
  border-color:rgba(251,191,36,.34);
}

.hha-hydr-ch-card.hero{
  border-color:rgba(251,113,133,.38);
  background:linear-gradient(180deg,rgba(251,113,133,.16),rgba(255,255,255,.07));
}

@media (max-width:720px){
  #hhaHydrationChallengeEntry .head{
    flex-direction:column;
  }

  #hhaHydrationChallengeEntry .grid{
    grid-template-columns:1fr;
  }

  .hha-hydr-ch-card{
    min-height:104px;
  }
}
`;
  document.head.appendChild(st);
}

function injectChallengeEntry(){
  if (document.getElementById('hhaHydrationChallengeEntry')) return;

  const host = document.createElement('section');
  host.id = 'hhaHydrationChallengeEntry';

  const currentDiff = String(qs('diff','normal') || 'normal').toLowerCase();

  host.innerHTML = `
    <div class="head">
      <div>
        <div class="title">🔥 เลือกระดับความท้าทาย Hydration</div>
        <div class="sub">
          Normal = เล่นเรียนรู้ทั่วไป • Challenge = Storm/Combo เข้มขึ้น • Hero = Final Rush หนักขึ้นและ Shield หายากขึ้น
        </div>
      </div>
      <div class="tag">ตอนนี้: ${escapeHtml(currentDiff.toUpperCase())}</div>
    </div>

    <div class="grid">
      <button class="hha-hydr-ch-card normal" type="button" data-diff="normal">
        <div class="emoji">💧</div>
        <div class="name">Normal</div>
        <div class="desc">เหมาะกับเริ่มเล่น ฝึกเก็บน้ำดีและหลบของไม่ดี</div>
      </button>

      <button class="hha-hydr-ch-card challenge" type="button" data-diff="challenge">
        <div class="emoji">🌩️</div>
        <div class="name">Challenge</div>
        <div class="desc">เพิ่ม Combo Gate, Storm Chain, Shield หายากขึ้น และเป้าเร็วขึ้น</div>
      </button>

      <button class="hha-hydr-ch-card hero" type="button" data-diff="hero">
        <div class="emoji">⚡</div>
        <div class="name">Hero</div>
        <div class="desc">โหมดเร้าใจสุด Final Rush หนักขึ้น เหมาะกับคนที่เล่นคล่องแล้ว</div>
      </button>
    </div>
  `;

  // พยายามแทรกหลัง header/hero เดิม ถ้าไม่เจอให้แทรกบนสุดของ body
  const candidate =
    document.querySelector('.hero-strip') ||
    document.querySelector('header') ||
    document.querySelector('main') ||
    document.body.firstElementChild;

  if (candidate && candidate.parentNode) {
    candidate.parentNode.insertBefore(host, candidate.nextSibling);
  } else {
    document.body.prepend(host);
  }

  host.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      const diff = btn.getAttribute('data-diff') || 'normal';
      location.href = buildRunUrl(diff);
    });
  });
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}