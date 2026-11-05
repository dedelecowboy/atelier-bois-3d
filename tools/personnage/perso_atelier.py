# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Personnage de l'atelier, style « 3D cartoon » doux (prototype 2, d'après le style demandé par l'enseignant le 05/11/2026 :
grosse tête ronde, grands yeux, sourcils épais, nez rond, mèches, grandes mains, chaussures montantes, couleurs chaudes).
Personnage original. Volumes fusionnés (champ de distance signée), maillés par marching cubes (grille plus fine pour la tête
et les mains), simplifiés, lissés, rattachés à un squelette (noms : Hanches, Dos_bas, Dos_haut, Cou, Tete, Clavicule_G,
Bras_G, AvantBras_G, Main_G, Doigts_G, Cuisse_G, Jambe_G, Pied_G, Orteils_G…). Une pièce par couche (couleur unie).
Les yeux, sourcils et bouche sont posés par le simulateur (expressions). Repère : mètres, Y en haut, regard vers +Z, gauche = +X.
Usage : python3 tools/personnage/perso_atelier.py machines/risques/personnage.glb   (écrit aussi personnage.glbz, la copie compressée intégrée au module)
(environ 6 min ; CACHE=<dossier> garde les maillages pour ne refaire que l'écriture.) Bibliothèques : numpy, scikit-image, fast-simplification, scipy."""
import sys, json, struct, math, os
import numpy as np
from skimage.measure import marching_cubes
import fast_simplification
import scipy.sparse as sp

OUT = sys.argv[1]
A = np.array
ANG = math.radians(36)                          # bras écartés au repos
def dirA(s): return A([math.sin(ANG) * s, -math.cos(ANG), 0.0])

# ---------- squelette ----------
J = { 'Hanches': A([0, 0.78, 0]), 'Dos_bas': A([0, 0.85, -0.005]), 'Dos_haut': A([0, 1.02, -0.01]), 'Cou': A([0, 1.165, -0.005]), 'Tete': A([0, 1.225, 0.0]), 'TeteFin': A([0, 1.55, 0]) }
ARM = {}
for s, S in ((1, 'G'), (-1, 'D')):
    sh = A([0.19 * s, 1.115, -0.005]); el = sh + 0.25 * dirA(s); wr = el + 0.215 * dirA(s) + A([0, 0, 0.01])
    kn = wr + 0.085 * dirA(s); tip = wr + 0.16 * dirA(s)
    ARM[s] = (sh, el, wr, kn, tip)
    J.update({ 'Clavicule_' + S: A([0.04 * s, 1.12, 0]), 'Bras_' + S: sh, 'AvantBras_' + S: el, 'Main_' + S: wr, 'Doigts_' + S: kn, 'DoigtsFin_' + S: tip,
               'Cuisse_' + S: A([0.09 * s, 0.755, 0]), 'Jambe_' + S: A([0.094 * s, 0.415, 0.012]), 'Pied_' + S: A([0.097 * s, 0.105, -0.01]),
               'Orteils_' + S: A([0.1 * s, 0.04, 0.13]), 'OrteilsFin_' + S: A([0.1 * s, 0.035, 0.2]) })
PARENT = { 'Hanches': None, 'Dos_bas': 'Hanches', 'Dos_haut': 'Dos_bas', 'Cou': 'Dos_haut', 'Tete': 'Cou' }
TAIL = { 'Hanches': 'Dos_bas', 'Dos_bas': 'Dos_haut', 'Dos_haut': 'Cou', 'Cou': 'Tete', 'Tete': 'TeteFin' }
for S in 'GD':
    PARENT.update({ 'Clavicule_' + S: 'Dos_haut', 'Bras_' + S: 'Clavicule_' + S, 'AvantBras_' + S: 'Bras_' + S, 'Main_' + S: 'AvantBras_' + S, 'Doigts_' + S: 'Main_' + S,
                    'Cuisse_' + S: 'Hanches', 'Jambe_' + S: 'Cuisse_' + S, 'Pied_' + S: 'Jambe_' + S, 'Orteils_' + S: 'Pied_' + S })
    TAIL.update({ 'Clavicule_' + S: 'Bras_' + S, 'Bras_' + S: 'AvantBras_' + S, 'AvantBras_' + S: 'Main_' + S, 'Main_' + S: 'Doigts_' + S, 'Doigts_' + S: 'DoigtsFin_' + S,
                  'Cuisse_' + S: 'Jambe_' + S, 'Jambe_' + S: 'Pied_' + S, 'Pied_' + S: 'Orteils_' + S, 'Orteils_' + S: 'OrteilsFin_' + S })
BONES = list(PARENT)

# ---------- outils de distance ----------
def capsule(P, a, b, ra, rb=None):
    rb = ra if rb is None else rb; a, b = A(a, float), A(b, float); ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1) - (ra + (rb - ra) * t)
def ellip(P, c, r):
    q = (P - A(c, float)) / A(r, float); k0 = np.linalg.norm(q, axis=1); k1 = np.linalg.norm(q / A(r, float), axis=1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
def rbox(P, c, h, r=0.0):   # boîte arrondie (demi-tailles h)
    q = np.abs(P - A(c, float)) - A(h, float) + r
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - r
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)
def U(ds, k=0.03):
    d = ds[0]
    for x in ds[1:]: d = smin(d, x, k)
    return d
