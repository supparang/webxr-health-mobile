// app.js
// Germ Detective — game core (WebXR / three.js integration simplified)
// Responsibilities:
// - scene + hotspot objects (placeholders)
// - input: controller ray / mouse / gaze-dwell fallback
// - tools: UV, Swab, Camera (emit local events via plate.safe.logEvent)
// - UI: simple DOM buttons + evidence board (no networking)
// - expects plate.safe.js and plate-logger-bridge.js to be loaded (or mocked)

// NOTE: this file uses minimal three.js usage assumptions — in repo we'll include full imports.
// For prototype, you can swap raycasting logic with existing three.js setup.

export default function GameApp(opts = {}) {
  const cfg = Object.assign({
    mountId: 'app',         // container element id (if any)
    timeSec: 240,
    dwellMs: 1200,
    seed: null
  }, opts);

  // state
  const STATE = {
    running: false,
    timeLeft: cfg.timeSec,
    tool: null, // 'uv'|'swab'|'cam'
    evidence: [], // {type, target, info, t}
    hotspots: []  // {id, name, el, isHotspot}
  };

  // utils
  const now = ()=> performance.now();
  function qs(id){ return document.getElementById(id); }
  function el(tag='div', cls=''){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }

  // DOM UI (simple)
  function buildUI(){
    // toolbar
    const toolbar = el('div','gd-toolbar');
    toolbar.style.position='fixed'; toolbar.style.left='12px'; toolbar.style.top='12px'; toolbar.style.zIndex=1000;
    const btnUV = el('button','gd-btn'); btnUV.textContent='UV'; btnUV.onclick = ()=> setTool('uv');
    const btnSwab = el('button','gd-btn'); btnSwab.textContent='Swab'; btnSwab.onclick = ()=> setTool('swab');
    const btnCam = el('button','gd-btn'); btnCam.textContent='Camera'; btnCam.onclick = ()=> setTool('cam');
    const btnSubmit = el('button','gd-btn'); btnSubmit.textContent='ส่งรายงาน'; btnSubmit.onclick = submitReport;
    [btnUV,btnSwab,btnCam,btnSubmit].forEach(b=>{ b.style.marginRight='6px'; toolbar.appendChild(b); });

    // timer
    const timer = el('div','gd-timer'); timer.id='gdTimer'; timer.style.marginTop='8px';
    toolbar.appendChild(timer);

    // evidence panel
    const panel = el('div','gd-evidence'); panel.id='gdEvidence';
    panel.style.position='fixed'; panel.style.right='12px'; panel.style.top='12px'; panel.style.width='260px'; panel.style.maxHeight='60vh'; panel.style.overflow='auto';
    const h = el('h4'); h.textContent='หลักฐาน'; panel.appendChild(h);
    const list = el('div'); list.id='gdEvidenceList'; panel.appendChild(list);

    document.body.appendChild(toolbar);
    document.body.appendChild(panel);
  }

  function setTool(t){
    STATE.tool = t;
    // dispatch event for UI update (plate.safe can listen)
    window.dispatchEvent(new CustomEvent('gd:toolchange', { detail:{ tool:t } }));
    // also log to plate.safe if available
    if(window.PlateSafe && typeof window.PlateSafe.logEvent === 'function'){
      window.PlateSafe.logEvent('tool_change', { tool: t });
    } else {
      window.dispatchEvent(new CustomEvent('hha:event', { detail: { name:'tool_change', payload:{ tool:t } } }));
    }
  }

  function addEvidence(rec){
    rec.t = new Date().toISOString();
    STATE.evidence.push(rec);
    const list = qs('gdEvidenceList');
    if(list){
      const c = el('div','gd-card');
      c.style.padding='8px'; c.style.marginBottom='6px'; c.style.background='rgba(255,255,255,0.03)';
      c.textContent = `${rec.type.toUpperCase()} • ${rec.target} • ${rec.info || ''}`;
      list.appendChild(c);
    }
    // emit local event for plate.safe
    if(window.PlateSafe && typeof window.PlateSafe.logEvent === 'function'){
      window.PlateSafe.logEvent('evidence_added', rec);
    } else {
      window.dispatchEvent(new CustomEvent('hha:event', { detail: { name:'evidence_added', payload:rec } }));
    }
  }

  async function submitReport(){
    // pick top evidence targets as report
    const targets = Array.from(new Set(STATE.evidence.map(e=>e.target))).slice(0,5);
    const payload = { targets, timeLeft: STATE.timeLeft, evidenceCount: STATE.evidence.length };
    // emit summary label
    if(window.PlateSafe && typeof window.PlateSafe.end === 'function'){
      window.PlateSafe.end('submitted');
      // PlateSafe may emit labels/hha:end itself
    } else {
      window.dispatchEvent(new CustomEvent('hha:labels', { detail: { type:'report_submitted', payload } }));
    }
    // also bridge to PlateLogger if present
    if(window.PlateLogger && typeof window.PlateLogger.logEvent === 'function'){
      window.PlateLogger.logEvent('report_submitted', payload);
    } else {
      window.postMessage && window.parent && window.parent.postMessage && window.parent.postMessage({ type:'plate:report', payload }, '*');
    }
    alert('ส่งรายงานแล้ว: ' + targets.join(', '));
  }

  // Hotspot creation (DOM placeholders for simple prototype)
  function createHotspots(){
    // create 3 example hotspots (divs in world plane overlay)
    const names = ['ฟองน้ำ','ลูกบิด','เขียง'];
    names.forEach((n,i)=>{
      const d = el('div','gd-spot'); d.textContent = n; d.dataset.name = n;
      d.style.position='absolute'; d.style.left = `${40 + i*160}px`; d.style.top = '220px';
      d.style.padding='12px'; d.style.borderRadius='8px'; d.style.background='rgba(255,255,255,0.04)'; d.style.cursor='pointer';
      d.onclick = ()=> onHotspotClick(n, d);
      document.body.appendChild(d);
      STATE.hotspots.push({ id:i, name:n, el:d, isHotspot:true });
    });
  }

  // interaction logic
  let gazeTimer = null;
  function onHotspotClick(name, el){
    const tool = STATE.tool;
    if(!tool){
      addEvidence({ type:'inspect', target:name, info:'ตรวจสอบ' });
      return;
    }
    if(tool === 'uv'){
      // reveal visual -> evidence
      el.style.boxShadow = '0 0 16px rgba(255,80,120,0.8)';
      setTimeout(()=> el.style.boxShadow = '', 1800);
      addEvidence({ type:'hotspot', target:name, info:'พบโดย UV' });
    } else if(tool === 'swab'){
      // simple swab minigame: progress + success
      el.style.opacity = '0.6';
      setTimeout(()=>{ el.style.opacity='1'; addEvidence({ type:'sample', target:name, info:'swab สำเร็จ' }); }, 1200);
    } else if(tool === 'cam'){
      // camera: fake snapshot, send small payload
      addEvidence({ type:'photo', target:name, info:'ถ่ายภาพ' });
      // optional: PlateLogger sendEvidence (data omitted)
      if(window.PlateLogger && typeof window.PlateLogger.sendEvidence === 'function'){
        window.PlateLogger.sendEvidence({ type:'photo', meta:{ target:name } });
      }
    }
  }

  // simple timer loop
  let _timer = null;
  function startTimer(){
    STATE.running = true;
    STATE.timeLeft = cfg.timeSec;
    updateTimerUI();
    _timer = setInterval(()=>{
      if(!STATE.running) return;
      STATE.timeLeft--;
      updateTimerUI();
      // emit features_1s tick for plate.safe if present
      if(window.PlateSafe && typeof window.PlateSafe.emitFeatures === 'function'){
        window.PlateSafe.emitFeatures();
      } else {
        // dispatch minimal feature event
        const feat = { game:'germ', timeLeft:STATE.timeLeft, evidenceCount:STATE.evidence.length };
        window.dispatchEvent(new CustomEvent('hha:features_1s', { detail: feat }));
      }
      if(STATE.timeLeft <= 0){
        clearInterval(_timer);
        STATE.running = false;
        // auto end
        if(window.PlateSafe && typeof window.PlateSafe.end === 'function'){
          window.PlateSafe.end('timeup');
        } else {
          window.dispatchEvent(new CustomEvent('hha:labels', { detail: { type:'end', reason:'timeup' } }));
        }
        alert('หมดเวลาแล้ว!');
      }
    }, 1000);
  }
  function updateTimerUI(){
    const el = qs('gdTimer');
    if(el) el.textContent = `เวลา: ${STATE.timeLeft}s`;
  }

  // public init
  function init(){
    buildUI();
    createHotspots();
    setTool('uv'); // default
    startTimer();

    // listen hub commands (postMessage) to set tool or pause
    window.addEventListener('message', ev=>{
      const m = ev.data;
      if(!m) return;
      if(m.type === 'command' && m.action === 'setTool' && m.value) setTool(m.value);
      if(m.type === 'command' && m.action === 'pause') STATE.running = false;
      if(m.type === 'command' && m.action === 'resume') STATE.running = true;
    }, false);

    // simple keyboard shortcuts for desktop testing
    window.addEventListener('keydown', e=>{
      if(e.key === '1') setTool('uv');
      if(e.key === '2') setTool('swab');
      if(e.key === '3') setTool('cam');
    }, false);
  }

  // expose simple API
  return {
    init,
    getState: ()=> STATE,
    addEvidence,
    setTool,
    stop: ()=> { STATE.running = false; clearInterval(_timer); }
  };
}
