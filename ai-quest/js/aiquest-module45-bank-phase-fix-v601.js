/* CSAI2102 AI Quest — Modules 4–5 Bank Phase Balance v6.0.1 */
(function(){
  'use strict';
  const root=window.AIQuestModule45Banks;
  if(!root||!root.CONFIG)return;
  const phase=(mission,prefix,value)=>{
    (root.CONFIG[mission]?.bank||[]).forEach((item)=>{if(String(item.id||'').indexOf(prefix)===0)item.phase=value;});
  };
  phase('s13','s13_limit_','Applied Deep Learning');
  phase('s14','s14_eval_','Applied RL');
  phase('s15','s15_ethics_','Applied GenAI');
  phase('b5','b5_boss_','Final Applied AI Boss');
  root.__v601Balanced=true;
  console.log('[AIQuest] Module 4–5 phase balance v6.0.1 loaded');
})();