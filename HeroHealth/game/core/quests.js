// === core/quests.js ===
// เควสต์ขั้นต่ำ: โชว์ชิป 1-2 อัน และนับ tick/hit เพื่ออัปเดตแถบ
let _hud = null;
let _coach = null;
let _chips = [];
let _goal = 20;

export const Quests = {
  bindToMain({ hud, coach }) {
    _hud = hud; _coach = coach;
    _chips = [
      { key:'hit',  icon:'⭐', label:'Hit Targets',  progress:0, need:_goal, done:false, fail:false },
      { key:'combo',icon:'🔥', label:'Combo Streak', progress:0, need:10,     done:false, fail:false },
    ];
    _hud?.setQuestChips(_chips);
    return { refresh(){ _hud?.setQuestChips(_chips); } };
  },

  beginRun(mode, diff, lang, timeSec) {
    // scale ตามโหมด/ระดับ
    _goal = Math.max(10, Math.round((timeSec||45) * (diff==='Hard'?0.7:diff==='Easy'?0.5:0.6)));
    if (_chips.length) _chips[0].need = _goal;
    if (_hud) _hud.setQuestChips(_chips);
  },

  event(type, payload={}) {
    if (type === 'hit') {
      _chips[0].progress = Math.min(_chips[0].need, (_chips[0].progress|0) + 1);
      const comboNow = payload.comboNow | 0;
      _chips[1].progress = Math.max(_chips[1].progress|0, comboNow);
      _chips[0].done = _chips[0].progress >= _chips[0].need;
      _chips[1].done = (_chips[1].progress|0) >= (_chips[1].need|0);
      _hud?.setQuestChips(_chips);
    }
  },

  tick() {
    // reserved for time-based quests
  },

  endRun({ score }) {
    // คืนผลสรุปเควสต์ (ถ้าต้องการ)
    return _chips.slice();
  }
};
