// === Hero Health Academy — core/mission-system.js (v2.4 single-active mini-quest) ===
export class MissionSystem {
  constructor(){
    // ----- Default pools -----
    this.pool = {
      goodjunk: [
        { key:'collect_goods',   target:[20,30,40],   icon:'🍎' },
        { key:'count_perfect',   target:[6,10,14],    icon:'🌟' },
        { key:'count_golden',    target:[2,3,4],      icon:'🟡' },
        { key:'reach_combo',     target:[12,18,24],   icon:'🔥' },
        { key:'no_miss',         target:[0],          icon:'❌' },
        { key:'score_reach',     target:[150,220,300],icon:'🏁' }
      ],
      groups: [
        { key:'target_hits',     target:[12,18,24],   icon:'🎯' },
        { key:'count_perfect',   target:[6,9,12],     icon:'🌟' },
        { key:'reach_combo',     target:[14,18,22],   icon:'🔥' },
        { key:'no_wrong_group',  target:[0],          icon:'🚫' },
        { key:'score_reach',     target:[160,240,320],icon:'🏁' }
      ],
      hydration: [
        { key:'hold_ok_sec',     target:[15,20,30],   icon:'💧' },
        { key:'no_overflow',     target:[0],          icon:'🛑' },
        { key:'count_perfect',   target:[4,6,8],      icon:'🌟' },
        { key:'reach_combo',     target:[12,16,20],   icon:'🔥' },
        { key:'score_reach',     target:[150,220,300],icon:'🏁' }
      ],
      plate: [
        { key:'perfect_plates',  target:[1,2,3],      icon:'🍽️' },
        { key:'no_over_quota',   target:[0],          icon:'🚫' },
        { key:'count_perfect',   target:[4,6,8],      icon:'🌟' },
        { key:'reach_combo',     target:[10,14,18],   icon:'🔥' },
        { key:'score_reach',     target:[180,260,340],icon:'🏁' }
      ]
    };
    this._icons = {
      collect_goods:'🍎', no_miss:'❌', score_reach:'🏁',
      target_hits:'🎯', no_wrong_group:'🚫',
      hold_ok_sec:'💧', no_overflow:'🛑',
      perfect_plates:'🍽️', no_over_quota:'🚫',
      count_perfect:'🌟', count_golden:'🟡', reach_combo:'🔥'
    };
    this._lastCoachAt = 0;
    this._coachGapMs  = 650;
  }

  // ===== Utils =====
  _rand(a){ return a[(Math.random()*a.length)|0]; }
  _clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  _num(n,d=0){ const v=Number(n); return Number.isFinite(v)?v:d; }

  _ensureCtx(state){
    state.ctx = state.ctx || {};
    state.ctx.goodHits = this._num(state.ctx.goodHits,0);
    state.ctx.miss = this._num(state.ctx.miss,0);
    state.ctx.targetHitsTotal = this._num(state.ctx.targetHitsTotal,0);
    state.ctx.wrongGroup = this._num(state.ctx.wrongGroup,0);
    state.ctx.hydOkSec = this._num(state.ctx.hydOkSec,0);
    state.ctx.overflow = this._num(state.ctx.overflow,0);
    state.ctx.perfectPlates = this._num(state.ctx.perfectPlates,0);
    state.ctx.overfillCount = this._num(state.ctx.overfillCount,0);
    state.ctx.perfectCount = this._num(state.ctx.perfectCount,0);
    state.ctx.goldenCount = this._num(state.ctx.goldenCount,0);
    state.ctx.maxCombo = this._num(state.ctx.maxCombo,0);
  }

  _pickSet(mode,count){
    const cand = this.pool[mode] || [{key:'score_reach',target:[200,260,320],icon:'🏁'}];
    const shuffled = cand.slice().sort(()=>Math.random()-0.5);
    const out=[];
    for(const m of shuffled){
      if(out.find(x=>x.key===m.key)) continue;
      const tgt=this._clamp(this._num(this._rand(m.target),0),0,99999);
      out.push({key:m.key,target:tgt,progress:0,done:false,success:false,remainSec:0,icon:(m.icon||this._icons[m.key]||'⭐')});
      if(out.length>=count) break;
    }
    return out;
  }

