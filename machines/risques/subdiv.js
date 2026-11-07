/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Subdivision de Loop des élèves, faite AU CHARGEMENT de la page (demandé par l'enseignant le 07/11/2026 : alléger la
   page). Le fichier eleves.glbz garde les maillages riggés de Meshy (10 000 faces) ; chacun est arrondi ici en
   ≈ 41 000 faces, exactement comme tools/personnage/meshy/subdiv_rig.py (même règle, même ordre des sommets), pour que
   la texture recuite sur le maillage subdivisé (recuire_texture.py) tombe juste.
   - positions : règle de Loop calculée sur le maillage « soudé » (sommets de même position = même `weld`) : les coutures
     de texture ne s'ouvrent pas ; arêtes de bord : milieu ; sommets de bord : 3/4 + 1/8 + 1/8 ;
   - coordonnées de texture : le nouveau point est projeté sur son triangle d'origine et prend les coordonnées de ce
     point (la texture ne glisse pas) ; poids des os : moyenne, 4 plus forts gardés ;
   - normales lissées à travers les coutures.
   Entrées : P (x, y, z par sommet), UV, J (4 os), W (4 poids), F (3 sommets par face), weld (identifiant soudé par
   sommet), part (étiquette par face, recopiée sur les 4 faces filles). */
