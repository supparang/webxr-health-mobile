/**
 * CSAI2102 AI Quest Coding Config v2.0
 * Supports S1-S15 and B1-B5.
 * Does NOT declare doGet(e) / doPost(e).
 */
var AIQCODING = AIQCODING || {};

AIQCODING.CONFIG_VERSION = '20260722-AIQ-CODING-CONFIG-V2.0.0';

AIQCODING.LABS = Object.freeze({
  S1:{title:'AI vs Automation',minRunScore:30,minModifyScore:50,maxScore:100},
  S2:{title:'Intelligent Agent',minRunScore:30,minModifyScore:50,maxScore:100},
  S3:{title:'Breadth-First Search',minRunScore:30,minModifyScore:50,maxScore:100},
  B1:{title:'AI Foundations Boss',minRunScore:30,minModifyScore:50,maxScore:100},
  S4:{title:'Uniform Cost Search',minRunScore:30,minModifyScore:50,maxScore:100},
  S5:{title:'Heuristic and A* Search',minRunScore:30,minModifyScore:50,maxScore:100},
  S6:{title:'Game Search and Minimax',minRunScore:30,minModifyScore:50,maxScore:100},
  B2:{title:'Search Strategy Boss',minRunScore:30,minModifyScore:50,maxScore:100},
  S7:{title:'Knowledge Representation',minRunScore:30,minModifyScore:50,maxScore:100},
  S8:{title:'Bayesian Reasoning',minRunScore:30,minModifyScore:50,maxScore:100},
  S9:{title:'Expert System',minRunScore:30,minModifyScore:50,maxScore:100},
  B3:{title:'Knowledge and Reasoning Boss',minRunScore:30,minModifyScore:50,maxScore:100},
  S10:{title:'Machine Learning Pipeline',minRunScore:30,minModifyScore:50,maxScore:100},
  S11:{title:'Supervised Learning',minRunScore:30,minModifyScore:50,maxScore:100},
  S12:{title:'Unsupervised Learning',minRunScore:30,minModifyScore:50,maxScore:100},
  B4:{title:'Machine Learning Boss',minRunScore:30,minModifyScore:50,maxScore:100},
  S13:{title:'Neural Network',minRunScore:30,minModifyScore:50,maxScore:100},
  S14:{title:'Reinforcement Learning',minRunScore:30,minModifyScore:50,maxScore:100},
  S15:{title:'NLP, Generative AI and RAG',minRunScore:30,minModifyScore:50,maxScore:100},
  B5:{title:'Final Applied AI Boss',minRunScore:30,minModifyScore:50,maxScore:100}
});

AIQCODING.allowedLab_ = function(sessionId) {
  sessionId = String(sessionId || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(AIQCODING.LABS, sessionId);
};