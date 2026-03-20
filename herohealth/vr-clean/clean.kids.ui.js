// === /herohealth/vr-clean/clean.kids.ui.js ===
// Clean Objects — Kids Mode UI
// CHILD-FRIENDLY for Grade 5
// PATCH v20260320-CLEAN-KIDS-UI-r1

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
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
}
function starText(n){
  n = Number(n || 0);
  if(n >= 3) return '⭐⭐⭐';
  if(n >= 2) return '⭐⭐';
  if(n >= 1) return '⭐';
  return '☆';
}

export function mountCleanKidsUI(root, opts={}){
  root.innerHTML = '';

  const app = el('div','kidsApp');
  root.appendChild(app);

  const top = el('div','kidsTop');
  top.innerHTML = `
    <div class="kidPill" id="kTime">เวลา: 0</div>
    <div class="kidPill" id="kPick">เลือกแล้ว: 0/3</div>
    <div class="kidPill" id="kStar">ดาว: ☆</div>
  `;
  app.appendChild(top);

  const mission = el('div','kidsMission');
  mission.innerHTML = `
    <div class="kidsMissionTitle">ภารกิจ</div>
    <div class="kidsMissionText" id="kidsMissionText">แตะจุดที่ควรเช็ดก่อน</div>
  `;
  app.appendChild(mission);

  const board = el('div','kidsBoard');
  board.id = 'kidsBoard';
  app.appendChild(board);

  const coach = el('div','kidsCoach');
  coach.innerHTML = `
    <div class="kidsCoachIcon" id="kidsCoachIcon">😄</div>
    <div class="kidsCoachText" id="kidsCoachText">เริ่มได้เลย!</div>
  `;
  app.appendChild(coach);

  const summary = el('div','kidsSummary');
  summary.style.display = 'none';
  summary.innerHTML = `
    <div class="kidsSummaryCard">
      <div class="kidsSummaryTitle">สรุปผล</div>
      <div class="kidsSummaryStars" id="kidsSummaryStars">⭐</div>
      <div class="kidsSummaryText" id="kidsSummaryText">เก่งมาก!</div>
      <div class="kidsSummarySub" id="kidsSummarySub"></div>
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
      font-size:16px;
      font-weight:1000;
      line-height:1.35;
    }
    .kidsBoard{
      display:grid;
      grid-template-columns:repeat(2, minmax(0,1fr));
      gap:12px;
    }
    .kidCard{
      min-height:140px;
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
    }
    .kidCard.goodHint{
      box-shadow:0 0 0 6px rgba(239,68,68,.10), 0 18px 40px rgba(0,0,0,.22);
    }
    .kidCard.special{
      outline:3px solid rgba(245,158,11,.75);
      outline-offset:2px;
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
    }
    .kidsSummaryCard{
      max-width:760px;
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

    @media (max-width:640px){
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
    }
  `;
  root.appendChild(style);

  const kTime = root.querySelector('#kTime');
  const kPick = root.querySelector('#kPick');
  const kStar = root.querySelector('#kStar');
  const kidsMissionText = root.querySelector('#kidsMissionText');
  const kidsCoachIcon = root.querySelector('#kidsCoachIcon');
  const kidsCoachText = root.querySelector('#kidsCoachText');
  const kidsBoard = root.querySelector('#kidsBoard');

  let lastState = null;

  function setCoach(kind, text){
    kidsCoachText.textContent = text || 'เริ่มได้เลย!';
    kidsCoachIcon.textContent =
      kind === 'good' ? '😄' :
      kind === 'warn' ? '🤔' :
      kind === 'boss' ? '🌟' : '😊';
  }

  function renderCards(S){
    kidsBoard.innerHTML = '';
    (S.cards || []).forEach(card=>{
      const chosen = (S.chosenIds || []).includes(card.id);
      const isSpecial = !!S.specialId && S.specialId === card.id;
      const node = el('button', 'kidCard');
      node.type = 'button';
      if(chosen) node.classList.add('done');
      if(isSpecial) node.classList.add('special');
      if((S.goodIds || []).includes(card.id)) node.classList.add('goodHint');

      node.innerHTML = `
        <div class="kidCardIcon">${card.kidIcon || '🧽'}</div>
        <div class="kidCardLabel">${escapeHtml(card.kidLabel || card.name || card.id)}</div>
        <div class="kidCardHint">${isSpecial ? 'ภารกิจพิเศษ' : 'แตะเพื่อเลือก'}</div>
      `;

      node.addEventListener('click', ()=>{
        if(!opts.selectCard) return;
        const res = opts.selectCard(card.id);
        if(!res || !res.ok) return;

        if(res.isGood){
          node.classList.add('correct');
        }else{
          node.classList.add('wrong');
        }
      });

      kidsBoard.appendChild(node);
    });
  }

  function renderTop(S){
    kTime.textContent = `เวลา: ${fmt(S.timeLeft)} วิ`;
    kPick.textContent = `เลือกแล้ว: ${fmt((S.chosenIds || []).length)}/${fmt(S.maxPicks || 3)}`;
    kStar.textContent = `ดาว: ${starText(S.stars)}`;
  }

  function onState(S){
    lastState = S;
    renderTop(S);
    renderCards(S);

    if(kidsMissionText){
      kidsMissionText.textContent = S.specialId
        ? 'แตะจุดที่ควรเช็ดก่อน และมองหาภารกิจพิเศษ'
        : 'แตะจุดที่ควรเช็ดก่อน';
    }
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
    g.searchParams.set('theme','cleanobjects');
    g.searchParams.set('game','cleanobjects');
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

  function onSummary(summary){
    const stars = Number(summary?.metrics?.stars || 0);
    const correct = Number(summary?.metrics?.correct || 0);
    const wrong = Number(summary?.metrics?.wrong || 0);
    const specialDone = !!summary?.metrics?.specialDone;

    const title =
      stars >= 3 ? 'เก่งมาก! ได้ 3 ดาว' :
      stars >= 2 ? 'ดีมาก! ได้ 2 ดาว' :
      'พยายามได้ดีแล้ว';

    const sub = [
      `เลือกถูก ${correct} จุด`,
      wrong > 0 ? `เลือกพลาด ${wrong} จุด` : 'แทบไม่พลาดเลย',
      specialDone ? 'ทำภารกิจพิเศษสำเร็จ ✅' : 'ยังไม่ได้ภารกิจพิเศษ'
    ].join(' • ');

    const box = root.querySelector('#kidsSummary');
    root.querySelector('#kidsSummaryStars').textContent = starText(stars);
    root.querySelector('#kidsSummaryText').textContent = title;
    root.querySelector('#kidsSummarySub').textContent = sub;
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