def cutp(d, P, n, p0): n = A(n, float); return np.maximum(d, (P - A(p0, float)) @ (n / np.linalg.norm(n)))

# ---------- corps ----------
def head(P):
    h = U([ellip(P, (0, 1.385, -0.008), (0.132, 0.142, 0.13)),               # crâne
           ellip(P, (0, 1.30, 0.022), (0.112, 0.098, 0.106)),                # mâchoire large
           ellip(P, (0, 1.235, 0.062), (0.052, 0.034, 0.042)),               # menton
           ellip(P, (0, 1.402, 0.088), (0.092, 0.026, 0.042))], 0.035)      # arcade
    for s in (1, -1): h = smin(h, ellip(P, (0.062 * s, 1.322, 0.072), (0.046, 0.04, 0.04)), 0.02)            # joues
    h = smin(h, U([ellip(P, (0, 1.352, 0.13), (0.024, 0.034, 0.03)), ellip(P, (0, 1.333, 0.152), (0.025, 0.022, 0.022))], 0.015), 0.012)   # nez rond
    for s in (1, -1): h = smin(h, ellip(P, (0.128 * s, 1.36, -0.012), (0.024, 0.044, 0.032)), 0.012)          # oreilles
    return h
def neck(P): return capsule(P, (0, 1.13, -0.005), (0, 1.26, 0.0), 0.058)
def hand(P, s):
    sh, el, wr, kn, tip = ARM[s]; d = dirA(s); side = A([math.cos(ANG), math.sin(ANG) * s, 0]) * s   # normale de la paume (vers le corps : −side)
    fw = A([0, 0, 1.0])                                                         # largeur de la main : vers l'avant
    q = P - (wr + 0.048 * d); palm = np.linalg.norm(np.stack([q @ d / 0.054, q @ side / 0.023, q @ fw / 0.046], 1), axis=1) - 1; palm *= 0.023
    fs = []
    for k, off in enumerate((-0.026, -0.009, 0.008, 0.024)):                   # 4 doigts (style cartoon)
        b0 = wr + 0.085 * d + fw * off; L = (0.05, 0.058, 0.055, 0.045)[k]
        fs.append(capsule(P, b0, b0 + L * d + fw * off * 0.25 - side * 0.006, 0.0115, 0.0105))
    th = capsule(P, wr + 0.035 * d + fw * 0.03 - side * 0.006, wr + 0.065 * d + fw * 0.068 - side * 0.012, 0.013, 0.012)
    return U([palm] + fs + [th], 0.012)
def torso(P, k=0.0):
    return U([ellip(P, (0, 1.015, -0.008), (0.182 + k, 0.158 + k, 0.122 + k)), ellip(P, (0, 0.875, -0.006), (0.168 + k, 0.12 + k, 0.115 + k)),
              ellip(P, (0, 0.785, -0.01), (0.168 + k, 0.085 + k, 0.108 + k)), capsule(P, (-0.16, 1.105, -0.012), (0.16, 1.105, -0.012), 0.062 + k)], 0.05)
def arms(P, k=0.0):
    ds = []
    for s in (1, -1):
        sh, el, wr, kn, tip = ARM[s]; ds += [capsule(P, sh, el, 0.062 + k, 0.053 + k), capsule(P, el, wr, 0.053 + k, 0.045 + k)]
    return U(ds, 0.02)
def legs(P, k=0.0, kb=0.0):
    ds = []
    for S in 'GD':
        ds += [capsule(P, J['Cuisse_' + S], J['Jambe_' + S], 0.088 + k, 0.066 + k), capsule(P, J['Jambe_' + S], J['Pied_' + S] + A([0, 0.03, 0]), 0.066 + k, 0.055 + k + kb)]
    return U(ds, 0.03)
def boots(P, k=0.0, high=True, toe=1.0):
    ds = []
    for S in 'GD':
        a = J['Pied_' + S]; x = a[0]
        f = U([capsule(P, (x, 0.05, -0.035), (x, 0.055, 0.15), 0.058 + k, 0.064 * toe + k),
               capsule(P, (x, 0.06, -0.03), (x, 0.21 if high else 0.12, -0.012), 0.066 + k, 0.062 + k)], 0.035)
        f = cutp(f, P, (0, 1, 0), (0, 0.235 if high else 0.13, 0)); ds.append(np.maximum(f, -P[:, 1]))
    return U(ds, 0.001)

def tete(P): return smin(head(P), neck(P), 0.03)
def mains(P): return np.minimum(hand(P, 1), hand(P, -1))
# ---------- vêtements ----------
def veste(P):   # veste de travail fermée, col, poignets ajustés
    d = smin(torso(P, 0.024), arms(P, 0.018), 0.045)
    d = smin(d, capsule(P, (-0.07, 1.165, -0.03), (0.07, 1.165, -0.03), 0.052), 0.04)
    d = cutp(d, P, (0, -1, 0), (0, 0.72, 0))
    for s in (1, -1):
        sh, el, wr, kn, tip = ARM[s]; ax = wr - el; d = cutp(d, P, ax, wr - ax / np.linalg.norm(ax) * 0.004)
    return d
def surfz(f, x, y):   # profondeur de la surface avant d'une couche en (x, y)
    z = np.linspace(0.3, -0.1, 801); P = np.stack([np.full_like(z, x), np.full_like(z, y), z], 1); d = f(P); return z[np.argmax(d < 0)]
