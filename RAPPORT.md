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

## §7 : Phase 1 §G — tests portés (`scripts/`)

**Méthode de vérification** : ces tests couplent au VRAI handler compilé via `require()`/
`require.resolve()` (jamais un import statique, jamais un `fetch` HTTP) — soit directement, soit via
un petit helper local `appeler(cheminHandler, nomExport, req)`/`appelerRouteur(...)`. Portabilité
vérifiée fichier par fichier par grep exhaustif de chaque littéral `require(...)`/
`require.resolve(...)`/`appeler("../lib/...")`, jamais supposée depuis le seul nom du fichier.

**15 fichiers portés verbatim** (aucune modification, dépendances 100% confirmées dans le périmètre
§A/§C — `lib/`, `lib/routes/` copiés tels quels) :
`test-categorisation-profil.ts` (`lib/categoriesCompetences`), `test-connexion-sans-code.ts`
(`lib/routes/classes`, `lib/routes/inscription-eleve`, `lib/routes/connexion-eleve`),
`test-explication-competences.ts` (`lib/profilCompetences`, `lib/dictionnaireCompetences`,
`lib/explicationsCompetences`), `test-gestion-classe-etendue.ts` (`lib/routes/classes`,
`lib/routes/eleves`, `lib/routes/profs/eleves/[id]`, `lib/routes/profs/desactiver-eleve`,
`lib/routes/connexion-eleve`, `lib/routes/profs/transferer-eleve`), `test-inscription-prof.ts`
(`lib/routes/inscription-prof`), `test-mes-resultats.ts` (`lib/routes/eleves/mes-resultats`),
`test-profil-competences.ts` (`lib/routes/profs/eleves/profil`),
`test-provisionnement-vrai-client-supabase.ts` (`lib/supabaseAdmin`, `lib/provisionnerEleve`),
`test-refonte-onglet-classes.ts` (`lib/routes/classes`, `lib/routes/classes/renommer`,
`lib/routes/eleves`), `test-tableau-de-bord-pagination.ts`, `test-tableau-de-bord-prof.ts`,
`test-tableau-de-bord-temps-variante.ts`, `test-temps-par-competence.ts`,
`test-temps-par-variante.ts` (ces 5 derniers : `lib/routes/profs/tableau-de-bord` et/ou
`lib/routes/profs/eleves/profil`, plus `lib/classeUniqueDeEleve` pour le dernier).

