/* Paquetage « Atelier bois 3D » (un seul paquetage SCORM, un élément par machine) : on passe d'un élément à l'autre
   par le sommaire du lecteur SCORM de Moodle, qui est sur le même domaine que le contenu.
   window.ATELIER_PKG = { atelier:'Atelier', titles:{ <id machine>:'<titre de l'élément>' } } est posé par le paquetage.
   moodleNav(titre, { before }) rend true si l'élément a été trouvé dans le sommaire (arbre ou liste déroulante) ;
   before() est appelé juste avant de changer d'élément (la machine y ferme sa session SCORM : enregistrement, LMSFinish). */
const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
export function moodleNav(title, { before, doc }={}){
  if(!doc){ if(window.top===window) return false; try{ doc=window.top.document; }catch(e){ return false; } }
  const t=norm(title); if(!t) return false;
  const links=[...doc.querySelectorAll('a')];
  const a= links.find(a=>norm(a.textContent)===t || norm(a.title)===t) || links.find(a=>norm(a.textContent).endsWith(t));
  if(a){ before?.(); a.click(); return true; }
  for(const sel of doc.querySelectorAll('select')){
    const o=[...sel.options].find(o=>norm(o.text).replace(/^[-–>\s]+/,'')===t);
    if(o){ before?.(); sel.value=o.value; sel.dispatchEvent(new Event('change',{ bubbles:true })); return true; } }
  return false; }
export const pkg=()=> window.ATELIER_PKG || null;
