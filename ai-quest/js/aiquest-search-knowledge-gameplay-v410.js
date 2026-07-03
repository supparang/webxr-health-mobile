/*
  CSAI2102 AI Quest
  v4.1.23 — Thai-first UI + Canonical B1 Foundation Gate
  ------------------------------------------------------------
  B1 is placed after S3. This runtime extension makes B1 assess
  S1 AI foundations, S2 agents/PEAS, and S3 search foundations.
*/
(function(){
  'use strict';

  const VERSION = 'v4.1.23-b1-s1-s3-foundation-gate';
  const B1_HISTORY_KEY = 'CSAI2102_AIQUEST_B1_S3_GATE_HISTORY_V362';
  const B1_HISTORY_WINDOW = 8;

  const LABELS = {
    'Card Rush':'ตัดสินใจเร็ว: AI หรือไม่ (Card Rush)',
    'Trick Check':'จับกับดักความเข้าใจ (Trick Check)',
    'Explain Strike':'อธิบายเหตุผล (Explain Strike)',
    'Rookie Boss':'บอสมือใหม่ AI (Rookie Boss)',
    'Agent Check':'ตรวจระบบตัวแทน (Agent Check)',
    'PEAS Builder':'สร้าง PEAS ของ Agent (PEAS Builder)',
    'Environment Lab':'วิเคราะห์สภาพแวดล้อม (Environment Lab)',
    'Rational Agent Boss':'บอสตัวแทนมีเหตุผล (Rational Agent Boss)',
    'Search Concept':'แนวคิดการค้นหา (Search Concept)',
    'BFS Trace':'ตามรอย BFS (BFS Trace)',
    'DFS Trace':'ตามรอย DFS (DFS Trace)',
    'Search Boss':'บอสการค้นหา (Search Boss)',
    'Cost Concept':'แนวคิดต้นทุนเส้นทาง (Cost Concept)',
    'UCS Trace':'ตามรอย UCS (UCS Trace)',
    'Optimal Path':'เส้นทางต้นทุนต่ำสุด (Optimal Path)',
    'Frontier Cost':'เลือกจากแนวหน้าตามต้นทุน (Frontier Cost)',
    'BFS vs UCS':'เปรียบเทียบ BFS กับ UCS',
    'Cost Boss':'บอสต้นทุนเส้นทาง (Cost Boss)',
    'A* Concept':'แนวคิด A* (A* Concept)',
    'A* Trace':'ตามรอย A* (A* Trace)',
    'Heuristic Check':'ตรวจค่า heuristic (Heuristic Check)',
    'A* Boss':'บอส A*',
    'Search Arena':'สนามประลองการค้นหา (Search Arena)',
    'Knowledge Concept':'แนวคิดความรู้ (Knowledge Concept)',
    'Representation Choice':'เลือกวิธีแทนความรู้ (Representation Choice)',
    'Inference Drill':'ฝึกการอนุมาน (Inference Drill)',
    'Consistency Debug':'ตรวจความสอดคล้อง (Consistency Debug)',
    'Knowledge Boss':'บอสฐานความรู้ (Knowledge Boss)'
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function clone(value){ return JSON.parse(JSON.stringify(value || {})); }

  function shuffle(items){
    const out = (items || []).slice();
    for(let i=out.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function thaiScenario(value){
    return text(value)
      .replace(/agent\s*scenario\s*(\d+)/ig,'สถานการณ์ที่ $1')
      .replace(/scenario\s*(\d+)/ig,'สถานการณ์ที่ $1');
  }

  function localizeItem(item){
    if(!item || typeof item !== 'object') return item;
    const rawPhase = text(item.phase);
    if(LABELS[rawPhase]) item.phase = LABELS[rawPhase];
    ['label','prompt','scenario'].forEach(key => {
      if(item[key]) item[key] = thaiScenario(item[key]);
    });
    return item;
  }

  function localizeRound(round){
    if(!round) return round;
    Object.keys(round).forEach(key => {
      if(Array.isArray(round[key])) round[key] = round[key].map(localizeItem);
    });
    if(Array.isArray(round.phases)){
      round.phases = round.phases.map(phase => LABELS[phase] || phase);
    }
    return round;
  }

  function wrapBuilderForThai(name){
    const original = window[name];
    if(typeof original !== 'function' || original.__thai423) return;
    const wrapped = function(difficulty){ return localizeRound(original(difficulty)); };
    wrapped.__thai423 = true;
    window[name] = wrapped;
  }

  function profileKey(){
    try{
      const profile = window.AIQuestStorage && window.AIQuestStorage.getProfile
        ? window.AIQuestStorage.getProfile()
        : {};
      return String((profile.studentId || 'anon') + '_' + (profile.section || '101')).replace(/[^\w-]/g, '_');
    }catch(error){
      return 'anon_101';
    }
  }

  function readB1History(){
    try{
      const all = JSON.parse(localStorage.getItem(B1_HISTORY_KEY) || '{}');
      const rows = all && all[profileKey()];
      return Array.isArray(rows) ? rows : [];
    }catch(error){
      return [];
    }
  }

  function writeB1History(record){
    try{
      const all = JSON.parse(localStorage.getItem(B1_HISTORY_KEY) || '{}');
      const key = profileKey();
      const list = Array.isArray(all[key]) ? all[key] : [];
      list.unshift(record);
      all[key] = list.slice(0, B1_HISTORY_WINDOW);
      localStorage.setItem(B1_HISTORY_KEY, JSON.stringify(all));
    }catch(error){}
  }

  function resetB1SearchHistory(){
    try{
      const all = JSON.parse(localStorage.getItem(B1_HISTORY_KEY) || '{}');
      delete all[profileKey()];
      localStorage.setItem(B1_HISTORY_KEY, JSON.stringify(all));
    }catch(error){}
  }

  function signature(item){
    return String([
      item && item.key,
      item && item.phase,
      item && item.claim,
      item && item.answer
    ].filter(Boolean).join(' | '))
      .toLowerCase()
      .replace(/\d+/g, '#')
      .replace(/\s+/g, ' ')
      .slice(0, 360);
  }

  const SEARCH_BLUEPRINTS = [
    ['bfs_shortest','BFS ใน graph ที่ทุก edge มีน้ำหนักเท่ากัน เหมาะเมื่อใด','เหมาะเมื่ออยากหาเส้นทางที่มีจำนวน edge น้อยที่สุด เพราะ BFS สำรวจเป็นชั้น', ['เหมาะเสมอใน weighted graph ทุกแบบ', 'ใช้แทน UCS ได้แม้ต้นทุนแต่ละ edge ต่างกัน', 'เลือก path ที่ลึกที่สุดก่อน'], 'BFS รับประกัน shortest path ใน unweighted/equal-cost graph'],
    ['dfs_limit','DFS รับประกัน shortest path เสมอหรือไม่','ไม่รับประกัน เพราะ DFS ลงลึกตามกิ่งก่อนและอาจพบเส้นทางที่ยาวกว่า', ['รับประกันเสมอเพราะลงลึกกว่า', 'รับประกันเมื่อมี visited set', 'รับประกันเมื่อมี goal เดียว'], 'DFS ไม่ได้ optimize ความสั้นของ path'],
    ['frontier_visited','frontier ต่างจาก visited อย่างไร','frontier คือ state ที่รอพิจารณา ส่วน visited คือ state ที่ตรวจ/ขยายแล้วเพื่อช่วยกันวนซ้ำ', ['frontier คือ final path เสมอ', 'visited คือ state ที่ยังไม่เคยเห็น', 'สองคำนี้ใช้แทนกันได้ทุกกรณี'], 'แยก frontier ออกจาก visited เพื่ออ่าน trace ให้ถูก'],
    ['expanded_path','expanded order คือ final path เสมอหรือไม่','ไม่เสมอ final path ต้องย้อนตาม parent chain จาก goal ไม่ใช่คัดทุก node ที่ถูก expand', ['เสมอ เพราะทุก node ที่ expand อยู่บน path', 'เสมอเมื่อใช้ BFS เท่านั้น', 'ใช้ visited set ทั้งหมดเป็น final path'], 'Trace การค้นหาไม่เท่ากับ solution path'],
    ['goal_test','ใน search ถ้าเห็นชื่อ goal อยู่ใน frontier แล้วจะสรุปคำตอบทันทีได้ทุกวิธีหรือไม่','ไม่ได้ ต้องพิจารณากติกาและลำดับการเลือก node ของ algorithm ก่อนสรุปผล', ['ได้เสมอเพราะ goal สำคัญที่สุด', 'ได้เมื่อ frontier ยังว่าง', 'ต้องเปลี่ยนเป็น DFS ทันที'], 'Goal discovery และการยืนยัน solution เป็นคนละขั้น'],
    ['state_space','โจทย์ puzzle ต้องระบุ state space เพื่ออะไร','เพื่อกำหนดว่าแต่ละสถานะ การกระทำ และการเปลี่ยนผ่านใดที่ search สามารถพิจารณาได้', ['เพื่อทำให้ BFS กลายเป็น AI เสมอ', 'เพื่อแทน parent chain ด้วย random', 'เพื่อไม่ต้องกำหนด goal test'], 'State space เป็นแบบจำลองปัญหาสำหรับการค้นหา']
  ];

  const INTEGRATED_BLUEPRINTS = [
    ['agent_search','หุ่นยนต์ส่งของมี sensor ตรวจสิ่งกีดขวาง ต้องหาทางไปเป้าหมายในแผนที่ที่ทุกทางมีน้ำหนักเท่ากัน แนวทางใดเหมาะสมที่สุด','กำหนด percept/action/goal ของ agent แล้วใช้ BFS หาเส้นทางที่มีจำนวน edge น้อยที่สุด', ['ใช้ DFS เพราะลงลึกก่อนจึงสั้นที่สุด', 'ใช้ sensor แทน goal test ได้ทั้งหมด', 'สรุปว่าเป็น AI เพียงเพราะมีหุ่นยนต์'], 'เชื่อม Agent/PEAS กับการเลือก search ตามคุณสมบัติปัญหา'],
    ['peas_search','ในระบบนำทาง ตัววัดผลต้องรวมทั้งการถึงเป้าหมายและการหลีกเลี่ยงการวนซ้ำ ข้อใดสะท้อน PEAS และ graph search ได้ถูกต้อง','กำหนด performance measure ให้ถึงเป้าหมายอย่างมีประสิทธิภาพ และใช้ visited/frontier เพื่อจัดการ state ซ้ำ', ['กำหนดเฉพาะชื่อ algorithm โดยไม่สน goal', 'ใช้ action เป็นตัวแทน performance measure', 'ไม่ต้องมี percept ถ้าใช้ BFS'], 'PEAS ต้องสอดคล้องกับการออกแบบ state space และ search'],
    ['automation_vs_agent_search','ระบบคลังสินค้าเดินตามลำดับเส้นตายตัว แต่ไม่ตรวจสภาพทางและไม่ปรับเส้นทาง เมื่อเรียกว่า intelligent search agent ข้อใดถูกต้อง','ยังไม่เพียงพอ ต้องมี percept/goal และการตัดสินใจตามสถานะ ไม่ใช่ทำตามลำดับตายตัวอย่างเดียว', ['เป็น intelligent agent เสมอเพราะเคลื่อนที่ได้', 'เป็น BFS ทันทีเพราะมีเส้นทาง', 'เป็น AI เพราะมี if-else หลายข้อ'], 'แยก automation ออกจาก agent ที่ใช้ข้อมูลตัดสินใจ'],
    ['rationality_search','agent เลือกเส้นทางที่สั้นตามจำนวน edge แต่โจทย์กำหนดว่าทุก edge เท่ากัน การตัดสินใจนี้อธิบายได้ดีที่สุดอย่างไร','เป็นการเลือก action ที่มีเหตุผลตาม performance measure และคุณสมบัติของ problem ที่ทำให้ BFS เหมาะสม', ['ไม่เป็นเหตุผลเพราะ BFS ไม่ใช่ AI', 'ต้องใช้ DFS เสมอเมื่อมีหลายทาง', 'ไม่ต้องนิยาม goal ถ้าใช้ algorithm ถูก'], 'Rationality คือเลือก action ที่เหมาะกับข้อมูลและเป้าหมาย']
  ];

  const CONTEXTS = [
    'แผนที่มหาวิทยาลัย', 'เกม maze', 'หุ่นยนต์ส่งของ', 'ระบบนำทางในอาคาร',
    'web crawler', 'puzzle search', 'warehouse route', 'ทางหนีฉุกเฉิน',
    'ระบบช่วยเหลือผู้สูงอายุ', 'ระบบเก็บสินค้าอัตโนมัติ'
  ];

  const FORMS = [
    (context, claim) => `Boss Claim: “${claim}”`,
    (context, claim) => `ใน${context} มีผู้เรียนกล่าวว่า “${claim}” ควรโต้แย้งอย่างไร?`,
    (context, claim) => `Debug misconception สำหรับ${context}: “${claim}” คำตอบใดถูกต้องที่สุด?`,
    (context, claim) => `โจทย์ประยุกต์ใน${context}: “${claim}” ควรสรุปอย่างไร?`,
    (context, claim) => `ระหว่างออกแบบ AI agent ใน${context} พบข้ออ้างว่า “${claim}” ให้เลือกเหตุผลที่ถูกต้องที่สุด`
  ];

  function buildExtensionItems(blueprints, phase, prefix, variants){
    const items = [];
    const totalVariants = variants || 12;
    for(let variant=0; variant<totalVariants; variant++){
      blueprints.forEach((blueprint, index) => {
        const context = CONTEXTS[(variant + index) % CONTEXTS.length];
        const claim = blueprint[1];
        items.push({
          id:`${prefix}_${String(variant).padStart(2,'0')}_${String(index).padStart(2,'0')}`,
          familyId:`${prefix}_${blueprint[0]}_${variant % 4}`,
          variantId:`gate_${variant % FORMS.length}`,
          type:'boss_claim',
          phase,
          difficulty:variant % 5 === 0 ? 'hard' : variant % 3 === 0 ? 'normal' : 'easy',
          key:blueprint[0],
          claim:FORMS[variant % FORMS.length](context, claim),
          answer:blueprint[2],
          why:blueprint[4],
          hint:'เชื่อม goal, percept/action, state space, frontier/visited และคุณสมบัติของ BFS/DFS ให้ถูก',
          distractors:blueprint[3],
          context
        });
      });
    }
    return items;
  }

  const SEARCH_ITEMS = buildExtensionItems(SEARCH_BLUEPRINTS, 'Search Foundations', 'b1_s3', 14);
  const FINAL_ITEMS = buildExtensionItems(INTEGRATED_BLUEPRINTS, 'Final Attack', 'b1_integrated', 14);

  function b1Counts(difficulty){
    return {
      easy:{'AI vs Automation':1,'Agent Foundation':1,'PEAS Gate':1,'Environment Gate':1,'Rationality Gate':1,search:2,final:2},
      normal:{'AI vs Automation':1,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':1,'Rationality Gate':1,search:3,final:2},
      hard:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':1,'Rationality Gate':1,search:3,final:3},
      challenge:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':2,'Rationality Gate':2,search:3,final:3}
    }[difficulty || 'normal'];
  }

  function selectCoreClaims(round, counts){
    const core = [];
    ['AI vs Automation','Agent Foundation','PEAS Gate','Environment Gate','Rationality Gate'].forEach(phase => {
      const need = Number(counts[phase] || 0);
      const pool = shuffle((round.claims || []).filter(item => item && item.phase === phase));
      core.push(...pool.slice(0, need));
    });
    return core;
  }

  function selectExtension(pool, count, recent, usedIds, usedFamilies, usedSignatures){
    const candidates = shuffle(pool).map(item => ({item, score:Math.random() * 20}));
    candidates.forEach(entry => {
      const item = entry.item;
      const sig = signature(item);
      if(recent.ids.has(item.id)) entry.score -= 180;
      if(recent.families.has(item.familyId)) entry.score -= 120;
      if(recent.signatures.has(sig)) entry.score -= 220;
      if(usedIds.has(item.id) || usedSignatures.has(sig)) entry.score -= 999;
      if(usedFamilies.has(item.familyId)) entry.score -= 170;
    });

    const chosen = [];
    for(const entry of candidates.sort((a,b) => b.score - a.score)){
      if(chosen.length >= count) break;
      const item = entry.item;
      const sig = signature(item);
      if(usedIds.has(item.id) || usedSignatures.has(sig)) continue;
      chosen.push(clone(item));
      usedIds.add(item.id);
      usedFamilies.add(item.familyId);
      usedSignatures.add(sig);
    }

    if(chosen.length < count){
      for(const item of shuffle(pool)){
        if(chosen.length >= count) break;
        if(usedIds.has(item.id)) continue;
        chosen.push(clone(item));
        usedIds.add(item.id);
        usedFamilies.add(item.familyId);
        usedSignatures.add(signature(item));
      }
    }
    return chosen;
  }

  function installCanonicalB1(){
    const bank = window.AIQUEST_BOSS1_BANK;
    if(!bank || typeof bank.buildBoss1Round !== 'function' || bank.__b1CanonicalV423) return false;

    const originalBuilder = bank.buildBoss1Round;
    const originalReset = bank.resetBoss1History;

    bank.buildBoss1Round = function(difficulty){
      const diff = difficulty || 'normal';
      const baseRound = originalBuilder.call(bank, diff);
      const counts = b1Counts(diff);
      const core = selectCoreClaims(baseRound, counts);
      const history = readB1History();
      const recent = {ids:new Set(), families:new Set(), signatures:new Set()};
      history.forEach(row => {
        (row.itemIds || []).forEach(id => recent.ids.add(id));
        (row.familyIds || []).forEach(id => recent.families.add(id));
        (row.signatures || []).forEach(sig => recent.signatures.add(sig));
      });

      const usedIds = new Set(core.map(item => item.id));
      const usedFamilies = new Set(core.map(item => item.familyId));
      const usedSignatures = new Set(core.map(signature));
      const search = selectExtension(SEARCH_ITEMS, counts.search, recent, usedIds, usedFamilies, usedSignatures);
      const final = selectExtension(FINAL_ITEMS, counts.final, recent, usedIds, usedFamilies, usedSignatures);
      const claims = [...core, ...search, ...final];

      writeB1History({
        ts:new Date().toISOString(),
        difficulty:diff,
        itemIds:[...search, ...final].map(item => item.id),
        familyIds:[...search, ...final].map(item => item.familyId),
        signatures:[...search, ...final].map(signature),
        policy:'S3 search + integrated S1-S3, item/family/signature anti-repeat'
      });

      return {
        ...baseRound,
        version:'v4.1.23-b1-s1-s3-foundation-gate',
        title:'B1: Foundation Boss Gate',
        phases:['AI vs Automation','Agent Foundation','PEAS Gate','Environment Gate','Rationality Gate','Search Foundations','Final Attack'],
        claims,
        gateScope:['S1','S2','S3'],
        noRepeat:{
          ...(baseRound.noRepeat || {}),
          extensionHistoryWindow:B1_HISTORY_WINDOW,
          extensionItemIds:[...search, ...final].map(item => item.id),
          extensionFamilyIds:[...search, ...final].map(item => item.familyId),
          policy:'core strong no-repeat + S3 extension item/family/signature'
        }
      };
    };

    bank.resetBoss1History = function(){
      try{
        if(typeof originalReset === 'function') originalReset.call(bank);
      }catch(error){}
      resetB1SearchHistory();
    };

    bank.canonicalGate = {
      version:VERSION,
      scope:['S1','S2','S3'],
      searchItems:SEARCH_ITEMS.length,
      integratedItems:FINAL_ITEMS.length
    };
    bank.__b1CanonicalV423 = true;
    window.buildBoss1Round = bank.buildBoss1Round;
    return true;
  }

  function isS2Boss(button){
    const shell = button.closest('.gamePanel,.missionPanel,.questionCard,.panel,.card,section,div') || document.body;
    const nearby = (shell.innerText || '').slice(0,1600);
    const page = (document.body.innerText || '').slice(0,5000);
    return /Rational Agent Boss|บอสตัวแทนมีเหตุผล|Agent Boss|คำกล่าวของบอส/i.test(nearby) || (/Session 2|Agent Builder|S2/i.test(page) && /Boss|บอส/i.test(nearby));
  }

  function feedbackBox(button){
    let parent = button.parentElement;
    for(let i=0;i<6 && parent;i++,parent=parent.parentElement){
      if(parent.querySelectorAll('button').length >= 2) return parent;
    }
    return button.parentElement || document.body;
  }

  function showS2BossFeedback(button){
    if(!isS2Boss(button)) return;
    const box = feedbackBox(button);
    const old = box.querySelector('.aq-s2-boss-feedback');
    if(old) old.remove();
    const correct = button.dataset.ok === 'true' || button.classList.contains('correct') || /ไม่ถูก|ไม่จริง|ไม่เสมอ|ต้องดู/.test(button.textContent || '');
    const message = document.createElement('div');
    message.className = 'aq-s2-boss-feedback';
    message.style.cssText = 'margin-top:12px;padding:12px 14px;border-radius:14px;line-height:1.55;font-weight:800;text-align:left;background:' + (correct ? 'rgba(52,211,153,.12)' : 'rgba(251,113,133,.12)');
    message.textContent = correct
      ? '✅ ตอบถูก — ตรวจจาก percept, action และ goal ไม่ใช่แค่คำว่า smart หรือ automatic.'
      : '❌ ยังไม่ถูก — ตรวจว่า agent รับรู้อะไร มีเป้าหมายใด และเลือก action ตามข้อมูลหรือไม่.';
    box.appendChild(message);
  }

  function replaceExact(value, replacements){
    const source = text(value);
    return replacements[source] || source;
  }

  function uiS2(value){
    let output = replaceExact(value, {
      'Agent or Not':'Agent หรือไม่? (Agent or Not)',
      'PEAS Builder':'สร้าง PEAS ของ Agent (PEAS Builder)',
      'Environment Classifier':'วิเคราะห์สภาพแวดล้อม (Environment Classifier)',
      'Rational Agent Boss':'บอสตัวแทนมีเหตุผล (Rational Agent Boss)',
      'Boss Claim':'คำกล่าวของบอส'
    });
    return output
      .replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*Agent or Not$/i,'ช่วงที่ $1 จาก $2 · Agent หรือไม่? (Agent or Not)')
      .replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*PEAS Builder$/i,'ช่วงที่ $1 จาก $2 · สร้าง PEAS ของ Agent (PEAS Builder)')
      .replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*Environment Classifier$/i,'ช่วงที่ $1 จาก $2 · วิเคราะห์สภาพแวดล้อม (Environment Classifier)')
      .replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*Rational Agent Boss$/i,'ช่วงที่ $1 จาก $2 · บอสตัวแทนมีเหตุผล (Rational Agent Boss)');
  }

  function uiS3(value){
    return replaceExact(value, {
      'State graph':'กราฟสถานะ (State Graph)',
      'Search trace':'ลำดับการค้นหา (Search Trace)',
      'Phase':'ช่วงการเรียน',
      'Search Boss':'บอสการค้นหา (Search Boss)'
    })
      .replace(/^S3 Search Maze · (.+)$/,'S3 เขาวงกตการค้นหา (Search Maze) · $1')
      .replace(/visited order/ig,'ลำดับโหนดที่ตรวจแล้ว (visited order)')
      .replace(/final path/ig,'เส้นทางคำตอบสุดท้าย (final path)')
      .replace(/frontier/ig,'ชุดโหนดรอพิจารณา (frontier)');
  }

  function uiS5(value){
    return replaceExact(value, {
      'A* Rescue Mission':'ภารกิจช่วยเหลือด้วย A* (A* Rescue Mission)',
      'A* Concept':'แนวคิด A* (A* Concept)',
      'A* Trace':'ตามรอย A* (A* Trace)',
      'Heuristic Check':'ตรวจค่า heuristic (Heuristic Check)',
      'A* Boss':'บอส A*',
      'Boss Claim':'คำกล่าวของบอส',
      'Concept Focus':'ประเด็นแนวคิด',
      'Phase score':'คะแนนช่วงการเรียน'
    })
      .replace(/^S5 A\* Rescue Mission · (.+)$/,'S5 ภารกิจช่วยเหลือด้วย A* (A* Rescue Mission) · $1')
      .replace(/g\(n\)/g,'g(n) = ต้นทุนที่เดินมาแล้ว')
      .replace(/h\(n\)/g,'h(n) = ค่าประมาณถึงเป้าหมาย')
      .replace(/heuristic/ig,'ค่าประมาณ (heuristic)')
      .replace(/frontier/ig,'ชุดโหนดรอพิจารณา (frontier)');
  }

  function uiS6(value){
    return replaceExact(value, {
      'Knowledge Base Forge':'ฐานความรู้ (Knowledge Base Forge)',
      'Knowledge Drill':'ภารกิจฝึกฐานความรู้',
      'Knowledge Concept':'แนวคิดความรู้ (Knowledge Concept)',
      'Representation Choice':'เลือกวิธีแทนความรู้ (Representation Choice)',
      'Inference Drill':'ฝึกการอนุมาน (Inference Drill)',
      'Consistency Debug':'ตรวจความสอดคล้อง (Consistency Debug)',
      'Knowledge Boss':'บอสฐานความรู้ (Knowledge Boss)',
      'Knowledge Representation / Knowledge Base / Rules':'การแทนความรู้ / ฐานความรู้ / กฎ',
      'AI Help':'คำใบ้ AI',
      'Next Question':'ข้อต่อไป'
    })
      .replace(/^6:\s*Knowledge Base Forge$/,'6: ฐานความรู้ (Knowledge Base Forge)')
      .replace(/^Knowledge Drill\s*(\d+)$/,'ภารกิจฝึกฐานความรู้ ข้อที่ $1')
      .replace(/^S6 Knowledge Base Forge · (.+)$/,'S6 ฐานความรู้ (Knowledge Base Forge) · $1')
      .replace(/^Correct$/,'ถูกต้อง')
      .replace(/^Not correct$/,'ยังไม่ถูกต้อง');
  }

  function uiB1(value){
    return text(value)
      .replace(/^Rookie AI Boss · /,'B1 Foundation Boss Gate (S1–S3) · ')
      .replace(/^B1: Rookie AI Boss$/,'B1: Foundation Boss Gate (S1–S3)')
      .replace(/^Boss Claim$/,'คำกล่าวของบอส')
      .replace(/^Search Foundations$/,'พื้นฐานการค้นหา (Search Foundations)')
      .replace(/^Final Attack$/,'โจมตีสรุป (Final Attack)');
  }

  function applyText(area, predicate, transform, selector){
    if(!area || !predicate(area.innerText || '')) return;
    area.querySelectorAll(selector).forEach(element => {
      const before = text(element.textContent);
      const after = transform(before);
      if(before !== after) element.textContent = after;
    });
  }

  function applyUi(){
    const area = document.getElementById('gameArea');
    if(!area) return;
    applyText(area, value => /Session 2|Agent Builder|Agent or Not|PEAS Builder|Environment Classifier|Rational Agent Boss/i.test(value), uiS2, '.phasePill,.tagline,.feedback b,h3');
    applyText(area, value => /S3 Search Maze|Search trace|visited order|final path|State graph|Search Boss/i.test(value), uiS3, '.phasePill,.tagline,.learningFeedbackPanel h4,.learningFeedbackPanel b,.gamePanel p,.bigCard b');
    applyText(area, value => /A\* Rescue Mission|A\* Trace|Heuristic Check|A\* Boss|g\(n\)|h\(n\)|f\(n\)/i.test(value), uiS5, '.phasePill,.tagline,.learningFeedbackPanel h3,.learningFeedbackPanel h4,.learningFeedbackPanel b,.feedback b,.gamePanel p,.bigCard b,h3');
    applyText(area, value => /Knowledge Base Forge|Knowledge Drill|Knowledge Concept|Representation Choice|Inference Drill|Consistency Debug|Knowledge Boss/i.test(value), uiS6, '.phasePill,.tagline,.learningFeedbackPanel h3,.learningFeedbackPanel h4,.learningFeedbackPanel b,.feedback b,.gamePanel p,.bigCard b,h1,h2,h3');
    applyText(area, value => /Rookie AI Boss|Foundation Boss Gate|Search Foundations|Final Attack/i.test(value), uiB1, '.phasePill,.tagline,.learningFeedbackPanel h3,.learningFeedbackPanel h4,.learningFeedbackPanel b,.feedback b,.gamePanel p,.bigCard b,h1,h2,h3');
  }

  function listen(){
    document.addEventListener('click', event => {
      const button = event.target.closest('button,.choiceBtn,.choice');
      if(button) setTimeout(() => showS2BossFeedback(button), 60);
    }, true);

    const area = document.getElementById('gameArea');
    if(area){
      new MutationObserver(() => requestAnimationFrame(applyUi)).observe(area, {childList:true, subtree:true});
    }
    setTimeout(applyUi, 500);
  }

  function run(){
    const b1Installed = installCanonicalB1();
    ['buildMission1Round','buildSession2Round','buildBoss1Round','buildSession3Round','buildSession4Round','buildSession5Round','buildBoss2Round','buildSession6Round'].forEach(wrapBuilderForThai);
    listen();
    window.AIQuestSearchKnowledgeGameplay = {
      version:VERSION,
      mode:'thai-first-s2-s6-visible-ui',
      b1Installed,
      b1Scope:['S1','S2','S3']
    };
    console.log('[AIQuest] ' + VERSION + ' loaded', {b1Installed});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(run, 250), {once:true});
  }else{
    setTimeout(run, 250);
  }
})();
