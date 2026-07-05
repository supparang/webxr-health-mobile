/* Keep replay source cases semantically clean before generating new forms. */
(()=>{'use strict';
  const mid=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const bank=mid==='s1'?window.AIQuestS1ThaiV646:(window.AIQuestCoreThaiBanksV646||{})[mid];
  if(!bank||bank.__cleanReplaySourceV653)return;
  const copy=row=>[row[0],row[1],Array.isArray(row[2])?row[2].slice():[],row[3]||''];
  const clean=(rows)=>rows.filter(row=>!/^Case (Explain|Repair)\s+/i.test(String(row[0]||''))).map(copy);
  const mechanics=clean(bank.m||[]),knowledge=clean(bank.q||[]);
  bank.m=[...mechanics,...knowledge.slice(0,4)];
  bank.q=knowledge;
  bank.__cleanReplaySourceV653=true;
})();