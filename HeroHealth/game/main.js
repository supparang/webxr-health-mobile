// === /HeroHealth/game/main.js (2025-11-12, overlay single + quest badge coloring) ===
import { HUD } from '../core/hud.js';
import { Engine } from '../core/engine.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import GameHub from '../vr/hub.js';

let hud=null, engine=null, hub=null;

function on(el,ev,fn,opts){ if(el&&el.addEventListener) el.addEventListener(ev,fn,opts||false); }
function qs(s){ return document.querySelector(s); }
function qsa(s){ return document.querySelectorAll(s); }

function unlockAudioOnce(){ try{ if(window.__HHA_SFX?.ctx?.state==='suspended') window.__HHA_SFX.ctx.resume(); }catch(_){} }

function announceHudReady(){
  try{ window.dispatchEvent(new CustomEvent('hha:hud-ready',{detail:{anchorId:'hudTop',scoreBox:true}})); }catch(_){}
}

function bootApp(){
  // HUD
  try{ hud=new HUD(); (qs('.game-wrap')||document.body) && hud.mount(qs('.game-wrap')||document.body); }catch(e){ console.log('[main] HUD error',e); }

  // Fever UI
  try{ ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); }catch(_){}

  // Engine
  try{
    engine=new Engine(); engine.start&&engine.start();
    on(window,'hha:pause',()=>engine.pause()); on(window,'hha:resume',()=>engine.resume());
    on(document,'visibilitychange',()=>{ if(!engine) return; document.hidden?engine.pause():engine.resume(); });
  }catch(e){ console.log('[main] Engine error',e); }

  // HUD sync
  on(window,'hha:time',(e)=>{ const sec=(e?.detail?.sec)||0; hud&&hud.setTimer && hud.setTimer(sec); });
  on(window,'hha:score',(e)=>{ const d=e?.detail||{}; if(hud){ if(d.score!=null) hud.setScore(d.score); if(d.combo!=null) hud.setCombo(d.combo);} });
  on(window,'hha:fever',(e)=>{ const onF=!!(e?.detail?.active); try{ setFeverActive(onF); }catch(_){}});

  // HUD ready (หลายรอบป้องกันสร้างช้า)
  announceHudReady(); let tries=0, id=setInterval(()=>{ announceHudReady(); if(++tries>15) clearInterval(id); },150);

  on(window,'pointerdown',unlockAudioOnce,{once:true});

  // Hub
  try{ hub=new GameHub(); }catch(e){ console.warn('[main] Hub load fail',e); }

  // UI buttons
  const btnStart=qs('#btnStart')||qs('[data-action="start"]');
  if(btnStart) on(btnStart,'click',(ev)=>{ try{ev.preventDefault();}catch(_){}; hub&&hub.startGame&&hub.startGame(); });
  const modeBtns=qsa('[data-mode]'); for(let i=0;i<modeBtns.length;i++){ const b=modeBtns[i]; on(b,'click',(ev)=>{ try{ev.preventDefault();}catch(_){}; const m=b.getAttribute('data-mode')||'goodjunk'; hub&&hub.selectMode&&hub.selectMode(m); }); }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootApp); else bootApp();
window.__HHA_BOOT_OK='main.js';

