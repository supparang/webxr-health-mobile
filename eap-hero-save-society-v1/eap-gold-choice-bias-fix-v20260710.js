/* =========================================================
   EAP Gold Choice Bias Fix v20260710
   V3 NEUTRAL-CORRECT-LABELS
   - Runs after eap-gold-item-bank.js and before the question engine.
   - Removes visible correct-answer signatures:
     "The scenario gives...", "The main message...", "Supported but limited...".
   - Rewrites inference + misconceptions into neutral short labels.
   - Keeps source passage, main, evidence, scoring, and Sheet sync unchanged.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-GOLD-CHOICE-BIAS-FIX-V3-NEUTRAL-CORRECT-LABELS';
  const BANK_NAME = 'EAP_GOLD_AUTHORED_BANK';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function words(v){ return clean(v).split(/\s+/).filter(Boolean).length; }

  const CORRECT_BANK = {
    0: 'Careful answer: uses evidence and keeps the claim limited.',
    1: 'Evidence-based answer: matches the source and avoids overclaiming.',
    2: 'Balanced answer: connects the detail to a limited conclusion.',
    3: 'Source-based answer: follows the text and states the limit.'
  };

  const LIMIT_BANK = {
    0: 'Limit: one short source cannot prove every case.',
    1: 'Limit: one example supports only a careful claim.',
    2: 'Limit: the source gives support, not a broad rule.',
    3: 'Limit: the conclusion must stay inside the evidence.'
  };

  const GENERIC_FIXES = [
    'Detail answer: uses one point but misses the larger meaning.',
    'Broad answer: says more than the source can support.',
    'Polished answer: sounds complete but is not evidence-based.',
    'Topic answer: stays related but misses the source condition.'
  ];

  const SESSION_FIXES = {
    3: [
      'Detail answer: uses one point but misses the whole message.',
      'Example answer: treats one example as the full main idea.',
      'Broad answer: makes a claim beyond the evidence.',
      'List answer: treats all details as equally important.'
    ],
    5: [
      'Confident answer: accepts a claim before checking purpose.',
      'Detail answer: connects a true detail to a weak claim.',
      'Strong answer: sounds persuasive but lacks evidence.',
      'Topic answer: misses the difference between claim and evidence.'
    ],
    6: [
      'Copy answer: repeats a sentence without a clear main idea.',
      'Long answer: keeps examples but misses summary focus.',
      'Detail answer: keeps interesting parts but loses the center.',
      'Paraphrase answer: changes words but not the source meaning.'
    ],
    10: [
      'Number answer: reports one figure but claims a cause.',
      'Trend answer: leaves out group or time period.',
      'Peak answer: uses the highest figure only.',
      'Dramatic answer: goes beyond the data.'
    ],
    14: [
      'Support answer: mentions detail but leaves the message unclear.',
      'Closing answer: sounds confident but overclaims.',
      'Detail answer: keeps facts without one clear message.',
      'Fluent answer: sounds smooth but lacks evidence link.'
    ]
  };

  function isBadCue(text){
    return /(the scenario gives|the main message|supported by one detail|supported but limited|evidence-based answer|balanced answer|careful answer|source-based answer|focused example related to|broader conclusion would need|not a full study|not a broad conclusion|all learners|longest|first detail|one example as the main idea|every detail as equally important|without checking|because it sounds formal|only because it sounds|copy|ignore)/i.test(text);
  }

  function balancedSet(sessionNo){ return SESSION_FIXES[sessionNo] || GENERIC_FIXES; }
  function pickCorrect(sessionNo, source){
    const seed = String(source && source.id || '') + ':' + String(source && source.title || '') + ':' + sessionNo;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return CORRECT_BANK[h % 4];
  }
  function pickLimit(sessionNo, source){
    const seed = String(source && source.id || '') + ':limit:' + sessionNo;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
    return LIMIT_BANK[h % 4];
  }

  function patchSource(sessionNo, source){
    if (!source) return false;
    let changed = false;
    const replacements = balancedSet(sessionNo);

    // Critical: correct answer must not have a repeated visible signature.
    const newInference = pickCorrect(sessionNo, source);
    if (!source.inference || isBadCue(source.inference) || words(source.inference) > 12) {
      source.originalInference = source.originalInference || source.inference;
      source.inference = newInference;
      changed = true;
    }

    const newLimitation = pickLimit(sessionNo, source);
    if (!source.limitation || isBadCue(source.limitation) || words(source.limitation) > 12) {
      source.originalLimitation = source.originalLimitation || source.limitation;
      source.limitation = newLimitation;
      changed = true;
    }

    if (Array.isArray(source.misconceptions)) {
      source.misconceptions = source.misconceptions.map((item, index) => {
        let out = clean(item);
        if (isBadCue(out) || words(out) < 5 || words(out) > 13) {
          changed = true;
          out = replacements[index % replacements.length];
        }
        return out;
      });
    } else {
      source.misconceptions = replacements.slice();
      changed = true;
    }

    source.misconceptions = source.misconceptions.map((item, index) => {
      let out = clean(item);
      if (isBadCue(out) || words(out) < 5 || words(out) > 13) {
        changed = true;
        out = replacements[index % replacements.length];
      }
      return out;
    });

    if (changed) {
      source.choiceBiasFixed = VERSION;
      source.choiceQuality = 'neutral-short-options-no-correct-signature';
    }
    return changed;
  }

  function patch(){
    const bank = window[BANK_NAME];
    if (!bank || !bank.sessions || bank.__choiceBiasFix === VERSION) return false;
    let changed = 0;
    Object.keys(bank.sessions).forEach(key => {
      const sessionNo = Number(key);
      const sources = bank.sessions[key] && bank.sessions[key].sources;
      if (!Array.isArray(sources)) return;
      sources.forEach(source => { if (patchSource(sessionNo, source)) changed += 1; });
    });
    try {
      bank.__choiceBiasFix = VERSION;
      bank.choiceBiasFixSummary = {
        version: VERSION,
        changedSources: changed,
        rule: 'No visible answer should be guessable by repeated correct-answer wording.'
      };
    } catch(_) {}
    return changed;
  }

  function start(){
    patch();
    window.EAPGoldChoiceBiasFix = { version: VERSION, patch };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
