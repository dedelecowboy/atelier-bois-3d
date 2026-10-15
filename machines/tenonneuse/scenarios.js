/* Scénarios guidés de la tenonneuse. Les pièces arrivent corroyées (dégauchisseuse puis raboteuse : SR1 et SR2 dressés et
   repérés, largeur et épaisseur faites), en attente dans « Pièces débitées ».
   1. Tenon simple sur une traverse de chêne : longueur à la scie (sous le capot), joue et épaisseur réglées en montant depuis
      SR1, pare-éclat renouvelé et usiné à vide, contrôle au pied à coulisse et au réglet.
   2. Série de traverses de hêtre tenonnées aux deux bouts : pièce d'essai, premier bout de toute la série, butée de longueur
      contre l'arasement, deuxième bout SR1 toujours sur la table ; longueur entre arasements.
   3. Enfourchements sur deux montants de chêne, machine préparée par un autre groupe (fraise de l'unité de toupillage marquée
      n max 4 500 pour un arbre à 6 000 tr/min, dérouleurs qui toucheraient la pièce) et lot avec une pièce trop courte.
   Barème du parcours : 5 critères de 4 points dont « aucune faute grave ». */
import { st, ctx, tool } from './state.js';
import { C_HOME, N_HEAD, HEADS, CHUTE_MIN, PROT_JEU } from './constants.js';
import { toolById, edgesOk } from './tools.js';
import { pieces, newPiece, clearPieces, chariotPiece, atHome, endInfo, fromFace, betweenShoulders, overhang, peKey, H, fmt, cut } from './piece.js';
import { spinning } from './rules.js';
import * as C from '../../engine/corroyage.js';

const lot={};
const near=(v,t,e)=>Math.abs(v-t)<=e+1e-9;
const yes=(ok,a='oui',b='non')=>ok?a:b;
const toolOk=(h,id)=>st.tools[h]===id && edgesOk(toolById(id),st.flips[h],h);
const closed=()=>!st.capot && !st.sel;
const peOk=()=>st.pe.on && st.pe.key===peKey();
const stopped=()=>!HEADS.some(h=>st.run[h]) && !!ctx.model && !spinning();
const onChariot=n=>{ const q=chariotPiece(); return !!q && q===lot[n]; };
const protOk=q=>!!q && st.protH>=H(q)-1e-6 && st.protH<=H(q)+PROT_JEU+1e-6;
const tenonAt=(q,e)=>{ const I=endInfo(q,e); return I && I.items.find(x=>x.type==='tenon'&&x.ax==='w') || null; };
const enfAt=(q,e)=>{ const I=endInfo(q,e); return I && I.items.find(x=>x.type==='enf'&&x.ax==='w') || null; };
const endWith=(q,f)=>['A','B'].find(e=>f(q,e))||null;
const tenonOk=(it,th,pos,len)=>!!it && near(it.th,th,0.1) && near(fromFace(it,'F1'),pos,0.1) && near(it.lenLo,len,0.5) && near(it.lenHi,len,0.5);
const refOk=q=>{ const L=q.log.filter(l=>l.done&&l.cuts.length); return L.length>0 && L.every(l=>l.down==='F1'); };
const noEc=q=>!['A','B'].some(e=>q.ends&&q.ends[e]&&q.ends[e].ec);
const speedLogOk=()=>{ const L=pieces.flatMap(q=>q.log||[]).filter(l=>l.done&&(l.cuts.length||l.chute)); return L.length>0 && L.every(l=>Object.entries(l.tools).every(([h,id])=>!id||toolById(id).nmax>=N_HEAD[h])); };

/* ---------- étapes communes ---------- */
const prep=c=>({k:'Préparation', t:'Préparer le poste', c, checks:[['Aspiration en marche',()=>st.asp]], done:s=>s.checks.every(c=>c[1]())});
const fin={k:'Fin', t:'Ranger et arrêter',
  c:'Le travail est fini : chariot ramené et verrouillé, presse desserrée, pièces mises de côté ; arrêtez les outils (bouton « Arrêt »). Ne quittez le poste qu\'à l\'arrêt complet des outils ; nettoyez à l\'aspirateur, machine hors tension, jamais à la soufflette.',
  checks:[['Aucune pièce sur le chariot',()=>!chariotPiece()],['Chariot en position de chargement, verrouillé',()=>atHome()&&st.lockC],['Outils arrêtés (frein)',stopped]],
  done:s=>s.checks.every(c=>c[1]())};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler les pièces', c, checks:[], results, done:()=>false});
