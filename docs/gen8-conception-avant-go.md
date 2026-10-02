# gen8 « f(x) à partir du graphe » — conception avant le « Go »

Lecture seule : aucun code, aucune migration. Les citations `chemin:lignes` désignent l'état de la branche `retours-gen7-ui` (commit `ce7e59b`, PR #37, après RAPPORT §54) :
elles ne sont pas encore sur `main`. L'audit prérequis est `docs/AUDIT-config-par-ligne-composition.md` (sections 1 à 10, décisions A à E) ; cette branche est empilée sur `audit-config-par-ligne`.
Les passages **PROPOSITION** n'existent pas dans le code ; **DÉCISION** = je ne peux pas trancher à votre place (section 9).

## 0. Synthèse

1. **Faisable sans toucher à `verifier`/`projeter`/au registre** pour la cascade et les écrans, mais **trois points de contrat bougent** : (a) une **figure** déclarée par écran (aujourd'hui inexistante),
   (b) une **3ᵉ forme d'aide typée** (`CLAUDE.md` : « une troisième forme est une décision de contrat »), avec des **paliers** (état serveur nouveau), (c) un **type d'écran** `chaine_transformations`.
2. **Quatre prémisses du prompt sont inexactes ou incomplètes** (section 1) — la plus lourde : **il n'existe aucun lecteur d'expressions polynomiales en `x` dans ce dépôt** ; « comparaison de coefficients développés,
   déjà utilisée ailleurs » ne s'y trouve pas. Il faut l'écrire (module nouveau, sous-ensemble ℚ, sans `sqrt`).
3. **Quatre défauts de spécification** qui produiraient des bugs silencieux si on codait à la lettre (section 6) : `fractionCorrecte = 1` interdit, écran 2 insoluble après une réponse fausse à l'écran 1,
   « juste » qui accepte une étape mal étiquetée, forme canonique non vérifiée à l'écran 1.
4. **Une donnée du prompt rend le graphique illisible dans certains tirages** : le point `A` à coordonnées entières est à un décalage vertical de **jusqu'à 120** unités (EV fractionnaire, dénominateur 5), 30 pour CV (section 2.4).
5. Le prompt veut l'architecture « configuration par ligne » **dans ce même chantier, en un commit séparé avant gen8** : prévu (section 7, commit C1). Pour gen8 la configuration n'agit **que sur `generer`** : la liste d'écrans reste de deux écrans fixes,
   donc les risques « configuration → écrans » de l'audit (3.3) ne s'appliquent pas ici.

## 1. Prémisses vérifiées

| Prémisse du prompt | Constat | Citation |
|---|---|---|
| `champ_expression` « vérifié par comparaison de coefficients développés, déjà utilisée ailleurs » | **Faux dans ce dépôt.** `champ_expression` renvoie le texte tel quel (`champExpression.js:35-38`). Le seul lecteur d'expression du témoin est **numérique** (`_temoinTechnique/index.ts:128`). `lireExpressionExacte.ts:6-19` lit des rationnels et `sqrt(n)`, **sans variable `x`**. Le comparateur par coefficients n'existe que dans l'ancien pilote (spec en lecture seule, `CLAUDE.md`) : on ne reprend pas sa structure | `public/moteur/ecrans/champExpression.js`, `src/generateurs/analyseFonctionMotifDelta/exact/lireExpressionExacte.ts` |
| « mécanisme existant de l'écran `allure` de gen7 : croquis réactif au clic, sans pénalité » | Exact, mais **ce n'est pas un graphique d'exercice** : `construireCroquisAllure` ne dessine que l'axe Oy selon deux choix locaux ; `illustration` n'existe que sur `champs_multiples` | `lib/contratGenerateur.ts:204-231`, `public/moteur/ecrans/champsMultiples.js:14-44`, `public/moteur/croquis.js:194-247` |
| « l'aide … annoter le graphique principal lui-même » | **Aucun graphique principal n'existe** : les aides sont servies à la demande dans une zone séparée (`.moteur-aide-texte`) ; `croquis_parabole` est construit depuis `a, b, c` — il **donnerait la réponse** de gen8 | `public/moteur/moteur.js:567-618`, `lib/aideTypee.ts:32-40`, `public/moteur/aides/croquisParabole.js` |
| Aide « par paliers » | **L'aide est binaire** : une ligne `aides_utilisees (exercice_assigne_id, champ)` (clé primaire), un seul pourcentage de pénalité par tâche, `aideUtilisee: boolean` | `supabase/schema.sql:262-267`, `lib/moteurTentatives.ts:148-168`, `lib/etatExercice.ts:283` |

Conséquence : les deux « mécanismes à concevoir » reposent sur **trois constructions** absentes (figure d'écran, paliers, lecteur polynomial). Elles sont toutes décrites ci-dessous.

## 2. Mécanisme 1 — graphique unique et aide par paliers sur l'écran 1

### 2.1 Une `figure` déclarée par écran (PROPOSITION)

`EcranCommun` (`lib/contratGenerateur.ts:73-105`) reçoit `figure?: FigureDeclaree`, union fermée d'**un** membre :

```ts
interface FigureGrapheParabole {
  type: "graphe_parabole";
  fenetre: { xMin: number; xMax: number; yMin: number; yMax: number };   // calée par le générateur
  graduations: { x: number[]; y: number[] };                              // entiers à étiqueter
  courbe: { x0: number; y0: number; xc: number; yc: number; x1: number; y1: number }; // Bézier quadratique EXACTE : départ, contrôle, arrivée
}
```

- **Donnée pure**, jamais du HTML/SVG (règle du contrat : « un générateur ne produit jamais de HTML/CSS »).
- **Pourquoi une Bézier quadratique** : une parabole en est *exactement* un arc ; trois points suffisent. On évite la polyligne de 64 segments (`croquis.js:151`) dont les marques pouvaient se
  désynchroniser de la courbe (défaut cité `croquis.js:12-16`). **Test de propriété** : `S` et `A` (envoyés par l'aide) sont sur la courbe à 1e-9 près.
- **Aucun coefficient exact** n'est servi : le serveur calcule la courbe depuis le modèle rationnel et n'envoie que des flottants de géométrie. ⚠ **Limite assumée** : ils permettent à un élève outillé de
  retrouver `a, p, q` ; mais l'image elle-même les donne à quiconque lit le graphique (c'est l'objet de l'exercice). Le modèle de menace est pédagogique, pas anti-triche.
- **Une seule image par exercice, identique sur les écrans 1 et 2** : le générateur renvoie la *même* `figure` sur les deux ; elle est calculée depuis l'exercice **brut**, jamais depuis l'exercice projeté
  (pas de dérive si la réponse de l'élève change : `projeter` ne touche pas à `figure`). Test : égalité profonde des deux `figure`, quel que soit l'historique.
- **Transport** : `GET /api/exercices/:id` envoie déjà tout l'écran sauf `aide` (`lib/routes/exercices/[id].ts:109-114`, `const { aide, ...publics }`) : **aucun changement de route**.
- **Rendu** : le moteur, pas chaque composant, rend la figure entre la consigne et le composant (`public/moteur/figures/index.js`, table type→composant, même patron que `aides/index.js:12-15`). Texte d'axe via
  `rendreTexte`, aucune couleur en dur : tokens uniquement, classes `figure-*` (`CLAUDE.md`, design system). **Référence design `docs/reference/graphe-parabole.html` AVANT le composant**, mesurée par `chromium-design`.
- **Témoin technique** : un nouveau type de figure exige un écran du témoin (`profil etendu`, `CLAUDE.md`).

### 2.2 Palier 1 et 2 : une 3ᵉ forme d'aide typée `annotations_figure` (DÉCISION de contrat)

Pourquoi pas les deux formes actuelles : `formule_coloree` est du texte ; `croquis_parabole` est un dessin à part **et** fuit `a, b, c`. Il faut une aide qui **modifie une figure déjà affichée**.

```ts
interface AideAnnotationsFigure {
  type: "annotations_figure";
  paliers: Annotation[][];          // exactement 2 pour gen8 ; cumulatif : le palier 2 REPREND les annotations du palier 1
}
type Annotation =
  | { genre: "point"; x: number; y: number; etiquette: string }          // S, puis A
  | { genre: "vecteur"; de: [number, number]; vers: [number, number]; etiquette: string }; // « d = 2 », « Δy = 6 »
```

- **Validation** : extension de `validerAide` (`lib/aideTypee.ts:55-100`) — clés connues, nombres finis, `|v| ≤ COEFFICIENT_MAX`, 1 à 3 paliers, ≤ 6 annotations par palier, étiquette LaTeX sans `$` ni commande interdite
  (même règle que `formule_coloree`, `:78-79`). Le message d'erreur du « type inconnu » (`:99`) est à mettre à jour.
- **Service** : `POST /api/reponses/aide` accepte un `palier` optionnel (`lib/routes/reponses-aide.ts:43-83`). Le serveur n'envoie **que** l'aide réduite au palier demandé — jamais les paliers suivants (même principe que
  « l'aide n'est jamais envoyée avec l'écran », `CLAUDE.md`). Un palier `p` n'est servi que si `p ≤ palier atteint + 1`.
- **État serveur nouveau** : `aides_utilisees.palier int not null default 1` (migration idempotente dans `schema.sql` **et** `cumulatif.sql`, même commit — `CLAUDE.md`). L'écriture actuelle est un `upsert ignoreDuplicates`
  (`reponses-aide.ts:81`) : elle devient « insérer, ou relever `palier` à `max(palier, p)` ». Les aides existantes (sans palier) restent à `palier = 1`, comportement inchangé.
- **Client** : `afficherAide` (`moteur.js:605-618`) range aujourd'hui toute aide typée dans la zone d'aide. Pour `annotations_figure`, la zone ne reçoit qu'une courte légende (« Le sommet S est marqué sur le graphique »)
  et le moteur appelle `figure.annoter(annotations)` sur la figure **de cet écran**. Interface de figure : `creer(figure) → { element, annoter(annotations) }`. Une annotation est une couche SVG *ajoutée* à la figure : rien n'est recalculé,
  rien ne quitte le composant.
- **Bouton** : après le palier 1, le bouton devient « Un indice de plus ? » (même style ambre, `CLAUDE.md` §53) ; après le palier 2 il disparaît ; « Revoir l'indice » redemande le **palier atteint** (gratuit : l'usage est déjà enregistré).
  Au rechargement d'un écran, les annotations ne réapparaissent **pas** seules : il faut recliquer « Revoir l'indice » (cohérent avec le comportement actuel `moteur.js:596-599`, évite une requête automatique à chaque affichage).
- **Exposition** : `GET /api/exercices/:id` ajoute `aide_palier` (0, 1, 2) et `aide_paliers_total` aux champs ; `aide_utilisee` reste vrai dès le palier 1.
- **Cascade (§18)** : l'aide d'un écran dépendant n'est servie qu'une fois ses prédécesseurs terminés ; l'écran 1 est indépendant : sans objet.
- **Écran 2** : « aucune aide, délibéré » → pas d'`aide` déclarée → `aide_disponible = false` (`[id].ts:113`). Les annotations de l'écran 1 **ne se reportent pas** sur la figure de l'écran 2 (l'aide est par `(exercice, champ)`).

### 2.3 Pénalité des paliers — DÉCISION

Le moteur de score ne connaît qu'une pénalité binaire (`moteurTentatives.ts:168`, `:198`). Deux options :

- **P1 (recommandée) — pénalité unique** : utiliser un palier ou deux coûte la même chose (le pourcentage de la tâche). Zéro changement de `lib/moteurTentatives.ts`. Défaut : le palier 2 (point `A` + vecteurs, donc `a = Δy/Δx²` presque lu) est gratuit
  une fois le palier 1 payé ; le professeur ne peut pas les distinguer dans les résultats.
- **P2 — pénalité par palier** : nouveau réglage de tâche, `aideUtilisee: boolean` devient un palier, formule de score, tableau de bord, vues prof, migration `taches` : **chantier transversal** à ne pas glisser dans gen8.

### 2.4 Donnée du prompt à corriger avant de coder : la fenêtre du graphique

`A` est à l'écart horizontal `d` (plus petit entier avec `d²` multiple du dénominateur) : son décalage vertical vaut `a·d²`. Calcul exact (énumération sur les règles du prompt) :

| Transformation | Valeurs | `d` max | décalage vertical de `A` |
|---|---|---|---|
| EV entier `[2,5]` | 4 | 1 | 2 à 5 |
| EV fractionnaire, dénominateur 2 à 5, **numérateur non borné dans le prompt** | — | 5 | **non borné** (11/2 → 22) |
| EV fractionnaire avec valeur ≤ 5 (hypothèse de borne) | 36 | 5 | **jusqu'à 120** (24/5) |
| CV `1/d`, `d∈[2,5]` | 4 | 5 | 1 à 5 |
| CV `n/d`, `n∈[2,5]`, `d≤6` | 6 | 6 | **jusqu'à 30** (5/6) |

Avec `S` dans `[-5,5]`, la fenêtre passe de ~20 à plus de 130 unités en `y` : `S` et le creux de la parabole sont écrasés, les graduations par 1 deviennent illisibles. Options pour EV fractionnaire (valeur dans `]1, cap]`) :

| Dénominateurs permis | cap 3 | cap 4 | cap 5 |
|---|---|---|---|
| 2, 3, 4, 5 | 70 | 95 | 120 |
| 2, 3, 4 | 24 | 33 | 42 |
| 2, 4 | 11 | 15 | 19 |
| 2 seulement | 10 | 14 | 18 |

**Recommandation** : dénominateurs `{2, 4}` et valeur `≤ 4` (15 maximum, 9 valeurs), et pour CV `n/d` retirer `d = 5` et `d = 6` (ou accepter 30). C'est une **DÉCISION** : elle change le pool de tirage du prompt.
Le graphique garde des échelles `x` et `y` indépendantes (comme `croquis.js:120-135`) ; les graduations de `y` passent par pas de 5 au-delà de 20 unités.

**Ambiguïté associée (DÉCISION)** : le prompt dit que le graphique « montre le sommet `S` et un second point `A` », puis que l'aide du palier 2 « ajoute le point `A` ». Je lis : le graphique de base montre la courbe, ses axes et ses graduations, **sans marquer ni nommer** `S` ni `A` ;
le palier 1 marque et nomme `S = (p ; q)`, le palier 2 marque `A` et trace les deux vecteurs. Si le graphique de base devait déjà marquer les deux points, le palier 2 n'aurait rien à « ajouter » que les vecteurs.

## 3. Mécanisme 2 — écran « chaîne d'étapes »

### 3.1 Contrat d'écran (PROPOSITION)

```ts
interface EcranChaineTransformations extends EcranCommun {
  type: "chaine_transformations";
  depart: string;                              // texte d'auteur : « $f_0(x) = x^2$ »
  choix: { id: string; libelle: string }[];    // toujours TH, TV, EV, CV, SOX, quelle que soit la configuration
  etapesMin: number;                           // 1
  etapesMax: number;                           // 5
}
```

Ajout à `TypeEcran` (`contratGenerateur.ts:71`) et à `EcranDeclare` (`:244`). Procédure du contrat respectée (`contratGenerateur.ts:60-69`) : interface, décodeur, composant enregistré, **écran du témoin** (profil `etendu`), `chromium-temoin`.

### 3.2 Forme de la réponse envoyée

**Une chaîne `reponse_brute`** (règle : `POST /api/reponses` ne reçoit que `{ exercice_assigne_id, champ, reponse_brute }`) :

```json
{"etapes":[{"expression":"(x-2)^2","transformation":"TH"},{"expression":"3(x-2)^2","transformation":"EV"}]}
```

- Un **tableau** (jamais un objet indexé par une clé de l'élève : `CLAUDE.md`, « Tables d'objets littéraux ») ; clés exactes `expression`, `transformation` ; `transformation` ∈ ids de `choix` ; 1 à 5 étapes ; `expression` ≤ 120 caractères.
- **Décodeur** `decoderChaineTransformations` dans `lib/reponsesEcran.ts` (ajouté à côté de `decoderChampsMultiples`, `:82`) : toute anomalie → `parse_error` avec message pédagogique, jamais d'exception.
- **État d'édition ≠ réponse** : étapes ajoutées/retirées, texte tapé, choix non confirmé restent dans le composant ; seul « Valider » envoie. « Valider » est inactif tant qu'une étape est incomplète (comme `champs_multiples`, `champsMultiples.js:7-12`).
- **Composant** `public/moteur/ecrans/chaineTransformations.js` : lignes « étape *i* : `E_i(x) =` [champ] [5 boutons à choix unique] », « Ajouter une étape » (désactivé à 5), « Retirer la dernière étape » ; l'expression de départ est affichée en tête. `valeurInitiale` restaurée **sans altération**
  (retour en arrière, `CLAUDE.md` §37) ; `marquer(ids)` avec les identifiants `etape:<i>` ; 3ᵉ argument de `resumer` (§52) ; `solution` / `reponse` dessinables comme le tableau (§53-§54) **non requis** ici : la solution est du texte (la chaîne canonique en une ligne).
  Choix des 5 options : boutons à choix unique cliqués par leur **libellé** (jamais le radio natif, `CLAUDE.md`), pas de `<select>` (mobile). **Référence design `docs/reference/chaine-transformations.html` AVANT le composant.**

### 3.3 Lecteur d'expressions polynomiales en `x` (module NOUVEAU)

Grammaire : celle de `lireExpressionExacte.ts:6-19` **restreinte à ℚ** (aucune racine, le prompt l'interdit) et **étendue** : atome `x`, opérateur `^` d'exposant entier 0..4 (et `²`, `³`), préfixe optionnel `f(x)=` / `E(x)=` / `y=`.
Résultat : polynôme à coefficients `Rat` (`exact/rationnel.ts`, déjà exact, avec `DebordementExact`). Degré ≤ 4 sinon refus. Division : par un **nombre** seulement (`3/sqrt(2)` déjà refusé de la même façon). Messages d'erreur = texte d'**auteur** ; la saisie de l'élève n'y est jamais recopiée brute
(`citer`, `lireExpressionExacte.ts:38-42`).
Lecture de `1/2(x-1)^2` : `((1/2)·((x-1)^2))` (multiplication implicite de gauche à droite, comme la grammaire existante) — à afficher dans l'aide d'écriture de l'écran, sinon source d'erreurs de saisie.
Une **seule** fonction `lirePolynome` ; la comparaison par `(A, B, C)` passe par elle (jamais de seconde implémentation, règle « grep avant de dupliquer »).

### 3.4 Vérification à deux niveaux — `verifier`

Entrée : `ex` = exercice **projeté** (fonction cible effective, section 5) et la configuration figée dans l'exercice (`ex.config`). `E_0(x) = x²`.

**Niveau 0 (lecture)** : une étape illisible → `parse_error` (« étape *k* : … »), aucune tentative consommée (comportement existant, `reponses.ts`).

**Niveau 1 (local, étape *i* contre l'expression que l'ÉLÈVE a écrite à l'étape *i−1*, jamais contre la vraie chaîne)** — pour des polynômes quelconques de degré ≤ 4 (une étape précédente fausse ne bloque donc pas l'évaluation de la suivante) :

| Transformation | Condition sur `E_{i-1}` → `E_i` |
|---|---|
| TH | `E_i(x) = E_{i-1}(x − h)`, `h ≠ 0` rationnel : `h` tiré du coefficient de `x^{n−1}`, puis égalité complète vérifiée |
| TV | `E_i − E_{i-1}` = constante `k ≠ 0` |
| EV | `E_i = m·E_{i-1}`, `m > 1` |
| CV | `E_i = m·E_{i-1}`, `0 < m < 1` |
| SOX | `E_i = −E_{i-1}` exactement |

Les cinq conditions sont **deux à deux incompatibles** (TH change `B` sans toucher `A` ; TV ne change que `C` ; les trois autres changent `A`, avec `m` dans des plages disjointes) : une étape ne peut jamais être « valide pour deux transformations ».
Étape **valide** = condition locale vraie **et** transformation choisie **active** dans `ex.config`. Condition vraie mais transformation inactive → `TRANSFORMATION_HORS_SUJET` (étape fausse). Le contrôle porte sur chaque étape **séparément** : deux étapes hors sujet qui s'annulent
(TV +3 puis TV −3) restent chacune hors sujet, même si la chaîne retombe sur la bonne expression.

**Niveau 2 (global)** : `E_n = f` (égalité de `(A, B, C)`).

**Verdict** : voir section 6 (point 3 : « juste » exige que **toutes** les étapes soient valides, pas seulement l'absence d'étape hors sujet). **Codes** : `TRANSFORMATION_HORS_SUJET` si ≥ 1 étape hors sujet ; signal pur.
**`partiesFausses`** : `etape:<i>` pour chaque étape invalide (surlignage §52). **`fractionCorrecte`** : section 6 (point 1). Les paramètres de la chaîne (`h`, `k`, `m`) ne sont **jamais** exposés dans un message.

Toute autre chaîne valide est acceptée (ordre libre, `k` ou `m` non entiers, étapes redondantes) : **HYPOTHÈSE** à confirmer — le prompt n'impose aucun ordre.

## 4. Écran 1 — expression canonique

- `champ_expression` + `lirePolynome` : `A, B, C` rationnels de la réponse comparés aux vrais (`f` développée), égalité exacte. `parse_error` si la saisie est illisible, de degré ≠ 2 ou `A = 0`.
- `partiesFausses: ["champ"]` (déjà le patron de `champ_expression`, `contratGenerateur.ts:294`). Poids 2.
- **Codes** (`codes.ts` de gen8 + `lib/dictionnaireCompetences.ts`, contrôle croisé du registre, `registreGenerateurs.ts:84-90`). Définitions rendues **partitionnantes** (la section 6 point 4 explique pourquoi) :
  `SIGNE_P_INVERSE` : `A` et `C` justes, `B' = −B`, `B ≠ 0` ; `Q_INCORRECT` : `A` et `B` justes, `C` différent ; `A_INCORRECT` : `A` différent **et** `B = −2A·p`, `C = A·p² + q` (vrais `p`, `q`) ;
  `P_MAGNITUDE_INCORRECTE` : `A` juste, `p' = −B'/(2A)` ∉ `{p, −p}` **et** `C' = A·p'² + q` (seul `p` est faux). Tout le reste : `not_equivalent` sans code. Les codes n'affectent jamais le score.
- Avec `p = 0` (TH inactive) : `B = 0`, `SIGNE_P_INVERSE` est impossible ; un test le vérifie (aucune étiquette sur une erreur qui n'existe pas).

## 5. Cascade de l'écran 2 (§18, §38, §45)

`dependDe: ["expression"]` + `projeter` (`lib/contratGenerateur.ts:350`, `lib/etatExercice.ts:85-103`) : l'écran 2 est jugé sur la fonction **effective** (`ex.effectif`), jamais sur la vraie fonction brute.
Règles (identiques à gen7 `CLAUDE.md` §38/§45) : réponse confirmée exploitable → fonction effective = **sa** fonction ; solution montrée → vraie fonction (`projeterExercice` ne transmet que les réponses `correct`) ; inexploitable → repli.
« Ne jamais coller la chaîne brute de l'élève dans un texte d'auteur : décoder puis re-sérialiser » : l'énoncé de l'écran 2 affiche la fonction **re-sérialisée** par le générateur (forme canonique `a(x−p)²+q`, termes neutres omis) — **HYPOTHÈSE** : un élève qui a répondu sous forme développée voit donc la forme canonique ; le libellé de l'énoncé est le **même** quelle que soit la justesse de la réponse (règle gen7, un libellé propre à l'erreur est un verdict).
La liste d'écrans est **constante** (2) : `champs_attendus` figé à l'assignation reste exact (`etatExercice.ts:98-101`).

## 6. Défauts de spécification à trancher avant de coder (DÉCISIONS)

1. **`fractionCorrecte = 1` interdit.** Le contrat n'admet que `0 ≤ φ < 1` sur `not_equivalent` (`contratGenerateur.ts:290`, contrôle `registreGenerateurs.ts:94-103` : lève sinon). La formule du prompt
   (étapes valides ÷ étapes soumises) vaut **1** quand toutes les étapes sont valides mais que la chaîne s'arrête avant `f` (ex. `[TH]` seule alors que TH et TV sont actives) : verdict faux, fraction 1 → erreur 500.
   *Options* : (a, recommandée) compter l'arrivée comme un élément : **φ = (étapes valides + [chaîne arrive à `f`]) ÷ (étapes soumises + 1)** — toujours `< 1` quand le verdict est faux, et monotone ;
   (b) formule du prompt + cas particulier « toutes valides mais chaîne incomplète » → φ = soumises ÷ (soumises + 1). (a) est plus simple à tester par propriété ; elle modifie les nombres du prompt (2 étapes valides sur 3 soumises, arrivée fausse : 2/3 → 2/4).
2. **Écran 2 insoluble après une réponse fausse à l'écran 1.** Si l'élève confirme `(x−3)²+1` alors que seule TH est active, l'écran 2 affiche `f(x) = (x−3)²+1` ; or atteindre cette fonction exige TV, **inactive** : toute chaîne correcte est « hors sujet ». L'élève est puni
   d'une conséquence de l'erreur précédente — et sous correction coupée il ne peut pas le savoir.
   *Proposition* : la réponse confirmée n'est « exploitable » pour la cascade que si la fonction est **atteignable avec les transformations actives** (`p = 0` si TH inactive, `q = 0` si TV inactive, `|a| = 1` sans EV/CV, `a > 0` sans SOX, `a > 1`/`0<a<1` possible avec EV/CV).
   Sinon : repli. Sans solution montrée, le repli doit être une fonction **différente de la vraie** (sinon l'énoncé la révèle : `CLAUDE.md` §18) : **un second tirage de repli, atteignable avec la même configuration**, effectué *après* les tirages de la vraie fonction (ordre contractuel, règle `_v2`), jamais égal à la vraie.
3. **« Juste » exige que toutes les étapes soient valides.** Lu à la lettre, le prompt déclare juste toute chaîne qui arrive à `f` sans étape *hors sujet* : une étape **mal étiquetée** (algèbre de TV, étiquette TH, les deux actives) ne serait ni hors sujet ni comptée.
   *Proposition* : juste ⇔ **chaque** étape valide (locale + active) **et** `E_n = f`.
4. **Les codes de l'écran 1 ne se partitionnent pas tels qu'écrits.** `P_MAGNITUDE_INCORRECTE` (« `A` juste, `p` reconstruit ∉ {p, −p} ») ne dit rien de `C` : une erreur sur `p` **et** `q` y entrerait alors qu'elle devrait être « deux erreurs combinées » (pas de code).
   Les définitions de la section 4 ajoutent la condition de cohérence de `C`.
5. **Forme canonique non vérifiée.** La comparaison par `(A, B, C)` accepte `2x²−4x+5` comme réponse à « expression canonique ». C'est cohérent avec le prompt (« vérifié par comparaison des coefficients développés »), mais l'écran s'appelle « Expression canonique ».
   *Options* : (a, recommandée) accepter toute forme équivalente (le diagnostic reste identique) ; (b) exiger la structure `a(x−p)²+q` (analyse syntaxique supplémentaire : parenthèse carrée repérée). Je ne recommande pas (b) sans demande explicite : coût élevé, source d'échecs sur des écritures équivalentes.

## 7. Découpage en commits (PROPOSITION)

Branche `gen8-fx-depuis-graphe`, empilée sur #37 (qui contient les contrats `solutionStructuree`, parties fausses, etc.). Chaque commit : tests d'abord, `tsc -b`, suites, `chromium-temoin`/`chromium-design` si l'interface est touchée.

| # | Commit | Contenu | Dépend de |
|---|---|---|---|
| **C1** | **Architecture « configuration par ligne » (commit séparé exigé)** | audit sections 2 à 10 : migration `configuration jsonb` (`taches_composition`, `exercices_assignes`) **+** `composition_id` sur `exercices_assignes` ; `generer(graine, configuration?)` ; `genererPourLigne` unique ; `validerConfiguration?` ; fusion des doublons (clé : variante, configuration canonique, durée normalisée) ; refus d'une configuration vide (400) ; chrono résolu **par ligne** ; formulaire prof à lignes multiples ; regroupement des résultats par ligne. Consommateur de test : le témoin (profil `etendu`) déclare une configuration minimale | — |
| C2 | Lecteur polynomial `lirePolynome` + opérations (`Rat`) | module pur, tests par propriété (idempotence, équivalence de formes, refus) | — |
| C3 | Figure d'écran + 3ᵉ forme d'aide + paliers | contrat, `validerAide`, route d'aide, migration `aides_utilisees.palier`, composants, référence design, témoin | décision 2.2/2.3 |
| C4 | Type d'écran `chaine_transformations` | contrat, décodeur, composant, référence design, témoin | C2 |
| C5 | gen8 : modèle, génération, graphique, écran 1 | `fx_depuis_graphe`, catalogue, registre, `CORRESPONDANCE_JSON_VERS_PILOTE`, JSON catalogue, vérification + codes, aide paliers | C1, C2, C3, section 2.4 |
| C6 | gen8 : écran 2, cascade, repli | `projeter`, vérification à deux niveaux, `fractionCorrecte` | C4, C5, décisions 6.1 à 6.3 |
| C7 | Chromium, RAPPORT §55, CLAUDE.md, PR | scénarios du prompt (section 8) | tout |

**Câblage `prof.html`** (`CLAUDE.md`) : une variante `fx_depuis_graphe`, **une** entrée de catalogue ; entrée JSON, entrée `CORRESPONDANCE_JSON_VERS_PILOTE`, champ non `disabled` vérifié en Chromium.

## 8. Tests (PROPOSITION)

- **Propriétés exhaustives** (pas de différentiel, gen8 n'existe pas dans l'ancien pilote) : pour **chaque** configuration valide (23 combinaisons non vides : TH × TV × {aucun, EV, CV} × SOX = 24, moins la configuration vide)
  × un pool de graines : l'exercice respecte les bornes du prompt ; transformation non cochée = valeur neutre ; `A` a des coordonnées entières, à écart `d` minimal ; `S` et `A` sur la courbe (Bézier) ; la fenêtre contient `S`, `A` avec marge ;
  la vraie fonction est atteignable en une chaîne canonique qui passe la vérification ; **chaque** perturbation d'une étape (mauvaise transformation, `h/k/m` faux, étape hors sujet, étape retirée) est refusée ; une chaîne hors sujet qui s'annule est refusée ;
  les codes de l'écran 1 se partitionnent (une réponse par catégorie, exactement un code) ; `fractionCorrecte < 1` toujours.
- **Portes** : `solution_attendue` / `parties_fausses` / score inchangés ; **annotations jamais servies sans demande** ni au-delà du palier atteint (palier 2 refusé avant palier 1) ; aide absente de l'écran 2.
- **Chromium** (390 et 1280 px) : chaque transformation seule ; plusieurs combinées ; étape hors sujet y compris deux qui s'annulent ; les deux paliers (annotations visibles sur le graphique principal, légende dans la zone d'aide) ; score affiché aux deux écrans ; `chromium-design` pour figure, annotations et chaîne.
- **Mutations** : retirer le plafond `φ < 1` ; servir tous les paliers ; ignorer `config` dans la vérification hors sujet → chaque mutation doit faire échouer un test.

## 9. Décisions à trancher (récapitulatif)

| # | Question | Recommandation |
|---|---|---|
| D1 | **3ᵉ forme d'aide typée** `annotations_figure` (décision de contrat, `CLAUDE.md`) | Oui, voir 2.2 |
| D2 | **Pénalité des paliers** : unique (P1) ou par palier (P2) | P1 |
| D3 | **Fenêtre du graphique** : bornes de l'EV fractionnaire (dénominateurs, plafond) et CV `d ≥ 5` | EV : dénominateurs `{2,4}`, valeur ≤ 4 ; CV : retirer `d = 5, 6` |
| D4 | Le graphique de base **marque-t-il** `S` et `A` ? | Non (palier 1 : S ; palier 2 : A et vecteurs) |
| D5 | `fractionCorrecte` : (a) arrivée comptée `(v+f)/(s+1)` ou (b) cas particulier | (a) |
| D6 | Repli de la cascade : atteignable seulement, second tirage de repli | Oui |
| D7 | « Juste » = toutes étapes valides **et** arrivée | Oui |
| D8 | Forme canonique à l'écran 1 : équivalente acceptée (a) ou structure exigée (b) | (a) |
| D9 | Chaînes valides : tout ordre / tout `k`, `m` rationnel accepté | Oui |
| D10 | L'énoncé de l'écran 2 re-sérialise la réponse en forme canonique | Oui |
| D11 | « Revoir l'indice » ne réaffiche pas seul les annotations au rechargement | Oui |

## 10. Limites de cet audit

- Lecture seule : rien n'a été compilé ni exécuté ; les bornes de la section 2.4 viennent d'une énumération Python des règles du prompt, non du code (qui n'existe pas).
- La borne « valeur ≤ 5 » de l'EV fractionnaire est **mon hypothèse** (le prompt ne borne pas le numérateur) : elle ne sert qu'à chiffrer l'ordre de grandeur.
- Le modèle de menace de la figure est pédagogique ; aucune garantie anti-triche n'est apportée ni visée.
- Les écrans de gen8 au-delà de ce qui est décrit dans le prompt ne sont pas anticipés.
