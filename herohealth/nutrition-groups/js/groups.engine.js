// === /herohealth/nutrition-groups/js/groups.engine.js ===
// Main engine for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-A

import { createRng } from '../../shared/nutrition-common.js';
import { buildSortQuestions, buildCompareQuestions, buildReasonQuestions } from './groups.rounds.js';
import { createEmptyStats, scoreSort, scoreCompare, scoreReason } from './groups.scoring.js';
import { buildGroupsSummary } from './groups.summary.js';

const PHASES = [
  { key: 'sort', label: 'Sort' },
  { key: 'compare', label: 'Compare' },
  { key: 'reason', label: 'Reason' }
];

export class GroupsEngine {
  constructor(ctx, logger) {
    this.ctx = ctx;
    this.logger = logger;
    this.rng = createRng(ctx.seed);
    this.reset();
  }

  reset() {
    this.stats = createEmptyStats();
    this.phaseIndex = 0;
    this.questionIndex = 0;

    const sortQuestions = buildSortQuestions(this.rng, 5);
    const compareQuestions = buildCompareQuestions(this.rng, 3);
    const reasonQuestions = buildReasonQuestions(compareQuestions, this.rng);

    this.plan = {
      sort: sortQuestions,
      compare: compareQuestions,
      reason: reasonQuestions
    };

    this.logger.log('groups_session_start', {
      seed: this.ctx.seed,
      diff: this.ctx.diff
    });
  }

  getPhaseKey() {
    return PHASES[this.phaseIndex]?.key || 'done';
  }

  getPhaseLabel() {
    return PHASES[this.phaseIndex]?.label || 'Done';
  }

  getCurrentQuestion() {
    const phaseKey = this.getPhaseKey();
    return this.plan[phaseKey]?.[this.questionIndex] || null;
  }

  getPhaseQuestions() {
    return this.plan[this.getPhaseKey()] || [];
  }

  getViewState() {
    return {
      phaseKey: this.getPhaseKey(),
      phaseLabel: this.getPhaseLabel(),
      phaseCurrent: this.questionIndex + 1,
      phaseTotal: this.getPhaseQuestions().length,
      score: this.stats.score,
      streak: this.stats.streak
    };
  }

  submit(answerId) {
    const phaseKey = this.getPhaseKey();
    const question = this.getCurrentQuestion();
    if (!question) {
      return { finished: true };
    }

    let evalResult = null;

    if (phaseKey === 'sort') {
      evalResult = scoreSort(this.stats, question, answerId);
    } else if (phaseKey === 'compare') {
      evalResult = scoreCompare(this.stats, question, answerId);
    } else if (phaseKey === 'reason') {
      evalResult = scoreReason(this.stats, question, answerId);
    }

    this.logger.log('groups_answer', {
      phase: phaseKey,
      questionId: question.id,
      answerId,
      correctId: question.correctId,
      correct: evalResult.correct,
      delta: evalResult.delta
    });

    this.questionIndex += 1;

    const phaseDone = this.questionIndex >= this.getPhaseQuestions().length;
    if (phaseDone) {
      this.phaseIndex += 1;
      this.questionIndex = 0;
    }

    const nextQuestion = this.getCurrentQuestion();
    const finished = !nextQuestion;

    if (finished) {
      const summary = buildGroupsSummary(this.ctx, this.stats, this.logger.getSessionMeta());
      this.logger.log('groups_summary_ready', summary.payload.metrics);
      return {
        finished: true,
        evaluation: evalResult,
        summary
      };
    }

    return {
      finished: false,
      evaluation: evalResult,
      question: nextQuestion,
      viewState: this.getViewState()
    };
  }
}