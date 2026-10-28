"""Outil des attestations : lecture du rapport de base de Moodle (formats réels du 28/10/2026, avec et sans objectifs,
avec l'élément « 0. Risques généraux »), une attestation par machine (ou module risques) validée (note ≥ 70), deux par feuille A4, pas de défilement horizontal sur téléphone."""
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import ROOT, CHROMIUM, check, run
from playwright.async_api import async_playwright

PAGE = os.path.join(ROOT, 'dist', 'Attestations_atelier_bois_3D.html')
T = "'Nom','Adresse de courriel','Tentative','Démarré le','Dernier accès le','Résultat','Atelier','1. Scie radiale','2. Déligneuse multilames','3. Dégauchisseuse','4. Raboteuse','5. Toupie','6. Tenonneuse','7. Scie à format'"
AT = "'Aucune tentative'"
CAS = {  # rapport de base exporté par l'enseignant : sans objectif rempli (cellules vides non écrites), puis objectifs remplis
  'objectifs vides': (f"[[{T},'RADIALE statut','RADIALE score'],['ÉLÈVE EXEMPLE 1','j',1,'27 octobre 2026, 20:25','28 octobre 2026, 10:22',1,'Incomplet',96.0,{AT},null,null,{AT},null,null,{AT},null,null,{AT},null,null,{AT},null,null,{AT}],"
                      f"['ÉLÈVE EXEMPLE 2','y','-','-','-','-',{AT},null,null,{AT},null,null,{AT},null,null,{AT},null,null,{AT},null,null,{AT},null,null,{AT},null,null,{AT}]]",
                      {'scie-radiale': 96, 'deligneuse': 'Aucune tentative'}, 1),
  'objectifs remplis': (f"[[{T},'RADIALE statut','RADIALE score'],['A','x',1,'-','2 novembre 2026, 09:10',7,'Incomplet',96,'Réussi',96,88,75,92,79,81,62],"
                        "['A','x',2,'-','3 novembre 2026, 09:10',7,'Incomplet',90,'Réussi',90,88,75,92,79,85,71]]",
                        {'scie-radiale': 96, 'tenonneuse': 85, 'scie-format': 71}, 7),
  # paquetage avec « 0. Risques généraux » (élément ajouté le 28/10/2026)
  'avec risques généraux': (f"[[{T.replace("'Atelier',", "'Atelier','0. Risques généraux',")}],['B','z',1,'-','4 novembre 2026, 08:30',1,'Incomplet',85,{AT},{AT},{AT},{AT},{AT},{AT},{AT}]]",
                            {'risques': 85, 'scie-radiale': 'Aucune tentative'}, 1),
}

async def main():
    if not os.path.exists(PAGE): sys.exit(f'{PAGE} absent : lancez « npm run build ».')
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path=CHROMIUM); pg = await b.new_page(viewport={'width': 1300, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else r.abort())
        await pg.goto('file://' + PAGE); await pg.wait_for_timeout(500)
        n = await pg.eval_on_selector('#nAtt', 'e=>e.textContent')
        check(n == '1', 'exemple chargé à l\'ouverture : 1 attestation (scie radiale 96)')
        for nom, (aoa, attendu, natt) in CAS.items():
            await pg.evaluate(f"()=>__att.load({aoa},'test',false)"); await pg.wait_for_timeout(200)
            r = await pg.evaluate("()=>[__att.data().rows.length, __att.data().rows[0].res, __att.data().rows[0].date, document.getElementById('nAtt').textContent, document.querySelectorAll('#preview .sheet').length]")
            ok = all(r[1].get(k) == v for k, v in attendu.items())
            check(ok and r[3] == str(natt) and r[4] == (natt + 1) // 2, f'{nom} : {r[1]} → {r[3]} attestation(s) sur {r[4]} feuille(s), date {r[2]}')
            if nom == 'objectifs remplis': check(r[0] == 1, 'deux tentatives du même élève : une ligne, meilleure note par machine')
        t = await pg.eval_on_selector('#preview .att', 'e=>e.innerText')
        check('Risques généraux de l\'atelier' in t and '4 situations notées' in t, 'attestation « Risques généraux de l\'atelier » (module sécurité, 4 situations notées)')
        await pg.evaluate(f"()=>__att.load({CAS['objectifs remplis'][0]},'test',false)"); await pg.wait_for_timeout(200)
        await pg.fill('#classe', '2MB'); t = await pg.eval_on_selector('#preview .att', 'e=>e.innerText')
        check('2MB' in t and 'Note obtenue' in t and 'Épreuve pratique' in t, 'attestation : classe, note, case de l\'épreuve pratique')
        await pg.emulate_media(media='print'); p = os.path.join(ROOT, 'tests', 'out', 'attestations.pdf'); os.makedirs(os.path.dirname(p), exist_ok=True)
        await pg.pdf(path=p, format='A4', print_background=True, prefer_css_page_size=True)
        check(os.path.getsize(p) > 50000, f'impression A4 : {p}')
        await pg.emulate_media(media='screen'); await pg.set_viewport_size({'width': 412, 'height': 900}); await pg.wait_for_timeout(300)
        sw = await pg.evaluate('()=>[document.documentElement.scrollWidth, innerWidth]')
        check(sw[0] <= sw[1] + 1, f'téléphone : pas de défilement horizontal ({sw[0]} px)')
        check(not errs, 'aucune erreur JavaScript' + ('' if not errs else ' : ' + '; '.join(errs)))
        await b.close()

if __name__ == '__main__': run(main)
