"""Images des machines pour les attestations : chaque modèle 3D en vue 3/4, sur fond transparent → attestations/img/<id>.webp
Usage : npm run build, puis python3 tools/capture_machines.py [id …] (sans argument : toutes les machines)"""
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tests'))
from harness import Page
OUT = os.path.join(os.path.dirname(__file__), '..', 'attestations', 'img')
IDS = ['risques', 'scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse', 'toupie', 'tenonneuse', 'scie-format']
HIDE = """()=>{ const s=document.createElement('style'); s.textContent=`html,body,#app,.stage{background:transparent!important}
 .stage::before,.stage::after{display:none!important} body *{visibility:hidden} #c,#c *{visibility:visible}
 #c{position:fixed!important;left:0!important;top:0!important;width:1600px!important;height:1000px!important}`; document.head.appendChild(s);
 const st=window.__atelier.app.stage; st.scene.background=null; st.renderer.setClearColor(0x000000,0); st.resize&&st.resize();
 const T=st.THREE, box=new T.Box3().setFromObject(st.root), sph=box.getBoundingSphere(new T.Sphere()), cam=st.camera;
 const dir=cam.position.clone().sub(st.controls.target).normalize(); dir.y=Math.max(dir.y,0.35); dir.normalize();
 const d=sph.radius/Math.sin(cam.fov*Math.PI/360)*0.92; st.controls.target.copy(sph.center); cam.position.copy(sph.center).addScaledVector(dir,d);
 cam.near=0.05; cam.far=d*4; cam.updateProjectionMatrix(); st.controls.update(); st.renderer.shadowMap.needsUpdate=true; }"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    for id in (sys.argv[1:] or IDS):
        async with Page(id, viewport=(1600, 1000)) as pg:
            await pg.eval(HIDE); await pg.page.wait_for_timeout(2500)
            p = os.path.join(OUT, id + '.png'); w = os.path.join(OUT, id + '.webp')
            await pg.page.locator('#c').screenshot(path=p, omit_background=True); from PIL import Image; im=Image.open(p); im=im.crop(im.getbbox()); im.thumbnail((900,900)); im.save(w, 'WEBP', quality=82); os.remove(p); print(w, im.size)
asyncio.run(main())
