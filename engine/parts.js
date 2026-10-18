/* Organes de la machine : registre (depuis organes.txt), nomenclature cliquable, surbrillance,
   vue intérieure (transparence) et sélection au clic / au doigt dans la 3D. */
import * as THREE from 'three';

const $ = id=>document.getElementById(id);
const HI = 0xd27a1c;

export function createParts(stage, PARTS, cfg){
  const partMeshes = {}; for(const k in PARTS) partMeshes[k]=[];

  /* rattache un objet 3D (et tous ses maillages) à un organe */
  function tagPart(obj, key){
    if(!PARTS[key]) console.warn(`Organe « ${key} » absent de organes.txt`);
    const list = partMeshes[key] || (partMeshes[key]=[]);
    obj.userData.part = key; obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.userData.part=key; list.push(o);} }); return obj; }

  /* nomenclature */
  const list=$('parts'); let selected=null; const hiMats=new Map();
  for(const [k,p] of Object.entries(PARTS)){
    const li=document.createElement('li'); const b=document.createElement('button'); b.type='button'; b.dataset.k=k;
    b.innerHTML=`<span>${p.n}</span><small>${p.ref}</small>`; b.onclick=()=>select(selected===k?null:k); li.appendChild(b); list.appendChild(li);
  }
  const infoDefault = $('info').innerHTML;
  /* surbrillance ; quiet = sans afficher le nom (repérage évalué) */
  function select(k,quiet){ highlight(null);
    if(selected) for(const m of partMeshes[selected]) if(m.userData.orig){ m.material=m.userData.orig; }
    selected=k;
    list.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.k===k)));
    if(k){ const hi=(mat)=>{ if(!hiMats.has(mat)){ const c=mat.clone(); if(c.emissive){ c.emissive=new THREE.Color(HI); c.emissiveIntensity=0.45; } else if(c.color){ c.color=c.color.clone().lerp(new THREE.Color(HI),0.45); } if(mat.clippingPlanes) c.clippingPlanes=mat.clippingPlanes; hiMats.set(mat,c);} return hiMats.get(mat); };
      for(const m of partMeshes[k]){ m.userData.orig=m.material; m.material=Array.isArray(m.material)? m.material.map(hi) : hi(m.material); }
      $('info').innerHTML= quiet? '<b>Organe en surbrillance</b><span>Validez votre choix, ou touchez un autre organe.</span>' : `<b>${PARTS[k].ref} · ${PARTS[k].n}</b><span>${PARTS[k].d}</span>`; }
    else $('info').innerHTML=infoDefault;
  }

  /* surbrillance d'une famille d'organes (panneau de réglage survolé, engine/families.js), teinte de la famille ;
     passagère : effacée par select() et setXray() */
  let hl=[]; const hlMats=new Map();
  function highlight(keys,color){
    for(const m of hl) if(m.userData.hlOrig){ m.material=m.userData.hlOrig; delete m.userData.hlOrig; } hl=[];
    if(keys&&keys.length){ const col=new THREE.Color(color);
      const tint=mat=>{ const k=mat.uuid+'|'+color; if(!hlMats.has(k)){ const c=mat.clone(); if(c.color) c.color=c.color.clone().lerp(col,0.6);
          if(c.emissive){ c.emissive=col.clone(); c.emissiveIntensity=0.35; } if(mat.clippingPlanes) c.clippingPlanes=mat.clippingPlanes; hlMats.set(k,c); } return hlMats.get(k); };
      for(const k of keys) if(k!==selected) for(const m of partMeshes[k]||[]){ if(m.userData.hlOrig) continue;
        m.userData.hlOrig=m.material; m.material=Array.isArray(m.material)? m.material.map(tint) : tint(m.material); hl.push(m); } }
    stage.dirty(); }

  /* vue intérieure : organes de cfg.xray.parts rendus translucides */
  const X = cfg.xray || {parts:[]};
  let xray=false;
  function setXray(on,moveCam){ highlight(null); xray=on; $('xray')?.setAttribute('aria-pressed',String(xray));
    for(const [k,op] of X.parts) for(const m of partMeshes[k]||[]){ for(const mat of [m.userData.orig&&m.material!==m.userData.orig?m.userData.orig:null, m.material]) if(mat){
      if(!mat.userData.base) mat.userData.base={t:mat.transparent,o:mat.opacity,d:mat.depthWrite};   // une étiquette (texture transparente) le reste en sortant de la vue intérieure
      const b=mat.userData.base; mat.transparent=xray||b.t; mat.opacity=xray?op*b.o:b.o; mat.depthWrite=xray?false:b.d; mat.needsUpdate=true; } m.castShadow=!xray; }
    stage.dirty();
    if(xray&&moveCam&&X.cam) stage.setCam(X.cam.pos,X.cam.tgt); }
  if($('xray')) $('xray').onclick=()=>setXray(!xray,true);
  const hiddenByXray = part => xray && X.parts.some(([k])=>k===part); // le Raycaster ignore « visible » et la transparence

  /* clic / toucher dans la 3D (tolérance de glissé : 14 px au doigt, 5 px à la souris) */
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let down=null, pickHook=null;
  stage.canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  stage.canvas.addEventListener('pointerup',e=>{ if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>(e.pointerType==='touch'?14:5)) return;
    const r=stage.canvas.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1, -(e.clientY-r.top)/r.height*2+1);
    ray.setFromCamera(ndc,stage.camera);
    const hits=ray.intersectObjects(stage.root.children,true);
    if(pickHook && pickHook(hits)) return;
    const hit=hits.find(h=>h.object.userData.part);
    select(hit? (hit.object.userData.part===selected?null:hit.object.userData.part) : null); });

  return { PARTS, partMeshes, tagPart, select, setXray, hiddenByXray, highlight,
    get xray(){ return xray; }, get selected(){ return selected; },
    onPick(fn){ pickHook=fn; } };
}
