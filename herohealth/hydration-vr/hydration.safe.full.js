// === /herohealth/hydration-vr/hydration.safe.full.js === // INTEGRATION PATCH PACK for the latest working hydration.safe.js // Purpose: // - keep your current gameplay logic intact // - add solo mobile focus mode // - add mini HUD // - use wrapper-based hide that matches hydration-vr.full.html // // HOW TO USE // 1) Start from your latest working hydration.safe.js (the one with full solo/duet logic). // 2) Replace or add the blocks below exactly. // 3) Keep your current gameplay/boss/duet logic unless a block here says to replace it. // 4) Pair this with hydration-vr.full.html.

export async function boot() { const WIN = window; const DOC = document;

const qs = (k, d = '') => { try { const v = new URLSearchParams(location.search).get(k); return v == null || v === '' ? d : v; } catch { return d; } };

const clamp = (v, a, b) => { v = Number(v); if (!Number.isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); };

const lerp = (a, b, t) => a + (b - a) * t; const nowMs = () => (performance && performance.now ? performance.now() : Date.now());

function xmur3(str) { str = String(str || ''); let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= (h >>> 16)) >>> 0; }; }

function sfc32(a, b, c, d) { return function () { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296; }; }

const seedStr = String(qs('seed', Date.now())); const seedFn = xmur3(seedStr); const rand = sfc32(seedFn(), seedFn(), seedFn(), seedFn()); const r01 = () => rand(); const pick = (arr) => arr[Math.floor(r01() * arr.length)] || arr[0];

const diff = String(qs('diff', 'normal')).toLowerCase(); const view = String(qs('view', 'mobile')).toLowerCase(); const hubUrl = String(qs('hub', '../hub.html')); const game = String(qs('game', 'hydration')); const theme = String(qs('theme', 'hydration')); const zone = String(qs('zone', 'nutrition')); const cat = String(qs('cat', zone || 'nutrition')); const mode = String(qs('mode', 'solo')); const pid = String(qs('pid', 'anon')); const nick = String(qs('nick', qs('nickName', 'Player'))) || 'Player'; const runMode = String(qs('run', 'play')); const cooldownRequired = String(qs('cooldown', '1')) !== '0'; const plannedSecRaw = Number(qs('time', diff === 'hard' ? 90 : 80)); const plannedSec = clamp( Number.isFinite(plannedSecRaw) && plannedSecRaw > 0 ? plannedSecRaw : (diff === 'hard' ? 90 : 80), 30, 300 );

const duet = { enabled: mode === 'duet' && String(qs('multiplayer', '0')) === '1', roomCode: String(qs('roomCode', '')), uid: String(qs('uid', '')), db: null, roomRef: null, roomData: null, isHost: false, started: false, armedAt: 0, startCommitSent: false, waitingForPeerEnd: false, combinedShown: false, roomListener: null, countdownTimer: 0, gateStartedAt: 0 };

