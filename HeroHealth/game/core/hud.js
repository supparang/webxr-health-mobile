// === HUD (minimal augment) ===
export class HUD{
  constructor(){
    this.el = document.querySelector('.hud') || document.body;
    this._missionBar = document.getElementById('missionBar');
    this._missionText = document.getElementById('missionText');
    this._resultModal = document.getElementById('resultModal');
  }
  setTimer(t){ const el = document.getElementById('hudTime'); if(el) el.textContent = t; }
  setScore(s){ const el = document.getElementById('hudScore'); if(el) el.textContent = s; }
  setCombo(c){ const el = document.getElementById('hudCombo'); if(el) el.textContent = 'x'+c; }
  setStatus(st){ const el = document.getElementById('hudStatus'); if(el) el.textContent = st; }

  showMission(show=true){
    const wrap = document.getElementById('missionWrap');
    if(wrap) wrap.style.display = show?'flex':'none';
  }
  setMissionGoal(goal){
    if(this._missionText) this._missionText.textContent = `ภารกิจ: เก็บอาหารดีให้ครบ ${goal}`;
  }
  updateMission(done, goal){
    if(this._missionBar){
      const pct = Math.max(0, Math.min(100, Math.round((done/goal)*100)));
      this._missionBar.style.width = pct+'%';
    }
    if(this._missionText){
      this._missionText.textContent = `ภารกิจ: ${done}/${goal}`;
    }
  }

  showResult({mode,score,time,stars=1,banner='RESULT',details={},summary=''}){
    // ถ้ามี result modal ใน DOM ให้ใช้
    if(this._resultModal){
      this._resultModal.querySelector('.res-banner').textContent = banner;
      this._resultModal.querySelector('.res-score').textContent = score;
      this._resultModal.querySelector('.res-time').textContent = time+'s';
      this._resultModal.querySelector('.res-stars').textContent = '★'.repeat(stars)+'☆'.repeat(5-stars);
      this._resultModal.querySelector('.res-detail').textContent =
        `Good ${details.good||0} | Junk ${details.junk||0} | MaxCombo x${details.maxCombo||1} | Mission ${details?.mission?.good||0}/${details?.mission?.goal||0}`;
      this._resultModal.style.display = 'block';
      return;
    }
    // fallback
    alert(summary || `Score ${score}`);
  }
}
