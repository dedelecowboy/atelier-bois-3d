/* Paquetage « Atelier bois 3D » (un seul paquetage SCORM, un élément par machine) : on passe d'un élément à l'autre
   par le sommaire du lecteur SCORM de Moodle, qui est sur le même domaine que le contenu.
   window.ATELIER_PKG = { atelier:'Atelier', titles:{ <id machine>:'<titre de l'élément>' } } est posé par le paquetage.
   moodleNav(titre, { before }) rend true si l'élément a été trouvé dans le sommaire (arbre ou liste déroulante) ;
   before() est appelé juste avant de changer d'élément (la machine y ferme sa session SCORM : enregistrement, LMSFinish). */
const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
/* texte d'un élément du sommaire sans la note que Moodle ajoute dans le lien : « 1. Scie radiale (Score : 96) » */
const lab=s=>norm(s).replace(/\s*\((?:score|note|résultat)[^)]*\)\s*$/i,'').trim();
const hit=(a,t)=>{ const x=lab(a.textContent); return x===t || norm(a.title)===t || x.endsWith(' '+t) || x.endsWith(t); };
export function moodleNav(title, { before, doc }={}){
  if(!doc){ if(window.top===window) return false; try{ doc=window.top.document; }catch(e){ return false; } }
  const t=norm(title); if(!t) return false;
  const links=[...doc.querySelectorAll('a')];
  const a= links.find(a=>lab(a.textContent)===t || norm(a.title)===t) || links.find(a=>hit(a,t));
  if(a){ before?.(); a.click(); return true; }
  for(const sel of doc.querySelectorAll('select')){
    const o=[...sel.options].find(o=>norm(o.text).replace(/^[-–>\s]+/,'')===t);
    if(o){ before?.(); sel.value=o.value; sel.dispatchEvent(new Event('change',{ bubbles:true })); return true; } }
  return false; }
export const pkg=()=> window.ATELIER_PKG || null;
/* verrou d'une machine du paquetage (version avec verrous), le même pour l'atelier et pour la machine :
   - Moodle applique le prérequis : l'élément est affiché sans lien dans le sommaire → verrouillé ;
   - sinon, si le sommaire montre le statut de la machine précédente : verrouillé tant qu'elle n'est pas réussie ;
   - sommaire illisible : bilan enregistré dans ce navigateur, et à défaut ouvert (on ne bloque pas un élève par erreur). */
export function pkgLock(id){ const P=pkg(), pre=P?.prereq?.[id]; if(!pre) return null;
  const me=tocInfo(P.titles[id]); if(me?.found && !me.linked) return pre;
  const tp=tocInfo(P.titles[pre]); if(tp?.status) return (tp.status==='passed'||tp.status==='completed')? null : pre;
  let b=null; try{ b=JSON.parse(localStorage.getItem('atelier.bilan.'+pre)||'null'); }catch(e){}
  return b && !b.passed ? pre : null; }
/* état d'un élément d'après le sommaire du lecteur Moodle : trouvé, cliquable (un élément dont le prérequis n'est pas
   rempli y est affiché sans lien), statut d'après le texte de son icône (Réussi / Terminé / Échoué…). null hors Moodle. */
export function tocInfo(title, doc){
  if(!doc){ if(window.top===window) return null; try{ doc=window.top.document; }catch(e){ return null; } }
  const t=norm(title); if(!t) return null;
  const a=[...doc.querySelectorAll('a')].find(a=>hit(a,t));
  let el=a; if(!el) el=[...doc.querySelectorAll('li,span,p,div,td')].find(e=>lab([...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' '))===t);
  if(!el) return { found:false, linked:false, status:null };
  const box=el.closest('li')||el.parentElement||el;
  const txt=[...box.querySelectorAll('img,[title],[aria-label]')].slice(0,4)
    .map(i=>[i.getAttribute('alt'),i.getAttribute('title'),i.getAttribute('aria-label'),i.getAttribute('src')].join(' ')).join(' ').toLowerCase();
  /* nom de l'icône (indépendant de la langue), puis texte français ou anglais */
  const status= /notattempted|non tenté|pas tenté|not attempted|pas commencé|non commencé/.test(txt)? 'notattempted'
    : /passed|réussi/.test(txt)? 'passed' : /failed|échou|échec/.test(txt)? 'failed' : /incomplete|incomplet/.test(txt)? 'incomplete'
    : /browsed|parcouru/.test(txt)? 'browsed' : /completed|termin/.test(txt)? 'completed' : null;
  /* Moodle 4 (thème Boost) : icônes Font Awesome, statut aussi lisible dans la classe (mod_scorm_get_fontawesome_icon_map) */
  const cls=status? '' : [...box.querySelectorAll('i,span.icon,[class*="fa-"]')].map(i=>' '+i.className+' ').join(' ');
  const st2= status || (/ fa-square-check /.test(cls)? 'completed' : / fa-check /.test(cls)? 'passed' : / fa-xmark /.test(cls)? 'failed'
    : / fa-pen-to-square | fa-pause /.test(cls)? 'incomplete' : / fa-eye /.test(cls)? 'browsed' : / fa-square /.test(cls)? 'notattempted' : null);
  /* note affichée par Moodle à côté du titre : « (Score : 96) » / « (Note : 96) » */
  const sc=(box.textContent||'').match(/\((?:score|note|résultat)\s*:?\s*(\d+(?:[.,]\d+)?)\s*\)/i);
  return { found:true, linked:!!a, status:st2, score: sc? Math.round(parseFloat(sc[1].replace(',','.'))) : null }; }
