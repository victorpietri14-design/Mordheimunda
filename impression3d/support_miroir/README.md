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

## Montage
1. Poser le miroir dans l'anneau 1 (lèvre devant), puis coller le jonc derrière.
2. Axes anneau 1 → anneau 2 : passer la tige par le trou de l'anneau 2 jusqu'au fond du trou de
   l'anneau 1, avec une goutte de colle **uniquement au fond** (dans l'anneau 1).
3. Faire de même pour les axes anneau 2 → anneau 3.
4. Coller le tenon de l'anneau 3 dans le socle.

Les trous où les tiges *tournent* sont à Ø 1,9 mm (paramètre `SERRAGE`) : c'est ce serrage qui donne la résistance.
- Trop dur : repasser un foret de 2 mm.
- Trop mou : une goutte de vernis dans le trou, ou mettre `SERRAGE = 0.15` et réimprimer.