const ui = { stage: DOC.getElementById('stage'), layer: DOC.getElementById('layer'), zoneSign: DOC.getElementById('zoneSign'), calloutLayer: DOC.getElementById('calloutLayer'), stickerBurst: DOC.getElementById('stickerBurst'), bossFace: DOC.getElementById('bossFace'), stageMascotFace: DOC.getElementById('stageMascotFace'), stageMascotMood: DOC.getElementById('stageMascotMood'),

hhPlayerName: DOC.getElementById('hhPlayerName'),
hhPlayerHint: DOC.getElementById('hhPlayerHint'),
hhDiffText: DOC.getElementById('hhDiffText'),
hhViewText: DOC.getElementById('hhViewText'),
hhTimeText: DOC.getElementById('hhTimeText'),

score: DOC.getElementById('uiScore'),
time: DOC.getElementById('uiTime'),
miss: DOC.getElementById('uiMiss'),
expire: DOC.getElementById('uiExpire'),
block: DOC.getElementById('uiBlock'),
grade: DOC.getElementById('uiGrade'),
water: DOC.getElementById('uiWater'),
combo: DOC.getElementById('uiCombo'),
shield: DOC.getElementById('uiShield'),
phase: DOC.getElementById('uiPhase'),
warmDone: DOC.getElementById('uiWarmDone'),
coolDone: DOC.getElementById('uiCoolDone'),
aiRisk: DOC.getElementById('aiRisk'),
aiHint: DOC.getElementById('aiHint'),
aiRiskMini: DOC.getElementById('aiRiskMini'),
aiHintMini: DOC.getElementById('aiHintMini'),
coachExplain: DOC.getElementById('coachExplain'),
riskFill: DOC.getElementById('riskFill'),

missionHitNow: DOC.getElementById('missionHitNow'),
missionHitGoal: DOC.getElementById('missionHitGoal'),
missionBlockNow: DOC.getElementById('missionBlockNow'),
missionBlockGoal: DOC.getElementById('missionBlockGoal'),
missionComboNow: DOC.getElementById('missionComboNow'),
missionComboGoal: DOC.getElementById('missionComboGoal'),
missionChipHit: DOC.getElementById('missionChipHit'),
missionChipBlock: DOC.getElementById('missionChipBlock'),
missionChipCombo: DOC.getElementById('missionChipCombo'),

duetOverlay: DOC.getElementById('duetOverlay'),
duetGateTitle: DOC.getElementById('duetGateTitle'),
duetGateSub: DOC.getElementById('duetGateSub'),
duetGateMeName: DOC.getElementById('duetGateMeName'),
duetGatePeerName: DOC.getElementById('duetGatePeerName'),
duetGateMeState: DOC.getElementById('duetGateMeState'),
duetGatePeerState: DOC.getElementById('duetGatePeerState'),
duetGateCountdown: DOC.getElementById('duetGateCountdown'),

helpOverlay: DOC.getElementById('helpOverlay'),
btnHelp: DOC.getElementById('btnHelp'),
btnHelpStart: DOC.getElementById('btnHelpStart'),

pauseOverlay: DOC.getElementById('pauseOverlay'),
btnPause: DOC.getElementById('btnPause'),
btnResume: DOC.getElementById('btnResume'),

btnSfx: DOC.getElementById('btnSfx'),

end: DOC.getElementById('end'),
endTitle: DOC.getElementById('endTitle'),
endSub: DOC.getElementById('endSub'),
endGrade: DOC.getElementById('endGrade'),
endScore: DOC.getElementById('endScore'),
endMiss: DOC.getElementById('endMiss'),
endWater: DOC.getElementById('endWater'),
endPhaseMini: DOC.getElementById('endPhaseMini'),
endStars: DOC.getElementById('endStars'),
endCoach: DOC.getElementById('endCoach'),
endPhaseSummary: DOC.getElementById('endPhaseSummary'),
endReward: DOC.getElementById('endReward'),
endBadge: DOC.getElementById('endBadge'),
endCollection: DOC.getElementById('endCollection'),
endRewardCard: DOC.getElementById('endRewardCard'),
endRewardMini: DOC.getElementById('endRewardMini'),
endStickerRow: DOC.getElementById('endStickerRow'),
btnEndToggleDetail: DOC.getElementById('btnEndToggleDetail'),
endDetailWrap: DOC.getElementById('endDetailWrap'),

duetEndBoard: DOC.getElementById('duetEndBoard'),
duetEndMeName: DOC.getElementById('duetEndMeName'),
duetEndMeScore: DOC.getElementById('duetEndMeScore'),
duetEndMeMeta: DOC.getElementById('duetEndMeMeta'),
duetEndPeerName: DOC.getElementById('duetEndPeerName'),
duetEndPeerScore: DOC.getElementById('duetEndPeerScore'),
duetEndPeerMeta: DOC.getElementById('duetEndPeerMeta'),
duetEndWinner: DOC.getElementById('duetEndWinner'),

btnCopy: DOC.getElementById('btnCopy'),
btnCopyEvents: DOC.getElementById('btnCopyEvents'),
btnCopyTimeline: DOC.getElementById('btnCopyTimeline'),
btnCopyFeatures: DOC.getElementById('btnCopyFeatures'),
btnCopyLabels: DOC.getElementById('btnCopyLabels'),
btnCopyFeaturesCsv: DOC.getElementById('btnCopyFeaturesCsv'),
btnCopyLabelsCsv: DOC.getElementById('btnCopyLabelsCsv'),
btnSendCloud: DOC.getElementById('btnSendCloud'),

btnReplay: DOC.getElementById('btnReplay'),
btnNextCooldown: DOC.getElementById('btnNextCooldown'),
btnBackHub: DOC.getElementById('btnBackHub'),

debugMini: DOC.getElementById('debugMini'),
dbgPhase: DOC.getElementById('dbgPhase'),
dbgCombo: DOC.getElementById('dbgCombo'),
dbgWater: DOC.getElementById('dbgWater'),
dbgShield: DOC.getElementById('dbgShield'),
dbgBubbles: DOC.getElementById('dbgBubbles'),
dbgFps: DOC.getElementById('dbgFps')

};

const stageEl = ui.stage; const layer = ui.layer; if (!stageEl || !layer) return;

// === INSERT THIS HELPER PACK INTO YOUR LATEST WORKING FILE === // Replace the old mobile/focus helpers with these.

function focusNode(id) { return document.getElementById(id); }

function ensureFocusWrappersReady() { return { topStats: focusNode('hhTopStatsWrap'), mission: focusNode('hhMissionWrap'), coachTop: focusNode('hhCoachTopWrap'), coachBottom: focusNode('hhCoachBottomWrap'), meta: focusNode('hhMetaWrap'), miniHud: focusNode('hydrationSoloMiniHud') }; }

