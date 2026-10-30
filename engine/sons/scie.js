/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Enregistrements de scie circulaire (fournis par l'enseignant le 30/10/2026, tools/sons.py scie ; licence À VÉRIFIER) :
   mise en marche, régime à vide, coupe, arrêt et frein. Communs à la scie à format, la scie radiale, la déligneuse et la scie
   d'affranchissement de la tenonneuse (crochet bruit.echantillons, engine/audio.js). */
import demarrage from './scie-demarrage.mp3';
import vide from './scie-vide.mp3';
import coupe from './scie-coupe.mp3';
import arret from './scie-arret.mp3';
export const SCIE = { demarrage, vide, coupe, arret };
/* dureté du bois pour la charge de coupe (même échelle que la toupie) */
export const DURETE = { sapin:1, epicea:1, pin:1.1, meleze:1.3, frene:1.6, hetre:1.6, chene:2 };
