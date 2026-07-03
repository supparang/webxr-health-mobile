/*
  CSAI2102 AI Quest — B2 Applied AI Gate
  v3.6.2
  ------------------------------------------------------------
  Canonical B2 scope: S4 Route Cost -> S5 A* -> S6 Knowledge Base
  The builder replaces the legacy S3-S5 selection with a balanced,
  replay-safe S4-S6 applied assessment.
*/
(function(){
  'use strict';

  const VERSION = 'v3.6.2-b2-applied-s4-s6';
  const KEY = 'CSAI2102_AIQUEST_B2_APPLIED_HISTORY_V362';
  const HISTORY_WINDOW = 8;

  function pad(n){ return String(n).padStart(3, '0'); }
  function clone(value){ return JSON.parse(JSON.stringify(value || {})); }
  function shuffle(items){
    const out = (items || []).slice();
    for(let i=out.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
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

  function readHistory(){
    try{
      const all = JSON.parse(localStorage.getItem(KEY) || '{}');
      const rows = all && all[profileKey()];
      return Array.isArray(rows) ? rows : [];
    }catch(error){
      return [];
    }
  }

  function writeHistory(record){
    try{
      const all = JSON.parse(localStorage.getItem(KEY) || '{}');
      const key = profileKey();
      const list = Array.isArray(all[key]) ? all[key] : [];
      list.unshift(record);
      all[key] = list.slice(0, HISTORY_WINDOW);
      localStorage.setItem(KEY, JSON.stringify(all));
    }catch(error){}
  }

  function resetB2History(){
    try{
      const all = JSON.parse(localStorage.getItem(KEY) || '{}');
      delete all[profileKey()];
      localStorage.setItem(KEY, JSON.stringify(all));
    }catch(error){}
  }

  function textSignature(item){
    return String([
      item && item.familyId,
      item && item.phase,
      item && item.prompt,
      item && item.answer
    ].filter(Boolean).join(' | '))
      .toLowerCase()
      .replace(/\d+/g, '#')
      .replace(/\s+/g, ' ')
      .slice(0, 360);
  }

  const SCENARIOS = [
    // S4: Route Cost / UCS
    ['S4 Cost Search', 'ucs_weighted', 'เส้นทาง A มี 2 edge ต้นทุนรวม 20 ส่วนเส้นทาง B มี 3 edge ต้นทุนรวม 8 เมื่อเป้าหมายคือต้นทุนต่ำสุด ควรใช้แนวคิดใด', 'เลือก Uniform Cost Search เพราะต้องเปรียบเทียบ cumulative cost ของเส้นทาง ไม่ใช่จำนวน edge', ['เลือก BFS เพราะจำนวน edge น้อยกว่าต้องดีที่สุดเสมอ', 'เลือก DFS เพราะลงลึกก่อนจึงได้ต้นทุนต่ำสุด', 'เลือก Greedy โดยไม่ต้องดูต้นทุนที่เดินมา'], 'Weighted graph ต้องดูผลรวม cost', 'ucs_weighted'],
    ['S4 Cost Search', 'ucs_goal_pop', 'UCS พบ goal อยู่ใน frontier ด้วย cost 15 แต่ยังมี node อื่น cost 5 อยู่ใน frontier ควรทำอย่างไร', 'ยังไม่ควรหยุด ต้องเลือก node ที่มี cost ต่ำสุดก่อน เพราะอาจพบเส้นทางไป goal ที่ถูกกว่า', ['หยุดทันทีเพราะเห็น goal แล้ว', 'ลบ node cost 5 เพราะ goal สำคัญกว่า', 'เปลี่ยนเป็น DFS เพื่อให้จบเร็ว'], 'UCS ตอบเมื่อ goal ถูกเลือกออกจาก frontier ด้วย priority ที่ถูกต้อง', 'ucs_goal_pop'],
    ['S4 Cost Search', 'ucs_relax', 'พบทางไปยัง X เดิมมี cost 12 แล้วพบทางใหม่ไป X มี cost 7 ระบบควรปรับอะไร', 'อัปเดต cost และ parent ของ X เป็นเส้นทาง cost 7', ['เก็บ cost 12 เพราะพบก่อน', 'ลบ X ออกจาก graph', 'ไม่ต้องเก็บ parent เพราะมี visited แล้ว'], 'Relaxation ทำให้ระบบเก็บเส้นทางที่ดีกว่า', 'ucs_relax'],
    ['S4 Cost Search', 'bfs_vs_ucs', 'มีผู้เรียนกล่าวว่า BFS กับ UCS ให้คำตอบเหมือนกันเสมอใน weighted graph ควรตอบอย่างไร', 'ไม่ถูก BFS พิจารณาจำนวน edge แต่ UCS พิจารณา cumulative cost จึงต่างกันเมื่อ cost ไม่เท่ากัน', ['ถูก เพราะทั้งคู่มี frontier', 'ถูกเมื่อมี goal เพียงหนึ่งเดียว', 'DFS คือ UCS แบบเร็วกว่า'], 'BFS และ UCS ต่างกันตาม cost structure', 'bfs_vs_ucs'],
    ['S4 Cost Search', 'priority_queue', 'ใน UCS node ใดควรถูกนำออกจาก priority queue ก่อน', 'node ที่มี cumulative cost g(n) ต่ำสุดตามข้อมูลปัจจุบัน', ['node ที่อยู่ลึกที่สุด', 'node ที่ชื่อใกล้ goal ที่สุดโดยไม่ดู cost', 'node ที่ถูกค้นพบก่อนเสมอ'], 'UCS จัดลำดับด้วย g(n)', 'priority_queue'],

    // S5: A* / Heuristic
    ['S5 Heuristic Search', 'astar_formula', 'A มี g=4,h=3 และ B มี g=2,h=6 ใน A* ควรเลือก node ใดก่อน', 'เลือก A เพราะ f(A)=g+h=7 ต่ำกว่า f(B)=8', ['เลือก B เพราะ g ต่ำกว่า', 'เลือก B เพราะ h สูงกว่า', 'สุ่มได้เพราะยังไม่ถึง goal'], 'A* เลือกตาม f(n)=g(n)+h(n)', 'astar_formula'],
    ['S5 Heuristic Search', 'greedy_vs_astar', 'ระบบเลือก node ที่ h(n) ต่ำสุดอย่างเดียวโดยไม่สนต้นทุนที่เดินมาแล้ว ระบบนี้ใกล้กับอะไร', 'Greedy Best-First Search มากกว่า A* เพราะ A* ต้องรวม g(n)+h(n)', ['A* แน่นอนเพราะมี heuristic', 'UCS เพราะมี frontier', 'BFS เพราะเลือกทีละ node'], 'Greedy ใช้ h-only ส่วน A* ใช้ g+h', 'greedy_vs_astar'],
    ['S5 Heuristic Search', 'admissible', 'heuristic ประเมินต้นทุนถึง goal สูงกว่าความจริงอย่างเป็นระบบ ผลที่ควรระวังคืออะไร', 'heuristic ไม่ admissible และ A* อาจไม่รับประกัน optimality', ['ยิ่งประเมินสูงยิ่ง optimal', 'A* จะกลายเป็น BFS', 'ไม่ต้องใช้ g(n) อีกต่อไป'], 'Admissible heuristic ไม่ควร overestimate', 'admissible'],
    ['S5 Heuristic Search', 'astar_zero', 'ถ้า heuristic ของทุก node เป็น 0 A* มีพฤติกรรมสอดคล้องกับวิธีใดมากที่สุด', 'Uniform Cost Search เพราะ f(n)=g(n)+0', ['BFS เสมอแม้ cost ต่างกัน', 'DFS เพราะไม่มี heuristic', 'Greedy เพราะ h(n)=0'], 'A* ที่ h=0 ลดรูปเป็น UCS', 'astar_zero'],
    ['S5 Heuristic Search', 'tie_break', 'A* มี node สองตัวที่ f เท่ากัน และโจทย์กำหนดให้เลือก h ต่ำกว่าก่อน ควรทำอย่างไร', 'เลือก node ที่ h ต่ำกว่าเพื่อทำตาม tie-break rule ของโจทย์', ['สุ่มได้เสมอเพราะ f เท่ากัน', 'เลือกชื่อ node ที่สั้นกว่า', 'หยุด search ทันที'], 'Tie-break ทำให้ trace ตรวจสอบได้', 'tie_break'],

    // S6: Knowledge Representation / Inference
    ['S6 Knowledge Representation', 'fact_rule', 'ฐานความรู้มี “Bird(Tweety)” และกฎ “Bird(x) → CanFly(x)” ข้อใดเป็นผลอนุมานที่เหมาะสม', 'CanFly(Tweety) เพราะ fact และ rule ทำให้อนุมานตามกฎได้', ['Bird(x) เป็นเท็จเพราะ x ไม่ใช่ชื่อจริง', 'Tweety เป็นกฎใหม่', 'ต้องสุ่มคำตอบเพราะไม่มีข้อมูลครบ'], 'แยก fact ออกจาก rule แล้วใช้ inference', 'fact_rule'],
    ['S6 Knowledge Representation', 'representation_choice', 'ต้องแทนความรู้ว่า “นักศึกษาทุกคนที่ผ่าน prerequisite จึงลงทะเบียนวิชาถัดไปได้” วิธีใดเหมาะสมที่สุด', 'ใช้กฎเชิงเงื่อนไขที่เชื่อม prerequisite กับสิทธิ์ลงทะเบียน', ['เก็บเป็นข้อความอิสระโดยไม่ระบุเงื่อนไข', 'เก็บเฉพาะรายชื่อทุกคนโดยไม่มีความสัมพันธ์', 'ใช้ค่า random เพื่อทำนายสิทธิ์'], 'Knowledge representation ต้องรักษาความสัมพันธ์เชิงกฎ', 'representation_choice'],
    ['S6 Knowledge Representation', 'forward_inference', 'มี fact ว่า “SensorOnline(R1)” และกฎ “SensorOnline(x) → CanObserve(x)” ข้อใดถูกต้อง', 'อนุมานได้ว่า CanObserve(R1)', ['อนุมานว่า R1 ไม่มี sensor', 'ลบ fact เดิมเพราะมีกฎแล้ว', 'สรุปว่า R1 เป็น goal'], 'Forward inference ใช้ fact ให้ตรงกับ antecedent ของ rule', 'forward_inference'],
    ['S6 Knowledge Representation', 'consistency', 'ฐานความรู้ระบุว่า “RoomA is available” และ “RoomA is not available” พร้อมกัน สิ่งใดควรทำก่อน', 'ตรวจความขัดแย้งของ fact และแหล่งข้อมูลก่อนนำไปอนุมานต่อ', ['ใช้ทั้งสอง fact พร้อมกันโดยไม่ตรวจสอบ', 'เลือก fact ที่เขียนยาวกว่า', 'ลบ rule ทุกข้อในฐานความรู้'], 'Knowledge base ต้องรักษาความสอดคล้อง', 'consistency'],
    ['S6 Knowledge Representation', 'closed_world', 'ไม่มี fact ว่า “HasKey(Nina)” ในฐานความรู้ที่ใช้ open-world reasoning ข้อใดเหมาะสมที่สุด', 'ยังสรุปไม่ได้ว่า Nina ไม่มี key เพียงเพราะไม่พบ fact', ['สรุปทันทีว่า Nina ไม่มี key', 'เพิ่ม fact ว่าไม่มี key โดยอัตโนมัติ', 'อนุมานว่า Nina เป็น goal'], 'การไม่มีข้อมูลไม่เท่ากับข้อมูลเป็นเท็จใน open-world setting', 'closed_world'],

    // Final applied synthesis
    ['Final Applied AI Duel', 'route_plus_rules', 'หุ่นยนต์ส่งของต้องเลือกเส้นทางต้นทุนต่ำและหลีกเลี่ยงห้องที่ฐานความรู้ระบุว่า “ปิดใช้งาน” ระบบควรผสานอะไร', 'ใช้ search เพื่อเลือกเส้นทาง และใช้ knowledge rules เพื่อคัดข้อจำกัดของเส้นทาง', ['ใช้ BFS อย่างเดียวโดยไม่ดูต้นทุนหรือกฎ', 'ใช้ฐานความรู้อย่างเดียวโดยไม่ค้นหาเส้นทาง', 'สุ่มเส้นทางเพื่อหลีกเลี่ยง bias'], 'งาน AI จริงมักผสาน search กับ representation/inference', 'route_plus_rules'],
    ['Final Applied AI Duel', 'astar_knowledge', 'ระบบนำทางมี g(n), h(n) และกฎว่าพื้นที่น้ำท่วมเป็น forbidden zone แนวทางใดเหมาะสมที่สุด', 'ใช้ A* เลือกตาม g+h พร้อมใช้กฎตัด node ที่ละเมิดข้อจำกัด', ['ใช้ h(n) อย่างเดียวและไม่สนข้อจำกัด', 'ใช้ DFS เพราะสามารถเดินผ่านพื้นที่ต้องห้ามได้', 'ละทิ้งกฎเมื่อ heuristic ดี'], 'A* และ rule constraints ต้องทำงานร่วมกัน', 'astar_knowledge'],
    ['Final Applied AI Duel', 'explain_decision', 'ระบบเลือกเส้นทางหนึ่งและผู้ใช้ถามเหตุผล คำอธิบายใดมีคุณภาพที่สุด', 'อธิบายทั้ง cost ที่สะสม ค่า heuristic และกฎ/ข้อจำกัดที่มีผลต่อการตัดสินใจ', ['บอกเพียงว่า AI เลือกเอง', 'บอกว่าเส้นทางนี้สั้นเพราะชื่อ node สั้น', 'ไม่ต้องอธิบายเมื่อคะแนนสูง'], 'Explainability ทำให้ตรวจสอบการตัดสินใจได้', 'explain_decision'],
    ['Final Applied AI Duel', 'update_knowledge', 'หลังห้องหนึ่งปิดกะทันหัน ระบบควรปรับการตัดสินใจอย่างไร', 'อัปเดต fact ในฐานความรู้แล้วคำนวณ search ใหม่ตามข้อจำกัดล่าสุด', ['ใช้เส้นทางเดิมต่อแม้ขัดกับข้อมูลใหม่', 'ลบทุก rule เพื่อให้เร็วขึ้น', 'ใช้คำตอบก่อนหน้าโดยไม่ตรวจสอบ'], 'การตัดสินใจที่ดีต้องอิงข้อมูลและ knowledge ล่าสุด', 'update_knowledge']
  ];

  const CONTEXTS = [
    'แผนที่มหาวิทยาลัย', 'เกม maze', 'หุ่นยนต์ส่งของ', 'ระบบนำทางในอาคาร',
    'web crawler', 'puzzle search', 'warehouse route', 'emergency exit',
    'ระบบช่วยเหลือผู้สูงอายุ', 'ระบบจัดตารางเรียน', 'ระบบคัดกรองงานบริการ', 'ยานยนต์อัตโนมัติจำลอง'
  ];

  const PROMPT_FORMS = [
    (context, prompt) => `${context}: ${prompt}`,
    (context, prompt) => `สถานการณ์ ${context}: ${prompt}`,
    (context, prompt) => `ใน ${context} ให้พิจารณาโจทย์ต่อไปนี้ — ${prompt}`,
    (context, prompt) => `Debug AI decision ใน${context}: ${prompt}`
  ];

  function makeBank(){
    const items = [];
    for(let variant=0; variant<24; variant++){
      SCENARIOS.forEach((scenario, index) => {
        const context = CONTEXTS[(variant + index) % CONTEXTS.length];
        const prompt = PROMPT_FORMS[variant % PROMPT_FORMS.length](context, scenario[2]);
        items.push({
          id:`b2_applied_${pad(variant)}_${pad(index)}`,
          familyId:`b2_${scenario[1]}_${variant % 6}`,
          phase:scenario[0],
          prompt,
          answer:scenario[3],
          distractors:scenario[4],
          why:scenario[5],
          hint:scenario[6],
          context
        });
      });
    }
    return items;
  }

  function rebuildB2(){
    const bank = window.AIQUEST_BOSS2_BANK;
    if(!bank) return null;

    const items = makeBank();
    bank.ITEMS = items;
    bank.counts = {
      total:items.length,
      s4:items.filter(item => item.phase === 'S4 Cost Search').length,
      s5:items.filter(item => item.phase === 'S5 Heuristic Search').length,
      s6:items.filter(item => item.phase === 'S6 Knowledge Representation').length,
      final:items.filter(item => item.phase === 'Final Applied AI Duel').length
    };
    bank.appliedScope = ['s4','s5','s6'];
    bank.appliedVersion = VERSION;
    return bank.counts;
  }

  function recentSets(){
    const history = readHistory();
    const ids = new Set();
    const families = new Set();
    const signatures = new Set();
    history.forEach(row => {
      (row.itemIds || []).forEach(id => ids.add(id));
      (row.familyIds || []).forEach(id => families.add(id));
      (row.signatures || []).forEach(value => signatures.add(value));
    });
    return {ids, families, signatures};
  }

  function pickItems(pool, count, recent, usedIds, usedFamilies, usedSignatures){
    const ranked = shuffle(pool).map(item => ({item, score:Math.random() * 20}));
    ranked.forEach(entry => {
      const item = entry.item;
      const signature = textSignature(item);
      if(recent.ids.has(item.id)) entry.score -= 160;
      if(recent.families.has(item.familyId)) entry.score -= 120;
      if(recent.signatures.has(signature)) entry.score -= 220;
      if(usedIds.has(item.id)) entry.score -= 999;
      if(usedFamilies.has(item.familyId)) entry.score -= 180;
      if(usedSignatures.has(signature)) entry.score -= 999;
    });

    const selected = [];
    for(const entry of ranked.sort((a,b) => b.score - a.score)){
      if(selected.length >= count) break;
      const item = entry.item;
      const signature = textSignature(item);
      if(usedIds.has(item.id) || usedSignatures.has(signature)) continue;
      selected.push(clone(item));
      usedIds.add(item.id);
      usedFamilies.add(item.familyId);
      usedSignatures.add(signature);
    }

    if(selected.length < count){
      for(const item of shuffle(pool)){
        if(selected.length >= count) break;
        if(usedIds.has(item.id)) continue;
        selected.push(clone(item));
        usedIds.add(item.id);
        usedFamilies.add(item.familyId);
        usedSignatures.add(textSignature(item));
      }
    }
    return selected;
  }

  function installAppliedBuilder(){
    const bank = window.AIQUEST_BOSS2_BANK;
    if(!bank || typeof bank.buildBoss2Round !== 'function' || bank.__b2AppliedV362) return false;

    const originalBuilder = bank.buildBoss2Round;
    bank.buildBoss2Round = function(difficulty){
      const oldRound = originalBuilder.call(bank, difficulty || 'normal');
      const total = ['state','graph','maze','boss'].reduce((sum, key) => sum + (Array.isArray(oldRound[key]) ? oldRound[key].length : 0), 0) || 16;
      const base = Math.floor(total / 4);
      const remainder = total % 4;
      const counts = [base + (remainder > 0 ? 1 : 0), base + (remainder > 1 ? 1 : 0), base + (remainder > 2 ? 1 : 0), base];
      const recent = recentSets();
      const usedIds = new Set();
      const usedFamilies = new Set();
      const usedSignatures = new Set();
      const items = bank.ITEMS || [];

      const state = pickItems(items.filter(item => item.phase === 'S4 Cost Search'), counts[0], recent, usedIds, usedFamilies, usedSignatures);
      const graph = pickItems(items.filter(item => item.phase === 'S5 Heuristic Search'), counts[1], recent, usedIds, usedFamilies, usedSignatures);
      const maze = pickItems(items.filter(item => item.phase === 'S6 Knowledge Representation'), counts[2], recent, usedIds, usedFamilies, usedSignatures);
      const boss = pickItems(items.filter(item => item.phase === 'Final Applied AI Duel'), counts[3], recent, usedIds, usedFamilies, usedSignatures);
      const all = [...state, ...graph, ...maze, ...boss];

      writeHistory({
        ts:new Date().toISOString(),
        difficulty:difficulty || 'normal',
        itemIds:all.map(item => item.id),
        familyIds:all.map(item => item.familyId),
        signatures:all.map(textSignature),
        policy:'8-attempt item-family-signature anti-repeat'
      });

      return {
        ...oldRound,
        version:VERSION,
        title:'B2: Applied AI Boss Gate',
        phases:['S4 Cost Search','S5 Heuristic Search','S6 Knowledge Representation','Final Applied AI Duel'],
        state,
        graph,
        maze,
        boss,
        noRepeat:{
          recentWindow:HISTORY_WINDOW,
          itemIds:all.map(item => item.id),
          familyIds:all.map(item => item.familyId),
          policy:'item + family + prompt signature'
        }
      };
    };

    window.buildBoss2Round = bank.buildBoss2Round;
    bank.__b2AppliedV362 = true;
    return true;
  }

  function run(){
    const counts = rebuildB2();
    const builderInstalled = installAppliedBuilder();
    const report = {version:VERSION, counts, builderInstalled, scope:'S4-S6'};
    window.AIQUEST_B2_APPLIED_REPORT = report;
    console.log('[AIQuest] B2 Applied Gate loaded', report);
  }

  run();
})();
