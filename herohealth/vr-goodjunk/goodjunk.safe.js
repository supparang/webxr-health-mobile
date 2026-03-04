*** a/herohealth/vr-goodjunk/goodjunk.safe.js
--- b/herohealth/vr-goodjunk/goodjunk.safe.js
@@
 export function boot(cfg){
   cfg = cfg || {};
   const WIN = window, DOC = document;
   const AI = cfg.ai || null;
@@
   const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
   const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
   const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
   const nowIso = ()=> new Date().toISOString();
   function $(id){ return DOC.getElementById(id); }
+
+  // ---------- RESET / EXPORT / COPY helpers (Classroom-safe) ----------
+  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
+  function dlText(filename, text){
+    try{
+      const blob = new Blob([String(text||'')], { type:'application/json;charset=utf-8' });
+      const a = DOC.createElement('a');
+      a.href = URL.createObjectURL(blob);
+      a.download = filename;
+      DOC.body.appendChild(a);
+      a.click();
+      setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(e){} }, 300);
+    }catch(e){}
+  }
+  async function copyText(text){
+    try{
+      if(navigator.clipboard && navigator.clipboard.writeText){
+        await navigator.clipboard.writeText(String(text||''));
+        return true;
+      }
+    }catch(e){}
+    try{
+      const ta = DOC.createElement('textarea');
+      ta.value = String(text||'');
+      ta.style.position='fixed';
+      ta.style.opacity='0';
+      DOC.body.appendChild(ta);
+      ta.focus(); ta.select();
+      const ok = DOC.execCommand('copy');
+      ta.remove();
+      return !!ok;
+    }catch(e){}
+    return false;
+  }
+  function randomSeed(){
+    try{ return String((Math.random()*1e9)>>>0); }catch(e){ return String(Date.now()); }
+  }
 
@@
   // hub / pid / cat / gameKey (used for cooldown button)
   const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
   const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
   const HH_CAT = 'nutrition';
   const HH_GAME = 'goodjunk';
+
+  // ---------- Classroom flags ----------
+  const teacherOn = String(qs('teacher','0')) === '1';
+  const studentOn = String(qs('student','0')) === '1';
+  const lockOn = String(qs('lock','0')) === '1';
+  const qrOn = String(qs('qr','0')) === '1';
+  const offlineQrOn = String(qs('offlineqr','1')) !== '0'; // default ON
+  const shareMode = String(qs('share', teacherOn ? 'student' : 'self')).toLowerCase(); // self | student
+  const embedCodeOn = String(qs('embedcode', teacherOn ? '1' : '0')) === '1';
 
   // init battle (optional)
   initBattleMaybe(pid, HH_GAME).catch(()=>{});
 
@@
   // ---------- FX layer ----------
   const fxLayer = DOC.createElement('div');
@@
   DOC.body.appendChild(fxLayer);
+
+  // =========================================================
+  // OFFLINE QR (dependency-free, canvas renderer)
+  // Byte mode + EC Low, version auto (1..10), mask 0 stable
+  // =========================================================
+  const _QR = (function(){
+    const GF_EXP = new Uint8Array(512);
+    const GF_LOG = new Uint8Array(256);
+    (function initGF(){
+      let x = 1;
+      for(let i=0;i<255;i++){
+        GF_EXP[i]=x; GF_LOG[x]=i;
+        x <<= 1;
+        if(x & 0x100) x ^= 0x11D;
+      }
+      for(let i=255;i<512;i++) GF_EXP[i]=GF_EXP[i-255];
+    })();
+    function gfMul(a,b){
+      if(a===0||b===0) return 0;
+      return GF_EXP[GF_LOG[a]+GF_LOG[b]];
+    }
+    function rsGenPoly(deg){
+      let poly=[1];
+      for(let i=0;i<deg;i++){
+        const next=[1, GF_EXP[i]];
+        const out=new Array(poly.length+1).fill(0);
+        for(let j=0;j<poly.length;j++){
+          out[j] ^= gfMul(poly[j], next[0]);
+          out[j+1] ^= gfMul(poly[j], next[1]);
+        }
+        poly=out;
+      }
+      return poly;
+    }
+    function rsRemainder(data, deg){
+      const gen=rsGenPoly(deg);
+      const res=new Array(deg).fill(0);
+      for(const b of data){
+        const factor=b ^ res[0];
+        res.shift(); res.push(0);
+        for(let i=0;i<deg;i++) res[i] ^= gfMul(gen[i+1], factor);
+      }
+      return res;
+    }
+    // EC Low tables (sufficient for classroom links; v1..10)
+    const CAP_L=[0,17,32,53,78,106,134,154,192,230,271];
+    const TOT_CW=[0,26,44,70,100,134,172,196,242,292,346];
+    const EC_CW_L=[0,7,10,15,20,26,18,20,24,30,18];
+
+    function toUtf8Bytes(str){
+      str=String(str||'');
+      try{ return Array.from(new TextEncoder().encode(str)); }
+      catch(e){
+        // very old fallback
+        const out=[];
+        for(let i=0;i<str.length;i++) out.push(str.charCodeAt(i)&255);
+        return out;
+      }
+    }
+    function pickVersion(n){
+      for(let v=1; v<=10; v++){
+        if(n <= CAP_L[v]) return v;
+      }
+      return 10;
+    }
+    function makeBits(bytes){
+      const bits=[];
+      const pushBits=(val,len)=>{ for(let i=len-1;i>=0;i--) bits.push((val>>>i)&1); };
+      pushBits(0b0100,4); // byte mode
+      const ver = pickVersion(bytes.length);
+      pushBits(bytes.length, ver<=9 ? 8 : 16);
+      for(const b of bytes) pushBits(b,8);
+      const totalBits = TOT_CW[ver]*8;
+      const rem = totalBits - bits.length;
+      const term = Math.min(4, Math.max(0, rem));
+      for(let i=0;i<term;i++) bits.push(0);
+      while(bits.length%8) bits.push(0);
+      const out=[];
+      for(let i=0;i<bits.length;i+=8){
+        let v=0;
+        for(let j=0;j<8;j++) v=(v<<1)|bits[i+j];
+        out.push(v);
+      }
+      while(out.length < TOT_CW[ver]-EC_CW_L[ver]){
+        out.push((out.length%2)?0x11:0xEC);
+      }
+      return { ver, dataCw: out };
+    }
+    function makeMatrix(ver){
+      const size=17+ver*4;
+      const m=Array.from({length:size}, ()=>Array(size).fill(null));
+      const set=(x,y,val)=>{ if(x>=0&&y>=0&&x<size&&y<size) m[y][x]=val; };
+      const drawFinder=(ox,oy)=>{
+        for(let y=-1;y<=7;y++){
+          for(let x=-1;x<=7;x++){
+            const xx=ox+x, yy=oy+y;
+            const on=(x>=0&&x<=6&&y>=0&&y<=6)&&(
+              (x===0||x===6||y===0||y===6)||(x>=2&&x<=4&&y>=2&&y<=4)
+            );
+            set(xx,yy,on?1:0);
+          }
+        }
+      };
+      drawFinder(0,0);
+      drawFinder(size-7,0);
+      drawFinder(0,size-7);
+      for(let i=8;i<size-8;i++){
+        set(i,6,(i%2)?0:1);
+        set(6,i,(i%2)?0:1);
+      }
+      set(8,size-8,1); // dark module
+      // reserve format areas
+      for(let i=0;i<9;i++){
+        if(i!==6){ set(8,i,0); set(i,8,0); }
+      }
+      for(let i=0;i<8;i++){
+        set(size-1-i,8,0);
+        set(8,size-1-i,0);
+      }
+      set(8,8,0);
+      return m;
+    }
+    function placeData(m,bits){
+      const size=m.length;
+      let dir=-1;
+      let x=size-1;
+      let y=size-1;
+      const isEmpty=(xx,yy)=> m[yy][xx]===null;
+      while(x>0){
+        if(x===6) x--;
+        for(let i=0;i<size;i++){
+          const yy=y+dir*i;
+          for(let dx=0;dx<2;dx++){
+            const xx=x-dx;
+            if(isEmpty(xx,yy)){
+              const bit=bits.length?bits.shift():0;
+              m[yy][xx]=bit;
+            }
+          }
+        }
+        y=y+dir*(size-1);
+        dir=-dir;
+        x-=2;
+      }
+    }
+    function maskBit(x,y){ return (((x+y)&1)===0); } // mask 0
+    function applyMask(m){
+      const size=m.length;
+      for(let y=0;y<size;y++){
+        for(let x=0;x<size;x++){
+          const inFinder=(x<9&&y<9)||(x>=size-8&&y<9)||(x<9&&y>=size-8);
+          const inTiming=(x===6&&y>=8&&y<=size-9)||(y===6&&x>=8&&x<=size-9);
+          const inFormat=(x===8&&y<9)||(y===8&&x<9)||(x===8&&y>=size-8)||(y===8&&x>=size-8);
+          const isDark=inFinder||inTiming||inFormat||(x===8&&y===size-8);
+          if(isDark) continue;
+          if(maskBit(x,y)) m[y][x]^=1;
+        }
+      }
+    }
+    function writeFormat(m){
+      // precomputed for EC Low + mask 0
+      const bits = 0b111011111000100;
+      const size=m.length;
+      const getBit=(i)=> (bits>>>i)&1;
+      for(let i=0;i<=5;i++) m[i][8]=getBit(14-i);
+      m[7][8]=getBit(8);
+      m[8][8]=getBit(7);
+      m[8][7]=getBit(6);
+      for(let i=9;i<=14;i++) m[8][14-i]=getBit(i-9);
+      for(let i=0;i<8;i++) m[8][size-1-i]=getBit(7-i);
+      for(let i=0;i<7;i++) m[size-1-i][8]=getBit(14-i);
+    }
+    function build(text){
+      const bytes=toUtf8Bytes(text);
+      const { ver, dataCw } = makeBits(bytes);
+      const ec=rsRemainder(dataCw, EC_CW_L[ver]);
+      const all=dataCw.concat(ec);
+      const bits=[];
+      for(const cw of all) for(let i=7;i>=0;i--) bits.push((cw>>>i)&1);
+      const m=makeMatrix(ver);
+      placeData(m,bits);
+      applyMask(m);
+      writeFormat(m);
+      return m;
+    }
+    function drawToCanvas(text, canvas, scale=6){
+      const m=build(text);
+      const size=m.length;
+      const quiet=4;
+      const dim=(size+quiet*2)*scale;
+      canvas.width=dim; canvas.height=dim;
+      const ctx=canvas.getContext('2d');
+      ctx.fillStyle='#fff';
+      ctx.fillRect(0,0,dim,dim);
+      ctx.fillStyle='#000';
+      for(let y=0;y<size;y++){
+        for(let x=0;x<size;x++){
+          if(m[y][x]===1){
+            ctx.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);
+          }
+        }
+      }
+    }
+    return { drawToCanvas };
+  })();
 
