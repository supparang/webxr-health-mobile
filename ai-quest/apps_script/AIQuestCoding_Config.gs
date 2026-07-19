
/**
 * CSAI2102 AI Quest Coding Module v1.0
 * S1-S3 + B1 pilot
 * Does NOT declare doGet(e) / doPost(e)
 */
var AIQCODING = AIQCODING || {};

AIQCODING.VERSION = '20260719-AIQ-CODING-PILOT-V1.0.0';

AIQCODING.LABS = Object.freeze({
  S1: {
    title: 'AI vs Automation',
    minRunScore: 20,
    minModifyScore: 30,
    maxScore: 100
  },
  S2: {
    title: 'Intelligent Agent',
    minRunScore: 20,
    minModifyScore: 30,
    maxScore: 100
  },
  S3: {
    title: 'Breadth-First Search',
    minRunScore: 20,
    minModifyScore: 30,
    maxScore: 100
  },
  B1: {
    title: 'Integrated AI Foundations Boss',
    minRunScore: 20,
    minModifyScore: 30,
    maxScore: 100
  }
});

AIQCODING.allowedLab_ = function(sessionId) {
  sessionId = String(sessionId || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(AIQCODING.LABS, sessionId);
};
