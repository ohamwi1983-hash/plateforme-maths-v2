# Rapport

## §1 : Phase 1 — socle de gestion

Démarrage de la reconstruction du pilote dans un nouveau dépôt (`plateforme-maths-v2`), à partir
d'un dépôt vide, selon `PROMPT-nouveau-pilote-phase1-socle-gestion.md`. Objectif de cette phase :
livrer uniquement le socle de gestion (authentification, classes, tâches, résultats) — sans moteur
d'exercice ni générateur, qui seront reconstruits en phase 3. L'ancien dépôt
`plateforme-maths-pilote` sert de spec en lecture seule ; rien n'y est poussé.

Travail en cours, documenté au fil des sections A à G de la spec. Cette section sera complétée par
les prochaines entrées au fur et à mesure de la livraison de chaque section.

**Livré §A** : squelette (`.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`,
`.env.example` copiés tels quels ; `vercel.json` recréé à l'identique ; `README.md`/`RAPPORT.md`
neufs ; `CLAUDE.md` adapté, 43 lignes). Commit `2307ba7`, poussé sur `main`.

## §2 : Phase 1 §B — schéma Supabase

`supabase/schema.sql` (240 lignes) et `supabase/migrations/cumulatif.sql` (148 lignes) copiés tels
quels depuis `plateforme-maths-pilote`. Diff vérifié vide entre source et copie sur les deux
fichiers (`diff` shell, aucune sortie). Aucune modification de schéma dans cette tâche : la
discipline migration de `CLAUDE.md` ne s'applique pas ici (copie à l'identique, pas d'ajout de
table/colonne).

## §3 : Phase 1 §C — serveur (lib/, lib/routes/, api/router.ts, src/)

**Fichiers copiés tels quels** (imports vérifiés un par un par lecture directe avant copie, pas
seulement classification de l'audit) :

- `lib/` (29 fichiers) : les 20 fichiers classés **G** de l'audit §1.2 (`classeUniqueDeEleve.ts`,
  `codeClasse.ts`, `eleveDuProf.ts`, `elevesDeLaClasse.ts`, `emailSynthetique.ts`,
  `historiqueTaches.ts`, `homonymes.ts`, `httpTypes.ts`, `normaliserTexte.ts`,
  `provisionnerEleve.ts`, `reglagesCorrection.ts`, `resoudreChronoDureeSecondes.ts`,
  `supabaseAdmin.ts`, `supabasePagination.ts`, `tableauDeBord.ts`, `tacheAssignee.ts`,
  `tacheDuProf.ts`, `tempsExercice.ts`, `tousLesEleves.ts`, `verrouillageTache.ts`) +
  `avecGestionErreurs.ts` (G) + les 6 fichiers nommés explicitement au §C du prompt
  (`moteurTentatives.ts`, `tempsExercice.ts` déjà listé, `tendanceTemps.ts`,
  `resoudreChronoDureeSecondes.ts` déjà listé, `supabasePagination.ts` déjà listé,
  `validationCorpsTaches.ts`) + les 5 données de compétences (décision actée 2 : tout garder —
  `dictionnaireCompetences.ts`, `categoriesCompetences.ts`, `explicationsCompetences.ts`,
  `explicationsCompetencesEleve.ts`, `profilCompetences.ts`) + `catalogueGenerateurs.ts` **élagué**
  (décision actée 3, voir plus bas).
- `lib/routes/` (24 fichiers) : les 23 fichiers de la liste explicite du §C du prompt (`classes.ts`,
  `config.ts`, `connexion-eleve.ts`, `eleves.ts`, `inscription-eleve.ts`, `inscription-prof.ts`,
  `reponses-debut-ecran.ts`, `taches.ts`, `classes/renommer.ts`, `classes/regenerer-code.ts`,
  `classes/[id]/profil.ts`, `eleves/mes-resultats.ts`, `exercices/index.ts`, `exercices/[id].ts`,
  `profs/creer-eleve.ts`, `profs/desactiver-eleve.ts`, `profs/reset-mdp-eleve.ts`,
  `profs/transferer-eleve.ts`, `profs/resultats.ts`, `profs/tableau-de-bord.ts`,
  `profs/eleves/[id].ts`, `profs/eleves/profil.ts`, `taches/[id].ts`) + `catalogue-generateurs.ts`
  (ajouté, absent de la liste explicite du prompt — voir « Écart n°1 » ci-dessous).
