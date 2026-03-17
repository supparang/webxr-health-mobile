// /herohealth/goodjunk-intervention/research/config.js
// GoodJunk Intervention Research Config
// Starter central config for game / assessments / parent / followup

(function () {
  'use strict';

  const WIN = window;

  if (WIN.GJ_INT_CONFIG) return;

  const CONFIG = {
    app: {
      appKey: 'goodjunk-intervention',
      title: 'GoodJunk Intervention',
      version: '20260317a',
      schemaVersion: 'gj-int-schema-v1',
      locale: 'th-TH'
    },

    paths: {
      teacherPanel: '../launcher/teacher-panel.html',
      studentLauncher: '../launcher/student-launcher.html',

      game: '../game/goodjunk-vr.html',

      preKnowledge: '../assessments/pre-knowledge.html',
      postKnowledge: '../assessments/post-knowledge.html',
      preBehavior: '../assessments/pre-behavior.html',
      postBehavior: '../assessments/post-behavior.html',

      parentSummary: '../parent/parent-summary.html',
      parentQuestionnaire: '../parent/parent-questionnaire.html',

      weeklyCheck: '../followup/weekly-check.html',
      shortFollowup: '../followup/short-followup.html',

      hubFallback: '../../hub.html'
    },

    storageKeys: {
      teacherPanel: 'GOODJUNK_INT_TEACHER_PANEL_V1',

      preKnowledge: 'GOODJUNK_INT_PRE_KNOWLEDGE_V1',
      postKnowledge: 'GOODJUNK_INT_POST_KNOWLEDGE_V1',

      preBehavior: 'GOODJUNK_INT_PRE_BEHAVIOR_V1',
      postBehavior: 'GOODJUNK_INT_POST_BEHAVIOR_V1',

      parentQuestionnaire: 'GOODJUNK_INT_PARENT_QUESTIONNAIRE_V1',
      weeklyCheck: 'GOODJUNK_INT_WEEKLY_CHECK_V1',
      shortFollowup: 'GOODJUNK_INT_SHORT_FOLLOWUP_V1',

      latestGameSummary: 'GOODJUNK_INT_LAST_SUMMARY_V1',
      sessionsHistory: 'GOODJUNK_INT_SESSIONS_HISTORY_V1',
      eventsHistory: 'GOODJUNK_INT_EVENTS_HISTORY_V1',
      mlHistory: 'GOODJUNK_INT_ML_HISTORY_V1',
      mlGameendHistory: 'GOODJUNK_INT_ML_GAMEEND_HISTORY_V1'
    },

    defaults: {
      projectTag: 'herohealth-goodjunk-intervention',
      studyId: 'GJ-INT-001',
      phase: 'pretest',
      conditionGroup: 'A',
      sessionOrder: '1',
      blockLabel: 'B1',

      run: 'play',
      diff: 'easy',
      view: 'mobile',
      time: '80',

      kid: true,
      readable: true,
      spawnDebug: false
    },

    contextKeys: [
      'projectTag',
      'studyId',
      'phase',
      'conditionGroup',
      'sessionOrder',
      'blockLabel',
      'sessionId',

      'studentKey',
      'schoolCode',
      'schoolName',
      'classRoom',
      'studentNo',
      'nickName',
      'gradeLevel',
      'gender',
      'age',

      'run',
      'diff',
      'view',
      'time',
      'seed',
      'kid',
      'readable',
      'spawnDebug',
      'hub'
    ],

    scoring: {
      knowledgeTotal: 5,
      behaviorTotal: 15,
      parentTotal: 15,
      weeklyTotal: 15,
      shortFollowupTotal: 9
    },

    answerKeys: {
      knowledge: {
        q1: 'B',
        q2: 'B',
        q3: 'A',
        q4: 'B',
        q5: 'B'
      }
    },

    game: {
      goalTargetByDiff: {
        easy: 14,
        normal: 18,
        hard: 24
      },
      spawnRateByDiff: {
        easy: 0.88,
        normal: 1.05,
        hard: 1.35
      },
      ttlByDiff: {
        easy: { good: 2.5, junk: 2.4 },
        normal: { good: 2.2, junk: 2.2 },
        hard: { good: 2.0, junk: 2.0 }
      }
    },

    labels: {
      grade(score, accPct, missTotal) {
        if (score >= 260 && accPct >= 80 && missTotal <= 3) return 'A';
        if (score >= 190 && accPct >= 65 && missTotal <= 5) return 'B';
        if (score >= 130 && accPct >= 50) return 'C';
        return 'D';
      }
    },

    urls: {
      withContext(base, sourceUrl) {
        const src = new URL(sourceUrl || location.href, location.href);
        const out = new URL(base, location.href);
        CONFIG.contextKeys.forEach((k) => {
          const v = src.searchParams.get(k);
          if (v != null && v !== '') out.searchParams.set(k, v);
        });
        return out.toString();
      }
    },

    utils: {
      q(k, d = '') {
        try { return new URL(location.href).searchParams.get(k) ?? d; }
        catch (_) { return d; }
      },

      safeNum(v, d = 0) {
        v = Number(v);
        return Number.isFinite(v) ? v : d;
      },

      clamp(v, a, b) {
        v = Number(v);
        if (!Number.isFinite(v)) v = a;
        return Math.max(a, Math.min(b, v));
      },

      bool01(v) {
        return v ? '1' : '0';
      },

      nowIso() {
        return new Date().toISOString();
      },

      makeSeed() {
        return String(Date.now());
      },

      makeSessionId(studentKey = 'anon') {
        return `gjint-${String(studentKey || 'anon')}-${Date.now()}`;
      },

      sumLikert(ans, keys) {
        return (keys || Object.keys(ans || {})).reduce((s, k) => s + (Number(ans?.[k]) || 0), 0);
      },

      allAnswered(ans, keys) {
        return (keys || Object.keys(ans || {})).every((k) => !!ans?.[k]);
      },

      readJson(key, fallback = null) {
        try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
          return fallback;
        }
      },

      writeJson(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (_) {
          return false;
        }
      }
    }
  };

  WIN.GJ_INT_CONFIG = CONFIG;
})();