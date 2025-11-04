// === Hero Health Academy — core/mission-system.js (v4.1: auto-advance, no zero target, instant HUD) ===
'use strict';

export class MissionSystem {
  constructor(){
    // 10 mini-quests (จะสุ่มมา 3 ต่อรอบ)
    this.poolDefs = [
      { key:'collect_goods', icon:'🥗', need:[12,16,20],  label:(n)=>`เก็บของดีให้ครบ ${n} ชิ้น` },
      { key:'count_perfect', icon:'🌟', need:[6,8,10],    label:(n)=>`Perfect ให้ครบ ${n}` },
      { key:'count_golden',  icon:'🟡', need:[2,3,4],     label:(n)=>`แตะทองให้ครบ ${n}` },
      { key:'reach_combo',   icon:'🔥', need:[10,20,30],  label:(n)=>`ทำคอมโบให้ถึง x${n}` },
      { key:'score_reach',   icon:'🏁', need:[300,450,600],label:(n)=>`ทำคะแนนให้ถึง ${n}` },
      { key:'target_hits',   icon:'🎯', need:[18,24,30],  label:(n)=>`ตีโดนให้ครบ ${n}` },
      // no_miss = ต่อเนื่องไม่พลาด N ครั้ง (เดิมเป้าดูเหมือน 0/0 → ปรับให้ชัดเจน)
      { key:'no_miss',       icon:'❌', need:[6,8,10],    label:(n)=>`ห้ามพลาดต่อเนื่อง จนครบ ${n} ครั้ง` },
      { key:'quick_start',   icon:'⚡', need:[5,6,7],     label:(n)=>`10 วินาทีแรก เก็บของดีให้ได้ ${n}` },
      { key:'streak_keep',   icon:'🧊', need:[8,10,12],   label:(n)=>`รักษาคอมโบ ≥ ${n} ต่อเนื่อง (วินาที)` },
      { key:'timed_survive', icon:'⏱️', need:[10,15,20],  label:(n)=>`อยู่รอด ${n} วิ โดยไม่พลาด` },
    ];
    this.active = [];
    this.index  = 0;
    this.runCtx = null;
    this.stats  = { miss:0, hits:0, goods:0, perfect:0, golden:0, combo:0, score:0, elapsed:0 };
  }

  _tier(diff){ if (diff==='Easy') return 0; if (diff==='Hard') return 2; return 1; }

  describe(m){ 
    const d=this.poolDefs.find(x=>x.key===m.key); 
    const n=m.target|0; 
    return d?.label ? d.label(n) : m.key; 
  }

  start(modeKey, {seconds=45, count=3, lang='TH', singleActive=true, diff='Normal'}={}){
    const tier=this._tier(diff);
    const pool=[...this.poolDefs];
    const picks=[];
    for(let i=0;i<count && pool.length;i++){
      const d=pool.splice((Math.random()*pool.length)|0,1)[0];
      let target = Array.isArray(d.need) ? (d.need[tier]|0) : (d.need|0);
      if (!Number.isFinite(target) || target<=0) target = 1; // ⬅ ป้องกัน 0
      picks.push({ key:d.key, icon:d.icon, target, progress:0, done:false, fail:false, label:d.label?d.label(target):d.key, _t:0 });
    }
    this.active=picks; this.index=0;
    this.runCtx={seconds, singleActive, lang, diff};
    this.stats={ miss:0, hits:0, goods:0, perfect:0, golden:0, combo:0, score:0, elapsed:0 };
    return { missions:this.active };
  }

  attachToState(run, stateRef){ stateRef.missions=this.active; stateRef.ctx=this.runCtx; }
  reset(stateRef){ this.active=[]; this.index=0; this.runCtx=null; this.stats={ miss:0, hits:0, goods:0, perfect:0, golden:0, combo:0, score:0, elapsed:0 }; if(stateRef){stateRef.missions=[]; stateRef.ctx={};} }

  _chips(){
    return this.active.map((m,i)=>({
      key:m.key,label:m.label,need:m.target|0,progress:Math.min(m.target|0,m.progress|0),
      done:!!m.done,fail:!!m.fail,active:(i===this.index && !m.done && !m.fail),icon:m.icon,iconSize:16
    }));
  }
  _cur(){ return this.active[this.index]||null; }

