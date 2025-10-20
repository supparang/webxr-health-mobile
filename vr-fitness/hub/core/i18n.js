(function(){
const DICT = {
en:{ hub_title:'VR Fitness — Hub', hub_desc:'Choose a workout type, mode, and difficulty — then Start.', workout_title:'VR Fitness — Workout', ready:'Ready?', press_start:'Press Start to initialize audio & begin' },
th:{ hub_title:'VR ฟิตเนส — ฮับ', hub_desc:'เลือกประเภทการออกกำลังกาย โหมด และระดับความยาก จากนั้นกด Start', workout_title:'VR ฟิตเนส — เล่น', ready:'พร้อมไหม?', press_start:'กด Start เพื่อเริ่มและเปิดเสียง' }
};
window.APP = window.APP || {};
APP.i18n = { current:'en', t(k){const d=DICT[this.current]||DICT.en; return d[k]||k;}, set(lang){ this.current=(lang==='th'||lang==='en')?lang:'en'; document.dispatchEvent(new CustomEvent('i18n:change',{detail:{lang:this.current}})); } };
})();
