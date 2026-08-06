/* Sentence City • Task-Aware Labels V1
 * Keeps instructions consistent with each question type.
 */
(function(){
  'use strict';

  const VERSION='2026-08-06-SC-TASK-LABELS-V1';
  const style=document.createElement('style');
  style.id='scTaskLabelsStyle';
  style.textContent=`
@media(max-width:720px){
  #mission.sc-context-choice .board,
  #mission.sc-repair-choice .board{
    grid-template-rows:12px 46px 12px minmax(92px,auto) 44px!important;
  }
  #mission.sc-context-choice .slots,
  #mission.sc-repair-choice .slots{
    display:grid!important;
    grid-template-columns:1fr!important;
    overflow:visible!important;
  }
  #mission.sc-context-choice .depot,
  #mission.sc-repair-choice .depot{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:6px!important;
    overflow:visible!important;
  }
  #mission.sc-context-choice .word,
  #mission.sc-repair-choice .word{
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:auto!important;
    min-height:42px!important;
    white-space:normal!important;
    line-height:1.12!important;
    padding:7px 9px!important;
  }
}
`;
  document.head.appendChild(style);

  function setText(element,text){
    if(element&&element.textContent!==text)element.textContent=text;
  }

  function apply(){
    const mission=document.getElementById('mission');
    const feedback=document.getElementById('feedback');
    const board=mission?.querySelector('.board');
    const labels=board?.querySelectorAll('.label');
    const check=document.getElementById('check');
    const slots=document.getElementById('slots');
    if(!mission||!feedback||!labels?.length||!check||!slots)return;

    const text=feedback.textContent;
    let mode='';
    if(text.includes('• Context •'))mode='context';
    else if(text.includes('• Repair •'))mode='repair';
    else if(text.includes('• Fill the Gap •'))mode='fill';
    else if(text.includes('• Word Order •'))mode='order';
    if(!mode)return;

    mission.classList.remove('sc-context-choice','sc-repair-choice','sc-fill-choice','sc-word-order');
    mission.classList.add(mode==='context'?'sc-context-choice':mode==='repair'?'sc-repair-choice':mode==='fill'?'sc-fill-choice':'sc-word-order');

    if(mode==='context'){
      setText(labels[0],'CHOOSE ONE SENTENCE');
      setText(labels[1],'SENTENCE OPTIONS');
      setText(check,'Confirm Answer');
    }else if(mode==='repair'){
      setText(labels[0],'CORRECTION SLOT');
      setText(labels[1],'WORD OPTIONS');
      setText(check,'Check Correction');
    }else if(mode==='fill'){
      setText(labels[0],'ANSWER SLOT');
      setText(labels[1],'WORD OPTIONS');
      setText(check,'Check Answer');
    }else{
      setText(labels[0],'SENTENCE BLUEPRINT');
      setText(labels[1],'WORD DEPOT');
      setText(check,'Build Sentence');
    }

    if(mode!=='order'&&slots.children.length===1){
      const slot=slots.children[0];
      if(slot&&!slot.classList.contains('filled')&&slot.textContent.trim()==='วางคำ'){
        slot.textContent='วางคำตอบ';
      }
    }
  }

  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  apply();

  window.SENTENCE_CITY_TASK_LABELS={version:VERSION,apply};
})();