export function loop({ P, UV, J, W, F, weld, part }){
  const nv=P.length/3, nf=F.length/3; let nw=0; for(let i=0;i<nv;i++) if(weld[i]+1>nw) nw=weld[i]+1;
  const Pw=new Float64Array(nw*3); for(let i=0;i<nv;i++){ const w=weld[i]; Pw[w*3]=P[i*3]; Pw[w*3+1]=P[i*3+1]; Pw[w*3+2]=P[i*3+2]; }
  /* arêtes soudées : nombre de faces voisines, somme des sommets opposés */
  const EK=new Map(), Ea=[], Eb=[], Ec=[], Eo=[];
  const ekey=(a,b)=>a<b? a*nw+b : b*nw+a;
  for(let f=0;f<nf;f++) for(let k=0;k<3;k++){ const a=weld[F[f*3+k]], b=weld[F[f*3+(k+1)%3]], c=weld[F[f*3+(k+2)%3]], key=ekey(a,b);
    let e=EK.get(key); if(e===undefined){ e=Ea.length; EK.set(key,e); Ea.push(Math.min(a,b)); Eb.push(Math.max(a,b)); Ec.push(0); Eo.push(0,0,0); }
    Ec[e]++; Eo[e*3]+=Pw[c*3]; Eo[e*3+1]+=Pw[c*3+1]; Eo[e*3+2]+=Pw[c*3+2]; }
  const ne=Ea.length, Em=new Float64Array(ne*3);
  const nbS=new Float64Array(nw*3), nbC=new Float64Array(nw), bS=new Float64Array(nw*3), bC=new Float64Array(nw);
  for(let e=0;e<ne;e++){ const a=Ea[e], b=Eb[e], inner=Ec[e]===2;
    for(let d=0;d<3;d++){ const pa=Pw[a*3+d], pb=Pw[b*3+d];
      Em[e*3+d]= inner? 3/8*(pa+pb)+1/8*Eo[e*3+d] : 0.5*(pa+pb);
      nbS[a*3+d]+=pb; nbS[b*3+d]+=pa; if(!inner){ bS[a*3+d]+=pb; bS[b*3+d]+=pa; } }
    nbC[a]++; nbC[b]++; if(!inner){ bC[a]++; bC[b]++; } }
  const Pv=new Float64Array(nw*3);
  for(let v=0;v<nw;v++){ const n=Math.max(nbC[v],1), beta= n===3? 3/16 : 3/(8*n);
    for(let d=0;d<3;d++){ const p=Pw[v*3+d];
      Pv[v*3+d]= bC[v]>0? (bC[v]===2? 0.75*p+0.125*bS[v*3+d] : p) : (1-n*beta)*p+beta*nbS[v*3+d]; } }
  /* arêtes non soudées (une par paire de sommets) : un nouveau sommet chacune, dans l'ordre de subdiv_rig.py */
  const keys=[], kset=new Set(); const ukey=(a,b)=>a<b? a*nv+b : b*nv+a;
  for(let f=0;f<nf;f++) for(let k=0;k<3;k++){ const key=ukey(F[f*3+k],F[f*3+(k+1)%3]); if(!kset.has(key)){ kset.add(key); keys.push(key); } }
  keys.sort((a,b)=>a-b); const UI=new Map(); keys.forEach((k,i)=>UI.set(k,i));
  const nu=keys.length, N=nv+nu;
  const oP=new Float32Array(N*3), oUV=new Float32Array(N*2), oJ=new Uint8Array(N*4), oW=new Float32Array(N*4), oWeld=new Uint32Array(N);
  for(let i=0;i<nv;i++){ const w=weld[i]; oWeld[i]=w; for(let d=0;d<3;d++) oP[i*3+d]=Pv[w*3+d]; oUV[i*2]=UV[i*2]; oUV[i*2+1]=UV[i*2+1];
    for(let d=0;d<4;d++){ oJ[i*4+d]=J[i*4+d]; oW[i*4+d]=W[i*4+d]; } }
  const acc=new Map();
  for(let u=0;u<nu;u++){ const key=keys[u], a=Math.floor(key/nv), b=key-a*nv, i=nv+u, e=EK.get(ekey(weld[a],weld[b]));
    oWeld[i]=nw+e; for(let d=0;d<3;d++) oP[i*3+d]=Em[e*3+d];
    oUV[i*2]=0.5*(UV[a*2]+UV[b*2]); oUV[i*2+1]=0.5*(UV[a*2+1]+UV[b*2+1]);
    acc.clear(); for(const s of [a,b]) for(let d=0;d<4;d++){ const w=W[s*4+d]; if(w>0){ const j=J[s*4+d]; acc.set(j,(acc.get(j)||0)+0.5*w); } }
    const top=[...acc.entries()].sort((x,y)=>y[1]-x[1]).slice(0,4); let s=0; for(const t of top) s+=t[1];
    top.forEach((t,d)=>{ oJ[i*4+d]=t[0]; oW[i*4+d]=t[1]/(s||1); }); }
  /* triangle d'origine de chaque sommet (le dernier écrit, comme numpy) et faces filles */
  const parent=new Int32Array(N), mid=new Int32Array(nf*3);
  for(let f=0;f<nf;f++) for(let k=0;k<3;k++) parent[F[f*3+k]]=f;
  for(let k=0;k<3;k++) for(let f=0;f<nf;f++){ const u=nv+UI.get(ukey(F[f*3+k],F[f*3+(k+1)%3])); parent[u]=f; mid[f*3+k]=u; }
  /* texture recalée sur le triangle d'origine */
  for(let i=0;i<N;i++){ const f=parent[i], A=F[f*3], B=F[f*3+1], C=F[f*3+2];
    const e1x=P[B*3]-P[A*3], e1y=P[B*3+1]-P[A*3+1], e1z=P[B*3+2]-P[A*3+2], e2x=P[C*3]-P[A*3], e2y=P[C*3+1]-P[A*3+1], e2z=P[C*3+2]-P[A*3+2];
    const qx=oP[i*3]-P[A*3], qy=oP[i*3+1]-P[A*3+1], qz=oP[i*3+2]-P[A*3+2];
    const d11=e1x*e1x+e1y*e1y+e1z*e1z, d12=e1x*e2x+e1y*e2y+e1z*e2z, d22=e2x*e2x+e2y*e2y+e2z*e2z, q1=qx*e1x+qy*e1y+qz*e1z, q2=qx*e2x+qy*e2y+qz*e2z;
    const den=d11*d22-d12*d12; if(!(Math.abs(den)>1e-14)) continue;
    let v=(d22*q1-d12*q2)/den, w=(d11*q2-d12*q1)/den; v=Math.min(1,Math.max(0,v)); w=Math.min(1,Math.max(0,w)); const sw=v+w; if(sw>1){ v/=sw; w/=sw; }
    for(let d=0;d<2;d++) oUV[i*2+d]=UV[A*2+d]+v*(UV[B*2+d]-UV[A*2+d])+w*(UV[C*2+d]-UV[A*2+d]); }
  const oF=new Uint32Array(nf*12), oPart=part? new Uint8Array(nf*4) : null;
  for(let f=0;f<nf;f++){ const a=F[f*3], b=F[f*3+1], c=F[f*3+2], m01=mid[f*3], m12=mid[f*3+1], m20=mid[f*3+2];
    const T=[[a,m01,m20],[b,m12,m01],[c,m20,m12],[m01,m12,m20]];
    for(let j=0;j<4;j++){ const o=(j*nf+f)*3; oF[o]=T[j][0]; oF[o+1]=T[j][1]; oF[o+2]=T[j][2]; if(oPart) oPart[j*nf+f]=part[f]; } }
  return { P:oP, UV:oUV, J:oJ, W:oW, F:oF, weld:oWeld, part:oPart }; }

/* normales lissées à travers les coutures (somme des normales des faces, par sommet soudé) */
export function normales(P,F,weld){ let nw=0; for(const w of weld) if(w+1>nw) nw=w+1; const A=new Float64Array(nw*3), N=new Float32Array(P.length);
  for(let f=0;f<F.length;f+=3){ const a=F[f]*3, b=F[f+1]*3, c=F[f+2]*3;
    const ux=P[b]-P[a], uy=P[b+1]-P[a+1], uz=P[b+2]-P[a+2], vx=P[c]-P[a], vy=P[c+1]-P[a+1], vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    for(const s of [F[f],F[f+1],F[f+2]]){ const w=weld[s]*3; A[w]+=nx; A[w+1]+=ny; A[w+2]+=nz; } }
  for(let i=0;i<weld.length;i++){ const w=weld[i]*3, l=Math.hypot(A[w],A[w+1],A[w+2])+1e-12; N[i*3]=A[w]/l; N[i*3+1]=A[w+1]/l; N[i*3+2]=A[w+2]/l; }
  return N; }
