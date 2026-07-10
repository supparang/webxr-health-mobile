/* =========================================================
   EAP Gold Choice Bias Fix v20260710
   V2 NO-CORRECT-SIGNATURE
   - Runs after eap-gold-item-bank.js and before the question engine.
   - Removes explicit test-taking cues such as "Select the longest sentence".
   - Removes the repeated correct-answer signature "The scenario gives...".
   - Rewrites inference + misconceptions into short, similar-length evidence options.
   - Keeps source passage, main, evidence, scoring, and Sheet sync unchanged.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-GOLD-CHOICE-BIAS-FIX-V2-NO-CORRECT-SIGNATURE';
  const BANK_NAME = 'EAP_GOLD_AUTHORED_BANK';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function words(v){ return clean(v).split(/\s+/).filter(Boolean).length; }

  const INFERENCE = {
    1: 'A clear goal with a small action shows useful study planning.',
    2: 'The word is useful only when its meaning fits this context.',
    3: 'The main message is supported by one detail, but it stays limited.',
    4: 'The keyword helps show how ideas are connected in this text.',
    5: 'The claim needs evidence and source purpose before it is accepted.',
    6: 'The summary should keep the central idea in new wording.',
    7: 'The academic version is clearer and more careful than casual wording.',
    8: 'The paragraph is clearer when the ideas follow a logical order.',
    9: 'The answer needs one clear point and one relevant support detail.',
    10: 'The data show a pattern, but they do not prove a cause.',
    11: 'The email should make a polite request with a clear purpose.',
    12: 'The source or AI support should be named honestly and carefully.',
    13: 'The listener should catch the main point before smaller details.',
    14: 'The presentation should keep one message with relevant support.',
    15: 'The final response should connect problem, evidence, and action.'
  };

  const LIMITATION = {
    1: 'This is one learner plan, not proof that every learner improves.',
    2: 'This is one vocabulary use, not a full rule for every context.',
    3: 'This is one short text, not a broad conclusion about all learners.',
    4: 'This is one text signal, not proof of every relationship in the topic.',
    5: 'This is one claim check, not complete proof of the whole issue.',
    6: 'This is one source task, not full evidence of writing mastery.',
    7: 'This is one revision, not proof that all writing is academic.',
    8: 'This is one paragraph task, not a full essay assessment.',
    9: 'This is one paragraph, not a complete research argument.',
    10: 'This is one data pattern, not proof of cause and effect.',
    11: 'This is one email situation, not every academic communication case.',
    12: 'This is one source-use case, not full proof of ethical mastery.',
    13: 'This is one listening example, not a complete lecture record.',
    14: 'This is one presentation task, not proof of every speaking skill.',
    15: 'This is one final scenario, not a complete solution for every context.'
  };

  const GENERIC_FIXES = [
    'Uses one detail, but the conclusion goes beyond the evidence.',
    'Sounds relevant, but misses the main relationship in the source.',
    'Sounds academic, but does not fully match the source evidence.',
    'Repeats source words, but leaves out the needed limitation.'
  ];

  const SESSION_FIXES = {
    3: [
      'Uses one detail, but misses the whole message of the text.',
      'Treats one example as the main idea, even though it is narrower.',
      'Sounds complete, but the conclusion is broader than the evidence.',
      'Lists several details, but misses which idea controls the text.'
    ],
    5: [
      'Accepts a confident claim before checking source purpose.',
      'Uses a true detail, but connects it to an unsupported claim.',
      'Sounds strong, but evidence does not support the conclusion.',
      'Focuses on the topic, but misses claim versus evidence.'
    ],
    6: [
      'Copies a useful sentence, but does not restate the main idea.',
      'Keeps many examples, but makes the summary too broad.',
      'Removes the central message while keeping interesting details.',
      'Changes words, but does not truly paraphrase the source.'
    ],
    10: [
      'Reports one number, but claims a cause the data do not prove.',
      'Uses careful words, but leaves out the group or time period.',
      'Uses the highest figure only, but ignores the overall pattern.',
      'Makes the result dramatic, but goes beyond the evidence.'
    ],
    14: [
      'Mentions support, but leaves the main message unclear.',
      'Uses a confident close, but makes a claim beyond the source.',
      'Keeps interesting details, but lacks one clear message.',
      'Sounds fluent, but misses the needed evidence link.'
    ]
  };

  function isBadCue(text){
    return /(the scenario gives|focused example related to|broader conclusion would need|not a full study|longest|first detail|one example as the main idea|every detail as equally important|without checking|because it sounds formal|only because it sounds|copy|ignore)/i.test(text);
  }

  function balancedSet(sessionNo){ return SESSION_FIXES[sessionNo] || GENERIC_FIXES; }

  function patchSource(sessionNo, source){
    if (!source) return false;
    let changed = false;
    const replacements = balancedSet(sessionNo);

    // Critical: remove the visible correct-answer signature used by the engine.
    const newInference = INFERENCE[sessionNo] || INFERENCE[1];
    if (!source.inference || isBadCue(source.inference) || words(source.inference) > 16) {
      source.originalInference = source.originalInference || source.inference;
      source.inference = newInference;
      changed = true;
    }

    const newLimitation = LIMITATION[sessionNo] || LIMITATION[1];
    if (!source.limitation || isBadCue(source.limitation) || words(source.limitation) > 16) {
      source.originalLimitation = source.originalLimitation || source.limitation;
      source.limitation = newLimitation;
      changed = true;
    }

    if (Array.isArray(source.misconceptions)) {
      source.misconceptions = source.misconceptions.map((item, index) => {
        let out = clean(item);
        if (isBadCue(out) || words(out) < 8 || words(out) > 18) {
          changed = true;
          out = replacements[index % replacements.length];
        }
        return out;
      });
    } else {
      source.misconceptions = replacements.slice();
      changed = true;
    }

    // Make sure all visible distractors are concise and no repeated cue survives.
    source.misconceptions = source.misconceptions.map((item, index) => {
      let out = clean(item);
      if (isBadCue(out) || words(out) < 7 || words(out) > 18) {
        changed = true;
        out = replacements[index % replacements.length];
      }
      return out;
    });

    if (changed) {
      source.choiceBiasFixed = VERSION;
      source.choiceQuality = 'no-correct-signature-balanced-short-options';
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
        rule: 'No visible answer should be guessable by longest length or repeated correct-answer wording.'
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
