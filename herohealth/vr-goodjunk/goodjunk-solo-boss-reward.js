// === /herohealth/vr-goodjunk/goodjunk-solo-boss-reward.js ===
// GoodJunk Solo Boss Final Reward + Learning Summary
// PATCH v8.40.4-FINAL-REWARD-LEARNING-SUMMARY
// ✅ child-friendly final summary
// ✅ stars / rank / badge / coins
// ✅ good vs junk vs fake healthy review
// ✅ learning tips
// ✅ replay button
// ✅ back to Nutrition Zone button
// ✅ saves latest summary to localStorage
// ✅ works with v8.40.1 ultimate + v8.40.2 drama + v8.40.3 juice
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.40.4-FINAL-REWARD-LEARNING-SUMMARY';

  const STORE_KEY = 'GJ_SOLO_BOSS_REWARD_LAST';
  const HHA_LAST_KEY = 'HHA_LAST_SUMMARY';

  const state = {
    started:false,
    ended:false,
    shown:false,
    showTimer:null,

    data:{
      patch:PATCH,
      defeated:false,
      hp:0,
      hpMax:0,
      phaseCount:0,
      missionDoneCount:0,
      maxCombo:0,
      goodHits:0,
      junkHits:0,
      fakeHits:0,
      misses:0,
      scoreBonus:0,
      totalDamage:0,
      hitCount:0,
      attackCount:0,
      frenzy:false,
      learningTips:[],
      reason:''
    }
  };

  function qs(name, fallback){
    return QS.get(name) ?? fallback;
  }

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
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

  function uniq(arr){
    const out = [];
    const seen = new Set();

    (arr || []).forEach(x => {
      const s = String(x || '').trim();
      if(!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });

    return out;
  }

  function readJson(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }

  function saveJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){}
  }

  function mergeData(detail){
    if(!detail || typeof detail !== 'object') return;

    const d = state.data;

    Object.keys(detail).forEach(k => {
      if(k === 'learningTips'){
        d.learningTips = uniq([...(d.learningTips || []), ...(detail.learningTips || [])]);
        return;
      }

      if(detail[k] !== undefined && detail[k] !== null){
        d[k] = detail[k];
      }
    });

    d.defeated = Boolean(d.defeated || detail.defeated);
    d.frenzy = Boolean(d.frenzy || detail.frenzy);

    d.phaseCount = Math.max(n(d.phaseCount), n(detail.phaseCount));
    d.missionDoneCount = Math.max(n(d.missionDoneCount), n(detail.missionDoneCount));
    d.maxCombo = Math.max(n(d.maxCombo), n(detail.maxCombo));
    d.goodHits = Math.max(n(d.goodHits), n(detail.goodHits));
    d.junkHits = Math.max(n(d.junkHits), n(detail.junkHits));
    d.fakeHits = Math.max(n(d.fakeHits), n(detail.fakeHits));
    d.misses = Math.max(n(d.misses), n(detail.misses));
    d.scoreBonus = Math.max(n(d.scoreBonus), n(detail.scoreBonus));
    d.totalDamage = Math.max(n(d.totalDamage), n(detail.totalDamage));
    d.hitCount = Math.max(n(d.hitCount), n(detail.hitCount));
    d.attackCount = Math.max(n(d.attackCount), n(detail.attackCount));
  }

  function hydrateFromStorage(){
    const u = readJson('GJ_SOLO_BOSS_ULTIMATE_LAST');
    const d = readJson('GJ_SOLO_BOSS_DRAMA_LAST');
    const j = readJson('GJ_SOLO_BOSS_JUICE_LAST');

    if(u) mergeData(u);
    if(d) mergeData(d);
    if(j) mergeData(j);
  }

  function calculateSummary(){
    hydrateFromStorage();

    const d = state.data;

    const goodHits = n(d.goodHits);
    const junkHits = n(d.junkHits);
    const fakeHits = n(d.fakeHits);
    const misses = Math.max(n(d.misses), junkHits + fakeHits);
    const maxCombo = n(d.maxCombo);
    const missionDoneCount = n(d.missionDoneCount);
    const phaseCount = n(d.phaseCount);
    const totalDamage = n(d.totalDamage);
    const defeated = Boolean(d.defeated);

    const baseScore =
      goodHits * 12 +
      maxCombo * 8 +
      missionDoneCount * 70 +
      phaseCount * 25 +
      Math.round(totalDamage / 8) +
      n(d.scoreBonus);

    const penalty = misses * 18 + fakeHits * 12 + junkHits * 10;

    const score = Math.max(0, Math.round(baseScore - penalty + (defeated ? 260 : 0)));

    let stars = 1;
    if(defeated) stars += 1;
    if(maxCombo >= 8) stars += 1;
    if(missionDoneCount >= 2) stars += 1;
    if(misses <= 3 && goodHits >= 8) stars += 1;
    stars = clamp(stars, 1, 5);

    let rank = 'Rookie Hero';
    let badge = '🌱 Good Food Starter';
    let message = 'เริ่มแยกอาหารดีและอาหารขยะได้แล้ว';

    if(stars >= 5){
      rank = 'Legend Hero';
      badge = '🏆 Nutrition Champion';
      message = 'สุดยอดมาก! เลือกอาหารดีต่อเนื่องและรับมือบอสได้ดี';
    }else if(stars >= 4){
      rank = 'Super Hero';
      badge = '⭐ Smart Plate Hero';
      message = 'เก่งมาก! เริ่มอ่านเกมและหลบ junk ได้ดี';
    }else if(stars >= 3){
      rank = 'Food Hero';
      badge = '💚 Good Choice Hero';
      message = 'ทำได้ดี! ฝึกอีกนิดจะชนะบอสได้มั่นคงขึ้น';
    }else if(stars >= 2){
      rank = 'Junior Hero';
      badge = '🥦 Healthy Learner';
      message = 'ดีขึ้นแล้ว! รอบหน้าลองสังเกตอาหารหลอกตาให้มากขึ้น';
    }

    const coins = Math.max(20, stars * 30 + missionDoneCount * 12 + Math.floor(maxCombo / 2));
    const accuracy = goodHits + misses > 0
      ? Math.round((goodHits / (goodHits + misses)) * 100)
      : 0;

    return {
      patch:PATCH,
      defeated,
      score,
      stars,
      rank,
      badge,
      coins,
      message,
      accuracy,

      goodHits,
      junkHits,
      fakeHits,
      misses,
      maxCombo,
      missionDoneCount,
      phaseCount,
      totalDamage,
      attackCount:n(d.attackCount),
      frenzy:Boolean(d.frenzy),
      learningTips:buildTips(d, {
        goodHits,
        junkHits,
        fakeHits,
        misses,
        maxCombo,
        missionDoneCount,
        defeated
      }),

      pid:qs('pid', 'anon'),
      name:qs('name', qs('nick', 'Hero')),
      diff:qs('diff', 'normal'),
      time:n(qs('time', 120), 120),
      view:qs('view', 'mobile'),
      savedAt:new Date().toISOString()
    };
  }

  function buildTips(raw, m){
    const tips = uniq(raw.learningTips || []);

    if(m.fakeHits > 0){
      tips.unshift('อาหารบางอย่างดูเหมือนดีต่อสุขภาพ แต่ต้องดูน้ำตาล น้ำมัน และซอสแฝงด้วย');
    }

    if(m.junkHits > 0){
      tips.unshift('อาหารทอด น้ำหวาน และขนมหวานควรกินแต่น้อย ไม่ควรกินบ่อย');
    }

    if(m.goodHits >= 8){
      tips.unshift('เลือกอาหารดีได้เยอะมาก เช่น ผัก ผลไม้ โปรตีน และอาหารหลักที่เหมาะสม');
    }

    if(m.maxCombo >= 8){
      tips.unshift('คอมโบสูงแปลว่าสังเกตอาหารได้ต่อเนื่องดีมาก');
    }

    if(m.missionDoneCount >= 2){
      tips.unshift('ทำภารกิจย่อยได้ดี แสดงว่าเล่นอย่างมีเป้าหมาย ไม่ใช่กดมั่ว');
    }

    if(!m.defeated){
      tips.unshift('รอบหน้าลองเน้นเก็บอาหารดีต่อเนื่องเพื่อทำคอมโบโจมตีบอส');
    }

    const fallback = [
      'เลือกอาหารให้หลากหลาย ครบหมู่ และกินอาหารขยะให้น้อยลง',
      'ถ้าเป็นน้ำหวานหรือของทอด แม้หน้าตาน่ากินก็ควรกินพอดี',
      'ผัก ผลไม้ และโปรตีนช่วยให้ร่างกายแข็งแรง'
    ];

    return uniq([...tips, ...fallback]).slice(0, 4);
  }

  function starText(count){
    count = clamp(Number(count) || 0, 0, 5);
    return '⭐'.repeat(count) + '☆'.repeat(5 - count);
  }

  function resultTitle(summary){
    if(summary.defeated && summary.stars >= 4) return 'ชนะบอสแบบสุดยอด!';
    if(summary.defeated) return 'ชนะบอสแล้ว!';
    if(summary.stars >= 3) return 'เกือบชนะแล้ว!';
    return 'ฝึกอีกนิด จะชนะได้!';
  }

  function resultIcon(summary){
    if(summary.defeated && summary.stars >= 4) return '🏆';
    if(summary.defeated) return '🎉';
    if(summary.stars >= 3) return '💪';
    return '🌱';
  }

  function metricCard(label, value, sub){
    return `
      <div class="gjr-metric">
        <b>${esc(value)}</b>
        <span>${esc(label)}</span>
        ${sub ? `<small>${esc(sub)}</small>` : ''}
      </div>
    `;
  }

  function tipList(tips){
    return (tips || []).map(t => `
      <li>
        <span>💡</span>
        <b>${esc(t)}</b>
      </li>
    `).join('');
  }

  function ensureLayer(){
    let root = DOC.getElementById('gjRewardLayer');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'gjRewardLayer';
    root.className = 'gjr-layer';
    root.innerHTML = `
      <div class="gjr-backdrop"></div>
      <section class="gjr-panel" role="dialog" aria-modal="true" aria-labelledby="gjrTitle">
        <button class="gjr-close" id="gjrCloseBtn" type="button" aria-label="close">×</button>

        <div class="gjr-hero">
          <div class="gjr-trophy" id="gjrIcon">🏆</div>
          <p class="gjr-kicker">GoodJunk Solo Boss</p>
          <h1 id="gjrTitle">ชนะบอสแล้ว!</h1>
          <div class="gjr-stars" id="gjrStars">⭐⭐⭐⭐⭐</div>
          <p class="gjr-message" id="gjrMessage">เลือกอาหารดี ชนะอาหารขยะได้</p>
        </div>

        <div class="gjr-rank-card">
          <div>
            <span>Rank</span>
            <b id="gjrRank">Food Hero</b>
          </div>
          <div>
            <span>Badge</span>
            <b id="gjrBadge">Good Choice Hero</b>
          </div>
          <div>
            <span>Coins</span>
            <b id="gjrCoins">+120 🪙</b>
          </div>
        </div>

        <div class="gjr-grid" id="gjrMetrics"></div>

        <div class="gjr-review">
          <h2>วันนี้ได้เรียนรู้อะไร?</h2>
          <ul id="gjrTips"></ul>
        </div>

        <div class="gjr-next">
          <h2 id="gjrNextTitle">ภารกิจรอบหน้า</h2>
          <p id="gjrNextText">ลองทำคอมโบให้สูงขึ้น และระวังอาหารหลอกตา</p>
        </div>

        <div class="gjr-actions">
          <button class="gjr-btn gjr-btn-main" id="gjrReplayBtn" type="button">🔁 เล่นอีกครั้ง</button>
          <button class="gjr-btn gjr-btn-zone" id="gjrZoneBtn" type="button">🏠 กลับ Nutrition Zone</button>
        </div>
      </section>
    `;

    DOC.body.appendChild(root);

    if(!DOC.getElementById('gjRewardStyle')){
      const css = DOC.createElement('style');
      css.id = 'gjRewardStyle';
      css.textContent = `
        .gjr-layer{
          position:fixed;
          inset:0;
          z-index:100020;
          display:none;
          pointer-events:none;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          color:#172033;
        }

        .gjr-layer.show{
          display:block;
          pointer-events:auto;
        }

        .gjr-backdrop{
          position:absolute;
          inset:0;
          background:
            radial-gradient(circle at 20% 15%,rgba(134,239,172,.36),transparent 32%),
            radial-gradient(circle at 80% 20%,rgba(147,197,253,.36),transparent 34%),
            radial-gradient(circle at 50% 85%,rgba(253,224,71,.30),transparent 36%),
            rgba(15,23,42,.56);
          backdrop-filter:blur(8px);
        }

        .gjr-panel{
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%) scale(.96);
          width:min(760px, calc(100vw - 22px));
          max-height:calc(100dvh - 24px);
          overflow:auto;
          border-radius:32px;
          border:3px solid rgba(255,255,255,.92);
          background:
            linear-gradient(180deg,rgba(255,255,255,.98),rgba(240,253,244,.97));
          box-shadow:0 28px 80px rgba(15,23,42,.36);
          padding:18px;
          animation:gjrPanelIn .28s ease forwards;
        }

        .gjr-close{
          position:sticky;
          top:0;
          float:right;
          z-index:3;
          width:38px;
          height:38px;
          border:0;
          border-radius:999px;
          background:rgba(15,23,42,.10);
          color:#0f172a;
          font-size:28px;
          font-weight:900;
          line-height:1;
          cursor:pointer;
        }

        .gjr-close:active{
          transform:scale(.94);
        }

        .gjr-hero{
          text-align:center;
          padding:10px 8px 14px;
        }

        .gjr-trophy{
          width:86px;
          height:86px;
          margin:0 auto 8px;
          display:grid;
          place-items:center;
          border-radius:30px;
          background:linear-gradient(135deg,#fff7ed,#fde68a,#bbf7d0);
          box-shadow:inset 0 -7px 0 rgba(0,0,0,.08),0 16px 34px rgba(15,23,42,.14);
          font-size:52px;
          animation:gjrTrophy 1s ease-in-out infinite alternate;
        }

        .gjr-kicker{
          margin:0;
          color:#2563eb;
          font-size:13px;
          font-weight:1000;
          letter-spacing:.10em;
          text-transform:uppercase;
        }

        .gjr-hero h1{
          margin:6px 0 0;
          color:#0f172a;
          font-size:clamp(27px,5.8vw,46px);
          line-height:1.05;
        }

        .gjr-stars{
          margin-top:8px;
          font-size:30px;
          letter-spacing:2px;
          filter:drop-shadow(0 4px 8px rgba(245,158,11,.22));
        }

        .gjr-message{
          margin:8px auto 0;
          max-width:560px;
          color:#475569;
          font-size:16px;
          font-weight:800;
          line-height:1.35;
        }

        .gjr-rank-card{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:10px;
          margin-top:10px;
        }

        .gjr-rank-card > div{
          border-radius:22px;
          background:linear-gradient(135deg,#eff6ff,#ecfdf5);
          border:2px solid rgba(255,255,255,.88);
          box-shadow:0 10px 26px rgba(15,23,42,.08);
          padding:12px;
          text-align:center;
        }

        .gjr-rank-card span{
          display:block;
          color:#64748b;
          font-size:12px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.06em;
        }

        .gjr-rank-card b{
          display:block;
          margin-top:4px;
          color:#0f172a;
          font-size:15px;
          line-height:1.18;
        }

        .gjr-grid{
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:10px;
          margin-top:12px;
        }

        .gjr-metric{
          border-radius:22px;
          background:#fff;
          border:2px solid rgba(226,232,240,.95);
          box-shadow:0 10px 24px rgba(15,23,42,.07);
          padding:12px 8px;
          text-align:center;
          min-height:94px;
        }

        .gjr-metric b{
          display:block;
          color:#0f172a;
          font-size:24px;
          line-height:1.05;
        }

        .gjr-metric span{
          display:block;
          margin-top:5px;
          color:#334155;
          font-size:13px;
          font-weight:900;
          line-height:1.15;
        }

        .gjr-metric small{
          display:block;
          margin-top:5px;
          color:#64748b;
          font-size:11px;
          font-weight:800;
          line-height:1.15;
        }

        .gjr-review,
        .gjr-next{
          margin-top:12px;
          border-radius:24px;
          border:2px solid rgba(255,255,255,.9);
          background:linear-gradient(135deg,#fff7ed,#fffbeb);
          box-shadow:0 10px 26px rgba(15,23,42,.08);
          padding:14px;
        }

        .gjr-review h2,
        .gjr-next h2{
          margin:0 0 10px;
          color:#0f172a;
          font-size:18px;
          line-height:1.15;
        }

        .gjr-review ul{
          list-style:none;
          padding:0;
          margin:0;
          display:grid;
          gap:8px;
        }

        .gjr-review li{
          display:grid;
          grid-template-columns:30px 1fr;
          gap:8px;
          align-items:start;
          border-radius:16px;
          background:rgba(255,255,255,.72);
          padding:10px;
        }

        .gjr-review li span{
          font-size:22px;
          line-height:1;
        }

        .gjr-review li b{
          color:#334155;
          font-size:14px;
          line-height:1.32;
        }

        .gjr-next{
          background:linear-gradient(135deg,#ecfdf5,#eff6ff);
        }

        .gjr-next p{
          margin:0;
          color:#334155;
          font-size:15px;
          line-height:1.35;
          font-weight:800;
        }

        .gjr-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-top:14px;
          position:sticky;
          bottom:0;
          padding-top:8px;
          background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.96) 34%);
        }

        .gjr-btn{
          border:0;
          border-radius:22px;
          padding:14px 12px;
          font-size:16px;
          font-weight:1000;
          cursor:pointer;
          box-shadow:0 12px 26px rgba(15,23,42,.16);
        }

        .gjr-btn:active{
          transform:scale(.97);
        }

        .gjr-btn-main{
          background:linear-gradient(135deg,#22c55e,#16a34a);
          color:white;
        }

        .gjr-btn-zone{
          background:linear-gradient(135deg,#38bdf8,#2563eb);
          color:white;
        }

        @keyframes gjrPanelIn{
          from{
            opacity:0;
            transform:translate(-50%,-46%) scale(.92);
          }
          to{
            opacity:1;
            transform:translate(-50%,-50%) scale(1);
          }
        }

        @keyframes gjrTrophy{
          from{ transform:translateY(0) rotate(-3deg) scale(1); }
          to{ transform:translateY(-5px) rotate(3deg) scale(1.06); }
        }

        @media (max-width:720px){
          .gjr-panel{
            border-radius:26px;
            padding:13px;
          }

          .gjr-trophy{
            width:72px;
            height:72px;
            font-size:44px;
            border-radius:24px;
          }

          .gjr-stars{
            font-size:25px;
          }

          .gjr-message{
            font-size:14px;
          }

          .gjr-rank-card{
            grid-template-columns:1fr;
            gap:8px;
          }

          .gjr-rank-card > div{
            display:grid;
            grid-template-columns:86px 1fr;
            align-items:center;
            text-align:left;
            padding:10px 12px;
          }

          .gjr-rank-card b{
            margin-top:0;
            font-size:14px;
          }

          .gjr-grid{
            grid-template-columns:repeat(2,1fr);
            gap:8px;
          }

          .gjr-metric{
            min-height:84px;
            padding:10px 6px;
          }

          .gjr-metric b{
            font-size:21px;
          }

          .gjr-metric span{
            font-size:12px;
          }

          .gjr-review,
          .gjr-next{
            border-radius:20px;
            padding:12px;
          }

          .gjr-review h2,
          .gjr-next h2{
            font-size:16px;
          }

          .gjr-review li b{
            font-size:13px;
          }

          .gjr-actions{
            grid-template-columns:1fr;
          }

          .gjr-btn{
            padding:13px 10px;
            border-radius:19px;
            font-size:15px;
          }
        }
      `;
      DOC.head.appendChild(css);
    }

    bindButtons();
    return root;
  }

  function bindButtons(){
    const closeBtn = DOC.getElementById('gjrCloseBtn');
    const replayBtn = DOC.getElementById('gjrReplayBtn');
    const zoneBtn = DOC.getElementById('gjrZoneBtn');

    if(closeBtn && !closeBtn.dataset.bound){
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', hideSummary);
    }

    if(replayBtn && !replayBtn.dataset.bound){
      replayBtn.dataset.bound = '1';
      replayBtn.addEventListener('click', replay);
    }

    if(zoneBtn && !zoneBtn.dataset.bound){
      zoneBtn.dataset.bound = '1';
      zoneBtn.addEventListener('click', backToZone);
    }
  }

  function render(summary){
    ensureLayer();

    const icon = resultIcon(summary);
    const title = resultTitle(summary);

    setText('gjrIcon', icon);
    setText('gjrTitle', title);
    setText('gjrStars', starText(summary.stars));
    setText('gjrMessage', summary.message);
    setText('gjrRank', summary.rank);
    setText('gjrBadge', summary.badge);
    setText('gjrCoins', `+${summary.coins} 🪙`);

    const metrics = DOC.getElementById('gjrMetrics');
    if(metrics){
      metrics.innerHTML = [
        metricCard('คะแนน', summary.score, 'รวมภารกิจและคอมโบ'),
        metricCard('ความแม่นยำ', `${summary.accuracy}%`, 'เลือกอาหารดี'),
        metricCard('คอมโบสูงสุด', `x${summary.maxCombo}`, 'ต่อเนื่องที่สุด'),
        metricCard('ภารกิจสำเร็จ', summary.missionDoneCount, 'mission ระหว่างบอส'),
        metricCard('อาหารดี', summary.goodHits, 'เลือกถูก'),
        metricCard('แตะ junk', summary.junkHits, 'ควรลดลง'),
        metricCard('อาหารหลอกตา', summary.fakeHits, 'ต้องสังเกตเพิ่ม'),
        metricCard('บอสโจมตี', summary.attackCount, 'รอดจากแรงกดดัน')
      ].join('');
    }

    const tips = DOC.getElementById('gjrTips');
    if(tips){
      tips.innerHTML = tipList(summary.learningTips);
    }

    const next = buildNextMission(summary);
    setText('gjrNextTitle', next.title);
    setText('gjrNextText', next.text);
  }

  function setText(id, value){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(value ?? '');
  }

  function buildNextMission(s){
    if(s.fakeHits > 0){
      return {
        title:'ภารกิจรอบหน้า: จับอาหารหลอกตา',
        text:'ลองดูให้ดีว่าอาหารที่ดูเหมือนดี มีน้ำตาล น้ำมัน หรือซอสแฝงมากเกินไปหรือไม่'
      };
    }

    if(s.junkHits > 2){
      return {
        title:'ภารกิจรอบหน้า: หลบ junk ให้แม่นขึ้น',
        text:'พยายามไม่แตะของทอด น้ำหวาน และขนมหวาน เพื่อไม่ให้บอสฟื้นพลัง'
      };
    }

    if(s.maxCombo < 8){
      return {
        title:'ภารกิจรอบหน้า: ทำ Combo x8',
        text:'เก็บอาหารดีต่อเนื่อง จะโจมตีบอสแรงขึ้นและได้คะแนนมากขึ้น'
      };
    }

    if(!s.defeated){
      return {
        title:'ภารกิจรอบหน้า: ปิดฉากบอส',
        text:'ทำภารกิจย่อยให้สำเร็จ แล้วใช้คอมโบโจมตีตอนบอสเลือดต่ำ'
      };
    }

    return {
      title:'ภารกิจรอบหน้า: ชนะให้ได้ 5 ดาว',
      text:'รักษาคอมโบสูง หลบ junk และอย่าโดนอาหารหลอกตา เพื่อเป็น Nutrition Champion'
    };
  }

  function showSummary(extra){
    if(extra) mergeData(extra);

    const summary = calculateSummary();

    state.shown = true;
    state.ended = true;

    render(summary);

    const root = ensureLayer();
    root.classList.add('show');

    saveSummary(summary);

    WIN.dispatchEvent(new CustomEvent('gj:reward-summary-shown', {
      detail:summary
    }));

    return summary;
  }

  function scheduleShow(reason, delay){
    if(state.shown) return;

    clearTimeout(state.showTimer);

    state.showTimer = setTimeout(() => {
      showSummary({ reason:reason || 'scheduled-end' });
    }, Number(delay) || 850);
  }

  function hideSummary(){
    const root = DOC.getElementById('gjRewardLayer');
    if(root) root.classList.remove('show');
  }

  function safeBackUrl(){
    const hub = qs('hub', '');
    const fallback = '../nutrition-zone.html';

    if(!hub) return fallback;

    try{
      const decoded = decodeURIComponent(hub);
      const url = new URL(decoded, location.href);

      if(url.origin === location.origin){
        return url.href;
      }

      if(url.hostname === 'supparang.github.io'){
        return url.href;
      }

      return fallback;
    }catch(e){
      return fallback;
    }
  }

  function replay(){
    const url = new URL(location.href);

    url.searchParams.set('seed', String(Date.now()));
    url.searchParams.set('run', 'play');

    // กัน browser ใช้ state เดิมเยอะเกินไป
    url.searchParams.set('r', String(Date.now()).slice(-6));

    location.href = url.href;
  }

  function backToZone(){
    location.href = safeBackUrl();
  }

  function saveSummary(summary){
    const payload = {
      ...summary,
      gameId:'goodjunk',
      mode:'solo_boss',
      source:'goodjunk-solo-boss',
      patch:PATCH,
      pageUrl:location.href
    };

    saveJson(STORE_KEY, payload);

    saveJson(HHA_LAST_KEY, {
      type:'game-summary',
      zone:'nutrition',
      gameId:'goodjunk',
      mode:'solo_boss',
      title:'GoodJunk Solo Boss',
      stars:summary.stars,
      score:summary.score,
      rank:summary.rank,
      badge:summary.badge,
      defeated:summary.defeated,
      accuracy:summary.accuracy,
      savedAt:summary.savedAt,
      backUrl:safeBackUrl(),
      payload
    });
  }

  function start(){
    state.started = true;
    state.ended = false;
    state.shown = false;
    clearTimeout(state.showTimer);

    state.data = {
      patch:PATCH,
      defeated:false,
      hp:0,
      hpMax:0,
      phaseCount:0,
      missionDoneCount:0,
      maxCombo:0,
      goodHits:0,
      junkHits:0,
      fakeHits:0,
      misses:0,
      scoreBonus:0,
      totalDamage:0,
      hitCount:0,
      attackCount:0,
      frenzy:false,
      learningTips:[],
      reason:''
    };

    ensureLayer();
  }

  function onUltimateSummary(e){
    mergeData(e.detail || {});
  }

  function onDramaSummary(e){
    mergeData(e.detail || {});
  }

  function onBossDefeated(e){
    mergeData({
      ...(e.detail || {}),
      defeated:true,
      reason:'boss-defeated'
    });

    scheduleShow('boss-defeated', 1150);
  }

  function onGameEnd(e){
    mergeData(e.detail || {});
    scheduleShow('game-end', 700);
  }

  function onItemHit(e){
    const d = e.detail || {};
    const item = d.food || d.item || d;
    const type = String(d.type || item.type || item.kind || '').toLowerCase();

    if(type === 'good') state.data.goodHits = n(state.data.goodHits) + 1;
    else if(type === 'junk' || type === 'bad'){
      state.data.junkHits = n(state.data.junkHits) + 1;
      state.data.misses = n(state.data.misses) + 1;
    }else if(type === 'fake' || type === 'trap' || type === 'fakehealthy'){
      state.data.fakeHits = n(state.data.fakeHits) + 1;
      state.data.misses = n(state.data.misses) + 1;
    }
  }

  function onMissGood(){
    state.data.misses = n(state.data.misses) + 1;
  }

  function onComboStrike(e){
    const combo = n(e.detail && e.detail.combo);
    state.data.maxCombo = Math.max(n(state.data.maxCombo), combo);
  }

  function onMissionComplete(e){
    const count = n(e.detail && e.detail.missionDoneCount);
    state.data.missionDoneCount = Math.max(n(state.data.missionDoneCount), count || n(state.data.missionDoneCount) + 1);
  }

  WIN.GoodJunkSoloBossReward = {
    version:PATCH,
    start,
    showSummary,
    hideSummary,
    scheduleShow,
    replay,
    backToZone,
    mergeData,
    calculateSummary,
    getState:()=>JSON.parse(JSON.stringify(state))
  };

  WIN.addEventListener('gj:game-start', start);
  WIN.addEventListener('gj:boss-start', start);
  WIN.addEventListener('gj:solo-boss-start', start);

  WIN.addEventListener('gj:item-hit', onItemHit);
  WIN.addEventListener('gj:hit-good', onItemHit);
  WIN.addEventListener('gj:hit-junk', onItemHit);
  WIN.addEventListener('gj:hit-fake', onItemHit);
  WIN.addEventListener('gj:miss-good', onMissGood);

  WIN.addEventListener('gj:ultimate-combo-strike', onComboStrike);
  WIN.addEventListener('gj:ultimate-mission-complete', onMissionComplete);
  WIN.addEventListener('gj:ultimate-summary', onUltimateSummary);

  WIN.addEventListener('gj:boss-hp-change', e => {
    const d = e.detail || {};
    state.data.totalDamage = Math.max(n(state.data.totalDamage), n(d.damage) + n(state.data.totalDamage));
    if(n(d.hp) <= 0) state.data.defeated = true;
  });

  WIN.addEventListener('gj:boss-frenzy', () => {
    state.data.frenzy = true;
  });

  WIN.addEventListener('gj:boss-drama-summary', onDramaSummary);
  WIN.addEventListener('gj:boss-defeated', onBossDefeated);

  WIN.addEventListener('gj:game-end', onGameEnd);
  WIN.addEventListener('gj:boss-end', onGameEnd);

  DOC.addEventListener('DOMContentLoaded', ensureLayer);
})();