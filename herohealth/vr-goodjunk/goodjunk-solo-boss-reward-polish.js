// === /herohealth/vr-goodjunk/goodjunk-solo-boss-reward-polish.js ===
// GoodJunk Solo Boss Reward Screen Polish
// PATCH v8.41.5-REWARD-SCREEN-POLISH
// ✅ fix sticky buttons covering learning content
// ✅ mobile compact reward layout
// ✅ mistake review section
// ✅ better scroll padding / safe area
// ✅ larger action buttons
// ✅ child-friendly “what to improve” summary
// ✅ works with v8.40.4 reward + v8.41.x
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.5-REWARD-SCREEN-POLISH';

  const CFG = {
    debug: QS.get('debugBoss') === '1',
    enabled: QS.get('rewardPolish') !== '0',
    view: String(QS.get('view') || 'mobile').toLowerCase()
  };

  const IS_MOBILE = (() => {
    try{
      return CFG.view === 'mobile' ||
        CFG.view === 'cvr' ||
        (WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches) ||
        Math.min(WIN.innerWidth || 999, WIN.innerHeight || 999) <= 760;
    }catch(e){
      return true;
    }
  })();

  const state = {
    patched:false,
    lastSummary:null,
    expanded:false,
    debugBox:null
  };

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function readJson(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){
      return null;
    }
  }

  function ensureStyle(){
    if(DOC.getElementById('gjRewardPolishStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjRewardPolishStyle';
    css.textContent = `
      html.gjrp-on .gjr-layer.show{
        background:rgba(15,23,42,.06);
      }

      html.gjrp-on .gjr-panel{
        padding-bottom:128px !important;
        scroll-padding-bottom:148px !important;
      }

      html.gjrp-on .gjr-review{
        margin-bottom:12px !important;
      }

      html.gjrp-on .gjr-actions{
        position:sticky !important;
        bottom:-18px !important;
        z-index:30 !important;
        margin-left:-18px !important;
        margin-right:-18px !important;
        margin-bottom:-18px !important;
        padding:14px 18px calc(16px + env(safe-area-inset-bottom)) !important;
        border-radius:0 0 28px 28px !important;
        background:
          linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.96) 18%,rgba(255,255,255,.99) 100%) !important;
        box-shadow:0 -16px 26px rgba(15,23,42,.08) !important;
      }

      html.gjrp-on .gjr-btn{
        min-height:58px !important;
        border-radius:24px !important;
        font-size:18px !important;
        letter-spacing:.01em;
      }

      html.gjrp-on .gjr-btn-main{
        background:linear-gradient(135deg,#22c55e,#16a34a) !important;
      }

      html.gjrp-on .gjr-btn-zone{
        background:linear-gradient(135deg,#38bdf8,#2563eb) !important;
      }

      .gjrp-review{
        margin-top:12px;
        border-radius:24px;
        border:2px solid rgba(255,255,255,.9);
        background:linear-gradient(135deg,#fff7ed,#eff6ff);
        box-shadow:0 10px 26px rgba(15,23,42,.08);
        padding:14px;
      }

      .gjrp-review-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:10px;
      }

      .gjrp-review-head h2{
        margin:0;
        color:#0f172a;
        font-size:18px;
        line-height:1.15;
      }

      .gjrp-toggle{
        border:0;
        border-radius:999px;
        padding:8px 11px;
        background:rgba(15,23,42,.08);
        color:#0f172a;
        font-size:12px;
        font-weight:1000;
        cursor:pointer;
      }

      .gjrp-toggle:active{
        transform:scale(.96);
      }

      .gjrp-focus-grid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
      }

      .gjrp-focus{
        border-radius:18px;
        background:rgba(255,255,255,.74);
        border:2px solid rgba(226,232,240,.72);
        padding:10px 8px;
        text-align:center;
        min-height:88px;
      }

      .gjrp-focus .ico{
        display:block;
        font-size:26px;
        line-height:1;
      }

      .gjrp-focus b{
        display:block;
        margin-top:5px;
        color:#0f172a;
        font-size:16px;
        line-height:1;
      }

      .gjrp-focus span{
        display:block;
        margin-top:5px;
        color:#475569;
        font-size:12px;
        font-weight:900;
        line-height:1.16;
      }

      .gjrp-advice{
        margin-top:10px;
        border-radius:18px;
        background:rgba(255,255,255,.74);
        padding:11px;
        display:grid;
        gap:8px;
      }

      .gjrp-advice-row{
        display:grid;
        grid-template-columns:30px 1fr;
        gap:8px;
        align-items:start;
      }

      .gjrp-advice-row i{
        font-style:normal;
        font-size:22px;
        line-height:1;
      }

      .gjrp-advice-row b{
        color:#334155;
        font-size:13px;
        line-height:1.3;
      }

      .gjrp-detail{
        display:none;
        margin-top:10px;
        border-radius:18px;
        background:rgba(15,23,42,.06);
        padding:10px;
      }

      .gjrp-detail.show{
        display:block;
      }

      .gjrp-detail ul{
        list-style:none;
        padding:0;
        margin:0;
        display:grid;
        gap:7px;
      }

      .gjrp-detail li{
        display:grid;
        grid-template-columns:28px 1fr;
        gap:8px;
        align-items:start;
        padding:8px;
        border-radius:14px;
        background:rgba(255,255,255,.66);
      }

      .gjrp-detail li span{
        font-size:20px;
        line-height:1;
      }

      .gjrp-detail li b{
        color:#334155;
        font-size:13px;
        line-height:1.28;
      }

      html.gjrp-compact .gjr-panel{
        width:min(720px, calc(100vw - 16px)) !important;
        border-radius:26px !important;
        padding:12px 12px 128px !important;
      }

      html.gjrp-compact .gjr-hero{
        padding-top:4px !important;
        padding-bottom:8px !important;
      }

      html.gjrp-compact .gjr-trophy{
        width:68px !important;
        height:68px !important;
        border-radius:24px !important;
        font-size:42px !important;
        margin-bottom:5px !important;
      }

      html.gjrp-compact .gjr-kicker{
        font-size:11px !important;
      }

      html.gjrp-compact .gjr-hero h1{
        font-size:clamp(25px,7vw,38px) !important;
      }

      html.gjrp-compact .gjr-stars{
        font-size:24px !important;
        margin-top:5px !important;
      }

      html.gjrp-compact .gjr-message{
        font-size:13px !important;
        margin-top:5px !important;
      }

      html.gjrp-compact .gjr-rank-card{
        gap:7px !important;
        margin-top:7px !important;
      }

      html.gjrp-compact .gjr-rank-card > div{
        border-radius:18px !important;
        padding:9px 10px !important;
      }

      html.gjrp-compact .gjr-grid{
        grid-template-columns:repeat(4,1fr) !important;
        gap:7px !important;
        margin-top:9px !important;
      }

      html.gjrp-compact .gjr-metric{
        border-radius:18px !important;
        min-height:76px !important;
        padding:9px 5px !important;
      }

      html.gjrp-compact .gjr-metric b{
        font-size:22px !important;
      }

      html.gjrp-compact .gjr-metric span{
        font-size:11px !important;
      }

      html.gjrp-compact .gjr-metric small{
        font-size:10px !important;
      }

      html.gjrp-compact .gjr-review,
      html.gjrp-compact .gjr-next,
      html.gjrp-compact .gjrp-review{
        border-radius:20px !important;
        padding:11px !important;
        margin-top:9px !important;
      }

      .gjrp-debug{
        position:fixed;
        right:10px;
        bottom:calc(190px + env(safe-area-inset-bottom));
        z-index:100120;
        width:min(300px, calc(100vw - 20px));
        border-radius:16px;
        padding:10px;
        background:rgba(15,23,42,.86);
        color:#e5e7eb;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.35;
        white-space:pre-wrap;
        pointer-events:none;
      }

      @media (max-width:720px){
        html.gjrp-on .gjr-panel{
          max-height:calc(100dvh - 12px) !important;
          padding-bottom:142px !important;
        }

        html.gjrp-on .gjr-actions{
          grid-template-columns:1fr 1fr !important;
          gap:8px !important;
          margin-left:-12px !important;
          margin-right:-12px !important;
          margin-bottom:-12px !important;
          padding:12px 12px calc(14px + env(safe-area-inset-bottom)) !important;
          border-radius:0 0 24px 24px !important;
        }

        html.gjrp-on .gjr-btn{
          min-height:58px !important;
          font-size:15px !important;
          border-radius:20px !important;
          padding:12px 8px !important;
        }

        .gjrp-focus-grid{
          grid-template-columns:repeat(3,1fr);
          gap:6px;
        }

        .gjrp-focus{
          min-height:76px;
          border-radius:16px;
          padding:8px 5px;
        }

        .gjrp-focus .ico{
          font-size:22px;
        }

        .gjrp-focus b{
          font-size:15px;
        }

        .gjrp-focus span{
          font-size:10.5px;
        }

        .gjrp-review-head h2{
          font-size:16px;
        }
      }

      @media (max-width:420px){
        html.gjrp-on .gjr-actions{
          grid-template-columns:1fr !important;
        }

        html.gjrp-on .gjr-panel{
          padding-bottom:190px !important;
        }

        html.gjrp-compact .gjr-grid{
          grid-template-columns:repeat(2,1fr) !important;
        }

        .gjrp-focus-grid{
          grid-template-columns:1fr;
        }

        .gjrp-focus{
          display:grid;
          grid-template-columns:36px 54px 1fr;
          align-items:center;
          text-align:left;
          min-height:52px;
          padding:8px 10px;
        }

        .gjrp-focus .ico{
          font-size:24px;
        }

        .gjrp-focus b{
          margin-top:0;
        }

        .gjrp-focus span{
          margin-top:0;
        }
      }
    `;

    DOC.head.appendChild(css);

    DOC.documentElement.classList.add('gjrp-on');
    if(IS_MOBILE) DOC.documentElement.classList.add('gjrp-compact');
  }

  function getLatestSummary(detail){
    const base = detail || {};
    const reward = readJson('GJ_SOLO_BOSS_REWARD_LAST') || {};
    const main = readJson('GJ_SOLO_BOSS_MAIN_LAST') || {};
    const ultimate = readJson('GJ_SOLO_BOSS_ULTIMATE_LAST') || {};
    const foodbank = readJson('GJ_SOLO_BOSS_FOODBANK_LAST') || {};

    return {
      ...reward,
      ...main,
      ...ultimate,
      ...foodbank,
      ...base
    };
  }

  function buildAdvice(summary){
    const goodHits = n(summary.goodHits);
    const junkHits = n(summary.junkHits);
    const fakeHits = n(summary.fakeHits);
    const goodMissed = n(summary.goodMissed);
    const maxCombo = n(summary.maxCombo);
    const defeated = Boolean(summary.defeated);
    const accuracy = n(summary.accuracy);

    const rows = [];

    if(fakeHits > 0){
      rows.push({
        icon:'🧃',
        text:'รอบหน้าสังเกต “อาหารหลอกตา” ให้ดี เช่น น้ำผลไม้หวาน สลัดซอสเยอะ หรือของทอดที่ดูเหมือนอาหารดี'
      });
    }

    if(junkHits > 0){
      rows.push({
        icon:'🍟',
        text:'ถ้าเห็นของทอด น้ำหวาน หรือขนมหวาน ให้หลบก่อน เพราะจะทำให้บอสได้เปรียบ'
      });
    }

    if(goodMissed > 0){
      rows.push({
        icon:'🥦',
        text:'อาหารดีหลุดไปบางชิ้น รอบหน้าลองแตะอาหารดีให้ไวขึ้นเพื่อรักษาคอมโบ'
      });
    }

    if(maxCombo < 8){
      rows.push({
        icon:'⚡',
        text:'ลองตั้งเป้า Combo x8 เพื่อโจมตีบอสแรงขึ้นและได้ดาวมากขึ้น'
      });
    }

    if(!defeated){
      rows.push({
        icon:'👾',
        text:'ถ้าจะชนะบอส ให้ทำภารกิจย่อยและเก็บอาหารดีต่อเนื่องตอนบอสเลือดต่ำ'
      });
    }

    if(goodHits >= 12 && junkHits === 0 && fakeHits === 0){
      rows.push({
        icon:'🏆',
        text:'ยอดเยี่ยมมาก! รอบหน้าลองเพิ่มความยาก หรือทำคอมโบให้สูงกว่าเดิม'
      });
    }

    if(accuracy >= 90 && defeated){
      rows.push({
        icon:'🌟',
        text:'เล่นแม่นมากแล้ว จุดต่อไปคือรักษาความเร็วและคอมโบให้ต่อเนื่อง'
      });
    }

    if(!rows.length){
      rows.push({
        icon:'💚',
        text:'ทำได้ดีมาก รอบหน้าลองแยกอาหารดี junk และอาหารหลอกตาให้เร็วขึ้นอีกนิด'
      });
    }

    return rows.slice(0, 4);
  }

  function buildDetail(summary){
    const rows = [];

    rows.push({
      icon:'🥦',
      text:`อาหารดีที่เก็บได้ ${n(summary.goodHits)} ชิ้น — ยิ่งเก็บต่อเนื่อง บอสยิ่งเสีย HP มากขึ้น`
    });

    rows.push({
      icon:'🍟',
      text:`แตะ junk ${n(summary.junkHits)} ครั้ง — ควรลดลง เพราะทำให้เสียจังหวะและเสียพลัง`
    });

    rows.push({
      icon:'🧃',
      text:`อาหารหลอกตา ${n(summary.fakeHits)} ครั้ง — ต้องดูน้ำตาล น้ำมัน และซอสแฝง`
    });

    rows.push({
      icon:'⚡',
      text:`คอมโบสูงสุด x${n(summary.maxCombo)} — คอมโบสูงช่วยปิดฉากบอสเร็วขึ้น`
    });

    rows.push({
      icon:'🏅',
      text:`ภารกิจสำเร็จ ${n(summary.missionDoneCount || summary.missionDone)} ครั้ง — ภารกิจช่วยเพิ่มโล่และพลังโจมตี`
    });

    return rows;
  }

  function createPolishSection(summary){
    let box = DOC.getElementById('gjRewardPolishReview');

    if(!box){
      box = DOC.createElement('section');
      box.id = 'gjRewardPolishReview';
      box.className = 'gjrp-review';

      const next = DOC.querySelector('.gjr-next');
      const actions = DOC.querySelector('.gjr-actions');

      if(next && next.parentNode){
        next.parentNode.insertBefore(box, next);
      }else if(actions && actions.parentNode){
        actions.parentNode.insertBefore(box, actions);
      }else{
        const panel = DOC.querySelector('.gjr-panel');
        if(panel) panel.appendChild(box);
      }
    }

    const advice = buildAdvice(summary);
    const detail = buildDetail(summary);

    box.innerHTML = `
      <div class="gjrp-review-head">
        <h2>ดูสิ่งที่พลาด / เป้าหมายรอบหน้า</h2>
        <button class="gjrp-toggle" id="gjrpToggleBtn" type="button">
          ${state.expanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
        </button>
      </div>

      <div class="gjrp-focus-grid">
        <div class="gjrp-focus">
          <span class="ico">🍟</span>
          <b>${n(summary.junkHits)}</b>
          <span>แตะ junk</span>
        </div>
        <div class="gjrp-focus">
          <span class="ico">🧃</span>
          <b>${n(summary.fakeHits)}</b>
          <span>อาหารหลอกตา</span>
        </div>
        <div class="gjrp-focus">
          <span class="ico">🥦</span>
          <b>${n(summary.goodMissed)}</b>
          <span>อาหารดีหลุด</span>
        </div>
      </div>

      <div class="gjrp-advice">
        ${advice.map(r => `
          <div class="gjrp-advice-row">
            <i>${esc(r.icon)}</i>
            <b>${esc(r.text)}</b>
          </div>
        `).join('')}
      </div>

      <div class="gjrp-detail ${state.expanded ? 'show' : ''}" id="gjrpDetail">
        <ul>
          ${detail.map(r => `
            <li>
              <span>${esc(r.icon)}</span>
              <b>${esc(r.text)}</b>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    const toggle = DOC.getElementById('gjrpToggleBtn');
    if(toggle){
      toggle.addEventListener('click', function(){
        state.expanded = !state.expanded;
        createPolishSection(state.lastSummary || summary);
      });
    }
  }

  function fixScrollPosition(){
    const panel = DOC.querySelector('.gjr-panel');
    if(!panel) return;

    // ให้ summary เริ่มที่บนสุดเสมอ และมีช่องว่างล่างไม่ให้ปุ่มบัง
    setTimeout(() => {
      try{ panel.scrollTop = 0; }catch(e){}
    }, 50);

    setTimeout(() => {
      const actions = DOC.querySelector('.gjr-actions');
      if(actions){
        actions.style.pointerEvents = 'auto';
      }
    }, 120);
  }

  function polishButtons(){
    const replay = DOC.getElementById('gjrReplayBtn');
    const zone = DOC.getElementById('gjrZoneBtn');

    if(replay){
      replay.innerHTML = '🔁 เล่นอีกครั้ง';
      replay.setAttribute('aria-label', 'เล่น GoodJunk Solo Boss อีกครั้ง');
    }

    if(zone){
      zone.innerHTML = '🏠 กลับ Nutrition Zone';
      zone.setAttribute('aria-label', 'กลับไปหน้า Nutrition Zone');
    }
  }

  function applyPolish(summary){
    if(!CFG.enabled) return;

    ensureStyle();

    summary = getLatestSummary(summary || {});
    state.lastSummary = summary;

    createPolishSection(summary);
    polishButtons();
    fixScrollPosition();

    state.patched = true;
    renderDebug();

    WIN.dispatchEvent(new CustomEvent('gj:reward-polish-applied', {
      detail:{
        patch:PATCH,
        isMobile:IS_MOBILE,
        summary
      }
    }));
  }

  function renderDebug(){
    if(!CFG.debug) return;

    ensureStyle();

    let box = DOC.getElementById('gjRewardPolishDebug');
    if(!box){
      box = DOC.createElement('pre');
      box.id = 'gjRewardPolishDebug';
      box.className = 'gjrp-debug';
      DOC.body.appendChild(box);
      state.debugBox = box;
    }

    const s = state.lastSummary || {};

    box.textContent =
`GoodJunk Reward Polish
${PATCH}

patched: ${state.patched}
mobile: ${IS_MOBILE}
expanded: ${state.expanded}

score: ${n(s.score)}
stars: ${n(s.stars)}
good: ${n(s.goodHits)}
junk: ${n(s.junkHits)}
fake: ${n(s.fakeHits)}
goodMissed: ${n(s.goodMissed)}
combo: ${n(s.maxCombo)}`;
  }

  function boot(){
    if(!CFG.enabled) return;

    ensureStyle();

    WIN.addEventListener('gj:reward-summary-shown', function(e){
      applyPolish(e.detail || {});
    });

    // fallback: ถ้า reward layer โผล่โดย event หลุด ให้ polish เอง
    const observer = new MutationObserver(() => {
      const layer = DOC.getElementById('gjRewardLayer');
      if(layer && layer.classList.contains('show')){
        if(!DOC.getElementById('gjRewardPolishReview')){
          applyPolish({});
        }
      }
    });

    observer.observe(DOC.body || DOC.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class']
    });

    WIN.GoodJunkSoloBossRewardPolish = {
      version:PATCH,
      applyPolish,
      createPolishSection,
      getState:()=>({
        patch:PATCH,
        patched:state.patched,
        expanded:state.expanded,
        isMobile:IS_MOBILE,
        lastSummary:state.lastSummary
      })
    };

    WIN.GJRP = WIN.GoodJunkSoloBossRewardPolish;

    WIN.dispatchEvent(new CustomEvent('gj:reward-polish-ready', {
      detail:{
        patch:PATCH,
        enabled:CFG.enabled,
        isMobile:IS_MOBILE
      }
    }));
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
