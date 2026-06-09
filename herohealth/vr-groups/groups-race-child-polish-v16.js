/* =========================================================
   HeroHealth • Groups Race Child Polish v16
   File: /herohealth/vr-groups/groups-race-child-polish-v16.js
   Purpose:
   - ทำให้ Groups Race เหมาะกับเด็ก ป.5 มากขึ้น
   - เพิ่ม feedback, badge, rank, mascot coach
   - ไม่รื้อระบบหลัก v15
   ========================================================= */

(function(){
  'use strict';

  const PATCH = 'v20260609-GROUPS-RACE-CHILD-POLISH-V16';

  if (window.__HHA_GROUPS_RACE_CHILD_POLISH_V16__) return;
  window.__HHA_GROUPS_RACE_CHILD_POLISH_V16__ = true;

  function $(id){ return document.getElementById(id); }

  function text(v){
    return String(v == null ? '' : v).trim();
  }

  function num(id){
    const el = $(id);
    if (!el) return 0;
    const n = Number(String(el.textContent || '').replace(/[^\d.]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function injectStyle(){
    if ($('hhaGroupsRaceChildPolishV16Style')) return;

    const style = document.createElement('style');
    style.id = 'hhaGroupsRaceChildPolishV16Style';
    style.textContent = `
      :root{
        --child-sky:#7dd3fc;
        --child-mint:#86efac;
        --child-sun:#fde68a;
        --child-pink:#f9a8d4;
      }

      body.hha-race-child-polish-v16 #hhaRacePlayV15{
        background:
          radial-gradient(circle at 15% 12%, rgba(125,211,252,.22), transparent 30%),
          radial-gradient(circle at 86% 10%, rgba(253,230,138,.20), transparent 26%),
          radial-gradient(circle at 50% 92%, rgba(134,239,172,.16), transparent 34%),
          linear-gradient(180deg,#07163f 0%,#082569 48%,#0d3b91 100%);
      }

      .hha-child-coach-v16{
        display:flex;
        align-items:center;
        gap:12px;
        margin-top:12px;
        padding:12px 14px;
        border-radius:22px;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.17);
        box-shadow:0 14px 34px rgba(0,0,0,.20);
      }

      .hha-child-coach-avatar-v16{
        width:54px;
        height:54px;
        border-radius:18px;
        display:grid;
        place-items:center;
        flex:0 0 auto;
        font-size:30px;
        background:linear-gradient(135deg,#fef3c7,#fdba74);
        color:#431407;
        border:1px solid rgba(255,255,255,.25);
      }

      .hha-child-coach-text-v16{
        min-width:0;
        color:#e0f2fe;
        font-size:15px;
        font-weight:950;
        line-height:1.35;
      }

      .hha-child-coach-text-v16 b{
        color:#bbf7d0;
      }

      .hha-child-badge-v16{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        margin:8px auto 0;
        padding:8px 13px;
        border-radius:999px;
        background:rgba(253,230,138,.14);
        border:1px solid rgba(253,230,138,.32);
        color:#fde68a;
        font-weight:1000;
        font-size:14px;
      }

      .hha-child-combo-pop-v16{
        position:fixed;
        left:50%;
        top:calc(82px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:999999;
        padding:12px 18px;
        border-radius:20px;
        background:rgba(15,23,42,.94);
        color:#fff;
        border:1px solid rgba(255,255,255,.18);
        box-shadow:0 16px 44px rgba(0,0,0,.32);
        font-weight:1000;
        font-size:18px;
        pointer-events:none;
        animation:hhaComboPopV16 .85s ease both;
      }

      @keyframes hhaComboPopV16{
        0%{ opacity:0; transform:translateX(-50%) scale(.88) translateY(-10px); }
        20%{ opacity:1; transform:translateX(-50%) scale(1.06) translateY(0); }
        80%{ opacity:1; transform:translateX(-50%) scale(1); }
        100%{ opacity:0; transform:translateX(-50%) scale(.96) translateY(-8px); }
      }

      body.hha-race-child-polish-v16 .hha-race-food-name{
        text-shadow:0 8px 20px rgba(0,0,0,.28);
      }

      body.hha-race-child-polish-v16 .hha-race-choice{
        min-height:82px;
        border:2px solid rgba(255,255,255,.40);
      }

      body.hha-race-child-polish-v16 .hha-race-choice:focus-visible{
        outline:4px solid rgba(253,230,138,.75);
        outline-offset:3px;
      }

      body.hha-race-child-polish-v16 .hha-race-summary{
        background:
          radial-gradient(circle at 20% 10%, rgba(253,230,138,.12), transparent 28%),
          radial-gradient(circle at 88% 18%, rgba(134,239,172,.12), transparent 24%),
          rgba(255,255,255,.10);
      }

      .hha-summary-rank-title-v16{
        margin:10px 0 8px;
        padding:12px;
        border-radius:20px;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.13);
        color:#e0f2fe;
        font-weight:1000;
        font-size:clamp(18px,5vw,26px);
      }

      .hha-summary-tip-v16{
        margin-top:10px;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(34,197,94,.13);
        border:1px solid rgba(187,247,208,.22);
        color:#dcfce7;
        font-weight:900;
        line-height:1.45;
      }

      @media (max-width:768px){
        .hha-child-coach-v16{
          padding:10px;
          gap:9px;
        }

        .hha-child-coach-avatar-v16{
          width:46px;
          height:46px;
          border-radius:16px;
          font-size:26px;
        }

        .hha-child-coach-text-v16{
          font-size:13px;
        }

        body.hha-race-child-polish-v16 .hha-race-choice{
          min-height:76px;
          font-size:clamp(15px,4.4vw,19px);
        }

        body.hha-race-child-polish-v16 .hha-race-food{
          width:min(230px,62vw);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function addCoachBox(){
    const question = $('hhaRaceQuestion');
    if (!question) return;

    if ($('hhaChildCoachV16')) return;

    const box = document.createElement('div');
    box.id = 'hhaChildCoachV16';
    box.className = 'hha-child-coach-v16';
    box.innerHTML = `
      <div class="hha-child-coach-avatar-v16">🧑‍🍳</div>
      <div class="hha-child-coach-text-v16" id="hhaChildCoachTextV16">
        ดูอาหารตรงกลาง แล้วเลือก <b>หมู่อาหาร</b> ให้ถูกนะ!
      </div>
    `;

    question.appendChild(box);
  }

  function setCoach(msg){
    const el = $('hhaChildCoachTextV16');
    if (!el) return;
    el.innerHTML = msg;
  }

  function comboPop(msg){
    const old = $('hhaChildComboPopV16');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'hhaChildComboPopV16';
    el.className = 'hha-child-combo-pop-v16';
    el.textContent = msg;
    document.body.appendChild(el);

    setTimeout(function(){
      try { el.remove(); } catch(_) {}
    }, 900);
  }

  function rankName(score, acc, combo){
    if (score >= 2200 || acc >= 90 || combo >= 12) return '🏆 Nutrition Champion';
    if (score >= 1600 || acc >= 80 || combo >= 8) return '🌟 Food Hero';
    if (score >= 900 || acc >= 65 || combo >= 4) return '⭐ Food Learner';
    return '🌱 Food Rookie';
  }

  function summaryTip(acc){
    if (acc >= 90) return 'เยี่ยมมาก! หนูจำหมู่อาหารได้แม่นมาก ลองเล่นอีกครั้งเพื่อทำ Combo ให้สูงกว่าเดิมนะ';
    if (acc >= 75) return 'ทำได้ดีมาก! รอบหน้าเน้นดูว่าอาหารให้พลังงานจากหมู่ไหน จะตอบได้เร็วขึ้น';
    if (acc >= 55) return 'เริ่มดีแล้ว! ลองจำง่าย ๆ: โปรตีนช่วยซ่อมแซมร่างกาย ข้าว-แป้งให้พลังงาน ผักผลไม้ช่วยให้สดชื่น';
    return 'ไม่เป็นไรนะ ลองเล่นใหม่อีกครั้ง เกมนี้ฝึกจำหมู่อาหาร ยิ่งเล่นยิ่งเก่ง';
  }

  function enhanceSummary(){
    const summary = $('hhaRaceSummary');
    const summaryText = $('hhaRaceSummaryText');
    if (!summary || !summaryText) return;

    const visible = getComputedStyle(summary).display !== 'none';
    if (!visible) return;

    if ($('hhaSummaryRankTitleV16')) return;

    const score = num('hhaRaceScore');
    const combo = num('hhaRaceCombo');

    let acc = 0;
    const raw = text(summaryText.textContent);
    const m = raw.match(/(\d+)\s*%/);
    if (m) acc = Number(m[1]) || 0;

    const rank = rankName(score, acc, combo);

    const rankEl = document.createElement('div');
    rankEl.id = 'hhaSummaryRankTitleV16';
    rankEl.className = 'hha-summary-rank-title-v16';
    rankEl.textContent = rank;

    const tipEl = document.createElement('div');
    tipEl.id = 'hhaSummaryTipV16';
    tipEl.className = 'hha-summary-tip-v16';
    tipEl.textContent = summaryTip(acc);

    summaryText.parentNode.insertBefore(rankEl, summaryText);
    summaryText.parentNode.insertBefore(tipEl, summaryText.nextSibling);
  }

  function normalizeFoodText(){
    const foodName = $('hhaRaceFoodName');
    if (!foodName) return;

    const name = text(foodName.textContent);

    /*
      น้ำมันใช้ emoji ถังแล้ว อาจสับสนกับน้ำมันเครื่อง
      เปลี่ยน coach text เพื่อช่วยเด็กเข้าใจว่าเป็นน้ำมันพืช/ไขมัน
    */
    if (name === 'น้ำมัน') {
      setCoach('นี่คือ <b>น้ำมันพืช</b> เป็นอาหารหมู่ 5 ไขมัน ให้พลังงานสูงนะ');
    }
  }

  function watchFeedback(){
    let lastCorrect = -1;
    let lastCombo = -1;
    let lastFood = '';

    setInterval(function(){
      addCoachBox();
      normalizeFoodText();
      enhanceSummary();

      const correct = num('hhaRaceCorrect');
      const combo = num('hhaRaceCombo');
      const food = text(($('hhaRaceFoodName') || {}).textContent || '');

      if (food && food !== lastFood) {
        lastFood = food;
        if (food !== 'น้ำมัน') {
          setCoach('ดูให้ดีนะ: <b>' + food + '</b> อยู่หมู่อาหารใด?');
        }
      }

      if (correct !== lastCorrect) {
        if (lastCorrect >= 0 && correct > lastCorrect) {
          setCoach('✅ เก่งมาก! ตอบถูกแล้ว ลองทำ Combo ต่อเนื่องนะ');
        }
        lastCorrect = correct;
      }

      if (combo !== lastCombo) {
        if (combo >= 5 && combo > lastCombo) {
          comboPop('🔥 Combo ' + combo + '!');
          setCoach('🔥 สุดยอด! Combo ' + combo + ' แล้ว รักษาจังหวะต่อไปนะ');
        }
        if (combo === 0 && lastCombo > 0) {
          setCoach('ไม่เป็นไรนะ ลองใหม่อีกครั้ง เลือกจากลักษณะของอาหารได้เลย');
        }
        lastCombo = combo;
      }
    }, 350);
  }

  function boot(){
    document.body.classList.add('hha-race-child-polish-v16');
    injectStyle();
    watchFeedback();

    console.info('[GroupsRaceChildPolishV16]', {
      patch: PATCH,
      status: 'ready'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