function ensureSoloMobilePlayfieldStyle() { if (!stageEl || !isMobileCompact() || duet.enabled) return; if (DOC.getElementById('hydrationSoloMobilePlayfieldStyle')) return;

const style = DOC.createElement('style');
style.id = 'hydrationSoloMobilePlayfieldStyle';
style.textContent = `
  @media (max-width: 640px){
    .hydr-page{ padding:8px !important; gap:8px !important; }
    #stage.solo-mobile-playfield{
      min-height: clamp(600px, 76svh, 840px) !important;
      height: clamp(600px, 76svh, 840px) !important;
      max-height: none !important;
      overflow: hidden !important;
      border-radius: 24px !important;
    }
  }
`;
DOC.head.appendChild(style);

}

function prioritizeSoloPlayfieldMobile() { if (!stageEl || !isMobileCompact() || duet.enabled) return;

ensureSoloMobilePlayfieldStyle();
stageEl.classList.add('solo-mobile-playfield');

const refs = ensureFocusWrappersReady();

if (refs.coachBottom) {
  refs.coachBottom.style.minHeight = '0';
  refs.coachBottom.style.padding = '8px 12px';
  refs.coachBottom.style.borderRadius = '18px';
  refs.coachBottom.style.margin = '0';
}

if (refs.meta) {
  refs.meta.style.minHeight = '0';
  refs.meta.style.padding = '6px 10px';
  refs.meta.style.borderRadius = '14px';
  refs.meta.style.margin = '0';
}

if (ui.coachExplain) {
  ui.coachExplain.style.fontSize = '13px';
  ui.coachExplain.style.lineHeight = '1.2';
}

if (ui.aiRisk) ui.aiRisk.style.fontSize = '13px';
if (ui.aiRiskMini) ui.aiRiskMini.style.fontSize = '13px';
if (ui.aiHintMini) {
  ui.aiHintMini.style.fontSize = '13px';
  ui.aiHintMini.style.lineHeight = '1.2';
}

}

function compactStatsGridForSoloMobile() { if (!isMobileCompact() || duet.enabled) return;

const refs = ensureFocusWrappersReady();
if (!refs.topStats) return;

refs.topStats.style.minHeight = '0';
refs.topStats.style.margin = '0';
refs.topStats.style.padding = '0';

const panels = refs.topStats.querySelectorAll('.stat-card, .hud-card, .kid-stat-card, .panel, .card');
panels.forEach((panel) => {
  panel.style.minHeight = '0';
  panel.style.padding = '6px 8px';
  panel.style.borderRadius = '14px';
  panel.style.margin = '0';
});

const grid = refs.topStats.querySelector('.stats-grid-kid, .stats-grid, .hud-stats-grid') || refs.topStats;
if (grid) {
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(2, minmax(0,1fr))';
  grid.style.gap = '6px';
  grid.style.margin = '0';
}

}

function compactMissionPanelForSoloMobile() { if (!isMobileCompact() || duet.enabled) return;

const refs = ensureFocusWrappersReady();
if (!refs.mission) return;

refs.mission.style.minHeight = '0';
refs.mission.style.padding = '8px 10px';
refs.mission.style.borderRadius = '16px';
refs.mission.style.margin = '0';

}

function ensureSoloMiniHud() { if (!stageEl || !isMobileCompact() || duet.enabled) return; const root = DOC.getElementById('hydrationSoloMiniHud'); if (root) root.hidden = false; }

function removeSoloMiniHud() { const root = DOC.getElementById('hydrationSoloMiniHud'); if (root) root.hidden = true; }

function updateSoloMiniHud() { if (!isMobileCompact() || duet.enabled) return; ensureSoloMiniHud();

const root = DOC.getElementById('hydrationSoloMiniHud');
if (!root) return;

const timeChip = root.querySelector('[data-k="time"]');
const waterChip = root.querySelector('[data-k="water"]');
const shieldChip = root.querySelector('[data-k="shield"]');
const pulse = root.querySelector('[data-k="pulse"]');

const timeVal = timeChip?.querySelector('.v');
const waterVal = waterChip?.querySelector('.v');
const shieldVal = shieldChip?.querySelector('.v');

if (timeVal) timeVal.textContent = formatClock(tLeft);
if (waterVal) waterVal.textContent = `${Math.round(waterPct)}%`;
if (shieldVal) shieldVal.textContent = String(shield);

timeChip?.classList.remove('warn', 'good');
waterChip?.classList.remove('warn', 'good');
shieldChip?.classList.remove('shield-hot');

if (tLeft <= 10) timeChip?.classList.add('warn');
else if (tLeft >= plannedSec * 0.7) timeChip?.classList.add('good');

if (waterPct < 25) waterChip?.classList.add('warn');
else if (waterPct >= 70) waterChip?.classList.add('good');

if (shield > 0) shieldChip?.classList.add('shield-hot');

let pulseText = '';
if (isThreatLive()) pulseText = shield > 0 ? '⚡ ใช้โล่บล็อกสายฟ้า!' : '⚡ รีบหาโล่';
else if (currentPhase === 'final' && inFinalRushNow()) pulseText = '⚡ FINAL RUSH';
else if (waterPct < 25) pulseText = '💧 รีบเก็บน้ำ';
else if (combo >= 10) pulseText = '🔥 COMBO HOT';

if (pulse) pulse.textContent = pulseText;

}

