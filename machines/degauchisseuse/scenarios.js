/* Scénarios guidés de la dégauchisseuse : dresser le plat (SR1), le marquer, dresser le chant (SR2) contre SR1,
   tracer le repère d'angle (petit V à cheval sur l'arête SR1 / SR2), arrêter la machine, contrôler.
   Trois pièces : rectiligne, cintrée sur le plat (creux sur la table, plusieurs passes), fil incliné (sens d'usinage). */
import { st } from './state.js';
import { p, newPiece, faces, mode, againstGuide, concaveDown } from './piece.js';
import { engaged, sr1, sr2, measureD } from './rules.js';

const fmt=(v,n=2)=>v.toLocaleString('fr-FR',{maximumFractionDigits:n});

/* ---------- étapes communes ---------- */
const prep=(c)=>({k:'Préparation', t:'Préparer la machine', c,
  checks:[['Aspiration en marche',()=>st.asp],['Guide à 90° (vérifié à l\'équerre)',()=>st.ga===90],['Profondeur de passe de 1 à 2 mm',()=>st.d>=1&&st.d<=2]],
  done:s=>s.checks.every(c=>c[1]())});
const sr1Step=(c,extra=[])=>({k:'SR1', t:'Dresser le plat (SR1)', c,
  checks:[['Pièce à plat sur la table',()=>!!p&&mode()==='plat'],...extra,['Bec d\'engagement horizontal (dressage du plat)',()=>st.bec==='plat'],['Moteur en marche',()=>st.motor]],
  done:()=>!!sr1()});
const back0=['Pièce ramenée sur la table d\'entrée',()=>!!p&&st.t===0];
const mark1={k:'Repère', t:'Marquer SR1 au crayon',
  c:'Ramenez la pièce en la soulevant, puis « Repère au crayon » : on prend la pièce en main, face dressée sur le dessus, et on trace le repère de parement, une boucle dont la queue rejoint l\'arête. Il dit, pour la suite du corroyage, quelle face est la référence.',
  checks:[back0],
  done:()=>{ const s=sr1(); return !!s&&p.face[s].mark==='loop'; }};
const sr2Step=(c)=>({k:'SR2', t:'Dresser le chant (SR2) d\'équerre', c,
  checks:[['Pièce sur chant',()=>!!p&&mode()==='chant'],['Face SR1 contre le guide',()=>!!p&&againstGuide()&&faces().back===sr1()],['Guide à 90°',()=>st.ga===90],['Bec d\'engagement vertical (dressage du chant)',()=>st.bec==='chant'],['Moteur en marche',()=>st.motor]],
  done:()=>!!sr2()});
const mark2={k:'Repère', t:'Marquer l\'angle droit SR1 / SR2',
  c:'Ramenez la pièce, puis « Repère au crayon » : la vue se rapproche de l\'arête où se rencontrent les deux faces dégauchies. Le repère d\'angle est un petit trait sur SR1, côté angle droit, qui repart sur SR2 : les deux traits forment un petit V qui montre quel angle est droit pour la suite du corroyage.',
  checks:[back0],
  done:()=>{ const s=sr2(); return !!s&&!!p.face[s].mark&&p.face[s].markRef===sr1(); }};
const fin={k:'Fin', t:'Remettre en sécurité',
  c:'Le travail est fini. Vérifiez que la couverture du protecteur est revenue seule sur la table, contre le guide (rappel par ressort) : l\'arbre est entièrement recouvert. Arrêtez le moteur.',
  checks:[['Couverture revenue sur la table, contre le guide',()=>!engaged()],['Moteur arrêté',()=>!st.motor]],
  done:s=>s.checks.every(c=>c[1]())};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler la pièce', c, checks:[], results, done:()=>false});

/* ---------- contrôle final ---------- */
function rows(kind){ const m=measureD(); if(!m) return {msg:'Pas de pièce sur la machine.'};
  const a=m.angle, okA=m.s2!==null&&a!==null&&Math.abs(a-90)<=0.2;
  const r=[['Planéité SR1 (0,05 mm max.)',fmt(m.flat1)+' mm',!!m.s1],['Planéité SR2 (0,05 mm max.)',fmt(m.flat2)+' mm',!!m.s2],
    ['Angle SR1 / SR2 (90 ± 0,2°)',a===null?'—':fmt(a,1)+'°',okA],['Arrachements',m.tear1||m.tear2?'oui':'aucun',!m.tear1&&!m.tear2],
    ['Repères au crayon SR1 et SR2',m.mark1&&m.mark2?'tracés':m.mark1?'SR2 manquant':'manquants',m.mark1&&m.mark2]];
  if(kind==='courbe') r.push(['Épaisseur finale (29,5 mm min.)',fmt(m.T,1)+' mm',m.T>=29.5-1e-6]);
  return {rows:r}; }

/* ---------- pièces de départ ---------- */
const PIECES={
  libre:{L:1000,W:140,T:27,wood:'chene',bow:1,rough:0.6,seed:3},
  rect:{L:800,W:90,T:32,wood:'hetre',bow:0,rough:0.6,seed:5},
  courbe:{L:900,W:120,T:35,wood:'chene',bow:3,rough:0.6,seed:9,k:2},      // posée le bombé sur la table : à retourner
  fil:{L:800,W:100,T:30,wood:'frene',bow:0,rough:0.6,seed:13,sT:0.12,sW:0},     // fil incliné dans l'épaisseur (lu sur le chant)
};
export const LOADERS=Object.fromEntries(Object.entries(PIECES).map(([k,spec])=>[k,()=>newPiece(spec)]));

