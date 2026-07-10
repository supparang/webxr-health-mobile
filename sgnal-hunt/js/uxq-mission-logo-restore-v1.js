/* CSAI2601 UX Quest • Mission Logo Restore v3
 * Static body-level mission logo/header. It is inserted before #uxqCanonicalNode, not inside the game DOM.
 * This prevents logo flicker/disappearing when the player or compact packs re-render .game/.question.
 * No scoring, answer, reason, progress, or sheet-sync changes.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  const NODE = String(params.get('node') || params.get('id') || 'W1').toUpperCase();
  const $ = (s, r=document) => r.querySelector(s);

  const logo = {
    W1:['🔎','UX First Responder','Friction → Goal → Proof'],
    W2:['🧭','HCD Evidence Lab','Evidence → Assumption → Test'],
    W3:['🧠','Psychology Signal','Attention → Load → Feedback'],
    W4:['🕵️','Research Detective','Question → Pain → Evidence'],
    W5:['💡','HMW Studio','Insight → Problem → Concept'],
    W6:['🗺️','Flow Mapper','IA → Path → Error Recovery'],
    W7:['📐','Wireframe Forge','Priority → Layout → CTA'],
    W8:['🧩','Blueprint Review','Evidence Chain → Revision'],
    W9:['🧱','Pattern Keeper','Component → State → Rule'],
    W10:['📱','Responsive Guardian','Mobile → Touch → A11y'],
    W11:['🎨','Visual Signal','Color → Type → Contrast'],
    W12:['⚡','Interaction Signal','State → Feedback → Recovery'],
    W13:['🔗','Prototype Link Check','Task → Link → Test'],
    W14:['🧪','Severity Lab','Finding → Severity → Retest'],
    W15:['🏁','Portfolio Defense','Story → Proof → Defense'],
    B1:['👹','Boss Foundation','UX + HCD + Psychology'],
    B2:['🐉','Boss Flow/Wireframe','Evidence → Flow → Wireframe'],
    B3:['🛡️','Boss Interface System','System + Responsive + A11y'],
    B4:['🔥','Boss Validation','Prototype + Evidence + Iteration']
  };

  function style(){
    let st = $('#uxq-mission-logo-restore-v3-style');
    if(!st){ st = document.createElement('style'); st.id = 'uxq-mission-logo-restore-v3-style'; document.head.appendChild(st); }
    st.textContent = `
      #uxqStaticMissionLogo.uxqMissionLogoRestore{
        width:min(1180px,calc(100% - 28px))!important;
        margin:14px auto 14px!important;
        display:grid!important;
        grid-template-columns:64px 1fr auto!important;
        gap:14px!important;
        align-items:center!important;
        padding:16px 18px!important;
        border-radius:22px!important;
        border:1px solid rgba(110,231,255,.48)!important;
        background:linear-gradient(135deg,rgba(110,231,255,.17),rgba(155,140,255,.15))!important;
        box-shadow:0 16px 36px rgba(0,0,0,.22), inset 0 0 0 1px rgba(255,255,255,.05)!important;
        visibility:visible!important;opacity:1!important;overflow:visible!important;position:relative!important;z-index:999!important;
        box-sizing:border-box!important;
      }
      #uxqStaticMissionLogo .mlrIcon{
        width:60px!important;height:60px!important;border-radius:20px!important;
        display:grid!important;place-items:center!important;
        font-size:2.35rem!important;line-height:1!important;
        background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.25),rgba(110,231,255,.12) 42%,rgba(6,18,43,.70) 100%)!important;
        border:1px solid rgba(110,231,255,.50)!important;
        box-shadow:0 10px 24px rgba(0,0,0,.18)!important;
      }
      #uxqStaticMissionLogo b{display:block!important;color:#fff!important;font-size:1.16rem!important;line-height:1.25!important;letter-spacing:.01em!important;}
      #uxqStaticMissionLogo span{display:block!important;color:#cfe4ff!important;font-size:.92rem!important;line-height:1.35!important;margin-top:3px!important;}
      #uxqStaticMissionLogo small{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;padding:7px 10px!important;border-radius:999px!important;border:1px solid rgba(255,209,102,.55)!important;background:rgba(255,209,102,.10)!important;color:#ffe8a6!important;font-weight:950!important;font-size:.76rem!important;white-space:nowrap!important;}
      .uxqMechanicPanel .uxqMechanicIcon,.uxqMissionIdentity .miIcon{display:grid!important;visibility:visible!important;opacity:1!important;}
      @media(max-width:760px){#uxqStaticMissionLogo.uxqMissionLogoRestore{grid-template-columns:48px 1fr!important;padding:13px!important;width:min(100% - 20px,1180px)!important}#uxqStaticMissionLogo small{grid-column:1/-1}#uxqStaticMissionLogo .mlrIcon{width:46px!important;height:46px!important;font-size:1.9rem!important}}
    `;
  }

  function ensureStaticHost(){
    const main = $('#uxqCanonicalNode');
    if(!main || !document.body) return null;
    let box = $('#uxqStaticMissionLogo');
    if(!box){
      box = document.createElement('section');
      box.id = 'uxqStaticMissionLogo';
      box.className = 'uxqMissionLogoRestore';
    }
    if(box.parentNode !== document.body || box.nextSibling !== main){
      document.body.insertBefore(box, main);
    }
    return box;
  }

  function apply(){
    style();
    const info = logo[NODE] || logo.W1;
    const box = ensureStaticHost();
    if(!box) return;
    box.innerHTML = `<div class="mlrIcon" aria-hidden="true">${info[0]}</div><div><b>${NODE} • ${info[1]}</b><span>${info[2]}</span></div><small>Mission Logo</small>`;

    const brand = $('.top .brand span:last-child');
    if(brand) brand.textContent = `${NODE} • ${info[1]}`;
  }

  let t = 0;
  function run(){ clearTimeout(t); t = setTimeout(apply, 20); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
  new MutationObserver(run).observe(document.documentElement, {childList:true, subtree:true, characterData:true});
})();
