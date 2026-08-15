(()=>{
'use strict';
const RELEASE='20260815-HH-RESPONSIVE-RUNTIME-R1.2-RETURN-FAILSAFE';
if(window.HHResponsiveRuntime?.release===RELEASE)return;
const q=new URLSearchParams(location.search),root=document.documentElement;
const coarse=window.matchMedia?.('(pointer:coarse)')?.matches===true;
const desktop=!coarse&&(window.innerWidth||1024)>=768;
const smoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''));
const gameTest=q.get('gameTestMode')==='1'||q.get('mode')==='game-test'||q.get('isTestAttempt')==='true';
root.classList.add('hh-responsive-runtime',desktop?'hh-device-desktop':'hh-device-mobile');
if(smoke)root.classList.add('hh-smoke-test');if(gameTest)root.classList.add('hh-game-test');
const css=`:root{--hh-safe-top:env(safe-area-inset-top,0px);--hh-safe-right:env(safe-area-inset-right,0px);--hh-safe-bottom:env(safe-area-inset-bottom,0px);--hh-safe-left:env(safe-area-inset-left,0px);--hh-visual-h:100dvh;--hh-edge:clamp(8px,2.4vw,18px)}html.hh-responsive-runtime{width:100%;max-width:100%;min-width:0;-webkit-text-size-adjust:100%;text-size-adjust:100%}html.hh-responsive-runtime body{width:100%;max-width:100%;min-width:0;min-height:100svh;min-height:var(--hh-visual-h);overflow-x:hidden}html.hh-responsive-runtime *{min-width:0}html.hh-responsive-runtime :where(img,svg,video){max-width:100%;height:auto}html.hh-responsive-runtime :where(iframe){max-width:100%;border:0}html.hh-responsive-runtime :where(button,[role=button]){touch-action:manipulation;-webkit-tap-highlight-color:transparent}html.hh-responsive-runtime :where(.wrap,.container,.page,.shell,.app){max-width:100%}html.hh-responsive-runtime :where(.modal,[role=dialog],.dialog,.sheet){max-width:calc(100vw - (var(--hh-edge)*2));max-height:calc(var(--hh-visual-h) - (var(--hh-edge)*2));overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}html.hh-responsive-runtime :where(h1,h2,h3,p,small,span,b,strong,label,.status,.notice){overflow-wrap:anywhere}html.hh-responsive-runtime :where(.screen,.overlay,.game,.stage){max-width:100vw}html.hh-responsive-runtime .screen{min-height:var(--hh-visual-h)}html.hh-responsive-runtime #world{max-width:none!important}html.hh-responsive-runtime #intro.screen,html.hh-responsive-runtime #countdown.screen,html.hh-responsive-runtime #result.screen{padding-top:calc(var(--hh-edge) + var(--hh-safe-top));padding-right:calc(var(--hh-edge) + var(--hh-safe-right));padding-bottom:calc(var(--hh-edge) + var(--hh-safe-bottom));padding-left:calc(var(--hh-edge) + var(--hh-safe-left))}html.hh-responsive-runtime #intro .card,html.hh-responsive-runtime #countdown .card,html.hh-responsive-runtime #result .card{max-height:calc(var(--hh-visual-h) - var(--hh-safe-top) - var(--hh-safe-bottom) - 16px);overflow:auto;-webkit-overflow-scrolling:touch}html.hh-responsive-runtime #game.game .hud{top:calc(6px + var(--hh-safe-top));left:calc(6px + var(--hh-safe-left));right:calc(6px + var(--hh-safe-right));gap:5px}html.hh-responsive-runtime #game.game .camera{right:calc(6px + var(--hh-safe-right));bottom:calc(6px + var(--hh-safe-bottom))}html.hh-responsive-runtime #game.game .pose{left:calc(6px + var(--hh-safe-left));bottom:calc(6px + var(--hh-safe-bottom));max-width:calc(100vw - 130px - var(--hh-safe-left) - var(--hh-safe-right));white-space:normal}html.hh-responsive-runtime body.bh-classroom-stable .app,html.hh-responsive-runtime body.bh-classroom-stable .stage{height:var(--hh-visual-h);min-height:var(--hh-visual-h);max-height:var(--hh-visual-h)}html.hh-responsive-runtime body.bh-classroom-stable .hud{top:calc(6px + var(--hh-safe-top));left:calc(6px + var(--hh-safe-left));right:calc(6px + var(--hh-safe-right));gap:5px}html.hh-responsive-runtime body.bh-classroom-stable .coach{bottom:calc(6px + var(--hh-safe-bottom));width:min(780px,calc(100% - 12px - var(--hh-safe-left) - var(--hh-safe-right)))}html.hh-responsive-runtime body.bh-classroom-stable .energy{bottom:calc(88px + var(--hh-safe-bottom))}html.hh-responsive-runtime body.bh-classroom-stable .overlay{padding:calc(8px + var(--hh-safe-top)) calc(8px + var(--hh-safe-right)) calc(8px + var(--hh-safe-bottom)) calc(8px + var(--hh-safe-left))}@media (pointer:coarse),(max-width:760px){html.hh-responsive-runtime :where(button,[role=button],input:not([type=radio]):not([type=checkbox]),select){min-height:48px}html.hh-responsive-runtime :where(input,select,textarea){font-size:16px}html.hh-responsive-runtime :where(.actions,.controls,.buttons,.button-row,.authbar){flex-wrap:wrap}html.hh-responsive-runtime #game.game .camera{width:clamp(88px,27vw,116px)}html.hh-responsive-runtime #game.game .pose{max-width:calc(100vw - 122px - var(--hh-safe-left) - var(--hh-safe-right));font-size:11px;padding:6px 8px}html.hh-responsive-runtime body.bh-classroom-stable .hud{grid-template-columns:repeat(3,minmax(0,1fr))}html.hh-responsive-runtime body.bh-classroom-stable .hudCard{padding:5px 6px;border-radius:13px}html.hh-responsive-runtime body.bh-classroom-stable .coach{grid-template-columns:auto 1fr;padding:8px;gap:7px}html.hh-responsive-runtime body.bh-classroom-stable .coachBadge{display:none!important}}@media(max-width:480px){:root{--hh-edge:8px}html.hh-responsive-runtime #game.game .mission{top:calc(58px + var(--hh-safe-top));font-size:11px;padding:7px 9px}html.hh-responsive-runtime #game.game .hud .pill{font-size:11px;padding:7px 8px}}@media print{html.hh-responsive-runtime body{min-height:auto!important;overflow:visible!important}.hh-smoke-badge{display:none!important}}`;
if(!document.getElementById('hh-responsive-runtime-style')){const s=document.createElement('style');s.id='hh-responsive-runtime-style';s.textContent=css;(document.head||root).appendChild(s)}
function viewport(){const vv=window.visualViewport,w=Math.max(1,Math.round(vv?.width||window.innerWidth||1)),h=Math.max(1,Math.round(vv?.height||window.innerHeight||1));root.style.setProperty('--hh-visual-w',`${w}px`);root.style.setProperty('--hh-visual-h',`${h}px`);root.dataset.hhViewport=w>h?'landscape':'portrait';root.dataset.hhDevice=desktop?'desktop':'mobile';root.dataset.hhSmoke=smoke?'1':'0'}
function ready(){document.body?.classList.add('hh-responsive-ready');if(smoke&&desktop&&window.top===window&&q.get('smokeBadge')!=='0'&&!document.getElementById('hh-smoke-badge')){const b=document.createElement('div');b.id='hh-smoke-badge';b.className='hh-smoke-badge';b.textContent='PC SMOKE • Responsive QA';b.style.cssText='position:fixed;z-index:2147483600;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));padding:6px 9px;border-radius:999px;background:#111827dd;color:#fff;font:900 10px system-ui;pointer-events:none';document.body.appendChild(b)}}

