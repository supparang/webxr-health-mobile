// === /herohealth/hub/hha-daily-quests-ui.js ===
// Daily Quest UI for HUB (requires ../vr/hha-daily-quest.js)

(function(){
  'use strict';

  const WIN = window;

  function $(sel, root=document){ return root.querySelector(sel); }
  function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }

  function pct(p){ return Math.max(0, Math.min(100, Math.round((Number(p)||0)*100))); }

  function mount(selector){
    const root = document.querySelector(selector);
    if(!root) return;

    const api = WIN.HHA_DailyQuest;
    if(!api){
      root.innerHTML = `<div class="dq-card">DailyQuest: missing script</div>`;
      return;
    }

    function render(){
      const st = api.getToday('normal'); // diff is not critical in HUB
      root.innerHTML = '';

      const u = (function(){
        try{ return JSON.parse(localStorage.getItem('HHA_HYGIENE_UNLOCKS')||'{}'); }catch{ return {}; }
      })();
      const streak = Number(u?.daily?.streak||0);

      const wrap = el('div','dq-card');
      wrap.innerHTML = `
        <div class="dq-top">
          <div>
            <div class="dq-title">📌 Daily Quest (วันนี้)</div>
            <div class="dq-sub">ทำครบ 2 ภารกิจ → กดรับรางวัล • Streak: <b>${streak}</b> วัน</div>
          </div>
          <button class="dq-btn" id="dqClaim" type="button">🎁 Claim</button>
        </div>
        <div class="dq-grid" id="dqGrid"></div>
        <div class="dq-foot" id="dqFoot"></div>
      `;
      root.appendChild(wrap);

      const grid = $('#dqGrid', wrap);
      const foot = $('#dqFoot', wrap);
      const btn = $('#dqClaim', wrap);

      let allDone = true;
      let already = !!st.claimed;

      st.quests.forEach(q=>{
        allDone = allDone && !!q.done;
        const card = el('div','dq-q');
        card.innerHTML = `
          <div class="dq-qtop">
            <div class="dq-qi">${q.icon||'✅'}</div>
            <div class="dq-qt">
              <div class="dq-qtitle">${q.title}</div>
              <div class="dq-qdesc">${q.desc}</div>
            </div>
            <div class="dq-qrew">🪙${q.rewardCoin||0} ⭐${q.rewardStar||0}</div>
          </div>
          <div class="dq-bar"><div class="dq-fill" style="width:${pct(q.progress)}%"></div></div>
          <div class="dq-qstat">${q.done ? '✅ Done' : `กำลังทำ... (${pct(q.progress)}%)`}</div>
        `;
        grid.appendChild(card);
      });

      // button state
      btn.disabled = !(allDone && !already);
      btn.textContent = already ? '✅ Claimed' : (allDone ? '🎁 Claim' : '🔒 ทำให้ครบก่อน');

      const nextMilestone = (streak < 3) ? 3 : (streak < 7 ? 7 : 7);
      const rewardTxt = (streak < 3)
        ? 'ครบ 3 วันปลด Aura: Spark ✨'
        : (streak < 7 ? 'ครบ 7 วันปลด Aura: Hero 🌈 + Title 🔥' : 'คุณเป็นสายฮีโร่แล้ว! 🌈🔥');

      foot.innerHTML = `
        <div class="dq-note">
          🧠 Tip: ภารกิจวันนี้ “ล็อกตามวัน” (ไม่เปลี่ยนไปมา) • ${rewardTxt}
        </div>
      `;

      btn.addEventListener('click', ()=>{
        const res = api.claimToday({ runMode:'play', diffHint:'normal' });
        if(res && res.ok){
          // quick feedback
          foot.innerHTML = `<div class="dq-note">รับแล้ว ✅ +🪙${res.addC} +⭐${res.addS} • Streak = <b>${res.streak}</b></div>`;
          render();
        }
      }, {passive:true});
    }

    render();
    WIN.addEventListener('focus', render);
    WIN.addEventListener('hha:end', render); // if HUB stays open and you end game in another tab
    WIN.addEventListener('hha:daily_claim', render);
  }

  WIN.HHA_DailyQuestUI = { mount };
})();