/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-modal-compact-fix.js
 * PATCH v20260514-P48-BRUSH-KIDS-SUMMARY-MODAL-COMPACT-FIX
 *
 * Purpose:
 * - Fix core brush.js summary modal after finishGame()
 * - Rank C / low coverage must not look like full success
 * - Stars must match actual result
 * - Child-friendly short feedback
 * - Do not show/inject anything during Prep / Gameplay
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260514-P48-BRUSH-KIDS-SUMMARY-MODAL-COMPACT-FIX';

  function $(id){
    return DOC.getElementById(id);
  }

  function textOf(el){
    try{
      return el ? String(el.textContent || '').trim() : '';
    }catch(_){
      return '';
    }
  }

  function numFromText(value, fallback){
    const m = String(value || '').match(/-?\d+(?:\.\d+)?/);
    if(!m) return fallback || 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function isModalOpen(){
    const modal = $('summaryModal');
    if(!modal) return false;
    if(modal.hidden) return false;

    const cs = WIN.getComputedStyle ? WIN.getComputedStyle(modal) : null;
    if(cs && cs.display === 'none') return false;

    return true;
  }

  function isPrepOrPlay(){
    const bodyText = (DOC.body && (DOC.body.innerText || DOC.body.textContent || '')) || '';

    if(/เตรียมแปรงสีฟัน|พร้อมแปรงฟัน|เริ่มแปรงฟัน|วิธีเล่น|แนวคิด simulation|ลายยาสีฟัน/i.test(bodyText)){
      return !isModalOpen();
    }

    return false;
  }

  function getSummaryData(){
    const rankEl = $('summaryRank');
    const scoreEl = $('summaryScore');
    const coverageEl = $('summaryCoverage');
    const accuracyEl = $('summaryAccuracy');

    const rank = textOf(rankEl) || 'C';
    const score = numFromText(textOf(scoreEl), 0);
    const coverage = numFromText(textOf(coverageEl), 0);
    const accuracy = numFromText(textOf(accuracyEl), 0);

    return {
      rank,
      score,
      coverage,
      accuracy
    };
  }

  function starByResult(data){
    const rank = String(data.rank || '').toUpperCase();
    const coverage = Number(data.coverage || 0);
    const accuracy = Number(data.accuracy || 0);

    if(rank === 'S' || (coverage >= 95 && accuracy >= 90)) return '⭐⭐⭐';
    if(rank === 'A' || (coverage >= 80 && accuracy >= 80)) return '⭐⭐⭐';
    if(rank === 'B' || coverage >= 55) return '⭐⭐';
    return '⭐';
  }

  function titleByResult(data){
    const rank = String(data.rank || '').toUpperCase();
    const coverage = Number(data.coverage || 0);

    if(rank === 'S' || coverage >= 95) return 'สุดยอดมาก!';
    if(rank === 'A' || coverage >= 80) return 'เยี่ยมมาก!';
    if(rank === 'B' || coverage >= 55) return 'ทำได้ดี!';
    return 'เริ่มได้ดีแล้ว!';
  }

  function noteByResult(data){
    const coverage = Number(data.coverage || 0);
    const accuracy = Number(data.accuracy || 0);

    if(coverage >= 95 && accuracy >= 85){
      return 'ฟันสะอาดครบเกือบทุกโซน เก่งมาก!';
    }

    if(coverage >= 80){
      return 'ทำได้ดีมากแล้ว รอบหน้าลองเก็บโซนที่เหลือให้ครบ!';
    }

    if(coverage >= 55){
      return 'ทำได้ดีแล้ว ลองแปรงต่อเนื่องให้ครบหลายโซนขึ้นนะ';
    }

    if(accuracy >= 85){
      return 'เริ่มได้ดีแล้ว! แปรงได้แม่น แต่ยังต้องเก็บโซนให้มากขึ้นนะ';
    }

    return 'เริ่มได้ดีแล้ว! รอบหน้าลองเลือกโซน แล้วแปรงให้ครบมากขึ้นนะ';
  }

  function adviceByResult(data){
    const coverage = Number(data.coverage || 0);
    const accuracy = Number(data.accuracy || 0);

    if(coverage < 35){
      return 'เริ่มได้ดีแล้ว ลองเลือกโซนฟันทีละจุด แล้วแปรงตามคำแนะนำกลางจอ';
    }

    if(coverage < 60){
      return 'รอบหน้า ลองเก็บอย่างน้อย 3 โซน และอย่าลืมแปรงด้านในกับแนวเหงือก';
    }

    if(coverage < 85){
      return 'ใกล้ครบแล้ว! ลองเก็บโซนที่เหลือให้ครบ 6/6 เพื่อชนะบอส';
    }

    if(accuracy < 80){
      return 'ฟันสะอาดดีแล้ว แต่ควรแปรงให้นิ่งและตรงจุดมากขึ้น';
    }

    return 'ยอดเยี่ยม! ครั้งหน้าลองรักษาคอมโบให้ยาวขึ้นและกันบอสให้ได้';
  }

  function rankTone(data){
    const coverage = Number(data.coverage || 0);

    if(coverage >= 85) return 'great';
    if(coverage >= 55) return 'good';
    return 'start';
  }

  function ensureStyle(){
    if($('hha-summary-modal-compact-fix-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-summary-modal-compact-fix-style';
    style.textContent = `
      #summaryModal.hha-p48-summary-fixed .summaryCard{
        width:min(720px,94vw) !important;
        border-radius:34px !important;
        padding:22px !important;
      }

      #summaryModal.hha-p48-summary-fixed .summaryHero{
        gap:8px !important;
      }

      #summaryModal.hha-p48-summary-fixed #summaryRank{
        min-width:96px;
        min-height:82px;
        display:inline-grid;
        place-items:center;
        border-radius:28px;
        font-size:52px !important;
        font-weight:1000 !important;
        line-height:1 !important;
      }

      #summaryModal.hha-p48-summary-fixed[data-tone="great"] #summaryRank{
        background:linear-gradient(180deg,#dcfff2,#baf4cf) !important;
        color:#14532d !important;
      }

      #summaryModal.hha-p48-summary-fixed[data-tone="good"] #summaryRank{
        background:linear-gradient(180deg,#ecfeff,#ffffff) !important;
        color:#0f766e !important;
      }

      #summaryModal.hha-p48-summary-fixed[data-tone="start"] #summaryRank{
        background:linear-gradient(180deg,#fff7b7,#ffe066) !important;
        color:#5b4200 !important;
      }

      #summaryModal.hha-p48-summary-fixed #summaryStars{
        font-size:34px !important;
        line-height:1.05 !important;
        letter-spacing:2px;
      }

      #summaryModal.hha-p48-summary-fixed .summaryGrid{
        grid-template-columns:repeat(3,minmax(0,1fr)) !important;
      }

      #summaryModal.hha-p48-summary-fixed .summaryBox{
        min-height:78px !important;
      }

      #summaryModal.hha-p48-summary-fixed .summaryBox b{
        font-size:clamp(26px,4vw,34px) !important;
      }

      #summaryModal.hha-p48-summary-fixed #summaryAdvice{
        text-align:center;
        font-size:15px !important;
        line-height:1.45 !important;
        font-weight:950 !important;
      }

      .hha-p48-kids-line{
        margin-top:2px;
        color:#5f7f92;
        font-size:16px;
        font-weight:950;
        line-height:1.35;
        text-align:center;
      }

      .hha-p48-mini-badges{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:4px;
      }

      .hha-p48-mini-badge{
        min-height:44px;
        border-radius:16px;
        border:2px solid #bbf7d0;
        background:rgba(236,253,245,.92);
        color:#166534;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:8px;
        text-align:center;
        font-size:13px;
        font-weight:1000;
      }

      .hha-p48-mini-badge.warn{
        border-color:#fde68a;
        background:#fffbeb;
        color:#6b4f00;
      }

      @media (max-width:640px){
        #summaryModal.hha-p48-summary-fixed .summaryGrid,
        .hha-p48-mini-badges{
          grid-template-columns:1fr !important;
        }

        #summaryModal.hha-p48-summary-fixed .summaryCard{
          padding:18px !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureKidsLine(){
    const hero = DOC.querySelector('#summaryModal .summaryHero');
    if(!hero) return null;

    let line = $('hha-p48-kids-line');
    if(!line){
      line = DOC.createElement('div');
      line.id = 'hha-p48-kids-line';
      line.className = 'hha-p48-kids-line';

      const stars = $('summaryStars');
      if(stars && stars.parentElement === hero){
        hero.insertBefore(line, stars.nextSibling);
      }else{
        hero.appendChild(line);
      }
    }

    return line;
  }

  function ensureBadges(){
    const modal = $('summaryModal');
    const grid = modal ? modal.querySelector('.summaryGrid') : null;
    if(!grid) return null;

    let badges = $('hha-p48-mini-badges');
    if(!badges){
      badges = DOC.createElement('div');
      badges.id = 'hha-p48-mini-badges';
      badges.className = 'hha-p48-mini-badges';
      grid.insertAdjacentElement('afterend', badges);
    }

    return badges;
  }

  function patchSummary(){
    if(!isModalOpen()) return;
    if(isPrepOrPlay()) return;

    ensureStyle();

    const modal = $('summaryModal');
    const rankEl = $('summaryRank');
    const starsEl = $('summaryStars');
    const noteEl = $('summaryLiveNote');
    const adviceEl = $('summaryAdvice');

    if(!modal || !rankEl || !starsEl) return;

    const data = getSummaryData();
    const tone = rankTone(data);

    modal.classList.add('hha-p48-summary-fixed');
    modal.setAttribute('data-tone', tone);
    modal.setAttribute('data-patch', PATCH_ID);

    const newTitle = titleByResult(data);
    const newStars = starByResult(data);
    const newNote = noteByResult(data);
    const newAdvice = adviceByResult(data);

    const title = DOC.querySelector('#summaryModal .summaryHero h2');
    if(title){
      title.textContent = newTitle;
    }

    starsEl.textContent = newStars;

    if(noteEl){
      noteEl.textContent = newNote;
    }

    const kidsLine = ensureKidsLine();
    if(kidsLine){
      kidsLine.textContent = `Coverage ${data.coverage}% • Accuracy ${data.accuracy}%`;
    }

    if(adviceEl){
      adviceEl.textContent = newAdvice;
    }

    const badges = ensureBadges();
    if(badges){
      const coveragePass = data.coverage >= 80;
      const accuracyPass = data.accuracy >= 80;
      const startPass = data.coverage > 0 || data.score > 0;

      badges.innerHTML = `
        <div class="hha-p48-mini-badge ${startPass ? '' : 'warn'}">
          <span>🪥 เริ่มแปรง</span>
          <strong>${startPass ? 'ผ่าน' : 'ลองใหม่'}</strong>
        </div>
        <div class="hha-p48-mini-badge ${coveragePass ? '' : 'warn'}">
          <span>🦷 ครบหลายโซน</span>
          <strong>${coveragePass ? 'ดีมาก' : 'ฝึกต่อ'}</strong>
        </div>
        <div class="hha-p48-mini-badge ${accuracyPass ? '' : 'warn'}">
          <span>🎯 แปรงตรงจุด</span>
          <strong>${accuracyPass ? 'เยี่ยม' : 'ฝึกต่อ'}</strong>
        </div>
      `;
    }

    try{
      localStorage.setItem('HHA_BRUSH_KIDS_SUMMARY_MODAL_P48', JSON.stringify({
        patch: PATCH_ID,
        ts: new Date().toISOString(),
        data,
        title: newTitle,
        stars: newStars,
        note: newNote,
        advice: newAdvice
      }));
    }catch(_){}
  }

  function apply(){
    if(!isModalOpen()) return;
    patchSummary();
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 80);
    };

    try{
      const modal = $('summaryModal');
      if(modal){
        const moModal = new MutationObserver(run);
        moModal.observe(modal, {
          attributes:true,
          attributeFilter:['hidden','class','style'],
          childList:true,
          subtree:true,
          characterData:true
        });
      }

      const moBody = new MutationObserver(run);
      moBody.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true
      });
    }catch(_){}

    setTimeout(apply, 120);
    setTimeout(apply, 400);
    setTimeout(apply, 900);
    setTimeout(apply, 1600);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_MODAL_COMPACT_FIX = {
      patch: PATCH_ID,
      apply,
      getSummaryData,
      starByResult,
      titleByResult,
      noteByResult,
      adviceByResult
    };
  }

  function boot(){
    expose();
    observe();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
