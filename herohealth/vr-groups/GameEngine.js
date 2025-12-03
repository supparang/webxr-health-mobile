// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (2025-12-05)
// รองรับ Goal/Mini Quest 25 แบบ + Logger + FX + Coach

'use strict';

window.GAME_MODULES = window.GAME_MODULES || {};
const ns = window.GAME_MODULES;

/******************************************************
 * SETTINGS
 ******************************************************/
const GAME_VERSION = 'GroupsVR_v1.2';

function detectDevice() {
  const ua = navigator.userAgent || '';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/******************************************************
 * MAIN CLASS
 ******************************************************/
class GameEngine {
  constructor(sceneEl) {
    this.sceneEl = sceneEl;
    this.state = 'idle';

    this.diff = 'normal';
    this.score = 0;

    this.targets = [];
    this.spawnTimer = null;
    this.gameTimer = null;

    this.deviceType = detectDevice();

    // Quest Manager (กำหนดใน start())
    this.questManager = null;

    // Group stats
    this.groupStats = {};
    this.resetGroupStats();

    // UI/Fx modules
    this.ui = ns.foodGroupsUI;
    this.fx = ns.foodGroupsFx;
    this.coach = ns.foodGroupsCoach;

    // Logging array
    window.HHA_FOODGROUPS_LOG = [];
  }

  /****************************************************
   * GROUP STATS
   ****************************************************/
  resetGroupStats() {
    this.groupStats = {};
    if (ns.foodGroupsEmoji && ns.foodGroupsEmoji.all) {
      ns.foodGroupsEmoji.all.forEach(g => {
        this.groupStats[g.id] = {
          id: g.id,
          label: g.label,
          emoji: g.emoji,
          isGood: !!g.isGood,
          spawns: 0,
          hits: 0,
          badHits: 0
        };
      });
    }
  }

  /****************************************************
   * START
   ****************************************************/
  start(diff = 'normal') {
    this.diff = diff;
    this.score = 0;
    this.state = 'playing';

    this.clearTimers();
    this.resetGroupStats();
    this.removeAllTargets();

    // ★ Load difficulty table
    const cfg = ns.foodGroupsDifficulty.get(diff);
    this.cfg = cfg;

    // ★ Quest Manager
    this.questManager = new ns.foodGroupsQuest.QuestManager(diff);

    // ★ UI init
    if (this.ui) {
      this.ui.init();
      this.ui.show();
      this.ui.reset();
      if (this.ui.setLegend && ns.foodGroupsEmoji.all) {
        this.ui.setLegend(ns.foodGroupsEmoji.all);
      }
    }

    if (this.coach && this.coach.setDifficulty) {
      this.coach.setDifficulty(diff);
    }

    if (this.coach && this.coach.sayStart) {
      this.coach.sayStart(this.questManager.exportForHUD());
    }

    // ★ Timer
    const duration = cfg.duration || 60000;
    this.gameTimer = setTimeout(() => {
      this.stop('timeout');
    }, duration);

    // ★ Spawn loop
    this.scheduleSpawn();

    // ★ Log start
    this.log('start', { diff, deviceType: this.deviceType });

    console.log('[GroupsVR] GAME START', diff);
  }

  /****************************************************
   * STOP
   ****************************************************/
  stop(reason = 'stop') {
    if (this.state !== 'playing') return;
    this.state = 'ended';

    this.clearTimers();
    this.removeAllTargets();

    if (this.ui) this.ui.hide();

    const quests = this.questManager;
    const status = quests ? quests.exportForHUD() : null;

    // ★ Coach summary
    if (this.coach && this.coach.sayFinish) {
      this.coach.sayFinish({
        score: this.score,
        diff: this.diff,
        goalsCleared: quests.goalIndex,
        miniCleared: quests.miniIndex
      });
    }

    // ★ Logging summary
    this.log('end', {
      diff: this.diff,
      score: this.score,
      goalsCleared: quests.goalIndex,
      miniCleared: quests.miniIndex
    });

    // ส่งขึ้น Cloud
    if (ns.foodGroupsCloudLogger && ns.foodGroupsCloudLogger.send) {
      const sessionSummary = {
        mode: 'groups-vr',
        version: GAME_VERSION,
        diff: this.diff,
        deviceType: this.deviceType,
        score: this.score,
        questsCleared: quests.goalIndex,
        questsTotal: quests.goals.length,
        startedAt: this.startedAt,
        endedAt: Date.now(),
        groupStats: this.groupStats
      };

      const events = window.HHA_FOODGROUPS_LOG.slice();
      ns.foodGroupsCloudLogger.send(sessionSummary, events);
    }

    // ส่ง event ไป HUD
    this.sceneEl.emit('fg-game-over', {
      score: this.score,
      questsCleared: this.questManager.goalIndex,
      questsTotal: this.questManager.goals.length,
      miniCleared: this.questManager.miniIndex,
      miniTotal: this.questManager.minis.length
    });

    console.log('[GroupsVR] GAME END');
  }

  /****************************************************
   * Target Spawn
   ****************************************************/
  scheduleSpawn() {
    if (this.state !== 'playing') return;
    const interval = this.cfg.spawnInterval || 1500;

    this.spawnTimer = setTimeout(() => {
      this.spawnTarget();
      this.scheduleSpawn();
    }, interval);
  }

  spawnTarget() {
    if (this.state !== 'playing') return;
    const cfg = this.cfg;

    // Pick group
    let group = ns.foodGroupsEmoji.pickRandomGroup();
    if (!group) {
      group = { id: 0, emoji: '🎯', label: 'target', isGood: true, color: '#22c55e' };
    }

    const radius = cfg.targetRadius || 0.45;

    const x = -1.2 + Math.random() * 2.4;
    const y = 1.1 + Math.random() * 0.8;
    const z = -2.8 + Math.random() * 0.6;

    const el = document.createElement('a-entity');
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-group-id', group.id);
    el.setAttribute('data-emoji', group.emoji);

    // circle target
    el.setAttribute('geometry', `primitive: circle; radius: ${radius}`);
    el.setAttribute('material', `color: ${group.color}; shader: flat; opacity:0.96`);
    el.setAttribute('position', `${x} ${y} ${z}`);

    // emoji sprite (สำคัญมาก!)
    const txt = document.createElement('a-text');
    txt.setAttribute('value', group.emoji);
    txt.setAttribute('align', 'center');
    txt.setAttribute('anchor', 'center');
    txt.setAttribute('color', '#fff');
    txt.setAttribute('width', '2.4');
    txt.setAttribute('position', '0 0 0.03');
    el.appendChild(txt);

    // timeout → miss
    const ttl = cfg.targetLifetime || 2200;
    el._timer = setTimeout(() => {
      this.onMiss(el);
    }, ttl);

    // click event
    el.addEventListener('click', () => this.onHit(el));

    this.sceneEl.appendChild(el);
    this.targets.push(el);

    // count
    this.groupStats[group.id].spawns++;

    // log
    this.log('spawn', { groupId: group.id, emoji: group.emoji });
  }

  removeAllTargets() {
    this.targets.forEach(t => t.remove());
    this.targets = [];
  }

  /****************************************************
   * HIT / MISS
   ****************************************************/
  onHit(el) {
    if (this.state !== 'playing') return;
    if (el._hit) return;
    el._hit = true;

    clearTimeout(el._timer);

    const groupId = parseInt(el.getAttribute('data-group-id'));
    const emoji = el.getAttribute('data-emoji');

    const item = { group: groupId };

    // Update quest
    this.questManager.updateOnHit(item);

    // UI update
    const q = this.questManager.exportForHUD();
    if (this.ui && this.ui.updateQuest) this.ui.updateQuest(q);

    // scoring
    let gained = 10;
    this.score += gained;
    if (this.ui) this.ui.setScore(this.score);

    // FX
    if (this.fx) this.fx.burst(el.object3D);

    // Coach reaction
    if (this.coach && this.coach.onHit) {
      this.coach.onHit({ groupId, emoji });
    }

    // update group stats
    this.groupStats[groupId].hits++;

    this.log('hit', { groupId, emoji, scoreDelta: gained });

    el.remove();
  }

  onMiss(el) {
    if (this.state !== 'playing') return;
    if (el._hit) return;

    const groupId = parseInt(el.getAttribute('data-group-id'));
    const emoji = el.getAttribute('data-emoji');

    // UI feedback
    if (this.ui) this.ui.flashMiss();

    if (this.coach && this.coach.onMiss) {
      this.coach.onMiss({ groupId, emoji });
    }

    this.groupStats[groupId].badHits++;

    this.log('miss', { groupId, emoji });

    el.remove();
  }

  /****************************************************
   * LOG
   ****************************************************/
  log(type, detail) {
    const arr = window.HHA_FOODGROUPS_LOG;
    arr.push({ ts: Date.now(), type, ...detail });
  }

  /****************************************************
   * UTIL
   ****************************************************/
  clearTimers() {
    if (this.spawnTimer) clearTimeout(this.spawnTimer);
    if (this.gameTimer) clearTimeout(this.gameTimer);
  }
}

/******************************************************
 * A-Frame Component
 ******************************************************/
AFRAME.registerComponent('food-groups-game', {
  init: function () {
    this.engine = new GameEngine(this.el.sceneEl);

    this.el.sceneEl.addEventListener('fg-start', e => {
      const diff = (e.detail?.diff) || 'normal';
      this.engine.start(diff);
    });

    this.el.sceneEl.addEventListener('fg-stop', e => {
      this.engine.stop(e.detail?.reason || 'stop');
    });
  }
});

ns.FoodGroupsGame = GameEngine;