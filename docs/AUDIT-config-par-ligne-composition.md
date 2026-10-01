# Audit — configuration par ligne de composition de tâche

Lecture seule : aucun code, aucune migration n'a été écrite ni exécutée. Chaque affirmation sur l'existant cite `chemin:lignes`
(état du dépôt au commit `15d6be3` de la branche `retours-gen7-ui`, PR #37, après RAPPORT §54 — **ces numéros de ligne et la suppression des anciens `af_*` (§51) ne sont pas encore sur `main`** : ils se décaleront à la fusion des PR #35 à #37). Les propositions (sections 2, 3, 4) sont marquées **PROPOSITION** : elles n'existent pas dans le code.

## 0. Synthèse (à lire d'abord)

1. **Le mécanisme est réalisable sans casser aucun générateur existant**, à condition de ne PAS recopier le précédent `chrono_duree_secondes`
   tel quel : il est lu **à la volée, par `(tache_id, variante_id)`, « première valeur non nulle »** (`lib/resoudreChronoDureeSecondes.ts:18-40`).
   Pour une configuration qui change **le contenu de l'exercice**, cette clé est ambiguë dès que deux lignes partagent un `variante_id`,
   et une lecture à la volée est fragile. Il faut **figer la configuration sur l'exercice assigné** (comme `graine` et `champs_attendus`).
2. **Trois prémisses du brief sont inexactes ou périmées** (section 6) — notamment `codesCompetenceDeclares`, qui est **statique** par
   générateur et ne dépend ni de l'exercice ni d'une configuration.
3. **La dépendance « configuration → écrans » percole très peu** si la configuration est consommée par `generer` et **portée par l'exercice** :
   `ecrans`, `etatActuel`, `verifier`, `projeter`, `solutionAttendue`, l'aide, les poids et `champs_attendus` reçoivent déjà l'exercice et n'ont
   **pas à changer de signature**. Le vrai travail est dans les **5 sites de production qui appellent `generer`** et les **lignes SQL** qui doivent
   transporter la colonne (section 3).
4. **Un risque silencieux à neutraliser** : `ecransDeLigne` et `poidsDesChampsDeLigne` régénèrent un exercice depuis `(variante_id, graine)` seuls.
   Si on oublie d'y passer la configuration, ils régénèrent la configuration par défaut : mauvaise liste d'écrans, poids retombant à 1
   (`lib/poidsEcran.ts:46-49`), **sans erreur**. Le typage doit rendre l'oubli impossible (section 3.4).
5. **Une décision produit à trancher avant de construire** (section 7) : peut-on avoir DEUX lignes du même `variante_id` avec des configurations
   différentes dans une même tâche ? L'interface actuelle ne le permet pas (un champ par variante).

---

## 1. Le précédent `chrono_duree_secondes`

### 1.1 Schéma

| Élément | Citation |
|---|---|
| Colonne de tâche `taches.chrono_duree_secondes int` (nullable) | `supabase/schema.sql:100-104` |
| Colonne de ligne `taches_composition.chrono_duree_secondes int` (nullable, sans `not null`, sans défaut) | `supabase/schema.sql:119-133` |
| Commentaire de conception : « surcharge, ligne de composition par ligne, du chrono de tâche — nullable, repli sur `taches.chrono_duree_secondes` si absent » | `supabase/schema.sql:126-133` |
| Aucune contrainte d'unicité sur `(tache_id, variante_id)` : « si plusieurs lignes correspondantes existent avec des valeurs différentes, `resoudreChronoDureeSecondes` retient la première valeur non nulle » | `supabase/schema.sql:129-132` |
| Migration réellement exécutée : `alter table taches_composition add column if not exists chrono_duree_secondes int;` | `supabase/migrations/cumulatif.sql:145-146` (colonne de tâche : `:127`) |
| `taches_composition` n'a **pas d'identifiant référencé** par `exercices_assignes` (celui-ci ne porte que `tache_id`, `variante_id`, `graine`, `champs_attendus`) | `supabase/schema.sql:119-133` et `:174-…` ; `lib/etatExercice.ts:26-37` |

### 1.2 Écriture (formulaire de composition, `public/prof.html`)

- Un champ numérique par ligne : `creerChampDureeVariante(varianteIdActif)` (`prof.html:1617-1648`) ; vide par défaut, `placeholder="défaut"`,
  sens « repli sur le réglage de tâche » (`:1603-1604`, `:1621-1623`) ; `data-chrono-variante-id` posé seulement si la variante est câblée
  (`:1625-1629`, même garde que le champ « nombre d'exercices ») ; masqué hors mode `par_ecran` (`:1643`).
- Lecture à l'envoi : les deux champs jumeaux sont appariés **par `variante_id`** (`prof.html:4498-4516`) — le code le dit : « chaque ligne de
  composition a exactement un champ nombre_exercices ET un champ durée avec le même identifiant de variante » (`:4500-4501`).
- Restauration (Modifier / Dupliquer) : `prof.html:2584-2600`, indexée elle aussi par `variante_id`.
- Corps validé côté serveur : `LigneComposition.chrono_duree_secondes?` (`lib/validationCorpsTaches.ts:6-17`), type du corps (`:20-22`),
  entier strictement positif par ligne (`:89-94`), `validerComposition` (`:114-128`, filtre les lignes à 0).
- Insertion à **trois** endroits, tous recopiant le champ à la main : `POST /api/taches` (`lib/routes/taches.ts:262-271`),
  `PATCH /api/taches/:id` (`lib/routes/taches/[id].ts:69-89`), aperçu (`lib/routes/taches-apercu.ts:156-164`).
- Relecture pour l'édition : `GET /api/taches` sélectionne la colonne (`lib/routes/taches.ts:84`) et la renvoie (`:143-153`).

### 1.3 Lecture serveur et repli

- **Point unique** : `resoudreChronoDureeSecondes` (`lib/resoudreChronoDureeSecondes.ts:24-41`) : hors mode `par_ecran`, retourne la durée de tâche
  sans interroger `taches_composition` (`:31`) ; sinon cherche la première ligne `(tache_id, variante_id)` à valeur non nulle (`:32-39`) et retombe sur la
  durée de tâche (`:40`).
- Appelé par `chargerContexteTache(admin, tacheId, varianteId)` (`lib/etatExercice.ts:117-126`) — donc **résolu à chaque requête**, jamais figé.
- Immuabilité qui rend ce choix acceptable pour le chrono : `PATCH` refuse toute tâche déjà assignée (`lib/routes/taches/[id].ts:32-35`, `tacheEstAssignee`,
  `lib/tacheAssignee.ts:14-26`). Une surcharge ne peut donc pas changer entre deux requêtes d'un élève.

### 1.4 Ce que le précédent enseigne — et ses limites pour la nouvelle configuration

| Point | Réutilisable tel quel ? |
|---|---|
| Colonne nullable sur `taches_composition`, `null` = « pas de surcharge » | Oui |
| Validation serveur ligne par ligne (`estCorpsValide`) + même règle à la création et à la modification | Oui |
| Quatre sites d'insertion/lecture à tenir synchronisés (`taches.ts`, `taches/[id].ts`, `taches-apercu.ts`, `GET`) | Oui, mais **à factoriser** (voir 4.4) |
| Repli « sur le réglage de tâche » | **Non** : il n'existe pas de réglage de tâche pour la configuration d'un générateur. Le repli est la configuration par défaut **du générateur** |
| Clé de résolution `(tache_id, variante_id)` + « première valeur non nulle » | **Non** (voir 4.3) : ambiguïté dès que deux lignes ont le même `variante_id` |
| Lecture à la volée | **Non** : la configuration change ce que `generer` produit ; elle doit être figée avec l'exercice |

---

## 2. Le contrat `Generateur` : ajouter un paramètre à `generer`

### 2.1 Existant

- `generer(graine: number): TExercice` (`lib/contratGenerateur.ts:327`) ; contrainte : même graine → exercice identique, JSON-sérialisable
  (`:319-326`), d'où la règle `_v2` (`CLAUDE.md`, « Aléa »).
- **Deux** implémentations dans tout le dépôt : la fabrique des dix variantes gen7 (`src/generateurs/analyseFonctionMotifDelta/generateurs.ts:21-32`,
  `generer: (graine: number) => genererExerciceMD(famille.id, graine)` à la ligne 28) et le témoin (`src/generateurs/_temoinTechnique/index.ts:641-650`).
  Le registre ne contient rien d'autre : `REGISTRE_GENERATEURS = [generateurTemoinTechnique, ...GENERATEURS_MOTIF_DELTA]` (`lib/registreGenerateurs.ts:18`).
- **Cinq sites de production** appellent `generer` :
  `lib/etatExercice.ts:56` (`regenererExercice`), `:68` (`ecransDeLigne`), `lib/poidsEcran.ts:43` (`poidsDesChampsDeLigne`),
  `lib/routes/taches-apercu.ts:181`, `lib/routes/assignations.ts:135`. Les tests en ont 37 occurrences réparties dans 7 fichiers
  (comptage `grep` sur `scripts/`), toutes à un seul argument.

### 2.2 Verdict : non cassant

**PROPOSITION** : `generer(graine: number, configuration?: TConfig): TExercice`, avec `TConfig` second paramètre générique du contrat
(défaut `undefined`).

- **Générateurs existants** : une fonction à un paramètre reste assignable à un type qui en déclare deux dont le second est optionnel
  (règle d'assignabilité de TypeScript). `generateurs.ts:28` et `index.ts:641` **compilent sans modification** et ignorent la configuration.
  Le registre est typé `Generateur<any>[]` (`registreGenerateurs.ts:18`) : pas de propagation de générique.
- **Appelants** : 37 occurrences de tests à un argument restent valides.
- **Mais « optionnel » est aussi le défaut du contrat** : un site de production qui oublierait de transmettre la configuration compile et s'exécute
  avec la configuration par défaut (cf. synthèse §4). Réponse recommandée : **un seul assistant** `genererPourLigne(generateur, ligne)` qui lit `ligne.configuration`
  et qui devient le seul appelant de `generer` côté production (aujourd'hui 5 appels dispersés), et une `configuration` **non optionnelle** dans le type de ligne
  (`LigneExerciceAssigne`, `lib/etatExercice.ts:26-37`).
- **La configuration doit rester DANS l'exercice** (l'objet renvoyé par `generer` l'embarque ou la reflète). C'est ce qui rend `ecrans`, `etatActuel`, `verifier`,
  `projeter`, `solutionAttendue` et l'aide indifférents à la configuration : ils ne reçoivent que `exercice`
  (`contratGenerateur.ts:329-352`). Précédent exact : le témoin porte `profil: "base" | "etendu"` dans son exercice et en tire sa liste d'écrans
  (`index.ts:641-650`, `ecransDe` à `:617`, `etatActuel` à `:654-656`).
- **Règle `_v2` à étendre** : pour un couple `(graine, configuration)` donné, `generer` doit rester stable. Ajouter une clé de configuration = compatible ;
  changer le sens d'une clé existante = nouveau `variante_id`. Le schéma de configuration d'un générateur fait donc partie de son contrat (à documenter, et à verrouiller
  par un test d'épinglage comme `scripts/support/epinglage-motif-delta.json`).
- **Hook de validation recommandé** (PROPOSITION), sur le modèle de `validerAide` : `validerConfiguration?(brute: unknown)` → configuration **canonique** (clés triées,
  doublons retirés, valeurs par défaut résolues) ou message d'erreur. Le contrat ne connaît pas gen8 ; le serveur appelle le hook à l'enregistrement de la tâche.

---

## 3. `ecrans()` et `codesCompetenceDeclares` : mécanique actuelle et percolation

### 3.1 `ecrans(exercice)`

- Contrat : `ecrans(exercice: TExercice): EcranDeclare[]` — « écrans de l'exercice, dans l'ordre » (`lib/contratGenerateur.ts:328-329`).
- **gen7** : la liste est **fixe**, six champs, pour les dix variantes (`champsMotifDelta()`, `analyseFonctionMotifDelta/ecrans.ts:54-57`) ; seul le contenu
  dépend de l'exercice (`ecransMotifDelta(exercice)`, `generateurs.ts:29`). **`etatActuel` de gen7 ignore l'exercice** : il utilise la liste statique `champs`
  capturée à la création (`generateurs.ts:22`, `:30`).
- **Témoin** : c'est le **seul** générateur dont la *liste* d'écrans dépend de l'exercice (`profil` tiré de la graine : `ecransDe`, `index.ts:617` ; `generer`
  `:641-650`) et son `etatActuel` la relit de l'exercice (`:654-656`). C'est le modèle à suivre pour gen8, pas gen7.

### 3.2 `codesCompetenceDeclares`

- **Statique par générateur** : `codesCompetenceDeclares: string[]` (`contratGenerateur.ts:317-318`) ; gen7 : `[...CODES_MOTIF_DELTA]` (`generateurs.ts:27`) ;
  témoin : trois constantes (`index.ts:635`).
- Usages : contrôle au chargement du registre (présence au dictionnaire, doublons : `lib/registreGenerateurs.ts:49-59`) et contrôle croisé à chaque
  vérification, tout code renvoyé par `verifier` doit y figurer (`registreGenerateurs.ts:84-90`).
- Conséquence : c'est un **majorant** de ce que `verifier` peut renvoyer. Pour gen8, déclarer l'**union** de tous les codes de toutes les transformations suffit,
  quelle que soit la configuration. **Aucun changement de mécanisme n'est nécessaire**, et une déclaration par configuration compliquerait le chargement du registre
  sans bénéfice (le contrôle croisé échoue déjà bruyamment si un détecteur émet un code absent).

### 3.3 Où la dépendance « configuration → écrans » percole (avec configuration portée par l'exercice)

| Système | État | Citation |
|---|---|---|
| `champs_attendus` | **Figé à l'assignation** depuis `ecrans(exercice)` : suit donc automatiquement la configuration. Tous les consommateurs de « terminé / complet / dénominateur » lisent cette colonne, pas le générateur | écriture `assignations.ts:142` ; lecture `lib/verrouillageTache.ts:44,75`, `lib/routes/eleves/mes-resultats.ts:76,234-241`, `lib/routes/profs/resultats.ts:147,183,318-320`, `lib/tableauDeBord.ts:56-58` |
| Cascade (`dependDe`) | Un écran qui dépend d'un écran **absent** est rejeté : `validerDependances` signale « champ inconnu » (`lib/cascadeEcrans.ts:18-28`) et `projeterExercice` **lève** (`lib/etatExercice.ts:86-87`) → 500. Le générateur doit donc **élaguer ses `dependDe`** quand il retire un écran, et `projeter` doit tolérer l'absence de réponse confirmée. Obligation de générateur, pas de framework ; l'échec est bruyant (bon) |
| Invariant de projection | `projeterExercice` impose que la projection ne change pas la liste des champs (`etatExercice.ts:98-101`) : la configuration, portée par l'exercice, ne varie pas entre `generer` et `projeter` → respecté |
| Poids | `poidsDesEcrans(ecrans)` calculé **par exercice** (`lib/poidsEcran.ts:25-27`) ; mais `poidsDesChampsDeLigne` régénère depuis `(variante_id, graine)` (`:39-44`) et `poidsDansMap` renvoie **1** pour un champ absent (`:46-49`). **Oubli de la configuration = poids faux sans erreur** |
| `ecransDeLigne` | Même défaut : `{ variante_id, graine }` seuls (`etatExercice.ts:64-69`). Appelé par `mes-resultats.ts:252` et `profs/resultats.ts:388` |
| Registre / catalogue | Inchangés : un seul `variante_id`, une seule entrée de catalogue, mêmes codes (3.2) |
| Exercice sans écran | Une configuration qui ne produit **aucun** écran donnerait `champs_attendus = []`, et `[].every(...)` vaut `true` : `exerciceEstComplet` répondrait « complet » d'emblée (`lib/tableauDeBord.ts:56-58`). **À refuser à l'enregistrement** (la validation de configuration doit exiger ≥ 1 écran et `validerDependances(ecrans) = []`) |

### 3.4 Sites de lecture qui doivent transporter la colonne

- `regenererExercice` : 6 appelants (`reponses-aide.ts:38`, `reponses.ts:72`, `exercices/[id]/remise.ts:37`, `exercices/[id].ts:47`, `eleves/tableau-de-bord.ts:109`,
  `etatExercice.ts:367`), **tous via** `COLONNES_EXERCICE_ASSIGNE` (`etatExercice.ts:37`) : **une seule** chaîne à étendre. Bon point d'entrée.
- Trois requêtes avec **liste de colonnes écrite à la main** qui alimentent `ecransDeLigne` / `poidsDesChampsDeLigne` : `mes-resultats.ts:76`,
  `profs/resultats.ts:147` et `:183`. À étendre (ou à faire passer par `COLONNES_EXERCICE_ASSIGNE`).
- `verrouillageTache.ts:44` (`id, champs_attendus, variante_id, remis_le`) ne régénère pas : **inchangé**.
- Production : `assignations.ts:112` lit `taches_composition` avec `select("generateur_id, variante_id, nombre_exercices")` : à étendre, puis copier la configuration sur
  chaque ligne `exercices_assignes` insérée (`:136-143`).

---

## 4. Stockage — PROPOSITION

### 4.1 Options

| Option | Pour | Contre |
|---|---|---|
| **A. `configuration jsonb` nullable** sur `taches_composition` **et** sur `exercices_assignes` | Générique : « réutilisable par d'éventuels futurs générateurs » (brief). Une colonne, quel que soit le générateur. Précédent jsonb dans la base (`exercices_assignes.enonce jsonb`, `bugs_plausibles jsonb`, `schema.sql:184-186`) | Pas de typage SQL ; la validité repose sur `validerConfiguration` côté serveur |
| B. Une colonne booléenne par transformation (`th`, `tv`, `evcv`, `sox`) | Typage SQL, lisible dans un outil SQL | **Couple le schéma partagé à gen8** ; chaque futur générateur = nouvelles colonnes sur une table commune (+ discipline `cumulatif.sql` à chaque fois) ; la validation générique reste à écrire |
| C. `text[]` de drapeaux | Compact, un type | Reste nommé/pensé pour gen8 ; aucune validation SQL ; ordre non canonique |

**Recommandation : A.** Argument contraire à écarter : « cohérent avec le précédent » plaide pour B/C (colonne typée). Mais le précédent est une propriété **générique
de toutes les lignes** (un nombre de secondes) ; une configuration est **propre à un générateur**. C'est précisément le cas où une colonne par réglage ne passe pas à l'échelle.

### 4.2 Migration (à ajouter dans le **même commit** à `schema.sql` ET `cumulatif.sql`, signalée dans `RAPPORT.md` — `CLAUDE.md`, « Schéma Supabase »)

```sql
-- supabase/migrations/cumulatif.sql (idempotent) + équivalent dans supabase/schema.sql
alter table taches_composition add column if not exists configuration jsonb;
alter table exercices_assignes  add column if not exists configuration jsonb;
```

- Pas de nouvelle table : **aucune** modification RLS (`scripts/test-rls-schema.ts` inchangé).
- **Risque d'exploitation** : ajouter `configuration` à `COLONNES_EXERCICE_ASSIGNE` fait échouer **toutes** les routes élèves (500, « column does not exist ») si le
  `cumulatif.sql` n'a pas été exécuté avant le déploiement. Aucun test ne le détectera : le faux Supabase indexe des objets libres et ne valide aucune colonne contre
  `schema.sql` (`scripts/support/fauxSupabase.ts:147-175` ; `harnaisRouteur.ts:131-148`). La parité `schema.sql` ↔ `cumulatif.sql` n'est vérifiée que **fonctionnalité par fonctionnalité**, par des
  expressions régulières écrites à la main (modèle : `scripts/test-reglage-retour-arriere.ts:67-73`) ; il n'existe pas de test général de parité — un test de ce type devra accompagner
  la migration. C'est exactement l'incident `date_echeance` cité par `CLAUDE.md`. **Ordre impératif : migration avant déploiement.**

### 4.3 Pourquoi copier la configuration sur l'exercice (et ne pas la relire dans `taches_composition`)

1. **Le contenu de l'exercice en dépend** : pour une graine donnée, `generer(graine, configuration)` change selon la configuration. Contrairement au chrono, une lecture
   « à la volée » dérivant d'une ligne modifiable est un risque de dérive silencieuse de ce que voit l'élève (règle `_v2`, `CLAUDE.md`).
2. **La clé `(tache_id, variante_id)` est ambiguë** dès que deux lignes ont le même `variante_id` et des configurations différentes ; la règle « première valeur non nulle »
   (`resoudreChronoDureeSecondes.ts:18-22`) serait alors un tirage au sort silencieux.
3. **Stocker la configuration RÉSOLUE** (canonique, défauts inclus), jamais `null` pour « défaut » : si le défaut d'un générateur évolue, les exercices déjà assignés ne
   doivent pas bouger. `null` ne subsiste que pour les générateurs sans configuration (gen7, témoin) et pour les lignes historiques : il n'est alors jamais lu.
4. Précédent de la même nature dans le dépôt : `champs_attendus` est « figé à l'assignation » (`etatExercice.ts:99-101`, `assignations.ts:142`).

### 4.4 Points à factoriser

- Trois insertions de `taches_composition` recopiant les champs (`taches.ts:262-271`, `taches/[id].ts:75-84`, `taches-apercu.ts:156-164`) : une 4ᵉ copie
  rendrait l'oubli quasi certain (c'est ainsi que l'aperçu avait déjà dû être rattrapé pour `chrono_duree_secondes`, `taches-apercu.ts:162`). **Un seul constructeur de ligne**
  (`lignesDeComposition(tacheId, composition)`) évite la divergence.
- Validation : une branche supplémentaire dans `estCorpsValide` (`validationCorpsTaches.ts:89-101`), puis appel du hook du générateur dans `validerComposition`
  (`:114-128`) pour produire la forme canonique.

---

## 5. Rétrocompatibilité

| Cas | Verdict | Pourquoi |
|---|---|---|
| gen7 v2 (dix variantes) | **Inchangé** | `generer` à un paramètre reste assignable (2.2) ; liste d'écrans fixe (3.1) ; pas de hook `validerConfiguration` donc la validation accepte `configuration` absent/`null` et **rejette** toute configuration fournie pour une variante qui n'en déclare pas |
| Témoin technique | **Inchangé** | idem ; les 137 assertions de la « Section A » ne bougent pas (`CLAUDE.md`) |
| Anciennes lignes `taches_composition` / `exercices_assignes` | **Inchangées** | colonnes nullables sans défaut, `null` jamais lu pour un générateur sans configuration |
| Ancien gen7 (`af_mise_en_evidence`…) | **N'existe plus** (suppression, RAPPORT §51 ; `CLAUDE.md` « gen7 : les dix variantes actuelles ») : le brief le cite encore comme exemple à préserver |
| Clients / API | `POST`/`PATCH /api/taches` : `configuration` optionnel par ligne, absent = comportement actuel ; `GET /api/taches` ajoute un champ |
| Interface professeur | Sans objet tant qu'aucun générateur ne déclare de configuration : le champ n'est rendu que pour une variante qui en déclare une |

Point de vigilance : la compatibilité des **lignes déjà assignées** repose sur `configuration = null` ⇒ « pas de configuration », donc `generer(graine, undefined)` identique à
`generer(graine)` pour tout générateur existant. Un test d'épinglage (même exercice avant/après pour les dix variantes gen7 et le témoin) le prouverait.

---

## 6. Prémisses du brief à corriger

1. **« `ecrans()` et `codesCompetenceDeclares` dépendent aujourd'hui de l'exercice généré »** — vrai pour `ecrans`, **faux pour `codesCompetenceDeclares`** (tableau statique,
   section 3.2).
2. **« `af_irreductible` déclare moins d'écrans que les autres sous-variantes de gen7 v2 »** — périmé : cette variante a été supprimée (RAPPORT §51) ; les dix variantes actuelles
   ont toutes **six** écrans (`ecrans.ts:54-57`). Le seul générateur à liste d'écrans variable est le témoin (3.1).
3. **« repli sur le réglage de tâche si absent »** comme modèle direct — il n'existe pas d'équivalent pour la configuration (section 1.4). Le repli est le défaut du générateur.
4. **HYPOTHÈSE implicite** : « une ligne de composition = un `variante_id` ». Le précédent chrono la suppose (`prof.html:4500-4501`) et la lecture serveur en dépend ;
   c'est précisément ce qui casse pour une configuration par ligne si deux lignes peuvent partager un `variante_id` (section 7, décision 1).

---

## 7. Décisions à trancher (sans anticiper gen8)

1. **Deux lignes de même `variante_id` avec des configurations différentes dans une même tâche ?**
   - **Non** : l'interface actuelle suffit (un champ par variante, `prof.html:4510-4516`) ; la copie sur l'exercice reste recommandée (4.3) mais l'ambiguïté disparaît.
   - **Oui** : il faut une identité de ligne (par exemple un `id` de ligne référencé par `exercices_assignes`, ou une configuration canonique comme clé) et une refonte du
     formulaire (`construireLigneVariante`, `prof.html` ; arbre construit depuis `catalogue-generateurs-complet.json`) ; les agrégats par `variante_id`
     (`profs/resultats.ts:425`) devraient aussi distinguer les configurations.
2. **Configuration par défaut** d'un générateur et sens de « rien coché » : refuser (≥ 1 écran obligatoire, cf. 3.3) ou défaut explicite ? C'est une décision produit propre à chaque
   générateur ; le mécanisme doit seulement permettre de refuser.
3. **Où la configuration est-elle visible à l'élève et au professeur** (libellé de ligne dans les résultats, aperçu) : hors périmètre de cet audit, à cadrer avec gen8.

---

## 8. Surface d'impact (estimation, pour information)

| Zone | Fichiers |
|---|---|
| Schéma | `supabase/schema.sql`, `supabase/migrations/cumulatif.sql` (+ section dans `RAPPORT.md`) |
| Contrat | `lib/contratGenerateur.ts` (paramètre optionnel + hook `validerConfiguration?`), un assistant `genererPourLigne` |
| Appelants de `generer` | `lib/etatExercice.ts` (×2), `lib/poidsEcran.ts`, `lib/routes/assignations.ts`, `lib/routes/taches-apercu.ts` |
| Transport de colonne | `COLONNES_EXERCICE_ASSIGNE` (`etatExercice.ts:37`), `mes-resultats.ts:76`, `profs/resultats.ts:147,183`, `assignations.ts:112,136-143` |
| Tâches (écriture/lecture) | `lib/validationCorpsTaches.ts`, `lib/routes/taches.ts`, `lib/routes/taches/[id].ts`, `lib/routes/taches-apercu.ts` (via un constructeur de ligne unique) |
| Interface professeur | `public/prof.html` (rendu et lecture d'un contrôle de configuration par ligne ; restauration Modifier/Dupliquer `:2584-2600`) |
| Tests | harnais `creerTache` (`scripts/support/harnaisRouteur.ts:131-148`) ; épinglage de non-régression ; test de la porte « ≥ 1 écran, dépendances valides » ; test de chargement du registre inchangé |

Aucun changement pour : `ecrans`/`etatActuel`/`verifier`/`projeter`/`solutionAttendue` (signatures), poids statiques, `champs_attendus` (déjà figé), registre, catalogue,
`codesCompetenceDeclares`, RLS.

---

## 9. Limites de cet audit

- Aucune exécution : tout est établi **par lecture**. L'assignabilité TypeScript (2.2) est une règle du langage non vérifiée ici par compilation d'un prototype.
- Le comptage des 37 occurrences de `generer(` en tests vient d'un `grep` ; il sert d'ordre de grandeur, pas de liste exhaustive des tests à relire.
- Le comportement de la production Supabase (colonne absente → erreur de `select`) est tiré de la documentation du dépôt (`CLAUDE.md`) et du fonctionnement de PostgREST, non testé.
- Rien sur gen8 lui-même (écrans, questions, aides) : volontairement exclu.

---

## 10. Décisions du propriétaire et conséquences

### A) Deux lignes du même `variante_id` avec des configurations différentes : **OUI** (refonte du formulaire acceptée)

La décision 1 de la section 7 est tranchée par l'affirmative. Conséquences, plus larges que la seule copie de la configuration sur l'exercice (4.3) :

1. **Il faut une identité de ligne référencée par l'exercice.** `taches_composition.id` existe déjà (`uuid primary key`, `supabase/schema.sql:119-121`) mais aucune table ne le référence.
   **PROPOSITION** : `exercices_assignes.composition_id uuid references taches_composition(id)` (nullable, comme les autres ajouts de colonnes — lignes historiques à `null`),
   en plus de la `configuration` figée (4.3) : la configuration reste copiée sur l'exercice (elle évite une requête supplémentaire à chaque régénération, 7 sites), l'identifiant
   de ligne sert au regroupement, au libellé et au chrono. Migration idempotente dans `schema.sql` ET `cumulatif.sql`, même commit, signalée dans `RAPPORT.md`.
   Ordre de suppression : `taches-apercu.ts:87` supprime déjà `exercices_assignes` **avant** `taches_composition` ; `taches/[id].ts:121` supprime les lignes de composition avant la
   tâche : l'ordre existant est compatible, mais le test d'aperçu (deuxième aperçu consécutif, `CLAUDE.md` « Aperçu d'une tâche ») doit couvrir la nouvelle clé étrangère.
2. **Le précédent chrono se casse aussi** : `resoudreChronoDureeSecondes` retient « la première valeur non nulle » pour `(tache_id, variante_id)`
   (`lib/resoudreChronoDureeSecondes.ts:18-40`) : avec deux lignes de même variante et deux durées différentes, l'élève recevrait la durée de l'autre ligne
   selon l'ordre de retour de la base. Le chrono doit passer à une résolution **par `composition_id`** (repli sur la durée de tâche inchangé). C'est une correction de comportement
   existant, à annoncer comme telle (RAPPORT) et à tester (deux lignes, deux durées).
3. **Formulaire** (`public/prof.html`) : le modèle actuel est « un champ par variante », apparié par `variante_id` aux trois endroits cités en 1.2 (`:2584-2600`, `:4498-4516`,
   `:1617-1648`). Il faut un modèle de **lignes** : pour une variante qui déclare une configuration, un bouton « Ajouter une ligne » et un contrôle de suppression, chaque ligne
   ayant sa configuration, son nombre d'exercices et sa durée ; identifiant de ligne côté client stable pendant l'édition ; restauration (Modifier / Dupliquer) par **liste ordonnée**,
   plus par dictionnaire `variante_id → valeur`. Les variantes sans configuration (gen7, témoin) gardent exactement le comportement actuel (une ligne).
4. **Doublons exacts** (même variante, même configuration canonique) : **PROPOSITION** de les fusionner côté serveur en additionnant les `nombre_exercices` (canonicalisation 2.2),
   plutôt que de tenir deux lignes indistinguables ; à confirmer.
5. **Agrégations professeur** : `profs/resultats.ts:425` regroupe par `variante_id` ; il faudra regrouper par `composition_id` et afficher la configuration dans le libellé
   (sinon deux lignes différentes apparaissent comme une seule, mélangées). Idem pour toute vue « résultats par variante ».
6. **Validation** : `validerComposition` (`validationCorpsTaches.ts:114-128`) accepte déjà plusieurs lignes de même `variante_id` (aucune contrainte d'unicité, `schema.sql:129-132`) :
   le serveur n'est donc pas bloquant ; c'est l'interface et la résolution du chrono qui supposaient l'unicité.

### B) « Aucune transformation cochée » : **REFUSÉ explicitement à l'enregistrement**

1. **Autorité serveur** : le hook `validerConfiguration` (2.2) renvoie une erreur dès que la configuration ne produit **aucun écran**. Règle générique, pas propre à gen8 :
   après canonicalisation, le serveur construit l'exercice de test `generer(graine_de_contrôle, configuration)`, exige `ecrans(...).length ≥ 1` **et** `validerDependances(ecrans) = []`
   (`lib/cascadeEcrans.ts:11-30`). Sans cela, `champs_attendus = []` rendrait l'exercice « complet » d'emblée (`lib/tableauDeBord.ts:56-58`).
2. **Même garde sur les trois routes d'écriture** : `POST /api/taches`, `PATCH /api/taches/:id` et l'aperçu passent déjà par `estCorpsValide` / `validerComposition`
   (`taches.ts:226-231`, `taches/[id].ts:37-42`, `taches-apercu.ts:102-106`) : un seul point d'implémentation (`validerComposition`) couvre les trois. Réponse `400` avec un message
   explicite (« Sélectionnez au moins une transformation pour cette ligne »), jamais un repli silencieux sur un défaut.
3. **Défense à l'assignation** : `lib/routes/assignations.ts` relit `taches_composition` (`:112`) ; une ligne altérée hors API ne doit pas produire d'exercices vides.
   **PROPOSITION** : re-valider la configuration avant de générer, `409` explicite sinon (même esprit que « Générateur pas encore disponible », `assignations.ts:118-122`).
4. **Interface** : « Créer » / « Enregistrer » désactivé avec le message sous la ligne concernée tant qu'une ligne de configuration est vide — **confort uniquement**, jamais l'autorité.
5. **Tests à écrire** (une fois construit) : configuration vide refusée sur les trois routes ; configuration vide forcée en base refusée à l'assignation ; aucune tâche créée en base
   après un refus (pas de ligne `taches` orpheline : la tâche est insérée avant la composition, `taches.ts:240-271`, donc la validation doit précéder toute écriture, ce qui est déjà le cas
   à `taches.ts:231`).

### Reste ouvert

- Confirmer la fusion des doublons exacts (A.4).
- Défaut de configuration quand le professeur n'a encore rien choisi dans une nouvelle ligne : **vide** (donc refusé à l'enregistrement, B) ou pré-cochée ? Décision produit propre à gen8, non anticipée ici.
