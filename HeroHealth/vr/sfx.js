// === vr/sfx.js ===
export class SFX{
  _play(name, vol=1){
    try{ const a = new Audio(`./assets/audio/${name}`); a.volume=vol; a.play(); }catch(e){}
  }
  popGood(){ this._play('pop.mp3', 1); }
  popBad(){ this._play('boo.mp3', 0.8); }
  star(){ this._play('star.mp3', 0.9); }
  diamond(){ this._play('diamond.mp3', 1); }
  feverStart(){ this._play('fever_start.mp3', 1); this._play('fever_bgm.mp3', 0.6); }
  feverEnd(){ this._play('fever_end.mp3', 1); }
  playCoach(tag){
    const map={
      start:'coach_start_th.mp3',
      clear:'coach_clear_th.mp3',
      mode_goodjunk:'coach_mode_goodjunk.mp3',
      mode_groups:'coach_mode_groups.mp3',
      mode_hydration:'coach_mode_hydration.mp3',
      mode_plate:'coach_mode_plate.mp3'
    };
    const file = map[tag]||'coach_start_th.mp3';
    this._play(file, 1);
  }
}
