// core/engine.js
window.APP=(function(){
  let CFG=null; let LANG='en';

  const DEFAULT_CFG = {
    projectName: "VR Fitness Academy",
    theme: "sport-tech",
    languages: ["en","th"],
    defaultLang: "en",
    games: [
      {id:"shadow-breaker", name:{en:"Shadow Breaker", th:"ชาโดว์เบรกเกอร์"}, desc:{en:"Slash or punch targets in time.", th:"ฟาด/ชกเป้าตามจังหวะ"}},
      {id:"rhythm-boxer",  name:{en:"Rhythm Boxer",    th:"ริทึมบ็อกเซอร์"}, desc:{en:"Box to the beat and rack up combos.", th:"ชกตามจังหวะ เก็บคอมโบ"}},
      {id:"jump-duck",     name:{en:"Jump & Duck",      th:"กระโดดและก้ม"}, desc:{en:"Move your body to dodge barriers.", th:"ขยับตัวหลบสิ่งกีดขวาง"}},
      {id:"balance-hold",  name:{en:"Balance Hold",     th:"ทรงตัวค้าง"},    desc:{en:"Hold steady poses for points.", th:"ทรงท่าค้าง รับคะแนน"}}
    ],
    audio: { bgm: "assets/sfx/bgm.wav", click: "assets/sfx/click.wav" }
  };

  async function tryFetch(url){
    try{ const r = await fetch(url); if(r.ok) return await r.json(); }catch(e){}
    return null;
  }

  async function loadConfig(){
    // ลองหลายพาธ เพื่อให้ทำงานได้ทั้งจาก hub และหน้าเกมย่อย
    const candidates = [
      'core/config.json',
      './core/config.json',
      '../core/config.json',
      '../../core/config.json'
    ];
    for(const u of candidates){
      const j = await tryFetch(u);
      if(j){ CFG=j; break; }
    }
    if(!CFG){ CFG = DEFAULT_CFG; console.warn('[APP] Using embedded DEFAULT_CFG'); }
    LANG = localStorage.getItem('lang') || CFG.defaultLang || 'en';
    if(!I18N[LANG]) LANG = 'en';
    AudioBus.load(CFG);
    return CFG;
  }

  function t(key){return (I18N[LANG]&&I18N[LANG][key])||key;}
  function setLang(l){LANG=l; localStorage.setItem('lang',l); refreshTexts();}
  function refreshTexts(){document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.getAttribute('data-i18n'); el.textContent=t(k);});}
  function routeToGame(id){window.location.href=`games/${id}/index.html?mode=timed&diff=normal`;}
  function badge(txt){
    const el=document.createElement('div'); el.textContent=txt;
    el.style.position='fixed'; el.style.right='14px'; el.style.bottom='14px';
    el.style.padding='8px 10px'; el.style.border='1px solid #1a2532';
    el.style.background='#0c131d'; el.style.borderRadius='10px';
    el.style.font='12px/1.2 ui-monospace, monospace'; el.style.color='#8aa2b2';
    el.style.opacity='0.95'; document.body.appendChild(el); setTimeout(()=>el.remove(),1800);
  }

  return {loadConfig,t,setLang,refreshTexts,routeToGame,badge,get CFG(){return CFG;},get LANG(){return LANG;}};})();