  _advanceAndAnnounce({hud,coach}={}){
    // เดินข้ามเควสต์ที่จบ/พัง
    while(this.index < this.active.length && (this.active[this.index].done || this.active[this.index].fail)) this.index++;
    // ประกาศเควสต์ถัดไป
    const nxt=this._cur();
    if(nxt){ hud?.showMiniQuest?.(nxt.label); }
    hud?.setQuestChips?.(this._chips());
  }

  // เรียกทุก 1 วิ (จาก main)
  tick(stateRef, scoreCtx, _unused, ui={}){
    this.stats.elapsed=(this.stats.elapsed|0)+1;
    const cur=this._cur();

    if(cur){
      // เงื่อนไขตามเวลา
      if(cur.key==='timed_survive' && !cur.fail){ cur._t=(cur._t|0)+1; cur.progress=cur._t; if(cur.progress>=cur.target){ cur.done=true; } }
      if(cur.key==='streak_keep'){
        const need=cur.target|0;
        if((this.stats.combo|0)>=need){ cur._t=(cur._t|0)+1; cur.progress=cur._t; if(cur.progress>=need){ cur.done=true; } }
        else { cur._t=0; cur.progress=0; }
      }
      if(cur.key==='quick_start'){ if((this.stats.elapsed|0)>10 && !cur.done){ cur.fail=true; } }
      if(cur.key==='score_reach'){ cur.progress=Math.min(cur.target|0,this.stats.score|0); if(this.stats.score>=cur.target){ cur.done=true; } }
    }

    ui?.hud?.setQuestChips?.(this._chips());
    if(cur && (cur.done||cur.fail)){ this._advanceAndAnnounce(ui); }
    return this._chips();
  }

  // ให้ main เรียกทันทีหลังเกิดอีเวนต์ เพื่อให้เลื่อนไว (ไม่ต้องรอ tick)
  ensureAdvance(ui){ if(this._cur() && (this._cur().done||this._cur().fail)){ this._advanceAndAnnounce(ui); } }

  onEvent(type, payload, stateRef){
    if(type==='hit') this.stats.hits++;
    if(type==='good') this.stats.goods++;
    if(type==='perfect') this.stats.perfect++;
    if(type==='golden') this.stats.golden++;
    if(type==='miss') this.stats.miss++;
    if(type==='combo') this.stats.combo = Math.max(this.stats.combo|0, payload?.combo|0);
    if(type==='score') this.stats.score = payload?.score|0;

    const cur=this._cur(); if(!cur) return;

    switch(cur.key){
      case 'collect_goods': if(type==='good'||type==='perfect'){ cur.progress=Math.min(cur.target,(cur.progress|0)+1); } break;
      case 'count_perfect': if(type==='perfect'){ cur.progress=Math.min(cur.target,(cur.progress|0)+1); } break;
      case 'count_golden' : if(type==='golden'){  cur.progress=Math.min(cur.target,(cur.progress|0)+1); } break;
      case 'reach_combo'  :
        if(type==='combo'){
          const c=payload?.combo|0;
          if(c>=cur.target){ cur.progress=cur.target; cur.done=true; } else { cur.progress=Math.max(cur.progress|0,c); }
        }
        break;
      case 'score_reach'  :
        if(type==='score'){ cur.progress=Math.min(cur.target,payload?.score|0); if((payload?.score|0)>=cur.target){ cur.done=true; } }
        break;
      case 'target_hits'  : if(type==='hit'){ cur.progress=Math.min(cur.target,(cur.progress|0)+1); } break;
      case 'no_miss'      :
        if(type==='miss'){ cur.fail=true; cur._t=0; cur.progress=0; }
        if(type==='good'||type==='perfect'){ if(!cur.fail){ cur._t=(cur._t|0)+1; cur.progress=Math.min(cur.target,cur._t); if(cur.progress>=cur.target){ cur.done=true; } } }
        break;
      case 'quick_start'  :
        if((type==='good'||type==='perfect') && (this.stats.elapsed|0)<=10){ cur.progress=Math.min(cur.target,(cur.progress|0)+1); if(cur.progress>=cur.target){ cur.done=true; } }
        break;
      case 'streak_keep'  : /* handled in tick */ break;
      case 'timed_survive': if(type==='miss'){ cur.fail=true; } break;
    }
    if(cur.progress>=cur.target && !cur.done && !cur.fail){ cur.done=true; }
  }
}