function wireHydrationFocusSelectors() { if (!isMobileCompact() || duet.enabled) return;

const refs = ensureFocusWrappersReady();
[refs.topStats, refs.mission, refs.coachTop, refs.coachBottom, refs.meta].forEach((el) => {
  if (el) el.removeAttribute('data-hh-focus');
});

if (refs.topStats) refs.topStats.setAttribute('data-hh-focus', 'hide');
if (refs.mission) refs.mission.setAttribute('data-hh-focus', 'hide');
if (refs.coachTop) refs.coachTop.setAttribute('data-hh-focus', 'hide');
if (refs.coachBottom) refs.coachBottom.setAttribute('data-hh-focus', 'hide');
if (refs.meta) refs.meta.setAttribute('data-hh-focus', 'hide');

if (stageEl) stageEl.setAttribute('data-hh-stage', 'focus');

}

function ensureSoloFocusPlayStyle() { if (!stageEl || !isMobileCompact() || duet.enabled) return; if (DOC.getElementById('hydrationSoloFocusPlayStyle')) return;

const style = DOC.createElement('style');
style.id = 'hydrationSoloFocusPlayStyle';
style.textContent = `
  @media (max-width: 640px){
    body.solo-focus-play .hydr-page{ gap: 6px !important; }
    body.solo-focus-play #stage.solo-mobile-playfield{
      min-height: clamp(660px, 82svh, 920px) !important;
      height: clamp(660px, 82svh, 920px) !important;
    }
    body.solo-focus-play [data-hh-focus="hide"]{ display:none !important; }
    body.solo-focus-play [data-hh-stage="focus"]{
      box-shadow: 0 20px 44px rgba(0,0,0,.24), 0 0 0 1px rgba(255,255,255,.08) inset !important;
    }
  }
`;
DOC.head.appendChild(style);

}

function setSoloFocusPlay(on) { if (!isMobileCompact() || duet.enabled) return;

ensureSoloFocusPlayStyle();
ensureSoloMiniHud();
wireHydrationFocusSelectors();

if (on) {
  document.body.classList.add('solo-focus-play');
  updateSoloMiniHud();
} else {
  document.body.classList.remove('solo-focus-play');
}

}

function refreshSoloFocusPlayState() { if (!isMobileCompact() || duet.enabled) return;

wireHydrationFocusSelectors();

const playing =
  !helpOpen &&
  !paused &&
  !ended &&
  !(ui.end && ui.end.getAttribute('aria-hidden') === 'false') &&
  !(ui.pauseOverlay && ui.pauseOverlay.getAttribute('aria-hidden') === 'false') &&
  !(ui.helpOverlay && ui.helpOverlay.getAttribute('aria-hidden') === 'false');

setSoloFocusPlay(!!playing);
if (playing) updateSoloMiniHud();

}

function condenseSoloHudMobile() { if (!isMobileCompact() || duet.enabled) return; prioritizeSoloPlayfieldMobile(); compactStatsGridForSoloMobile(); compactMissionPanelForSoloMobile(); ensureSoloFocusPlayStyle(); refreshSoloFocusPlayState(); }

// === KEEP YOUR CURRENT WORKING GAMEPLAY/DUET LOGIC BELOW THIS POINT === // Apply these call-site changes in your latest working file: // 1) Boot init: //    bindKidHudMeta(); //    applyStagePhaseVisuals(); //    syncPhaseDramaDecor(); //    condenseSoloHudMobile(); //    wireHydrationFocusSelectors(); //    refreshSoloFocusPlayState(); //    setHUD(); // // 2) In hideHelp() and hidePause(), after unpausing: //    refreshSoloFocusPlayState(); //    updateSoloMiniHud(); // // 3) In resize handler: //    condenseSoloHudMobile(); //    wireHydrationFocusSelectors(); //    refreshSoloFocusPlayState(); // // 4) In showEnd(reason) and combined duet end cleanup: //    refreshSoloFocusPlayState(); //    document.body.classList.remove('solo-focus-play'); //    removeSoloMiniHud(); // // 5) In setHUD(), after syncCompactHudFocus(): //    if (isMobileCompact() && !duet.enabled) updateSoloMiniHud(); }