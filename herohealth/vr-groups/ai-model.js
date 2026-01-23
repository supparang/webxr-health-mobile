// === /herohealth/vr-groups/ai-model.js ===
// DL AI Modifiers (TFJS) for GroupsVR
(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const qbool = (k)=>{ const v=(qs(k,'')+'').toLowerCase(); return v==='1'||v==='true'||v==='yes'||v==='on'; };

  const DL_ON = qbool('dl') && qbool('ai') && (String(qs('run','play')||'play').toLowerCase()==='play');
  if (!DL_ON) return;

  let scaler=null, model=null;

  async function loadJSON(url){
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error('fetch fail ' + url);
    return await r.json();
  }

  function standardize(x, mean, scale){
    const out = new Array(x.length);
    for (let i=0;i<x.length;i++){
      const m = mean[i] ?? 0;
      const s = scale[i] ?? 1;
      out[i] = (x[i] - m) / (s || 1);
    }
    return out;
  }

  async function ensure(){
    if (model && scaler) return;

    // tfjs must exist
    if (!root.tf) throw new Error('tfjs missing');

    scaler = await loadJSON('./ai/groups_scaler.json');
    model  = await root.tf.loadGraphModel('./ai/model.json', { fromTFHub:false });
  }

  function pickFeatures(m, feature_cols){
    // metrics -> feature vector ตาม scaler.feature_cols
    const map = m || {};
    return feature_cols.map(k => Number(map[k] ?? 0));
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  async function predictAndApply(m){
    try{
      await ensure();

      const eng = root.GroupsVR && root.GroupsVR.GameEngine;
      if (!eng || !eng.setAIModifiers) return;

      const x = pickFeatures(m, scaler.feature_cols);
      const xs = standardize(x, scaler.mean, scaler.scale);

      const t = root.tf.tensor2d([xs], [1, xs.length], 'float32');
      const y = model.predict(t);
      const arr = await y.data();

      t.dispose(); y.dispose();

      // arr order = scaler.label_cols
      const out = {};
      for (let i=0;i<scaler.label_cols.length;i++){
        out[scaler.label_cols[i]] = arr[i];
      }

      // clamp safety
      const mods = {
        intervalMul: clamp(out.intervalMul ?? 1, 0.75, 1.35),
        lifeMul:     clamp(out.lifeMul     ?? 1, 0.75, 1.35),
        sizeMul:     clamp(out.sizeMul     ?? 1, 0.82, 1.22),
        wrongAdd:    clamp(out.wrongAdd    ?? 0, -0.12, 0.12),
        junkAdd:     clamp(out.junkAdd     ?? 0, -0.12, 0.12),
      };

      eng.setAIModifiers(mods);

    }catch(err){
      // fail-safe: do nothing
      // console.warn('[DL AI] fail', err);
    }
  }

  // listen metrics
  root.addEventListener('groups:metrics', (ev)=>{
    const m = ev.detail || {};
    predictAndApply(m);
  }, { passive:true });

})(window);