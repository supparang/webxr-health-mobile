// === /herohealth/vr-clean/clean.kids.ui.js ===
// Clean Objects — Kids Mode UI
// 4 PHASES / BOSS UI / CHILD-FRIENDLY
// PATCH v20260320-CLEAN-KIDS-UI-4PHASE-BOSS-r3

'use strict';

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html !== undefined) n.innerHTML = html;
  return n;
}
function fmt(v){
  v = Number(v) || 0;
  return String(Math.round(v));
}
function escapeHtml(s){
  s = String(s ?? '');
  return s.replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
}
function starText(n){
  n = Number(n || 0);
  if(n >= 4) return '⭐⭐⭐⭐';
  if(n >= 3) return '⭐⭐⭐';
  if(n >= 2) return '⭐⭐';
  if(n >= 1) return '⭐';
  return '☆';
}
function phaseCircle(active, done){
  if(done) return '✅';
  if(active) return '🟡';
  return '⚪';
}
function summaryTitleFromStars(totalStars){
  totalStars = Number(totalStars || 0);
  if(totalStars >= 12) return 'สุดยอดมาก! เคลียร์บอสได้แล้ว';
  if(totalStars >= 9) return 'เก่งมาก! เล่นได้ยอดเยี่ยม';
  if(totalStars >= 6) return 'ดีมาก! ผ่านหลายด่านแล้ว';
  return 'เก่งแล้ว ลองอีกครั้งได้นะ';
}
function coachMoodFromKind(kind){
  if(kind === 'good') return { icon:'😄', cls:'good' };
  if(kind === 'warn') return { icon:'🤔', cls:'warn' };
  if(kind === 'boss') return { icon:'👾', cls:'boss' };
  return { icon:'😊', cls:'tip' };
}
function getPhaseThemeMeta(phaseNo){
  phaseNo = Number(phaseNo || 1);

  if(phaseNo === 1){
    return {
      icon: '🏫',
      title: 'ห้องเรียน',
      sub: 'เริ่มจากจุดที่เด็กใช้ใกล้ตัว เช่น สวิตช์ไฟ หรืออุปกรณ์ที่จับบ่อย'
    };
  }

  if(phaseNo === 2){
    return {
      icon: '🤝',
      title: 'ของใช้ร่วม',
      sub: 'มองหาของที่หลายคนจับร่วมกัน เช่น รีโมท ลูกบิด หรือราวจับ'
    };
  }

  if(phaseNo === 3){
    return {
      icon: '🚽',
      title: 'ห้องน้ำ',
      sub: 'ด่านนี้มีจุดเสี่ยงสูง และมีภารกิจพิเศษให้หา'
    };
  }

  return {
    icon: '👾',
    title: 'Boss Mission',
    sub: 'ด่านสุดท้าย! เลือก 3 จุดสำคัญเพื่อหยุดการระบาด'
  };
}
function getPhaseThemeColors(phaseNo){
  phaseNo = Number(phaseNo || 1);

  if(phaseNo === 1){
    return {
      themeClass: 'theme-classroom',
      accent: '#60a5fa'
    };
  }

  if(phaseNo === 2){
    return {
      themeClass: 'theme-shared',
      accent: '#fb923c'
    };
  }

  if(phaseNo === 3){
    return {
      themeClass: 'theme-bathroom',
      accent: '#a78bfa'
    };
  }

  return {
    themeClass: 'theme-boss',
    accent: '#f43f5e'
  };
}
function getCardThemeClass(phaseNo){
  phaseNo = Number(phaseNo || 1);
  if(phaseNo === 1) return 'theme-classroom';
  if(phaseNo === 2) return 'theme-shared';
  if(phaseNo === 3) return 'theme-bathroom';
  return 'theme-boss';
}

