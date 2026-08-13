#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const canonicalSrc = read('sgnal-hunt/js/uxq-csai2601-canonical-content-v1.js');
const snapshotSrc = read('sgnal-hunt/js/uxq-canonical-snapshot-v1.js');
const bridgeSrc = read('sgnal-hunt/js/uxq-course-alignment-bridge-v1.js');
const finalSrc = read('sgnal-hunt/js/uxq-canonical-content-final-authority-v3.js');
const w12Src = read('sgnal-hunt/js/uxq-w12-content-integrity-v1.js');
const html = read('sgnal-hunt/csai2601-canonical-node-clean-v1.html');

const context = {
  window:{dispatchEvent(){}},
  document:{documentElement:{dataset:{}}},
  CustomEvent:function CustomEvent(type, init){ this.type=type; this.detail=init?.detail; },
  console
};
vm.createContext(context);
vm.runInContext(canonicalSrc, context, {filename:'canonical.js'});
vm.runInContext(snapshotSrc, context, {filename:'snapshot.js'});
vm.runInContext(bridgeSrc, context, {filename:'bridge.js'});

const canonical = context.window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
const snapshot = context.window.CSAI2601_UXQ_CANONICAL_SNAPSHOT_V1;
const studio = context.window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;

const EXPECTED_ORDER = ['W1','W2','W3','B1','W4','W5','W6','W7','B2','W8','W9','W10','W11','B3','W12','W13','W14','B4','W15'];
assert.deepStrictEqual(Array.from(canonical.nodes, n => n.id), EXPECTED_ORDER, 'canonical order must be 19 nodes');
assert.deepStrictEqual(Array.from(snapshot.nodes, n => n.id), EXPECTED_ORDER, 'snapshot must preserve canonical order');
assert.strictEqual(studio.items.length, 19, 'Studio must exist for all 19 nodes');

const byId = id => canonical.nodes.find(n => n.id === id);
assert.match(byId('W4').title, /Define.*HMW.*Inclusive/i, 'W4 canonical mapping drift');
assert.match(byId('W5').title, /Ideation.*AI-assisted.*Ethics/i, 'W5 canonical mapping drift');
assert.match(byId('W6').title, /Information Architecture.*Navigation/i, 'W6 canonical mapping drift');
assert.match(byId('W9').title, /Visual Design.*UI Kit.*Design Tokens/i, 'W9 canonical mapping drift');
assert.match(byId('W11').title, /Design System.*Components.*Front-end/i, 'W11 canonical mapping drift');
assert.match(byId('W13').title, /Prototype.*Developer Handoff/i, 'W13 handoff mapping drift');
assert.match(byId('W14').title, /Heuristic Evaluation.*Usability Testing.*Iteration/i, 'W14 evaluation mapping drift');
assert.match(byId('W15').title, /Final UX\/UI Case Study.*Professional Portfolio/i, 'W15 portfolio mapping drift');

for (const node of canonical.nodes) {
  const item = studio.items.find(x => x.id === node.id);
  assert(item, `${node.id}: missing Studio`);
  assert(item.fields.some(f => f.key === 'reflection'), `${node.id}: missing Reflection`);
  for (const key of ['figmaUrl','projectUrl','evidenceUrl']) {
    assert(item.fields.some(f => f.key === key), `${node.id}: missing ${key}`);
  }
  const taskLabels = item.fields.filter(f => /^artifactEvidence\d+$/.test(f.key)).map(f => f.label).join(' • ');
  for (const checklistItem of node.artifactChecklist || []) {
    assert(taskLabels.includes(checklistItem), `${node.id}: Studio does not derive from canonical checklist item "${checklistItem}"`);
  }
  assert.deepStrictEqual(Array.from(item.practiceFlow), Array.from(node.missionRounds), `${node.id}: Studio flow must match canonical mission rounds`);
}

const reflection = id => studio.items.find(x => x.id === id).reflectionPrompt;
assert(!/Persona/i.test(reflection('W4')), 'W4 Reflection must not drift back to Persona/User Research');
assert(/AI|desirability|feasibility|viability/i.test(reflection('W5')), 'W5 Reflection must include AI-assisted ideation/selection');
assert(/findability|sitemap|navigation/i.test(reflection('W6')), 'W6 Reflection must align to IA/findability');
assert(/token|hierarchy|contrast/i.test(reflection('W9')), 'W9 Reflection must align to visual/tokens');
assert(/component|front-end|implementation/i.test(reflection('W11')), 'W11 Reflection must align to Design System/front-end');

