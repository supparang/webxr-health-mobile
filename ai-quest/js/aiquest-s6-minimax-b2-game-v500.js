/*
  CSAI2102 AI Quest
  v5.0.0 — S6 Minimax Arena + B2 Search & Game AI Boss Gate
  ----------------------------------------------------------------
  Canonical course alignment:
  S4 = Uniform Cost Search, S5 = A*, S6 = Minimax / Alpha-Beta,
  B2 = integrated UCS + A* + Minimax evidence.

  This is a runtime replacement layer. It preserves the established
  attempt/event/summary contract and uses mission IDs m6 and b2.
*/
(function(){
  'use strict';

  const VERSION = 'v5.0.0-s6-minimax-b2-search-game-ai';
  const HISTORY_WINDOW = 8;
  const CONFIG = {
    s6:{
      id:'m6', sessionId:'s6', title:'Minimax Arena',
      fullTitle:'S6: Minimax Arena',
      topic:'Game Tree / MAX–MIN / Utility / Alpha–Beta Pruning',
      historyKey:'CSAI2102_AIQUEST_S6_MINIMAX_HISTORY_V500',
      time:180,
      phaseOrder:['Game Tree Basics','Minimax Choice','Alpha–Beta Pruning','Strategy Boss'],
      phaseLabel:{
        'Game Tree Basics':'พื้นฐาน Game Tree',
        'Minimax Choice':'ตัดสินใจด้วย Minimax',
        'Alpha–Beta Pruning':'Alpha–Beta Pruning',
        'Strategy Boss':'Strategy Boss'
      },
      picks:{'Game Tree Basics':3,'Minimax Choice':3,'Alpha–Beta Pruning':3,'Strategy Boss':3}
    },
    b2:{
      id:'b2', sessionId:'b2', title:'Search & Game AI Boss Gate',
      fullTitle:'B2: Search & Game AI Boss Gate',
      topic:'Uniform Cost Search / A* / Minimax',
      historyKey:'CSAI2102_AIQUEST_B2_SEARCH_GAME_HISTORY_V500',
      time:220,
      phaseOrder:['UCS Cost Control','A* Heuristic Command','Minimax Strategy','Integrated Boss'],
      phaseLabel:{
        'UCS Cost Control':'UCS Cost Control',
        'A* Heuristic Command':'A* Heuristic Command',
        'Minimax Strategy':'Minimax Strategy',
        'Integrated Boss':'Integrated Boss'
      },
      picks:{'UCS Cost Control':3,'A* Heuristic Command':3,'Minimax Strategy':3,'Integrated Boss':3}
    }
  };

  function $(id){ return document.getElementById(id); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function toast(message){
    try{ if(typeof window.showToast === 'function') return window.showToast(message); }catch(error){}
    console.log('[AIQuest]', message);
  }
  function shuffle(items){
    const out = (items || []).slice();
    for(let i=out.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function difficulty(){
    try{
      const value = typeof window.difficulty === 'function' ? window.difficulty() : null;
      if(value) return value;
    }catch(error){}
    return {label:'Normal', help:3, time:180};
  }
  function getProfile(){
    try{ return window.AIQuestStorage && window.AIQuestStorage.getProfile ? window.AIQuestStorage.getProfile() : {}; }
    catch(error){ return {}; }
  }
  function uid(prefix){
    try{ return window.AIQuestStorage && window.AIQuestStorage.uid ? window.AIQuestStorage.uid(prefix) : prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); }
    catch(error){ return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); }
  }
  function calcStars(score){
    try{ return typeof window.calcStars === 'function' ? window.calcStars(score) : (score >= 85 ? 3 : score >= 70 ? 2 : score >= 60 ? 1 : 0); }
    catch(error){ return score >= 85 ? 3 : score >= 70 ? 2 : score >= 60 ? 1 : 0; }
  }
  function stopLegacyTimer(){
    try{ if(typeof window.stopTimer === 'function') window.stopTimer(); }catch(error){}
  }
  function beep(kind){ try{ if(typeof window.beep === 'function') window.beep(kind); }catch(error){} }
  function runtimeContext(){
    try{ return window.AIQuestDataContract && window.AIQuestDataContract.getRuntimeContext ? window.AIQuestDataContract.getRuntimeContext() : {}; }
    catch(error){ return {}; }
  }
  function runMode(){
    try{ return window.AIQuestGameplayLockdown && window.AIQuestGameplayLockdown.getRunMode ? window.AIQuestGameplayLockdown.getRunMode() : 'graded'; }
    catch(error){ return 'graded'; }
  }

  const S6_BANK = [
    ['Game Tree Basics','tree_nodes','ในเกมหมากรุกจำลอง “โหนด” (node) ใน game tree ใช้แทนสิ่งใด','สถานะของเกมหรือจุดตัดสินใจหนึ่งจุด',['รายชื่อผู้เล่นทั้งหมด','ค่าตอบแทนของรางวัลเท่านั้น','จำนวนครั้งที่กดปุ่ม'], 'Game tree แทนสถานะและการเลือก action ต่อเนื่องของผู้เล่น','มอง node เป็น “ตำแหน่ง/สถานะ” ของเกม ณ จุดหนึ่ง'],
    ['Game Tree Basics','terminal_utility','ใบไม้ปลายทาง (terminal node) ที่มีค่า utility = +10 หมายถึงอะไร','ผลลัพธ์ปลายทางนี้ดีต่อผู้เล่น MAX ตามเกณฑ์ที่กำหนด',['MAX ต้องเดินอีก 10 ครั้ง','MIN ชนะเสมอ','เกมยังไม่เริ่ม'], 'Utility เป็นค่าประเมินผลลัพธ์จากมุมมองของผู้เล่นหรือเป้าหมาย','ถามก่อนว่า utility วัดผลดี–เสียให้ใคร'],
    ['Game Tree Basics','turn_alternation','เหตุใด game tree ของเกมสองฝ่ายจึงสลับชั้น MAX และ MIN','เพราะแต่ละฝ่ายผลัดกันเลือก action ที่เป็นประโยชน์ต่อฝ่ายตน',['เพราะ MAX คำนวณได้เร็วกว่า','เพราะ MIN เป็นชื่อของใบไม้','เพื่อให้จำนวนโหนดเท่ากัน'], 'Minimax จำลองการผลัดกันตัดสินใจของฝ่ายที่มีเป้าหมายขัดกัน','คิดว่า “ตาฉันเลือกดีสุด / ตาคู่แข่งเลือกแย่สุดสำหรับฉัน”'],
    ['Game Tree Basics','depth_limit','เมื่อ game tree ลึกมากจนค้นหาถึง terminal node ไม่ได้ ระบบมักทำอย่างไร','ตัดที่ depth limit แล้วใช้ evaluation function ประเมินสถานะนั้น',['สุ่มเดินโดยไม่ใช้ข้อมูล','ยกเลิกเกมทันที','เปลี่ยนทุก node เป็น MAX'], 'ในเกมจริงมักใช้ค่าประเมินแทนการค้นหาจนสุดต้นไม้','depth limit ต้องคู่กับ evaluation function'],
    ['Game Tree Basics','evaluation','evaluation function มีหน้าที่ใดในการเล่นเกมด้วย AI','ให้คะแนนความได้เปรียบของสถานะเมื่อยังไม่ถึงจบเกม',['บอกชื่อผู้เล่น','เพิ่มจำนวนตาเดิน','สร้าง game tree ใหม่เสมอ'], 'Evaluation function ช่วยตัดสินคุณภาพของ state ระหว่างทาง','ไม่ใช่ผลจริงเสมอ แต่เป็นค่าประเมินเพื่อเลือกทางเดิน'],
    ['Game Tree Basics','two_player','ข้อใดเป็นเงื่อนไขที่ทำให้ minimax เหมาะกับปัญหา','มีผู้เล่นสองฝ่ายผลัดกันเลือก action และผลประโยชน์ขัดกัน',['มีข้อมูลเป็นตารางอย่างเดียว','มี sensor อย่างเดียว','มีการจัดกลุ่มข้อมูลโดยไม่มีคู่แข่ง'], 'Minimax เหมาะกับ adversarial search','มองหาคู่แข่งที่ตอบโต้การตัดสินใจของเรา'],

    ['Minimax Choice','max_pick','ที่โหนด MAX มีค่าลูก 3, 7 และ 5 MAX จะเลือกค่าใด','7',['3','5','ค่าเฉลี่ย 5'], 'MAX เลือกค่าที่มากที่สุดตาม utility','MAX = maximize'],
    ['Minimax Choice','min_pick','ที่โหนด MIN มีค่าลูก 4, -2 และ 6 MIN จะเลือกค่าใด','-2',['4','6','ค่าเฉลี่ย 3'], 'MIN เลือกค่าที่ต่ำที่สุดจากมุมมองของ MAX','MIN = minimize utility ของ MAX'],
    ['Minimax Choice','backup_values','โหนด MAX มีลูกสองโหนด: A เป็น MIN ที่เลือกระหว่าง 8 กับ 2, B เป็น MIN ที่เลือกระหว่าง 6 กับ 5. MAX ควรเลือกทางใด','เลือก A เพราะ MIN จะส่งค่า 2 ขึ้นมา และ MAX เลือกค่าสูงสุดระหว่าง 2 กับ 5 คือ 5 จาก B','เลือก A เพราะเห็นค่า 8 สูงสุด','เลือก B เพราะมีลูกสองค่า','เลือกค่าเฉลี่ยของทุกใบไม้'], 'ต้อง backup ค่าผ่าน MIN ก่อน: A=2, B=5 แล้ว MAX เลือก B','อย่าหยิบค่าของใบไม้สูงสุดโดยข้ามการเลือกของคู่แข่ง'],
    ['Minimax Choice','opponent_assumption','Minimax สมมติว่าคู่แข่งมีพฤติกรรมอย่างไร','คู่แข่งเลือก action ที่ทำให้ผลลัพธ์ของ MAX แย่ที่สุด',['คู่แข่งสุ่มเสมอ','คู่แข่งช่วย MAX ทุกครั้ง','คู่แข่งเลือกตามเวลาเร็วที่สุด'], 'Minimax เป็นโมเดล worst-case rational opponent','คิดจากมุมมองว่าคู่แข่งฉลาดและไม่ยอมให้เราได้เปรียบง่าย'],
    ['Minimax Choice','best_guarantee','คำว่า “best move” ใน minimax หมายถึงอะไร','action ที่ให้ผลลัพธ์รับประกันดีที่สุดเมื่อคู่แข่งตอบโต้อย่างเหมาะสม',['action ที่ utility ใบไม้สูงสุดใบเดียว','action ที่สุ่มแล้วชนะบ่อยที่สุดเสมอ','action ที่ใช้เวลาคำนวณน้อยสุด'], 'Minimax ไม่ได้เลือกจากความหวังดีที่สุด แต่เลือกจากผลที่ยังดีภายใต้การตอบโต้','มองค่า worst-case ของแต่ละ action'],
    ['Minimax Choice','root_choice','ถ้ารากเป็น MAX และมีค่าหลัง backup ของแต่ละทางเป็น 1, 0, -3 ควรเลือกอะไร','เลือกทางที่มีค่า 1',['เลือกทาง 0 เพราะปลอดภัยกว่า','เลือกทาง -3 เพราะมีตัวเลขมาก','สุ่มเพื่อไม่ให้คู่แข่งเดาได้'], 'ที่ราก MAX เลือกค่าใหญ่สุด','ใช้ค่าหลัง backup ไม่ใช่ค่าใบไม้ดิบ'],

    ['Alpha–Beta Pruning','alpha_meaning','ค่า alpha ใน alpha–beta pruning สื่อถึงอะไร','ค่าดีที่สุดที่ MAX รับประกันได้จนถึงขณะนั้น',['ค่าต่ำสุดของ MIN เสมอ','จำนวน node ที่ตัดทิ้ง','เวลาเหลือในการค้นหา'], 'alpha คือ lower bound ของผลลัพธ์สำหรับ MAX','จำ alpha = MAX มีอย่างน้อยเท่านี้'],
    ['Alpha–Beta Pruning','beta_meaning','ค่า beta ใน alpha–beta pruning สื่อถึงอะไร','ค่าดีที่สุดที่ MIN ยังยอมให้เกิดได้จนถึงขณะนั้น',['ค่าดีที่สุดของ MAX','จำนวนใบไม้ทั้งหมด','คะแนนเฉลี่ยของเกม'], 'beta คือ upper bound ที่ MIN ยอมรับจากมุมมอง MAX','จำ beta = MIN ไม่อยากให้ MAX เกินค่านี้'],
    ['Alpha–Beta Pruning','prune_rule','สามารถ prune กิ่งได้เมื่อใด','เมื่อ alpha ≥ beta',['เมื่อ alpha < beta','เมื่อจำนวนลูกเป็นเลขคู่','เมื่อถึง node MAX ทุกครั้ง'], 'เมื่อ alpha ≥ beta กิ่งที่เหลือไม่อาจเปลี่ยนการตัดสินใจของ ancestor ได้','ตรวจเงื่อนไข alpha มากกว่าหรือเท่ากับ beta'],
    ['Alpha–Beta Pruning','same_answer','alpha–beta pruning เปลี่ยนคำตอบที่ minimax เลือกหรือไม่','ไม่เปลี่ยน หากค้นหา game tree เดียวกันอย่างถูกต้อง แต่ช่วยลดจำนวน node ที่ต้องประเมิน',['เปลี่ยนเสมอเพราะตัดกิ่ง','เปลี่ยนเมื่อ MAX เป็นฝ่ายเริ่ม','เปลี่ยนเป็น DFS'], 'Pruning ลดงานคำนวณ ไม่เปลี่ยน minimax value ที่ถูกต้อง','เป้าหมายคือเร็วขึ้นโดยไม่เสียคำตอบ'],
    ['Alpha–Beta Pruning','ordering','เหตุใดการเรียงลำดับ action ที่มีแนวโน้มดีจึงช่วย alpha–beta','ช่วยให้เกิด cutoff เร็วและ prune ได้มากขึ้น',['ทำให้ไม่ต้องมี MIN','ทำให้ utility ทุกค่าเท่ากัน','ทำให้ game tree ไม่ต้องมีใบไม้'], 'Good move ordering ทำให้ bounds แน่นเร็ว','เรียง action ดี = ตัดกิ่งได้เร็วขึ้น'],
    ['Alpha–Beta Pruning','no_prune','ถ้าขณะพิจารณา node หนึ่งได้ alpha=3 และ beta=5 ควรทำอย่างไร','ยังค้นหาต่อ เพราะ alpha ยังน้อยกว่า beta',['prune ทันที','ประกาศว่า MAX ชนะ','เปลี่ยน beta เป็น 0'], '3 < 5 จึงยังไม่มี cutoff','prune เฉพาะเมื่อ alpha ≥ beta'],

    ['Strategy Boss','chess_scenario','AI เล่นเกมกระดานมีทางเลือก X และ Y. หลังมองการตอบโต้ที่ดีที่สุดของคู่แข่ง พบว่า X รับประกันค่า 2 และ Y รับประกันค่า 4. ควรเลือกอะไร','เลือก Y เพราะให้ worst-case utility สูงกว่า',['เลือก X เพราะอาจมีใบไม้ค่า 10','เลือก X เพราะตรวจเจอก่อน','สุ่ม X/Y'], 'Minimax เลือก action ที่รักษาผลลัพธ์ดีที่สุดแม้คู่แข่งตอบโต้อย่างเต็มที่','เปรียบเทียบค่าที่รับประกันได้ของแต่ละทาง'],
    ['Strategy Boss','adversarial_route','ในเกมไล่จับ ผู้เล่นฝ่ายตรงข้ามสามารถปิดเส้นทางของเราได้ การเลือกวิธีคิดใดเหมาะที่สุด','ใช้ minimax เพื่อคาดการตอบโต้ของคู่แข่งก่อนเลือก action',['ใช้ BFS อย่างเดียวโดยไม่สนคู่แข่ง','ใช้ clustering เพื่อแบ่งเส้นทาง','ใช้ Bayes โดยไม่ต้องมี game tree'], 'เมื่ออีกฝ่ายเลือก action เพื่อต้านเรา ปัญหามีลักษณะ adversarial','มองหาคู่แข่งที่มีตาเดินตอบโต้'],
    ['Strategy Boss','pruning_reason','ทีมหนึ่งบอกว่า “ตัดกิ่งแล้วจะพลาดทางเลือกที่ดีที่สุดแน่ ๆ” คำตอบใดถูกต้อง','ไม่เสมอไป ถ้า alpha ≥ beta กิ่งนั้นไม่สามารถเปลี่ยนผล minimax ที่กำลังพิจารณาได้',['ถูกเสมอเพราะทุกใบไม้สำคัญเท่ากัน','ถูกเมื่อมี MAX ที่ราก','ต้องเปลี่ยนเป็น BFS'], 'Prune เฉพาะกิ่งที่ไม่มีผลต่อ decision แล้ว','อธิบายด้วย bounds ไม่ใช่ความรู้สึก'],
    ['Strategy Boss','human_ai','ในเกมคนกับ AI ควรแยก “การทำนายคู่แข่ง” ออกจาก “การเลือกเรา” อย่างไร','ใช้ชั้น MIN แทนคู่แข่งและชั้น MAX แทนเป้าหมายของระบบ แล้ว backup utility กลับสู่ราก',['ใช้ค่าเฉลี่ยของทุก action','ให้ MAX เลือกทุกชั้น','ตัดชั้น MIN ทิ้งเพื่อให้เร็ว'], 'การสลับ MAX/MIN คือแกนของ minimax','แยกตาของเราและตาของคู่แข่งให้ชัด'],
    ['Strategy Boss','limit_tradeoff','ข้อจำกัดสำคัญของ minimax ในเกมจริงคืออะไร','จำนวนสถานะโตเร็วมาก จึงมักต้องใช้ depth limit, evaluation function และ alpha–beta pruning',['ไม่สามารถมีผู้เล่นสองฝ่าย','ใช้กับเกมกระดานไม่ได้','ต้องใช้ข้อมูลติดป้ายกำกับ'], 'Game tree explosion เป็นเหตุผลที่ต้องใช้ pruning และ evaluation','คิดถึง branching factor และความลึก'],
    ['Strategy Boss','explain_move','คำอธิบายใดโปร่งใสที่สุดเมื่อ AI เลือกตาเดินในเกม','บอกว่าเลือก action เพราะหลังคาดการตอบโต้ที่ดีที่สุดของคู่แข่งแล้ว ค่าที่รับประกันได้สูงกว่า',['บอกว่าโมเดลเลือกเอง','บอกว่าค่าใบไม้หนึ่งใบสูงที่สุด','บอกว่าใช้ AI จึงถูกเสมอ'], 'อธิบายเหตุผลเชิง worst-case utility ทำให้ตรวจสอบได้','ผูกคำอธิบายกับค่า backup และการตอบโต้']
  ].map((row, index) => ({id:'s6m_'+String(index+1).padStart(2,'0'), phase:row[0], family:row[1], prompt:row[2], answer:row[3], distractors:row[4], explain:row[5], hint:row[6]}));

  const B2_BANK = [
    ['UCS Cost Control','ucs_weighted','เส้นทาง A มี 2 edge แต่ cost รวม 20; เส้นทาง B มี 3 edge แต่ cost รวม 8. ถ้าต้องการต้นทุนต่ำสุด ควรใช้หลักใด','ใช้ Uniform Cost Search โดยเปรียบเทียบ cumulative cost ของเส้นทาง',['ใช้ BFS เพราะ edge น้อยกว่า','ใช้ DFS เพราะลึกก่อน','เลือกทางที่เจอก่อน'], 'Weighted graph ต้องดูผลรวม cost ไม่ใช่จำนวน edge','UCS ใช้ g(n) เป็นเกณฑ์'],
    ['UCS Cost Control','ucs_frontier_goal','UCS เห็น goal ใน frontier ด้วย cost 15 แต่ยังมี node cost 5 รออยู่ ควรทำอย่างไร','ยังไม่หยุด ต้องเลือก node cost ต่ำสุดก่อน',['หยุดทันทีเมื่อเห็น goal','ลบ node cost 5','เปลี่ยนเป็น DFS'], 'UCS ยืนยันคำตอบเมื่อ goal ถูกเลือกตาม priority ที่ถูกต้อง','goal discovery ไม่เท่ากับ optimal solution'],
    ['UCS Cost Control','ucs_relax','พบเส้นทางใหม่ไป X ด้วย cost 7 ขณะที่เดิมเก็บไว้ cost 12 ระบบควรทำอย่างไร','อัปเดต cost และ parent ของ X เป็นเส้นทาง cost 7',['เก็บ cost เดิมเพราะเจอก่อน','ลบ X ออกจาก graph','หยุดค้นหา X'], 'Relaxation เก็บเส้นทางที่ดีกว่า','ตรวจ cumulative cost ใหม่กับค่าเดิม'],
    ['UCS Cost Control','ucs_priority','priority queue ของ UCS ควรนำ node ใดออกก่อน','node ที่มี g(n) หรือ cumulative cost ต่ำสุด',['node ที่ลึกที่สุด','node ที่ชื่อใกล้ goal','node ที่เข้าคิวก่อนเสมอ'], 'UCS จัดลำดับด้วย g(n)','ไม่สับสนกับ BFS queue'],
    ['UCS Cost Control','ucs_bfs','ข้อใดถูกต้องเกี่ยวกับ BFS และ UCS','BFS เหมาะเมื่อทุก edge มี cost เท่ากัน; UCS เหมาะเมื่อ cost ต่างกัน',['ทั้งสองเหมือนกันเสมอ','UCS ไม่ใช้ frontier','BFS ดู cumulative cost'], 'จุดต่างคือเกณฑ์เลือก node','ถามว่า edge cost เท่ากันหรือไม่'],

    ['A* Heuristic Command','astar_formula','A มี g=4,h=3 และ B มี g=2,h=6 ใน A* ควรเลือก node ใดก่อน','เลือก A เพราะ f(A)=7 ต่ำกว่า f(B)=8',['เลือก B เพราะ g ต่ำกว่า','เลือก B เพราะ h สูงกว่า','สุ่มได้'], 'A* เลือกตาม f(n)=g(n)+h(n)','คำนวณ g+h ก่อนเสมอ'],
    ['A* Heuristic Command','astar_zero','ถ้า h(n)=0 ทุก node, A* จะมีพฤติกรรมใกล้กับอะไร','Uniform Cost Search',['BFS แม้ cost ต่างกัน','DFS','Greedy Best-First'], 'เมื่อ h=0, f=g','เชื่อม A* กับ UCS'],
    ['A* Heuristic Command','admissible','heuristic ที่ admissible ควรมีคุณสมบัติใด','ไม่ประเมินต้นทุนที่เหลือสูงเกินความจริง',['ต้องสูงเกินเสมอ','ต้องเป็น 0 เสมอ','ต้องเท่ากับ g(n)'], 'ไม่ overestimate ช่วยให้ A* รักษา optimality ภายใต้เงื่อนไขมาตรฐาน','admissible = optimistic bound'],
    ['A* Heuristic Command','greedy','ระบบเลือก node ที่ h(n) ต่ำสุดอย่างเดียว ระบบนี้ใกล้กับอะไร','Greedy Best-First Search มากกว่า A*',['A* เพราะมี heuristic','UCS เพราะมี queue','Minimax'], 'A* ต้องรวม g+h; Greedy ใช้ h อย่างเดียว','ดูว่ามี g(n) ในเกณฑ์หรือไม่'],
    ['A* Heuristic Command','astar_explain','คำอธิบายใดถูกต้องเมื่อ A* ไม่เลือก node ที่ h ต่ำสุด','A* อาจเลือก node อื่นเพราะ f=g+h ต่ำกว่าเมื่อรวมต้นทุนที่เดินมาแล้ว',['A* ต้องเลือก h ต่ำสุดเสมอ','A* ไม่ดู g(n)','A* ใช้ MIN เลือก'], 'A* สมดุลต้นทุนที่ผ่านมาและการประมาณอนาคต','คิดสองส่วน g และ h'],

    ['Minimax Strategy','minimax_max','โหนด MAX มีค่าหลัง backup เป็น 2, 6, 1. ควรเลือกค่าใด','6',['2','1','ค่าเฉลี่ย 3'], 'MAX เลือก utility สูงสุด','MAX = maximize'],
    ['Minimax Strategy','minimax_min','โหนด MIN มีค่าลูก 7, 0, 4. MIN จะส่งค่าใดขึ้นไป','0',['7','4','ค่าเฉลี่ย'], 'MIN ลด utility ของ MAX','MIN = minimize'],
    ['Minimax Strategy','ab_cutoff','alpha=5 และ beta=4. สถานะใดถูกต้อง','สามารถ prune กิ่งที่เหลือได้ เพราะ alpha ≥ beta',['ยังต้องค้นหาต่อ','MAX แพ้ทันที','เปลี่ยนเป็น A*'], 'alpha-beta cutoff เกิดเมื่อ alpha มากกว่าหรือเท่ากับ beta','ตรวจ bounds'],
    ['Minimax Strategy','minimax_opponent','เหตุใด minimax ไม่เลือกใบไม้ที่มีค่า 100 เสมอ','คู่แข่งอาจเลือกทางอื่นที่ทำให้เราไม่ได้ถึงใบไม้นั้น',['เพราะ MAX ไม่ใช้ utility','เพราะใบไม้สูงสุดผิดเสมอ','เพราะต้องใช้ BFS'], 'ต้องคาดคู่แข่งตอบโต้ที่ดีที่สุด','อย่ามองเฉพาะ best-case'],
    ['Minimax Strategy','ab_result','alpha-beta pruning มีประโยชน์หลักใด','ลดจำนวน node ที่ประเมินโดยไม่เปลี่ยนคำตอบ minimax ที่ถูกต้อง',['เปลี่ยนค่า utility','ลบคู่แข่งออกจากเกม','ทำให้เกมไม่มี terminal node'], 'Pruning เพิ่มประสิทธิภาพ','คำตอบเดิมยังคงเหมือน minimax'],

    ['Integrated Boss','triage_search','หุ่นยนต์แข่งในเกมต้องเลือกเส้นทางต้นทุนต่ำ และเมื่อเจอคู่แข่งต้องคาดการตอบโต้. แนวทางใดเหมาะสม','ใช้ UCS/A* สำหรับการวางเส้นทาง และใช้ Minimax สำหรับการตัดสินใจเชิงแข่งขัน',['ใช้ BFS อย่างเดียวทุกสถานการณ์','ใช้ Minimax หาต้นทุนเส้นทางโดยไม่ดู edge cost','ใช้ clustering แทนการเลือก action'], 'เลือก algorithm ตามโครงสร้างปัญหา: cost search กับ adversarial choice ไม่เหมือนกัน','ถามก่อนว่าโจทย์คือ route planning หรือ opponent reasoning'],
    ['Integrated Boss','astar_minimax','เกมนำทางมีค่า g,h และฝ่ายตรงข้ามปิดเส้นทางบางจุด. ข้อใดอธิบายได้ดีที่สุด','A* ช่วยประเมินเส้นทาง แต่ minimax ช่วยคาดการเลือกของคู่แข่งในจุดตัดสินใจ',['A* แทน minimax ได้ทุกกรณี','minimax แทน g+h ได้เสมอ','ไม่ต้องสนคู่แข่ง'], 'สองวิธีอาจอยู่ในระบบเดียวกัน แต่ตอบคำถามต่างกัน','แยก search cost/heuristic ออกจาก adversarial decision'],
    ['Integrated Boss','explainable_ai','คำอธิบายการเลือก action ที่ดีควรมีอะไร','เกณฑ์เลือก เช่น cumulative cost, f(n), หรือ worst-case utility พร้อมเหตุผล','เพียงบอกว่า AI เลือกเอง','เฉพาะคะแนนสุดท้าย','ชื่อของ algorithm โดยไม่มีเหตุผล'], 'Explainability ต้องผูกกับหลักตัดสินใจของระบบ','อธิบายทั้งเกณฑ์และผลต่อ decision'],
    ['Integrated Boss','model_choice','สถานการณ์ใดเหมาะกับ minimax มากที่สุด','เกมกระดานที่ผู้เล่นสองฝ่ายผลัดกันเลือกตาเดิน',['จัดกลุ่มลูกค้าจากข้อมูล','ทำนายราคาบ้านจากตัวอย่าง','หาเส้นทางสั้นสุดใน graph ไม่มีคู่แข่ง'], 'Minimax เหมาะกับ adversarial game','มองหาการผลัดกันตัดสินใจของสองฝ่าย'],
    ['Integrated Boss','responsible_play','เมื่อ AI เล่นเกมเก่งขึ้น สิ่งใดควรตรวจเพิ่มเติมในการออกแบบ','เกณฑ์ประเมิน ความเป็นธรรม และการอธิบายการตัดสินใจต่อผู้ใช้',['คะแนนชนะอย่างเดียว','จำนวน effect ในเกม','สีของ UI เท่านั้น'], 'ระบบ AI ควรตรวจทั้งประสิทธิภาพและผลกระทบ','เกณฑ์สำคัญไม่ได้มีแค่ชนะ']
  ].map((row, index) => ({id:'b2m_'+String(index+1).padStart(2,'0'), phase:row[0], family:row[1], prompt:row[2], answer:row[3], distractors:row[4], explain:row[5], hint:row[6]}));

  function readHistory(key){
    try{ const rows = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(rows) ? rows : []; }
    catch(error){ return []; }
  }
  function writeHistory(key, ids){
    try{
      const history = readHistory(key);
      history.unshift({ts:new Date().toISOString(), ids:ids || []});
      localStorage.setItem(key, JSON.stringify(history.slice(0, HISTORY_WINDOW)));
    }catch(error){}
  }
  function recentIds(key){
    const set = new Set();
    readHistory(key).forEach(row => (row.ids || []).forEach(id => set.add(id)));
    return set;
  }
  function chooseRound(bank, config){
    const seen = recentIds(config.historyKey);
    const chosen = [];
    config.phaseOrder.forEach(phase => {
      const pool = shuffle(bank.filter(item => item.phase === phase));
      const fresh = pool.filter(item => !seen.has(item.id));
      const need = config.picks[phase] || 3;
      chosen.push(...(fresh.length >= need ? fresh.slice(0, need) : pool.slice(0, need)));
    });
    const all = shuffle(chosen);
    writeHistory(config.historyKey, all.map(item => item.id));
    return all;
  }
  function injectStyle(){
    if(document.getElementById('aiquestS6B2V500Style')) return;
    const style = document.createElement('style');
    style.id = 'aiquestS6B2V500Style';
    style.textContent = `
      .aiqArenaIntro{padding:14px;border:1px solid rgba(167,139,250,.36);border-radius:16px;background:linear-gradient(135deg,rgba(88,28,135,.23),rgba(14,116,144,.16));margin:12px 0;color:#e9d5ff;line-height:1.55}
      .aiqArenaMeta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.aiqArenaMeta span{padding:5px 9px;border-radius:999px;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.25);font-size:12px;color:#bae6fd}
      .aiqArenaFeedback{margin-top:14px;padding:13px;border-radius:14px;line-height:1.55}.aiqArenaFeedback.good{background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.35)}.aiqArenaFeedback.bad{background:rgba(251,113,133,.12);border:1px solid rgba(251,113,133,.35)}.aiqArenaFeedback.warn{background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35)}
      .aiqArenaNext{margin-top:12px}.aiqArenaSummary .phaseInsightGrid{margin-top:10px}
    `;
    document.head.appendChild(style);
  }
  function header(config, active, done, seconds, combo, helpLeft){
    return `
      <div class="hud">
        <span class="hudChip" data-aiq-timer>⏱ ${seconds}s</span>
        <span class="hudChip combo" data-aiq-combo>Combo x${combo}</span>
        <span class="hudChip" data-aiq-help>AI Help ${helpLeft}/3</span>
        <span class="hudChip">${esc(config.sessionId.toUpperCase())}</span>
        <div class="timerBar"><div class="timerFill" data-aiq-fill style="width:100%"></div></div>
      </div>
      <div class="phaseStrip">${config.phaseOrder.map(phase => `<span class="phasePill ${phase===active?'active':''} ${done.includes(phase)?'done':''}">${esc(config.phaseLabel[phase] || phase)}</span>`).join('')}</div>`;
  }
  function phaseAdvice(phase, percent){
    if(phase === 'Game Tree Basics') return percent >= 70 ? 'อ่านโครงสร้าง game tree ได้ดี' : 'ทบทวน state, terminal node และ utility ก่อนเลือก action';
    if(phase === 'Minimax Choice') return percent >= 70 ? 'ถอยค่าผ่าน MAX/MIN ได้ดี' : 'จำว่า MAX เลือกค่าสูงสุด และ MIN เลือกค่าต่ำสุดจากมุมมอง MAX';
    if(phase === 'Alpha–Beta Pruning') return percent >= 70 ? 'เข้าใจ cutoff และ pruning ดี' : 'ทบทวน alpha, beta และเงื่อนไข alpha ≥ beta';
    if(phase === 'UCS Cost Control') return percent >= 70 ? 'แยก UCS จาก BFS ได้ดี' : 'ทบทวน cumulative cost g(n) และ priority queue';
    if(phase === 'A* Heuristic Command') return percent >= 70 ? 'ใช้ f(n)=g(n)+h(n) ได้ดี' : 'ระวังสับสน A* กับ Greedy ที่ใช้ h(n) อย่างเดียว';
    if(phase === 'Minimax Strategy') return percent >= 70 ? 'คาดการตอบโต้ของคู่แข่งได้ดี' : 'ทบทวน worst-case utility และ alpha–beta pruning';
    return percent >= 70 ? 'บูรณาการแนวคิดได้ดี' : 'เลือก algorithm ให้ตรงโครงสร้างปัญหาและอธิบายเหตุผล';
  }
  function buildSummaryRows(config, metrics){
    return config.phaseOrder.map(phase => {
      const row = metrics.phase[phase] || {correct:0,total:0,wrong:0};
      const percent = row.total ? Math.round(row.correct / row.total * 100) : 0;
      return {phase, label:config.phaseLabel[phase] || phase, correct:row.correct, total:row.total, wrong:row.wrong, percent, advice:phaseAdvice(phase, percent)};
    });
  }
  function wrongReview(items){
    if(!items.length) return '<b>Review Wrong Items</b><br>ยอดเยี่ยม รอบนี้ไม่มีข้อผิดพลาดสำคัญ';
    return `<b>Review Wrong Items</b><div class="wrongList">${items.slice(0,8).map(item => `<div class="wrongItem"><b>${esc(item.phase)}</b><br>${esc(item.prompt)}<br><b>ตอบ:</b> ${esc(item.yourAnswer)}<br><b>ควรเป็น:</b> ${esc(item.correctAnswer)}<br><span class="muted">${esc(item.explain)}</span></div>`).join('')}</div>`;
  }
  function coachSummary(config, score, mastered, rows, metrics){
    const weak = rows.slice().sort((a,b)=>a.percent-b.percent)[0];
    const next = config.sessionId === 's6'
      ? 'Next: ผ่าน S6 แล้วจึงเปิด B2 เพื่อบูรณาการ UCS, A* และ Minimax'
      : 'Next: เมื่อผ่าน B2 จะไป S7: Knowledge Representation & Inference';
    return `<div class="aiqArenaSummary"><b>${esc(config.fullTitle)} Coach</b><br>Score: ${score}/100 · Mastery: ${mastered ? 'YES' : 'Not yet'}<br>Correct ${metrics.correct}/${metrics.total} · Max combo x${metrics.maxCombo} · AI Help used ${metrics.helpUsed}<br>${weak ? `จุดเน้น: ${esc(weak.label)} ${weak.percent}% — ${esc(weak.advice)}` : ''}<div class="phaseInsightGrid">${rows.map(row => `<div class="phaseInsightCard ${row.percent>=80?'good':row.percent>=60?'warn':'bad'}"><b>${esc(row.label)}</b><br>${row.correct}/${row.total} · ${row.percent}%<br>${esc(row.advice)}</div>`).join('')}</div><div class="nextPathBox"><b>${esc(next)}</b></div></div>`;
  }
  function makeEvent(config, attemptId, data){
    const profile = getProfile();
    const ctx = runtimeContext();
    return Object.assign({
      eventId:uid('evt'), attemptId, studentId:profile.studentId || '', section:profile.section || '101',
      sessionId:config.sessionId, missionId:config.id, clientTs:new Date().toISOString(), userAgent:navigator.userAgent,
      pageUrl:location.href, courseId:ctx.courseId || 'CSAI2102', classId:ctx.classId || 'CSAI2102-2569-101',
      term:ctx.term || '1/2569', runMode:runMode(), runModeLabel:runMode().toUpperCase()
    }, data || {});
  }

  function renderArena(config, bank){
    injectStyle();
    stopLegacyTimer();
    const area = $('gameArea');
    if(!area) return;
    const diff = difficulty();
    const startTs = Date.now();
    const items = chooseRound(bank, config);
    const totalTime = Math.max(config.time, Number(diff.time || 0));
    const attemptId = uid('att');
    const metrics = {correct:0,total:0,wrong:0,combo:0,maxCombo:0,helpLeft:Number(diff.help || 3),helpUsed:0,wrongItems:[],mis:{},phase:{}};
    config.phaseOrder.forEach(phase => metrics.phase[phase] = {correct:0,total:0,wrong:0});
    const eventLog = [];
    let index = 0;
    let remaining = totalTime;
    let timer = null;
    let ended = false;
    let answered = false;

    function stop(){ if(timer){ clearInterval(timer); timer = null; } }
    function updateHud(){
      const timerEl = area.querySelector('[data-aiq-timer]');
      const comboEl = area.querySelector('[data-aiq-combo]');
      const helpEl = area.querySelector('[data-aiq-help]');
      const fill = area.querySelector('[data-aiq-fill]');
      if(timerEl) timerEl.textContent = `⏱ ${Math.max(0, remaining)}s`;
      if(comboEl) comboEl.textContent = `Combo x${metrics.combo}`;
      if(helpEl) helpEl.textContent = `AI Help ${metrics.helpLeft}/${Number(diff.help || 3)}`;
      if(fill){ const pct = Math.max(0, remaining / totalTime * 100); fill.style.width = pct+'%'; fill.classList.toggle('low', pct < 25); }
    }
    function beginTimer(){
      timer = setInterval(() => { remaining -= 1; updateHud(); if(remaining <= 0) end(true); }, 1000);
    }
    function help(item){
      if(metrics.helpLeft <= 0){ toast('AI Help หมดแล้ว'); return; }
      metrics.helpLeft -= 1; metrics.helpUsed += 1; updateHud();
      const box = area.querySelector('#arenaFeedback');
      if(box){ box.className='aiqArenaFeedback warn'; box.style.display='block'; box.innerHTML=`<b>AI Help:</b> ${esc(item.hint)}`; }
      eventLog.push(makeEvent(config,attemptId,{eventType:'ai_help_used',phase:item.phase,itemId:item.id,prompt:item.prompt,extraJson:{hint:item.hint}}));
    }
    function renderQuestion(){
      const item = items[index];
      if(!item){ end(false); return; }
      answered = false;
      const done = config.phaseOrder.filter(phase => (metrics.phase[phase] || {}).total > 0);
      const choices = shuffle([item.answer].concat(item.distractors || []));
      area.innerHTML = `${header(config,item.phase,done,remaining,metrics.combo,metrics.helpLeft)}
        <div class="gamePanel">
          <div class="tagline">${esc(config.fullTitle)} · ${esc(config.phaseLabel[item.phase] || item.phase)} · ข้อ ${index+1}/${items.length}</div>
          <div class="aiqArenaIntro"><b>Mission Intel</b><br>${config.sessionId==='s6'?'คิดเป็นลำดับ: state → MAX/MIN → utility → action. อย่าลืมว่าคู่แข่งตอบโต้เราได้':'เลือกหลัก AI ให้ตรงงาน: UCS ดู cost, A* ดู g+h, Minimax คาดคู่แข่งตอบโต้'}</div>
          <h3>${esc(item.prompt)}</h3>
          <div class="choicesGrid">${choices.map((choice,i)=>`<button class="choiceBtn" data-arena-choice="${i}">${esc(choice)}</button>`).join('')}</div>
          <div id="arenaFeedback" class="aiqArenaFeedback" style="display:none"></div>
          <div class="row aiqArenaNext"><button class="btn secondary" id="arenaHelp">AI Help</button><button class="btn" id="arenaNext" disabled>${index===items.length-1?'สรุปผล':'ข้อต่อไป'}</button></div>
        </div>`;
      area.querySelectorAll('[data-arena-choice]').forEach(button => {
        button.onclick = () => answer(item, choices[Number(button.dataset.arenaChoice)], choices);
      });
      const helpButton = $('arenaHelp'); if(helpButton) helpButton.onclick = () => help(item);
      const nextButton = $('arenaNext'); if(nextButton) nextButton.onclick = () => { index += 1; renderQuestion(); };
      updateHud();
    }
    function answer(item, selected, choices){
      if(answered || ended) return;
      answered = true;
      const correct = selected === item.answer;
      const phase = metrics.phase[item.phase] || (metrics.phase[item.phase] = {correct:0,total:0,wrong:0});
      metrics.total += 1; phase.total += 1;
      if(correct){ metrics.correct += 1; phase.correct += 1; metrics.combo += 1; metrics.maxCombo=Math.max(metrics.maxCombo,metrics.combo); beep('ok'); }
      else{
        metrics.wrong += 1; phase.wrong += 1; metrics.combo=0; metrics.mis[item.family]=(metrics.mis[item.family]||0)+1; beep('bad');
        metrics.wrongItems.push({phase:config.phaseLabel[item.phase]||item.phase,prompt:item.prompt,yourAnswer:selected,correctAnswer:item.answer,explain:item.explain,itemId:item.id,family:item.family});
      }
      eventLog.push(makeEvent(config,attemptId,{eventType:'answer_submit',phase:item.phase,itemId:item.id,prompt:item.prompt,yourAnswer:selected,correctAnswer:item.answer,isCorrect:correct?1:0,combo:metrics.combo,helpLeft:metrics.helpLeft,extraJson:{family:item.family,explain:item.explain}}));
      area.querySelectorAll('[data-arena-choice]').forEach(button => {
        button.disabled=true; const text=choices[Number(button.dataset.arenaChoice)]; if(text===item.answer) button.classList.add('correct'); else if(text===selected) button.classList.add('wrong');
      });
      const box = $('arenaFeedback');
      if(box){ box.style.display='block'; box.className='aiqArenaFeedback '+(correct?'good':'bad'); box.innerHTML=`<b>${correct?'ถูกต้อง':'ยังไม่ถูกต้อง'}</b><br><b>คำตอบ:</b> ${esc(item.answer)}<br>${esc(item.explain)}`; }
      updateHud();
      const nextButton = $('arenaNext'); if(nextButton) nextButton.disabled=false;
      try{ if(typeof window.aiquestRecordAdaptiveEvent === 'function') window.aiquestRecordAdaptiveEvent({eventType:'answer',phase:item.phase,itemId:item.id,prompt:item.prompt,isCorrect:correct,misconceptionKey:item.family}); }catch(error){}
    }
    function end(fromTimeout){
      if(ended) return;
      ended=true; stop();
      const used = Math.max(0,Math.round((Date.now()-startTs)/1000));
      const accuracy = metrics.total ? metrics.correct / metrics.total : 0;
      const rows = buildSummaryRows(config,metrics);
      const phasePass = rows.every(row => row.total === 0 || row.percent >= 60);
      const helpBonus = Math.max(0,Math.round((metrics.helpLeft / Math.max(1,Number(diff.help||3))) * 8));
      const comboBonus = Math.min(8,metrics.maxCombo*2);
      const finalScore = Math.max(0,Math.min(100,Math.round(accuracy*84+helpBonus+comboBonus)));
      const mastered = finalScore >= 85 && phasePass && metrics.helpUsed <= 2;
      const bossWin = config.id === 'b2' ? finalScore >= 60 && phasePass : false;
      eventLog.push(makeEvent(config,attemptId,{eventType:'session_end',phase:'end',itemId:'',prompt:config.fullTitle+' ended',isCorrect:'',combo:metrics.combo,helpLeft:metrics.helpLeft,extraJson:{score:finalScore,mastered,accuracy:Math.round(accuracy*100),phaseAnalytics:rows,timeOut:!!fromTimeout}}));
      const profile = getProfile();
      const summary = {
        attemptId, ts:new Date().toISOString(), course:'CSAI2102', courseId:'CSAI2102', classId:'CSAI2102-2569-101', section:profile.section || '101', studentId:profile.studentId || '', studentName:profile.studentName || profile.name || '',
        sessionId:config.sessionId, missionId:config.id, missionTitle:config.title, version:VERSION, score:finalScore, stars:calcStars(finalScore), passed:finalScore>=60, mastered, difficulty:(window.localStorage.getItem('CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS') ? (()=>{ try{return JSON.parse(localStorage.getItem('CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS')||'{}').difficulty || 'normal';}catch(e){return 'normal';} })() : 'normal'),
        usedTimeSec:used, timeLeftSec:Math.max(0,remaining), accuracy:Math.round(accuracy*100), correct:metrics.correct,total:metrics.total,wrong:metrics.wrong,maxCombo:metrics.maxCombo,helpUsed:metrics.helpUsed,bossWin,misconceptionsJson:JSON.stringify(metrics.mis),
        extraJson:{sessionTitle:config.topic, phaseAnalytics:rows, wrongItems:metrics.wrongItems, noRepeat:{recentWindow:HISTORY_WINDOW,itemIds:items.map(item=>item.id)}, recommendedNext:config.id==='m6'?'B2 Search & Game AI Boss Gate':'S7 Knowledge Representation & Inference'}, events:eventLog
      };
      const message = `${config.fullTitle}: Accuracy ${summary.accuracy}% · Correct ${metrics.correct}/${metrics.total} · Combo x${metrics.maxCombo} · Mastery ${mastered?'YES':'Not yet'}`;
      if(typeof window.finishMission === 'function'){
        window.finishMission(finalScore,message,{usedTime:used,mastered,bossWin,coachSummary:coachSummary(config,finalScore,mastered,rows,metrics),wrongReview:wrongReview(metrics.wrongItems),wrongItems:metrics.wrongItems,summary});
      }else{
        area.innerHTML=`<div class="gamePanel"><h2>${esc(config.fullTitle)}</h2><p>${esc(message)}</p><div class="coachBox">${coachSummary(config,finalScore,mastered,rows,metrics)}</div></div>`;
        toast('บันทึกคะแนนไม่สำเร็จ: ไม่พบ finishMission');
      }
    }
    eventLog.push(makeEvent(config,attemptId,{eventType:'session_start',phase:'start',itemId:'',prompt:config.fullTitle+' started',isCorrect:'',combo:0,helpLeft:metrics.helpLeft,extraJson:{version:VERSION,itemCount:items.length,phases:config.phaseOrder}}));
    renderQuestion(); beginTimer();
  }

  function patchRoadmap(){
    try{
      const roadmap = window.AIQuestRoadmap;
      if(!roadmap || !Array.isArray(roadmap.FLOW)) return;
      const s6 = roadmap.FLOW.find(item => item.id === 'm6');
      const b2 = roadmap.FLOW.find(item => item.id === 'b2');
      if(s6){ s6.title='Minimax Arena'; s6.topic='Game Tree / MAX–MIN / Utility / Alpha–Beta Pruning'; s6.unlock='ผ่าน S5'; }
      if(b2){ b2.title='Search & Game AI Boss Gate'; b2.topic='UCS / A* / Minimax'; b2.unlock='ผ่าน S4–S6'; }
      if(typeof roadmap.render === 'function') roadmap.render();
    }catch(error){}
  }
  function patchVisibleText(){
    const replacements=[
      ['Knowledge Base Forge','Minimax Arena'],
      ['Knowledge Representation / Facts / Rules / Inference','Game Tree / MAX–MIN / Utility / Alpha–Beta Pruning'],
      ['Cost Search / A* / Knowledge Representation','UCS / A* / Minimax'],
      ['Applied AI Boss Gate','Search & Game AI Boss Gate'],
      ['Knowledge Representation → Applied AI Gate','Minimax / Alpha–Beta → Search & Game AI Gate']
    ];
    ['detailPanel','studentStartPanel','studentProgressBox','missionMap'].forEach(id => {
      const root = $(id); if(!root) return;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[]; let node;
      while((node=walker.nextNode())) nodes.push(node);
      nodes.forEach(textNode=>{ let text=textNode.nodeValue; replacements.forEach(([a,b])=>{ if(text.includes(a)) text=text.split(a).join(b); }); if(text!==textNode.nodeValue) textNode.nodeValue=text; });
    });
  }
  function renderS6(){
    const heading=$('gameHeading'); const sub=$('gameSubheading');
    if(heading) heading.textContent=CONFIG.s6.fullTitle;
    if(sub) sub.textContent=CONFIG.s6.topic;
    renderArena(CONFIG.s6,S6_BANK);
  }
  function renderB2(){
    const heading=$('gameHeading'); const sub=$('gameSubheading');
    if(heading) heading.textContent=CONFIG.b2.fullTitle;
    if(sub) sub.textContent=CONFIG.b2.topic;
    renderArena(CONFIG.b2,B2_BANK);
  }
  function wrapStartMission(){
    const current = window.startMission;
    if(typeof current !== 'function' || current.__aiquestS6B2V500) return;
    const wrapped = function(id){
      const result = current.apply(this,arguments);
      if(result === false) return result;
      const key=String(id||'').toLowerCase();
      if(key === 'm6') setTimeout(renderS6,0);
      if(key === 'b2') setTimeout(renderB2,0);
      return result;
    };
    wrapped.__aiquestS6B2V500=true;
    wrapped.__legacyStartMission=current;
    window.startMission=wrapped;
  }
  function boot(){
    patchRoadmap(); patchVisibleText(); wrapStartMission();
    const observer = new MutationObserver(()=>{ patchRoadmap(); patchVisibleText(); wrapStartMission(); });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.AIQuestS6B2Realignment={VERSION,renderS6,renderB2,patchRoadmap,bank:{s6:S6_BANK.length,b2:B2_BANK.length}};
    console.log('[AIQuest] '+VERSION+' loaded',window.AIQuestS6B2Realignment.bank);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