def shell(v, a=0.005, b=0.004): return np.maximum(v - a, -(v + b))
def plaque(P, x, y, f, h, r=0.006, dz=0.001, th=0.007):   # plaque posée sur la surface avant de f, qui suit l'arrondi
    zs = surfz(f, x, y); n = A([x * 0.9, 0, 1.0]); n /= np.linalg.norm(n); u = A([n[2], 0, -n[0]])
    q = P - A([x, y, zs + dz]); return rbox(np.stack([q @ u, q[:, 1], q @ n], 1), (0, 0, 0), (h[0], h[1], th), r)
POCHES = [(0.088 * s, 0.985) for s in (1, -1)]
def poches(P): return U([plaque(P, x, y, veste, (0.045, 0.05)) for x, y in POCHES], 0.001)
def rabats(P): return U([plaque(P, x, y + 0.038, veste, (0.049, 0.017), 0.005, 0.009, 0.006) for x, y in POCHES], 0.001)
def passepoil_rabats(P): return U([plaque(P, x, y + 0.019, veste, (0.05, 0.0035), 0.003, 0.012, 0.004) for x, y in POCHES], 0.001)
def coude(P, t0, t1):
    z = 9 + 0 * P[:, 0]
    for s in (1, -1):
        sh, el, wr, kn, tip = ARM[s]; ax = wr - el; L = np.linalg.norm(ax); ax /= L; t = (P - el) @ ax / L
        z = np.minimum(z, np.maximum(t0 - t, t - t1))
    return z
def YOKE(P):   # ligne de l'empiècement : haute devant au milieu, plus basse vers les épaules et dans le dos
    front = np.clip(P[:, 2] / 0.1, 0, 1); return 1.10 + 0.045 * front * np.clip(1 - np.abs(P[:, 0]) / 0.16, 0, 1) - 0.25 * np.maximum(0, np.abs(P[:, 0]) - 0.17)
def epaules(P):   # empiècement noir des épaules (et haut des manches) + coudières
    v = veste(P); yl = YOKE(P); yoke = -(P[:, 1] - yl)
    return np.maximum(shell(v), np.minimum(yoke, coude(P, -0.08, 0.3)))
def passepoils(P):   # passepoils jaunes sous l'empiècement et sous les coudières
    v = veste(P); line = np.abs(P[:, 1] - YOKE(P)) - 0.0045
    return np.maximum(shell(v, 0.0065, 0.004), np.minimum(line, coude(P, 0.3, 0.33)))
def col(P):   # col montant
    v = veste(P); return np.maximum(shell(v, 0.006, 0.006), -(P[:, 1] - 1.135))
def fermeture(P): v = veste(P); return np.maximum.reduce([shell(v, 0.006, 0.004), np.abs(P[:, 0] - 0.012) - 0.016, -(P[:, 2] - 0.06), P[:, 1] - 1.14])
def poignets(P):
    z = 9 + 0 * P[:, 0]
    for s in (1, -1):
        sh, el, wr, kn, tip = ARM[s]; ax = (wr - el) / np.linalg.norm(wr - el); z = np.minimum(z, np.abs((P - (wr - ax * 0.025)) @ ax) - 0.02)
    return np.maximum(shell(veste(P)), z)
def bas_veste(P): return np.maximum(shell(veste(P)), np.abs(P[:, 1] - 0.742) - 0.02)
def sweat(P):
    d = smin(torso(P, 0.034), arms(P, 0.024), 0.05); d = smin(d, ellip(P, (0, 1.18, -0.09), (0.15, 0.075, 0.075)), 0.04)   # capuche dans le dos
    d = cutp(d, P, (0, -1, 0), (0, 0.69, 0))
    for s in (1, -1):
        sh, el, wr, kn, tip = ARM[s]; ax = wr - el; d = cutp(d, P, ax, wr + ax / np.linalg.norm(ax) * 0.008)
    slot = np.maximum.reduce([np.abs(P[:, 0]) - 0.055, -P[:, 2], np.abs(P[:, 1] - 0.94) - 0.26])
    return np.maximum(d, -slot)
def teeshirt(P): return np.maximum(cutp(torso(P, 0.02), P, (0, -1, 0), (0, 0.7, 0)), np.maximum.reduce([np.abs(P[:, 0]) - 0.065, -P[:, 2] + 0.0, np.abs(P[:, 1] - 0.94) - 0.27]))
def cordons(P): return U([capsule(P, (0.035 * s, 1.15, 0.12), (0.04 * s, 1.0, 0.145), 0.0045) for s in (1, -1)], 0.001)
def pantalon(P):
    d = smin(torso(P, 0.016), legs(P, 0.02, 0.012), 0.03); d = cutp(d, P, (0, 1, 0), (0, 0.84, 0))
    return np.maximum(d, -(P[:, 1] - 0.165))
def cargo(P):   # poche cargo sur le côté de la cuisse
    z = 9 + 0 * P[:, 0]
    for S, sg in (('G', 1), ('D', -1)):
        c = J['Cuisse_' + S] + A([0.0, -0.17, 0.0]); x = c[0] + sg * 0.1
        q = P - A([x, c[1], c[2] + 0.005]); z = np.minimum(z, rbox(np.stack([q[:, 2], q[:, 1], q[:, 0] * sg], 1), (0, 0, 0), (0.05, 0.065, 0.02), 0.008))
    return np.maximum(shell(pantalon(P), 0.007, 0.004), z)
