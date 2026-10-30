# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Scie à ruban : disposition sur ordinateur (1400 px ; dock d'exercice aussi à 1280 et 2560 px) et téléphone (412 px), captures dans tests/out/.
Sur ordinateur, pas de barre de défilement de page ; sur téléphone, une colonne, 3D jamais écrasée."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run, dock_une_ligne, DOCK_LIGNE

GEOM = """()=>{ const c=document.getElementById('c').getBoundingClientRect(), d=document.documentElement;
  return {cw:Math.round(c.width), ch:Math.round(c.height), sw:d.scrollWidth, sh:d.scrollHeight, iw:innerWidth, ih:innerHeight, ui:document.getElementById('app').dataset.ui}; }"""

async def main():
    print('Ordinateur 1400 × 820')
    async with Page('scie-ruban') as pg:
        for ui in ['pres', 'ex']:
            await pg.eval(f"()=>document.getElementById('ui-{ui}').click()"); await pg.page.wait_for_timeout(600)
            g = await pg.eval(GEOM)
            check(g['sh'] <= g['ih'] + 1 and g['sw'] <= g['iw'] + 1, f'{ui} : pas de défilement de page ({g["sw"]}×{g["sh"]})')
            check(g['ch'] > 400, f'{ui} : vue 3D de {g["cw"]}×{g["ch"]} px')
            if ui == 'ex': await dock_une_ligne(pg, 1400)
            print('   capture', await pg.shot(f'scie-ruban_{ui}_1400.png'))
    for w in [1280, 2560]:
        async with Page('scie-ruban', viewport=(w, 900)) as pg:
            await pg.eval("()=>document.getElementById('ui-ex').click()"); await pg.page.wait_for_timeout(600)
            await dock_une_ligne(pg, w)
            print('   capture', await pg.shot(f'scie-ruban_ex_{w}.png'))
    print('Téléphone 412 × 915')
    async with Page('scie-ruban', viewport=(412, 915), touch=True) as pg:
        for ui in ['pres', 'ex']:
            await pg.eval(f"()=>document.getElementById('ui-{ui}').click()"); await pg.page.wait_for_timeout(600)
            g = await pg.eval(GEOM)
            check(g['sw'] <= g['iw'] + 1, f'{ui} : pas de défilement horizontal ({g["sw"]} px)')
            check(g['ch'] > 300 and g['cw'] >= 400, f'{ui} : vue 3D de {g["cw"]}×{g["ch"]} px (non écrasée)')
            if ui == 'ex':
                d = await pg.eval(DOCK_LIGNE)
                check(d['lignes'] == d['n'], f'ex : sur téléphone, les {d["n"]} panneaux restent empilés')
            print('   capture', await pg.shot(f'scie-ruban_{ui}_412.png'))
    async with Page('scie-ruban', viewport=(412, 915), touch=True, scorm=True) as pg:
        g = await pg.eval(GEOM)
        check(g['ui'] == 'parcours' and g['ch'] > 300, f'parcours : vue 3D de {g["cw"]}×{g["ch"]} px')
        print('   capture', await pg.shot('scie-ruban_parcours_412.png'))

if __name__ == '__main__': run(main)
