# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Page atelier : démarrage sans erreur, les 9 machines construites et les postes à venir, sélection d'un poste,
aperçu élève (verrouillage), disposition ordinateur (1400 px) et téléphone (412 px). Captures dans tests/out/."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

INFO = """()=>{ const A=window.__atelier; return A.STATIONS.map(s=>({ id:s.id, built:!!s.build, meshes:s.mats.length,
  size:[+s.size.x.toFixed(2),+s.size.y.toFixed(2),+s.size.z.toFixed(2)], center:[+s.center.x.toFixed(2),+s.center.z.toFixed(2)],
  box:[s.box.min.x,s.box.min.z,s.box.max.x,s.box.max.z] })); }"""
GEOM = """()=>{ const c=document.getElementById('c').getBoundingClientRect(), d=document.documentElement;
  return {cw:Math.round(c.width), ch:Math.round(c.height), sw:d.scrollWidth, sh:d.scrollHeight, iw:innerWidth, ih:innerHeight}; }"""

def overlap(a, b, m=0.15):
    return a[0] < b[2] - m and b[0] < a[2] - m and a[1] < b[3] - m and b[1] < a[3] - m

async def main():
    print('Ordinateur 1400 × 820')
    async with Page('atelier') as pg:
        await pg.page.wait_for_timeout(1500)
        info = await pg.eval(INFO)
        built = [s for s in info if s['built']]
        check(len(built) == 9, f'9 machines construites ({", ".join(s["id"] for s in built)})')
        for s in built:
            check(s['meshes'] > 10 and all(v == v and v > 0.3 for v in s['size']), f'{s["id"]} : taille {s["size"]} m au poste {s["center"]}')
        for s in info:
            x0, z0, x1, z1 = s['box']
            check(x0 > -10.95 and x1 < 10.95 and z0 > -10.82 and z1 < 10.82, f'{s["id"]} dans la salle ({x0:.1f} à {x1:.1f} ; {z0:.1f} à {z1:.1f})')
        # chemins au sol (31/10/2026) : jaune niveau 1, orange foncé niveau 2, jamais sous une machine
        fl = await pg.eval("""()=>{ const A=window.__atelier, B=A.STATIONS[0].box.constructor, boxes=A.STATIONS.map(s=>[s.id,s.box]).concat(A.DECORS.map(d=>[d.L.nom,new B().setFromObject(d.g)]));
          return A.flows.map(f=>({ niv:f.niv, col:f.col, hit:f.pts.flatMap(([x,z])=>boxes.filter(([n,b])=>x>b.min.x+0.05&&x<b.max.x-0.05&&z>b.min.z+0.05&&z<b.max.z-0.05).map(([n])=>n)) })); }""")
        check(len(fl) == 7 and [f['niv'] for f in fl].count(1) == 2 and fl[0]['col'] != fl[2]['col'], f'chemins au sol : 2 jaunes (niveau 1, branche de la scie à ruban), 5 orange foncé (niveau 2) — {[f["col"] for f in fl]}')
        check(all(not f['hit'] for f in fl), 'aucun chemin ne passe sous une machine : ' + str([f['hit'] for f in fl if f['hit']]))
        g = await pg.eval(GEOM)
        check(g['sh'] <= g['ih'] + 1 and g['sw'] <= g['iw'] + 1, f'pas de défilement de page ({g["sw"]}×{g["sh"]})')
        print('   capture', await pg.shot('atelier_ensemble_1400.png'))
        await pg.eval("()=>document.querySelector('#postes [data-id=raboteuse]').click()"); await pg.page.wait_for_timeout(1600)
        card = await pg.eval("()=>({ hidden:document.getElementById('card').hidden, h:document.querySelector('#card h2')?.textContent, href:document.querySelector('#card .go')?.href })")
        check(not card['hidden'] and card['h'] == 'Raboteuse' and 'claude.ai/artifact/' in (card['href'] or ''), f'fiche « {card["h"]} » avec le lien du simulateur')
        print('   capture', await pg.shot('atelier_raboteuse_1400.png'))
        await pg.eval("()=>{ document.getElementById('home').click(); document.getElementById('eleve').click(); document.getElementById('progPlus').click(); document.getElementById('progPlus').click(); }")
        await pg.page.wait_for_timeout(1200)
        first = await pg.eval("()=>document.querySelector('#postes button').dataset.id")
        check(first == 'risques', 'liste des postes : « 0 Risques généraux » en tête')
        lk = await pg.eval("()=>[...document.querySelectorAll('#postes button:not([data-id=risques])')].map(b=>b.dataset.id+':'+b.dataset.locked+':'+b.dataset.done)")
        check(lk[:3] == ['scie-radiale:false:true', 'deligneuse:false:true', 'degauchisseuse:false:false'] and lk[3].endswith(':true:false'),
              'aperçu élève : 2 validées, la 3e ouverte, la suite verrouillée')
        await pg.eval("()=>document.querySelector('#postes [data-id=toupie]').click()"); await pg.page.wait_for_timeout(1600)
        msg = await pg.eval("()=>document.querySelector('#card .lockmsg')?.textContent||''")
        check('Verrouillée' in msg and not await pg.eval("()=>!!document.querySelector('#card .go')"), f'machine verrouillée : {msg.strip()}')
        print('   capture', await pg.shot('atelier_eleve_1400.png'))
        print('Modifier l\'implantation')
        await pg.eval("()=>{ document.getElementById('vWeb').click(); document.getElementById('editBtn').click(); }"); await pg.page.wait_for_timeout(1500)
        ed = await pg.eval("()=>({ hidden:document.getElementById('edit').hidden, pins:[...document.querySelectorAll('.dlbl')].filter(e=>!e.hidden).length })")
        check(not ed['hidden'] and ed['pins'] >= 12, f'panneau de modification ouvert, {ed["pins"]} machines sans module nommées')
        await pg.eval("()=>document.querySelector('#postes [data-id=raboteuse]').click()"); await pg.page.wait_for_timeout(300)
        p0 = await pg.eval("()=>{ const s=window.__atelier.STATIONS.find(s=>s.id==='raboteuse'); return { x:s.slot.x, z:s.slot.z, rot:s.slot.rot, gy:s.group.rotation.y, cx:s.center.x }; }")
        await pg.eval("()=>document.querySelector('#edit [data-r=\"90\"]').click()"); await pg.page.wait_for_timeout(300)
        p1 = await pg.eval("()=>{ const s=window.__atelier.STATIONS.find(s=>s.id==='raboteuse'); return { rot:s.slot.rot, gy:s.group.rotation.y }; }")
        check(p1['rot'] == (p0['rot'] + 90) % 360 and abs(p1['gy'] - (p0['gy'] - 1.5708)) < 0.01, f'rotation ↻ 90° : {p0["rot"]}° → {p1["rot"]}°')
        # glisser-déposer à la souris : du centre de la raboteuse, 120 px vers la droite
        xy = await pg.eval("()=>{ const s=window.__atelier.STATIONS.find(s=>s.id==='raboteuse'), c=document.getElementById('c').getBoundingClientRect();"
                           " const v=s.center.clone(); v.y=0.9; v.project(window.__atelier.camera); return [c.left+(v.x+1)/2*c.width, c.top+(1-v.y)/2*c.height]; }")
        m = pg.page.mouse
        await m.move(xy[0], xy[1]); await m.down(); await m.move(xy[0]+60, xy[1], steps=4); await m.move(xy[0]+120, xy[1], steps=4); await m.up()
        await pg.page.wait_for_timeout(400)
        p2 = await pg.eval("()=>{ const s=window.__atelier.STATIONS.find(s=>s.id==='raboteuse'); return { x:s.slot.x, z:s.slot.z }; }")
        check(p2['x'] > p0['x'] + 1.0 and abs(p2['z'] - p0['z']) < 0.3, f'glisser-déposer : X {p0["x"]} → {p2["x"]} m')
        await pg.eval("()=>{ const e=document.getElementById('edZ_'); e.value='2.5'; e.dispatchEvent(new Event('change')); }")
        j = await pg.eval("()=>JSON.parse(document.getElementById('edOut').value).machines.find(m=>m.id==='rabot')")
        check(j['z'] == 2.5 and abs(j['x'] - p2['x']) < 0.01 and j['rot'] == p1['rot'], f'disposition à copier à jour (raboteuse en {j["x"]} ; {j["z"]}, {j["rot"]}°)')
        await pg.eval("()=>document.getElementById('edAdd').click()"); await pg.page.wait_for_timeout(300)
        n = await pg.eval("()=>JSON.parse(document.getElementById('edOut').value).machines.length")
        check(n == 22, f'machine ajoutée ({n} machines)')
        print('   capture', await pg.shot('atelier_edition_1400.png'))
        await pg.page.reload(); await pg.page.wait_for_function('window.__ready', timeout=30000); await pg.page.wait_for_timeout(800)
        r = await pg.eval("()=>{ const L=window.__atelier.lay.machines; return { rabot:L.find(m=>m.id==='rabot'), n:L.length }; }")
        check(r['rabot']['z'] == 2.5 and r['n'] == 22, 'disposition gardée dans le navigateur après rechargement')
        await pg.eval("()=>{ document.getElementById('editBtn').click(); }"); await pg.page.wait_for_timeout(300)
        await pg.eval("()=>{ const b=document.getElementById('edReset'); b.click(); b.click(); }")
        await pg.page.wait_for_function('window.__ready', timeout=30000); await pg.page.wait_for_timeout(800)
        r = await pg.eval("()=>window.__atelier.lay.machines.length")
        check(r == 21, 'retour au plan d\'origine')
    print('Téléphone 412 × 915')
    async with Page('atelier', viewport=(412, 915), touch=True) as pg:
        await pg.page.wait_for_timeout(1500)
        g = await pg.eval(GEOM)
        check(g['sw'] <= g['iw'] + 1 and g['cw'] <= g['iw'] and g['ch'] > 400, f'vue 3D de {g["cw"]}×{g["ch"]} px, pas de défilement horizontal')
        print('   capture', await pg.shot('atelier_ensemble_412.png'))
        await pg.eval("()=>document.querySelector('#postes [data-id=tenonneuse]').click()"); await pg.page.wait_for_timeout(1600)
        print('   capture', await pg.shot('atelier_tenonneuse_412.png'))
        await pg.eval("()=>{ document.getElementById('home').click(); document.getElementById('editBtn').click(); }"); await pg.page.wait_for_timeout(1500)
        await pg.eval("()=>document.querySelector('#postes [data-id=toupie]').click()"); await pg.page.wait_for_timeout(400)
        g = await pg.eval(GEOM)
        check(g['sw'] <= g['iw'] + 1 and not await pg.eval("()=>document.getElementById('edit').hidden"), 'modification sur téléphone : panneau en bas, pas de défilement horizontal')
        print('   capture', await pg.shot('atelier_edition_412.png'))

if __name__ == '__main__': run(main)