def liseres(P):
    z = 9 + 0 * P[:, 0]
    for S, sg in (('G', 1), ('D', -1)):
        c = J['Cuisse_' + S] + A([0.0, -0.12, 0.0]); z = np.minimum(z, np.maximum(np.abs(P[:, 1] - c[1]) - 0.004, -(P[:, 0] * sg - c[0] * sg - 0.03)))
    return np.maximum(shell(pantalon(P), 0.0095, 0.0), np.maximum(z, cargo(P) - 0.003))
def ceinture(P): return np.maximum(torso(P, 0.019), np.abs(P[:, 1] - 0.80) - 0.016)
def chaussures(P): return boots(P, 0.0, False, 1.1)
def semelle(P): return np.maximum(shell(boots(P, 0.0, False, 1.1), 0.007, 0.006), P[:, 1] - 0.03)
def embout(P): return np.maximum.reduce([shell(boots(P, 0.0, False, 1.1), 0.0055, 0.004), -(P[:, 2] - 0.115), 0.03 - P[:, 1]])
def chaussures_jaune(P):   # touches jaunes sur les côtés et lacets
    side = np.maximum(np.abs(P[:, 1] - 0.075) - 0.006, np.abs(P[:, 2] - 0.04) - 0.04)
    lace = U([capsule(P, (J['Pied_' + S][0] - 0.03, 0.105 + 0.012 * k, 0.07 - 0.03 * k), (J['Pied_' + S][0] + 0.03, 0.105 + 0.012 * k, 0.07 - 0.03 * k), 0.0035) for S in 'GD' for k in range(3)], 0.001)
    return np.minimum(np.maximum(shell(boots(P, 0.0, False, 1.1), 0.0045, 0.003), side), np.maximum(lace, -boots(P, 0.0, False, 1.1) - 0.003))
def baskets(P): return boots(P, 0.0, False, 1.0)
def baskets_semelle(P): return np.maximum(boots(P, 0.006, False, 1.0), P[:, 1] - 0.03)
# ---------- cheveux ----------
def hairline(P):
    fz = np.clip(P[:, 2] / 0.13, -1, 1)
    yl = 1.462 - 0.085 * np.maximum(0, -fz) - 0.07 * np.maximum(0, -fz - 0.35) - 0.015 * np.minimum(1, np.abs(P[:, 0]) / 0.1) * np.maximum(0, fz)
    side = (np.abs(P[:, 0]) > 0.11) & (P[:, 2] > 0.005) & (P[:, 2] < 0.04)      # pattes fines devant les oreilles
    yl = np.where(side, np.minimum(yl, 1.395), yl)
    ear = (np.abs(P[:, 0]) > 0.1) & (P[:, 2] > -0.05) & (P[:, 2] <= 0.005) & (P[:, 1] < 1.43)      # oreilles dégagées
    yl = np.where(ear, 9, yl)
    return yl - P[:, 1]
def cheveux(P):
    base = head(P) - 0.012
    tufts = U([capsule(P, (0.0, 1.49, -0.02), (0.015, 1.555, 0.07), 0.055, 0.03),              # houppe vers le haut et l'avant
               capsule(P, (0.06, 1.49, -0.03), (0.07, 1.54, 0.045), 0.045, 0.026), capsule(P, (-0.06, 1.49, -0.03), (-0.05, 1.545, 0.05), 0.046, 0.026),
               capsule(P, (0.03, 1.5, 0.0), (0.095, 1.525, 0.065), 0.034, 0.022), capsule(P, (-0.02, 1.5, 0.0), (-0.095, 1.525, 0.055), 0.034, 0.022),
               capsule(P, (0.0, 1.5, -0.08), (0.0, 1.545, -0.02), 0.05, 0.03)], 0.02)
    d = smin(base, tufts, 0.03); d = np.maximum(d, hairline(P))
    return np.maximum(d, -(head(P) + 0.002))
def barbe(P):
    sh = head(P) - 0.009
    zone = np.maximum(P[:, 1] - 1.325 + 0.04 * np.maximum(0, 0.09 - np.abs(P[:, 0])) / 0.09, -(P[:, 2] + 0.03))      # bas du visage
    mouth = ellip(P, (0, 1.285, 0.13), (0.032, 0.014, 0.05))                      # bouche dégagée
    return np.maximum(np.maximum(sh, zone), -mouth)
def cheveux_longs(P):
    d = smin(cheveux(P), U([ellip(P, (0, 1.30, -0.085), (0.145, 0.18, 0.075)), ellip(P, (0, 1.16, -0.08), (0.155, 0.06, 0.06))], 0.05), 0.05)
    d = np.maximum(d, -(head(P) + 0.002))
    return np.maximum(d, (P[:, 2] - 0.025) * 2 - np.maximum(0, P[:, 1] - 1.40))
def queue(P):
    return U([cheveux(P), ellip(P, (0, 1.43, -0.13), (0.045, 0.035, 0.035)), capsule(P, (0, 1.42, -0.15), (0, 1.2, -0.2), 0.048, 0.03)], 0.025)

