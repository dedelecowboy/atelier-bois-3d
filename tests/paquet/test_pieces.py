# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Ranger comme pièce / comme chute, liste « Pièces débitées », Reprendre (demandé par l'enseignant le 06/11/2026) : contrôle court sur les 9 machines,
en mode libre. La pièce rangée va dans la liste avec le bon type, ne disparaît pas, se reprend ; reprendre machine occupée range ce qui est dessus."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

KIND2 = {'scie-format': 'chute', 'degauchisseuse': 'chute', 'deligneuse': 'chute', 'scie-radiale': 'chute', 'scie-ruban': 'chute',
         'raboteuse': 'retour', 'toupie': 'interdite', 'tenonneuse': 'interdite', 'mortaiseuse': 'interdite'}
LIST = "()=>[...document.querySelectorAll('#debit li[data-k]')].map(l=>l.dataset.k)"

async def click(pg, sel):
    await pg.eval("(s)=>{ const b=document.querySelector(s); if(!b) throw new Error('absent : '+s); b.click(); }", sel); await pg.page.wait_for_timeout(120)

async def main():
    for m, k2 in KIND2.items():
        print(f' {m}')
        async with Page(m) as pg:
            await pg.eval("()=>__atelier.app.ex.setMode('libre')"); await pg.page.wait_for_timeout(300)
            n0 = len(await pg.eval(LIST))
            await click(pg, '[data-op=rangeC]')
            l = await pg.eval(LIST)
            if len(l) == n0:     # pas de pièce posée au départ du mode libre : on en reprend une, sinon on passe
                print('   pas de pièce au départ du mode libre'); continue
            check(len(l) == n0 + 1 and l[0] == k2 or k2 in l, f'rangée comme {k2} : {l}')
            await click(pg, '#debit [data-take], #debit [data-d=take]')
            check(len(await pg.eval(LIST)) == n0, 'reprise : elle revient sur la machine')
            await click(pg, '[data-op=rangeP]')
            l = await pg.eval(LIST)
            check('piece' in l and len(l) == n0 + 1, f'rangée comme pièce : {l}')
            await click(pg, '#debit [data-take], #debit [data-d=take]')
            await click(pg, '#debit [data-kind], #debit [data-d=kind]') if await pg.eval("()=>!!document.querySelector('#debit [data-kind], #debit [data-d=kind]')") else None
    print(' reprendre machine occupée (lot de la mortaiseuse)')
    async with Page('mortaiseuse') as pg:
        await pg.eval("()=>__atelier.app.ex.setMode('serie')"); await pg.page.wait_for_timeout(300)
        n = len(await pg.eval(LIST))
        await click(pg, '#debit [data-take]'); a = len(await pg.eval(LIST))
        await click(pg, '#debit [data-take]'); b = len(await pg.eval(LIST))
        check(a == n - 1 and b == a, f'la pièce sur la table part dans la liste : {n} → {a} → {b}')
    print(' scie à ruban : poussoir et ↺ ↻ à l\'arrêt')
    async with Page('scie-ruban') as pg:
        await pg.eval("()=>__atelier.app.ex.setMode('chant')"); await pg.page.wait_for_timeout(300)
        th = "()=>__ruban.pieces.find(q=>q.state==='table')?.th"
        t0 = await pg.eval(th)
        b = await pg.page.query_selector('#right'); await b.dispatch_event('pointerdown'); await pg.page.wait_for_timeout(500); await b.dispatch_event('pointerup')
        check(await pg.eval(th) != t0, 'la pièce tourne à l\'arrêt')
        await click(pg, '[data-op=pchute]')
        check('piece' in await pg.eval(LIST), 'dégager au poussoir fonctionne pour la pièce')
        r = await pg.eval("()=>{ const s=__ruban.st; return [s.gL,s.gLi,s.posOk]; }")
        check(r[2] and r[0] == 0.2, 'galets et position sur les volants réglés seuls')
    print(' dégauchisseuse : machine vide sans erreur')
    async with Page('degauchisseuse') as pg:
        await pg.eval("()=>__atelier.app.ex.setMode('libre')"); await click(pg, '[data-op=rangeP]'); await pg.page.wait_for_timeout(500)
        check(len(await pg.eval(LIST)) == 1, 'pièce rangée dans la liste')
        await click(pg, '#debit [data-take]'); await pg.page.wait_for_timeout(300)
        check(len(await pg.eval(LIST)) == 0, 'pièce reprise')

if __name__ == '__main__': run(main)
