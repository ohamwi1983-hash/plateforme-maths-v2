# Archive : la vérification de la factorisation de gen7 (`racinesChamp1`, `racinesChamp2`)

Statut : **document d'archive, pas une spécification à suivre.** Il dit où retrouver le code supprimé par la PR #35, quels contrats il respectait, et ce qu'un futur générateur de factorisation pourrait en tirer. Il ne décrit aucun code présent dans le dépôt.

## 1. Pourquoi ce document existe

La PR #35 (« Suppression des quatre anciennes variantes gen7 `af_*` et du mécanisme « retiré » », RAPPORT §51) a supprimé `src/generateurs/analyseFonction/` en entier, y compris le sous-dossier `racines/` (10 fichiers, environ 1 000 lignes). Le critère de la décision était « tout ce qui n'existait que pour les quatre anciennes variantes est du code mort ». **La suppression de `racines/` en découle ; ce n'est pas un arbitrage séparé sur la réutilisation pour un futur générateur de factorisation.** Le risque (« irréversible hors git ») est consigné dans §51 ; ce document en réduit le coût : il évite de devoir refaire l'archéologie.

Vérification faite avant la suppression : aucune ligne `af_*` dans `taches_composition` ni `exercices_assignes` de la base de production (3 profs, 1 élève, 1 tâche sans composition). Aucune donnée n'est concernée.

## 2. Où retrouver le code

Rien n'est perdu : le parent de la suppression est le commit **`4a43a21`** (« Merge pull request #34 »), qui est dans l'historique de `main`.

```
git show 4a43a21:src/generateurs/analyseFonction/racines/verifierRacinesChamp1.ts
git ls-tree -r --name-only 4a43a21 -- src/generateurs/analyseFonction/racines
git show 4a43a21:CLAUDE.md          # section « Vérification de la factorisation de gen7 » (ligne 224)
```

