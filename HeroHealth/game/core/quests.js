// === Hero Health Academy — core/quests.js (10 quests per mode, HUD-ready) ===
export const Quests = (() => {
  // ---------- Quest definitions (10 ต่อโหมด) ----------
  const GJ = [ // Good vs Junk
    { id:'gj_good30',   icon:'🥗', labelTH:'เก็บของดี 30',   labelEN:'Collect 30 good',          need:30, type:'count_good' },
    { id:'gj_good50',   icon:'🥗', labelTH:'เก็บของดี 50',   labelEN:'Collect 50 good',          need:50, type:'count_good' },
    { id:'gj_combo15',  icon:'🔥', labelTH:'คอมโบ x15',      labelEN:'Combo x15',                need:15, type:'reach_combo' },
    { id:'gj_combo25',  icon:'🔥', labelTH:'คอมโบ x25',      labelEN:'Combo x25',                need:25, type:'reach_combo' },
    { id:'gj_perfect8', icon:'🌟', labelTH:'Perfect 8',       labelEN:'8 Perfects',               need:8,  type:'count_perfect' },
    { id:'gj_perfect12',icon:'🌟', labelTH:'Perfect 12',      labelEN:'12 Perfects',              need:12, type:'count_perfect' },
    { id:'gj_avoid10',  icon:'🛡️', labelTH:'ไม่โดนขยะ 10',  labelEN:'Avoid 10 junk',            need:10, type:'streak_nomiss' },
    { id:'gj_score300', icon:'⏱️', labelTH:'คะแนน≥300',      labelEN:'Score ≥300',               need:300, type:'reach_score' },
    { id:'gj_fever2',   icon:'✨', labelTH:'เปิดFEVER 2',     labelEN:'Trigger FEVER 2x',         need:2,  type:'count_fever' },
    { id:'gj_golden3',  icon:'🟡', labelTH:'Golden 3',        labelEN:'Hit 3 Golden',             need:3,  type:'count_golden' },
  ];

  const GR = [ // Groups (targeted)
    { id:'gr_target20', icon:'🎯', labelTH:'ตรงหมวด 20',     labelEN:'20 target hits',           need:20, type:'count_target' },
    { id:'gr_target35', icon:'🎯', labelTH:'ตรงหมวด 35',     labelEN:'35 target hits',           need:35, type:'count_target' },
    { id:'gr_veggie8',  icon:'🥦', labelTH:'ผัก 8',           labelEN:'8 veggies',                need:8,  type:'count_group', group:'veggies' },
    { id:'gr_fruit8',   icon:'🍎', labelTH:'ผลไม้ 8',         labelEN:'8 fruits',                 need:8,  type:'count_group', group:'fruits' },
    { id:'gr_combo18',  icon:'🔥', labelTH:'คอมโบ x18',      labelEN:'Combo x18',                need:18, type:'reach_combo' },
    { id:'gr_perfect8', icon:'🌟', labelTH:'Perfect 8',       labelEN:'8 Perfects',               need:8,  type:'count_perfect' },
    { id:'gr_clear3',   icon:'✅', labelTH:'เปลี่ยนเป้า 3',   labelEN:'Clear 3 targets',          need:3,  type:'targets_cleared' },
    { id:'gr_score320', icon:'⏱️', labelTH:'คะแนน≥320',      labelEN:'Score ≥320',               need:320, type:'reach_score' },
    { id:'gr_fever1',   icon:'✨', labelTH:'เปิดFEVER 1',     labelEN:'Trigger FEVER',            need:1,  type:'count_fever' },
    { id:'gr_golden2',  icon:'🟡', labelTH:'Golden 2',        labelEN:'Hit 2 Golden',             need:2,  type:'count_golden' },
  ];

  const HY = [ // Hydration
    { id:'hy_ok20s',    icon:'💠', labelTH:'อยู่โซนพอดี 20s', labelEN:'OK zone 20s',             need:20, type:'hydro_ok_time' },
    { id:'hy_ok35s',    icon:'💠', labelTH:'อยู่โซนพอดี 35s', labelEN:'OK zone 35s',             need:35, type:'hydro_ok_time' },
    { id:'hy_recover3', icon:'📈', labelTH:'กู้จากต่ำ 3',     labelEN:'Recover from LOW 3x',      need:3,  type:'hydro_recover_low' },
    { id:'hy_treat4',   icon:'🍬', labelTH:'ลดสูงด้วยหวาน 4', labelEN:'Treat high 4x',           need:4,  type:'hydro_treat_high' },
    { id:'hy_combo14',  icon:'🔥', labelTH:'คอมโบ x14',      labelEN:'Combo x14',                need:14, type:'reach_combo' },
    { id:'hy_perfect6', icon:'🌟', labelTH:'Perfect 6',       labelEN:'6 Perfects',               need:6,  type:'count_perfect' },
    { id:'hy_no_over',  icon:'🚫', labelTH:'ไม่เกินน้ำ',      labelEN:'No overhydration',         need:0,  type:'hydro_no_high' },
    { id:'hy_score280', icon:'⏱️', labelTH:'คะแนน≥280',      labelEN:'Score ≥280',               need:280, type:'reach_score' },
    { id:'hy_fever1',   icon:'✨', labelTH:'เปิดFEVER',        labelEN:'Trigger FEVER',            need:1,  type:'count_fever' },
    { id:'hy_sips10',   icon:'🧠', labelTH:'จิบเหมาะสม 10',   labelEN:'Smart sips 10',            need:10, type:'hydro_smart_sip' },
  ];

  const PL = [ // Plate
    { id:'pl_fill12',   icon:'🍱', labelTH:'วางถูก 12',       labelEN:'Place 12 correct',         need:12, type:'count_target' },
    { id:'pl_fill18',   icon:'🍱', labelTH:'วางถูก 18',       labelEN:'Place 18 correct',         need:18, type:'count_target' },
    { id:'pl_veg4',     icon:'🥦', labelTH:'ใส่ผัก 4',        labelEN:'Add 4 veggies',            need:4,  type:'count_group', group:'veggies' },
    { id:'pl_pro3',     icon:'🍗', labelTH:'โปรตีน 3',        labelEN:'3 protein',                need:3,  type:'count_group', group:'protein' },
    { id:'pl_combo10',  icon:'🔥', labelTH:'คอมโบ x10',      labelEN:'Combo x10',                need:10, type:'reach_combo' },
    { id:'pl_perfect4', icon:'🌟', labelTH:'Perfect 4',       labelEN:'4 Perfects',               need:4,  type:'count_perfect' },
    { id:'pl_golden2',  icon:'🟡', labelTH:'Golden 2',        labelEN:'Hit 2 Golden',             need:2,  type:'count_golden' },
    { id:'pl_no_over',  icon:'🚫', labelTH:'ห้ามเกินโควตา',   labelEN:'No over quota',            need:0,  type:'no_over_quota' },
    { id:'pl_score300', icon:'⏱️', labelTH:'คะแนน≥300',      labelEN:'Score ≥300',               need:300, type:'reach_score' },
    { id:'pl_any2full', icon:'✅', labelTH:'เติมครบ 2 หมวด',   labelEN:'Complete 2 groups',        need:2,  type:'groups_completed' },
  ];

  const POOLS = { goodjunk: GJ, groups: GR, hydration: HY, plate: PL };

  // ---------- Runtime ----------
  let RUN = null, _hud = null;

  function shufflePick3(list){
    const a=[...list]; for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j]]=[a[j],a[i]]; }
    return a.slice(0,3);
  }
  function toChips(){
    if (!RUN) return [];
    return RUN.list.map(q=>({
      key:q.id, icon:q.icon||'⭐', need:q.need|0,
      progress: Math.max(0, Math.min(q.need|0, q.prog|0)),
      remain: RUN.remainSec|0, done:!!q.done, fail:!!q.fail, label:q.label
    }));
  }
  function evalDone(){ if(!RUN) return; for(const q of RUN.list){ if(!q.done && !q.fail){ if((q.prog|0)>=(q.need|0)) q.done=true; else if((RUN.remainSec|0)<=0) q.fail=true; } } }

  function beginRun(mode, diff, lang='TH', seconds=45){
    const pool = POOLS[mode]||GJ;
    const list = shufflePick3(pool).map(m=>({
      ...m,
      label: lang==='EN'?(m.labelEN||m.id):(m.labelTH||m.id),
      prog:0, done:false, fail:false
    }));
    RUN = { mode, diff, lang, list, remainSec: Math.max(10, seconds|0) };
    if (!window.HHA_QUESTS){ window.HHA_QUESTS = { event:(type,payload)=>event(type,payload) }; }
    if (_hud) _hud.setQuestChips(toChips());
    return list;
  }

  function _applyHit(ctx, type, p){
    for(const q of RUN.list){
      if(q.done) continue;
      switch(q.type){
        case 'count_good':     if(type==='hit' && (p.result==='good'||p.result==='perfect') && p.meta?.isGood) q.prog=(q.prog|0)+1; break;
        case 'count_perfect':  if(type==='hit' && p.result==='perfect') q.prog=(q.prog|0)+1; break;
        case 'streak_nomiss':  if(type==='hit'){ if(p.result==='bad') q._streak=0; else q._streak=(q._streak|0)+1; q.prog=Math.max(q.prog|0, q._streak|0); } break;
        case 'reach_score':    if((ctx.score|0) >= (q.need|0)) q.prog=q.need; break;
        case 'count_fever':    if(type==='fever' && p.kind==='start') q.prog=(q.prog|0)+1; break;
        case 'count_golden':   if(type==='hit' && p.meta?.golden) q.prog=(q.prog|0)+1; break;
        case 'count_target':   if(type==='hit' && (p.meta?.good||p.meta?.isTarget)) q.prog=(q.prog|0)+1; break;
        case 'count_group':    if(type==='hit' && p.meta?.groupId===q.group && (p.result==='good'||p.result==='perfect')) q.prog=(q.prog|0)+1; break;
        case 'reach_combo':    if(type==='hit'){ q._max = Math.max(q._max|0, p.comboNow|0); q.prog=q._max|0; } break;
        case 'targets_cleared':if(type==='target_cleared') q.prog=(q.prog|0)+1; break;
        case 'hydro_ok_time':  if(type==='hydro_tick' && p.zone==='OK') q.prog=(q.prog|0)+1; break;
        case 'hydro_recover_low': if(type==='hydro_cross' && p.from==='LOW' && p.to==='OK') q.prog=(q.prog|0)+1; break;
        case 'hydro_treat_high':  if(type==='hydro_click' && p.zoneBefore==='HIGH' && p.kind==='sweet') q.prog=(q.prog|0)+1; break;
        case 'hydro_no_high':  if(type==='run_end'){ if((p.highCount|0)===0) q.prog=0; q.prog=q.need; } break;
        case 'hydro_smart_sip':if(type==='hydro_click'){ const good=(p.zoneBefore==='LOW'&&p.kind==='water')||(p.zoneBefore==='HIGH'&&p.kind==='sweet')||(p.zoneBefore==='OK'&&p.kind==='water'); if(good) q.prog=(q.prog|0)+1; } break;
        case 'no_over_quota':  if(type==='run_end'){ if((p.overfill|0)===0) q.prog=q.need; } break;
        case 'groups_completed': if(type==='group_full') q.prog=Math.min(q.need|0, (q.prog|0)+1); break;
      }
    }
  }

  function event(type, payload={}){
    if(!RUN) return;
    const ctx = payload._ctx || {};
    _applyHit(ctx, type, payload);
    evalDone();
    if(_hud) _hud.setQuestChips(toChips());
  }

  function tick(payload={}){ if(!RUN) return; RUN.remainSec=Math.max(0,(RUN.remainSec|0)-1); // speed_finisher migrated to reach_score
    evalDone(); if(_hud) _hud.setQuestChips(toChips()); }

  function endRun(summary){ if(!RUN) return []; for(const q of RUN.list){ if(!q.done && !q.fail){ /* allow end checks already handled */ } }
    const out = RUN.list.map(x=>x); RUN=null; if(_hud) _hud.setQuestChips([]); return out; }

  function bindToMain({hud=null}={}){ _hud=hud||null; return { refresh(){ if(_hud) _hud.setQuestChips(toChips()); } }; }

  return { beginRun, event, tick, endRun, bindToMain };
})();
