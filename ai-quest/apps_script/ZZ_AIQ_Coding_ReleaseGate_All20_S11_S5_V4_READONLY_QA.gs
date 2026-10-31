/** CSAI2102 Coding Release Gate V4: Synthetic S11 multi-output / S5 starter QA.
 * READ_ONLY_NO_WRITE. Run TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V4().
 * Calls the complete V3 suite; no official Sheets or score writes.
 */
function TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V4() {
 'use strict';
 var baseline=TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V3();
 var s11=[{"name":"IMAGE_S11_ALL_METRICS_TWO_LISTS","input":"[0, 1, 1]\nTN: 1, FP: 0, FN: 0, TP: 2\nAccuracy: 1.0\nPrecision: 1.0, Recall: 1.0, F1: 1.0\n[0, 0, 1]","expected":true},{"name":"S11_LABELED_MODIFIED","input":"[0, 1, 1]\nnew_predictions: [0, 0, 1]","expected":true},{"name":"S11_LABELED_BOTH","input":"predictions: [0, 1, 1]\nmodified_predictions: [0, 0, 1]","expected":true},{"name":"S11_THRESHOLD_LABELS","input":"threshold_0.5_predictions: [0, 1, 1]\nthreshold_0.8_predictions: [0, 0, 1]","expected":true},{"name":"S11_BASELINE_WITH_METRICS","input":"[0, 1, 1]\nAccuracy: 1.0","expected":true},{"name":"S11_BASELINE_ONLY","input":"[0, 1, 1]","expected":true},{"name":"S11_BASELINE_FLAT","input":"0, 1, 1","expected":true},{"name":"S11_EXPERIMENT_ONLY","input":"new_predictions: [0, 0, 1]","expected":false},{"name":"S11_WRONG_FIRST_LIST","input":"[0, 0, 1]\nTN: 1, FP: 0, FN: 0, TP: 2\n[0, 1, 1]","expected":false},{"name":"S11_TWO_UNLABELED_NO_METRICS","input":"[0, 1, 1]\n[0, 0, 1]","expected":false},{"name":"S11_WRONG_SECOND_LIST","input":"[0, 1, 1]\nTN: 1, FP: 0, FN: 0, TP: 2\n[0, 1, 0]","expected":false},{"name":"S11_DUPLICATE_BASELINE","input":"predictions: [0, 1, 1]\nbaseline_predictions: [0, 1, 1]","expected":false},{"name":"S11_THREE_LISTS","input":"[0, 1, 1]\nTN: 1, FP: 0, FN: 0, TP: 2\n[0, 0, 1]\n[0, 1, 1]","expected":false},{"name":"S11_UNKNOWN_EXTRA_LINE","input":"[0, 1, 1]\nAccuracy: 1.0\n[0, 0, 1]\nrest_and_monitor","expected":false},{"name":"S11_MALFORMED_METRIC","input":"[0, 1, 1]\nAccuracy: apples\n[0, 0, 1]","expected":false},{"name":"S11_UNKNOWN_VECTOR","input":"[0, 1, 1]\nnew_predictions: [0, 0, 0]","expected":false},{"name":"S11_INVALID_VECTOR","input":"[0, 1, 1]\nnew_predictions: [0, two, 1]","expected":false},{"name":"S11_BASELINE_WRONG","input":"[0, 0, 1]","expected":false}];
 var s5=[{"name":"S5_CANONICAL_F","prediction":"f(B)=4","reason":"โค้ดตั้งต้นให้ g(B)=2 และ h(B)=2 จึงได้ f(B)=4","expected":true},{"name":"S5_CANONICAL_BRACKET","prediction":"f(B)=[4]","reason":"โค้ดตั้งต้นให้ g(B)=2 และ h(B)=2 จึงได้ f(B)=4","expected":true},{"name":"S5_CANONICAL_B4","prediction":"B 4","reason":"โค้ดตั้งต้นกำหนด g(B)=2 h(B)=2 รวมเป็น 4","expected":true},{"name":"S5_IMAGE_BRACKET_15","prediction":"f(B)=[15]","reason":"f(B)=[15] คำนวณจาก g(B)=5 บวกกับ h(B)=10 จากโค้ดตั้งต้น","expected":false},{"name":"S5_WRONG_15_NO_NUMERIC_REASON","prediction":"f(B)=[15]","reason":"จากสูตร f(B)=g(B)+h(B) และโค้ดตั้งต้น","expected":false},{"name":"S5_WRONG_OPERANDS_WITH_CORRECT_RESULT","prediction":"f(B)=4","reason":"ตามตัวอย่างอื่น g(B)=5 และ h(B)=10 จึงได้ 4","expected":false},{"name":"S5_CORRECT_RESULT_WRONG_F_C","prediction":"f(B)=4","reason":"จาก g(B)=2 h(B)=2 แล้วระบุ f(C)=5","expected":false},{"name":"S5_ONLY_FORMULA","prediction":"A* ใช้ f(n)=g(n)+h(n)","reason":"อธิบายสูตรกับฮิวริสติกโดยไม่คำนวณผลลัพธ์ B","expected":false},{"name":"S5_WRONG_B40","prediction":"B 40","reason":"อธิบายจากค่าคำนวณ A* ตามโค้ดตั้งต้น","expected":false},{"name":"S5_CONFLICTING_F_VALUES","prediction":"f(B)=4","reason":"กล่าวว่า f(B)=4 แต่สรุปสุดท้าย f(B)=15","expected":false},{"name":"S5_EMPTY","prediction":"","reason":"ให้เหตุผลคำนวณแล้วแต่ยังไม่ใส่คำตอบ","expected":false}];
 var failed=[],passedS11=0,passedS5=0;
 s11.forEach(function(t){
  var got=AIQCODING.validateOutputEvidence_('S11',t.input,AIQCODING.RULES.S11);
  if(!got||got.passed!==t.expected)failed.push({stage:'S11',case:t.name,expected:t.expected,actual:got&&got.passed,issue:got&&got.issue});
  else passedS11++;
 });
 s5.forEach(function(t){
  var got=AIQCODING.validatePredictV1_('S5',t.prediction,t.reason,AIQCODING.RULES.S5);
  if(!got||got.passed!==t.expected)failed.push({stage:'S5',case:t.name,expected:t.expected,actual:got&&got.passed,issue:got&&got.issue});
  else passedS5++;
 });
 if(!baseline||baseline.result!=='PASS')failed.push({check:'BASELINE_V3',result:baseline&&baseline.result});
 var report={audit:'AIQ_CODING_RELEASE_GATE_ALL20_V4_S11_OUTPUT_S5_STARTER',mode:'READ_ONLY_NO_WRITE',receiverVersion:AIQCODING.VERSION,
  baseline:{result:baseline&&baseline.result,fixtureCount:baseline&&baseline.fixtureCount},
  s11:{expected:s11.length,passed:passedS11},s5:{expected:s5.length,passed:passedS5},
  fixtureCount:(baseline&&baseline.fixtureCount||0)+s11.length+s5.length,failed:failed,result:failed.length?'FAIL':'PASS'};
 Logger.log(JSON.stringify(report));return report;
}
