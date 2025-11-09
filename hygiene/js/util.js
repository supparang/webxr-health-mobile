export function $(s,root=document){ return root.querySelector(s); }
export function $$(s,root=document){ return Array.from(root.querySelectorAll(s)); }
export function toast(msg){ const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.classList.add('show')); setTimeout(()=>{el.classList.remove('show'); el.remove();}, 2200); }
export function emojiForZone(id){ return (ZONES.find(z=>z.id===id)||{emoji:'🧩'}).emoji; }
