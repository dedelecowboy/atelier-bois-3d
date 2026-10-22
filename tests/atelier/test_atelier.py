"""Page atelier : démarrage sans erreur, les 7 machines construites et les postes à venir, sélection d'un poste,
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
        check(len(built) == 7, f'7 machines construites ({", ".join(s["id"] for s in built)})')
        for s in built:
            check(s['meshes'] > 10 and all(v == v and v > 0.3 for v in s['size']), f'{s["id"]} : taille {s["size"]} m au poste {s["center"]}')
        room = await pg.eval("()=>{ const s=window.__atelier.STATIONS; return null; }")
        for s in info:
            x0, z0, x1, z1 = s['box']
            check(x0 > -10.95 and x1 < 10.95 and z0 > -10.82 and z1 < 10.82, f'{s["id"]} dans la salle ({x0:.1f} à {x1:.1f} ; {z0:.1f} à {z1:.1f})')
        g = await pg.eval(GEOM)
        check(g['sh'] <= g['ih'] + 1 and g['sw'] <= g['iw'] + 1, f'pas de défilement de page ({g["sw"]}×{g["sh"]})')
        print('   capture', await pg.shot('atelier_ensemble_1400.png'))
        await pg.eval("()=>document.querySelector('#postes [data-id=raboteuse]').click()"); await pg.page.wait_for_timeout(1600)
        card = await pg.eval("()=>({ hidden:document.getElementById('card').hidden, h:document.querySelector('#card h2')?.textContent, href:document.querySelector('#card .go')?.href })")
        check(not card['hidden'] and card['h'] == 'Raboteuse' and 'claude.ai/artifact/' in (card['href'] or ''), f'fiche « {card["h"]} » avec le lien du simulateur')
        print('   capture', await pg.shot('atelier_raboteuse_1400.png'))
        await pg.eval("()=>{ document.getElementById('home').click(); document.getElementById('eleve').click(); document.getElementById('progPlus').click(); document.getElementById('progPlus').click(); }")
        await pg.page.wait_for_timeout(1200)
        lk = await pg.eval("()=>[...document.querySelectorAll('#postes button')].map(b=>b.dataset.id+':'+b.dataset.locked+':'+b.dataset.done)")
        check(lk[:3] == ['scie-radiale:false:true', 'deligneuse:false:true', 'degauchisseuse:false:false'] and lk[3].endswith(':true:false'),
              'aperçu élève : 2 validées, la 3e ouverte, la suite verrouillée')
        await pg.eval("()=>document.querySelector('#postes [data-id=toupie]').click()"); await pg.page.wait_for_timeout(1600)
        msg = await pg.eval("()=>document.querySelector('#card .lockmsg')?.textContent||''")
        check('Verrouillée' in msg and not await pg.eval("()=>!!document.querySelector('#card .go')"), f'machine verrouillée : {msg.strip()}')
        print('   capture', await pg.shot('atelier_eleve_1400.png'))
    print('Téléphone 412 × 915')
    async with Page('atelier', viewport=(412, 915), touch=True) as pg:
        await pg.page.wait_for_timeout(1500)
        g = await pg.eval(GEOM)
        check(g['sw'] <= g['iw'] + 1 and g['ch'] > 400, f'vue 3D de {g["cw"]}×{g["ch"]} px, pas de défilement horizontal')
        print('   capture', await pg.shot('atelier_ensemble_412.png'))
        await pg.eval("()=>document.querySelector('#postes [data-id=tenonneuse]').click()"); await pg.page.wait_for_timeout(1600)
        print('   capture', await pg.shot('atelier_tenonneuse_412.png'))

if __name__ == '__main__': run(main)
