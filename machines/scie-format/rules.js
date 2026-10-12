/* Règles de la scie à format : alertes de sécurité et de qualité, mesures de la pièce obtenue.
   Une alerte « danger » active au moment où une coupe commence est une faute grave (parcours évalué).
   Règles validées par l'enseignant (ne pas régresser) :
   - tronçonnage en butée contre le guide parallèle, règle du guide PAS en position courte → danger (rejet) ;
   - délignage d'une pièce étroite (< 120 mm) contre la règle du guide en position courte → danger ;
   - rive en flache contre le guide → danger (déligner d'abord au sabot). */
import { lineDist, edgeDir, angDiff, area, clipHalf, zAt, outwardNormal } from '../../engine/poly.js';
import { BLADE_Z, KERF, MAIN_KERF } from './constants.js';
import { st, guideFace, fenceDist } from './state.js';
import { pieces, cut, A, sPts, sAll, toSlider, bandRange, segLen, scoreState, fenceEdge, guideEdge, sabotContact } from './pieces.js';

/* --- contrôles de sécurité et de qualité --- */
function computeAlerts(){ const out=[], p=A(); if(cut.blocked) out.push(['danger',cut.blocked]); if(!p) return out;
  const T=Math.round(p.T*1000), gf=guideFace();
  const Tb=T/Math.cos(st.t*Math.PI/180);   // épaisseur traversée le long de la lame (lame inclinée : plus longue)
  if(st.h<Tb+2) out.push(['danger',`Lame trop basse : elle ne traverse pas la pièce (épaisseur ${T} mm${st.t?`, lame inclinée à ${st.t}° : ${Math.round(Tb)} mm à traverser`:''}).`]);
  else if(st.h>Tb+25) out.push(['warn',`Lame trop haute : faites dépasser la denture d'environ 10 mm (≈ ${Math.round(Tb+10)} mm).`]);
  if(!st.motor) out.push(['info','Moteur arrêté : démarrez-le avant la passe.']);
  if(pieces.some(q=>Math.min(...sAll(q).map(fenceDist))<-0.001)) out.push(['warn','Une pièce chevauche la règle de tronçonnage : cliquez « Contre la règle ».']);
  if(pieces.some(q=>Math.min(...sAll(q).map(v=>v[1]))<gf-0.001)) out.push(['danger','Le guide parallèle est sur le passage de la pièce : reculez-le.']);
  const ge=guideEdge(p), fe=fenceEdge(p), S=sPts(p);
  { const xs=S.map(v=>v[0]), extX=Math.max(...xs)-Math.min(...xs), touchG=Math.abs(Math.min(...S.map(v=>v[1]))-gf)<0.0008;
    if(touchG && extX<2*st.r/1000){ // guide parallèle utilisé comme butée de longueur (tronçonnage)
      if(!st.guideShort) out.push(['danger','RISQUE MAJEUR DE REJET : la pièce est tronçonnée en butée contre le guide parallèle alors que sa règle n\'est pas en position courte. La chute se coince entre la lame et le guide et elle est projetée. Utilisez la butée de la règle de tronçonnage, ou passez la règle du guide en position courte (elle doit s\'arrêter avant la lame).']);
      else out.push(['info','Guide parallèle en position courte utilisé comme butée : la chute se dégage avant d\'atteindre la lame.']); }
    else if(ge){ // délignage contre le guide
      if(st.r<120){ if(st.guideShort) out.push(['danger','RISQUE MAJEUR DE REJET : délignage d\'une pièce étroite (moins de 120 mm) contre la règle du guide en position courte. Après la fin de la règle, la baguette n\'est plus guidée entre la lame et le guide. Passez la règle en position longue et utilisez un poussoir.']);
        else out.push(['warn','Délignage étroit (moins de 120 mm) : utilisez un poussoir.']); }
      else if(p.kind!=='mela' && !st.guideShort) out.push(['warn','Bois massif : passez la règle du guide en position courte (elle doit s\'arrêter au niveau de la lame), sinon risque de pincement et de rejet.']);
      if(!ge.sawn && p.meta.some(m=>m.sawn)) out.push(['warn',`Le chant ${ge.label} contre le guide est brut : la largeur ne sera pas parallèle au chant dressé.`]); } }
  if(st.t>0 && ge) out.push(['warn',`Lame inclinée de ${st.t}° vers le guide : la pièce entre la lame et le guide passe sous la lame et peut être pincée et rejetée. Règle du guide en position courte et poussoir.`]);
  if(st.mit && ge) out.push(['warn',`Règle de tronçonnage orientée à ${st.mit}° : pour un délignage contre le guide, remettez-la à 0°.`]);
  if(fe && !ge && !fe.sawn && p.meta.some(m=>m.sawn)) out.push(['warn',`Le chant ${fe.label} contre la règle est brut : la coupe ne sera pas d'équerre au chant dressé.`]);
  if(!ge && !st.guideShort && bandRange(p)){ const minZ=Math.min(...S.map(v=>v[1])); if(minZ<gf+0.06) out.push(['danger','La chute risque de se coincer entre la lame et le guide parallèle : éloignez le guide.']); }
  if(!fe && !ge && !sabotContact(p) && bandRange(p)) out.push(['warn','La pièce n\'est en appui ni contre la règle, ni contre le guide, ni contre le sabot : coupe non maîtrisée.']);
  if(p.bands&&p.bands.length&&ge&&!ge.sawn) out.push(['danger','Une rive brute (flache) ne doit jamais s\'appuyer contre le guide : la planche peut basculer et être rejetée. Délignez d\'abord une rive au sabot.']);
  if(cut.inProgress) out.push(['info',`Coupe en cours (trait ${cut.letter}) : terminez la passe.`]);
  if(p.kind==='mela'){ const ss=scoreState();
    if(ss==='off') out.push(['info','Inciseur arrêté : sur le mélaminé, la face de dessous va éclater le long du trait.']);
    else if(ss==='low') out.push(['warn','Inciseur trop bas : il doit entailler le panneau de 1 à 2 mm.']);
    else if(ss==='narrow') out.push(['warn',`Largeur d'incision (${st.incW.toFixed(1)} mm) inférieure au trait de lame (${MAIN_KERF.toFixed(1)} mm) : éclats sur les bords du trait.`]);
    else if(ss==='misaligned') out.push(['warn',`Inciseur mal aligné sur la lame (décalage ${st.incOff.toFixed(1)} mm) : éclats d'un côté du trait.`]);
    if(st.inc && st.incH>3) out.push(['warn','Inciseur trop haut : 1 à 2 mm suffisent.']); }
  if(cut.needEvac && !cut.inProgress) out.push(['warn','Chute à évacuer avant de ramener le chariot : « Évacuer les chutes » garde la pièce entourée en orange et retire les autres. Cliquez une pièce pour changer celle qui est gardée.']);
  return out; }

