/**
 * CSAI2102 • AIQCODING Legacy Router Compatibility Bridge v1.0
 *
 * IMPORTANT: REPLACE the *contents* of the existing AIQCODING.gs in
 * the Apps Script project with this file, after a full code backup.
 * Do NOT install as a third Coding Receiver file. This is NOT an authority.
 *
 * Authority (single owner):
 *   AIQuestCoding_Receiver.gs v3.2.4+
 * Submission gate:
 *   AIQuestCoding_AuthorityGate_v322.gs / AIQCODING_SECURE.handle
 *
 * Preserved legacy public calls:
 *   AIQCODING.route(action, payload)
 *   AIQCODING.dispatch(action, payload)
 *   AIQCODING.handleRequest(payload)
 *   AIQCODING.submitCodingLab_(payload)
 *   AIQCODING.getCodingStatus_(payload)
 *
 * Does NOT overwrite VERSION, handle, validateEvidence_, getStatus_,
 * writeCodingRow_, rows, scores, Sheet headers or doPost/doGet.
 * Any legacy write path must go through the secure authority gate.
 */

var AIQCODING = AIQCODING || {};
var AIQCODING_LEGACY_BRIDGE = AIQCODING_LEGACY_BRIDGE || {};
AIQCODING_LEGACY_BRIDGE.VERSION = '20261029-AIQ-CODING-LEGACY-BRIDGE-V1.0-NO-COLLISION';

AIQCODING_LEGACY_BRIDGE.route_ = function(actionOrPayload, payload) {
  var p;
  if(actionOrPayload && typeof actionOrPayload === 'object' && !Array.isArray(actionOrPayload)) {
    p = Object.assign({}, actionOrPayload);
  }else{
    p = Object.assign({}, payload || {});
    p.action = String(actionOrPayload || p.action || '').trim();
  }
  var action = String(p.action || '').trim().toUpperCase();
  if(!action){
    return {ok:false,code:'CODING_ACTION_REQUIRED',version:AIQCODING_LEGACY_BRIDGE.VERSION};
  }
  p.action=action;

  // Fail closed: old helper aliases must never bypass the Flow authority gate.
  if(action === 'SUBMIT_CODING_LAB'){
    if(typeof AIQCODING_SECURE === 'undefined' ||
       typeof AIQCODING_SECURE.handle !== 'function'){
      return {ok:false,code:'AIQCODING_SECURE_GATE_MISSING',
        version:AIQCODING_LEGACY_BRIDGE.VERSION};
    }
    return AIQCODING_SECURE.handle(p);
  }

  if(typeof AIQCODING.handle !== 'function'){
    return {ok:false,code:'CODING_RECEIVER_MISSING',version:AIQCODING_LEGACY_BRIDGE.VERSION};
  }
  return AIQCODING.handle(p);
};

AIQCODING.route = function(action, payload) {
  return AIQCODING_LEGACY_BRIDGE.route_(action, payload);
};
AIQCODING.dispatch = function(action, payload) {
  return AIQCODING_LEGACY_BRIDGE.route_(action, payload);
};
AIQCODING.handleRequest = function(payload) {
  return AIQCODING_LEGACY_BRIDGE.route_(payload || {});
};

AIQCODING.submitCodingLab_ = function(payload) {
  var p=Object.assign({}, payload || {});
  p.action='SUBMIT_CODING_LAB';
  return AIQCODING_LEGACY_BRIDGE.route_(p);
};
AIQCODING.getCodingStatus_ = function(payload) {
  var p=Object.assign({}, payload || {});
  p.action='GET_CODING_STATUS';
  return AIQCODING_LEGACY_BRIDGE.route_(p);
};

/**
 * Read-only runtime check. Run from Apps Script Editor. Does not query
 * student data, change Sheet rows, grant unlocks, or alter scoring.
 */
function TEST_AIQ_CODING_SINGLE_AUTHORITY_READONLY() {
  var coding=typeof AIQCODING === 'undefined'?null:AIQCODING;
  var bridge=typeof AIQCODING_LEGACY_BRIDGE === 'undefined'?null:AIQCODING_LEGACY_BRIDGE;
  var writer=coding && typeof coding.writeCodingRow_==='function'?
    String(coding.writeCodingRow_):'';
  var receiverVersion=coding?String(coding.VERSION||'UNKNOWN'):'MISSING';
  var out={
    audit:'AIQ_CODING_SINGLE_AUTHORITY_V1',
    mode:'READ_ONLY_NO_WRITE',
    bridgeLoaded:!!bridge,
    receiverVersion:receiverVersion,
    expectedReceiver:/V3\.2\.(?:4-DUPLICATE-ALIASES|5-SEMANTIC-EQUIVALENCE|6-OUTPUT-PARITY)/.test(receiverVersion),
    writerVersion324:writer.indexOf('CODING_HEADER_MISSING_')>=0,
    writerVersion323:writer.indexOf('CODING_HEADER_INVALID_')>=0,
    routerAliasesReady:!!(coding&&typeof coding.route==='function'&&
      typeof coding.dispatch==='function'&&
      typeof coding.handleRequest==='function'),
    secureGateLoaded:typeof AIQCODING_SECURE!=='undefined' &&
      typeof AIQCODING_SECURE.handle==='function',
    flowLoaded:typeof AIQFLOW!=='undefined' &&
      typeof AIQFLOW.getSessionStatus_==='function',
    readiness:'NOT_READY'
  };
  out.readiness=out.bridgeLoaded && out.expectedReceiver &&
    out.writerVersion324 && !out.writerVersion323 &&
    out.routerAliasesReady && out.secureGateLoaded && out.flowLoaded?
    'READY_FOR_READONLY_FLOW_TEST':'REVIEW_MISSING_MODULES';
  Logger.log(JSON.stringify(out));
  return out;
}
