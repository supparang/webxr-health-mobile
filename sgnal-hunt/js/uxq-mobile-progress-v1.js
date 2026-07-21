/* CSAI2601 UX Quest • Mobile Course Progress Controller v2
 * Front-end presentation only. Does not change Sheet schema, Apps Script, unlock, or completion rules.
 */
(() => {
  'use strict';

  const MOBILE_QUERY = '(max-width: 760px)';
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  function installStyle() {
    if (document.getElementById('uxq-mobile-progress-style-v2')) return;
    const style = document.createElement('style');
    style.id = 'uxq-mobile-progress-style-v2';
    style.textContent = `
      @media(max-width:760px){
        body.uxq-hub-page .hub-shell{padding:10px 10px 30px!important}
        body.uxq-hub-page .hub-topbar{gap:8px!important;align-items:flex-start!important}
        body.uxq-hub-page .hub-brand__copy strong{font-size:1rem!important}
        body.uxq-hub-page .hub-brand__copy small{font-size:.72rem!important}
        body.uxq-hub-page .overview-grid{display:block!important}
        body.uxq-hub-page .act-intro{margin-bottom:10px!important}
        body.uxq-hub-page .act-intro h1{font-size:1.82rem!important;line-height:1.04!important;letter-spacing:-.035em!important}
        body.uxq-hub-page .act-intro__lede{font-size:.88rem!important;line-height:1.48!important}
        body.uxq-hub-page .current-card{padding:12px!important;border-radius:17px!important;min-height:0!important}
        body.uxq-hub-page .current-card__status{font-size:.68rem!important}
        body.uxq-hub-page .current-card__main{gap:9px!important;margin-top:8px!important}
        body.uxq-hub-page .current-card__icon{width:42px!important;height:42px!important;min-width:42px!important}
        body.uxq-hub-page .current-card h2{font-size:1.06rem!important;line-height:1.22!important;margin:0!important}
        body.uxq-hub-page .current-card p{font-size:.79rem!important;line-height:1.4!important;margin-top:4px!important}
        body.uxq-hub-page .current-card__cta{width:100%!important;text-align:center!important;margin-top:9px!important;min-height:44px!important;display:grid!important;place-items:center!important;font-size:.9rem!important}

        .studio-overview{margin:10px 0!important;padding:12px!important;border-radius:17px!important}
        .studio-overview>h2{font-size:1.12rem!important;line-height:1.25!important}
        .studio-overview>p{font-size:.78rem!important;line-height:1.42!important;margin-top:4px!important}
        .course-primary{grid-template-columns:1fr!important;padding:12px!important;gap:8px!important;border-radius:15px!important}
        .course-primary__value{display:flex!important;align-items:flex-end!important;gap:7px!important;flex-wrap:wrap!important}
        .course-primary__value small{width:100%!important;font-size:.66rem!important;letter-spacing:.06em!important}
        .course-primary__value strong{font-size:2.2rem!important;margin:0!important}
        .course-primary__value span{padding-bottom:3px!important;font-size:.82rem!important}
        .course-bar{height:9px!important}
        .course-primary__next{font-size:.78rem!important;line-height:1.4!important}

        .studio-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important}
        .studio-summary span{padding:8px!important;border-radius:11px!important;font-size:.67rem!important;min-height:55px!important}
        .studio-summary b{font-size:.95rem!important}
        .studio-summary span:nth-child(n+5){display:none!important}
        .studio-summary.is-expanded span:nth-child(n+5){display:block!important}
        .uxq-mobile-summary-toggle,.uxq-mobile-timeline-toggle,.uxq-mobile-path-toggle,.uxq-mobile-retry{width:100%;margin-top:8px;border:1px solid rgba(110,231,255,.35);border-radius:11px;padding:10px;background:rgba(110,231,255,.08);color:#dffaff;font-weight:900;font-size:.82rem}

        .student-timeline{padding-top:11px!important;margin-top:11px!important}
        .student-timeline__head{align-items:center!important;margin-bottom:7px!important}
        .student-timeline__head h3{font-size:.95rem!important}
        .student-timeline__head span{font-size:.7rem!important}
        .student-timeline__list{max-height:none!important;overflow:visible!important;padding-right:0!important;gap:6px!important}
        .timeline-row{grid-template-columns:38px 1fr!important;gap:6px!important;padding:8px!important;border-radius:11px!important}
        .timeline-row__id{font-size:.86rem!important}
        .timeline-row__steps{grid-column:2;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3px!important}
        .timeline-step{font-size:.57rem!important;padding:3px!important;white-space:nowrap!important;text-align:center!important;overflow:hidden!important;text-overflow:ellipsis!important}
        .timeline-row__action{grid-column:1/-1!important;display:block!important;text-align:center!important;padding:8px!important;border-radius:9px!important;background:rgba(110,231,255,.08)!important;font-size:.72rem!important}
        .timeline-row.is-locked .timeline-row__action{display:none!important}
        .timeline-row[data-mobile-hidden='1']{display:none!important}
        .student-timeline__list.is-expanded .timeline-row[data-mobile-hidden='1']{display:grid!important}

        .up-next{margin-top:14px!important}
        .up-next .section-heading{margin:0 0 8px!important}
        .up-next .section-heading .eyebrow{font-size:.66rem!important}
        .up-next .section-heading h2{font-size:1rem!important;line-height:1.35!important}
        .up-next-grid{grid-template-columns:1fr!important;gap:8px!important}
        .campaign-preview{padding:11px!important;border-radius:15px!important;min-height:0!important}
        .campaign-preview h3{font-size:1.12rem!important;line-height:1.2!important}
        .campaign-preview p{font-size:.75rem!important;line-height:1.4!important}
        .campaign-preview .compact-stage__icon,.campaign-preview .boss-preview__icon{width:44px!important;height:44px!important;font-size:1.6rem!important}
        .campaign-preview[data-mobile-role='future']{display:none!important}
        .up-next-grid.is-expanded .campaign-preview[data-mobile-role='future']{display:block!important}
        .campaign-preview[data-mobile-role='current']{display:block!important;border-color:rgba(110,231,255,.58)!important;box-shadow:0 12px 30px rgba(0,0,0,.16)!important}
        .campaign-preview[data-mobile-role='next']{display:block!important;opacity:.62!important}
        .campaign-preview[data-three-part-locked='1'] .campaign-launch{display:none!important}
        .studio-node-status{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3px!important}
        .studio-node-status span{font-size:.57rem!important;padding:3px!important}
        .node-next-note,.three-part-lock-note{font-size:.68rem!important;line-height:1.35!important}
        .campaign-launch.uxq-primary-action{display:block!important;width:100%!important;text-align:center!important;margin-top:8px!important;padding:10px!important}

        #progress{position:static!important;font-size:.7rem!important;white-space:normal!important;line-height:1.25!important}
        .hub-menu__panel{max-width:43vw!important;padding:6px 8px!important}
        .uxq-mobile-friendly-error{border:1px solid rgba(255,209,102,.42);border-radius:14px;padding:12px;background:rgba(255,209,102,.07)}
        .uxq-mobile-friendly-error strong{display:block;color:#ffe5a3;margin-bottom:4px}
        .uxq-mobile-friendly-error p{margin:0;color:#d9e5fa!important}
      }
    `;
    document.head.appendChild(style);
  }

  function addSummaryToggle() {
    const summary = document.querySelector('.studio-summary');
    if (!summary || document.getElementById('uxqMobileSummaryToggle')) return;
    const button = document.createElement('button');
    button.id = 'uxqMobileSummaryToggle';
    button.className = 'uxq-mobile-summary-toggle';
    button.type = 'button';
    button.textContent = 'ดูรายละเอียดเพิ่มเติม';
    button.addEventListener('click', () => {
      const expanded = summary.classList.toggle('is-expanded');
      button.textContent = expanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดเพิ่มเติม';
    });
    summary.insertAdjacentElement('afterend', button);
  }

  function compactTimeline() {
    const list = document.querySelector('.student-timeline__list');
    if (!list) return;
    const rows = Array.from(list.querySelectorAll('.timeline-row'));
    if (!rows.length) return;
    const found = rows.findIndex(row => row.classList.contains('is-current'));
    const currentIndex = found >= 0 ? found : 0;
    const visible = new Set([Math.max(0,currentIndex-1), currentIndex, Math.min(rows.length-1,currentIndex+1), Math.min(rows.length-1,currentIndex+2)]);
    rows.forEach((row, index) => { row.dataset.mobileHidden = visible.has(index) ? '0' : '1'; });
    let button = document.getElementById('uxqMobileTimelineToggle');
    if (!button) {
      button = document.createElement('button');
      button.id = 'uxqMobileTimelineToggle';
      button.className = 'uxq-mobile-timeline-toggle';
      button.type = 'button';
      list.insertAdjacentElement('afterend', button);
    }
    const hiddenCount = rows.filter(row => row.dataset.mobileHidden === '1').length;
    button.hidden = hiddenCount === 0;
    button.textContent = `ดู Timeline ทั้งหมด ${rows.length} Nodes`;
    button.onclick = () => {
      const expanded = list.classList.toggle('is-expanded');
      button.textContent = expanded ? 'ย่อ Timeline' : `ดู Timeline ทั้งหมด ${rows.length} Nodes`;
    };
  }

  function compactCampaignCards() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.campaign-preview'));
    if (!cards.length) return;
    let currentIndex = cards.findIndex(card => card.dataset.threePartLocked !== '1' && card.dataset.nodeComplete !== '1');
    if (currentIndex < 0) currentIndex = 0;
    cards.forEach((card, index) => {
      card.dataset.mobileRole = index === currentIndex ? 'current' : index === currentIndex + 1 ? 'next' : 'future';
      if (index > currentIndex) {
        const badge = card.querySelector('.stage-state');
        if (badge) badge.textContent = index === currentIndex + 1 ? '🔒 ด่านถัดไป' : '🔒 Locked';
        card.querySelectorAll('.campaign-launch').forEach(link => {
          link.href = '#';
          link.setAttribute('aria-disabled','true');
          link.onclick = event => event.preventDefault();
          link.textContent = 'ยังไม่เปิด';
        });
      }
    });
    let button = document.getElementById('uxqMobilePathToggle');
    if (!button) {
      button = document.createElement('button');
      button.id = 'uxqMobilePathToggle';
      button.className = 'uxq-mobile-path-toggle';
      button.type = 'button';
      grid.insertAdjacentElement('afterend', button);
    }
    const futureCount = cards.filter(card => card.dataset.mobileRole === 'future').length;
    button.hidden = futureCount === 0;
    button.textContent = `ดูเส้นทางทั้งหมด ${cards.length} Nodes`;
    button.onclick = () => {
      const expanded = grid.classList.toggle('is-expanded');
      button.textContent = expanded ? 'ซ่อนด่านอนาคต' : `ดูเส้นทางทั้งหมด ${cards.length} Nodes`;
    };
  }

  function friendlyNetworkError() {
    const box = document.getElementById('uxqStudioOverview');
    if (!box) return;
    const text = box.textContent || '';
    if (!/studio_progress_network|studio_progress_timeout|ดึงสถานะ.*ไม่สำเร็จ/i.test(text)) return;
    box.innerHTML = `<div class="uxq-mobile-friendly-error"><strong>กำลังเชื่อมต่อสถานะ Studio/Reflection</strong><p>สัญญาณเครือข่ายยังไม่พร้อม ระบบยังไม่เปลี่ยนสถานะหรือปลดล็อกด่าน จนกว่าจะยืนยันจาก Google Sheet สำเร็จ</p><button type="button" class="uxq-mobile-retry">ลองตรวจอีกครั้ง</button></div>`;
    box.querySelector('.uxq-mobile-retry')?.addEventListener('click', () => location.reload());
  }

  function suppressFloatingBadge() {
    document.querySelectorAll('body > *').forEach(el => {
      if (el.id === 'progress' || el.closest?.('.hub-shell')) return;
      const text = String(el.textContent || '').trim();
      if (/Mission\s*\d+\/\d+.*Studio\/Reflection|Course Complete\s*\d+\/\d+/i.test(text) && getComputedStyle(el).position === 'fixed') {
        el.style.display = 'none';
      }
    });
  }

  function apply() {
    installStyle();
    if (!isMobile()) return;
    addSummaryToggle();
    compactTimeline();
    compactCampaignCards();
    friendlyNetworkError();
    suppressFloatingBadge();
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  window.addEventListener('resize', schedule);
  window.addEventListener('uxq-three-part-course-progress', schedule);
  new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });

  window.UXQMobileCourseProgressV1 = Object.freeze({ apply, version:'20260721-MOBILE-PROGRESS-V2' });
})();