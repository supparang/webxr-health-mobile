// === /herohealth/nutrition-groups/js/groups.engine.js ===
// Main engine for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-B

import { createRng } from '../../shared/nutrition-common.js';
import { buildSortQuestions, buildCompareQuestions, buildReasonQuestions } from './groups.rounds.js';
import { createEmptyStats, scoreSort, scoreCompare, scoreReason, scoreRetry } from './groups.scoring.js';
import { buildGroupsSummary } from './groups.summary.js';

const PHASE_LABELS = {
  sort: 'Sort',
  compare: 'Compare',
  reason: 'Reason',
  retry: 'Retry'
};

function cloneRetryQuestion(question) {
  return {
    ...question,
    id: `retry-${question.id}`,
    isRetry: true,
    retryFrom: question.type
  };
}

export class GroupsEngine {
  constructor(ctx, logger) {
    this.ctx = ctx;
    this.logger = logger;
    this.rng = createRng(ctx.seed);
    this.reset();
  }

  reset() {
    this.stats = createEmptyStats();
    this.phaseOrder = ['sort', 'compare', 'reason'];
    this.phaseIndex = 0;
    this.questionIndex = 0;
    this.retryQueue = [];
    this.retrySeen = new Set();

    const sortQuestions = buildSortQuestions(this.rng, 5);
    const compareQuestions = buildCompareQuestions(this.rng, 3);
    const reasonQuestions = buildReasonQuestions(compareQuestions, this.rng);

    this.plan = {
      sort: sortQuestions,
      compare: compareQuestions,
      reason: reasonQuestions,
      retry: []
    };

    this.logger.log('groups_session_start', {
      seed: this.ctx.seed,
      diff: this.ctx.diff
    });
  }

  getPhaseKey() {
    return this.phaseOrder[this.phaseIndex] || 'done';
  }

  getPhaseLabel() {
    return PHASE_LABELS[this.getPhaseKey()] || 'Done';
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

  enqueueRetry(question) {
    if (question.isRetry) return;
    if (this.retrySeen.has(question.id)) return;

    this.retrySeen.add(question.id);
    const retryQuestion = cloneRetryQuestion(question);
    this.retryQueue.push(retryQuestion);
    this.plan.retry = this.retryQueue;
  }

  maybeActivateRetryPhase() {
    if (this.retryQueue.length > 0 && !this.phaseOrder.includes('retry')) {
      this.phaseOrder.push('retry');
      this.logger.log('groups_retry_phase_added', {
        retryCount: this.retryQueue.length
      });
    }
  }

  evaluateQuestion(phaseKey, question, answerId) {
    if (phaseKey === 'sort') return scoreSort(this.stats, question, answerId);
    if (phaseKey === 'compare') return scoreCompare(this.stats, question, answerId);
    if (phaseKey === 'reason') return scoreReason(this.stats, question, answerId);
    if (phaseKey === 'retry') return scoreRetry(this.stats, question, answerId);

    return {
      correct: false,
      delta: 0,
      feedback: ''
    };
  }

  submit(answerId) {
    const phaseKey = this.getPhaseKey();
    const question = this.getCurrentQuestion();
    if (!question) {
      return { finished: true };
    }

    const evalResult = this.evaluateQuestion(phaseKey, question, answerId);

    if (!evalResult.correct && phaseKey !== 'retry') {
      this.enqueueRetry(question);
    }

    this.logger.log('groups_answer', {
      phase: phaseKey,
      questionId: question.id,
      answerId,
      correctId: question.correctId,
      correct: evalResult.correct,
      delta: evalResult.delta,
      retryFrom: question.retryFrom || null
    });

    this.questionIndex += 1;

    const phaseDone = this.questionIndex >= this.getPhaseQuestions().length;
    if (phaseDone) {
      if (phaseKey === 'reason') {
        this.maybeActivateRetryPhase();
      }
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