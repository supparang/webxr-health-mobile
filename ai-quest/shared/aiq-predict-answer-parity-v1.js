/** CSAI2102 Predict+Reason parity, Web/GAS shared read-only contract. */
function aiqPredictAnswerParityV1(stage,prediction,reason,rule,validateOutput,matchesGroups,s4Check){
  // Shared Web+GAS Predict checker, aligned with canonical lab.predict.
  // Retains old activity concept answers except for numerical/vector gates.
  var p=String(prediction||'').trim(),r=String(reason||'').trim();
  function out(ok,issue,mode){return {passed:!!ok,issue:issue||'',mode:mode||'PREDICT_ANSWER_PARITY_V1'};}
  if(!p)return out(false,'PREDICTION_EMPTY');
  if(r.length<20)return out(false,'REASON_TOO_SHORT');
  if(stage==='S4')return s4Check(p,r);
  var answer=validateOutput(stage,p,rule);
  var numeric={S5:1,S6:1,S8:1,S10:1,S11:1,S12:1,S13:1,S14:1};
  var source=rule&&rule.allowCombinedPredictReason?p+' '+r:p;
  var oldConcept=!numeric[stage]&&matchesGroups(source,(rule&&rule.pg)||[]);
  if(/\b(?:no|not|never|cannot|can't|don't)\b|(?:ไม่ใช่|ไม่ต้อง|ไม่ได้)/i.test(p))oldConcept=false;
  if(stage==='S5'){
    var text=p+' '+r,seen=[],m;
    var token=/\bf\s*\(\s*B\s*\)\s*[:=]\s*(-?\d+(?:\.\d+)?)|\bB\s*(?:[:=]|\s+)\s*(-?\d+(?:\.\d+)?)\b/gi;
    while((m=token.exec(text))!==null)seen.push(Number(m[1]||m[2]));
    var c=/\bf\s*\(\s*C\s*\)\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi;
    while((m=c.exec(text))!==null)if(Number(m[1])!==4)return out(false,'S5_F_C_INCORRECT');
    if(seen.some(function(x){return x!==4;}))return out(false,'S5_F_B_INCORRECT');
    return answer.passed||seen.length>0?out(true,'','S5_COMPUTED_RESULT'):out(false,'S5_CALCULATED_VALUE_REQUIRED');
  }
  if(stage==='S8'&&answer.passed){
    var n=r.toLowerCase().replace(/\s+/g,'');
    if(!(/prior|ฐานเดิม/.test(n)&&/likelihood|sensitivity|ความไว/.test(n)&&
      /evidence|normaliz|หลักฐาน|ตัวหาร/.test(n)&&/posterior|ภายหลัง|หลังเห็นหลักฐาน/.test(n)))
      return out(false,'S8_BAYES_REASON_MISSING');
  }
  if(stage==='B5'&&/\bREJECT\s*\/\s*HOLD\b/i.test(p)&&
    /(?:privacy|ความเป็นส่วนตัว)[^\r\n]{0,45}(?:fail|false|ไม่ผ่าน|ละเมิด)|(?:fail|false|ไม่ผ่าน)[^\r\n]{0,45}(?:privacy|ความเป็นส่วนตัว)/i.test(r))
    return out(true,'','B5_REASONED_PRIVACY_HOLD');
  if(answer.passed)return out(true,'','CANONICAL_RESULT');
  if(oldConcept)return out(true,'','PREVIOUS_ACTIVITY_CONCEPT');
  return out(false,'PREDICT_RESULT_NOT_CONFIRMED');
}