# ---------- EPI (portés sur la tête ou les mains, os Tete / mains) ----------
def casque(P):   # casque antibruit : coquilles sur les oreilles, arceau rembourré au-dessus des cheveux
    cups = U([ellip(P, (0.152 * s, 1.36, -0.012), (0.034, 0.06, 0.05)) for s in (1, -1)], 0.001)
    cups = np.maximum(cups, -(np.abs(P[:, 0]) - 0.128))
    r = np.linalg.norm(P[:, :2] - A([0, 1.36]), axis=1)
    band = np.maximum(np.sqrt((r - 0.205) ** 2 + (P[:, 2] + 0.012) ** 2) - 0.014, -(P[:, 1] - 1.41))
    band = np.maximum(band, np.abs(P[:, 2] + 0.012) - 0.02)
    arms_ = U([capsule(P, (0.168 * s, 1.385, -0.012), (0.19 * s, 1.44, -0.012), 0.006) for s in (1, -1)], 0.001)
    return U([cups, band, arms_], 0.008)
def lunettes(P):   # lunettes enveloppantes : écran courbe devant les yeux, branches jusqu'aux oreilles
    e = np.sqrt((P[:, 0] / 0.152) ** 2 + ((P[:, 2] + 0.012) / 0.172) ** 2) - 1
    lens = np.maximum.reduce([np.abs(e) * 0.16 - 0.0022, np.abs(P[:, 1] - 1.388 + 0.01 * (P[:, 0] / 0.1) ** 2) - 0.037 + 0.012 * np.abs(P[:, 0]) / 0.14, -(P[:, 2] - 0.03)])
    nose = ellip(P, (0, 1.372, 0.15), (0.02, 0.022, 0.03))
    lens = np.maximum(lens, -nose)
    temples = U([capsule(P, (0.142 * s, 1.392, 0.04), (0.14 * s, 1.392, -0.05), 0.0035) for s in (1, -1)], 0.001)
    return np.minimum(lens, temples)
def ffp2(P):   # masque FFP2 : coque sur le nez et la bouche, soupape, élastique
    cup = ellip(P, (0, 1.298, 0.092), (0.078, 0.072, 0.092)); cup = np.maximum(np.abs(cup) - 0.003, -(P[:, 2] - 0.095))
    cup = np.maximum(cup, -(head(P) + 0.001))
    strap = np.maximum.reduce([np.abs(head(P) - 0.004) - 0.002, np.abs(P[:, 1] - 1.33 - 0.06 * np.clip(-P[:, 2] / 0.13, 0, 1)) - 0.005, P[:, 2] - 0.12])
    return np.minimum(cup, strap)
def ffp2_soupape(P): return capsule(P, (0.035, 1.275, 0.165), (0.04, 1.272, 0.186), 0.016)
def demimasque(P):   # demi-masque à cartouches : coque caoutchouc + harnais
    cup = ellip(P, (0, 1.295, 0.1), (0.07, 0.068, 0.085)); cup = np.maximum(np.abs(cup) - 0.005, -(P[:, 2] - 0.1))
    cup = np.maximum(cup, -(head(P) + 0.001))
    strap = np.maximum.reduce([np.abs(head(P) - 0.004) - 0.0025, np.abs(P[:, 1] - 1.31 - 0.08 * np.clip(-P[:, 2] / 0.13, 0, 1)) - 0.007, P[:, 2] - 0.11])
    return np.minimum(cup, strap)
def filtres(P): return U([capsule(P, (0.055 * s, 1.27, 0.15), (0.085 * s, 1.255, 0.175), 0.027) for s in (1, -1)], 0.001)
def gant(P, k=0.0045, long=0.07):
    d = mains(P) - k
    for s in (1, -1):
        sh, el, wr, kn, tip = ARM[s]; ax = (wr - el) / np.linalg.norm(wr - el)
        d = smin(d, capsule(P, wr - ax * long, wr + ax * 0.02, 0.052 if long > 0.1 else 0.05, 0.047), 0.02)
    return d
def enduit(P):   # paume et doigts enduits (côté paume, vers le corps) ; dos de la main en tricot
    z = 9 + 0 * P[:, 0]
    for s in (1, -1):
        sh, el, wr, kn, tip = ARM[s]; d = dirA(s); side = A([math.cos(ANG), math.sin(ANG) * s, 0]) * s; t = (P - wr) @ d
        z = np.minimum(z, np.minimum(-(t - 0.085), np.maximum(-(t - 0.0), (P - wr) @ side - 0.004)))
    return np.maximum(shell(gant(P), 0.0025, 0.004), np.maximum(z, -(gant(P) + 0.01)))

