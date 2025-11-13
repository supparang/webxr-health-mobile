// === /HeroHealth/vr/quest-hud.js (HUD GOAL + MINI) ===
(function(){
  'use strict';
  const ID = 'hha-quest-hud';
  if (document.getElementById(ID)) return;

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
      <div class="card" id="qMini">
        <div class="title">MINI QUEST</div>
        <div class="label" id="qMiniLabel">—</div>
        <div class="bar"><div class="fill" id="qMiniFill"></div></div>
        <div class="nums"><span id="qMiniNow">0</span>/<span id="qMiniMax">0</span></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const css = document.createElement('style');
  css.id = 'hha-quest-hud-css';
  css.textContent = `
    #${ID}{position:fixed;right:16px;top:88px;z-index:520;pointer-events:none}
    #${ID} .wrap{display:flex;flex-direction:column;gap:10px;max-width:min(48vw,420px)}
    #${ID} .card{
      background:#020617d9;border:1px solid #334155;border-radius:14px;
      padding:12px 14px;color:#e2e8f0;box-shadow:0 12px 30px rgba(0,0,0,.4)
    }
    #${ID} .title{font:900 11px system-ui;letter-spacing:.9px;color:#93c5fd;margin-bottom:4px}
    #${ID} .label{font:800 14px system-ui;margin:2px 0 8px 0}
    #${ID} .bar{
      height:10px;border-radius:999px;background:#020617;border:1px solid #334155;overflow:hidden
    }
    #${ID} .fill{height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#22c55e)}
    #${ID} .nums{margin-top:6px;font:800 12px system-ui;color:#cbd5e1;text-align:right}
    @media (max-width:640px){
      #${ID}{right:10px;top:86px}
      #${ID} .wrap{max-width:85vw}
    }
  `;
  document.head.appendChild(css);

  const elGoalLabel = document.getElementById('qGoalLabel');
  const elGoalFill  = document.getElementById('qGoalFill');
  const elGoalNow   = document.getElementById('qGoalNow');
  const elGoalMax   = document.getElementById('qGoalMax');

  const elMiniLabel = document.getElementById('qMiniLabel');
  const elMiniFill  = document.getElementById('qMiniFill');
  const elMiniNow   = document.getElementById('qMiniNow');
  const elMiniMax   = document.getElementById('qMiniMax');

  const pct = (n,d)=> d>0 ? Math.max(0,Math.min(100,Math.round((n/d)*100))) : 0;

  function renderGoal(g){
    if (!g){ elGoalLabel.textContent='—'; elGoalFill.style.width='0%'; elGoalNow.textContent='0'; elGoalMax.textContent='0'; return; }
    const now = +g.prog|0, max = +g.target|0;
    elGoalLabel.textContent = g.label || '—';
    elGoalFill.style.width  = pct(now,max)+'%';
    elGoalNow.textContent   = now;
    elGoalMax.textContent   = max;
  }
  function renderMini(m){
    if (!m){ elMiniLabel.textContent='—'; elMiniFill.style.width='0%'; elMiniNow.textContent='0'; elMiniMax.textContent='0'; return; }
    const now = +m.prog|0, max = +m.target|0;
    elMiniLabel.textContent = m.label || '—';
    elMiniFill.style.width  = pct(now,max)+'%';
    elMiniNow.textContent   = now;
    elMiniMax.textContent   = max;
  }

  let lastGoal=null, lastMini=null;
  function update(data){
    if (!data) return;
    if (data.goal) lastGoal = data.goal;
    if (data.mini) lastMini = data.mini;
    renderGoal(lastGoal);
    renderMini(lastMini);
  }

  window.addEventListener('hha:quest',(e)=>update(e.detail||{}));
  window.addEventListener('quest:update',(e)=>update(e.detail||{}));
})();
