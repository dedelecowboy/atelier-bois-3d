"""Risques généraux : les quatre scénarios joués comme un élève (panneau « Actions »), sans faute et avec fautes.
Chaque jeu rend {res: lignes du tableau de contrôle, faults: fautes graves du scénario}."""
BASE = r"""
 const R=__risques, a=(k,v)=>{ const b=document.querySelector(`[data-act=${k}]`+(v!==undefined?`[data-v="${v}"]`:'')); if(!b) throw new Error('bouton absent : '+k+' '+(v??'')); b.click(); };
 const next=async n=>{ for(let i=0;i<n;i++){ $('stepNext').click(); await sleep(60); } };
 const fin=async()=>{ await next(8); return { res:results(), faults:R.st.faults.slice(), step:$('stepN').textContent }; };
 const stopped=async()=>{ for(let i=0;i<60 && R.model.spin>0.02;i++) await sleep(250); };   // lame arrêtée (4 s, horloge réelle)
 const measure=code=>{ R.pickDanger(code); const d=R.data.dangers.find(x=>x.k===code); a('measure',d.a); };
"""
JEUX = {
  # tous les dangers repérés avec la bonne mesure, aucune fausse alerte
  'dangers': BASE + r"""
    for(const d of R.data.dangers.filter(x=>x.type==='D')) measure(d.k);
    await sleep(200); return await fin();""",
  # les 4 tenues correctes
  'epi': BASE + r"""
    const T=R.data.epi.tasks;
    for(let i=0;i<T.length;i++){ for(const k of T[i].req) a('epi',k); a('valider'); await sleep(100); await next(1); }
    return await fin();""",
  # consignation complète dans l'ordre
  'consignation': BASE + r"""
    a('stop'); await stopped(); a('sect'); a('lock'); a('key'); a('tag'); a('start'); a('inter');
    a('prot'); a('tag'); a('lock'); a('warn'); a('sect'); a('start'); await sleep(200);
    return await fin();""",
  # alerte, extincteur à eau à bonne distance, évacuation par la porte B
  'feu': BASE + r"""
    a('cri'); a('alarme'); a('au'); a('ext','eau'); a('pos','ok'); a('aim','base'); await sleep(300);
    a('exit','B'); a('ferme'); a('rass'); await sleep(200);
    return await fin();""",
}
FAUTES = {
  'epi': BASE + r"""
    const T=R.data.epi.tasks;   // tâche 1 (toupie) avec des gants, les autres correctes
    for(let i=0;i<T.length;i++){ for(const k of T[i].req) a('epi',k); if(i===0) a('epi','gants_manut'); a('valider'); await sleep(100); await next(1); }
    return await fin();""",
  'consignation': BASE + r"""
    a('inter'); a('stop'); a('au'); await stopped(); a('inter'); const f=R.st.faults.slice(); return { ...(await fin()), f };""",
  'feu': BASE + r"""
    a('ext','co2'); a('pos','fond'); a('aim','haut'); a('exit','A'); a('sac'); a('rass'); await sleep(200); return await fin();""",
}
