"""Prépare les enregistrements d'une machine pour le simulateur (engine/synth.js, chargerEchantillons) :
découpe, coupe-bas 40 Hz, mise au même niveau (−20 dBFS), boucles fondues sans clic, MP3 mono 56 kbit/s.
Essai sur la scie à ruban (29/10/2026), enregistrements fournis par l'enseignant :
  start.mp3 = « freesound_community-bandsawstart-105351 » (démarrage, régime établi, arrêt) ;
  coupe.mp3 = « audiopapkin-cutting-wood-on-a-band-saw-320670 » (à vide puis coupes) ;
licence et source à vérifier par l'enseignant (noms de fichiers de type Pixabay / Freesound).
Aspiration (commune à toutes les machines, fournie le 29/10/2026) : asp.mp3 = « audiopapkin-mobile-extraction-in-the-carpentry-workshop-320669 »
(régime établi puis arrêt et ralentissement de 15 s) → engine/sons/aspiration.mp3 (boucle) et aspiration-arret.mp3.
Rabotage (raboteuse ET dégauchisseuse, fourni le 30/10/2026) : rabot.mp3 = « Woodworking Machinery Sound Effect - Power Tool Sounds -
Timber Planer Thicknesser Machine » (silence 0–2,5 s, à vide 2,5–4,5 s, usinage 4,5–23,3 s, à vide 25,8–28 s) → engine/sons/rabotage-vide.mp3
(2,8–4,4 s + 26,0–27,4 s, en boucle) et rabotage-coupe.mp3 (boucle 5,0–11,5 s) ; pas de démarrage ni d'arrêt enregistrés (la boucle à vide ralentit au freinage).
Scies circulaires (scie à format, scie radiale, déligneuse, scie de la tenonneuse ; fourni le 30/10/2026) :
  switch.mp3 = « audiopapkin-table-saw-switch-on-off-326820 » (mise en marche à 0,1 s, régime établi 1,5–4 s, arrêt et frein 4–7,6 s) ;
  circ.mp3 = « freesound_community-circ_saw-03-87937 » (coupe continue 0,25–4,1 s) → engine/sons/scie-*.mp3.
Usage : python3 tools/sons.py scie <dossier des enregistrements> engine/sons
Usage : python3 tools/sons.py rabotage <dossier des enregistrements> engine/sons
Usage : python3 tools/sons.py ruban <dossier des enregistrements> machines/scie-ruban/sons
        python3 tools/sons.py aspiration <dossier des enregistrements> engine/sons
Les instants (secondes) des extraits sont propres à ces enregistrements : à adapter pour une autre machine."""
import subprocess, numpy as np, sys, os
RECETTE, S, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; SR=44100
def load(f):
    raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw,np.float32).copy()
def seg(x,a,b): return x[int(a*SR):int(b*SR)].copy()
def rms(x): return float(np.sqrt(np.mean(x**2)))
def norm(x,target=-20): return x*(10**(target/20)/rms(x))
def loop(x,xf=0.35):
    n=int(xf*SR); L=len(x)-n
    t=np.linspace(0,1,n); fi=np.sqrt(t); fo=np.sqrt(1-t)
    y=x[:L].copy(); y[:n]=x[:n]*fi + x[L:L+n]*fo   # fin fondue dans le début : boucle sans clic
    return y
def hp(x,f=40):   # coupe-bas léger (souffle, manipulation du téléphone)
    a=np.exp(-2*np.pi*f/SR); y=np.zeros_like(x); p=0; px=0
    for i,v in enumerate(x): p=a*(p+v-px); px=v; y[i]=p
    return y
def fade(x,i=0.01,o=0.05):
    ni,no=int(i*SR),int(o*SR); x[:ni]*=np.linspace(0,1,ni); x[-no:]*=np.linspace(1,0,no); return x
def save(x,name,kbps=56):
    x=np.clip(x,-0.98,0.98).astype(np.float32)
    p=os.path.join(OUT,name+'.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a',f'{kbps}k',p],input=x.tobytes(),check=True)
    print(name, f'{len(x)/SR:.2f} s', os.path.getsize(p),'octets')
def ruban():
    st=hp(load(os.path.join(S,'start.mp3'))); co=hp(load(os.path.join(S,'coupe.mp3')))
    g_idle=10**(-20/20)/rms(seg(co,0.5,3.9))       # même gain pour les extraits d'un même enregistrement
    vide=loop(seg(co,0.5,3.9)*g_idle)
    coupe=loop(norm(seg(co,5.0,11.2)))
    g_st=10**(-20/20)/rms(seg(st,2.0,4.5))          # le régime établi du démarrage au niveau de « vide »
    dem=fade(seg(st,0.0,3.0)*g_st,0.005,0.4)
    arr=fade(seg(st,4.6,7.5)*g_st,0.3,0.3)
    for x,n in [(dem,'demarrage'),(vide,'vide'),(coupe,'coupe'),(arr,'arret')]: save(x,n)

def aspiration():
    x=hp(load(os.path.join(S,'asp.mp3')))
    g=10**(-20/20)/rms(seg(x,2.0,11.0))           # régime établi à −20 dBFS, l'arrêt avec le même gain
    save(loop(seg(x,2.0,11.0)*g,0.5),'aspiration',40)            # 40 kbit/s : ce son est dans chaque page
    save(fade(seg(x,11.6,19.0)*g,0.2,1.5),'aspiration-arret',40)
def rabotage():
    x=hp(load(os.path.join(S,'rabot.mp3')))
    a,b=norm(seg(x,2.8,4.4)),norm(seg(x,26.0,27.4))     # deux plages à vide mises bout à bout (fondu 0,2 s) : boucle moins répétitive
    n=int(0.2*SR); t=np.linspace(0,1,n); ab=np.concatenate([a[:-n], a[-n:]*np.sqrt(1-t)+b[:n]*np.sqrt(t), b[n:]])
    save(loop(ab,0.3),'rabotage-vide',48)
    save(loop(norm(seg(x,5.0,11.5)),0.35),'rabotage-coupe',48)
def scie():
    x=hp(load(os.path.join(S,'switch.mp3'))); c=hp(load(os.path.join(S,'circ.mp3')))
    g=10**(-20/20)/rms(seg(x,1.5,3.95))            # même gain pour le démarrage, le régime établi et l'arrêt
    save(fade(seg(x,0.08,2.6)*g,0.005,0.4),'scie-demarrage',48)
    save(loop(seg(x,1.5,3.95)*g,0.3),'scie-vide',48)
    save(fade(seg(x,3.95,7.6)*g,0.2,0.3),'scie-arret',48)
    save(loop(norm(seg(c,0.25,4.15)),0.35),'scie-coupe',48)
{'scie':scie,'ruban':ruban,'aspiration':aspiration,'rabotage':rabotage}[RECETTE]()