Sources complémentaires, toutes en lecture seule :
- **Ancien pilote** `ohamwi1983-hash/plateforme-maths-pilote` @ `6acc102` : la spec d'origine. Le code archivé en est une réécriture locale, jamais un import.
- **`RAPPORT.md` §19** (phase 3b-2) : conception, divergences délibérées, preuves. Conservé tel quel (le RAPPORT est append-only).
- Matériel de preuve, à `4a43a21` : `scripts/test-verification-racines.ts` (462 lignes, 230 vérifications), `scripts/support/table-verite-racines-pilote.json` (table de vérité différentielle, 893 ko, **15 100 cas** produits en appelant le vrai code de l'ancien pilote), `docs/extraction-table-verite-racines.md` (provenance de cette table), `scripts/support/generateurRacinesTest.ts` (générateur de test à la route réelle).

## 3. Les fichiers (état à `4a43a21`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `racines/types.ts` | 38 | catégories, constantes de champ, codes, garde d'exécution (`:35`) |
| `racines/ecransRacines.ts` | 32 | les deux écrans (`:14`) |
| `racines/genererRacines.ts` | 72 | génération seedée (`:33` `construireRacines`, `:50` `genererRacines`) |
| `racines/verifierRacinesChamp1.ts` | 117 | vérification de la factorisation (`:106`) |
| `racines/verifierRacinesChamp2.ts` | 71 | vérification de la liste de racines (`:53`) |
| `racines/expressionAlgebrique.ts` | 310 | parseur d'expressions en `x` (`:184` `analyserExpression`, `:269` racines du produit, `:297` trinôme) |
| `racines/expressionNumerique.ts` | 276 | évaluateur numérique (`sqrt`, `cbrt`, `abs`, `|…|`) |
| `racines/messagesSyntaxe.ts` | 70 | messages de `parse_error` (`:21` champ 2, `:49` champ 1) |
| `racines/erreurSyntaxe.ts` | 25 | la nature d'une erreur de lecture est une donnée |
| `racines/index.ts` | 23 | exports |

## 4. Les contrats qu'il respectait

**Deux écrans, seulement pour trois catégories.** `racinesChamp1` : « Factorise l'équation $f(x) = 0$ » (`champ_expression`) ; `racinesChamp2` : « Quelles sont les racines éventuelles de cette fonction ? » (`liste_valeurs` avec `permetAucune`, « Pas de racine » / « Au moins une racine »). Aucune aide sur ces écrans. La catégorie `irreductible` (Δ < 0) **saute** ces deux écrans : `ecransRacines("irreductible")` renvoie une liste vide ; ils n'existent pas, ils ne sont pas « présents mais toujours corrects » (garde de typage `CategorieRacines` et garde d'exécution).

**Génération (`genererRacines.ts`).** Ordre des tirages contractuel pour l'ancien `_v1` : `a = entierEntre(1, 4)`, puis `r` : rejet de 0 dans `[−5, 5]` pour la mise en évidence et le produit remarquable ; `entierEntre(1, 5)` pour le binôme. Constructions : mise en évidence `a·x·(x − r)` ; binôme conjugué `a(x − r)(x + r)` ; produit remarquable `a(x − r)²`.

**Champ 1 (`verifierRacinesChamp1.ts`).**
- Illisible → `parse_error` avec message pédagogique ; jamais `not_equivalent`.
- Sinon la saisie doit être une **factorisation** dont les coefficients développés égalent ceux de l'énoncé (tolérance 1e-6), avec en plus : un *produit* (pas une somme) où `x` est un facteur explicite (mise en évidence) ; exactement 2 racines opposées non nulles (binôme) ; exactement 2 racines identiques (produit remarquable). Une factorisation équivalente non maximale est acceptée (`(8x−12)(0,5x+0,75)`).
- Code de compétence **seulement si** `not_equivalent`, un seul, selon la catégorie : `C04` (un facteur est `−x` au lieu de `x`, `:70`), `C05_SIGNE_REPETE` (binôme : deux racines égales de valeur absolue attendue, `:80`), `C06_SIGNE_OPPOSE` (produit remarquable : deux racines opposées de valeur absolue attendue, `:87`). `C07_ou_C08` n'était jamais émis ni déclaré.

**Champ 2 (`verifierRacinesChamp2.ts`).** `[]` = « Pas de racine », jamais correct pour ces catégories ; chaque valeur est une expression numérique (`6/2`, `sqrt(9)`, `|-4|`) ; ordre indifférent ; une valeur seule n'est correcte que pour une racine double ; trois valeurs ou plus = faux ; tolérance 1e-9 (racines exactes). `RACINE_PARTIELLE` : statut `not_equivalent`, exactement deux valeurs, **une seule position égale après tri** (comptage par position, pas intersection d'ensembles).

**Divergences délibérées avec l'ancien pilote (les seules, RAPPORT §19-D).** (1) Une valeur non finie (`sqrt(-1)`, `1/0`) ne déclenche jamais `RACINE_PARTIELLE`. (2) Liste entièrement vide : `parse_error` avec message. (3) Le mot `constructor` n'est plus lu comme une fonction (`Object.hasOwn`, `expressionNumerique.ts:80`). (4) Messages de `parse_error` du champ 1 rédigés (l'ancien n'en avait pas), le caractère recopié est échappé.

## 5. Ce qui reste dans le dépôt après #35

La **taxonomie** de compétences est conservée : `C04`, `C05_SIGNE_REPETE`, `C06_SIGNE_OPPOSE` (`lib/dictionnaireCompetences.ts:136-138`) et leurs explications, ainsi que `RACINE_PARTIELLE`, que gen7 « motif / delta » utilise toujours (`src/generateurs/analyseFonctionMotifDelta/codes.ts`). Un futur générateur de factorisation retrouverait donc ses codes sans rien recréer. Les sections de `CLAUDE.md` consacrées à ces écrans ont été retirées de `CLAUDE.md` ; elles restent consultables à `4a43a21`.

## 6. Piste de reconstruction avec `lirePolynome`

HYPOTHÈSE de conception, non testée : le vérificateur archivé repose sur un arbre syntaxique flottant (tolérance 1e-6). Un nouveau contrôle pourrait s'appuyer sur `lirePolynome` (`src/generateurs/fxDepuisGraphe/polynome.ts`) : lecture exacte dans ℚ, multiplication implicite (`2x(x-4)`, `(x-3)(x+3)`), degré ≤ 4. La comparaison « coefficients développés égaux » deviendrait **exacte** au lieu d'une tolérance, et les racines entières de ces trois catégories restent dans ℚ.

Limites à connaître avant de s'y fier :
- `lirePolynome` renvoie le polynôme **développé** : `x(2x − 8)` et `2x² − 8x` y sont identiques. Les contrôles de **structure** (produit et non somme, `x` explicite en facteur, exactement deux facteurs, détection de `C04` = facteur `−x`) exigent encore une analyse syntaxique de surface, que le lecteur ne fournit pas.
- Aucune racine carrée : les cas à racines irrationnelles de gen7 « motif / delta » ne sont pas couverts (hors périmètre de la factorisation archivée, dont les racines sont entières).
- La table de vérité différentielle de 15 100 cas reste le meilleur banc de non-régression pour un nouveau contrôle : elle est récupérable à `4a43a21`.

## 7. Ce que ce document n'est pas

Ni une demande de réimplémenter la factorisation, ni une autorisation de reprendre la **structure** du code archivé : la règle du dépôt (CLAUDE.md, « ancien pilote = spec en lecture seule ») vaut aussi ici. Un futur générateur de factorisation passe par le contrat de générateur, `lib/registreGenerateurs.ts`, un `variante_id` neuf et la discipline de câblage de `prof.html`.
