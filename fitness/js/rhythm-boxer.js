// ===== Rhythm Boxer main controller =====
import { RhythmEngine } from './rhythm-engine.js';

let viewMenu, viewResearch, viewPlay, viewResult;
let scoreEl, comboEl, perfectEl, missEl, timeEl;
let rScore, rAcc, rOffset, rPerfect, rMiss, rMaxCombo;
let engine = null;

window.addEventListener('DOMContentLoaded', () => {
  query();
  bindMenu();
});

function query() {
  viewMenu    = document.querySelector('#view-menu');
  viewResearch= document.querySelector('#view-research');
  viewPlay    = document.querySelector('#view-play');
  viewResult  = document.querySelector('#view-result');

  scoreEl  = document.querySelector('#score');
  comboEl  = document.querySelector('#combo');
  perfectEl= document.querySelector('#perfect');
  missEl   = document.querySelector('#miss');
  timeEl   = document.querySelector('#time');

  rScore   = document.querySelector('#r-score');
  rAcc     = document.querySelector('#r-acc');
  rOffset  = document.querySelector('#r-offset');
  rPerfect = document.querySelector('#r-perfect');
  rMiss    = document.querySelector('#r-miss');
  rMaxCombo= document.querySelector('#r-maxcombo');
}

function show(v) {
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(s=>s.classList.add('hidden'));
  v.classList.remove('hidden');
}

function bindMenu() {
  // ปกติ
  document.querySelector('[data-action="start-normal"]')
    .onclick = () => beginPlay({mode:'normal'});

  // วิจัย
  document.querySelector('[data-action="start-research"]')
    .onclick = () => show(viewResearch);

  document.querySelector('[data-action="research-begin"]')
    .onclick = () => beginPlay({
      mode:'research',
      pid: document.querySelector('#r-id').value,
      group: document.querySelector('#r-group').value,
      note: document.querySelector('#r-note').value
    });

  document.querySelectorAll('[data-action="back-menu"]')
    .forEach(btn => btn.onclick = () => show(viewMenu));

  document.querySelector('[data-action="stop"]').onclick = endPlay;
}

function beginPlay(info={}) {
  const diff = document.querySelector('#difficulty').value;

  engine = new RhythmEngine({
    targetLayer: document.querySelector('#target-layer'),
    difficulty: diff,
    mode: info.mode,
    research: info
  });

  engine.onUpdate = updateHUD;
  engine.onFinish = showResult;

  show(viewPlay);
  engine.start();
}

function updateHUD(s) {
  scoreEl.textContent = s.score;
  comboEl.textContent = s.combo;
  perfectEl.textContent = s.perfect;
  missEl.textContent = s.miss;
  timeEl.textContent = s.timeLeft;
}

function endPlay() {
  if (engine) engine.forceEnd();
}

function showResult(res) {
  rScore.textContent   = res.score;
  rAcc.textContent     = (res.rhythmAccuracy*100).toFixed(1)+'%';
  rOffset.textContent  = res.avgOffset.toFixed(1)+' ms';
  rPerfect.textContent = res.perfect;
  rMiss.textContent    = res.miss;
  rMaxCombo.textContent= res.maxCombo;

  show(viewResult);

  document.querySelector('[data-action="play-again"]').onclick = () => {
    show(viewMenu);
  };
}