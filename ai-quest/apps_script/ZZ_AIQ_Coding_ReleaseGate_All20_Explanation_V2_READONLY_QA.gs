/**
 * CSAI2102 AI Quest • 20-stage release gate v2: printed explanation parity.
 *
 * READ ONLY: purely synthetic output fixtures, no student identities,
 * Sheets writes, scoring submissions or unlocks. Run:
 * TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V2()
 *
 * This preserves the 308-fixture v1 release gate as its baseline, then
 * adds explicit explanation/decision collision regression fixtures.
 */
function TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V2() {
  'use strict';
  var baseline=TEST_AIQ_CODING_RELEASE_GATE_ALL20_READONLY_V1();
  var cases=[{"stage":"S9","name":"SCREENSHOT_TH_EXPLANATION","input":"Recommendation: recommend_checkup\nExplanation: กฎ R2_respiratory_infection ถูกใช้ เพราะพบอาการ: fever และ cough","expected":true},{"stage":"S9","name":"EN_EXPLANATION","input":"Recommendation: recommend_checkup\nExplanation: rule R2 matched fever and cough","expected":true},{"stage":"S9","name":"THAI_LABEL","input":"Recommendation: recommend_checkup\nคำอธิบาย: ระบบพบกฎ R2 จึงแนะนำให้ตรวจสุขภาพ","expected":true},{"stage":"S9","name":"REASON_LABEL","input":"Recommendation: recommend_checkup\nReason: fever and cough present","expected":true},{"stage":"S9","name":"RATIONALE_LABEL","input":"Recommendation: recommend_checkup\nRationale: rule R2 matched symptoms","expected":true},{"stage":"S9","name":"CONFLICT_TWO_RECOMMENDATIONS","input":"Recommendation: recommend_checkup\nRecommendation: rest_and_monitor","expected":false},{"stage":"S9","name":"CONFLICT_SECOND_RESULT","input":"Recommendation: recommend_checkup\nDecision: rest_and_monitor","expected":false},{"stage":"S9","name":"CONFLICT_UNLABELED_LINE","input":"Recommendation: recommend_checkup\nrest_and_monitor","expected":false},{"stage":"S9","name":"CONFLICT_NESTED_DECISION","input":"Recommendation: recommend_checkup\nExplanation: Decision: rest_and_monitor","expected":false},{"stage":"S9","name":"CONFLICT_NESTED_RECOMMENDATION","input":"Recommendation: recommend_checkup\nExplanation: Recommendation: rest_and_monitor","expected":false},{"stage":"S9","name":"EMPTY_EXPLANATION","input":"Recommendation: recommend_checkup\nExplanation:","expected":false},{"stage":"S9","name":"NO_RESULT","input":"Explanation: fever and cough present","expected":false},{"stage":"S9","name":"WRONG_RECOMMENDATION","input":"Recommendation: rest_and_monitor\nExplanation: fever and cough present","expected":false},{"stage":"S1","name":"S1_EXPLANATION","input":"Result: High temperature alert\nExplanation: threshold reached","expected":true},{"stage":"S2","name":"S2_EXPLANATION","input":"Action: clean\nExplanation: percept is dirty","expected":true},{"stage":"B3","name":"B3_EXPLANATION","input":"Decision: high_risk_with_evidence\nExplanation: rule risk threshold passed","expected":true},{"stage":"B5","name":"B5_EXPLANATION","input":"Decision: review_with_evidence\nExplanation: human review with evidence","expected":true},{"stage":"B5","name":"B5_CONFLICT","input":"Decision: review_with_evidence\nExplanation: Decision: approve","expected":false}];
  var failures=[],passed=0;
  cases.forEach(function(t){
    var rule=AIQCODING.RULES&&AIQCODING.RULES[t.stage];
    var observed=rule?AIQCODING.validateOutputEvidence_(t.stage,t.input,rule):null;
    if(!observed||observed.passed!==t.expected)
      failures.push({stage:t.stage,name:t.name,expected:t.expected,actual:observed&&observed.passed,issue:observed&&observed.issue});
    else passed++;
  });
  if(!baseline||baseline.result!=='PASS')
    failures.push({check:'BASELINE_308_RELEASE_GATE',result:baseline&&baseline.result,failed:baseline&&baseline.failed});
  var report={
    audit:'AIQ_CODING_RELEASE_GATE_ALL20_V2_EXPLANATION_PARITY',
    mode:'READ_ONLY_NO_WRITE',
    receiverVersion:AIQCODING.VERSION,
    baseline:baseline&&{result:baseline.result,fixtureCount:baseline.fixtureCount,failed:baseline.failed},
    explanation:{expected:cases.length,passed:passed,failed:failures.filter(function(v){return v.name;})},
    fixtureCount:(baseline&&baseline.fixtureCount||0)+cases.length,
    failed:failures,
    result:failures.length?'FAIL':'PASS'
  };
  Logger.log(JSON.stringify(report));
  return report;
}
