(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.CONFIG)return;
const KEY='fitness_balance_hold_sequence_last_v13';
const RELEASE='20260716-BALANCE-HOLD-TWIN-POSE-V13-END-TO-END';
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
    {id:'H4-L-B-R-B-C',steps:['center','left','center','boss','center','right','center','boss','center']}
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
BH.SEQUENCE_BANK=BANK;BH.chooseSequence=choose;BH.RELEASE_VERSION=RELEASE;
function installSummaryHook(){
  if(BH.__sequenceSummaryHooked||typeof BH.calcSummary!=='function'||typeof BH.payload!=='function')return false;
  BH.__sequenceSummaryHooked=true;
  const baseCalc=BH.calcSummary;
  BH.calcSummary=function(reason){
    const x=baseCalc(reason)||{};
    x.version=RELEASE;x.releaseVersion=RELEASE;x.sequencePatternId=BH.state.sequencePatternId||'';
    x.sequencePatternLevel=BH.state.sequencePatternLevel||BH.el?.difficulty?.value||'';
    x.bossPoseCount=(x.poseSequence||[]).filter(v=>v==='boss').length;
    x.recoveryRequired=x.official!==false;x.canonicalPath='/webxr-health-mobile/fitness/balance-hold-ar2.html';
    return x;
  };
  const basePayload=BH.payload;
  BH.payload=function(x){
    const p=basePayload(x)||{};
    p.version=x.version||RELEASE;p.releaseVersion=x.releaseVersion||RELEASE;p.sequencePatternId=x.sequencePatternId||'';
    p.sequencePatternLevel=x.sequencePatternLevel||'';p.bossPoseCount=Number(x.bossPoseCount||0);
    p.recoveryRequired=x.recoveryRequired?'yes':'no';p.canonicalPath=x.canonicalPath||'/webxr-health-mobile/fitness/balance-hold-ar2.html';
    return p;
  };
  return true;
}
if(!installSummaryHook()){const t=setInterval(()=>{if(installSummaryHook())clearInterval(t)},50);setTimeout(()=>clearInterval(t),10000)}
console.info('[BalanceHold] Safe Sequence Bank + Summary Metadata v13 ready');
})();