/* ---------- étapes de chaque mode ---------- */
export const STEPS={
  rect:[
    prep('Planche de hêtre brute de sciage, 800 × 90 × 32 mm, rectiligne. Objectif : dresser une face de référence (SR1) puis un chant d\'équerre (SR2), et les marquer au crayon. Avant tout : EPI, aspiration en marche, guide vérifié à 90°, profondeur de passe de 1 à 2 mm.'),
    sr1Step('Posez la pièce à plat et plaquez-la contre le guide. Orientez le bec d\'engagement du protecteur à l\'horizontale : en arrivant, la pièce soulève la couverture, qui glisse sur elle et redescend seule sur la table après son passage. Démarrez le moteur et passez la pièce sans vous arrêter, mains à plat sur la pièce, en appuyant sur la table de sortie. Ramenez la pièce en la soulevant et repassez jusqu\'à ce que toute la face soit dressée.'),
    mark1,
    sr2Step('Posez la pièce sur chant, la face SR1 plaquée contre le guide réglé à 90°. Orientez le bec d\'engagement à la verticale : la pièce écarte la couverture du guide juste de son épaisseur, et la couverture la plaque contre le guide. Passez la pièce en la tenant des deux mains contre le guide, jusqu\'à ce que le chant soit dressé.'),
    mark2, fin,
    ctrl('Comparez la pièce au cahier des charges : SR1 et SR2 plans, d\'équerre, sans arrachement, repérés au crayon.',()=>rows('rect'))],
  courbe:[
    prep('Planche de chêne de 900 × 120 × 35 mm, cintrée sur le plat (flèche de 3 mm). Objectif : SR1 puis SR2 d\'équerre, sans gaspiller d\'épaisseur (29,5 mm au moins à la fin). Avant tout : EPI, aspiration, guide à 90°, profondeur de 1 à 2 mm.'),
    sr1Step('Regardez la pièce : elle est posée le bombé sur la table et bascule. Retournez-la : le creux sur la table, elle repose sur ses deux bouts et ne bouge plus. Bec d\'engagement à l\'horizontale, passez. Les premières passes n\'usinent que les bouts : repassez jusqu\'à ce que toute la face soit dressée, sans passe inutile.',
      [['Creux sur la table (face concave dessous)',()=>!!p&&concaveDown()]]),
    mark1,
    sr2Step('Posez la pièce sur chant, la face SR1 contre le guide à 90°. Bec d\'engagement à la verticale, dressez le chant.'),
    mark2, fin,
    ctrl('Cahier des charges : SR1 et SR2 plans et d\'équerre, repérés, épaisseur finale de 29,5 mm au moins.',()=>rows('courbe'))],
  fil:[
    prep('Planche de frêne de 800 × 100 × 30 mm dont le fil est incliné. Objectif : SR1 et SR2 sans aucun arrachement. Avant tout : EPI, aspiration, guide à 90°, profondeur de 1 à 2 mm.'),
    sr1Step('Observez le fil sur le chant visible : les fibres doivent monter, depuis la face posée sur la table, vers le bout qui passe en premier sur l\'arbre (on « couche » le fil). Sinon, pivotez la pièce bout pour bout. Bec d\'engagement à l\'horizontale, passez. Si la face est arrachée, retournez la pièce bout pour bout et repassez à 1 mm au moins.'),
    mark1,
    sr2Step('Posez la pièce sur chant, SR1 contre le guide à 90°, bec d\'engagement à la verticale, et dressez le chant. Sur cette planche, le fil n\'est incliné que dans l\'épaisseur : le chant se dresse sans arrachement quel que soit le sens.'),
    mark2, fin,
    ctrl('Cahier des charges : SR1 et SR2 plans, d\'équerre, repérés, sans aucun arrachement.',()=>rows('fil'))],
};

/* ---------- parcours évalué : 3 scénarios, 5 critères de 4 points ---------- */
export const SCENS=[
  {mode:'rect', view:'vop', t:'Pièce rectiligne', intro:'Dressage d\'une planche de hêtre rectiligne : SR1, puis SR2 d\'équerre, avec les repères au crayon.'},
  {mode:'courbe', view:'vop', t:'Pièce cintrée', intro:'Dressage d\'une planche de chêne cintrée : creux sur la table, plusieurs passes, sans gaspiller d\'épaisseur.'},
  {mode:'fil', view:'vop', t:'Fil incliné', intro:'Dressage d\'une planche de frêne au fil incliné : lire le fil et usiner dans le bon sens, sans arrachement.'},
];
export function scenCriteria(m, {dangers, ok}){ const d=measureD(), nb=`${dangers}`;
  if(!d) return [['SR1 dressé','—',false],['SR2 dressé','—',false],['Angle SR1 / SR2','—',false],['Pièce','—',false],['Aucune faute grave',nb,ok]];
  const okA=d.s2!==null&&d.angle!==null&&Math.abs(d.angle-90)<=0.2, ang=d.angle===null?'—':fmt(d.angle,1)+' deg';
  const c1=['SR1 dressé',fmt(d.flat1)+' mm',!!d.s1], c2=['SR2 dressé',fmt(d.flat2)+' mm',!!d.s2], c3=['Angle SR1 / SR2 90 ± 0,2°',ang,okA];
  const rep=['Repères au crayon',d.mark1&&d.mark2?'traces':'manquants',d.mark1&&d.mark2], sec=['Aucune faute grave',nb,ok];
  if(m==='courbe') return [c1,c2,c3,['Épaisseur finale 29,5 mm min.',fmt(d.T,1)+' mm',d.T>=29.5-1e-6],sec];
  if(m==='fil') return [['SR1 dressé sans arrachement',fmt(d.flat1)+' mm',!!d.s1&&!d.tear1],['SR2 dressé sans arrachement',fmt(d.flat2)+' mm',!!d.s2&&!d.tear2],c3,rep,sec];
  return [c1,c2,c3,rep,sec]; }