@@
   // ---------- Coach (micro tips) ----------
   const coach = DOC.createElement('div');
@@
   DOC.body.appendChild(coach);
@@
   function sayCoach(msg){
@@
   }
+
+  // ---------- BADGES (local) ----------
+  const badgesKey = `HHA_GJ_BADGES:${pid}`;
+  const hardWinKey = `HHA_GJ_HARDWIN_STREAK:${pid}`;
+  function loadBadges(){ try{ return JSON.parse(localStorage.getItem(badgesKey)||'{}')||{}; }catch(e){ return {}; } }
+  function saveBadges(b){ try{ localStorage.setItem(badgesKey, JSON.stringify(b||{})); }catch(e){} }
+  function incBadge(b,k){ b[k]=(Number(b[k])||0)+1; }
+  function getHardWinStreak(){ try{ return Number(localStorage.getItem(hardWinKey)||'0')||0; }catch(e){ return 0; } }
+  function setHardWinStreak(v){ try{ localStorage.setItem(hardWinKey, String(v|0)); }catch(e){} }
+
+  // ---------- PROGRESS HISTORY (last 5) ----------
+  const histKey = `HHA_GJ_HISTORY:${pid}`;
+  function loadHist(){ try{ const a=JSON.parse(localStorage.getItem(histKey)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
+  function saveHist(a){ try{ localStorage.setItem(histKey, JSON.stringify(a||[])); }catch(e){} }
+  function pushHist(summary){
+    const a=loadHist();
+    a.push({ ts:Date.now(), diff:summary.diff, seed:summary.seed, score:summary.scoreFinal|0, acc:summary.accPct|0, med:summary.medianRtGoodMs|0 });
+    while(a.length>5) a.shift();
+    saveHist(a);
+    return a;
+  }
+
+  // ---------- reset + export bundle ----------
+  function resetProgressForPid(){
+    try{
+      lsDel(`HHA_GJ_BADGES:${pid}`);
+      lsDel(`HHA_GJ_HISTORY:${pid}`);
+      lsDel(`HHA_GJ_HARDWIN_STREAK:${pid}`);
+      lsDel(`HHA_GJ_GHOST_STREAK:${pid}:${seedStr}:${plannedSec}`);
+    }catch(e){}
+  }
+  function exportJsonBundle(summary){
+    try{
+      const b=loadBadges();
+      const h=loadHist();
+      const gk=`HHA_GHOST_GJ:${pid}:${diff}:${plannedSec}:${seedStr}`;
+      let ghost=null;
+      try{ ghost=JSON.parse(localStorage.getItem(gk)||'null'); }catch(_){ ghost=null; }
+      const bundle={
+        projectTag:'HeroHealth',
+        gameKey:'goodjunk',
+        pid,
+        exportedAt:new Date().toISOString(),
+        params:{ diff, view, plannedSec, seed:seedStr, runMode },
+        lastSummary: summary||null,
+        badges:b,
+        historyLast5:h,
+        ghostForThisSeed:ghost
+      };
+      const fname=`goodjunk_${pid}_${diff}_seed${seedStr}_${Date.now()}.json`;
+      dlText(fname, JSON.stringify(bundle,null,2));
+    }catch(e){}
+  }
+
+  // ---------- lock helper ----------
+  function disableEl(el){
+    if(!el) return;
+    try{
+      el.disabled=true;
+      el.setAttribute('aria-disabled','true');
+      el.style.opacity='0.55';
+      el.style.pointerEvents='none';
+      el.style.filter='grayscale(0.2)';
+    }catch(e){}
+  }
+
+  // =========================================================
+  // Assignment Code (6 chars) + Teacher/Student panels
+  // =========================================================
+  const CODE_ALPH='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
+  const CODE_BASE=CODE_ALPH.length; // 32
+  function toBase32(n){
+    n=(Number(n)>>>0);
+    let out='';
+    for(let i=0;i<6;i++){
+      out = CODE_ALPH[n % CODE_BASE] + out;
+      n = Math.floor(n / CODE_BASE);
+    }
+    return out;
+  }
+  function fromBase32(s){
+    s=String(s||'').trim().toUpperCase();
+    if(s.length!==6) return null;
+    let n=0;
+    for(let i=0;i<6;i++){
+      const ix=CODE_ALPH.indexOf(s[i]);
+      if(ix<0) return null;
+      n = n*CODE_BASE + ix;
+    }
+    return n>>>0;
+  }
+  const TIME_TABLE=[30,40,50,60,70,80,90,100,110,120,150,180,200,240,300];
+  function timeToIdx(t){
+    t=clamp(t,20,300)|0;
+    let best=0, bd=1e9;
+    for(let i=0;i<TIME_TABLE.length;i++){
+      const d=Math.abs(TIME_TABLE[i]-t);
+      if(d<bd){ bd=d; best=i; }
+    }
+    return best&15;
+  }
+  function idxToTime(i){
+    i=clamp(i,0,TIME_TABLE.length-1)|0;
+    return TIME_TABLE[i];
+  }
+  function diffToBits(d){
+    d=String(d||'normal').toLowerCase();
+    if(d==='easy') return 0;
+    if(d==='normal') return 1;
+    return 2;
+  }
+  function bitsToDiff(b){
+    b=b|0;
+    if(b===0) return 'easy';
+    if(b===1) return 'normal';
+    return 'hard';
+  }
+  function crc3(x){
+    x=(x>>>0);
+    x ^= (x>>>11);
+    x ^= (x>>>7);
+    return (x ^ (x>>>3)) & 7;
+  }
+  function makeAssignCode(seed, t, d){
+    let s20 = (Number(seed)>>>0) & ((1<<20)-1);
+    const ti = timeToIdx(t) & 15;  // 4 bits
+    const db = diffToBits(d) & 3;  // 2 bits
+    let pack = (s20) | (ti<<20) | (db<<24); // 26 bits
+    const c = crc3(pack);
+    pack = pack | (c<<26); // 29 bits
+    return toBase32(pack);
+  }
+  function decodeAssignCode(code){
+    const n=fromBase32(code);
+    if(n==null) return null;
+    const pack=n>>>0;
+    const c=(pack>>>26)&7;
+    const core=pack & ((1<<26)-1);
+    if(crc3(core)!==c) return null;
+    const s20=core & ((1<<20)-1);
+    const ti=(core>>>20)&15;
+    const db=(core>>>24)&3;
+    return { seed:String(s20>>>0), time:idxToTime(ti), diff:bitsToDiff(db) };
+  }
+
+  // ---------- Teacher share url builder ----------
+  function setQS(u,k,v){
+    if(v==null || v==='') u.searchParams.delete(k);
+    else u.searchParams.set(k, String(v));
+  }
+  function buildUrlFromPanel(v){
+    const u=new URL(location.href);
+    setQS(u,'pid', v.pid);
+    setQS(u,'diff', v.diff);
+    setQS(u,'time', v.time);
+    setQS(u,'view', v.view);
+    setQS(u,'seed', v.seed);
+    // keep passthrough goodies
+    ['run','ghost','practice','dl','sfx','autolv','battle','room','autostart','forfeit','ai'].forEach(k=>{
+      const cur=(new URL(location.href)).searchParams.get(k);
+      if(cur!=null && cur!=='') u.searchParams.set(k, cur);
+    });
+    // keep hub/policy if present
+    ['hub','cdnext','zone','grade','log','studyId','phase','conditionGroup'].forEach(k=>{
+      const cur=(new URL(location.href)).searchParams.get(k);
+      if(cur!=null && cur!=='') u.searchParams.set(k, cur);
+    });
+    return u.toString();
+  }
+
+  function getShareUrl(tpRefs){
+    // tpRefs optional: {tpPid,tpDiff,tpTime,tpView,tpSeed,tpCode}
+    let url=null;
+    try{
+      if(tpRefs && tpRefs.tpSeed && tpRefs.tpSeed.value){
+        let seed = tpRefs.tpSeed.value || seedStr;
+        let t = Number(tpRefs.tpTime?.value)||plannedSec;
+        let d = tpRefs.tpDiff?.value || diff || 'normal';
+        let v = tpRefs.tpView?.value || view || 'mobile';
+        let p = tpRefs.tpPid?.value || pid || 'anon';
+
+        const code = String(tpRefs.tpCode?.value||'').trim().toUpperCase();
+        const dec = code ? decodeAssignCode(code) : null;
+        if(dec){ seed=dec.seed; t=dec.time; d=dec.diff; }
+
+        url = buildUrlFromPanel({ pid:p, diff:d, time:t, view:v, seed });
+      }
+    }catch(e){ url=null; }
+    if(!url){
+      const u=new URL(location.href);
+      if(!u.searchParams.get('seed')) u.searchParams.set('seed', seedStr);
+      url=u.toString();
+    }
+    const u2=new URL(url);
+    if(shareMode==='student'){
+      u2.searchParams.delete('teacher');
+      u2.searchParams.set('student','1');
+      u2.searchParams.set('lock','1');
+      u2.searchParams.delete('share');
+      if(embedCodeOn){
+        try{
+          let code = String(u2.searchParams.get('code')||'').trim().toUpperCase();
+          if(!code){
+            // prefer panel code if exists
+            if(tpRefs && tpRefs.tpCode) code = String(tpRefs.tpCode.value||'').trim().toUpperCase();
+          }
+          if(!code || !decodeAssignCode(code)){
+            const seed=u2.searchParams.get('seed')||seedStr;
+            const t=Number(u2.searchParams.get('time')||plannedSec);
+            const d=String(u2.searchParams.get('diff')||diff);
+            code = makeAssignCode(seed,t,d);
+          }
+          u2.searchParams.set('code', code);
+        }catch(e){}
+      }
+    }
+    return u2.toString();
+  }
+
+  // ---------- Lock banner overlay ----------
+  (function(){
+    const lockBanner=DOC.createElement('div');
+    lockBanner.style.position='fixed';
+    lockBanner.style.left='10px';
+    lockBanner.style.right='10px';
+    lockBanner.style.top=`calc(env(safe-area-inset-top, 0px) + 10px)`;
+    lockBanner.style.zIndex='99998';
+    lockBanner.style.display=lockOn ? 'flex' : 'none';
+    lockBanner.style.justifyContent='center';
+    lockBanner.style.pointerEvents='none';
+    lockBanner.innerHTML=`
+      <div style="
+        max-width:920px; width:100%;
+        border-radius:18px;
+        border:1px solid rgba(239,68,68,.26);
+        background:rgba(127,29,29,.18);
+        color:rgba(254,242,242,.96);
+        box-shadow:0 20px 70px rgba(0,0,0,.45);
+        backdrop-filter: blur(10px);
+        -webkit-backdrop-filter: blur(10px);
+        padding:10px 12px;
+        font: 1100 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
+        text-align:center;">
+        🔒 LOCKED MODE — ค่า diff/time/seed ถูกล็อกเพื่อใช้ในห้องเรียน
+      </div>`;
+    DOC.body.appendChild(lockBanner);
+  })();
+
+  // ---------- Teacher Panel (optional) ----------
+  let tp=null, tpPid=null, tpDiff=null, tpTime=null, tpView=null, tpSeed=null, tpCode=null, tpHint=null;
+  if(teacherOn){
+    tp = DOC.createElement('div');
+    tp.style.position='fixed';
+    tp.style.left='10px';
+    tp.style.right='10px';
+    tp.style.bottom=`calc(env(safe-area-inset-bottom, 0px) + 10px)`;
+    tp.style.zIndex='99999';
+    tp.style.display='block';
+    tp.style.pointerEvents='auto';
+    tp.innerHTML = `
+      <div style="
+        max-width:980px; margin:0 auto;
+        border-radius:20px;
+        border:1px solid rgba(148,163,184,.18);
+        background:rgba(2,6,23,.80);
+        box-shadow:0 22px 80px rgba(0,0,0,.55);
+        backdrop-filter: blur(10px);
+        -webkit-backdrop-filter: blur(10px);
+        padding:12px 12px 10px;
+        color:rgba(229,231,235,.96);
+        font: 1000 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
+        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
+          <div style="font-size:13px;">🧑‍🏫 Teacher Panel — GoodJunk</div>
+          <button id="tpHide" style="all:unset; cursor:pointer; padding:6px 8px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35);">ซ่อน</button>
+        </div>
+
+        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:8px; margin-top:10px;">
+          <label style="display:grid; gap:4px;">
+            <span style="opacity:.85;">pid</span>
+            <input id="tpPid" value="" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+          </label>
+          <label style="display:grid; gap:4px;">
+            <span style="opacity:.85;">diff</span>
+            <select id="tpDiff" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;">
+              <option value="easy">easy</option>
+              <option value="normal">normal</option>
+              <option value="hard">hard</option>
+            </select>
+          </label>
+          <label style="display:grid; gap:4px;">
+            <span style="opacity:.85;">time</span>
+            <input id="tpTime" type="number" min="20" max="300" value="80" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+          </label>
+          <label style="display:grid; gap:4px;">
+            <span style="opacity:.85;">view</span>
+            <select id="tpView" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;">
+              <option value="mobile">mobile</option>
+              <option value="cvr">cvr</option>
+              <option value="vr">vr</option>
+              <option value="pc">pc</option>
+            </select>
+          </label>
+          <label style="display:grid; gap:4px;">
+            <span style="opacity:.85;">seed</span>
+            <input id="tpSeed" value="" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+          </label>
+          <label style="display:grid; gap:4px;">
+            <span style="opacity:.85;">code</span>
+            <input id="tpCode" placeholder="เช่น 3FQ8K2" value="" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+          </label>
+        </div>
+
+        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
+          <button id="tpApply" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(59,130,246,.30); background:rgba(59,130,246,.14);">✅ Apply & Start</button>
+          <button id="tpCopy" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(148,163,184,.22); background:rgba(148,163,184,.10);">🔗 Copy Link (student)</button>
+          <button id="tpRand" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(234,179,8,.30); background:rgba(234,179,8,.14);">🎲 Random Seed</button>
+          <button id="tpMakeCode" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(34,197,94,.26); background:rgba(34,197,94,.10);">🧩 Make Code</button>
+        </div>
+
+        <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(148,163,184,.16);">
+          <div style="opacity:.9; margin-bottom:6px;">🧑‍🏫 Roster Mode</div>
+          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:8px;">
+            <label style="display:grid; gap:4px;">
+              <span style="opacity:.85;">prefix</span>
+              <input id="roPrefix" value="A" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+            </label>
+            <label style="display:grid; gap:4px;">
+              <span style="opacity:.85;">start</span>
+              <input id="roStart" type="number" value="1" min="1" max="999" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+            </label>
+            <label style="display:grid; gap:4px;">
+              <span style="opacity:.85;">end</span>
+              <input id="roEnd" type="number" value="45" min="1" max="999" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+            </label>
+            <label style="display:grid; gap:4px;">
+              <span style="opacity:.85;">pad</span>
+              <input id="roPad" type="number" value="2" min="1" max="4" style="width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1000; outline:none;" />
+            </label>
+          </div>
+          <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
+            <button id="roPrev" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(148,163,184,.20); background:rgba(148,163,184,.08);">⬅️ Prev</button>
+            <button id="roNext" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(59,130,246,.30); background:rgba(59,130,246,.14); font-weight:1200;">➡️ Next Student</button>
+            <button id="roCopy" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(34,197,94,.26); background:rgba(34,197,94,.10);">🔗 Copy Link (current)</button>
+            <button id="roReset" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(248,113,113,.26); background:rgba(248,113,113,.10);">🧹 Reset Roster</button>
+          </div>
+          <div id="roHint" style="margin-top:8px; text-align:center; opacity:.82;">—</div>
+        </div>
+
+        <div id="tpHint" style="margin-top:10px; text-align:center; opacity:.82;">
+          📤 โหมดส่งลิงก์: ${shareMode==='student' ? 'STUDENT (student=1 + lock=1 + code)' : 'SELF'}
+        </div>
+      </div>
+    `;
+    DOC.body.appendChild(tp);
+
+    tpPid = tp.querySelector('#tpPid');
+    tpDiff = tp.querySelector('#tpDiff');
+    tpTime = tp.querySelector('#tpTime');
+    tpView = tp.querySelector('#tpView');
+    tpSeed = tp.querySelector('#tpSeed');
+    tpCode = tp.querySelector('#tpCode');
+    tpHint = tp.querySelector('#tpHint');
+
+    function panelLoadFromQS(){
+      const sp = new URL(location.href).searchParams;
+      tpPid.value  = sp.get('pid')  || pid || 'anon';
+      tpDiff.value = sp.get('diff') || diff || 'normal';
+      tpTime.value = sp.get('time') || String(plannedSec|0);
+      tpView.value = sp.get('view') || view || 'mobile';
+      tpSeed.value = sp.get('seed') || seedStr || String(Date.now());
+      tpCode.value = sp.get('code') || tpCode.value || '';
+    }
+    panelLoadFromQS();
+
+    tp.querySelector('#tpHide').addEventListener('click', ()=>{
+      tp.style.display='none';
+      sayCoach('ซ่อน Teacher Panel แล้ว');
+    });
+
+    function applyFromCode(){
+      const c = String(tpCode.value||'').trim().toUpperCase();
+      if(!c){ tpHint.textContent='ใส่ code ก่อนนะ'; return null; }
+      const dec = decodeAssignCode(c);
+      if(!dec){
+        tpHint.textContent='❌ Code ไม่ถูกต้อง (ลองเช็คตัวอักษร)';
+        sayCoach('Code ไม่ถูกต้อง');
+        return null;
+      }
+      tpSeed.value = dec.seed;
+      tpTime.value = String(dec.time);
+      tpDiff.value = dec.diff;
+      tpHint.textContent = `✅ Code OK → diff=${dec.diff}, time=${dec.time}, seed=${dec.seed}`;
+      sayCoach('ตั้งค่าจาก Code แล้ว');
+      return dec;
+    }
+    tpCode.addEventListener('keydown', (e)=>{
+      if(e.key==='Enter'){ e.preventDefault(); applyFromCode(); }
+    });
+
+    tp.querySelector('#tpRand').addEventListener('click', ()=>{
+      tpSeed.value = randomSeed();
+      tpHint.textContent = `🎲 seed ใหม่: ${tpSeed.value}`;
+      sayCoach('สุ่ม seed ใหม่แล้ว');
+    });
+
+    tp.querySelector('#tpMakeCode').addEventListener('click', ()=>{
+      const seed = tpSeed.value || seedStr || String(Date.now());
+      const t = Number(tpTime.value)||plannedSec;
+      const d = tpDiff.value || diff || 'normal';
+      const code = makeAssignCode(seed, t, d);
+      tpCode.value = code;
+      tpHint.textContent = `🧩 Code: ${code} (ส่งให้เด็กได้เลย)`;
+      copyText(code).then(ok=>{ if(ok) sayCoach('คัดลอก Code แล้ว ✅'); });
+    });
+
+    tp.querySelector('#tpCopy').addEventListener('click', ()=>{
+      const url = getShareUrl({ tpPid,tpDiff,tpTime,tpView,tpSeed,tpCode });
+      copyText(url).then(ok=> sayCoach(ok ? 'คัดลอกลิงก์นักเรียนแล้ว ✅' : 'คัดลอกไม่สำเร็จ'));
+    });
+
+    tp.querySelector('#tpApply').addEventListener('click', ()=>{
+      const codeRaw = String(tpCode.value||'').trim();
+      if(codeRaw && !decodeAssignCode(codeRaw)){
+        tpHint.textContent='❌ Code ไม่ถูกต้อง (ลบ code หรือแก้ให้ถูก)';
+        sayCoach('Code ไม่ถูกต้อง');
+        return;
+      }
+      const url = buildUrlFromPanel({
+        pid: tpPid.value || pid,
+        diff: tpDiff.value || diff,
+        time: Number(tpTime.value)||plannedSec,
+        view: tpView.value || view,
+        seed: tpSeed.value || seedStr
+      });
+      sfx('replay');
+      location.href = url;
+    });
+
+    // ---------- Roster logic ----------
+    const roPrefix = tp.querySelector('#roPrefix');
+    const roStart  = tp.querySelector('#roStart');
+    const roEnd    = tp.querySelector('#roEnd');
+    const roPad    = tp.querySelector('#roPad');
+    const roHint   = tp.querySelector('#roHint');
+
+    function rosterKey(){
+      return `HHA_GJ_ROSTER:${tpSeed?.value || seedStr}:${tpDiff?.value || diff}:${tpTime?.value || plannedSec}`;
+    }
+    function roGet(){ try{ return Number(localStorage.getItem(rosterKey())||'0')||0; }catch(e){ return 0; } }
+    function roSet(v){ try{ localStorage.setItem(rosterKey(), String(v|0)); }catch(e){} }
+    function roFmt(idx){
+      const pfx = String(roPrefix?.value||'A').trim() || 'A';
+      const pad = clamp(Number(roPad?.value)||2, 1, 4)|0;
+      const n = String(idx).padStart(pad,'0');
+      return `${pfx}${n}`;
+    }
+    function roBounds(){
+      const s = clamp(Number(roStart?.value)||1, 1, 999)|0;
+      const e = clamp(Number(roEnd?.value)||s, s, 999)|0;
+      return { s, e };
+    }
+    function roSyncHint(){
+      const { s, e } = roBounds();
+      const cur = clamp(roGet()||s, s, e)|0;
+      roHint.textContent = `Current PID: ${roFmt(cur)}  (${cur}/${e})`;
+    }
+    function roSetPidTo(idx){
+      const { s, e } = roBounds();
+      idx = clamp(idx, s, e)|0;
+      roSet(idx);
+      tpPid.value = roFmt(idx);
+      roSyncHint();
+      try{ refreshQr(); }catch(e){}
+    }
+    (function roInit(){
+      const { s, e } = roBounds();
+      let cur = roGet();
+      if(cur < s || cur > e) cur = s;
+      roSetPidTo(cur);
+    })();
+    tp.querySelector('#roPrev').addEventListener('click', ()=>{
+      const { s }=roBounds();
+      const cur=roGet()||s;
+      roSetPidTo(cur-1);
+      sayCoach('ย้อนคนก่อนหน้า');
+    });
+    tp.querySelector('#roNext').addEventListener('click', ()=>{
+      const { s, e }=roBounds();
+      const cur=roGet()||s;
+      const nxt=(cur>=e)?s:(cur+1);
+      roSetPidTo(nxt);
+      // auto make code + copy student link
+      try{
+        const seed = tpSeed.value || seedStr;
+        const t = Number(tpTime.value)||plannedSec;
+        const d = tpDiff.value || diff || 'normal';
+        const code = makeAssignCode(seed, t, d);
+        tpCode.value = code;
+        const url = getShareUrl({ tpPid,tpDiff,tpTime,tpView,tpSeed,tpCode });
+        copyText(url);
+        sayCoach(`ถัดไป: ${tpPid.value} (คัดลอกลิงก์แล้ว)`);
+      }catch(e){ sayCoach(`ถัดไป: ${tpPid.value}`); }
+    });
+    tp.querySelector('#roCopy').addEventListener('click', ()=>{
+      const url = getShareUrl({ tpPid,tpDiff,tpTime,tpView,tpSeed,tpCode });
+      copyText(url).then(ok=> sayCoach(ok ? 'คัดลอกลิงก์นักเรียนแล้ว ✅' : 'คัดลอกไม่สำเร็จ'));
+    });
+    tp.querySelector('#roReset').addEventListener('click', ()=>{
+      try{ localStorage.removeItem(rosterKey()); }catch(e){}
+      const { s }=roBounds();
+      roSetPidTo(s);
+      sayCoach('รีเซ็ต roster แล้ว');
+    });
+    [roPrefix,roStart,roEnd,roPad].forEach(el=>{
+      el.addEventListener('change', ()=> roSyncHint());
+      el.addEventListener('input', ()=> roSyncHint());
+    });
+    roSyncHint();
+
+    if(lockOn){
+      // lock tuning fields, allow roster next/prev/copy
+      disableEl(tpDiff);
+      disableEl(tpTime);
+      disableEl(tpSeed);
+      disableEl(tpView);
+      disableEl(tp.querySelector('#tpRand'));
+      [roPrefix,roStart,roEnd,roPad].forEach(disableEl);
+      if(tpHint) tpHint.textContent='🔒 LOCKED: เปลี่ยน diff/time/seed/view ไม่ได้ (เพื่อความแฟร์ทั้งห้อง)';
+    }
+  }
+
+  // ---------- QR panel for teacher (offline canvas) ----------
+  let qrPanel=null;
+  function refreshQr(){ /* assigned below if panel exists */ }
+  if(teacherOn && qrOn){
+    qrPanel = DOC.createElement('div');
+    qrPanel.style.position='fixed';
+    qrPanel.style.right='10px';
+    qrPanel.style.top = `calc(env(safe-area-inset-top, 0px) + 62px)`;
+    qrPanel.style.zIndex='99997';
+    qrPanel.style.display='block';
+    qrPanel.style.pointerEvents='auto';
+    qrPanel.innerHTML = `
+      <div style="
+        width: 220px;
+        border-radius:18px;
+        border:1px solid rgba(148,163,184,.18);
+        background:rgba(2,6,23,.78);
+        box-shadow:0 20px 70px rgba(0,0,0,.45);
+        backdrop-filter: blur(10px);
+        -webkit-backdrop-filter: blur(10px);
+        padding:10px;
+        color:rgba(229,231,235,.96);
+        font: 1000 11px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
+        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
+          <div>📱 Classroom QR</div>
+          <button id="qrHide" style="all:unset; cursor:pointer; padding:5px 7px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35);">ซ่อน</button>
+        </div>
+        <div style="margin-top:8px; display:grid; place-items:center;">
+          <canvas id="qrCv" width="320" height="320"
+            style="width:200px; height:200px; border-radius:12px; border:1px solid rgba(148,163,184,.14); background:#fff;"></canvas>
+        </div>
+        <div style="margin-top:8px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
+          <button id="qrCopy" style="all:unset; cursor:pointer; padding:8px 10px; border-radius:14px; border:1px solid rgba(148,163,184,.22); background:rgba(148,163,184,.10);">🔗 Copy Link</button>
+          <button id="qrRefresh" style="all:unset; cursor:pointer; padding:8px 10px; border-radius:14px; border:1px solid rgba(234,179,8,.26); background:rgba(234,179,8,.10);">♻️ Refresh</button>
+        </div>
+        <div id="qrHint" style="margin-top:8px; text-align:center; opacity:.82;">
+          สแกนเพื่อเข้าเกมด้วยค่าตั้งเดียวกัน
+        </div>
+      </div>
+    `;
+    DOC.body.appendChild(qrPanel);
+
+    refreshQr = function(){
+      try{
+        const url = getShareUrl({ tpPid,tpDiff,tpTime,tpView,tpSeed,tpCode });
+        const cv = qrPanel.querySelector('#qrCv');
+        const hint = qrPanel.querySelector('#qrHint');
+        if(cv && offlineQrOn) _QR.drawToCanvas(url, cv, 6);
+        if(hint) hint.textContent = lockOn ? 'สแกนเข้า “LOCKED assignment”' : 'สแกนเข้าเกมด้วยค่าตั้งเดียวกัน';
+      }catch(e){}
+    };
+    refreshQr();
+    try{
+      qrPanel.querySelector('#qrHide').addEventListener('click', ()=>{
+        qrPanel.style.display='none';
+        sayCoach('ซ่อน QR แล้ว');
+      });
+      qrPanel.querySelector('#qrRefresh').addEventListener('click', ()=>{
+        refreshQr();
+        sayCoach('อัปเดต QR แล้ว');
+      });
+      qrPanel.querySelector('#qrCopy').addEventListener('click', ()=>{
+        const url = getShareUrl({ tpPid,tpDiff,tpTime,tpView,tpSeed,tpCode });
+        copyText(url).then(ok=> sayCoach(ok ? 'คัดลอกลิงก์นักเรียนแล้ว ✅' : 'คัดลอกไม่สำเร็จ'));
+      });
+    }catch(e){}
+  }
+
+  // ---------- Student mini panel ----------
+  let sp=null;
+  if(studentOn && !teacherOn){
+    sp = DOC.createElement('div');
+    sp.style.position='fixed';
+    sp.style.left='10px';
+    sp.style.right='10px';
+    sp.style.bottom=`calc(env(safe-area-inset-bottom, 0px) + 10px)`;
+    sp.style.zIndex='99996';
+    sp.style.display='block';
+    sp.style.pointerEvents='auto';
+    sp.innerHTML = `
+      <div style="
+        max-width:820px; margin:0 auto;
+        border-radius:20px;
+        border:1px solid rgba(148,163,184,.18);
+        background:rgba(2,6,23,.80);
+        box-shadow:0 22px 80px rgba(0,0,0,.55);
+        backdrop-filter: blur(10px);
+        -webkit-backdrop-filter: blur(10px);
+        padding:12px 12px 10px;
+        color:rgba(229,231,235,.96);
+        font: 1000 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
+        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
+          <div style="font-size:13px;">👩‍🎓 Student Panel — Assignment</div>
+          <button id="spHide" style="all:unset; cursor:pointer; padding:6px 8px; border-radius:12px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35);">ซ่อน</button>
+        </div>
+
+        <div id="spGrid" style="display:grid; grid-template-columns: 1fr 140px; gap:8px; margin-top:10px;">
+          <input id="spCode" placeholder="เช่น 3FQ8K2" style="width:100%; padding:10px 12px; border-radius:14px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.35); color:rgba(229,231,235,.95); font-weight:1100; outline:none; letter-spacing:.5px;" />
+          <button id="spApply" style="all:unset; cursor:pointer; display:grid; place-items:center; padding:10px 12px; border-radius:14px; border:1px solid rgba(59,130,246,.30); background:rgba(59,130,246,.14); font-weight:1200;">
+            ✅ Apply
+          </button>
+        </div>
+
+        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
+          <button id="spChange" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(148,163,184,.22); background:rgba(148,163,184,.08);">✍️ เปลี่ยนโค้ด</button>
+          <button id="spQr" style="all:unset; cursor:pointer; padding:10px 12px; border-radius:14px; border:1px solid rgba(34,197,94,.26); background:rgba(34,197,94,.10);">📱 Show QR</button>
+        </div>
+
+        <div id="spHint" style="margin-top:8px; text-align:center; opacity:.82;">
+          ถ้ามี code ฝังมาในลิงก์ จะตั้งค่าให้อัตโนมัติ
+        </div>
+
+        <div id="spQrBox" style="display:none; margin-top:10px; text-align:center;">
+          <canvas id="spQrCv" width="320" height="320"
+            style="width:220px; height:220px; border-radius:12px; border:1px solid rgba(148,163,184,.14); background:#fff;"></canvas>
+          <div style="margin-top:6px; opacity:.82;">สแกนแทนการพิมพ์ลิงก์ได้</div>
+        </div>
+      </div>
+    `;
+    DOC.body.appendChild(sp);
+
+    const spGrid = sp.querySelector('#spGrid');
+    const spCode = sp.querySelector('#spCode');
+    const spHint = sp.querySelector('#spHint');
+    const spQrBox = sp.querySelector('#spQrBox');
+    const spQrCv = sp.querySelector('#spQrCv');
+
+    function studentApplyCode(codeOverride){
+      const c = String(codeOverride || spCode.value || '').trim().toUpperCase();
+      if(!c){
+        spHint.textContent='ใส่ code ก่อนนะ';
+        sayCoach('ใส่ Code ก่อน');
+        return false;
+      }
+      const dec = decodeAssignCode(c);
+      if(!dec){
+        spHint.textContent='❌ Code ไม่ถูกต้อง (เช็คตัวอักษรอีกครั้ง)';
+        sayCoach('Code ไม่ถูกต้อง');
+        return false;
+      }
+      const u = new URL(location.href);
+      u.searchParams.set('seed', String(dec.seed));
+      u.searchParams.set('time', String(dec.time));
+      u.searchParams.set('diff', String(dec.diff));
+      u.searchParams.set('lock','1');
+      u.searchParams.set('student','1');
+      u.searchParams.delete('teacher');
+      sfx('replay');
+      location.href = u.toString();
+      return true;
+    }
+
+    function studentAutoApplyFromUrl(){
+      try{
+        const spx = new URL(location.href).searchParams;
+        const code = String(spx.get('code')||'').trim().toUpperCase();
+        if(!code) return false;
+        const dec = decodeAssignCode(code);
+        if(!dec) return false;
+
+        // if already applied, just hide input
+        const same =
+          (spx.get('seed')===String(dec.seed)) &&
+          (spx.get('time')===String(dec.time)) &&
+          (spx.get('diff')===String(dec.diff)) &&
+          (spx.get('lock')==='1');
+        if(same){
+          spCode.value = code;
+          spHint.textContent = `✅ พร้อมเล่นแล้ว (diff=${dec.diff}, time=${dec.time})`;
+          if(spGrid) spGrid.style.display='none';
+          sayCoach('พร้อมเล่นแล้ว ✅');
+          return true;
+        }
+
+        // apply now
+        spx.set('seed', String(dec.seed));
+        spx.set('time', String(dec.time));
+        spx.set('diff', String(dec.diff));
+        spx.set('lock','1');
+        spx.set('student','1');
+        spx.delete('teacher');
+        const u = new URL(location.href);
+        u.search = spx.toString();
+        sfx('replay');
+        location.href = u.toString();
+        return true;
+      }catch(e){}
+      return false;
+    }
+
+    sp.querySelector('#spHide').addEventListener('click', ()=>{
+      sp.style.display='none';
+      sayCoach('ซ่อน Student Panel แล้ว');
+    });
+    sp.querySelector('#spApply').addEventListener('click', ()=> studentApplyCode());
+    spCode.addEventListener('keydown', (e)=>{
+      if(e.key==='Enter'){ e.preventDefault(); studentApplyCode(); }
+    });
+    sp.querySelector('#spChange').addEventListener('click', ()=>{
+      if(spGrid) spGrid.style.display='grid';
+      sayCoach('ใส่โค้ดใหม่ได้เลย');
+    });
+    sp.querySelector('#spQr').addEventListener('click', ()=>{
+      try{
+        const url = new URL(location.href);
+        url.searchParams.set('student','1');
+        url.searchParams.set('lock','1');
+        url.searchParams.delete('teacher');
+        if(spQrCv && offlineQrOn) _QR.drawToCanvas(url.toString(), spQrCv, 6);
+        if(spQrBox) spQrBox.style.display = (spQrBox.style.display==='none') ? 'block' : 'none';
+      }catch(e){}
+    });
+    // auto apply if code embedded
+    studentAutoApplyFromUrl();
+  }
 
@@
   function showEnd(reason){
@@
     const summary = buildEndSummary(reason);
+
+    // ✅ save progress history (last 5)
+    let hist5 = null;
+    try{ hist5 = pushHist(summary); }catch(e){ hist5 = null; }
@@
     if(endOverlay){
@@
       try{
         hhInjectCooldownButton({ endOverlayEl: endOverlay, hub: hubUrl, cat: HH_CAT, gameKey: HH_GAME, pid });
       }catch(e){}
+
+      // ✅ badges on ghost win (if ghost exists)
+      try{
+        // if you have ghost summary already computed above, use it. Otherwise, no-op.
+        const winGhost = (typeof ghostDelta==='number') ? (ghostDelta>0) : false;
+        const b = loadBadges();
+        const d = String(diff||'normal').toLowerCase();
+        if(winGhost){
+          if(d==='easy') incBadge(b,'bronze');
+          else if(d==='normal') incBadge(b,'silver');
+          else incBadge(b,'gold');
+          if(d==='hard'){
+            const st = getHardWinStreak()+1;
+            setHardWinStreak(st);
+            if(st>=3){
+              incBadge(b,'legend');
+              setHardWinStreak(0);
+              sayCoach('👑 LEGEND! ชนะ Ghost ใน HARD 3 รอบติด!');
+            }
+          }else{
+            setHardWinStreak(0);
+          }
+        }else{
+          if(d==='hard') setHardWinStreak(0);
+        }
+        saveBadges(b);
+      }catch(e){}
+
+      // ✅ end actions: copy/export/reset (lock-aware)
+      try{
+        const panel = endOverlay.querySelector('.panel') || endOverlay;
+        let row = panel.querySelector('.hh-end-actions');
+        if(!row){
+          row = DOC.createElement('div');
+          row.className='hh-end-actions';
+          row.style.display='flex';
+          row.style.gap='10px';
+          row.style.flexWrap='wrap';
+          row.style.justifyContent='center';
+          row.style.marginTop='12px';
+          row.style.paddingTop='10px';
+          row.style.borderTop='1px solid rgba(148,163,184,.16)';
+          panel.appendChild(row);
+        }
+
+        if(!row.querySelector('[data-hh-copy="1"]')){
+          const c = DOC.createElement('button');
+          c.type='button';
+          c.dataset.hhCopy='1';
+          c.textContent='🧾 Copy Summary';
+          c.className='btn';
+          c.style.border='1px solid rgba(148,163,184,.24)';
+          c.style.background='rgba(148,163,184,.10)';
+          c.style.color='rgba(229,231,235,.96)';
+          c.style.borderRadius='14px';
+          c.style.padding='10px 12px';
+          c.style.fontWeight='1000';
+          c.style.cursor='pointer';
+          c.style.minHeight='42px';
+          c.addEventListener('click', async ()=>{
+            const txt =
+              `GoodJunk | pid=${pid} | diff=${diff} | seed=${seedStr}\n`+
+              `score=${summary.scoreFinal} | acc=${summary.accPct}% | miss=${summary.missTotal} | medRT=${summary.medianRtGoodMs}ms | grade=${summary.grade}\n`+
+              `tieBreak=${summary.tieBreakOrder}`;
+            const ok = await copyText(txt);
+            sayCoach(ok ? 'คัดลอกแล้ว ✅' : 'คัดลอกไม่สำเร็จ');
+          });
+          row.appendChild(c);
+        }
+
+        if(!row.querySelector('[data-hh-export="1"]')){
+          const ex = DOC.createElement('button');
+          ex.type='button';
+          ex.dataset.hhExport='1';
+          ex.textContent='📤 Export JSON';
+          ex.className='btn';
+          ex.style.border='1px solid rgba(34,197,94,.26)';
+          ex.style.background='rgba(34,197,94,.10)';
+          ex.style.color='rgba(229,231,235,.96)';
+          ex.style.borderRadius='14px';
+          ex.style.padding='10px 12px';
+          ex.style.fontWeight='1000';
+          ex.style.cursor='pointer';
+          ex.style.minHeight='42px';
+          ex.addEventListener('click', ()=>{
+            exportJsonBundle(summary);
+            sayCoach('ส่งออกไฟล์แล้ว 📤');
+          });
+          row.appendChild(ex);
+        }
+
+        if(!row.querySelector('[data-hh-reset="1"]')){
+          const rs = DOC.createElement('button');
+          rs.type='button';
+          rs.dataset.hhReset='1';
+          rs.textContent='🧹 Reset (PID นี้)';
+          rs.className='btn';
+          rs.style.border='1px solid rgba(248,113,113,.28)';
+          rs.style.background='rgba(248,113,113,.10)';
+          rs.style.color='rgba(229,231,235,.96)';
+          rs.style.borderRadius='14px';
+          rs.style.padding='10px 12px';
+          rs.style.fontWeight='1000';
+          rs.style.cursor='pointer';
+          rs.style.minHeight='42px';
+          rs.addEventListener('click', ()=>{
+            resetProgressForPid();
+            sayCoach('รีเซ็ตแล้ว ✅');
+            setTimeout(()=>{ try{ location.reload(); }catch(e){} }, 300);
+          });
+          if(lockOn) disableEl(rs);
+          row.appendChild(rs);
+        }
+
+        // ✅ progress chart (last 5 runs) — simple canvas sparkline
+        try{
+          let chartWrap = panel.querySelector('#hhProgChart');
+          if(!chartWrap){
+            chartWrap = DOC.createElement('div');
+            chartWrap.id='hhProgChart';
+            chartWrap.style.marginTop='10px';
+            chartWrap.style.paddingTop='10px';
+            chartWrap.style.borderTop='1px solid rgba(148,163,184,.16)';
+            chartWrap.style.textAlign='center';
+            panel.appendChild(chartWrap);
+          }
+          const H = (hist5 && hist5.length) ? hist5 : loadHist();
+          if(!H || H.length < 2){
+            chartWrap.innerHTML = `<div style="opacity:.8; font:1000 12px/1.4 system-ui;">📈 Progress: ยังไม่พอ (ต้องเล่นอย่างน้อย 2 รอบ)</div>`;
+          }else{
+            chartWrap.innerHTML = `
+              <div style="opacity:.9; font:1100 12px/1.4 system-ui; margin-bottom:6px;">📈 Progress (5 รอบล่าสุด)</div>
+              <canvas id="hhProgCanvas" width="720" height="170" style="width:min(720px,100%); height:auto; border-radius:14px; border:1px solid rgba(148,163,184,.16); background:rgba(15,23,42,.20);"></canvas>
+              <div id="hhProgTip" style="margin-top:6px; opacity:.85; font:1000 12px/1.4 system-ui;"></div>
+            `;
+            const cv = chartWrap.querySelector('#hhProgCanvas');
+            const tip = chartWrap.querySelector('#hhProgTip');
+            const ctx = cv.getContext('2d');
+            const pad = 14;
+            const w = cv.width, h = cv.height;
+            const scores = H.map(x=>x.score|0);
+            const accs   = H.map(x=>x.acc|0);
+            const meds   = H.map(x=>x.med|0);
+            const x = H.map((_,i)=> pad + (i*(w-2*pad))/Math.max(1,(H.length-1)));
+            function norm(arr, invert=false){
+              let mn = Math.min(...arr), mx = Math.max(...arr);
+              if(mx===mn) mx = mn+1;
+              return arr.map(v=>{
+                let p = (v-mn)/(mx-mn);
+                if(invert) p = 1-p;
+                return pad + (1-p)*(h-2*pad);
+              });
+            }
+            function line(xs, ys){
+              ctx.beginPath();
+              for(let i=0;i<xs.length;i++){
+                if(i===0) ctx.moveTo(xs[i], ys[i]);
+                else ctx.lineTo(xs[i], ys[i]);
+              }
+              ctx.stroke();
+            }
+            ctx.clearRect(0,0,w,h);
+            ctx.globalAlpha=0.55; ctx.lineWidth=1; ctx.strokeStyle='rgba(148,163,184,.35)';
+            for(let i=0;i<4;i++){
+              const yy=pad+i*(h-2*pad)/3;
+              ctx.beginPath(); ctx.moveTo(pad,yy); ctx.lineTo(w-pad,yy); ctx.stroke();
+            }
+            ctx.globalAlpha=1;
+            ctx.lineWidth=3; ctx.strokeStyle='rgba(229,231,235,.92)'; line(x, norm(scores,false));
+            ctx.lineWidth=2; ctx.strokeStyle='rgba(148,163,184,.92)'; line(x, norm(accs,false));
+            ctx.lineWidth=2; ctx.strokeStyle='rgba(94,234,212,.65)'; line(x, norm(meds,true));
+            const ds = scores[scores.length-1]-scores[0];
+            const da = accs[accs.length-1]-accs[0];
+            const dm = meds[0]-meds[meds.length-1];
+            const sTxt = ds>=0 ? `คะแนน +${ds}` : `คะแนน ${ds}`;
+            const aTxt = da>=0 ? `ความแม่น +${da}%` : `ความแม่น ${da}%`;
+            const mTxt = dm>=0 ? `รีแอคไวขึ้น ~${dm}ms` : `รีแอคช้าลง ~${-dm}ms`;
+            tip.textContent = `แนวโน้ม: ${sTxt} | ${aTxt} | ${mTxt}`;
+          }
+        }catch(e){}
+      }catch(e){}
     }
@@
   sayCoach('แตะ “ของดี” เลี่ยงของเสีย! 🥦🍎');
   setHUD();
   requestAnimationFrame(tick);
 }