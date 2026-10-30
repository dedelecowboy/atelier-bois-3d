/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Assemblage tenon – mortaise, commun à la mortaiseuse et à la tenonneuse (déplacé de machines/mortaiseuse/piece.js le 30/10/2026 :
   décidé par l'enseignant, la mortaise se fait AVANT le tenon, car on ajuste le tenon à la mortaise ; le contrôle d'assemblage
   est donc à la tenonneuse). Lecture des mortaises d'une pièce de corroyage (`q.morts`), du tenon d'un bout (`q.ends`), et test d'entrée. */
import * as C from './corroyage.js';
const N = C.N, BIG = C.BIG;
const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});
const ext=q=>({ w:[Math.min(...q.w1),Math.max(...q.w2)], v:[Math.min(...q.v1),Math.max(...q.v2)] });

/* ---------- mortaises de la pièce (lecture au pied à coulisse et au réglet) ---------- */
/* plongées voisines de même section regroupées en une mortaise : face, distances aux bouts, longueur, épaisseur, position
   depuis chaque face, profondeur, débouchante, éclats */
export function mortises(q){ if(!C.hasMorts(q)) return []; const E=ext(q), out=[];
  const info=m=>{ const inf=x=>Math.abs(x)>=BIG/2, dv=inf(m.v0)||inf(m.v1), ax=dv? 'v' : 'w', cx= ax==='v'? 'w' : 'v';
    const [d0,d1]= ax==='v'? [m.v0,m.v1] : [m.w0,m.w1], [lo,hi]=E[ax], through=inf(d0)&&inf(d1);
    const side= through? 'hi' : inf(d1)? 'hi' : 'lo', dep= through? hi-lo : side==='hi'? hi-d0 : d1-lo;
    const [c0,c1]= cx==='v'? [m.v0,m.v1] : [m.w0,m.w1];
    return { ax, side, face: ax==='v'? (side==='hi'?'C2':'C1') : (side==='hi'?'F2':'F1'), c0, c1, dep:Math.min(dep,hi-lo), through, u0:m.u0, u1:m.u1, ec:!!m.ec }; };
  const groups=[];
  for(const m of q.morts){ const I=info(m); let g=groups.find(g=>g.face===I.face&&Math.abs(g.c0-I.c0)<0.05&&Math.abs(g.c1-I.c1)<0.05&&I.u0<=g.u1+0.05&&I.u1>=g.u0-0.05);
    if(g){ g.u0=Math.min(g.u0,I.u0); g.u1=Math.max(g.u1,I.u1); g.dep=Math.min(g.dep,I.dep); g.dmax=Math.max(g.dmax,I.dep); g.through=g.through&&I.through; g.ec=g.ec||I.ec; g.n++; }
    else groups.push({...I, dmax:I.dep, n:1}); }
  // regroupements en chaîne (une plongée qui relie deux mortaises)
  for(let k=0;k<groups.length;k++) for(let j=groups.length-1;j>k;j--){ const a=groups[k], b=groups[j];
    if(a.face===b.face&&Math.abs(a.c0-b.c0)<0.05&&Math.abs(a.c1-b.c1)<0.05&&b.u0<=a.u1+0.05&&b.u1>=a.u0-0.05){ a.u0=Math.min(a.u0,b.u0); a.u1=Math.max(a.u1,b.u1); a.dep=Math.min(a.dep,b.dep); a.dmax=Math.max(a.dmax,b.dmax); a.ec=a.ec||b.ec; a.n+=b.n; groups.splice(j,1); } }
  for(const g of groups){ const cx= g.ax==='v'? 'w' : 'v', [lo,hi]=E[cx];
    out.push({ face:g.face, len:g.u1-g.u0, th:g.c1-g.c0, fromA:g.u0, fromB:q.L-g.u1, fromLo:g.c0-lo, fromHi:hi-g.c1, cx, dep:g.dep, dmax:g.dmax, through:g.through, ec:g.ec, plunges:g.n }); }
  return out.sort((a,b)=>a.fromA-b.fromA); }
/* position de la mortaise depuis la face de référence f (SR1 = F1 ou F2) */
export const fromFace=(m,f)=> (f==='F1'||f==='C1')? m.fromLo : m.fromHi;
/* distance de la mortaise au bout le plus proche, et ce bout */
export const nearEnd=m=> m.fromA<=m.fromB? {e:'A', d:m.fromA} : {e:'B', d:m.fromB};

/* ---------- tenon d'une traverse (pièce de la tenonneuse) et assemblage ---------- */
/* tenon au bout e (joues usinées par les dérouleurs, axe w : pièce à plat) : épaisseur, position depuis F1 et F2, longueur, largeur */
export function tenonOf(q,e){ const R=q.ends&&q.ends[e]; if(!R||!R.cuts.length) return null; const i= e==='A'? 0 : N-1;
  const lo=q.w1[i], hi=q.w2[i], cs=R.cuts.filter(c=>c.ax==='w'&&c.d0<0.5);
  const low=cs.find(c=>c.a<=lo+1e-6), high=cs.find(c=>c.b>=hi-1e-6); if(!low||!high) return null;
  const a=Math.max(lo,low.b), b=Math.min(hi,high.a); if(b<=a) return null;
  const vs=R.cuts.filter(c=>c.ax==='v'&&c.d0<0.5), v0=Math.max(q.v1[i],...vs.filter(c=>c.a<=q.v1[i]+1e-6).map(c=>c.b)), v1=Math.min(q.v2[i],...vs.filter(c=>c.b>=q.v2[i]-1e-6).map(c=>c.a));
  return { th:b-a, fromLo:a-lo, fromHi:hi-b, len:Math.min(low.d1,high.d1), width:v1-v0 }; }
/* le tenon entre-t-il dans la mortaise ? épaisseur (jeu 0 à 0,2 mm), parements affleurants (même distance à SR1),
   longueur de la mortaise = largeur du tenon (0 à 1 mm de jeu), profondeur au moins la longueur du tenon + 1 mm */
export function fit(m, t, s1m='F1', s1t='F1'){ if(!m||!t) return { ok:false, why:'pièces introuvables' };
  const jeu=m.th-t.th, aff=fromFace(m,s1m)-(s1t==='F1'? t.fromLo : t.fromHi), jl=m.len-t.width, jp=m.dep-t.len;
  const why=[]; if(jeu< -0.05) why.push('tenon trop épais'); else if(jeu>0.25) why.push('mortaise trop large (jeu)');
  if(Math.abs(aff)>0.2) why.push('parements décalés de '+fmt(Math.abs(aff))+' mm');
  if(jl< -0.05) why.push('mortaise trop courte'); else if(jl>1.05) why.push('mortaise trop longue');
  if(jp<1-1e-6) why.push(jp<0? 'mortaise pas assez profonde' : 'pas de jeu au fond de la mortaise');
  return { ok:!why.length, why:why.join(', '), jeu, aff, jl, jp }; }

