/* HeroHealth Research Assessment Metadata v2.0
 * Research-facing metadata for the expert-validated 45 parallel-pair production bank.
 * Production architecture remains 15 items per form: 5 Hygiene + 5 Nutrition + 5 Fitness.
 * Expert validation status locked 2026-08-14; final psychometric refinement may follow pilot item analysis.
 */
(()=>{
'use strict';

function hlProcessFromBloom(bloom){
  const b=String(bloom||'').toLowerCase();
  if(b==='remember'||b==='understand')return 'understand';
  if(b==='apply')return 'apply';
  if(b==='analyze'||b==='evaluate')return 'appraise';
  return 'understand';
}
function constructFromBloom(bloom){
  const b=String(bloom||'').toLowerCase();
  if(b==='remember'||b==='understand')return 'health_knowledge_understanding';
  if(b==='apply')return 'applied_health_literacy';
  if(b==='analyze'||b==='evaluate')return 'health_information_appraisal';
  return 'health_knowledge_understanding';
}
function enrichBank(bank){
  return (bank||[]).map(pair=>({
    ...pair,
    research:{
      construct:constructFromBloom(pair.bloom),
      hlProcess:hlProcessFromBloom(pair.bloom),
      researchRole:'core_pre_post',
      validationStatus:'expert_validated_production',
      assessmentFamily:'HSAS-P5',
      instrumentVersion:'HSAS-P5-VALIDATED-V4-20260814',
      parallelPair:true,
      psychometricStatus:'expert_validated_pending_pilot_item_analysis'
    }
  }));
}

window.HHResearchAssessmentMetadataV1={
  VERSION:'HH-RESEARCH-METADATA-V2-VALIDATED-20260814',
  enrichBank,hlProcessFromBloom,constructFromBloom
};
})();
