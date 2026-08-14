/* HeroHealth Research Assessment Metadata v1.0
 * Adds research-facing construct/process metadata to the existing 45 parallel pairs.
 * Keeps the production 15-item 5-5-5 assessment architecture unchanged.
 * DRAFT FOR EXPERT VALIDATION / PILOT — not a final validated instrument.
 */
(()=>{
'use strict';

const DOMAIN_DEFAULTS={
  hygiene:{construct:'health_knowledge_applied_literacy'},
  nutrition:{construct:'health_knowledge_applied_literacy'},
  fitness:{construct:'health_knowledge_applied_literacy'}
};

function hlProcessFromBloom(bloom){
  const b=String(bloom||'').toLowerCase();
  if(b==='remember'||b==='understand')return 'understand';
  if(b==='apply')return 'apply';
  if(b==='analyze'||b==='evaluate')return 'appraise';
  return 'understand';
}
function constructFromBloom(bloom){
  const b=String(bloom||'').toLowerCase();
  if(b==='remember'||b==='understand')return 'health_knowledge';
  if(b==='apply')return 'applied_health_literacy';
  if(b==='analyze'||b==='evaluate')return 'applied_health_literacy';
  return 'health_knowledge';
}
function enrichBank(bank){
  return (bank||[]).map(pair=>({
    ...pair,
    research:{
      ...(DOMAIN_DEFAULTS[pair.domain]||{}),
      construct:constructFromBloom(pair.bloom),
      hlProcess:hlProcessFromBloom(pair.bloom),
      researchRole:'core_pre_post',
      validationStatus:'draft_for_expert_review',
      assessmentFamily:'HSAS-P5',
      parallelPair:true
    }
  }));
}

window.HHResearchAssessmentMetadataV1={
  VERSION:'HH-RESEARCH-METADATA-V1-20260814',
  enrichBank,hlProcessFromBloom,constructFromBloom
};
})();
