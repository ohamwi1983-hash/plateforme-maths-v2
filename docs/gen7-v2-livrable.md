# gen7 reconstruit — livrable (RAPPORT §49)

Deux familles, dix sous-variantes, six écrans identiques, calcul exact. Ce document résume ce qui change pour le professeur et pour l'élève ; le détail technique, avec les citations `fichier:ligne`, est dans `RAPPORT.md` §49.

## Ce que voit le professeur (catalogue 4e, n° 7)

| N° | Identifiant | Libellé affiché | Exercices distincts |
|---|---|---|---|
| 1.1 | `af_motif_aucune_racine` | Aucune racine réelle (b=0) | 32 |
| 1.2 | `af_motif_racine_double_rationnelle` | Racine double rationnelle | 80 |
| 1.3 | `af_motif_racine_double_irrationnelle` | Racine double irrationnelle | 180 |
| 1.4 | `af_motif_racines_opposees_rationnelles` | Racines opposées rationnelles (b=0) | 40 |
| 1.5 | `af_motif_racines_opposees_irrationnelles` | Racines opposées irrationnelles (b=0) | 90 |
| 1.6 | `af_motif_racine_nulle_rationnelle` | Une racine nulle, l'autre rationnelle (c=0) | 96 |
| 1.7 | `af_motif_racine_nulle_irrationnelle` | Une racine nulle, l'autre irrationnelle (c=0) | 288 |
| 2.1 | `af_delta_aucune_racine` | Aucune racine réelle (Δ<0) | 180 |
| 2.2 | `af_delta_racines_rationnelles` | Deux racines distinctes rationnelles | 472 |
| 2.3 | `af_delta_racines_irrationnelles` | Deux racines distinctes irrationnelles | 744 |

Les quatre anciennes variantes (`af_mise_en_evidence`, `af_binome_conjugue`, `af_produit_remarquable`, `af_irreductible`) ne sont plus proposées. Elles restent exécutables : un exercice déjà assigné continue de fonctionner.

## Ce que fait l'élève (six écrans, dans cet ordre)

1. **Coefficients** : `a`, `b`, `c` ; une racine carrée s'écrit `sqrt(2)`.
2. **Allure** : le sens de la parabole ET la position du sommet par rapport à l'axe Oy ; les deux réglages pilotent le même croquis en direct ; une seule aide, qui couvre les deux questions.
3. **Axe de symétrie et sommet** (poids 2).
4. **Ensemble-image** : l'aperçu « im f = » s'affiche au-dessus de la saisie ; pas d'aide.
5. **Racines** : liste de valeurs (ou « Pas de racine »), résultat seul (poids 2 pour la famille sans discriminant, 3 pour celle avec).
6. **Tableau de signe et de variation** (poids 3) : l'aide est un croquis de la parabole.

Les écrans 2 à 6 sont jugés sur la fonction que l'élève a confirmée à l'écran 1 quand elle est exploitable (règle de cascade existante), sinon sur la vraie fonction.

## Diagnostics pour le professeur (codes de compétence)

`ALLURE_PARTIELLE`, `AXE_SYMETRIE_NOTATION`, `RACINE_NON_SIMPLIFIEE`, `RACINE_PARTIELLE`, `RACINES_NOMBRE_INCORRECT`, `TABLEAU_SIGNE_PARTIEL`, `TABLEAU_VARIATION_PARTIEL`, `TABLEAU_SIGNE_INVERSE`, `TABLEAU_CONCAVITE_INCORRECTE`.

## Ce qu'il faut savoir

- **À vérifier sur la vraie base** : qu'aucun ancien `af_*` n'a été assigné à de vrais élèves (cela n'a pas pu être vérifié depuis l'environnement de développement). Même si c'est le cas, rien ne casse : les exercices existants restent servis.
- **Petits ensembles** : les sous-variantes 1.1 (32) et 1.4 (40) produisent peu d'exercices distincts ; éviter d'en assigner beaucoup à un même élève.
- **Indice uniforme** : toutes les consignes rappellent « Une racine carrée s'écrit sqrt(2) », même pour un exercice sans radical, pour ne pas révéler la nature des racines.
- **Tableau** : si les coefficients confirmés changent le nombre de racines, la structure du tableau change aussi ; une réponse bâtie sur la vraie fonction est alors signalée comme illisible plutôt que fausse.
- Une tâche non encore assignée qui contenait un ancien `af_*` ne peut plus être modifiée sans le retirer.

## Vérifications faites

Typage, suite complète des tests (dont `test-route-motif-delta`, 200 vérifications sur le vrai routeur), `npm run chromium-temoin` (3321 vérifications, 10 sous-variantes × 390 et 1280 px, parcours complet au clic), `npm run chromium-design`.
