/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Géométrie 2D des pièces : polygones convexes [[x,z],…] (repère de la machine ou local). */

export function centroid(P){ let x=0,z=0; for(const q of P){x+=q[0];z+=q[1];} return [x/P.length,z/P.length]; }
export function area(P){ let a=0; for(let i=0;i<P.length;i++){ const [x1,z1]=P[i],[x2,z2]=P[(i+1)%P.length]; a+=x1*z2-x2*z1; } return Math.abs(a)/2; }
/* Découpe Sutherland-Hodgman par un demi-plan. M = métadonnées par arête (arête i = P[i]→P[i+1]),
   cutMeta = métadonnée de la nouvelle arête créée par la coupe. */
export function clipHalf(P,M,inside,inter,cutMeta){ const out=[],om=[],n=P.length;
  for(let i=0;i<n;i++){ const a=P[i], b=P[(i+1)%n], ia=inside(a), ib=inside(b);
    if(ia&&ib){ out.push(a); om.push(M[i]); }
    else if(ia&&!ib){ out.push(a); om.push(M[i]); out.push(inter(a,b)); om.push(cutMeta); }
    else if(!ia&&ib){ out.push(inter(a,b)); om.push(M[i]); } }
  const P2=[],M2=[]; for(let i=0;i<out.length;i++){ const b=out[(i+1)%out.length]; if(Math.hypot(out[i][0]-b[0],out[i][1]-b[1])>1e-7){ P2.push(out[i]); M2.push(om[i]); } }
  return [P2,M2]; }
/* point du segment a-b à la cote z donnée */
export const zAt=(a,b,z)=>{ const t=(z-a[1])/(b[1]-a[1]); return [a[0]+(b[0]-a[0])*t, z]; };
/* normale extérieure de l'arête i */
export function outwardNormal(S,i){ const a=S[i], b=S[(i+1)%S.length]; let nx=b[1]-a[1], nz=-(b[0]-a[0]); const L=Math.hypot(nx,nz)||1; nx/=L; nz/=L;
  const C=centroid(S), mx=(a[0]+b[0])/2-C[0], mz=(a[1]+b[1])/2-C[1]; if(nx*mx+nz*mz<0){ nx=-nx; nz=-nz; } return [nx,nz]; }
/* rectangle englobant minimal (longueur, largeur en mm) */
export function obb(pts){ let best=null; const n=pts.length;
  for(let i=0;i<n;i++){ const a=pts[i], b=pts[(i+1)%n], ang=Math.atan2(b[1]-a[1],b[0]-a[0]), c=Math.cos(ang), sn=Math.sin(ang);
    let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; for(const q of pts){ const u=q[0]*c+q[1]*sn, v=-q[0]*sn+q[1]*c; u0=Math.min(u0,u); u1=Math.max(u1,u); v0=Math.min(v0,v); v1=Math.max(v1,v); }
    if(!best||(u1-u0)*(v1-v0)<best.a) best={a:(u1-u0)*(v1-v0),L:Math.max(u1-u0,v1-v0),W:Math.min(u1-u0,v1-v0)}; }
  return {L:best.L*1000, W:best.W*1000}; }
/* distance entre la droite de l'arête i et le milieu de l'arête j */
export function lineDist(P,i,j){ const n=P.length, a=P[i], b=P[(i+1)%n], c=P[j], d=P[(j+1)%n]; const mx=(c[0]+d[0])/2, mz=(c[1]+d[1])/2;
  return Math.abs((b[0]-a[0])*(a[1]-mz)-(a[0]-mx)*(b[1]-a[1]))/Math.hypot(b[0]-a[0],b[1]-a[1]); }
export function edgeDir(P,i){ const a=P[i], b=P[(i+1)%P.length]; return Math.atan2(b[1]-a[1],b[0]-a[0]); }
export const angDiff=(a,b)=>{ const d=Math.abs(a-b)%Math.PI; return Math.min(d,Math.PI-d); };
