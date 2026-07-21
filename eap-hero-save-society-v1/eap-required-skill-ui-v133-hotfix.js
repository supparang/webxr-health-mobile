/* EAP Hero v133 — Required Skill Hub visual hotfix
   Visual-only. Does not alter score, unlock, Sheet, evidence, or route authority.
*/
(() => {
  'use strict';
  const STYLE_ID = 'eap-required-skill-ui-v133-hotfix-style';
  const css = `
    /* Remove stale/duplicate legacy panels once the premium shell exists */
    body.eap-v133-skill-ready .eap-rs-summary,
    body.eap-v133-skill-ready .eap-compact-skill-shell,
    body.eap-v133-skill-ready .eap-skill-score-line{display:none!important}

    .eap-premium-shell{max-width:100%!important;margin:14px 0 10px!important}
    .eap-premium-summary{grid-template-columns:minmax(0,1.55fr) 190px 220px!important;border-radius:16px!important;margin-bottom:12px!important}
    .eap-premium-summary>div{padding:14px 16px!important}
    .eap-premium-shield{width:44px!important;height:48px!important;font-size:22px!important;border-radius:14px 14px 18px 18px!important}
    .eap-premium-title{font-size:16px!important}
    .eap-premium-help{font-size:11px!important}
    .eap-premium-progress-score{font-size:22px!important}

    .eap-premium-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
    .eap-premium-card{display:grid!important;grid-template-columns:54px minmax(0,1fr)!important;gap:12px!important;min-height:118px!important;padding:14px 16px!important;border-radius:15px!important;align-items:center!important;text-align:left!important}
    .eap-premium-icon{display:grid!important;width:50px!important;height:50px!important;font-size:25px!important}
    .eap-premium-body{display:flex!important;min-width:0!important;gap:5px!important}
    .eap-premium-name{font-size:16px!important}
    .eap-premium-status{display:block!important;font-size:11px!important;white-space:normal!important}
    .eap-premium-score-row{display:flex!important}
    .eap-premium-actions{display:flex!important;margin-top:0!important}
    .eap-premium-start,.eap-premium-stats{min-height:34px!important;padding:7px 12px!important;font-size:11px!important}
    .eap-premium-legend{margin-top:9px!important;padding:8px 11px!important;font-size:10px!important}

    /* Prevent old native skill tiles from occupying space behind the rebuilt shell */
    body.eap-v133-skill-ready .eap-premium-shell~.skill-grid,
    body.eap-v133-skill-ready .eap-premium-shell~.skills-grid{display:none!important}

    @media(max-width:900px){
      .eap-premium-summary{grid-template-columns:1fr 180px!important}
      .eap-premium-ready{grid-column:1/-1!important}
    }
    @media(max-width:700px){
      .eap-premium-grid{grid-template-columns:1fr!important}
      .eap-premium-summary{grid-template-columns:1fr!important}
      .eap-premium-card{grid-template-columns:48px minmax(0,1fr)!important;min-height:110px!important;padding:13px!important}
      .eap-premium-icon{width:44px!important;height:44px!important;font-size:22px!important}
      .eap-premium-actions{display:grid!important;grid-template-columns:1fr 1fr!important}
    }
  `;

  function inject(){
    let style=document.getElementById(STYLE_ID);
    if(!style){style=document.createElement('style');style.id=STYLE_ID;document.head.appendChild(style);}
    style.textContent=css;
  }
  function visible(el){return !!(el&&el.offsetParent!==null);}
  function clean(){
    inject();
    const shell=document.querySelector('.eap-premium-shell');
    if(!visible(shell)) return;
    document.body.classList.add('eap-v133-skill-ready');

    /* Remove stale summary cards outside the canonical premium shell. */
    [...document.querySelectorAll('#app .eap-rs-summary,#app .eap-compact-skill-shell')]
      .filter(el=>!shell.contains(el))
      .forEach(el=>el.remove());

    /* Ensure all four rebuilt cards are actually visible and complete. */
    const cards=[...shell.querySelectorAll('.eap-premium-card')];
    cards.forEach(card=>{
      card.style.removeProperty('height');
      card.style.removeProperty('min-width');
      const icon=card.querySelector('.eap-premium-icon');
      const body=card.querySelector('.eap-premium-body');
      if(icon) icon.hidden=false;
      if(body) body.hidden=false;
    });
  }
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(clean,100);};
  window.addEventListener('load',schedule);
  ['eap:resume-synced','eap:route-changed','eap:profile-saved'].forEach(ev=>window.addEventListener(ev,schedule));
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(schedule,1800);
  window.EAPRequiredSkillUIV133={clean,version:'v20260721-v133-hotfix'};
})();