/* Plein écran. Dans le paquetage unique, c'est le lecteur SCORM de Moodle entier (sommaire + contenu) qui passe en
   plein écran, dans la page de Moodle (même domaine) : il le reste quand on passe d'une machine à l'atelier, puisque
   seul le contenu du cadre change. Hors du paquetage : la page elle-même, comme avant. */
import { pkg } from './moodlenav.js';
function host(){
  if(pkg() && window.top!==window){ try{ const d=window.top.document;
    return { doc:d, el:d.getElementById('scormpage')||d.getElementById('scorm_layout')||d.documentElement }; }catch(e){} }
  return { doc:document, el:document.documentElement }; }
export const fsOn=()=>{ const { doc }=host(); return !!(doc.fullscreenElement||doc.webkitFullscreenElement); };
export async function toggleFs(){ const { doc, el }=host();
  if(doc.fullscreenElement||doc.webkitFullscreenElement) return (doc.exitFullscreen||doc.webkitExitFullscreen).call(doc);
  if(el!==doc.documentElement && !el.style.background) el.style.background='#fff';   // fond du lecteur en plein écran (sinon noir)
  return (el.requestFullscreen||el.webkitRequestFullscreen).call(el); }
export function onFsChange(fn){ const { doc }=host(); for(const d of new Set([doc, document])){ d.addEventListener('fullscreenchange',fn); d.addEventListener('webkitfullscreenchange',fn); } }