- `src/` : uniquement `src/moteur/statutVerification.ts` (22 lignes, aucun import) — confirmé par
  grep des imports des 53 fichiers ci-dessus : seul `StatutVerification` est importé depuis `src/`
  (par `reglagesCorrection.ts`, `tableauDeBord.ts`, `verrouillageTache.ts`, `moteurTentatives.ts`,
  `lib/routes/eleves/mes-resultats.ts`). Aucun autre fichier `src/` requis.
- `api/router.ts` : copié et élagué — `TABLE_ROUTAGE` réduite de 30 à 24 entrées. Retirées :
  `POST /api/assignations`, `GET /api/eleves/tableau-de-bord`, `POST /api/reponses` (gestionnaires
  reportés en phase 2) ; `GET /api/profs/exercices/:id`, `GET /api/reponses/grille-info` (décision
  actée 4, jamais copiés) ; `POST /api/taches/apercu`, `GET /api/taches/:id/impression`
  (gestionnaires non copiés — écart n°2 ci-dessous). Ajoutée : `GET /api/catalogue-generateurs`
  (écart n°1 ci-dessous).

**Décision actée 3 appliquée** — `lib/catalogueGenerateurs.ts` élagué à un seul générateur : les 4
entrées gen7 (`af_mise_en_evidence`, `af_binome_conjugue`, `af_produit_remarquable`,
`af_irreductible`), labels copiés mot pour mot de l'ancien pilote
(`plateforme-maths-pilote/lib/catalogueGenerateurs.ts:165-168`), plus les 3 fonctions génériques
inchangées (`estVarianteConnue`, `generateurIdPourVariante`, `labelPourVariante`). Aucun code de
générateur (décision actée 1) : ce ne sont que 4 lignes de donnée `{generateur_id, variante_id,
label}`, gen7 lui-même sera réécrit en phase 3.

