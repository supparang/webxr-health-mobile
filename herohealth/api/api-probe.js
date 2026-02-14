// === /herohealth/api/api-probe.js ===
// Safe endpoint probe (no Apollo)

'use strict';

export async function probeEndpoint(endpoint){
  const url = String(endpoint || '').trim();
  if(!url){
    return { ok:false, status:0, error:'NO_ENDPOINT' };
  }

  try{
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ ping:true })
    });

    return {
      ok: res.status === 200,
      status: res.status,
      statusText: res.statusText || '',
    };
  }catch(err){
    return {
      ok:false,
      status:0,
      error: String(err?.message || err || 'FETCH_FAILED')
    };
  }
}