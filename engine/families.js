/* Panneaux de réglage par famille (demandé par l'enseignant : mieux distinguer machine, outil, guidage, protection, pièce).

   Dans les fragments HTML de la machine (settings.html, dock.html), chaque groupe de réglages est une section :
     <section class="fam" data-fam="outil" data-key="outil" data-title="Outil">…réglages…</section>
   data-fam : famille (couleur, icône) ; data-key : nom unique du panneau (plusieurs panneaux par famille possibles) ;
   data-title (facultatif) : titre affiché, sinon le nom de la famille.

   initFamilies(app, { parts:{famille:[codes d'organes]}, summary:{clé:()=>texte} }) :
   - en-tête coloré (icône, titre, pastille OK / attention / danger, résumé) ; les alertes [niveau, texte, clé]
     s'affichent aussi dans leur panneau (titre court, texte complet en dépliant) ;
   - ordinateur (plus de 900 px) : tous les panneaux dépliés ; téléphone : un seul déplié à la fois (au départ, celui
     qui a une alerte danger, sinon le premier), les autres réduits à leur résumé ;
   - lien avec la 3D : survoler un panneau (ou toucher son en-tête) éclaire ses organes dans la couleur de la famille ;
     toucher un organe dans la 3D ouvre et fait ressortir son panneau (app.families.reveal, appelé par app.js). */

export const FAMS = {
  machine:    { n:'Machine',    hex:0x4e6a86, ico:'<path d="M12 3v8"/><path d="M6.3 7.5a8 8 0 1 0 11.4 0"/>' },
  outil:      { n:'Outil',      hex:0xd9772b, ico:'<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>' },
  guidage:    { n:'Guidage',    hex:0x2e8b57, ico:'<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>' },
  protection: { n:'Protection', hex:0xe3b505, ico:'<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>' },
  piece:      { n:'Pièce',      hex:0xa8743f, ico:'<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M8 8v8M14 10c1 1 1 3 0 4"/>' },
};
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
/* titre court d'une alerte : avant « : », en minuscules si le texte est en capitales */
function short(t){ let s=t.split(' : ')[0]; if(s.length>90) s=s.slice(0,88)+'…';
  if(s===s.toUpperCase()) s=s.charAt(0)+s.slice(1).toLowerCase(); return s; }

