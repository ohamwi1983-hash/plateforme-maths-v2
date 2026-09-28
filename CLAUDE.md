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

## Ancien pilote = spec en lecture seule

`ohamwi1983-hash/plateforme-maths-pilote` est la spec de référence pour ce qui reste à porter
(moteur d'exercice, générateurs, phase 3). Il ne reçoit jamais de push depuis ce dépôt.
