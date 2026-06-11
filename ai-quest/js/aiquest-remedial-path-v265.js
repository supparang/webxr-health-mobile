/*
  CSAI2102 AI Quest
  PATCH v2.6.5 Remedial Diagnostic Review
  ------------------------------------------------------------
  Fixes v2.6.4 problem:
  - choices were too easy because options began with obvious "ถูก/ไม่ถูก"
  - review felt like guessable quiz, not real remediation
  v2.6.5 changes review to diagnostic reasoning:
  - no "ถูก/ไม่ถูก" prefixes in choices
  - all options are plausible misconceptions
  - AI vs Automation uses curated diagnostic scenarios, not raw boss claims
  - still non-graded and optional
*/
(function(){
  'use strict';

  const VERSION = 'v2.6.5-remedial-diagnostic';
  const STATE_KEY = 'CSAI2102_AIQUEST_PRES3_REMEDIAL_V265';
  const RECENT_KEY = 'CSAI2102_AIQUEST_PRES3_RECENT_FAMILIES_V265';

  const AUTOMATION_DIAGNOSTIC_BANK = [
    {
      id:'auto_diag_001',
      familyId:'timer_automation',
      prompt:'นาฬิกาปลุกที่ดังเวลา 07:00 ทุกวัน ควรจัดประเภทอย่างไรเมื่อเทียบกับ intelligent agent?',
      correct:'เป็นระบบอัตโนมัติแบบตั้งเวลา ยังไม่พอเรียกว่า intelligent agent เพราะไม่ได้รับ percept จาก environment เพื่อเลือก action ตาม goal',
      why:'การทำงานตามเวลาไม่เท่ากับ agent reasoning ต้องดู percept-action-goal loop',
      distractors:[
        'เป็น simple reflex agent แน่นอน เพราะเวลา 07:00 ถือเป็น percept และเสียงปลุกเป็น action',
        'เป็น rational agent เพราะช่วยให้ผู้ใช้ตื่นตรงเวลาได้ตาม goal',
        'เป็น AI เพราะทำงานอัตโนมัติโดยไม่ต้องมีมนุษย์กดทุกครั้ง'
      ]
    },
    {
      id:'auto_diag_002',
      familyId:'threshold_system',
      prompt:'เครื่องตรวจควันที่ส่งเสียงเมื่อค่าควันเกิน threshold สรุปแบบใดรอบคอบที่สุด?',
      correct:'เป็นระบบ rule/threshold หรือ simple reflex ได้ แต่ยังไม่ควรสรุปว่าเป็น intelligent agent ขั้นสูงถ้าไม่มีการประเมินบริบทและเลือก action',
      why:'threshold อย่างเดียวเป็นเงื่อนไขตายตัว ต้องดูว่าระบบเลือก action หลายแบบจากบริบทหรือไม่',
      distractors:[
        'เป็น AI ทันที เพราะมี sensor ตรวจจับควัน',
        'เป็น rational agent เสมอ เพราะเลือกเตือนเมื่อมีอันตราย',
        'ไม่เกี่ยวกับ agent เลย เพราะไม่มีหน้าจอหรือฐานข้อมูล'
      ]
    },
    {
      id:'auto_diag_003',
      familyId:'database_lookup',
      prompt:'เว็บค้นฐานข้อมูลรายวิชาแล้วแสดงผลตาม keyword ของผู้ใช้ คำอธิบายใดเหมาะสมที่สุด?',
      correct:'เป็น information retrieval/lookup เป็นหลัก ยังไม่พอเรียกว่า intelligent agent ถ้าไม่ได้เลือก action ตาม performance measure',
      why:'การค้นและแสดงข้อมูลไม่เท่ากับการมี goal-directed action selection',
      distractors:[
        'เป็น intelligent agent เพราะมีข้อมูลใน database จำนวนมาก',
        'เป็น AI เพราะ keyword แต่ละคนไม่เหมือนกัน',
        'เป็น rational agent เพราะตอบสนองคำถามของผู้ใช้ได้เร็ว'
      ]
    },
    {
      id:'auto_diag_004',
      familyId:'rulebased_many_rules',
      prompt:'ระบบมี if-else 500 กฎเพื่อคัดแยกคำร้องเรียน ควรตีความอย่างไร?',
      correct:'อาจเป็น rule-based system ที่ซับซ้อน แต่จำนวนกฎมากไม่ได้พิสูจน์ว่าเป็น AI ที่เรียนรู้หรือ rational agent',
      why:'ความซับซ้อนของกฎไม่ใช่ตัวชี้ขาด ต้องดู learning, model, goal และการเลือก action',
      distractors:[
        'ยิ่งมีกฎมาก ยิ่งเป็น AI ระดับสูง',
        'ถ้ามีกฎมากพอ จะกลายเป็น machine learning โดยอัตโนมัติ',
        'ถ้าไม่มีหุ่นยนต์ก็ไม่เกี่ยวกับ agent'
      ]
    },
    {
      id:'auto_diag_005',
      familyId:'software_agent',
      prompt:'ระบบ spam filter รับอีเมลแล้วตัดสินใจย้ายไป spam/junk ควรอธิบายอย่างไร?',
      correct:'เป็น software agent ได้ เพราะรับ percept เป็นอีเมลและมี action เป็นการจัดหมวดหมู่/ย้ายกล่องตาม goal ลด spam',
      why:'agent ไม่จำเป็นต้องเป็นหุ่นยนต์ software ก็มี percept และ action ได้',
      distractors:[
        'ไม่เป็น agent เพราะไม่มีแขนกลหรือการเคลื่อนที่',
        'เป็นแค่ database เพราะอีเมลเป็นข้อมูล',
        'เป็น AI ก็ต่อเมื่อมีหน้าจอสวยและตอบแบบ chatbot ได้'
      ]
    },
    {
      id:'auto_diag_006',
      familyId:'random_not_ai',
      prompt:'แอปสุ่มคำคมขึ้นมาแต่ละครั้งไม่เหมือนกัน ควรมองอย่างไร?',
      correct:'การสุ่มทำให้ผลไม่ตายตัว แต่ยังไม่ใช่ intelligence ถ้าไม่มี goal, feedback หรือ reasoning ที่เลือกคำคมให้เหมาะบริบท',
      why:'randomness ไม่เท่ากับ rationality หรือ learning',
      distractors:[
        'เป็น AI เพราะผลลัพธ์ไม่ซ้ำและคาดเดายาก',
        'เป็น agent เพราะมี output ทุกครั้งที่กด',
        'เป็น rational agent เพราะช่วยสร้างแรงบันดาลใจ'
      ]
    },
    {
      id:'auto_diag_007',
      familyId:'sensor_agent',
      prompt:'ระบบเปิดไฟเมื่อ motion sensor เจอคนเดินผ่าน อธิบายอย่างไรให้ไม่เหมารวมเกินไป?',
      correct:'ถ้าเปิด/ปิดตาม sensor ตายตัวคือ automation/simple reflex เป็นหลัก จะเป็น agent ที่ซับซ้อนขึ้นเมื่อใช้บริบทและ goal หลายด้านในการเลือก action',
      why:'sensor เป็นแค่ช่องรับ percept ไม่ได้พิสูจน์ intelligence ทั้งระบบ',
      distractors:[
        'เป็น intelligent agent ทุกกรณี เพราะมี sensor',
        'ไม่เกี่ยวกับ agent เพราะไฟไม่ใช่หุ่นยนต์',
        'เป็น rational agent เสมอเพราะประหยัดแรงคน'
      ]
    },
    {
      id:'auto_diag_008',
      familyId:'robot_only',
      prompt:'ถ้าระบบไม่มีร่างกาย แต่แนะนำวิดีโอให้ผู้ใช้ตามพฤติกรรมการดู ควรอธิบายอย่างไร?',
      correct:'เป็น software agent/recommender ได้ เพราะรับ percept จากพฤติกรรมผู้ใช้และ action คือการจัดอันดับ/แนะนำวิดีโอ',
      why:'action ของ agent อาจเป็น ranking/recommendation ไม่จำเป็นต้องเป็นการเคลื่อนที่',
      distractors:[
        'ไม่เป็น agent เพราะไม่มี sensor ทางกายภาพ',
        'เป็น automation เท่านั้น เพราะอยู่ในเว็บไซต์',
        'เป็น agent เฉพาะตอนผู้ใช้กดปุ่ม ไม่ใช่ตอนระบบแนะนำเอง'
      ]
    },
    {
      id:'auto_diag_009',
      familyId:'goal_missing',
      prompt:'ระบบตอบกลับข้อความทุกครั้งด้วย template เดิม ควรวิเคราะห์จุดใดก่อนเรียกว่า agent?',
      correct:'ต้องดูว่ามี goal/performance measure และเลือก action ตาม percept หรือไม่ ไม่ใช่แค่มี output ตอบกลับ',
      why:'output อย่างเดียวไม่พอ ต้องมีความสัมพันธ์ระหว่าง percept, action และ goal',
      distractors:[
        'มี output จึงเป็น agent โดยอัตโนมัติ',
        'ตอบข้อความได้จึงเป็น LLM แน่นอน',
        'ถ้า template เขียนไว้ดีพอ ก็เป็น rational agent เสมอ'
      ]
    },
    {
      id:'auto_diag_010',
      familyId:'actuator_confusion',
      prompt:'ระบบแจ้งเตือนความเสี่ยงน้ำท่วมผ่านข้อความ LINE มี actuator หรือไม่?',
      correct:'มีได้ เพราะ actuator คือช่องทางที่ agent กระทำต่อ environment เช่น ข้อความเตือน ไม่จำเป็นต้องเป็นมอเตอร์',
      why:'actuator ใน software อาจเป็น notification, recommendation, ranking หรือ message',
      distractors:[
        'ไม่มี actuator เพราะไม่มีแขนกล',
        'ไม่มี action เพราะเป็นแค่ข้อความ',
        'มี actuator เฉพาะถ้าควบคุมประตูน้ำจริงเท่านั้น'
      ]
    },
    {
      id:'auto_diag_011',
      familyId:'prediction_action',
      prompt:'ระบบทำนายว่านักศึกษาเสี่ยงตก แต่ไม่แจ้งเตือนหรือแนะนำอะไร ควรมองอย่างไร?',
      correct:'มี prediction แต่ยังไม่ครบ agent action loop ถ้าไม่มี action หรือ decision ที่ใช้ prediction ตาม performance measure',
      why:'prediction ไม่เท่ากับ action การเป็น agent ต้องดูการนำผลทำนายไปใช้ตัดสินใจ',
      distractors:[
        'เป็น agent สมบูรณ์เพราะทำนายได้แล้ว',
        'เป็น rational agent เพราะรู้อนาคตของผู้เรียน',
        'ไม่เกี่ยวกับ AI เพราะไม่มีหุ่นยนต์'
      ]
    },
    {
      id:'auto_diag_012',
      familyId:'learning_required',
      prompt:'ระบบ expert system ใช้กฎจากผู้เชี่ยวชาญและเลือกคำแนะนำได้ แต่ไม่เรียนรู้เอง ควรอธิบายอย่างไร?',
      correct:'ยังเป็น agent/rule-based AI ได้ในบางบริบท แม้ไม่ได้เรียนรู้เอง แต่ต้องยอมรับว่าความสามารถปรับตัวจำกัด',
      why:'agent ไม่จำเป็นต้องเป็น machine learning ทุกตัว',
      distractors:[
        'ไม่ใช่ agent แน่นอน เพราะไม่ learning',
        'เป็น deep learning เพราะใช้ความรู้ผู้เชี่ยวชาญ',
        'เป็น automation ธรรมดาเสมอ ไม่มีทางเป็น AI'
      ]
    }
  ];

  function qs(){ return new URLSearchParams(location.search); }

  function isTeacherMode(){
    const p = qs();
    return p.get('teacher') === '1' || p.get('admin') === '1' || p.get('mode') === 'teacher' || p.get('view') === 'teacher';
  }

  function $(selector){ return document.querySelector(selector); }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function shuffle(array){
    const a = array.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function readJson(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(error){ return fallback; }
  }

  function saveJson(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(error){}
  }

  function getProfile(){
    try{
      return window.AIQuestStorage && AIQuestStorage.getProfile ? AIQuestStorage.getProfile() : {};
    }catch(error){
      return {};
    }
  }

  function profileKey(){
    const p = getProfile();
    return String((p.studentId || 'anon') + '_' + (p.section || '101')).replace(/[^\w-]/g,'_');
  }

  function readRecentFamilies(track){
    const all = readJson(RECENT_KEY, {});
    const key = profileKey();
    return (all[key] && Array.isArray(all[key][track])) ? all[key][track] : [];
  }

  function writeRecentFamilies(track, families){
    const all = readJson(RECENT_KEY, {});
    const key = profileKey();
    if(!all[key]) all[key] = {};
    const prev = Array.isArray(all[key][track]) ? all[key][track] : [];
    all[key][track] = families.concat(prev).filter(Boolean).slice(0, 24);
    saveJson(RECENT_KEY, all);
  }

  function familyOf(item){
    return String(item.familyId || item.key || item.id || '').trim();
  }

  function uniqueByFamily(items, limit, track){
    const recent = new Set(readRecentFamilies(track).slice(0, 16));
    const used = new Set();
    const result = [];
    const pool = shuffle(items || []);

    function pass(filterFn){
      pool.forEach(item => {
        if(result.length >= limit) return;
        const fam = familyOf(item);
        if(!fam || used.has(fam)) return;
        if(filterFn && !filterFn(item, fam)) return;
        used.add(fam);
        result.push(item);
      });
    }

    pass((item, fam) => !recent.has(fam));
    pass(() => true);

    if(result.length < limit){
      pool.forEach(item => {
        if(result.length >= limit) return;
        if(result.some(x => x.id === item.id)) return;
        result.push(item);
      });
    }

    writeRecentFamilies(track, result.map(familyOf));
    return result.slice(0, limit);
  }

  function getWeakKeys(){
    const keys = [];
    [
      'CSAI2102_AIQUEST_S2_WEAK_MIS_V256',
      'CSAI2102_AIQUEST_S2_WEAK_MIS_V258',
      'CSAI2102_AIQUEST_S2_WEAK_MIS_V259'
    ].forEach(key => {
      try{
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        Object.entries(obj.mis || {})
          .sort((a,b)=>Number(b[1])-Number(a[1]))
          .forEach(pair => {
            if(pair[0] && !keys.includes(pair[0])) keys.push(pair[0]);
          });
      }catch(error){}
    });

    return keys.slice(0, 6);
  }

  function injectStyle(){
    if($('#aiquestRemedialPathStyle')) return;

    const style = document.createElement('style');
    style.id = 'aiquestRemedialPathStyle';
    style.textContent = `
      .remedialPanel{
        border:1px solid rgba(56,189,248,.24);
        background:linear-gradient(135deg,rgba(15,23,42,.92),rgba(30,41,59,.90));
        border-radius:28px;
        padding:18px;
        margin:16px 0;
        box-shadow:0 20px 70px rgba(0,0,0,.22);
      }

      .remedialPanel.compact .remedialGrid,
      .remedialPanel.compact #remedialMiniHost,
      .remedialPanel.compact .remedialRow.optionalActions,
      .remedialPanel.compact .remedialSub.weakLine{
        display:none;
      }

      .remedialHeader{
        display:flex;
        justify-content:space-between;
        gap:14px;
        align-items:flex-start;
        flex-wrap:wrap;
      }

      .remedialTitle{
        font-size:clamp(20px,2.2vw,28px);
        font-weight:1000;
        margin:0;
      }

      .remedialSub{
        color:var(--muted,#94a3b8);
        margin-top:4px;
        line-height:1.55;
      }

      .remedialBadge{
        border-radius:999px;
        padding:9px 12px;
        font-weight:1000;
        border:1px solid rgba(52,211,153,.35);
        background:rgba(52,211,153,.10);
        color:#bbf7d0;
      }

      .remedialToggle{
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.08);
        color:var(--text,#e2e8f0);
        border-radius:999px;
        padding:9px 12px;
        font-weight:900;
        cursor:pointer;
      }

      .remedialGrid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:12px;
        margin-top:14px;
      }

      .remedialCard{
        border:1px solid rgba(255,255,255,.12);
        border-radius:20px;
        background:rgba(255,255,255,.055);
        padding:14px;
        min-height:150px;
      }

      .remedialCard h3{ margin:0 0 7px; font-size:18px; }
      .remedialCard p{
        margin:0 0 12px;
        color:var(--muted,#94a3b8);
        line-height:1.5;
      }

      .remedialMini{
        margin-top:14px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:22px;
        padding:14px;
        background:rgba(15,23,42,.58);
      }

      .remedialChoice{
        width:100%;
        display:block;
        margin-top:8px;
        text-align:left;
        border-radius:16px;
        border:1px solid rgba(255,255,255,.15);
        background:rgba(255,255,255,.07);
        color:var(--text,#e2e8f0);
        padding:12px;
        font-weight:800;
        cursor:pointer;
      }

      .remedialChoice:hover{filter:brightness(1.08)}
      .remedialChoice.correct{border-color:rgba(52,211,153,.7);background:rgba(52,211,153,.14)}
      .remedialChoice.wrong{border-color:rgba(251,113,133,.7);background:rgba(251,113,133,.13)}

      .remedialFeedback{
        margin-top:12px;
        border-radius:16px;
        padding:12px;
        line-height:1.6;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.12);
      }

      .remedialRow{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:12px;
      }

      .diagnosticNote{
        margin-top:8px;
        color:rgba(226,232,240,.72);
        font-size:13px;
        line-height:1.45;
      }

      @media(max-width:980px){.remedialGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:640px){.remedialGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getCompletion(){
    const all = readJson(STATE_KEY, {});
    const key = profileKey();
    if(!all[key]) all[key] = {};
    return {all, key, data:all[key]};
  }

  function markDone(track, score, total){
    const st = getCompletion();
    st.data[track] = {
      done:true,
      score:Number(score || 0),
      total:Number(total || 0),
      ts:new Date().toISOString()
    };
    st.all[st.key] = st.data;
    saveJson(STATE_KEY, st.all);
  }

  function doneCount(){
    const st = getCompletion().data || {};
    return ['automation','peas','environment','boss'].filter(k => st[k] && st[k].done).length;
  }

  function btnClass(){ return 'btn secondary'; }

  function openS2(){
    const top = document.getElementById('btnSession2Top');
    if(top){ top.click(); return; }
    const card = document.querySelector('[data-roadmap-id="s2"], [data-mission-id="m2"]');
    if(card){ card.click(); return; }
    if(window.showToast) showToast('ไปที่ Roadmap แล้วกด S2 Agent Builder');
  }

  function openBoss(){
    const card = document.querySelector('[data-roadmap-id="b1"], [data-mission-id="b1"]');
    if(card){ card.click(); return; }
    if(window.showToast) showToast('ไปที่ Roadmap แล้วกด B1 Rookie AI Boss');
  }

  function makeDiagnosticChoices(item){
    return shuffle([{text:item.correct, ok:true}].concat((item.distractors || []).map(text => ({text, ok:false}))));
  }

  function makeAutomationQuestions(){
    return uniqueByFamily(AUTOMATION_DIAGNOSTIC_BANK, 6, 'automation').map(item => ({
      track:'automation',
      familyId:item.familyId,
      prompt:item.prompt,
      correct:item.correct,
      why:item.why,
      choices:makeDiagnosticChoices(item)
    }));
  }

  function bossClaimsFor(keys, limit, track){
    const bank = window.AIQUEST_BOSS1_BANK && AIQUEST_BOSS1_BANK.BOSS1_CLAIMS ? AIQUEST_BOSS1_BANK.BOSS1_CLAIMS : [];
    let pool = [];

    if(keys && keys.length){
      pool = bank.filter(item => keys.includes(item.key) || keys.includes(item.familyId));
    }

    if(pool.length < limit){
      pool = pool.concat(bank.filter(item => !pool.some(p => p.id === item.id)));
    }

    return uniqueByFamily(pool, limit, track || 'boss');
  }

  function makeReasoningOptionsFromBoss(item){
    const correct = String(item.answer || '').replace(/^ไม่ถูก\s*/,'').replace(/^ไม่เสมอ\s*/,'ควรระวังว่า ');
    const phase = item.phase || '';
    const key = item.key || item.familyId || '';

    const generic = [
      'ให้ยึดชื่อระบบเป็นหลัก ถ้ามีคำว่า smart หรือ AI ก็ถือว่าถูกต้อง',
      'ให้ดูแค่ว่ามีข้อมูลหรือ sensor หรือไม่ ถ้ามีก็จัดเป็น intelligent agent ได้',
      'ให้ดูเฉพาะความเร็วและความอัตโนมัติ ถ้าทำงานเร็วก็ถือว่าตัดสินใจดี',
      'ไม่ต้องแยก goal, performance measure, environment และ action เพราะเป็นรายละเอียดทางเทคนิค'
    ];

    const phaseDistractors = {
      'PEAS Gate':[
        'ให้เขียน PEAS เป็นรายชื่อ component เช่น model, database, server และ UI',
        'ให้ถือว่า Performance measure คือข้อมูลจาก sensor ที่ระบบรับเข้ามา',
        'ให้ถือว่า Actuator ต้องเป็นอุปกรณ์กายภาพเท่านั้น'
      ],
      'Environment Gate':[
        'ให้ถือว่า sensor เยอะเท่ากับ fully observable เสมอ',
        'ให้ถือว่า software environment เป็น static เสมอ',
        'ให้ดูเฉพาะ agent ตัวที่เราสนใจ จึงนับเป็น single-agent เสมอ'
      ],
      'Rationality Gate':[
        'ให้ถือว่า rational agent ต้องรู้ผลลัพธ์จริงที่ดีที่สุดเสมอ',
        'ให้ถือว่าข้อมูลเยอะเพียงพอแล้ว ไม่ต้องดู goal หรือ action',
        'ให้ถือว่า prediction ที่แม่นคือ decision ที่ดีโดยอัตโนมัติ'
      ],
      'Final Attack':[
        'ให้เน้น accuracy อย่างเดียว ถ้าสูงพอก็ไม่ต้องดู fairness/privacy',
        'ให้ deploy ได้ทันทีเมื่อ prototype เล่นได้',
        'ให้ถือว่า AI รับผิดชอบเองเมื่อระบบตัดสินใจผิด'
      ]
    };

    const wrong = (phaseDistractors[phase] || generic).concat(generic);
    return shuffle([{text:correct, ok:true}].concat(shuffle(wrong).slice(0,3).map(text => ({text, ok:false}))));
  }

  function makeBossQuestions(){
    const weak = getWeakKeys();
    return bossClaimsFor(weak.length ? weak : ['rationality','peas_swap','observable_confusion','bigdata_rational'], 6, 'boss')
      .map(item => ({
        track:'boss',
        familyId:item.familyId || item.key,
        prompt:item.claim,
        correct:String(item.answer || '').replace(/^ไม่ถูก\s*/,'').replace(/^ไม่เสมอ\s*/,''),
        why:item.why || item.hint || item.answer,
        choices:makeReasoningOptionsFromBoss(item)
      }));
  }

  function peasItems(limit){
    const bank = window.AIQUEST_SESSION2_BANK && AIQUEST_SESSION2_BANK.PEAS_ITEMS ? AIQUEST_SESSION2_BANK.PEAS_ITEMS : [];
    return uniqueByFamily(bank, limit, 'peas');
  }

  function envItems(limit){
    const bank = window.AIQUEST_SESSION2_BANK && AIQUEST_SESSION2_BANK.ENV_ITEMS ? AIQUEST_SESSION2_BANK.ENV_ITEMS : [];
    return uniqueByFamily(bank, limit, 'environment');
  }

  function makePeasQuestions(){
    return peasItems(6).map(item => {
      const choices = shuffle((item.choices || []).map(c => ({
        text:String(c.text || '').replace(/^P=ใช้ AI รุ่นล่าสุด.*$/,'P=ความเร็วของ UI, E=server, A=database, S=keyboard'),
        ok:!!c.correct,
        why:c.correct ? 'PEAS นี้แยก Performance, Environment, Actuators, Sensors ได้ถูกต้อง' : 'ยังมีการสลับ P/E/A/S หรือมองเป็น component ของระบบ'
      })));
      return {
        track:'peas',
        familyId:item.familyId,
        prompt:'เลือกเหตุผล PEAS ที่ออกแบบได้ถูกต้องที่สุดสำหรับ: ' + (item.scenario || 'สถานการณ์นี้'),
        correct:(choices.find(c => c.ok) || {}).text || '',
        why:'PEAS ต้องแยก P=เกณฑ์สำเร็จ, E=โลก/บริบท, A=สิ่งที่ agent ทำ, S=สิ่งที่ agent รับรู้',
        choices
      };
    });
  }

  function makeEnvironmentQuestions(){
    return envItems(6).map(item => {
      const choices = shuffle((item.choices || []).map(c => ({
        text:c.text,
        ok:!!c.correct,
        why:c.correct ? 'คำอธิบาย environment สอดคล้องกับ observable/dynamic/stochastic/sequential' : 'คำตอบนี้สับสนเรื่อง observable, dynamic, stochastic หรือจำนวน agent'
      })));
      return {
        track:'environment',
        familyId:item.familyId,
        prompt:item.stem || 'เลือก environment classification ที่เหมาะสมที่สุด',
        correct:(choices.find(c => c.ok) || {}).text || '',
        why:'ให้ดูว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม ผลลัพธ์แน่นอนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม',
        choices
      };
    });
  }

  function buildQuiz(track){
    if(track === 'automation') return makeAutomationQuestions();
    if(track === 'peas') return makePeasQuestions();
    if(track === 'environment') return makeEnvironmentQuestions();
    if(track === 'boss') return makeBossQuestions();
    return [];
  }

  function trackTitle(track){
    return {
      automation:'AI vs Automation Diagnostic',
      peas:'PEAS Diagnostic',
      environment:'Environment Diagnostic',
      boss:'Boss Weakness Diagnostic'
    }[track] || 'Diagnostic';
  }

  function startDrill(track){
    const host = $('#remedialMiniHost');
    if(!host) return;

    const questions = buildQuiz(track);

    if(!questions.length){
      host.innerHTML = `
        <div class="remedialMini">
          <b>${escapeHtml(trackTitle(track))}</b><br>
          ยังโหลดคลังคำถามไม่ครบ กรุณาตรวจไฟล์ mission2-agent-bank หรือ boss1-rookie-bank
        </div>
      `;
      return;
    }

    let i = 0;
    let score = 0;
    let answered = false;

    function render(){
      const q = questions[i];

      if(!q){
        const pct = questions.length ? Math.round(score / questions.length * 100) : 0;
        markDone(track, score, questions.length);
        host.innerHTML = `
          <div class="remedialMini">
            <h3>${escapeHtml(trackTitle(track))} Complete</h3>
            <p>ผลลัพธ์: ${score}/${questions.length} · ${pct}%</p>
            <div class="remedialFeedback">
              ${pct >= 80 ? 'พร้อมแล้วสำหรับ S3/Boss ถัดไป' : 'ควรทำซ้ำอีก 1 รอบเพื่อปิด misconception'}
            </div>
            <div class="remedialRow">
              <button class="${btnClass()}" id="redoDrill">ทำซ้ำแบบไม่ซ้ำ family เดิม</button>
              <button class="${btnClass()}" id="goBoss">ไป B1 Boss</button>
            </div>
          </div>
        `;
        const redo = $('#redoDrill');
        if(redo) redo.onclick = () => startDrill(track);
        const goBoss = $('#goBoss');
        if(goBoss) goBoss.onclick = openBoss;
        renderPanel(false);
        return;
      }

      answered = false;

      host.innerHTML = `
        <div class="remedialMini">
          <div class="remedialSub">${escapeHtml(trackTitle(track))} · ข้อ ${i+1}/${questions.length} · family: ${escapeHtml(q.familyId || '-')}</div>
          <h3>${escapeHtml(q.prompt)}</h3>
          <div class="diagnosticNote">เลือก “เหตุผลที่ดีที่สุด” ไม่ใช่คำตอบที่ดูเดาง่ายที่สุด</div>
          <div>
            ${q.choices.map((c,idx) => `<button class="remedialChoice" data-choice="${idx}">${escapeHtml(c.text)}</button>`).join('')}
          </div>
          <div id="remedialFeedback"></div>
        </div>
      `;

      host.querySelectorAll('[data-choice]').forEach(btn => {
        btn.onclick = () => {
          if(answered) return;
          answered = true;

          const c = q.choices[Number(btn.dataset.choice)];
          if(c.ok) score += 1;

          host.querySelectorAll('[data-choice]').forEach(b => {
            const cc = q.choices[Number(b.dataset.choice)];
            b.disabled = true;
            if(cc.ok) b.classList.add('correct');
          });

          if(!c.ok) btn.classList.add('wrong');

          const fb = $('#remedialFeedback');
          fb.innerHTML = `
            <div class="remedialFeedback">
              <b>${c.ok ? 'เหตุผลถูกทาง' : 'ยังมีจุดสับสน'}</b><br>
              <b>เหตุผลที่ควรได้:</b> ${escapeHtml(q.correct)}<br>
              <b>สรุป concept:</b> ${escapeHtml(q.why || c.why || '')}
              <div class="remedialRow">
                <button class="${btnClass()}" id="nextRemedial">${i+1 >= questions.length ? 'สรุปผล' : 'ข้อถัดไป'}</button>
              </div>
            </div>
          `;

          const next = $('#nextRemedial');
          if(next) next.onclick = () => { i += 1; render(); };
        };
      });
    }

    render();
  }

  function shouldStartCompact(){
    const p = qs();
    if(p.get('review') === '1' || p.get('remedial') === '1') return false;
    return true;
  }

  function renderPanel(keepOpen){
    if(isTeacherMode()) return;

    injectStyle();

    let panel = $('#preS3RemedialPanel');

    if(!panel){
      panel = document.createElement('section');
      panel.id = 'preS3RemedialPanel';
      panel.className = 'remedialPanel';

      const anchor = $('#sessionRoadmapPanel') || document.querySelector('#menuScreen .hero') || $('#menuScreen');
      if(anchor && anchor.parentNode){
        anchor.insertAdjacentElement(anchor.id === 'sessionRoadmapPanel' ? 'afterend' : 'afterend', panel);
      }else{
        return;
      }
    }

    const wasOpen = keepOpen || !panel.classList.contains('compact');
    const compact = keepOpen ? false : shouldStartCompact() && !wasOpen;
    panel.classList.toggle('compact', compact);

    const weak = getWeakKeys();
    const completed = doneCount();

    panel.innerHTML = `
      <div class="remedialHeader">
        <div>
          <h2 class="remedialTitle">Optional Pre-S3 Diagnostic Review</h2>
          <div class="remedialSub">
            ใช้ทบทวนเมื่อยังสับสน · ไม่ใช่คะแนน graded · ตัวเลือกเป็นเหตุผลเชิงวินิจฉัย ไม่ใช่คำใบ้ง่าย
          </div>
        </div>
        <div class="remedialRow" style="margin-top:0">
          <span class="remedialBadge">Review Done ${completed}/4</span>
          <button class="remedialToggle" id="toggleRemedial">${compact ? 'เปิด Review' : 'ย่อ Review'}</button>
        </div>
      </div>

      <div class="remedialSub weakLine" style="margin-top:8px">
        Weak focus: ${weak.length ? weak.map(escapeHtml).join(', ') : 'ไม่มี weakness เฉพาะตัว — review นี้เป็น optional'}
      </div>

      <div class="remedialGrid">
        <div class="remedialCard">
          <h3>AI vs Automation</h3>
          <p>โจทย์วินิจฉัยเหตุผล ไม่มีตัวเลือก “ถูก/ไม่ถูก” ให้เดาง่าย</p>
          <button class="${btnClass()}" data-drill="automation">เริ่ม Diagnostic</button>
        </div>
        <div class="remedialCard">
          <h3>PEAS Drill</h3>
          <p>ฝึกแยก Performance / Environment / Actuator / Sensor ให้แม่น</p>
          <button class="${btnClass()}" data-drill="peas">เริ่ม PEAS</button>
        </div>
        <div class="remedialCard">
          <h3>Environment Drill</h3>
          <p>ฝึกดู observable, dynamic, stochastic, sequential, multi-agent</p>
          <button class="${btnClass()}" data-drill="environment">เริ่ม Environment</button>
        </div>
        <div class="remedialCard">
          <h3>Boss Weakness</h3>
          <p>สุ่มจาก misconception เด่น แต่ใช้เหตุผลลวงที่ใกล้เคียงขึ้น</p>
          <button class="${btnClass()}" data-drill="boss">เริ่ม Boss Diagnostic</button>
        </div>
      </div>

      <div class="remedialRow optionalActions">
        <button class="${btnClass()}" id="goS2Review">เล่น S2 ซ้ำเพื่อ Mastery</button>
        <button class="${btnClass()}" id="goB1Review">เข้า B1 Boss</button>
      </div>

      <div id="remedialMiniHost"></div>
    `;

    const toggle = $('#toggleRemedial');
    if(toggle){
      toggle.onclick = () => {
        panel.classList.toggle('compact');
        toggle.textContent = panel.classList.contains('compact') ? 'เปิด Review' : 'ย่อ Review';
      };
    }

    panel.querySelectorAll('[data-drill]').forEach(btn => {
      btn.onclick = () => {
        panel.classList.remove('compact');
        startDrill(btn.dataset.drill);
      };
    });

    const s2 = $('#goS2Review');
    if(s2) s2.onclick = openS2;

    const b1 = $('#goB1Review');
    if(b1) b1.onclick = openBoss;
  }

  function boot(){
    if(isTeacherMode()) return;
    setTimeout(() => renderPanel(false), 250);
    setTimeout(() => renderPanel(false), 900);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AIQuestRemedialPath = {
    VERSION,
    renderPanel,
    startDrill,
    getWeakKeys,
    reset(){
      try{
        localStorage.removeItem(STATE_KEY);
        localStorage.removeItem(RECENT_KEY);
      }catch(error){}
      renderPanel(true);
    }
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
