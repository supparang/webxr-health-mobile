// === /fitness/js/balance-hold.js ===
// Balance Hold — FINAL PATCH (No auto jump + In-page history lock)

'use strict';

/* ------------------------------------------------------------
 * DOM helpers
 * ------------------------------------------------------------ */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

function setText(selOrEl, v){
  const el = (typeof selOrEl === 'string') ? $(selOrEl) : selOrEl;
  if (el) el.textContent = String(v ?? '');
}

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function fmtPercent(v){
  v = Number(v);
  if(!Number.isFinite(v)) return '-';
  return (v*100).toFixed(1)+'%';
}

/* ------------------------------------------------------------
 * In-page History (สำคัญมาก)
 * ------------------------------------------------------------ */

function navSet(view){
  try{
    history.pushState({ bhView:view }, '', '#'+view);
  }catch(e){}
}

function navReplace(view){
  try{
    history.replaceState({ bhView:view }, '', '#'+view);
  }catch(e){}
}

window.addEventListener('popstate',(e)=>{
  const v = e?.state?.bhView;
  if(!v) return;

  closeEndModal();
  closeTutorial();

  if(v==='menu') showView('menu');
  if(v==='play') showView('play');
  if(v==='research') showView('research');
  if(v==='result') showView('result');
});

/* ------------------------------------------------------------
 * Views
 * ------------------------------------------------------------ */

const viewMenu     = $('#view-menu');
const viewResearch = $('#view-research');
const viewPlay     = $('#view-play');
const viewResult   = $('#view-result');

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v&&v.classList.add('hidden'));
  if(name==='menu') viewMenu?.classList.remove('hidden');
  if(name==='research') viewResearch?.classList.remove('hidden');
  if(name==='play') viewPlay?.classList.remove('hidden');
  if(name==='result') viewResult?.classList.remove('hidden');
}

/* ------------------------------------------------------------
 * Overlay helpers
 * ------------------------------------------------------------ */

const tutorialOverlay = $('#tutorialOverlay');
const endModal = $('#endModal');

function openTutorial(){
  tutorialOverlay?.classList.remove('hidden');
}
function closeTutorial(){
  tutorialOverlay?.classList.add('hidden');
}
function openEndModal(){
  endModal?.classList.remove('hidden');
}
function closeEndModal(){
  endModal?.classList.add('hidden');
}

/* ------------------------------------------------------------
 * Game State
 * ------------------------------------------------------------ */

let state=null;
let rafId=null;
let isPaused=false;

/* ------------------------------------------------------------
 * Start
 * ------------------------------------------------------------ */

function startGame(){
  state={
    durationMs:60000,
    startTime:performance.now(),
    score:0
  };

  isPaused=false;

  showView('play');
  navSet('play');

  rafId=requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Stop (สำคัญ)
 * ------------------------------------------------------------ */

function stopGame(reason){
  if(!state) return;

  cancelAnimationFrame(rafId);

  const summary={
    score:state.score||0,
    rank:'B',
    stabilityRatio:0.65
  };

  fillResult(summary);

  state=null;
  isPaused=false;

  showView('result');
  navSet('result');

  // เปิด modal ช้าเล็กน้อย
  setTimeout(()=>openEndModal(),300);
}

/* ------------------------------------------------------------
 * Loop
 * ------------------------------------------------------------ */

function loop(now){
  if(!state) return;

  const elapsed=now-state.startTime;

  if(elapsed>=state.durationMs){
    stopGame('timeout');
    return;
  }

  rafId=requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Result
 * ------------------------------------------------------------ */

function fillResult(summary){
  setText('#res-score',summary.score);
  setText('#res-rank',summary.rank);
  setText('#res-stability',fmtPercent(summary.stabilityRatio));
}

/* ------------------------------------------------------------
 * Init
 * ------------------------------------------------------------ */

function init(){

  $('[data-action="start-normal"]')?.addEventListener('click',()=>{
    startGame();
  });

  $('[data-action="stop"]')?.addEventListener('click',()=>{
    stopGame('manual');
  });

  $('[data-action="result-play-again"]')?.addEventListener('click',()=>{
    closeEndModal();
    showView('menu');
    navSet('menu');
  });

  $('[data-action="result-back-hub"]')?.addEventListener('click',()=>{
    const hub=new URLSearchParams(location.search).get('hub');
    if(hub) location.href=hub;
  });

  $('[data-action="close-end-modal"]')?.addEventListener('click',closeEndModal);

  showView('menu');
  navReplace('menu');
}

window.addEventListener('DOMContentLoaded',init);