# Instructions pour ce dépôt

## Schéma Supabase — discipline de migration (obligatoire)

`supabase/schema.sql` est la référence canonique, mais ce n'est **pas** ce qui s'exécute contre la
vraie base. Seul `supabase/migrations/cumulatif.sql` s'exécute réellement. Toute tâche qui touche
`schema.sql` doit, dans le même commit, ajouter l'instruction idempotente équivalente
(`create table if not exists` / `alter table ... add column if not exists`) à
`cumulatif.sql` — jamais un nouveau fichier séparé — et le signaler explicitement dans
`RAPPORT.md`. Ne jamais se contenter d'une mention en prose : c'est exactement l'oubli qui a rendu
`taches_assignations.date_echeance` indisponible en production dans l'ancien pilote.

## Nouveau générateur/variante — discipline de câblage `prof.html` (obligatoire)

Dès qu'un générateur ou une variante devient assignable côté prof, `public/prof.html` ne relie
l'arbre JSON (`public/catalogue-generateurs-complet.json`) au catalogue serveur que via une table
tenue à la main, `CORRESPONDANCE_JSON_VERS_PILOTE`. Une variante absente de cette table apparaît
dans l'arbre avec son champ "nombre d'exercices" silencieusement grisé (`input.disabled = true`) —
sans erreur ni log. Toute tâche qui ajoute un générateur/variante assignable doit, dans le même
commit : confirmer/ajouter l'entrée JSON avec les libellés EXACTEMENT identiques à
`CATALOGUE_GENERATEURS` ; ajouter l'entrée correspondante dans `CORRESPONDANCE_JSON_VERS_PILOTE` ;
vérifier réellement (Chromium, `api/router.ts` réel, base en mémoire) que le champ n'est pas
`disabled` et créer une vraie tâche de bout en bout ; documenter la vérification dans `RAPPORT.md`
avec citation de l'entrée ajoutée.

## Pagination Supabase (obligatoire)

PostgREST plafonne silencieusement tout `select` à 1000 lignes sans jamais renvoyer d'erreur. Toute
requête non bornée à un seul élève/exercice (donc potentiellement volumineuse) doit passer par
`recupererToutesLesLignes` (`lib/supabasePagination.ts`) plutôt qu'un simple `.select()...in()`,
sous peine de tronquer silencieusement le résultat. Ne jamais redéfinir cette boucle de pagination
localement ailleurs.

## `RAPPORT.md` — append-only

`RAPPORT.md` s'allonge, section par section, une par tâche livrée. Ne jamais réécrire ou relire en
entier les sections précédentes avant d'ajouter la nouvelle — ajouter en fin de fichier avec
citations exactes (fichier:ligne) de ce qui a été livré dans cette tâche.

## Ancien pilote = spec en lecture seule, jamais un modèle de structure

`ohamwi1983-hash/plateforme-maths-pilote` est la spec de référence pour ce qui reste à porter
(générateurs curriculaires, phase 3) : ce qu'un écran doit vérifier, ses pièges, ses tolérances, ses
codes de compétence. Il ne reçoit jamais de push depuis ce dépôt. **Ne jamais en reprendre la
structure de code** (fonctions géantes, HTML/JS/vérification mélangés, branches `if` par générateur,
noms de variables) : ce dépôt a un vrai moteur générique (voir ci-dessous).

## Registre unique de générateurs (obligatoire, depuis la phase 2)

`lib/registreGenerateurs.ts` est la **seule** autorité sur « quel `variante_id` correspond à quel
générateur exécutable ». Ne jamais recréer une deuxième liste de variantes à tenir à la main en
parallèle (assignation, réponses, tableau de bord, GET exercice passent tous par `chercherGenerateur`,
jamais par une chaîne de tests sur `variante_id` ni par des ensembles `VARIANTES_*` codés en dur) —
c'est le défaut trouvé en phase 1 (`MIROIR_GENERATEURS` non documenté, une entrée jamais copiée dans
`catalogue-generateurs-complet.json`). `lib/catalogueGenerateurs.ts` reste la source du catalogue
AFFICHÉ au professeur : les deux sont distincts (le catalogue dit ce qu'on peut composer, le registre
sait exécuter) et leur cohérence est vérifiée au chargement du registre (échec bruyant).

