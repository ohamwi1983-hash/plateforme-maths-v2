# gen7 v2 — état des lieux avant le « Go »

> **Aucun code n'a été écrit.** Ce document répond à la section « Avant le Go » du prompt `PROMPT-gen7-v2-reconstruction.md` : ce qui est réellement réutilisable, la mécanique de génération des complexes conjugués invisibles, la nomenclature des dix `variante_id`. Lecture faite sur `main` (`222b5d6`). Chaque affirmation cite le fichier et la ligne.

## 0. Synthèse

Le chantier est faisable, mais **il est nettement plus gros que le prompt ne le suppose**, parce que le prompt s'appuie sur plusieurs prémisses que le code réel ne confirme pas (§2). Les trois plus lourdes :

1. **Tout gen7 raisonne en entiers.** `fonctionDe` refuse un coefficient non entier (`src/generateurs/analyseFonction/types.ts:49`), `xS ∈ ½ℤ`, `yS ∈ ¼ℤ`, les comparaisons ont une tolérance de 0,005. Les sous-variantes 1.3, 1.5, 1.7 et 2.3 exigent des coefficients et des racines **irrationnels** : le modèle numérique doit être remplacé par un calcul **exact**, pas étendu.
2. **Le contrat n'accepte qu'une aide par écran** (`lib/contratGenerateur.ts:88`) et la base n'enregistre qu'une aide par `(exercice, champ)` (`supabase/schema.sql:262`). « Aide 1 + Aide 2 » sur l'écran Allure est une **décision de contrat avec migration**.
3. **Le `sqrt` existant est numérique** (`racines/expressionNumerique.ts:239`, `Math.sqrt`) : il ne distingue pas `sqrt(8)` de `2sqrt(2)`. La comparaison exacte-symbolique exige un **nouveau module**.

**Neuf décisions sont à trancher avant le Go** (§5). Sans elles, je risquerais de construire la mauvaise chose.

## 1. Ce qui est réellement réutilisable

| Élément | État réel | Verdict |
|---|---|---|
| `champs_multiples` (écrans 1 et 3) | Existe, sous-champs texte ou choix, restauration `valeurInitiale`. | **Réutilisable tel quel.** |
| Croquis d'allure | Existe : `construireCroquisAllure` (`public/moteur/croquis.js:204`), **un seul dessin** piloté par **deux sous-champs** (`signeA` → concavité, `signeAB` → décalage horizontal du sommet : `+` à gauche, `-` à droite, `0` au centre). Illustration, pas aide : aucune pénalité. Déclaré par `IllustrationAllure` (`lib/contratGenerateur.ts:210`), utilisé aussi par le témoin technique (`_temoinTechnique/index.ts:419`). | **Le mécanisme est déjà celui que le prompt demande** (voir D2) ; seul change ce qu'on demande à l'élève. |
| `intervalle` (écran 4) | Existe, avec un aperçu en direct `.moteur-apercu` (`ecrans/intervalle.js:66`), mais **sous** la ligne de saisie et sans « im f = ». | Réutilisable ; aperçu à repositionner et à libeller (champ optionnel, défaut inchangé). |
| `liste_valeurs` + `permetAucune` (écran 5) | Existe (`lib/contratGenerateur.ts:117`). | **Réutilisable tel quel.** |
| Tableau de signes et variations (écran 6) | Structuré, `resoudreRangees`, `comparerCasesTableau`. | Réutilisable pour la structure ; **ses colonnes et sa vérification supposent des racines numériques** (`tableauSignes.ts:37-60, 95-125`) : à rebrancher sur le calcul exact. |
| Aide `formule_coloree` | Existe ; les segments sont du LaTeX brut (`\sqrt{2}` admis par la validation). | Réutilisable ; la convention `x` / `x²` sans « 1 » est déjà respectée (`formatage.ts` `monome`, `ecrans.ts` `aideFormuleColoree`) pour les entiers. |
| Aide `croquis_parabole` | **Entiers exigés** (`lib/aideTypee.ts:13`, `COEFFICIENT_MAX`). | **Inutilisable avec un coefficient irrationnel** (voir D8). |
| Cascade (`dependDe`, `projeter`, §45) | Générique, réutilisable. | Réutilisable ; `effectifDepuisReponses` (`cascade.ts:214`) lit les coefficients par `lireNombreOuFraction` : à remplacer. |
| `racinesChamp1` / `racinesChamp2` (3b-2) | Numériques (tolérance 1e-9), jugés sur l'équation **vraie**, « pas de racine » jamais correct. | **Non réutilisables pour l'écran 5.** Conservés intacts comme le demande le prompt. |
| Poids par écran | Aucun écran de gen7 ne déclare `poids` : défaut 1. | OK ; le poids de « Racines » (2 ou 3) dépend de la famille, `ecrans(exercice)` est pure : possible. |
| Registre, aperçu, tableau de bord | Génériques (`chercherGenerateur`). | Rien à changer. |

