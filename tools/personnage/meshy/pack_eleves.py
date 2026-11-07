# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Assemble les élèves Meshy et les EPI en un seul fichier compact pour le module des risques généraux.

  python3 tools/personnage/meshy/pack_eleves.py machines/risques/eleves.glbz \
      equipe=rig.glb,fini.glb mal=… equipe_b=… mal_s=… fille=… … noir=… noir_mal=… noir_b=… noir_mal_s=… \
      casque=epi_casque.glb lunettes=epi_lunettes.glb ffp2=epi_ffp2.glb demimasque=epi_demimasque.glb echarpe=… bracelet=…

Trois élèves (groupes garcon, fille, noir), quatre versions chacun : tenue d'atelier (ok) ou sweat (mal), chaussures de
sécurité ou baskets (equipe / fille / noir = tenue + sécurité ; *_b = tenue + baskets ; mal / fille_mal / noir_mal =
sweat + baskets ; *_s = sweat + sécurité). Chaque version = deux fichiers : le modèle RIGGÉ de Meshy (10 000 faces,
squelette Mixamo 24 os) et le même arrondi par subdiv_rig.py puis recuit par recuire_texture.py (seule sa texture sert).
Le fichier garde le maillage de 10 000 faces : la page l'arrondit au chargement (machines/risques/subdiv.js, même
calcul que subdiv_rig.py, donc la texture recuite tombe juste). Les EPI sont ceux de epi_prep.py. Le PREMIER élève de
chaque groupe donne le squelette du groupe : les autres versions y sont recalées (mêmes noms d'os).

Chaque triangle reçoit une pièce d'après l'os qui le commande (part : 0 tête, 1 corps, 2 pieds, 3 mains, 4 cou) :
  tete (Head : visage et cheveux, mèches longues reconnues à leur couleur), corps (la tenue), pieds (chaussure entière,
  reconnue à sa couleur et reliée au sol), mains (nues ou gantées). On combine ainsi tête, tenue et gants.

Format (lu par machines/risques/figures.js, sans chargeur asynchrone) : zlib( longueur JSON sur 4 octets, JSON,
données ). Positions en entiers 16 bits (échelle et décalage dans le JSON), coordonnées de texture 16 bits, os et
poids 8 bits, indices et soudure 16 bits, pièce par face 8 bits, textures JPEG ; EPI avec normales 8 bits.
"""
import io, json, os, struct, sys, zlib
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbio import load, acc

TEX_ELEVE = 1024   # px : les élèves sont vus de loin dans la salle
TEX_EPI = 512
CHEVEUX_LONGS = ('fille_mal', 'fille_mal_s', 'fille_l')
Q = 84             # qualité JPEG
GROUPES = {k: 'garcon' for k in ('equipe', 'mal', 'equipe_b', 'mal_s')}
GROUPES.update({k: 'fille' for k in ('fille', 'fille_mal', 'fille_b', 'fille_mal_s', 'fille_l')})   # fille_l : tenue, cheveux détachés
GROUPES.update({k: 'noir' for k in ('noir', 'noir_mal', 'noir_b', 'noir_mal_s')})
_s = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'subdiv_rig.py'), encoding='utf-8').read()
exec(_s[_s.index('def loop'):_s.index('for _ in range(A.niveaux)')])   # loop(P, UV, W, F) : la même subdivision que la page

out_path = sys.argv[1]
args = dict(a.split('=', 1) for a in sys.argv[2:])
eleves = [k for k in args if k in GROUPES]
epis = [k for k in args if k not in eleves]

BIN = bytearray()
def put(arr):
    arr = np.ascontiguousarray(arr)
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(arr.tobytes()); return [o, arr.nbytes]
def jpeg(img, size):
    im = img.convert('RGB')
    if size: im = im.resize((size, size), Image.LANCZOS)
    o = io.BytesIO(); im.save(o, 'JPEG', quality=Q, optimize=True); return put(np.frombuffer(o.getvalue(), np.uint8))
def image_of(g, b, tex_index):
    iv = g['images'][g['textures'][tex_index]['source']]; bv = g['bufferViews'][iv['bufferView']]; o = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(b[o:o + bv['byteLength']]))
def geom(P, N, UV, F, J=None, W=None):
    lo = P.min(0); hi = P.max(0); sc = (hi - lo) / 65535
    G = {'n': int(len(P)), 'pmin': lo.tolist(), 'pscale': sc.tolist(),
         'pos': put(np.round((P - lo) / sc).astype(np.uint16)),
         'nor': put(np.round(np.clip(N, -1, 1) * 127).astype(np.int8)),
         'uv': put(np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)),
         'idx': put(F.reshape(-1).astype(np.uint16))}
    if J is not None:
        G['jnt'] = put(J.astype(np.uint8)); G['wgt'] = put(W.astype(np.uint8))
    return G

J = {'eleves': {}, 'epi': {}, 'squelettes': {}}
REF = {}            # groupe -> (noms des os, matrices monde de repos) de l'élève de référence (le premier du groupe)
for k in eleves:
    rig, fini = args[k].split(',')
    g, b = load(rig); pr = g['meshes'][0]['primitives'][0]; at = pr['attributes']
    P = acc(g, b, at['POSITION']).astype(np.float64)
    UV = acc(g, b, at['TEXCOORD_0']).astype(np.float64); F = acc(g, b, pr['indices']).reshape(-1, 3).astype(np.int64)
    Jn = acc(g, b, at['JOINTS_0']).astype(np.int64); Wt = acc(g, b, at['WEIGHTS_0'])
    Wt = (Wt.astype(np.float64) / (255 if Wt.dtype == np.uint8 else 1))
    sk = g['skins'][0]; names = [g['nodes'][j]['name'].replace('mixamorig:', '') for j in sk['joints']]
    grp = GROUPES[k]
    ibm_k = acc(g, b, sk['inverseBindMatrices']).reshape(-1, 4, 4).astype(np.float64)
    # soudure (sommets de même position) AVANT le recalage : la page s'en sert pour la subdivision et les normales
    _, weld = np.unique(np.round(P, 6), axis=0, return_inverse=True); weld = weld.ravel()
    if grp not in REF:
        # squelette commun : nœuds de l'armature (dont l'échelle 0,01 de Mixamo) et os
        par = {}
        for i, nd in enumerate(g['nodes']):
            for c in nd.get('children', []): par[c] = i
        jset = set(sk['joints']); arm = par[sk['joints'][0]]
        while arm in jset: arm = par[arm]
        def trs(nd): return {'t': nd.get('translation', [0, 0, 0]), 'r': nd.get('rotation', [0, 0, 0, 1]), 's': nd.get('scale', [1, 1, 1])}
        bones = []
        for j in sk['joints']:
            nd = g['nodes'][j]; p = par.get(j)
            bones.append({'name': nd['name'].replace('mixamorig:', ''), 'parent': sk['joints'].index(p) if p in jset else -1, **trs(nd)})
        J['squelettes'][grp] = {'armature': trs(g['nodes'][arm]), 'os': bones,
                                'ibm': put(acc(g, b, sk['inverseBindMatrices']).astype(np.float32))}
        REF[grp] = (names, np.linalg.inv(ibm_k.transpose(0, 2, 1)))
    base, Wref = REF[grp]
    remap = np.array([base.index(n) for n in names])
    # recalage sur le squelette de référence du groupe (habillage linéaire du repos de cet élève vers celui de la référence)
    Bk = ibm_k.transpose(0, 2, 1)
    M = np.einsum('nij,njk->nik', Wref[remap], Bk)
    # un os orienté autrement (Meshy tourne parfois un os sur lui-même : la tête de deux versions de l'élève noir est
    # tournée de 135°) : la pièce qu'il commande est seulement DÉPLACÉE sur l'articulation de la référence (même pose en
    # A, même orientation du corps), sinon elle serait tournée avec l'os (visage vers l'arrière)
    Wk = np.linalg.inv(Bk); tourne = {}
    jp = {}
    for i_, nd_ in enumerate(g['nodes']):
        for c_ in nd_.get('children', []): jp[c_] = i_
    for i_ in range(len(names)):
        Ra = Wref[remap[i_]][:3, :3]; Rb = Wk[i_][:3, :3]
        Ra = Ra / np.linalg.norm(Ra, axis=0); Rb = Rb / np.linalg.norm(Rb, axis=0)
        ang = np.degrees(np.arccos(np.clip((np.trace(Ra @ Rb.T) - 1) / 2, -1, 1)))
        if ang <= 45: continue
        pj = jp.get(sk['joints'][i_]); pi_ = sk['joints'].index(pj) if pj in sk['joints'] else -1
        if pi_ in tourne: M[i_] = M[pi_]     # bout de la tête : même déplacement que la tête (sa longueur diffère)
        else: Mi = np.eye(4); Mi[:3, 3] = Wref[remap[i_]][:3, 3] - Wk[i_][:3, 3]; M[i_] = Mi
        tourne[i_] = True
        print(f'  {k} : os {names[i_]} tourné de {ang:.0f}° : déplacé sans rotation')
    P = np.einsum('vk,vkij,vj->vi', Wt, M[Jn], np.c_[P, np.ones(len(P))])[:, :3]
    Jn = remap[Jn]
    dom = np.take_along_axis(Jn, np.argmax(Wt, 1)[:, None], 1)[:, 0]
    bn = np.array(base)
    ishand = np.isin(bn[dom], ['LeftHand', 'RightHand'])
    ishead = np.isin(bn[dom], ['Head', 'HeadTop_End', 'headfront'])
    w8 = np.round(Wt * 255).astype(np.int64); w8[:, 0] += 255 - w8.sum(1)
    # texture recuite (même atlas que le riggé)
    gf, bf = load(fini)
    img0 = image_of(gf, bf, gf['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']).convert('RGB')
    Tc = np.asarray(img0, np.float64) / 255; Rc = Tc.shape[0]
    def couleur(uv): return Tc[np.clip((uv[:, 1] * Rc).astype(int), 0, Rc - 1), np.clip((uv[:, 0] * Rc).astype(int), 0, Rc - 1)]
    # chaussures : reconnues à leur couleur (pas le bleu du pantalon) et reliées au sol ; le bas du pantalon reste avec la
    # tenue et la chaussure entière va avec les pieds
    ct = couleur(UV[F].mean(1)); yt = P[F].mean(1)[:, 1]
    pantalon = (ct[:, 2] > ct[:, 0] + 0.06) & (ct[:, 2] > 0.12)
    cand = (~pantalon) & (yt < 0.22)
    Fw = weld[F]; nwv = weld.max() + 1
    vt = [[] for _ in range(nwv)]
    for ti_, (a0, a1, a2) in enumerate(Fw):
        if cand[ti_]:
            vt[a0].append(ti_); vt[a1].append(ti_); vt[a2].append(ti_)
    pied = np.zeros(len(F), bool); pile = [t for t in np.nonzero(cand & (yt < 0.03))[0]]
    for t in pile: pied[t] = True
    while pile:
        t = pile.pop()
        for v in Fw[t]:
            for u in vt[v]:
                if not pied[u]: pied[u] = True; pile.append(u)
    parts = {'pieds': pied, 'mains': ishand[F].all(1) & ~pied, 'tete': ishead[F].all(1) & ~pied}
    parts['corps'] = ~(parts['pieds'] | parts['mains'] | parts['tete'])
    if k in CHEVEUX_LONGS:
        # cheveux longs : les mèches dans le dos sont liées au dos par Meshy ; reconnues à leur couleur (châtain : teinte
        # 0,02 à 0,11, saturée, ni claire ni noire) au-dessus de la taille, elles restent avec la tête
        c = ct; mx = c.max(1); mn = c.min(1); sat = (mx - mn) / np.maximum(mx, 1e-6)
        hue = np.where(mx == c[:, 0], ((c[:, 1] - c[:, 2]) / np.maximum(mx - mn, 1e-6)) / 6 % 1, 0.5)
        mech = parts['corps'] & (hue > 0.02) & (hue < 0.11) & (sat > 0.35) & (mx > 0.15) & (mx < 0.75) & (yt > 0.85)
        parts['tete'] = parts['tete'] | mech; parts['corps'] = parts['corps'] & ~mech
        print(f'  {k} : {int(mech.sum())} triangles de cheveux rattachés à la tête')
    # col et capuche liés à la tête par Meshy : le rouge du sweat et le bleu-gris de la veste vont avec la tenue (sinon des
    # morceaux du col de l'autre tenue apparaissent aux épaules quand on change de tête ou de tenue)
    tissu = (ct[:, 2] > ct[:, 0] + 0.02) | ((ct[:, 0] > 0.35) & (ct[:, 1] < 0.4 * ct[:, 0]) & (ct[:, 2] < 0.4 * ct[:, 0])) | (ct.min(1) > 0.78)
    if grp != 'noir': tissu |= ct.max(1) < 0.2          # bleu marine très sombre (les cheveux noirs de l'élève noir restent)
    col = parts['tete'] & tissu & (yt < np.percentile(yt[parts['tete']], 40))
    parts['tete'] = parts['tete'] & ~col; parts['corps'] = parts['corps'] | col
    if col.any(): print(f'  {k} : {int(col.sum())} triangles du col rendus à la tenue')
    # cou : la peau de la tête sous le menton. Quand on pose la tête d'une autre version (coiffure de la fille), le cou
    # vient avec la tête et son bas passe sous le col de la tenue (sinon deux bouts de cou mal raccordés dépassent du col)
    cmx = ct.max(1); cmn = ct.min(1); csat = (cmx - cmn) / np.maximum(cmx, 1e-6)
    if grp == 'noir': peau = (ct[:, 0] > 0.30) & (ct[:, 0] < 0.85) & (ct[:, 0] > ct[:, 2] + 0.12) & (csat > 0.30) & (csat < 0.75)
    else: peau = (ct[:, 0] > 0.6) & (ct[:, 0] > ct[:, 2] + 0.08) & (csat < 0.5) & (cmx > 0.62)
    pv = np.zeros(len(P), bool); pv[F[parts['tete'] & peau].ravel()] = True
    hvv = np.isin(bn[dom], ['Head', 'HeadTop_End', 'headfront'])
    # menton : sur la ligne du milieu, la peau la plus basse qui avance presque autant que le nez (le cou est en retrait)
    mil = pv & (np.abs(P[:, 0]) < 0.03) & (P[:, 1] > np.percentile(P[:, 1], 55))
    zf = P[mil, 2].max(); menton = P[mil & (P[:, 2] > zf - 0.06), 1].min()
    ymx = P[F].max(1)[:, 1]
    peau &= ct[:, 1] > 0.55 * ct[:, 0]                  # pas les reflets du sweat rouge
    parts['cou'] = parts['tete'] & peau & (ymx < menton - 0.004) & (ymx > menton - 0.20)
    parts['tete'] = parts['tete'] & ~parts['cou']
    part = np.zeros(len(F), np.uint8)
    for i, n in enumerate(('tete', 'corps', 'pieds', 'mains', 'cou')): part[parts[n]] = i
    lo = P.min(0); hi = P.max(0); sc = (hi - lo) / 65535
    E = {'n': int(len(P)), 'pmin': lo.tolist(), 'pscale': sc.tolist(),
         'pos': put(np.round((P - lo) / sc).astype(np.uint16)),
         'uv': put(np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)),
         'jnt': put(Jn.astype(np.uint8)), 'wgt': put(w8.astype(np.uint8)),
         'idx': put(F.reshape(-1).astype(np.uint16)), 'weld': put(weld.astype(np.uint16)), 'part': put(part)}
    # repères du visage et boîte de la tête, sur le maillage tel que la page l'arrondit
    Pq = lo + np.round((P - lo) / sc) * sc
    nj = len(base); Wd = np.zeros((len(P), nj)); np.add.at(Wd, (np.repeat(np.arange(len(P)), 4), Jn.ravel()), w8.ravel() / 255)
    Ps, UVs, Ws, Fs = loop(Pq, np.round(np.clip(UV, 0, 1) * 65535) / 65535, Wd, F)
    hv = np.isin(bn[np.argmax(Ws, 1)], ['Head', 'HeadTop_End', 'headfront'])
    hp = Ps[hv]
    if grp == 'fille':   # queue de cheval : boîte du visage seulement (moitié avant de la tête)
        hp = hp[hp[:, 2] > np.median(hp[:, 2])]
    cv = couleur(UVs); mxv = cv.max(1); mnv = cv.min(1); satv = (mxv - mnv) / np.maximum(mxv, 1e-6)
    if grp == 'noir':    # peau foncée : brune, plus rouge que bleue, ni noire (cheveux) ni claire
        sk_ = hv & (cv[:, 0] > 0.30) & (cv[:, 0] < 0.85) & (cv[:, 0] > cv[:, 2] + 0.12) & (satv > 0.30) & (satv < 0.75)
    else:
        sk_ = hv & (cv[:, 0] > 0.7) & (cv[:, 0] > cv[:, 2] + 0.08) & (satv < 0.45) & (mxv > 0.72)
    Sk = Ps[sk_]
    ear = Sk[np.abs(Sk[:, 0]) > np.percentile(np.abs(Sk[:, 0]), 97)]
    nose = Sk[Sk[:, 2] > np.percentile(Sk[:, 2], 99.5)]
    eye = Ps[hv & (mnv > 0.8) & (Ps[:, 2] > np.percentile(Sk[:, 2], 60))]
    E['reperes'] = {k_: round(float(v), 4) for k_, v in dict(haut=Ps[hv, 1].max(), oreille_x=np.abs(ear[:, 0]).mean(), oreille_y=ear[:, 1].mean(),
        oreille_z=ear[:, 2].mean(), oreille_bas=ear[:, 1].min(), oreille_haut=ear[:, 1].max(), nez_y=nose[:, 1].mean(), nez_z=nose[:, 2].max(),
        oeil_y=eye[:, 1].mean(), oeil_z=eye[:, 2].max(), menton=Sk[:, 1].min()).items()}
    print('  repères', E['reperes'])
    E['boite_tete'] = {'min': hp.min(0).tolist(), 'max': hp.max(0).tolist()}
    E['hauteur'] = float(Ps[:, 1].max()); E['groupe'] = grp
    E['chaussures'] = 'securite' if k in ('equipe', 'fille', 'noir') or k.endswith('_s') else 'baskets'
    E['tenue'] = 'mal' if '_mal' in k or k == 'mal' or k.startswith('mal') else 'ok'
    E['tex'] = jpeg(img0, TEX_ELEVE)
    J['eleves'][k] = E
    print(f'{k} : {len(P)} sommets, ' + ', '.join(f"{n} {int(fm.sum())} faces" for n, fm in parts.items()))
for k in epis:
    g, b = load(args[k]); pr = g['meshes'][0]['primitives'][0]; at = pr['attributes']
    P = acc(g, b, at['POSITION']).astype(np.float64); N = acc(g, b, at['NORMAL']).astype(np.float64)
    UV = acc(g, b, at['TEXCOORD_0']).astype(np.float64); F = acc(g, b, pr['indices']).reshape(-1, 3)
    E = geom(P, N, UV, F); E['tex'] = jpeg(image_of(g, b, g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']), TEX_EPI)
    J['epi'][k] = E
js = json.dumps(J, separators=(',', ':')).encode()
raw = struct.pack('<I', len(js)) + js + bytes(BIN)
z = zlib.compress(raw, 9)
open(out_path, 'wb').write(z)
print(f'{out_path} : {len(z)//1024} Ko (brut {len(raw)//1024} Ko)')
