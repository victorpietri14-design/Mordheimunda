V71b — Visual-only adjustment from V70b
- Base: V70b inline skill tree / spell domain builder.
- Changed only the visual styling of the two creation inputs for custom skill tree/domain name and description.
- They now match the existing custom-field inputs used for weapon traits / special-rule naming fields: dark background, border, typography, padding, focus border and focus glow.
- No data model, behavior, parsing, saving, or layout logic changed.


V3 — La configuration d'une Warband custom référence maintenant tous les combattants de toutes les factions et tout l'équipement du jeu, en plus du contenu custom. Les références sont conservées séparément pour éviter les collisions entre profils portant le même id dans des factions différentes.

V3-fixed (mise à jour) — XP modifiable par quantité (+x / -x)
- Sur la fiche du combattant, cliquer sur le bloc XP ouvre désormais une fenêtre « Ajouter / Soustraire » avec une quantité au choix, exactement comme pour le Trésor et la Réputation dans l'onglet de bande (openFighterXPAdjust / applyFighterXPAdjust, réutilisant le même composant resource-dialog).
- Les boutons rapides ± 1 XP restent disponibles à côté, aucune fonctionnalité retirée.


## V71c — aperçu équipement + effets passifs
- Le nom d'un équipement dans le sélecteur de la fiche combattant affiche au survol/focus un aperçu avec profil d'arme et texte de règle, et peut être ouvert au clic sans lancer l'achat.
- Les effets de profil passifs de Full plate armour, Heavy armour, Sigmarite armour et Laudanum sont désormais synchronisés avec les caractéristiques du combattant.
- Les effets conditionnels nécessitant une action ou un état en jeu (par ex. Crimson Shade) ne sont pas appliqués automatiquement à l'équipement simplement possédé.

## V71d — audit équipements
- Audit des 110 entrées d’équipement du référentiel M17.
- Ajout de l’application automatique de War Trophies (+1 WS), en plus des malus d’armure/Laudanum déjà centralisés.
- Ajout de l’affichage des règles persistantes Magic Resistance provenant de Sigmarite Armour et Amulet of Protection.
- Les effets conditionnels ou dépendants d’une arme/action restent volontairement hors des caractéristiques permanentes.
- Rapport détaillé : `EQUIPMENT_AUDIT_V71d.md`.


## V71e — effets sur armes et comparaison du profil
- Les compétences/équipements qui donnent directement un trait ou un modificateur à une arme compatible sont maintenant affichés sur le profil de l’arme.
- Les effets ajoutés par le combattant sont visuellement mis en évidence tout en conservant la même famille typographique.
- Le profil du combattant compare désormais ses valeurs effectives à un profil normal calculé à partir du profil de base, des advancements et des modificateurs de règles permanents, sans compter l’équipement.
- Une statistique effective inférieure au profil normal est affichée en rouge ; supérieure en vert.
- Les effets situationnels ne sont pas intégrés comme bonus permanents au profil.

## V82 — Audit de code + correctif Lasting Injury
- CORRECTIF DEMANDÉ : la séquelle « Lesson Learned » (11) n'envoie plus le combattant en récupération ; elle applique uniquement le gain d'XP (+D3 ou quantité manuelle), le combattant reste actif. Le texte de la table de référence et de la fenêtre de résolution ont été mis à jour en conséquence.
- BUG CORRIGÉ : `confirmHenchRoll`, la fonction censée appliquer le résultat du jet d'avancement Henchman (table p.129), n'existait pas du tout — la fonctionnalité entière était cassée depuis son introduction. Elle a été implémentée : dépense les 6 XP, applique le +1 caractéristique choisi (en respectant le maximum racial), ou promeut en Veteran selon le résultat.
- BUG CORRIGÉ : `updateFighterStat` (édition manuelle d'une caractéristique sur la fiche) n'existait pas non plus ; implémentée, avec respect du plafond racial (page 129).
- BUG CORRIGÉ : `removeCustomContentDraft` (bouton × sur un élément de brouillon dans le créateur de contenu custom) n'existait pas ; implémentée.
- BUG CORRIGÉ : la table d'avancement Volonté/Intelligence (Héros ET Henchman) référençait un indice de caractéristique hors-limites (12 au lieu de 11), ce qui cassait ce résultat d'avancement pour tout le monde. Corrigé à [10,11] (Volonté, Intelligence).
- NETTOYAGE : aucune fonction dupliquée trouvée dans assets/app.js (le nettoyage précédent a tenu). Suppression de `data/dataset.js`, un fichier de données mort : il n'était chargé par aucune page et n'était référencé nulle part dans le code.
- Vérification : `node --check` sur app.js, et contrôle croisé de tous les gestionnaires onclick/onchange/oninput contre les fonctions définies (0 référence cassée restante, 0 doublon).

## V83 — Style du bouton de suppression skill/sort
- Le bouton « × » pour retirer une compétence ou un sort dans la fiche du combattant n'avait aucun style dédié et affichait le bouton par défaut du navigateur (rectangle gris) à l'intérieur de la pastille arrondie. Il est maintenant un petit bouton rond discret, intégré à la pastille, qui se met en rouge doux au survol pour indiquer clairement l'action de suppression.
