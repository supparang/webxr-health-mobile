// === /herohealth/vr/goodjunk-model.js ===
// Exported ML model stub (replace with real exported model later)
// Must define: window.HHA_GOODJUNK_MODEL.predict(features) -> {hazardRisk, next5?}
// FULL v20260301-MODEL-STUB
(function(){
  const WIN = (typeof window !== 'undefined') ? window : globalThis;

  WIN.HHA_GOODJUNK_MODEL = {
    ver: 'stub-0',
    predict: function(features){
      // fallback to simple linear-ish risk
      const f = features || {};
      const miss = (Number(f.missGoodExpired||0) + Number(f.missJunkHit||0));
      const shield = Number(f.shield||0);
      let r = 0.18 + Math.min(0.55, miss/12);
      if(shield<=0) r += 0.16;
      r = Math.max(0, Math.min(0.98, r));
      return { hazardRisk: r, next5: ['model-stub', 'หาโล่', 'โฟกัส GOOD', 'เลี่ยง JUNK', 'คุมจังหวะ'] };
    }
  };
})();