export function initFamilies(app, o={}){
  const $=id=>document.getElementById(id), narrow=matchMedia('(max-width:900px)');
  const famParts=o.parts||{}, summary=o.summary||{};
  /* parts : clé = famille (tous ses panneaux) ou data-key d'un panneau précis ; 'pupitre' = barre du pupitre */
  const partFam={}; for(const [f,list] of Object.entries(famParts)) for(const k of list) partFam[k]=f;
  const secs=[...document.querySelectorAll('section.fam')], byKey={};
  for(const s of secs){
    const fam=s.dataset.fam, F=FAMS[fam]; const key=s.dataset.key||(s.dataset.key=fam); byKey[key]=s; if(!s.id) s.id='fam-'+key;
    const body=document.createElement('div'); body.className='fam-b'; while(s.firstChild) body.appendChild(s.firstChild);
    const al=document.createElement('ul'); al.className='fam-al'; al.hidden=true; body.prepend(al);
    const h=document.createElement('button'); h.type='button'; h.className='fam-h'; h.setAttribute('aria-controls',s.id);
    h.innerHTML=`<span class="fam-i"><svg viewBox="0 0 24 24" aria-hidden="true">${F.ico}</svg></span><span class="fam-t"><b>${esc(s.dataset.title||F.n)}</b><span class="fam-s"></span></span><span class="fam-p" hidden></span><span class="fam-c" aria-hidden="true"></span>`;
    s.append(h, body);
    const hk= famParts[key]? key : fam;
    s.addEventListener('mouseenter',()=>hl(hk,fam)); s.addEventListener('mouseleave',()=>hl(null));
    h.addEventListener('click',e=>{ if(narrow.matches){ open= open===key? null : key; layout(); }
      hl(hk,fam); if(e.pointerType!=='mouse') hlT=setTimeout(()=>hl(null),2500); });
  }
  /* bandeau en tête des réglages : alertes par panneau (cliquables) ; le bouton du schéma s'y range */
  const S=$('settings'), bar=document.createElement('div'); S.classList.add('has-fam'); $('dockSlot')?.querySelector(':scope>h2')?.setAttribute('hidden',''); bar.className='srow fam-bar'; bar.id='famBar';
  bar.innerHTML='<span class="fam-bar-l">Alertes</span><span class="fam-chips" id="famChips"></span>'; S.prepend(bar);
  bar.addEventListener('click',e=>{ const b=e.target.closest('[data-go]'); if(b) show(b.dataset.go,true); });

  /* surbrillance des organes d'une famille dans la 3D */
  let hlT=0;
  function hl(k,fam=k){ clearTimeout(hlT); app.parts.highlight(k? famParts[k]||[] : null, k? FAMS[fam]?.hex : 0); }

  /* repli (téléphone seulement) */
  let open=null, pendingAuto=true, lastMode=null;
  function layout(){ const n=narrow.matches;
    for(const s of secs){ const c=n && s.dataset.key!==open; s.classList.toggle('closed',c);
      const h=s.querySelector('.fam-h'); if(n) h.setAttribute('aria-expanded',String(!c)); else h.removeAttribute('aria-expanded');
      s.querySelector('.fam-c').textContent= n? (c?'▸':'▾') : ''; } }
  narrow.addEventListener('change',layout);

  /* faire ressortir un panneau : ouvert (téléphone), amené dans la colonne visible (ordinateur), contour qui clignote */
  function show(key, scroll){ const s=byKey[key]; if(!s) return;
    if(narrow.matches){ open=key; layout(); }
    if(scroll||!narrow.matches) s.scrollIntoView({block:'nearest', behavior:'smooth'});
    s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); setTimeout(()=>s.classList.remove('flash'),1600); }
  function reveal(part){ const fam=partFam[part];
    if(fam==='pupitre'){ const p=$('pupitre'); if(p){ p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); setTimeout(()=>p.classList.remove('flash'),1600); } return; }
    if(!fam) return; if(byKey[fam]&&byKey[fam].offsetParent!==null) return show(fam,false);
    const s=secs.find(x=>x.dataset.fam===fam && x.offsetParent!==null); if(s) show(s.dataset.key,false); }

  /* alertes et résumés (à chaque rafraîchissement du panneau d'exercice) */
  let akey='';
  function update(alerts){
    if(app.ex.mode!==lastMode){ lastMode=app.ex.mode; pendingAuto=true; }
    const by={}; for(const [l,t,k] of alerts) if(k&&byKey[k]&&(l==='danger'||l==='warn')) (by[k]||(by[k]=[])).push([l,t]);
    const sums=Object.keys(byKey).map(k=>{ try{ return summary[k]?.()||''; }catch(e){ return ''; } });
    const vis=Object.keys(byKey).filter(k=>byKey[k].offsetParent!==null);
    const kk=JSON.stringify([by,sums,vis]); if(kk===akey&&!pendingAuto) return; akey=kk;
    const chips=[];
    Object.keys(byKey).forEach((k,i)=>{ const s=byKey[k], list=by[k]||[], nd=list.filter(a=>a[0]==='danger').length, nw=list.length-nd;
      const p=s.querySelector('.fam-p'); p.hidden=false; p.dataset.l= nd?'danger':nw?'warn':'ok';
      p.textContent= nd? `${nd} danger${nd>1?'s':''}` : nw? `${nw} attention` : 'OK';
      s.querySelector('.fam-s').textContent=sums[i];
      const al=s.querySelector('.fam-al'); al.hidden=!list.length;
      al.innerHTML=list.map(([l,t])=>`<li data-l="${l}"><details><summary>${esc(short(t))}</summary><p>${esc(t)}</p></details></li>`).join('');
      if(list.length&&vis.includes(k)) chips.push(`<button type="button" class="fam-chip" data-go="${k}" data-l="${nd?'danger':'warn'}" style="--c:var(--fam-${s.dataset.fam})">${esc(s.dataset.title||FAMS[s.dataset.fam].n)} · ${nd?nd+' danger'+(nd>1?'s':''):nw+' attention'}</button>`); });
    $('famChips').innerHTML= chips.join('') || '<span class="fam-none">aucune alerte de réglage</span>';
    if(pendingAuto){ pendingAuto=false; const k=Object.keys(byKey);
      open= k.find(x=>(by[x]||[]).some(a=>a[0]==='danger')) || k.find(x=>byKey[x].offsetParent!==null) || k[0]; }
    layout(); }

  const fam={ update, reveal, show, highlight:hl, get open(){ return open; } };
  app.families=fam; layout(); return fam;
}