assert.match(w12Src, /const ORDER = \['trigger','feedback','prevention','microcopy','recovery'\]/, 'W12 canonical round order mismatch');
assert.match(finalSrc, /20260813-CANONICAL-CONTENT-FINAL-AUTHORITY-V3/, 'final authority version missing');
for (const id of EXPECTED_ORDER) {
  assert(new RegExp(`\\b${id}:\\s*\\[`).test(finalSrc), `${id}: missing from final Mission guide`);
}
assert.match(finalSrc, /restoreCanonicalMetadata/, 'final authority must restore canonical metadata');
assert.match(finalSrc, /if \(NODE === 'W12'\) return; \/\/ dedicated canonical W12 v4 is the owner\./, 'W12 must have a single visible content owner');

const SNAP_TAG = 'uxq-canonical-snapshot-v1.js?v=content-alignment-v3-20260813';
const BRIDGE_TAG = 'uxq-course-alignment-bridge-v1.js?v=content-alignment-v3-20260813';
const W12_TAG = 'uxq-w12-content-integrity-v1.js?v=content-alignment-v4-20260813';
const BOOT_TAG = 'uxq-w12-prompt-no-shake-v1.js?v=content-alignment-bootstrap-v3-20260813';
const bootstrapSrc = read('sgnal-hunt/js/uxq-w12-prompt-no-shake-v1.js');
assert(html.includes(SNAP_TAG), 'HTML missing canonical snapshot/cache bust');
assert(html.includes(BRIDGE_TAG), 'HTML missing bridge cache bust');
assert(html.includes(W12_TAG), 'HTML missing W12 v4 cache bust');
assert(html.includes(BOOT_TAG), 'HTML missing canonical final bootstrap cache bust');
assert(bootstrapSrc.includes('uxq-canonical-content-final-authority-v3.js?v=content-alignment-v3-20260813'), 'bootstrap must load final authority with fresh cache key');

const idxCanonical = html.indexOf('uxq-csai2601-canonical-content-v1.js');
const idxSnapshot = html.indexOf('uxq-canonical-snapshot-v1.js');
const idxBridge = html.indexOf('uxq-course-alignment-bridge-v1.js');
const idxField = html.indexOf('uxq-field-aware-questions-w8-w15-v1.js');
const idxPlayer = html.indexOf('uxq-csai2601-canonical-node-player-v1.js');
const idxBootstrap = html.indexOf('uxq-w12-prompt-no-shake-v1.js');
assert(idxCanonical < idxSnapshot, 'snapshot must load immediately after canonical source');
assert(idxSnapshot < idxBridge && idxBridge < idxField, 'canonical Studio bridge must run before stale field-aware layers');
assert(idxField < idxPlayer, 'legacy field-aware metadata layers must complete before player');
assert(idxPlayer < idxBootstrap, 'final visible authority bootstrap must run after player/legacy visible layers');

for (const [name, src] of [['snapshot',snapshotSrc],['bridge',bridgeSrc],['final',finalSrc],['w12',w12Src],['bootstrap',bootstrapSrc]]) {
  for (const forbidden of ['localStorage.setItem','sessionStorage.setItem','fetch(','XMLHttpRequest','firebase.firestore','submit_attempt','mission_completed =','unlockNext']) {
    assert(!src.includes(forbidden), `${name}: safety regression contains ${forbidden}`);
  }
}
assert(!bridgeSrc.includes('oldFields'), 'bridge must not inherit legacy Studio fields');
assert(!bridgeSrc.includes('oldPack'), 'bridge must not inherit legacy Studio pack');

console.log('CSAI2601 CONTENT ALIGNMENT SMOKE: PASS');
console.log(`Nodes: ${EXPECTED_ORDER.length}/19`);
console.log('Mission canonical owner: PASS');
console.log('Studio from canonical artifactChecklist: PASS');
console.log('Reflection 19/19: PASS');
console.log('W12 canonical order: PASS');
console.log('Cache/bootstrap authority: PASS');
console.log('Progress/score/write safety static guard: PASS');
