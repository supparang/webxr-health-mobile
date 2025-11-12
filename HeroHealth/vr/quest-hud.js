// === /HeroHealth/vr/quest-hud.js (2025-11-12 LATEST, auto-mount, focus-one-by-one) ===
(function(){
  'use strict';

  // ---------- DOM build ----------
  const ID_ROOT = 'hha-quest-hud';
  if (document.getElementById(ID_ROOT)) return; // mounted already

  const root = document.createElement('div');
  root.id = ID_ROOT;
  root.innerHTML = `
    <div class="wrap">
      <div class="card" id="qGoal">
        <div class="title">GOAL</div>
        <div class="label" id="qGoalLabel">—</div>
        <div class="bar"><div class="fill" id="qGoalFill" style="width:0%"></div></div>
        <div class="nums"><span id="qGoalNow">0</span>/<span id="qGoalMax">0</span></div>
      </div>

      <div class="card" id="qMini" hidden>
        <div class="title">MINI QUEST</div>
        <div class="label" id="qMiniLabel">—</div>
        <div class="bar"><div class="fill" id="qMiniFill" style="width:0%"></div></div>
        <div class="nums"><span id="qMiniNow">0</span>/<span id="qMiniMax">0</span></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // ---------- CSS ----------
  const css = document.createElement('style');
  css.id = 'hha-quest-hud-css';
  css.textContent = `
  #${ID_ROOT}{position:fixed;right:16px;top:88px;z-index:520;pointer-events:none}
  #${ID_ROOT} .wrap{display:flex;flex-direction:column;gap:10px;max-width:min(48vw,420px)}
  #${ID_ROOT} .card{
    background:#0b1220cc;border:1px solid #334155;border-radius:14px;padding:12px 14px;
    color:#e2e8f0;box-shadow:0 12px 30px rgba(0,0,0,.35)
  }
  #${ID_ROOT} .title{font:900 11px system-ui;letter-spacing:.8px;color:#93c5fd;opacity:.9;margin-bottom:4px}
  #${ID_ROOT} .label{font:800 14px system-ui;color:#f8fafc;margin:2px 0 8px 0}
  #${ID_ROOT} .bar{height:10px;border-radius:999px;background:#0f172a;border:1px solid #334155;overflow:hidden}
  #${ID_ROOT} .fill{height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#22c55e)}
  #${ID_ROOT} .nums{margin-top:6px;font:800 12px system-ui;color:#cbd5e1;text-align:right}
  @media (max-width:640px){
    #${ID_ROOT}{right:10px;top:86px}
    #${ID_ROOT} .wrap{max-width:85vw}
  }`;
  document.head.appendChild(css);

  // ---------- Refs ----------
  const elGoalCard = document.getElementById('qGoal');
  const elMiniCard = document.getElementById('qMini');

  const elGoalLabel = document.getElementById('qGoalLabel');
  const elGoalFill  = document.getElementById('qGoalFill');
  const elGoalNow   = document.getElementById('qGoalNow');
  const elGoalMax   = document.getElementById('qGoalMax');

  const elMiniLabel = document.getElementById('qMiniLabel');
  const elMiniFill  = document.getElementById('qMiniFill');
  const elMiniNow   = document.getElementById('qMiniNow');
  const elMiniMax   = document.getElementById('qMiniMax');

  // ---------- State ----------
  let last = { goal:null, mini:null };
  let focus = 'goal'; // 'goal' or 'mini'
  let rotTimer = null;

  function pct(n,d){ return d>0 ? Math.max(0, Math.min(100, Math.round((n/d)*100))) : 0; }

  function renderGoal(g){
    if(!g){ elGoalLabel.textContent='—'; elGoalFill.style.width='0%'; elGoalNow.textContent='0'; elGoalMax.textContent='0'; return; }
    const now = +g.prog|0, max = +g.target|0;
    elGoalLabel.textContent = g.label || '—';
    elGoalFill.style.width  = pct(now, max) + '%';
    elGoalNow.textContent   = now.toString();
    elGoalMax.textContent   = max.toString();
  }
  function renderMini(m){
    if(!m){ elMiniLabel.textContent='—'; elMiniFill.style.width='0%'; elMiniNow.textContent='0'; elMiniMax.textContent='0'; return; }
    const now = +m.prog|0, max = +m.target|0;
    elMiniLabel.textContent = m.label || '—';
    elMiniFill.style.width  = pct(now, max) + '%';
    elMiniNow.textContent   = now.toString();
    elMiniMax.textContent   = max.toString();
  }

  function applyFocus(which){
    focus = (which==='mini') ? 'mini' : 'goal';
    if (focus==='goal'){ elGoalCard.hidden=false; elMiniCard.hidden=true; }
    else { elGoalCard.hidden=true; elMiniCard.hidden=false; }
  }

  function rotate(){
    applyFocus(focus==='goal' ? 'mini' : 'goal');
  }

  function scheduleRotate(){
    try{ clearInterval(rotTimer); }catch(_){}
    rotTimer = setInterval(rotate, 6000);
  }

  // ---------- Public-ish API (optional) ----------
  function questHUDInit(){ applyFocus('goal'); scheduleRotate(); }
  function questHUDUpdate(data, _subtitle){
    if (!data) return;
    if (data.goal) last.goal = data.goal;
    if (data.mini) last.mini = data.mini;
    renderGoal(last.goal);
    renderMini(last.mini);
  }
  function questHUDDispose(){
    try{ clearInterval(rotTimer); }catch(_){}
    try{ root.remove(); }catch(_){}
    try{ css.remove(); }catch(_){}
  }

  // expose (optional import usage)
  try{ window.questHUDInit = questHUDInit; window.questHUDUpdate = questHUDUpdate; window.questHUDDispose = questHUDDispose; }catch(_){}

  // ---------- Auto-init + Event wiring ----------
  questHUDInit();

  // Accept both events:
  window.addEventListener('hha:quest', (e)=> questHUDUpdate(e.detail||{}));
  window.addEventListener('quest:update', (e)=> questHUDUpdate(e.detail||{}));

  // Manual focus switch (optional): window.dispatchEvent(new CustomEvent('quest:focus',{detail:'mini'}))
  window.addEventListener('quest:focus', (e)=> applyFocus(e?.detail==='mini'?'mini':'goal'));
})();
