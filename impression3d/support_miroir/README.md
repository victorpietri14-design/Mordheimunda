# Support de miroir rotatif, style Homme-Lézard

Cardan à 3 anneaux et socle en pyramide à degrés, pour un miroir de Ø 50 mm.
Le miroir s'oriente librement (360° sur 2 axes) et reste en place par friction.

Pour régénérer après avoir changé une cote (par exemple `MIROIR_EP`) :

```bash
pip install trimesh manifold3d numpy matplotlib
python3 support_miroir.py
```

## Pièces (toutes imprimées à plat, face décorée vers le haut)
| Fichier | Rôle |
|---|---|
| `1_anneau_miroir.stl` | sertissage : la lèvre côté plateau = face avant |
| `1b_jonc_arriere.stl` | bloque le miroir par l'arrière (à coller) |
| `2_anneau_milieu.stl` | anneau intermédiaire |
| `3_anneau_exterieur.stl` | anneau fixe avec ses rayons solaires et le tenon |
| `4_socle_pyramide.stl` | socle, avec une mortaise pour le tenon |

## Quincaillerie
- Tige métal Ø 2 mm (laiton de modélisme, ou un clou de 2 mm), 4 morceaux d'environ 7,5 mm.
- 4 joints toriques **2 x 1 mm** (diamètre intérieur 2 mm, section 1 mm), en NBR ou silicone, quelques euros en kit.
  Ce sont les freins : chaque joint se loge dans l'anneau extérieur, côté intérieur, autour de la tige.
- Lest facultatif mais conseillé : environ 50 g de plombs de pêche ou de rondelles, à coller dans la cavité sous le socle.

## Montage
1. Poser le miroir dans l'anneau 1 (lèvre devant), puis coller le jonc derrière.
2. Axes anneau 1 → anneau 2 : passer la tige par le trou de l'anneau 2 jusqu'au fond du trou de
   l'anneau 1, avec une goutte de colle **uniquement au fond** (dans l'anneau 1).
3. Faire de même pour les axes anneau 2 → anneau 3.
4. Coller le tenon de l'anneau 3 dans le socle.

Avant d'enfiler chaque tige, placer un joint torique dans le logement de l'anneau extérieur.

## Vérifications (`python3 verif.py`)
- Aucune collision sur 360° pour chaque axe, ni dans toutes les combinaisons.
- Le cardan est équilibré : le centre de gravité reste à moins de 0,7 mm des axes.
  La gravité ne fait donc qu'un couple d'environ 0,1 N.mm, et les joints freinent 7 à 40 fois plus.
- Le caoutchouc garde sa pression dans le temps et les pièces imprimées ne sont presque pas contraintes.
  À l'inverse, le mode `FREIN = "serrage"` (trou plus petit que la tige) impose 5 % de déformation au plastique :
  le PLA se détend et la résine risque de fendre. Ce mode est déconseillé.
- Trop dur : une goutte de graisse silicone sur la tige. Trop mou : passer `JOINT_COMP` à 0.25 et réimprimer l'anneau concerné.