// === Result Modal Overlay (single version with QUESTS x/y colored) ===
(function(){
  let overlay=null, listBox=null, scoreEl=null, comboEl=null, goalEl=null, titleEl=null;
  let missEl=null, timeBadge=null, questBadge=null;
  let btnAgain=null, btnMenu=null, btnClose=null;
  let _hubRef=null; try{ if(typeof hub!=='undefined') _hubRef=hub; }catch(_){}

  function injectStyles(){
    if(document.getElementById('hha-result-style')) return;
    const st=document.createElement('style'); st.id='hha-result-style';
    st.textContent = `
      .hha-result-overlay{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
      .hha-result-card{width:min(840px,92vw);max-height:86vh;overflow:auto;background:#0b1220cc;backdrop-filter:blur(8px);border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,.45);border-radius:18px;padding:20px;color:#e2e8f0;font:600 14px system-ui,Segoe UI,Inter,sans-serif;}
      .hha-result-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
      .hha-result-title{font-weight:900;font-size:20px;letter-spacing:.3px;}
      .hha-head-badges{display:flex;gap:8px;align-items:center;}
      .hha-badge{background:#334155;color:#cbd5e1;padding:4px 8px;border-radius:999px;font-weight:800;border:1px solid #475569;}
      .hha-result-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 6px;}
      .hha-kpi{background:#0f172acc;border:1px solid #334155;border-radius:12px;padding:12px;}
      .hha-kpi b{display:block;font-size:12px;color:#93c5fd;font-weight:800;margin-bottom:6px;}
      .hha-kpi .v{font-size:22px;font-weight:900;color:#f8fafc;}
      .hha-goal-ok{color:#22c55e;} .hha-goal-ng{color:#ef4444;}
      .hha-quest-wrap{margin-top:12px;border-top:1px dashed #334155;padding-top:12px;}
      .hha-quest-wrap h3{margin:0 0 8px 0;font-weight:900;font-size:16px;color:#93c5fd;}
      .hha-quest-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .hha-quest{display:flex;align-items:center;gap:10px;background:#0f172acc;border:1px solid #263244;border-radius:12px;padding:10px;}
      .hha-quest .check{width:22px;height:22px;flex:0 0 22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;}
      .hha-quest.done .check{background:#16a34a;color:#fff;border:1px solid #15803d;}
      .hha-quest.fail .check{background:#334155;color:#94a3b8;border:1px solid #475569;}
      .hha-quest .txt{flex:1 1 auto;}
      .hha-quest .meta{color:#94a3b8;font-weight:700;font-size:12px;}
      .hha-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;}
      .hha-btn{appearance:none;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;}
      .hha-btn:hover{border-color:#94a3b8;}
      .hha-btn.primary{background:#2563eb;border-color:#1d4ed8;color:white;}
      @media (max-width:640px){ .hha-result-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .hha-quest-list{grid-template-columns:1fr;} }
    `;
    document.head.appendChild(st);
  }

  function ensureOverlay(){
    if(overlay) return;
    injectStyles();
    overlay=document.createElement('div'); overlay.className='hha-result-overlay'; overlay.id='hhaResultOverlay';
    const card=document.createElement('div'); card.className='hha-result-card';

    const head=document.createElement('div'); head.className='hha-result-head';
    titleEl=document.createElement('div'); titleEl.className='hha-result-title'; titleEl.textContent='สรุปผลการเล่น';
    const badges=document.createElement('div'); badges.className='hha-head-badges';
    timeBadge=document.createElement('div'); timeBadge.className='hha-badge'; timeBadge.id='hhaResTimeBadge'; timeBadge.textContent='TIME 0s';
    questBadge=document.createElement('div'); questBadge.className='hha-badge'; questBadge.id='hhaResQuestBadge'; questBadge.textContent='QUESTS 0/0';
    badges.appendChild(questBadge); badges.appendChild(timeBadge); head.appendChild(titleEl); head.appendChild(badges);

    const grid=document.createElement('div'); grid.className='hha-result-grid';
    const k1=document.createElement('div'); k1.className='hha-kpi';
    const k2=document.createElement('div'); k2.className='hha-kpi';
    const k3=document.createElement('div'); k3.className='hha-kpi';
    const k4=document.createElement('div'); k4.className='hha-kpi';
    const b1=document.createElement('b'); b1.textContent='คะแนนรวม';
    const b2=document.createElement('b'); b2.textContent='คอมโบสูงสุด';
    const b3=document.createElement('b'); b3.textContent='เป้าหมาย';
    const b4=document.createElement('b'); b4.textContent='พลาด (miss)';
    scoreEl=document.createElement('div'); scoreEl.className='v'; scoreEl.textContent='0';
    comboEl=document.createElement('div'); comboEl.className='v'; comboEl.textContent='0';
    goalEl=document.createElement('div'); goalEl.className='v'; goalEl.innerHTML='<span class="hha-goal-ng">ยังไม่ถึง</span>';
    missEl=document.createElement('div'); missEl.className='v'; missEl.textContent='0';
    k1.appendChild(b1); k1.appendChild(scoreEl); k2.appendChild(b2); k2.appendChild(comboEl);
    k3.appendChild(b3); k3.appendChild(goalEl);  k4.appendChild(b4); k4.appendChild(missEl);
    grid.appendChild(k1); grid.appendChild(k2); grid.appendChild(k3); grid.appendChild(k4);

    const qwrap=document.createElement('div'); qwrap.className='hha-quest-wrap';
    const qh=document.createElement('h3'); qh.textContent='ภารกิจที่สุ่มให้รอบนี้';
    listBox=document.createElement('div'); listBox.className='hha-quest-list';
    qwrap.appendChild(qh); qwrap.appendChild(listBox);

    const actions=document.createElement('div'); actions.className='hha-actions';
    btnAgain=document.createElement('button'); btnAgain.className='hha-btn primary'; btnAgain.textContent='เล่นอีกครั้ง';
    btnMenu=document.createElement('button'); btnMenu.className='hha-btn'; btnMenu.textContent='กลับเมนู';
    btnClose=document.createElement('button'); btnClose.className='hha-btn'; btnClose.textContent='ปิด';
    actions.appendChild(btnAgain); actions.appendChild(btnMenu); actions.appendChild(btnClose);

    card.appendChild(head); card.appendChild(grid); card.appendChild(qwrap); card.appendChild(actions);
    overlay.appendChild(card); (document.querySelector('.game-wrap')||document.body).appendChild(overlay);

    btnAgain.addEventListener('click',(e)=>{ try{e.preventDefault();}catch(_){} hide(); try{_hubRef&&_hubRef.startGame&&_hubRef.startGame();}catch(_){}} );
    btnMenu.addEventListener('click',(e)=>{ try{e.preventDefault();}catch(_){} hide(); });
    btnClose.addEventListener('click',(e)=>{ try{e.preventDefault();}catch(_){} hide(); });
    overlay.addEventListener('click',(e)=>{ if(e.target===overlay) hide(); });
  }

  function fmt(n){ n=Number(n)||0; return n.toLocaleString(); }
  function clearChildren(el){ while(el&&el.firstChild) el.removeChild(el.firstChild); }
  function buildQuestItem(q){
    const row=document.createElement('div'); row.className='hha-quest '+(q.done?'done':'fail');
    const ck=document.createElement('div'); ck.className='check'; ck.textContent=q.done?'✓':'•';
    const txt=document.createElement('div'); txt.className='txt'; txt.textContent=String(q.label||'');
    const meta=document.createElement('div'); meta.className='meta';
    const lv=q.level?('['+q.level+'] '):''; meta.textContent = (q.target>0)? (lv+'('+fmt(q.prog)+'/'+fmt(q.target)+')'):lv;
    row.appendChild(ck); row.appendChild(txt); row.appendChild(meta); return row;
  }
  function computeQuestCounts(detail){
    const arr=(detail&&detail.questsSummary&&detail.questsSummary.slice)?detail.questsSummary.slice():null;
    if(arr){ const y=arr.length, x=arr.filter(q=>q&&q.done).length; return {x,y}; }
    if(detail&&detail.questsCleared!=null&&detail.questsTotal!=null){ return {x:Number(detail.questsCleared)||0, y:Number(detail.questsTotal)||0}; }
    return {x:0,y:0};
  }
  function paintQuestBadge(badge,x,y){
    const r=(y>0)?(x/y):0;
    badge.style.borderColor = (r>=1)?'#16a34a':(r>=0.5?'#f59e0b':'#ef4444');
    badge.style.background  = (r>=1)?'#16a34a22':(r>=0.5?'#f59e0b22':'#ef444422');
    badge.style.color       = (r>=1)?'#bbf7d0':(r>=0.5?'#fde68a':'#fecaca');
  }

  function show(detail){
    ensureOverlay();
    titleEl.textContent = 'สรุปผล: ' + (detail.mode||'Result') + (detail.difficulty?(' ('+detail.difficulty+')'):'');
    scoreEl.textContent = fmt(detail.score);
    comboEl.textContent = fmt(detail.comboMax!=null?detail.comboMax:detail.combo);
    missEl.textContent  = fmt(detail.misses);
    timeBadge.textContent = 'TIME ' + fmt(detail.duration) + 's';
    goalEl.innerHTML = detail.goalCleared ? '<span class="hha-goal-ok">ถึงเป้า'+(detail.goalTarget!=null?(' ('+fmt(detail.goalTarget)+')'):'')+'</span>' :
                                            '<span class="hha-goal-ng">ยังไม่ถึง'+(detail.goalTarget!=null?(' ('+fmt(detail.goalTarget)+')'):'')+'</span>';

    const c=computeQuestCounts(detail);
    questBadge.textContent='QUESTS '+fmt(c.x)+'/'+fmt(c.y);
    paintQuestBadge(questBadge,c.x,c.y);

    clearChildren(listBox);
    const arr=(detail&&detail.questsSummary&&detail.questsSummary.slice)?detail.questsSummary.slice(0,12):[];
    if(arr.length){ arr.forEach(q=>listBox.appendChild(buildQuestItem(q))); }
    else{
      const empty=buildQuestItem({label:'ไม่มีข้อมูลเควสต์จากรอบนี้',level:'',done:false,prog:0,target:0});
      listBox.appendChild(empty);
    }
    overlay.style.display='flex';
  }
  function hide(){ if(overlay) overlay.style.display='none'; }

  window.addEventListener('hha:end',(e)=>{ try{ show(e?.detail||{}); }catch(_){}} );
})();