const peStep=c=>({k:'Pare-éclat', t:'Renouveler et usiner le pare-éclat', c,
  checks:[['Pare-éclat usiné aux réglages en cours',peOk],['Chariot ramené en position de chargement',atHome]], done:s=>s.checks.every(c=>c[1]())});

/* ---------- contrôle ---------- */
function rows(mode){ const r=[];
  if(mode==='tenon'){ const q=lot.a; if(!q) return {msg:'Pièce introuvable.'}; const e=endWith(q,tenonAt), it=e&&tenonAt(q,e), I=e&&endInfo(q,e);
    const ref=refOk(q) && q.log.filter(l=>l.done&&l.cuts.length).every(l=>l.back==='C1');
    if(!it) return {rows:[['Épaisseur du tenon 9,0 ± 0,1 mm (pied à coulisse)','—',false],['Tenon à 9,0 ± 0,1 mm de SR1 (pied à coulisse)','—',false],['Longueur des joues 40,0 ± 0,5 mm (réglet)','—',false],['Arasements nets, sans éclat','—',false],['Réglé depuis SR1 (table) et SR2 (guide)',yes(ref),ref]]};
    r.push(['Épaisseur du tenon 9,0 ± 0,1 mm (pied à coulisse)',fmt(it.th)+' mm',near(it.th,9,0.1)],['Tenon à 9,0 ± 0,1 mm de SR1 (pied à coulisse)',fmt(fromFace(it,'F1'))+' mm',near(fromFace(it,'F1'),9,0.1)],
      ['Longueur des joues 40,0 ± 0,5 mm (réglet)',`${fmt(it.lenLo)} / ${fmt(it.lenHi)} mm`,near(it.lenLo,40,0.5)&&near(it.lenHi,40,0.5)],['Arasements nets, sans éclat',I.ec?'éclats':'nets',!I.ec],
      ['Réglé depuis SR1 (table) et SR2 (guide)',yes(ref),ref]); }
  if(mode==='serie'){ const B=['a','b','c'].map(k=>lot[k]); if(B.some(q=>!q)) return {msg:'Pièces introuvables.'};
    const nT=B.filter(q=>tenonOk(tenonAt(q,'A'),8,8,35)&&tenonOk(tenonAt(q,'B'),8,8,35)).length, bs=B.map(betweenShoulders), nL=bs.filter(x=>x!==null&&near(x,500,0.5)).length;
    const ref=B.every(refOk), ec=B.every(noEc), essai=!!lot.e && !!endWith(lot.e,tenonAt) && lot.e.state==='stock';
    r.push(['Tenons conformes aux deux bouts (8,0 à 8,0 de SR1, joues 35,0)',`${nT} / 3`,nT===3],['Longueur entre arasements 500,0 ± 0,5 mm',`${nL} / 3${bs.some(x=>x!==null)?' ('+bs.map(x=>x===null?'—':fmt(x)).join(' ; ')+')':''}`,nL===3],
      ['SR1 sur la table à chaque passe (même référence aux deux bouts)',yes(ref),ref],['Arasements nets, sans éclat',yes(ec),ec],['Pièce d\'essai usinée et contrôlée',yes(essai),essai]); }
  if(mode==='enfourchement'){ const B=['a','b'].map(k=>lot[k]); if(B.some(q=>!q)) return {msg:'Pièces introuvables.'};
    const E=B.map(q=>{ const e=endWith(q,enfAt); return e? enfAt(q,e) : null; });
    const nW=E.filter(x=>x&&near(x.width,9,0.1)&&near(fromFace(x,'F1'),9,0.1)).length, nD=E.filter(x=>x&&near(x.depth,40,0.5)).length;
    const c=lot.c, courte= c.state==='stock' && c.kind==='interdite' && !C.hasEnds(c) && c.L===200;
    const v=speedLogOk(), ec=B.every(noEc), joues=B.every(q=>!['A','B'].some(e=>tenonAt(q,e)||(endInfo(q,e)?.items||[]).some(x=>x.type==='joue')));
    r.push(['Enfourchements de 9,0 ± 0,1 mm à 9,0 ± 0,1 mm de SR1',`${nW} / 2`,nW===2],['Profondeur 40,0 ± 0,5 mm',`${nD} / 2${E.some(Boolean)?' ('+E.map(x=>x?fmt(x.depth):'—').join(' ; ')+')':''}`,nD===2],
      ['Pièce de 200 mm écartée, non usinée',yes(courte,'oui',C.hasEnds(c)?'usinée':'non classée'),courte],['Vitesse ≤ n max des outils à chaque passe',yes(v,'oui','non'),v],['Sans éclat, joues intactes',yes(ec&&joues),ec&&joues]); }
  return {rows:r}; }

