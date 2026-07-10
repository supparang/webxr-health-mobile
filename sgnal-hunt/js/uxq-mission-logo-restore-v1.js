/* CSAI2601 UX Quest • Mission Logo Restore v1
 * Restores clear mission logo/icon for every W/B after compact packs.
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
    let st = $('#uxq-mission-logo-restore-v1-style');
    if(!st){ st = document.createElement('style'); st.id = 'uxq-mission-logo-restore-v1-style'; document.head.appendChild(st); }
    st.textContent = `
      .uxqMissionLogoRestore{
        display:grid!important;
        grid-template-columns:56px 1fr auto!important;
        gap:12px!important;
        align-items:center!important;
        margin:0 0 16px!important;
        padding:14px 16px!important;
        border-radius:20px!important;
        border:1px solid rgba(110,231,255,.38)!important;
        background:linear-gradient(135deg,rgba(110,231,255,.13),rgba(155,140,255,.13))!important;
        box-shadow:0 14px 34px rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.04)!important;
      }
      .uxqMissionLogoRestore .mlrIcon{
        width:52px!important;height:52px!important;border-radius:18px!important;
        display:grid!important;place-items:center!important;
        font-size:2.15rem!important;line-height:1!important;
        background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.23),rgba(110,231,255,.10) 42%,rgba(6,18,43,.62) 100%)!important;
        border:1px solid rgba(110,231,255,.42)!important;
      }
      .uxqMissionLogoRestore b{display:block!important;color:#fff!important;font-size:1.08rem!important;line-height:1.25!important;letter-spacing:.01em!important;}
      .uxqMissionLogoRestore span{display:block!important;color:#cfe4ff!important;font-size:.88rem!important;line-height:1.35!important;margin-top:2px!important;}
      .uxqMissionLogoRestore small{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;padding:6px 10px!important;border-radius:999px!important;border:1px solid rgba(255,209,102,.5)!important;background:rgba(255,209,102,.08)!important;color:#ffe8a6!important;font-weight:950!important;font-size:.76rem!important;white-space:nowrap!important;}
      .uxqMechanicPanel .uxqMechanicIcon,.uxqMissionIdentity .miIcon{display:grid!important;visibility:visible!important;opacity:1!important;}
      @media(max-width:760px){.uxqMissionLogoRestore{grid-template-columns:46px 1fr!important}.uxqMissionLogoRestore small{grid-column:1/-1}.uxqMissionLogoRestore .mlrIcon{width:44px!important;height:44px!important;font-size:1.85rem!important}}
    `;
  }

  function apply(){
    style();
    const q = $('.question');
    if(!q) return;
    const info = logo[NODE] || logo.W1;
    let box = $('.uxqMissionLogoRestore', q);
    if(!box){
      box = document.createElement('section');
      box.className = 'uxqMissionLogoRestore';
      q.insertBefore(box, q.firstChild);
    }
    box.innerHTML = `<div class="mlrIcon" aria-hidden="true">${info[0]}</div><div><b>${NODE} • ${info[1]}</b><span>${info[2]}</span></div><small>Mission Logo</small>`;

    const brand = $('.top .brand span:last-child');
    if(brand) brand.textContent = `${NODE} • ${info[1]}`;
  }

  let t = 0;
  function run(){ clearTimeout(t); t = setTimeout(apply, 25); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
  new MutationObserver(run).observe(document.documentElement, {childList:true, subtree:true, characterData:true});
})();
