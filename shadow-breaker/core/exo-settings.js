// EXO Settings + i18n
window.EXO_SETTINGS = (function(){
  const KEY = 'EXO_SETTINGS_V1';
  const DEF = { music:true, sfx:true, lang:'th', api:{leaderboardUrl:'', apiKey:''} };

  function get(){ return EXO.store.get(KEY, DEF); }
  function set(p){ const v={...DEF, ...get(), ...p}; EXO.store.set(KEY, v); apply(v); return v; }

  // i18n — เพิ่มคีย์ได้เรื่อย ๆ
  const dict = {
    th:{ settings:'ตั้งค่า', music:'เพลงประกอบ', sfx:'เสียงเอฟเฟกต์', language:'ภาษา',
         thai:'ไทย', english:'อังกฤษ', save:'บันทึก', back:'กลับ', leaderboard:'ลีดเดอร์บอร์ด (ทางเลือก)',
         apiUrl:'Endpoint URL', apiKey:'API Key' },
    en:{ settings:'Settings', music:'Music', sfx:'SFX', language:'Language',
         thai:'Thai', english:'English', save:'Save', back:'Back', leaderboard:'Leaderboard (optional)',
         apiUrl:'Endpoint URL', apiKey:'API Key' },
  };
  function t(k){ const {lang}=get(); return (dict[lang]&&dict[lang][k])||k; }

  // apply -> sync กับ audio gains/ mute
  function apply(cfg){
    try{
      EXO.audio.ensure();
      if (EXO.audio.musicGain) EXO.audio.musicGain.gain.value = cfg.music ? 0.4 : 0.0;
      if (EXO.audio.sfxGain)   EXO.audio.sfxGain.gain.value   = cfg.sfx   ? 0.12 : 0.0;
    }catch(e){}
    document.documentElement.setAttribute('data-lang', cfg.lang);
  }

  // init ครั้งแรก
  apply(get());
  return { get, set, t };
})();