/* ---------- pièces de départ (corroyées, telles qu'elles sortent de la raboteuse : SR1 = F1 dessous, SR2 = C1 contre le guide) ---------- */
const DR={s1:'F1',s2:'C1'};
const PIECES={
  libre:[['a',{name:'Traverse',L:600,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:21,dress:DR}],['b',{name:'Traverse 2',L:600,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:22,dress:DR,state:'stock'}],
    ['c',{name:'Cale',L:180,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:23,dress:DR,state:'stock'}]],
  tenon:[['a',{name:'Traverse',L:600,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:21,dress:DR,state:'stock'}]],
  serie:[['e',{name:'Pièce d\'essai',L:450,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:9,dress:DR,state:'stock'}],
    ['a',{name:'Traverse 1',L:600,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:5,dress:DR,state:'stock'}],['b',{name:'Traverse 2',L:600,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:6,dress:DR,state:'stock'}],
    ['c',{name:'Traverse 3',L:600,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:7,dress:DR,state:'stock'}]],
  enfourchement:[['a',{name:'Montant 1',L:700,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:31,dress:DR,state:'stock'}],['b',{name:'Montant 2',L:700,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:32,dress:DR,state:'stock'}],
    ['c',{name:'Montant court',L:200,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:33,dress:DR,state:'stock'}]],
};
/* réglages de départ de la machine (ce qu'un groupe précédent a laissé) */
const BASE={ main:true, cad:false, au:false, filin:false, armed:false, asp:false, sel:0, capot:false, carters:true, head:'sup',
  dec:0, ang:0, butOn:false, presse:false, cx:C_HOME, lockC:true, av:8, mains:'poignee', wedge:false };
const MACH={
  libre:        { lt:40, hInf:9, ep:9, ht:9, pt:-10, but:500, protH:35, pe:null, tools:{scie:'lame400',inf:'dinf180',sup:'dsup180',tou:'enf9'} },
  tenon:        { lt:30, hInf:6, ep:12, ht:9, pt:-10, but:500, protH:80, pe:'ancien', tools:{scie:'lame400',inf:'dinf180',sup:'dsup180',tou:'enf9'} },
  serie:        { lt:40, hInf:9, ep:9, ht:9, pt:-10, but:400, protH:60, pe:'ancien', tools:{scie:'lame400',inf:'dinf180',sup:'dsup180',tou:'enf9'} },
  enfourchement:{ lt:40, hInf:9, ep:9, ht:6, pt:-10, but:500, protH:60, pe:'ancien', tools:{scie:'lame400',inf:'dinf180',sup:'dsup180',tou:'rain250'} },
};
export const LOADERS=Object.fromEntries(Object.entries(PIECES).map(([m,list])=>[m,()=>{ clearPieces(); for(const k in lot) delete lot[k];
  const M=MACH[m]; Object.assign(st,BASE,M); st.tools={...M.tools}; st.pe={on:true,key:M.pe};
  st.run={scie:false,inf:false,sup:false,tou:false}; st.flips={scie:false,inf:false,sup:false,tou:false}; st.locks={scie:false,inf:false,sup:false,tou:false}; st.bl={hInf:false,ep:false,ht:false};
  if(m==='libre'){ st.armed=true; st.asp=true; }
  for(const [k,spec] of list) lot[k]=newPiece(spec); }]));

/* ---------- étapes de chaque mode ---------- */
const capotOpen={k:'Capot', t:'Ouvrir le capot',
  c:'Les compteurs de la scie, du décalage et de la profondeur de toupillage sont sous le capot. Outils arrêtés : sélecteur « Ouverture capot » sur 1, attendez la temporisation (arrêt complet des outils, voyant allumé), puis ouvrez le capot.',
  checks:[['Capot ouvert',()=>st.capot]], done:s=>s.checks.every(c=>c[1]())};
const capotClose=c=>({k:'Capot', t:'Refermer le capot, réarmer', c:c||'Refermez le capot, remettez le sélecteur sur 0, puis réarmez (bouton bleu).',
  checks:[['Capot fermé, sélecteur sur 0',closed],['Machine réarmée',()=>st.armed&&st.main&&!st.cad]], done:s=>s.checks.every(c=>c[1]())});
