/*
  CSAI2102 AI Quest
  PATCH v3.0.0 Constructed-response Remedial
  ------------------------------------------------------------
  Fixes v2.6.5 problem:
  - multiple-choice review remained guessable because the correct answer was often longer
  v3.0.0 removes MCQ from remedial review:
  - student writes a short reason first
  - then sees model answer + checklist
  - self-checks "เข้าใจแล้ว" / "ยังสับสน"
  - no graded score and no Google Sheets attempt
*/
(function(){
  'use strict';

  const VERSION = 'v3.0.0-constructed-review-ux';
  const STATE_KEY = 'CSAI2102_AIQUEST_PRES3_CONSTRUCTED_V266';
  const RECENT_KEY = 'CSAI2102_AIQUEST_PRES3_RECENT_FAMILIES_V266';

  const AUTOMATION_PROMPTS = [
    {
      id:'auto_construct_001',
      familyId:'timer_automation',
      prompt:'นาฬิกาปลุกที่ดังเวลา 07:00 ทุกวัน ยังไม่ควรสรุปว่าเป็น intelligent agent เพราะอะไร?',
      model:'เพราะทำงานตามเวลาที่ตั้งไว้เป็นหลัก ยังไม่มีการรับ percept จาก environment เพื่อเลือก action ตาม goal ในบริบทที่เปลี่ยนไป',
      checklist:['แยก timer/automation ออกจาก agent', 'กล่าวถึง percept-action-goal', 'ไม่ใช้คำว่าอัตโนมัติ = AI']
    },
    {
      id:'auto_construct_002',
      familyId:'sensor_agent',
      prompt:'ระบบเปิดไฟเมื่อ motion sensor เจอคนเดินผ่าน มี sensor แล้ว ทำไมยังไม่ควรสรุปว่าเป็น intelligent agent ทันที?',
      model:'เพราะ sensor เป็นแค่ช่องรับ percept ถ้าระบบเปิด/ปิดตาม rule ตายตัวก็เป็น automation/simple reflex เป็นหลัก ต้องดู goal, action selection และบริบทเพิ่ม',
      checklist:['อธิบาย sensor เป็นเพียง percept channel', 'พูดถึง rule ตายตัว', 'ระบุว่าต้องดู goal/action']
    },
    {
      id:'auto_construct_003',
      familyId:'software_agent',
      prompt:'spam filter ไม่มีร่างกายหรือหุ่นยนต์ แต่ทำไมยังอธิบายว่าเป็น software agent ได้?',
      model:'เพราะรับ percept เป็นอีเมลและเลือก action เช่น ติดป้าย/ย้ายไป spam เพื่อบรรลุ goal ลดอีเมลรบกวน จึงไม่จำเป็นต้องมีร่างกาย',
      checklist:['มี percept เป็นอีเมล', 'มี action เป็น label/move', 'มี goal ลด spam', 'บอกว่าไม่ต้องเป็นหุ่นยนต์']
    },
    {
      id:'auto_construct_004',
      familyId:'database_lookup',
      prompt:'เว็บค้นฐานข้อมูลรายวิชาแล้วแสดงผลตาม keyword ต่างจาก intelligent agent อย่างไร?',
      model:'การ lookup เป็นการดึงข้อมูลตามคำค้นเป็นหลัก ยังไม่ใช่การเลือก action ตาม performance measure หรือปรับตาม goal ของงานอย่างชัดเจน',
      checklist:['แยก lookup กับ decision', 'กล่าวถึง performance measure', 'ไม่เหมารวมว่า database = AI']
    },
    {
      id:'auto_construct_005',
      familyId:'rulebased_many_rules',
      prompt:'ระบบ if-else จำนวนมากอาจดูฉลาด แต่ทำไมจำนวนกฎมากไม่ใช่หลักฐานว่าเป็น AI ขั้นสูง?',
      model:'จำนวนกฎมากอาจยังเป็น rule-based system ที่มนุษย์กำหนดไว้ ไม่ได้แปลว่าเรียนรู้ ปรับตัว หรือเลือก action อย่างเหมาะสมจากข้อมูลใหม่',
      checklist:['กล่าวถึง rule-based', 'แยกจำนวนกฎออกจาก learning', 'พูดถึงการปรับตัวหรือข้อมูลใหม่']
    },
    {
      id:'auto_construct_006',
      familyId:'prediction_action',
      prompt:'ระบบทำนายความเสี่ยงได้ แต่ไม่แจ้งเตือนหรือแนะนำอะไร ยังขาดส่วนใดของ agent loop?',
      model:'ยังขาด action หรือ decision ที่นำ prediction ไปใช้ตาม performance measure เพราะ prediction อย่างเดียวไม่เท่ากับ agent ที่กระทำต่อ environment',
      checklist:['ระบุว่าขาด action/decision', 'แยก prediction กับ action', 'กล่าวถึง performance measure']
    },
    {
      id:'auto_construct_007',
      familyId:'actuator_confusion',
      prompt:'ข้อความแจ้งเตือนใน LINE ถือเป็น actuator ของ software agent ได้อย่างไร?',
      model:'actuator คือช่องทางที่ agent ใช้กระทำต่อ environment ซึ่งใน software อาจเป็น notification, message, ranking หรือ recommendation ไม่จำเป็นต้องเป็นมอเตอร์',
      checklist:['นิยาม actuator เป็นช่องทาง action', 'ยกตัวอย่าง software action', 'ไม่จำกัด actuator เป็นกายภาพ']
    },
    {
      id:'auto_construct_008',
      familyId:'random_not_ai',
      prompt:'แอปสุ่มคำคมไม่ซ้ำกัน ทำไม randomness ไม่เพียงพอที่จะเรียกว่า intelligence?',
      model:'เพราะการสุ่มไม่ใช่การเลือก action ตาม goal หรือ evidence ถ้าไม่มีบริบท feedback หรือ reasoning ก็ยังไม่ใช่ intelligence',
      checklist:['แยก randomness กับ intelligence', 'กล่าวถึง goal/evidence', 'กล่าวถึง feedback/reasoning']
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


      .constructedTopline{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
        margin:8px 0 10px;
      }
      .charCounter{
        font-size:13px;
        color:rgba(226,232,240,.72);
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.06);
        border-radius:999px;
        padding:6px 10px;
        font-weight:900;
      }
      .charCounter.ready{
        color:#bbf7d0;
        border-color:rgba(52,211,153,.35);
        background:rgba(52,211,153,.10);
      }
      .btn[disabled]{
        opacity:.45;
        cursor:not-allowed;
        filter:grayscale(.25);
      }
      .modelAnswerBox{
        border:1px solid rgba(56,189,248,.24);
        background:rgba(56,189,248,.08);
        border-radius:16px;
        padding:12px;
        margin-bottom:12px;
      }
      .checklistGrid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:10px;
      }
      .checkItem{
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.055);
        border-radius:14px;
        padding:10px;
        line-height:1.45;
      }
      .checkItem::before{
        content:'□ ';
        color:#93c5fd;
        font-weight:1000;
      }
      .selfCheckHint{
        color:rgba(226,232,240,.75);
        margin-top:10px;
        font-size:13px;
      }
      .optionalNotice{
        border:1px solid rgba(251,191,36,.24);
        background:rgba(251,191,36,.08);
        border-radius:16px;
        padding:10px 12px;
        margin-top:10px;
        line-height:1.55;
      }
      @media(max-width:780px){.checklistGrid{grid-template-columns:1fr}}

      .constructedInput{
        width:100%;
        min-height:120px;
        border-radius:18px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.07);
        color:var(--text,#e2e8f0);
        padding:14px;
        font-size:16px;
        line-height:1.55;
        resize:vertical;
      }

      .constructedHint{
        color:rgba(226,232,240,.72);
        font-size:13px;
        line-height:1.45;
        margin:8px 0;
      }

      .remedialFeedback{
        margin-top:12px;
        border-radius:16px;
        padding:12px;
        line-height:1.65;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.12);
      }

      .checklist{
        margin:8px 0 0;
        padding-left:20px;
      }

      .remedialRow{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:12px;
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

  function markDone(track, understood, total, confused){
    const st = getCompletion();
    st.data[track] = {
      done:true,
      understood:Number(understood || 0),
      confused:Number(confused || 0),
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


  function goMissionMapOrS3(){
    const s3 = document.querySelector('[data-roadmap-id="s3"], [data-session-id="s3"], [data-mission-id="m3"]');
    if(s3 && !String(s3.className || '').includes('locked')){
      s3.click();
      return;
    }

    const mapBtn = document.getElementById('btnMissionMap') || document.querySelector('[data-action="mission-map"]');
    if(mapBtn){ mapBtn.click(); return; }

    const roadmap = document.getElementById('sessionRoadmapPanel');
    if(roadmap){
      roadmap.scrollIntoView({behavior:'smooth', block:'start'});
      if(window.showToast) showToast('ไปที่ Mission Map แล้ว S3 จะเปิดใน patch ถัดไป');
      return;
    }

    if(window.showToast) showToast('S3 จะเปิดใน patch ถัดไป');
  }

  function buildAutomationPrompts(){
    return uniqueByFamily(AUTOMATION_PROMPTS, 4, 'automation');
  }

  function peasItems(limit){
    const bank = window.AIQUEST_SESSION2_BANK && AIQUEST_SESSION2_BANK.PEAS_ITEMS ? AIQUEST_SESSION2_BANK.PEAS_ITEMS : [];
    return uniqueByFamily(bank, limit, 'peas');
  }

  function envItems(limit){
    const bank = window.AIQUEST_SESSION2_BANK && AIQUEST_SESSION2_BANK.ENV_ITEMS ? AIQUEST_SESSION2_BANK.ENV_ITEMS : [];
    return uniqueByFamily(bank, limit, 'environment');
  }

  function bossClaimsFor(limit){
    const bank = window.AIQUEST_BOSS1_BANK && AIQUEST_BOSS1_BANK.BOSS1_CLAIMS ? AIQUEST_BOSS1_BANK.BOSS1_CLAIMS : [];
    const weak = getWeakKeys();
    let pool = weak.length ? bank.filter(item => weak.includes(item.key) || weak.includes(item.familyId)) : [];
    if(pool.length < limit){
      pool = pool.concat(bank.filter(item => !pool.some(p => p.id === item.id)));
    }
    return uniqueByFamily(pool, limit, 'boss');
  }

  function buildPeasPrompts(){
    return peasItems(4).map(item => {
      const correct = (item.choices || []).find(c => c.correct);
      return {
        id:item.id,
        familyId:item.familyId,
        prompt:'เขียน PEAS ของสถานการณ์นี้ให้ครบ 4 ส่วน: ' + (item.scenario || 'สถานการณ์นี้'),
        model:correct ? correct.text : 'ระบุ P=เกณฑ์สำเร็จ, E=โลก/บริบท, A=สิ่งที่ agent ทำ, S=สิ่งที่ agent รับรู้',
        checklist:['มี P เป็นเกณฑ์วัดความสำเร็จ', 'มี E เป็นบริบท/โลกของงาน', 'มี A เป็น action/actuator', 'มี S เป็น sensor/percept']
      };
    });
  }

  function buildEnvPrompts(){
    return envItems(4).map(item => {
      const correct = (item.choices || []).find(c => c.correct);
      return {
        id:item.id,
        familyId:item.familyId,
        prompt:(item.stem || 'วิเคราะห์ environment ของสถานการณ์นี้') + ' ให้เขียนเหตุผลประกอบ ไม่ใช่ตอบแค่ชื่อประเภท',
        model:correct ? correct.text : 'วิเคราะห์ observable, deterministic/stochastic, episodic/sequential, static/dynamic, discrete/continuous และ single/multi-agent',
        checklist:['กล่าวถึง observable หรือ partially observable', 'กล่าวถึง static/dynamic หรือ stochastic', 'มีเหตุผลโยงกับสถานการณ์']
      };
    });
  }

  function buildBossPrompts(){
    return bossClaimsFor(4).map(item => ({
      id:item.id,
      familyId:item.familyId || item.key,
      prompt:'หักล้าง claim นี้ด้วยเหตุผลสั้น ๆ: ' + (item.claim || ''),
      model:item.answer || item.why || 'อธิบาย misconception แล้วโยงกลับไป concept ที่ถูกต้อง',
      checklist:['ระบุว่า misconception อยู่ตรงไหน', 'ให้เหตุผลเชิง concept', 'โยงกลับไป AI/Agent/PEAS/Environment/Rationality']
    }));
  }

  function buildPrompts(track){
    if(track === 'automation') return buildAutomationPrompts();
    if(track === 'peas') return buildPeasPrompts();
    if(track === 'environment') return buildEnvPrompts();
    if(track === 'boss') return buildBossPrompts();
    return [];
  }

  function trackTitle(track){
    return {
      automation:'AI vs Automation Constructed Review',
      peas:'PEAS Constructed Review',
      environment:'Environment Constructed Review',
      boss:'Boss Weakness Constructed Review'
    }[track] || 'Constructed Review';
  }

  function startDrill(track){
    const host = $('#remedialMiniHost');
    if(!host) return;

    const prompts = buildPrompts(track);

    if(!prompts.length){
      host.innerHTML = `
        <div class="remedialMini">
          <b>${escapeHtml(trackTitle(track))}</b><br>
          ยังโหลดคลังคำถามไม่ครบ กรุณาตรวจไฟล์ mission2-agent-bank หรือ boss1-rookie-bank
        </div>
      `;
      return;
    }

    let i = 0;
    let understood = 0;
    let confused = 0;

    function render(){
      const q = prompts[i];

      if(!q){
        markDone(track, understood, prompts.length, confused);
        host.innerHTML = `
          <div class="remedialMini">
            <h3>${escapeHtml(trackTitle(track))} Complete</h3>
            <p>เข้าใจแล้ว ${understood}/${prompts.length} · ยังสับสน ${confused}</p>
            <div class="remedialFeedback">
              ${confused === 0 ? 'พร้อมแล้วสำหรับ S3/Boss ถัดไป' : 'ควรเล่น S2/B1 ซ้ำ หรือทำ review track นี้อีกครั้ง'}
            </div>
            <div class="remedialRow">
              <button class="${btnClass()}" id="redoDrill">ทำซ้ำแบบ family ใหม่</button>
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

      host.innerHTML = `
        <div class="remedialMini">
          <div class="remedialSub">${escapeHtml(trackTitle(track))} · ข้อ ${i+1}/${prompts.length} · family: ${escapeHtml(q.familyId || '-')}</div>
          <h3>${escapeHtml(q.prompt)}</h3>
          <div class="constructedHint">พิมพ์เหตุผลของตัวเองก่อน แล้วค่อยดูคำตอบตัวอย่าง ไม่มีตัวเลือกให้เดา</div>
          <div class="constructedTopline">
            <span class="charCounter" id="reasonCounter">0/${MIN_REASON_CHARS} ตัวอักษร</span>
            <span class="constructedHint" style="margin:0">ต้องเขียนอย่างน้อย 1–2 ประโยค</span>
          </div>
          <textarea class="constructedInput" id="constructedAnswer" placeholder="เขียนเหตุผลสั้น ๆ อย่างน้อย 1–2 ประโยค..."></textarea>
          <div class="remedialRow">
            <button class="${btnClass()}" id="showModelAnswer" disabled>ดูคำตอบตัวอย่าง</button>
            <button class="${btnClass()}" id="skipConstructed">ข้าม Review / ไป Mission Map</button>
          </div>
          <div id="constructedFeedback"></div>
        </div>
      `;

      const textarea = $('#constructedAnswer');
      const show = $('#showModelAnswer');
      const counter = $('#reasonCounter');
      const skip = $('#skipConstructed');

      function updateReasonState(){
        const len = String((textarea && textarea.value) || '').trim().length;
        if(counter){
          counter.textContent = `${Math.min(len, MIN_REASON_CHARS)}/${MIN_REASON_CHARS} ตัวอักษร`;
          counter.classList.toggle('ready', len >= MIN_REASON_CHARS);
        }
        if(show){
          show.disabled = len < MIN_REASON_CHARS;
          show.textContent = len >= MIN_REASON_CHARS ? 'ดูคำตอบตัวอย่าง' : `พิมพ์เพิ่มอีก ${Math.max(0, MIN_REASON_CHARS-len)} ตัวอักษร`;
        }
      }

      if(textarea){
        textarea.addEventListener('input', updateReasonState);
        updateReasonState();
        setTimeout(() => textarea.focus(), 80);
      }

      if(skip){
        skip.onclick = goMissionMapOrS3;
      }

      if(show){
        show.onclick = () => {
          const answer = String((textarea && textarea.value) || '').trim();

          if(answer.length < MIN_REASON_CHARS){
            if(window.showToast) showToast(`พิมพ์เหตุผลก่อนอย่างน้อย ${MIN_REASON_CHARS} ตัวอักษร`);
            else alert(`พิมพ์เหตุผลก่อนอย่างน้อย ${MIN_REASON_CHARS} ตัวอักษร`);
            return;
          }

          const box = $('#constructedFeedback');
          if(!box) return;

          box.innerHTML = `
            <div class="remedialFeedback">
              <div class="modelAnswerBox">
                <b>คำตอบตัวอย่าง</b><br>
                ${escapeHtml(q.model || '')}
              </div>
              <b>Self-check Checklist</b>
              <div class="checklistGrid">
                ${(q.checklist || []).map(c => `<div class="checkItem">${escapeHtml(c)}</div>`).join('')}
              </div>
              <div class="selfCheckHint">
                เทียบคำตอบของตนเองกับ checklist แล้วเลือกสถานะด้านล่าง
              </div>
              <div class="remedialRow">
                <button class="${btnClass()}" id="markUnderstood">เข้าใจแล้ว</button>
                <button class="${btnClass()}" id="markConfused">ยังสับสน</button>
                <button class="${btnClass()}" id="goMapAfterCheck">ข้าม Review / ไป Mission Map</button>
              </div>
            </div>
          `;

          const ok = $('#markUnderstood');
          if(ok) ok.onclick = () => {
            understood += 1;
            i += 1;
            render();
          };

          const no = $('#markConfused');
          if(no) no.onclick = () => {
            confused += 1;
            i += 1;
            render();
          };

          const go = $('#goMapAfterCheck');
          if(go) go.onclick = goMissionMapOrS3;
        };
      }
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
          <h2 class="remedialTitle">Optional Pre-S3 Constructed Review</h2>
          <div class="remedialSub">
            ใช้เมื่อยังสับสน · ไม่ใช่คะแนน graded · ไม่มี multiple choice ให้เดา
          </div>
          <div class="optionalNotice">
            Optional: ถ้าผ่าน S1/S2/B1 แล้ว สามารถข้าม Review แล้วไป Mission Map ได้
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
          <p>ตอบแบบเขียนเหตุผล: แยก automation, sensor, software agent, prediction/action</p>
          <button class="${btnClass()}" data-drill="automation">เริ่ม Constructed Review</button>
        </div>
        <div class="remedialCard">
          <h3>PEAS Drill</h3>
          <p>เขียน PEAS เองครบ 4 ส่วน แล้วเทียบกับตัวอย่าง</p>
          <button class="${btnClass()}" data-drill="peas">เริ่ม PEAS</button>
        </div>
        <div class="remedialCard">
          <h3>Environment Drill</h3>
          <p>เขียน classification พร้อมเหตุผล ไม่ใช่เลือกคำตอบ</p>
          <button class="${btnClass()}" data-drill="environment">เริ่ม Environment</button>
        </div>
        <div class="remedialCard">
          <h3>Boss Weakness</h3>
          <p>หักล้าง claim ด้วยเหตุผลของตนเอง แล้ว self-check</p>
          <button class="${btnClass()}" data-drill="boss">เริ่ม Boss Review</button>
        </div>
      </div>

      <div class="remedialRow optionalActions">
        <button class="${btnClass()}" id="goS2Review">เล่น S2 ซ้ำเพื่อ Mastery</button>
        <button class="${btnClass()}" id="goB1Review">เข้า B1 Boss</button>
        <button class="${btnClass()}" id="skipReviewToMap">ข้าม Review / ไป Mission Map</button>
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

    const skipMap = $('#skipReviewToMap');
    if(skipMap) skipMap.onclick = goMissionMapOrS3;
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
