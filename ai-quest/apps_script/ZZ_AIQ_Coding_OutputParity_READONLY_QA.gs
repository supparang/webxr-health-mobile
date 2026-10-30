/**
 * CSAI2102 AI Quest — S4/S6 Output Evidence READ ONLY Regression
 * Synthetic examples only. No student IDs, Sheet writes, scoring writes,
 * unlocks, doGet or doPost. Install as a separate QA .gs file in Editor.
 */
function TEST_AIQ_CODING_OUTPUT_PARITY_READONLY_V1() {
  if (typeof AIQCODING === 'undefined' ||
      typeof AIQCODING.validateOutputEvidence_ !== 'function')
    throw new Error('AIQCODING_RECEIVER_OUTPUT_VALIDATOR_MISSING');
  var fixtures = [
  {
    "name": "user-first",
    "input": "Expanding: A (Cost: 0)\nExpanding: B (Cost: 2)\nExpanding: C (Cost: 5)\nExpanding: D (Cost: 6)\n\nResult:\nPath: ['A', 'B', 'D']\nTotal Cost: 6",
    "expected": true,
    "stage": "S4"
  },
  {
    "name": "user-second",
    "input": "Expanding: A (Cost: 0)\nExpanding: B (Cost: 2)\nExpanding: C (Cost: 5)\nExpanding: D (Cost: 6)\nD : 6",
    "expected": true,
    "stage": "S4"
  },
  {
    "name": "starter",
    "input": "A 0\nB 2\nC 5\nD 6",
    "expected": true,
    "stage": "S4"
  },
  {
    "name": "alt-optimal",
    "input": "Path: A -> C -> D\nTotal Cost: 6",
    "expected": true,
    "stage": "S4"
  },
  {
    "name": "goal-with-total",
    "input": "Goal: D\nTotal Cost: 6",
    "expected": true,
    "stage": "S4"
  },
  {
    "name": "decimal",
    "input": "D (Cost: 6.0)",
    "expected": true,
    "stage": "S4"
  },
  {
    "name": "wrong-goal-cost",
    "input": "Expanding: D (Cost: 7)",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "contradict-total",
    "input": "Expanding: D (Cost: 6)\nTotal Cost: 8",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "invalid-edge",
    "input": "Path: ['A','D']\nTotal Cost: 6\nD : 6",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "wrong-goal",
    "input": "Goal: C\nPath: ['A','B','D']\nTotal Cost: 6",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "only-cost",
    "input": "Total Cost: 6",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "unrelated",
    "input": "print('D 6')",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "wrong-66",
    "input": "D : 66",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "empty",
    "input": "",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "wrong-path",
    "input": "Path: ['A','B','C','D']\nTotal Cost: 6",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "wrong-total-string",
    "input": "D 6\nTotal Cost: not_available",
    "expected": false,
    "stage": "S4"
  },
  {
    "name": "canonical-3",
    "input": "3",
    "expected": true,
    "stage": "S6"
  },
  {
    "name": "verbose-result",
    "input": "Result: 3",
    "expected": true,
    "stage": "S6"
  },
  {
    "name": "minimax-label",
    "input": "Minimax Value: 3",
    "expected": true,
    "stage": "S6"
  },
  {
    "name": "decimal",
    "input": "3.0",
    "expected": true,
    "stage": "S6"
  },
  {
    "name": "wrong-13",
    "input": "13",
    "expected": false,
    "stage": "S6"
  },
  {
    "name": "wrong-30",
    "input": "30",
    "expected": false,
    "stage": "S6"
  },
  {
    "name": "contradictory",
    "input": "Result: 3\nResult: 4",
    "expected": false,
    "stage": "S6"
  },
  {
    "name": "only-mentioned",
    "input": "scores = [3, 5, 2, 9]",
    "expected": false,
    "stage": "S6"
  },
  {
    "name": "empty",
    "input": "",
    "expected": false,
    "stage": "S6"
  }
];
  var cases=fixtures.map(function(t) {
    var r=AIQCODING.validateOutputEvidence_(t.stage,t.input,AIQCODING.RULES[t.stage]);
    return {stage:t.stage,name:t.name,expected:t.expected,
      actual:r.passed,pass:r.passed===t.expected,issue:r.issue};
  });
  var stages=Object.keys(AIQCODING.RULES);
  var regressions=stages.filter(function(stage){
    var rule=AIQCODING.RULES[stage];
    return !AIQCODING.validateOutputEvidence_(stage,rule.expected,rule).passed;
  });
  var summary={
    audit:'AIQ_CODING_OUTPUT_PARITY_READONLY_V1',
    mode:'NO_WRITE',
    version:AIQCODING.VERSION,
    stagesScanned:stages.length,
    sampleCount:cases.length,
    failed:cases.filter(function(x){return !x.pass;}),
    canonicalOutputsRejected:regressions,
    result:cases.every(function(x){return x.pass;})&&!regressions.length?'PASS':'FAIL'
  };
  Logger.log(JSON.stringify(summary));
  return summary;
}