export const STEPS={
  tenon:[
    prep('Traverse de chêne corroyée (600 × 70 × 27, SR1 et SR2 repérés) : tenon de 9 mm d\'épaisseur, à 9 mm de SR1 (joue du dessous), 40 mm de long. Avant tout : EPI (protection auditive, lunettes, masque si l\'aspiration est insuffisante, pas de bijoux ni de vêtements amples), poste dégagé, aspiration en marche.'),
    capotOpen,
    {k:'Scie', t:'Longueur du tenon',
      c:'Réglez la position de la scie : le trait de scie à 40 mm de l\'arasement, c\'est la longueur du tenon. Vérifiez au passage que l\'unité de toupillage ne touchera pas la pièce (profondeur négative ou nulle).',
      checks:[['Scie : longueur du tenon 40 mm',()=>near(st.lt,40,0.05)],['Unité de toupillage hors de la pièce',()=>st.pt<=0]], done:s=>s.checks.every(c=>c[1]())},
    capotClose(),
    {k:'Dérouleurs', t:'Joue et épaisseur, en montant',
      c:'Sur le dessus de la machine : dérouleur inférieur à 9 mm (hauteur de la joue, distance de SR1 au tenon), épaisseur du tenon 9 mm. Toujours régler en montant : si le compteur est au-dessus de la cote, descendez plus bas, puis remontez.',
      checks:[['Joue du dessous : 9 mm',()=>near(st.hInf,9,0.05)],['Épaisseur du tenon : 9 mm',()=>near(st.ep,9,0.05)],['Réglés en montant (jeu rattrapé)',()=>!st.bl.hInf&&!st.bl.ep]], done:s=>s.checks.every(c=>c[1]())},
    peStep('Le pare-éclat a servi pour d\'autres réglages : renouvelez-le, puis usinez-le à vide. Démarrez la scie, le dérouleur inférieur, le dérouleur supérieur (machine réarmée), déverrouillez le chariot, poussez-le sans pièce, ramenez-le et verrouillez-le.'),
    {k:'Pièce', t:'Poser et serrer la pièce',
      c:'« Reprendre » la traverse : SR1 (la boucle) sur la table du chariot, SR2 (le V) contre le guide, le bout dépasse un peu du trait de scie (5 mm au moins). Serrez la presse. Protecteur avant au plus près, juste au-dessus de la pièce. Mains sur la poignée, avance de 4 à 8 m/min (chêne).',
      checks:[['Traverse sur le chariot, SR1 sur la table, SR2 contre le guide',()=>onChariot('a')&&C.faces(lot.a).down==='F1'&&C.faces(lot.a).back==='C1'],[`Bout au-delà du trait de scie (${CHUTE_MIN} mm au moins)`,()=>onChariot('a')&&overhang(lot.a)>=CHUTE_MIN-1e-6],['Presse serrée',()=>st.presse],
        ['Protecteur avant juste au-dessus de la pièce (10 mm au plus)',()=>protOk(lot.a)],['Mains sur la poignée, avance de 4 à 8 m/min',()=>st.mains==='poignee'&&st.av<=8]],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Usinage', t:'Usiner le tenon',
      c:'Outils en marche, déverrouillez le chariot et poussez-le régulièrement par sa poignée jusqu\'au bout de sa course ; ramenez-le en position de chargement et verrouillez-le avant de desserrer la presse.',
      checks:[['Tenon usiné',()=>!!endWith(lot.a,tenonAt)],['Chariot ramené et verrouillé',()=>atHome()&&st.lockC]], done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez le tenon : épaisseur et position depuis SR1 au pied à coulisse, longueur des joues au réglet, arasements nets, référence respectée.',()=>rows('tenon'))],
  serie:[
    prep('Série de 3 traverses de hêtre corroyées (600 × 60 × 24) : tenons de 8 mm d\'épaisseur, à 8 mm de SR1, 35 mm de long, aux deux bouts, 500 mm entre arasements. Une pièce d\'essai de même section sert à valider les réglages. EPI, poste dégagé, aspiration en marche.'),
    capotOpen,
    {k:'Scie', t:'Longueur du tenon', c:'Scie : trait à 35 mm de l\'arasement. Unité de toupillage hors de la pièce.',
      checks:[['Scie : longueur du tenon 35 mm',()=>near(st.lt,35,0.05)],['Unité de toupillage hors de la pièce',()=>st.pt<=0]], done:s=>s.checks.every(c=>c[1]())},
    capotClose(),
    {k:'Dérouleurs', t:'Joue et épaisseur, en montant',
      c:'Dérouleur inférieur à 8 mm, épaisseur 8 mm. Les compteurs sont à 9 : il faut descendre ; descendez sous la cote, puis remontez à 8 (réglage en montant).',
      checks:[['Joue du dessous : 8 mm',()=>near(st.hInf,8,0.05)],['Épaisseur du tenon : 8 mm',()=>near(st.ep,8,0.05)],['Réglés en montant (jeu rattrapé)',()=>!st.bl.hInf&&!st.bl.ep]], done:s=>s.checks.every(c=>c[1]())},
    peStep('Renouvelez le pare-éclat et usinez-le à vide (scie et dérouleurs en marche, chariot poussé sans pièce, puis ramené et verrouillé).'),
    {k:'Essai', t:'Pièce d\'essai',
      c:'Passez la pièce d\'essai (SR1 sur la table, SR2 contre le guide, presse serrée, protecteur réglé), contrôlez son tenon dans « Bouts de la pièce » (8 × 35 à 8 de SR1), puis mettez-la de côté.',
      checks:[['Pièce d\'essai tenonnée',()=>!!lot.e&&!!endWith(lot.e,tenonAt)],['Pièce d\'essai conforme',()=>{ const e=endWith(lot.e,tenonAt); return !!e&&tenonOk(tenonAt(lot.e,e),8,8,35); }],['Pièce d\'essai mise de côté',()=>lot.e.state==='stock']], done:s=>s.checks.every(c=>c[1]())},
    {k:'Premier bout', t:'Premier bout de toute la série',
      c:'Butée relevée, usinez le premier bout des trois traverses, l\'une après l\'autre : SR1 sur la table, SR2 contre le guide, le bout dépasse du trait de scie, presse serrée. Mettez chaque traverse de côté avant de reprendre la suivante (chariot ramené et verrouillé).',
      checks:[['Traverse 1 : premier tenon',()=>!!tenonAt(lot.a,'A')],['Traverse 2 : premier tenon',()=>!!tenonAt(lot.b,'A')],['Traverse 3 : premier tenon',()=>!!tenonAt(lot.c,'A')]], done:s=>s.checks.every(c=>c[1]())},
    {k:'Butée', t:'Butée de longueur d\'arasement',
      c:'Outils arrêtés : placez la butée de longueur à 500 mm (la distance entre arasements), puis abaissez-la. Elle viendra contre l\'arasement du premier tenon, pas contre son bout.',
      checks:[['Butée à 500 mm',()=>near(st.but,500,0.05)],['Butée abaissée',()=>st.butOn]], done:s=>s.checks.every(c=>c[1]())},
    {k:'Deuxième bout', t:'Deuxième bout, SR1 toujours sur la table',
      c:'Reprenez chaque traverse « Bout pour bout » : SR1 reste sur la table (SR2 passe à l\'opposé du guide), « Contre la butée », serrez, poussez. Le bout est affranchi par la scie à la bonne longueur.',
      checks:[['Traverse 1 : deuxième tenon',()=>!!tenonAt(lot.a,'B')],['Traverse 2 : deuxième tenon',()=>!!tenonAt(lot.b,'B')],['Traverse 3 : deuxième tenon',()=>!!tenonAt(lot.c,'B')]], done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez la série : tenons aux deux bouts (pied à coulisse, réglet), longueur entre arasements (mètre à ruban), même référence, arasements nets.',()=>rows('serie'))],
  enfourchement:[
    prep('Deux montants de chêne corroyés (700 × 70 × 27) : enfourchement de 9 mm de large, à 9 mm de SR1, 40 mm de profondeur, à l\'unité de toupillage. La machine a été préparée par un autre groupe et le lot contient une pièce à ne pas usiner : vérifiez tout. EPI, aspiration en marche.'),
    {k:'Machine', t:'Contrôler et changer l\'outil de toupillage',
      c:'Lisez le marquage de chaque outil (n max) et comparez à la vitesse de son arbre (6 000 tr/min pour l\'unité de toupillage). Outil inadapté : sélecteur sur 1, capot ouvert, machine consignée (interrupteur général 0 + cadenas), carters déposés, arbre bloqué ; montez la fraise à enfourcher de 9 mm, débloquez l\'arbre, remontez les carters, déconsignez.',
      checks:[['Fraise à enfourcher 9 mm montée, dans le sens de l\'arbre',()=>toolOk('tou','enf9')],['Arbre débloqué',()=>!st.locks.tou],['Carters remis en place',()=>st.carters],['Machine déconsignée, interrupteur général sur I',()=>!st.cad&&st.main]], done:s=>s.checks.every(c=>c[1]())},
    {k:'Réglages', t:'Scie et profondeur (sous le capot)',
      c:'Capot ouvert : scie à 40 mm (le bout est affranchi), profondeur d\'usinage de l\'unité de toupillage 40 mm depuis le trait de scie.',
      checks:[['Scie à 40 mm',()=>near(st.lt,40,0.05)],['Profondeur d\'enfourchement 40 mm',()=>near(st.pt,40,0.05)]], done:s=>s.checks.every(c=>c[1]())},
    capotClose(),
    {k:'Hauteurs', t:'Dérouleurs hors de la pièce, fraise à 9 mm en montant',
      c:'Les dérouleurs ne doivent pas toucher la pièce : joue du dessous à 0, épaisseur au-dessus de la pièce (30 mm ou plus). Fraise à enfourcher : bas de l\'outil à 9 mm de la table (de SR1), réglée en montant.',
      checks:[['Dérouleur inférieur à 0 (hors de la pièce)',()=>st.hInf<=0.05],['Dérouleur supérieur au-dessus de la pièce',()=>st.hInf+st.ep>=30-1e-6],['Fraise à enfourcher à 9 mm, réglée en montant',()=>near(st.ht,9,0.05)&&!st.bl.ht]], done:s=>s.checks.every(c=>c[1]())},
    {k:'Lot', t:'Contrôler le lot',
      c:'Regardez chaque pièce du lot (« Pièces débitées »). Une pièce de moins de 250 mm ne se tient pas sur le chariot : la presse la serre trop près des outils. Marquez-la « Pas à la tenonneuse » (on usinera une pièce plus longue, recoupée ensuite).',
      checks:[['Pièce de 200 mm écartée',()=>lot.c.state==='stock'&&lot.c.kind==='interdite']], done:s=>s.checks.every(c=>c[1]())},
    peStep('Renouvelez le pare-éclat, puis usinez-le à vide : scie et unité de toupillage en marche, chariot poussé sans pièce, ramené et verrouillé.'),
    {k:'Usinage', t:'Usiner les deux enfourchements',
      c:'Pour chaque montant : SR1 sur la table, SR2 contre le guide, bout au-delà du trait de scie, presse serrée, protecteur au plus près, mains sur la poignée ; poussez le chariot, ramenez-le, verrouillez, desserrez, mettez de côté.',
      checks:[['Montant 1 enfourché',()=>!!endWith(lot.a,enfAt)],['Montant 2 enfourché',()=>!!endWith(lot.b,enfAt)]], done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez les enfourchements (pied à coulisse : largeur et position depuis SR1 ; réglet : profondeur), le lot et les outils utilisés.',()=>rows('enfourchement'))],
};

/* ---------- parcours évalué : 3 scénarios, 5 critères de 4 points ---------- */
export const SCENS=[
  {mode:'tenon', view:'vop', t:'Tenon simple', intro:'Tenon de 9 × 40 mm à 9 mm de SR1 sur une traverse corroyée : longueur à la scie (sous le capot), joue et épaisseur réglées en montant, pare-éclat usiné, puis contrôle.'},
  {mode:'serie', view:'vop', t:'Série aux deux bouts', intro:'Trois traverses tenonnées aux deux bouts, 500 mm entre arasements : pièce d\'essai, premier bout de toute la série, butée contre l\'arasement, deuxième bout SR1 sur la table.'},
  {mode:'enfourchement', view:'vop', t:'Enfourchement et machine à contrôler', intro:'Enfourchements sur deux montants. La machine a été préparée par un autre groupe et le lot contient une pièce à ne pas usiner : vérifiez tout avant de démarrer.'},
];
export function scenCriteria(m,{dangers,ok}){ const sec=['Aucune faute grave',`${dangers}`,ok];
  const R=rows(m); if(!R.rows) return [['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],sec];
  const r=R.rows;
  if(m==='tenon') return [r[0],r[1],r[2],['Arasements nets, référence respectée',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec];
  if(m==='serie') return [r[0],r[1],r[2],['Sans éclat, pièce d\'essai',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec];
  return [r[0],r[1],r[2],['Vitesse adaptée, sans éclat',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec]; }
