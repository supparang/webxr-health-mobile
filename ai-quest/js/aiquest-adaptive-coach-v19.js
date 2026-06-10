/*
  CSAI2102 AI Quest
  PATCH v1.9 Adaptive Difficulty + Misconception Coach
  ------------------------------------------------------------
  ใช้ร่วมกับ v1.8 Gate + Support
  จุดประสงค์:
  - ตรวจ pattern ความผิดระหว่างเล่น
  - ให้คำแนะนำเฉพาะ misconception
  - แนะนำ Practice / Remedial / Challenge
  - ใช้เป็นชั้นกลางก่อนต่อ Teacher Dashboard
*/
(function(){
  'use strict';

  const VERSION = 'v1.9-adaptive-coach';
  const STORE_KEY = 'CSAI2102_AIQUEST_ADAPTIVE_V19';

  const MISCONCEPTION_TIPS = {
    automation: {
      title:'Automation ≠ AI',
      short:'ระบบอัตโนมัติอาจทำงานเองได้ แต่ยังไม่ใช่ AI เสมอไป',
      coach:'ถามตัวเองว่า ระบบนี้เรียนรู้/ทำนาย/จำแนกจากข้อมูลหรือเพียงทำตามเงื่อนไขที่ตั้งไว้?'
    },
    sensor: {
      title:'Sensor เป็น input ไม่ใช่ AI โดยตัวมันเอง',
      short:'มี sensor ไม่ได้แปลว่าเป็น AI',
      coach:'sensor ช่วยรับข้อมูล แต่ต้องดูว่ามีการวิเคราะห์/เรียนรู้/ตัดสินใจจากข้อมูลหรือไม่'
    },
    database: {
      title:'Database / Retrieval ≠ Intelligence',
      short:'ฐานข้อมูลมากไม่ได้แปลว่าเป็น AI',
      coach:'ถ้าระบบแค่ค้นคืนข้อมูล อาจเป็น retrieval แต่ AI ต้องมีการใช้ข้อมูลเพื่อทำนาย/จำแนก/สร้างผลลัพธ์'
    },
    rulebased: {
      title:'Rule-based ≠ Learning-based',
      short:'If-Then ที่กำหนดไว้ล่วงหน้าไม่ใช่ machine learning',
      coach:'ถ้าพฤติกรรมถูกกำหนดตายตัวทุกกรณี ให้ระวังว่าเป็น rule-based system'
    },
    internet: {
      title:'Internet-connected ≠ AI',
      short:'เชื่อมต่ออินเทอร์เน็ตไม่ได้เป็นเกณฑ์ตัดสิน AI',
      coach:'ระบบ AI อาจออนไลน์หรือออฟไลน์ก็ได้ เกณฑ์สำคัญคือวิธีประมวลผลข้อมูล'
    },
    generative_vs_retrieval: {
      title:'Generative ≠ Retrieval',
      short:'การสร้างคำตอบใหม่ต่างจากการดึงคำตอบเดิม',
      coach:'Generative AI สร้างผลลัพธ์จากแบบจำลอง ส่วน retrieval ดึงคำตอบจากคลังข้อมูล'
    },
    prediction: {
      title:'Prediction ต้องอาศัย pattern',
      short:'การคำนวณตามสูตรไม่เท่ากับการทำนายด้วยโมเดล',
      coach:'ดูว่าระบบเรียนรู้ pattern จากข้อมูลเดิมเพื่อคาดการณ์สิ่งใหม่หรือไม่'
    },
    ethics: {
      title:'AI ต้องตรวจสอบได้',
      short:'AI ไม่ได้ถูกเสมอและอาจมี bias',
      coach:'คำตอบของ AI ต้องตรวจสอบแหล่งข้อมูล ความถูกต้อง อคติ และผลกระทบต่อผู้ใช้'
    },
    general: {
      title:'ทบทวนเกณฑ์ AI',
      short:'AI มักเกี่ยวกับข้อมูล การเรียนรู้ การทำนาย การจำแนก หรือการสร้างผลลัพธ์',
      coach:'ลองแยกว่า ระบบนี้แค่ทำตามคำสั่ง หรือใช้ข้อมูลเพื่อปรับ/ตัดสินใจอย่างมีเหตุผล'
    }
  };

  function nowIso(){
    return new Date().toISOString();
  }

  function defaultState(){
    return {
      version: VERSION,
      updatedAt: nowIso(),
      streakCorrect:0,
      streakWrong:0,
      recent:[],
      misconceptionCount:{},
      supportActions:[],
      challengeUnlocked:false
    };
  }

  function load(){
    try{
      return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
    }catch(error){
      return defaultState();
    }
  }

  function save(state){
    state.updatedAt = nowIso();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function normalizeMis(raw){
    if(!raw) return 'general';
    const s = String(raw).toLowerCase();
    if(s.includes('automation')) return 'automation';
    if(s.includes('sensor')) return 'sensor';
    if(s.includes('database') || s.includes('retrieval')) return 'database';
    if(s.includes('rule')) return 'rulebased';
    if(s.includes('internet')) return 'internet';
    if(s.includes('generative')) return 'generative_vs_retrieval';
    if(s.includes('predict')) return 'prediction';
    if(s.includes('ethic') || s.includes('bias')) return 'ethics';
    return s || 'general';
  }

  function recordAnswer(evt){
    const state = load();
    const ok = !!evt.isCorrect;
    const mis = normalizeMis(evt.misconception || evt.extraJson?.misconception || evt.extraJson?.misconceptionKey || evt.misKey);

    if(ok){
      state.streakCorrect += 1;
      state.streakWrong = 0;
    }else{
      state.streakWrong += 1;
      state.streakCorrect = 0;
      state.misconceptionCount[mis] = (state.misconceptionCount[mis] || 0) + 1;
    }

    state.recent.push({
      at: nowIso(),
      phase: evt.phase || '',
      itemId: evt.itemId || '',
      ok,
      misconception: ok ? '' : mis
    });

    state.recent = state.recent.slice(-12);

    const advice = getAdaptiveAdvice(state, evt);
    if(advice.action){
      state.supportActions.push({
        at: nowIso(),
        action: advice.action,
        message: advice.message,
        misconception: advice.misconception || ''
      });
      state.supportActions = state.supportActions.slice(-30);
    }

    if(state.streakCorrect >= 5){
      state.challengeUnlocked = true;
    }

    save(state);
    return advice;
  }

  function getAdaptiveAdvice(state, evt){
    if(state.streakWrong >= 3){
      const hot = topMisconception(state);
      const tip = MISCONCEPTION_TIPS[hot] || MISCONCEPTION_TIPS.general;
      return {
        action:'coach_intervention',
        level:'support',
        misconception: hot,
        title: tip.title,
        message: `${tip.short} — ${tip.coach}`,
        addTime: 10,
        suggestPractice:true
      };
    }

    if(state.streakWrong >= 2){
      const hot = topMisconception(state);
      const tip = MISCONCEPTION_TIPS[hot] || MISCONCEPTION_TIPS.general;
      return {
        action:'micro_hint',
        level:'hint',
        misconception: hot,
        title: tip.title,
        message: tip.coach,
        addTime: 5
      };
    }

    if(state.streakCorrect >= 5){
      return {
        action:'challenge_card',
        level:'challenge',
        title:'Challenge Ready',
        message:'ตอบถูกต่อเนื่อง ระบบพร้อมเพิ่ม Challenge Card หรือ Hard Choice'
      };
    }

    return {
      action:'',
      level:'normal',
      message:''
    };
  }

  function topMisconception(state){
    const entries = Object.entries(state.misconceptionCount || {});
    if(!entries.length) return 'general';
    entries.sort((a,b) => b[1] - a[1]);
    return entries[0][0] || 'general';
  }

  function getCoachReport(){
    const state = load();
    const hot = topMisconception(state);
    const tip = MISCONCEPTION_TIPS[hot] || MISCONCEPTION_TIPS.general;
    return {
      version: VERSION,
      streakCorrect: state.streakCorrect,
      streakWrong: state.streakWrong,
      challengeUnlocked: state.challengeUnlocked,
      topMisconception: hot,
      tip,
      misconceptionCount: state.misconceptionCount,
      recent: state.recent,
      supportActions: state.supportActions
    };
  }

  function reset(){
    localStorage.removeItem(STORE_KEY);
    return load();
  }

  function renderCoachPanel(container){
    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if(!target) return;

    const report = getCoachReport();
    const counts = Object.entries(report.misconceptionCount || {})
      .sort((a,b) => b[1] - a[1])
      .map(([k,v]) => `<span class="scoreChip">${k}: ${v}</span>`)
      .join('');

    target.innerHTML = `
      <div class="coachBox">
        <b>Adaptive Coach ${VERSION}</b><br>
        <b>จุดที่ควรระวัง:</b> ${report.tip.title}<br>
        ${report.tip.coach}<br>
        <b>Streak:</b> ถูก ${report.streakCorrect} | ผิด ${report.streakWrong}
        ${report.challengeUnlocked ? '<br><b>Challenge:</b> ปลดล็อก Challenge Card แล้ว' : ''}
      </div>
      <div class="scoreLine">
        ${counts || '<span class="scoreChip">ยังไม่มี misconception ที่บันทึก</span>'}
      </div>
    `;
  }

  window.AIQuestAdaptiveCoach = {
    VERSION,
    MISCONCEPTION_TIPS,
    load,
    save,
    recordAnswer,
    getAdaptiveAdvice,
    getCoachReport,
    renderCoachPanel,
    reset
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
