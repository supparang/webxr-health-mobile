'use strict';

export const AiCoach = {
  toast(text) {
    if (!text) return;
    try{
      // Reuse FX layer text
      const x = window.innerWidth * 0.5;
      const y = window.innerHeight * 0.72;
      import('./fx-burst.js').then(({FxBurst})=>{
        FxBurst.popText(x, y, text, 'sb-fx-tip');
      }).catch(()=>{});
    }catch(_){}
  },

  quickTip(s = {}) {
    const miss = Number(s.miss) || 0;
    const combo = Number(s.combo) || 0;
    const hp = Number(s.youHp) || 100;

    if (hp < 35) return 'ระวัง HP! เก็บ Heal/Shield แล้วค่อยลุยต่อ';
    if (miss >= 10) return 'พลาดเยอะ—ลองช้าลง แล้วเล็งก่อนแตะ';
    if (combo >= 10) return 'คอมโบสวย! ลองเร่งจังหวะขึ้นอีกนิดได้';
    return 'โฟกัสเป้าหลัก แล้วหลบ Bomb/Decoy ให้ไว';
  }
};