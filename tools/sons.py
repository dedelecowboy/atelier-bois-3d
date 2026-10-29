"""Prépare les enregistrements d'une machine pour le simulateur (engine/synth.js, chargerEchantillons) :
découpe, coupe-bas 40 Hz, mise au même niveau (−20 dBFS), boucles fondues sans clic, MP3 mono 56 kbit/s.
Essai sur la scie à ruban (29/10/2026), enregistrements fournis par l'enseignant :
  start.mp3 = « freesound_community-bandsawstart-105351 » (démarrage, régime établi, arrêt) ;
  coupe.mp3 = « audiopapkin-cutting-wood-on-a-band-saw-320670 » (à vide puis coupes) ;
licence et source à vérifier par l'enseignant (noms de fichiers de type Pixabay / Freesound).
Usage : python3 tools/sons.py <dossier des enregistrements> machines/scie-ruban/sons
Les instants (secondes) des extraits sont propres à ces enregistrements : à adapter pour une autre machine."""
import subprocess, numpy as np, sys, os
S=sys.argv[1]; OUT=sys.argv[2]; SR=44100
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
def save(x,name):
    x=np.clip(x,-0.98,0.98).astype(np.float32)
    p=os.path.join(OUT,name+'.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','56k',p],input=x.tobytes(),check=True)
    print(name, f'{len(x)/SR:.2f} s', os.path.getsize(p),'octets')
st=hp(load(os.path.join(S,'start.mp3'))); co=hp(load(os.path.join(S,'coupe.mp3')))
g_idle=10**(-20/20)/rms(seg(co,0.5,3.9))       # même gain pour les extraits d'un même enregistrement
vide=loop(seg(co,0.5,3.9)*g_idle)
coupe=loop(norm(seg(co,5.0,11.2)))
g_st=10**(-20/20)/rms(seg(st,2.0,4.5))          # le régime établi du démarrage au niveau de « vide »
dem=fade(seg(st,0.0,3.0)*g_st,0.005,0.4)
arr=fade(seg(st,4.6,7.5)*g_st,0.3,0.3)
for x,n in [(dem,'demarrage'),(vide,'vide'),(coupe,'coupe'),(arr,'arret')]: save(x,n)
