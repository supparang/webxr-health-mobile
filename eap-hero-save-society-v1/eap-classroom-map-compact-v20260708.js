/* =========================================================
   EAP Hero Classroom Map Compact v20260708
   Goal: reduce long mobile Map / Report scrolling during class.
   - Adds a sticky compact action card when Map/Report content is long.
   - Shows only current next step first.
   - Provides buttons to continue Speaking Support or return to Mission Brief.
   - UI-only. Does not change scoring, unlocks, evidence, or Sheet sync.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-CLASSROOM-MAP-COMPACT-V1';
  const STYLE_ID = 'eap-classroom-map-compact-style';
  const CARD_ID = 'eap-classroom-map-compact-card';

  function text(value){
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function isMapOrReport(){
    const bodyText = text(document.body && document.body.textContent || '');
    return /My Learning Report/.test(bodyText) || /Student Learning Reports/.test(bodyText) || /Mission Path/.test(bodyText) || /Session Path/.test(bodyText) || /Focus Route/.test(bodyText);
  }

  function needsSpeakingSupport(){
    const bodyText = text(document.body && document.body.textContent || '');
    return /Speaking:\s*ยังไม่ทำ/.test(bodyText) || /เหลือ\s*1\s*Skill/.test(bodyText) || /speaking\s*·\s*Support/i.test(bodyText);
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CARD_ID}{
        position:sticky;
        top:8px;
        z-index:1200;
        margin:8px auto 12px;
        max-width:calc(100vw - 28px);
        border-radius:18px;
        padding:12px;
        background:linear-gradient(135deg,#0f172a,#17375e);
        color:#fff;
        box-shadow:0 12px 30px rgba(8,25,45,.28);
        font-family:Arial,'Noto Sans Thai',sans-serif;
      }
      #${CARD_ID} .cmc-title{font-size:16px;font-weight:950;margin-bottom:4px;line-height:1.25}
      #${CARD_ID} .cmc-sub{font-size:12px;opacity:.9;line-height:1.35;margin-bottom:9px}
      #${CARD_ID} .cmc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #${CARD_ID} button{border:0;border-radius:12px;padding:10px 8px;font-weight:950;font-size:13px;line-height:1.15;cursor:pointer}
      #${CARD_ID} button.primary{background:#e8fbf3;color:#087f5b}
      #${CARD_ID} button.secondary{background:#edf2f7;color:#1f2937}
      #${CARD_ID} button.ghost{background:#e8f0fe;color:#174ea6}
      #${CARD_ID}.cmc-collapsed .cmc-sub,#${CARD_ID}.cmc-collapsed .cmc-actions{display:none}
      #${CARD_ID}.cmc-collapsed{padding:9px 11px;border-radius:999px;max-width:max-content}
      #${CARD_ID}.cmc-collapsed .cmc-title{font-size:13px;margin:0;white-space:nowrap}
      @media(max-width:760px){
        #${CARD_ID}{margin:6px auto 10px;padding:10px;border-radius:15px}
        #${CARD_ID} .cmc-title{font-size:14px}
        #${CARD_ID} .cmc-sub{font-size:11px}
        #${CARD_ID} button{font-size:12px;min-height:39px;padding:9px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  function getRoot(){
    return document.getElementById('app') || document.body;
  }

  function goSpeaking(){
    try {
      if (window.EAPHero && typeof window.EAPHero.openSkillMission === 'function') {
        window.EAPHero.openSkillMission('Speaking', 1);
        return;
      }
      if (window.EAPClassroomActionRail && typeof window.EAPClassroomActionRail.startSkill === 'function') {
        window.EAPClassroomActionRail.startSkill('speaking');
        return;
      }
      if (window.EAPHero && typeof window.EAPHero.skillHub === 'function') {
        window.EAPHero.skillHub(1);
        return;
      }
    } catch(error) {
      console.warn('[EAP Map Compact] speaking action failed', error);
    }
  }

  function goBrief(){
    const panel = document.getElementById('eap-session-content-brief');
    if (panel) {
      panel.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    try {
      if (window.EAPHero && typeof window.EAPHero.map === 'function') window.EAPHero.map();
    } catch(error) {}
  }

  function collapseLongBlocks(){
    const root = getRoot();
    if (!root) return;

    const details = Array.from(root.querySelectorAll('details'));
    details.forEach(function(d){
      if (!d.dataset.eapClassroomCompact) {
        d.dataset.eapClassroomCompact = VERSION;
        d.open = false;
      }
    });
  }

  function mount(){
    if (!isMapOrReport()) return;
    injectStyle();
    collapseLongBlocks();

    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      const root = getRoot();
      root.insertBefore(card, root.firstChild);
    }

    const speaking = needsSpeakingSupport();
    card.className = '';
    card.innerHTML = `
      <div class="cmc-title">🗺️ Map แบบย่อสำหรับคาบนี้</div>
      <div class="cmc-sub">${speaking ? 'Reading ผ่านแล้ว เหลือ Speaking Support เพื่อให้ Session 1 สมบูรณ์' : 'ดูเฉพาะขั้นต่อไปก่อน รายละเอียดอื่นพับไว้เพื่อลดการเลื่อนจอ'}</div>
      <div class="cmc-actions">
        <button type="button" class="primary" data-cmc="speaking">▶ Speaking Support</button>
        <button type="button" class="ghost" data-cmc="brief">📘 Mission Brief</button>
        <button type="button" class="secondary" data-cmc="collapse">ย่อแถบนี้</button>
        <button type="button" class="secondary" data-cmc="top">ขึ้นบน</button>
      </div>
    `;
  }

  function onClick(event){
    const btn = event.target.closest('[data-cmc]');
    if (!btn) return;
    event.preventDefault();
    const action = btn.dataset.cmc;
    if (action === 'speaking') goSpeaking();
    else if (action === 'brief') goBrief();
    else if (action === 'top') window.scrollTo({top:0, behavior:'smooth'});
    else if (action === 'collapse') {
      const card = document.getElementById(CARD_ID);
      if (card) card.classList.toggle('cmc-collapsed');
    }
  }

  function start(){
    document.addEventListener('click', onClick, true);
    mount();
    window.setInterval(mount, 1200);
    window.EAPClassroomMapCompact = {
      version: VERSION,
      refresh: mount
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
