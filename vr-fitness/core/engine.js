window.APP=(function(){
  let CFG=null; let LANG='en';
  async function loadConfig(){const res=await fetch('../../core/config.json').catch(()=>fetch('core/config.json'));
    CFG=await res.json(); LANG=localStorage.getItem('lang')||CFG.defaultLang||'en'; if(!I18N[LANG]) LANG='en'; AudioBus.load(CFG); return CFG;}
  function t(key){return (I18N[LANG]&&I18N[LANG][key])||key;}
  function setLang(l){LANG=l; localStorage.setItem('lang',l); refreshTexts();}
  function refreshTexts(){document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.getAttribute('data-i18n'); el.textContent=t(k);});}
  function routeToGame(id){const url=`games/${id}/index.html?mode=timed&diff=normal`; window.location.href=url;}
  function badge(txt){const el=document.createElement('div'); el.textContent=txt; el.style.position='fixed'; el.style.right='14px'; el.style.bottom='14px';
    el.style.padding='8px 10px'; el.style.border='1px solid #1a2532'; el.style.background='#0c131d'; el.style.borderRadius='10px';
    el.style.font='12px/1.2 ui-monospace, monospace'; el.style.color='#8aa2b2'; el.style.opacity='0.95'; document.body.appendChild(el); setTimeout(()=>el.remove(),1800);}
  return {loadConfig,t,setLang,refreshTexts,routeToGame,badge,get CFG(){return CFG;},get LANG(){return LANG;}};})();