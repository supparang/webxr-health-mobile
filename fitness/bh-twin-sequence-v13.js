(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.CONFIG)return;
const KEY='fitness_balance_hold_sequence_last_v13';
const BANK={
  easy:[
    {id:'E1-LR',steps:['center','left','center','right','center']},
    {id:'E2-RL',steps:['center','right','center','left','center']},
    {id:'E3-LCL',steps:['center','left','center','left','center']},
    {id:'E4-RCR',steps:['center','right','center','right','center']}
  ],
  normal:[
    {id:'N1-LR-B-C',steps:['center','left','center','right','center','boss','center']},
    {id:'N2-RL-B-C',steps:['center','right','center','left','center','boss','center']},
    {id:'N3-L-B-R-C',steps:['center','left','center','boss','center','right','center']},
    {id:'N4-R-B-L-C',steps:['center','right','center','boss','center','left','center']},
    {id:'N5-LR-L-B-C',steps:['center','left','center','right','center','left','center','boss','center']}
  ],
  hard:[
    {id:'H1-RL-R-B-C',steps:['center','right','center','left','center','right','center','boss','center']},
    {id:'H2-LR-L-B-C',steps:['center','left','center','right','center','left','center','boss','center']},
    {id:'H3-B-L-R-B-C',steps:['center','boss','center','left','center','right','center','boss','center']},
    {id:'H4-L-B-R-L-B-C',steps:['center','left','center','boss','center','right','center','left','center','boss','center']}
  ]
};
function safeGet(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch(_){return {}}}
function safeSet(v){try{sessionStorage.setItem(KEY,JSON.stringify(v))}catch(_){}}
function choose(level){
  const list=BANK[level]||BANK.normal,last=safeGet(),prev=last[level]||'';
  const candidates=list.length>1?list.filter(p=>p.id!==prev):list;
  const picked=candidates[Math.floor(Math.random()*candidates.length)]||list[0];
  last[level]=picked.id;safeSet(last);
  BH.state.sequencePatternId=picked.id;
  BH.state.sequencePatternLevel=level;
  return picked.steps.slice();
}
Object.keys(BANK).forEach(level=>{
  const cfg=BH.CONFIG[level];if(!cfg)return;
  Object.defineProperty(cfg,'sequence',{configurable:true,enumerable:true,get(){return choose(level)}});
});
BH.SEQUENCE_BANK=BANK;
BH.chooseSequence=choose;
console.info('[BalanceHold] Safe Sequence Bank v13 ready');
})();