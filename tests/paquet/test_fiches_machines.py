# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Fiches de chaque machine (lecture obligatoire, 29/10/2026) : pour les 9 machines,
page web = onglet « Fiches » ouvert au départ, 8 fiches, « Voir sur la machine » nomme des organes, lecture complète ;
paquetage séparé = la lecture des fiches est la première étape du parcours. (Détail complet : tests/scie-radiale/test_fiches.py.)"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

MACHINES = ['scie-format', 'degauchisseuse', 'deligneuse', 'scie-radiale', 'raboteuse', 'toupie', 'tenonneuse', 'scie-ruban', 'mortaiseuse']
ETAT = "()=>({ n:document.querySelectorAll('#fichesBox details.fiche').length, lues:document.querySelectorAll('#fichesBox details.fiche[data-lu=true]').length, lt:document.getElementById('app').dataset.lt, voir:document.querySelectorAll('#fichesBox [data-fshow]').length })"
LIRE = "async ()=>{ const s=ms=>new Promise(r=>setTimeout(r,ms)); for(let k=0;k<20;k++){ const b=document.querySelector('#fichesBox [data-flu]:not([disabled])'); if(!b) break; b.closest('details').open=true; await s(20); document.querySelector(`#fichesBox [data-flu=\"${b.dataset.flu}\"]`).click(); await s(20); } }"

async def main():
    for m in MACHINES:
        print(m)
        async with Page(m, lues=False) as pg:
            e = await pg.eval(ETAT)
            check(e['n'] == 8 and e['lues'] == 0 and e['lt'] == 'fiches' and e['voir'] == 8, f'onglet Fiches ouvert, 8 fiches avec « Voir sur la machine » : {e}')
            vides = []
            for i in range(8):
                await pg.eval(f"()=>document.querySelector('[data-fshow=\"{i}\"]').click()")
                info = await pg.eval("()=>document.getElementById('info')?.querySelector('span')?.textContent||''")
                if len(info) < 3: vides.append(i + 1)
            check(not vides, f'« Voir sur la machine » nomme des organes pour chaque fiche (sans : {vides})')
            await pg.eval(LIRE); e = await pg.eval(ETAT)
            check(e['lues'] == 8, 'les 8 fiches se valident une à une')
        async with Page(m, scorm=True, lues=False) as pg:
            st = await pg.eval("()=>({ card:document.getElementById('parcCard').innerText, s0:document.querySelector('#parcSteps li')?.textContent||'' })")
            check('Lisez les fiches' in st['card'] and 'Fiches' in st['s0'], 'paquetage séparé : lecture des fiches avant le repérage')

if __name__ == '__main__': run(main)