## Contrat de générateur et moteur (phase 2)

- Un générateur (`lib/contratGenerateur.ts`) déclare des écrans (données) ; il n'écrit jamais de
  HTML/CSS. Un nouveau type d'écran = une interface dans le contrat + un composant dans
  `public/moteur/ecrans/` (enregistré dans `index.js`) + un écran dans le témoin technique
  (`src/generateurs/_temoinTechnique/`, `variante_id` `_temoin_technique_v1`, permanent, jamais dans le
  catalogue affiché) ; `npm run chromium-temoin` doit alors passer.
- **État local d'édition ≠ réponse.** Ce que l'élève compose (texte tapé, lignes ajoutées, cases
  cochées, choix non confirmé) ne quitte jamais le composant ; seule une réponse confirmée (« Valider »)
  est envoyée, sous forme d'UNE chaîne `reponse_brute`. `POST /api/reponses` rejette toute clé autre que
  `{ exercice_assigne_id, champ, reponse_brute }`. Vérification **uniquement côté serveur**, jamais de
  marquage d'erreur en direct pendant la frappe.
- Aléa : uniquement `creerPrng(graine)` (`lib/prng.ts`), jamais `Math.random()` dans un générateur.
  L'exercice n'est pas stocké : il est régénéré depuis `exercices_assignes.graine`. **Toute
  modification qui change ce que `generer` produit pour une graine donnée impose un NOUVEAU
  `variante_id` (`_v2`…)**, sinon les exercices déjà assignés changent sous les pieds des élèves.
- Le texte d'aide n'est jamais envoyé avec l'écran : `POST /api/reponses/aide` le sert et enregistre
  l'usage côté serveur (`aides_utilisees`).
- Nouveau générateur curriculaire : l'ajouter à `REGISTRE_GENERATEURS` **et** au catalogue **et** à
  `CORRESPONDANCE_JSON_VERS_PILOTE` (discipline de câblage ci-dessus) ; ses codes de compétence
  doivent exister dans `lib/dictionnaireCompetences.ts`.
- Le conteneur du moteur dans `eleve.html` est `#conteneur-moteur`, pas `#exercice` : `style.css`
  garde des règles héritées de l'ancien écran d'exercice sous `#exercice` (ex. `#exercice button
  { width: 100% }` en mobile) qui déforment tout composant placé dessous.

## Design system (phase 2)

Les 32 tokens de `:root` (`public/style.css`) sont documentés dans `docs/design-system.md`
(`scripts/test-design-system.ts` vérifie qu'ils restent identiques, et que `public/moteur/ecrans.css`
n'utilise que des `var(--token)`). Ne jamais ajouter de valeur en dur (couleur, police, espacement,
rayon) dans un composant d'écran ; ne jamais inventer un token sans mettre à jour le document (et le compte attendu par le test). Ombre de carte :
`var(--ombre-carte)`, jamais recopiée littéralement.

## Correction immédiate coupée (règle de révélation)

Sous `feedback_immediat = false` : **un seul essai effectif** (`tentativesMaxEffectif`, `lib/moteurTentatives.ts`,
seule source ; le formulaire prof verrouille « Tentatives supplémentaires » à 0) et **rien n'est révélé —
ni verdict, ni solution, ni `revele`, ni message d'erreur — avant que la tâche ENTIÈRE soit terminée**, jamais
à l'épuisement d'un champ. Un échec ne doit pas être plus visible qu'une réussite, par AUCUN canal : ajouter
un nouvel indicateur dérivé des réponses d'un élève (série, compétences, score, badge…) impose de l'exclure
tant que la tâche est masquée (`revelationFinDeTache`, `lib/etatExercice.ts` ; voir `RAPPORT.md` §13).

