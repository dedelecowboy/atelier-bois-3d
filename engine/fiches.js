/* Fiches de la machine (présentation) : lecture obligatoire avant l'évaluation (demandé par l'enseignant le 29/10/2026).
   machines/<id>/data/fiches.txt, même format que les fiches des risques généraux (engine/data.js, parseFiches) :
   ## Titre | codes d'organes (bouton « Voir sur la machine ») ; paragraphe ; « - » puce ; « > » source.

   Chaque fiche se lit en entier et se valide par « J'ai lu cette fiche » (en bas de la fiche).
   Mémoire de la lecture : dans Moodle, suspend_data de l'élément (parc.lu, gardée aussi en entraînement) et,
   quand toutes les fiches sont lues, une trace CODE_lecture « 8/8 fiches lues le 29/10/2026 08:40 » ;
   hors Moodle, le navigateur (localStorage, rien n'est bloqué : pas d'évaluation sur la page web).
   Évaluation bloquée tant que toutes les fiches ne sont pas lues (app.js : carte de choix du paquetage ;
   parcours.js : paquetage séparé, la lecture se fait dans la carte du parcours avant le repérage). */
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function createFiches(app, parc){
  const F = app.data.fiches || [];
  const id = app.config.id || 'machine', KEY = 'fiches.lues.'+id;
  const P = parc?.PARC_ON ? parc.parc : null;
  const CODE = (app.config.scorm?.code||id).toUpperCase();
  const listeners = new Set(), mounts = [];
  /* mémoire */
  const get = ()=>{ if(P) return Array.isArray(P.lu)? P.lu : [];
    try{ const a=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(a)? a : []; }catch(e){ return []; } };
  const put = a=>{ if(P){ P.lu=a; parc.scorm.save(); return; } try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(e){} };
  const isRead = i=>get().includes(i);
  const count = ()=>F.reduce((n,_,i)=>n+(isRead(i)?1:0),0);
  const all = ()=>F.length>0 && count()===F.length;
  const need = ()=>F.length>0 && !all();
  let open = -1;                                   // fiche ouverte (une à la fois)

  function mark(i){ if(isRead(i)) return; const was=all(); put([...get(), i].sort((a,b)=>a-b));
    if(!was && all()){
      const now=new Date(), d=now.toLocaleDateString('fr-FR')+' '+now.toTimeString().slice(0,5);
      if(P){ P.luD=d; parc.scorm.inter(`${CODE}_lecture`, 'performance', `${F.length}/${F.length} fiches lues le ${d}`, 'correct'); parc.scorm.save(); }
      app.toast?.(P? 'Toutes les fiches sont lues : l\'évaluation est ouverte.' : 'Toutes les fiches sont lues.'); }
    const nx=F.findIndex((_,k)=>!isRead(k)); open=nx;   // la suivante non lue s'ouvre
    render(); listeners.forEach(f=>f()); }

  function show(f){ const P2=app.parts; P2.select?.(null); P2.highlight(f.parts, 0xd27a1c); app.fichesShow?.(f);
    const info=document.getElementById('info'); if(info) info.innerHTML=`<b>${esc(f.t)}</b><span>${f.parts.map(k=>P2.PARTS[k]?.n).filter(Boolean).join(' · ')}</span>`; }

  function html(o){ const n=count(), pc=F.length? Math.round(100*n/F.length) : 0;
    return `<div class="fiches-prog" data-all="${all()}"><b>Fiches lues : ${n} / ${F.length}</b><span class="fbar"><i style="width:${pc}%"></i></span>`
      + `<span class="fiches-msg">${all()? (o.doneMsg||'Toutes les fiches sont lues.') : (o.todoMsg||'Lisez chaque fiche jusqu\'au bout, puis « J\'ai lu cette fiche ». Obligatoire avant l\'évaluation dans Moodle.')}</span></div>`
      + F.map((f,i)=>{ const lu=isRead(i);
        return `<details class="fiche" data-i="${i}" data-lu="${lu}"${i===open?' open':''}><summary><span class="fnum">${lu?'✓':i+1}</span><span class="ft">${esc(f.t)}</span></summary>`
          + f.blocks.map(b=>b.p?`<p>${esc(b.p)}</p>`:b.ul?`<ul>${b.ul.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p class="src">${esc(b.src)}</p>`).join('')
          + `<div class="fiche-act">${f.parts.length?`<button type="button" class="toggle mini" data-fshow="${i}">${o.voir||'Voir sur la machine'}</button>`:''}`
          + `<button type="button" class="toggle fiche-lu" data-flu="${i}" ${lu?'disabled aria-pressed="true"':''}>${lu?'Fiche lue ✓':'J\'ai lu cette fiche'}</button></div></details>`; }).join(''); }

  function render(){ for(const m of mounts){ const el=m.el; if(!el.isConnected) continue; el.innerHTML=html(m.o);
      el.querySelectorAll('details.fiche').forEach(d=>d.addEventListener('toggle',()=>{ if(d.open){ open=+d.dataset.i;
        el.querySelectorAll('details.fiche[open]').forEach(o=>{ if(o!==d) o.open=false; }); } }));
      el.querySelectorAll('[data-fshow]').forEach(b=>b.onclick=()=>show(F[+b.dataset.fshow]));
      el.querySelectorAll('[data-flu]').forEach(b=>b.onclick=()=>mark(+b.dataset.flu)); }
    const n=document.getElementById('fichesN'); if(n) n.textContent=F.length? `${count()}/${F.length}` : ''; }

  /* el : conteneur ; o : { voir, todoMsg, doneMsg } */
  function mount(el, o={}){ if(!el || !F.length) return; for(let i=mounts.length-1;i>=0;i--) if(mounts[i].el===el || !mounts[i].el.isConnected) mounts.splice(i,1);
    mounts.push({ el, o }); if(open<0) open=Math.max(0, F.findIndex((_,k)=>!isRead(k))); render(); }

  return { list:F, count, all, need, mark, mount, render, onChange:f=>listeners.add(f), get CODE(){ return CODE; } };
}
