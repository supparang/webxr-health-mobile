// === /herohealth/vr/hha-quest-hud.js ===
// HHA Universal Quest HUD — v1.0.0
// Listens: window 'quest:update'
// Normalizes multiple payload shapes:
// - Plate: { goal:{name,sub,cur,target}, mini:{name,sub,cur,target,done}, allDone }
// - Groups: { groupName, goalTitle, goalNow, goalTotal, goalPct, miniTitle, miniNow, miniTotal, miniPct, miniTimeLeftSec }
// - GoodJunk/Hydration: { goal:{title,desc,cur,target,done}, mini:{title,cur,target,done}, allDone }
// Renders: top HUD panel (left), safe-area friendly, progress bars
// Never blocks play: pointer-events:none

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__HHA_QUEST_HUD_LOADED__) return;
  WIN.__HHA_QUEST_HUD_LOADED__ = true;

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // window.HHA_QUEST_CONFIG = { topPx: 10, maxWidthPx: 560, minEmitGapMs: 90 }
  const CFG = Object.assign({
    topPx: 10,
    maxWidthPx: 560,
    minEmitGapMs: 90
  }, WIN.HHA_QUEST_CONFIG || {});

  const S = {
    lastRenderAt: 0,
    lastNorm: null
  };

  function ensureStyle(){
    if (DOC.getElementById('hha-quest-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-quest-style';
    st.textContent = `
      .hhaQuestWrap{
        position: fixed;
        left: 10px;
        top: calc(${CFG.topPx}px + env(safe-area-inset-top));
        z-index: 99996;
        pointer-events: none;
        display:flex;
        align-items:flex-start;
        justify-content:flex-start;
      }
      .hhaQuestWrap[hidden]{ display:none !important; }
      .hhaQuestCard{
        width: min(${CFG.maxWidthPx}px, 92vw);
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.78);
        box-shadow: 0 14px 46px rgba(0,0,0,.30);
        backdrop-filter: blur(10px);
        overflow: hidden;
        padding: 10px 12px;
        transform: translateY(-6px);
        opacity: 0;
        transition: transform 180ms ease, opacity 170ms ease;
      }
      .hhaQuestCard.show{
        transform: translateY(0);
        opacity: 1;
      }
      .hhaQuestRowTop{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        margin-bottom: 6px;
      }
      .hhaQuestTitle{
        font-weight: 950;
        font-size: 13px;
        color: #e5e7eb;
        line-height: 1.2;
        display:flex;
        align-items:center;
        gap: 8px;
        min-width: 0;
      }
      .hhaQuestPill{
        display:inline-flex;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.16);
        background: rgba(148,163,184,.10);
        font-size: 11px;
        color: rgba(148,163,184,.95);
        white-space: nowrap;
      }
      .hhaQuestSub{
        font-weight: 900;
        font-size: 12px;
        color: rgba(148,163,184,.96);
        margin-bottom: 8px;
        line-height: 1.25;
        word-break: break-word;
      }

      .hhaBars{
        display:flex;
        flex-direction:column;
        gap: 8px;
      }
      .hhaBarLine{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        margin-bottom: 4px;
      }
      .hhaBarLabel{
        font-weight: 950;
        font-size: 12px;
        color: rgba(226,232,240,.95);
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 72%;
      }
      .hhaBarValue{
        font-weight: 950;
        font-size: 12px;
        color: rgba(148,163,184,.96);
        white-space: nowrap;
      }
      .hhaBarTrack{
        width: 100%;
        height: 10px;
        border-radius: 999px;
        background: rgba(148,163,184,.12);
        border: 1px solid rgba(148,163,184,.14);
        overflow:hidden;
      }
      .hhaBarFill{
        height: 100%;
        width: 0%;
        border-radius: 999px;
        background: rgba(34,197,94,.66);
        transition: width 160ms ease;
      }
      .hhaBarFill.mini{ background: rgba(245,158,11,.66); }
      .hhaBarFill.done{ background: rgba(34,197,94,.82); }

      .hhaQuestFooter{
        margin-top: 8px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
      }
      .hhaQuestHint{
        font-weight: 900;
        font-size: 11px;
        color: rgba(148,163,184,.92);
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 70%;
      }
      .hhaQuestState{
        font-weight: 950;
        font-size: 11px;
        color: rgba(148,163,184,.92);
        white-space: nowrap;
      }

      /* view-cvr: keep higher so it won't conflict with ENTER VR */
      body.view-cvr .hhaQuestWrap{
        top: calc(${CFG.topPx + 8}px + env(safe-area-inset-top));
      }
      @media (min-width: 980px){
        .hhaQuestCard{ width: min(${CFG.maxWidthPx}px, 520px); }
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureDom(){
    ensureStyle();
    let wrap = DOC.getElementById('hhaQuestWrap');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.id = 'hhaQuestWrap';
    wrap.className = 'hhaQuestWrap';
    wrap.hidden = true;

    wrap.innerHTML = `
      <div class="hhaQuestCard" id="hhaQuestCard" role="status" aria-live="polite">
        <div class="hhaQuestRowTop">
          <div class="hhaQuestTitle" id="hhaQuestTitle">QUEST</div>
          <div class="hhaQuestPill" id="hhaQuestPill">RUN</div>
        </div>
        <div class="hhaQuestSub" id="hhaQuestSub">…</div>

        <div class="hhaBars">
          <div>
            <div class="hhaBarLine">
              <div class="hhaBarLabel" id="hhaGoalLabel">GOAL</div>
              <div class="hhaBarValue" id="hhaGoalValue">0/0</div>
            </div>
            <div class="hhaBarTrack"><div class="hhaBarFill" id="hhaGoalFill"></div></div>
          </div>

          <div>
            <div class="hhaBarLine">
              <div class="hhaBarLabel" id="hhaMiniLabel">MINI</div>
              <div class="hhaBarValue" id="hhaMiniValue">0/0</div>
            </div>
            <div class="hhaBarTrack"><div class="hhaBarFill mini" id="hhaMiniFill"></div></div>
          </div>
        </div>

        <div class="hhaQuestFooter">
          <div class="hhaQuestHint" id="hhaQuestHint">—</div>
          <div class="hhaQuestState" id="hhaQuestState">—</div>
        </div>
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function pct(cur, target){
    cur = Number(cur)||0;
    target = Math.max(0, Number(target)||0);
    if (target <= 0) return 0;
    return clamp((cur/target)*100, 0, 100);
  }

  function pickRunPill(){
    // take from URL if present
    try{
      const q = new URL(location.href).searchParams;
      const run = String(q.get('run')||q.get('runMode')||'').toLowerCase();
      const diff = String(q.get('diff')||'').toLowerCase();
      const view = String(q.get('view')||'').toLowerCase();
      const parts = [];
      if (run) parts.push(run);
      if (diff) parts.push(diff);
      if (view) parts.push(view);
      return parts.length ? parts.join(' · ') : 'RUN';
    }catch(_){
      return 'RUN';
    }
  }

  function normalize(detail){
    const d = (detail && typeof detail === 'object') ? detail : {};

    // Groups format
    if ('goalNow' in d || 'goalTotal' in d || 'miniNow' in d || 'miniTotal' in d){
      const goalTitle = d.goalTitle || (d.groupName ? `ยิงให้ถูก: ${d.groupName}` : 'GOAL');
      const miniTitle = d.miniTitle || 'MINI';
      const goalNow = Number(d.goalNow ?? 0) || 0;
      const goalTotal = Number(d.goalTotal ?? 0) || 0;
      const miniNow = Number(d.miniNow ?? 0) || 0;
      const miniTotal = Number(d.miniTotal ?? 0) || 0;
      const miniTimeLeftSec = Number(d.miniTimeLeftSec ?? 0) || 0;

      return {
        title: d.groupName ? `Groups — ${d.groupName}` : 'Groups',
        sub: d.groupKey ? `เป้าหมายปัจจุบัน: ${String(d.groupKey)}` : 'ฝึกยิงให้ถูกหมู่',
        goal: { label: goalTitle, cur: goalNow, target: goalTotal, done: (goalTotal>0 && goalNow>=goalTotal) },
        mini: { label: miniTitle, cur: miniNow, target: miniTotal, done: (miniTotal>0 && miniNow>=miniTotal), leftSec: miniTimeLeftSec },
        allDone: false
      };
    }

    // Plate / GoodJunk / Hydration common-ish: goal + mini objects
    const g = d.goal || d.Goal || null;
    const m = d.mini || d.Mini || null;

    // Plate style: {goal:{name,sub,cur,target}, mini:{name,sub,cur,target,done}, allDone}
    const gName = g?.name ?? g?.title ?? 'GOAL';
    const gSub  = g?.sub  ?? g?.desc  ?? '';
    const gCur  = Number(g?.cur ?? 0) || 0;
    const gTar  = Number(g?.target ?? 0) || 0;
    const gDone = !!g?.done || (gTar>0 && gCur>=gTar);

    const mName = m?.name ?? m?.title ?? 'MINI';
    const mSub  = m?.sub  ?? m?.desc  ?? '';
    const mCur  = Number(m?.cur ?? 0) || 0;
    const mTar  = Number(m?.target ?? 0) || 0;
    const mDone = !!m?.done || (mTar>0 && mCur>=mTar);

    const allDone = !!d.allDone || (gDone && mDone);

    // choose title/sub
    const title = d.title || d.gameTitle || 'Quest';
    const sub = (gSub || mSub || d.sub || '').toString();

    return {
      title,
      sub: sub || 'ทำภารกิจให้ครบเพื่อรับโบนัส',
      goal: { label: String(gName), cur: gCur, target: gTar, done: gDone },
      mini: { label: String(mName), cur: mCur, target: mTar, done: mDone, leftSec: Number(m?.leftSec ?? 0)||0 },
      allDone
    };
  }

  function render(n){
    const wrap = ensureDom();
    const card = DOC.getElementById('hhaQuestCard');

    const elTitle = DOC.getElementById('hhaQuestTitle');
    const elPill  = DOC.getElementById('hhaQuestPill');
    const elSub   = DOC.getElementById('hhaQuestSub');

    const elGL = DOC.getElementById('hhaGoalLabel');
    const elGV = DOC.getElementById('hhaGoalValue');
    const elGF = DOC.getElementById('hhaGoalFill');

    const elML = DOC.getElementById('hhaMiniLabel');
    const elMV = DOC.getElementById('hhaMiniValue');
    const elMF = DOC.getElementById('hhaMiniFill');

    const elHint = DOC.getElementById('hhaQuestHint');
    const elState= DOC.getElementById('hhaQuestState');

    wrap.hidden = false;
    requestAnimationFrame(()=>card.classList.add('show'));

    elTitle.textContent = n.title || 'Quest';
    elPill.textContent  = pickRunPill();
    elSub.textContent   = n.sub || '—';

    // GOAL
    elGL.textContent = n.goal.label || 'GOAL';
    elGV.textContent = (n.goal.target>0) ? `${n.goal.cur}/${n.goal.target}` : `${n.goal.cur}`;
    const gp = pct(n.goal.cur, n.goal.target);
    elGF.style.width = `${gp.toFixed(0)}%`;
    elGF.classList.toggle('done', !!n.goal.done);

    // MINI
    elML.textContent = n.mini.label || 'MINI';
    elMV.textContent = (n.mini.target>0) ? `${n.mini.cur}/${n.mini.target}` : `${n.mini.cur}`;
    const mp = pct(n.mini.cur, n.mini.target);
    elMF.style.width = `${mp.toFixed(0)}%`;
    elMF.classList.toggle('done', !!n.mini.done);

    // footer
    const left = Number(n.mini.leftSec||0);
    const hint = n.allDone
      ? 'ครบแล้ว! 🎉'
      : (left>0 ? `MINI เหลือ ${left}s` : 'เล็งให้ชัวร์ แล้วคุมคอมโบ');

    elHint.textContent = hint;

    const state =
      (n.allDone) ? 'ALL DONE' :
      (n.goal.done && !n.mini.done) ? 'GOAL ✓' :
      (!n.goal.done && n.mini.done) ? 'MINI ✓' :
      'IN PROGRESS';

    elState.textContent = state;
  }

  function onQuest(ev){
    const t = nowMs();
    if ((t - S.lastRenderAt) < CFG.minEmitGapMs) return;
    S.lastRenderAt = t;

    const n = normalize(ev && ev.detail);
    S.lastNorm = n;
    render(n);
  }

  WIN.addEventListener('quest:update', onQuest, { passive:true });

  // expose helper
  WIN.HHA_QuestHUD = {
    render: (detail)=>onQuest({ detail }),
    hide: ()=>{
      const w = DOC.getElementById('hhaQuestWrap');
      const c = DOC.getElementById('hhaQuestCard');
      if(!w || !c) return;
      c.classList.remove('show');
      setTimeout(()=>{ try{ w.hidden = true; }catch(_){ } }, 180);
    },
    getLast: ()=>S.lastNorm
  };
})();