**`test-routeur.ts` adapté** (jamais un simple copier-coller — la table `TABLE_ROUTAGE` a été
élaguée en §C, ce test exerçait explicitement les 19 routes de l'ancienne table) :
- Retirés des cas de dispatch (`CAS_DISPATCH`) : `assignations`, `eleves/tableau-de-bord`,
  `reponses`, et les 2 cas `taches/apercu` — les 4 routes correspondantes n'existent plus dans
  `TABLE_ROUTAGE` de ce dépôt (moteur/tentatives et tableau de bord élève différés phase 2, écart
  n°2 §3 pour `taches/apercu`/`taches-impression`).
- Cas "méthode incorrecte sur un chemin connu -> 405 du handler" : `assignations` PUT (original,
  route absente ici) remplacé par `classes` PUT. Ce remplacement a nécessité 2 correctifs découverts
  en exécutant le test (jamais supposés a priori) : (1) authentification requise
  (`injecterFauxAdmin(ADMIN_INUTILISE, true)`, pas `false`) — `gererClasses` vérifie
  `profAuthentifie` AVANT le dispatch de méthode (`lib/routes/classes.ts:35-39`), contrairement à
  l'ancien `assignations` qui vérifiait la méthode en premier ; sans authentification, PUT renvoyait
  401 avant d'atteindre le 405 attendu. (2) invalidation ciblée du cache
  (`delete require.cache[require.resolve("../lib/routes/classes")]`) — `lib/routes/classes` avait
  déjà été chargé (et capturé le faux admin non-authentifié d'ALORS) par la boucle `CAS_DISPATCH`
  précédente ; sans ce nettoyage, le module continuait silencieusement à utiliser l'ancien admin
  malgré le ré-appel d'`injecterFauxAdmin`, même piège que celui déjà documenté dans le fichier
  original pour `lib/routes/exercices/[id]`. Reste inchangé : dispatch des 16 routes restantes,
  fusion de `classe_id`, extraction de `:id`, 404 sur chemin inconnu et sur `path` absent.

**`scripts/smoke-test.ts` extrait** (432 lignes utiles sur les 2475 de l'original, reconstruit avec
un nouvel en-tête + imports ciblés, pas une simple suppression de blocs en place) : 5 blocs de
fonctions pures de gestion conservés, dans l'ordre — `genererCodeClasse`/`normaliserTexte`/
`filtrerHomonymes`+`formaterAffichage`/`construireReponseHttpReponses` (lignes 467-535 de
l'original), `exerciceEstComplet`/`tacheEstComplete`/`classifierTache` (920-965),
`construireChampVue` (977-1044, borne de fin corrigée après une 1ère extraction qui coupait
l'accolade fermante — détecté par une vérification programmatique de l'équilibre des accolades
avant assemblage), `nombreTachesEnCoursDepuisAssignations`/`compterBugsDepuisReponses`/
`resumeExercice`/`resumeTache`/`calculerSerieActuelle` (1063-1181),
`calculerProfilCompetences`/`calculerEtatChampTentatives`/`tentativesMaxDepuisReglages`/
`statutRecap`/`libelleStatutRecap`/`construireLigneRecap` (1245-1375). Abandonnés avec raison :
tout `src/generateurs/`, `src/moteur/`, `src/diagnostic/` (gen1/gen6/secondDegre, hors périmètre
phase 1 par décision actée n°1) ; le bloc `estPeriodeAssignationValide` (967-975, dépend de
`lib/routes/assignations`, jamais copié) ; les blocs `formatQuadratique`/`formatMembreGaucheKatex`
(1183-1243, dépendent de `lib/formatQuadratique.ts`, absent des 29 fichiers `lib/` du socle §A).

**Validation** : `npx tsc -b` clean (exit 0) sur l'état final (53 fichiers `.ts` serveur + 16
scripts). Les 16 scripts (`smoke-test.ts` + 15 tests) exécutés individuellement via `npx tsx`, 3
fois consécutives : tous verts au 3e essai, aucun flake. `test-routeur.ts` a échoué de façon
reproductible (3/3, jamais un flake) avant les 2 correctifs ci-dessus, confirmant qu'il s'agissait
d'un vrai bug d'adaptation et non d'une instabilité du test.

**Tests dépendant de `reponses.ts`/`assignations.ts` (moteur/tentatives), différés phase 2, jamais
portés** : aucun des 15 fichiers portés n'en dépend (vérifié ci-dessus) ; les tests de l'ancien
pilote qui en dépendent réellement (chrono, tentatives, verrouillage — hors des 15 candidats
identifiés) restent dans l'ancien pilote, non inventoriés individuellement ici faute d'y avoir
touché. **Non portés intentionnellement** (générateurs, hors décision n°1) :
`test-taxonomie-competences-tier0-1-15.ts`, `test-saisie-signe-negatif.ts`, et tout autre test dont
le nom référence un générateur (gen1/gen6/secondDegre/inequationRationnelle).

## §8 : Phase 1 §G — validation Chromium bout en bout + correctif `catalogue-generateurs-complet.json`

**Méthode** : harnais réel (pas une simple inspection visuelle) — serveur HTTP local exécutant le
VRAI `api/router.ts` compilé avec un faux client Supabase Auth+DB en mémoire injecté via
`require.cache` (même idiome que `scripts/test-routeur.ts`/`test-gestion-classe-etendue.ts`),
piloté par Chromium (`/opt/pw-browsers/chromium`) avec interception du seul CDN bloqué par le bac à
sable (`unpkg.com/@supabase/supabase-js`, remplacé par un stub local fidèle à l'API réelle
`auth.{getSession,setSession,signInWithPassword,...}`) — aucun réseau réel utilisé nulle part.

**8 scénarios requis × 2 largeurs (390px mobile, 1280px desktop) : 16/16 PASS**, plus inscription
prof (préalable) et connexion élève (préalable), soit 18/18 scénarios :
- `prof.html` : inscription (invitation) → tableau de bord ; création de classe (POST
  `/api/classes` → 201, apparaît immédiatement) ; création d'élève (POST `/api/profs/creer-eleve` →
  201, apparaît dans la liste) ; formulaire de composition gen7 "4e:7" — champ "nombre
  d'exercices" de `af_mise_en_evidence` vérifié **non disabled** par lecture de la propriété DOM
  (`disabled: false`), capture desktop montrant le contraste avec un générateur voisin
  (numero 9, absent de `CORRESPONDANCE_JSON_VERS_PILOTE`) resté visiblement grisé ; création réelle
  d'une tâche bout en bout, `POST /api/taches` → 201, composition confirmée par un `GET /api/taches`
  de suivi.
- `eleve.html` : connexion (nom+prénom+mot de passe réels, élève créé quelques instants plus tôt
  côté prof) ; tableau de bord — `GET /api/eleves/tableau-de-bord` renvoie un vrai 404 (route
  absente de `TABLE_ROUTAGE`, différée phase 2), état vide affiché comme prévu, **0 erreur JS**
  (`pageerror`/`console.error` applicatif — la seule entrée console est le diagnostic réseau natif
  de Chromium pour ce même 404 attendu, jamais une exception) — conforme à la décision utilisateur
  du §5 ; onglet Résultats (`GET /api/eleves/mes-resultats` → 200, état vide correct) ; onglet Mon
  compte (avatar, stats 0/0, actions de compte).

**Bug réel trouvé par la validation, corrigé dans ce même travail** (pas seulement documenté) :
`public/catalogue-generateurs-complet.json` était **absent du dépôt** (jamais commité — confirmé
par `git log --all` vide sur ce chemin), alors que `public/prof.html:2102` le récupère sans
condition à chaque chargement de la table de composition (`fetch("/catalogue-generateurs-complet.json")`).
Sans ce fichier, l'arbre de composition entier échoue pour TOUT professeur, pas seulement gen7 —
exactement la même classe de régression silencieuse ("rien ne signale l'oubli, ni erreur ni log")
que celle documentée par `CLAUDE.md` pour `CORRESPONDANCE_JSON_VERS_PILOTE`, mais un niveau
au-dessus (le fichier JSON lui-même, jamais une de ses entrées). Écart introduit en §A/§D (fichier
non listé parmi les fichiers `public/` copiés à l'époque, jamais rattrapé depuis) — la validation
Chromium du harnais avait dû en fournir une copie de secours pour pouvoir tester quoi que ce soit
côté composition, ce qui a signalé l'absence. **Correctif** : fichier copié verbatim depuis l'ancien
pilote (`public/catalogue-generateurs-complet.json`, 123 269 octets, identique — `diff` vide,
`json.load` valide) vers `public/catalogue-generateurs-complet.json` de ce dépôt (décision n°3 :
fichier gardé "whole", jamais élagué).

**Harnais de validation** : conservé hors dépôt, dans un répertoire scratch (`scratchpad-validation/`
du clone de travail) jamais ajouté à git — confirmé non suivi (`git status --short`) et non commité
ici. Les 18 captures d'écran et le journal console complet restent disponibles dans ce répertoire de
travail pour consultation, mais ne font pas partie du livrable versionné.

## §9 : 2 points relevés par l'utilisateur sur les captures du §8 — 1 bug réel corrigé, 1 alerte infirmée

**1. Bug réel confirmé et corrigé** : `public/prof.html`, onglet Classes, état à 0 classe —
`#bandeau-classe-active` (la carte avatar/crayon/code) restait visible en même temps que
`#etat-vide-classes` ("Aucune classe pour l'instant"), alors que `rendreBandeauEtMesClasses()`
(`public/prof.html:2172-2187`) met bien `bandeau.hidden = true` dans ce cas.

Cause réelle (jamais supposée, vérifiée par la lecture du CSS puis confirmée empiriquement) :
`.bandeau-classe-active { display: flex; ... }` (`public/style.css:4263`, spécificité classe seule,
0,1,0) l'emporte sur la règle `[hidden] { display: none }` du navigateur (même spécificité, mais
l'auteur gagne sur l'agent-utilisateur à égalité) — **exactement le même piège de cascade déjà
documenté et déjà corrigé pour l'élément voisin `.bandeau-classe-active-edition[hidden]`**
(`public/style.css:4372-4378`, commentaire de tête : "trouvé par la validation Chromium de la
refonte 'Onglet Classes'"), jamais appliqué à `.bandeau-classe-active` lui-même.

Vérifié empiriquement (Chromium réel, `getComputedStyle`, avant/après) : avant le correctif,
`.bandeau-classe-active[hidden]` calculait `display: flex` (visible malgré `hidden`) ; après,
`display: none`. `#etat-vide-classes` (aucune règle concurrente) était déjà correct dans les deux
cas (`display: block`/`none` selon `hidden`). **Correctif** : ajout de
`.bandeau-classe-active[hidden] { display: none; }` juste après la règle de base
(`public/style.css:4274-4280`), même patron que le correctif voisin déjà en place.

**2. Alerte infirmée après vérification directe** : le formulaire de composition de tâche, recherche
"second degré" — les entrées 9, 55, 57, 60, 1, 2, 61 (chapitre 1/2 de "4e", non câblées dans
`CORRESPONDANCE_JSON_VERS_PILOTE`) semblaient, sur la capture envoyée, tout aussi interactives que
gen7 (numero 7, seul câblé). Vérification en 2 temps, jamais une relecture de code seule :

1. **Logique pure** (`varianteIdActive`, `public/prof.html:1447-1453`) rejouée directement dans Node
   avec les vraies données (`CORRESPONDANCE_JSON_VERS_PILOTE` réelle + `idsConnus` réel dérivé de
   `CATALOGUE_GENERATEURS`, 4 entrées) : `varianteIdActive("4e", 55, 0, idsConnus)` →
   `undefined` (et de même pour 9/57/60/1/2/61) — la fonction identifie déjà correctement ces
   7 entrées comme non câblées.
2. **DOM réel** (Chromium, code de `public/prof.html` extrait tel quel — lignes 1360-1847 +
   `normaliserRecherche` —, exécuté contre le vrai `public/catalogue-generateurs-complet.json` et
   le vrai `public/style.css`, arbre construit par le vrai `construireArbreComposition`) : pour
   chacune des 7 entrées listées par l'utilisateur, le champ "nombre d'exercices" a
   **`input.disabled === true` et `opacity: 0.5`** — rigoureusement identique au traitement déjà
   appliqué à numero 9 (dont le caractère grisé n'était, lui, pas contesté), et strictement
   différent de gen7 (`disabled === false`, `opacity: 1`).

Serveur (`lib/validationCorpsTaches.ts:108-109`, `estVarianteConnue`) rejette de toute façon avec
400 toute composition contenant un `variante_id` hors `CATALOGUE_GENERATEURS` — défense en
profondeur déjà en place indépendamment du client.

**Conclusion** : ces 7 entrées sont déjà correctement désactivées, côté client ET serveur — la
décision actée n°3 du prompt phase 1 est déjà respectée pour elles. Ce qui a induit en erreur (moi
d'abord, la lecture de la capture ensuite) est purement visuel : `opacity: 0.5` sur un champ déjà
minuscule (stepper 24px) est un signal trop faible pour se distinguer d'un champ actif à la taille
d'une capture d'écran compressée — un vrai défaut d'affordance, mais pas le bug fonctionnel
initialement suspecté. Aucun changement de code nécessaire pour la correction fonctionnelle ; une
amélioration de contraste visuel (ex. `opacity` plus faible, `cursor: not-allowed` déjà présent mais
peu visible, ou un badge explicite) resterait une amélioration UX à discuter séparément, pas un
correctif de sécurité/données.

## §10 : Phase 2 — contrat de générateur, moteur générique, design system (témoin technique)

Décisions de l'utilisateur appliquées : modules ES natifs sous `public/moteur/` ; **graine stockée en
base, exercice régénéré à chaque appel** (colonne ajoutée à `schema.sql` ET `cumulatif.sql`, même
commit) ; règle « état local d'édition ≠ réponse » **appliquée, pas seulement convenue** ; risque
« le témoin ne garantit pas la couverture du vrai cas gen7 » et choix de l'étiquette « bientôt
disponible » consignés ci-dessous. Vérification préalable par lecture directe : plusieurs éléments du
prompt ne correspondaient pas au dépôt (voir « Écarts »).

### Schéma Supabase (`CLAUDE.md` — discipline de migration)
- `supabase/schema.sql:167-194` : `exercices_assignes.enonce`/`solution` deviennent nullables (l'exercice
  n'est plus figé) ; `graine bigint` ajoutée (nullable : lignes historiques). `supabase/schema.sql:241` :
  table `aides_utilisees`. Commentaire legacy gen1/gen6 de `reponses.champ` remplacé (`schema.sql:200`).
- **Équivalent idempotent dans `supabase/migrations/cumulatif.sql:150-162`, même commit** :
  `alter table exercices_assignes add column if not exists graine bigint;`,
  `alter … alter column enonce drop not null;`, `alter … alter column solution drop not null;`,
  `create table if not exists aides_utilisees (…)`. **À exécuter sur la vraie base avant de déployer** :
  sans `graine`, `POST /api/assignations` échoue.

### A. Contrat — `lib/contratGenerateur.ts`, `lib/prng.ts`, `lib/reponsesEcran.ts`
- `Generateur<TExercice>` : `lib/contratGenerateur.ts:109` ; types d'écran `:43-81` ; `ResultatVerification`
  (union, `parse_error` porte obligatoirement `messageErreur`) `:99` ; `etatActuelSequentiel` `:140`.
- PRNG mulberry32 seedé `lib/prng.ts:32` (`creerPrng`), graine 32 bits `:12-19`. Aucun `Math.random()` dans
  un générateur (seul `tirerGraine`, serveur, à l'assignation).
- **Règle « état local d'édition ≠ réponse »** : documentée en tête de `lib/contratGenerateur.ts`, imposée par
  `lib/routes/reponses.ts:22,34` (`CLES_AUTORISEES` : toute autre clé → 400), par les signatures
  (`verifier` reçoit une chaîne, `etatActuel` des `ReponseConfirmee`), et côté client par la conception des
  composants (`lireReponse()` n'est appelé qu'au clic « Valider », `public/moteur/moteur.js`). Vérifiée
  en test (`brouillon`, `etat_edition` → 400) et en Chromium (0 requête `/api/reponses` pendant frappe, ajout/
  retrait de lignes, cases de tableau, choix de QCM).
- Contrôle croisé des codes : au chargement du registre (`lib/registreGenerateurs.ts:35`) ET à chaque vérification
  (`verifierAvecControle`, `:81`, lève si un code n'est pas déclaré ou si `parse_error` n'a pas de message).
- **Écarts avec la proposition du prompt** : (1) champ `curriculaire: boolean` ajouté (le témoin n'a pas de
  codes dans `dictionnaireCompetences.ts`, mais un générateur curriculaire doit en avoir — contrôle conditionné
  par ce champ) ; (2) `EtatActuel = { champCourant: string | null }` seulement (la fin d'exercice est dérivée
  des `champs_attendus`) ; (3) `ReponseConfirmee` = dernière soumission d'un champ TERMINÉ (réussi ou révélé),
  jamais une tentative intermédiaire ; (4) `EcranDeclare.aide` n'est jamais envoyé avec l'écran (voir D).

### B. Types d'écran — `public/moteur/ecrans/`
`champExpression.js`, `qcm.js`, `listeValeurs.js`, `tableauSignes.js`, table de répartition
`public/moteur/ecrans/index.js:20` ; `rendreTexte.js` = point unique de rendu de texte (texte brut en phase 2,
**KaTeX à brancher là en phase 3** : non couvert ici). Format de `reponse_brute` par type : en-tête de
`lib/contratGenerateur.ts` ; décodeurs `lib/reponsesEcran.ts:9,26`. Ajouter un type d'écran ne touche ni le contrat
`Generateur`, ni le moteur, ni les routes.

### C. Moteur client — `public/moteur/moteur.js`, `public/moteur/api.js`
`ouvrirExercice` `moteur.js:41`, `demarrerTache` `:262` : répartition par table sur le type d'écran (jamais une
branche par générateur), séquençage, `POST /api/reponses`, affichage du verdict serveur, tentatives restantes,
indice, compte à rebours (affichage seul : à zéro l'état est relu au serveur). Câblage `public/eleve.html:489-527`
(`importerMoteur`, `demarrerFluxPasAPas`, `ouvrirExercice`, import dynamique) ; le traitement du 404 du tableau de
bord est retiré (la route existe). **Conteneur `#conteneur-moteur` (`eleve.html:312`), pas `#exercice`** : `style.css`
garde des règles héritées de l'ancien écran sous `#exercice` (`#exercice button { width: 100% }` en mobile,
`style.css:3756`) — trouvé en Chromium (titre de tâche écrasé en colonne d'une lettre de large à 390px).

### D. Dispatcher serveur — registre unique
- `lib/registreGenerateurs.ts:17` (`REGISTRE_GENERATEURS`), `:72` (`chercherGenerateur`). Cohérence contrôlée au
  chargement, échec bruyant (test : doublon, curriculaire absent du catalogue, `generateur_id` divergent, code hors
  dictionnaire, témoin présent dans le catalogue → tous détectés). `variantesCatalogueSansGenerateur()` (`:62`)
  liste les 4 variantes gen7 cataloguées sans générateur : **toléré en phase 2, à faire tomber à 0 en phase 3**.
- **Fichiers « réécrits » : en réalité créés** (absents depuis la phase 1) : `lib/routes/assignations.ts:66`,
  `lib/routes/reponses.ts:44`, `lib/routes/eleves/tableau-de-bord.ts:28` ; plus `lib/routes/reponses-aide.ts:12` (non
  demandé, voir ci-dessous) et `lib/routes/exercices/[id].ts:18` réécrite (régénération). Routés `api/router.ts:63,119,224,238`.
  Il n'y avait aucun ensemble `VARIANTES_*_SET` à supprimer (jamais portés) : le principe est inscrit dans `CLAUDE.md`.
- État partagé (une seule dérivation pour GET exercice, POST réponse, tableau de bord) : `lib/etatExercice.ts:182`
  (`calculerEtatExercice`), réutilise `moteurTentatives.ts`, `construireChampVue`, `resoudreChronoDureeSecondes`.
- Assignation : générateurs résolus par le **registre**, jamais par le catalogue ; échec 409 **avant toute écriture**
  si une variante n'a pas de générateur ; exercices écrits avant la ligne d'assignation ; idempotente par (tâche, élève).
  **Conséquence à connaître** : un professeur peut composer une tâche gen7 (validé au §8) mais ne peut plus l'assigner
  tant que gen7 n'existe pas (409 « Générateur pas encore disponible »).
- **Aide côté serveur (ajout non demandé, assumé)** : `POST /api/reponses/aide` sert le texte et enregistre l'usage
  (`aides_utilisees`) ; `reponses.indice_utilise` est dérivé de cette table. Sans cela, le texte d'aide voyagerait avec
  l'écran et la pénalité dépendrait d'un booléen déclaré par le client — même faille que celle corrigée pour le chrono.
- `verrouille` (nouvelle notion, `lib/etatExercice.ts:161-182`) : un champ est verrouillé côté client s'il est terminé
  OU si `feedback_immediat` est faux et qu'une réponse existe (sinon la 2e tentative révélerait que la 1re était fausse).
  Le score reste dérivé du seul moteur de tentatives. **HYPOTHÈSE à arbitrer** : combiner `feedback_immediat=false` et
  `tentatives_supplementaires>0` reste possible côté professeur, sans effet côté élève.

### Correctifs de code existant trouvés en chemin (tous testés)
- `lib/tableauDeBord.ts:150-161` (`construireChampVue`) : un champ révélé **sans réponse** (chrono écoulé avant toute
  soumission) n'exposait ni `revele` ni solution → élève bloqué sur un écran fermé sans correction.
- `lib/etatExercice.ts:146` : `calculerEtatChampTentatives(…, chronoExpire=true)` court-circuite l'historique ; appliqué
  à un champ déjà réussi il transformait une bonne réponse en révélation. Le chrono n'est appliqué qu'à un champ non terminé
  (test : champ réussi reste réussi après expiration).
- `lib/verrouillageTache.ts:19-31` : `categorieTachePourEleve` ignorait `taches_assignations_eleves` (assignation par élève).
- **Non corrigé, à signaler** : `lib/routes/eleves/mes-resultats.ts` considère toujours un champ « terminé » dès qu'il a une
  ligne `reponses` (l'ancien critère, remplacé ailleurs par l'état du moteur de tentatives) — incohérent avec le tableau de
  bord dès que `tentatives_supplementaires > 0`.

### E. Design system
`public/style.css:35-83` : les 31 tokens regroupés par famille (marque, statut, accents, neutres, rayons, typographie,
espacement), **aucune valeur ajoutée ni modifiée**. `docs/design-system.md` (tableaux nom/valeur/rôle, règle d'usage,
manques connus : pas de token de taille de police ni d'épaisseur). `public/moteur/ecrans.css` : uniquement des `var(--token)`.
`scripts/test-design-system.ts` (244 vérifications) : `:root` == documentation (31/31, valeurs identiques), et `ecrans.css` sans
couleur/police/rayon/longueur en dur (exceptions : 0, auto, 1px, 2px, em).
**Correctif d'ergonomie (catalogue grisé)** : étiquette « bientôt disponible » **permanente** (choix validé, plutôt qu'un
changement d'opacité : le grisé ne se voyait pas sur capture, `cursor: not-allowed` n'existe qu'au survol donc jamais sur
mobile) — `public/prof.html:1516-1528`, `public/style.css:1317` (`.etiquette-bientot-disponible`), `flex-wrap` du stepper pour
que l'étiquette passe à la ligne plutôt que de déborder à 390px. Verrou fonctionnel inchangé (`disabled`, pas de
`data-variante-id`). Chromium : 4 variantes gen7 actives sans étiquette ; chaque entrée non câblée en porte une.
**Compromis** : ~1 200 entrées du catalogue portent maintenant l'étiquette — plus lisible mais plus dense.

### F. Témoin technique — `src/generateurs/_temoinTechnique/index.ts:183` (`_temoin_technique_v1`)
Un écran par type : somme (`champ_expression`, évaluateur arithmétique sans `eval`, `parse_error` pédagogique), parité (`qcm`),
diviseurs (`liste_valeurs`, comparaison en ensemble), signes de (x−r₁)(x−r₂) (`tableau_signes`). Deux codes de compétence
déclarés, déclenchés par des erreurs typiques. Absent de `CATALOGUE_GENERATEURS` (contrôlé au chargement), de
`catalogue-generateurs-complet.json`, de `GET /api/catalogue-generateurs` et de la page professeur, et **refusé** par
`POST /api/taches` (400) — tous testés (serveur et Chromium).
**RISQUE CONNU (consigné, accepté)** : le témoin valide le contrat, le moteur et les 4 types d'écran, **pas leur adéquation au vrai
gen7** — rien ne garantit que ce tableau de signes couvre les besoins réels (intervalles ouverts/fermés, valeurs interdites, ligne
« résultat »…), ni que le rendu texte suffira (KaTeX). Ces écarts ne se verront qu'en phase 3.

### Validation
- `tsc -b` propre ; les 16 scripts existants passent (aucune régression) ; nouveaux : `scripts/test-temoin-technique.ts` (115
  vérifications : reproductibilité par graine, 4 types × correct/not_equivalent/parse_error, registre, assignation, réponses, aide,
  chrono, réglages de correction, fenêtres de dates, tableau de bord), `scripts/test-design-system.ts` (244),
  `scripts/chromium-temoin-technique.ts` (80, outil manuel, `playwright` requis) — 390px et 1280px, **0 erreur console/JS**,
  zones tactiles ≥ 44px, pas de défilement horizontal de la page. Support : `scripts/support/fauxSupabase.ts` (base en mémoire),
  `scripts/support/harnaisRouteur.ts`.
- **Défauts trouvés par inspection visuelle des captures, corrigés** (les vérifications chiffrées ne les voyaient pas) : titre
  écrasé à 390px (cascade `#exercice`), libellés de ligne du tableau de signes hors écran au défilement horizontal (colonne
  collante ajoutée), radio de QCM désaligné, `champ_expression` sans écouteur `input` (bouton « Valider » jamais activé —
  trouvé par le premier passage Chromium).
- Non couvert : aucun test sur la vraie base Supabase (donc `cumulatif.sql` non exécuté ici), aucun vrai navigateur mobile
  (émulation Chromium seulement), pas de test de charge sur le tableau de bord (N requêtes par tâche/variante pour les contextes).

## §11 : Suites de revue de la phase 2 — `feedback_immediat=false` × tentatives, `mes-resultats.ts`, `playwright`

### 1. `feedback_immediat=false` + `tentatives_supplementaires>0` : enquête dans l'ancien pilote (lecture seule, HEAD `6acc102`) — AUCUNE décision prise
**Constat : la combinaison est atteignable par un professeur mais jamais traitée comme un cas** — ni verrouillée dans l'interface, ni testée sur le score, et l'ancien pilote a la même incohérence latente que celle que j'avais signalée :
- **Formulaire prof** — `plateforme-maths-pilote/public/prof.html:2546-2551` (`appliquerVerrouReglages`) verrouille `reponse_visible` quand « correction immédiate » est décochée (et la pénalité d'aide quand l'aide est décochée), mais **pas** `tentatives-supplementaires` (`prof.html:596`). Rien n'empêche donc un professeur de régler 5 essais sans feedback.
- **Serveur** — `lib/validationCorpsTaches.ts:58` ne valide que le type booléen ; `lib/routes/reponses.ts` compte les tentatives quel que soit le feedback (seul l'affichage est masqué, `:3410-3434`).
- **Client élève** — `public/eleve.html:13528` : `if (!feedbackImmediat || correct || reponse.revele)` verrouille le champ et propose « Question suivante » **après n'importe quelle réponse** dès que le feedback est coupé. Côté élève le comportement effectif est donc « un seul essai » — exactement mon `verrouille` (`lib/etatExercice.ts`). Le commentaire `eleve.html:11268-11277` reconnaît que, sans feedback, « le client ne sait jamais si sa réponse était correcte ».
- **Serveur, conséquence non traitée** — `lib/routes/eleves/tableau-de-bord.ts:783` ne compte un champ comme terminé que si `etat.terminee` : avec feedback coupé et 1 essai raté sur 2, le serveur laisse le champ ouvert alors que le client l'a verrouillé → tâche jamais « complète » côté serveur.
- **Tests** — un seul test passe cette combinaison, `scripts/test-messages-erreur-parsing.ts:118` (`tentatives_supplementaires: 5`) puis `:169-175` (« Cas D »), et il ne vérifie que le corps HTTP vide, jamais le score ni la complétion. Aucun écran d'utilisation réel n'est documenté (`RAPPORT.md` de l'ancien pilote : mentions du seul comportement d'affichage).
**Ce que fait le nouveau dépôt aujourd'hui** : reproduit le client de l'ancien pilote (`verrouille`), mais **tranche la complétion du tableau de bord côté client** (le champ compte comme terminé) là où l'ancien pilote laissait la tâche bloquée ; `mes-resultats` (point 2) suit le moteur strict. Divergence résiduelle assumée en attendant votre arbitrage : sous cette combinaison, le tableau de bord voit la tâche « effectuée » et `mes-resultats` non.
**Options à arbitrer (non implémentées)** : (A) verrouiller `tentatives_supplementaires` (ou le remettre à 0) dans le formulaire prof quand le feedback est coupé, comme pour `reponse_visible` — le plus cohérent avec l'existant ; (B) côté serveur, `tentativesMax=1` quand `feedback_immediat=false` (une seule source de vérité, protège aussi contre une tâche créée hors interface) ; (C) statu quo documenté. A+B ensemble sont compatibles.

### 2. `mes-resultats.ts` — complétion par le moteur de tentatives (corrigé)
- **Bug** : un champ comptait comme « terminé » dès qu'il avait une ligne `reponses` (`lib/routes/eleves/mes-resultats.ts`, ancien critère `derniereStatutParCle.has`). Avec des tentatives supplémentaires, une 1re réponse ratée faisait donc noter une tâche dont un champ restait ouvert.
- **Correctif** : la complétion utilise `etatTentativesAvecChrono` (`lib/etatExercice.ts:144`, extrait de `calculerEtatChamp` : **une seule** dérivation de « un champ est terminé » pour GET exercice, POST réponse, tableau de bord et mes-résultats) ; `mes-resultats.ts:207-228`. Sont maintenant pris en compte : essais épuisés (révélé) et **chrono écoulé sans réponse** (champ compté raté au score, `total++` sans réponse, au lieu d'être ignoré du total).
- **Même correction que `categorieTachePourEleve`** : les assignations **par élève** (`taches_assignations_eleves`) sont lues pour les dates de début/échéance (auparavant ignorées : une tâche individuelle pas commencée pouvait être notée).
- **Test** : `scripts/test-mes-resultats.ts` réécrit sur la base en mémoire à filtres réels (l'ancien faux ignorait `.eq`/`.in`, donc incapable de tester ce cas) ; les 4 vérifications d'origine conservées, plus : 1 échec sur 2 essais → tâche non notée ; 2 échecs → notée 0/1 ; 0 tentative supplémentaire → 1 réponse suffit ; chrono écoulé → 1/2 ; assignation individuelle échue/future. **Vérifié : 3 de ces cas échouent sur l'ancien code** (`git stash` du seul `mes-resultats.ts`), 15/15 passent avec le correctif.
- Limite connue : la règle `verrouille` (feedback coupé) n'est pas comptée ici — point 1.

### 3. `playwright` en devDependency
`package.json` : `"playwright": "1.56.1"` (version **épinglée** : elle détermine la révision de Chromium attendue), `package-lock.json` mis à jour. Le paquet ne télécharge pas de navigateur ici (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) ; en dehors de ce bac à sable, il faut `npx playwright install chromium`. `scripts/chromium-temoin-technique.ts` importe désormais le paquet local (plus de repli sur un chemin global) ; **80/80 vérifications rejouées** avec lui après ces changements. Lancement : `npm run chromium-temoin`.