**Écart n°1 vs la liste explicite du prompt — `lib/routes/catalogue-generateurs.ts` ajouté** : ce
fichier n'est pas dans la liste explicite du §C du prompt (probablement parce qu'il est classé
G/S, pas purement G, dans l'audit §1.2 : « renvoie `CATALOGUE_GENERATEURS` tel quel »). Mais
`public/prof.html:2292` (`fetch("/api/catalogue-generateurs", ...)`) en fait la **seule source de
vérité côté client** pour déterminer si une variante est réellement assignable (voir
`prof.html:2034`, commentaire "seule source de vérité sur ce qui est assignable") — c'est ce fetch
qui contrôle si le champ « nombre d'exercices » est `disabled` ou non. Sans cette route, la
validation explicitement demandée par le prompt (« `disabled` absent du champ « nombre
d'exercices » » pour la composition gen7 « 4e:7 ») échouerait nécessairement. Copié pour cette
raison : dépendance uniquement de `lib/catalogueGenerateurs.ts` (élagué, gen7 seul) et de
`lib/supabaseAdmin.ts`/`lib/avecGestionErreurs.ts`/`lib/httpTypes.ts` (tous dans le périmètre),
aucune fuite vers un module reporté.

**Écart n°2 vs la liste explicite du prompt — `lib/routes/taches-impression.ts` NON copié malgré
sa présence dans la liste du §C** : lecture directe du fichier confirme qu'il importe
`genererLigne` depuis `./assignations` (reporté) ET `calculerSolutionAttendue` depuis
`./eleves/tableau-de-bord` (reporté) — son unique fonction (`GET /api/taches/:id/impression`)
génère à la volée, sans écriture en base, les exercices qu'une composition de tâche produirait,
puis leur réponse attendue : une fonctionnalité intégralement dépendante du futur contrat de
générateur, donc irréconciliable avec la décision actée 1 (« aucun code de générateur »). Solution
retenue parmi celles proposées par le prompt (« stub typé ou report du fichier importateur ») :
report du fichier importateur, pas de stub — un stub de génération d'exercice n'aurait aucun sens
tant que le contrat de générateur n'existe pas. Sa route (`GET /api/taches/:id/impression`) a été
retirée de `TABLE_ROUTAGE` en conséquence. Le bouton « Imprimer » de `prof.html` qui l'appelle sera
désactivé proprement au §D.

**Incohérence de l'audit tranchée** — `lib/routes/taches-apercu.ts` : confirmé par lecture directe
(ligne 6, `import { genererLigne, type LigneExerciceAssigne } from "./assignations"`) qu'il dépend
bien de `genererLigne` malgré sa classification **G** à l'audit §1.2 — l'audit §2.5 avait déjà
signalé cette incohérence. Non copié (il n'était de toute façon pas dans la liste explicite du
§C). Le bouton « aperçu » de `prof.html` qui l'appelle sera désactivé proprement au §D.

**Validation** : `npm install` (159 paquets) puis `npx tsc -b` — **exit code 0, aucune erreur**,
sur les 53 fichiers `.ts` copiés (29 `lib/`, 24 `lib/routes/`, 1 `src/`, 1 `api/`).

## §4 : Phase 1 §D — client `public/prof.html`

Copié en entier depuis l'ancien pilote (6937 lignes), puis élagué à 6581 lignes.

**`CORRESPONDANCE_JSON_VERS_PILOTE`** (`prof.html:1407` avant élagage) : réduite de 14 entrées
(`"4e:1"` à `"4e:14"`) à la seule `"4e:7"` (4 variantes `af_mise_en_evidence`/`af_binome_conjugue`/
`af_produit_remarquable`/`af_irreductible`, labels identiques mot pour mot à l'ancien pilote et à
`lib/catalogueGenerateurs.ts` élagué au §C).

**`NUMEROS_PAR_CHAPITRE_4E`/`LABELS_CHAPITRE_4E`** (`prof.html:1741-1760` avant élagage) :
**non modifiées**, contrairement à la formulation initiale du §D du prompt (« élaguer... aux
numéros restants »). Vérifié par lecture : `public/catalogue-generateurs-complet.json` est copié
**en entier** (décision actée 3), donc ses 66 `numero` de "4e" existent toujours tous — cette table
ne fait que nommer/regrouper les 8 vrais chapitres pour l'affichage de l'arbre, elle ne filtre
aucune entrée. Aucun `numero` n'a été retiré du JSON, donc aucune entrée n'est devenue orpheline :
il n'y avait rien à élaguer ici sans retirer aussi des entrées du JSON, que la décision actée 3
interdit explicitement. Le grisage des variantes non wired (13 générateurs sur 14) reste géré par
le mécanisme existant (`varianteIdActive` renvoie `undefined` → `creerChampNombreExercices` pose
`input.disabled = true`), pas par un filtrage de cette table.

**Retiré** (décision actée 4) :
- `estExerciceGen1` (`prof.html:4952` avant élagage) + son unique appelant, le lien « Voir
  l'exercice → » (`ouvrirRevueExercice`, `panneauDetail.appendChild(lienExercice)` dans le
  détail d'un exercice de résultat) : ce lien n'existait QUE pour gen1
  (`GET /api/profs/exercices/:id` répond 400 pour tout autre générateur, voir commentaire d'origine
  ligne 4946), et `lib/routes/profs/exercices/[id].ts` n'a pas été copié (§C). `ouvrirRevueExercice`
  lui-même (devenu sans appelant) a aussi été retiré.
- `MIROIR_GENERATEURS`/`URL_BASE_MIROIR`/`resoudreImpressionMiroir` (impression via le site
  `plateforme-maths` public) : retirés à la racine (décision actée 4, ne jamais copier
  `MIROIR_GENERATEURS`).

**Désactivé proprement** (dépendant de générateurs/moteur d'exercice, ni copié ni laissé cassé) :
- **Bouton « Aperçu »** (`#btn-apercu-tache`) : marqué `disabled` avec `title` explicatif en HTML ;
  son gestionnaire de clic remplacé par un message statique (« Aperçu indisponible en phase 1 »)
  au lieu d'appeler `POST /api/taches/apercu` (déféré, §C) et d'ouvrir `eleve.html?apercu=1` (moteur
  d'exercice absent de cette phase, voir §E ci-dessous).
- **Écran « Imprimer une tâche »** (`#ecran-impression-tache`, ouvert depuis le menu ⋯/détail
  dépliable d'une ligne de tâche) : `ouvrirEcranImpressionTache` réécrite pour afficher un message
  d'indisponibilité et masquer le panneau `.reglages-impression` (gabarit/corrigé/bouton générer),
  au lieu de calculer une URL miroir ou d'ouvrir `eleve.html?imprimer_tache=...` (moteur d'exercice
  absent). Le bouton « 🖨️ Imprimer » par tâche reste visible (menu ⋯ et détail dépliable) mais
  aboutit désormais à ce message, jamais à un écran cassé.
- Distinct de ce qui précède : **le bouton « 🖨️ Imprimer » des Résultats** (`#btn-ouvrir-
  impression-resultats`, impression de profils de compétences/scores par élève, AUCUNE référence
  générateur) reste pleinement fonctionnel — il n'a jamais dépendu de code de générateur.

**Fichiers `public/` non audités par l'audit, lus et tranchés dans cette tâche** :
- `index.html` (231 lignes) : **copié tel quel** — page d'accueil + flux de réinitialisation de mot
  de passe, 0 référence générateur, dépend uniquement de `GET /api/config` (copié).
- `manifest-eleve.json`/`manifest-prof.json` (15 lignes chacun) : **copiés tels quels** — manifestes
  PWA génériques (nom, icônes, couleurs), 0 référence générateur.
- `icon-192.png`/`icon-512.png`/`icon-512-maskable.png` : **copiés tels quels** (référencés par les
  2 manifestes).
- `revue-exercice.html` (621 lignes) : **NON copié**. Lu en tête (imports KaTeX/style.css, filet de
  sécurité diagnostic identique à prof.html/eleve.html) — confirmé scopé à gen1 uniquement (même
  dépendance `GET /api/profs/exercices/:id` que `estExerciceGen1` ci-dessus, non copiée). Sans
  entrée point ni backend, cette page serait du code mort ; décision alignée avec la décision actée
  4 (jamais copier ce qui est scopé gen1-uniquement).
- `README.md` : déjà traité au §A (neuf, pas une copie de l'ancien, non audité).

**Validation** : les 2 blocs `<script>` inline de `prof.html` parsent sans erreur de syntaxe
(`new Function(script)` via Node, aucune exception). Vérification de balance HTML `<div>`/`<button>`
équilibrée (166/166, 83/83) ; le léger déséquilibre `<script>`/`<p>` (4/3, 37/36) est identique dans
l'ancien pilote avant toute modification de cette tâche (vérifié par le même script sur le fichier
source) — pas une régression introduite ici. Aucune référence résiduelle à
`MIROIR_GENERATEURS`/`estExerciceGen1`/`ouvrirRevueExercice`/`resoudreImpressionMiroir` hors des
commentaires explicatifs de cette section (vérifié par grep). La validation Chromium complète
(disabled absent du champ « nombre d'exercices » pour "4e:7", création de tâche de bout en bout)
est reportée au §G (validation finale), après §E/§F.

## §5 : Phase 1 §E — client `public/eleve.html` (checkpoint obligatoire, validé par l'utilisateur)

**Point de contrôle** : avant toute copie, classification exhaustive de l'ancien `eleve.html`
(23 612 lignes) livrée à l'utilisateur (fichier `CLASSIFICATION-ELEVE-HTML.md`, envoyé hors dépôt)
et validation explicite obtenue ("Go, avec la gestion d'erreur silencieuse sur
chargerTableauDeBord face à une 404") avant d'écrire le moindre fichier. Méthode : lecture directe
de la structure HTML (lignes 1-3858, moi-même) + un agent de recherche dédié pour la zone
entrelacée gen1-gen6 (3859-13930, 329 fonctions) et le bloc impression/aperçu jamais audité
auparavant (23025-23601) ; 6 fonctions majeures spot-vérifiées par moi ligne par ligne après coup
(lignes exactes confirmées à 100%).

**Construit un fichier NEUF** (jamais une copie élaguée du fichier de 23 612 lignes) : 970 lignes,
contenant exclusivement les ~285 lignes HTML de gestion identifiées (tête, en-tête, authentification,
nav à 4 onglets, panneau Tableau de bord résumé, panneau Mes tâches — **liste de tâches
uniquement, sans `#exercice`**, onglet Résultats, onglet Mon compte) et les 20 fonctions JS de
gestion classées, adaptées :

- `chargerTableauDeBord` : `GET /api/eleves/tableau-de-bord` étant différé à la phase 2 (§C),
  gestion d'erreur silencieuse spécifique au 404 (état vide `{en_cours: [], effectuees: [],
  anterieures: [], serieActuelle: 0}`, jamais de bannière d'erreur fatale) — décision validée
  explicitement par l'utilisateur. Tout autre code d'erreur continue d'appeler
  `window.afficherErreurFatale` comme avant (bug réel à ne pas masquer).
- `btn-deconnexion` : retiré `document.getElementById("exercice").hidden = true` (élément absent
  de ce fichier), reste inchangé sinon.
- `demarrerFluxPasAPas`/`ouvrirExercice` : **stubs temporaires** (avertissement console, aucune
  action) au lieu d'être copiées — ce sont des fonctions du moteur d'exercice (~437 et ~340 lignes
  dans l'ancien fichier), hors périmètre phase 1. En pratique, ces branches ne s'exécutent jamais
  (les 3 catégories de tâches sont toujours vides tant que le tableau de bord est différé), mais
  les stubs évitent un `ReferenceError` si cette hypothèse changeait avant la phase 3.
- `libelleCategorie` : portée **verbatim**, sans modification — vérifié qu'elle dégrade
  gracieusement (repli sur le slug brut) en l'absence de tout `.choix-btn[data-valeur]` dans le
  DOM (ces boutons n'existent que dans les blocs de générateur, absents de ce fichier).
- KaTeX (CDN script + feuille de style) retiré de `<head>` : aucune des 20 fonctions de gestion
  portées n'en dépend (confirmé par grep) — chargement CDN inutile en phase 1.
- Point d'entrée du script : `initSupabaseClient()` directement, jamais
  `initModeImpression()`/`initModeApercu()` (tous deux hors périmètre, dépendants du moteur
  d'exercice — voir la classification).

**Validation** : les 2 blocs `<script>` inline parsent sans erreur de syntaxe (`new Function`, Node).
Les 55 cibles distinctes de `document.getElementById(...)` résolvent toutes vers un élément
existant du HTML de ce même fichier (script de vérification automatisé, 0 manquant). Balance des
tags HTML (`div`/`section`/`script`/`button`/`p`) vérifiée égale. Aucune référence résiduelle à
`formatEnonceKatex`/`afficherEtapeCourante`/`soumettreEtapeCourante`/`champsPourVariante`/
`VARIANTES_*`/`katex` (vérifié par grep). La validation Chromium réelle (connexion, onglets
Résultats/Compte, tableau de bord vide sans erreur console) est reportée au §G.

## §6 : Phase 1 §F — styles `public/style.css`

Copié depuis l'ancien pilote (6063 lignes) puis élagué à 4671 lignes (147 blocs de règles retirés,
77% des lignes conservées).

**Méthode** : script Python d'analyse de blocs `{...}` (commentaires neutralisés pour ne jamais
faire correspondre un sélecteur à du texte de commentaire, seul le sélecteur réel juste avant `{`
est testé), avec liste de motifs couvrant tout ce qui identifie un générateur par nom : `af-`/`af_`
(gen7), `gen1` à `gen14` (numériques), `tg-`/`bloc-tg` (gen8), `cercle-trig`/`cercle-quadrant`
(gen14), `mafs-graph` (graphe d'exercice), `niveau1-4`/`denominateurCarre`/`sansFacteurCommun`/
`cubique`/`inequation` (gen2/gen6), `grille-signes`/`cellule-grille` (tableau de signes, les 2
« pièges » explicitement visés), `ens-sol`/`racinesChamp`/`axeSommet`/`domaineImage`/`allure`
(widgets de réponse par générateur), `arbre-famille` (nesting gen13), `zeros`/`grille-choix-zeros`
(widget dédié gen1, découvert lors du 2e passage — non capturé par les motifs `gen*`/`af*` car son
nom ne porte aucun préfixe de générateur, ajouté après un sondage complémentaire par mots-clés).
Dans un `@media`, seules les règles internes qui correspondent sont retirées (le bloc `@media`
entier n'est retiré que si TOUTES ses règles internes correspondent).

**Conservé explicitement** (classes génériques nommées par le prompt comme « à garder en cas de
doute », vérifiées présentes après élagage) : `.template-box`, `.pastille-tentatives`, `.stepper*`,
ainsi que `.summary-table`/`.curseur-champ*`/`.grille-choix`/`.choix-btn` (même raisonnement —
noms de composants génériques, non liés à un générateur par leur nom, même si actuellement
consommés uniquement par le moteur d'exercice) et `.recap-cumulatif`/`.instruction-persistante`
(base partagée, confirmée non retirée). Tokens `:root` (31 propriétés) intacts. Chrome de gestion
(`.item-liste`, `.grille-stats-tdb*`, `.arbre-*` hors `.arbre-famille`, `.onglet*`, `.tdb*`,
`@media print`) intact.

**Itérations correctives** : 2 sondages complémentaires par mots-clés après le premier passage ont
trouvé des règles manquées par les motifs initiaux — `#bloc-tg #pastille-tentatives` (motif `tg-`
avec tiret ne capturait pas `bloc-tg` sans tiret final, corrigé) et `.gen5-session-hero`/
`#gen5-session-table` (motif numérique initial limité à gen7-14, gen5 avait aussi des sélecteurs
`genN-` propres, motif étendu à gen1-14). Sondage final exhaustif après corrections : 0 sélecteur
résiduel correspondant à un des motifs ci-dessus.

**Validation** : balance accolades/commentaires vérifiée égale (761/761, 201/201) sur le fichier
élagué. Vérification Chromium réelle (pas seulement une inspection du CSS) : serveur statique local
+ stub `/api/config`, captures mobile (390px) et desktop de `eleve.html` (écran de connexion) et
`prof.html` (écran de connexion, onglet Classes) avec le style élagué, plus captures des écrans
`eleve.html` accessibles uniquement après connexion (Tableau de bord, Mes tâches avec accordéons,
Résultats, Mon compte avec avatar/mini-stats) en forçant l'état `hidden` via `page.evaluate` (pas
de vraie session Supabase disponible dans ce bac à sable, CDN bloqué) — rendu visuellement intact
sur les 8 captures : cartes, dégradés, badges, accordéons, navigation flottante, formulaires tous
correctement stylés, aucune classe de gestion cassée par l'élagage.
