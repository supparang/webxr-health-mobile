/* CSAI2601 UX Quest • Production Theme v2.1
 * Consolidated five-phase visual authority.
 * Presentation only: never changes answers, score, progress, unlocks, identity,
 * artifacts, or Google Sheet synchronization.
 */
(function(){
  'use strict';

  var VERSION='uxq-production-theme-v2.1-20260715';
  var STYLE_ID='uxqProductionThemeV2';
  var DEBUG_RE=/(?:W\d+\s+stage-aware|W\d+\s+problem\s*scan|Foundation Quality Pack|Ultimate Guard|no-repeat\s*\/\s*no-longest|evidence-first|hard compact|4-card override|Anti-Guess|Sheet Only|Final v\d+|visual authority|production authority)/i;

  function installStyle(){
    var old=document.getElementById(STYLE_ID);
    if(old)old.remove();
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      :root{
        --uxq-bg:#061126;--uxq-panel:#0d2142;--uxq-card:#0c203e;
        --uxq-card-hover:#132d52;--uxq-line:rgba(144,184,245,.24);
        --uxq-line-strong:rgba(110,231,255,.62);--uxq-text:#f4f8ff;
        --uxq-muted:#aebfdd;--uxq-cyan:#6ee7ff;--uxq-violet:#9b8cff;
        --uxq-gold:#ffd166;--uxq-good:#6ee7b7;--uxq-bad:#ff91a8;
        --uxq-shell:min(92vw,1440px);--uxq-shadow:0 28px 80px rgba(0,0,0,.32)
      }
      *{box-sizing:border-box}
      html,body{max-width:100%;overflow-x:hidden!important}
      body{margin:0!important;min-height:100vh;color:var(--uxq-text)!important;background:radial-gradient(circle at 8% 0%,rgba(33,83,139,.72),transparent 31rem),radial-gradient(circle at 100% 0%,rgba(70,48,139,.65),transparent 33rem),var(--uxq-bg)!important;font-family:Inter,"Noto Sans Thai",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
      button,a,textarea,input,select{font:inherit}
      #uxqStaticMissionLogo{display:none!important}
      #uxqCanonicalNode{width:100%;min-height:100vh}
      .shell{width:var(--uxq-shell)!important;max-width:var(--uxq-shell)!important;margin:0 auto!important;padding:22px 0 56px!important}
      .top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;margin:0 0 16px!important}
      .brand{display:flex!important;align-items:center!important;gap:10px!important;color:#fff!important;text-decoration:none!important;font-weight:950!important;font-size:18px!important}
      .mark{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;border-radius:13px!important;border:1px solid rgba(110,231,255,.55)!important;background:linear-gradient(145deg,rgba(110,231,255,.22),rgba(155,140,255,.25))!important}
      .top>.pill{display:none!important}
      .panel{overflow:hidden!important;border:1px solid var(--uxq-line)!important;border-radius:28px!important;background:linear-gradient(155deg,rgba(19,44,83,.97),rgba(7,22,48,.99))!important;box-shadow:var(--uxq-shadow)!important}
      .hero{display:grid!important;gap:20px!important;padding:clamp(30px,5vw,62px)!important}
      .hero .kicker,.case>.kicker{margin:0!important;color:var(--uxq-cyan)!important;font-size:13px!important;font-weight:950!important;letter-spacing:.14em!important;text-transform:uppercase!important}
      .hero .title{margin:0!important;max-width:950px!important;font-size:clamp(42px,6vw,76px)!important;line-height:.98!important;letter-spacing:-.045em!important}
      .hero .lede{margin:0!important;max-width:900px!important;color:var(--uxq-muted)!important;font-size:clamp(17px,1.8vw,21px)!important;line-height:1.58!important}
      .briefs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important}
      .brief{min-height:112px!important;padding:18px!important;border:1px solid var(--uxq-line)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(7,22,49,.76),rgba(5,16,37,.76))!important}
      .brief b{display:block!important;margin-bottom:7px!important;color:#fff!important;font-size:16px!important}.brief span{display:block!important;color:var(--uxq-muted)!important;font-size:15px!important;line-height:1.55!important}
      .actions{display:grid!important;grid-template-columns:minmax(180px,230px) minmax(180px,230px)!important;gap:12px!important}
      .btn,.actions .btn{display:grid!important;place-items:center!important;min-height:54px!important;padding:13px 18px!important;border-radius:16px!important;border:0!important;text-align:center!important;text-decoration:none!important;font-size:17px!important;font-weight:950!important;cursor:pointer!important;transition:.16s ease!important}
      .btn:not(.secondary){background:linear-gradient(135deg,var(--uxq-cyan),#8af0dc)!important;color:#061126!important}.btn.secondary{background:rgba(5,15,35,.38)!important;color:#fff!important;border:1px solid var(--uxq-line)!important}.btn:hover{transform:translateY(-2px)!important}
      .game{padding:0!important}
      .hud{display:grid!important;grid-template-columns:minmax(0,1.9fr) repeat(3,minmax(118px,.42fr))!important;gap:10px!important;padding:12px 14px!important;border-bottom:1px solid var(--uxq-line)!important;background:rgba(4,14,31,.54)!important}
      .meter{min-width:0!important;min-height:64px!important;padding:10px 12px!important;border:1px solid var(--uxq-line)!important;border-radius:15px!important;background:linear-gradient(180deg,rgba(6,21,43,.78),rgba(4,15,34,.68))!important}.meter small{display:block!important;color:#aabddd!important;font-size:11px!important;font-weight:900!important;letter-spacing:.09em!important;text-transform:uppercase!important}.meter b{display:block!important;margin-top:3px!important;color:#fff!important;font-size:16px!important}.bar{height:7px!important;margin-top:8px!important;border-radius:999px!important;background:rgba(255,255,255,.09)!important;overflow:hidden!important}.bar i{display:block!important;height:100%!important;background:linear-gradient(90deg,var(--uxq-cyan),var(--uxq-violet))!important}
      .case{display:grid!important;gap:9px!important;margin:0!important;padding:34px 32px 18px!important;background:transparent!important}.case h1{margin:0!important;font-size:clamp(2rem,3.3vw,3.35rem)!important;line-height:1.08!important;letter-spacing:-.035em!important}.case p{margin:0!important;color:var(--uxq-muted)!important;font-size:clamp(1rem,1.25vw,1.18rem)!important;line-height:1.58!important}
      .question{margin:0 32px 32px!important;padding:24px!important;border:1px solid var(--uxq-line)!important;border-radius:23px!important;background:linear-gradient(150deg,rgba(21,45,84,.88),rgba(8,22,48,.97))!important;box-shadow:0 18px 44px rgba(0,0,0,.18)!important;overflow:visible!important}.prompt,.question .prompt{margin:0!important;color:#fff!important;font-size:clamp(1.45rem,2vw,2rem)!important;line-height:1.28!important}.instruction{margin:9px 0 0!important;color:#c8d5ed!important;font-size:clamp(.98rem,1.12vw,1.08rem)!important;line-height:1.52!important}
      .options{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:1fr!important;gap:14px!important;width:100%!important;min-width:0!important;max-width:100%!important;margin-top:18px!important;align-items:stretch!important;overflow:visible!important;transform:none!important}
      .option,button.option{display:flex!important;flex-direction:column!important;justify-content:flex-start!important;width:100%!important;min-width:0!important;max-width:100%!important;height:100%!important;min-height:132px!important;margin:0!important;padding:18px!important;border:1px solid var(--uxq-line)!important;border-radius:18px!important;background:linear-gradient(180deg,var(--uxq-card),#091b36)!important;color:#fff!important;text-align:left!important;white-space:normal!important;overflow:visible!important;overflow-wrap:anywhere!important;box-shadow:0 8px 20px rgba(0,0,0,.13)!important;cursor:pointer!important;transition:.16s ease!important}.option:hover:not(:disabled),button.option:hover:not(:disabled){transform:translateY(-2px)!important;border-color:var(--uxq-line-strong)!important;background:linear-gradient(180deg,var(--uxq-card-hover),#0c2342)!important}.option.pick,.option.selected,button.option.pick,button.option.selected{border-color:rgba(255,209,102,.82)!important}.option.correct,button.option.correct{border-color:rgba(110,231,183,.82)!important;background:rgba(18,63,70,.96)!important}.option.wrong,button.option.wrong{border-color:rgba(255,145,168,.82)!important;background:rgba(73,36,57,.96)!important}
      .option b,button.option b{display:block!important;margin:0!important;color:#fff!important;font-size:clamp(1rem,1.15vw,1.12rem)!important;font-weight:850!important;line-height:1.46!important;white-space:normal!important;overflow-wrap:anywhere!important}.option span,button.option span{display:block!important;margin-top:8px!important;color:#9fb1d2!important;font-size:.86rem!important;line-height:1.42!important;white-space:normal!important;overflow-wrap:anywhere!important}.option .letter,button.option .letter{display:inline-grid!important;place-items:center!important;width:30px!important;height:30px!important;margin:0 0 9px!important;border:1px solid rgba(110,231,255,.65)!important;border-radius:999px!important;color:#baf4ff!important;background:rgba(110,231,255,.09)!important;font-size:13px!important;font-weight:950!important}
      .verify{margin:16px 0 0!important;padding:18px!important;border:1px solid rgba(110,231,255,.38)!important;border-radius:19px!important;background:rgba(110,231,255,.065)!important}.verify h2,.verify h3{margin:0 0 7px!important;color:#fff!important;font-size:clamp(1.25rem,1.7vw,1.55rem)!important}.verify>p{margin:0 0 12px!important;color:#d5e1f6!important;line-height:1.55!important}
      .utility{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;align-items:stretch!important;margin-top:16px!important}.hint,.utility .hint{display:flex!important;align-items:center!important;min-height:54px!important;padding:13px 16px!important;border:1px solid rgba(255,209,102,.48)!important;border-radius:15px!important;background:rgba(255,209,102,.08)!important;color:#ffe3a6!important;font-size:16px!important;line-height:1.48!important}.hint::before{content:'💡';margin-right:9px}.utility button{min-width:138px!important;min-height:54px!important;padding:12px 17px!important;border-radius:15px!important;border:1px solid var(--uxq-line)!important;background:linear-gradient(180deg,#132d52,#0c213f)!important;color:#fff!important;font-size:16px!important;font-weight:950!important}
      .feedback{margin-top:15px!important;padding:16px!important;border:1px solid var(--uxq-line)!important;border-radius:17px!important;background:rgba(5,15,35,.58)!important;line-height:1.58!important}.feedback.good{border-color:rgba(110,231,183,.62)!important;background:rgba(110,231,183,.09)!important}.feedback.bad{border-color:rgba(255,145,168,.65)!important;background:rgba(255,145,168,.09)!important}
      .results{display:grid!important;justify-items:center!important;gap:17px!important;padding:clamp(28px,5vw,58px)!important;text-align:center!important}.stars{font-size:clamp(2.8rem,8vw,5.2rem)!important;color:var(--uxq-gold)!important}.result-grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;width:min(850px,100%)!important}.result-grid>div{padding:14px!important;border:1px solid var(--uxq-line)!important;border-radius:16px!important;background:rgba(5,15,35,.48)!important}
      .artifact{display:grid!important;gap:11px!important;width:min(860px,100%)!important;padding:20px!important;border:1px solid rgba(155,140,255,.56)!important;border-radius:21px!important;background:linear-gradient(145deg,rgba(54,42,112,.34),rgba(8,24,52,.76))!important}.artifact textarea,.artifact input,.artifact select{width:100%!important;padding:12px!important;border:1px solid rgba(181,205,255,.32)!important;border-radius:13px!important;background:rgba(3,13,31,.56)!important;color:#eff7ff!important;font-size:16px!important}.artifact button{min-height:52px!important;border-radius:15px!important;font-weight:950!important}
      #uxqStaticMissionLogo,[data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority],[data-hard-compact],.w1HardBadge,.hardBadge,.uxqDebugBadge,.uxqAuthorityBadge{display:none!important}
      @media(max-width:900px){:root{--uxq-shell:100%}.shell{padding:0!important}.top{padding:14px 16px 0!important}.panel{border-left:0!important;border-right:0!important;border-radius:0!important;box-shadow:none!important}.briefs{grid-template-columns:1fr!important}.actions{grid-template-columns:1fr!important}.actions .btn{width:100%!important}.hud{grid-template-columns:1fr 1fr!important;padding:10px!important}.hud .meter:first-child{grid-column:1/-1!important}.case{padding:24px 18px 14px!important}.question{margin:0 12px 18px!important;padding:18px!important}.options{grid-template-columns:1fr!important;grid-auto-rows:auto!important}.option,button.option{height:auto!important;min-height:0!important;padding:16px!important}.utility{grid-template-columns:1fr!important}.utility button{width:100%!important}.result-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:480px){.top{padding:11px 12px 0!important}.brand{font-size:15px!important}.mark{width:35px!important;height:35px!important}.hero{padding:24px 16px 22px!important}.hero .title{font-size:36px!important}.case{padding:20px 14px 13px!important}.case h1{font-size:2rem!important}.question{margin:0 8px 14px!important;padding:15px!important}.prompt,.question .prompt{font-size:1.35rem!important}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function protectedContainer(el){
    return !el || !el.matches || el.matches('#uxqCanonicalNode,.shell,.panel,.game,.hero,.hud,.case,.question,.options,.verify,.results,.artifact,.top,.briefs,.actions');
  }

  function removeDebugBadges(){
    document.querySelectorAll('[data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority],[data-hard-compact],.w1HardBadge,.hardBadge,.uxqDebugBadge,.uxqAuthorityBadge').forEach(function(el){if(!protectedContainer(el))el.remove();});
    document.querySelectorAll('#uxqCanonicalNode div,#uxqCanonicalNode span,#uxqCanonicalNode small,#uxqCanonicalNode p').forEach(function(el){
      if(protectedContainer(el) || el.querySelector('button,input,textarea,select,a'))return;
      var text=String(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!text || text.length>180 || !DEBUG_RE.test(text))return;
      var rect=el.getBoundingClientRect();
      if(rect.height<=64 && rect.width<=900)el.remove();
    });
  }

  function cleanChoiceMeta(){
    document.querySelectorAll('.option span,button.option span').forEach(function(el){
      if(el.children.length)return;
      var text=String(el.textContent||'').replace(/\s+/g,' ').trim();
      if(/^กับดัก\s*:/i.test(text) || /^เชื่อมกับหลักฐานและ artifact$/i.test(text) || /^พิจารณาความสอดคล้องกับสถานการณ์.*เป้าหมาย.*ผู้ใช้$/i.test(text))el.remove();
    });
  }

  function normalize(){
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
    document.querySelectorAll('.options').forEach(function(group){
      ['grid-auto-flow','grid-auto-columns','min-width','width','transform'].forEach(function(p){group.style.removeProperty(p);});
      group.scrollLeft=0;
    });
    document.querySelectorAll('.option,button.option').forEach(function(card){
      ['flex-basis','min-width','max-width','width','height','min-height','transform'].forEach(function(p){card.style.removeProperty(p);});
    });
  }

  function run(){removeDebugBadges();cleanChoiceMeta();normalize();}
  installStyle();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  var raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(run);}
  new MutationObserver(schedule).observe(document.getElementById('uxqCanonicalNode')||document.body,{childList:true,subtree:true});
  addEventListener('resize',schedule,{passive:true});
  window.UXQProductionThemeV2=Object.freeze({version:VERSION,run:run});
})();
