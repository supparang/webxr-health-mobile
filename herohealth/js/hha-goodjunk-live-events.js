// === /herohealth/js/hha-goodjunk-live-events.js ===
// GoodJunk live event logger for Apps Script
// Requires: window.HHACloudPost
// FULL PATCH v20260327-GJ-LIVE-EVENTS

(function (global) {
  'use strict';

  const WIN = global;

  function qs(key, fb = '') {
    try {
      const q = new URLSearchParams(WIN.location.search);
      return q.get(key) ?? fb;
    } catch {
      return fb;
    }
  }

  function clean(v) {
    return String(v || '').trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function randId(n = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < n; i++) out += chars[(Math.random() * chars.length) | 0];
    return out;
  }

  function toNum(v, fb = '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  }

  function detectHeroAvatar(name, fallback = '🙂') {
    const byWord = {
      Apple:'🍎', Carrot:'🥕', Bunny:'🐰', Panda:'🐼', Star:'⭐',
      Berry:'🍓', Tiger:'🐯', Cloud:'☁️', Rocket:'🚀', Kitty:'🐱',
      Buddy:'🧡', Hero:'🦸', Sunny:'🌞', Happy:'😊', Brave:'🛡️',
      Blue:'💙', Magic:'✨', Sparkle:'🌟', Super:'⚡', Honey:'🍯',
      Lucky:'🍀', Tiny:'🐣', Jolly:'🎈', Rainbow:'🌈'
    };
    const text = String(name || '').trim();
    if (!text) return fallback;
    const parts = text.split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const first = parts[0] || '';
    return byWord[last] || byWord[first] || fallback;
  }

  function makeBaseCtx(extra = {}) {
    const name = clean(qs('name'));
    const avatar = clean(qs('heroAvatar')) || detectHeroAvatar(name, '🙂');

    return {
      endpoint: clean(qs('api')) || clean(WIN.HHA_CLOUD_ENDPOINT) || '',

      pid: clean(qs('pid')) || 'anon',
      name,
      hero_name: name,
      hero_avatar: avatar,
      hero_soft: clean(qs('heroSoft')) || '#eef8ff',
      hero_border: clean(qs('heroBorder')) || '#bfe3f2',
      hero_text: clean(qs('heroText')) || '#4d4a42',
      hero_display: clean(qs('heroDisplay')) || [avatar, name].filter(Boolean).join(' ').trim(),

      game: clean(qs('gameId')) || 'goodjunk',
      game_title: 'GoodJunk Race',
      zone: clean(qs('zone')) || 'nutrition',
      mode: clean(qs('mode')) || 'race',
      run: clean(qs('run')) || 'play',
      research_phase: clean(qs('phase')) || '',
      study_id: clean(qs('studyId')) || '',
      condition_group: clean(qs('conditionGroup')) || '',
      variant: clean(qs('mode')) || 'race',
      difficulty: clean(qs('diff')) || 'normal',
      view_mode: clean(qs('view')) || 'mobile',
      seed: clean(qs('seed')) || '',

      grade: clean(qs('grade')) || '',
      class_room: clean(qs('classRoom')) || clean(qs('class_room')) || '',
      school: clean(qs('school')) || '',
      student_code: clean(qs('studentCode')) || clean(qs('student_code')) || '',

      ...extra
    };
  }

  class GoodJunkLiveEvents {
    constructor(opts = {}) {
      this.ctx = makeBaseCtx(opts.ctx || {});
      this.endpoint = clean(opts.endpoint) || this.ctx.endpoint;
      this.sessionId = clean(opts.sessionId) || `gjrace_${this.ctx.pid}_${Date.now()}_${randId(5)}`;
      this.eventSeq = 0;
      this.startedAt = Date.now();
      this.queue = [];
      this.flushTimer = 0;
      this.destroyed = false;
      this.debug = !!opts.debug;
      this.flushEveryMs = Math.max(2000, Number(opts.flushEveryMs || 5000));
      this.flushBatchSize = Math.max(5, Number(opts.flushBatchSize || 8));

      this.summarySent = false;
      this.lastSnapshot = {
        score: 0,
        miss: 0,
        combo: 0,
        hp: '',
        shield: '',
        energy: ''
      };

      if (this.debug) {
        console.log('[GJ-LIVE] init', {
          endpoint: this.endpoint,
          sessionId: this.sessionId,
          ctx: this.ctx
        });
      }

      this.startAutoFlush();
      this.bindLifecycle();
    }

    log(...args) {
      if (!this.debug) return;
      try { console.log('[GJ-LIVE]', ...args); } catch {}
    }

    hasPoster() {
      return !!(WIN.HHACloudPost && typeof WIN.HHACloudPost.sendBundle === 'function');
    }

    makeEventBase() {
      return {
        session_id: this.sessionId,
        pid: this.ctx.pid,
        game: this.ctx.game,
        zone: this.ctx.zone,
        mode: this.ctx.mode,
        run: this.ctx.run,
        research_phase: this.ctx.research_phase,
        study_id: this.ctx.study_id,
        condition_group: this.ctx.condition_group,
        variant: this.ctx.variant,
        difficulty: this.ctx.difficulty,
        view_mode: this.ctx.view_mode,
        seed: this.ctx.seed,

        hero_name: this.ctx.hero_name || this.ctx.name,
        hero_avatar: this.ctx.hero_avatar,
        hero_soft: this.ctx.hero_soft,
        hero_border: this.ctx.hero_border,
        hero_text: this.ctx.hero_text,
        hero_display: this.ctx.hero_display
      };
    }

    nextEvent(detail = {}) {
      this.eventSeq += 1;

      const row = {
        ...this.makeEventBase(),
        event_id: detail.event_id || `evt_${Date.now()}_${this.eventSeq}_${randId(4)}`,
        event_seq: this.eventSeq,
        ts_ms: detail.ts_ms ?? Date.now(),
        ts_iso: detail.ts_iso || nowIso(),

        phase: detail.phase || '',
        event_type: detail.event_type || 'event',
        event_name: detail.event_name || '',
        action: detail.action || '',

        target_id: detail.target_id || '',
        target_type: detail.target_type || '',
        target_label: detail.target_label || '',

        scenario_id: detail.scenario_id || '',
        scenario_type: detail.scenario_type || '',
        step_id: detail.step_id || '',
        step_name: detail.step_name || '',
        item_id: detail.item_id || '',
        item_name: detail.item_name || '',
        food_group: detail.food_group || '',
        lane: detail.lane ?? '',
        slot: detail.slot ?? '',

        expected: detail.expected ?? '',
        actual: detail.actual ?? '',
        choice: detail.choice ?? '',
        correct: detail.correct ?? '',
        score_delta: detail.score_delta ?? 0,
        combo: detail.combo ?? this.lastSnapshot.combo ?? '',

        hp: detail.hp ?? this.lastSnapshot.hp ?? '',
        shield: detail.shield ?? this.lastSnapshot.shield ?? '',
        energy: detail.energy ?? this.lastSnapshot.energy ?? '',
        resource_type: detail.resource_type || '',
        resource_delta: detail.resource_delta ?? '',

        value_num: detail.value_num ?? '',
        value_num2: detail.value_num2 ?? '',
        rt_ms: detail.rt_ms ?? '',
        timing_offset_ms: detail.timing_offset_ms ?? '',

        x: detail.x ?? '',
        y: detail.y ?? '',
        z: detail.z ?? '',
        norm_x: detail.norm_x ?? '',
        norm_y: detail.norm_y ?? '',
        zone_hit: detail.zone_hit ?? '',
        in_target_zone: detail.in_target_zone ?? '',

        hint_shown: detail.hint_shown ?? '',
        coach_tip_id: detail.coach_tip_id || '',
        coach_tip_type: detail.coach_tip_type || '',
        rationale_score: detail.rationale_score ?? '',
        priority_rank: detail.priority_rank ?? '',
        constraint_id: detail.constraint_id || '',
        constraint_ok: detail.constraint_ok ?? '',

        meta_json: detail.meta_json || detail.meta || {},
        client_ts: Date.now(),
        sync_status: 'queued',
        created_at: nowIso()
      };

      return row;
    }

    push(detail = {}) {
      if (this.destroyed) return;
      const row = this.nextEvent(detail);
      this.queue.push(row);

      if (detail.score_now !== undefined) this.lastSnapshot.score = detail.score_now;
      if (detail.miss_now !== undefined) this.lastSnapshot.miss = detail.miss_now;
      if (detail.combo !== undefined) this.lastSnapshot.combo = detail.combo;
      if (detail.hp !== undefined) this.lastSnapshot.hp = detail.hp;
      if (detail.shield !== undefined) this.lastSnapshot.shield = detail.shield;
      if (detail.energy !== undefined) this.lastSnapshot.energy = detail.energy;

      this.log('push', row.event_name, row);

      if (this.queue.length >= this.flushBatchSize) {
        this.flush('batch');
      }
    }

    async flush(reason = 'manual', keepalive = false) {
      if (this.destroyed) return;
      if (!this.queue.length) return;
      if (!this.endpoint) {
        this.log('skip flush: missing endpoint');
        return;
      }
      if (!this.hasPoster()) {
        this.log('skip flush: HHACloudPost missing');
        return;
      }

      const rows = this.queue.splice(0, this.queue.length);

      try {
        const result = await WIN.HHACloudPost.sendBundle({
          endpoint: this.endpoint,
          keepalive,
          ctx: {
            ...this.ctx,
            session_id: this.sessionId
          },
          events: rows
        });
        this.log('flush ok', reason, result);
      } catch (err) {
        this.log('flush fail -> requeue', reason, err);
        this.queue = rows.concat(this.queue);
      }
    }

    startAutoFlush() {
      if (this.flushTimer) clearInterval(this.flushTimer);
      this.flushTimer = setInterval(() => {
        this.flush('interval');
      }, this.flushEveryMs);
    }

    bindLifecycle() {
      this.onPageHide = () => {
        this.flush('pagehide', true);
      };
      WIN.addEventListener('pagehide', this.onPageHide);
    }

    destroy() {
      this.destroyed = true;
      if (this.flushTimer) clearInterval(this.flushTimer);
      this.flushTimer = 0;
      try { WIN.removeEventListener('pagehide', this.onPageHide); } catch {}
    }

    // ---------- semantic helpers ----------

    sessionStart(detail = {}) {
      this.push({
        event_type: 'session',
        event_name: 'session_start',
        action: 'start',
        phase: detail.phase || 'start',
        value_num: detail.time_setting ?? '',
        value_num2: detail.goal ?? '',
        meta_json: {
          session_id: this.sessionId,
          ...detail
        }
      });
    }

    goodHit(detail = {}) {
      this.push({
        event_type: 'tap',
        event_name: 'good_hit',
        action: 'collect',
        phase: detail.phase || '',
        target_id: detail.target_id || '',
        target_type: 'good',
        target_label: detail.target_label || detail.label || '',
        item_id: detail.item_id || '',
        item_name: detail.item_name || detail.label || '',
        food_group: detail.food_group || 'good',
        lane: detail.lane ?? '',
        slot: detail.slot ?? '',
        expected: 'tap_good',
        actual: 'tap_good',
        choice: detail.choice || detail.label || '',
        correct: 1,
        score_delta: detail.score_delta ?? 10,
        combo: detail.combo ?? '',
        value_num: detail.score_delta ?? 10,
        rt_ms: detail.rt_ms ?? '',
        x: detail.x ?? '',
        y: detail.y ?? '',
        norm_x: detail.norm_x ?? '',
        norm_y: detail.norm_y ?? '',
        zone_hit: detail.zone_hit ?? 'playfield',
        in_target_zone: detail.in_target_zone ?? 1,
        meta_json: detail.meta_json || detail.meta || {},
        score_now: detail.score_now,
        miss_now: detail.miss_now
      });
    }

    junkHit(detail = {}) {
      this.push({
        event_type: 'tap',
        event_name: 'junk_hit',
        action: 'wrong_tap',
        phase: detail.phase || '',
        target_id: detail.target_id || '',
        target_type: 'junk',
        target_label: detail.target_label || detail.label || '',
        item_id: detail.item_id || '',
        item_name: detail.item_name || detail.label || '',
        food_group: detail.food_group || 'junk',
        lane: detail.lane ?? '',
        slot: detail.slot ?? '',
        expected: 'avoid_junk',
        actual: 'tap_junk',
        choice: detail.choice || detail.label || '',
        correct: 0,
        score_delta: detail.score_delta ?? -5,
        combo: detail.combo ?? '',
        value_num: detail.score_delta ?? -5,
        rt_ms: detail.rt_ms ?? '',
        x: detail.x ?? '',
        y: detail.y ?? '',
        norm_x: detail.norm_x ?? '',
        norm_y: detail.norm_y ?? '',
        zone_hit: detail.zone_hit ?? 'playfield',
        in_target_zone: detail.in_target_zone ?? 1,
        hint_shown: detail.hint_shown ?? '',
        coach_tip_id: detail.coach_tip_id || '',
        coach_tip_type: detail.coach_tip_type || '',
        meta_json: detail.meta_json || detail.meta || {},
        score_now: detail.score_now,
        miss_now: detail.miss_now
      });
    }

    missGood(detail = {}) {
      this.push({
        event_type: 'miss',
        event_name: 'good_missed',
        action: 'miss_target',
        phase: detail.phase || '',
        target_id: detail.target_id || '',
        target_type: 'good',
        target_label: detail.target_label || detail.label || '',
        item_id: detail.item_id || '',
        item_name: detail.item_name || detail.label || '',
        food_group: detail.food_group || 'good',
        expected: 'tap_good',
        actual: 'miss_good',
        correct: 0,
        score_delta: detail.score_delta ?? 0,
        combo: detail.combo ?? 0,
        value_num: detail.score_now ?? '',
        meta_json: detail.meta_json || detail.meta || {},
        score_now: detail.score_now,
        miss_now: detail.miss_now
      });
    }

    hint(detail = {}) {
      this.push({
        event_type: 'hint',
        event_name: 'hint_shown',
        action: 'coach_tip',
        phase: detail.phase || '',
        hint_shown: 1,
        coach_tip_id: detail.coach_tip_id || '',
        coach_tip_type: detail.coach_tip_type || '',
        value_num: detail.value_num ?? '',
        meta_json: detail.meta_json || detail.meta || detail
      });
    }

    comboMilestone(detail = {}) {
      this.push({
        event_type: 'milestone',
        event_name: 'combo_milestone',
        action: 'combo',
        phase: detail.phase || '',
        combo: detail.combo ?? '',
        value_num: detail.combo ?? '',
        meta_json: detail.meta_json || detail.meta || {},
        score_now: detail.score_now,
        miss_now: detail.miss_now
      });
    }

    sessionEnd(detail = {}) {
      if (this.summarySent) return;
      this.summarySent = true;

      this.push({
        event_type: 'summary',
        event_name: 'session_end',
        action: 'finish',
        phase: detail.phase || 'summary',
        value_num: detail.score ?? this.lastSnapshot.score ?? '',
        value_num2: detail.rank ?? '',
        combo: detail.bestStreak ?? this.lastSnapshot.combo ?? '',
        meta_json: detail.meta_json || detail.meta || detail,
        score_now: detail.score,
        miss_now: detail.miss
      });

      this.flush('session_end', true);
    }
  }

  function createGoodJunkRaceLiveLogger(opts = {}) {
    return new GoodJunkLiveEvents({
      ...opts,
      ctx: {
        ...makeBaseCtx(),
        mode: 'race',
        variant: 'race',
        game_title: 'GoodJunk Race',
        ...(opts.ctx || {})
      }
    });
  }

  WIN.HHAGoodJunkLiveEvents = {
    GoodJunkLiveEvents,
    createGoodJunkRaceLiveLogger
  };
})(window);