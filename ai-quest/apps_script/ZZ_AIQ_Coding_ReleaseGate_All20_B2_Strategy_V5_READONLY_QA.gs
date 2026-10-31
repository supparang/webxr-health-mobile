/** CSAI2102 B2 release gate V5 — READ_ONLY_NO_WRITE.
 * Pure synthetic outputs only: no student identities, Sheets, scoring, unlocks.
 * Run TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V5().
 */
function TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V5(){
 'use strict';
 var base=TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V4();
 var cases=[{"stage":"B2","name":"SCREENSHOT_THAI_ASTARR","input":"Strategy: ใช้ A* เพื่อรวม Cost กับ Heuristic แสดง Optimality เมื่อเงื่อนไขครบ\nReason: เนื่องจากเป็น Weighted graph และมี Heuristic ที่ Admissible การใช้ A* จะคำนวณ f(n) = g(n) + h(n) เพื่อรับประกัน Optimality","expected":true},{"stage":"B2","name":"ASTAR_STRATEGY_REASON","input":"Strategy: A*\nReason: weighted graph and heuristic available","expected":true},{"stage":"B2","name":"THAI_STRATEGY_REASON","input":"กลยุทธ์: เลือก A*\nเหตุผล: กราฟมีน้ำหนักและ heuristic","expected":true},{"stage":"B2","name":"ASTAR_STRATEGY_ONLY","input":"Strategy: A*","expected":true},{"stage":"B2","name":"ASTAR_LEGACY","input":"A*","expected":true},{"stage":"B2","name":"ASTAR_LEGACY_PLUS_REASON","input":"A*\nReason: weighted graph with heuristic","expected":true},{"stage":"B2","name":"ASTAR_TH_COLUMN","input":"Strategy: ใช้ A*\nคำอธิบาย: มี cost และ heuristic","expected":true},{"stage":"B2","name":"ASTAR_WITH_PARENTHESES","input":"Strategy: A* (เหมาะสม)\nReason: weighted","expected":true},{"stage":"B2","name":"WRONG_BFS","input":"Strategy: ใช้ BFS\nReason: weighted and heuristic","expected":false},{"stage":"B2","name":"WRONG_UCS","input":"Strategy: ใช้ UCS\nReason: weighted and heuristic","expected":false},{"stage":"B2","name":"WRONG_MINIMAX","input":"Strategy: ใช้ Minimax\nReason: adversarial","expected":false},{"stage":"B2","name":"CONFLICT_STRATEGY","input":"Strategy: ใช้ A* และใช้ UCS\nReason: weighted","expected":false},{"stage":"B2","name":"CONFLICT_REASON","input":"Strategy: ใช้ A*\nReason: เลือก BFS เป็นผลสุดท้าย","expected":false},{"stage":"B2","name":"DUPLICATE_STRATEGY","input":"Strategy: A*\nStrategy: UCS","expected":false},{"stage":"B2","name":"ONLY_REASON","input":"Reason: weighted graph and heuristic","expected":false},{"stage":"B2","name":"EMPTY_REASON","input":"Strategy: A*\nReason:","expected":false},{"stage":"B2","name":"NESTED_DECISION","input":"Strategy: A*\nReason: Strategy: UCS","expected":false},{"stage":"B2","name":"NEGATED_ASTARR","input":"Strategy: ไม่ควรใช้ A*\nReason: incorrect","expected":false},{"stage":"B2","name":"UNKNOWN_EXTRA","input":"Strategy: A*\nReason: weighted\nUCS","expected":false},{"stage":"B2","name":"AMBIGUOUS_FIRST","input":"Strategy: BFS หรือ A*\nReason: weighted","expected":false},{"stage":"B2","name":"PARTIAL_ASTARR","input":"Strategy: A*starish\nReason: weighted","expected":false},{"stage":"B2","name":"NO_RESULT","input":"","expected":false}];
 var failed=[],passed=0;
 cases.forEach(function(t){
  var got=AIQCODING.validateOutputEvidence_('B2',t.input,AIQCODING.RULES.B2);
  if(!got||got.passed!==t.expected)failed.push({stage:t.stage,case:t.name,expected:t.expected,actual:got&&got.passed,issue:got&&got.issue});
  else passed++;
 });
 if(!base||base.result!=='PASS')failed.push({check:'BASELINE_V4',result:base&&base.result});
 var out={audit:'AIQ_CODING_RELEASE_GATE_ALL20_V5_B2_STRATEGY_REASON',mode:'READ_ONLY_NO_WRITE',receiverVersion:AIQCODING.VERSION,
   baseline:{result:base&&base.result,fixtureCount:base&&base.fixtureCount},b2:{expected:cases.length,passed:passed},
   fixtureCount:(base&&base.fixtureCount||0)+cases.length,failed:failed,result:failed.length?'FAIL':'PASS'};
 Logger.log(JSON.stringify(out));return out;
}
