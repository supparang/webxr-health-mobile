// === /herohealth/gate/helpers/dom.js ===
// Shared DOM helpers for gate modules

export function qs(root, sel){
  return root.querySelector(sel);
}

export function qsa(root, sel){
  return Array.from(root.querySelectorAll(sel));
}

export function el(tag, attrs={}, html=''){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k === 'className') node.className = v;
    else if(k === 'text') node.textContent = v;
    else if(k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  if(html) node.innerHTML = html;
  return node;
}

export function setHtml(node, html){
  if(node) node.innerHTML = html;
}

export function setText(node, text){
  if(node) node.textContent = String(text);
}

export function show(node){
  node?.classList.remove('hidden');
}

export function hide(node){
  node?.classList.add('hidden');
}
