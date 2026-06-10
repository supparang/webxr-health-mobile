/*
  CSAI2102 AI Quest
  PATCH v2.1 Session 2 Template: Intelligent Agent
  ------------------------------------------------------------
  หัวข้อ: Intelligent Agent / PEAS / Environment / Rational Agent
  ใช้เป็น template สำหรับขยาย Session 3-15
*/
(function(){
  'use strict';

  const VERSION = 'v2.1-session2-agent-template';

  const AGENT_CARDS = [
    {
      id:'s2_agent_001',
      label:'ระบบแนะนำเส้นทางที่ปรับตามสภาพจราจรแบบ real-time',
      answer:'Agent',
      hint:'ระบบรับข้อมูลจาก environment แล้วเลือก action',
      why:'เป็น agent เพราะรับข้อมูลสภาพแวดล้อมและเลือกเส้นทางที่เหมาะสม',
      misconception:'automation'
    },
    {
      id:'s2_agent_002',
      label:'เครื่องคิดเลขที่คำนวณตามสูตรที่ผู้ใช้กด',
      answer:'Not Agent',
      hint:'มีการรับรู้ environment และตัดสินใจเองหรือไม่?',
      why:'ไม่ใช่ intelligent agent เพราะตอบสนองตามคำสั่งตรง ๆ ไม่มี goal-directed behavior',
      misconception:'calculator'
    },
    {
      id:'s2_agent_003',
      label:'หุ่นยนต์ดูดฝุ่นที่ตรวจจับสิ่งกีดขวางและเปลี่ยนเส้นทาง',
      answer:'Agent',
      hint:'มี sensor และ action ต่อ environment หรือไม่?',
      why:'เป็น agent เพราะรับ percept จาก sensor แล้วเลือก action เช่น เลี้ยวหรือหลบ',
      misconception:'sensor'
    },
    {
      id:'s2_agent_004',
      label:'เว็บที่แสดงรายการสินค้าเรียงตามเวลาที่เพิ่มล่าสุดเสมอ',
      answer:'Maybe Agent',
      hint:'ถ้าแค่เรียงตาม rule ตายตัวอาจยังไม่ใช่ intelligent agent',
      why:'อาจเป็น agent ได้ถ้ามีการปรับตามเป้าหมาย/ผู้ใช้ แต่ถ้าเรียงตามเวลาตายตัวคือ rule-based',
      misconception:'rulebased'
    },
    {
      id:'s2_agent_005',
      label:'ระบบแจ้งเตือนน้ำท่วมที่วิเคราะห์ระดับน้ำและแนะนำเส้นทางปลอดภัย',
      answer:'Agent',
      hint:'ดูว่าระบบมี goal และเลือก action/recommendation หรือไม่',
      why:'เป็น agent เพราะรับ percept จากข้อมูลน้ำ/พื้นที่ แล้วให้ action recommendation เพื่อบรรลุเป้าหมายความปลอดภัย',
      misconception:'database'
    },
    {
      id:'s2_agent_006',
      label:'เครื่องขายน้ำอัตโนมัติที่ปล่อยน้ำเมื่อหยอดเหรียญครบ',
      answer:'Not Agent',
      hint:'ตอบสนองตามเงื่อนไขตายตัวหรือมี rational decision?',
      why:'ส่วนใหญ่เป็น automation/rule-based ไม่ใช่ intelligent agent',
      misconception:'automation'
    }
  ];

  const PEAS_ITEMS = [
    {
      id:'s2_peas_001',
      scenario:'รถยนต์ไร้คนขับในเมือง',
      correct:{
        performance:'ปลอดภัย ถึงจุดหมายเร็ว ใช้พลังงานเหมาะสม ไม่ละเมิดกฎจราจร',
        environment:'ถนน รถคันอื่น คนเดินเท้า สัญญาณไฟ สภาพอากาศ',
        actuators:'พวงมาลัย เบรก คันเร่ง ไฟเลี้ยว',
        sensors:'กล้อง LiDAR GPS radar speed sensor'
      },
      choices:[
        {text:'P=ปลอดภัย/ถึงเร็ว, E=ถนนและผู้ใช้ถนน, A=เบรก/พวงมาลัย, S=กล้อง/GPS', correct:true, misconception:''},
        {text:'P=กล้องชัด, E=พวงมาลัย, A=ถนน, S=ความเร็วถึงเป้าหมาย', correct:false, misconception:'peas_swap'},
        {text:'P=มีฐานข้อมูลแผนที่, E=algorithm, A=ข้อมูลจราจร, S=รถยนต์', correct:false, misconception:'system_component'},
        {text:'P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้โดยสาร, S=จุดหมาย', correct:false, misconception:'tech_focus'}
      ]
    },
    {
      id:'s2_peas_002',
      scenario:'แชตบอตให้คำปรึกษาการลงทะเบียนเรียน',
      correct:{
        performance:'ตอบถูก เข้าใจคำถาม แนะนำรายวิชาถูกเงื่อนไข ลดเวลารอ',
        environment:'นักศึกษา หลักสูตร เงื่อนไขรายวิชา ปฏิทินการศึกษา',
        actuators:'ข้อความตอบกลับ ลิงก์/คำแนะนำ รายการวิชาที่เสนอ',
        sensors:'ข้อความผู้ใช้ โปรไฟล์นักศึกษา ประวัติผลการเรียน'
      },
      choices:[
        {text:'P=ตอบถูก/ลดเวลารอ, E=นักศึกษาและข้อมูลหลักสูตร, A=ข้อความตอบกลับ, S=ข้อความ/โปรไฟล์ผู้ใช้', correct:true, misconception:''},
        {text:'P=มีหน้าตาสวย, E=ปุ่มแชต, A=นักศึกษา, S=คำตอบจากอาจารย์', correct:false, misconception:'ui_focus'},
        {text:'P=ฐานข้อมูลรายวิชา, E=โมเดลภาษา, A=เงื่อนไขหลักสูตร, S=เวลาเรียน', correct:false, misconception:'component_vs_peas'},
        {text:'P=ตอบเร็วอย่างเดียว, E=อินเทอร์เน็ต, A=server, S=keyboard', correct:false, misconception:'speed_only'}
      ]
    },
    {
      id:'s2_peas_003',
      scenario:'หุ่นยนต์ดูดฝุ่นในบ้าน',
      correct:{
        performance:'ทำความสะอาดครอบคลุม ชนสิ่งของน้อย ใช้เวลา/พลังงานเหมาะสม',
        environment:'พื้นห้อง เฟอร์นิเจอร์ ฝุ่น คน/สัตว์เลี้ยง สิ่งกีดขวาง',
        actuators:'ล้อ มอเตอร์ดูดฝุ่น แปรง',
        sensors:'sensor ระยะ กล้อง bumper dust sensor'
      },
      choices:[
        {text:'P=สะอาด/ครอบคลุม/ไม่ชน, E=พื้นและสิ่งกีดขวาง, A=ล้อ/มอเตอร์, S=sensor ระยะ/ฝุ่น', correct:true, misconception:''},
        {text:'P=sensor เยอะ, E=แบตเตอรี่, A=ฝุ่น, S=ล้อ', correct:false, misconception:'peas_swap'},
        {text:'P=ทำงานอัตโนมัติ, E=algorithm, A=แผนที่บ้าน, S=เจ้าของบ้าน', correct:false, misconception:'automation'},
        {text:'P=ราคาถูก, E=กล่องสินค้า, A=คู่มือ, S=สายชาร์จ', correct:false, misconception:'irrelevant_but_plausible'}
      ]
    }
  ];

  const ENV_ITEMS = [
    {
      id:'s2_env_001',
      stem:'เกมหมากรุกสำหรับ AI มี environment แบบใดเด่นที่สุด?',
      correct:'Fully observable, deterministic, sequential, static, discrete, multi-agent',
      choices:[
        {text:'Fully observable, deterministic, sequential, static, discrete, multi-agent', correct:true, misconception:''},
        {text:'Partially observable เพราะผู้เล่นไม่เห็นความคิดของคู่แข่ง', correct:false, misconception:'observable_confusion'},
        {text:'Stochastic เพราะผู้เล่นอาจเดินผิดพลาด', correct:false, misconception:'agent_error_vs_environment'},
        {text:'Continuous เพราะกระดานมีหลายตำแหน่ง', correct:false, misconception:'discrete_continuous'}
      ]
    },
    {
      id:'s2_env_002',
      stem:'รถยนต์ไร้คนขับบนถนนจริงมี environment แบบใดเหมาะสมที่สุด?',
      correct:'Partially observable, stochastic, sequential, dynamic, continuous, multi-agent',
      choices:[
        {text:'Partially observable, stochastic, sequential, dynamic, continuous, multi-agent', correct:true, misconception:''},
        {text:'Fully observable เพราะมีกล้องและ sensor จำนวนมาก', correct:false, misconception:'sensor_full_observable'},
        {text:'Static เพราะถนนเป็นตำแหน่งคงที่', correct:false, misconception:'dynamic_confusion'},
        {text:'Single-agent เพราะรถตัดสินใจเองเพียงคันเดียว', correct:false, misconception:'multiagent_confusion'}
      ]
    },
    {
      id:'s2_env_003',
      stem:'ระบบแนะนำวิดีโอออนไลน์จัดเป็น environment แบบใดในมุมมอง agent?',
      correct:'Partially observable และ sequential เพราะไม่รู้ความชอบทั้งหมดและคำแนะนำก่อนหน้าส่งผลต่อครั้งถัดไป',
      choices:[
        {text:'Partially observable และ sequential เพราะไม่รู้ความชอบทั้งหมดและคำแนะนำก่อนหน้าส่งผลต่อครั้งถัดไป', correct:true, misconception:''},
        {text:'Fully observable เพราะมีประวัติการดูครบทุกคลิป', correct:false, misconception:'data_not_full_observable'},
        {text:'Episodic เพราะแต่ละคำแนะนำไม่เกี่ยวข้องกับพฤติกรรมต่อไป', correct:false, misconception:'episodic_sequential'},
        {text:'Deterministic เสมอ เพราะ algorithm ให้ผลลัพธ์เดิมทุกครั้ง', correct:false, misconception:'deterministic_confusion'}
      ]
    }
  ];

  const BOSS_CLAIMS = [
    {
      id:'s2_boss_001',
      claim:'ถ้าระบบมี sensor ก็เป็น intelligent agent แน่นอน',
      counter:'ไม่เสมอไป sensor เป็นเพียงช่องทางรับ percept ต้องดูว่าระบบเลือก action เพื่อบรรลุ goal อย่างมีเหตุผลหรือไม่',
      hint:'sensor อยู่ใน S ของ PEAS แต่ไม่ใช่ทั้งหมดของ agent',
      why:'agent ต้องมี percept, action, goal/performance measure และการตัดสินใจ',
      key:'sensor'
    },
    {
      id:'s2_boss_002',
      claim:'Performance measure คือสิ่งที่ agent ใช้รับข้อมูลจากโลก',
      counter:'ไม่ใช่ Performance measure คือเกณฑ์วัดความสำเร็จ ส่วนสิ่งที่รับข้อมูลคือ Sensors',
      hint:'แยก P กับ S ใน PEAS',
      why:'P ใช้วัดผลว่า agent ทำดีไหม ส่วน S คือช่องทางรับ percept',
      key:'peas_swap'
    },
    {
      id:'s2_boss_003',
      claim:'Rational agent ต้องเลือก action ที่ดีที่สุดจริงเสมอ',
      counter:'ไม่จำเป็นต้องดีที่สุดจริง แต่ควรเลือก action ที่คาดว่าจะดีที่สุดจาก percept และความรู้ที่มีในขณะนั้น',
      hint:'rational ไม่ได้แปลว่า omniscient',
      why:'rationality ขึ้นกับข้อมูล/ความรู้ที่ agent มี ไม่ใช่การรู้ทุกอย่าง',
      key:'rationality'
    },
    {
      id:'s2_boss_004',
      claim:'ถ้า environment เป็น dynamic แปลว่า agent ต้องเคลื่อนที่ได้เท่านั้น',
      counter:'ไม่ใช่ dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ ไม่จำเป็นว่า agent ต้องเคลื่อนที่',
      hint:'dynamic คือสภาพแวดล้อมเปลี่ยน ไม่ใช่ตัว agent ขยับ',
      why:'เช่นตลาดหุ้นหรือ traffic เป็น dynamic แม้ agent เป็น software',
      key:'dynamic_confusion'
    }
  ];

  function shuffle(array){
    const a = array.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function pick(array, n){
    return shuffle(array).slice(0, n);
  }

  function buildSession2Round(difficulty){
    const diff = difficulty || 'normal';
    const counts = {
      easy:{agent:4, peas:2, env:2, boss:2},
      normal:{agent:5, peas:3, env:3, boss:3},
      challenge:{agent:6, peas:3, env:3, boss:4}
    }[diff] || {agent:5, peas:3, env:3, boss:3};

    return {
      version: VERSION,
      title:'Session 2: Intelligent Agent',
      phases:['Agent or Not','PEAS Builder','Environment Classifier','Agent Boss'],
      agent: pick(AGENT_CARDS, counts.agent),
      peas: pick(PEAS_ITEMS, counts.peas),
      env: pick(ENV_ITEMS, counts.env),
      boss: pick(BOSS_CLAIMS, counts.boss)
    };
  }

  window.AIQUEST_SESSION2_BANK = {
    VERSION,
    AGENT_CARDS,
    PEAS_ITEMS,
    ENV_ITEMS,
    BOSS_CLAIMS,
    buildSession2Round
  };

  window.buildSession2Round = buildSession2Round;

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
