// === /HeroHealth/game/main.js (2025-11-12) ===
import { HUD } from '../core/hud.js';
import { Engine } from '../core/engine.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import GameHub from '../vr/hub.js';

let hud = null;
let engine = null;
let hub = null;

// ---------- helpers ----------
function on(el, ev, fn, opts){ if(el && el.addEventListener) el.addEventListener(ev, fn, opts||false); }
function qs(s){ return document.querySelector(s); }
function qsa(s){ return document.querySelectorAll(s); }
function param(name, dft){
  const q = new URLSearchParams(location.search);
  return q.get(name) ?? dft;
}

// ---------- audio unlock ----------
function unlockAudioOnce(){
  try{
    if(window.__HHA_SFX && window.__HHA_SFX.ctx && window.__HHA_SFX.ctx.state==='suspended'){
      window.__HHA_SFX.ctx.resume();
    }
  }catch(_){}
}

// ---------- HUD-ready announce ----------
function announceHudReady(){
  try{
    window.dispatchEvent(new CustomEvent('hha:hud-ready',{detail:{anchorId:'hudTop',scoreBox:true}}));
    return true;
  }catch(_){}
  return false;
}

// ---------- boot ----------
function bootApp(){
  // HUD
  try{
    hud = new HUD();
    const wrap = qs('.game-wrap') || document.body;
    hud.mount(wrap);
  }catch(e){ console.warn('[main] HUD error', e); }

  // Fever UI base
  try{ ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); }catch(_){}

  // Engine
  try{
    engine = new Engine();
    engine.start && engine.start();
    on(window,'hha:pause',()=>engine.pause && engine.pause());
    on(window,'hha:resume',()=>engine.resume && engine.resume());
    on(document,'visibilitychange',()=>{
      if(!engine) return;
      if(document.hidden) engine.pause && engine.pause();
      else engine.resume && engine.resume();
    });
  }catch(e){ console.warn('[main] Engine error', e); }

  // HUD sync
  on(window,'hha:time',(e)=>{ const sec = (e && e.detail && e.detail.sec)|0; hud && hud.setTimer && hud.setTimer(sec); });
  on(window,'hha:score',(e)=>{
    const d=e && e.detail || {};
    if(hud){
      if(d.score!=null) hud.setScore(d.score);
      if(d.combo!=null) hud.setCombo(d.combo);
    }
  });
  on(window,'hha:fever',(e)=>{ const onF = !!(e && e.detail && e.detail.active); try{ setFeverActive(onF); }catch(_){}});

  // HUD announce (หลายรอบกันพลาด)
  announceHudReady();
  let tries=0, id=setInterval(()=>{ if(announceHudReady()) { clearInterval(id); } if(++tries>20) clearInterval(id); },150);

  // unlock audio (ครั้งเดียว)
  on(window,'pointerdown',unlockAudioOnce,{once:true});

  // GameHub
  try{
    hub = new GameHub();
    console.log('[main] Hub ready');
  }catch(e){ console.warn('[main] Hub load fail', e); }

  // ปุ่มเริ่มเกม (DOM)
  const btnStart = qs('#btnStart') || qs('[data-action="start"]');
  if(btnStart){
    on(btnStart,'click',(ev)=>{
      try{ ev.preventDefault(); }catch(_){}
      if(hub && hub.startGame) hub.startGame();
    });
  }

  // ปุ่มเลือกโหมด (VR เมนู)
  const modeBtns = qsa('[data-mode]');
  for(let i=0;i<modeBtns.length;i++){
    const btn = modeBtns[i];
    on(btn,'click',(ev)=>{
      try{ ev.preventDefault(); }catch(_){}
      const m = btn.getAttribute('data-mode') || 'goodjunk';
      hub && hub.selectMode && hub.selectMode(m);
    });
  }

  // autostart จากพารามิเตอร์ (ถ้ามี)
  const autoStart = (param('autostart','1') !== '0'); // default auto
  if(autoStart && hub && hub.startGame){
    // รอให้ A-Frame เสถียรนิดนึง
    setTimeout(()=>{ try{ hub.startGame(); }catch(e){ console.warn('[main] autostart fail', e); } }, 150);
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootApp);
else bootApp();

window.__HHA_BOOT_OK='main.js';