function installVerifiedReturnFailsafe(){
  if(window.top!==window||gameTest||!/game-shell-authority-r42\.html$/i.test(String(location.pathname||'')))return;
  if(window.__HH_R42_VERIFIED_RETURN_FAILSAFE__)return;
  window.__HH_R42_VERIFIED_RETURN_FAILSAFE__=true;
  let armedAt=0,navigating=false;
  const sid=String(q.get('studentId')||q.get('sid')||q.get('pid')||'').trim();
  const gameId=String(q.get('gameId')||'').trim().toLowerCase();
  function canonicalReturn(){
    const raw=q.get('return')||q.get('back')||'./index.html';
    const u=new URL(raw,location.href);
    if(sid){u.searchParams.set('studentId',sid);u.searchParams.set('sid',sid)}
    u.searchParams.set('authority','firebase');u.searchParams.set('firebaseReady','1');u.searchParams.set('firebaseReceipt','1');u.searchParams.set('gameCompleted','1');
    if(gameId)u.searchParams.set('returnedGame',gameId);
    u.searchParams.set('authorityRefresh',String(Date.now()));u.searchParams.set('returnSessionPolicy','force-firebase-rehydrate-r53');u.searchParams.set('shellWatchdog','r53');u.searchParams.set('appv','20260815-PASSPORT-R20-REWARD-CHAMPION');
    return u.href;
  }
  function evidence(){
    const shellText=`${document.getElementById('receiptStatus')?.textContent||''} ${document.getElementById('back')?.textContent||''}`;
    let frameText='';
    try{const d=document.getElementById('game')?.contentDocument;if(d)frameText=String(d.body?.innerText||'').slice(-6000)}catch(_){}
    const text=`${shellText} ${frameText}`;
    return /Firebase\s*ยืนยันแล้ว/i.test(text)&&(/กำลังกลับ\s*Hero\s*Passport/i.test(text)||/กลับ\s*Passport/i.test(text));
  }
  function tick(){
    if(navigating)return;
    if(!evidence()){armedAt=0;return}
    if(!armedAt){armedAt=Date.now();console.info('[HeroHealth R42 Return Failsafe] verified receipt observed',{sid,gameId});return}
    if(Date.now()-armedAt<1400)return;
    navigating=true;
    const url=canonicalReturn();
    console.warn('[HeroHealth R42 Return Failsafe] forcing Passport return',{sid,gameId,url});
    try{location.replace(url)}catch(_){location.href=url}
    setTimeout(()=>{if(location.pathname.includes('game-shell-authority-r42.html'))location.href=url},1200);
  }
  setInterval(tick,250);
  addEventListener('pageshow',tick);addEventListener('online',tick);
  console.info('[HeroHealth R42 Return Failsafe] installed',RELEASE);
}

viewport();document.body?ready():addEventListener('DOMContentLoaded',ready,{once:true});let raf=0;const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(viewport)};addEventListener('resize',schedule,{passive:true});addEventListener('orientationchange',schedule,{passive:true});window.visualViewport?.addEventListener('resize',schedule,{passive:true});
installVerifiedReturnFailsafe();
window.HHResponsiveRuntime={release:RELEASE,smoke,gameTest,desktop,refresh:viewport,installVerifiedReturnFailsafe};
})();