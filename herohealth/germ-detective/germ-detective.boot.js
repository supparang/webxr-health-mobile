// === /herohealth/germ-detective/germ-detective.boot.js ===
import GameApp from './app.js';
import { createLogger } from './germ-detective.logger.js';
import { ensureResultModalDOM, renderResult } from './germ-detective.result.js';

(function(){
  'use strict';

  const P = {
    run:  String(new URL(location.href).searchParams.get('run')  || 'play').toLowerCase(),
    diff: String(new URL(location.href).searchParams.get('diff') || 'normal').toLowerCase(),
    time: Math.max(20, Math.min(600, Number(new URL(location.href).searchParams.get('time') || 80))),
    seed: String(new URL(location.href).searchParams.get('seed') || Date.now()),
    pid:  String(new URL(location.href).searchParams.get('pid')  || 'anon'),
    scene:String(new URL(location.href).searchParams.get('scene')|| 'classroom').toLowerCase(),
    view: String(new URL(location.href).searchParams.get('view') || 'pc').toLowerCase(),
    hub:  String(new URL(location.href).searchParams.get('hub')  || '/herohealth/hub.html')
  };
  document.documentElement.dataset.view = P.view;

  // minimal GD state (ให้โมดูลอื่นอ่านได้)
  const GD = window.GD = window.GD || {
    ai:{ riskScore:72, nextBestAction:null },
    budget:{ points:100, spent:0, actions:[], cleanedTargets:new Set() },
    phase:{ mode:'investigate' },
    mission:{ current:null, progress:{} },
    graph:{ nodes:new Map(), edges:[], lastSeq:[] },
    trace:{ toolUse:{uv:0,swab:0,cam:0}, uniqueTargets:new Set(), evidenceCount:0 }
  };

  const hubURL = ()=> P.hub || '/herohealth/hub.html';

  // ensure modal exists
  ensureResultModalDOM();

  // create app
  const app = GameApp({ mountId:'app', timeSec:P.time, seed:P.seed, scene:P.scene, view:P.view });
  app.init();

  // Logger
  const logger = createLogger(()=>({
    P, GD, app,
    helpers:{
      budgetLeft: ()=> Math.max(0, (GD.budget.points||0) - (GD.budget.spent||0)),
      graphTopChain: ()=> (window.__GD_GRAPH_CHAIN__ || []),
      graphNodeCount: ()=> (GD.graph.nodes ? Array.from(GD.graph.nodes.values()).length : 0),
      graphEdgeCount: ()=> (GD.graph.edges ? GD.graph.edges.length : 0)
    }
  }));
  logger.init();
  logger.startFeatureLoop();

  // hook all hha:event to logger
  window.addEventListener('hha:event', (ev)=>{
    const d = ev.detail || {};
    logger.logEvent(d.name || 'hha_event', d.payload || {});
  }, false);

  // end -> compute score (ใช้ของคุณเดิมหรือจะเสียบฟังก์ชัน computeFinalScore ใน boot ใหญ่)
  function computeFinalScoreFallback(){
    const final = Math.max(0, Math.min(100, 60 + Math.round(Math.random()*30))); // fallback ถ้ายังไม่เสียบ scoring ตัวจริง
    return {
      final,
      rank: final>=90?'S':final>=80?'A':final>=70?'B':final>=60?'C':'D',
      accuracy:{score:0}, chain:{score:0}, speed:{score:0}, verification:{score:0},
      intervention:{score:0,strategy:0,efficiency:0},
      mission:{completedObjectives:0,totalObjectives:0,bonusPoints:0,allClear:false},
      graph:{ inferredChain: window.__GD_GRAPH_CHAIN__ || [] }
    };
  }

  function finalize(reason='end'){
    try{ logger.stopFeatureLoop(); }catch{}
    const score = (GD.score && GD.score.final!=null) ? GD.score : computeFinalScoreFallback();
    GD.score = score;
    logger.logSessionEnd({ reason });
    // ให้ export ปุ่มเรียก logger.exportCsv ได้ (จะเพิ่มปุ่มภายหลังได้)
    renderResult({ P, GD, score, hubURL });
  }

  window.addEventListener('hha:end', (ev)=> finalize(ev.detail?.reason || 'end'), false);
  window.addEventListener('pagehide', ()=>{ try{ logger.logSessionEnd({ reason:'pagehide' }); }catch{} }, false);

})();