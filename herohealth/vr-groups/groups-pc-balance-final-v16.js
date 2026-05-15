// === /herohealth/vr-groups/groups-pc-balance-final-v16.js ===
// HeroHealth Groups PC — v1.6 Balance Final
// Adds final visual balance, difficulty coach, pacing feedback, QA-ready PC tuning summary.

(function(){
  'use strict';

  const VERSION = 'v1.6-pc-balance-final-20260514';
  if(window.__HHA_GROUPS_PC_BALANCE_V16__) return;
  window.__HHA_GROUPS_PC_BALANCE_V16__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    tipsShown:{},
    lastTipAt:0,
    timer:null,
    lastSummary:null
  };

  const $ = id => DOC.getElementById(id);

  function api(){ return WIN.HHA_GROUPS_PC_V1 || null; }

  function gs(){
    try{
      const a = api();
      return a && typeof a.getState === 'function' ? (a.getState() || {}) : {};
    }catch(e){ return {}; }
  }

  function injectStyle(){
    if($('groups-pc-v16-style')) return;

    const s = DOC.createElement('style');
    s.id = 'groups-pc-v16-style';
    s.textContent = `
      /*
        PC v1.6 final balance polish:
        wider arena readability, clearer gates, less visual collision with add-on HUDs.
      */
      @media (min-width:1000px){
        .arena-wrap{
          top:222px !important;
          bottom:142px !important;
          grid-template-columns:1fr 300px !important;
        }

        .fall-item{
          width:82px !important;
          height:82px !important;
          font-size:45px !important;
        }

        .gates{
          bottom:18px !important;
          gap:14px !important;
        }

        .gate{
          min-height:108px !important;
        }

        .gate .label{
          font-size:20px !important;
        }
      }

      @media (max-height:760px){
        .topbar{top:10px !important;}
        .mission-card{padding:9px 12px !important;border-radius:22px !important;}
        .wave-title{font-size:23px !important;}
        .wave-sub{font-size:13px !important;}

        .meter-zone{
          top:92px !important;
        }

        .pc-v11-bossbar{
          top:142px !important;
        }

        .pc-v12-card{
          top:188px !important;
        }

        .pc-v13-card{
          top:242px !important;
        }

        .arena-wrap{
          top:244px !important;
          bottom:126px !important;
        }

        .gate{
          min-height:86px !important;
          padding:8px 6px !important;
        }

        .gate .num{
          width:30px !important;
          height:30px !important;
          font-size:16px !important;
        }

        .gate .label{
          font-size:16px !important;
        }

        .gate .hint{
          display:none !important;
        }
      }

      .pc-v16-coach{
        position:absolute;
        left:18px;
        top:268px;
        z-index:47;
        width:min(360px,30vw);
        border-radius:26px;
        padding:13px;
        background:rgba(255,255,255,.93);
        border:2px solid rgba(255,255,255,.94);
        box-shadow:0 18px 48px rgba(35,81,107,.16);
        pointer-events:none;
        display:none;
      }

      body.playing .pc-v16-coach.show{
        display:block;
        animation:pcv16Coach .28s ease both;
      }

      @keyframes pcv16Coach{
        from{opacity:0;transform:translateY(8px);}
        to{opacity:1;transform:translateY(0);}
      }

      .pc-v16-coach b{
        display:block;
        color:#244e68;
        font-size:15px;
        line-height:1.15;
        font-weight:1000;
      }

      .pc-v16-coach span{
        display:block;
        margin-top:5px;
        color:#7193a8;
        font-size:12px;
        line-height:1.3;
        font-weight:850;
      }

      .pc-v16-summary{
        margin-top:12px;
        border-radius:24px;
        padding:14px;
        background:linear-gradient(180deg,#f7fdff,#ffffff);
        border:2px solid #d7edf7;
      }

      .pc-v16-summary h3{
        margin:0;
        font-size:18px;
        font-weight:1000;
        color:#244e68;
      }

      .pc-v16-summary p{
        margin:7px 0 0;
        color:#7193a8;
        font-size:14px;
        line-height:1.38;
        font-weight:850;
      }
    `;
    DOC.head.appendChild(s);
  }

  function ensureCoach(){
    const game = $('game');
    if(!game || $('pcv16Coach')) return;

    const c = DOC.createElement('div');
    c.id = 'pcv16Coach';
    c.className = 'pc-v16-coach';
    c.innerHTML = `<b>PC Coach</b><span>ใช้คลิกเลือกอาหาร แล้วกดเลข 1–5 เพื่อส่งเข้าหมู่เร็วขึ้น</span>`;
    game.appendChild(c);
  }

  function showTip(key, title, text, ms=3800){
    const now = Date.now();
    if(state.tipsShown[key]) return;
    if(now - state.lastTipAt < 5200) return;

    const c = $('pcv16Coach');
    if(!c) return;

    state.tipsShown[key] = true;
    state.lastTipAt = now;

    c.innerHTML = `<b>${title}</b><span>${text}</span>`;
    c.classList.add('show');

    clearTimeout(c.__timer);
    c.__timer = setTimeout(()=>c.classList.remove('show'), ms);
  }

  function poll(){
    const s = gs();
    if(!s || s.mode !== 'game' || s.ended) return;

    const combo = Number(s.combo || 0);
    const miss = Number(s.miss || 0);
    const items = Number(s.items || 0);
    const phase = s.phase || 'calm';

    if(items >= 5){
      showTip('manyItems','⚡ หลายเลนแล้ว!', 'กดเลข 1–5 ช่วยส่งอาหารได้เร็วกว่าเมาส์อย่างเดียว');
    }

    if(combo >= 6){
      showTip('combo','🔥 คอมโบกำลังมา!', 'รักษาจังหวะต่อเนื่อง จะเข้า Fever ได้เร็วขึ้น');
    }

    if(miss >= 2){
      showTip('support','🌱 ใจเย็นก่อน', 'เลือกอาหารที่ต่ำใกล้พื้นก่อน แล้วค่อยเก็บชิ้นถัดไป');
    }

    if(phase === 'boss'){
      showTip('boss','👑 Boss Rush!', 'ตอน Boss ให้โฟกัสชิ้นที่ตกต่ำสุดก่อน อย่าเสียหัวใจ');
    }
  }

  function recommendation(summary){
    const acc = Number(summary.accuracy || 0);
    const combo = Number(summary.bestCombo || 0);
    const score = Number(summary.score || 0);
    const miss = Number(summary.miss || 0);

    if(acc < 70) return 'Balance: ความแม่นยำยังต่ำ แนะนำเริ่มที่ easy/normal และใช้ปุ่มเลข 1–5';
    if(miss >= 5) return 'Balance: พลาดค่อนข้างมาก แนะนำลดความเร็วหรือเล่นโหมดซ้อมก่อน';
    if(combo < 8) return 'Balance: คอมโบยังไม่ต่อเนื่อง แนะนำเลือกอาหารที่ต่ำใกล้พื้นก่อน';
    if(score > 900 && acc >= 90) return 'Balance: ผู้เล่นเก่งมาก รอบถัดไปควรใช้ hard/challenge';
    return 'Balance: ระดับเกมเหมาะสมสำหรับ PC Solo แล้ว';
  }

  function appendSummary(detail){
    setTimeout(()=>{
      let summary = detail;

      try{
        if(!summary){
          const raw = localStorage.getItem('HHA_GROUPS_PC_SUMMARY');
          if(raw) summary = JSON.parse(raw);
        }
      }catch(e){}

      if(!summary) return;
      state.lastSummary = summary;

      const card = DOC.querySelector('.summary-card');
      if(!card) return;

      let box = $('pcv16Summary');
      if(!box){
        box = DOC.createElement('div');
        box.id = 'pcv16Summary';
        box.className = 'pc-v16-summary';
        const actions = card.querySelector('.actions');
        card.insertBefore(box, actions);
      }

      const text = recommendation(summary);

      box.innerHTML = `
        <h3>✅ PC v1.6 Balance Final</h3>
        <p>${text}<br>สถานะ: PC Solo พร้อมเข้าสู่รอบทดสอบจริง 3–5 รอบ</p>
      `;

      try{
        summary.pcBalanceFinal = {
          version:VERSION,
          recommendation:text,
          qaReady:true
        };
        localStorage.setItem('HHA_GROUPS_PC_SUMMARY', JSON.stringify(summary));
      }catch(e){}
    }, 360);
  }

  function expose(){
    WIN.HHA_GROUPS_PC_V16_BALANCE = {
      version:VERSION,
      showTip,
      getState:()=>({
        version:VERSION,
        lastSummary:state.lastSummary,
        tipsShown:Object.assign({}, state.tipsShown)
      })
    };
  }

  function init(){
    injectStyle();
    ensureCoach();

    state.timer = setInterval(poll, 900);

    WIN.addEventListener('groups:end', ev=>appendSummary(ev.detail || null));
    WIN.addEventListener('hha:summary-enriched', ev=>appendSummary(ev.detail || null));

    expose();

    console.info('[Groups PC v1.6] balance final installed', VERSION);
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