export function mountCleanKidsUI(root, opts={}){
  root.innerHTML = '';

  const app = el('div','kidsApp');
  root.appendChild(app);

  const top = el('div','kidsTop');
  top.innerHTML = `
    <div class="kidPill" id="kPhase">ด่าน 1/4</div>
    <div class="kidPill" id="kTime">เวลา: 0</div>
    <div class="kidPill" id="kPick">เลือกแล้ว: 0/0</div>
    <div class="kidPill" id="kStar">ดาว: ☆</div>
  `;
  app.appendChild(top);

  const phaseBar = el('div','kidsPhaseBar');
  phaseBar.innerHTML = `
    <div class="phaseNode" id="phaseNode1">
      <div class="phaseDot" id="phaseDot1">🟡</div>
      <div class="phaseLabel">🏫 ด่าน 1</div>
    </div>
    <div class="phaseLine" id="phaseLine1"></div>

    <div class="phaseNode" id="phaseNode2">
      <div class="phaseDot" id="phaseDot2">⚪</div>
      <div class="phaseLabel">🤝 ด่าน 2</div>
    </div>
    <div class="phaseLine" id="phaseLine2"></div>

    <div class="phaseNode" id="phaseNode3">
      <div class="phaseDot" id="phaseDot3">⚪</div>
      <div class="phaseLabel">🚽 ด่าน 3</div>
    </div>
    <div class="phaseLine" id="phaseLine3"></div>

    <div class="phaseNode" id="phaseNode4">
      <div class="phaseDot" id="phaseDot4">⚪</div>
      <div class="phaseLabel">👾 ด่าน 4</div>
    </div>
  `;
  app.appendChild(phaseBar);

  const mission = el('div','kidsMission');
  mission.innerHTML = `
    <div class="kidsMissionTitle" id="kidsMissionTitle">ภารกิจ</div>
    <div class="kidsMissionText" id="kidsMissionText">แตะจุดที่ควรเช็ดก่อน</div>
    <div class="kidsMissionSub" id="kidsMissionSub">ดูให้ดีแล้วเลือกให้ถูก</div>
  `;
  app.appendChild(mission);

  const transition = el('div','kidsTransition');
  transition.style.display = 'none';
  transition.innerHTML = `
    <div class="kidsTransitionCard">
      <div class="kidsTransitionIcon" id="kidsTransitionIcon">🎉</div>
      <div class="kidsTransitionTitle" id="kidsTransitionTitle">ผ่านด่านแล้ว!</div>
      <div class="kidsTransitionText" id="kidsTransitionText">กำลังไปด่านถัดไป...</div>
    </div>
  `;
  app.appendChild(transition);

  const board = el('div','kidsBoard');
  board.id = 'kidsBoard';
  app.appendChild(board);

  const coach = el('div','kidsCoach');
  coach.innerHTML = `
    <div class="kidsCoachIcon" id="kidsCoachIcon">😊</div>
    <div class="kidsCoachText" id="kidsCoachText">เริ่มได้เลย!</div>
  `;
  app.appendChild(coach);

  const summary = el('div','kidsSummary');
  summary.style.display = 'none';
  summary.innerHTML = `
    <div class="kidsSummaryCard">
      <div class="kidsSummaryTitle">สรุปผลทั้งเกม</div>
      <div class="kidsSummaryStars" id="kidsSummaryStars">⭐</div>
      <div class="kidsSummaryText" id="kidsSummaryText">เก่งมาก!</div>
      <div class="kidsSummarySub" id="kidsSummarySub"></div>

      <div class="kidsSummaryGrid" id="kidsSummaryGrid"></div>

      <div class="kidsSummaryBtns">
        <button class="kidBtn primary" id="kidsBtnCooldown" type="button">Go Cooldown</button>
        <button class="kidBtn" id="kidsBtnHub" type="button">Back HUB</button>
        <button class="kidBtn" id="kidsBtnReplay" type="button">Replay</button>
      </div>
    </div>
  `;
  root.appendChild(summary);

  const style = el('style');
  style.textContent = `
    .kidsApp{
      display:grid;
      gap:12px;
    }

    .kidsTop{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }
    .kidPill{
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.45);
      font-size:14px;
      font-weight:1000;
    }

    .kidsPhaseBar{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      padding:12px;
      border-radius:18px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(15,23,42,.46);
      overflow-x:auto;
    }
    .phaseNode{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:4px;
      min-width:72px;
    }
    .phaseDot{
      width:42px;
      height:42px;
      border-radius:999px;
      display:grid;
      place-items:center;
      font-size:20px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.52);
      transition:box-shadow .15s ease, border-color .15s ease;
    }
    .phaseLabel{
      font-size:12px;
      font-weight:1000;
      color:#e5e7eb;
      text-align:center;
      line-height:1.2;
    }
    .phaseLine{
      flex:0 0 30px;
      height:4px;
      border-radius:999px;
      background:rgba(148,163,184,.18);
    }
    .phaseLine.done{
      background:rgba(34,197,94,.55);
    }

    .kidsMission{
      padding:12px;
      border-radius:18px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(15,23,42,.46);
    }
    .kidsMissionTitle{
      font-size:14px;
      font-weight:1000;
      margin-bottom:6px;
    }
    .kidsMissionText{
      font-size:18px;
      font-weight:1000;
      line-height:1.35;
    }
    .kidsMissionSub{
      margin-top:6px;
      font-size:13px;
      font-weight:900;
      opacity:.88;
      line-height:1.45;
    }

    .kidsTransition{
      border-radius:18px;
      border:1px solid rgba(34,197,94,.22);
      background:rgba(34,197,94,.10);
      padding:12px;
      animation:kidsFadeIn .22s ease-out;
    }
    .kidsTransitionCard{
      display:grid;
      gap:6px;
      text-align:center;
    }
    .kidsTransitionIcon{
      font-size:28px;
      line-height:1;
    }
    .kidsTransitionTitle{
      font-size:18px;
      font-weight:1000;
    }
    .kidsTransitionText{
      font-size:14px;
      font-weight:900;
      opacity:.92;
    }

    .kidsBoard{
      display:grid;
      grid-template-columns:repeat(2, minmax(0,1fr));
      gap:12px;
    }

    .kidCard{
      min-height:138px;
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.75);
      box-shadow:0 18px 40px rgba(0,0,0,.22);
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:8px;
      padding:12px;
      text-align:center;
      cursor:pointer;
      user-select:none;
      transition:transform .12s ease, opacity .12s ease, border-color .12s ease;
      position:relative;
    }
    .kidCard:hover{
      transform:translateY(-1px);
    }
    .kidCard.goodHint{
      box-shadow:0 0 0 6px rgba(148,163,184,.06), 0 18px 40px rgba(0,0,0,.22);
    }
    .kidCard.special{
      outline:3px solid rgba(245,158,11,.78);
      outline-offset:2px;
      box-shadow:
        0 0 0 8px rgba(245,158,11,.08),
        0 18px 40px rgba(0,0,0,.22);
    }
    .kidCard.special::before{
      content:'SPECIAL';
      position:absolute;
      top:10px;
      right:10px;
      min-height:22px;
      padding:4px 8px;
      border-radius:999px;
      border:1px solid rgba(245,158,11,.42);
      background:rgba(245,158,11,.18);
      color:#fde68a;
      font-size:10px;
      font-weight:1100;
      letter-spacing:.4px;
      line-height:1;
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }
    .kidCard.boss{
      outline:3px solid rgba(244,63,94,.82);
      outline-offset:2px;
      box-shadow:
        0 0 0 10px rgba(244,63,94,.08),
        0 18px 40px rgba(0,0,0,.22);
    }
    .kidCard.boss::before{
      content:'BOSS';
      position:absolute;
      top:10px;
      right:10px;
      min-height:22px;
      padding:4px 8px;
      border-radius:999px;
      border:1px solid rgba(244,63,94,.42);
      background:rgba(244,63,94,.18);
      color:#fecdd3;
      font-size:10px;
      font-weight:1100;
      letter-spacing:.4px;
      line-height:1;
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }
    .kidCard.special .kidCardIcon{
      filter:drop-shadow(0 0 10px rgba(245,158,11,.28));
    }
    .kidCard.boss .kidCardIcon{
      filter:drop-shadow(0 0 12px rgba(244,63,94,.28));
    }
    .kidCard.special .kidCardHint{
      color:#fde68a;
    }
    .kidCard.boss .kidCardHint{
      color:#fecdd3;
    }

    .kidCard.specialPulse{
      animation:kidSpecialPulse 1.2s ease-in-out infinite;
    }
    .kidCard.bossPulse{
      animation:kidBossPulse 1.15s ease-in-out infinite;
    }

    .kidCard.done{
      opacity:.82;
      transform:scale(.98);
    }
    .kidCard.correct{
      background:rgba(34,197,94,.16);
      border-color:rgba(34,197,94,.35);
    }
    .kidCard.wrong{
      background:rgba(239,68,68,.12);
      border-color:rgba(239,68,68,.28);
    }
    .kidCard.locked{
      pointer-events:none;
    }

    .kidCardIcon{
      font-size:34px;
      line-height:1;
    }
    .kidCardLabel{
      font-size:16px;
      font-weight:1000;
      line-height:1.2;
    }
    .kidCardHint{
      font-size:12px;
      font-weight:1000;
      opacity:.88;
    }

    .kidsCoach{
      display:flex;
      align-items:center;
      gap:10px;
      padding:12px;
      border-radius:18px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(15,23,42,.46);
    }
    .kidsCoach.good{
      border-color:rgba(34,197,94,.22);
      background:rgba(34,197,94,.10);
    }
    .kidsCoach.warn{
      border-color:rgba(245,158,11,.24);
      background:rgba(245,158,11,.10);
    }
    .kidsCoach.boss{
      border-color:rgba(244,63,94,.24);
      background:rgba(244,63,94,.10);
    }

    .kidsCoachIcon{
      width:48px;
      height:48px;
      border-radius:16px;
      display:grid;
      place-items:center;
      font-size:24px;
      background:rgba(2,6,23,.55);
      border:1px solid rgba(148,163,184,.18);
    }
    .kidsCoachText{
      font-size:15px;
      font-weight:1000;
      line-height:1.35;
    }

    .kidsSummary{
      position:fixed;
      inset:0;
      z-index:200;
      background:rgba(0,0,0,.55);
      padding:14px;
      overflow:auto;
    }
    .kidsSummaryCard{
      max-width:860px;
      margin:0 auto;
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.90);
      box-shadow:0 24px 90px rgba(0,0,0,.42);
      padding:18px;
      text-align:center;
    }
    .kidsSummaryTitle{
      font-size:22px;
      font-weight:1000;
    }
    .kidsSummaryStars{
      margin-top:10px;
      font-size:32px;
      font-weight:1000;
      letter-spacing:2px;
    }
    .kidsSummaryText{
      margin-top:8px;
      font-size:18px;
      font-weight:1000;
    }
    .kidsSummarySub{
      margin-top:8px;
      font-size:14px;
      font-weight:900;
      line-height:1.5;
      opacity:.9;
    }
    .kidsSummaryGrid{
      display:grid;
      grid-template-columns:repeat(4, minmax(0,1fr));
      gap:10px;
      margin-top:14px;
    }
    .kidsSummaryBox{
      border-radius:16px;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(15,23,42,.46);
      padding:12px;
      text-align:left;
    }
    .kidsSummaryBoxTitle{
      font-size:13px;
      font-weight:1000;
      margin-bottom:6px;
    }
    .kidsSummaryBoxText{
      font-size:13px;
      font-weight:900;
      line-height:1.55;
      opacity:.92;
    }

    .kidsSummaryBtns{
      margin-top:14px;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:center;
    }
    .kidBtn{
      padding:12px 14px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(15,23,42,.46);
      color:#e5e7eb;
      font-size:14px;
      font-weight:1000;
      cursor:pointer;
    }
    .kidBtn.primary{
      background:rgba(34,197,94,.18);
      border-color:rgba(34,197,94,.34);
    }

    .kidsApp.theme-classroom .kidsMission{
      border-color: rgba(96,165,250,.28);
      background: rgba(96,165,250,.10);
      box-shadow: 0 0 0 1px rgba(96,165,250,.08) inset;
    }
    .kidsApp.theme-shared .kidsMission{
      border-color: rgba(251,146,60,.28);
      background: rgba(251,146,60,.10);
      box-shadow: 0 0 0 1px rgba(251,146,60,.08) inset;
    }
    .kidsApp.theme-bathroom .kidsMission{
      border-color: rgba(167,139,250,.28);
      background: rgba(167,139,250,.10);
      box-shadow: 0 0 0 1px rgba(167,139,250,.08) inset;
    }
    .kidsApp.theme-boss .kidsMission{
      border-color: rgba(244,63,94,.30);
      background: rgba(244,63,94,.10);
      box-shadow: 0 0 0 1px rgba(244,63,94,.08) inset;
    }

    .kidsApp.theme-classroom .phaseDot.active{
      border-color: rgba(96,165,250,.38);
      box-shadow: 0 0 0 6px rgba(96,165,250,.12);
    }
    .kidsApp.theme-shared .phaseDot.active{
      border-color: rgba(251,146,60,.38);
      box-shadow: 0 0 0 6px rgba(251,146,60,.12);
    }
    .kidsApp.theme-bathroom .phaseDot.active{
      border-color: rgba(167,139,250,.38);
      box-shadow: 0 0 0 6px rgba(167,139,250,.12);
    }
    .kidsApp.theme-boss .phaseDot.active{
      border-color: rgba(244,63,94,.42);
      box-shadow: 0 0 0 6px rgba(244,63,94,.14);
    }

    .kidsApp.theme-classroom .kidCard.goodHint{
      box-shadow: 0 0 0 6px rgba(96,165,250,.10), 0 18px 40px rgba(0,0,0,.22);
    }
    .kidsApp.theme-shared .kidCard.goodHint{
      box-shadow: 0 0 0 6px rgba(251,146,60,.10), 0 18px 40px rgba(0,0,0,.22);
    }
    .kidsApp.theme-bathroom .kidCard.goodHint{
      box-shadow: 0 0 0 6px rgba(167,139,250,.10), 0 18px 40px rgba(0,0,0,.22);
    }
    .kidsApp.theme-boss .kidCard.goodHint{
      box-shadow: 0 0 0 6px rgba(244,63,94,.10), 0 18px 40px rgba(0,0,0,.22);
    }

    .kidsApp.theme-classroom .kidsTransition{
      border-color: rgba(96,165,250,.26);
      background: rgba(96,165,250,.10);
    }
    .kidsApp.theme-shared .kidsTransition{
      border-color: rgba(251,146,60,.26);
      background: rgba(251,146,60,.10);
    }
    .kidsApp.theme-bathroom .kidsTransition{
      border-color: rgba(167,139,250,.26);
      background: rgba(167,139,250,.10);
    }
    .kidsApp.theme-boss .kidsTransition{
      border-color: rgba(244,63,94,.26);
      background: rgba(244,63,94,.10);
    }

    .kidsApp.theme-classroom .kidPill{
      border-color: rgba(96,165,250,.22);
    }
    .kidsApp.theme-shared .kidPill{
      border-color: rgba(251,146,60,.22);
    }
    .kidsApp.theme-bathroom .kidPill{
      border-color: rgba(167,139,250,.22);
    }
    .kidsApp.theme-boss .kidPill{
      border-color: rgba(244,63,94,.24);
    }

    .kidCard.theme-classroom{
      background: linear-gradient(180deg, rgba(96,165,250,.10), rgba(2,6,23,.75));
    }
    .kidCard.theme-shared{
      background: linear-gradient(180deg, rgba(251,146,60,.10), rgba(2,6,23,.75));
    }
    .kidCard.theme-bathroom{
      background: linear-gradient(180deg, rgba(167,139,250,.10), rgba(2,6,23,.75));
    }
    .kidCard.theme-boss{
      background: linear-gradient(180deg, rgba(244,63,94,.12), rgba(2,6,23,.75));
    }

    .kidsApp.theme-classroom .kidsCoach{
      box-shadow: 0 0 0 1px rgba(96,165,250,.08) inset;
    }
    .kidsApp.theme-shared .kidsCoach{
      box-shadow: 0 0 0 1px rgba(251,146,60,.08) inset;
    }
    .kidsApp.theme-bathroom .kidsCoach{
      box-shadow: 0 0 0 1px rgba(167,139,250,.08) inset;
    }
    .kidsApp.theme-boss .kidsCoach{
      box-shadow: 0 0 0 1px rgba(244,63,94,.08) inset;
    }

    @keyframes kidsFadeIn{
      from{ opacity:0; transform:translateY(4px); }
      to{ opacity:1; transform:translateY(0); }
    }

    @keyframes kidSpecialPulse{
      0%{
        transform:scale(1);
        box-shadow:
          0 0 0 0 rgba(245,158,11,.18),
          0 18px 40px rgba(0,0,0,.22);
      }
      50%{
        transform:scale(1.015);
        box-shadow:
          0 0 0 10px rgba(245,158,11,.06),
          0 18px 40px rgba(0,0,0,.22);
      }
      100%{
        transform:scale(1);
        box-shadow:
          0 0 0 0 rgba(245,158,11,.18),
          0 18px 40px rgba(0,0,0,.22);
      }
    }

    @keyframes kidBossPulse{
      0%{
        transform:scale(1);
        box-shadow:
          0 0 0 0 rgba(244,63,94,.18),
          0 18px 40px rgba(0,0,0,.22);
      }
      50%{
        transform:scale(1.02);
        box-shadow:
          0 0 0 12px rgba(244,63,94,.06),
          0 18px 40px rgba(0,0,0,.22);
      }
      100%{
        transform:scale(1);
        box-shadow:
          0 0 0 0 rgba(244,63,94,.18),
          0 18px 40px rgba(0,0,0,.22);
      }
    }

    @media (max-width:720px){
      .kidsBoard{
        grid-template-columns:1fr 1fr;
      }
      .kidCard{
        min-height:126px;
      }
      .kidCardIcon{
        font-size:30px;
      }
      .kidCardLabel{
        font-size:15px;
      }
      .kidsSummaryGrid{
        grid-template-columns:1fr 1fr;
      }
      .phaseLine{
        flex-basis:18px;
      }
      .phaseNode{
        min-width:58px;
      }
      .phaseLabel{
        font-size:11px;
      }
    }

    @media (max-width:520px){
      .kidsSummaryGrid{
        grid-template-columns:1fr;
      }
    }
  `;
  root.appendChild(style);

  const kPhase = root.querySelector('#kPhase');
  const kTime = root.querySelector('#kTime');
  const kPick = root.querySelector('#kPick');
  const kStar = root.querySelector('#kStar');

  const phaseDot1 = root.querySelector('#phaseDot1');
  const phaseDot2 = root.querySelector('#phaseDot2');
  const phaseDot3 = root.querySelector('#phaseDot3');
  const phaseDot4 = root.querySelector('#phaseDot4');
  const phaseLine1 = root.querySelector('#phaseLine1');
  const phaseLine2 = root.querySelector('#phaseLine2');
  const phaseLine3 = root.querySelector('#phaseLine3');

  const kidsMissionTitle = root.querySelector('#kidsMissionTitle');
  const kidsMissionText = root.querySelector('#kidsMissionText');
  const kidsMissionSub = root.querySelector('#kidsMissionSub');

  const kidsTransition = root.querySelector('.kidsTransition');
  const kidsTransitionIcon = root.querySelector('#kidsTransitionIcon');
  const kidsTransitionTitle = root.querySelector('#kidsTransitionTitle');
  const kidsTransitionText = root.querySelector('#kidsTransitionText');

  const kidsCoach = root.querySelector('.kidsCoach');
  const kidsCoachIcon = root.querySelector('#kidsCoachIcon');
  const kidsCoachText = root.querySelector('#kidsCoachText');

  const kidsBoard = root.querySelector('#kidsBoard');

  let lastState = null;
  let lastPhaseNo = 0;
  let phaseTransitionTimer = 0;

  function setCoach(kind, text){
    const mood = coachMoodFromKind(kind);
    kidsCoach.classList.remove('tip','good','warn','boss');
    kidsCoach.classList.add(mood.cls);
    kidsCoachIcon.textContent = mood.icon;
    kidsCoachText.textContent = text || 'เริ่มได้เลย!';
  }

  function applyThemeClass(S){
    const colors = getPhaseThemeColors(S.phaseNo);

    app.classList.remove('theme-classroom','theme-shared','theme-bathroom','theme-boss');
    app.classList.add(colors.themeClass);

    [phaseDot1, phaseDot2, phaseDot3, phaseDot4].forEach(n => n.classList.remove('active'));

    if(Number(S.phaseNo) === 1) phaseDot1.classList.add('active');
    if(Number(S.phaseNo) === 2) phaseDot2.classList.add('active');
    if(Number(S.phaseNo) === 3) phaseDot3.classList.add('active');
    if(Number(S.phaseNo) === 4) phaseDot4.classList.add('active');
  }

  function renderPhaseBar(S){
    const results = Array.isArray(S.phaseResults) ? S.phaseResults : [];
    const done1 = Number(S.phaseNo) > 1 || !!results.find(x => x.phaseNo === 1 && x.passed);
    const done2 = Number(S.phaseNo) > 2 || !!results.find(x => x.phaseNo === 2 && x.passed);
    const done3 = Number(S.phaseNo) > 3 || !!results.find(x => x.phaseNo === 3 && x.passed);
    const done4 = !!results.find(x => x.phaseNo === 4 && x.passed);

    phaseDot1.textContent = phaseCircle(Number(S.phaseNo) === 1, done1);
    phaseDot2.textContent = phaseCircle(Number(S.phaseNo) === 2, done2);
    phaseDot3.textContent = phaseCircle(Number(S.phaseNo) === 3, done3);
    phaseDot4.textContent = phaseCircle(Number(S.phaseNo) === 4, done4);

    phaseLine1.classList.toggle('done', done1);
    phaseLine2.classList.toggle('done', done2);
    phaseLine3.classList.toggle('done', done3);
  }

  function renderTop(S){
    kPhase.textContent = `ด่าน ${fmt(S.phaseNo)}/${fmt(S.phaseTotal || 4)}`;
    kTime.textContent = `เวลา: ${fmt(S.timeLeft)} วิ`;
    kPick.textContent = `เลือกแล้ว: ${fmt((S.chosenIds || []).length)}/${fmt(S.maxPicks || 0)}`;
    kStar.textContent = `ดาว: ${starText(S.stars)}`;
  }

  function renderMission(S){
    const meta = getPhaseThemeMeta(S.phaseNo);
    kidsMissionTitle.textContent = `${meta.icon} ${escapeHtml(S.phaseTitle || `ด่าน ${S.phaseNo}`)}`;

    if(Number(S.phaseNo) === 1){
      kidsMissionText.textContent = 'เลือกจุดที่ควรเช็ดก่อนในห้องเรียน';
      kidsMissionSub.textContent = meta.sub;
      return;
    }

    if(Number(S.phaseNo) === 2){
      kidsMissionText.textContent = 'เลือกของใช้ร่วมที่ควรเช็ดก่อน';
      kidsMissionSub.textContent = meta.sub;
      return;
    }

    if(Number(S.phaseNo) === 3){
      kidsMissionText.textContent = 'เลือกจุดเสี่ยงในห้องน้ำ และมองหาการ์ดพิเศษ ⭐';
      kidsMissionSub.textContent = meta.sub;
      return;
    }

    kidsMissionText.textContent = 'Boss Mission: เลือก 3 จุดหลักเพื่อหยุดการระบาด 👾';
    kidsMissionSub.textContent = meta.sub;
  }

  function renderCards(S){
    kidsBoard.innerHTML = '';

    (S.cards || []).forEach(card=>{
      const chosen = (S.chosenIds || []).includes(card.id);
      const isSpecial = !!S.specialId && S.specialId === card.id;
      const isBoss = !!S.bossId && S.bossId === card.id;

      const node = el('button', 'kidCard');
      node.type = 'button';
      node.classList.add(getCardThemeClass(S.phaseNo));

      if(chosen) node.classList.add('done','locked');
      if(isSpecial){
        node.classList.add('special');
        if(Number(S.phaseNo) === 3) node.classList.add('specialPulse');
      }
      if(isBoss){
        node.classList.add('boss','bossPulse');
      }

      if(card.kind === 'good') node.classList.add('goodHint');
      if(S.waitingNextPhase || S.ended) node.classList.add('locked');

      node.innerHTML = `
        <div class="kidCardIcon">${card.kidIcon || '🧽'}</div>
        <div class="kidCardLabel">${escapeHtml(card.kidLabel || card.name || card.id)}</div>
        <div class="kidCardHint">${
          isBoss ? 'Boss Mission 👾' :
          isSpecial ? 'ภารกิจพิเศษ ⭐' :
          'แตะเพื่อเลือก'
        }</div>
      `;

      node.addEventListener('click', ()=>{
        if(!opts.selectCard) return;
        const res = opts.selectCard(card.id);
        if(!res || !res.ok) return;

        if(res.isGood || res.isBoss){
          node.classList.add('correct');
        }else{
          node.classList.add('wrong');
        }
      });

      kidsBoard.appendChild(node);
    });
  }

  function showTransition(S){
    if(!S.waitingNextPhase) return;

    const currentPhase = Number(lastPhaseNo || S.phaseNo || 1);
    const nextPhase = Math.min((currentPhase || 1) + 1, Number(S.phaseTotal || 4));
    const nextMeta = getPhaseThemeMeta(nextPhase);

    kidsTransition.style.display = '';
    kidsTransitionIcon.textContent =
      currentPhase >= 4 ? '🏁' :
      nextPhase === 4 ? '👾' : '🎉';

    kidsTransitionTitle.textContent =
      currentPhase >= 4 ? 'จบเกมแล้ว!' : `ผ่านด่าน ${currentPhase} แล้ว!`;

    kidsTransitionText.textContent =
      currentPhase >= 4
        ? 'กำลังสรุปผลทั้งเกม...'
        : (nextPhase === 4
            ? `ต่อไป: ${nextMeta.icon} ${nextMeta.title} — ด่านสุดท้าย 👾`
            : `ต่อไป: ${nextMeta.icon} ${nextMeta.title}`);

    clearTimeout(phaseTransitionTimer);
    phaseTransitionTimer = setTimeout(()=>{
      if(lastState && !lastState.waitingNextPhase){
        kidsTransition.style.display = 'none';
      }
    }, 1200);
  }

  function hideTransition(){
    if(kidsTransition) kidsTransition.style.display = 'none';
  }

  function onState(S){
    const phaseChanged = Number(S.phaseNo || 0) !== Number(lastPhaseNo || 0);
    lastState = S;

    applyThemeClass(S);
    renderTop(S);
    renderPhaseBar(S);
    renderMission(S);
    renderCards(S);

    if(S.waitingNextPhase){
      showTransition(S);
    } else {
      hideTransition();
    }

    if(phaseChanged && Number(lastPhaseNo) > 0 && !S.waitingNextPhase){
      setCoach('tip', `เริ่ม ${S.phaseTitle || `ด่าน ${S.phaseNo}`} ได้เลย`);
    }

    lastPhaseNo = Number(S.phaseNo || lastPhaseNo || 1);
  }

  function onTick(S){
    if(S) renderTop(S);
  }

  function onCoach(msg){
    if(!msg) return;
    setCoach(msg.kind, msg.text);
  }

  function goCooldown(){
    const hub = qs('hub','') || '../hub.html';
    const base = new URL(location.href);
    const g = new URL('../warmup-gate.html', base);

    g.searchParams.set('gatePhase','cooldown');
    g.searchParams.set('phase','cooldown');
    g.searchParams.set('cat','hygiene');
    g.searchParams.set('theme','cleanobjects-kids');
    g.searchParams.set('game','cleanobjects-kids');
    g.searchParams.set('cd','1');
    g.searchParams.set('next', hub);
    g.searchParams.set('hub', hub);

    ['run','diff','time','seed','pid','view','ai','debug','api','log','studyId','phase','conditionGroup','boss','bossType','kids']
      .forEach(k=>{
        const v = base.searchParams.get(k);
        if(v !== null && v !== '') g.searchParams.set(k, v);
      });

    location.href = g.toString();
  }

  function goHub(){
    const hub = qs('hub','') || '../hub.html';
    location.href = hub;
  }

  function replay(){
    location.reload();
  }

  function renderSummaryGrid(metrics){
    const rows = [];
    const phaseResults = Array.isArray(metrics?.phaseResults) ? metrics.phaseResults : [];

    phaseResults.forEach(r=>{
      rows.push(`
        <div class="kidsSummaryBox">
          <div class="kidsSummaryBoxTitle">ด่าน ${fmt(r.phaseNo)}</div>
          <div class="kidsSummaryBoxText">
            ถูก ${fmt(r.correct)} • ผิด ${fmt(r.wrong)}<br>
            ดาว ${starText(r.stars)}<br>
            ${r.specialDone ? 'ภารกิจพิเศษสำเร็จ ✅<br>' : ''}
            ${r.bossClear ? 'Boss สำเร็จ 🏆' : ''}
            ${!r.specialDone && !r.bossClear ? (r.passed ? 'ผ่านด่าน ✅' : 'ยังไม่ผ่าน') : ''}
          </div>
        </div>
      `);
    });

    if(!rows.length){
      rows.push(`
        <div class="kidsSummaryBox">
          <div class="kidsSummaryBoxTitle">สรุป</div>
          <div class="kidsSummaryBoxText">ยังไม่มีข้อมูลด่าน</div>
        </div>
      `);
    }

    return rows.join('');
  }

  function onSummary(summary){
    const metrics = summary?.metrics || {};
    const totalStars = Number(metrics?.stars || 0);
    const totalCorrect = Number(metrics?.totalCorrect || 0);
    const totalWrong = Number(metrics?.totalWrong || 0);
    const phaseCount = Number(metrics?.phaseCount || 4);
    const bossClear = !!metrics?.bossClear;

    const title = bossClear
      ? 'สุดยอด! ชนะ Boss Mission แล้ว 👾'
      : summaryTitleFromStars(totalStars);

    const sub = [
      `ผ่านทั้งหมด ${phaseCount} ด่าน`,
      `เลือกถูก ${totalCorrect} จุด`,
      totalWrong > 0 ? `เลือกพลาด ${totalWrong} จุด` : 'แทบไม่พลาดเลย',
      bossClear ? 'หยุดการระบาดสำเร็จ ✅' : 'ยังไม่ชนะบอส'
    ].join(' • ');

    const box = root.querySelector('#kidsSummary');
    root.querySelector('#kidsSummaryStars').textContent = starText(Math.ceil(totalStars / 4));
    root.querySelector('#kidsSummaryText').textContent = title;
    root.querySelector('#kidsSummarySub').textContent = sub;
    root.querySelector('#kidsSummaryGrid').innerHTML = renderSummaryGrid(metrics);

    box.style.display = '';

    root.querySelector('#kidsBtnCooldown').onclick = goCooldown;
    root.querySelector('#kidsBtnHub').onclick = goHub;
    root.querySelector('#kidsBtnReplay').onclick = replay;
  }

  return {
    onState,
    onTick,
    onCoach,
    onSummary
  };
}