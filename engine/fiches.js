/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Fiches de la machine (présentation) : lecture obligatoire avant l'évaluation (demandé par l'enseignant le 29/10/2026).
   machines/<id>/data/fiches.txt, même format que les fiches des risques généraux (engine/data.js, parseFiches) :
   ## Titre | codes d'organes (bouton « Voir sur la machine ») ; paragraphe ; « - » puce ; « > » source.

   Chaque fiche se lit en entier et se valide par « J'ai lu cette fiche » (en bas de la fiche).
   Mémoire de la lecture : dans Moodle, suspend_data de l'élément (parc.lu, gardée aussi en entraînement) et,
   quand toutes les fiches sont lues, une trace CODE_lecture « 8/8 fiches lues le 29/10/2026 08:40 » ;
   hors Moodle, le navigateur (localStorage, rien n'est bloqué : pas d'évaluation sur la page web).
   Évaluation bloquée tant que toutes les fiches ne sont pas lues (app.js : carte de choix du paquetage ;
   parcours.js : paquetage séparé, la lecture se fait dans la carte du parcours avant le repérage). */
import { noteFiches } from './permis.js';
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* O (facultatif) : une 2e série de fiches à lecture obligatoire, avec sa propre mémoire (risques généraux : le vestiaire,
   demandé par l'enseignant le 06/11/2026) : { list (fiches lues par parseFiches), key (préfixe localStorage), store (champ de
   suspend_data, 've' : ve, veD, veV), trace (suffixe de l'interaction CODE_<trace>), version, mots:{ lues, lire, lu, tous,
   todo, trace }, onOpen(f, i) (fiche ouverte), extra(f, i) (boutons ajoutés en bas de la fiche, HTML) }. Sans O : comme avant. */