# couche : (fonction, boîte [min, max] ou None, pas de grille, triangles visés, couleur sRGB, rugosité)
FULL = ((-0.75, -0.01, -0.35), (0.75, 1.65, 0.32))
HEADB = ((-0.2, 1.08, -0.26), (0.2, 1.64, 0.22))
HANDB = ((-0.72, 0.45, -0.12), (0.72, 0.92, 0.16))
FEETB = ((-0.25, -0.01, -0.12), (0.25, 0.26, 0.26))
HB2 = ((-0.25, 1.08, -0.26), (0.25, 1.68, 0.24))
LAYERS = {
  'tete': (tete, HEADB, 0.0035, 7000, (0.87, 0.6, 0.45), 0.6), 'mains': (mains, HANDB, 0.003, 3600, (0.87, 0.6, 0.45), 0.6),
  'cheveux': (cheveux, HEADB, 0.0035, 3000, (0.3, 0.19, 0.11), 0.7),
  'cheveux_longs': (cheveux_longs, HEADB, 0.004, 3000, (0.42, 0.26, 0.14), 0.7), 'queue': (queue, HEADB, 0.004, 3000, (0.42, 0.26, 0.14), 0.7),
  'veste': (veste, FULL, 0.005, 6000, (0.42, 0.47, 0.55), 0.85), 'veste_epaules': (epaules, FULL, 0.004, 4500, (0.11, 0.12, 0.13), 0.8),
  'veste_passepoils': (passepoils, FULL, 0.0035, 2500, (0.93, 0.85, 0.12), 0.6), 'veste_col': (col, FULL, 0.004, 2500, (0.11, 0.12, 0.13), 0.8),
  'veste_poches': (poches, FULL, 0.003, 1500, (0.4, 0.45, 0.53), 0.8), 'veste_rabats': (rabats, FULL, 0.003, 1200, (0.11, 0.12, 0.13), 0.8),
  'veste_passepoil2': (passepoil_rabats, FULL, 0.0025, 800, (0.93, 0.85, 0.12), 0.6),
  'veste_fermeture': (fermeture, FULL, 0.004, 1500, (0.39, 0.44, 0.52), 0.8), 'veste_poignets': (poignets, FULL, 0.004, 1800, (0.39, 0.44, 0.52), 0.8),
  'veste_bas': (bas_veste, FULL, 0.004, 2000, (0.39, 0.44, 0.52), 0.8),
  'sweat': (sweat, FULL, 0.006, 6000, (0.62, 0.17, 0.17), 0.9), 'sweat_teeshirt': (teeshirt, FULL, 0.006, 1200, (0.9, 0.9, 0.88), 0.9),
  'sweat_cordons': (cordons, FULL, 0.003, 300, (0.92, 0.92, 0.9), 0.8),
  'pantalon': (pantalon, FULL, 0.005, 4500, (0.15, 0.17, 0.22), 0.9), 'pantalon_cargo': (cargo, FULL, 0.0035, 1600, (0.13, 0.15, 0.19), 0.85),
  'pantalon_liseres': (liseres, FULL, 0.003, 800, (0.82, 0.84, 0.86), 0.3),
  'pantalon_ceinture': (ceinture, FULL, 0.005, 600, (0.1, 0.1, 0.11), 0.6),
  'chaussures': (chaussures, FEETB, 0.004, 3000, (0.09, 0.09, 0.1), 0.55), 'chaussures_semelle': (semelle, FEETB, 0.0035, 2000, (0.4, 0.42, 0.44), 0.7),
  'chaussures_embout': (embout, FEETB, 0.0035, 1200, (0.2, 0.21, 0.22), 0.5), 'chaussures_jaune': (chaussures_jaune, FEETB, 0.003, 1500, (0.96, 0.8, 0.1), 0.5),
  'baskets': (baskets, FEETB, 0.004, 2000, (0.95, 0.95, 0.94), 0.6), 'baskets_semelle': (baskets_semelle, FEETB, 0.004, 800, (0.62, 0.64, 0.68), 0.7),
  'epi_casque': (casque, HB2, 0.0035, 5000, (0.1, 0.1, 0.11), 0.45), 'epi_lunettes': (lunettes, HB2, 0.0025, 4000, (0.88, 0.94, 0.97), 0.05, 0.25),
  'epi_ffp2': (ffp2, HB2, 0.003, 3000, (0.95, 0.95, 0.93), 0.9), 'epi_ffp2soupape': (ffp2_soupape, HB2, 0.0025, 600, (0.95, 0.55, 0.15), 0.6),
  'epi_demimasque': (demimasque, HB2, 0.003, 3000, (0.3, 0.32, 0.35), 0.6), 'epi_filtres': (filtres, HB2, 0.0025, 1200, (0.85, 0.32, 0.55), 0.6),
  'epi_gants': (gant, HANDB, 0.003, 3000, (0.94, 0.9, 0.62), 0.95), 'epi_gantsenduit': (enduit, HANDB, 0.003, 2500, (0.95, 0.47, 0.1), 0.65),
  'epi_gantschim': (lambda P: gant(P, 0.004, 0.16), HANDB, 0.003, 3000, (0.15, 0.38, 0.85), 0.45),
}

def mesh(f, box, step):
    lo, hi = A(box[0], float), A(box[1], float); n = np.ceil((hi - lo) / step).astype(int) + 1
    xs = [np.linspace(lo[i], lo[i] + step * (n[i] - 1), n[i]) for i in range(3)]
    P = np.stack(np.meshgrid(*xs, indexing='ij'), -1).reshape(-1, 3); d = np.empty(len(P), np.float32)
    for i in range(0, len(P), 1_500_000): d[i:i + 1_500_000] = f(P[i:i + 1_500_000])
    v, fc, _, _ = marching_cubes(d.reshape(n), 0.0, spacing=(step,) * 3); return v + lo, fc
def simplify(v, f, target):
    v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=max(0.0, 1 - target / len(f))); return v2.astype(np.float64), f2
