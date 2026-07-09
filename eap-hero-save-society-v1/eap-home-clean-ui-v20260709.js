/* =========================================================
   EAP Hero Home Clean UI v20260709
   V1 CENTERED LOBBY + HIDE LEGACY HOME CLUTTER
   - Keeps one primary learner path: Start / Continue.
   - Keeps one small secondary action: เปลี่ยนผู้เรียน / ย้ายเครื่อง.
   - Hides legacy Mission Mode panel, duplicate Map/Continue buttons,
     old intro/status cards, and Sheet floating badges on the Home screen.
   - Does NOT run inside active missions, Map, Skill Hub, Report, Profile,
     Boss flow, or Teacher pages.
   - UI-only. Does not change profile, Cloud/Sheet, scores, pass/fail,
     evidence, teacher review, or unlock logic.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260709-EAP-HOME-CLEAN-UI-V1-CENTERED-LOBBY';
  const HIDDEN = 'data-eap-home-clean-hidden';
  const STYLE_ID = 'eap-home-clean-ui-style-v1';
  const LOBBY_ID = 'eap-student-compact-lobby';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }

  function appText(){
    const app = document.getElementById('app') || document.body;
    return clean(app && app.innerText || '');
  }

  function hasLobby(){ return !!document.getElementById(LOBBY_ID); }

  function isHome(){
    const t = appText();
    if (!/EAP Hero:\s*Save the Society/i.test(t)) return false;
    if (!/Student Lobby|Start\s*\/\s*Continue/i.test(t)) return false;
    if (/EAP\s+Skill\s+Mission\s+Hub/i.test(t)) return false;
    if (/Session\s+\d+\s*:/i.test(t) && /Reading|Writing|Listening|Speaking/i.test(t)) return false;
    if (/Boss Defeated|Boss Gate|หลักฐานพูด Boss Gate|Why is your answer academically correct\?/i.test(t)) return false;
    return true;
  }

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [${HIDDEN}="1"]{display:none!important}
      body.eap-clean-student-home #app{
        min-height:calc(100vh - 20px)!important;
      }
      body.eap-clean-student-home #${LOBBY_ID}{
        width:min(720px,calc(100vw - 32px))!important;
        max-width:720px!important;
        margin:26px auto 18px!important;
        padding:22px!important;
        text-align:center!important;
      }
      body.eap-clean-student-home #${LOBBY_ID} h2{
        font-size:clamp(32px,4.6vw,52px)!important;
        line-height:1.02!important;
        margin-bottom:10px!important;
      }
      body.eap-clean-student-home #${LOBBY_ID} .lob-grid{
        grid-template-columns:1fr!important;
      }
      body.eap-clean-student-home #${LOBBY_ID} .lob-actions{
        max-width:460px!important;
        margin:18px auto 8px!important;
        grid-template-columns:1fr!important;
      }
      body.eap-clean-student-home #${LOBBY_ID} .lob-now{
        max-width:520px!important;
      }
      body.eap-clean-student-home #${LOBBY_ID} .home-hint,
      body.eap-clean-student-home #${LOBBY_ID} .profile-hint{
        font-size:12px!important;
        line-height:1.4!important;
      }
      @media(max-width:760px){
        body.eap-clean-student-home #${LOBBY_ID}{
          width:calc(100vw - 18px)!important;
          margin:10px 9px 14px!important;
          padding:15px!important;
        }
        body.eap-clean-student-home #${LOBBY_ID} h2{
          font-size:clamp(28px,8vw,38px)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function hide(node){
    if (!node || node.id === LOBBY_ID || (node.closest && node.closest('#' + LOBBY_ID))) return;
    node.setAttribute(HIDDEN,'1');
    node.setAttribute('aria-hidden','true');
  }

  function unhideAll(){
    Array.from(document.querySelectorAll('[' + HIDDEN + '="1"]')).forEach(function(node){
      node.removeAttribute(HIDDEN);
      node.removeAttribute('aria-hidden');
    });
  }

  function nearestPanel(node){
    if (!node) return null;
    return node.closest('section,aside,main,.panel,.card,.mission-card,.home-card,.student-card,div') || node;
  }

  function hideTopDuplicateButtons(){
    const re = /^(?:📘\s*)?Map$|^(?:▶\s*)?Continue$|^(?:👤\s*)?Profile$|^(?:📘\s*)?Report$|^Mission\s+Mode$/i;
    Array.from(document.querySelectorAll('button,a,[role="button"]')).forEach(function(btn){
      if (btn.closest('#' + LOBBY_ID)) return;
      const label = clean(btn.textContent).replace(/^[📘👤🧭▶⚡]+\s*/,'');
      if (re.test(label)) hide(btn);
    });
  }

  function hideLegacyPanels(){
    Array.from(document.querySelectorAll('section,aside,main,div')).forEach(function(node){
      if (node.id === LOBBY_ID || node.closest('#' + LOBBY_ID)) return;
      const t = clean(node.textContent || '');
      if (!t || t.length > 900) return;

      /* Old active mission preview on Home: visually confusing because Start/Continue
         should be the only launch path. */
      if (/Mission\s+Mode/i.test(t) && /Rescue\s+Clash/i.test(t) && /Focus\s+Route/i.test(t)) {
        hide(nearestPanel(node));
        return;
      }

      if (/Academic Hero Awakening/i.test(t) && /Need a 10-sec clue/i.test(t) && /Brief|Action|Rescue/i.test(t)) {
        hide(nearestPanel(node));
        return;
      }

      /* Old large intro/status cards are duplicated by Student Lobby. */
      if (/Player Status/i.test(t) && /XP/i.test(t) && /Progress/i.test(t)) {
        hide(nearestPanel(node));
        return;
      }

      if (/Student Mode/i.test(t) && /My Learning Report/i.test(t) && /Profile/i.test(t) && /Start\s*\/\s*Continue/i.test(t)) {
        hide(nearestPanel(node));
        return;
      }
    });
  }

  function hideFloatingSheetBadges(){
    Array.from(document.querySelectorAll('button,div,a')).forEach(function(node){
      if (node.closest('#' + LOBBY_ID)) return;
      const t = clean(node.textContent || '');
      if (/Sheet:\s*\d+\s*send attempts/i.test(t) || /ส่งผลล่าสุดเข้า\s*Sheet/i.test(t)) {
        hide(node);
      }
    });
  }

  let timer = null;
  function apply(){
    addStyle();
    const home = isHome() && hasLobby();
    document.body.classList.toggle('eap-clean-student-home', home);
    if (!home) { unhideAll(); return; }
    hideTopDuplicateButtons();
    hideLegacyPanels();
    hideFloatingSheetBadges();
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(apply, 90);
  }

  function start(){
    addStyle();
    window.addEventListener('load', schedule);
    window.addEventListener('storage', schedule);
    window.addEventListener('eap:resume-synced', schedule);
    window.addEventListener('eap:profile-saved', schedule);
    new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    schedule();
    setInterval(apply, 1200);
  }

  window.EAPHomeCleanUI = { version: VERSION, refresh: apply };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();