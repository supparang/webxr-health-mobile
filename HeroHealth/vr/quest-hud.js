// === /HeroHealth/vr/quest-hud.js (2025-11-13 LATEST, auto-mount, toast, rotate) ===
(function(){
  'use strict';
  const ID = 'hha-quest-hud';
  if (document.getElementById(ID)) return;

  // Root
  const root = document.createElement('div');
  root.id = ID;
  root.innerHTML = `
    <div class="wrap">
      <div class="card" id="qGoal">
        <div class="title">GOAL</div>
        <div class="label" id="qGoalLabel">—</div>
        <div class="bar"><div class="fill" id="qGoalFill"></div></div>
        <div class="nums"><span id="qGoalNow">0</span>/<span id="qGoalMax">0</span></div>
      </div>
      <div class="card" id="qMini" hidden>
        <div class="title">MINI QUEST</div>
        <div class="label" id="qMiniLabel">—</div>
        <div class="bar"><div class="fill" id="qMiniFill"></div></div>
        <div class="nums"><span id="qMiniNow">0</span>/<span id="qMiniMax">0</span></div>
      </div>
    </div>
    <div id="hha-toast" class="toast" hidden></div>
  `;
  document.body.appendChild(root);

  // CSS
  const css = document.createElement('style');
  css.id = 'hha-quest-hud-css';
  css.textContent = `
  #${ID}{position:fixed;right:16px;top:88px;z-index:560;pointer-events:none}
  #${ID} .wrap{display:flex;flex-direction:column;gap:10px;max-width:min(48vw,420px)}
  #${ID} .card{background:#0b1220cc;border:1px solid #334155;border-radius:14px;padding:12px 14px;color:#e2e8f0;box-shadow:0 12px 30px rgba(0,0,0,.35)}
  #${ID} .title{font:900 11px system-ui;letter-spacing:.8px;color:#93c5fd;opacity:.9;margin-bottom:4px}
  #${ID} .label{font:800 14px system-ui;color:#f8fafc;margin:2px 0 8px 0}
  #${ID} .bar{height:10px;border-radius:999px;background:#0f172a;border:1px solid #334155;overflow:hidden}
  #${ID} .fill{height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#22c55e)}
  #${ID} .nums{margin-top:6px;font:800 12px system-ui;color:#cbd5e1;text-align:right}
  #${ID} .toast{position:fixed;right:18px;top:58px;background:#111827e6;color:#e5e7eb;border:1px solid #374151;border-radius:12px;padding:8px 12px;font:800 12px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  @media (max-width:640px){ #${ID}{right:10px;top:86px} #${ID} .wrap{max-width:85vw} }
  `;
  document.head.appendChild(css);

  // Refs
  const elGoalCard = root.querySelector('#qGoal');
  const elMiniCard = root.querySelector('#qMini');
  const elGoalLabel = root.querySelector('#qGoalLabel');
  const elGoalFill  = root.querySelector('#qGoalFill');
  const elGoalNow   = root.querySelector('#qGoalNow');
  const elGoalMax   = root.querySelector('#qGoalMax');
  const elMiniLabel = root.querySelector('#qMiniLabel');
  const elMiniFill  = root.querySelector('#qMiniFill');
  const elMiniNow   = root.querySelector('#qMiniNow');
  const elMiniMax   = root.querySelector('#qMiniMax');
  const elToast     = root.querySelector('#hha-toast');

  let last = { goal:null, mini:null };
  let focus = 'goal';
  let rotTimer = null;

  const pct = (n, d)=> d>0 ? Math.max(0, Math.min(100, Math.round((n/d)*100))) : 0;

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
    focus = which==='mini' ? 'mini' : 'goal';
    elGoalCard.hidden = (focus!=='goal');
    elMiniCard.hidden = (focus!=='mini');
  }
  function rotate(){ applyFocus(focus==='goal' ? 'mini' : 'goal'); }
  function scheduleRotate(){ try{clearInterval(rotTimer);}catch{} rotTimer = setInterval(rotate, 6000); }

  function questHUDInit(){ applyFocus('goal'); scheduleRotate(); }
  function questHUDUpdate(data){
    if (!data) return;
    if (data.goal) last.goal = data.goal;
    if (data.mini) last.mini = data.mini;
    renderGoal(last.goal);
    renderMini(last.mini);
  }
  function questHUDDispose(){ try{clearInterval(rotTimer);}catch{} try{root.remove();}catch{} try{css.remove();}catch{} }

  // Expose (optional)
  try{ window.questHUDInit=questHUDInit; window.questHUDUpdate=questHUDUpdate; window.questHUDDispose=questHUDDispose; }catch{}

  // Auto-init & Wire events
  questHUDInit();
  window.addEventListener('hha:quest', (e)=>questHUDUpdate(e.detail||{}));
  window.addEventListener('quest:update', (e)=>questHUDUpdate(e.detail||{}));

  // Toast API
  let toastTimer=null;
  function showToast(msg){
    if(!elToast) return;
    elToast.textContent = String(msg||'');
    elToast.hidden = false;
    try{ clearTimeout(toastTimer);}catch{}
    toastTimer = setTimeout(()=>{ elToast.hidden = true; }, 1600);
  }
  window.addEventListener('hha:toast', (e)=> showToast(e?.detail||''));
})();
