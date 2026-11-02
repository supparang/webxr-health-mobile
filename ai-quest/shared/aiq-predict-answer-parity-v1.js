/** CSAI2102 Predict+Reason reflection contract, shared by Web and GAS. */
function aiqPredictAnswerParityV1(stage,prediction,reason,rule,validateOutput,matchesGroups,s4Check){
  // Keep the historical function name for deployed callers. Predict is assessed
  // as a reflection: the learner provides an answer and a meaningful reason.
  var p=String(prediction||'').trim(),r=String(reason||'').trim();
  function out(ok,issue,mode){return {passed:!!ok,issue:issue||'',mode:mode||'AIQ_REFLECTION_V1'};}
  if(!p)return out(false,'PREDICTION_EMPTY');
  if(r.length<20)return out(false,'REASON_TOO_SHORT');
  return out(true,'','REFLECTION_RECORDED');
}