  // ===== Public API =====
  start(mode,opts={}){
    const legacy=(opts===undefined);
    const o=opts||{};
    const seconds=Math.max(10,(o.seconds|0)||45);
    const count=this._clamp((o.count|0)||(legacy?1:3),1,3);
    const lang=String(o.lang||'TH').toUpperCase();
    const single=(o.singleActive!==false);
    const missions=this._pickSet(mode,count).map(m=>({...m,remainSec:seconds}));
    return legacy?{...missions[0]}:{list:missions,seconds,lang,singleActive:!!single,activeIndex:0};
  }

  attachToState(run,state){
    state.missions=(run?.list||[]).map(m=>({...m,remainSec:Math.max(0,m.remainSec|0)}));
    state.lang=run?.lang||state.lang||'TH';
    state.singleActive=(run?.singleActive!==false);
    state.activeIndex=this._num(run?.activeIndex,0);
    this._ensureCtx(state);
    return state;
  }

  describe(m,lang='TH'){
    const TH={
      collect_goods:t=>`เก็บของดี ${t} ชิ้น`,count_perfect:t=>`Perfect ${t}`,
      count_golden:t=>`Golden ${t}`,reach_combo:t=>`คอมโบ x${t}`,
      no_miss:_=>'ห้ามพลาด',score_reach:t=>`คะแนน ${t}`,
      target_hits:t=>`เป้าหมาย ${t}`,no_wrong_group:_=>'ห้ามผิดหมวด',
      hold_ok_sec:t=>`อยู่ในโซนน้ำ ${t}s`,no_overflow:_=>'ห้ามน้ำเกิน',
      perfect_plates:t=>`จานสมบูรณ์ ${t}`,no_over_quota:_=>'ห้ามเกินโควตา'
    };
    const EN={
      collect_goods:t=>`Collect ${t}`,count_perfect:t=>`Perfect ${t}`,
      count_golden:t=>`Golden ${t}`,reach_combo:t=>`Combo x${t}`,
      no_miss:_=>'No miss',score_reach:t=>`Score ${t}`,
      target_hits:t=>`Target ${t}`,no_wrong_group:_=>'No wrong group',
      hold_ok_sec:t=>`OK zone ${t}s`,no_overflow:_=>'No overflow',
      perfect_plates:t=>`Full plate ${t}`,no_over_quota:_=>'No over quota'
    };
    const L=(String(lang).toUpperCase()==='EN')?EN:TH;
    const fn=L[m?.key]||(x=>`${m?.key||'mission'} ${x}`);
    return fn(this._num(m?.target,0));
  }

  onEvent(ev,meta={},state){
    this._ensureCtx(state);
    const c=(n)=>(Number.isFinite(n)?n|0:1);
    switch(ev){
      case'good':state.ctx.goodHits+=c(meta.count);break;
      case'miss':state.ctx.miss+=c(meta.count);break;
      case'perfect':state.ctx.perfectCount+=c(meta.count);break;
      case'golden':state.ctx.goldenCount+=c(meta.count);break;
      case'combo':state.ctx.maxCombo=Math.max(state.ctx.maxCombo|0,this._num(meta.value,0));break;
      case'target_hit':state.ctx.targetHitsTotal+=c(meta.count);break;
      case'wrong_group':state.ctx.wrongGroup+=c(meta.count);break;
      case'plate_perfect':state.ctx.perfectPlates+=c(meta.count);break;
      case'over_quota':state.ctx.overfillCount+=c(meta.count);break;
      case'overflow':state.ctx.overflow+=c(meta.count);break;
      case'hydration_zone':if(meta.z==='ok')state.ctx.hydOkSec+=1;break;
    }
  }

