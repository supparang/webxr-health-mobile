// === /HeroHealth/game/main.js (fix: wire hha:quest -> questHUDUpdate) ===
'use strict';

import { ensureFeverBar } from '../vr/ui-fever.js';
import { questHUDInit, questHUDDispose, questHUDUpdate } from '../vr/quest-hud.js';

(function(){
  const $  = s => document.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const modeParam = (qs.get('mode')||'goodjunk').toLowerCase();
  const diffParam = (qs.get('diff')||'normal').toLowerCase();
  const duration  = Number(qs.get('time')||60)|0;
  const autoStart = !!qs.get('autostart');

  const MODE_FILE = {
    goodjunk : 'goodjunk.safe.js',
    groups   : 'groups.safe.js',
    hydration: 'hydration.quest.js',
    plate    : 'plate.safe.js'
  };

  let score=0, combo=0, comboMax=0;
  const hudScore = $('#hudScore');
  const hudCombo = $('#hudCombo');
  const feverDock = $('#feverBarDock');

  function setScore(n){ score=n|0; if(hudScore) hudScore.textContent = score.toLocaleString(); }
  function setCombo(n){ combo=n|0; comboMax=Math.max(comboMax,combo); if(hudCombo) hudCombo.textContent = combo; }

  ensureFeverBar(feverDock);
  questHUDInit(); // ให้ HUD โผล่มาตั้งแต่ต้น

  // ⬅️ ผูกอีเวนต์จากแต่ละโหมดมาอัปเดต HUD เป้าหมาย/เควสต์
  window.addEventListener('hha:quest', (e)=>{
    try{ questHUDUpdate(e.detail||{}, e.detail?.caption||''); }catch{}
  }, { passive:true });

  window.addEventListener('hha:score', e=>{
    const d = e?.detail?.delta|0;
    if (d>=0) setCombo(combo+1); else setCombo(0);
    setScore(Math.max(0, score + d));
  }, { passive:true });

  let lastSec = duration;
  window.addEventListener('hha:time', e=>{ lastSec = e?.detail?.sec|0; }, { passive:true });

  let controller = null;
  let ended = false;

  async function loadMode(modName){
    const file = MODE_FILE[modName];
    if(!file) throw new Error(`ไม่รู้จักโหมด: ${modName}`);
    const url = new URL(`../modes/${file}`, import.meta.url).href;
    return import(url);
  }

  async function startGame(){
    try{
      ended=false; setScore(0); setCombo(0);

      const mod = await loadMode(modeParam);
      const { boot } = mod;
      controller = await boot({ difficulty: diffParam, duration });
      controller?.start?.();
    }catch(err){
      alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่ได้\n${err.message||err}`);
      console.error(err);
    }
  }

  function stopGame(){ try{ controller?.stop?.(); }catch{} }

  function showResult(detail){
    $('#resultOverlay')?.remove();
    const o = document.createElement('div');
    o.id = 'resultOverlay';
    o.innerHTML = `
      <style>
        #resultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:900;display:flex;align-items:center;justify-content:center}
        #resultOverlay .card{min-width:720px;max-width:92vw;background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:16px;padding:20px 22px;box-shadow:0 20px 60px #000a}
        #resultOverlay h2{margin:0 0 14px 0;font:800 22px/1.2 system-ui}
        #resultOverlay .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
        #resultOverlay .box{background:#0f172a;border:1px solid #263244;border-radius:12px;padding:10px 12px;text-align:center}
        #resultOverlay .k{opacity:.7;font-weight:600;margin-bottom:4px}
        #resultOverlay .v{font:800 22px/1.2 system-ui}
        #resultOverlay .btns{margin-top:16px;display:flex;justify-content:flex-end;gap:10px}
        #resultOverlay button{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}
        #btnRetry{background:#22c55e;color:#052e16}
        #btnHub{background:#2563eb;color:#fff}
      </style>
      <div class="card">
        <h2>สรุปผล: ${detail.mode||'—'} (${detail.difficulty||'-'})</h2>
        <div class="grid">
          <div class="box"><div class="k">คะแนนรวม</div><div class="v">${(detail.score|0).toLocaleString()}</div></div>
          <div class="box"><div class="k">คอมโบสูงสุด</div><div class="v">${detail.comboMax|0}</div></div>
          <div class="box"><div class="k">พลาด</div><div class="v">${detail.misses|0}</div></div>
          <div class="box"><div class="k">เวลา</div><div class="v">${detail.duration|0}s</div></div>
          <div class="box"><div class="k">Mini Quests</div><div class="v">${detail.questsCleared|0}/${detail.questsTotal|0}</div></div>
        </div>
        <div class="btns">
          <button id="btnHub">กลับ Hub</button>
          <button id="btnRetry">เล่นอีกครั้ง</button>
        </div>
      </div>`;
    document.body.appendChild(o);
    document.getElementById('btnRetry')?.addEventListener('click', ()=>location.reload());
    document.getElementById('btnHub')?.addEventListener('click', ()=>{
      const q = new URLSearchParams({ mode: modeParam, diff: diffParam }).toString();
      location.href = `../hub.html?${q}`;
    });
  }

  window.addEventListener('hha:end', (e)=>{
    if (ended) return; ended=true;
    try{ stopGame(); }catch{}
    questHUDDispose();
    const d = e.detail||{};
    showResult({
      mode:d.mode||modeParam, difficulty:d.difficulty||diffParam,
      score:d.score|0, comboMax:d.comboMax|0, misses:d.misses|0,
      duration, questsCleared:d.questsCleared|0, questsTotal:d.questsTotal|0
    });
  });

  const btn = $('#btnStart');
  btn?.addEventListener('click', (ev)=>{ ev.preventDefault(); startGame(); });
  if (autoStart) startGame();
})();
