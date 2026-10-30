# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Fiches de la machine à lecture obligatoire (engine/fiches.js, demandé par l'enseignant le 29/10/2026) :
1. page web : onglet « Fiches » ouvert au départ, lecture fiche par fiche, mémoire du navigateur, « Voir sur la machine » ;
2. paquetage séparé (évaluation seule) : la lecture se fait dans la carte du parcours avant le repérage,
   trace RADIALE_lecture, lecture gardée dans suspend_data (reprise directe au repérage) ;
3. téléphone : pas de défilement horizontal. (Paquetage unique : « Passer l'évaluation » fermé, voir tests/paquet.)"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

ETAT = "()=>({ n:document.querySelectorAll('#fichesBox details.fiche').length, lues:document.querySelectorAll('#fichesBox details.fiche[data-lu=true]').length, lt:document.getElementById('app').dataset.lt, prog:document.querySelector('#fichesBox .fiches-prog b')?.textContent, tab:document.getElementById('fichesN').textContent })"
LIRE = "async ()=>{ const s=ms=>new Promise(r=>setTimeout(r,ms)); for(const b of [...document.querySelectorAll('[data-flu]')]){ const d=b.closest('details'); d.open=true; await s(30); document.querySelector(`[data-flu=\"${b.dataset.flu}\"]`)?.click(); await s(30); } }"

async def main():
    print('Page web')
    async with Page('scie-radiale', lues=False) as pg:
        e = await pg.eval(ETAT)
        check(e['n'] == 8 and e['lues'] == 0 and e['lt'] == 'fiches' and e['prog'] == 'Fiches lues : 0 / 8', f'onglet Fiches ouvert au départ : {e}')
        await pg.eval("()=>document.querySelector('[data-fshow]').click()"); await pg.page.wait_for_timeout(300)
        info = await pg.eval("()=>document.getElementById('info').textContent")
        check('Scie radiale' not in info and len(info) > 10, f'« Voir sur la machine » : organes de la fiche nommés ({info[:60]}…)')
        print('   capture', await pg.shot('scie-radiale_fiches_1400.png'))
        await pg.eval("()=>{ const b=document.querySelector('[data-flu=\"0\"]'); b.closest('details').open=true; b.click(); }")
        e = await pg.eval(ETAT)
        check(e['lues'] == 1 and e['tab'] == '1/8', 'une fiche validée : 1 / 8 (aussi sur l\'onglet)')
        await pg.eval(LIRE); e = await pg.eval(ETAT)
        check(e['lues'] == 8 and e['prog'] == 'Fiches lues : 8 / 8', 'toutes les fiches lues')
        await pg.page.reload(); await pg.page.wait_for_function('window.__ready', timeout=30000); await pg.page.wait_for_timeout(800)
        e = await pg.eval(ETAT)
        check(e['lues'] == 8 and e['lt'] == 'parts', 'lecture gardée dans le navigateur : au rechargement, la nomenclature s\'ouvre')
    print('Paquetage séparé (évaluation seule)')
    async with Page('scie-radiale', scorm=True, lues=False) as pg:
        st = await pg.eval("()=>({ card:document.getElementById('parcCard').innerText, bar:document.getElementById('repBar').hidden, steps:[...document.querySelectorAll('#parcSteps li')].map(l=>l.dataset.s+':'+l.textContent) })")
        check('Lisez les fiches' in st['card'] and st['bar'] and st['steps'][0].startswith('cur:') and 'Fiches' in st['steps'][0], 'parcours : lecture des fiches avant le repérage (barre de repérage cachée)')
        print('   capture', await pg.shot('scie-radiale_fiches_parcours.png'))
        await pg.eval("()=>{ const b=document.querySelector('#parcFiches [data-flu=\"0\"]'); b.closest('details').open=true; b.click(); }")
        n = await pg.eval("()=>document.querySelectorAll('#parcFiches details.fiche[data-lu=true]').length")
        check(n == 1, 'la carte du parcours se redessine après chaque fiche lue')
        await pg.eval(LIRE.replace("'[data-flu]'", "'#parcFiches [data-flu]'"))
        for _ in range(8):
            if await pg.eval("()=>document.querySelector('#parcFiches [data-flu]:not([disabled])')"):
                await pg.eval("()=>{ const b=document.querySelector('#parcFiches [data-flu]:not([disabled])'); b.closest('details').open=true; b.click(); }")
        st = await pg.eval("()=>({ card:document.getElementById('parcCard').innerText, bar:document.getElementById('repBar').hidden, store:__store })")
        lec = [v for k, v in st['store'].items() if k.endswith('.id') and v == 'RADIALE_lecture']
        resp = [v for k, v in st['store'].items() if k.endswith('.student_response') and 'fiches lues' in v]
        check('Trouvez' in st['card'] and not st['bar'], 'toutes les fiches lues : le repérage commence')
        check(len(lec) == 1 and resp and resp[0].startswith('8/8 fiches lues le '), f'trace Moodle RADIALE_lecture : « {resp[0] if resp else "-"} »')
        sd = json.loads(st['store']['cmi.suspend_data'])
        check(sd.get('lu') == list(range(8)) and sd.get('luD'), 'lecture gardée dans suspend_data')
    async with Page('scie-radiale', scorm=True, suspend=json.dumps(sd), lues=False) as pg:
        card = await pg.eval("()=>document.getElementById('parcCard').innerText")
        check('Trouvez' in card, 'reprise : fiches déjà lues, retour direct au repérage')
    print('Téléphone 412 × 915')
    async with Page('scie-radiale', viewport=(412, 915), touch=True, lues=False) as pg:
        g = await pg.eval("()=>[document.documentElement.scrollWidth, innerWidth, !!document.querySelector('#fichesBox details.fiche[open]')]")
        check(g[0] <= g[1] + 1 and g[2], f'fiches lisibles sur téléphone, pas de défilement horizontal ({g[0]} px)')
        await pg.eval("()=>document.getElementById('fichesBox').scrollIntoView()"); await pg.page.wait_for_timeout(300)
        print('   capture', await pg.shot('scie-radiale_fiches_412.png'))

if __name__ == '__main__': run(main)
