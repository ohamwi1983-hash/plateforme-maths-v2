# gen9 « Complète le carré » — livrable

`variante_id` `completion_du_carre`, `generateur_id` `gen9`, entrée 4e n° 68 (« La fonction du second degré »). Détail et citations `fichier:ligne` : `RAPPORT.md` §59. Conception validée : `docs/gen9-conception-avant-go.md`.

## Ce que l'élève voit

- **Écran 1 (poids 3).** On lui donne `f(x) = 52 + 2x² − 20x` (forme développée, termes mélangés, jamais dans l'ordre `ax² + bx + c`), il écrit `f(x)` sous la forme canonique `a(x − p)² + q` (aperçu LaTeX pendant la frappe). Aide à **deux paliers** : (1) `a` mis en facteur sur les deux premiers termes ; (2) le schéma général `a[(x + b/2a)² − (b/2a)²] + c`, la quantité `(b/2a)²` en emphase. Le serveur ne sert qu'un palier à la fois ; la pénalité est binaire.
- **Écran 2 (poids 2).** La chaîne de transformations de `x²` à la fonction **qu'il a confirmée** à l'écran 1 (même fausse : option 4 de gen8), composant et vérification partagés avec gen8.
- **Configuration par ligne** (côté professeur) : les cinq transformations de gen8, mais **TH obligatoire** (cochée et verrouillée) ; EV et CV s'excluent.

## Décisions et écarts par rapport au prompt

| Sujet | Choix |
|---|---|
| `a = −1` | Non exclu. Les deux codes sur `p` coïncident (et ceux sur `q`) : aucun code émis. |
| `a = 1` | Les valeurs « facteur oublié » sont les valeurs justes : `P_FACTEUR_A_OUBLIE` et `Q_FACTEUR_A_OUBLIE` inertes, sans rendre EV/CV/SOX obligatoires. |
| `P_SIGNE_INVERSE` (prompt) | Même condition que `SIGNE_P_INVERSE` de gen8 : un seul code, partagé. Trois nouveaux codes, pas quatre. |
| Forme canonique exigée | L'énoncé est développé : avec la vérification de gen8 (coefficients développés), recopier l'énoncé serait « juste ». `lireFormeCanonique` impose `a(x − p)² + q`. |
| `b`, `c` entiers | Tirage dans la liste exhaustive des couples (translation, facteur) admissibles (76 pour EV, 18 pour CV). |
| Noyau partagé | `src/generateurs/_noyauQuadratique/` : modifier un pool ou le repli impose un nouveau `variante_id` à gen8 **et** gen9. |

## À décider (rien n'a été modifié)

1. **`parse_error` consomme un essai** (`lib/moteurTentatives.ts`). Mon document de conception et des commentaires de gen8 affirmaient le contraire ; c'était faux, corrigé dans le code. Conséquence pour gen9 : un élève qui recopie l'énoncé développé perd un essai (avec 1 seul essai, la solution est révélée sous correction immédiate + « Afficher la réponse attendue »). Le message d'erreur explique la forme attendue seulement sous correction immédiate. Rendre `parse_error` gratuit est un changement transversal à tous les générateurs ; à vous de dire si vous le voulez, et pour quels cas (saisie illisible seulement, ou aussi « forme non canonique »).
2. **Palier 1 de l'aide.** Il montre `b/a = −2p` en clair, donc `p` s'en déduit en divisant par 2 ; le palier 2 symbolique ne protège donc pas vraiment la valeur de `p²`. C'est la décision validée (le palier 1 reste l'étape « factoriser `a` »), mais l'argument « ne pas donner `p²` » est surtout cosmétique.

## Vérifications

- Tests par propriété : `test-gen9-generation`, `test-gen9-ecran1` (4 codes contre un oracle écrit en `(a, b, c)`, recopie de l'énoncé refusée sur 14 400 cas, a = −1 sans code, a = 1 inerte, mutation du diagnostic détectée), `test-gen9-aide`, `test-gen9-ecran2`, `test-route-gen9` (vrai `api/router.ts`, base en mémoire), `test-formule-paliers`, plus les suites gen8 inchangées (la refonte du noyau n'a changé aucun compte).
- Chromium (390 et 1280 px) : `scenarioGen9Prof` (câblage `prof.html` : bloc présent, champ « nombre d'exercices » non `disabled`, TH verrouillée, tâche à deux lignes créée par l'interface), `scenarioGen9Eleve` (cinq configurations, recopie, huit réponses fausses dont deux à `a = −1` sans code, deux paliers, trois régimes de correction), `chromium-design` (référence `docs/reference/formule-emphase.html`).
- Aucune migration : `supabase/` n'a pas été touché.
