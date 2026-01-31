// === /fitness/js/rb-gameplay.js ===
// Boss + MiniQuest + Shield gameplay layer (play-only, deterministic by seed)

(function(){
  'use strict';

  function clamp(v,a,b){ return v<a?a : v>b?b : v; }

  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ===== Quest templates (short, kid-friendly) =====
  const QUESTS = [
    { id:'q_perfect3',  label:'Perfect ให้ได้ 3 ครั้ง!', dur:10, type:'count', key:'perfect', goal:3 },
    { id:'q_great5',    label:'Great/Perfect รวม 5 ครั้ง!', dur:10, type:'count', key:'greatPlus', goal:5 },
    { id:'q_noblank10', label:'ห้ามกดลอย 10 วิ!', dur:10, type:'noblank', goal:1 },
    { id:'q_lr6',       label:'สลับ ซ้าย–ขวา 6 ครั้ง!', dur:12, type:'pattern', key:'LR', goal:6 }
  ];

  class RbGameplayLayer{
    constructor(engine, opts={}){
      this.e = engine;
      this.seed = (opts.seed|0) || (Date.now()|0);
      this.rand = mulberry32(this.seed);

      // state
      this.quest = null;
      this.questEndsAt = 0;
      this.questProg = 0;
      this.questLastSide = null;

      this.boss = null;
      this.bossActive = false;
      this.bossEndsAt = 0;

      this.nextQuestAt = 6.0; // start after a bit
      this.nextShieldAt = 7.5;
      this.bossMarks = [0.60, 0.85]; // progress points
      this.bossFired = [false, false];

      // UI hooks (optional)
      this.ui = opts.ui || {};
    }

    _uiQuest(text, show){
      if(this.ui.setQuestText) this.ui.setQuestText(text||'', !!show);
    }
    _uiBoss(hpPct, show){
      if(this.ui.setBossHp) this.ui.setBossHp(hpPct, !!show);
    }

    // ---------- quest ----------
    _pickQuest(skill){
      // skill: 0..1 (optional)
      // simple selection: easier quests at low skill
      const pool = QUESTS.slice();
      if(skill != null && skill < 0.45){
        // bias towards easier: no-blank + perfect3
        return (this.rand() < 0.55) ? QUESTS[0] : QUESTS[2];
      }
      if(skill != null && skill > 0.70){
        return (this.rand() < 0.55) ? QUESTS[3] : QUESTS[1];
      }
      return pool[Math.floor(this.rand()*pool.length)];
    }

    _startQuest(songTime){
      const ai = this.e._lastAiOut || {};
      const skill = (ai && ai.skillScore!=null) ? clamp(ai.skillScore,0,1) : null;

      const q = this._pickQuest(skill);
      this.quest = Object.assign({}, q);
      this.questEndsAt = songTime + (q.dur||10);
      this.questProg = 0;
      this.questLastSide = null;

      this._uiQuest(`🎯 Quest: ${q.label}`, true);

      this.e._logEventRow({
        event_type: 'quest_start',
        song_time_s: songTime.toFixed(3),
        quest_id: q.id,
        quest_label: q.label,
        quest_dur_s: q.dur
      });
    }

    _finishQuest(songTime, ok){
      if(!this.quest) return;
      const q = this.quest;

      if(ok){
        // reward loop
        const bonus = 600 + Math.round(this.e.combo * 12);
        this.e.score += bonus;

        // +fever a bit
        if(typeof this.e._addFeverGauge === 'function'){
          this.e._addFeverGauge(18, songTime);
        }

        // +shield (1–2)
        const addShield = (this.rand() < 0.25) ? 2 : 1;
        this.e.shield = clamp((this.e.shield|0) + addShield, 0, 5);

        this._uiQuest(`✅ Quest สำเร็จ! +${bonus} ⭐ +Shield`, true);
        this.e._logEventRow({
          event_type: 'quest_complete',
          song_time_s: songTime.toFixed(3),
          quest_id: q.id,
          quest_prog: this.questProg,
          bonus_score: bonus,
          shield_gain: addShield
        });
      }else{
        this._uiQuest(`❌ Quest ไม่ทัน! ลองใหม่รอบหน้า`, true);
        this.e._logEventRow({
          event_type: 'quest_fail',
          song_time_s: songTime.toFixed(3),
          quest_id: q.id,
          quest_prog: this.questProg
        });
      }

      // clear + cooldown
      this.quest = null;
      this.questEndsAt = 0;
      this.nextQuestAt = songTime + 7.0 + this.rand()*6.0;
      // auto-hide after a moment
      if(this.ui.flashQuest){
        this.ui.flashQuest();
      }
    }

    // ---------- boss ----------
    _startBoss(songTime, which){
      this.bossActive = true;

      // boss hp scales with difficulty
      const base = 24 + which*8; // 24, 32
      const ai = this.e._lastAiOut || {};
      const skill = (ai && ai.skillScore!=null) ? clamp(ai.skillScore,0,1) : 0.5;
      const hpMax = Math.round(base + 18*skill);

      this.boss = {
        which,
        hp: hpMax,
        hpMax
      };

      this.bossEndsAt = songTime + 10.0; // max duration; can end earlier if hp->0
      this._uiBoss(1, true);
      this._uiQuest(`👾 BOSS มาแล้ว! ตี Perfect/Great ให้เยอะ!`, true);

      this.e._logEventRow({
        event_type: 'boss_start',
        song_time_s: songTime.toFixed(3),
        boss_index: which+1,
        boss_hp: hpMax
      });
    }

    _endBoss(songTime, win){
      if(!this.boss) return;
      const b = this.boss;

      this.bossActive = false;

      if(win){
        const bonus = 1200 + Math.round(this.e.maxCombo * 6);
        this.e.score += bonus;
        this.e.shield = clamp((this.e.shield|0) + 1, 0, 5);
        if(typeof this.e._addFeverGauge === 'function'){
          this.e._addFeverGauge(22, songTime);
        }
        this._uiQuest(`🏆 ชนะบอส! +${bonus} ⭐`, true);

        this.e._logEventRow({
          event_type: 'boss_end',
          song_time_s: songTime.toFixed(3),
          boss_index: b.which+1,
          result: 'win',
          bonus_score: bonus
        });
      }else{
        this._uiQuest(`😈 บอสหนีไปก่อน! เล่นให้แม่นขึ้นนะ`, true);
        this.e._logEventRow({
          event_type: 'boss_end',
          song_time_s: songTime.toFixed(3),
          boss_index: b.which+1,
          result: 'timeout'
        });
      }

      this._uiBoss(0, false);
      this.boss = null;
      this.bossEndsAt = 0;
    }

    // ---------- shield note spawn ----------
    trySpawnShieldNote(songTime){
      // spawn occasionally
      if(songTime < this.nextShieldAt) return;
      this.nextShieldAt = songTime + 9.0 + this.rand()*8.0;

      // create a special note
      const lane = (this.e.aiDirector && this.e.aiDirector.pickLane)
        ? this.e.aiDirector.pickLane(null)
        : Math.floor(this.rand()*5);

      // create as type 'shield'
      if(typeof this.e._createNote === 'function'){
        this.e._createNote({ time: songTime + 1.2, lane, type:'shield' });
      }
    }

    // ---------- hooks from engine ----------
    onTick(songTime, dt){
      const e = this.e;
      if(!e || e.mode === 'research') return;

      // boss triggers by progress
      const dur = e.track && e.track.durationSec ? e.track.durationSec : 32;
      const prog = clamp(songTime / Math.max(1, dur), 0, 1);

      for(let i=0;i<this.bossMarks.length;i++){
        if(this.bossFired[i]) continue;
        if(prog >= this.bossMarks[i]){
          this.bossFired[i] = true;
          this._startBoss(songTime, i);
        }
      }

      // boss timeout
      if(this.bossActive && songTime >= this.bossEndsAt){
        this._endBoss(songTime, false);
      }

      // update boss UI
      if(this.bossActive && this.boss){
        const pct = clamp(this.boss.hp / Math.max(1,this.boss.hpMax), 0, 1);
        this._uiBoss(pct, true);
      }

      // quest start
      if(!this.quest && songTime >= this.nextQuestAt && !this.bossActive){
        this._startQuest(songTime);
      }

      // quest timeout
      if(this.quest && songTime >= this.questEndsAt){
        this._finishQuest(songTime, false);
      }

      // shield note spawn
      if(!this.bossActive){
        this.trySpawnShieldNote(songTime);
      }
    }

    onHit(note, songTime, judgment){
      if(this.e.mode === 'research') return;

      // shield note reward
      if(note && note.type === 'shield'){
        const gain = 1;
        this.e.shield = clamp((this.e.shield|0) + gain, 0, 5);
        this._uiQuest(`🛡️ ได้ Shield +${gain}!`, true);
        this.e._logEventRow({
          event_type:'shield_gain',
          song_time_s: songTime.toFixed(3),
          lane: note.lane,
          shield_after: this.e.shield
        });
      }

      // quest progress
      if(this.quest){
        const q = this.quest;
        if(q.type === 'count'){
          if(q.key === 'perfect' && judgment === 'perfect') this.questProg++;
          if(q.key === 'greatPlus' && (judgment === 'perfect' || judgment === 'great')) this.questProg++;
        }else if(q.type === 'pattern' && q.key === 'LR'){
          const side = (note.lane===2) ? 'C' : (note.lane<=1 ? 'L' : 'R');
          if(side === 'L' || side === 'R'){
            if(this.questLastSide && side !== this.questLastSide) this.questProg++;
            this.questLastSide = side;
          }
        }
        if(this.questProg >= (q.goal||1)){
          this._finishQuest(songTime, true);
        }
      }

      // boss HP
      if(this.bossActive && this.boss){
        const dmg = (judgment === 'perfect') ? 3 : (judgment === 'great') ? 2 : 1;
        this.boss.hp = Math.max(0, this.boss.hp - dmg);

        if(this.boss.hp <= 0){
          this._endBoss(songTime, true);
        }
      }
    }

    onBlankTap(songTime){
      if(this.e.mode === 'research') return;
      this.e.blankTapCount = (this.e.blankTapCount||0) + 1;

      if(this.quest && this.quest.type === 'noblank'){
        // fail instantly
        this._finishQuest(songTime, false);
      }

      if(this.bossActive && this.boss){
        // boss punishes spamming a bit
        this.boss.hp = clamp(this.boss.hp + 1, 0, this.boss.hpMax);
      }
    }

    // returns true if shield consumed (damage should be negated)
    tryConsumeShieldOnMiss(songTime){
      if(this.e.mode === 'research') return false;
      if((this.e.shield|0) > 0){
        this.e.shield = (this.e.shield|0) - 1;
        this._uiQuest(`🛡️ Shield กันพลาด! เหลือ ${this.e.shield}`, true);

        this.e._logEventRow({
          event_type:'shield_use',
          song_time_s: songTime.toFixed(3),
          shield_after: this.e.shield
        });
        return true;
      }
      return false;
    }

    onMiss(songTime){
      if(this.e.mode === 'research') return;

      if(this.bossActive && this.boss){
        // miss makes boss tougher (but not too harsh)
        this.boss.hp = clamp(this.boss.hp + 2, 0, this.boss.hpMax);
      }
    }
  }

  window.RbGameplayLayer = RbGameplayLayer;
})();