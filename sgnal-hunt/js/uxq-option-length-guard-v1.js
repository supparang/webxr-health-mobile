/* UX Quest • Option Length Guard v1
 * Removes the "longest choice = correct" cue without changing correctness.
 * Every decision shows neutral A–D headings and a balanced-length explanation.
 */
(()=>{'use strict';
  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  const compact=(value,max=112)=>{
    const s=text(value);
    if(s.length<=max)return s;
    const head=Math.max(62,Math.floor(max*.72)),tail=Math.max(18,max-head-2);
    return `${s.slice(0,head).trim()}…${s.slice(-tail).trim()}`;
  };
  const fill=(value,target=126)=>{
    let s=compact(value,target);
    const neutral=' พิจารณาเป้าหมายผู้ใช้ ข้อจำกัด และผลต่อ task.';
    while(s.length<target-12)s+=neutral;
    return compact(s,target);
  };
  function balance(config){
    if(!config||!Array.isArray(config.bank))return config;
    const copy=Object.assign({},config,{bank:config.bank.map(casefile=>{
      const stages={};
      Object.entries(casefile.stages||{}).forEach(([key,stage])=>{
        const options=Array.isArray(stage?.options)?stage.options:[];
        stages[key]=Object.assign({},stage,{options:options.map((option,index)=>{
          const original=text(option.label);
          const support=text(option.description);
          const visible=fill(`${original}${support?` — ${support}`:''}`,126);
          return Object.assign({},option,{label:`แนวทาง ${String.fromCharCode(65+index)}`,description:visible,fullLabel:original});
        })});
      });
      return Object.assign({},casefile,{stages});
    })});
    if(Array.isArray(config.bossBank))copy.bossBank=copy.bank;
    copy.format=`${text(config.format)} • ตัวเลือกสมดุลความยาว`;
    return copy;
  }
  const prior=Object.getOwnPropertyDescriptor(window,'UXQMissionEngine');let current;
  Object.defineProperty(window,'UXQMissionEngine',{configurable:true,get(){return current||(prior?.get?prior.get.call(window):undefined)},set(engine){
    if(prior?.set){prior.set.call(window,engine);engine=prior.get?prior.get.call(window):engine;}
    if(!engine||typeof engine.init!=='function'){current=engine;return;}
    const init=engine.init.bind(engine);
    current=Object.freeze(Object.assign({},engine,{init:config=>init(balance(config))}));
  }});
  window.UXQOptionLengthGuard=Object.freeze({version:'v1',balance});
})();