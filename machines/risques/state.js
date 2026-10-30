/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* État des scénarios du module « Risques généraux » (remis à zéro par chaque mode, voir scenarios.js). */
export const st = {
  d: null,   // dangers : { found:{code:{m, ok}}, fa:[codes], pending, fb }
  e: null,   // EPI : { sel:{tâche:[codes]}, res:{tâche:{ok, miss, bad}}, fb }
  c: null,   // consignation : machine, sectionneur, cadenas… et ordre des actions (t)
  f: null,   // départ de feu : choix et ordre des actions (t)
  faults: [],   // fautes graves du scénario en cours (aussi relevées par le parcours SCORM)
};
export const ctx = { app:null, model:null, data:null };
export const $ = id=>document.getElementById(id);
