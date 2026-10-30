/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Règles de la scie à ruban : alertes de sécurité et de qualité, blocages.
   Une alerte « danger » active au démarrage de la lame ou pendant l'avance de la pièce est une faute grave (parcours) ;
   certains gestes hors coupe en sont aussi (intervenir sur la lame sans consignation, reculer dans une courbe lame en
   marche, dégager à la main une chute contre la lame en mouvement). Sources : data/sources.txt.
   - lame à l'envers, fissurée, pas tendue, qui déjante → danger au démarrage ;
   - protecteur à plus de 10 mm au-dessus de la pièce → danger ;
   - main dans l'axe de la lame (chantournage) → danger ;
   - fin de passe au guide sans poussoir (au gabarit, les mains sont sur sa poignée : pas de poussoir) (moins de 120 mm entre la lame et l'arrière de la pièce) → danger ;
   - pièce ronde sans gabarit, pièce sur chant instable → danger. */
import { ZONE, PROT_GAP, MIN_TEETH, MAX_TEETH, STAB, E_MAX, GUIDE_LAT, GUIDE_BACK, GUIDE_FRONT, TENSION_TOL } from './constants.js';
import { st, lame, rimPos, wide, dents } from './state.js';
import { cut, cur, onTable, extent, feedMode, footW, chutes, nearBlade, fmt } from './piece.js';

export const broken={ on:false };   // rupture de la lame (mode libre)
/* réglages des guide-lames : liste de défauts [niveau, texte] pour le guide du haut (sup) ou du bas */
export function guideIssues(sup){ const b=lame(); if(!b) return [];
  const L=sup?st.gL:st.gLi, B=sup?st.gB:st.gBi, F=sup?st.gF:st.gFi, h=dents(), w=b.w, n=sup?'supérieur':'inférieur', out=[];
  if(L<GUIDE_LAT[0]) out.push(`galets latéraux du guide ${n} serrés contre la lame : frottement, échauffement, bruit strident`);
  else if(L>GUIDE_LAT[1]+1e-9) out.push(`galets latéraux du guide ${n} trop loin de la lame (${fmt(L)} mm) : la lame est mal tenue, la coupe dérive`);
  if(F<h+GUIDE_FRONT[0]-1e-9) out.push(F<h? `galets du guide ${n} sur la denture : ils abîment les dents et matent la voie` : `galets du guide ${n} trop près du fond de denture`);
  else if(F>h+GUIDE_FRONT[1]+1e-9) out.push(`galets du guide ${n} trop en arrière du fond de denture : la lame est mal tenue`);
  if(B<w+GUIDE_BACK[0]-1e-9) out.push(B<w? `galet arrière du guide ${n} trop en avant : il pousse la lame` : `galet arrière du guide ${n} toujours en contact avec le dos de la lame : il chauffe`);
  else if(B>w+GUIDE_BACK[1]+1e-9) out.push(`galet arrière du guide ${n} trop loin du dos (${fmt(B-w)} mm) : la lame recule dans la coupe et dérive`);
  return out; }
export const guidesOk=sup=>!guideIssues(sup).length;
/* dérive de la lame (mm pour 100 mm d'avance) : tension insuffisante, guides mal réglés, lame trop étroite pour une refente */
export function drift(){ const b=lame(); if(!b) return 0; let d=0;
  if(st.ten<b.w-TENSION_TOL) d+=1.2*(b.w-st.ten)/b.w*3;
  if(st.gL>GUIDE_LAT[1]+1e-9||st.gLi>GUIDE_LAT[1]+1e-9) d+=0.5;
  if(st.gB>b.w+GUIDE_BACK[1]+1e-9||st.gBi>b.w+GUIDE_BACK[1]+1e-9) d+=0.4;
  const p=cur(); if(p&&b.w<20&&p.H>=80) d+=0.6;
  return Math.round(d*100)/100; }
/* distance entre la lame et l'arrière de la pièce (côté opérateur), en mm */
export const remaining=p=>Math.max(0,extent(p).z1);
const protOk=p=>!!p && st.hg>=p.H+PROT_GAP[0] && st.hg<=p.H+PROT_GAP[1];
export { protOk };

/* raisons de refuser (pas des fautes : la machine ne le permet pas) */
export function motorBlock(){ if(st.cad) return 'Machine consignée : retirez votre cadenas et remettez le sectionneur sur I.';
  if(!st.main) return 'Sectionneur sur 0 : remettez-le sur I.';
  if(st.au) return 'Arrêt d\'urgence enfoncé : déverrouillez-le (tournez-le) avant de redémarrer.';
  if(st.doors) return 'Portes des volants ouvertes : la machine ne démarre pas (portes verrouillées). Fermez-les.';
  if(!lame()) return 'Aucune lame montée.';
  if(broken.on) return 'Lame cassée : changez-la (machine consignée).';
  return ''; }
export function feedBlock(spin){ const p=cur(), t=onTable();
  if(!t.length) return 'Pas de pièce sur la table : « Nouvelle pièce » ou « Reprendre » dans « Pièces débitées ».';
  if(t.length>1 && !cut.entered) return 'Dégagez d\'abord les chutes (« Évacuer les chutes », lame arrêtée, ou « Dégager au poussoir ») : seule la pièce gardée (contour orange) reste sur la table.';
  if(!st.motor||spin<0.95) return 'Attendez que la lame tourne à sa vitesse avant d\'engager la pièce.';
  if(st.inv) return 'La lame ne coupe pas : elle est montée à l\'envers (dents vers le haut). Arrêtez, consignez et retournez-la.';
  if(p && st.hg<p.H) return `Le guide-lame (à ${st.hg} mm) bute contre la pièce (${fmt(p.H,0)} mm de haut) : remontez-le 3 à 10 mm au-dessus de la pièce, lame arrêtée.`;
  if(p && feedMode(p)==='fence' && st.mitOn) return 'Guide d\'onglet et guide parallèle en même temps : retirez le guide d\'onglet.';
  return ''; }

export function computeAlerts(spin){ const out=[], b=lame(), p=cur(), t=onTable();
  if(cut.blocked) out.push(['danger',cut.blocked,'piece']);
  if(broken.on) out.push(['danger','LAME CASSÉE : restez à l\'écart, arrêtez la machine (O ou arrêt d\'urgence) et attendez l\'arrêt complet des volants. N\'ouvrez rien avant. Puis consignez et changez la lame.','machine']);
  // lame et machine
  if(b){ const r=rimPos();
    if(st.inv) out.push(['danger','LAME MONTÉE À L\'ENVERS : les dents doivent descendre vers la table. Elle ne coupe pas, chauffe et casse. Consignez et retournez-la.','outil']);
    if(b.crack) out.push(['danger','LAME FISSURÉE : une crique à la soudure. Elle va casser : ne l\'utilisez pas, mettez-la au rebut et signalez-la à l\'affûteur.','outil']);
    if(st.ten<b.w*0.5) out.push(['danger',`LAME PAS TENDUE (indicateur à ${st.ten} pour une lame de ${b.w} mm) : elle sort des volants dès le démarrage. Tendez-la sur ${b.w}, machine arrêtée.`,'outil']);
    else if(st.ten<b.w-TENSION_TOL) out.push(['warn',`Tension insuffisante (${st.ten} pour une lame de ${b.w} mm) : la lame dérive et peut sortir des volants. Réglez l'indicateur sur ${b.w}.`,'outil']);
    else if(st.ten>b.w+TENSION_TOL) out.push(['warn',`Tension trop forte (${st.ten} pour une lame de ${b.w} mm) : le ressort n'amortit plus, la lame peut casser. Réglez l'indicateur sur ${b.w}.`,'outil']);
    if(!st.posOk) out.push(['warn','Position de la lame sur les volants pas vérifiée : machine consignée, portes ouvertes, « Tourner le volant à la main ».','outil']);
    else if(r.frac<0.6) out.push(['danger','LAME QUI DÉJANTE : elle déborde trop du bandage et va sortir du volant. Corrigez le dévers et tournez le volant à la main.','outil']);
    else if(wide()&&r.over<dents()) out.push(['warn',`Dents sur le bandage : une lame large (${b.w} mm) a ses dents en dehors du bandage, sinon elles l'abîment et la voie est matée. Réglez le dévers.`,'outil']);
    else if(!wide()&&Math.abs(r.c)>3) out.push(['warn',`Lame à chantourner pas au milieu du bandage (décalée de ${fmt(r.c,0)} mm) : réglez le dévers.`,'outil']);
    if(b.e>E_MAX) out.push(['warn',`Lame trop épaisse (${fmt(b.e)} mm) pour des volants de 800 mm (0,8 mm au plus) : elle fatigue et casse.`,'outil']);
    for(const s of [true,false]) for(const g of guideIssues(s)) out.push(['warn',g[0].toUpperCase()+g.slice(1)+'.','guides']); }
  else out.push(['info','Aucune lame montée : machine consignée, portes ouvertes, choisissez une lame et « Monter la lame ».','outil']);
  // pièce
  if(p){ const mode=feedMode(p);
    if(st.hg>p.H+PROT_GAP[1]) out.push(['danger',`PROTECTEUR TROP HAUT (${st.hg} mm pour une pièce de ${fmt(p.H,0)} mm) : la lame est accessible au-dessus de la pièce. Descendez le guide-lame à ${PROT_GAP[0]} à ${PROT_GAP[1]} mm au-dessus de la pièce.`,'protection']);
    if(p.round&&!p.gab&&p.gen===0) out.push(['danger','PIÈCE RONDE NON MAINTENUE : un rondin roule sous la lame, il est happé et entraîne la main. Sciez-le dans un gabarit (vé), ou écartez-le.','piece']);
    if(p.chant&&p.H>STAB*footW(p)) out.push(['danger',`PIÈCE INSTABLE : sur chant, ${fmt(p.H,0)} mm de haut pour ${fmt(footW(p),0)} mm d'appui (plus de ${STAB} fois). Elle peut basculer.`,'piece']);
    if(mode==='free'&&st.mains==='axe') out.push(['danger','MAIN DANS L\'AXE DE LA LAME : les mains restent derrière la pointe des dents, de part et d\'autre de la lame, jamais devant elle.','mains']);
    if((mode==='fence'||mode==='miter')&&(cut.entered||cut.inWood)&&remaining(p)<ZONE&&!st.pouss)
      out.push(['danger',`FIN DE PASSE SANS POUSSOIR : la main arrive à moins de ${ZONE} mm de la lame. Prenez le poussoir pour finir la passe.`,'mains']);
    else if(mode==='fence'&&!st.pouss) out.push(['info','Poussoir à portée de main : prenez-le avant la fin de la passe.','mains']);
    if(b){ const n=p.H/b.p; if(n<MIN_TEETH) out.push(['warn',`Pas trop grand (${b.p} mm) pour ${fmt(p.H,0)} mm d'épaisseur : moins de ${MIN_TEETH} dents en prise, la coupe donne des à-coups.`,'outil']);
      else if(n>MAX_TEETH) out.push(['warn',`Pas trop fin (${b.p} mm) pour ${fmt(p.H,0)} mm à scier : la denture bourre de sciure et chauffe.`,'outil']); }
    if(cut.forcing) out.push(['warn',`LA LAME FORCE : elle ne suit pas un rayon plus petit que ${b?.w? (b.w>=30?'son rayon mini (lame large : sciage droit seulement)':'environ '+(rminText(b))+' mm'):'?'}. Elle se tord et peut casser : prenez une lame plus étroite.`,'outil']);
    if((mode==='fence'||mode==='gab')&&p.L>650&&!st.serv) out.push(['warn','Pièce longue : mettez la servante en sortie de table pour la soutenir à l\'horizontale.','table']);
    if(mode==='fence'&&st.tilt) out.push(['info',`Table inclinée à ${st.tilt}° : la coupe sera biaise.`,'table']);
    if(st.speed===3&&p.H>=40) out.push(['warn','Avance trop rapide pour cette épaisseur : la lame chauffe et peut casser (cause de rupture). Prenez une avance normale ou lente.','mains']); }
  if(spin>0.02 && chutes().some(nearBlade)) out.push(['info','Chute contre la lame : dégagez-la au poussoir, ou attendez l\'arrêt complet avant de la prendre à la main.','piece']);
  if(t.length>1&&!cut.entered) out.push(['info','Plusieurs pièces sur la table : gardez la pièce utile (contour orange, cliquez une autre pour la garder) et évacuez les chutes.','piece']);
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche avant de scier (poussières de bois cancérogènes).','machine']);
  if(st.doors) out.push(['info','Portes des volants ouvertes : la machine ne peut pas démarrer.','machine']);
  if(st.cad) out.push(['info','Machine consignée (sectionneur sur 0, cadenassé) : vous pouvez intervenir sur la lame.','machine']);
  if(!st.motor&&spin>0.02) out.push(['info','Lame en cours de freinage : attendez l\'arrêt complet.','machine']);
  else if(!st.motor) out.push(['info','Lame arrêtée.']);
  return out; }
const rminText=b=>({6:20,10:40,15:95,20:140}[b.w]??300);
