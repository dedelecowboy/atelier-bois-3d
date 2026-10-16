/* Schéma de principe du réglage, posé sur la vue 3D (demandé par l'enseignant : les réglages le cachaient).
   Il apparaît dès qu'on touche un réglage (curseur, champ, bouton du bloc #settings, ou bouton de la pièce dans le dock),
   et disparaît 6 s après la dernière action, sauf s'il est épinglé (bouton « Schéma du réglage : afficher ») ; × le ferme.
   Chaque machine fournit ses SVG : soit des éléments déjà présents dans ses fragments HTML (déplacés ici, l'id est gardé :
   les fonctions de dessin ne changent pas), soit du HTML à créer.

   initSchema({ sub, svgs:['idSvg', …] | html:'<svg…>', pinIn:'idElement' (sinon en tête de #settings),
                skip:'sélecteur' (éléments qui ne montrent pas le schéma), dock:true (boutons de la pièce), delay:6000 })
   → { show, pin, box } */
export function initSchema(o={}){
  const $=id=>document.getElementById(id), stage=document.querySelector('.stage'), delay=o.delay??6000;
  const box=document.createElement('div'); box.className='schema'; box.id='schema'; box.hidden=true;
  box.innerHTML=`<div class="schema-h"><b>Schéma du réglage</b><span>${o.sub||''}</span><button type="button" class="schema-x" id="schemaX" aria-label="Fermer le schéma">×</button></div><div class="schema-b"></div>`;
  const body=box.querySelector('.schema-b');
  if(o.html) body.innerHTML=o.html;
  for(const id of o.svgs||[]){ const el=$(id); if(el){ el.classList.add('schema-svg'); body.appendChild(el); } }
  stage.appendChild(box);
  // bouton d'épinglage, dans les réglages
  const pinB=document.createElement('button'); pinB.type='button'; pinB.className='toggle mini'; pinB.id='schemaPin';
  pinB.setAttribute('aria-pressed','false'); pinB.title='Affiche en permanence, sur la vue 3D, le schéma de principe du réglage';
  const host= o.pinIn&&$(o.pinIn);
  if(host) host.appendChild(pinB);
  else { const S=$('settings'), row=document.createElement('div'); row.className='srow schema-row'; row.appendChild(pinB); S.insertBefore(row,S.children[1]||null); }
  let pinned=false, t=0;
  const label=()=>{ pinB.textContent= pinned? 'Schéma du réglage : épinglé' : 'Schéma du réglage : afficher'; pinB.setAttribute('aria-pressed',String(pinned)); };
  const show=()=>{ box.hidden=false; box.classList.remove('fade'); clearTimeout(t);
    if(!pinned) t=setTimeout(()=>{ box.classList.add('fade'); t=setTimeout(()=>{ if(!pinned) box.hidden=true; },400); },delay); };
  const pin=on=>{ pinned=on; label(); if(on) show(); else { clearTimeout(t); box.hidden=true; } };
  label();
  pinB.onclick=()=>pin(!pinned);
  box.querySelector('#schemaX').onclick=()=>pin(false);
  // toute action sur un réglage (champ, curseur, bouton d'un bloc .ctl ; pas les commandes de la machine) montre le schéma (phase de capture : les événements de synthèse des tests aussi)
  const S=$('settings'), skip='#schemaPin,#xray,#resetPres'+(o.skip?','+o.skip:'');
  for(const ev of ['input','change','pointerdown']) S.addEventListener(ev,e=>{ const el=e.target.closest('input,select,button'); if(!el||el.closest(skip)) return;
    if(el.tagName==='BUTTON'&&!el.closest('.ctl')) return; show(); },true);
  if(o.dock!==false) document.querySelector('.dock .tools')?.addEventListener('pointerdown',e=>{ if(e.target.closest('button,input')) show(); });
  return { show, pin, box };
}
