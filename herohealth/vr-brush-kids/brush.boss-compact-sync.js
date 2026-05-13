/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.boss-compact-sync.js
 * PATCH v20260513-P45-BRUSH-KIDS-BOSS-COMPACT-SYNC
 *
 * Purpose:
 * - ใช้ผลจาก brush.boss-gate.js เป็น source of truth
 * - แสดงผลบอสแบบสั้นใน Compact Summary
 * - ซ่อน Boss Gate ตารางยาวในโหมดเด็ก
 * - ถ้าแพ้บอส: summary ต้องบอกว่า "เกือบชนะแล้ว" ไม่ใช่ "ชนะทุกอย่าง"
 * - มีปุ่มเล็ก "รายละเอียดครู" สำหรับดูเงื่อนไข 7 ข้อ
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260513-P45-BRUSH-KIDS-BOSS-COMPACT-SYNC';
  const OUT_KEY = 'HHA_BRUSH_KIDS_BOSS_COMPACT_SYNC';

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
  }

  function isSummary(){
    const t = text();

    const hasSummary =
      /ผลการแปรงฟันของฉัน|Clean Teeth|Replay Challenge|Best Score|Best Clean|Tooth Pet Rescue|เยี่ยมมาก/i.test(t);

    const isPrep =
      /พร้อมแปรงฟัน|พร้อมแล้ว ไปเล่นจริง|Prep|ลายยาสีฟัน|ยังไม่ได้ใส่ยาสีฟัน/i.test(t);

    return hasSummary && !isPrep;
  }

  function readJson(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(_){}
  }

  function bossResult(){
    /*
     * Prefer live P44 API if available.
     * Fallback to localStorage result from P44.
     */
    try{
      if(WIN.HHA_BRUSH_BOSS_GATE && typeof WIN.HHA_BRUSH_BOSS_GATE.result === 'function'){
        return WIN.HHA_BRUSH_BOSS_GATE.result();
      }
    }catch(_){}

    return readJson('HHA_BRUSH_KIDS_BOSS_GATE') || null;
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-boss-compact-sync-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-boss-compact-sync-style';
    style.textContent = `
      /* ซ่อนตาราง Boss Gate ยาวในหน้าเด็กไว้ก่อน */
      body.hha-boss-compact-sync #hha-brush-boss-gate-card{
        display:none !important;
      }

      #hha-boss-compact-card{
        margin-top:14px;
        border-radius:24px;
        border:3px solid #bdf4ff;
        background:linear-gradient(180deg,#ffffff,#f0fdff);
        padding:14px;
        color:#17384f;
        font-weight:1000;
        box-shadow:0 12px 30px rgba(23,56,79,.10);
      }

      #hha-boss-compact-card.win{
        border-color:#86efac;
        background:linear-gradient(180deg,#f0fdf4,#ffffff);
        color:#14532d;
      }

      #hha-boss-compact-card.lose{
        border-color:#fde68a;
        background:linear-gradient(180deg,#fffbeb,#ffffff);
        color:#6b4f00;
      }

      .hha-boss-compact-title{
        font-size:clamp(20px,3.2vw,28px);
        line-height:1.15;
        font-weight:1000;
        margin-bottom:8px;
      }

      .hha-boss-compact-line{
        font-size:15px;
        line-height:1.45;
        font-weight:900;
      }

      .hha-boss-compact-badges{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      .hha-boss-mini{
        min-height:42px;
        border-radius:16px;
        border:2px solid rgba(189,244,255,.95);
        background:#fff;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:8px 10px;
        font-size:13px;
        font-weight:1000;
        text-align:center;
      }

      #hha-boss-teacher-toggle{
        margin-top:10px;
        border:0;
        border-radius:999px;
        padding:8px 12px;
        background:#ecfeff;
        color:#0f766e;
        border:2px solid #bdf4ff;
        font-weight:1000;
        cursor:pointer;
      }

      body.hha-boss-teacher-open #hha-brush-boss-gate-card{
        display:block !important;
      }

      body.hha-boss-teacher-open #hha-brush-boss-gate-card{
        margin-top:12px !important;
      }

      @media (max-width:720px){
        .hha-boss-compact-badges{
          grid-template-columns:1fr;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function compactCard(){
    return DOC.getElementById('hha-brush-compact-override-card') ||
           DOC.getElementById('hha-brush-compact-card') ||
           DOC.getElementById('hha-brush-summary-final-card') ||
           null;
  }

  function badgeContainer(card){
    if(!card) return null;

    return card.querySelector('.hha-co-badges') ||
           card.querySelector('.hha-compact-badges') ||
           card.querySelector('.hha-final-panel') ||
           card;
  }

  function removeOldBossBadges(card){
    if(!card) return;

    Array.from(card.querySelectorAll('[data-boss-compact="1"], .hha-boss-compact-card')).forEach(el => {
      try{ el.remove(); }catch(_){ el.style.display = 'none'; }
    });

    Array.from(card.querySelectorAll('.hha-co-badge,.hha-compact-badge,.hha-final-item')).forEach(el => {
      const t = text(el);
      if(/ชนะบอส|ท้าทายบอส|Boss Result|บอส/i.test(t)){
        try{ el.remove(); }catch(_){ el.style.display = 'none'; }
      }
    });
  }

  function renderIntoCompact(out){
    const card = compactCard();
    if(!card || !out || !out.outcome) return false;

    removeOldBossBadges(card);

    const outcome = out.outcome;
    const metrics = out.metrics || {};
    const th = outcome.thresholds || {};

    const box = DOC.createElement('section');
    box.id = 'hha-boss-compact-card';
    box.setAttribute('data-boss-compact', '1');
    box.className = outcome.win ? 'win' : 'lose';

    const title = outcome.win
      ? '👑 ชนะบอสฟันผุแล้ว!'
      : '⚡ เกือบชนะบอสแล้ว!';

    const stars = outcome.stars > 0 ? '⭐'.repeat(outcome.stars) : 'ลองใหม่';

    const shortTip = outcome.childTip || (
      outcome.win
        ? 'เก่งมาก! ชนะบอสแล้ว'
        : 'ลองเล่นอีกครั้งเพื่อชนะบอสนะ'
    );

    box.innerHTML = `
      <div class="hha-boss-compact-title">${title}</div>
      <div class="hha-boss-compact-line">${shortTip}</div>

      <div class="hha-boss-compact-badges">
        <div class="hha-boss-mini">🪥 Boss Hits ${metrics.bossHits || 0}/${th.bossHits || '-'}</div>
        <div class="hha-boss-mini">🦠 Monster ${metrics.monsters || 0}/${th.monsters || '-'}</div>
        <div class="hha-boss-mini">🛡️ Storm ${metrics.stormBlocked || 0}/${th.stormBlocked || '-'}</div>
      </div>

      <div class="hha-boss-compact-line" style="margin-top:10px">
        ผลบอส: <strong>${outcome.win ? 'ผ่าน' : 'ลองใหม่'}</strong> • ดาวบอส: <strong>${stars}</strong>
      </div>

      <button id="hha-boss-teacher-toggle" type="button">รายละเอียดสำหรับครู / วิจัย</button>
    `;

    const target = badgeContainer(card);
    target.appendChild(box);

    const toggle = box.querySelector('#hha-boss-teacher-toggle');
    if(toggle && !toggle.__hhaBossToggleBound){
      toggle.__hhaBossToggleBound = true;
      toggle.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        if(DOC.body){
          DOC.body.classList.toggle('hha-boss-teacher-open');
        }

        toggle.textContent = DOC.body && DOC.body.classList.contains('hha-boss-teacher-open')
          ? 'ซ่อนรายละเอียดครู / วิจัย'
          : 'รายละเอียดสำหรับครู / วิจัย';
      });
    }

    return true;
  }

  function patchCompactTitle(out){
    const card = compactCard();
    if(!card || !out || !out.outcome) return;

    const title =
      card.querySelector('.hha-co-title') ||
      card.querySelector('.hha-compact-title') ||
      card.querySelector('.hha-final-title');

    const sub =
      card.querySelector('.hha-co-sub') ||
      card.querySelector('.hha-compact-sub') ||
      card.querySelector('.hha-final-sub');

    const stars =
      card.querySelector('.hha-co-stars') ||
      card.querySelector('.hha-compact-stars');

    if(out.outcome.win){
      if(title) title.textContent = 'เยี่ยมมาก!';
      if(sub) sub.textContent = 'ฟันสะอาดและชนะบอสแล้ว';
    }else{
      if(title) title.textContent = 'เกือบชนะแล้ว!';
      if(sub) sub.textContent = 'ฟันสะอาดมากแล้ว ลองชนะบอสอีกครั้งนะ';
    }

    if(stars){
      stars.textContent = out.outcome.stars > 0
        ? '⭐'.repeat(out.outcome.stars)
        : '⭐';
    }

    const tip =
      card.querySelector('.hha-co-tip') ||
      card.querySelector('.hha-compact-tip');

    if(tip && out.outcome.childTip){
      tip.textContent = '💡 ' + out.outcome.childTip;
    }
  }

  function patchNativeLongText(out){
    if(!out || !out.outcome) return;

    /*
     * ไม่แก้หนักทั้ง DOM แต่ถ้าเจอแถว Boss ที่บอกชนะอัตโนมัติ
     * ให้แทนข้อความสั้น ๆ ให้ตรงกับ boss gate
     */
    Array.from(DOC.querySelectorAll('div,p,span,li')).forEach(el => {
      const t = text(el);
      if(!/Boss\s*:|Boss Battle/i.test(t)) return;
      if(t.length > 360) return;

      if(/Boss\s*:\s*ชนะแล้ว/.test(t) || /Boss\s*:\s*แพ้/.test(t)){
        el.textContent = out.outcome.win
          ? `Boss: ชนะแล้ว • ผ่านเงื่อนไข ${out.outcome.passedCount}/7`
          : `Boss: ยังไม่ชนะ • ผ่านเงื่อนไข ${out.outcome.passedCount}/7`;
      }
    });
  }

  function patchAchievements(out){
    if(!out || !out.outcome) return;

    /*
     * ถ้าแพ้บอส ไม่ควรให้ข้อความ "ชนะบอส" โดดเด่นใน Daily Challenge
     * แต่ไม่ไปลบ achievement ถาวรของรอบก่อนหน้า
     */
    if(out.outcome.win) return;

    Array.from(DOC.querySelectorAll('div,li,span')).forEach(el => {
      const t = text(el);
      if(t.length > 260) return;

      if(/ชนะ Cavity King|Boss|King/i.test(t) && /ผ่าน|ได้แล้ว/i.test(t)){
        el.style.opacity = '.72';
        el.setAttribute('data-boss-softened', '1');
      }
    });
  }

  function apply(){
    if(!isSummary()) return;

    ensureStyle();

    if(DOC.body){
      DOC.body.classList.add('hha-boss-compact-sync');
    }

    const out = bossResult();
    if(!out || !out.outcome) return;

    renderIntoCompact(out);
    patchCompactTitle(out);
    patchNativeLongText(out);
    patchAchievements(out);

    writeJson(OUT_KEY, {
      patch: PATCH_ID,
      ts: new Date().toISOString(),
      boss: out
    });
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 160);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true
      });
    }catch(_){}

    setTimeout(apply, 160);
    setTimeout(apply, 700);
    setTimeout(apply, 1500);
    setTimeout(apply, 2800);
  }

  function expose(){
    WIN.HHA_BRUSH_BOSS_COMPACT_SYNC = {
      patch: PATCH_ID,
      apply,
      bossResult
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
