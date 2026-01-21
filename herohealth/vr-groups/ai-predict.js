/* === /herohealth/vr-groups/ai-predict.js ===
AI Prediction (Browser, no deps)
A) missRisk: P(miss soon)
B) miniFailRisk: P(mini fail)
C) gradeProb: softmax over 6 classes (C..SSS)

Enable:
- Your launcher already gates AI with ?ai=1
- This module only predicts when GroupsVR.AIPredict.setEnabled(true)

Model:
- Stored at localStorage: HHA_GROUPS_MODEL_V1
- Import JSON via GroupsVR.AIPredict.importModelFromText(jsonText)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;
  const NS = root.GroupsVR = root.GroupsVR || {};

  const LS_MODEL = 'HHA_GROUPS_MODEL_V1';

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function sigmoid(x){ x=Number(x)||0; if (x>30) return 1; if (x<-30) return 0; return 1/(1+Math.exp(-x)); }
  function softmax(arr){
    const xs = arr.map(Number);
    let m = -1e9;
    for (let i=0;i<xs.length;i++) m = Math.max(m, xs[i]);
    const ex = xs.map(v => Math.exp(v-m));
    let s = 0; for (let i=0;i<ex.length;i++) s += ex[i];
    if (!isFinite(s) || s<=0) return xs.map(()=>1/xs.length);
    return ex.map(v=>v/s);
  }
  function dot(w,x){
    let s=0;
    const n = Math.min(w.length, x.length);
    for (let i=0;i<n;i++) s += (Number(w[i])||0) * (Number(x[i])||0);
    return s;
  }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } }

  const DEFAULT = {
    meta:{
      featureNames: [],
      gradeLabels: ['C','B','A','S','SS','SSS']
    },
    missHead:{ b:-1.4, w:[] },
    miniHead:{ b:-1.2, w:[] },
    gradeHead:{ b:[0,0,0,0,0,0], W:[] } // W: [6,F]
  };

  function loadModel(){
    try{
      const raw = localStorage.getItem(LS_MODEL);
      if (raw) return Object.assign({}, DEFAULT, JSON.parse(raw));
    }catch(_){}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function saveModel(m){ try{ localStorage.setItem(LS_MODEL, JSON.stringify(m)); }catch(_){} }

  function ensureShape(m, F){
    if (!m.missHead || !Array.isArray(m.missHead.w)) m.missHead = {b:-1.4,w:[]};
    if (!m.miniHead || !Array.isArray(m.miniHead.w)) m.miniHead = {b:-1.2,w:[]};
    if (!m.gradeHead) m.gradeHead = {b:[0,0,0,0,0,0], W:[]};

    if (!m.missHead.w || m.missHead.w.length !== F) m.missHead.w = new Array(F).fill(0);
    if (!m.miniHead.w || m.miniHead.w.length !== F) m.miniHead.w = new Array(F).fill(0);

    if (!m.gradeHead.W || m.gradeHead.W.length !== 6){
      m.gradeHead.W = new Array(6).fill(0).map(()=>new Array(F).fill(0));
    }else{
      for (let k=0;k<6;k++){
        if (!m.gradeHead.W[k] || m.gradeHead.W[k].length !== F){
          m.gradeHead.W[k] = new Array(F).fill(0);
        }
      }
    }

    if (!Array.isArray(m.gradeHead.b) || m.gradeHead.b.length !== 6) m.gradeHead.b = [0,0,0,0,0,0];
    if (!m.meta) m.meta = {};
    if (!Array.isArray(m.meta.gradeLabels) || m.meta.gradeLabels.length !== 6) m.meta.gradeLabels = ['C','B','A','S','SS','SSS'];
    if (!Array.isArray(m.meta.featureNames)) m.meta.featureNames = [];
    return m;
  }

  const AIPredict = NS.AIPredict = NS.AIPredict || {};
  let enabled = false;
  let model = loadModel();
  let last = null;

  AIPredict.setEnabled = function(on){ enabled = !!on; };
  AIPredict.isEnabled  = function(){ return !!enabled; };
  AIPredict.getLast    = function(){ return last; };

  AIPredict.setModel = function(m){
    if (!m) return;
    model = Object.assign({}, DEFAULT, m);
    saveModel(model);
  };
  AIPredict.getModel = function(){ return model; };

  AIPredict.clearModel = function(){
    try{ localStorage.removeItem(LS_MODEL); }catch(_){}
    model = loadModel();
  };

  AIPredict.importModelFromText = function(txt){
    try{
      const obj = JSON.parse(String(txt||'').trim());
      AIPredict.setModel(obj);
      return true;
    }catch(_){
      return false;
    }
  };

  function predictOne(x, featureNames){
    const F = x.length|0;
    model.meta.featureNames = featureNames || model.meta.featureNames || [];
    model = ensureShape(model, F);

    const missRisk = sigmoid(dot(model.missHead.w, x) + (Number(model.missHead.b)||0));
    const miniFailRisk = sigmoid(dot(model.miniHead.w, x) + (Number(model.miniHead.b)||0));

    const logits = [];
    for (let k=0;k<6;k++){
      logits.push(dot(model.gradeHead.W[k], x) + (Number(model.gradeHead.b[k])||0));
    }
    const gradeProb = softmax(logits);
    let bestK = 0, bestP = -1;
    for (let k=0;k<gradeProb.length;k++){ if (gradeProb[k]>bestP){bestP=gradeProb[k]; bestK=k;} }
    const gradeText = (model.meta.gradeLabels && model.meta.gradeLabels[bestK]) ? model.meta.gradeLabels[bestK] : String(bestK);

    return { missRisk, miniFailRisk, gradeProb, gradeText };
  }

  root.addEventListener('groups:features', (ev)=>{
    if (!enabled) return;
    const d = ev.detail || {};
    if (!d || !Array.isArray(d.x)) return;

    const out = predictOne(d.x, d.featureNames || []);
    last = Object.assign({ tSec: d.tSec|0 }, out);
    emit('ai:predict', last);
  }, {passive:true});

})(typeof window!=='undefined'?window:globalThis);