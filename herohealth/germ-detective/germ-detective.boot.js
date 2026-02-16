import GameApp from './germ-detective.js';

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const num = (v,d)=>{ const n = Number(v); return Number.isFinite(n) ? n : d; };

const ctx = {
  hub:  String(qs('hub','../hub.html')||'../hub.html'),
  run:  String(qs('run','play')||'play').toLowerCase(),
  view: String(qs('view', document.body.getAttribute('data-view')||'pc')||'pc').toLowerCase(),
  pid:  String(qs('pid','anon')||'anon').trim(),
  time: num(qs('time','240'), 240),
  diff: String(qs('diff','normal')||'normal').toLowerCase(),
  seed: String(qs('seed','')||String(Date.now())),
  gate: String(qs('gate','1')) !== '0',
  ai:   String(qs('ai','1')) !== '0'
};

document.body.setAttribute('data-view', ctx.view);
document.body.setAttribute('data-run', ctx.run);

window.HHA = window.HHA || {};
window.HHA.ctx = ctx;

const app = GameApp({
  mountId: 'app',
  timeSec: Math.max(30, Math.min(600, ctx.time)),
  seed: ctx.seed,
  view: ctx.view,
  diff: ctx.diff,
  enableAI: ctx.ai,
  warmupGate: ctx.gate
});

app.init();
window.GermDetective = app;