/* --- mesures sur la pièce --- */
function vertexAngles(p){ const P=p.pts,n=P.length,res=[]; for(let j=0;j<n;j++){ const a=P[(j-1+n)%n], o=P[j], b=P[(j+1)%n]; const u=[a[0]-o[0],a[1]-o[1]], w=[b[0]-o[0],b[1]-o[1]];
  res.push({j, deg:Math.acos(Math.max(-1,Math.min(1,(u[0]*w[0]+u[1]*w[1])/(Math.hypot(...u)*Math.hypot(...w)))))*180/Math.PI, both:p.meta[(j-1+n)%n].sawn&&p.meta[j].sawn}); } return res; }
const rightAngle=p=>!!p && vertexAngles(p).some(v=>v.both && Math.abs(v.deg-90)<0.05);
function parallelAt(p,d){ if(!p) return false; const P=p.pts,n=P.length; for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(p.meta[i].sawn&&p.meta[j].sawn && angDiff(edgeDir(P,i),edgeDir(P,j))<0.0009 && Math.abs(lineDist(P,i,j)-d)<0.0005) return true; return false; }
function measure(p){ const P=p.pts; if(P.length!==4) return null;
  const d02=lineDist(P,0,2)*1000, d13=lineDist(P,1,3)*1000, L=Math.max(d02,d13), W=Math.min(d02,d13);
  const diag=Math.abs(Math.hypot(P[2][0]-P[0][0],P[2][1]-P[0][1])-Math.hypot(P[3][0]-P[1][0],P[3][1]-P[1][1]))*1000;
  const dev=Math.max(...vertexAngles(p).map(v=>Math.abs(v.deg-90))); return {L,W,diag,dev,sawn:p.meta.filter(m=>m.sawn).length}; }

/* --- délignage : flache et avivé --- */
function flacheCheck(p){ const no={clean:false,lost:0}; if(!p||!p.bands||!p.bands.length||!bandRange(p)) return no;
  const S=sPts(p); let best=-2,L=null; S.forEach((_,i)=>{ const n=outwardNormal(S,i); if(-n[1]>best){best=-n[1];L=p.meta[i].label;} });
  const bs=p.bands.filter(b=>b.label===L&&b.inner); if(!bs.length) return no; let kept=0, maxIn=-Infinity;
  for(const b of bs){ const P=b.pts.map(q=>toSlider(p,q)); const [C]=clipHalf(P,P.map(()=>null),q=>q[1]>=BLADE_Z+KERF,(a,c)=>zAt(a,c,BLADE_Z+KERF),null); if(C.length>=3) kept+=area(C); for(const q of b.inner) maxIn=Math.max(maxIn,toSlider(p,q)[1]); }
  return {clean:kept<1e-7, margin:Math.max(0,Math.round((BLADE_Z-KERF-maxIn)*1000))}; } // marge entre le trait et le point le plus profond de la flache
function measurePlanche(p){ const P=p.pts,n=P.length; let best=null;
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(p.meta[i].sawn&&p.meta[j].sawn&&segLen(p,i)>1&&segLen(p,j)>1){ const dv=angDiff(edgeDir(P,i),edgeDir(P,j)); if(!best||dv<best.dv) best={dv,W:lineDist(P,i,j)*1000}; }
  const fl=(p.bands||[]).reduce((s,b)=>s+area(b.pts),0); const longSawn=p.meta.filter((m,i)=>m.sawn&&segLen(p,i)>1).length;
  return best? {W:best.W, dev:best.dv*180/Math.PI, flache:fl>1e-7, longSawn} : null; }

/* --- mélaminé --- */
const faceUp=p=>p.flip?'verso':'recto';
const hasChips=p=>!!p&&p.meta.some(m=>m.chips&&(m.chips.recto||m.chips.verso));
function bladeEdge(p){ if(!p) return null; const S=sPts(p); let best=-2,bi=-1; S.forEach((_,i)=>{ const n=outwardNormal(S,i); if(-n[1]>best){best=-n[1];bi=i;} }); return bi>=0?p.meta[bi]:null; }

export { computeAlerts, vertexAngles, rightAngle, parallelAt, measure, flacheCheck, measurePlanche, faceUp, hasChips, bladeEdge };
