// === core/leaderboard.js (localStorage, scopes, render)
export class Leaderboard {
  constructor(opts = {}) {
    this.key = String(opts.key || 'hha_board');
    this.maxKeep = Math.max(50, opts.maxKeep|0 || 300);
    this.retentionDays = Math.max(7, opts.retentionDays|0 || 180);
    this.entries = this._load();
    this._gc();
  }
  submit(mode, diff, score, { name, meta } = {}) {
    const ts = Date.now();
    const entry = { ts, mode:String(mode||''), diff:String(diff||''), score:score|0, name:sanitizeName(name), meta:meta||{} };
    this.entries.push(entry); this._save();
  }
  renderInto(el, { scope='month' } = {}) {
    if (!el) return;
    const data = this._scoped(scope);
    const top = data.slice().sort((a,b)=> b.score - a.score || a.ts - b.ts).slice(0, 50);
    el.innerHTML = `
      <table>
        <thead><tr><th>Rank</th><th>Name</th><th>Mode</th><th>Diff</th><th>Score</th><th>Date</th></tr></thead>
        <tbody>${top.map((e,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(e.name||'Player')}</td><td>${escapeHtml(shortMode(e.mode))}</td><td>${escapeHtml(e.diff)}</td><td style="font-weight:900">${e.score|0}</td><td>${fmtDate(e.ts)}</td></tr>`).join('')}</tbody>
      </table>`;
  }
  getInfo(scope='month'){ const data=this._scoped(scope); const best=data.reduce((m,e)=> e.score>m?e.score:m,0); const txt=`Scope: ${scope.toUpperCase()} • Records: ${data.length} • Best: ${best}`; return { text:txt }; }
  _scoped(scope){ const now=Date.now(); if(scope==='all') return this.entries.slice(); const d=new Date(); let from=0;
    if(scope==='week'){ const day=(d.getDay()+6)%7; const start=new Date(d.getFullYear(), d.getMonth(), d.getDate()); start.setDate(start.getDate()-day); start.setHours(0,0,0,0); from=+start; }
    else if(scope==='month'){ const start=new Date(d.getFullYear(), d.getMonth(), 1); start.setHours(0,0,0,0); from=+start; }
    else if(scope==='year'){ const start=new Date(d.getFullYear(), 0, 1); start.setHours(0,0,0,0); from=+start; }
    else from=0; return this.entries.filter(e=>e.ts>=from); }
  _gc(){ const cutoff=Date.now()-this.retentionDays*24*60*60*1000; this.entries=this.entries.filter(e=>e.ts>=cutoff); this.entries.sort((a,b)=> b.score - a.score || a.ts - b.ts); if(this.entries.length>this.maxKeep) this.entries.length=this.maxKeep; this._save(); }
  _load(){ try{ const raw=localStorage.getItem(this.key); if(!raw) return []; const arr=JSON.parse(raw); return Array.isArray(arr)?arr.filter(validEntry):[]; }catch{ return []; } }
  _save(){ try{ this._gc(); localStorage.setItem(this.key, JSON.stringify(this.entries)); }catch{} }
}
function validEntry(e){ return e && Number.isFinite(e.ts) && Number.isFinite(e.score); }
function sanitizeName(s){ const t=String(s||'').trim(); if(!t) return ''; return t.slice(0,24).replace(/\s+/g,' '); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDate(ts){ const d=new Date(ts); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${day} ${hh}:${mm}`; }
function shortMode(m){ if(m==='goodjunk') return 'Good vs Junk'; if(m==='groups') return '5 Groups'; if(m==='hydration') return 'Hydration'; if(m==='plate') return 'Healthy Plate'; return m||''; }