  tick(state,score,cb,hooks={}){
    const hud=hooks.hud,coach=hooks.coach;
    const lang=(hooks.lang||state?.lang||'TH').toUpperCase();
    const nowMs=performance?.now?.()||Date.now();

    const list=state?.missions||[];
    if(!list.length)return[];
    if(!Number.isFinite(state.activeIndex))state.activeIndex=0;

    // หาเควสต์ที่ยังไม่เสร็จ
    let idx=state.activeIndex;
    for(;idx<list.length&&list[idx].done;idx++);
    if(idx>=list.length){hud?.setQuestChips?.([]);hud?.showMiniQuest?.('');return[];}
    state.activeIndex=idx;
    const m=list[idx];
    m.remainSec=Math.max(0,(m.remainSec|0)-1);
    const prev=m.progress|0;
    const {ok,fail,progress}=this._evaluateOne(state,score,m);
    if(Number.isFinite(progress))m.progress=progress;

    if(ok||fail){
      m.done=true;m.success=!!ok;
      cb?.({success:!!ok,key:m.key,index:idx});
      coach&&(ok?coach.onQuestDone?.():coach.onQuestFail?.());
      hud?.showMiniQuestComplete?.(this.describe(m,lang));
      let next=idx+1;
      for(;next<list.length&&list[next].done;next++);
      if(next<list.length){
        state.activeIndex=next;
        const nm=list[next];
        const chip=this._chipOf(nm,lang);
        hud?.setQuestChips?.([chip]);
        setTimeout(()=>hud?.showMiniQuest?.(chip.label),650);
        return[chip];
      }else{
        hud?.setQuestChips?.([]);setTimeout(()=>hud?.showMiniQuest?.(''),650);return[];
      }
    }else{
      if((m.progress|0)!==prev){
        if(!coach||(nowMs-this._lastCoachAt)>=this._coachGapMs){
          coach?.onQuestProgress?.(this.describe(m,lang),m.progress|0,m.target|0);
          this._lastCoachAt=nowMs;
        }
      }
      const chip=this._chipOf(m,lang);
      hud?.setQuestChips?.([chip]);
      hud?.showMiniQuest?.(chip.label);
      return[chip];
    }
  }

  _evaluateOne(state,score,m){
    let ok=false,fail=false,progress=this._num(m.progress,0);
    const sc=this._num(score?.score,0);
    switch(m.key){
      case'collect_goods':progress=this._num(state.ctx.goodHits,0);ok=progress>=(m.target|0);break;
      case'count_perfect':progress=this._num(state.ctx.perfectCount,0);ok=progress>=(m.target|0);break;
      case'count_golden':progress=this._num(state.ctx.goldenCount,0);ok=progress>=(m.target|0);break;
      case'reach_combo':progress=this._num(state.ctx.maxCombo,0);ok=progress>=(m.target|0);break;
      case'no_miss':{const miss=this._num(state.ctx.miss,0)>0;if(m.remainSec<=0){ok=!miss;fail=miss;}break;}
      case'score_reach':progress=this._clamp(sc,0,m.target|0);ok=sc>=(m.target|0);break;
      case'target_hits':progress=this._num(state.ctx.targetHitsTotal,0);ok=progress>=(m.target|0);break;
      case'no_wrong_group':{const w=this._num(state.ctx.wrongGroup,0)>0;if(m.remainSec<=0){ok=!w;fail=w;}break;}
      case'hold_ok_sec':progress=this._num(state.ctx.hydOkSec,0);ok=progress>=(m.target|0);break;
      case'no_overflow':{const of=this._num(state.ctx.overflow,0)>0;if(m.remainSec<=0){ok=!of;fail=of;}break;}
      case'perfect_plates':progress=this._num(state.ctx.perfectPlates,0);ok=progress>=(m.target|0);break;
      case'no_over_quota':{const o=this._num(state.ctx.overfillCount,0)>0;if(m.remainSec<=0){ok=!o;fail=o;}break;}
      default:{progress=this._num(progress,0);if(m.remainSec<=0){ok=false;fail=true;}}
    }
    if(!ok&&!fail&&(m.remainSec|0)<=0)fail=true;
    progress=this._clamp(progress|0,0,this._num(m.target,0));
    return{ok,fail,progress};
  }

  _chipOf(m,lang='TH'){
    const label=this.describe(m,lang);
    return{
      key:m.key,icon:m.icon||this._icons[m.key]||'⭐',
      need:this._num(m.target,0),
      progress:this._clamp(this._num(m.progress,0),0,this._num(m.target,0)),
      remain:this._clamp(this._num(m.remainSec,0),0,9999),
      done:!!m.done,fail:!!m.done&&!m.success,label
    };
  }
}

try{window.__HHA_MISSION_VER__='v2.4-single-active';}catch{}