## 2. Divergences entre le prompt et le code réel

| # | Le prompt dit… | Le code réel… | Conséquence |
|---|---|---|---|
| **D1** | « Deux aides distinctes sur le même écran, à confirmer que le contrat le permet » | **Non** : `aide?: string \| AideTypee` (`contratGenerateur.ts:88`) ; `aides_utilisees` a pour clé `(exercice_assigne_id, champ)` (`schema.sql:262-267`) ; la pénalité est un booléen par champ (`moteurTentatives.ts:118`, `etatExercice.ts:283`). | Décision de contrat **et** migration `schema.sql` + `cumulatif.sql` (discipline du dépôt). Voir Q1. |
| **D2** | « Nouveau réglage indépendant : position du sommet… second croquis… à trancher » | Il y a **un seul dessin** et deux réglages **déjà indépendants** ; le second (`signeAB`) déplace déjà le sommet. Comme `xS = −b/(2a)`, `signe(xS) = −signe(ab)`. | Pas de second croquis. On remplace la question « signe de `a·b` » par « position du sommet » (`x<0`, `x=0`, `x>0`) ; `ALLURE_PARTIELLE` reste valable. Le contrat d'illustration reçoit un champ optionnel (le témoin garde son comportement). |
| **D3** | « Prévisualisation textuelle en direct au-dessus (« im f = … ») » | Un aperçu existe déjà, **en dessous**, sans libellé. | Petit ajout optionnel au contrat `intervalle`. |
| **D4** | « Utiliser seulement `sqrt(n)`, comparaison exacte-symbolique » | L'évaluateur `sqrt` actuel est **flottant** et ne lève pas d'erreur sur `sqrt(-1)` (`NaN`). | Module **exact** neuf (espace vectoriel sur ℚ engendré par les `√r`, `r` sans facteur carré). |
| **D5** | « Codes inchangés : `TABLEAU_SIGNE_PARTIEL`, `TABLEAU_VARIATION_PARTIEL`, `TABLEAU_SIGNE_INVERSE`, `TABLEAU_CONCAVITE_INCORRECTE` » | **Ces quatre codes n'existent pas** (0 occurrence dans `lib/` et `src/`). Le tableau n'émet que `SIGNE_VARIATION_PARTIEL` (`tableauSignes.ts:125`). | Je garde `SIGNE_VARIATION_PARTIEL` tel quel. Les quatre autres seraient des **détecteurs neufs**, hors du « inchangé ». Voir Q8. |
| **D6** | « `RACINE_NON_SIMPLIFIEE` (déjà existant) » | C'est un **libellé de catégorie** (`lib/categoriesCompetences.ts:73`), **absent du dictionnaire** et jamais émis. Un code curriculaire doit exister dans le dictionnaire (`registreGenerateurs.ts:52-55`). | À créer : dictionnaire + `explicationsCompetences.ts` + `explicationsCompetencesEleve.ts` (+ catégorie). Idem pour `RACINES_NOMBRE_INCORRECT`. |
| **D7** | « L'écran 5 : … ses coefficients confirmés, même faux, en donnent deux » | Aujourd'hui les écrans racines sont jugés sur l'équation **vraie** (CLAUDE.md:236, « restent sur l'équation VRAIE »). | L'écran 5 passe sur la fonction **effective** (comme le tableau, §41) : la règle §38 est **modifiée**, CLAUDE.md à réécrire, et le calcul exact des racines d'une fonction arbitraire à coefficients exacts devient nécessaire (voir §3.4). |
| **D8** | Écran 6 : « aucun changement » (aide parabole incluse) | `croquis_parabole` exige des entiers ; avec `b` irrationnel (1.3, 1.7) l'aide est invalide. Le repli actuel (`ecrans.ts:76`, vraie parabole) échoue aussi : elle est non entière. | Assouplir `croquis_parabole` aux réels finis (le croquis est qualitatif), **ou** retirer l'aide du tableau pour ces familles. Voir Q4. |
| **D9** | « Remplacement de la structure actuelle » | Un générateur **curriculaire doit figurer au catalogue** (`registreGenerateurs.ts:50`) ; retirer les 4 `af_*` du catalogue **exige** de les retirer du registre, donc de casser la régénération de tout exercice déjà assigné. | Voir Q2 : je recommande de les **conserver, cachés**. |
| **D10** | « Termes dans un ordre mélangé, jamais dans l'ordre canonique » | Aujourd'hui le mélange peut tomber sur l'ordre canonique. Avec **2 termes non nuls** (1.1, 1.4, 1.5, 1.6, 1.7 : 5 familles sur 10), l'**unique** ordre non canonique est déterministe (`c + ax²`, ou `bx + ax²`). | Aucun aléa pour ces 5 familles : un élève verra toujours `−4 + 3x²`. À valider (Q7). |
| **D11** | 2.1 : « mêmes conditions que 1.1 » (donc `b = 0` ?) | Avec `b = 0`, 2.1 serait **identique à 1.1** (seul le poids de l'écran 5 changerait). | Hypothèse retenue : 2.1 a `b ≠ 0` (complexes `p ± iq`, `p ≠ 0`). Voir Q6. |
| **D12** | Précision « arrondi au centième » de l'écran 3 | La consigne actuelle accepte ±0,005 (`axeSommet.ts`). | Conflit avec « exact, jamais de tolérance ». Voir Q5. |
| **D13** | Libellés du catalogue des 10 sous-variantes | Non fournis. Le JSON (`4e:7`) et `CORRESPONDANCE_JSON_VERS_PILOTE` (`prof.html:1481`) exigent des libellés **mot pour mot identiques** à `CATALOGUE_GENERATEURS` (`lib/catalogueGenerateurs.ts:12`). | Propositions en §4 ; à valider. |

## 3. Mécanique de génération

### 3.1 Complexes conjugués invisibles (1.1 et 2.1)

On tire `z = p + i·q` avec `q > 0`, puis on développe **dans le générateur seulement** :

```
f(x) = a·(x − z)(x − z̄) = a·[ x² − 2p·x + (p² + q²) ]
     ⇒ b = −2ap , c = a(p² + q²) , Δ = b² − 4ac = −4a²q² < 0
```

* **Réel par construction** : `b` et `c` ne dépendent que de `p` et `q`. `z` et `z̄` ne quittent jamais la fonction `generer` : l'exercice ne porte que `(a, b, c)`.
* **1.1 : `p = 0`** donc `b = 0`, `f = a(x² + β²)` avec `β = q`.
* **2.1 : `p ≠ 0`** donc `b ≠ 0` (hypothèse Q6).
* **Coefficients entiers** : `p` entier ou demi-entier, `q` entier ; on rejette tout tirage où `2ap` ou `a(p² + q²)` n'est pas entier (vérifié : 180 exercices distincts en 2.1, tous entiers).
* Δ < 0 est **prouvé par la forme**, pas testé numériquement : un test de propriété le contrôle quand même sur toutes les graines.

### 3.2 Les dix familles (formes exactes, vérifiées par calcul)

`a ∈ ±{1,2,3,4}`, `n ∈ {2,3,5,6,7,10}` (sans facteur carré), `m` entier. Bornes **provisoires** (à valider, Q9).

| # | Forme | `b` | `c` | `xS` | `yS` | Racines | Termes | Exercices distincts* |
|---|---|---|---|---|---|---|---|---|
| 1.1 | `a(x² + β²)`, `β ∈ 1..4` | 0 | `aβ²` | 0 | `c` | aucune réelle | 2 | 32 |
| 1.2 | `a(x − r)²`, `r ∈ ±1..5` | `−2ar` | `ar²` | `r` | 0 | `r` double | 3 | 80 |
| 1.3 | `a(x − s·m√n)²`, `m ≤ 2`, `s = ±1` | `−2asm√n` **irr.** | `am²n` | `sm√n` **irr.** | 0 | `sm√n` double | 3 | 192 |
| 1.4 | `a(x² − r²)`, `r ∈ 1..5` | 0 | `−ar²` | 0 | `c` | `±r` | 2 | 40 |
| 1.5 | `a(x² − m²n)`, `m ≤ 2` | 0 | `−am²n` | 0 | `c` | `±m√n` | 2 | 96 |
| 1.6 | `a·x(x − r)`, `r ∈ ±1..6` | `−ar` | 0 | `r/2` | `−ar²/4` | `0`, `r` | 2 | 96 |
| 1.7 | `a·x(x − s·m√n)`, `m ≤ 3` | `−asm√n` **irr.** | 0 | `sm√n/2` **irr.** | `−am²n/4` rationnel | `0`, `sm√n` | 2 | 288 |
| 2.1 | `a[x² − 2px + p² + q²]`, `p ∈ ½ℤ*`, `q ≤ 3` | `−2ap` ≠ 0 | `a(p² + q²)` | `p` | `a·q²` | aucune réelle | 3 | 180 |
| 2.2 | `a(x − r₁)(x − r₂)`, `r₁ < r₂`, non nuls, non opposés | `−a(r₁+r₂)` ≠ 0 | `ar₁r₂` ≠ 0 | `(r₁+r₂)/2` | `−a(r₁−r₂)²/4` | `r₁`, `r₂` rationnelles | 3 | 480 |
| 2.3 | `a[(x − p)² − m²n]`, `p ∈ ±1..4`, `m ≤ 2` | `−2ap` ≠ 0 | `a(p² − m²n)` | `p` | `−am²n` | `p ± m√n` | 3 | 768 |

\* avec les bornes ci-dessus. **Vérifié par calcul exact** : les affirmations du prompt tiennent (1.7 : `yS` rationnel et `xS` irrationnel ; 2.3 : racines forcément non nulles et non opposées car `√n` est irrationnel ; 2.2 : par rejet explicite). En 2.3, `Δ = 4a²m²n` n'est jamais un carré parfait puisque `n` est sans facteur carré.

**Remarques :**
* **1.1 (32) et 1.4 (40) ont peu d'exercices distincts** : une tâche de plus de 20 exercices en répéterait. À élargir si c'est un souci (Q9).
* Dans 1.3, `|c|` peut monter à 160 (`a m² n`) : peu « simple » à la main. À borner.
* L'ordre des tirages sera **épinglé** par un test (graine → exercice), comme l'exige la règle `_v2`.

### 3.3 Calcul exact (module neuf)

Représentation : somme finie `Σ qᵣ·√r`, `qᵣ ∈ ℚ`, `r` sans facteur carré (`r = 1` pour la partie rationnelle). Opérations : `+`, `−`, produit (avec réduction `√r₁·√r₂ = g·√(r₁r₂/g²)`), division **par un rationnel** seulement. Conséquences :

* **Comparaison** exacte, jamais flottante ; `sqrt(n)` avec `n < 0` → `parse_error` pédagogique.
* **Non simplifié** : si l'arbre de saisie contient un `sqrt(k)` où `k` a un facteur carré (`sqrt(8)`, `sqrt(12)`, même `sqrt(4)`), la valeur peut être juste mais la réponse est `not_equivalent` avec `RACINE_NON_SIMPLIFIEE`.
* **Hors périmètre** : division par un radical (`3/sqrt(2)`) → `parse_error` (le code `DENOMINATEUR_NON_RATIONALISE` existe en catégorie, non traité ici) ; racine d'une expression non constante.
* Les décimaux (`1,41`) ne valent **jamais** une valeur irrationnelle (voir Q5 pour les rationnelles).

### 3.4 Cascade sur coefficients confirmés (écran 5)

L'écran 5 est jugé sur la fonction **effective**. Pour qu'un calcul exact reste possible, on définit « coefficients exploitables » : `a` rationnel non nul, `c` rationnel, `b = q·√n` (ou rationnel). Alors `Δ = b² − 4ac` est **rationnel** et les racines vivent dans `ℚ(√d)`. Tout autre cas (`b = 1 + √2`, `a` irrationnel…) donnerait des radicaux imbriqués : **repli sur la vraie fonction**, comme aujourd'hui pour un coefficient illisible (publique dans l'énoncé : aucune fuite). Sous « réponse affichée » (§45), seules les réponses correctes alimentent la suite, inchangé.

