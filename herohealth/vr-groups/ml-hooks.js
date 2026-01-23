// === /herohealth/vr-groups/ml-hooks.js ===
// GroupsVR ML Hooks — SAFE (client-only)
// ✅ Enable: ?ml=1
// ✅ Sample snapshots every 250ms (default) into JSONL/CSV
// ✅ Logs events from: hha:score, hha:time, hha:rank, quest:update, groups:power, groups:progress, hha:judge, hha:shoot, hha:end
// ✅ Export buttons wired by groups-vr.html patch (optional)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  function qs(k,d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  const on = ['1','true','on','yes'].includes(String(qs('ml','0')).toLowerCase());
  if(!on || !DOC) { NS.ML = { enabled:false }; return; }

  const sampleMs = Math.max(100, Math.min(1000, Number(qs('mlms', 250))||250));

  // rolling state
  const S = {
    t0: Date.now(),
    view: String(qs('view','mobile')||'mobile'),
    run:  String(qs('run','play')||'play'),
    diff: String(qs('diff','normal')||'normal'),
    style:String(qs('style','mix')||'mix'),
    seed: String(qs('seed','')||''),

    timeLeft: 0,
    score: 0,
    combo: 0,
    misses: 0,
    acc: 0,
    grade: 'C',

    goalPct: 0,
    miniOn: 0,
    miniPct: 0,
    miniLeft: 0,

    powerCur: 0,
    powerThr: 8,

    // labels / scene states
    stormOn: 0,
    bossActive: 0,
    pressure: 0,  // from engine summary at end (approx), also can be derived from misses if needed
  };

  const events = [];     // event labels
  const samples = [];    // snapshot sequence
  let ended = false;

  function relMs(){ return Date.now() - S.t0; }
  function pushEvent(type, extra){
    events.push(Object.assign({ t: relMs(), type }, extra||{}));
  }

  // snapshots
  let timer = null;
  function startSampling(){
    if(timer) return;
    timer = setInterval(()=>{
      if(ended) return;
      samples.push({
        t: relMs(),
        timeLeft: S.timeLeft,
        score: S.score,
        combo: S.combo,
        misses: S.misses,
        acc: S.acc,
        grade: S.grade,

        goalPct: Math.round(S.goalPct),
        miniOn: S.miniOn,
        miniPct: Math.round(S.miniPct),
        miniLeft: S.miniLeft,

        powerCur: S.powerCur,
        powerThr: S.powerThr,

        stormOn: S.stormOn,
        bossActive: S.bossActive,
        pressure: S.pressure,

        view: S.view,
        run: S.run,
        diff: S.diff,
        style: S.style
      });
    }, sampleMs);
  }
  startSampling();

  // listeners
  root.addEventListener('hha:time', (ev)=>{
    const d = ev.detail||{};
    S.timeLeft = Number(d.left||0)|0;
  }, {passive:true});

  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    S.score = Number(d.score||0)|0;
    S.combo = Number(d.combo||0)|0;
    S.misses= Number(d.misses||0)|0;
  }, {passive:true});

  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    S.grade = String(d.grade||'C');
    S.acc   = Number(d.accuracy||0)|0;
  }, {passive:true});

  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    S.goalPct = Number(d.goalPct||0);
    S.miniOn  = (d.miniTimeLeftSec && Number(d.miniTimeLeftSec)>0) ? 1 : 0;
    S.miniPct = Number(d.miniPct||0);
    S.miniLeft= Number(d.miniTimeLeftSec||0)|0;
  }, {passive:true});

  root.addEventListener('groups:power', (ev)=>{
    const d = ev.detail||{};
    S.powerCur = Number(d.charge||0)|0;
    S.powerThr = Number(d.threshold||8)|0;
  }, {passive:true});

  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if(k==='storm_on')  { S.stormOn = 1; pushEvent('storm_on'); }
    if(k==='storm_off') { S.stormOn = 0; pushEvent('storm_off'); }

    if(k==='boss_spawn'){ S.bossActive = 1; pushEvent('boss_spawn', { pattern:d.pattern||'' }); }
    if(k==='boss_down') { S.bossActive = 0; pushEvent('boss_down'); }

    if(k==='mini_start') pushEvent('mini_start');
    if(k==='mini_clear') pushEvent('mini_clear');
    if(k==='mini_fail')  pushEvent('mini_fail');

    if(k==='perfect_switch') pushEvent('switch_group', { toName:d.toName||'' });
    if(k==='miss') pushEvent('miss', { why:d.why||'' });
    if(k==='pressure') { S.pressure = Number(d.level||0)|0; pushEvent('pressure', { level:S.pressure }); }
  }, {passive:true});

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'');
    // normalize labels for training
    if(kind==='good') pushEvent('hit_good', { text:d.text||'' });
    else if(kind==='bad') pushEvent('hit_bad', { text:d.text||'' });
    else if(kind==='miss') pushEvent('shoot_miss');
    else if(kind==='boss') pushEvent('boss_hit', { text:d.text||'' });
    else if(kind==='perfect') pushEvent('perfect', { text:d.text||'' });
    else if(kind==='storm') pushEvent('storm_mark', { text:d.text||'' });
  }, {passive:true});

  root.addEventListener('hha:shoot', (ev)=>{
    pushEvent('shoot', { src: (ev.detail && ev.detail.source) ? String(ev.detail.source) : '' });
  }, {passive:true});

  root.addEventListener('hha:end', (ev)=>{
    ended = true;
    const d = ev.detail||{};
    S.pressure = Number(d.pressureLevel||S.pressure||0)|0;
    pushEvent('end', { reason:d.reason||'end', grade:d.grade||S.grade });
    clearInterval(timer);
  }, {passive:true});

  // export helpers
  function toJSONL(){
    const header = {
      meta:{
        game:'GroupsVR',
        createdIso: new Date().toISOString(),
        view:S.view, run:S.run, diff:S.diff, style:S.style, seed:S.seed,
        sampleMs
      }
    };
    const lines = [];
    lines.push(JSON.stringify(header));
    lines.push(JSON.stringify({ events }));
    for(const s of samples) lines.push(JSON.stringify(s));
    return lines.join('\n');
  }

  function toCSV(){
    const cols = [
      't','timeLeft','score','combo','misses','acc','grade',
      'goalPct','miniOn','miniPct','miniLeft',
      'powerCur','powerThr',
      'stormOn','bossActive','pressure',
      'view','run','diff','style'
    ];
    const rows = [cols.join(',')];
    for(const s of samples){
      rows.push(cols.map(k=>{
        const v = (s[k] != null) ? s[k] : '';
        const str = String(v).replaceAll('"','""');
        return `"${str}"`;
      }).join(','));
    }
    return rows.join('\n');
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 200);
    }catch(_){}
  }

  NS.ML = {
    enabled:true,
    getState: ()=>({ S: Object.assign({},S), samples: samples.slice(), events: events.slice() }),
    exportJSONL: ()=> toJSONL(),
    exportCSV: ()=> toCSV(),
    downloadJSONL: ()=> downloadText(`groups-ml-${Date.now()}.jsonl`, toJSONL()),
    downloadCSV: ()=> downloadText(`groups-ml-${Date.now()}.csv`, toCSV()),
  };

})(window);