def smooth(v, f, it=5):
    nb = [[] for _ in range(len(v))]
    for a, b, c in f: nb[a] += [b, c]; nb[b] += [a, c]; nb[c] += [a, b]
    nb = [np.unique(x) for x in nb]
    for _ in range(it):
        for k in (0.5, -0.52):
            m = np.array([v[x].mean(0) if len(x) else v[i] for i, x in enumerate(nb)]); v = v + k * (m - v)
    return v
def voisins(v, f):   # moyenne des voisins (matrice creuse)
    n = len(v); e = np.unique(np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), 1), axis=0)
    Ad = sp.coo_matrix((np.ones(len(e) * 2), (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(n, n)).tocsr(); Ad.data[:] = 1
    deg = np.asarray(Ad.sum(1)).ravel(); return sp.diags(1 / np.maximum(deg, 1)) @ Ad, deg > 0
def taubin(v, f, it, lam=0.5, mu=-0.52):   # lissage qui garde le volume
    W, ok = voisins(v, f)
    for _ in range(it):
        for k in (lam, mu): d = W @ v - v; d[~ok] = 0; v = v + k * d
    return v
def orient(v, f, sdf):   # chaque face tournée comme le gradient du champ (vers l'extérieur), même après simplification
    c = v[f].mean(1); n = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]); e = 1e-3
    g = np.stack([sdf(c + A([e, 0, 0])) - sdf(c - A([e, 0, 0])), sdf(c + A([0, e, 0])) - sdf(c - A([0, e, 0])), sdf(c + A([0, 0, e])) - sdf(c - A([0, 0, e]))], 1)
    bad = np.einsum('ij,ij->i', n, g) < 0; f = f.copy(); f[bad] = f[bad][:, ::-1]; return f
def normals(v, f):
    n = np.zeros_like(v); fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3): np.add.at(n, f[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)

# ---------- poids ----------
def segd(P, b):
    a, c = J[b], J[TAIL[b]]; ab = c - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
ALLOW = { 'epi_casque': ['Tete'], 'epi_lunettes': ['Tete'], 'epi_ffp2': ['Tete'], 'epi_ffp2soupape': ['Tete'], 'epi_demimasque': ['Tete'], 'epi_filtres': ['Tete'],
          'epi_gants': ['Main_G', 'Doigts_G', 'AvantBras_G', 'Main_D', 'Doigts_D', 'AvantBras_D'], 'epi_gantsenduit': ['Main_G', 'Doigts_G', 'AvantBras_G', 'Main_D', 'Doigts_D', 'AvantBras_D'], 'epi_gantschim': ['Main_G', 'Doigts_G', 'AvantBras_G', 'Main_D', 'Doigts_D', 'AvantBras_D'], 'cheveux': ['Tete'], 'barbe': ['Tete'], 'queue': ['Tete'], 'cheveux_longs': ['Tete', 'Cou', 'Dos_haut'],
          'mains': ['Main_G', 'Doigts_G', 'AvantBras_G', 'Main_D', 'Doigts_D', 'AvantBras_D'] }
CLOTH = ('veste', 'sweat', 'pantalon', 'chaussures', 'baskets')
def weights(v, layer):
    base = layer if layer in ALLOW else layer.split('_')[0]; allowed = ALLOW.get(base)
    if base == 'epi': return np.zeros((len(v), 4), np.uint8), np.tile(A([1, 0, 0, 0], np.float32), (len(v), 1))
    D = np.stack([segd(v, b) for b in BONES], 1)
    if base in CLOTH: D[:, BONES.index('Tete')] = 9; D[:, BONES.index('Cou')] += 0.05
    if base == 'tete': D[:, BONES.index('Tete')] -= 0.03 * (v[:, 1] > 1.2)
    if allowed: D[:, [i for i, b in enumerate(BONES) if b not in allowed]] = 9
    near = D.argmin(1); W = np.zeros_like(D)
    adj = { i: [i] + [BONES.index(x) for x in BONES if PARENT[x] == BONES[i]] + ([BONES.index(PARENT[BONES[i]])] if PARENT[BONES[i]] else []) for i in range(len(BONES)) }
    for k in range(len(v)): ids = adj[near[k]]; W[k, ids] = 1 / np.maximum(D[k, ids], 0.004) ** 6
    top = np.argsort(-W, 1)[:, :4]; Wt = np.take_along_axis(W, top, 1); Wt /= Wt.sum(1, keepdims=True)
    return top.astype(np.uint8), Wt.astype(np.float32)

# ---------- GLB compact (KHR_mesh_quantization) ----------
# positions en entiers 16 bits normalisés (la conversion en mètres est rangée dans les matrices de liaison du squelette),
# normales 8 bits, poids 8 bits : fichier valide pour tout lecteur glTF ; une copie compressée (zlib, .glbz) est intégrée aux pages.
import zlib
CACHE = os.environ.get('CACHE')                          # dossier de cache des maillages (pour ne refaire que l'écriture)
lin = lambda c: [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c]
RES = {}
for name, (f, box, step, target, col, rough, *alpha) in LAYERS.items():
    cf = CACHE and os.path.join(CACHE, f'{name}_{target}_{step}.npz')
    if cf and os.path.exists(cf):
        z = np.load(cf); v, fc, n = z['v'], z['f'], z['n']
    else:
        v, fc = mesh(f, box, step)
        v = taubin(v, fc, 12)                                   # lissage du maillage dense (marches de la grille)
        v, fc = simplify(v, fc, target); v = taubin(v, fc, 6)   # puis après simplification
        fc = orient(v, fc, f); n = normals(v, fc); W, _ = voisins(v, fc)
        for _ in range(3): n = W @ n * 0.6 + n * 0.4; n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)   # ombrage adouci
        if cf: os.makedirs(CACHE, exist_ok=True); np.savez(cf, v=v, f=fc, n=n)
    jo, we = weights(v, name)
    RES[name] = (v, fc, n, jo, we, col, rough, alpha)
