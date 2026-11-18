/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Rendu « soigné » des élèves en gros plan (vestiaire, exercice EPI ; validé en démonstration le 17/11/2026) : mêmes maillages et mêmes textures que figures.js,
   aucun fichier en plus. Tout est calculé dans le navigateur :
   - texture agrandie et affinée (netteté) à l'arrivée de l'image, filtrage anisotrope ;
   - matière par zone, reconnue À LA COULEUR d'après la peau et les cheveux de l'élève (relevés sur son visage et le haut
     de sa tête) : peau satinée avec lumière diffusée dans la chair (rougeur au bord des ombres), cheveux brillants,
     tissus mats au léger duvet, yeux humides (reflets de la pièce), relief tiré du modelé peint dans la texture ;
   - liseré de lumière sur le contour (contre-jour), qui détache l'élève du décor ;
   - éclairage à trois sources (principale chaude avec ombres fines, d'ambiance froide, contre-jour) et ombre de contact au sol.
   embellir(matiere, maillage) rend la matière soignée d'une matière de figures.js ; eclairage() rend le groupe de lumières. */
import * as THREE from 'three';

const PETIT=typeof innerWidth==='number' && Math.min(innerWidth,innerHeight)<=600;      // téléphone : textures moins grandes
export const REGL={ rim:1.0, sss:1.0, relief:1.0, net:1.0, debug:0 };          // réglages communs (démonstration)
const U={ uKey:{ value:new THREE.Vector3(0,1,0) }, uBack:{ value:new THREE.Vector3(0,0,-1) }, uRim:{ value:1 }, uSss:{ value:1 }, uDebug:{ value:0 },
  uRimCol:{ value:new THREE.Color(0xdbe8ff) } };
const lin=(r,g,b)=>new THREE.Color().setRGB(r/255,g/255,b/255,THREE.SRGBColorSpace);

/* ---------- texture : agrandie ×2 et affinée (masque flou soustrait), une fois par version ---------- */
function affiner(img,max){ const k=Math.min(2,max/img.width), w=Math.round(img.width*k), h=Math.round(img.height*k);
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d',{ willReadFrequently:true });
  x.imageSmoothingQuality='high'; x.drawImage(img,0,0,w,h);
  const d=x.getImageData(0,0,w,h), p=d.data, q=new Uint8ClampedArray(p), a=0.35*REGL.net;
  for(let j=1;j<h-1;j++) for(let i=1;i<w-1;i++){ const o=(j*w+i)*4;
    for(let ch=0;ch<3;ch++){ const m=(q[o+ch-4]+q[o+ch+4]+q[o+ch-w*4]+q[o+ch+w*4]+q[o+ch-w*4-4]+q[o+ch-w*4+4]+q[o+ch+w*4-4]+q[o+ch+w*4+4])/8;
      p[o+ch]=q[o+ch]+a*(q[o+ch]-m); } }
  x.putImageData(d,0,0); return c; }

/* ---------- relevés sur la tête : couleur de la peau, des cheveux, place des yeux dans la texture ---------- */
function releves(tete,img,rep){ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d',{ willReadFrequently:true }); x.drawImage(img,0,0);
  const px=x.getImageData(0,0,c.width,c.height).data, P=tete.attributes.position, UV=tete.attributes.uv, n=P.count;
  const tex=i=>{ const u=Math.min(c.width-1,Math.max(0,Math.round(UV.getX(i)*c.width))), v=Math.min(c.height-1,Math.max(0,Math.round(UV.getY(i)*c.height))), o=(v*c.width+u)*4; return [px[o],px[o+1],px[o+2]]; };
  let ymax=-9, ymin=9; for(let i=0;i<n;i++){ ymax=Math.max(ymax,P.getY(i)); ymin=Math.min(ymin,P.getY(i)); }
  const k=(rep.haut-rep.menton)/0.48, med=L=>{ if(!L.length) return null; const m=k=>L.map(v=>v[k]).sort((a,b)=>a-b)[L.length>>1]; return [m(0),m(1),m(2)]; };
  const joues=[], haut=[], yeux=[[],[]];
  /* repères du visage de cette version (fichier des élèves) : joues à côté du nez, haut de la tête, blanc des yeux */
  for(let i=0;i<n;i++){ const X=P.getX(i), Y=P.getY(i), Z=P.getZ(i), ax=Math.abs(X);
    if(Z>rep.nez_z-0.14*k && ax>0.06*k && ax<0.13*k && Y<rep.nez_y-0.01*k && Y>rep.nez_y-0.07*k){ const t=tex(i); if(Math.max(...t)-Math.min(...t)>40) joues.push(t); }   // sans le blanc des yeux
    if(Y>rep.haut-0.035) haut.push(tex(i));
    if(Z>rep.oeil_z-0.07*k && Y>rep.oeil_y-0.06*k && Y<rep.oeil_y+0.06*k && ax>0.015*k && ax<0.16*k){ const t=tex(i), mn=Math.min(...t), mx=Math.max(...t);
      if(mn>150 && mx-mn<50) yeux[X<0?0:1].push([X,Y,Z]); } }
  /* yeux : centre et rayon dans le repère du maillage au repos (le blanc de l'œil, reconnu à sa couleur) */
  const E=yeux.map(L=>{ if(L.length<3) return null; const mm=d=>{ const S=L.map(v=>v[d]).sort((a,b)=>a-b); return [S[Math.floor(S.length*0.04)],S[Math.ceil(S.length*0.96)-1]]; }, [x0,x1]=mm(0), [y0,y1]=mm(1), z=med(L)[2];
    return new THREE.Vector4((x0+x1)/2,(y0+y1)/2,z,Math.min(0.075*k,Math.max(0.02*k,Math.max(x1-x0,y1-y0)/2*1.35))); });
  return { peau:med(joues), cheveux:med(haut), yeux:E }; }

/* ---------- matière soignée ---------- */
export const FAITES=new Map();
export function embellir(orig,{ k, tete, rep, objet }={}){
  if(FAITES.has(orig)) return FAITES.get(orig);
  // objet (casque, lunettes, écharpe…) : matière d'origine + liseré ; k, tete, rep : version de l'élève, sa tête (maillage) et ses repères
  const m=orig.clone(); m.envMapIntensity=0.7;
  if(objet) m.roughness={ casque:0.4, lunettes:0.3, bracelet:0.35 }[objet] ?? orig.roughness;
  const u={ uSkin:{ value:new THREE.Color(0,0,0) }, uHair:{ value:new THREE.Color(0,0,0) }, uZones:{ value:0 }, uEye:{ value:[new THREE.Vector4(9,9,9,1),new THREE.Vector4(9,9,9,1)] }, uVerre:{ value:objet==='lunettes'? 1 : 0 }, ...U };
  m.userData.u=u;
  m.onBeforeCompile=sh=>{ orig.onBeforeCompile?.(sh); Object.assign(sh.uniforms,u);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n varying vec3 vRepos;').replace('#include <begin_vertex>','#include <begin_vertex>\n vRepos=position;');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>',`#include <common>
        uniform vec3 uSkin, uHair, uKey, uBack, uRimCol; uniform float uZones, uRim, uSss, uDebug, uVerre; uniform vec4 uEye[2]; varying vec3 vRepos;
        float zoneCouleur(vec3 a, vec3 ref){ float la=dot(a,vec3(1.))+1e-4, lr=dot(ref,vec3(1.))+1e-4;
          float dc=distance(a/la, ref/lr)/0.055, dl=abs(log2(la/lr))/1.25; return 1.0-smoothstep(0.75,1.45,sqrt(dc*dc+dl*dl)); }`)
      .replace('#include <map_fragment>',`#include <map_fragment>
        diffuseColor.rgb=max(vec3(0.),mix(vec3(dot(diffuseColor.rgb,vec3(0.3,0.59,0.11))),diffuseColor.rgb,1.10));   /* couleurs un peu plus vives */
        vec3 albedo=diffuseColor.rgb; float zPeau=0., zChev=0., zOeil=0.;
        #ifdef USE_MAP
          if(uZones>0.5){ zPeau=zoneCouleur(albedo,uSkin); zChev=zoneCouleur(albedo,uHair)*(1.-zPeau);
            for(int i=0;i<2;i++){ vec3 d=(vRepos-uEye[i].xyz)*vec3(1.,1.12,0.5)/uEye[i].w; zOeil=max(zOeil,1.-smoothstep(0.85,1.0,length(d))); }
            zOeil*=smoothstep(0.4,0.8,1.-zPeau); zChev*=1.-zOeil; }
        #endif`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,0.46,zPeau); roughnessFactor=mix(roughnessFactor,0.6,zChev); roughnessFactor=mix(roughnessFactor,0.03,zOeil);
        bool verre=uVerre>0.5 && diffuseColor.a<0.5; if(verre) roughnessFactor=0.05;`)
      .replace('#include <normal_fragment_maps>',`vec3 nLisse=normal;
        #include <normal_fragment_maps>
        normal=normalize(mix(normal,nLisse,max(zOeil,max(zPeau,zChev*0.6))));   /* pas de relief sur la peau ni sur les yeux */`)
      .replace('#include <opaque_fragment>',`{ vec3 Nn=normalize(normal), Vv=normalize(vViewPosition);
          float fr=pow(1.0-saturate(dot(Nn,Vv)),3.2), dos=saturate(dot(Nn,uBack)*0.6+0.55);
          float tissu=1.-max(zPeau,max(zChev,zOeil));
          outgoingLight+=uRimCol*fr*dos*uRim*(0.5+0.35*zPeau-0.25*zChev)*(1.-zOeil);            /* liseré de contre-jour */
          outgoingLight+=albedo*fr*tissu*0.22*uRim;                                                  /* duvet des tissus */
          float ndl=dot(Nn,uKey), bord=smoothstep(-0.45,0.02,ndl)*(1.-smoothstep(0.02,0.6,ndl));
          outgoingLight+=zPeau*albedo*vec3(1.0,0.36,0.26)*bord*0.26*uSss;                          /* lumière diffusée dans la peau */
          /* verre des lunettes : presque invisible, sauf les reflets */
          if(verre){ float s=dot(reflectedLight.directSpecular+reflectedLight.indirectSpecular,vec3(0.45)); diffuseColor.a=clamp(max(diffuseColor.a*0.45,s),0.,1.); }
          if(uDebug>0.5) outgoingLight=vec3(zPeau,zChev,zOeil); }
        #include <opaque_fragment>`); };
  m.customProgramCacheKey=()=>'soigne|'+(objet||'eleve');
  FAITES.set(orig,m);
  /* quand l'image de la texture est là : relevés sur la tête de la même version, puis texture affinée */
  const pret=()=>{ const img=orig.map?.image; if(!img||!img.width) return false;
    if(tete&&rep){ const R=releves(tete,img,rep); if(R.peau){ u.uSkin.value.copy(lin(...R.peau)); u.uHair.value.copy(lin(...(R.cheveux||[0,0,0]))); u.uZones.value=1; R.yeux.forEach((e,i)=>e&&u.uEye.value[i].copy(e)); m.userData.releves=R; } }
    const t=new THREE.CanvasTexture(affiner(img,PETIT?1024:2048)); t.flipY=false; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=16; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter;
    m.map=t; if(!objet){ m.bumpMap=t; m.bumpScale=0.5*REGL.relief; } m.needsUpdate=true; return true; };
  if(orig.map){ if(!pret()){ const it=setInterval(()=>{ if(pret()) clearInterval(it); },60); } }
  else m.roughness=Math.max(0.4,orig.roughness*0.9);
  return m; }

/* direction des lumières dans le repère de la caméra (à appeler avant chaque image) */
const _v=new THREE.Vector3();
export function majLumieres(cam,L){ U.uKey.value.copy(_v.copy(L.key.position).sub(L.key.target.position).normalize()).transformDirection(cam.matrixWorldInverse);
  U.uBack.value.copy(_v.copy(L.back.position).sub(L.back.target.position).normalize()).transformDirection(cam.matrixWorldInverse);
  U.uRim.value=REGL.rim; U.uSss.value=REGL.sss; U.uDebug.value=REGL.debug; }

/* ---------- éclairage à trois sources autour d'un élève placé à l'origine du groupe ---------- */
export function eclairage(){ const g=new THREE.Group();
  const amb=new THREE.HemisphereLight(0xdfe9ff,0x8d8478,0.3); g.add(amb);
  const key=new THREE.DirectionalLight(0xffeedb,2.9); key.position.set(-1.9,3.1,2.7); key.target.position.set(0,1.0,0); key.castShadow=true;
  key.shadow.mapSize.set(2048,2048); Object.assign(key.shadow.camera,{ left:-1.3,right:1.3,top:1.5,bottom:-1.5,near:0.5,far:9 }); key.shadow.bias=-0.00025; key.shadow.normalBias=0.012; key.shadow.radius=2.5;
  const fill=new THREE.DirectionalLight(0xcfe0ff,0.62); fill.position.set(2.6,1.6,2.2); fill.target.position.set(0,1.1,0);
  const back=new THREE.DirectionalLight(0xe6efff,1.5); back.position.set(1.7,2.9,-3.0); back.target.position.set(0,1.2,0);
  g.add(key,key.target,fill,fill.target,back,back.target);
  /* ombre de contact : tache douce sous les pieds */
  const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), gr=x.createRadialGradient(64,64,4,64,64,62);
  gr.addColorStop(0,'rgba(0,0,0,.55)'); gr.addColorStop(.45,'rgba(0,0,0,.22)'); gr.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=gr; x.fillRect(0,0,128,128);
  const tache=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.75),new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false, toneMapped:false }));
  tache.rotation.x=-Math.PI/2; tache.position.y=0.004; tache.renderOrder=1; g.add(tache);
  return { groupe:g, key, fill, back, amb, tache }; }