`RACINES_NOMBRE_INCORRECT` : le nombre attendu (0, 1 ou 2) vient de ces coefficients effectifs ; `RACINE_PARTIELLE` : bon nombre, une valeur fausse.

## 4. Nomenclature des dix `variante_id`

**Collision : aucune.** Les dix identifiants proposés ont **0 occurrence** dans le dépôt (`src`, `lib`, `public`, `scripts`, `docs`, `supabase`), sont uniques, aucun n'est préfixe d'un autre, et aucun ne heurte les quatre `af_*` existants. Limite : je n'ai pas accès à l'ancien pilote (hors périmètre de cette session) ; le préfixe `af_` et la longueur des noms rendent une collision improbable.

**Défaut de lisibilité à corriger** (HYPOTHÈSE de ma part, le prompt autorise l'ajustement) : `af_delta_neg_sans_racine` (1.1, famille **sans** discriminant) et `af_delta_sans_racine` (2.1) sont quasi homonymes, et le premier contient « delta » alors que la famille 1 est « sans discriminant ». Proposition, avec un préfixe de famille :

| # | Prompt | Proposition (recommandée) |
|---|---|---|
| 1.1 | `af_delta_neg_sans_racine` | `af_motif_aucune_racine` |
| 1.2 | `af_racine_double_rationnelle` | `af_motif_racine_double_rationnelle` |
| 1.3 | `af_racine_double_irrationnelle` | `af_motif_racine_double_irrationnelle` |
| 1.4 | `af_racines_opposees_rationnelles` | `af_motif_racines_opposees_rationnelles` |
| 1.5 | `af_racines_opposees_irrationnelles` | `af_motif_racines_opposees_irrationnelles` |
| 1.6 | `af_racine_nulle_rationnelle` | `af_motif_racine_nulle_rationnelle` |
| 1.7 | `af_racine_nulle_irrationnelle` | `af_motif_racine_nulle_irrationnelle` |
| 2.1 | `af_delta_sans_racine` | `af_delta_aucune_racine` |
| 2.2 | `af_delta_racines_rationnelles` | `af_delta_racines_rationnelles` |
| 2.3 | `af_delta_racines_irrationnelles` | `af_delta_racines_irrationnelles` |

**Libellés du catalogue (à valider, Q3)** : ils doivent être identiques mot pour mot dans `CATALOGUE_GENERATEURS`, `catalogue-generateurs-complet.json` et `CORRESPONDANCE_JSON_VERS_PILOTE` ; le champ « nombre d'exercices » doit être vérifié **non `disabled`** en Chromium pour chacune des dix entrées (discipline `prof.html`).

## 5. Décisions à trancher avant le Go

| # | Question | Ma recommandation |
|---|---|---|
| **Q1** | **Deux aides sur Allure** : (A) étendre le contrat à deux aides + migration `aides_utilisees` (clé `rang`), UI en deux paliers, **une seule pénalité** quel que soit le nombre d'aides ; (B) une seule aide contenant les deux explications. | **A**, pénalité unique. B perd l'échelle d'indices. Coût de A : contrat, route, schéma (+ `cumulatif.sql`), UI, tests. |
| **Q2** | **Anciens `af_*`** (mise en évidence, binôme, produit, irréductible) : (A) les garder exécutables mais **cachés** du catalogue ; (B) les supprimer. | **A** : sinon tout exercice déjà assigné ne se régénère plus. Impose un flag de générateur « retiré » (un curriculaire doit être au catalogue, `registreGenerateurs.ts:50`). **DONNÉES manquantes : des exercices `af_*` ont-ils déjà été assignés en production ?** |
| **Q3** | **Libellés et exemples** des dix entrées du catalogue, et regroupement dans l'arbre (`axe` « sans discriminant » / « avec discriminant » ?). | Je les propose au Go ; vous validez. |
| **Q4** | **Aide parabole** avec coefficients irrationnels : (A) l'accepter pour des réels finis (croquis qualitatif) ; (B) la retirer des écrans 3, 4, 6 pour ces familles. | **A** pour l'écran 6 (le prompt dit « aucun changement »). Écrans 3 (formule) et 4 (aucune aide) : selon le prompt. |
| **Q5** | **Tolérance** : garder ±0,005 pour les valeurs **rationnelles** (comportement actuel, « arrondi au centième ») et exiger l'exact **dès qu'une valeur contient un radical** ? | **Oui** (hybride). Le texte « arrondi accepté » est retiré des consignes à valeur irrationnelle. |
| **Q6** | **2.1 : `b = 0` ou `b ≠ 0` ?** | **`b ≠ 0`** (sinon 2.1 ≡ 1.1 au poids près). |
| **Q7** | **Ordre des termes** : accepter qu'avec 2 termes il n'y ait qu'un seul ordre possible (`−4 + 3x²`) ? | Oui. |
| **Q8** | **Codes `TABLEAU_*`** : les quatre n'existent pas. (A) rester sur `SIGNE_VARIATION_PARTIEL` ; (B) créer les détecteurs. | **A** pour cette livraison. |
| **Q9** | **Bornes** de `a`, `m`, `n`, `p`, `q`, `r` et taille des pools (1.1 : 32, 1.4 : 40 exercices). | Je pars de §3.2, avec |c| ≤ 100 ; dites-moi si vous voulez plus de variété ou des coefficients plus simples. |

## 6. Découpage en commits proposé

1. **Calcul exact** `ℚ(√n)` : lecteur de saisie `sqrt`, comparaison, forme simplifiée, LaTeX ; tests de propriété.
2. **Modèle exact de gen7 v2** (`FonctionExacte`) et **générateur des dix familles** (graine → exercice épinglé), complexes conjugués ; tests exhaustifs par propriété.
3. **Codes de compétence** (`RACINE_NON_SIMPLIFIEE`, `RACINES_NOMBRE_INCORRECT`) : dictionnaire, explications prof et élève, catégories.
4. **Écrans 1 à 4** : coefficients exacts, allure (position du sommet), axe/sommet exact, ensemble-image + aperçu « im f = » ; contrat (illustration, intervalle) en options.
5. **Écran 5 « Racines »** exact + cascade sur coefficients confirmés + `RACINES_NOMBRE_INCORRECT` ; mise à jour CLAUDE.md §38.
6. **Écran 6** (tableau) rebranché sur le calcul exact, poids, aide parabole selon Q4.
7. **Aides** (selon Q1) : contrat + migration + route + UI.
8. **Câblage** : registre, catalogue, JSON `4e:7`, `CORRESPONDANCE_JSON_VERS_PILOTE`, anciens `af_*` cachés (Q2) ; vérification Chromium « champ non `disabled` » ×10.
9. **Chromium** : scénario complet par sous-variante, y compris les deux réglages de l'écran Allure ; régression complète ; RAPPORT.

## 7. Validation prévue

* Tests de propriété **par sous-variante** (au moins 1 000 graines chacune) : invariants de §3.2, `Δ` et nature des racines, absence des termes nuls, convention `x`/`x²`, ordre non canonique, radicandes sans facteur carré, `yS` rationnel en 1.7, textes servis passant `verifierBalisageMath`.
* **Aller-retour de vérification** : la solution attendue de chaque écran est acceptée ; ses perturbations (signe, `sqrt(8)` pour `2sqrt(2)`, décimal pour un irrationnel, mauvais nombre de racines) sont refusées avec le bon code.
* Cascade : les deux régimes de correction, et §45 (réponse affichée).
* Chromium : dix scénarios, mesure du style calculé des deux croquis réactifs, « nombre d'exercices » non `disabled`.
* **Régression complète inchangée** : les quatre `af_*` historiques et leurs tests ne bougent pas (nouveau code dans de nouveaux fichiers, jamais de modification de `genererExercice` existant : règle `_v2`).

## 8. Hors périmètre signalé

* `racinesChamp1` / `racinesChamp2` (3b-2) ne sont plus câblés dans les dix nouvelles variantes mais **restent intacts** (et câblés dans les quatre `af_*` historiques) : ils pourront servir de base au futur générateur dédié factorisation / discriminant.
* La notation générale `rac` / `rac2` / `rac3` reste un chantier séparé : seul `sqrt(n)` est supporté ici.
