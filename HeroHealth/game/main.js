// === Hero Health Academy — game/main.js (2025-10-31 full reactive build) ===
// All modes unified with HUD, FX, Coach, Score, Combo, Fever

import * as HUDMod from './core/hud.js';
import { Quests } from './core/quests.js';
import * as FX from './core/fx.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

// --------------------- ENGINE ---------------------
const Engine = {
  score: {
    value: 0,
    combo: 0,
    fever: 0,
    add(n = 0) {
      this.value += n | 0;
      if (this.value < 0) this.value = 0;
    },
    comboUp() {
      this.combo++;
      if (this.combo % 10 === 0) this.fever++;
    },
    comboBreak() {
      this.combo = 0;
    }
  },
  sfx: {
    play(id) {
      const el = document.getElementById(id);
      if (el) el.currentTime = 0, el.play().catch(() => {});
    }
  },
  fx: {
    popText(txt, { x, y, ms = 650 } = {}) {
      const t = document.createElement('div');
      t.textContent = txt;
      t.style.cssText = `
        position:fixed;left:${x}px;top:${y}px;
        transform:translate(-50%,-50%);
        font:900 18px/1 ui-rounded;color:#fff;
        text-shadow:0 2px 10px #0008;
        pointer-events:none;z-index:300;
        transition:all .6s ease-out`;
      document.body.appendChild(t);
      setTimeout(() => {
        t.style.transform = 'translate(-50%,-120%) scale(1.3)';
        t.style.opacity = '0';
      }, 20);
      setTimeout(() => t.remove(), ms);
    },
    add3DTilt: FX.add3DTilt,
    shatter3D: FX.shatter3D
  }
};

// --------------------- STATE ---------------------
const App = {
  running: false,
  modeKey: 'goodjunk',
  diff: 'Normal',
  lang: 'TH',
  timeLeft: 45,
  raf: 0,
  lastTs: 0,
  game: null,
  hud: null
};

const MODES = { goodjunk, groups, hydration, plate };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const $ = s => document.querySelector(s);

// --------------------- HUD + QUEST ---------------------
App.hud = HUDMod.createHUD({
  onHome: stopToHome,
  onReplay: () => startGame(App.modeKey, App.diff, App.lang)
});
Quests.bindToMain({ hud: App.hud });

// --------------------- MENU ---------------------
const TILE = {
  goodjunk: $('#m_goodjunk'),
  groups: $('#m_groups'),
  hydration: $('#m_hydration'),
  plate: $('#m_plate')
};
for (const [k, el] of Object.entries(TILE)) {
  el?.addEventListener('click', () => {
    Object.values(TILE).forEach(x => x?.classList.remove('active'));
    el.classList.add('active');
    App.modeKey = k;
    $('#modeName').textContent = {
      goodjunk: 'Good vs Junk',
      groups: 'Food Groups',
      hydration: 'Hydration',
      plate: 'Healthy Plate'
    }[k];
  });
}
$('#d_easy').onclick = () => App.diff = 'Easy';
$('#d_normal').onclick = () => App.diff = 'Normal';
$('#d_hard').onclick = () => App.diff = 'Hard';
$('#btn_start').onclick = () => startGame(App.modeKey, App.diff, App.lang);

// --------------------- GAME CONTROL ---------------------
function startGame(modeKey = 'goodjunk', diff = 'Normal', lang = 'TH') {
  stopGame();
  App.running = true;
  App.timeLeft = 45;
  Engine.score.value = 0;
  Engine.score.combo = 0;
  Engine.score.fever = 0;
  App.hud.resetScore(0, 0);
  App.hud.updateTime(App.timeLeft);

  $('#menuBar').style.display = 'none';
  Quests.setLang(lang);
  Quests.beginRun(modeKey, diff, lang, App.timeLeft);

  const Bus = {
    hit: ({ kind, points, ui, meta } = {}) => {
      const pts = points ?? (kind === 'perfect' ? 20 : 10);
      Engine.score.add(pts);
      Engine.score.comboUp();
      Engine.fx.popText(`+${pts}${kind === 'perfect' ? ' ✨' : ''}`, ui);
      FX.shatter3D(ui.x, ui.y);
      Quests.event('hit', { result: kind || 'good', meta, comboNow: Engine.score.combo, score: Engine.score.value });
      App.hud.updateScore(Engine.score.value, Engine.score.combo, App.timeLeft);
      App.hud.setFever(Engine.score.fever);
    },
    miss: ({ meta } = {}) => {
      Engine.score.comboBreak();
      Quests.event('hit', { result: 'bad', meta, comboNow: 0, score: Engine.score.value });
      App.hud.updateScore(Engine.score.value, 0, App.timeLeft);
      App.hud.dimPenalty();
    }
  };

  const coach = {
    onStart() { App.hud.setCoach('เริ่มเลย!'); App.hud.showCoach(true); setTimeout(() => App.hud.showCoach(false), 1500); },
    onGood()  { if (Math.random() < 0.25) App.hud.flashCoach('ดีมาก!'); },
    onBad()   { App.hud.flashCoach('ระวังหน่อย!'); }
  };

  const mod = MODES[modeKey] || goodjunk;
  App.game = mod.create({ engine: Engine, hud: App.hud, coach });
  App.Bus = Bus;
  App.game.start();

  App.lastTs = performance.now();
  App.raf = requestAnimationFrame(loop);
  tickSecond();
}

function loop(ts) {
  if (!App.running) return;
  const dt = Math.min(0.05, (ts - App.lastTs) / 1000);
  App.lastTs = ts;
  try { App.game?.update?.(dt, App.Bus); } catch (e) { console.warn(e); }
  App.raf = requestAnimationFrame(loop);
}

function tickSecond() {
  if (!App.running) return;
  App.timeLeft = clamp(App.timeLeft - 1, 0, 999);
  App.hud.updateTime(App.timeLeft);
  Quests.tick({ score: Engine.score.value });
  if (App.timeLeft <= 0) return endGame();
  setTimeout(tickSecond, 1000);
}

function endGame() {
  if (!App.running) return;
  App.running = false;
  try { App.game?.stop?.(); } catch { }
  const q = Quests.endRun({ score: Engine.score.value });
  App.hud.showResult({ score: Engine.score.value, combo: Engine.score.combo, quests: q });
}

function stopGame() {
  cancelAnimationFrame(App.raf);
  try { App.game?.stop?.(); } catch { }
  App.game = null;
}

function stopToHome() {
  stopGame();
  $('#menuBar').style.display = '';
  App.hud.hideResult();
  App.hud.showCoach(false);
}

window.addEventListener('blur', () => { if (App.running) App.hud.setCoach('⏸ พักเกม'); });
window.addEventListener('focus', () => { if (App.running) App.hud.showCoach(false); });

window.__HHA_APP = App;