export function createFiches(app, parc, O={}){
  const F = O.list || app.data.fiches || [], MAIN = !O.list;
  const W = { lues:'Fiches lues', lire:'J\'ai lu cette fiche', lu:'Fiche lue ✓', tous:'Toutes les fiches sont lues', trace:'fiches lues',
    todo:'Lisez chaque fiche jusqu\'au bout, puis « J\'ai lu cette fiche ». Obligatoire avant l\'évaluation dans Moodle.', ...(O.mots||{}) };
  const S = O.store || 'lu', SD = S+'D', SV = S+'V';
  const id = app.config.id || 'machine', KEY = (O.key||'fiches')+'.lues.'+id;
  const P = parc?.PARC_ON ? parc.parc : null;
  const CODE = (app.config.scorm?.code||id).toUpperCase();
  const listeners = new Set(), mounts = [];
  /* mémoire */
  /* version des fiches (config.fichesV, 1 par défaut) : la lecture est mémorisée par numéro de fiche ; quand l'ordre ou
     le nombre des fiches change, l'enseignant augmente fichesV et l'ancienne lecture est oubliée (sinon de nouvelles
     fiches seraient marquées « lues » par erreur). Mémoire sans version = version 1. */
  const V = +(O.list? O.version : app.config.fichesV) || 1;
  if(P){ if((+P[SV]||1)!==V){ P[S]=[]; delete P[SD]; } if(V>1) P[SV]=V; }
  else try{ if((+localStorage.getItem(KEY+'.v')||1)!==V){ localStorage.removeItem(KEY); localStorage.setItem(KEY+'.v', V); } }catch(e){}
  const get = ()=>{ if(P) return Array.isArray(P[S])? P[S].filter(i=>i<F.length) : [];
    try{ const a=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(a)? a.filter(i=>i<F.length) : []; }catch(e){ return []; } };
  /* repère « fiches lues » du permis machine (engine/permis.js) : aussi gardé dans le navigateur dans Moodle (indicatif, sans effet) */
  const repere = ()=>{ if(MAIN) noteFiches(id, count(), F.length); };
  const put = a=>{ if(P){ P[S]=a; parc.scorm.save(); repere(); return; } try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(e){} repere(); };
  const isRead = i=>get().includes(i);
  const count = ()=>F.reduce((n,_,i)=>n+(isRead(i)?1:0),0);
  const all = ()=>F.length>0 && count()===F.length;
  const need = ()=>F.length>0 && !all();
  let open = -1;                                   // fiche ouverte (une à la fois)

  function mark(i){ if(isRead(i)) return; const was=all(); put([...get(), i].sort((a,b)=>a-b));
    if(!was && all()){
      const now=new Date(), d=now.toLocaleDateString('fr-FR')+' '+now.toTimeString().slice(0,5);
      if(P){ P[SD]=d; parc.scorm.inter(`${CODE}_${O.trace||'lecture'}`, 'performance', `${F.length}/${F.length} ${W.trace} le ${d}`, 'correct'); parc.scorm.save(); }
      app.toast?.(W.tous+(P && !(app.lectures||[]).some(l=>l.need())? ' : l\'évaluation est ouverte.' : '.')); }
    const nx=F.findIndex((_,k)=>!isRead(k)); open=nx;   // la suivante non lue s'ouvre
    render(); listeners.forEach(f=>f()); }

  function show(f){ const P2=app.parts; P2.select?.(null); P2.highlight(f.parts, 0xd27a1c); app.fichesShow?.(f);
    const info=document.getElementById('info'); if(info) info.innerHTML=`<b>${esc(f.t)}</b><span>${f.parts.map(k=>P2.PARTS[k]?.n).filter(Boolean).join(' · ')}</span>`; }

  function html(o){ const n=count(), pc=F.length? Math.round(100*n/F.length) : 0;
    return `<div class="fiches-prog" data-all="${all()}"><b>${W.lues} : ${n} / ${F.length}</b><span class="fbar"><i style="width:${pc}%"></i></span>`
      + `<span class="fiches-msg">${all()? (o.doneMsg||W.tous+'.') : (o.todoMsg||W.todo)}</span></div>`
      + F.map((f,i)=>{ const lu=isRead(i);
        return (f.sec?`<h4 class="fiches-sec">${esc(f.sec)}</h4>${f.secNote?`<p class="fiches-secnote">${esc(f.secNote)}</p>`:''}`:'')
          + `<details class="fiche" data-i="${i}" data-lu="${lu}"${i===open?' open':''}><summary><span class="fnum">${lu?'✓':i+1}</span><span class="ft">${esc(f.t)}${f.tag?`<small class="ftag">${esc(f.tag)}</small>`:''}</span></summary>`
          + f.blocks.map(b=>b.p?`<p>${esc(b.p)}</p>`:b.ul?`<ul>${b.ul.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p class="src">${esc(b.src)}</p>`).join('')
          + `<div class="fiche-act">${O.extra? O.extra(f,i) : ''}${MAIN && f.parts.length?`<button type="button" class="toggle mini" data-fshow="${i}">${o.voir||'Voir sur la machine'}</button>`:''}`
          + `<button type="button" class="toggle fiche-lu" data-flu="${i}" ${lu?'disabled aria-pressed="true"':''}>${lu?W.lu:W.lire}</button></div></details>`; }).join(''); }

  function render(){ for(const m of mounts){ const el=m.el; if(!el.isConnected) continue; el.innerHTML=html(m.o);
      el.querySelectorAll('details.fiche').forEach(d=>d.addEventListener('toggle',()=>{ if(d.open){ open=+d.dataset.i;
        el.querySelectorAll('details.fiche[open]').forEach(o=>{ if(o!==d) o.open=false; }); O.onOpen?.(F[open], open); } }));
      el.querySelectorAll('[data-fshow]').forEach(b=>b.onclick=()=>show(F[+b.dataset.fshow]));
      el.querySelectorAll('[data-flu]').forEach(b=>b.onclick=()=>mark(+b.dataset.flu)); }
    const n=MAIN && document.getElementById('fichesN'); if(n) n.textContent=F.length? `${count()}/${F.length}` : ''; }

  /* el : conteneur ; o : { voir, todoMsg, doneMsg } */
  function mount(el, o={}){ if(!el || !F.length) return; for(let i=mounts.length-1;i>=0;i--) if(mounts[i].el===el || !mounts[i].el.isConnected) mounts.splice(i,1);
    mounts.push({ el, o }); repere(); if(open<0) open=Math.max(0, F.findIndex((_,k)=>!isRead(k))); render(); }

  return { list:F, count, all, need, mark, mount, render, onChange:f=>listeners.add(f), get CODE(){ return CODE; }, get open(){ return open; }, mots:W };
}