lo = np.min([r[0].min(0) for r in RES.values()], 0); hi = np.max([r[0].max(0) for r in RES.values()], 0)
C0 = (lo + hi) / 2; HALF = (hi - lo) / 2 * 1.0001
buf = bytearray(); views = []; accs = []
def add(arr, comp, typ, target=None, stride=None, norm=False, mm=None):
    a = np.ascontiguousarray(arr); off = len(buf); buf.extend(a.tobytes())
    while len(buf) % 4: buf.append(0)
    views.append({ 'buffer': 0, 'byteOffset': off, 'byteLength': a.nbytes, **({ 'target': target } if target else {}), **({ 'byteStride': stride } if stride else {}) })
    ac = { 'bufferView': len(views) - 1, 'componentType': comp, 'count': len(a), 'type': typ, **({ 'normalized': True } if norm else {}) }
    if mm: ac['min'], ac['max'] = mm
    accs.append(ac); return len(accs) - 1
meshes = []; nodes = []; mats = []; stats = {}
for name, (v, fc, n, jo, we, col, rough, alpha) in RES.items():
    q = np.clip(np.round((v - C0) / HALF * 32767), -32767, 32767).astype(np.int16)
    qp = np.zeros((len(v), 4), np.int16); qp[:, :3] = q                                   # pas de 8 octets
    nq = np.zeros((len(v), 4), np.int8); nq[:, :3] = np.clip(np.round(n * 127), -127, 127)  # pas de 4 octets
    w8 = np.round(we * 255).astype(np.int32); w8[:, 0] += 255 - w8.sum(1); w8 = np.clip(w8, 0, 255).astype(np.uint8)
    mats.append({ 'name': name, 'pbrMetallicRoughness': { 'baseColorFactor': lin(col) + [alpha[0] if alpha else 1], 'metallicFactor': 0, 'roughnessFactor': rough }, **({ 'alphaMode': 'BLEND', 'doubleSided': True } if alpha else {}) })
    att = { 'POSITION': add(qp, 5122, 'VEC3', 34962, 8, True, ((q.min(0) / 32767).tolist(), (q.max(0) / 32767).tolist())),
            'NORMAL': add(nq, 5120, 'VEC3', 34962, 4, True), 'JOINTS_0': add(jo, 5121, 'VEC4', 34962), 'WEIGHTS_0': add(w8, 5121, 'VEC4', 34962, None, True) }
    big = len(v) >= 65535
    meshes.append({ 'name': name, 'primitives': [{ 'attributes': att, 'indices': add(fc.astype(np.uint32 if big else np.uint16).reshape(-1), 5125 if big else 5123, 'SCALAR', 34963), 'material': len(mats) - 1 }] })
    nodes.append({ 'name': name, 'mesh': len(meshes) - 1, 'skin': 0 }); stats[name] = len(fc)
jn = {}
for b in BONES: jn[b] = len(nodes); nodes.append({ 'name': b })
for b in BONES:
    p = PARENT[b]; nodes[jn[b]]['translation'] = [float(x) for x in (J[b] - (J[p] if p else 0))]
    if p: nodes[jn[p]].setdefault('children', []).append(jn[b])
Dq = np.diag([HALF[0], HALF[1], HALF[2], 1.0]); Dq[:3, 3] = C0                          # entiers normalisés → mètres
ibm = np.array([(np.array([[1, 0, 0, -J[b][0]], [0, 1, 0, -J[b][1]], [0, 0, 1, -J[b][2]], [0, 0, 0, 1]]) @ Dq).T.reshape(-1) for b in BONES], np.float32)
gl = { 'asset': { 'version': '2.0', 'generator': 'atelier-bois-3d tools/personnage/perso_atelier.py', 'copyright': '© 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT, GNU GPL v3' },
       'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
       'scene': 0, 'scenes': [{ 'nodes': list(range(len(RES))) + [jn['Hanches']] }], 'nodes': nodes, 'meshes': meshes, 'materials': mats,
       'skins': [{ 'joints': [jn[b] for b in BONES], 'skeleton': jn['Hanches'], 'inverseBindMatrices': add(ibm, 5126, 'MAT4') }],
       'accessors': accs, 'bufferViews': views, 'buffers': [{ 'byteLength': len(buf) }] }
js = json.dumps(gl, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(buf), 0x004E4942) + bytes(buf)
open(OUT, 'wb').write(glb); open(OUT + 'z', 'wb').write(zlib.compress(glb, 9))
print(OUT, len(glb) // 1024, 'Ko ;', OUT + 'z', os.path.getsize(OUT + 'z') // 1024, 'Ko', stats)