// ---------- Result Modal Overlay (คะแนน + ภารกิจ + Quest badge) ----------
(function(){
  let overlay=null, listBox=null, scoreEl=null, comboEl=null, goalEl=null, titleEl=null;
  let btnAgain=null, btnMenu=null, btnClose=null;
  let _hubRef=null;
  try{ if(typeof window!=='undefined' && window.hub) _hubRef = window.hub; }catch(_){}

  function injectStyles(){
    if(document.getElementById('hha-result-style')) return;
    const st=document.createElement('style'); st.id='hha-result-style';
    st.textContent=[
      '.hha-result-overlay{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}',
      '.hha-result-card{width:min(840px,92vw);max-height:86vh;overflow:auto;background:#0b1220cc;backdrop-filter:blur(8px);border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,.45);border-radius:18px;padding:20px;color:#e2e8f0;font:600 14px system-ui,Segoe UI,Inter,sans-serif}',
      '.hha-result-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}',
      '.hha-result-title{font-weight:900;font-size:20px;letter-spacing:.3px}',
      '.hha-head-badges{display:flex;gap:8px;align-items:center}',
      '.hha-badge{background:#334155;color:#cbd5e1;padding:4px 8px;border-radius:999px;font-weight:800;border:1px solid #475569}',
      '.hha-badge-quest{background:#1e293b;color:#a5b4fc;border-color:#4f46e5}',
      '.hha-result-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 6px}',
      '.hha-kpi{background:#0f172acc;border:1px solid #334155;border-radius:12px;padding:12px}',
      '.hha-kpi b{display:block;font-size:12px;color:#93c5fd;font-weight:800;margin-bottom:6px}',
      '.hha-kpi .v{font-size:22px;font-weight:900;color:#f8fafc}',
      '.hha-goal-ok{color:#22c55e}.hha-goal-ng{color:#ef4444}',
      '.hha-quest-wrap{margin-top:12px;border-top:1px dashed #334155;padding-top:12px}',
      '.hha-quest-wrap h3{margin:0 0 8px 0;font-weight:900;font-size:16px;color:#93c5fd}',
      '.hha-quest-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
      '.hha-quest{display:flex;align-items:center;gap:10px;background:#0f172acc;border:1px solid #263244;border-radius:12px;padding:10px}',
      '.hha-quest .check{width:22px;height:22px;flex:0 0 22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900}',
      '.hha-quest.done .check{background:#16a34a;color:#fff;border:1px solid #15803d}',
      '.hha-quest.fail .check{background:#334155;color:#94a3b8;border:1px solid #475569}',
      '.hha-quest .txt{flex:1 1 auto}',
      '.hha-quest .meta{color:#94a3b8;font-weight:700;font-size:12px}',
      '.hha-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}',
      '.hha-btn{appearance:none;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}',
      '.hha-btn:hover{border-color:#94a3b8}.hha-btn.primary{background:#2563eb;border-color:#1d4ed8;color:#fff}',
      '@media (max-width:640px){ .hha-result-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .hha-quest-list{grid-template-columns:1fr;} }'
    ].join('');
    document.head.appendChild(st);
  }

  function ensureOverlay(){
    if(overlay) return;
    injectStyles();

    overlay = document.createElement('div'); overlay.className='hha-result-overlay'; overlay.id='hhaResultOverlay';
    const card = document.createElement('div'); card.className='hha-result-card';

    // head
    const head=document.createElement('div'); head.className='hha-result-head';
    titleEl=document.createElement('div'); titleEl.className='hha-result-title'; titleEl.textContent='สรุปผลการเล่น';

    const badges=document.createElement('div'); badges.className='hha-head-badges';
    const badgeQuests=document.createElement('div'); badgeQuests.className='hha-badge hha-badge-quest'; badgeQuests.id='hhaResQuestBadge'; badgeQuests.textContent='QUESTS 0/0';
    const badgeTime=document.createElement('div'); badgeTime.className='hha-badge'; badgeTime.id='hhaResTimeBadge'; badgeTime.textContent='TIME 0s';
    badges.appendChild(badgeQuests); badges.appendChild(badgeTime);

    head.appendChild(titleEl); head.appendChild(badges);

    // grid KPIs
    const grid=document.createElement('div'); grid.className='hha-result-grid';
    const mkKPI=(name)=>{
      const box=document.createElement('div'); box.className='hha-kpi';
      const b=document.createElement('b'); b.textContent=name;
      const v=document.createElement('div'); v.className='v'; v.textContent='0';
      box.appendChild(b); box.appendChild(v); return {box, v};
    };
    const g1=mkKPI('คะแนนรวม'); scoreEl=g1.v;
    const g2=mkKPI('คอมโบสูงสุด'); comboEl=g2.v;
    const g3=mkKPI('เป้าหมาย');     goalEl =g3.v;
    const g4=mkKPI('พลาด (miss)');  const missEl=g4.v;
    grid.appendChild(g1.box); grid.appendChild(g2.box); grid.appendChild(g3.box); grid.appendChild(g4.box);

    // quests
    const qwrap=document.createElement('div'); qwrap.className='hha-quest-wrap';
    const qh=document.createElement('h3'); qh.textContent='ภารกิจที่สุ่มให้รอบนี้';
    listBox=document.createElement('div'); listBox.className='hha-quest-list';
    qwrap.appendChild(qh); qwrap.appendChild(listBox);

    // actions
    const actions=document.createElement('div'); actions.className='hha-actions';
    btnAgain=document.createElement('button'); btnAgain.className='hha-btn primary'; btnAgain.textContent='เล่นอีกครั้ง';
    btnMenu =document.createElement('button'); btnMenu.className='hha-btn'; btnMenu.textContent='กลับเมนู';
    btnClose=document.createElement('button'); btnClose.className='hha-btn'; btnClose.textContent='ปิด';
    actions.appendChild(btnAgain); actions.appendChild(btnMenu); actions.appendChild(btnClose);

    card.appendChild(head); card.appendChild(grid); card.appendChild(qwrap); card.appendChild(actions);
    overlay.appendChild(card);
    (document.querySelector('.game-wrap')||document.body).appendChild(overlay);

    btnAgain.addEventListener('click',(e)=>{ try{e.preventDefault();}catch(_){} hide(); try{ hub && hub.startGame && hub.startGame(); }catch(_){ } });
    btnMenu.addEventListener('click',(e)=>{ try{e.preventDefault();}catch(_){} hide(); });
    btnClose.addEventListener('click',(e)=>{ try{e.preventDefault();}catch(_){} hide(); });
    overlay.addEventListener('click',(e)=>{ if(e.target===overlay) hide(); });

    overlay._missEl = missEl;
    overlay._timeBadge = badgeTime;
    overlay._questBadge = badgeQuests;
  }

  function fmt(n){ n = Number(n)||0; return n.toLocaleString(); }
  function clearChildren(el){ try{ while(el && el.firstChild) el.removeChild(el.firstChild); }catch(_){ } }
  function buildQuestItem(label, level, done, prog, target){
    const row=document.createElement('div'); row.className='hha-quest '+(done?'done':'fail');
    const ck=document.createElement('div'); ck.className='check'; ck.textContent=done?'✓':'•';
    const txt=document.createElement('div'); txt.className='txt'; txt.textContent=label||'';
    const meta=document.createElement('div'); meta.className='meta';
    const lv = level ? ('['+level+'] ') : '';
    meta.textContent = target>0 ? (lv+'('+fmt(prog)+'/'+fmt(target)+')') : lv;
    row.appendChild(ck); row.appendChild(txt); row.appendChild(meta);
    return row;
  }
  function computeQuestCounts(detail){
    if(detail && typeof detail.questsCleared==='number' && typeof detail.questsTotal==='number'){
      return {x:Number(detail.questsCleared)||0, y:Math.max(0, Number(detail.questsTotal)||0)};
    }
    const arr = (detail && detail.questsSummary && detail.questsSummary.slice) ? detail.questsSummary.slice() : [];
    let x=0; for(let i=0;i<arr.length;i++){ if(arr[i] && arr[i].done) x++; }
    return {x:x, y:arr.length};
  }

  function show(detail){
    ensureOverlay();

    // title
    const modeName = (detail && detail.mode) ? String(detail.mode) : 'Result';
    const diff     = (detail && detail.difficulty) ? String(detail.difficulty) : '';
    titleEl.textContent = 'สรุปผล: '+modeName+(diff?(' ('+diff+')'):'');
    // KPIs
    scoreEl.textContent = fmt(detail && detail.score);
    comboEl.textContent = fmt((detail && (detail.comboMax!=null?detail.comboMax:detail.combo))||0);
    overlay._missEl.textContent = fmt(detail && detail.misses);
    const ok = !!(detail && detail.goalCleared);
    const tgt = (detail && detail.goalTarget!=null)?Number(detail.goalTarget):null;
    goalEl.innerHTML = ok ? '<span class="hha-goal-ok">ถึงเป้า'+(tgt!=null?(' ('+fmt(tgt)+')'):'')+'</span>'
                          : '<span class="hha-goal-ng">ยังไม่ถึง'+(tgt!=null?(' ('+fmt(tgt)+')'):'')+'</span>';
    overlay._timeBadge.textContent = 'TIME '+fmt(detail && detail.duration)+'s';

    // quest badge
    const qc = computeQuestCounts(detail);
    overlay._questBadge.textContent = 'QUESTS '+fmt(qc.x)+'/'+fmt(qc.y);
    // รายการ
    clearChildren(listBox);
    const arr = (detail && detail.questsSummary && detail.questsSummary.slice) ? detail.questsSummary.slice(0,12) : [];
    if(arr.length){
      for(let i=0;i<arr.length;i++){
        const q = arr[i]||{};
        listBox.appendChild(buildQuestItem(String(q.label||''), String(q.level||''), !!q.done, Number(q.prog)||0, Number(q.target)||0));
      }
    }else{
      listBox.appendChild(buildQuestItem('ไม่มีข้อมูลเควสต์จากรอบนี้','',false,0,0));
    }
    overlay.style.display='flex';
  }
  function hide(){ if(overlay) overlay.style.display='none'; }

  window.addEventListener('hha:end',(e)=>{ try{ show(e && e.detail ? e.detail : {}); }catch(_){ } });
})();
