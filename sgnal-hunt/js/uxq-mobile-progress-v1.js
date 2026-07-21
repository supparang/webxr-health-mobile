/* CSAI2601 UX Quest • Mobile Course Progress Controller v1
 * Front-end presentation only. Does not change Sheet, unlock, or completion logic.
 */
(() => {
  'use strict';

  const MOBILE_QUERY = '(max-width: 760px)';
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  function installStyle() {
    if (document.getElementById('uxq-mobile-progress-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-mobile-progress-style-v1';
    style.textContent = `
      @media(max-width:760px){
        body.uxq-hub-page .hub-shell{padding:10px 10px 28px!important}
        body.uxq-hub-page .overview-grid{display:block!important}
        body.uxq-hub-page .act-intro{margin-bottom:12px!important}
        body.uxq-hub-page .act-intro h1{font-size:2rem!important;line-height:1.02!important}
        body.uxq-hub-page .act-intro__lede{font-size:.92rem!important;line-height:1.5!important}
        body.uxq-hub-page .current-card{padding:14px!important;border-radius:18px!important}
        body.uxq-hub-page .current-card__main{gap:10px!important}
        body.uxq-hub-page .current-card__icon{width:44px!important;height:44px!important;min-width:44px!important}
        body.uxq-hub-page .current-card h2{font-size:1.15rem!important;line-height:1.25!important}
        body.uxq-hub-page .current-card p{font-size:.85rem!important;line-height:1.45!important}
        body.uxq-hub-page .current-card__cta{width:100%!important;text-align:center!important;margin-top:10px!important;min-height:46px!important;display:grid!important;place-items:center!important}

        .studio-overview{margin:12px 0!important;padding:13px!important;border-radius:18px!important}
        .studio-overview>h2{font-size:1.2rem!important}
        .studio-overview>p{font-size:.82rem!important;line-height:1.45!important}
        .course-primary{grid-template-columns:1fr!important;padding:13px!important;gap:10px!important;border-radius:16px!important}
        .course-primary__value{display:flex!important;align-items:flex-end!important;gap:8px!important;flex-wrap:wrap!important}
        .course-primary__value small{width:100%!important;font-size:.7rem!important;letter-spacing:.05em!important}
        .course-primary__value strong{font-size:2.45rem!important;margin:0!important}
        .course-primary__value span{padding-bottom:4px!important}
        .course-bar{height:10px!important}
        .course-primary__next{font-size:.84rem!important;line-height:1.45!important}

        .studio-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
        .studio-summary span{padding:9px!important;border-radius:12px!important;font-size:.72rem!important;min-height:61px!important}
        .studio-summary b{font-size:1rem!important}
        .studio-summary span:nth-child(n+5){display:none!important}
        .studio-summary.is-expanded span:nth-child(n+5){display:block!important}
        .uxq-mobile-summary-toggle{width:100%;margin-top:8px;border:1px solid rgba(181,205,255,.25);border-radius:11px;padding:9px;background:rgba(255,255,255,.04);color:#cfe3ff;font-weight:800}

        .student-timeline{padding-top:12px!important;margin-top:12px!important}
        .student-timeline__head{align-items:center!important;margin-bottom:8px!important}
        .student-timeline__head h3{font-size:1rem!important}
        .student-timeline__head span{font-size:.75rem!important}
        .student-timeline__list{max-height:none!important;overflow:visible!important;padding-right:0!important;gap:6px!important}
        .timeline-row{grid-template-columns:42px 1fr!important;gap:7px!important;padding:9px!important;border-radius:12px!important}
        .timeline-row__id{font-size:.9rem!important}
        .timeline-row__steps{grid-column:2;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important}
        .timeline-step{font-size:.62rem!important;padding:3px 4px!important;white-space:nowrap!important;text-align:center!important;overflow:hidden!important;text-overflow:ellipsis!important}
        .timeline-row__action{grid-column:1/-1!important;display:block!important;text-align:center!important;padding:8px!important;border-radius:9px!important;background:rgba(110,231,255,.08)!important;font-size:.75rem!important}
        .timeline-row.is-locked .timeline-row__action{display:none!important}
        .timeline-row[data-mobile-hidden='1']{display:none!important}
        .student-timeline__list.is-expanded .timeline-row[data-mobile-hidden='1']{display:grid!important}
        .uxq-mobile-timeline-toggle{width:100%;margin-top:8px;border:1px solid rgba(110,231,255,.35);border-radius:11px;padding:10px;background:rgba(110,231,255,.08);color:#dffaff;font-weight:900}

        .campaign-preview{padding:12px!important;border-radius:16px!important}
        .campaign-preview[data-three-part-locked='1']{display:none!important}
        .up-next .section-heading{margin-top:16px!important}
        .up-next .section-heading h2{font-size:1.1rem!important}
        .up-next-grid{grid-template-columns:1fr!important;gap:9px!important}
        .studio-node-status{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important}
        .studio-node-status span{font-size:.62rem!important;padding:4px!important}
        .node-next-note,.three-part-lock-note{font-size:.72rem!important}

        #progress{position:static!important;font-size:.75rem!important;white-space:normal!important}
        .hub-menu__panel{max-width:46vw!important}
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
    const currentIndex = Math.max(0, rows.findIndex(row => row.classList.contains('is-current')));
    const start = Math.max(0, currentIndex - 1);
    const end = Math.min(rows.length - 1, currentIndex + 2);
    rows.forEach((row, index) => {
      row.dataset.mobileHidden = index >= start && index <= end ? '0' : '1';
    });
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
    button.textContent = `ดูทั้งหมด ${rows.length} Nodes`;
    button.onclick = () => {
      const expanded = list.classList.toggle('is-expanded');
      button.textContent = expanded ? 'ย่อ Timeline' : `ดูทั้งหมด ${rows.length} Nodes`;
    };
  }

  function apply() {
    installStyle();
    if (!isMobile()) return;
    addSummaryToggle();
    compactTimeline();
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  window.addEventListener('resize', schedule);
  window.addEventListener('uxq-three-part-course-progress', schedule);
  new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });

  window.UXQMobileCourseProgressV1 = Object.freeze({ apply, version:'20260721-MOBILE-PROGRESS-V1' });
})();