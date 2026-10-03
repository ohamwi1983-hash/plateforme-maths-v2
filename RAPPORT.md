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

## §12 : Options A + B implémentées (`feedback_immediat=false` × tentatives) — remplace la « divergence résiduelle » du §11

Décision de l'utilisateur : A **et** B, ensemble.

- **A — formulaire prof** : `public/prof.html` (`appliquerVerrouReglages`, bloc « Sans correction immédiate… ») verrouille (`disabled`) l'`<input id="tentatives-supplementaires">` **et** ses deux boutons −/+ (`data-stepper-cible`) et remet la valeur à 0, même patron que `reponse-visible`. Libellé : « Tentatives supplémentaires (si correction immédiate) ». Grisage explicite `public/style.css` (`.ligne-reglage .stepper-bouton:disabled`, `.ligne-reglage input.stepper-valeur:disabled`). Le rechargement d'une tâche existante (modifier/dupliquer) passe déjà par `appliquerVerrouReglages` : une ancienne tâche « feedback coupé + N essais » s'affiche donc à 0.
- **B — serveur, source unique** : `lib/moteurTentatives.ts` `tentativesMaxEffectif(feedbackImmediat, tentativesSupplementaires)` (`feedback_immediat=false` ⇒ 1 essai quelle que soit la valeur stockée). Seuls deux endroits dérivent `tentativesMax` d'une ligne `taches` et passent désormais par elle : `lib/etatExercice.ts` (`chargerContexteTache`) et `lib/verrouillageTache.ts`. Protège les tâches créées avant le verrou ou hors interface.
- **Simplification** : le cas particulier `verrouille = terminée OU (feedback coupé ET réponse existante)` de `calculerEtatExercice` (§10) est **supprimé** — avec 1 essai la première réponse termine le champ par le moteur seul. Conséquence : tableau de bord, `mes-resultats`, `categorieTachePourEleve` et le client voient désormais **exactement** le même état ; la divergence signalée au §11 n'existe plus, et la « Limite connue » de `mes-resultats.ts` est retirée.

**⚠ Constat nouveau à connaître (hérité de l'ancien pilote, non modifié)** : à l'épuisement des essais la révélation est **forcée** quels que soient `feedback_immediat`/`reponse_visible` (`lib/tableauDeBord.ts` `construireChampVue`, identique à `plateforme-maths-pilote/lib/routes/reponses.ts:3388-3410`, justification : sinon l'élève reste bloqué sur un champ fermé). Avec 1 essai, **sous « correction immédiate » décochée, une mauvaise réponse révèle donc statut ET solution, tandis qu'une bonne réponse ne révèle rien**. Ce n'était pas nouveau pour le réglage par défaut (0 tentative supplémentaire), mais B l'étend à toute tâche sans feedback. Effet : « correction immédiate = non » ne cache rien sur un échec, et l'absence de révélation trahit la bonne réponse. **Non modifié** (décision de conception, pas de la mienne) ; à arbitrer : soit assumer (« sans correction immédiate » = « je ne vois que le verrouillage tant que c'est juste »), soit ne forcer la révélation sous feedback coupé qu'au relevé de fin de tâche. J'avais un test qui supposait l'inverse ; il est corrigé (`scripts/test-temoin-technique.ts`) et documente désormais ce comportement.

**Tests ajoutés** : `scripts/test-temoin-technique.ts` (121 vérifications) — `tentatives_max` effectif = 1 sous feedback coupé même avec 2 essais stockés, réponse fausse ⇒ révélation forcée, réponse juste ⇒ ni statut ni solution, tâche répondue une fois par champ ⇒ « effectuée » au tableau de bord ET notée par `mes-resultats` (même verdict), `tentativesMaxEffectif` unitaire ; `scripts/test-mes-resultats.ts` (16) — feedback coupé + 3 essais stockés : 1 réponse suffit ; `scripts/chromium-temoin-technique.ts` (88) — stepper actif par défaut et fonctionnel, sans correction immédiate : champ + 2 boutons désactivés et valeur remise à 0 (même après avoir réglé 2), recocher déverrouille, aucune régression sur les 80 vérifications précédentes.

**Régression complète après ce changement** : `tsc -b` propre ; les 18 scripts de test passent (dont `smoke-test`, `test-routeur`, `test-design-system` 244) ; Chromium 88/88 à 390 px et 1280 px, 0 erreur console/JS.

**Toujours en attente avant fusion** : exécution de `supabase/migrations/cumulatif.sql` sur la vraie base (`graine`, `enonce`/`solution` nullables, `aides_utilisees`) — à confirmer par l'utilisateur.

## §13 : Sous correction immédiate coupée, révélation à la fin de la TÂCHE entière — remplace le « constat » du §12

Décision de l'utilisateur : la révélation, correction immédiate coupée, ne se déclenche qu'à la fin de la tâche entière, jamais à l'épuisement d'un champ ; un échec ne doit pas être plus visible qu'une réussite pour ce réglage.

**Règle implémentée** (correction immédiate active : inchangée, y compris la révélation forcée à l'épuisement des essais) :
- Sous correction immédiate coupée, tant que la tâche n'est pas terminée (tous ses exercices, pour l'élève) ni échue : **ni verdict, ni solution, ni message de syntaxe, ni `revele`** ne sont exposés, pour une réponse fausse comme pour une réponse juste. Réponse fausse et réponse juste ont **exactement** la même apparence (`verrouille: true`, `tentatives_restantes: 0`, « Réponse enregistrée. »).
- Dès que la tâche est terminée (ou échue), **tout est révélé d'un coup** (verdicts + solutions de tous les exercices) ; la réponse qui termine la tâche révèle son propre champ (`tache_terminee: true`).

**Où** :
- `lib/tableauDeBord.ts:156` (`construireChampVue`) : `revele = revelee && (feedback_immediat || révélation forcée)` ; plus aucune révélation forcée à l'épuisement si le feedback est coupé.
- `lib/etatExercice.ts:211,220` : `revelationFinDeTache` (règle, source unique) et `tacheEstCompletePourEleve` (complétion d'une tâche pour un élève, même critère que le tableau de bord).
- `lib/routes/reponses.ts:134-135` (réponse `POST`, champ `tache_terminee`), `lib/routes/exercices/[id].ts:61-65` (consultation), `lib/routes/eleves/tableau-de-bord.ts:127-139`.
- **Fuites indirectes fermées** (même principe : un échec caché ne doit pas se voir par un autre canal) : la **série** du tableau de bord ignore les réponses d'une tâche masquée (`tableau-de-bord.ts:98,128,154` — sinon un échec caché faisait retomber la série à 0) ; `mes-resultats` exclut les bugs détectés d'une tâche masquée de « compétences à travailler », de l'évolution et des segments (`mes-resultats.ts:191,230,260` — sinon un échec caché apparaissait comme compétence non maîtrisée). L'historique de scores ne porte déjà que sur les tâches terminées.

**Tests** : `scripts/smoke-test.ts` (l'assertion qui figeait l'ancienne règle est remplacée : épuisement sous feedback actif → révélé ; sous feedback coupé → rien, fausse = juste, fin de tâche → tout) ; `scripts/test-temoin-technique.ts` (137 vérifications, dont un scénario 2 exercices : 2 fausses + 2 justes indiscernables, GET exercice / tableau de bord / mes-résultats / série muets en cours de tâche, tout révélé après la dernière réponse, score 6/8 et compétence visibles seulement à ce moment) — **7 de ces vérifications échouent sans le correctif** (vérifié par `git stash`) ; `scripts/chromium-temoin-technique.ts` (104) : nouveau scénario « sans correction immédiate » à 390 px et 1280 px (retours identiques après réponse fausse/juste, aucun verdict ni solution avant la fin, 2 échecs + 2 réussites + 4 solutions révélés à la fin, 0 erreur console).

**Régression complète** : `tsc -b` propre ; 18 scripts de test passent ; Chromium 104/104.

**Deux choix de détail à connaître** : (1) la réponse qui termine la tâche révèle immédiatement son propre champ (le reste se consulte ensuite) ; (2) un champ sans réponse verrouillé par le chrono, sous feedback coupé, ne révèle rien avant la fin de la tâche — comme les autres.

**Toujours en attente avant fusion** : confirmation que `supabase/migrations/cumulatif.sql` a été exécuté avec succès sur la vraie base.

## §14 : Finalisation visuelle des composants d'écran (post phase 2)

Prérequis relu avant modification : `public/moteur/ecrans.css` (323 lignes, phase 2) et le témoin technique (`src/generateurs/_temoinTechnique/index.ts`) ; contrat et moteur (`public/moteur/moteur.js`) **non modifiés**. Décisions de l'utilisateur appliquées : ombre par nouveau token, padding par tokens, verdicts sur la carte entière par `:has()`, tableau de signes coloré en entier, texte des messages en `--text`, deux `parse_error` fabriqués par appel direct à l'API, 4 précisions par défaut.

### Token `--ombre-carte` (32e token)
- `public/style.css:78` : `--ombre-carte: 0 10px 24px -18px rgba(59,20,112,.3)` — **nomme la valeur historique**, sans la modifier. Elle était répétée à l'identique dans cinq règles ; toutes utilisent désormais `var(--ombre-carte)` (`style.css:181,273,864,4118,4312` ; vérifié en Chromium : la valeur calculée reste `rgba(59, 20, 112, 0.3) 0px 10px 24px -18px`, inchangée). Compte de `:root` : 31 → 32.
- `docs/design-system.md` (nouvelle famille « Ombre », section « États d'un composant d'écran », mention des alias locaux) ; `CLAUDE.md` (32 tokens, règle « ombre de carte : `var(--ombre-carte)`, jamais recopiée ») ; `scripts/test-design-system.ts` : compte attendu 32, et nouveaux contrôles — alias locaux `--etat-*` autorisés **seulement** s'ils valent `var(--token)` existant, `box-shadow` limité à `none` / `var(--ombre-carte)` / anneau intérieur `inset 0 0 0 1px var(--…)`, carte d'écran obligatoirement sur `var(--ombre-carte)` (326 vérifications, vert).
- Point d'attention : « aucun token modifié » (prompt) reste vrai — un token est **ajouté**, aucun des 31 existants n'est touché.

### Composants — `public/moteur/ecrans.css` (réécrit)
- **Carte d'écran commune** `ecrans.css:53` : `--surface`, `1px --border`, `--radius`, `--ombre-carte`, padding `--espace-4` ; consigne 600 / `--text`. Écran courant = carte blanche ombrée ; écrans terminés = carte en creux sans ombre (`:71`) — **remplace la bordure violette de 2 px** de l'écran courant, pour réserver le violet à l'état « sélectionné ».
- **Champ** `:166` : `--surface-sunken`, `1px --border`, `--radius-sm`, padding `var(--espace-2) var(--espace-3)` (tokens, 8/16 au lieu des 10/12 de la maquette — décision utilisateur), anneau de focus 2 px `--violet-vif`.
- **QCM** `:194-231` : options en blocs pleine largeur ; sélectionné = bordure 2 px `--violet-vif` (filet de 1 px + anneau intérieur de 1 px : **aucun décalage de mise en page**), fond `--violet-clair`, texte `--violet`, gras ; bouton radio natif conservé (accessibilité clavier). `margin: 0` : la règle globale `label { margin-bottom }` créait de grands vides entre options (trouvé en Chromium).
- **Liste** `:257` : icône de suppression `--text-muted`, `--text` au survol, zone tactile 44 px conservée ; bouton d'ajout = secondaire du site (`:133`, fond transparent, texte et bordure `--violet-vif`), qui s'applique aussi à « Retour » et « Besoin d'un indice ? ».
- **Tableau de signes** `:319-360` : même traitement que le QCM ; libellés de ligne collés à gauche avec `z-index: 1` (`:313`) — **sans lui les cases qui défilent passaient par-dessus le libellé** (trouvé en Chromium).

### États post-validation (sur la carte entière, CSS seul — moteur non touché)
- `ecrans.css:85,94,103` : `:has(.moteur-statut-correct | -not_equivalent | -parse_error)` → bordure et fond `--vert`/`--vert-clair`, `--danger`/`--danger-clair`, `--ambre`/`--ambre-clair`. Ces classes n'existent que si le serveur a répondu (et, sans correction immédiate, seulement à la fin de la tâche — §13) : **aucun verdict ne peut apparaître depuis l'état local d'édition**.
- Alias locaux `--etat-bordure/-fond/-texte/-filet` (définis par tokens) : le champ verrouillé, l'option de QCM sélectionnée et **toutes** les cases du tableau prennent la couleur du verdict (`:181,226,346`) ; le tableau est de plus encadré en entier (`:353`). Le serveur ne rend qu'un verdict par champ : **jamais case par case**.
- **Précision d'interprétation (à confirmer)** : la sélection ne « devient » couleur de verdict qu'une fois le champ **verrouillé** (composant désactivé). Tant que des essais restent, une **nouvelle** sélection reste violette et la carte garde le verdict précédent — sinon une réponse pas encore validée apparaîtrait rouge, contraire au principe « jamais de rouge avant la réponse du serveur ». Vérifié : `scenarioRetentative` (carte rouge, nouvelle option violette).
- `button:disabled` (`style.css`) impose `opacity: 0.55` : il délavait les cases verrouillées (`ecrans.css:340`, `opacity: 1`).

### Écarts assumés par rapport au prompt (contraste, calculé)
1. **Texte du message `correct`** : `--vert` sur `--vert-clair` = **3,68:1** (< 4,5:1, seuil WCAG AA) → texte en `var(--text)` ; bordure et fond gardent `--vert`/`--vert-clair`. Même choix pour la mention « Exercice terminé » (`:404`, même paire).
2. **Texte du message `parse_error`** : `--ambre` sur `--ambre-clair` = **2,40:1** → texte en `var(--text)` ; bordure et fond gardent l'ambre. `--danger` sur blanc (≈ 6,5:1) est conservé pour le libellé de `not_equivalent`.
Aucune couleur du système n'a été modifiée : seul l'usage de `--vert`/`--ambre` comme couleur de texte est écarté.

### Validation
- `tsc -b` propre ; 18 scripts de test passent, dont `scripts/test-design-system.ts` (326).
- **Chromium — matrice des 4 composants × états × 2 largeurs** (`scripts/chromium-temoin-technique.ts:315` `reponseApi`, `:348` `matriceVisuelle`, `:432` `scenarioRetentative`) : défaut, sélectionné, `correct`, `not_equivalent`, `parse_error` — **42 captures** (390 px et 1280 px). Le `parse_error` du QCM (choix inconnu) et du tableau (incomplet, bloqué côté client) est produit par **appel direct à l'API**, l'écran verrouillé étant relu par le moteur (le résumé n'affiche pas le message pédagogique : celui-ci n'est visible qu'en direct, ce qui est le cas du champ et de la liste). Assertions sur styles calculés : couleurs exactes du verdict sur la carte, jamais de vert/rouge/ambre avant la réponse, option sélectionnée violet-vif/violet-clair/600, cases du tableau toutes identiques (avant validation : violet ; après : couleur du verdict), même ombre / rayon / filet / fond que `.carte-tache` du tableau de bord (`.item-liste`), ombre résolue inchangée. **216 vérifications, 0 erreur console/JS.**
- Cohérence visuelle avec les cartes de `prof.html`/`eleve.html` confirmée par ces égalités de styles calculés et par relecture des captures.
- **Défauts trouvés à l'inspection des captures, corrigés** : vides entre options de QCM (marge globale de `label`), cases passant par-dessus les libellés collés, couleur des cases verrouillées délavée (`opacity` global des boutons désactivés).

**Non couvert** : rendu sur vrai navigateur mobile (émulation Chromium seulement) ; pas de mode sombre (aucun token dédié).

## §15 : Phase 3b-1 — contrat étendu, composants, balisage mathématique, aide typée (aucun gen7)

Prérequis relus avant de coder (`origin/main` = `d045956`) : `lib/contratGenerateur.ts`, `lib/reponsesEcran.ts`, `public/moteur/{moteur.js,rendreTexte.js,ecrans/*.js,ecrans.css}`, `lib/routes/{reponses-aide.ts,exercices/[id].ts}`, `scripts/{test-temoin-technique,chromium-temoin-technique,test-design-system}.ts`, `docs/design-system.md`. Aucun changement de schéma : `supabase/schema.sql` et `supabase/migrations/cumulatif.sql` ne sont **pas** touchés ; aucun générateur curriculaire n'est ajouté, donc `CORRESPONDANCE_JSON_VERS_PILOTE` et le catalogue ne sont pas touchés non plus (les 4 `af_*` restent catalogués sans générateur : `variantesCatalogueSansGenerateur().length === 4`, inchangé).

### A. Balisage mathématique et point unique d'écriture du texte
- Grammaire `$…$` : `public/moteur/texteMath.js:24` (`decouperTexteMath`), `:84` (`versTexteBrut`) ; invalide (non fermé, `$$`, vide) → texte brut intégral ; jamais d'exception.
- `public/moteur/rendreTexte.js:30` `rendreTexte(el, texte, { math })` (sans option : comportement inchangé) ; `:20` `rendreMath` (repli lisible : **la seule fonction que la 3c remplacera**).
- **Liste des commandes interdites : un seul endroit réel** — `lib/balisageMath.ts:14` (`COMMANDES_MATH_INTERDITES`), détecteur `:31`. Vérifié par `grep` : `public/moteur/` n'en contient aucune copie ; `scripts/test-texte-math.ts` le contrôle en permanence. (Les tests portent un oracle indépendant des noms attendus : c'est une attente de test, pas une seconde liste de production.)
- Enveloppe **typée pour les tests seuls** `scripts/support/texteMath.ts` (`require` du module client + `verifierBalisageMath`) : la production n'importe jamais depuis `public/`.
- **Contournements corrigés** (constat du prompt, revérifié sur `origin/main`) : `qcm.js:21`, `tableauSignes.js:25,37` (libellés de colonne et de ligne) et `listeValeurs.js:18` écrivaient un texte de générateur par `textContent` ; la consigne passait en texte brut (`moteur.js`, `creer`). Désormais routés par `rendreTexte` : `qcm.js:26`, `tableauSignes.js:104` (et colonnes, sous-libellés, bornes), `listeValeurs.js:35`. Tout texte d'auteur passe désormais par `rendreTexte(…, { math: true })` : consigne, libellés, étiquettes, aide en chaîne, `Réponse attendue`, `message_erreur`. `placeholder` : `versTexteBrut` (`champExpression.js`, `champsMultiples.js`).
- `resumer` peut renvoyer des **pièces** `{ texte, auteur? }[]` (`moteur.js:35` `rendrePieces`, `ecrans/index.js`) : le libellé d'un QCM est un texte d'auteur, un texte tapé jamais.

### B. Types d'écran et extensions (contrat : `lib/contratGenerateur.ts`)
- `champs_multiples` (`:170`) + composant `public/moteur/ecrans/champsMultiples.js` ; `intervalle` (`:176`) + `intervalle.js` ; `liste_valeurs.permetAucune` (`:101`, composant `listeValeurs.js`) ; `tableau_signes` étendu (`:125` : alphabet par ligne, `rendu: "symboles_variation"`, `sousLibelle`, `bornes`, `tableauSignes.js`). Un écran qui ne déclare pas les extensions est rendu comme avant (les 137 assertions du témoin d'origine sont **inchangées** et vertes).
- Décodeurs (`lib/reponsesEcran.ts`) : `decoderListeValeursOuAucune` `:53`, `decoderChampsMultiples` `:76` (valide contre **la déclaration de l'écran** ; champ vide → refus nommant le champ, **jamais lu comme 0**), `decoderIntervalle` `:115` (syntaxe seulement), `lireNombreOuFraction` `:146` (**le** lecteur de nombre : `""`, espaces, `abc`, `1/0`, `1e3`, `0x10` → `null`). `decoderListeValeurs` reste inchangé (rejette toujours `[]`).
- **D16 (a) appliquée** : aucun blocage de « Valider » sur la lisibilité syntaxique, seulement la complétude. **Coût assumé** : sous `feedback_immediat = false`, une saisie illisible consomme l'essai unique sans message (`lib/routes/reponses.ts:139`, `lib/moteurTentatives.ts:115`) ; déjà vrai pour `champ_expression`.
- Aperçu de l'intervalle en **texte brut** (symboles fixes + texte de l'élève) : ce qu'un élève tape n'est jamais interprété (test Chromium).

### C. Aide typée — exactement 2 formes (`lib/aideTypee.ts`)
- `formule_coloree` et `croquis_parabole` ; `validerAide` `:53` (clés inconnues, type inconnu, `a ≠ 0`, entiers bornés, segments non vides et bornés, aucun `$`, aucune commande interdite, rôle ∈ {a, b, c}) ; `aidePresente` `:101`.
- **Ordre corrigé dans `lib/routes/reponses-aide.ts`** : constat — l'usage était enregistré (`:69`) avant l'envoi de l'aide ; la validation (`:59`) précède maintenant l'enregistrement : une aide invalide **n'est ni servie ni comptée** (échec bruyant HTTP 500 nommant la commande). Prouvé avec un générateur défectueux temporaire (`scripts/test-temoin-technique.ts`, Section B, section 7).
- `lib/routes/exercices/[id].ts:94` : `aide_disponible` vaut pour les deux formes ; **aucune** donnée d'aide dans `GET /api/exercices/:id` (testé).
- Client : table `public/moteur/aides/index.js` (dispatch, jamais une chaîne de tests) ; `moteur.js:277` `afficherAide` (type inconnu : message neutre, jamais de plantage).
- Découverte par la validation elle-même : le témoin émettait un segment **vide** quand `|coefficient| = 1` ; un segment n'est jamais vide (rien à colorer → on l'**omet**, son signe reste dans un segment sans rôle) ; règle consignée dans `lib/aideTypee.ts`.

### D. Croquis SVG (`public/moteur/croquis.js`, DOM API, classes seulement)
- `construireCroquisParabole` `:103`, `construireCroquisAllure` `:204`. **Écart assumé avec le pilote** : le pilote place les points par « seaux de signe » (croquis qualitatif) et a dû corriger a posteriori (§216) la désynchronisation des marques et de la courbe. Ici la parabole est **vraie, mise à l'échelle** (axes à échelles indépendantes, fenêtre calée sur 0, le sommet, les racines et `c`) : racines, sommet et point (0 ; c) sont sur la courbe **par construction**. Deux points confondus mathématiquement le restent (étiquettes écartées) ; une racine confondue avec le sommet donne une marque fusionnée portant l'indice `x_S`.
- **Ce que chaque croquis révèle en plus (contrepartie pénalisée de l'aide)** : tous montrent `c = valeur` ; `marqueS` montre en outre la **position** du sommet, qui, à l'échelle, permet d'estimer xS et yS (plus révélateur que le croquis qualitatif du pilote) ; `marquesOx` affiche les **valeurs** des racines et de xS ; `surlignageImf` désigne l'ensemble-image. L'illustration d'allure (`champs_multiples.illustration`) n'affiche que les deux choix **locaux** et `c` : aucun verdict, aucune aide, aucune pénalité.

### E. Tokens de surbrillance (D15) et contraste
- `public/style.css:68` : `--coef-a: #BF2280`, `--coef-b: #1137D0`, `--coef-c: #795B15` (35 tokens) ; documentés `docs/design-system.md` (rôle, valeurs, **table des ratios mesurés**). Réservés à `.moteur-coef-a|b|c` (`ecrans.css:645`).
- **Les teintes du pilote ne passent pas** : `#2f9e44` = 3,45:1 sur blanc ; sous déficience visuelle simulée leur distinction tombait à ΔE 20 (a–c en deutéranopie, b–c en tritanopie). Triplet retenu par **recherche sous contrainte** (ratio ≥ 4,6 sur 6 fonds de carte, teintes de verdict — rouge, vert, ambre — exclues, distinction minimale maximisée) : ratios réels **≥ 4,80:1**, ΔE minimal **48** (Machado 2009, sévérité 1). Une distinction purement chromatique n'est pas garantie : l'**ordre** a, b, c reste l'indice non chromatique.
- **Le contraste est un test permanent** : `scripts/test-design-system.ts:67` (6 fonds × 3 tokens, seuil 4,5:1) et réservation des tokens à leur seule règle. Vérifié aussi **dans le navigateur** (couleur calculée = token ; contraste réel contre le fond réel de la zone d'aide) ; captures sous 4 déficiences émulées (`Emulation.setEmulatedVisionDeficiency`) dans `captures-chromium/*-etendu-03-vision-*.png`.

### F. Témoin technique UNIQUE (deux profils) — **fusion demandée en revue de PR**
- Le prompt disait « étendre le témoin ». La première version de cette PR avait créé un second témoin (`_temoin_technique_etendu_v1`) pour garder intactes les assertions chiffrées d'origine ; **vous avez demandé un témoin unique**, les assertions d'origine restant une section vérifiable. Fait : il n'y a plus qu'**un** générateur, `src/generateurs/_temoinTechnique/index.ts` (`_temoin_technique_v1`), et **un** test, `scripts/test-temoin-technique.ts`.
- **Deux profils d'exercice, tirés de la graine** (`generer` : `index.ts:548`). Le profil est le **dernier** tirage utile, après les cinq de l'origine (`a`, `b`, `n`, `r1`, `r2`) : pour une graine donnée, ces paramètres sont donc **exactement** ceux d'avant la fusion. **Prouvé** par comparaison avec le générateur de `origin/main` sur 20 000 graines : pour les 10 018 graines de profil « base », paramètres, écrans, bonnes réponses, solutions et résultat de `verifier` identiques, **0 divergence** (les 9 982 autres ont le profil « étendu »).
  - `base` : les 4 écrans d'origine (`ecransBase`, `index.ts:182`).
  - `etendu` : les 7 écrans de la phase 3b-1 (`ecransEtendus`, `index.ts:306`), forme à 3 ou 7 colonnes tirée ensuite. Les champs d'origine restent vérifiables sur tout exercice.
- **Section A — assertions d'origine** (`scripts/test-temoin-technique.ts`) : **137 vérifications, inchangées**. Leur nombre est compté et vérifié (`NB_SECTION_A`, `:35` ; garde `:34`) : en retirer ou en ajouter une sans décision fait échouer le test. Le diff de la Section A contre `origin/main` se limite à l'en-tête, aux imports, au réglage explicite du profil, au compteur de garde et à **un seul littéral** : `temoin.generer(2024)` devient `temoin.generer(graineDeProfil("base", 0))`, car la graine 2024 a désormais le profil « étendu » (les valeurs attendues ne changent pas).
- **Section B — extension 3b-1** (`sectionB`, `:422`) : 4 589 vérifications (formes 3/7 colonnes, balisage dans chaque nature de texte, 7 écrans × statuts, `validerAide`, parcours par le vrai routeur, aides typées, aide invalide non comptée).
- **Le profil des exercices assignés est déclaré, pas caché** : `imposerProfilAssignation("base" | "etendu" | "aleatoire")` (`scripts/support/harnaisRouteur.ts:51`). À l'assignation, la seule source d'aléa est `tirerGraine()` (`Math.random`, `lib/prng.ts:20`) ; le harnais la remplace, le temps de l'appel, par des graines distinctes du profil demandé (écriture exacte `g / 2^32`), ce qui laisse `champs_attendus` cohérent avec la graine. Chaque scénario d'origine déclare `base`, chaque scénario étendu `etendu`.
- **Exemption `_v2` (Q4)** : le témoin ne peut pas être assigné par l'application (`lib/validationCorpsTaches.ts:108-111` rejette toute variante hors catalogue, à la création `taches.ts:230` et à la modification `taches/[id].ts:42` ; le registre refuse un témoin catalogué). Changer ce que `generer` produit pour une graine (ici : ajout du profil) ne contrevient donc pas à la règle `_v2`. **Limite** : cela ne prouve pas qu'aucune ligne n'a été insérée à la main dans la vraie base Supabase.
- `generateurTemoinTechnique.codesCompetenceDeclares` gagne `TEMOIN_AXE_NOTATION` (code émis sur un `parse_error`).

### G. `variante_id` et `_v2` (documenté, rien à trancher)
La règle protège les exercices déjà assignés. Les `af_*` sont au catalogue mais non exécutables (donc non assignables) : leur première implémentation (3b-3) garde l'identifiant du catalogue (`verifierCoherenceRegistre` l'exige). La règle ne s'appliquera qu'à un changement **ultérieur** de `generer()` une fois gen7 livré. Précisé dans `CLAUDE.md` (« Contrat de générateur »).

### Tests et validation
- `tsc -b` propre ; **21 scripts** (`smoke-test` + `scripts/test-*.ts`) passent, dont : `test-texte-math` (133), `test-temoin-technique` (4 726 = Section A d'origine **137, inchangée** + Section B 4 589), `test-design-system` (459).
- **Chromium 412/412** (390 px et 1280 px, vrai `api/router.ts`, base en mémoire) : `scenarioEtendu` (`scripts/chromium-temoin-technique.ts:532`) ; les scénarios d'origine tournent désormais sur des graines de profil « base » déclarées (déterministes). Points prouvés : aucune requête pendant l'édition (champs multiples, illustration, intervalle, liste, tableau) ; « Valider » désactivé tant qu'un sous-champ est vide ; l'illustration suit les choix locaux, reste neutre avec un seul choix, n'est pas une aide, n'affiche aucun verdict ; **le balisage d'auteur atteint `.moteur-math` dans chaque nature de texte alors qu'un `$x$` tapé par l'élève reste du texte brut** (réponse, aperçu, « Ta réponse ») ; **tableau 3 puis 7 colonnes sur deux exercices consécutifs : 14 cases toutes vides, aucun état résiduel** (risque §9.3 de la spec d'origine) ; chaque réponse n'a que les 3 clés du contrat ; 11 réponses, 6 demandes d'aide, zéro erreur JS/console.
- Défauts trouvés en inspectant les captures, **corrigés** : légende de `fieldset` en police de marque et fond lilas parasite (style global du site), résumé « Signe de a a > 0 » (séparateur selon la ponctuation du libellé).

### Non couvert / limites
- **KaTeX (3c)** : les mathématiques s'affichent en source LaTeX (repli lisible) ; ce sera remplacé par `rendreMath` seul. Les fragments de `formule_coloree` sont des `<span>` adjacents ; la 3c les assemblera en **une** chaîne LaTeX (l'espacement des opérateurs se perd sur des fragments isolés) via une liste blanche `\htmlClass`, à vérifier sur la version de KaTeX retenue.
- La géométrie des croquis n'est vérifiée que par assertions DOM et captures (pas de test unitaire numérique de la géométrie).
- Émulation Chromium seulement (pas de vrai mobile ni de lecteur d'écran) ; `aria-label` présents mais non audités avec un lecteur d'écran ; le runtime Node de Vercel n'est pas épinglé (`package.json` sans `engines`), d'où la règle « la production n'importe rien depuis `public/` ».
- Croquis de l'allure : la courbe peut sortir du cadre (comportement qualitatif hérité du pilote).


## §16 : Score partiel — `fractionCorrecte` dans le moteur de tentatives (inerte : aucun consommateur livré)

Décisions validées avant le code (formule + 5 points, dont l'exemple limite « 0,9 puis réussite »). Aucun `verifier()` réel n'émet de fraction (témoin compris), aucun dictionnaire ni code d'émission n'a bougé : la fonctionnalité est **livrée dormante**.

### ⚠ MIGRATION À EXÉCUTER SUR LA VRAIE BASE **AVANT toute fusion** (`schema.sql` ET `cumulatif.sql` touchés)
- `supabase/schema.sql:225` — colonne `reponses.fraction_correcte double precision check (fraction_correcte is null or (fraction_correcte >= 0 and fraction_correcte < 1))`.
- `supabase/migrations/cumulatif.sql:132` — instruction idempotente équivalente `alter table reponses add column if not exists fraction_correcte double precision check (…)` (même commit, pas de nouveau fichier). **Sans elle, tous les `select` de `reponses` ci-dessous échouent** (colonne inconnue) : c'est la raison pour laquelle elle précède la fusion. Lignes existantes : `NULL` = comportement d'origine.

### A. Contrat et contrôle
- `lib/contratGenerateur.ts:215` — `fractionCorrecte?: number` typé **uniquement** sur la variante `not_equivalent` de `ResultatVerification` (un `correct`/`parse_error` avec fraction ne compile pas). Absent = comportement inchangé.
- `lib/registreGenerateurs.ts:91-101` (`verifierAvecControle`) — contrôle d'exécution, qui attrape aussi un contournement du typage : fraction sur autre chose que `not_equivalent`, ou non-nombre / non fini / `< 0` / `≥ 1` → `Error` (500 via `avecGestionErreurs`, comme un code de compétence non déclaré). φ = 1 est interdit : une réponse entièrement juste est `correct`.

### B. Formule (`lib/moteurTentatives.ts:105-145` doc + aiguillage, `:179-` chemin partiel)
`p = 100 / tentativesMax`. Un échec de rang *i* (échecs_avant = échecs antérieurs) vaut `φ_i × max(0, 100 − échecs_avant × p)` (φ absent ⇒ 0) ; `meilleur_partiel` = max de ces valeurs.
- **Réussite au rang r** : `max( max(0, 100 − (r−1)·p) , meilleur_partiel )`.
- **Épuisement** : `meilleur_partiel` (0 sans fraction). **Chrono expiré** : `meilleur_partiel` des soumissions faites (0 sans fraction).
- **Aide** : `× (1 − pct/100)` sur toute valeur > 0.
- `terminee`, `reussie`, `revelee`, `tentativesUtilisees` **ne dépendent jamais** de φ : le verdict reste binaire, un échec partiel compte pour `tentativesMax` et ne débloque rien.
- **Non-régression par construction** : sans aucune fraction strictement positive lue sur un `not_equivalent` (`aUneFractionPositive`, `:170`), le corps d'origine (`:146-166`) s'exécute **tel quel**, expressions comprises ; le chemin partiel n'est emprunté que si une fraction > 0 existe.
- Pourquoi « meilleure tentative » et non « dernière » : ne pas punir l'élève d'avoir tenté mieux ensuite puis rechuté ; pourquoi une pénalité de rang **multiplicative** : une 3ᵉ tentative à 90 % ne doit pas valoir autant qu'une 1ʳᵉ ; pourquoi φ < 1 strict : `correct` est le seul chemin vers 100.
- **Conséquences assumées** (validées) : (1) un champ peut être `revelee = true` avec `score > 0` ; (2) le score d'une réussite peut dépasser celui de la tentative réussie elle-même — **0,9 puis réussite à tentativesMax = 2 donne 90, pas 50** (l'ancienne formule) : conséquence directe de « meilleure tentative », pas un bug.

### C. Stockage et câblage (une seule dérivation partout)
- `lib/routes/reponses.ts:120` — insertion `fraction_correcte` (`null` hors `not_equivalent`) ; `:124` — l'historique en mémoire porte la fraction (état recalculé avec la soumission courante).
- Lecture : `lib/etatExercice.ts:93` (`LigneReponse.fraction_correcte`), `:107` (select), `:146-160` (`etatTentativesAvecChrono`, 7ᵉ paramètre transmis aux **deux** appels, normal et chrono), `:166` (`calculerEtatChamp`) ; `lib/routes/eleves/tableau-de-bord.ts:66` (select paginé) ; `lib/verrouillageTache.ts:68,82,91` ; `lib/routes/eleves/mes-resultats.ts:133,169` + transmission au moteur. Le **pourcentage** de `mes-resultats` reste fondé sur les statuts (inchangé) : pas de consommateur du score.
- **Règle de révélation (§13)** : la fraction n'est renvoyée par **aucune** réponse HTTP (elle trahirait « presque juste » sous correction coupée). Vérifié sur 15 réponses (POST réponse, aide, GET exercice ×4, tableau de bord élève, mes-resultats, tableau de bord prof, profil élève prof) : aucune n'expose `fraction_correcte`/`fractionCorrecte`.

### D. Preuves (`scripts/test-score-partiel.ts`, `npm run test-score-partiel`, 65 vérifications)
- **1. Non-régression EXHAUSTIVE** (`:80`) : copie **gelée** de l'ancienne fonction (`:35`, mot pour mot @ `dc64fb3`) contre la réelle sur **toutes** les séquences de statuts de longueur 0..8 (9 841) × tentativesMax 1..6 × aide × 6 pourcentages × chrono = **1 417 104 configurations × 5 formes d'appel** (sans fraction, `undefined`, toutes `null`, toutes égales à 0, fractions positives posées sur des lignes jamais lues `correct`/`parse_error`) : **0 divergence**, score comparé par `Object.is` (bit à bit). Le nombre de configurations est compté (une boucle vide ne passerait pas).
- **2. Propriétés** (`:113`) : 200 000 tirages déterministes (77 091 avec fraction positive) — progression identique à l'ancienne, nullité du score identique, score ∈ [0,100], jamais sous l'ancienne formule, croissant en φ, plafonné par l'aide : **0 violation** de chaque propriété.
- **3. Scénarios synthétiques** (`:155`, valeurs calculées à la main, tm = 3 sauf mention) : 2/3 puis correct → 66,67 ; 1/3, 2/3 puis correct → 44,44 ; épuisement 2/3×3 → révélé, 66,67 ; fractions 0 → 0 ; aide 50 % → 33,33 ; tm 1 : 66,67 (53,33 avec aide 20 %) ; chrono après un essai à 2/3 → 66,67, sans essai → 0 ; parse_error compte comme échec ; **0,9 puis correct (tm 2) → 90**, 0 puis correct → 50 ; un échec à 0,99 ne termine rien ; fraction ignorée sur `parse_error`/`correct`.
- **4. `verifierAvecControle`** (`:206`) : 0, 0,5, 0,999 passent ; 1, 1,5, −0,1, NaN, ±∞, `"0.5"`, `null`, `true`, et toute fraction sur `correct`/`parse_error` sont rejetés.
- **5. Route** (`:228`, vrai `api/router.ts`, base en mémoire ; injection **de test** d'une fraction par enveloppe de `temoin.verifier`, restaurée dans `finally` — le vrai `verifier` du témoin n'est jamais modifié) : fraction stockée puis relue par la vraie dérivation (`chargerDonneesExercice` + `calculerEtatChamp`) : 0,6 / NULL / parse_error à tm 3 → révélé, score 60 ; 0,9 puis aide puis réussite (tm 2, aide 50 %) → 45 ; ligne héritée sans colonne → 50 comme avant ; correction coupée → rien révélé.
- **Sensibilité du test vérifiée par mutation** : une retouche d'un ulp de l'expression d'origine → divergences détectées ; retrait du `max` de la réussite → scénarios rouges. Fichier restauré.
- **Régression complète** : `tsc -b` propre ; 21 scripts (`smoke-test` — dont `smoke-test.ts:427-456` **inchangé** — et `scripts/test-*.ts`) passent ; `test-temoin-technique` 4 726 = 137 (Section A) + 4 589 ; **Chromium 412/412**.

### E. Non couvert / limites
- **Inerte** : aucun générateur n'émet de fraction et aucun écran ne lit `EtatChampTentatives.score` ; l'effet n'existera qu'avec un consommateur et un `verifier()` qui émet φ (chaque futur émetteur devra justifier sa φ : 1ʳᵉ implémentation, donc pas de `_v2`).
- Incongruité d'étiquette différée : un champ `revelee` avec `score > 0` s'affiche « Réponse révélée » (rouge) au récapitulatif ; à traiter avec le récapitulatif, pas ici.
- « Meilleure tentative » est un choix de conception validé (alternatives écartées : dernière tentative — punit la rechute ; somme pondérée — score potentiellement > réussite).
- Règle `-0` : l'épuisement/chrono sans partiel renvoie `0` (pas `0 × (1 − pct)`), identique bit à bit à l'ancienne.


## §17 : Poids par écran — agrégation pondérée « champs corrects / total » (inerte : aucun poids non défaut)

Mécanique seulement, pas de valeurs de gen7 : `EcranDeclare.poids` (entier ≥ 1, défaut 1) pondère l'agrégation **entre écrans d'un même exercice / d'une même tâche**. Indépendant de `fractionCorrecte` (§16, score d'UN champ) et du poids entre variantes/tâches (hors périmètre). Aucun affichage du poids, aucun temps de réponse touché. Décisions validées : D1 (chaque site garde son dénominateur), D2 (poids transporté par champ dans les JSON + module client unique), D3 (progression, série, segments non pondérés), repli à 1 sur ligne historique ; **D4 non tranchée** (voir E).

### A. Audit exhaustif des points d'agrégation « corrects / total » (grep `lib/`, `api/`, `src/`, `public/`)
| # | Emplacement | Nature | Dénominateur (conservé) | Traité |
|---|---|---|---|---|
| S1 | `lib/routes/eleves/mes-resultats.ts:243-256` | serveur, score d'une tâche notée (`correct`/`total`/`pourcentage`, → `historiqueTaches`, `calculerTendanceScore`, `eleve.html` pourcentage) | tous les `champs_attendus` | oui — `sommePonderee` |
| C1 | `public/prof.html:4770-4772` `calculerScoreEleve` | client, par élève | champs répondus | oui — `sommeChampsPonderee` |
| C2 | `public/prof.html:4819-4821` `calculerScoreExercice` | client, par exercice | champs répondus | oui |
| C3 | `public/eleve.html:563-571` (tuiles « réussite ») | client, tout le tableau de bord | champs répondus **et visibles** (statut `null` ignoré) | oui |
- **Dérivés, sans logique propre** (héritent de C1/C2, aucune retouche) : `prof.html` tri par score (`:4614`, `:6224`), moyenne / élèves en difficulté (`calculerStatsResultats`), badges `X/Y · Z%` (`construireBadgeScorePourPaire`), somme par tâche (`:5182-5184`), filtre « masquer les vides » (`:6237`), impression (`:6286`, `:6315`). En aval de S1 : `lib/historiqueTaches.ts:34` (moyenne de `correct/total` par tâche : rapport de sommes pondérées, additives).
- **Examinés, volontairement NON pondérés (D3)** : anneau de progression `resumeExercice`/`resumeTache` (`lib/tableauDeBord.ts:71-78`, compte des champs *répondus*, pas des réussites), série `calculerSerieActuelle` (`:89`, soumissions consécutives), `calculerSegmentsCompetence` (`lib/profilCompetences.ts:261`) et `calculerProfilCompetences` (occurrences de bug).
- **Aucun autre comptage** : `profs/resultats.ts`, `profs/eleves/profil.ts`, `classes/[id]/profil.ts`, `profs/tableau-de-bord.ts` renvoient statuts/bugs/temps sans pourcentage ; c'est `prof.html` qui agrège les Résultats.

### B. Contrat et lecture unique
- `lib/contratGenerateur.ts:88` — `poids?: number` sur `EcranCommun` (donc tout `EcranDeclare`), statique, jamais dépendant des réponses.
- `lib/poidsEcran.ts` — **seule lecture du poids** : `validerPoids` (`:17`, entier ≥ 1 sinon `Error`), `poidsDesEcrans` (`:25`), `poidsDuChamp(generateur, exercice, champ)` (`:30`), `poidsDesChampsDeLigne` (`:39`, pour les routes qui ne régénèrent pas déjà), `poidsDansMap` (`:47`), `sommePonderee` (`:57`). Pas de nouvelle donnée stockée ni de colonne : `ecrans(exercice)` est pure, l'exercice se régénère depuis `exercices_assignes.graine`.
- **Repli à 1** (nécessaire à la non-régression sur données réelles) : ligne sans graine, variante hors registre, graine invalide, champ inconnu, générateur `null`.

### C. Transport et sites
- `lib/routes/eleves/mes-resultats.ts:22,70` — `graine` ajoutée au `select` (la route ne régénérait pas) ; `:243-256` somme pondérée.
- `lib/routes/profs/resultats.ts:23,43,338-341` (+ `select` `:140` et `:176`) — chaque `ChampResultat` porte `poids`.
- `lib/routes/eleves/tableau-de-bord.ts:134,141` — chaque champ servi porte `poids` (déjà régénéré ici).
- Le `poids` est une donnée **indépendante des réponses** : rien à masquer sous correction coupée (§13) ; C3 continue d'ignorer les statuts masqués. Alternative écartée : scores pré-calculés côté serveur (nouvel indicateur dérivé des réponses, à exclure tant que la tâche est masquée).
- `public/moteur/scorePondere.js` — **seule implémentation navigateur** (`sommeChampsPonderee`, poids absent/invalide → 1). Script **classique** (`<script src>` en `prof.html:1161`, `eleve.html:316`), pas un module ES : les scripts inline l'appellent de façon synchrone (tri, badges, impression). Parité avec `sommePonderee` testée (le navigateur ne peut pas importer `lib/`, la production n'importe jamais depuis `public/`).

### D. Preuves
- `scripts/test-poids-ecran.ts` (`npm run test-poids-ecran`, 42 vérifications) : **1.** copies GELÉES des comptages d'origine (serveur, client prof, client élève) contre les versions pondérées, poids absents ET à 1 : **8 191 listes serveur** (tailles 0..12, tous sous-ensembles) et **87 381 listes client** (statuts ×4, tailles 0..8) — 0 divergence, pourcentage arrondi compris (les nombres de listes sont comptés). **2.** parité serveur/client sur 100 000 tirages à poids 1..5 : 0 divergence. **3.** scénario synthétique à poids 3/1/1/2 : **4/7 = 57 %** (et non 2/4 = 50 %). **4.** repli à 1 et rejets de `validerPoids` (0, −1, 1,5, NaN, ∞, `"2"`, `null`, `undefined`). **5.** route (vrai `api/router.ts`, injection de test de `temoin.ecrans`, restaurée) : `mes-resultats` **8/10 = 80 %** (3/4 = 75 % sans poids), `profs/resultats` et tableau de bord élève servent `poids` par champ, le module client retrouve 8/10, ligne historique sans graine **1/2 = 50 % inchangé**.
- **Sensibilité vérifiée par mutation** : ignorer le poids en S1, dans `scorePondere.js` ou dans `profs/resultats` fait échouer respectivement 1, 6 et 3 assertions.
- **Chromium 432/432** (412 + 20) : `scenarioPoids` (`scripts/chromium-temoin-technique.ts`) joue les vraies pages — `eleve.html` : tuile « réussite » = **80 %** ; `prof.html` Résultats : « Réussite moyenne » **80 %**, badge « **8/10 · 80%** » ; 0 erreur JS.
- **Défaut de harnais trouvé et corrigé** : le pont API du script Chromium **supprimait la query string** (`?classe_id=`, `?tache_id=`) : `GET /api/eleves?classe_id=…` tombait sur la branche authentifiée (401) et **interrompait l'init de `prof.html` après `chargerClasses`** (jamais `chargerTaches`) — invisible tant qu'aucun scénario n'avait besoin des tâches. Corrigé (`query: { path, ...searchParams }`) ; `scripts/support/harnaisRouteur.ts` gagne l'option `query`. Une 2ᵉ particularité de la base en mémoire (première liste de classes sans code : forme de `update().select()`) est contournée en amont dans le scénario, non corrigée.
- Régression complète et `tsc -b` : voir la PR.

### E. Risque documenté — D4 NON tranchée (règle `_v2` et poids)
La règle `_v2` (`CLAUDE.md`) protège ce que `generer` produit pour une graine ; `poids` vit dans `ecrans`. **Changer un poids après livraison réécrit rétroactivement tous les pourcentages historiques** (S1 recalcule à chaque appel depuis la graine, sans instantané) sans que la règle `_v2` ne l'impose. Non tranché : la décision (étendre la règle à `poids`, ou non) attend que gen7 fixe ses premiers poids réels. En attendant : aucun générateur réel ne déclare de poids, donc aucun effet.

### F. Non couvert / limites
- Inerte : aucun poids ≠ 1 en production. `X/Y` affichés deviendront des points pondérés (et non des nombres d'écrans) dès qu'un poids ≠ 1 existera (D3 : assumé).
- Un poids invalide déclaré par un générateur lève à la lecture (500 sur les routes concernées) — pas de contrôle au chargement du registre (il faudrait générer un exercice) ; couvert par les tests des générateurs.
- Coût : `mes-resultats` et `profs/resultats` régénèrent désormais chaque exercice (`generer` puis `ecrans`, pur et déterministe) ; à surveiller si les volumes montent (une régénération par exercice affiché).


## §18 : Cascade de réponses entre écrans — la donnée affichée vient de `reponsesConfirmees`, jamais de l'exercice brut

Règle (demande explicite) : quand un écran affiche une valeur dépendant d'un écran précédent, elle vient de ce que l'élève a **confirmé**, et la vérification de l'écran suivant se fait sur cette même valeur — une méthode juste sur une donnée de départ fausse **réussit** l'écran, sans échec en cascade. Valable sous correction immédiate active. Aucun générateur réel n'a d'écran dépendant (gen7 arrivera) : **livré dormant**, éprouvé par un générateur de test.

### A. Décisions validées
- **(a) Projection unique** : `Generateur.projeter?(exercice, reponsesConfirmees, { correctionImmediate })` renvoie l'« exercice effectif ». `ecrans`, `verifier`, `solutionAttendue` et l'aide ne reçoivent que lui (`lib/contratGenerateur.ts:284`, `ContexteProjection` `:216`) — un seul point de substitution au lieu de quatre signatures modifiées.
- **(b) Repli à deux régimes, choisi sur `feedback_immediat` STATIQUE de la tâche, jamais sur `revele`** : quand la valeur confirmée est inexploitable (non analysable, hors domaine, champ terminé sans réponse — chrono) : **correction immédiate active → la vraie valeur** ; **correction coupée → une donnée de repli déclarée par le générateur, distincte de la vraie valeur**.
  - *Justification (à ne pas perdre)* : sous correction ACTIVE, ces cas impliquent `revelee = true` **et** la solution du champ est montrée à l'élève au même instant (`lib/tableauDeBord.ts:156`, `revele = revelee && (feedback_immediat || …)`) : la vraie valeur ne fuit rien. Sous correction COUPÉE la même équivalence est **fausse** : `revelee` est un état interne, rien n'est montré avant la fin de la TÂCHE (§13), et avec `tentativesMax = 1` une simple faute de frappe (`parse_error`) termine déjà le champ — un repli sur la vraie valeur ferait fuiter la réponse du champ précédent par l'énoncé suivant. Le choix sur `revele` est écarté : il bascule à la fin de la tâche et **changerait après coup l'énoncé déjà vu** par l'élève.
  - Pour l'écran 3 d'une chaîne, la « vraie valeur » de l'écran 2 est celle que sa solution PROJETÉE donne (méthode correcte sur la donnée affichée), pas la valeur brute.
- **Point 5 — écrans à venir** : `public/moteur/moteur.js:102` saute les écrans non courants et non verrouillés, mais `GET /api/exercices/:id` envoyait **tous** les `ecrans` (consignes comprises) : masquer dans le navigateur ne protège pas la charge utile. `EcranDeclare.dependDe?: string[]` (`lib/contratGenerateur.ts:96`) + filtrage **serveur** : un écran dépendant n'est servi qu'une fois ses prédécesseurs terminés (`ecransServis`, `lib/cascadeEcrans.ts:41` ; tâche antérieure : tout est servi). Un écran sans `dependDe` est servi comme avant (l'assertion de Section A `ecrans.length === 4` reste vraie : le profil `base` n'a aucun écran dépendant). `champs` (état de chaque champ) reste complet, sans texte.

### B. Sites de projection — **six**, pas cinq (défaut trouvé à la vérification demandée)
Le premier inventaire listait 5 sites en supposant l'aide couverte par `ecrans`. **`POST /api/reponses/aide` lisait `regenere.ecrans` (vraie valeur)** : l'aide d'un écran dépendant aurait été bâtie sur la vraie valeur, et délivrée même avant que ses prédécesseurs soient terminés. Corrigé, avec un 409 qui ne compte aucun usage d'aide.
1. `lib/routes/exercices/[id].ts:62` (projection), `:96` (écrans filtrés), solutions du champ ;
2. `lib/routes/reponses.ts:113` (409 si prédécesseurs non terminés), `:117` (`verifier` sur l'exercice projeté) et la solution renvoyée ;
3. `lib/routes/reponses-aide.ts:57-61` (409 + aide de l'écran **projeté**, validée avant tout comptage) ;
4. `lib/routes/eleves/tableau-de-bord.ts:134` (solutions relues).
- `lib/etatExercice.ts:70` `projeterExercice` : sans `projeter`, renvoie l'exercice brut **par référence** (zéro coût, zéro régression) ; **échec bruyant** si `dependDe` est mal formé (champ inconnu, écran qui ne précède pas, doublon), déclaré sans `projeter`, ou si la projection change la liste des champs (`champs_attendus` est figé à l'assignation par `lib/routes/assignations.ts:142` sur l'exercice brut : les identifiants ne doivent jamais dépendre des confirmations).
- Hors périmètre car sans texte d'écran : `mes-resultats`, `profs/resultats` (le poids §17 est statique, non projeté).

### C. Texte d'élève et balisage
Un générateur qui affiche la donnée confirmée **ne colle jamais la chaîne brute de l'élève** dans un texte d'auteur (le `$` tapé par l'élève casserait le rendu ou y injecterait des commandes) : il la décode (`lib/reponsesEcran.ts`) et **re-sérialise** lui-même la valeur (`verifierBalisageMath`). Le générateur de test n'accepte que des entiers relus par expression régulière (`|v| ≤ 10 000`).

### D. Preuves (`scripts/test-cascade.ts`, `npm run test-cascade`, 62 vérifications)
- **Générateur de test** `scripts/support/generateurCascade.ts` (dans `scripts/`, jamais `src/`, ajouté au registre le temps du test) : 3 étapes chaînées + 1 écran indépendant, uniquement des `champ_expression`. **Pas dans le témoin technique** : ce mécanisme n'ajoute aucun type d'écran, et un 3ᵉ profil du témoin aurait déplacé les graines de centaines d'assertions.
- **1. Contrat exhaustif** : 100 graines × 91 valeurs confirmées (−30..60, dont la vraie) × 2 régimes = **18 200 projections** : énoncé, aide et solution bâtis sur la valeur confirmée ; **la méthode juste sur la donnée confirmée réussit** ; la chaîne officielle n'est acceptée que si la donnée confirmée est la vraie ; chaîne à 3 écrans ; indépendance vis-à-vis des confirmations suivantes ; liste des champs constante ; repli (5 formes de valeur inexploitable) : vraie valeur si correction active, donnée de repli ≠ vraie valeur si coupée. 0 violation.
- **2.** validation des déclarations (auto-référence, écran suivant, champ inconnu, liste vide, doublon) et filtrage des écrans servis. **3.** sans `projeter` : même référence ; `dependDe` sans `projeter` et projection qui change les champs lèvent.
- **4. Route** (vrai `api/router.ts`) : **correction active** — GET initial sans texte dépendant, aide/POST d'un écran dépendant avant ses prédécesseurs = 409 (aucun usage compté), donnée fausse confirmée puis méthode juste = **RÉUSSITE** (puis chaîne complète), chaîne officielle **rejetée** avec solution projetée, `parse_error` → énoncé suivant sur la vraie valeur (déjà révélée), solutions relues et tableau de bord cohérents ; **correction coupée** — repli sur la donnée déclarée, aide bâtie dessus, **aucune charge utile avant la fin de la tâche ne contient la vraie valeur**, tout révélé à la fin sans que l'énoncé déjà vu change, une seule erreur ne produit **pas** de cascade d'échecs.
- **Sensibilité par mutation** : aide lue sur l'écran brut (3 assertions rouges), `verifier` sur l'exercice brut (4), écrans non filtrés (2), régime de repli toujours « vraie valeur » (8). Fichiers restaurés.

### E. Non couvert / limites
- Inerte tant qu'aucun générateur ne déclare `dependDe` (gen7). Chaque futur générateur doit fournir un `projeter` **et** sa donnée de repli, dans le domaine valide de son écran (un Δ faux négatif ou `a = 0` ne laissent pas de problème bien posé : hors domaine = inexploitable = repli).
- Une réussite sur donnée fausse compte pour la compétence de l'écran suivant ; l'erreur initiale reste attribuée à son écran, sans propagation de `codesCompetence` (comportement voulu, non codé).
- `POST /api/reponses/aide` ne vérifie toujours pas que le champ est l'écran COURANT (préexistant, hors périmètre) ; seul le cas « dépendance non terminée » est refusé.
- Les sites clients n'ont rien à changer (le moteur ignore déjà les écrans non servis) ; non vérifié en Chromium avec un générateur dépendant (aucun réel n'existe).


## §19 : Phase 3b-2 — vérification de la factorisation de gen7 (`racinesChamp1`, `racinesChamp2`) : modules purs

Deuxième des trois PR de gen7 : **modules purs seulement** (`src/generateurs/analyseFonction/racines/`), testés contre l'ancien pilote (`plateforme-maths-pilote` @ `6acc102`, lecture seule, jamais modifié). Aucun `Generateur` gen7 assemblé, aucun enregistrement au registre, aucun autre écran, **aucune modification du contrat, du moteur, du poids ni de la cascade** (3b-3). Aucune migration SQL.

### A. Lecture réelle avant le « Go » (`ANALYSE-phase3b2-racines.md`, validée Q1-Q4)
- **Confirmé** sur le vrai code, cas par cas : conditions de `C04` (`pilote:src/diagnostic/diagnosticMiseEnEvidence.ts:204-217`), `C05_SIGNE_REPETE`/`C06_SIGNE_OPPOSE` (`pilote:src/diagnostic/diagnosticBinomeProduitRemarquable.ts:26-39`), `RACINE_PARTIELLE` (`pilote:lib/routes/reponses.ts:2085-2089, 430-434`), `traiterChamp1` (`:535-570`), tolérances (1e-6 champ 1 ; 1e-9 champ 2, `racinesExactes: true` dans les 3 constructeurs), saut de l'irréductible (`pilote:lib/champsAttendus.ts:373-378`).
- **Corrections apportées à ce que la spec 3a et le prompt supposaient** : (1) `RACINE_PARTIELLE` émis sur une valeur non réelle (`sqrt(-1);4`) — défaut de l'ancien code ; (2) **aucun message pédagogique** sur `parse_error` de `racinesChamp1` dans l'ancien pilote (les `catch` de `expressionAlgebrique.ts` ne l'enregistrent pas ; seul le champ 2 le fait) → messages du champ 1 **rédigés**, pas portés ; (3) la table verrouillée par les tests de l'ancien pilote est mince (1 cas C04, 1 RACINE_PARTIELLE, 1 « aucune » ; rien sur C05/C06, `parse_error`, tolérances, formes équivalentes) → table **différentielle** ; (4) volume ≈ 1 030 lignes avec commentaires (≈ 700 de code), pas ~1 300 : cubique, forme canonique/réduite/proportionnelle, mise en évidence généralisée et tout l'irrationnel ne sont **pas portés**, et le tokeniseur/parseur que l'ancien pilote dupliquait dans `diagnosticMiseEnEvidence.ts` est **unique** ici.

### B. Modules (réécrits localement — aucun import de l'ancien pilote)
- `expressionAlgebrique.ts` (310 l.) — tokeniseur, parseur, évaluation, extraction de racines par échantillonnage, trinôme : comportement de `pilote:src/moteur/expressionAlgebrique.ts`. `expressionNumerique.ts` (276 l.) — évaluateur du champ 2 (`pilote:src/moteur/expressionGenerale.ts` + `normalisationNumerique.ts`) : fonctions `sqrt/cbrt/abs`, barres `|…|`, `x`/`X` → `*` avant lecture. **Deux grammaires distinctes, reproduites telles quelles** (l'unifier changerait des verdicts).
- `erreurSyntaxe.ts` — la NATURE d'une erreur de lecture est une donnée (l'ancien pilote la reconnaissait en comparant des chaînes de message) ; `messagesSyntaxe.ts:21` (champ 2, textes portés), `:49` (champ 1, rédigés), `:12` échappement du texte d'élève recopié (`$` → `\$`, règle « un `$` tapé reste un `$` »).
- `verifierRacinesChamp1.ts:106` — statut d'abord (`estCorrecte` `:47`), code ensuite **seulement si `not_equivalent`** : `C04` (`:70`), `C05_SIGNE_REPETE` (`:80`), `C06_SIGNE_OPPOSE` (`:87`), un seul par catégorie (`:94`). `C07_ou_C08` **non émis, non déclaré** (`types.ts`, `CODES_RACINES`).
- `verifierRacinesChamp2.ts:53` — `[]` = « Pas de racine » (`permetAucune`, jamais correct), expressions numériques, ordre indifférent, 1 valeur ssi racine double, ≥ 3 valeurs faux ; `RACINE_PARTIELLE` par **position** après tri (`:47`, `:69`).
- `genererRacines.ts:33` (`construireRacines`, déterministe) et `:50` (`genererRacines`, seedée) : **l'ordre des tirages est contractuel pour le `_v1` de gen7** — `a = entierEntre(1,4)`, puis `r` (rejet de 0 pour mise en évidence et produit remarquable, `entierEntre(1,5)` pour le binôme) ; gen7 (3b-3) ajoutera ses tirages APRÈS. Figé par le test (30 couples graine/`a`/`r`).
- `ecransRacines.ts:14` — les deux écrans (libellés de l'ancien client, aucune aide, `permetAucune`) ; `types.ts` — `CategorieRacines` **exclut** `irreductible`.

### C. Exception `af_irreductible` — « jamais appelés », pas « toujours corrects »
`ecransRacines("irreductible")` renvoie une liste **vide** (`ecransRacines.ts:15`) : les deux écrans n'existent ni dans `ecrans()` ni dans `champs_attendus`. Aucune fonction de vérification/génération ne compile avec `irreductible` (`// @ts-expect-error` dans le test), et une **garde d'exécution** (`types.ts:35`) lève si le typage est contourné (4 points d'entrée testés). Réel (vrai `api/router.ts`) : `champs_attendus = [debut, fin]`, écrans servis idem, **requête forgée sur `racinesChamp1`/`racinesChamp2` → 400, rien enregistré**, exercice terminé sans jamais les traverser.

### D. Divergences DÉLIBÉRÉES avec l'ancien pilote (les seules)
1. **Valeur non finie** (`sqrt(-1)`, `1/0`) dans `racinesChamp2` : verdict inchangé, **jamais `RACINE_PARTIELLE`** (`verifierRacinesChamp2.ts:69`) — Q1.
2. **Liste entièrement vide** : `parse_error` avec message (ancien : `not_equivalent`) — décision D6.
3. **Le mot `constructor`** : l'ancien `mot in NOMS_FONCTIONS` le lisait comme une fonction (clé du prototype d'objet) de valeur `undefined` → `RACINE_PARTIELLE` possible ; ici `Object.hasOwn` (`expressionNumerique.ts:80`) → identifiant inconnu. Trouvé en sondant, absent de la spec.
4. **Messages `parse_error`** : champ 1 rédigés (Q2, l'ancien n'en avait pas) ; le caractère recopié est échappé (F7).
Le reste est **identique**, prouvé ci-dessous.

### E. Preuves (`scripts/test-verification-racines.ts`, `npm run test-verification-racines`, 230 vérifications)
- **Table de vérité différentielle** (`scripts/support/table-verite-racines-pilote.json`, provenance `docs/extraction-table-verite-racines.md`) : **15 100 cas** (100 exercices × 75 saisies champ 1 + 76 champ 2, produits en appelant le VRAI `traiterAnalyseFonction` de l'ancien pilote, exporté par `sed` dans une copie jetable) — statut, code de compétence et message du champ 2 reproduits à l'identique : **13 820 identiques, 1 280 divergences délibérées exactement comptées (400 liste vide, 480 non finie, 400 `constructor`), 0 non délibérée**. La table exerce `C04`, `C05`, `C06`, `RACINE_PARTIELLE`, > 1 000 `parse_error` par champ ; le test échoue si l'une des divergences n'est plus exercée. La génération est comparée aux constructeurs de l'ancien pilote (`b`, `c`, racines, texte de solution : 100/100 caractère pour caractère).
- **Cas verrouillés par l'ancien pilote** (`test-taxonomie-gen7.ts:129-135, 228-229, 258-269`, `test-gen7.ts` E2E) : C04 sur 24 exercices, RACINE_PARTIELLE `r0;r1+137`, « aucune » sans code, solution acceptée 100/100.
- Lecture des saisies : imbrication démesurée sans exception (l'ancien `catch` global), tous les messages passent `verifierBalisageMath`, `$` échappé, comptage par position (`[5 ; 7]` pour `[0 ; 5]` : aucun code).
- Génération : 9 000 exercices (3 catégories × 3 000 graines), déterministes, invariants tenus (bornes, relations, zéros du trinôme, solution acceptée).
- **Route réelle** (générateur de test `scripts/support/generateurRacinesTest.ts`, non enregistré en production, composé de ces modules) : `parse_error` + `message_erreur` sous correction immédiate, historique stocké `parse_error → not_equivalent/C04 → correct`, `bug_detecte` = `C05_SIGNE_REPETE` / `RACINE_PARTIELLE`, « Pas de racine » jamais correct ; **sous correction coupée ni verdict ni message** (§13).
- **Sensibilité par mutation** : détecteur C04 relâché, non-fini autorisé, irréductible non sauté, tirage modifié, échappement retiré — tous détectés.

### F. Non couvert / limites
- **Code non appelé en production** jusqu'à la 3b-3 (assemblage) : c'est voulu.
- La table différentielle couvre 100 exercices (a ∈ [1,4], r ∈ [−5,5]\{0} / [1,5]) et 150 saisies-types : elle prouve l'équivalence sur ce corpus, pas sur toute saisie possible.
- Écho de texte d'élève dans un message d'auteur : seul le caractère fautif (échappé) et l'identifiant (lettres/chiffres) sont recopiés.
- La ligne « forme factorisée confirmée = 0 » de l'écran `racinesChamp2` (spec 3a §5.1 n°4) est un cas d'usage de la **cascade** (`dependDe: ["racinesChamp1"]`) : 3b-3.

### G. Erratum (comptes de scripts annoncés avant cette section)
`RAPPORT.md:711` (§15) annonçait « 21 scripts (`smoke-test` + `scripts/test-*.ts`) » : **19** au commit de fusion `dc64fb3` (le chiffre datait d'avant la fusion des deux témoins). `RAPPORT.md:756` (§16) annonçait 21 : **20** (`cb5a3aa`). Les PR #5 annonçaient 22 puis 23 : **21** puis **22**. Cause : le script Chromium était compté en plus alors qu'il était aussi cité à part. Les comptes d'assertions (412, 432, 4 726, 137…) n'étaient pas concernés. Depuis cette section : **23** scripts `smoke-test` + `scripts/test-*.ts`, + Chromium à part.


## §20 : Durcissement contre la chaîne de prototypes (`x in objet`, `objet[cle]` sur objet littéral)

Petite PR de correctifs, née du constat de la §19-D n°3 (l'ancien `mot in NOMS_FONCTIONS` lisait `constructor` comme une fonction) : le même piège était-il dans le code déjà écrit ? Grep exhaustif de `lib/`, `api/`, `src/`, `scripts/`, `public/` (opérateur `in` hors boucles `for…in` — il n'y en a aucune —, `hasOwnProperty` / `Object.hasOwn` / `Object.create(null)` — aucun avant la §19 —, tables d'objets littéraux et leurs lectures par clé dynamique). Aucune migration SQL, aucun changement de comportement pour une entrée ordinaire.

### A. Le piège
Tout objet littéral « contient » `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__proto__`… : `cle in table` est vrai et `table["constructor"]` est une **fonction**, pas `undefined`. Nouvelle lecture unique : `lib/tablePropre.ts` (`lirePropre`, fondée sur `Object.hasOwn`).

### B. Sites corrigés (un test chacun, `scripts/test-durcissement-prototype.ts`, 97 vérifications)
| # | Site | Clé | Avant → après |
|---|---|---|---|
| 1 | `lib/registreGenerateurs.ts:52` `code in dictionnaire` (**production**) | code déclaré par le développeur | un code déclaré « constructor » passait la cohérence du registre → `Object.hasOwn` |
| 2 | `lib/profilCompetences.ts:131,132,142` — dictionnaire, explications, explications élève | `bug_detecte` (serveur) | `explicationEleve` recevait la **fonction** `Object` → `lirePropre` |
| 3 | `lib/categoriesCompetences.ts:134` | idem | `categorie` / `sousCategorie` lues sur une fonction → catégorie par défaut |
| 4 | `lib/routes/profs/resultats.ts:280,326` `resumeBugs` (objet) ; `:363-366` | idem | **compteur corrompu** : `occurrences: "function Object() { [native code] }11"` (reproduit) → `Map` ; les lectures de tables passent par `lirePropre` |
| 5 | `lib/reponsesEcran.ts:36-49` `decoderTableauSignes` — **clés venues de l'ÉLÈVE** | id de ligne / de colonne | `{"__proto__":{"signe":"+"}}` changeait le prototype de l'objet décodé (`signe` héritée) → rejet explicite de `__proto__` **et** objets sans prototype |
| 6 | `public/moteur/ecrans/tableauSignes.js:41,49-54,120` `NOMS_SYMBOLES` / `TRACES_SYMBOLES` | valeur d'une réponse **stockée** (`resumer`) | « function Object() { [native code] } » affiché dans le résumé de l'élève → `Object.hasOwn` |
| 7 | `lib/tablePropre.ts` | — | test unitaire de `lirePropre` |

### C. Ce que les tests prouvent (chacun reproduit d'abord l'entrée hostile ; **mutation vérifiée** : retirer le correctif d'un site fait échouer son test)
- Registre : les 9 clés héritées déclarées comme codes sont refusées, un vrai code reste accepté (témoin : `in` les voit bien dans le dictionnaire réel).
- Profil / catégories : pour chaque clé héritée, libellé de repli, aucune explication lue dans le prototype, catégorie « Non classé » ; un code réel (`FC_CE_FANTOME`) reste résolu depuis les quatre tables.
- `profs/resultats` en réel (vrai `api/router.ts`, réponses stockées avec `bug_detecte` = `constructor`, `toString`, `__proto__`, `valueOf`) : compteurs entiers exacts, libellé de repli.
- **`decoderTableauSignes({"__proto__":{"signe":"+"}})` est rejeté** (et `__proto__` en colonne, seul ou parmi des colonnes valides) ; `constructor` / `toString` comme id de ligne sont des clés ordinaires, propres, jamais héritées ; `Object.prototype` n'est pas pollué ; le vérificateur du témoin répond `parse_error` à une réponse portée par `__proto__`, et accepte toujours la bonne. Les décodeurs `champs_multiples`, `intervalle`, `liste_valeurs` refusaient déjà `__proto__` : verrouillé.
- Client : `resumer` d'une réponse stockée contenant chaque clé héritée affiche la valeur brute ; les vrais symboles gardent leur nom accessible.

### D. Constats honnêtes
- **Aucun de ces sites n'était atteignable par un élève sauf n°5 et n°6** (les codes viennent du serveur : `verifierAvecControle` ne laisse passer que des codes DÉCLARÉS, et leur nom suit une convention `MAJUSCULES_SOUS_TIRETS` qui ne peut pas heurter un membre de prototype). Le n°4 était pourtant un défaut **réel et reproduit** si un tel code existait ; le n°1 était le seul filet qui aurait pu le laisser entrer.
- **Les lectures de `DICTIONNAIRE_COMPETENCES[code]?.libelle` et `EXPLICATIONS_COMPETENCES[code]?.explication` dans `resultats.ts` n'avaient AUCUN effet observable** (une propriété lue sur une fonction héritée vaut `undefined`, donc le repli s'appliquait quand même) : elles sont durcies par cohérence, et **aucun test ne peut distinguer** l'ancienne et la nouvelle lecture à cet endroit (mutation testée : 0 échec) — la preuve porte sur `resumeBugs`, seul défaut visible de ce fichier.
- `NOMS_SYMBOLES` est le seul site client atteignable ; `TRACES_SYMBOLES` (`symboleSvg`, `rafraichir`) est durci par cohérence : ses clés viennent de l'alphabet de l'auteur, jamais d'une réponse ; son chemin normal est couvert par Chromium (symboles de variation), pas par un test hostile.
- Vérifiés SANS changement : `OPERATEURS[c]` des deux évaluateurs de la §19 (un seul caractère ne peut égaler un membre de prototype) ; `COMPOSANTS_ECRAN[ecran.type]` et `LIBELLES_STATUT[statut]` (`public/moteur/moteur.js`, clés fournies par le serveur) ; `CORRESPONDANCE_JSON_VERS_PILOTE[…]` (clé `niveau:numero`, jamais un nom de propriété) ; les 12 `table in tables` des scripts de test (noms de tables écrits en dur).

### E. Non couvert / limites
- Grep par motif : un accès indirect (clé calculée à travers plusieurs fonctions) a pu m'échapper ; la recherche a porté sur les tables d'objets littéraux **déclarées** et leurs lectures.
- Aucune règle de lint ne verrouille le motif : une nouvelle lecture `TABLE[cle]` non protégée serait possible. Règle écrite dans `CLAUDE.md`.


## §21 : Chromium — contrôle des réponses HTTP >= 400 inattendues

Petite tâche de harnais (`scripts/chromium-temoin-technique.ts`), proposée après le défaut du pont d'API (§ précédentes : la chaîne de requête `?tache_id=` était perdue depuis `d360c35`, des appels de `prof.html` échouaient sans qu'aucune assertion ne le voie). Aucun code de production touché, aucune migration SQL.

### A. Ce qui est livré
- `scripts/chromium-temoin-technique.ts:166` : chaque page ouverte par `preparerPage` journalise toute réponse HTTP >= 400 (statut, méthode, chemin) dans `journal.reponsesEnErreur` (type `Journal`, `:96`), qu'un test l'attende ou non.
- `:118` `evaluerReponsesHttp` (pure) et `:133` `controlerReponsesHttp(étiquette, attendues?)`, appelé après **chacun des 7 scénarios × 2 largeurs** (`main`). Une réponse >= 400 non déclarée fait échouer avec « statut, méthode, chemin, jeton de la page » ; une réponse déclarée attendue (`ReponseHttpAttendue`, `pourquoi` obligatoire, `:105`) mais jamais vue échoue aussi, pour que la liste d'attendus ne se périme pas en silence.
- `:140` `temoinControleHttp` (appelé en tête de `main`, `:942`) : un vrai 404 est journalisé ; non déclaré → refusé ; déclaré → accepté ; statut différent → « inattendue » ET « périmée » ; attendu jamais observé → signalé (5 vérifications).
- `:964` : si un scénario **plante** (timeout d'attente) avant son contrôle, les réponses >= 400 déjà vues sont affichées avant l'erreur.

### B. Résultat mesuré
Sur le harnais actuel : **aucune réponse >= 400 dans les 14 scénarios** ; la liste d'attendus est donc vide (aucun scénario ne provoque de 4xx par l'interface). 432 → **451** vérifications (+5 témoin, +14 contrôles).

### C. Mutation, et un constat honnête
Retrait de `...Object.fromEntries(url.searchParams)` du pont d'API (le défaut d'origine) : **le contrôle seul ne suffisait pas** — le scénario `poids` plante sur un timeout *avant* d'atteindre son contrôle, donc le verdict de `controlerReponsesHttp` n'est jamais rendu. C'est pourquoi le diagnostic de plantage (`:964`) a été ajouté : la mutation affiche alors `401 GET /api/eleves (prof:prof-1)` avant le timeout. Le contrôle apporte donc (1) un échec net avec l'URL en cause pour un 4xx silencieux qui ne bloque pas le scénario, (2) un diagnostic pour ceux qui le bloquent ; il ne remplace pas les assertions fonctionnelles.

### D. Limites
- Seules les réponses vues par `page.on("response")` : une requête avortée (`requestfailed`, ex. polices `fonts.gstatic.com`, interceptées volontairement) n'est pas une réponse et n'est pas contrôlée.
- Les 4xx que le navigateur reçoit d'un `fetch` sont vus ; ceux des appels directs `appeler(...)` du harnais (sans navigateur) ne passent pas par ce contrôle — ils sont déjà assertés par leur statut.
- Un scénario qui devra un jour provoquer un 4xx par l'interface devra le DÉCLARER (`attendues`), avec sa raison.
## §22 : RLS activé (sans police) sur `invitations_prof` et `profs`

Petite PR de sécurité, née de la question « comment amorcer le premier professeur » : `schema.sql:4-6` note que RLS est absent, et aucune instruction `enable row level security` ni `create policy` n'existait dans le dépôt. **Migration SQL : OUI** — deux instructions idempotentes, dans le même commit que `schema.sql` (règle de `CLAUDE.md`) : `supabase/migrations/cumulatif.sql:171-172` (à EXÉCUTER sur la vraie base) et `supabase/schema.sql:270-271`.

### A. Pourquoi ces deux tables
- `invitations_prof` : lisible ⇒ codes d'invitation volés ; **inscriptible ⇒ un code forgé = un compte professeur sans invitation** (`lib/routes/inscription-prof.ts:68-72` ne vérifie que l'existence de la ligne).
- `profs` : identifiants des comptes professeurs (et `eleve_apercu_id`).
- RLS activé **sans aucune police** : `anon` et `authenticated` n'ont accès à aucune ligne ; `service_role` (le seul client serveur, `lib/supabaseAdmin.ts:9-14`) contourne RLS. Le navigateur n'utilise la clé `anon` que pour `auth` (`createClient` dans `prof.html:1318`, `eleve.html:331`, `index.html:185` ; aucun `.from(` dans `public/`) : **l'application n'est pas affectée**.

### B. Ce qui est livré
- `supabase/migrations/cumulatif.sql:171-172`, `supabase/schema.sql:270-271` (+ commentaire d'avertissement « aucune police sans décision explicite », `schema.sql:263-269`, et renvoi en tête de fichier `schema.sql:7-8`).
- `scripts/test-rls-schema.ts` (15 vérifications, npm `test-rls-schema`) : les deux fichiers activent RLS sur exactement ces deux tables, aucune `create policy`, aucun `disable`, mêmes tables créées dans les deux fichiers, liste figée des 11 tables sans RLS (§D). Mutations vérifiées : retrait de la ligne dans `schema.sql` (2 échecs), dans `cumulatif.sql` (2), ajout d'une police (1).

### C. Vérification sur un vrai PostgreSQL 16 (cluster local jetable, rôles `anon`/`authenticated`/`service_role` ÉMULÉS avec les privilèges par défaut de Supabase — ce n'est PAS la vraie plateforme)
1. AVANT (état de `main`) : `cumulatif.sql` sur base vide OK ; `anon` **lit** `SECRET-SERVICE` dans `invitations_prof` et **insère** `FORGE-PAR-ANON` (total 2 lignes).
2. APRÈS, migration rejouée deux fois sur cette base (idempotence OK) : `relrowsecurity = true` sur `invitations_prof` et `profs` ; `anon` et `authenticated` : 0 ligne visible ; `anon` insère → `ERROR: new row violates row-level security policy for table "invitations_prof"` ; `service_role` lit toujours les lignes (y compris celle forgée avant la migration).
3. `schema.sql` sur base neuve : même résultat.
**Non vérifié : la vraie base Supabase.** Contrôle à y faire après exécution :
`select relname, relrowsecurity from pg_class where relname in ('invitations_prof','profs');` (attendu : `true, true`) ; puis, avec la clé `anon` du projet, `GET {SUPABASE_URL}/rest/v1/invitations_prof?select=code` doit renvoyer `[]`. **Un code forgé AVANT cette migration reste dans la table** : la vider ou la relire (`select * from invitations_prof`) est un contrôle à faire, et `select * from profs` pour repérer un compte inattendu.

### D. Étendue (question posée séparément, NON traitée ici)
Même mécanisme sur les 11 autres tables — `aides_utilisees, classes, debuts_ecran, eleves, exercices_assignes, inscriptions, reponses, taches, taches_assignations, taches_assignations_eleves, taches_composition` : RLS absent, privilèges `anon` par défaut. Mesuré sur le cluster local : `anon` lit une ligne de `classes` et de `eleves` et **modifie** `eleves` (`update … returning` → `PIRATÉ`). Liste figée dans `scripts/test-rls-schema.ts` : y ajouter RLS devra la modifier.

### E. Limites
- Test statique : il ne prouve pas le comportement de la base, seulement que le SQL reste présent ; la preuve de comportement est le §C (émulation).
- Sans police, la lecture d'un client `authenticated` est aussi vide : si un futur écran lit ces tables depuis le navigateur, il faudra une police, décision explicite.


## §23 : RLS activé (sans police) sur les 11 autres tables — les 13 tables du pilote sont protégées

Suite de la §22 (question d'étendue, §22-D) sur ordre explicite. **Migration SQL : OUI** — 11 instructions idempotentes, dans le même commit que `schema.sql` : `supabase/migrations/cumulatif.sql:176-186` (à EXÉCUTER sur la vraie base — la PR #9 (§22) doit l'avoir été avant ou en même temps) et `supabase/schema.sql:278-288` (comment `:274-277`).

### A. Tables
`aides_utilisees, classes, debuts_ecran, eleves, exercices_assignes, inscriptions, reponses, taches, taches_assignations, taches_assignations_eleves, taches_composition`. Avec la §22 : `pg_class.relrowsecurity = true` sur 13 tables sur 13 (mesuré sur base neuve issue de `schema.sql`).

### B. Preuve avant/après sur un vrai PostgreSQL 16 (cluster local jetable, rôles `anon`/`authenticated`/`service_role` ÉMULÉS avec les privilèges par défaut de Supabase)
Une ligne insérée dans chacune des 13 tables, puis lecture (`select count(*)`) et modification (`update t set 1re_colonne = 1re_colonne`) sous chaque rôle :
- **AVANT (base construite depuis `schema.sql`/`cumulatif.sql` de `main` — RLS sur 2 tables — dans un cluster SANS event trigger ni réglage de plateforme ; ce n'est PAS l'état constaté de la production, voir §G)** : `anon` lit **1 ligne et modifie 1 ligne** dans **11 tables sur 13** ; `authenticated` lit 1 ligne dans les mêmes 11 ; `invitations_prof` et `profs` : 0/0.
- **APRÈS (migration rejouée deux fois sur cette base, données présentes = idempotente)** : `anon` et `authenticated` : **0 ligne lue, 0 modifiée sur les 13 tables** ; `service_role` : 1 ligne lue partout.
- `schema.sql` sur base neuve + mêmes lignes : même résultat.

### C. « Aucun mécanisme Supabase interne n'a besoin d'un accès anon » — ce qui est PROUVÉ, et ce qui ne l'est pas
Prouvé par le code du dépôt :
1. Le seul client serveur est `supabaseAdmin()` (`service_role`), `lib/supabaseAdmin.ts:8-15` ; `SUPABASE_ANON_KEY` n'est lue que par `lib/routes/config.ts:17` pour la remettre au navigateur.
2. Le navigateur ne fait que de l'authentification (`createClient` : `prof.html:1318`, `eleve.html:331`, `index.html:185`) : aucun `.from(`, `.rpc(`, `.channel(`, `.storage`, `functions.invoke` dans `public/`, `lib/`, `api/`, `src/`.
3. Aucun trigger, fonction, vue, publication Realtime, `security definer`, `grant` ni extension dans `schema.sql`/`cumulatif.sql` : rien côté base ne lit ces tables sous un autre rôle.
Prouvé sur le cluster local (propriétaire NON superuser `postgres_sim`, tables créées par lui, comme le rôle `postgres` de Supabase) :
4. Le propriétaire lit tout malgré RLS (le SQL Editor / Table Editor du dashboard se connectent en `postgres`, propriétaire) : 1 ligne dans `classes`, `eleves`, `invitations_prof`, `reponses`.
5. Le rôle qui joue GoTrue (`supabase_auth_admin`, droits sur `auth.users` seulement) supprimant un compte encore référencé par `profs` obtient **`violates foreign key constraint "profs_id_fkey"`**, comptes intacts : le contrôle de clé étrangère n'est pas aveuglé par RLS (les vérifications d'intégrité référentielle ignorent RLS).
6. `service_role` : `insert` / `update` / `delete` réussis sur `invitations_prof` et `reponses`.
**NON prouvé (documentation supabase.com bloquée par le proxy de cette session : `EGRESS_BLOCKED`)** : que le tableau de bord, Auth (GoTrue), Realtime ou Storage réels n'interrogent jamais ces tables sous `anon`/`authenticated`. Ce que je sais de l'architecture (GoTrue n'utilise que le schéma `auth` ; le dashboard se connecte en `postgres`) n'est PAS vérifié ici et repose sur ma connaissance générale. Contrôle à faire sur la vraie base après exécution : connexion prof, connexion élève, inscription élève et prof, une réponse d'élève, un rechargement du tableau de bord — puis `GET /rest/v1/eleves?select=nom` avec la clé `anon` (attendu `[]`). (État de ce contrôle : voir §G.)

### D. Piège trouvé en vérifiant — `signInWithPassword` change le rôle du client (mesuré avec `@supabase/supabase-js` 2.115.0 réel, `fetch` simulé)
Sur un client créé avec la clé de service : `admin.from(...)` avant `signInWithPassword` part avec `Authorization: Bearer <service_role>` ; **après, le MÊME client envoie `Bearer <JWT de l'utilisateur>`** (rôle `authenticated` ⇒ RLS s'applique, sans police : 0 ligne / écriture refusée). `admin.auth.admin.*` garde la clé de service (mesuré). Aucun code actuel n'est touché (les trois routes qui appellent `signInWithPassword` — `connexion-eleve.ts:84`, `inscription-eleve.ts:69`, `inscription-prof.ts:100` — ne font AUCUN accès aux données après), mais avant cette PR le piège était invisible (RLS absent) et il aurait échoué en silence. Garde-fou : `lib/supabaseAdmin.ts` (commentaire, ancien texte « RLS hors scope » corrigé) + `scripts/test-rls-schema.ts` (découverte automatique des fichiers appelant `signInWithPassword`, exactement 3 attendus, aucun `.from(`/`.rpc(`/`provisionnerEleve(` textuellement après).

### E. Test qui verrouille la liste
`scripts/test-rls-schema.ts` : 15 → 47 vérifications. Dans `schema.sql` ET `cumulatif.sql` : RLS sur exactement les 13 tables de la liste figée, aucune table créée sans RLS, aucune `create policy`, aucun `disable`, mêmes tables dans les deux fichiers, garde-fou `signInWithPassword` + témoin. Mutations vérifiées : retrait d'une ligne dans chaque fichier (2 échecs chacun), table nouvelle sans RLS dans `cumulatif.sql` (3), police (1), accès aux données après `signInWithPassword` (1).

### F. Limites
- Test statique : la preuve de comportement est le §B (émulation, pas la plateforme). Le garde-fou `signInWithPassword` est textuel (ordre dans le fichier) : une fonction qui reçoit le client déjà connecté n'est pas vue.
- Sans police, un futur écran qui lirait ces tables depuis le navigateur ne recevra rien : il faudra une police, décision explicite, avec un test refus + accès.
- Les lignes de `RAPPORT.md` antérieures qui disent « RLS hors scope » (`schema.sql` en-tête, sections anciennes) sont historiques ; l'état courant est ce paragraphe et CLAUDE.md.

### G. Constats sur la VRAIE base (rapportés par le professeur, non reproduits par la session — aucun accès réseau/identifiants ici)
- **Écart code / production.** Sur la vraie base, `relrowsecurity = true` pour `taches`, `classes`, `eleves`, `reponses`, alors qu'aucune instruction `enable row level security` n'existait dans `schema.sql`/`cumulatif.sql` avant §22. Les 9 autres tables n'ont PAS encore été relevées. **Cause NON établie** : hypothèses (création par le Table Editor, case « Enable RLS » ; option de projet/event trigger activant RLS sur les nouvelles tables ; activation manuelle) — à départager par `select * from pg_event_trigger` et `pg_get_functiondef` ; aucune source consultée (documentation supabase.com bloquée : `EGRESS_BLOCKED`).
- **Écriture : preuve en conditions réelles OBTENUE.** `POST /rest/v1/invitations_prof` avec la clé `anon` du projet → **`42501` — `new row violates row-level security policy for table "invitations_prof"`**. La forme du message (violation de politique, et non `permission denied for table`) montre que `anon` a le privilège d'écriture et qu'aucune police ne l'autorise : RLS activé, sans police permissive, sur cette table en production.
- **Lecture : non testée séparément.** `GET /rest/v1/eleves` avec la clé `anon` a renvoyé `[]`, mais la table `eleves` de la production était **vide** (précisé par le professeur) : ce `[]` n'est donc PAS une preuve de blocage, seulement l'absence de données. La lecture n'a pas fait l'objet d'une preuve propre ; elle est jugée protégée par le MÊME mécanisme que l'écriture (RLS activé sans police permissive : ni `using` ni `with check` ne laissent passer `anon`). Décision du professeur : vérification en production **close** sur cette base.
- **Réserves qui subsistent (jugées acceptées, non levées).** (1) La preuve d'écriture porte sur `invitations_prof` : elle ne vaut pour une autre table que si RLS y est actif — vrai après exécution de `cumulatif.sql` (§22-§23), non relevé pour 9 tables avant. (2) « Sans police » est établi par le dépôt, pas par la base : `select * from pg_policies where schemaname = 'public'` (attendu 0 ligne) n'a pas été rapporté. Ces deux points se vérifient par SQL (`relrowsecurity` sur les 13 tables, `pg_policies`), sans requête HTTP ; ils ne remettent pas en cause la décision de clore.
- **Conséquence sur la portée des PR #9/#10.** Ces migrations sont idempotentes et probablement sans effet sur les tables où RLS est déjà actif ; leur valeur est de **documenter et garantir l'intention** dans le seul fichier exécuté (`cumulatif.sql`) pour toute base reconstruite (staging, reprise après sinistre, autre projet) et de faire échouer `test-rls-schema.ts` si une table est ajoutée sans RLS, au lieu de dépendre d'un comportement de plateforme non garanti dans le temps. Les tests statiques ne voient pas une police créée à la main dans le dashboard : requête `select * from pg_policies where schemaname = 'public'` à lancer (attendu 0 ligne).


### H. Réserves du §G levées (relevés SQL sur la vraie base, rapportés par le professeur, non reproduits par la session)
- **`relrowsecurity = true` sur les 13 tables.** Aux 4 déjà relevées (`taches`, `classes`, `eleves`, `reponses`) s'ajoutent les 9 restantes : `aides_utilisees`, `debuts_ecran`, `exercices_assignes`, `inscriptions`, `invitations_prof`, `profs`, `taches_assignations`, `taches_assignations_eleves`, `taches_composition`. Réserve n°1 du §G : levée.
- **`select count(*) from pg_policies where schemaname = 'public'` → 0.** Aucune police nulle part sur la base réelle (y compris créée à la main dans le dashboard, ce que `scripts/test-rls-schema.ts` ne voit pas). Réserve n°2 du §G : levée.
- **Conclusion.** Sur la base réelle, les 13 tables ont RLS activé et aucune police : `anon` et `authenticated` n'ont accès à aucune ligne, en lecture comme en écriture (même mécanisme, aucune police permissive). Preuves : catalogue (`relrowsecurity`, `pg_policies`) pour les 13 tables + preuve HTTP d'écriture sur `invitations_prof` (`42501`). Ce qui n'a JAMAIS été exercé en HTTP : une lecture `anon` sur une table non vide (`eleves` était vide) ; elle est déduite du mécanisme, sans réserve restante.
- **Cause de l'écart code/production (§G, 1er point) toujours non établie** : RLS était déjà actif sur la base réelle avant les migrations de ce dépôt ; `pg_event_trigger` n'a pas été rapporté. Sans effet sur la protection, à connaître si une base est reconstruite : c'est `cumulatif.sql` (§22-§23) qui garantit désormais le RLS, plus un comportement de plateforme.


## §24 : Diagnostic TEMPORAIRE — « Code d'invitation invalide » en production (DIAG-INVITATION)

**Temporaire : à supprimer dès la cause trouvée** (supprimer `lib/diagInvitation.ts`, `scripts/test-diag-invitation.ts`, son entrée `package.json`, et les 3 lignes marquées `DIAG-INVITATION` de `lib/routes/inscription-prof.ts`). Aucun SQL, aucun changement de comportement.

### A. Contexte (établi avant ce traçage)
Le formulaire n'a aucune validation côté client (`public/prof.html:174-190`, `:4050-4066` : la valeur du champ part telle quelle) ; le serveur fait `code.trim()` puis `.eq("code", code).maybeSingle()` (`lib/routes/inscription-prof.ts:64,68-72`), égalité STRICTE et sensible à la casse ; **`erreurInvitation || !invitation` renvoie le même 404 « Code d'invitation invalide »** (ligne 73) qu'il y ait « aucune ligne » ou une erreur de requête réelle, l'erreur étant jetée. Trace Chromium locale (base en mémoire) : espaces, tabulation, espace insécable → 201 ; majuscule initiale, tout en majuscules, tirets typographiques, U+200B, caractère manquant → 404. Sur la production (constaté par le professeur) : code copié-collé, URL et rôle de clé confirmés corrects, échec identique ⇒ cause côté serveur/base, ou erreur de requête masquée.

### B. Ce que le traçage écrit (une ligne `DIAG-INVITATION {json}` par étape, dans les logs de la fonction)
- `avant` (`lib/diagInvitation.ts`, `diagAvant`) : le code reçu tel quel (`recu`, échappé par JSON), `longueurRecu` / `longueurApresTrim`, `pointsDeCodeRecu` (U+ en hexadécimal de chaque caractère), `hoteSupabaseUrl` (hôte seulement), `cleService` = revendications NON secrètes `role` / `ref` / `iss` du JWT de la clé de service (jamais la clé). Le `ref` permet de voir une clé d'un AUTRE projet que l'URL (une clé valide mais étrangère donne « Invalid API key » côté PostgREST, donc le même message masqué).
- `apres` (`diagApres`) : `erreurRequete` (`message`, `code`, `details`, `hint` PostgREST) **distincte** de « aucune ligne » ; `decision` ∈ `TROUVE` / `AUCUNE_LIGNE` / `ERREUR_DE_REQUETE`.
- `controle` (seulement quand la route va répondre « invalide ») : une lecture de contrôle de `invitations_prof` (50 lignes max, `count: exact`) : `nombreLignesVues`, `compteExact`, et pour chacune des 10 premières lignes — SANS jamais écrire le code stocké : `longueurStocke`, `egalExact`, `egalApresTrimDuStocke`, `egalSansCasse`, `caracteresHorsHexTiret` (points de code), `utilise`.
- **Ajouts par rapport à la demande littérale** (code reçu + points de code, erreur distincte, nombre de lignes) : `cleService.ref`/`hoteSupabaseUrl` et les booléens de comparaison du contrôle — sans eux, un désaccord entre code stocké et code saisi serait invisible sans écrire le code stocké dans les logs. Retirables sans effet sur le reste.
- Le code SAISI est journalisé en clair, à la demande du professeur : c'est un code à usage unique ; il ne faut pas laisser ce diagnostic en place ensuite. Ni mot de passe, ni email, ni clé ne sont journalisés.

### C. Vérifications
`scripts/test-diag-invitation.ts` (16 vérifications) : réponse de la route inchangée dans tous les cas (201 / 404 / 404), cas « aucune ligne » distinct de « erreur de requête » (`PGRST301` simulée), points de code et longueurs (majuscule `0046`, U+200B `200b`, longueur 40 → 37), `nombreLignesVues` (1 puis 0), code stocké jamais dans les logs, aucun mot de passe / email. Vérifié aussi avec le vrai `@supabase/supabase-js` (fetch simulé) : les deux requêtes sont bien formées (`GET …?select=code,utilise&code=eq.…`, puis `GET …?select=code,utilise&limit=50` avec `Prefer: count=exact`).

### D. Comment lire les logs après une tentative
| Ce que montrent les lignes | Cause |
|---|---|
| `decision: ERREUR_DE_REQUETE` (message/code/hint) | erreur PostgREST masquée par la ligne 73 (clé invalide → `PGRST301`/`Invalid API key`, table introuvable → `42P01`/`PGRST205`, droit refusé → `42501`) |
| `AUCUNE_LIGNE`, `nombreLignesVues: 0` | le serveur ne voit aucune ligne : autre projet/base que celle où le code a été inséré (comparer `cleService.ref` et `hoteSupabaseUrl` au projet), ou clé sans droit de lecture (RLS actif sans police + clé non `service_role`) |
| `AUCUNE_LIGNE`, `nombreLignesVues ≥ 1`, aucun `egalExact` | désaccord de contenu : `egalSansCasse` / `caracteresHorsHexTiret` / `longueurStocke` / `pointsDeCodeRecu` le montrent |
| `TROUVE` | la recherche réussit ; le 404 vient d'ailleurs (la réponse serait alors 400 « déjà utilisé » ou 500, à recouper avec le corps de la réponse) |

À compléter (cause, correctif, retrait du diagnostic) une fois les logs lus.


## §25 : `SUPABASE_URL` terminée par `/rest/v1/` — cause du « Code d'invitation invalide » ; normalisation défensive

Aucun SQL. Cause trouvée grâce au diagnostic du §24 et à `GET /api/config` (rapporté par le professeur) : la variable d'environnement `SUPABASE_URL` de la production valait `https://<ref>.supabase.co/rest/v1/`.

### A. Le client Supabase ajoute BIEN son propre chemin — confirmé dans le code et par mesure
- Code (`@supabase/supabase-js` 2.115.0, `node_modules/@supabase/supabase-js/dist/index.cjs`) : `validateSupabaseUrl` (l. 378-387) ne fait qu'ajouter une barre finale ; le constructeur fait `new URL("auth/v1", baseUrl)` (l. 628), `"storage/v1"`, `"realtime/v1"`, `"functions/v1"` (l. 626-630) et `new PostgrestClient(new URL("rest/v1", baseUrl).href, …)` (l. 660).
- Mesure (vrai client, `fetch` simulé, `from("invitations_prof").select().eq().maybeSingle()` puis `auth.signInWithPassword`) :

| `SUPABASE_URL` | chemins émis |
|---|---|
| `https://abc.supabase.co` et `https://abc.supabase.co/` | `/rest/v1/invitations_prof` · `/auth/v1/token` |
| `https://abc.supabase.co/rest/v1/` (le cas réel) | **`/rest/v1/rest/v1/invitations_prof`** · **`/rest/v1/auth/v1/token`** |
| `https://abc.supabase.co/rest/v1` (sans barre) | idem, doublé |

`/rest/v1/rest/v1/…` : PostgREST répond `PGRST125 Invalid path`. Deuxième conséquence, plus large que l'inscription : l'authentification (`/rest/v1/auth/v1/token`) échouait aussi, côté serveur (`signInWithPassword`, `getUser`) ET côté navigateur (`prof.html:1318`, `eleve.html:331`, `index.html:185` construisent leur client avec la valeur servie par `/api/config`). Aucun compte n'avait pu se connecter sur cette base neuve, ce qui explique que le défaut n'ait pas été vu avant. Le message « Code d'invitation invalide » venait de la ligne 73 de `lib/routes/inscription-prof.ts` (`erreurInvitation || !invitation`), qui jetait l'erreur PostgREST.

### B. Ce qui est livré
- `lib/urlSupabase.ts` : `normaliserUrlSupabase` (retire un suffixe final `/rest|auth|storage|realtime|functions/v1` avec ou sans barre, insensible à la casse, plus les barres/espaces finaux ; un chemin de proxy avant le suffixe est conservé) et `lireSupabaseUrl` (**avertit dans les logs, une fois par valeur brute**, nommant le suffixe retiré et la valeur utilisée). Seule lecture de `process.env.SUPABASE_URL` du dépôt (hors le diagnostic temporaire du §24).
- `lib/supabaseAdmin.ts` (`supabaseAdmin`) et `lib/routes/config.ts` (`GET /api/config`, donc le navigateur) passent par `lireSupabaseUrl`. Règle ajoutée à `CLAUDE.md`.
- `scripts/test-url-supabase.ts` (28 vérifications) : 16 cas de normalisation ; avertissement unique ; **vraies requêtes du vrai client** via `supabaseAdmin()` avec la variable fautive (`/rest/v1/`, `/rest/v1`, `/auth/v1/`, `/`, correcte) → toujours `/rest/v1/invitations_prof` puis `/auth/v1/token` ; `GET /api/config` renvoie l'URL corrigée ; **témoin** : le client brut avec l'URL fautive double bien les chemins (si supabase-js le corrigeait un jour, ce témoin le dirait) ; erreur d'origine conservée si la variable manque ; aucun autre fichier de `lib/`, `api/`, `src/` ne lit `SUPABASE_URL`. Mutations vérifiées : `supabaseAdmin` sans normalisation (3 échecs), `config` sans normalisation (1), sans avertissement (2).

### C. Limites
- **Corriger la variable sur Vercel reste la bonne réponse** (`https://<ref>.supabase.co`, sans chemin) ; la normalisation évite seulement l'échec silencieux et prévient dans les logs (visible dans les logs Vercel, pas dans l'interface).
- Ne traite que cette famille de suffixes : une URL d'un autre projet, une clé d'un autre projet, ou une faute de frappe dans l'hôte ne sont pas détectées.
- **Non traité (proposition)** : `inscription-prof.ts` répond « invalide » (404) même quand la requête à la base échoue (`erreurInvitation`). Une erreur de requête devrait être un 500 journalisé, pas un message qui accuse l'utilisateur ; le diagnostic §24 la rend visible mais ne la corrige pas. À décider à part.
- Le diagnostic DIAG-INVITATION (§24) est toujours en place : à retirer après confirmation que l'inscription fonctionne avec la variable corrigée.


## §26 : Rôle admin-prof — gestion des comptes professeurs

Décisions D1-D8 validées avant le « Go » (`ANALYSE-admin-prof.md`) ; D3 (garde-fous admin) confirmée **essentielle**. **Migration SQL : OUI, à EXÉCUTER sur la vraie base AVANT la fusion** (§C).

### A. Ce que fait le patron élève, et où le rôle prof s'en écarte (relu avant d'écrire)
`desactiver-eleve.ts` = `eleves.actif = false` seulement, appliqué à la connexion serveur (`connexion-eleve.ts:92`) et dans les listes ; `reset-mdp-eleve.ts` = `auth.admin.updateUserById(password)` ; `creer-eleve.ts` = `provisionnerEleve`. **Écarts assumés pour les profs** : (1) le prof se connecte directement depuis le navigateur (`prof.html`, `signInWithPassword`), un drapeau seul serait donc sans effet ; (2) `profs` n'a ni `actif` ni e-mail. Constat hors périmètre, **noté sans être corrigé** : `eleveAuthentifie` (`lib/supabaseAdmin.ts`) ne lit pas `eleves.actif` — une session d'élève ouverte survit à sa désactivation, le compte Auth n'est pas banni (à traiter séparément, décision du professeur).

### B. Livré (citations)
| Sujet | Emplacement |
|---|---|
| Schéma canonique | `supabase/schema.sql:18-19` (`profs.est_admin`, `profs.actif`), `:271` (`invitations_prof.email_cible`, `cree_par`) |
| **Migration idempotente** | `supabase/migrations/cumulatif.sql:188-192` (4 × `add column if not exists`) |
| Règle d'accès (pure) | `lib/authProf.ts:21` `profDepuisLigne` : seul `actif === false` refuse |
| `profAuthentifie` | `lib/supabaseAdmin.ts:28` — lit `id, nom, actif, est_admin` (`:37`) à CHAQUE requête ; 17 fichiers de routes l'appelaient déjà : un compte désactivé reçoit 401 partout |
| Garde admin | `lib/adminAuth.ts:10` `exigerAdmin` : 401 non authentifié / désactivé, **403 « Réservé aux administrateurs »** ; appelé AVANT toute validation de corps |
| Création partagée | `lib/provisionnerProf.ts:18` (utilisée par `inscription-prof.ts:95` ET `admin/profs/creer.ts`), **supprime le compte Auth si l'insertion `profs` échoue** (`:28`) ; ne connaît pas `est_admin` |
| Cible d'une action | `lib/adminProfs.ts:30` `chargerCibleProf` (UUID mal formé ou inconnu → 404, jamais une erreur PostgREST) |
| `GET /api/admin/profs` | `lib/routes/admin/profs/index.ts:21` (`exigerAdmin` `:26`) — e-mails lus dans Auth par lots, pagination `recupererToutesLesLignes` |
| `POST /api/admin/profs/creer` | `…/creer.ts:15` — corps `{email, motDePasse, nom}` EXACTEMENT (toute autre clé, dont `est_admin`, → 400) ; e-mail déjà pris → 409 |
| `POST /api/admin/profs/inviter` | `…/inviter.ts:13` — `{email}` seul, `randomUUID`, lié à l'e-mail, `cree_par` |
| `POST /api/admin/profs/:id/desactiver` | `…/[id]/desactiver.ts:14` — `actif=false` PUIS `ban_duration 876000h` ; jamais soi-même, jamais un admin |
| `POST /api/admin/profs/:id/reactiver` | `…/[id]/reactiver.ts:11` — lève le ban PUIS `actif=true` |
| `POST /api/admin/profs/:id/reset-mdp` | `…/[id]/reset-mdp.ts:14` — jamais sur un admin (soi compris) |
| `GET /api/profs/moi` | `lib/routes/profs/moi.ts:10` — `{id, nom, est_admin}` |
| Routage | `api/router.ts:71-119` |
| Inscription liée à l'e-mail | `lib/routes/inscription-prof.ts:85` — `email_cible` non nul et différent (insensible à la casse) → **même 404 générique**, testé AVANT « déjà utilisé » ; nul (codes historiques) → utilisable par tous |
| Interface | `public/prof.html:221` (bouton d'onglet `hidden`), `:502` (panneau), `:4157` `chargerIdentiteProf`, `:4265` `construireLigneProfAdmin` ; `style.css` (mêmes composants que les élèves, tokens uniquement) |

### C. Migration et ordre de déploiement — **risque réel**
`profAuthentifie` lit désormais `actif` et `est_admin`. **Tant que `cumulatif.sql` n'a pas été exécuté, la lecture échoue (colonne absente) et TOUTES les routes prof répondent 401.** Ordre : (1) exécuter `supabase/migrations/cumulatif.sql` en entier (idempotent) ; (2) fusionner / déployer ; (3) promouvoir le premier admin (§D). Vérifié sur PostgreSQL 16 local : `schema.sql` sur base neuve (colonnes `est_admin boolean not null default false`, `actif boolean not null default true`, `email_cible text`, `cree_par uuid` avec FK vers `profs`) ; `cumulatif.sql` de `main` rejoué sur une base ANCIENNE avec données, puis deux fois : profs existants → `est_admin=false, actif=true`, invitation historique → `email_cible` et `cree_par` nuls ; RLS toujours actif sur `profs` et `invitations_prof`, `anon` lit 0 ligne de `profs` ; FK `cree_par` refuse un id inconnu.

### D. Bootstrap du premier admin (une seule fois, hors code) — requête testée sur PostgreSQL 16
Après l'exécution de `cumulatif.sql` et le déploiement, dans le SQL Editor de Supabase :
```sql
update profs set est_admin = true
where id = (select id from auth.users where lower(email) = lower('VOTRE@EMAIL'))
returning id, nom, est_admin;
```
Attendu : **1 ligne** (`est_admin = t`). 0 ligne = e-mail inconnu (aucune erreur, aucune modification). Puis se reconnecter (ou recharger `prof.html`) : `GET /api/profs/moi` doit renvoyer `est_admin: true` et l'onglet « Admin » apparaît. Le statut admin ne s'accorde JAMAIS par l'interface ni l'API (test statique : aucune route n'écrit `est_admin`). Retirer ce statut : `update profs set est_admin = false where id = …`.

### E. Point 4 — liaison code ↔ e-mail : FAIT (D4)
Faisable sur le schéma réel (`invitations_prof` : `code`, `utilise`, `cree_le`) : deux colonnes nullables. Obligatoire pour les codes générés par l'interface ; les codes historiques (NULL) restent utilisables par n'importe qui. Discordance = 404 générique identique à « code inexistant » (test : réponses identiques, aucun oracle), avant le test « déjà utilisé ». Coût réel : 2 colonnes, 8 lignes dans `inscription-prof.ts`, un champ de formulaire.

### F. Validation
- `tsc -b` propre ; **28/28 scripts** ; `scripts/test-admin-profs.ts` **117 vérifications** (les VRAIES routes via `api/router.ts`, base en mémoire) : pour chacune des 6 routes admin × {sans jeton, jeton élève, prof non admin (valide ET corps invalide), admin désactivé, mauvaise méthode} → 401 / 403 explicite / 405 sans aucun effet de bord ; `GET /profs/moi` ; liste ; création directe (compte Auth + ligne non admin, `est_admin`/`actif` dans le corps → 400, doublon → 409) ; invitation puis inscription (bon e-mail à la casse près, mauvais e-mail, code déjà utilisé, code historique) ; désactivation (ban 876000h, 5 routes → 401, classe conservée, idempotente, échec du ban → 500 état sûr) ; réactivation ; réinitialisation ; garde-fous (soi-même, autre admin, id inconnu/mal formé) ; le VRAI `profAuthentifie` avec client factice (colonnes lues, désactivé refusé, erreur de lecture refusée) ; compensation de `provisionnerProf` ; aucune écriture de `est_admin` dans `lib/`, `api/`, `src/`.
- **Mutations vérifiées (19)** : retrait de `exigerAdmin` de chacune des 6 routes, du test `est_admin`, de la règle `actif`, de la lecture des colonnes, de chaque garde-fou (soi, autre admin en désactivation, autre admin en reset), du ban, du contrôle `email_cible` (et son ordre), de la clé `est_admin` acceptée, de la compensation, d'une écriture `est_admin`, de la traduction 409 : chacune fait échouer le test.
- **Chromium 496/496** (`scenarioAdmin`, 390 px et 1280 px) : prof non admin → aucun onglet et l'API refuse à la main (403, déclaré) ; admin → onglet visible, liste (e-mail Auth, « Administrateur », « (vous) », « Compte désactivé »), aucune action sur un admin, création, code affiché EN ENTIER (un `<input>` le tronquait à 390 px : remplacé par `.code-invitation`), désactivation avec confirmation, réactivation, réinitialisation, pas de défilement horizontal, 5 onglets lisibles. Captures `captures-chromium/{390,1280}-13…16-admin-*.png`.
- Régression existante inchangée (aucune assertion modifiée ; `profAuthentifie` du harnais partage `profDepuisLigne`).

### G. Limites et constats
- **Non vérifié** : le comportement réel de GoTrue pour un compte banni (refus de connexion ET de renouvellement de jeton). Le verrou qui compte est côté API (`profAuthentifie`, testé) ; le ban est une deuxième ceinture, à essayer sur la vraie base (désactiver un compte test puis tenter de se connecter).
- Un jeton d'accès déjà émis reste valide jusqu'à son expiration, mais `profAuthentifie` le refuse à chaque requête (401).
- Réinitialiser le mot de passe d'un prof ordinaire permet de se connecter à son compte (accès à ses élèves) : pouvoir inhérent, **aucun journal d'audit**. Aucun admin ne peut être désactivé ni réinitialisé par l'API (y compris par lui-même) : le retirer/désactiver = SQL.
- Pas de liste des invitations en attente (D7) : un code perdu se retrouve par SQL (`select code, email_cible from invitations_prof where not utilise`). Deux codes peuvent être générés pour le même e-mail.
- Trouvé en testant : dans le harnais Chromium, `prof.html` interrompt son chargement après `chargerClasses` (`Cannot read properties of undefined (reading 'slice')`, `GET /api/eleves?classe_id=undefined`) — antérieur à ce chantier, non corrigé. Conséquence traitée : `chargerIdentiteProf` s'exécute AVANT les autres chargements et a son propre `try/catch`, pour que l'onglet « Admin » ne dépende d'aucun chargement sans rapport.
- **Ordre des PR (D8)** : celle-ci modifie `lib/routes/inscription-prof.ts` près des lignes `DIAG-INVITATION` (§24, temporaires) ; à fusionner après la PR #13 et le retrait du diagnostic. Le diagnostic est toujours en place.


## §27 : Chromium — la vraie cause du chargement interrompu de `prof.html` (faux Supabase) + lecture des erreurs affichées

Correction du §26-G, qui décrivait ce défaut comme « antérieur à ce chantier, non corrigé » sans en avoir cherché la cause : le contournement (`chargerIdentiteProf` d'abord) masquait le symptôme. Aucun code de production touché, aucune migration SQL.

### A. Ce que le contrôle des 4xx (§21) a vu : rien — et il ne pouvait pas le voir
Trace réelle du chargement de `prof.html` dans le harnais : `GET /api/classes` → **200** `[{"0":{"id":"classe-1","nom":"4A","code":"3NSR33"},"nombre_eleves_actifs":0}]` (objet emballé sous la clé `"0"`), `GET /api/eleves?classe_id=undefined` → **200** `[]`, puis `TypeError: Cannot read properties of undefined (reading 'slice')` dans `rendreBandeauEtMesClasses` (`prof.html:2262`), rattrapé par le `try/catch` de `init` qui écrit « Impossible de charger la configuration : … » dans `#statut-connexion`. **Aucune réponse >= 400, aucune erreur console, aucun `pageerror`** : les trois canaux surveillés étaient muets. Il n'a été découvert que parce que le nouveau scénario attendait `GET /api/profs/moi`, appelé après le plantage.
Les scénarios `prof` / `poids` existants passaient parce que leurs assertions ne portent que sur ce qui est chargé AVANT l'échec (`chargerCatalogue`) : `chargerTaches` et `chargerTableauDeBordProf` n'ont **jamais** été exécutés en Chromium avant ce correctif.

### B. Cause : le faux Supabase, pas le pont d'API
`lib/routes/classes.ts:56-62` génère paresseusement le `code` d'une classe qui n'en a pas : `update({code}).eq().select().single()`. PostgREST renvoie **un objet** ; `BaseMemoire.executer()` n'appliquait `.single()` / `.maybeSingle()` qu'à `select`, et renvoyait un **tableau** pour `update` / `insert` / `upsert`. `{ ...classe }` d'un tableau = `{ "0": ligne }`. Les classes du scénario (`creerScenario`) n'ont pas de `code` : le premier `GET /api/classes` prenait toujours cette branche. La route est correcte ; le pont d'API (`demarrerServeur`) relaie fidèlement.
Correctif : `scripts/support/fauxSupabase.ts` `enUneLigneSiDemande` (`.single()` sans ligne = erreur PGRST116, `.maybeSingle()` sans ligne = `null`), appliqué à `insert` / `upsert` / `update`.

### C. Lecture des erreurs affichées (`scripts/chromium-temoin-technique.ts`)
`LECTURE_ERREURS_INTERFACE` : à la fermeture de chaque contexte (`contexte.close` enveloppé dans `preparerPage`), le harnais lit `#erreur-fatale-pilote` (erreur fatale du pilote, `eleve.html` / `index.html`) et `#statut-connexion` (« Impossible de charger » / « Erreur inattendue », `prof.html`). `evaluerErreursInterface` les rapporte dans `controlerReponsesHttp` : tout message d'erreur affiché fait échouer le scénario. Témoin : une page qui n'a AUCUN signal HTTP / console / pageerror mais affiche l'erreur est bien lue.

### D. Mesures
- Avec le correctif : 28/28 scripts (aucune assertion modifiée), **Chromium 498/498** ; `prof.html` charge maintenant `/api/taches` et `/api/profs/tableau-de-bord` (trace : `config · profs/moi · catalogue · classes · eleves?classe_id=classe-1 · taches · tableau-de-bord`, `#statut-connexion` vide).
- **Mutation** : faux Supabase SANS correctif + garde-fou → **6 échecs** (scénarios `prof` et `admin` × 2 largeurs), message « erreur affichée à l'écran — statut-connexion : Impossible de charger la configuration : Cannot read properties of undefined (reading 'slice') ».

### E. Limites
- Le garde-fou ne lit que `#erreur-fatale-pilote` et `#statut-connexion` : une erreur écrite dans un autre élément (`#statut-liste-eleves`, `#statut-creer-prof`…) n'est pas vue. Un `catch` qui avale l'erreur SANS rien afficher reste invisible pour tous les canaux.
- `chargerIdentiteProf` reste appelé en premier (§26) : sa robustesse est voulue, mais la raison invoquée au §26-G (« défaut du harnais antérieur ») est remplacée par ce §27.
- D'autres écarts de fidélité du faux Supabase sont possibles (il n'implémente ni contraintes ni tous les opérateurs) : chacun se découvre à l'usage.


## §28 : Retrait du diagnostic DIAG-INVITATION (§24) ; bannissement Auth vérifié en production

Aucun SQL, aucun changement de comportement de la route : le diagnostic n'avait qu'observé.

### A. Retiré (tout ce que le §24 listait)
`lib/diagInvitation.ts` et `scripts/test-diag-invitation.ts` supprimés ; entrée `test-diag-invitation` retirée de `package.json` ; les 3 lignes marquées `DIAG-INVITATION` retirées de `lib/routes/inscription-prof.ts` (import, `diagAvant`, `diagApres`) ; deux mentions devenues fausses corrigées : `scripts/test-url-supabase.ts` (le seul lecteur de `SUPABASE_URL` est désormais `lib/urlSupabase.ts`) et `scripts/test-admin-profs.ts` (le silence de `console.log` qui n'avait plus d'objet). `grep DIAG-INVITATION|diagInvitation|diagAvant|diagApres` hors `RAPPORT.md` (historique) : aucun résultat.

### B. Motif : cause trouvée et corrigée (§25), inscription confirmée en production
`SUPABASE_URL` se terminait par `/rest/v1/` (chemins doublés `/rest/v1/rest/v1/…`, PGRST125) ; variable corrigée sur Vercel, et normalisée défensivement par `lireSupabaseUrl` (§25). Rapporté par le professeur après déploiement : une nouvelle inscription par code d'invitation fonctionne normalement.

### C. Le bannissement Auth (§26-G, « non vérifié contre le vrai GoTrue ») est vérifié pour la connexion
Rapporté par le professeur sur la vraie base : un compte désactivé par `POST /api/admin/profs/:id/desactiver` **ne peut plus se connecter** (refus par Supabase Auth). Non testé : le renouvellement d'un jeton déjà émis (couvert de toute façon par `profAuthentifie`, 401 à chaque requête).

### D. À faire de ton côté — les journaux de la période de diagnostic contiennent des codes
Pendant le diagnostic, la fonction écrivait le code d'invitation SAISI en clair dans les journaux Vercel. Ces lignes (`DIAG-INVITATION`) restent dans les journaux jusqu'à leur expiration. Un code déjà utilisé est inoffensif ; **un code encore non utilisé qui y figure resterait valable**. Vérifier et supprimer si besoin :
```sql
select code, email_cible, utilise, cree_le from invitations_prof where not utilise order by cree_le;
-- puis, pour chaque code non utilisé apparu dans les journaux :
delete from invitations_prof where code = '…';
```
### E. Non traité (proposition inchangée)
`inscription-prof.ts` répond toujours « Code d'invitation invalide » (404) quand la requête à la base ÉCHOUE (`erreurInvitation || !invitation`) : une panne de configuration comme celle du §25 reste indiscernable d'un code faux. Corriger = répondre 500 journalisé sur `erreurInvitation` seule. À décider séparément.


## §29 : « Durée (secondes) » du chrono désactivée mais non grisée (défaut visuel du formulaire de tâche)

Aucun SQL, aucun changement de comportement : seul le style change.

### A. Cause
Le grisage des champs verrouillés était écrit **champ par champ** : `#aide-penalite-pourcent:disabled { opacity: 0.5; cursor: not-allowed }` (règle nommée par identifiant), plus des règles par composant pour les interrupteurs (`.toggle-natif:disabled`), les steppers (`.ligne-reglage .stepper-bouton:disabled`, `input.stepper-valeur:disabled`) et `.champ-chrono-variante:disabled`. `#chrono-duree-secondes` est désactivé par le même `appliquerVerrouReglages` (`public/prof.html:2438`) mais **aucune règle ne le visait** : il n'existe pas de règle générique `input:disabled` ni `input[type="number"]:disabled` dans `style.css`. Ce n'était donc ni un problème de `disabled` (correct) ni d'héritage : un champ désactivé sans règle dédiée garde exactement l'apparence d'un champ actif.

### B. Reproduit avant de corriger (Chromium, rendu réel)
Chrono « Aucun » + aide décochée : `#aide-penalite-pourcent` → `opacity 0.5, cursor not-allowed` ; `#chrono-duree-secondes` → **`opacity 1, cursor default`** (identique à un champ actif). Une garde générale — « aucun `input:disabled` de l'onglet Tâches n'a l'apparence d'un champ actif » — ne trouvait que ce champ : **c'est le seul** du formulaire (les autres champs désactivés ont déjà leur règle).

### C. Correctif (`public/style.css:1104`)
La règle par identifiant est remplacée par une règle **par ligne de réglage** : `.ligne-reglage input:disabled, .ligne-reglage select:disabled { opacity: 0.5; cursor: not-allowed }`. Un futur champ verrouillé est grisé sans qu'on y pense. **Volontairement limitée à `.ligne-reglage`** : un `input:disabled` global grisé aussi les réponses verrouillées du moteur élève ; `.ligne-reglage` n'apparaît ni dans `eleve.html`, ni dans `index.html`, ni dans `public/moteur/` (0 occurrence).

### D. Vérification
`scripts/chromium-temoin-technique.ts` (scénario `prof`, 390 et 1280 px) : les deux champs désactivés sont grisés (`opacity < 1`, curseur `not-allowed`), réactivés ils retrouvent `opacity 1`, et la garde générale ne trouve aucun champ désactivé sans signe visuel. Avec l'ancien CSS : 4 échecs explicites (2 par largeur) ; avec le correctif : 508/508. Capture : `captures-chromium/{390,1280}-17-prof-champs-desactives-grises.png`.

### E. Limite
La garde ne parcourt que `#onglet-taches` dans l'état « chrono aucun, aide décochée, correction immédiate décochée » : un champ désactivé par un autre état ou dans un autre onglet n'est pas vu.


## §30 : Révision du composant `tableau_signes` — tableau structuré 2N+1, plein-bord, cycles sans retour à « ? », cases de variation fusionnées

Aucun SQL. Décisions actées avec l'utilisateur avant le « Go » : flag `racine` par colonne, clé d'ancrage des cases fusionnées, « Valider » désactivé tant qu'il reste un « ? » (**décision C4 inversée** : la prémisse « une tentative incomplète est soumissible ailleurs » était fausse — `public/moteur/moteur.js:152` désactive « Valider » quand `lireReponse() === null`, et tous les composants renvoient `null` s'il manque quelque chose), plein-bord jusqu'aux bords de la COLONNE (720 px sur bureau, bords de l'écran sur mobile), 44 px partout, libellés de ligne au-dessus des rangées.

### A. État avant la révision (écarts constatés par lecture)
Le cycle **revenait à « ? »** après la dernière valeur (`etat.valeur = suivant >= alphabet.length ? null : …`) ; alphabet **par ligne** seulement (rien ne distinguait intervalle / racine / sommet / pôle) ; colonnes `−∞`/`+∞` (`bornes`) et en-tête à deux niveaux (`sousLibelle`) ; tableau dans la carte avec conteneur à défilement horizontal ; aucune fusion de cases. Le contrat permettait déjà plusieurs lignes de signe. **Point 8 confirmé par lecture** (`spec-gen7-phase3a.md` §2.4, §2.5) : `yS` reste demandé dans `axeSommet` (±0,005) et `domaineImage` (`imf`) ; l'ancien tableau n'avait **jamais** de saisie numérique (cycle de symboles, §2.9).

### B. Contrat (`lib/contratGenerateur.ts:135-175`)
`ColonneTableauSignes` : `genre` (`intervalle`|`valeur`, `:150`), `valeur`, `symbole`, `racine`, `pole`, `sommet` ; `LigneTableauSignes.nature` (`signe`|`quotient`|`variation`, `:135`) ; `EcranTableauSignes.titre`. **Supprimés** (code mort, plus aucun usage) : `bornes`, `sousLibelle`. Un tableau **sans** `genre` reste « hérité » (une case par colonne, alphabet de ligne : le tableau à 5 colonnes du témoin ; Section A intacte, 137 assertions).

### C. Une seule dérivation : `lib/structureTableau.ts`
`resoudreRangees` (`:139`) donne, par ligne, les cases `{ancre, couvre, alphabet}` : colonnes `intervalle` → `+ -` ; `valeur` racine → `+ - 0` ; `valeur` non racine (`xS` de deux racines / sans racine) → `+ -` **jamais `0`** (`alphabetSigne`, `:93`) ; ligne `quotient` sur un `pole` → `+ - 0 ∅` ; ligne `variation` → cases FUSIONNÉES par groupes délimités par les colonnes `sommet` (`groupesVariation`, `:100`) : `↗ ↘` sur un groupe, `⌢ ⌣` au sommet, **clé de réponse = première colonne du groupe**. Les 3 configurations de gen7 sont couvertes (aucune racine : 3 colonnes à 2 valeurs ; racine double : centre à 3 valeurs ; deux racines : 7 colonnes, fusions 3 | 1 | 3). Déclaration incohérente (alternance, 2N+1, > 9 colonnes = `NB_COLONNES_MAX`, `:21`, `genre` partiel, attribut mal placé, ids en double) → **lève** (échec bruyant). Le navigateur ne recalcule **rien** : `GET /api/exercices/:id` sert `rangees` (`lib/routes/exercices/[id].ts:100`) et `public/moteur/ecrans/tableauSignes.js` dessine.
`comparerCasesTableau` (`:158`) : case manquante / inconnue en trop / clé d'une colonne couverte / valeur hors de l'alphabet de SA case (dont `"?"`) → `ok:false` (→ `parse_error` du générateur, jamais un essai raté) ; clés lues par `lirePropre` (§20) — `constructor`, `__proto__` refusés.

### D. Composant (`public/moteur/ecrans/tableauSignes.js`)
Cycle : `?` → 1re valeur → … → dernière → **1re** (`:84`) ; jamais `?`. `lireReponse` (`:216`) renvoie `null` tant qu'une case est vide : « Valider » reste désactivé (comportement de `champs_multiples`/`intervalle`). Disposition structurée (`construireStructure`, `:100`) : bande de symboles (`--surface-sunken`) puis ligne des x (`<` entre les valeurs), titre de chaque ligne AU-DESSUS (`th` en `colspan` = ligne de titre, **jamais** une ligne de cases), fond `<col>` `--violet-clair` sur toutes les lignes (`ecrans.css:383`), boutons 44 px fixes en flex. Disposition héritée (`construireHeritee`, `:161`) inchangée hors cycle et plein-bord.

### E. Plein-bord (`public/moteur/ecrans.css:284`, `public/style.css:142,148`)
`margin-inline: calc(-1*var(--retrait-plein-bord,0px))`. Le retrait = padding de la carte (`--espace-4`) + bordure (1 px) + padding de `.moteur-exercice` (`--espace-3`) + gouttière de `.contenu-page` (`--espace-3`, 14 px ≤ 600 px) : **quatre termes dans trois règles** — un premier essai avait oublié `.moteur-exercice` (tableau à 16 px des bords au lieu de 0) et n'a été trouvé que par la mesure Chromium. Titres de ligne alignés sur le texte de la carte (`padding: calc(var(--retrait-plein-bord,0px))`).

### F. Casse (piège `f(x)` / `F(X)`)
Aucun `text-transform` dans `ecrans.css` (testé, `scripts/test-structure-tableau.ts`) ; les titres (« SIGNE DE $f(x)$ ») sont **écrits** dans leur casse, l'effet vient de la taille, de l'espacement (`letter-spacing`) et de la couleur (`ecrans.css:398`).

### G. Témoin (`src/generateurs/_temoinTechnique/index.ts`) — profil `etendu`
`colonnesTableau` (`:287`) / `ecranSignesVariation` (`:305`) : 7 colonnes (deux racines) ou 3 (racine double), variations fusionnées. **Nouvel écran `quotient_signes`** (`ecranQuotient`, `:349`) : `g(x) = (x−r₁)(x−r₂)/(x−p)`, 4 lignes empilées, `∅` au pôle de la ligne finale — le seul moyen de tester réellement les lignes empilées et la cellule à 4 valeurs. Tirages ajoutés **après** ceux d'origine (`genererEtendu`, `:469`) : les exercices existants ne changent pas. La vérification passe par `comparerCasesTableau` (`:561`), plus de boucle dupliquée. Le témoin n'a pas de configuration « sans racine » (les tests de structure la couvrent avec les déclarations exactes de gen7).

### H. Vérifications
`tsc -b` ; `test-temoin` **6 086** (Section A : 137, inchangée) ; `test-structure-tableau` (61, nouveau, `npm run test-structure-tableau`) ; `test-design-system` ; `test-durcissement-prototype` ; Chromium **1 164** (dont audit de structure `scripts/chromium-temoin-technique.ts:712`, plein-bord `:664`, cycles `:688`) à 390 et 1280 px : cycle sans retour à `?` sur les cases à 2, 3 et 4 valeurs et sur chaque type de variation ; 4 lignes empilées → boutons de même largeur (44 px) que 1 ligne ; colonnes alignées, `colspan` 1 sur tout signe et 3|1|3 sur les variations ; tableau = bords de l'écran (390) / de la colonne de 720 px (1280) tandis que la consigne garde ses 24 px ; « Valider » désactivé à 9 cases sur 10. **Mutations vérifiées** : cycle qui revient à `?` → 144 échecs Chromium ; `racine` ignoré → 3 échecs de structure + 1 du témoin ; retrait sans `.moteur-exercice` → échecs de plein-bord. Captures : `captures-chromium/{390,1280}-etendu-09-tableau-3-colonnes.png`, `-09b-quotient.png`, `-10-tableau-7-colonnes.png`.

### I. Limites
9 colonnes à 390 px : 9 × 44 = 396 px > 390 px (page qui déborde de 6 px) — **hors périmètre par décision** (aucun générateur actuel n'a plus de 7 colonnes) ; à traiter avec le premier générateur à 4 valeurs. Le `0` reste offert sur toute colonne `racine` d'une ligne de facteur, même si ce n'est pas la racine de CE facteur (distracteur accepté). La 3b-3 (gen7) écrira son écran directement sur ce contrat ; `spec-gen7-phase3a.md` §2.9 décrit encore l'ancien format à 7 clés de variation.


## §31 : Tableau de signes — rendu aligné sur la RÉFÉRENCE validée (correctif visuel de §30)

Aucun SQL, aucun changement de contrat ni de comportement : seul l'**apparence** change.

### A. Ce qui était faux
§30 avait été livré vert (tests, Chromium) mais **visuellement éloigné** de la maquette validée : le prompt de révision décrivait le comportement en mots, jamais le code de la maquette. Écarts constatés : une bulle (bordure + rayon + fond) autour de chaque valeur ; sur la ligne « Variations », de petits carrés de 44px centrés dans les 3 cases fusionnées ; des flèches SVG à tracé fixe par symbole ; un titre « TABLEAU DE SIGNES » et des `<` dans la ligne des x que la référence n'a pas ; titres de ligne en blanc avec `letter-spacing: 0.08em`. **Cause : DONNÉES manquantes** (référence non transmise), pas un défaut de test — les tests vérifiaient le comportement demandé, pas l'apparence. Le code de référence est désormais dans le dépôt : `docs/reference/tableau-signes.html` (règle CLAUDE.md).

### B. Corrigé (`public/moteur/ecrans.css:372-520`, `public/moteur/ecrans/tableauSignes.js:73-145`)
Cellules à filets fins (`border-top`/`border-right: 1px solid var(--border)`) ; case = toute la cellule, sans bordure, fond ni ombre (`.moteur-table-structure .moteur-case-signe`, `ecrans.css:451`), 48px (56px sur les variations) ; bande de symboles entièrement `--surface-sunken` (`:420`) ; titres de ligne en bandeau `--surface-sunken`, `letter-spacing: 0.03em`, toujours sans `text-transform` ; colonnes d'intervalle de la ligne des x vides ; plus de titre « TABLEAU DE SIGNES » (retiré des déclarations du témoin, le champ `titre` reste facultatif). **Flèche tracée et pivotée** (`dessinerFleche`, `tableauSignes.js:75`) : mesure de la vraie case, angle `atan2(0,42·h ; 0,68·l)`, trait de la bonne longueur + pointe SVG fixe, `transform: rotate` d'un seul bloc, redessinée par `ResizeObserver` (`:134`) ; le sommet reste un glyphe `⌢`/`⌣`. Moins typographique `−` affiché pour `-` (la valeur envoyée reste `-`). `aria-label` inchangés (noms en toutes lettres). Les constantes numériques de la flèche (`FLECHE`, `:73`) sont des mesures de tracé, posées en style en ligne : `ecrans.css` n'a toujours aucune longueur en dur (`scripts/test-design-system.ts` : `1px`/`2px` désormais admis aussi dans `padding`/`margin`, exceptions déjà documentées).

### C. Vérification
`tsc -b` ; `test-design-system` (508) ; Chromium **1 463** à 390 et 1280 px, dont (`scripts/chromium-temoin-technique.ts:712`) : aucune bordure / fond / ombre sur les cases, chaque bouton occupe toute sa cellule, bande de symboles entièrement `rgb(246, 243, 251)`, flèche = **un trait + une pointe, sans aucun caractère**, angle < 0 à droite (montante) puis > 0 (descendante) puis retour (jamais `?`), longueur du trait proportionnelle à la case, flèche **redessinée** après redimensionnement, sommet en glyphe. **Comparaison côte à côte** avec le rendu de la référence dans Chromium : `captures-chromium/390-etendu-10b-carte-tableau-7-colonnes.png`.

### D. Limites
Le tableau « hérité » (5 colonnes, Section A du témoin) garde son ancien style : il n'est utilisé que par le témoin. Les symboles de la bande (`x_1`) et les valeurs (`-2`) s'affichent encore en source LaTeX tant que KaTeX n'est pas branché (3b-3, commit 4) ; la référence utilise `x₁` et `−2`. Rendu de la carte : la référence est un seul bloc de 390px ; ici le tableau sort de la carte jusqu'aux bords de l'écran (décision du propriétaire, §30-E).


## §32 : Design des composants d'écran — corrections E1-E5 et E7 de l'audit, test de fidélité permanent

Aucun SQL. Suite de l'audit (étape 1, aucune correction) : les décisions du propriétaire sont E1/E2 = vrais bugs, E3/E4 = améliorations à garder en changeant seulement le style, E5 = resserrer à 12px, E6 = rien, E7 = comblé par deux références exactes (champs multiples, intervalle). Les cinq références sont stockées dans le dépôt : `docs/reference/composants-ecran.html`.

### A. Ce qui était faux, et pourquoi les tests ne le voyaient pas
Les composants avaient été construits à partir de descriptions en mots ; le CSS *source* disait presque la bonne chose, le style *appliqué* non. **E1** : `ecrans.css` déclarait `.moteur-champ { background: var(--surface-sunken); padding: 8px 16px }` mais `style.css` a `input[type="text"] { background: var(--surface); padding: 8px 12px }` (spécificité 0,1,1 contre 0,1,0) : le fond en creux et le padding étaient du code mort. Aucun test ne comparait un fond calculé.

### B. Corrections (`public/moteur/ecrans.css`, `public/moteur/ecrans/listeValeurs.js`, `public/style.css`)
- **E1** (`ecrans.css:175`) : sélecteur `.moteur-ecran .moteur-champ` (0,2,0) ; fond `--surface-sunken`, padding 10px 12px, 0,95em, `margin: 0` (un `input` de `style.css` ajoutait 4px). Hauteur 44px conservée (cible tactile). **Aucun sélecteur partagé n'est modifié** : seul `eleve.html` charge `ecrans.css` ; le diff de `style.css` est une seule variable (`--ombre-bouton`, inutilisée ailleurs). `prof.html` et `index.html` sont donc inchangés par construction (`git diff --stat`), et le scénario `prof` de Chromium (vrai `prof.html`) reste vert.
- **E2** (`ecrans.css:128`) : « Valider » = bordure 2px, padding 9px 18px (1,125 × `--espace-2`/`--espace-3`, multiples exacts de l'échelle), 0,95em, ombre nommée par le **36e token `--ombre-bouton`** (`style.css:90`, `docs/design-system.md`, `scripts/test-design-system.ts` : 36 tokens ; désactivé : sans ombre). Les valeurs 9/10/12/14px de la référence ne sont pas des tokens : elles sont écrites `calc(token × facteur)`, jamais en dur.
- **E3** (`ecrans.css:204-240`) : le radio natif reste dans l'arbre d'accessibilité (`opacity: 0`, 1×1px, **jamais** `display: none` ni `visibility: hidden`), focalisable, flèches du clavier opérationnelles ; le focus clavier se lit sur l'option (`:has(input:focus-visible)`, contour 2px). Option = padding 10px 14px ; retenue = **vraie** bordure de 2px (au lieu de 1px + anneau intérieur).
- **E4** (`listeValeurs.js:88`, `ecrans.css:279`) : glyphe `🗑` à 18px ; le vrai bouton (44×48px, `aria-label` « Retirer cette valeur ») est conservé. « Ajouter » : 0,9em, hauteur tactile 44px conservée.
- **E5** (`ecrans.css:62`) : espacement de la carte 16 → 12px (`calc(--espace-3 × 0,75)`) ; le bouton d'aide reste entre le champ et « Valider » (12 + 44 + 12).
- **E7** : champs multiples — gap 8px, libellé `min-width: 24px` (les champs `a`, `b`, `c` étaient décalés de 1px). Intervalle — crochets **ronds de 32×32px** (bordure 2px violette, fond blanc), **cible tactile de 44×44px conservée par un pseudo-élément** qui déborde de 6px (`ecrans.css:776`) ; bornes de 64px, texte centré, padding 8px 10px, 0,9em ; gap 6px. `border-radius: 50%` admis par le test du design system (forme, pas une valeur).

### C. Test permanent : `scripts/chromium-fidelite-design.ts` (`npm run chromium-design`)
Rend la référence et l'application réelle dans le **même Chromium** et compare les styles **calculés** élément par élément (couleurs en hexadécimal, rayons, paddings, ombre, police, graisse, tailles) + espacements verticaux mesurés sur les boîtes. Vérifie aussi : radio masqué mais présent et focalisable, focus visible, suppression = vrai bouton 44×44 avec `aria-label` et glyphe `🗑`, hauteur des champs ≥ 44px, alignement des libellés, crochets 32×32 et zone tactile 44×44 (`elementFromPoint` : touché à 5px, plus à 9px). **222 vérifications**. Mutation : remettre `.moteur-champ` (E1) → 11 échecs explicites. Deux pièges rencontrés : (1) le fond d'un champ passe par une **transition** (focus → repos) : capturé trop tôt, il paraissait blanc alors que le style calculé était juste — on attend 450ms après le flou ; (2) le survol change le fond du bouton « Ajouter » : la souris est écartée avant toute mesure.
Le serveur et le stub Supabase de Chromium sont factorisés (`scripts/support/serveurChromium.ts`), utilisés par les deux scripts. Les scénarios existants cliquent désormais l'**option** (label), pas le radio masqué : c'est ce que fait un vrai utilisateur.

### D. Vérification
`tsc -b` ; tous les `scripts/test-*.ts` + smoke-test ; `test-design-system` (524, 36 tokens) ; Chromium `chromium-temoin` **1 463** (couleurs de sélection du QCM incluses) ; `chromium-design` **222**. Captures : `captures-chromium/fidelite-{ref,app}-{champ,qcm,liste,multiples,intervalle}.png`.

### E. Écarts ADMIS (documentés, pas des oublis)
Hauteur des champs et des options (44px tactile contre 39-42px) ; hauteur du bouton « Ajouter » ; le bouton « Besoin d'un indice ? » (absent des références) ; le libellé du bouton « Ajouter » vient du générateur (la référence écrit « + Ajouter une valeur ») ; les boutons ±∞ de l'intervalle n'ont pas de référence. Rendu à 1280px non recapturé (règles identiques). Polices : seule la famille déclarée est comparée (polices bloquées dans le bac à sable).

## §33 : gen7 « Analyse d'une fonction du second degré » assemblé — quatre variantes `af_*` jouables, KaTeX, panneau de faits (phase 3b-3)

Livré en 5 commits (`c5a824e`, `a2cb948`, `421ff54`, `5a771b3`, puis celui-ci). Réponses du propriétaire prises pour référence : Q1 les deux écrans oubliés + `af_irreductible` ; Q2 table différentielle tirée du code réel de l'ancien pilote, divergences comptées ; Q3 cascade complète sur `racinesChamp2` ; Q4 tableau « moins coûteux » (valeurs vraies en correction immédiate, symboliques sinon) ; Q5 énoncé par écran, consigne persistante et panneau de faits en TEXTE de consigne ; Q6 KaTeX 0.18.9 vendoré, `trust` restreint, deux gardes ; Q7 rien à dégriser dans `prof.html`.

### A. Vérification pure des six écrans restants (commit 1)
Modules purs `src/generateurs/analyseFonction/{coefficients,allure,axeSommet,domaineImage,reconnaissance,tableauSignes}.ts` (avec `racines/` de la 3b-2 : huit écrans). Preuve : `scripts/test-verification-gen7.ts` rejoue l'ancien pilote (`6acc102`) sur la table figée `scripts/support/table-verite-gen7-pilote.json` (provenance : `docs/extraction-table-verite-gen7.md`) : **5350 vérifications, 5300 divergences délibérées en 15 classes**, chacune comptée dans `ATTENDU` (`scripts/test-verification-gen7.ts:330`) et refusée si un cas diverge sans classe déclarée. Les classes, dans l'ordre du test : allure (choix absent ou hors liste → `parse_error`, 1656) ; axeSommet (sans « x = » 938 ; champ vide 276 ; écriture scientifique 92 ; illisible → `parse_error` 184) ; coefficients (champ manquant 46 ; vide, l'ancien lisait 0 : 230 ; illisible 276 ; lecture élargie fraction/moins typographique 176 ; restreinte scientifique/hexadécimal 184) ; domaineImage (scientifique 46 ; sentinelle entourée d'espaces acceptée 46) ; racinesReconnaissance (identifiant hors liste 184) ; tableauSignes (réponse non représentable 496 ; valeur hors des choix de sa case 470). Ce sont des choix de conception (illisible = `parse_error` avec message, jamais un essai raté), pas des régressions ; tout cas nouveau fait échouer le test.

### B. Génération (commit 2)
`genererExercice(categorie, graine)` : `src/generateurs/analyseFonction/exercice.ts:66` ; construction de l'irréductible (a ≠ 0 par rejet, Δ < 0 par construction) `:59`. **Ordre des tirages figé** (`:13`, règle `_v2`) : tirages de la catégorie, puis mélange de Fisher-Yates de l'ordre d'affichage des termes. Épinglé par graine dans `scripts/test-generation-gen7.ts` (4 graines × 4 catégories = 16 exercices) ; plages, Δ, xS ∈ ½ℤ, yS ∈ ¼ℤ vérifiés sur 300 graines par catégorie.

### C. Écrans (commit 2)
`ecransAnalyseFonction` `src/generateurs/analyseFonction/ecrans.ts:49` : 8 écrans, **6 pour `af_irreductible`** (`racinesChamp1/2` absents partout : écrans, champs attendus, requêtes forgées → 400, `test-route-gen7.ts`). Énoncé par écran et consigne persistante : les cinq écrans « fonction » répètent « Étudie la fonction suivante : $f(x) = …$ » (ordre des termes mélangé par la graine, exposant en `x^2`, jamais « ² ») ; les écrans « racines » parlent de l'équation canonique. Dépendances : `racinesChamp2` ← `racinesChamp1` ; `tableauSignes` ← `axeSommet` (+ `racinesChamp2` hors irréductible). Aides typées : `formule_coloree` (trois termes toujours, un coefficient nul s'écrit 0) et `croquis_parabole`.

### D. Cascade (commit 2, RAPPORT §18)
`projeterAnalyseFonction` `cascade.ts:168`. A : `racinesChamp2` affiche et vérifie l'équation issue de la factorisation CONFIRMÉE ; réponse `correct` → racines vraies ; fausse mais exploitable en correction coupée → équation et racines de l'élève (« une méthode juste sur une donnée fausse réussit ») ; inexploitable → vraie factorisation (immédiat) ou équation développée publique (coupé). B : valeurs du tableau vraies ou symboliques selon le seul réglage statique. Jamais la chaîne brute de l'élève dans un texte d'auteur (`factorisationVersLatex`, ré-écriture).
**Défaut trouvé par le test et corrigé** : `1/0*x` était lu comme valide et l'énoncé suivant affichait « \dfrac{1}{0}·x = 0 » (`cascade.ts:82`, `divisePar0`, appliqué dans `lire`). Le test le détecte (mutant vérifié).

### E. Panneau « Ce que tu sais déjà » (commit 5) — DÉCISION À VALIDER
`ligneFaits` `ecrans.ts:130`, composé dans les consignes par `composer` `:53`. Une ligne de texte (retours à la ligne : `.moteur-consigne { white-space: pre-line }`, `ecrans.css:78`). **Deux écarts assumés avec l'ancien « Ce qu'on sait déjà »** (spec 3a §2.9) : (1) l'ancien montrait `solution_attendue ?? valeur_saisie`, donc la bonne valeur même d'un écran RATÉ ; ici seuls les écrans RÉUSSIS y figurent (`corrects`, `cascade.ts:172`) — un écran raté n'est jamais rappelé, quel que soit `reponse_visible` ; (2) jamais sous correction coupée (règle de révélation §13). Les racines n'y figurent qu'une fois les deux écrans racines réussis (valeurs effectives de la cascade), jamais pour l'irréductible. Un écran ne rappelle jamais sa propre réponse. Limite visuelle constatée sur les captures : le panneau est dans un paragraphe en gras comme la question, donc peu distinct ; un vrai panneau à part exige une référence de design AVANT construction (CLAUDE.md) — proposition, non réalisée.

### F. Générateurs et registre (commit 3)
`generateurs.ts:27` (une fabrique, quatre objets, variante_id = catalogue sans suffixe), codes déclarés `:33` (3 pour `af_irreductible`, 7 sinon, `C07_ou_C08` jamais). Registre : `lib/registreGenerateurs.ts:18` (`[témoin, ...GENERATEURS_ANALYSE_FONCTION]`), cohérence avec le catalogue vérifiée au chargement sans toucher au catalogue ; `variantesCatalogueSansGenerateur()` est vide. `scripts/test-temoin-technique.ts` : gen7 est au registre ; le 409 « variante sans générateur » retire un instant `af_mise_en_evidence` (Section A : 137 assertions inchangées). `scripts/test-route-gen7.ts` (121 vérifications, vrai `api/router.ts`) : champs attendus, filtrage de la cascade, 4 parcours complets, cascade immédiat/coupé, repli, irréductible forgé, codes stockés (`ALLURE_PARTIELLE`, `AXE_SYMETRIE_NOTATION` sur `parse_error`, `C05_SIGNE_REPETE`, `RACINE_PARTIELLE`), panneau.

### G. KaTeX (commit 4)
`public/vendor/katex-0.18.9/` (604 Ko : JS, CSS, LICENSE MIT, 20 polices woff2 ; identique octet pour octet à `node_modules/katex@0.18.9`, devDependency exacte). Chargé avec le moteur : `eleve.html:495` (`chargerKatex`) ; absent → repli en source. `rendreMath` `public/moteur/rendreTexte.js:33`, réglages `reglagesKatex` `:58` : `throwOnError: true` puis repli en source (pas `throwOnError:false`, qui rendrait les erreurs EN ROUGE) ; **constat** : KaTeX rend une commande de confiance refusée en rouge sans lever d'erreur → drapeau `refuse` ; KaTeX ne bloque pas `\textcolor` → la liste noire serveur reste indispensable. `roles: true` réservé à `formule_coloree` (`formuleColoree.js:25`), seul `\htmlClass{moteur-coef-a|b|c}` admis ; segments assemblés en UNE chaîne (`texteMath.js:97`). Ponctuation collée à la formule qui la précède (`rendreTexte.js:89`, `.moteur-insecable` `ecrans.css:660`). **Écart de design** : libellé de champ multiple 24 → 36 px (`ecrans.css:682`), « a = » rendu par KaTeX mesure 28 à 31 px et désalignait les champs (mesuré par `chromium-design`). Gardes : `scripts/test-katex.ts` (60 751 vérifications : sha256, identité npm, confiance, assemblage, 1030 formules distinctes de gen7 compilées sur 43 384 segments, dont les panneaux, les consignes de cascade et les messages d'erreur).

### H. Discipline de câblage `prof.html` (CLAUDE.md)
Entrées déjà présentes, libellés identiques à `CATALOGUE_GENERATEURS` (`lib/catalogueGenerateurs.ts:12-15`) : `public/prof.html:1484-1487` (`{ index: 0..3, variante_id: "af_…" }`). Vérification réelle (`scenarioGen7Prof`, `chromium-temoin-technique.ts:1531`, 390 et 1280 px, vrai routeur, base en mémoire) : les 4 champs « nombre d'exercices » existent et ne sont PAS `disabled` ; une tâche est créée par l'interface (`#btn-creer-tache`), sa composition en base contient les 2 variantes `gen7` choisies, elle est assignée, et l'élève ouvre l'énoncé et valide un premier écran.

### I. Chromium
`scenarioGen7Parties` (`:1428`) : une partie complète au clic par catégorie (8 écrans, 6 pour l'irréductible), mathématiques KaTeX sans repli en source, panneau sur ses lignes, tableau à 7 ou 3 colonnes, fin de tâche, toutes les réponses correctes en base. `scenarioGen7Coupe` (`:1484`) : correction coupée, factorisation fausse → équation de l'élève sans fuite de la vraie, « 0 ; 2 » correct pour cette équation, tableau symbolique sans chiffre, aucun verdict avant la dernière réponse, qui révèle. Bloc KaTeX de `scenarioEtendu` (`:810`) : rendu réel, repli, jamais de rouge. **`chromium-temoin` : 1797 vérifications ; `chromium-design` : 222.**

### J. Ce qui n'est PAS fait / risques ouverts
- `etapesActives` (sélection d'écrans par réglage de tâche) hors périmètre : la séquence est celle de la catégorie.
- Panneau de faits : décision E ci-dessus à valider ; rendu non distinct de la question.
- Règle `_v2` et `poids` (décision D4, RAPPORT §17-E) : toujours différée.
- Petites PR annoncées, non faites : `lib/routes/inscription-prof.ts:73` (`erreurInvitation || !invitation` → 500 journalisé sur `erreurInvitation` seule) ; `eleveAuthentifie` ne lit pas `eleves.actif`.
- À votre charge : vérifier dans les journaux Vercel qu'aucun code d'invitation non utilisé n'a été exposé (RAPPORT §24, retiré en §28).
- Aucun changement de schéma SQL : rien à reporter dans `cumulatif.sql`.

Régression : voir le message de PR (export propre du commit exact : `tsc -b`, tous les `scripts/test-*.ts` + smoke, `chromium-temoin`, `chromium-design`).

## §34 : `inscription-prof` — une panne de la base n'est plus un « code d'invitation invalide »

**Défaut** (signalé en fin de §33, ligne 73 avant correction) : `if (erreurInvitation || !invitation)` renvoyait le même 404 « Code d'invitation invalide » pour un code inexistant ET pour une erreur de lecture de la base. Pendant une panne, un professeur muni d'un code valide croyait son code faux, et rien n'apparaissait dans les journaux (même famille de masquage que §25).

**Correction** : `lib/routes/inscription-prof.ts:75-81` — une erreur de lecture est levée (`throw new Error("Lecture du code d'invitation impossible : …")`), donc 500 journalisé par `avecGestionErreurs` avec la cause dans `detail` ; seul `!invitation` reste un 404. Le message générique du 404 (code inexistant, e-mail discordant) est inchangé, donc l'anti-fuite de §26 aussi.

**Test** : `scripts/test-inscription-prof.ts` — panne simulée de la lecture de `invitations_prof` (`panne.invitations`) : 500, cause dans le détail, message différent du 404, aucun compte créé. Mutant vérifié : avec l'ancienne condition, le test échoue (« 500 attendu, obtenu 404 »).

Aucun changement de schéma SQL.

## §35 : un élève désactivé perd l'accès à l'API à chaque requête (`eleveAuthentifie` lit `eleves.actif`)

**Défaut** (signalé en fin de §33) : la désactivation d'un élève par son professeur (`lib/routes/profs/desactiver-eleve.ts:47`, `actif = false`) n'était vérifiée qu'À LA CONNEXION (`lib/routes/connexion-eleve.ts:92`, 403). `eleveAuthentifie` ne lisait pas `actif` : un jeton déjà émis restait valable et l'élève désactivé continuait à lire ses exercices et à répondre. **Mesuré** avec l'ancienne règle (mutant du test) : après désactivation, `GET eleves/tableau-de-bord`, `GET eleves/mes-resultats`, `GET exercices`, `GET exercices/:id` et `POST reponses/debut-ecran` répondent **200**, `POST reponses` 409 (écran suivant) et `POST reponses/aide` 403 (aide non activée) — aucun n'est un refus d'authentification.

**Correction** : `eleveAuthentifie` (`lib/supabaseAdmin.ts:55`) lit `id, actif` à chaque requête et applique `eleveDepuisLigne` (`lib/authProf.ts:37`) : `actif === false` → `null` → 401 partout, puisque les sept routes élève passent par ce point unique. Même règle et même structure que `profAuthentifie` (§26) : seul `actif === false` désactive (colonne absente ou nulle = pas un refus), fonction pure partagée avec le harnais de test (`scripts/support/harnaisRouteur.ts:33`, une seule règle), paramètre `admin` injectable comme pour `profAuthentifie`. Réactiver (SQL du propriétaire) rend l'accès immédiatement, avec le même jeton. Le compte Auth n'est pas banni (contrairement aux professeurs, §26) : le contrôle par requête suffit et la désactivation d'un élève reste réversible sans toucher à Auth. L'élève « fantôme » de l'aperçu (`profs.eleve_apercu_id`) a `actif` à `true` (défaut) : non concerné.

**Test** : `scripts/test-eleve-desactive.ts` (22 vérifications) — le vrai `eleveAuthentifie` avec un faux `admin` (actif, désactivé, colonne absente, nulle, ligne absente, erreur de lecture, jeton invalide, sans en-tête ; la colonne `actif` doit être lue) puis le vrai routeur : désactivation par la vraie route professeur, les sept routes élève répondent 401 avec le jeton déjà émis, aucune écriture, l'autre élève de la classe et les données de l'élève désactivé intacts, réactivation immédiate. Mutant vérifié (règle sans `actif`) : le test échoue.

**Prérequis de production** : `eleves.actif` existe déjà (`supabase/migrations/cumulatif.sql:39`, requis par la connexion) ; aucun changement de schéma.

## §36 : Bouton « Aperçu » du formulaire de tâche réactivé (`POST /api/taches/apercu`, `eleve.html?apercu=1`)

**Contexte** : en phase 1 le bouton `#btn-apercu-tache` était `disabled` (§3, gen7 n'existait pas comme générateur exécutable). Les quatre variantes de gen7 sont au registre depuis §33.

### A. Mécanisme de l'ancien pilote (lu avant de réactiver ; lecture seule, `pilote@6acc102`)
`lib/routes/taches-apercu.ts` : un **élève fantôme** par professeur (`profs.eleve_apercu_id` : un vrai compte Supabase Auth + une vraie ligne `eleves`, jamais inscrit à une classe), créé paresseusement au premier aperçu ; une tâche `est_apercu = true` aux réglages du formulaire, assignée à ce seul fantôme ; l'ancienne tâche d'aperçu du professeur supprimée en cascade (au plus UNE vivante) ; mot de passe du fantôme réinitialisé à chaque aperçu puis `signInWithPassword` → session renvoyée. `prof.html` la dépose dans `localStorage` (`apercu_session`) et ouvre `eleve.html?apercu=1` ; `initModeApercu` la lit, la RETIRE aussitôt, saute la connexion, affiche un bandeau, masque la navigation et ouvre la tâche. Les réponses du professeur sont bien écrites dans `reponses` ; ce sont l'absence d'inscription du fantôme et `est_apercu` qui les excluent de toute vue professeur — pas une absence d'écriture.

### B. Écarts avec l'ancien pilote (délibérés, chacun testé ou mesuré)
1. **Fenêtre d'assignation.** `GET /api/eleves/tableau-de-bord` de ce dépôt ignore une tâche sans ligne `taches_assignations_eleves` (`lib/routes/eleves/tableau-de-bord.ts:103`, `if (!fenetre) continue`) : sans elle, l'aperçu s'ouvrait sur « aucune tâche ». La route en crée une pour le fantôme (`lib/routes/taches-apercu.ts:191`). **Mesuré** : sans cette ligne, le tableau de bord du fantôme montre 0 tâche (mutant du test).
2. **Cascade de suppression.** L'ancienne ignorait `aides_utilisees` (table ajoutée depuis) et `taches_assignations_eleves` : le 2e aperçu aurait échoué sur une clé étrangère dès qu'une aide avait été demandée (gen7 propose des aides). Couverts (`:72-94`), en lots de 100 identifiants (limite d'URL de `.in()`), identifiants lus par `recupererToutesLesLignes`. Mutant vérifié.
3. **Registre.** Exercices tirés du registre (`chercherGenerateur`, `tirerGraine`, `champs_attendus` du générateur), plus de `genererLigne`. Une composition contenant une variante sans générateur exécutable est refusée en **409** `variantes_indisponibles` AVANT toute écriture (`:116`) : l'aperçu précédent reste alors en place.
4. **Compensation et aléa.** Compte Auth du fantôme supprimé si une écriture suivante échoue ; mots de passe par `crypto.randomBytes` (l'ancienne utilisait `Math.random`).
5. **Popup.** `window.open` fait après un `await` est bloqué par plusieurs navigateurs (l'activation utilisateur n'y survit pas) : l'onglet est ouvert DANS le clic (`about:blank`), puis reçoit son adresse ; refermé en cas d'échec, message dédié si le navigateur bloque (`prof.html:4587`).
6. **Nom facultatif.** Un aperçu n'a pas besoin d'un intitulé : `« Aperçu »` est envoyé si le champ est vide (l'ancienne route rejetait un nom vide en 400).
7. **Sortie du moteur.** En mode aperçu « Retour » et la fin de tâche ferment l'onglet (`eleve.html:536`, `sortieDuMoteur`) : le fantôme n'a pas de liste de tâches à laquelle revenir.

### C. Activation du bouton par le REGISTRE
`GET /api/catalogue-generateurs` ajoute `executable` à chaque entrée, **dérivé à la volée** de `chercherGenerateur` (`lib/routes/catalogue-generateurs.ts:29`) — jamais une liste tenue à part (CLAUDE.md « Registre unique »). `mettreAJourBoutonApercu` (`prof.html:1938`) : bouton inactif sans exercice, ou si une variante composée a `executable === false` (infobulle qui la nomme) ; rappelé par `mettreAJourBadgeComposition` et après le chargement du catalogue. Le 409 serveur reste la vraie garde. Aujourd'hui les quatre variantes gen7 sont exécutables, donc le bouton est actif dès qu'un exercice est composé ; le cas « non exécutable » est prouvé en retirant une variante du registre le temps du test.

### D. Livré
Route `lib/routes/taches-apercu.ts` (routée AVANT `/api/taches/:id`, sinon « apercu » serait lu comme un identifiant : `api/router.ts:314`) ; `prof.html:766` (bouton), `:1938`, `:4587` ; `eleve.html:90` (bandeau), `:1028` (`initModeApercu`, `persistSession: false` : sinon la session fantôme écraserait celle du professeur, même origine et même clé de stockage), `:536`. Harnais : `fauxSupabase.ts` (jeton `eleve:` d'un compte élève, e-mail renvoyé par `updateUserById`, défaut `est_apercu = false`).

### E. Tests
`scripts/test-apercu-tache.ts` (45 vérifications, vrai routeur, registre gen7 réel) : validation (401, 405, 400 dont le témoin technique), 409 avant écriture, fantôme créé puis réutilisé, réglages copiés (correction coupée, aide, chrono), exercices du registre, session, moteur élève tel quel, cascade complète, exclusion de `GET /api/taches`, de `PATCH/DELETE`, des statistiques et listes professeur, isolation entre professeurs, catalogue `executable`. `test-routeur.ts` : dispatch de `taches/apercu`. **Chromium** (`scenarioApercu`, `chromium-temoin-technique.ts:1581`, 390 et 1280 px) sur une tâche gen7 composée dans le formulaire : bouton inactif/actif/infobulle, garde par le registre (variante retirée puis restituée), clic → onglet `eleve.html?apercu=1` (bandeau, navigation masquée, KaTeX, session retirée du stockage, réglage « correction coupée » respecté), première réponse juste, rechargement → « Session d'aperçu introuvable », page professeur intacte, 2e aperçu remplaçant le 1er, « Fermer cet onglet ». `chromium-temoin` : 1839 vérifications.

### F. Limites
- Deux aperçus SIMULTANÉS d'un professeur sans fantôme pourraient en créer deux (le dernier lié gagne) ; hors d'un usage manuel.
- La session du fantôme transite par `localStorage` (même origine, retirée au chargement) : comme l'ancien pilote ; un script tiers de la même origine pourrait la lire pendant ce court instant.
- Aucun changement de schéma (`profs.eleve_apercu_id`, `taches.est_apercu` existent : `cumulatif.sql:151-152`).
- Le message de capture évoqué par la demande (« tâche gen7 composée comme celle de la capture ») n'était pas joint : le scénario compose lui-même `af_mise_en_evidence` + `af_irreductible`.
- **Une exécution de `chromium-temoin` sur l'export propre du commit a échoué UNE fois (exception non identifiée : ma commande n'affichait que la dernière ligne, tronquée), sans que je puisse la reproduire ensuite : 12 exécutions consécutives sur le même code, toutes vertes (4 locales, 2 sur exports neufs à froid, 6 en parallèle par trois). Cause non établie ; hypothèse non vérifiée : une attente de 30 s dépassée sur une machine chargée. Si elle revient, relever le message complet avant toute conclusion.**
- `scripts/test-rls-schema.ts` attendait 3 fichiers appelant `signInWithPassword` : `lib/routes/taches-apercu.ts` est le 4e (examiné : dernier usage du client, aucun accès aux données ensuite).

## §37 : Retour en arrière sur les écrans déjà traversés (réglage de tâche, sous correction immédiate coupée)

Section construite commit par commit (3b-4). Décisions D1–D9 validées avant le code ; l'analyse est dans `ANALYSE-retour-en-arriere.md` (livrée en conversation).

### §37-A : une seule définition de « terminé » (commits 1 et 2)

- `champsTermines` (`lib/etatExercice.ts`) est désormais la seule dérivation de « quels champs sont terminés » (réussi, tentatives épuisées ou chrono écoulé). Utilisée par `lib/verrouillageTache.ts`, `lib/routes/eleves/mes-resultats.ts` et `lib/routes/profs/resultats.ts` ; `calculerEtatExercice` reste l'autorité à l'échelle d'un exercice, et un test différentiel de 4000 historiques les compare (`scripts/test-completion-unique.ts`).
- **Deux changements de comportement, délibérés et isolés** : (1) `verrouillageTache` ignorait l'expiration du chrono (tâche classée « en cours » pour le contrôle d'écriture, « effectuée » au tableau de bord) ; (2) la colonne `complet` de la vue prof valait « a une réponse » (plus faible que les trois autres écrans). Les deux échouent sur l'ancien code (mutants tués dans le test).

### §37-B : réglage `autoriser_retour_arriere` et colonne `remis_le` (commit 3)

- **Migration (discipline CLAUDE.md)** : `taches.autoriser_retour_arriere boolean not null default false` (`supabase/schema.sql:109`, `supabase/migrations/cumulatif.sql:195`) et `exercices_assignes.remis_le timestamptz` (`schema.sql:210`, `cumulatif.sql:196`), instructions idempotentes (`add column if not exists`) ajoutées au fichier cumulatif, jamais à un nouveau fichier. `scripts/test-reglage-retour-arriere.ts` vérifie leur présence dans les DEUX fichiers.
- **Règle effective** : `retourArriereEffectif(feedbackImmediat, autoriser)` (`lib/moteurTentatives.ts`, à côté de `tentativesMaxEffectif`) — le réglage n'agit que sous correction coupée.
- **Validation** (`lib/validationCorpsTaches.ts`) : booléen exigé ; `autoriser_retour_arriere: true` avec `chrono_mode: "par_ecran"` → 400 (D6). Le chrono `global` reste compatible.
- **Routes** : `POST /api/taches`, `PATCH /api/taches/:id`, `POST /api/taches/apercu` écrivent la colonne ; `GET /api/taches` la renvoie (édition, duplication).
- **Formulaire prof** (`public/prof.html`, `#autoriser-retour-arriere`) : même patron que `reponse-visible` — grisé et décoché sous correction immédiate ou chrono « Par écran » ; réciproquement l'option « Par écran » est grisée tant que le retour est coché ; envoyé par `construireCorpsTache`, relu par `demarrerModification` / `dupliquerTache`, remis à zéro par `reinitialiserFormulaireTache`. Scénario Chromium ajouté à `scenarioProf` (aux deux largeurs).
- Non encore câblé à ce commit (suivants) : l'usage de `remis_le` et de la règle effective par les routes élève.

### §37-C : état dérivé, remise, routes (commit 4)

- **Validité par ordre d'insertion (D4)** — `lib/reponsesValides.ts` : `amontsTransitifs` (fermeture transitive de `dependDe`) et `dernieresReponsesValides` (une ligne est valide si elle est plus récente que la dernière ligne de chaque écran amont ; l'état d'un écran = sa dernière ligne si valide). Aucune écriture d'invalidation, aucune ligne supprimée : la dérivation est identique à chaque lecture. `reponses.ts` n'ajoute une ligne que si la réponse DIFFÈRE (D7, `trim()` des deux côtés) : renvoyer la même chose ne périme rien.
- **État** — `calculerEtatExercice` (`lib/etatExercice.ts`) calcule, sous retour effectif (`ContexteTache.retourArriere`), sur `donneesEffectives` (dernière ligne valide par écran, un seul essai) ; chaque champ porte `modifiable` (répondu, exercice pas verrouillé) ; l'exercice porte `exerciceVerrouille` (rendu OU chrono global écoulé, `exerciceVerrouille()`), `pretARendre`, et **`termine` exige le verrou** : avoir répondu à tout ne termine pas l'exercice (D3) — sinon la dernière réponse ferait tout révéler sans relecture possible. `champsTermines` (lecteurs en masse : `verrouillageTache`, `mes-resultats`, `profs/resultats`) applique la même règle (tout ou rien selon `remis`/chrono global).
- **Routes** : `POST /api/reponses` accepte l'écran courant OU un écran `modifiable` (409 sinon, 409 si rendu/expiré), vérifie sur les seules réponses de l'AMONT de l'écran, répond `modifiable`, `pret_a_rendre`, `champs_invalides`, `inchangee` (uniquement sous retour) ; `POST /api/reponses/aide` reste possible sur un écran modifiable (l'usage est collant, D5) ; `GET /api/exercices/:id` sert `modifiable`, `tache.retour_arriere`, `pret_a_rendre` et la dernière réponse valide (pré-remplissage) ; **nouvelle route `POST /api/exercices/:id/remise`** (`lib/routes/exercices/[id]/remise.ts`, routée dans `api/router.ts`) : pose `exercices_assignes.remis_le` si tous les écrans ont une réponse valide, idempotente, 403 hors fenêtre, 409 sans retour.
- **Lecteurs alignés sur la dernière réponse valide** : `mes-resultats` (score d'un champ) et `profs/resultats` (statut par champ ; un écran périmé disparaît de la liste). Les statistiques (bugs détectés, durées, `serieActuelle`) continuent de compter TOUTES les lignes (D8).
- **Non-fuite** : `scripts/test-retour-arriere.ts` compare la réponse HTTP d'une réussite et d'un échec (identiques, octet pour octet) et le GET (identique hors texte saisi) ; aucun `statut` nulle part dans la charge utile avant la remise.
- **Harnais** : `BaseMemoire.maintenant` produit des horodatages STRICTEMENT croissants (microsecondes comme Postgres) : deux lignes insérées dans la même milliseconde étaient ex æquo et le tri `order("horodatage")` en perdait l'ordre — invisible jusque-là, fatal dès que l'ordre d'insertion porte du sens.
- **Tests** : `scripts/test-retour-arriere.ts` (147 vérifications, trois mutants tués : validité toujours vraie, réponse identique ignorée, `termine` sans remise) ; `scripts/test-completion-unique.ts` étendu (2000 historiques sous retour : `calculerEtatExercice.termine` == complétion des lecteurs).
- **Limite connue** : modifier le réglage `autoriser_retour_arriere` d'une tâche DÉJÀ assignée change la lecture des lignes existantes (sans retour, la première ligne d'un écran fait foi ; avec retour, la dernière valide) ; comme pour les autres réglages de tâche, rien ne réécrit l'historique.

### §37-D : client (commit 5)

- **Pré-remplissage des six composants** (`public/moteur/ecrans/*.js`) : option `valeurInitiale` (la `reponse_brute` DÉJÀ confirmée) ; décodage défensif (JSON illisible, forme inattendue, valeur hors de l'alphabet de la case → ignoré, écran vierge ; `Object.hasOwn` pour les clés d'élève ; jamais interprété comme du balisage). Contrat documenté dans `public/moteur/ecrans/index.js`.
- **Moteur** (`public/moteur/moteur.js`) : sous `tache.retour_arriere`, un écran répondu montre sa dernière réponse et « Modifier ma réponse » ; la modification ouvre l'écran pré-rempli (un seul formulaire à la fois, « Annuler ») ; la réponse enregistrée annonce `inchangée` / `modifiée` et le nombre d'écrans aval à refaire, sans aucun verdict ; quand `pret_a_rendre`, le panneau « Rendre cet exercice » (confirmation en deux clics) appelle `POST /api/exercices/:id/remise` (`api.rendreExercice`), puis le flux d'origine (« Exercice terminé », « Terminer »). Le chrono global court aussi pendant la relecture (compte à rebours dans le panneau). Tout l'état affiché vient du serveur ; le client ne garde que l'écran en cours de modification.
- **Style** : aucune valeur en dur, aucun nouveau token (`.moteur-bouton-modifier { align-self: flex-start }` ; le panneau réutilise `.moteur-fin`) ; `chromium-design` et `test-design-system` inchangés.
- **Scénario Chromium** (`scenarioRetourArriere`, 390 px et 1280 px, gen7 `af_mise_en_evidence` sous correction coupée) : parcours des 8 écrans sans aucun verdict ; les 8 écrans pré-remplis ; **aller-retour exact des six composants** (« Modifier » puis « Valider » sans changer → « Réponse inchangée. », aucune ligne écrite : si un composant re-sérialisait autrement, une simple relecture périmerait l'aval) ; « Annuler » n'écrit rien ; modifier `racinesChamp1` → racinesChamp2 ET le tableau disparaissent, « Rendre » aussi, racinesChamp2 est rebâti sur la nouvelle factorisation ; remise en deux clics ; les 8 verdicts n'apparaissent qu'APRÈS la remise ; les anciennes lignes sont conservées ; le réglage est sans effet sous correction immédiate (« Question suivante », aucun « Modifier »).
- **Écart signalé** : dans ce scénario, `racinesChamp1` est modifié en enveloppant la bonne réponse de parenthèses (`(4x(x + 5))`), c'est-à-dire une chaîne DIFFÉRENTE mais équivalente — le comportement voulu (D7) : c'est la chaîne, pas le sens, qui décide d'invalider l'aval.

### §37-E : citations, validation, points ouverts

**Livré (fichier:ligne, tête de série `4c060ed`)** — règle effective `lib/moteurTentatives.ts:51` ; validité `lib/reponsesValides.ts:18` (amonts), `:37` (dernières valides) ; définition unique de « terminé » `lib/etatExercice.ts:230` (`champsTermines`), `:260` (`exerciceVerrouille`), `:268` (`donneesEffectives`), `:320` (`calculerEtatExercice`) ; lecteurs : `lib/verrouillageTache.ts:85`, `lib/routes/eleves/mes-resultats.ts:250`, `lib/routes/profs/resultats.ts:384` ; routes : réponse identique `lib/routes/reponses.ts:141`, vérification sur l'amont `:133`, aide `lib/routes/reponses-aide.ts:75`, remise `lib/routes/exercices/[id]/remise.ts:15` (routée `api/router.ts:209`) ; validation `lib/validationCorpsTaches.ts:88` ; colonnes `supabase/schema.sql:109` et `:210`, **migration `supabase/migrations/cumulatif.sql:195-196`** ; formulaire `public/prof.html:663` (case), `:2467` (verrou réciproque) ; client `public/moteur/moteur.js:125` (« Modifier ma réponse »), `:157` (panneau « Rendre ») ; scénario `scripts/chromium-temoin-technique.ts:1563`.

**Validation (export propre `git archive` + `npm ci` du commit `4c060ed`)** : `tsc -b` propre ; tous les `scripts/test-*.ts` + smoke verts (dont les nouveaux `test-completion-unique` 6048, `test-reglage-retour-arriere` 30, `test-retour-arriere` 147) ; `chromium-temoin` 1985 ; `chromium-design` 222 (inchangé). Mutants tués : ancienne boucle de `verrouillageTache` (sans chrono), ancienne définition « a une réponse » de la vue prof, validité toujours vraie, réponse identique ignorée, `termine` sans remise.

**Décisions D1–D9** : appliquées telles que validées ; D9 en deux commits (unification à comportement conservé sauf `verrouillageTache` qui gagne le chrono ; puis `profs/resultats` aligné, changement assumé).

**Points ouverts / risques**
1. Le comportement d'un exercice déjà commencé change si le prof active/désactive le réglage après assignation (§37-C, limite connue).
2. `serieActuelle` (tableau de bord) compte toutes les lignes, y compris les réponses remplacées par une modification (D8) : une série peut inclure un essai remplacé.
3. Un élève qui n'ouvre jamais « Rendre » laisse l'exercice « en cours » jusqu'à l'échéance de la tâche ; à l'échéance, la tâche passe en « antérieure » et les DERNIÈRES réponses valides sont notées/révélées sans remise (comportement voulu de l'échéance, non spécifié par D1–D9 : à confirmer).
4. Deux onglets ouverts sur le même exercice : le second reçoit un 409 (état relu), jamais une corruption ; pas de verrou optimiste sur `remis_le`.

### §37-F : confirmations du propriétaire

Point ouvert 3 de §37-E **confirmé comme comportement voulu** : à l'échéance sans remise explicite, les dernières réponses valides sont notées et révélées automatiquement. Points 1 (réglage modifié après assignation) et 2 (série qui compte les réponses remplacées) : acceptés tels quels, non urgents.
## §38 : Cascade des coefficients dans gen7 (`allure`, `axeSommet`, `domaineImage`) et cascade uniforme dans les deux régimes de correction

Numérotation : §36 (Aperçu, PR #23) et §37 (retour en arrière, PR #24) sont fusionnés avant cette section ; conflit de fin de fichier résolu en gardant les trois sections dans l'ordre.

### A. Signalement du propriétaire (test réel, tâche déployée, `f(x) = 4x² + 8x`, correction immédiate)

1. `domaineImage` : a = 5 (faux) et yS = 0 (faux) confirmés, réponse `[0 ; +∞[` — cohérente avec SES valeurs — marquée fausse, « attendu `[−4 ; +∞[` ». 2. `axeSommet` : cascade sur `xS` seul ? 3. Tableau de signes : ligne des valeurs absente.

**Causes, avant correction (citations sur `main` @ `15d52e2`)** : la cascade de gen7 ne couvrait que `racinesChamp1 → racinesChamp2` (`cascade.ts:168-190`, via `ex.zeros`). `verifierAnalyseFonction` passait la VRAIE fonction à `allure` (`allure.ts:24-25` : `f.a`, `f.a·f.b`), `axeSommet` (`axeSommet.ts:44` : l'axe, `xS` ET `yS` comparés à `f.xS`, `f.yS`, verdict unique pour les trois) et `domaineImage` (`domaineImage.ts:33-36` : `f.a`, `f.yS`) ; aucun des trois ne déclarait de `dependDe`. Réponse au point 2 : `xS` avait le même défaut, et il n'existait aucun cas isolant `xS` (verdict global). Reproduit avant correction par `scripts/test-cascade-gen7-coefficients.ts` (34 vérifications rouges sur 100).
**Point 3 (non reproduit)** : sous correction immédiate le serveur sert bien `colonnes[*].valeur = "$-2$"…` et la ligne des valeurs s'affiche (captures 390/1280 px de la 3b-3). Sous correction COUPÉE, l'écran n'a volontairement qu'une ligne `x₁ x_S x₂` (décision Q4, RAPPORT §33) : c'est exactement la description du signalement. En attente du relevé réseau du propriétaire (D-C) ; aucun changement du tableau ici.

### B. Décisions du propriétaire

- **D-A (1) — cascade UNIFORME dans les deux régimes** : « juger la méthode sur les valeurs confirmées » s'applique aussi sous correction immédiate. **Cela déroge à ma décision antérieure §33-D**, qui limitait à la correction coupée l'usage d'une donnée fausse mais exploitable (`utilisable = correct || !correctionImmediate`, l'ancien `cascade.ts:177`), au motif que sous correction immédiate la vraie valeur vient d'être montrée. Cette limite contredisait aussi la formule du §18 (« valable sous correction immédiate active ») et le scénario du propriétaire. Elle est retirée pour `racinesChamp2` (`cascade.ts:238`, `utilisable = confirmee !== undefined && statut !== "parse_error"`) comme pour les trois nouveaux écrans. Contrepartie assumée : sous correction immédiate l'élève a vu la vraie valeur, puis est jugé sur la sienne à l'écran suivant ; les consignes le disent (« d'après les coefficients que tu as donnés », « D'après ta factorisation »).
- **D-B (1) — périmètre** : `allure`, `axeSommet`, `domaineImage`. **Le tableau de signes reste jugé sur la vraie fonction** (`tableauSignes.ts:119`) : décision séparée, en attente (source de ses racines : `racinesChamp2` confirmé, ou coefficients confirmés recalculés).

### C. Mécanique de révélation — CONFIRMÉE, pas supposée (demande explicite)

Sous correction immédiate, **tout champ confirmé non réussi a été révélé, solution montrée, quel que soit `reponse_visible`** :
- Un champ n'est « confirmé » que s'il est terminé (`reponsesConfirmees = champs.filter(verrouille)`, `lib/etatExercice.ts`), c'est-à-dire réussi ou révélé : `terminee` n'est vrai que par `reussie` ou `revelee` (`lib/moteurTentatives.ts:151,159,163`), et `revelee` = tentatives épuisées (un `parse_error` compte comme un essai raté) ou chrono écoulé.
- `construireChampVue` (`lib/tableauDeBord.ts:156`) : `revele = revelee && (feedback_immediat || revelerSansReponse)`, puis pleine révélation `{ feedback_immediat: true, reponse_visible: true }` (`:182-184`). Le réglage `reponse_visible` (colonne `taches.reponse_visible`, « Afficher la réponse attendue » dans `prof.html`) n'agit que sur une RÉUSSITE ou un échec intermédiaire avec essais restants, jamais sur un champ révélé. Vérifié par le test (§7) : 1 essai, `reponse_visible=false`, échec ⇒ `verrouille`, `revele`, `solution_attendue` ; 2 essais, 1er échec ⇒ rien ; épuisement ⇒ révélé ; `parse_error` épuisant ⇒ révélé.
- **La valeur confirmée est celle de la DERNIÈRE tentative** (un champ terminé par épuisement porte son dernier essai raté ; testé : a = 6 au 2ᵉ essai devient la fonction affichée).
- Sous correction coupée : rien n'est révélé avant la fin de la tâche, la cascade n'y fuit rien (elle ne montre que ce que l'élève a écrit).

### D. Mécanisme livré

- `DonneesEffectives` / `effectifVrai` (`types.ts:68`, `:82`) ; `ExerciceAnalyseFonction.effectif` (vrai dans l'exercice brut). `effectifDepuisReponses` (`cascade.ts:199`) : coefficients confirmés s'ils sont exploitables (lisibles par `lireNombreOuFraction`, |v| ≤ 10000, |a| ≥ 1e-6 ; `cascade.ts:173`), sinon les vrais — **repli sans fuite : la fonction est publique dans l'énoncé** ; sommet de leur parabole ; `yImage` = ordonnée confirmée à `axeSommet` si lisible et écartée de plus que la tolérance de saisie (0,005) du sommet effectif (un arrondi accepté n'est pas une autre donnée).
- `verification.ts:24` et `solutions.ts:14` : `allure`, `axeSommet`, `domaineImage` jugés et corrigés sur `ex.effectif` ; `formatage.ts:63` `texteRacine` (valeurs hors ¼ℤ).
- `ecrans.ts:55` `DEPENDANCES_FONCTION` : `allure` et `axeSommet` dépendent de `coefficients`, `domaineImage` de `coefficients` et `axeSommet` → filtrage serveur (ils ne sont plus servis au départ ; compatible avec le retour en arrière de la PR #24 : modifier `coefficients` périmera aussi ces écrans). `ecrans.ts:73` : quand les coefficients confirmés diffèrent des vrais, l'énoncé de ces écrans affiche SA fonction (« Étudie la fonction suivante, d'après les coefficients que tu as donnés : … », ordre canonique des termes) ; `domaineImage` rappelle « Avec y_S = … pour ordonnée du sommet » quand celle-ci diffère de la vraie ; aides `croquis_parabole` bâties sur la parabole effective, **omises** (jamais une aide invalide) si ses coefficients ne sont pas des entiers admissibles (`ecrans.ts:80`).
- **Panneau « Ce que tu sais déjà »** (`ecrans.ts:170`) : un écran jugé sur une donnée de l'élève n'est un fait que si cette donnée est la vraie (`donneesVraies`) — « axe juste pour SES coefficients » n'établit pas l'axe de la vraie fonction. Mutant vérifié.
- Sans effet quand les coefficients sont justes (consignes identiques à l'exercice brut, testé) ; `generer()` inchangé : pas de `_v2`. Les exercices déjà assignés sont en revanche jugés différemment dès le déploiement (comme pour tout correctif de `verifier`).

### E. Recherche par motif sur toute la cascade (demande)

Toutes les lectures de la vraie fonction dans `src/generateurs/analyseFonction/{ecrans,verification,solutions,cascade,tableauSignes}.ts` ont été relevées. Restent sur la vraie fonction, volontairement : `coefficients` (écran source), le panneau de faits (gardé par `donneesVraies`), **`tableauSignes`** (décision séparée : `tableauSignes.ts:95-110`, `verification.ts`, aide `ecrans.ts:143`) et **`racinesReconnaissance` / `racinesChamp1`** (`ecrans.ts` : « l'équation … » et leurs vérifications utilisent la vraie fonction). **Observation non traitée** : un élève dont les coefficients sont faux voit donc `f` (la sienne) aux écrans allure/axe/image, puis l'équation VRAIE aux écrans racines ; le propriétaire a borné le périmètre à trois écrans, à réexaminer avec le tableau.

### F. Tests et validation

`scripts/test-cascade-gen7-coefficients.ts` (100 vérifications) : le scénario EXACT dans les deux régimes (coefficients 5 ; 4 ; −4, axe −2/5 / yS 0 ⇒ `not_equivalent`, image `[0 ; +∞[` ⇒ `correct`), cohérence (yS = −24/5 ; la vraie image `[−4 ; +∞[` refusée), signe de a, repli (illisibles, a = 0, démesurés), régression (coefficients justes), filtrage des écrans, mécanique de révélation, panneau de faits, `racinesChamp2` sous correction immédiate, `af_irreductible`. Mutants tués : `domaineImage` sur la vraie fonction (6 rouges), cascade de `racinesChamp2` limitée à la correction coupée (3), panneau sans `donneesVraies` (1), `axeSommet` sur la vraie fonction (2). Tests existants mis à jour DÉLIBÉRÉMENT : `test-generation-gen7.ts` A3 (renversement §33-D) ; `test-route-gen7.ts` (écrans servis au départ ; consigne de `racinesChamp2` sous correction immédiate). Chromium : `scenarioGen7Cascade` (390/1280 px, deux régimes, captures `*-gen7-cascade-*-image.png`) ; `chromium-temoin` 1823 ; `chromium-design` inchangé.

### §38-G : libellé identique juste/faux, découvert à la fusion avec le retour en arrière (§37)

En combinant ce travail avec `main` (PR #24), `test-retour-arriere` — qui exige qu'une réussite et un échec soient INDISTINGUABLES avant la remise — est devenu rouge : la version §38-D n'affichait « d'après les coefficients que tu as donnés » et la fonction de l'élève QUE si ses coefficients différaient des vrais. Sous correction coupée, ce libellé était donc un verdict visible (règle de révélation, CLAUDE.md). **Corrigé** : dès que les coefficients confirmés sont exploitables (justes OU faux), les écrans dépendants affichent SA fonction en ordre canonique avec le MÊME libellé (`coefficientsAffiches`, `ordonneeAffichee`, `types.ts`) ; `domaineImage` rappelle « Avec y_S = … pour ordonnée du sommet » dans les deux cas. Ce qui varie est l'écho de la saisie de l'élève (comme `valeur_saisie`), pas le libellé. Pour la même raison, l'aide `croquis_parabole` ne disparaît plus quand ses coefficients effectifs ne sont pas des entiers (repli sur la vraie parabole, publique) : `aide_disponible` ne dépend jamais de la justesse. Tests : `test-cascade-gen7-coefficients` §5/§5 bis (libellé et aide identiques pour coefficients justes, faux entiers, faux décimaux ; deux mutants tués) ; `test-retour-arriere` compare les GET après normalisation de l'écho (`$f(x) = …$`, `c` du croquis d'allure).
**Limite connue** (déjà présente pour `racinesChamp2`) : l'illisibilité d'une saisie (`parse_error`, repli sur la vraie fonction et donc sur le libellé d'origine) reste visible dans le libellé, sous correction coupée — elle ne dit pas que la saisie est fausse, seulement qu'elle n'a pas été lue.
**Interaction avec §37** : `allure`, `axeSommet` et `domaineImage` dépendant désormais de `coefficients`, modifier `coefficients` sous retour en arrière les périme (`test-retour-arriere` mis à jour : `champs_invalides = ["allure"]`).

## §39 : « Aperçu » + retour en arrière — scénario Chromium de bout en bout (test seulement)

Retour du propriétaire après exécution de la migration : « je vois l'aperçu, mais pas le retour en arrière ». Aucun défaut de code établi : `scenarioApercuRetour` (`scripts/chromium-temoin-technique.ts`, 390 et 1280 px) rejoue le parcours réel dans le navigateur, avec le vrai routeur — composer une tâche gen7, **décocher « Correction immédiate »**, cocher « Autoriser le retour en arrière », cliquer « Aperçu », répondre au premier écran — et vérifie que l'écran répondu propose « Modifier ma réponse » ; sans la case cochée, le comportement d'origine (« Question suivante ») est inchangé. Il verrouille aussi que la case est GRISÉE tant que la correction immédiate est cochée (`prof.html`, `#autoriser-retour-arriere`) : le réglage n'existe que sous correction coupée, ce qui est la cause la plus probable de « je ne le vois pas ». Captures : `*-apercu-retour-{avec,sans}-formulaire.png`, `*-apercu-retour-modifier.png`.

## §40 : Le bandeau de l'aperçu annonce les réglages effectifs de la tâche (dont le retour en arrière)

Retour du propriétaire : dans l'aperçu (téléphone), les écrans répondus n'avaient pas « Modifier ma réponse » alors que le scénario Chromium de §39 le montre. Cause non établie à distance (le rendu montre la correction coupée et la cascade §38 : le code déployé est le bon ; le plus probable est que le réglage n'était pas coché à la création de l'aperçu). Plutôt que deviner : `GET /api/eleves/tableau-de-bord` renvoie désormais, pour chaque tâche, `correction_immediate` et `retour_arriere` (réglages EFFECTIFS, `lib/routes/eleves/tableau-de-bord.ts`, que l'élève vit déjà) ; le bandeau de `eleve.html?apercu=1` (`#bandeau-reglages-apercu`, `initModeApercu`) écrit « Réglages : correction immédiate coupée · retour en arrière activé » ou désactivé avec la raison (sans effet sous correction immédiate / case non cochée). Le professeur voit ainsi d'un coup d'œil pourquoi le retour est, ou non, offert. Test : `scenarioApercuRetour` vérifie le texte du bandeau avec et sans la case cochée.

## §41 : Le tableau de signes jugé sur la fonction effective (cascade des coefficients, suite de §38)

**Décision prise ici, sur ma recommandation** (le propriétaire avait réservé la question « source des racines du tableau » puis demandé de passer au tableau sans la trancher ; elle est réversible et signalée dans la PR) : le tableau est jugé sur la fonction EFFECTIVE, celle des coefficients CONFIRMÉS (`fonctionEffective`, `types.ts`), comme `allure`, `axeSommet` et `domaineImage` ; ses **racines et son sommet en sont DÉRIVÉS** (`racinesEffectives`, `cascade.ts`, discriminant nul à la tolérance près → racine double exactement égale). Ni `racinesChamp2` confirmé ni le `xS` tapé à `axeSommet` ne sont lus : des valeurs incohérentes entre elles (xS hors de l'intervalle des racines) donneraient un tableau mal formé, et un élève aux coefficients justes mais aux racines fausses reste jugé sur le vrai tableau. Coefficients justes ou inexploitables → `ex.fonction` lui-même : aucun changement.

- `tableauSignes.ts` : colonnes en `latexRacine` (valeurs hors ¼ℤ), signe « 0 » à la tolérance flottante près (`signeReel`) — une racine irrationnelle d'une fonction effective donne f(r) ≈ 1e-15 (mutant : sans tolérance, « − » à la place de « 0 »). `ecrans.ts` : tableau, aide et consigne sur la fonction effective, `dependDe` = `coefficients` + `axeSommet` [+ `racinesChamp2`]. `verification.ts`, `solutions.ts` : idem.
- **Panneau de faits** : les racines de `racinesChamp1/2` (équation VRAIE, non cascadée) ne sont plus rappelées quand les coefficients confirmés sont faux : elles contrediraient la fonction et les valeurs de x que le tableau affiche (défaut vu sur la capture Chromium, corrigé, mutant tué).
- **Tests** : `scripts/test-cascade-tableau-gen7.ts` (27 vérifications, deux régimes : signe de a opposé, Δ < 0 → 3 colonnes, racines irrationnelles, repli, dépendances ; 3 mutants tués) ; `test-generation-gen7` (dépendances du tableau) mis à jour ; scénario Chromium `scenarioGen7CascadeTableau` (390/1280, deux régimes ; captures `*-gen7-cascade-tableau-*.png`).
- **Limites** : sous correction coupée, la FORME du tableau (3 ou 7 colonnes) suit les coefficients confirmés : un jeu de coefficients qui change la structure des racines est distinguable d'un jeu juste (comme l'illisibilité, §38-G) ; `racinesReconnaissance`, `racinesChamp1` et `racinesChamp2` restent sur l'équation vraie (leur cascade sur des coefficients quelconques n'a pas de « catégorie » définie) — une fonction affichée aux écrans allure/axe/image/tableau et une équation vraie aux écrans racines coexistent donc quand les coefficients sont faux.

## §42 : « Afficher la réponse attendue » commande enfin la révélation de la solution (option B du propriétaire)

**Signalement.** Dans l'aperçu d'une tâche où SEULE la correction immédiate est cochée, la réponse attendue s'affiche quand même. **Cause (lue dans le code, pas supposée)** : avec 1 essai (défaut), le premier échec épuise le champ (`calculerEtatChampTentatives`, `lib/moteurTentatives.ts:172-173`, `revelee: true`) ; `construireChampVue` forçait alors `{ feedback_immediat: true, reponse_visible: true }` (ancien `lib/tableauDeBord.ts:182-185`) : solution montrée QUEL QUE SOIT le réglage. `reponse_visible` ne changeait donc presque rien à ce que voit un élève qui se trompe (seulement l'écho de la solution après une RÉUSSITE). C'est la mécanique que §38-C m'avait fait « confirmer » (« quel que soit `reponse_visible` ») sans en tirer que le réglage devenait vide de sens. Le tableau de signes avait le même défaut : `affichageTableau` ne dépendait que de la correction immédiate (ancien `cascade.ts:246`).

**Décision (option B).** La solution n'est montrée pendant la résolution que si correction immédiate ET case cochée. Case décochée : verdict + verrouillage à l'épuisement, **jamais** solution ni `revele`.
- **Seule définition** : `solutionMontreeEnCours` (`lib/reglagesCorrection.ts:15`).
- `construireChampVue` (`lib/tableauDeBord.ts:158`) : `revele = revelee && (solutionMontreeEnCours(reglages) || revelerSansReponse)`. Le reste de la fonction (réglages « réels » forcés à `revele`) suit sans changement : un champ épuisé mais non révélé n'a que `{ feedback_immediat: true, reponse_visible: false }`, donc `statut` seul.
- **Inchangés, délibérément** : la tâche ANTÉRIEURE (`REGLAGES_FORCEES_ANTERIEURES`), la fin d'une tâche sous correction coupée (`revelationFinDeTache`), la règle « jamais dès le 1er échec s'il reste des essais » (correctif URGENT antérieur, `smoke-test.ts`, `test-reponse-visible.ts` §2d), et la révélation sous case cochée.
- **Contrat de projection** : `ContexteProjection.solutionMontree` (`lib/contratGenerateur.ts:252`), posé par `projeterExercice` (`lib/etatExercice.ts:92`). Repli de `racinesChamp2` et valeurs vraies du tableau : `cascade.ts:249` (`affichageTableau`) et `:271` (`zeros`) lisent `solutionMontree`, plus `correctionImmediate`. Sans elle, la vraie factorisation apparaissait dans l'énoncé suivant d'un élève à qui on ne l'avait pas montrée : une fuite que l'option B aurait créée.
- **Panneau de faits** (`corrects`, `cascade.ts:252`) : reste sur `correctionImmediate`. Un fait est la bonne valeur d'un écran RÉUSSI, dont le verdict est visible dès la correction immédiate : rien de nouveau n'est appris.
- Bandeau de l'aperçu (`public/eleve.html:1077`) et charge utile du tableau de bord (`lib/routes/eleves/tableau-de-bord.ts:151`) : le bandeau annonce « réponse attendue affichée / NON affichée ». Libellé de la case (`public/prof.html:636`) : « … une fois les essais épuisés (si correction immédiate) ».

**⚠ Correction d'une affirmation antérieure (à ne pas laisser dans le dossier).** En proposant l'option B, j'ai écrit que la solution n'apparaîtrait « qu'au récapitulatif si `afficher_recapitulatif` ». C'était FAUX : `construireLigneRecap` (`lib/moteurTentatives.ts:264`) n'est appelée par aucune route et ne porte de toute façon aucune solution (un statut, un libellé, un score). Conséquence réelle de B : **case décochée, l'élève ne voit jamais la solution avant l'échéance** (après elle, la tâche antérieure révèle tout). Le libellé « Réponse révélée » du récapitulatif (`libelleStatutRecap`) ne doit pas être branché tant qu'il désigne un champ épuisé sans solution montrée.

**Recherche par motif (tous les sites qui lisent `feedback_immediat` / `correctionImmediate` / `revelee`).**
- `construireChampVue` est le point UNIQUE des trois sorties qui montrent une solution (GET exercice, POST réponses, tableau de bord) : un seul site à changer, vérifié par test aux trois.
- `lib/routes/reponses.ts` `message_erreur` (`parse_error` sous correction immédiate) : message de SYNTAXE, jamais la solution : inchangé.
- `mes-resultats.ts`, `profs/resultats.ts` : statuts et scores, aucun texte de solution : inchangés.
- Aide (`reponses/aide`) : lit l'exercice projeté, aucune solution : inchangée.
- **Un seul site fautif supplémentaire** trouvé : le repli de `racinesChamp2` (voir ci-dessus).

**Tests (écrits d'abord ; mutant : rétablir l'ancien test `feedback_immediat` fait échouer 5 vérifications de `test-reponse-visible`).**
- `scripts/test-reponse-visible.ts` (46) : table de vérité de `solutionMontreeEnCours` ; `construireChampVue` (épuisement, chrono écoulé sans réponse, réussite, antérieure) ; routes réelles du témoin (immédiate × case × 1 ou 2 essais, coupée jusqu'à la fin de la tâche) ; gen7 (tableau, repli de `racinesChamp2` dans l'énoncé servi, faits).
- Tests devenus faux, réécrits (ils encodaient le forçage) : `smoke-test.ts:202`, `test-cascade-gen7-coefficients.ts` (§7, dont l'assertion §38-C), `test-temoin-technique.ts` (épuisement, tableau de bord ; le nombre d'assertions de la Section A ne bouge pas), `test-cascade.ts` (R2, R3 ; **R3b** ajouté), `test-cascade-tableau-gen7.ts` (régime « immédiate » = case cochée).
- **Écart signalé** : `scripts/support/generateurCascade.ts` lisait `contexte.correctionImmediate` pour son repli ; il lit `solutionMontree`.

**Validation (export propre `git archive` du commit `8b1cfa5`, `npm ci`).** `tsc -b` OK ; 40 scripts `test-*` / `smoke*` : 0 échec ; `npm run chromium-temoin` : 2073 vérifications (390 px et 1280 px, dont le nouveau `scenarioReponseVisible` : verdict montré dans les deux cas, `.moteur-solution` absent case décochée, présent case cochée) ; `npm run chromium-design` : 222 vérifications. Captures : `captures-chromium/{390,1280}-reponse-visible-{cochee,decochee}.png`.
- **Échec intermédiaire, cause établie (pas un « flake »)** : 1 échec à 1280 px seulement dans `scenarioEtendu` (`chromium-temoin-technique.ts`, attente de `.moteur-solution`). Depuis §42, une tâche à case cochée montre aussi la solution d'un écran RÉUSSI : `waitForSelector(".moteur-solution")` se satisfaisait d'une solution déjà à l'écran avant le rendu de celle de l'écran courant. Corrigé en attendant `courant.locator(".moteur-solution")` ; aucun code de production touché.
- **Non couvert, à savoir** : les cas d'un exercice à plusieurs essais avec chrono `par_ecran` sous case décochée sont testés en fonction pure (`construireChampVue`, chrono écoulé sans réponse) mais pas en navigateur.

## §43 : Enveloppe de l'exercice — un écran à la fois, progression et « Ce qu'on sait déjà » (design cible du propriétaire)

**Demande.** Changer le design de l'écran d'exercice pour celui du gen7 de l'ancien pilote (captures Chromium + `style.css` fournis), en ne reprenant QUE : la mise en page de la page,
le passage d'écran à écran, le rappel « Ce qu'on sait déjà ». Tout le reste reste à nous : validation / invalidation, tentatives, aides, tableau de signes, et la couleur vert / rouge / jaune
de l'écran validé. Périmètre : interface élève (`eleve.html`) ; `prof.html` inchangé.

**Faits établis avant de coder (mesurés, pas supposés).**
- Les **31 tokens de `:root` de la source sont identiques, valeur par valeur**, aux nôtres (v2 en ajoute 5 : `--coef-a|b|c`, `--ombre-carte`, `--ombre-bouton`) ; mêmes polices (Fraunces, Inter), même lien Google Fonts. Ce n'est donc **pas** un changement de palette : c'est la structure de l'écran.
- Les captures du premier zip (« Gen7S1 ») que j'avais prises pour l'application actuelle étaient le gen7 de l'ancien pilote, donc la cible : erreur de ma part, corrigée ici.
- Le CSS source est une pile de correctifs par identifiant (`#af-…`, `#exercice.exercice-af`) : structure de code que `CLAUDE.md` interdit de reprendre. Seules les **valeurs** ont été relevées (rappel : `padding 14 16`, segments de 12 px, marques de 20 px ; titres : surtitre 11 px, titre Fraunces 20 px), puis réécrites avec nos tokens.

**Livré.**
- **Référence** `docs/reference/enveloppe-exercice.html` (avant le composant, comme l'exige `CLAUDE.md`) : lien, surtitre, titre, carte avec panneau en creux, quatre états de ligne (juste / faux / illisible / sans verdict) + ligne en cours.
- **Moteur** `public/moteur/moteur.js` : `afficher` (l.108) = UN écran courant ; `construireEntete` (l.175), `construireRappel` (l.206), `ligneFaite` (l.250), `MARQUES_RAPPEL` (l.28), `nomDe` (l.37). Le rappel ne dérive que de `exercice.champs` (`verrouille`, `modifiable`, `statut`, `valeur_saisie`, `solution_attendue`) : `statut === null` (correction coupée) → marque `•` et segment `--violet-2`, **jamais une coche**. « Exercice i sur m » : `demarrerTache` passe `rang`/`total` (l.527).
- **CSS** `public/moteur/ecrans.css` : bloc « Enveloppe » (l.31 et suivantes), uniquement des tokens (test de design system : 610 vérifications) ; `.moteur-exercice` n'a plus de padding propre (l.20) ; `--retrait-plein-bord` recalculé (`public/style.css:146` et `:152`).
- **Contrat** : `EcranDeclare.nom` (`lib/contratGenerateur.ts:82`, optionnel), posé sur gen7 (`NOMS_ECRANS`, `ecrans.ts:62`) et le témoin (`_temoinTechnique/index.ts:602`). Le champ ne s'appelle pas `titre` : `EcranTableauSignes.titre` existe déjà.
- **gen7** : la ligne « Ce que tu sais déjà » des consignes (`ligneFaits`, `ex.corrects`) est **supprimée**, remplacée par le rappel du moteur (valable pour tous les générateurs). Les tests qui la verrouillaient verrouillent son absence et la présence des noms.

**Décisions prises, à confirmer (le propriétaire tranche).**
1. **Mobile plein-bord NON repris.** La cible est plein-bord à ≤ 600 px (feuille sans arrondi, bandeau gris qui touche la bannière). Cela contredit la référence stricte des composants (`composants-ecran.html` : carte arrondie, padding 24, mesurée à 390 px). J'ai gardé la carte validée à toutes les largeurs ; le documenter ici plutôt que de casser une référence sans décision.
2. **Sans écran courant** (exercice terminé, tâche antérieure, remise à venir du retour en arrière), la **relecture reste celle d'avant** (une carte par écran : énoncé, « Ta réponse », verdict, solution, « Modifier ma réponse »). Le rappel compact ne porte pas l'énoncé ; sans cette carte, un élève ne pourrait plus relire l'énoncé d'un exercice fini. L'écran de fin de la cible (« Résultat de l'exercice », récapitulatif de session) n'est PAS porté ici.
3. **Valeur d'une ligne** = la réponse d'ÉLÈVE résumée par le composant (`resumer`), pas un texte d'auteur compact comme « Sommet : (2 ; −8) » de la cible : plus verbeux (ex. « Axe de symétrie AS ≡ x = −5/2 ; xS = −5/2 ; yS = −75/4 »). Un texte de rappel déclaré par le générateur serait plus compact ; non fait ici.
4. **Majuscules écrites, jamais `text-transform`** (`test-structure-tableau` l'interdit, RAPPORT §30) : « EXERCICE i SUR m », « CE QU'ON SAIT DÉJÀ » sont en majuscules dans le texte ; le nom de la tâche reste tel que saisi.
5. **Nom de la tâche** ajouté au surtitre (« EXERCICE 1 SUR 2 · DEVOIR 3 ») : la cible ne l'affichait pas, mais l'ancien écran le montrait et il est utile à l'élève.
6. **Progression** = écrans répondus / total (avancement, pas un score) ; segments verts / rouges / ambre selon le verdict que le serveur montre, neutres sans verdict.

**Fidélité mesurée.** `scripts/chromium-fidelite-design.ts` (l.265 et suivantes) rend la référence et l'application dans le même Chromium à 390 ET 1280 px et compare les styles calculés (lien, puce, surtitre, titre, panneau, piste, segments, marques, noms, valeurs) et 7 espacements ; + la zone tactile du lien (≥ 44 px par pseudo-élément) et l'absence de toute couleur de verdict sous correction coupée. **516 vérifications** (222 d'origine inchangées : les composants validés ne bougent pas). Les cinq écarts trouvés en route ont été corrigés, aucun admis (`display` inline-flex vs flex, taille de la puce en `em`, rayon des pilules en jeton).

**Tests adaptés** (`scripts/chromium-temoin-technique.ts`, 2247 vérifications) : la matrice visuelle lit l'état « illisible » d'un écran verrouillé sur la marque de sa ligne (`ligneDuRappel`, l.456) sauf pour le dernier écran (l'exercice est alors terminé : relecture en carte) ; les scénarios gen7 vérifient « Question k sur N », la progression et le rappel (marques neutres sous correction coupée) ; l'aperçu du retour en arrière cherche `.moteur-rappel-ligne-neutre`.

**Bug trouvé par les tests (corrigé).** Sous retour en arrière, un écran répondu mais modifiable a `verrouille = false` (`modifiable = true`) : le rappel l'ignorait. « Répondu » = `verrouille || modifiable` (`moteur.js:211`).

**Non traité (hors périmètre, à décider).** Écran « Résultat de l'exercice » et récapitulatif de session (la cible) ; le tableau de session de l'ancien pilote déborde à 390 px (signalé par l'autre session : à ne pas reproduire) ; pastille « Tentative n/3 » et aides (gardées telles quelles, décision du propriétaire) ; `ContexteProjection.correctionImmediate` n'est plus lu par aucun générateur depuis la suppression de `ligneFaits` (champ conservé pour l'instant).

**Validation (export propre `git archive` du commit `091fb09`, `npm ci`).** `tsc -b` OK ; 40 scripts `test-*` / `smoke*` : 0 échec ; `npm run chromium-temoin` : 2247 vérifications (390 px et 1280 px) ; `npm run chromium-design` : 516 vérifications (dont l'enveloppe à 390 et 1280 px). Captures : `captures-chromium/fidelite-app-enveloppe-{390,1280}.png`, `fidelite-app-enveloppe-coupe-{390,1280}.png`, `{390,1280}-gen7-*`.

## §44 : Assemblage de l'enveloppe — gris AU-DESSUS du blanc, bord à bord sur mobile (retour du propriétaire sur §43)

**Retour (captures de test sur téléphone, image 1 = cible, image 2 = §43).** Le design n'était pas respecté : (1) la largeur du bloc blanc doit être celle de l'écran ; (2) le bloc gris « Ce qu'on sait déjà » ne doit pas être
contenu dans le bloc blanc, mais AU-DESSUS, sa bordure basse étant la bordure haute du blanc, et avoir lui aussi la largeur de l'écran ; (3) l'espace entre la bannière violette et le bloc gris doit avoir la couleur du bloc gris.

**Cause (mienne).** En §43 j'avais gardé la carte arrondie à toutes les largeurs (point 1 de ma liste de décisions « à confirmer ») et placé le panneau DANS la carte, pour ne pas contredire la référence stricte de `composants-ecran.html`. Le propriétaire
tranche : la cible prime sur mobile. Cela rend caduque cette décision et change la carte de tous les composants (voir « Conséquences »).

**Livré.**
- **DOM** : le rappel est un FRÈRE placé avant la carte (`public/moteur/moteur.js:131`), plus un enfant. La couleur de verdict ne touche donc que la carte (le gris n'en hérite plus).
- **Bureau (> 600 px)** : panneau gris et carte blanche de même largeur, un seul bloc aux angles arrondis (gris en haut, blanc en bas) ; la carte n'a plus de bord haut : la bordure basse du gris EST le haut du blanc (`ecrans.css:271`, `.moteur-rappel + .moteur-ecran`).
- **Mobile (≤ 600 px)** (`ecrans.css:277` et suivantes) : tout est bord à bord. Le bandeau gris (lien + titres) touche la bannière violette et a la couleur du panneau ; panneau gris (filets haut et bas) et carte blanche font la largeur de l'écran (sans arrondi, sans bord latéral, padding 16 px).
  Les gouttières de la page sont annulées par `--gouttiere-page` / `--marge-haute-page` (`public/style.css:144`, `:155`), valeurs de mise en page et non des tokens (la gouttière mobile de 14 px n'est pas dans l'échelle). Bug évité en route : `.moteur-exercice { max-width: 100% }`
  empêchait les marges négatives d'élargir le bloc (largeur 362 au lieu de 390) : `max-width: none` sous 600 px.
- **Référence** `docs/reference/enveloppe-exercice.html` réécrite : même ordre, gabarit unique avec une requête `@media (max-width: 600px)`.

**Mesuré en Chromium** (`scripts/chromium-fidelite-design.ts`, **573 vérifications** dont la géométrie de §44) : à 390 px, carte blanche, panneau gris et bandeau ont la largeur exacte de l'écran (390), le bandeau touche la bannière (0 px), bandeau et panneau ont la même couleur et se touchent ;
à 1280 px comme à 390, le panneau gris n'est pas un descendant de la carte, a la même largeur et le même bord gauche, et son bas est le haut de la carte (0 px).

**Conséquences (documentées, pas cachées).**
1. **La carte des composants n'est plus celle de `composants-ecran.html` par son enveloppe** (bord haut, rayons, padding latéral, largeur). `P_CARTE` (`chromium-fidelite-design.ts:41`) ne compare plus que le fond, l'ombre, le bord bas et le padding bas ; ce que la carte CONTIENT (consigne, champs, boutons, espacements) reste mesuré contre la référence des composants, les 222 vérifications de contenu sont inchangées. Décision du propriétaire, à son initiative.
2. **Tableau de signes** : `--retrait-plein-bord` vaut 16 px sur mobile (`style.css:158`), le padding de la carte déjà bord à bord ; 24 + 1 + gouttière sur bureau (inchangé). `verifierPleinBord` (`chromium-temoin-technique.ts`) exige maintenant, sous 600 px, un tableau de la largeur exacte de la carte (et non plus qui en sorte) et un padding de carte de 16 px.
3. **Cohérence avec les cartes du tableau de bord** : la carte d'écran garde l'ombre et le fond de `.carte-tache` ; le rayon et le filet n'en sont plus comparés.
4. **Test de design system** (`scripts/test-design-system.ts`, l.51 et l.55) : le seuil d'une requête `@media (max-width: 600px)` n'est pas une « longueur en dur » ; `0` est admis comme valeur de `border-radius` (angle droit) — la règle « aucun rayon en dur » reste pour toute autre valeur.

**À confirmer (décision mienne sur un point non tranché).** **Sur bureau**, la cible de l'ancien pilote montrait le panneau gris DANS la carte ; j'ai appliqué la règle énoncée (« au-dessus, bord haut = bord bas ») à toutes les largeurs : un bloc gris en haut / blanc en bas, même largeur. Dis-moi si tu préfères l'ancien rendu bureau.

**Validation** : voir la section ci-dessous (export propre du commit final).

**Validation de §44 (export propre `git archive` du commit `13cc018`, `npm ci`).** `tsc -b` OK ; 40 scripts `test-*` / `smoke*` : 0 échec ; `npm run chromium-temoin` : 2247 vérifications ; `npm run chromium-design` : 573 vérifications.
- **Échec intermédiaire, cause établie** : sur l'export du commit `ee7482d`, `scenarioApercu` a échoué au clic « Fermer cet onglet » (« Target page … has been closed »). Ce bouton appelle `window.close()` : Playwright peut signaler la fermeture pendant le clic. Scénario inchangé par §43-§44 et passé 4 fois avant ; le clic ne tolère plus que cette erreur précise, la fermeture reste vérifiée par l'événement `close`. Aucun code de production touché.
- Captures : `captures-chromium/fidelite-app-enveloppe-{390,1280}.png`, `fidelite-app-enveloppe-coupe-{390,1280}.png`, `{390,1280}-gen7-*`.

## §45 : quand la solution est montrée, la cascade repart de la VRAIE valeur (précise D-A de §38, demande du propriétaire)

**Demande.** Avec « Afficher la réponse attendue une fois les essais épuisés » cochée, l'élève voit la solution de chaque écran raté ; or les écrans suivants continuaient à s'appuyer sur sa réponse FAUSSE (§18, §38). Incohérent : on lui montre la vraie valeur puis on lui pose la suite sur la fausse.

**Livré.**
- `projeterExercice` (`lib/etatExercice.ts:96`) ne transmet à `projeter` que les réponses `statut === "correct"` quand `solutionMontree` (`solutionMontreeEnCours`, §42, seule définition). Filtre unique au point de substitution : aucun code de gen7 modifié. Contrat documenté dans `lib/contratGenerateur.ts` (doc de `projeter`).
- **Inchangé** : correction coupée et immédiate SANS la case (rien n'a été montré : la méthode juste appliquée à une donnée fausse reste acceptée, §38) ; réponse correcte : point de départ comme avant.
- Effets vérifiés côté serveur : énoncé de `allure` (vraie fonction, plus « d'après les coefficients que tu as donnés »), allure jugée sur la vraie fonction (la méthode juste sur SES coefficients devient fausse), `racinesChamp2` (vraie factorisation), `domaineImage` (vraie ordonnée), tableau de signes (vraies valeurs de x, jugé sur la vraie fonction).

**Tests.** Nouveau `scripts/test-cascade-revelee.ts` (26 vérifications, 3 régimes × 5 scénarios, VRAI routeur). Tests existants mis à jour car ils supposaient la case cochée par défaut de `creerTache` : `test-cascade.ts`, `test-cascade-gen7-coefficients.ts`, `test-route-gen7.ts`, `test-cascade-tableau-gen7.ts` (option `reponse_visible: false` pour le régime « immédiat », section « 4 bis » pour le régime révélé). Chromium : `assignerGen7` reçoit une option `visible` (`scripts/chromium-temoin-technique.ts:1467`) ; `scenarioGen7Cascade` (l.1592) et `scenarioGen7CascadeTableau` (l.1829, trois régimes : immédiat sans la case, coupé, immédiat avec la case) — 2081 vérifications au total.

**À savoir.**
- **HYPOTHÈSE assumée** : « solution montrée » = réglage statique de la tâche, pas l'état d'un champ. Une réponse fausse avec essais restants ne déclenche rien (l'écran dépendant n'est de toute façon servi qu'une fois le champ terminé, `dependDe`).
- **Conséquence pédagogique** : sous la case cochée, un élève qui se trompe aux coefficients ne peut plus « gagner » les écrans suivants par cohérence interne ; il repart de la vraie fonction. C'est le comportement demandé ; il rend ce régime plus exigeant que les deux autres.
- `ContexteProjection.correctionImmediate` n'est plus lu par aucun générateur (conservé dans le contrat).

## §46 : la relecture / le récapitulatif aussi bord à bord sur mobile (retour du propriétaire sur §44)

**Demande.** « Même dans l'écran récapitulatif, les blocs doivent avoir une largeur égale à la largeur de l'écran. » En §44, seuls le bandeau, le panneau gris et la carte COURANTE étaient bord à bord ; les cartes de relecture (`.moteur-ecran-termine`), le panneau de remise, « Exercice terminé » et les messages gardaient la gouttière de la page (capture : 390 px → blocs de ~358 px).

**Livré.**
- `public/moteur/ecrans.css:284` (dans `@media (max-width: 600px)`) : la règle qui rendait la gouttière aux enfants hors bord à bord est SUPPRIMÉE ; `.moteur-ecran-termine`, `.moteur-fin` (dont `.moteur-remise`) et `.moteur-message` sont sans arrondi, sans bord latéral, `padding-inline: var(--espace-3)`. Uniquement des tokens (`test-design-system` : 646 vérifications).
- **Test** : `verifierBlocsRelecturePleineLargeur` (`scripts/chromium-temoin-technique.ts:712`), appelé dans l'état « avant la remise » (cartes de relecture + panneau de remise) et « après la remise » (récapitulatif + « Exercice terminé ») : à 390 px chaque bloc touche les deux bords de l'ÉCRAN, rayon 0, bords latéraux 0 ; à 1280 px tous ont la largeur de la colonne. **Contrôle de mutation** : avec l'ancien CSS, 34 vérifications échouent ; avec le nouveau, 2313 passent.
- `chromium-design` : 573 vérifications inchangées (la référence `enveloppe-exercice.html` décrit l'écran courant, pas la relecture).

**À savoir.** Le récapitulatif n'a PAS de référence dans le design cible du propriétaire (l'écran de fin / récapitulatif de session de l'ancien pilote n'est pas porté) : ce choix (cartes de relecture « en creux » bord à bord, séparées par le fond de page) est une décision de ma part, à confirmer visuellement sur `390 retour-01-panneau-remise.png` et `390 retour-04-apres-remise.png`.

## §47 : bureau — le panneau « Ce qu'on sait déjà » passe DANS la carte (choix B du propriétaire), mobile inchangé

**Demande.** Après comparaison en images (bloc joint « A » contre gris dans la carte « B »), le propriétaire choisit **B sur bureau, mobile inchangé** : sur grand écran le panneau gris est un encadré en retrait dans la carte, comme l'ancien pilote (`.recap-cumulatif`) ; sous 600 px, rien ne change (gris AU-DESSUS du blanc, bord à bord, §44).

**Livré (une seule structure, deux mises en page en CSS).**
- `public/moteur/moteur.js:132` : le panneau du rappel est le **premier enfant** de la carte de l'écran courant (il était son frère précédent). Aucun élément englobant, aucun déplacement par script selon la largeur.
- `public/moteur/ecrans.css:109` : `.moteur-rappel` = encadré (filet, arrondi `--radius-sm`, padding 14 × 16). Bloc « Assemblage » `ecrans.css:266` : la règle « bloc joint » de §44 disparaît ; sous 600 px, `.moteur-ecran-courant > .moteur-rappel` (l.312) annule le padding latéral de la carte par des marges négatives, la carte perd son padding haut, `.moteur-suivi + .moteur-ecran-courant` annule le `gap` — on retrouve exactement la mise en page de §44.
- Référence `docs/reference/enveloppe-exercice.html` restructurée (rappel dans la carte, encadré sur bureau, marges négatives sur mobile) ; `docs/design-system.md` et `CLAUDE.md` (section Enveloppe) mis à jour. **Correction d'une erreur de §46** : la phrase ajoutée à CLAUDE.md avait été insérée au milieu d'une puce ; remise à sa place.
- `scripts/chromium-fidelite-design.ts:347` : géométrie réécrite (panneau = premier enfant ; bureau : retrait de 25 px de chaque côté = 1 px de bord + 24 px de padding ; mobile : carte, panneau et bandeau à la largeur de l'écran, panneau au ras du haut de la carte, bandeau gris collé à la bannière) ; la distance « panneau→carte » devient « carte→panneau, HAUT À HAUT » (`decalageHaut`, l.97).

**Preuve que le mobile est inchangé.** Capture `fidelite-app-enveloppe-390.png` rendue AVANT (commit `cdc1107`, export séparé) et APRÈS, comparées pixel à pixel dans Chromium (canvas) : **0 pixel différent** (390 × 971). Le bureau, lui, change comme voulu (959 → 972 px de haut à 1280).

**Vérification.** `chromium-design` : 575 vérifications ; `chromium-temoin` : 2313 ; `test-design-system` : 642.

**À savoir.** Le panneau ne porte JAMAIS la couleur du verdict : le vert / rouge / jaune colore la carte, l'encadré reste gris (sinon un échec serait plus visible qu'une réussite sous correction coupée, et le rappel perdrait sa couleur). Entre 601 et ~720 px (petite tablette, téléphone en paysage), la mise en page « bureau » s'applique : à valider visuellement si ce cas compte.

## §48 : « Modifier ma réponse » devient un crayon (modèle A du propriétaire), dans le rappel gris ET dans la relecture

**Demande.** Remplacer le gros bouton « Modifier ma réponse » du bloc gris par une icône crayon placée à côté de chaque réponse ; après comparaison de quatre maquettes (A pastille à droite, B icône nue après le texte, C bouton contour, D crayon + mot), le propriétaire choisit **A**, **aussi dans la relecture**.

**Livré.**
- `public/moteur/moteur.js:41` : `creerCrayon(nom, surClic)`, **seul** point de création (`<button type="button" class="moteur-crayon">`, icône SVG construite par le DOM, `aria-hidden`). Nom accessible `Modifier ma réponse à l'écran « nom »` (le nom d'auteur passe par `versTexteBrut`, règle des attributs ; l'ancien bouton de relecture disait « à cet écran » sans nom), infobulle « Modifier ». Rappel : `moteur.js:291` (ligne `moteur-rappel-ligne-modifiable`, crayon en dernier enfant) ; relecture : `moteur.js:171` (crayon à droite du bloc « Ta réponse »). Même comportement qu'avant : `afficher(exercice, { edition: champ })`.
- `public/moteur/ecrans.css:898` : `.moteur-crayon` (32 px, rond, `--violet-clair` / `--violet-vif`, survol plein `--violet-vif`, focus 2 px), uniquement des tokens (`test-design-system` : 665). **Le bouton global du site est neutralisé propriété par propriété** (`min-height: 44px`, padding 9 × 18, bord 2 px, ombre violette, marge, `filter: brightness` au survol) : sans cela la pastille aurait fait 44 px de haut et gonflé chaque ligne.
- Texte du panneau de remise : « le crayon à côté d'une réponse rouvre l'écran correspondant » (il citait le bouton).
- **Référence AVANT construction** (règle du dépôt) : `docs/reference/crayon-modifier.html` ; section « Crayon » de `scripts/chromium-fidelite-design.ts:411` (rappel ET relecture, à 390 et 1280 px) : styles calculés du bouton, de l'icône, de la ligne, de la marque et du corps du rappel, centrage dans la relecture. `chromium-design` : 711 vérifications (575 avant).
- Tests Chromium (`scripts/chromium-temoin-technique.ts:728`, `verifierCrayons`) : 32 × 32 mesurés, rond, couleurs, ni ombre ni bord ni marge ni hauteur mini hérités, icône de 16 px, libellé et infobulle, aucun chevauchement entre crayons, aligné à droite du panneau (15–17,5 px du bord), à droite du bloc « Ta réponse » en relecture, **plus aucun `.moteur-bouton-modifier`**, survol, **activation au clavier** (Entrée ouvre l'écran). Contrôle de mutation : un crayon porté à 40 px fait échouer 8 vérifications de `chromium-design`. `chromium-temoin` : 2617.

**Écarts et risques assumés.**
- **Zone tactile de 32 px**, pas 44 px comme le reste de l'application. Un pseudo-élément de 44 px a été essayé sur maquette : avec des lignes de 40 px de pas, les zones se chevauchent et un doigt touche la ligne voisine. 32 px reste au-dessus du minimum WCAG 2.2 AA (24 px, critère 2.5.8).
- **Hauteur du rappel** : une ligne répondue passe d'environ 18 px à 32 px (+ le pas de 8 px) ; avec 8 écrans, le panneau gris grandit d'environ 100 px sous le régime « retour en arrière » (seul régime où le crayon existe). Sur mobile, le nom et la réponse peuvent passer sur deux lignes quand la réponse est longue (le crayon retire environ 44 px de largeur).
- **Icône seule** : sans le mot, un élève qui découvre le crayon peut ne pas en deviner le rôle ; l'infobulle ne s'affiche pas au doigt. Le texte du panneau de remise l'explique. À revoir à l'usage (le modèle D, avec le mot, reste l'alternative).
- Le crayon n'existe que là où l'ancien bouton existait (écran répondu ET modifiable, c'est-à-dire sous correction coupée avec retour en arrière).

## §49 : gen7 reconstruit — deux familles, dix sous-variantes (`af_motif_*` ×7, `af_delta_*` ×3), calcul exact, six écrans

Exécution de `PROMPT-gen7-v2-reconstruction.md`, après le rapport d'état des lieux `docs/gen7-v2-etat-des-lieux.md` (13 divergences D1–D13, 9 questions) et les réponses du propriétaire (Q1–Q9, ci-dessous). Livrable lisible : `docs/gen7-v2-livrable.md`. Branche `gen7-v2`, onze commits (2 de documentation, C1 à C8), une PR.

**Livré (citations exactes).**
- *Calcul exact* : espace vectoriel ℚ(√r) (`src/generateurs/analyseFonctionMotifDelta/exact/`), division par un rationnel seulement, signe par approximation flottante mais zéro EXACT ; lecteur de saisie `lireExpressionExacte` (`exact/lireExpressionExacte.ts:42`) ; comparaison hybride (Q5) `comparerValeur` (`comparaison.ts:25`) : ±0,005 si l'attendu est rationnel, exacte s'il comporte une racine. Une racine non simplifiée donne `RACINE_NON_SIMPLIFIEE`.
- *Génération* : `genererExerciceMD` (`exercice.ts:33`), UN tirage = un indice dans le pool exhaustif de la famille (`familles.ts:139`, ordre du pool contractuel : règle `_v2`), puis une permutation NON canonique (jamais `ax² + bx + c`). Mécanisme invisible des racines complexes conjuguées : `a(x−z)(x−z̄)` donne `b = −2ap`, `c = a(p²+q²)`, `Δ = −4a²q²`. Bornes : `|c| ≤ 100` (Q9). Épinglage graine → exercice : `scripts/support/epinglage-motif-delta.json`, test `scripts/test-generation-motif-delta.ts`.
- *Six écrans* (`ecrans.ts:133`, identiques pour les dix) : coefficients, allure (sens + position du sommet, UNE aide combinée `aides.ts:30`, Q1), axe/sommet, ensemble-image (aperçu « im f = » AU-DESSUS de la saisie, aucune aide), racines (liste avec « Pas de racine », résultat seul), tableau (aide `croquis_parabole` à coefficients réels, Q4). Poids 1/1/2/1/(2 motif | 3 delta)/3 (`ecrans.ts:44`).
- *Codes* (`codes.ts:16`) : `ALLURE_PARTIELLE`, `AXE_SYMETRIE_NOTATION`, `RACINE_NON_SIMPLIFIEE`, `RACINE_PARTIELLE`, `RACINES_NOMBRE_INCORRECT`, et QUATRE vrais détecteurs `TABLEAU_*` (Q8, `tableauSignes.ts:116`, `classerLigne`) : signes inversés → `TABLEAU_SIGNE_INVERSE`, ≥ 1 juste et ≥ 1 faux non inversé → `TABLEAU_SIGNE_PARTIEL`, variations ↗↔↘ / ⌢↔⌣ → `TABLEAU_CONCAVITE_INCORRECTE`, partiel → `TABLEAU_VARIATION_PARTIEL` ; jamais de code sur une ligne entièrement fausse non inversée, jamais sur autre chose que `not_equivalent`. `C04`, `C05_SIGNE_REPETE`, `C06_SIGNE_OPPOSE` ne sont plus déclarés par les nouvelles variantes. `SIGNE_VARIATION_PARTIEL` n'est plus émis ici.
- *Cascade* (`cascade.ts:77`, `projeterMotifDelta`) : les écrans 2 à 6 sont jugés sur la fonction EFFECTIVE (coefficients confirmés exploitables), repli sur la vraie fonction sinon. **Change la règle de §38 pour la nouvelle gen7** : l'écran racines n'est plus sur « l'équation vraie » mais sur la fonction effective (il n'y a plus de factorisation à confirmer). `racinesChamp1`/`racinesChamp2` (§19) sont INCHANGÉS : seuls les anciens `af_*` les câblent encore.
- *Contrat* (`lib/contratGenerateur.ts`) : `Generateur.retire` (l. 314), `EcranIntervalle.apercu` (l. 241), illustration `croquis_allure` à deux réglages (l. 211). Registre : trois branches (retiré / curriculaire / témoin), cohérence vérifiée au chargement (`lib/registreGenerateurs.ts:56-70`).
- *Anciens `af_*`* (Q2) : cachés, pas supprimés. Toujours EXÉCUTABLES au registre (`retire: true`, `src/generateurs/analyseFonction/generateurs.ts`), absents du catalogue affiché, listés dans `VARIANTES_RETIREES` (`lib/catalogueGenerateurs.ts:32`) ; `validerComposition` refuse de les composer, l'assignation et le tableau de bord passent toujours par le registre.
- *Câblage `prof.html`* (discipline CLAUDE.md) : entrées JSON `public/catalogue-generateurs-complet.json` (libellés identiques à `CATALOGUE_GENERATEURS`, `lib/catalogueGenerateurs.ts:15-24`) ET `CORRESPONDANCE_JSON_VERS_PILOTE["4e:7"]` (`public/prof.html:1489-1490`, dix entrées dont `{ index: 0, variante_id: "af_motif_aucune_racine" }`). Vérification réelle : `scenarioGen7Prof` (Chromium, vrai routeur, base en mémoire) contrôle que les DIX champs « nombre d'exercices » existent et ne sont PAS `disabled`, que les quatre anciens sont absents, crée une vraie tâche par l'interface, l'assigne et fait résoudre le premier écran à l'élève.
- *Schéma* : AUCUN changement de `supabase/schema.sql` ni de `cumulatif.sql` (pas de colonne ni de table nouvelle) ; aucune table de plus à `supprimerAncienApercu`.

**Décisions du propriétaire (Q1–Q9).** Q1 une aide combinée sur l'allure ; Q2 anciens `af_*` cachés (à vérifier sur la vraie base qu'aucun n'a été assigné à de vrais élèves : non vérifiable depuis le bac à sable) ; Q3 libellés proposés (catalogue, ci-dessus) ; Q4 `croquis_parabole` à coefficients réels ; Q5 tolérance hybride ; Q6 la famille 2.1 a `b ≠ 0` ; Q7 un seul ordre non canonique déterministe pour les fonctions à deux termes ; Q8 quatre vrais détecteurs `TABLEAU_*` ; Q9 bornes de l'état des lieux.

**Tests ajoutés.** `test-exact-motif-delta`, `test-generation-motif-delta` (propriétés exhaustives par sous-variante + épinglage), `test-croquis-reels`, `test-verification-motif-delta` (dont contrôles de mutation des détecteurs), `test-cascade-motif-delta`, `test-catalogue-motif-delta` (64), `test-route-motif-delta` (200 : vrai routeur, assignation ×10, parcours complet ×10, trois régimes de correction, codes stockés, aide combinée, requêtes forgées, variantes retirées). Trois tests existants migrés vers les nouvelles variantes (`test-apercu-tache`, `test-reglage-retour-arriere`, `test-temoin-technique`). Chromium : `scenarioGen7MotifDelta` — 10 sous-variantes × 2 largeurs, parcours complet au clic, les DEUX réglages de l'allure pilotent le même croquis (3 positions, 2 sens, neutre avant tout choix), aperçu « im f = » au-dessus et non interprété (`7$x` reste `7$x`), aucune aide sur l'ensemble-image, aide d'allure et croquis de parabole, tableau à 3 ou 7 colonnes, 2 aides enregistrées, 6 réponses correctes ; `scenarioGen7Prof`, `scenarioApercu`, `scenarioApercuRetour` migrés. `chromium-temoin` : 3321 vérifications.

**Écarts et risques assumés (à lire).**
- **Petits pools** : 1.1 → 32 exercices, 1.4 → 40 (après `|c| ≤ 100`) ; un élève à qui on assigne beaucoup d'exercices de ces sous-variantes verra des répétitions. 1.3 → 180, 1.5 → 90, 2.1 → 180, 2.2 → 472, 2.3 → 744.
- **Indice de racine uniforme** dans les consignes (« Une racine carrée s'écrit sqrt(2). ») sur TOUS les exercices, même sans radical : un libellé propre aux irrationnelles révélerait la nature des racines.
- **Tableau et structure** : si les coefficients confirmés changent le nombre de racines, la structure du tableau (3 ou 7 colonnes) change ; la réponse bâtie sur la VRAIE fonction y est un `parse_error`, pas un essai raté.
- `sqrt(4)` tapé pour 2 compte comme racine non simplifiée ; une division par un radical est un `parse_error` ; une décimale n'égale jamais un irrationnel.
- Une tâche NON ENCORE assignée qui contiendrait un ancien `af_*` ne peut plus être modifiée (`validerComposition` le refuse, `taches/[id].ts`) ; les tâches déjà assignées continuent de s'exécuter.
- Croquis d'aide du tableau : quand le sommet est sur l'axe Oy, l'étiquette « x_S » et le « 0 » de l'axe se touchent (visible sur `captures-chromium/390-md-1.5-06-tableau-aide.png`) ; lisible, non corrigé.
- Reste ouvert (inchangé) : affichage des scores par écran et cumulés (propositions A–D, en attente du choix du propriétaire).

## §50 : scores par écran et cumul en points (« le score suit la solution »)

Reprise de la demande « afficher les scores pour chaque écran et le score cumulé si on choisit d'afficher la réponse ». Décisions du propriétaire : **condition** = correction immédiate ET « Afficher la réponse attendue » ; **placement** = rappel gris pendant la résolution + tableau final ; **cumul** = points pondérés sur le total possible de TOUS les écrans.

**Livré (citations exactes).**
- *Règle unique* : le score d'un écran (0 à 100 : essais ratés, score partiel, pénalité d'indice, `EtatChampTentatives.score`, `lib/moteurTentatives.ts:123-141`) n'est exposé que là où la solution l'est : `score = terminee && (solutionMontreeEnCours(reglages) || revelerSansReponse) ? etat.score : null` dans `construireChampVue` (`lib/tableauDeBord.ts`, champ `ChampVue.score`). Donc : immédiat + case → au fil de l'eau ; immédiat SANS la case → jamais de score, même exercice terminé ; correction coupée → rien avant la fin de la TÂCHE entière, puis tout (révélation forcée) ; tâche antérieure → tout. Un champ non terminé n'a pas de score (un score de 0 est un score).
- *Exposition* : `GET /api/exercices/:id` envoie `score` ET `poids` pour TOUS les champs (`lib/routes/exercices/[id].ts`) — le dénominateur « points possibles » exige les poids des écrans pas encore servis (statiques, RAPPORT §17, rien à masquer). Le tableau de bord élève reprend `score` par le même `construireChampVue`. **`POST /api/reponses` n'envoie jamais de score** (testé) : seul le GET, relu à chaque écran, le porte.
- *Calcul client* (`public/moteur/pointsEcran.js`, module pur, seule implémentation) : points = poids × score / 100 arrondi à 1 décimale ; **total = somme des lignes AFFICHÉES** (jamais l'arrondi d'une somme exacte : deux nombres à l'écran ne se contredisent pas) ; dénominateur = Σ poids de tous les écrans ; poids invalide → 1 ; score non fini ignoré, hors bornes borné ; format français (« 1,8 / 2 pts », « 0 / 1 pt » : l'unité suit le dénominateur).
- *Interface* (`public/moteur/moteur.js` : `construireRappel`, `ligneFaite`, `construireRecapScores`) : une valeur à droite de chaque ligne répondue du rappel, une ligne « Score » en bas, et le panneau « RÉSULTAT DE L'EXERCICE » (une ligne par écran + « Total ») dans le bloc de fin. **Aucune couleur de verdict** : un 0 n'est pas rouge (la marque porte déjà le verdict) ; valeur en `--violet`. CSS : `public/moteur/ecrans.css` (`.moteur-rappel-score`, `.moteur-rappel-total*`, `.moteur-recap*`), tokens uniquement. Référence : `docs/reference/scores.html`, comparée en Chromium (`chromium-design` : 879 vérifications).
- *Tests* : `scripts/test-scores-ecran.ts` (58 : gate pur ×14, trois régimes sur le vrai routeur, pénalité d'essais 50 % et d'indice 10 %, `poids` de tous les champs, POST sans `score`, tableau de bord, module client). **Contrôle de mutation** : retirer la condition `solutionMontreeEnCours` fait échouer 18 vérifications. Chromium (`chromium-temoin` : 3469) : sous-variante 1.1 jouée avec la case et une pénalité de 10 % (indice sur l'allure → « 0,9 / 1 pt », total « 1,9 / 10 pts » puis « 6,9 / 10 pts », tableau final « 9,6 / 10 pts »), les neuf autres sans la case (aucun score), régime coupé (aucun score pendant, tableau final complet à la fin de la tâche).
- *Défaut trouvé par la mesure du style calculé* : `font-weight: inherit` sur `th` (spécificité 0,1,1) écrasait `.moteur-recap-nom` : les noms du tableau final n'étaient pas en gras. Corrigé (règle retirée), verrouillé par `chromium-design`.
- *Schéma* : aucun changement (`schema.sql` / `cumulatif.sql` inchangés).

**Écarts et risques assumés (à lire).**
- **LOGIQUE — exception à §16 assumée** : un score partiel (ex. 37,5) révèle `fractionCorrecte`, que CLAUDE.md disait « ne jamais sortir d'une réponse HTTP ». Elle n'est exposée que là où le verdict et la solution le sont déjà ; jamais sous correction coupée avant la fin. Elle est LATENTE : aucun générateur de `src/` n'émet aujourd'hui `fractionCorrecte` (le mécanisme existe au contrat, `lib/contratGenerateur.ts`) ; elle ne deviendra visible qu'avec le premier générateur qui l'utilise.
- **Condition stricte** : « immédiat sans la case » ne montre aucun score, même en fin d'exercice, alors que le score ne révèle pas la solution. C'est le choix du propriétaire ; l'alternative (« correction immédiate seule ») ne change qu'une condition.
- **DONNÉES — deux notions de « score » à l'écran** : ces points pondérés (essais, partiel, indice) ne coïncident pas avec le pourcentage du tableau de bord élève, fondé sur les statuts (`scorePondere.js`). Un élève peut voir « 9,6 / 10 pts » dans l'exercice et un pourcentage différent ailleurs.
- **Arrondi** : chaque ligne est arrondie à 0,1 ; le total est la somme des lignes arrondies, donc il peut s'écarter du total exact de moins de 0,05 par ligne.
- **Relecture d'une tâche antérieure** (écran sans bloc de fin) : les scores existent dans la charge utile mais ne sont pas affichés ; le tableau final n'apparaît qu'à la sortie du dernier écran. Non fait.
- **Côté professeur** : aucune vue ne reprend ces points.
- Reste ouvert : un affichage du score dans le bandeau de verdict (« +2 pts ») n'a pas été retenu.

## §51 : suppression des quatre anciennes variantes gen7 (`af_*` « catégories ») et de tout ce qui n'existait que pour elles

Décision du propriétaire, après confirmation qu'aucune tâche n'avait été créée ni assignée : le choix « cachés, pas supprimés » de §49 (Q2) ne reposait que sur le doute d'un exercice déjà assigné. Ce doute est levé, donc le code mort part.

**Supprimé (net : 62 fichiers, −4961 lignes).**
- `src/generateurs/analyseFonction/` en entier : les quatre `Generateur` (`af_mise_en_evidence`, `af_binome_conjugue`, `af_produit_remarquable`, `af_irreductible`), leurs écrans, la cascade, la vérification, et le sous-dossier `racines/` (`racinesChamp1`/`racinesChamp2`, expressions algébrique et numérique, messages de syntaxe, génération).
- Le mécanisme « variante retirée » : `Generateur.retire` (`lib/contratGenerateur.ts`), `VARIANTES_RETIREES` et son repli dans `labelPourVariante` (`lib/catalogueGenerateurs.ts`), la branche « retiré » et le paramètre `retirees` de `verifierCoherenceRegistre` (`lib/registreGenerateurs.ts`) : le registre redevient deux cas (curriculaire : au catalogue, mêmes `generateur_id`, codes au dictionnaire ; non curriculaire : jamais au catalogue).
- Les suites qui ne testaient que l'ancien code : `test-verification-gen7`, `test-verification-racines`, `test-generation-gen7`, `test-cascade-gen7-coefficients`, `test-cascade-tableau-gen7`, `test-route-gen7`, leur fixture `scripts/support/generateurRacinesTest.ts`, les tables de vérité figées contre l'ancien pilote (`table-verite-gen7-pilote.json`, `table-verite-racines-pilote.json`) et leurs documents d'extraction (`docs/extraction-table-verite-*.md`). Dans `chromium-temoin` : `scenarioGen7Parties` (remplacé par `scenarioGen7MotifDelta`, §49) et `scenarioGen7CascadeTableau`.
- Dans `CLAUDE.md` : les sections §19 (factorisation) et §33 (« `af_*` au registre »), réécriture de §38 et de l'introduction de §49.

**Conservé volontairement.** La taxonomie : `C04`, `C05_SIGNE_REPETE`, `C06_SIGNE_OPPOSE`, `FC_*` au dictionnaire, aux explications et au profil de compétences. Ce sont des données de curriculum, utilisées comme fixtures par `test-profil-competences`, `test-categorisation-profil`, `test-explication-competences` et d'autres ; les supprimer changerait les comptes épinglés de ces tests sans rien simplifier. À décider si une future famille de factorisation ne revient jamais.

**Rapatrié avant la suppression** (les nouveaux modules en dépendaient) : constantes de champ `CHAMP_COEFFICIENTS|ALLURE|AXE_SOMMET|DOMAINE_IMAGE|TABLEAU_SIGNES`, types `Terme` et `AffichageColonnes` → `src/generateurs/analyseFonctionMotifDelta/types.ts` ; codes `CODE_ALLURE_PARTIELLE`, `CODE_AXE_SYMETRIE_NOTATION`, `CODE_RACINE_PARTIELLE` → `…/codes.ts` ; `LIGNES_TABLEAU` → `…/tableauSignes.ts`. Valeurs identiques : aucun `variante_id`, aucun code, aucun nom de champ ne change, donc aucun exercice existant n'est affecté.

**Couverture : rien de transversal n'est perdu — chaque règle testée via l'ancien gen7 l'est maintenant via le nouveau, avec un contrôle de mutation.**
- `test-cascade-revelee` (§45) : réécrit sur `af_delta_racines_rationnelles` graine 4242 (f = x² + 3x − 4), mêmes cinq règles ; 31 vérifications. Mutation : retirer le filtre `statut === "correct"` de `projeterExercice` (`lib/etatExercice.ts:96`) → 7 échecs.
- `test-reponse-visible` : section gen7 réécrite (tableau aux valeurs vraies seulement sous `solutionMontreeEnCours`, pur + de bout en bout). Mutation : `solutionMontree` → `correctionImmediate` dans `projeterMotifDelta` → 2 échecs.
- `test-retour-arriere` : graphe de dépendances du nouveau gen7 (modifier `axeSommet` périme `domaineImage` ET le tableau, pas l'allure ni les racines ; modifier `coefficients` périme les cinq autres). Mutation : ne compter que la première dépendance → 13 échecs. Attendu corrigé : le tableau reste servi quand `domaineImage` est périmé (il n'en dépend pas) ; un seul écran est affiché à la fois.
- `test-katex` : la garde « tout texte d'auteur compile » couvre maintenant les dix sous-variantes (180 166 vérifications, 1337 formules distinctes), avec coefficients radicaux confirmés par l'élève et entrées malformées de `sqrt`. **Lacune comblée au passage** : `scripts/support/textesAuteur.ts` ignorait `EcranIntervalle.apercu` (« im f = ») ; une mutation du libellé (`$` non fermé) est maintenant attrapée (3000 échecs).
- Chromium : `scenarioGen7Coupe` et `scenarioGen7Cascade` réécrits (fonction de l'élève, tableau symbolique, rien de révélé avant la fin, tableau final avec scores 10 / 11) ; `scenarioRetourArriere` migré (6 écrans, 5 crayons dans le rappel, modification d'`axeSommet`) ; **nouveau `scenarioRetourArriereTemoin`** : l'aller-retour exact des composants champ texte et QCM (que le nouveau gen7 n'utilise plus) est joué sur le témoin technique. `chromium-temoin` : 2947 vérifications (3469 avant : les scénarios uniquement hérités ont disparu).
- Le harnais `imposerProfilAssignation` remplace `Math.random` à l'assignation : `assignerMD` remet le profil à « aléatoire », sinon une graine demandée est silencieusement ignorée.

**Écarts et risques assumés.**
- **Irréversible hors git** : si un jour une variante de factorisation revient, elle sera reconstruite (l'historique git et §19/§33 en gardent la spec). Aucune donnée de production n'est concernée (aucune tâche).
- **DONNÉES — vérifié par le propriétaire, pas par moi** : « aucune tâche créée » est une déclaration. Si un exercice `af_*` existait, `chercherGenerateur` renverrait `null` et la ligne serait traitée comme non exécutable (repli à 1 pour les poids, 409 à la réponse).
- Les comptes `chromium-temoin` ne sont pas comparables d'une livraison à l'autre (scénarios supprimés).

## §52 : les parties fausses d'une réponse sont surlignées en rouge (correction immédiate), dans l'écran courant et dans l'écran récapitulatif

Demande du propriétaire : « surligner en rouge les champs / boutons-choix qui sont faux dans le cas où il y a correction immédiate (avec ou sans tentatives), de même pour l'écran récapitulatif ». Périmètre choisi : **tous les composants de gen7** (champs multiples, intervalle, liste de racines, tableau), plus le champ texte et le QCM du témoin.

**Constat de départ.** Le serveur ne disait que « correct / faux » pour un écran entier : aucun générateur ne savait dire *quelle partie* était fausse. Il a fallu étendre le contrat de vérification, pas seulement le CSS.

**Livré (citations exactes).**
- *Contrat* : `ResultatVerification.not_equivalent.partiesFausses?: string[]` (`lib/contratGenerateur.ts`, bloc commenté : identifiants par type d'écran). Contrôle de forme dans `verifierAvecControle` (`lib/registreGenerateurs.ts`) : liste de ≤ 200 chaînes de 1 à 60 caractères, sans doublon, jamais sur un verdict autre que `not_equivalent` — sinon échec bruyant, comme un code non déclaré.
- *Identifiants* : `champs_multiples` = id du sous-champ ; `intervalle` = `crochetGauche` | `borneGauche` | `borneDroite` | `crochetDroit` ; `liste_valeurs` = `ligne:<i>` (rang dans la liste soumise) | `mode:aucune` ; `tableau_signes` = `<ligne>:<ancre>` ; `qcm` = id du choix coché ; `champ_expression` = `champ`.
- *gen7* (`src/generateurs/analyseFonctionMotifDelta/`) : `coefficients.ts`, `allure.ts`, `axeSommet.ts`, `domaineImage.ts`, `racinesEcran.ts`, `tableauSignes.ts` désignent chacun leurs parties. Une valeur juste mais écrite avec une racine non simplifiée est une partie fausse (le verdict est négatif). `domaineImage` juge désormais crochets et bornes séparément (avant : retour anticipé sur les crochets). Témoin : `somme` (`champ`) et `parite` (choix coché), `src/generateurs/_temoinTechnique/index.ts`.
- *Porte unique* : `lib/partiesFausses.ts` (`partiesFaussesDe`, `recalculerPartiesFausses`) : exposées seulement sous correction IMMÉDIATE — le réglage RÉEL de la tâche (`contexte.reglages.feedback_immediat`), jamais la révélation forcée d'une tâche antérieure ni d'une fin de tâche sous correction coupée — pour un verdict `not_equivalent` dont le générateur désigne des parties. Avec ou sans « Afficher la réponse attendue », avec ou sans essais supplémentaires.
- *Exposition* : `POST /api/reponses` (`parties_fausses`, `lib/routes/reponses.ts`) et `GET /api/exercices/:id` (`champs[].parties_fausses`, `lib/routes/exercices/[id].ts`) ; le GET re-vérifie la dernière réponse enregistrée sur l'exercice projeté courant (sous correction immédiate les écrans amont sont verrouillés : la projection est celle d'origine) et ne fait jamais échouer la lecture (`null` en cas d'erreur).
- *Client* : `public/moteur/ecrans/marquage.js` (seule implémentation : classe `moteur-partie-fausse`, `aria-invalid` sur un champ ou un radio, `aria-description` sur un bouton, retrait de la marque dès que l'élève modifie SA partie — jamais de marquage pendant la frappe) ; `marquer(ids)` sur les six composants ; `resumer(ecran, valeur, parties)` surligne les morceaux faux de « Ta réponse » (rappel gris ET écran récapitulatif, `moteur.js:rendrePieces`), sans aucun changement de forme quand il n'y a rien à surligner.
- *Design* : référence `docs/reference/parties-fausses.html` ; CSS en FIN de `public/moteur/ecrans.css` (il doit l'emporter, à spécificité égale, sur les règles d'état : champ verrouillé, option cochée, case renseignée). Fond blanc + filet de 2 px `--danger` + texte `--danger` en gras ; la couleur ne suffit jamais : ✕ (option, bouton, case ; `content: "✕" / ""` pour qu'un lecteur d'écran ne le lise pas) et soulignement ondulé pour un morceau de réponse. Aucun nouveau token (`test-design-system` : 720).

**Tests (chacun avec un contrôle de mutation).**
- `test-parties-fausses` (4203 vérifications, 80 exercices) : pour chaque écran, tous les sous-ensembles de parties perturbées sont désignés EXACTEMENT ; illisible ⇒ aucune partie. Mutations : retirer la détection du doublon de racine → 40 échecs ; désigner la mauvaise partie de l'allure → 40 échecs.
- `test-parties-fausses-route` (28) : trois variantes de correction immédiate, six écrans, POST et GET identiques, aucune partie après réussite ou erreur de syntaxe, **jamais sous correction coupée, même à la fin de la tâche**. Mutation : retirer la porte → 2 échecs (la réponse POST et le GET de fin de tâche divulguaient les parties).
- Chromium (`chromium-temoin` : 3037) : `scenarioPartiesFausses` (gen7 : une partie fausse par type de composant, marque attendue + `aria`, retrait à la modification, relecture rappel et récapitulatif, avec et sans la case) ; `scenarioPartiesFaussesTemoin` (champ texte et QCM) ; `scenarioGen7Coupe` verrouille l'absence de marque sous correction coupée. `chromium-design` : 1019 vérifications dont chaque case de tableau marquée (le premier essai ne mesurait que la 1re, la mutation l'a montré).

**Écarts et risques assumés (à lire).**
- **LOGIQUE — information plus fine que le verdict.** Dire QUELLE partie est fausse aide à la corriger : avec des essais supplémentaires, un élève peut éliminer par tâtonnement. C'est le choix explicite du propriétaire (porte = correction immédiate), à la différence des scores (porte = celle de la solution). Aucune règle de §16/§50 n'est contredite (`fractionCorrecte` et `score` ne sortent toujours que là où leur porte l'autorise), mais les deux portes sont désormais différentes : à ne pas confondre.
- **Une racine manquante n'est pas désignable** : si l'élève donne seulement −4 pour {−4 ; 1}, aucune ligne n'est fausse ; le verdict est négatif et seul le rouge de la carte apparaît. De même pour une liste trop longue sur une partie qu'on ne peut pas attribuer.
- **La carte reste teintée en rouge** : le surlignage s'y ajoute (il ne remplace pas le verdict de la carte).
- **Relecture** : les marques apparaissent dans le rappel gris et dans l'écran récapitulatif de fin (ou la consultation d'une tâche antérieure à correction immédiate). Le tableau de bord élève et les vues professeur ne les portent pas.
- **Chaque nouveau générateur doit désigner ses parties** pour bénéficier du surlignage fin ; sans cela, comportement d'origine (carte rouge seule) — jamais une erreur.
- Dépend de la PR #35 (suppression des anciens `af_*`) : branche empilée sur elle.

## §53 : retours du propriétaire sur gen7 — arbre prof, aide jaune, solution = tableau rempli, intervalle sur une ligne

Six remarques après essai de l'aperçu de la PR #36. Livré sur une branche empilée sur #36 (elle-même sur #35).

1. **Arbre prof : deux variantes, sous-variantes dedans.** Les dix entrées JSON de 4e n°7 portent `"groupe": "Sans discriminant"` (7) / `"Avec discriminant"` (3) (`public/catalogue-generateurs-complet.json`) ; `construireGroupeVariantes` (déjà écrit pour gen13) les range dans deux `<details>` ; `libelleVariante` ne préfixe plus `[axe]` quand `groupe` existe (`public/prof.html:1708`). `CORRESPONDANCE_JSON_VERS_PILOTE["4e:7"]` est inchangée (index = position). Vérifié en Chromium contre le vrai routeur : les dix champs existent, aucun `disabled`, deux groupes, aucune ligne hors groupe, aucun préfixe répété, tâche créée de bout en bout par l'interface (`scenarioGen7Prof`) ; `test-catalogue-motif-delta` pose le `groupe`.
2. **Aide jaunâtre avec ampoule** : `creerIconeAmpoule` (`public/moteur/moteur.js:64`), `.moteur-bouton-aide` ambre (`public/moteur/ecrans.css`, fin de fichier), zone d'indice typée ambre aussi. Référence `docs/reference/bouton-aide.html`, mesurée par `chromium-design`.
3. **« Réponse attendue » = le tableau rempli**, sous « Valider » ET dans l'écran récapitulatif (et dans le rappel gris pour un écran non réussi). Contrat `solutionStructuree?` (`lib/contratGenerateur.ts:358`), porte unique `lib/solutionStructuree.ts:9` branchée dans `lib/routes/reponses.ts:179` et `lib/routes/exercices/[id].ts:81` ; implémentation gen7 `solutions.ts:61`, témoin (deux tableaux structurés). Client : `tableauSignes.js:331` (`solution`), `moteur.js:337` (`creerSolution`). Référence `docs/reference/tableau-solution.html`. Mêmes rangées et mêmes hauteurs que le tableau à compléter (mesuré à 390 et 1280 px), 7 colonnes, flèches TRACÉES, texte neutre.
4. **Aide du tableau retirée** (`ecranSix` sans `aide`). 5. **Aide de l'écran « im f » retirée** — voir l'écart ci-dessous. 6. **Intervalle sur une ligne** (`ecrans.css` : `flex-wrap: nowrap`, bornes `flex: 0 1 auto`, plancher 40 px), mesuré à 390, 360 et **320 px**.

**Vérifications.** `test-solution-structuree` (98) : porte unique, trois régimes, POST et GET, tableau servi rejouable comme réponse juste. Mutation : retirer le `null` de la porte → 4 échecs (la forme structurée fuyait sous « case décochée » et sous correction coupée). Mutation intervalle : rétablir `wrap` → échec à 320 px. `chromium-design` : 1177 ; `chromium-temoin` : 3083 (nouveau `scenarioSolutionTableauTemoin` : tableau sous « Valider », rappel gris, case décochée = rien).

**Écarts et risques assumés (à lire).**
- **HYPOTHÈSE — remarque 5.** L'écran « im f » n'avait AUCUN bouton d'aide (`aide_disponible` est faux sur `domaineImage`) : j'ai compris « le coup de pouce » comme la phrase « le sommet est (x_S ; y_S = …) » de la consigne, qui donnait la borne. Elle est retirée. Si l'intention était autre, le revert est une ligne (`ecrans.ts:102`).
- **Libellés** : « avec delta / sans delta » est affiché « Avec / Sans discriminant » (libellés déjà dans le JSON et les tests).
- **Écart antérieur révélé par la mesure** : la case du tableau À COMPLÉTER s'écrit `1.15em` (18,4 px) là où `tableau-signes.html` dit 1,1 rem (17,6 px) ; jamais mesuré avant. Je n'y ai pas touché (la solution est comparée à ce tableau-là, comme demandé) ; à trancher.
- **« Ta réponse » reste textuelle** dans le récapitulatif (seule la réponse ATTENDUE est un tableau) ; la dessiner aussi, avec les cases fausses en rouge, est faisable avec le même constructeur.
- **Correction d'un test fragile** : `scenarioEtendu` attendait « un tableau à 7 colonnes » ; la solution dessinée du quotient de l'exercice 1 en est un, d'où une attente maintenant liée à « EXERCICE 2 SUR ».
- **Portée de la solution dessinée** : tableau de signes seulement ; les autres écrans gardent leur phrase.

## §54 : « Ta réponse » dessinée en tableau dans l'écran récapitulatif

Demande : « Dessine aussi “Ta réponse” en tableau dans le récapitulatif » (suite de §53).

**Livré.** `tableauSignes.js` : `construireLecture` (partagé avec la solution) et `reponse(ecran, valeurSaisie, partiesFausses)` ; `moteur.js` : `resumeTermine` utilise `composant.reponse` quand il existe (étiquette « Ta réponse : » puis le tableau, crayon « Modifier ma réponse » inchangé à droite de l'étiquette), sinon le résumé textuel d'avant. CSS : la couleur neutre des cases en lecture seule ne s'applique pas aux cases marquées (`:not(.moteur-partie-fausse)`, `ecrans.css`), sinon elle masquait le rouge.

**Vérifications** (`chromium-design`, 1203, à 390 et 1280 px) : même cadre, mêmes rangées et mêmes hauteurs que le tableau à compléter ; les cases rendent EXACTEMENT ce que l'élève avait saisi (comparées aux libellés accessibles de l'écran courant avant « Valider ») ; lecture seule, aucune case vide, flèches tracées ; les MÊMES cases fausses qu'après « Valider », avec la même couleur, bordure et fond (mesurés), `aria-description` posé ; cases justes en texte neutre ; pas de résumé en texte en double. Mutation : désactiver l'appel à `composant.reponse` → échec. `chromium-temoin` 3083 et les 46 suites inchangés.

**Écarts et risques.**
- **Porte inchangée** : les cases rouges viennent de `parties_fausses` (§52) : sous correction coupée, ou pour une tâche antérieure sous correction forcée, la réponse est dessinée SANS cases rouges (le tableau rempli de la réponse de l'élève n'est pas une information nouvelle pour lui, comme `valeur_saisie`).
- **Rappel gris non modifié** : « Ta réponse » y reste en texte compact ; seule la relecture (écran récapitulatif) est dessinée, comme demandé.
- **Seul le tableau de signes** a une version dessinée de la réponse ; les autres écrans gardent leur résumé textuel.

## §55 : configuration PAR LIGNE de composition de tâche (commit C1 de gen8, premier consommateur : gen8 « f(x) à partir du graphe »)

Implémentation de `docs/AUDIT-config-par-ligne-composition.md` (décisions A à E du propriétaire). Aucun générateur existant ne change (gen7, témoin).

**Livré.**
- **Schéma** (`supabase/schema.sql` ET `supabase/migrations/cumulatif.sql`, même commit, idempotent) : `taches_composition.configuration jsonb`, `exercices_assignes.composition_id uuid references taches_composition(id) on delete set null`, `exercices_assignes.configuration jsonb`.
  ⚠ **À exécuter AVANT le déploiement du code** : `COLONNES_EXERCICE_ASSIGNE` (`lib/etatExercice.ts`) lit les deux nouvelles colonnes, toutes les routes élèves échoueraient sinon (le faux Supabase des tests ne le détecte pas). `on delete set null` : une assignation interrompue ne doit pas bloquer la modification d'une tâche.
- **Contrat** (`lib/contratGenerateur.ts`) : `Generateur.configuration?: DescripteurConfigurationCases` (UNE forme, `cases` + `exclusifs`) et `generer(graine, configuration?)`. **Écart avec l'audit** : le hook `validerConfiguration` proposé est remplacé par ce descripteur déclaratif — il suffit à gen8, rend la validation générique et permet au formulaire de se construire seul depuis `GET /api/catalogue-generateurs` (descripteur dérivé du registre, jamais une liste tenue à part). Un hook reste ajoutable plus tard.
- **Seule autorité** : `lib/configurationLigne.ts` (forme canonique `{ actives: [...] }` : identifiants connus, sans doublon, dans l'ordre du descripteur ; **ligne vide refusée**, jamais complétée par un défaut ; groupes exclusifs). `lib/genererPourLigne.ts` est le SEUL appelant de `Generateur.generer` en production (5 appels dispersés avant) ; un test de garde le vérifie.
- **Validation** (`validerComposition`, `lib/validationCorpsTaches.ts`, point unique des trois routes d'écriture) : configuration canonisée par ligne ; configuration qui ne produit aucun écran, ou dont les dépendances sont invalides : refusée ; **fusion des doublons exacts en additionnant les nombres**, clé `(variante_id, configuration canonique, durée de chrono normalisée)` — la durée n'entre dans la clé qu'en mode `par_ecran` (décisions C et E). `lib/lignesComposition.ts` : constructeur unique des lignes insérées par `POST /api/taches`, `PATCH /api/taches/:id` et l'aperçu (trois copies à la main avant).
- **Assignation** (`lib/routes/assignations.ts`) : la configuration est **re-validée** (409 explicite si une ligne a été altérée hors API), copiée avec `composition_id` sur chaque exercice, `champs_attendus` calculés avec elle. L'aperçu fait de même (`lib/routes/taches-apercu.ts`, lignes insérées avec `.select("id")`).
- **Régénération** : `regenererExercice`, `ecransDeLigne`, `poidsDesChampsDeLigne` reçoivent la configuration figée. Le type de `ecransDeLigne` / `poidsDesChampsDeLigne` la rend **obligatoire** (`configuration: unknown`, non optionnelle) : oublier de la sélectionner dans une requête ne compile plus (le compilateur a trouvé `profs/resultats.ts`, `mes-resultats.ts` et `test-poids-ecran`). Configuration figée absente ou invalide pour un générateur qui l'exige : ligne non exécutable (409), jamais exécutée avec un défaut.
- **Chrono par ligne** (`lib/resoudreChronoDureeSecondes.ts`) : avec `composition_id`, la durée est celle de CETTE ligne. **Correction d'un comportement existant** : « première valeur non nulle par (tâche, variante) » donnait à un élève la durée d'une autre ligne dès que deux lignes partagent une variante. La règle d'origine ne subsiste que pour les exercices historiques (`composition_id` nul). Tous les sites qui chargent un contexte (`chargerContexteTache`, 8 sites) passent `composition_id` et mettent leur cache par ligne.
- **Résultats professeur** : `GET /api/profs/resultats` expose `composition_id` et `configuration` par exercice.
- **Formulaire professeur** (`public/prof.html`, `public/style.css`) : pour une variante à configuration, un **bloc de lignes** (cases à cocher, nombre, durée, « Retirer la ligne », « Ajouter une ligne ») au lieu d'un champ unique. Nouvelle ligne VIDE (jamais pré-cochée), 1 exercice, message « Sélectionnez au moins une case pour cette ligne. » et « Créer » désactivé tant qu'une ligne demandée est vide ; cases exclusives appliquées par l'interface ; note de fusion sur les lignes identiques ; durée appariée dans la MÊME ligne (plus par `variante_id`) ; restauration (Modifier / Dupliquer) par liste ordonnée ; la vue « Sélection » distingue les lignes par leur configuration. Les variantes sans configuration (gen7) sont **inchangées**.

**Vérifications.** `scripts/test-configuration-ligne.ts` (84) : forme canonique, entrées hostiles (`__proto__`…), validation pure, fusion, POST/PATCH/GET/aperçu (rien d'écrit après un refus, pas de tâche orpheline, deuxième aperçu consécutif), assignation figée et immuable (modifier la ligne après coup ne change pas ce que voit l'élève), chrono par ligne, exercice historique, 409 sur configuration corrompue, résultats, catalogue, gardes statiques (seul appelant de `generer`, colonnes dans `schema.sql` ET `cumulatif.sql`). Générateur de test à configuration (`scripts/support/generateurConfigurable.ts`, une case cochée = un écran) injecté au registre le temps du test. Mutations vérifiées : ne plus transmettre la configuration à `generer` ; ne plus additionner les doublons ; ignorer `composition_id` pour le chrono → chacune fait échouer le test. Chromium (`scenarioConfigurationLigne`, 390 et 1280 px) : ajout/retrait de lignes, nouvelle ligne vide, message, bouton, exclusion, doublons, vue Sélection, envoi, restauration. Suites unitaires, `chromium-temoin` (3129) et `chromium-design` (1203) passent.

**Écarts et risques assumés (à lire).**
- **Vues agrégées par variante du professeur NON scindées** : les écrans « temps par variante » et la répartition par variante (`prof.html`, arcs, fil d'Ariane) regroupent toujours par `variante_id` ; deux lignes de même variante et de configurations différentes y apparaissent MÉLANGÉES. Les données (`composition_id`, `configuration`) sont exposées ; le regroupement par ligne est un chantier d'interface séparé, à décider avec gen8 (non inclus : aucun consommateur réel avant gen8).
- **Aucun générateur réel ne déclare encore de configuration** : l'architecture est éprouvée par un générateur de test ; gen8 est son premier consommateur réel.
- Le choix « nouvelle ligne = 1 exercice » (et non 0) est le mien : avec 0, une ligne cochée mais jamais comptée serait ignorée sans bruit.
- La durée de chrono d'une ligne de configuration n'est pas pré-remplie par le réglage de tâche (contrairement aux champs uniques) : vide = repli sur la durée de la tâche.

## §56 : gen8 « f(x) à partir du graphe », infrastructure (commits C2 à C5) : lecteur polynomial, figure, aide par paliers, chaîne d'étapes, écran 1

Suite de §55 (C1). Les décisions du propriétaire sont celles de `docs/gen8-conception-avant-go.md` (D1 troisième forme d'aide, D2 pénalité binaire unique, D3 pools bornés, D4 graphique de base sans S ni A, D5 à D11 comme recommandées) ; la règle B (repli de l'écran 2) est **en attente** et n'est pas construite. **gen8 n'est pas encore au registre** : l'écran 2 (chaîne) n'existe pas côté générateur.

**C2 — lecteur polynomial.** `src/generateurs/fxDepuisGraphe/polynome.ts:102` (`lirePolynome`) : ℚ exact (réutilise `Rat`), `x`, `^`, `²³⁴`, préfixe `f(x)=`/`y=`/`E1(x)=`, multiplication implicite seulement devant `x` ou `(`, division par une constante non nulle, degré ≤ 4 ; opérations `plusP`, `foisP`, `puissanceP`, `decalerP` (`:65`, TH), `rapportProportionnel` (`:72`, EV/CV). Aucune saisie recopiée dans un message. Test : `scripts/test-polynome.ts`.

**C3 — figure et aide par paliers.** `lib/figureParabole.ts:39` (arc de Bézier exact, fenêtre ajustée) ; contrat `FigureGrapheParabole` (`lib/contratGenerateur.ts:79`) ; 3ᵉ forme d'aide `AideAnnotationsFigure` (`lib/aideTypee.ts:61`), validation (`:157`), réduction au palier (`aideAuPalier`, `:91`) ; route (`lib/routes/reponses-aide.ts:29-31` : le palier demandé, dans l'ordre) ; migration `aides_utilisees.palier` (`supabase/schema.sql:276` ET `supabase/migrations/cumulatif.sql`, même commit) ; client `public/moteur/aides/annotationsFigure.js:8` ; référence `docs/reference/graphe-parabole.html`. Régression trouvée et corrigée : la règle §53 `.moteur-bouton-aide { display: inline-flex }` écrasait `[hidden]` (bouton d'aide resté visible après usage).

**C4 — écran `chaine_transformations`.** Contrat `lib/contratGenerateur.ts:269`, décodeur `lib/reponsesEcran.ts:177`, composant `public/moteur/ecrans/chaineTransformations.js:15`, référence `docs/reference/chaine-transformations.html`, écrans du témoin (profil `graphe`, `src/generateurs/_temoinTechnique/index.ts:652`). Correctif : `text-transform: uppercase` retiré (cassait `test-structure-tableau`, règle §30).

**C5 — modèle, génération, écran 1 (ce commit).**
- **Modèle exact** (`src/generateurs/fxDepuisGraphe/types.ts`) : `ExerciceFx` (JSON, régénéré depuis `(graine, configuration)`), `parametres`/`polynomeDe`/`polynomeVrai`, `pointsDe` (`:69`), `ecartHorizontal` (`:57`, plus petit `d` avec `d²` multiple du dénominateur : `y_A` entier).
- **Génération** (`generation.ts:41`) : ordre de tirage TH, TV, facteur, côté de `A` ; pools `POOL_EV` (`:20`, 13 valeurs) et `POOL_CV` (`:26`, 6 valeurs) ; configuration absente, vide, inconnue ou `EV+CV` : `ConfigurationDeLigneInvalide`, jamais un défaut.
- **Figure et aide** (`ecrans.ts:23` `figureEtPoints`, `:33` `aideExpression`) : figure sans coordonnée remarquable ; palier 1 = `S`, palier 2 = `A` + vecteur horizontal + vecteur vertical avec leurs longueurs ; légendes qui ne donnent jamais `a`.
- **Vérification** (`verification.ts:14`) : coefficients développés exacts ; toute forme équivalente acceptée ; illisible ou degré ≠ 2 → `parse_error` ; `partiesFausses: ["champ"]` ; **aucune** `fractionCorrecte`.
- **Codes** (`diagnostic.ts:20`) : quatre définitions partitionnantes ; entrées au dictionnaire (`lib/dictionnaireCompetences.ts:293`), aux explications professeur (`lib/explicationsCompetences.ts:249`) et élève (`lib/explicationsCompetencesEleve.ts:60`), aux catégories (`lib/categoriesCompetences.ts:64`…).
- **Formatage** (`formatage.ts:17`) : aucun terme neutre (`x^2`, jamais `(x - 0)^2`, `1(x-3)^2` ni `+ 0`).
- **Poids 2**, consigne globale « Détermine l'expression analytique de la parabole ci-dessous. » (+ « Écris $f(x)$ sous la forme canonique… » : générique, identique pour toutes les configurations).

**Vérifications.** `scripts/test-fx-ecran1.ts` (`npm run test-fx-ecran1`, 1 262 040 assertions) : les **23 configurations** × 200 graines (bornes, valeurs neutres, `d` minimal, `A` entier, `S` et `A` sur la courbe de la figure, fenêtre avec marge, écran sans aide ni coordonnée, aide valide à deux paliers cumulatifs, longueurs des vecteurs, solution sans terme neutre, quatre écritures équivalentes reconnues) ; **partition des codes** contre un ORACLE écrit dans les paramètres `(a', p', q')` de la réponse (`:217`) sur une grille de 2 700 réponses par exercice ; chaque code atteint ; cas `p = 0` (jamais `SIGNE_P_INVERSE`) ; fuzz « ne lève jamais » ; tirages **épinglés** (`:166`). Mutations vérifiées : `d` non minimal, TH/TV échangés, `Q_INCORRECT` trop large, longueur de vecteur fausse. Deux gardes (`!estZeroR(v.B)` dans `SIGNE_P_INVERSE`, `!memeP` dans `P_MAGNITUDE_INCORRECTE`) sont **redondantes** par construction (équivalentes aux tests déjà faits plus haut) : défensives, non testables.

**Écarts et risques assumés (à lire).**
- **Codes : créés, pas réutilisés.** Le dépôt contenait `FORME_CANONIQUE_SIGNE_P` et `TRANSFORMATION_*` (ancien gen8/gen9, détectés par curseurs). `SIGNE_P_INVERSE` recouvre la même confusion de signe mais avec un autre détecteur et une définition partitionnante ; les réutiliser aurait agrégé deux erreurs différentes sous un code que `CODES_MASQUES_PROF` (`lib/profilCompetences.ts:87`) cache aux professeurs. Conséquence : un élève fort sur l'un ne l'est pas sur l'autre dans le profil de compétences. Décision à confirmer.
- **Vues professeur agrégées par `variante_id`** (rappel §55) : deux lignes gen8 de configurations différentes y sont fusionnées.
- **Le verdict « degré ≠ 2 → parse_error »** (aucune tentative consommée) est celui du document de conception ; il dit à l'élève que sa réponse n'est pas du second degré, ce qui est une information sur la FORME, jamais sur les valeurs.
- **Ordre des pools** : `POOL_EV`, `POOL_CV` et `POOL_TRANSLATION` sont contractuels ; y toucher impose `fx_depuis_graphe_v2`.
- **Reste à faire (C6/C7)** : écran 2 (chaîne, vérification à deux niveaux, cascade `dependDe`/`projeter`, `fractionCorrecte` `(valides + arrivée)/(soumises + 1)`), registre, catalogue, entrée JSON et `CORRESPONDANCE_JSON_VERS_PILOTE`, scénarios Chromium, aperçu. **Bloqué sur la règle B** (repli de l'écran 2) : à valider avant construction.

## §57 : gen8 « f(x) à partir du graphe », écran 2, cascade, câblage (commits C6a et C6b, parcours Chromium C7)

Décisions du propriétaire appliquées ici : **option 4** pour l'écran 2 (jamais de substitution ; transformations élargies pour cet élève ; clause `x²`), **poids inversés** (3 pour l'écran 1, 2 pour l'écran 2) et **plafond du crédit partiel**. Le §56 dit « Poids 2 » pour l'écran 1 et « règle B en attente » : ces deux phrases sont **périmées** (RAPPORT append-only, corrigé ici).

**Livré.**
- **Écran 2** (`src/generateurs/fxDepuisGraphe/ecrans.ts:90` `ecranChaine`) : consigne globale + « Quelles transformations permettent d'obtenir la fonction $f(x) = …$ à partir de $x^2$ ? » + légende TH / TV / EV / CV / SOX ; menu TOUJOURS à cinq choix (`:28`) ; même figure que l'écran 1 ; aucune aide ; `dependDe: ["expression"]`. Poids `POIDS_EXPRESSION = 3`, `POIDS_CHAINE = 2` (`:24-25`).
- **Cascade** (`cascade.ts:38` `effectifDepuisReponses`, `:54` `fonctionEffective`) : la fonction affichée est la réponse confirmée (re-sérialisée), la vraie fonction si la solution est montrée ou si la réponse est juste, le repli si aucune réponse. Réponse > 10 000 en numérateur ou dénominateur : inexploitable (`:16`).
- **Repli** (`generation.ts:63` `tirerRepli`, champ `repli` de l'exercice, `types.ts:33`) : tiré après les quatre tirages contractuels, atteignable, ≠ vraie fonction (pile-ou-face pour SOX).
- **Transformations admises** (`chaine.ts:15` `necessaires`, `:36` `transformationsAdmises`, `:47` `longueurMinimale`, `:61` `chaineCanonique`, `:95` `etapeLocalementValide`, `:27` `estXCarre`).
- **Vérification à deux niveaux** (`verification.ts:47` `verifierChaine`) : lecture (`parse_error` « Étape k : … »), règle locale + transformation admise par étape, arrivée exacte ; `partiesFausses` = `etape:<i>` ; `fractionCorrecte` plafonnée (`:82`). Code `TRANSFORMATION_HORS_SUJET` (`lib/dictionnaireCompetences.ts:309`, explications professeur et élève, catégorie « Mauvais élément de référence »).
- **Solution** (`solutions.ts:11`) : une chaîne valide pour la fonction effective, étape par étape.
- **Câblage (CLAUDE.md « discipline de câblage »)** : registre (`lib/registreGenerateurs.ts:19`), catalogue (`lib/catalogueGenerateurs.ts:27`, `{ generateur_id: "gen8", variante_id: "fx_depuis_graphe", label: "f(x) à partir du graphe" }`), JSON (`public/catalogue-generateurs-complet.json`, 4e n° 67 : `{"numero":67,"libelle":"67. f(x) à partir du graphe","chapitre":1,"variantes":[{"axe":"transformations appliquées","label":"f(x) à partir du graphe"}]}`), `CORRESPONDANCE_JSON_VERS_PILOTE["4e:67"] = [{ index: 0, variante_id: "fx_depuis_graphe" }]` (`public/prof.html:1505`) et `NUMEROS_PAR_CHAPITRE_4E` chapitre 1 (`:1985`, deuxième table tenue à la main, oubliée par la discipline écrite).
- **Correctif de l'écran 1 (C5)** : une saisie démesurée (entiers sûrs au maximum) levait `DebordementExact` dans le diagnostic, donc une erreur 500 ; protégé (`verification.ts:30`), couvert par `test-fx-ecran1`.

**Vérifications.**
- `scripts/test-fx-ecran2.ts` (`npm run test-fx-ecran2`) : 23 configurations × cinq graines × 5 000 réponses possibles de l'écran 1 : chaîne canonique valide de longueur `k*`, `necessaires` exact (sans l'une d'elles, `g` n'est pas atteignable), clause `x²`, règles locales de chaque transformation, exclusion mutuelle des étiquettes sur 6 000 paires, chaînes CONSTRUITES (l'étiquette de construction est l'oracle), hors sujet y compris TV +3 / −3 avec TV inactive (arrivée exacte, verdict faux, deux étapes désignées), option 4 (TV exigée par la fonction de l'élève = admise ; SOX non exigée = hors sujet), crédit partiel plafonné (remplissage = `k*/6`), cascade par `projeterExercice` réel dans les TROIS régimes × réponse juste / fausse / absente / illisible, énoncé identique pour toute configuration, exercice brut qui ne nomme aucune fonction, fuzz sans exception. Mutations vérifiées : admises sans les nécessaires, sans clause `x²`, plafond retiré, hors sujet ignoré, projection qui renvoie la vraie fonction, repli égal à la vraie, poids égaux, TH avec `h = 0`.
- `scripts/test-route-fx.ts` (`npm run test-route-fx`) : vrai routeur, câblage, 23 configurations assignées, cascade sous les trois régimes, hors sujet stocké (code, fraction) sans rien servir, aide à deux paliers dans l'ordre, écran 2 refusé avant l'écran 1, configuration figée même si la ligne est altérée hors API.
- Chromium (`chromium-temoin`, 3253 + 277 pour gen8 : `scenarioGen8Prof` `scripts/chromium-temoin-technique.ts:2403`, `scenarioGen8Eleve` `:2515`) : bloc de lignes de gen8 dans prof.html (champs non désactivés, EV / CV exclusifs, tâche à deux lignes créée par l'interface puis assignée) ; chaque transformation seule (TH, TV, EV, CV, SOX) puis deux combinaisons, de la figure à la relecture, score aux deux écrans (3 / 3 et 2 / 2, total 5 / 5) ; étape hors sujet (+3 / −3) ; les deux paliers d'aide (S(…), puis A et deux vecteurs) ; option 4 sous les trois régimes (écran 1 faux, écran 2 sur SA fonction, 0 / 3 + 2 / 2 à la fin sauf sans la case : verdicts seuls, aucun score, règle §50).

**Écarts et risques assumés (à lire).**
- **Se tromper exprès à l'écran 1** : n'est plus rentable (2 < 3), mais l'écran 2 reste jugé sur la réponse de l'élève (cascade voulue par le prompt). Un élève qui répond n'importe quoi à l'écran 1 puis réussit l'écran 2 obtient 2 / 5, jamais plus que 3 / 5 minimum d'un élève honnête qui réussit l'écran 1.
- **Écart avec le prompt** : « transformation réellement active sur la ligne » devient « active pour cet élève » (ligne ∪ ce que sa fonction exige). `TRANSFORMATION_HORS_SUJET` perd donc son signal quand l'écran 1 a déjà exigé la transformation : le professeur voit alors le code de l'écran 1 (`Q_INCORRECT`, `A_INCORRECT`…) et rien à l'écran 2.
- **Écran 1 sans la case « Afficher la réponse attendue »** : verdict seul, jamais de score (§50) ; le tableau final n'affiche aucun point dans ce régime.
- **Vues professeur agrégées par `variante_id`** (rappel §55) : deux lignes gen8 de configurations différentes y sont fusionnées.
- **Chapitre et numéro** : gen8 est le n° 67 du JSON, rangé chapitre 1 ; c'est un choix de placement (le prompt n'en dit rien), facile à déplacer (`prof.html:1985`).
- **Migration** : celles de §55 / §56 (`composition_id`, `configuration`, `aides_utilisees.palier`) sont requises AVANT le déploiement ; aucune nouvelle ici.

## §58 : retours du propriétaire sur gen8 — question sous le graphique, aperçu LaTeX de la saisie, étape de chaîne refaite (menu, valeur, « ? »)

Demande du propriétaire (quatre points) : (1) la question spécifique de l'écran 1 sous le graphique ; (2) au-dessus du champ libre, un aperçu LaTeX dynamique « f(x) = » suivi de ce que l'élève tape ; (3) la question de l'écran 2 sous le graphique, et la légende des abréviations seulement derrière un « ? » ; (4) dans chaque étape, « ? » à droite de « Étape k », puis « f_k(x) » + liste déroulante des cinq transformations + « : » + champ libre pour la VALEUR de TH / TV / EV / CV (rien après SOX), puis « f_k(x) = » + champ libre. Le propriétaire avait remarqué que l'élève ne pouvait pas déclarer la valeur d'une translation ou d'un facteur : c'est le trou comblé par le point 4. **Aucune migration** (ni `schema.sql`, ni `cumulatif.sql` : rien en base ne change).

### A. Contrat (`lib/contratGenerateur.ts`)
- `EcranCommun.question?` (:99) — texte d'auteur, **sous la figure** ; la consigne reste au-dessus. Absente : comportement inchangé.
- `EcranChampExpression.apercu?: { libelle }` (:138) — aperçu LaTeX dynamique au-dessus du champ.
- `EcranChaineTransformations.choix[].valeur?: { placeholder }` (:287) — la transformation prend une valeur ; `legende?` (:289) — dévoilée par le « ? » de chaque étape, jamais affichée d'office.
- **Format de réponse de la chaîne** (`lib/reponsesEcran.ts:201`) : `{"etapes":[{"expression","transformation","valeur"}…]}` — TROIS clés exactes. `valeur` (≤ 40 caractères, `VALEUR_ETAPE_LONGUEUR_MAX`, :173) est exigée non vide pour une transformation à valeur et **doit être `""`** pour SOX (sinon illisible) : la réponse reste canonique, donc re-validable sans changement (retour en arrière).

### B. Vérification de la valeur déclarée (`src/generateurs/fxDepuisGraphe/`)
- `parametreEtape` (`chaine.ts:95`) : la règle locale d'une étape renvoie aussi son **paramètre** — TH `h` de `E_i(x) = E_{i-1}(x − h)` (positif = vers la droite), TV la constante ajoutée (positive = vers le haut), EV | CV le facteur `m` (jamais `1/m`), SOX `−1` (jamais déclaré). `etapeLocalementValide` n'est plus que `parametreEtape(…) !== null`.
- `verifierChaine` (`verification.ts`) : la valeur est lue par `lirePolynome` (`lireValeurDeclaree`, :15 — un NOMBRE rationnel : `3`, `-2`, `1/2`, `0,5`) ; illisible ou non constante → `parse_error` « Étape i : la valeur doit être un nombre… » (aucune tentative consommée, message identique pour tous les exercices : aucune valeur attendue n'y figure). Étape **valide** = règle vraie ET valeur exacte (`valeurJuste`, :84-85) ET transformation admise.
- **Bug trouvé par le test et corrigé avant livraison** : une valeur fausse sur une transformation admise déclenchait `TRANSFORMATION_HORS_SUJET`. Le code ne vient plus que de « règle vraie mais transformation NON admise » (`verification.ts:88`) ; une valeur fausse est une étape fausse sans code.
- Solution écrite (`solutions.ts`) : cite la valeur de chaque étape sauf SOX.
- `ecrans.ts` : `question` écran 1 (:81) et écran 2 (:103) séparées de la consigne globale ; `apercu: { libelle: "f(x) =" }` (:82) ; `legende` (:104) déplacée hors de la consigne ; `CHOIX_CHAINE` (:33) avec le placeholder de convention de signe pour TH / TV / EV / CV.

### C. Client
- **`public/moteur/apercuLatex.js`** (nouveau, `versLatexApercu` :91) : convertit la saisie en LaTeX **construit** depuis un jeu fermé de jetons (nombres, lettres, `+ - * / ^ = ( )`, `² ³ ⁴`). Tolérant (on tape caractère par caractère : parenthèse non fermée → `\right.`, exposant manquant → groupe vide), **jamais d'exception**, jamais une commande (`$ \ { } % # & _ ~ ' " @` échappés). Deux défauts trouvés par le test avant livraison : deux nombres séparés par une espace étaient fusionnés (`2 3` → `23`), et un exposant empilé ou l'apostrophe (« prime » de KaTeX) produisait un double exposant que KaTeX refuse (`avecExposant`, :135).
- `moteur.js:196,209` : la question est rendue après la figure (écran courant ET relecture) ; `champExpression.js:36,43` : l'aperçu (`rendreMath`, `aria-hidden`) est recalculé à chaque frappe, jamais un verdict.
- `chaineTransformations.js` (réécrit) : en-tête « Étape k » + pastille « ? » (:105, `aria-expanded`/`aria-controls`) ; `<select>` natif avec invite « Choisir… » désactivée ; champ de valeur masqué avec son « : » quand la transformation n'en prend pas (`prendUneValeur`, :160) ; `lireReponse` (:234) renvoie `null` tant qu'une étape est incomplète. Parties fausses `etape:<i>` : la fonction obtenue, la transformation et la valeur.
- CSS (`ecrans.css`, **tokens seuls**, vérifié par `test-design-system`) : `.moteur-question` (:413, même règle que la consigne), `.moteur-apercu-expression` (:431), `.moteur-chaine-aide` (:1658), `.moteur-select` (:1722).

### D. Références de design (écrites AVANT le code, comparées au style CALCULÉ)
`docs/reference/ecran-expression-graphe.html` (nouveau) et `docs/reference/chaine-transformations.html` (refait). `scripts/chromium-fidelite-design.ts:895` (écran d'expression) et `:927` (chaîne, y compris SOX et la légende ouverte), à 390 et 1280 px.

### E. Témoin technique
L'écran `courbe` du profil `graphe` porte une `question` et un `apercu` (`_temoinTechnique/index.ts:662`), la chaîne sa `legende` et les valeurs : la Section A (137 assertions) et le profil `etendu` ne bougent pas.

### F. Vérifications
`scripts/test-apercu-latex.ts` (31 445 vérifications : chaque PRÉFIXE de 21 saisies modèles compile sous KaTeX `strict`, 6 000 chaînes hostiles, commandes en liste fermée) ; `test-fx-ecran2.ts` §5b (`:288`, valeur : signe, facteur inversé, écritures équivalentes, illisible, SOX avec valeur, hors sujet + valeur fausse) ; `test-chaine-transformations.ts` (décodeur à trois clés) ; `test-route-fx.ts` ; Chromium (`scenarioGen8Eleve` : ordre consigne / graphique / question / aperçu / champ, aperçu suivant la frappe, `$` et commande LaTeX tapés restent inertes ; `scenarioChaineTransformations` : « ? » à droite du numéro, légende cachée puis dévoilée sous l'en-tête, SOX sans champ, valeur après le menu).

### G. Décisions par défaut à confirmer (le prompt ne les tranche pas)
1. **Convention de la valeur** : TH `h` avec `f(x − h)` (positif = droite), TV signée (positif = haut), EV | CV = le facteur. Un élève qui écrit « 3 vers la gauche » ou `-3` pour `(x−3)²` a une étape fausse. Elle est rappelée par le placeholder, pas par la légende (dont le texte est celui du propriétaire, inchangé).
2. **Ligne 1** lue comme `f_k(x) [menu] : [valeur]`.
3. **« ? » par étape = LE « ? »** demandé ; le « ? » global de l'écran (point 3 du message) **n'est pas construit** : l'emplacement n'est pas encore précisé.
4. Pas d'aperçu LaTeX sur les champs `f_k(x) =` de la chaîne (non demandé). Parties fausses : toujours l'étape entière.
5. `<select>` natif (le menu s'ouvre avec le sélecteur du système, accessible au clavier) plutôt qu'un menu dessiné.

**§58-H. Validation sur export propre** : `npm ci`, `tsc -b`, tous les `scripts/test-*.ts`, `npm run chromium-temoin` (3 677 vérifications) et `npm run chromium-design` (1 719) passent. Un seul test avait échoué : `test-aide-paliers` cherchait « legende » dans toute la vue pour détecter une fuite d'aide et trouvait la légende des abréviations de la chaîne (servie volontairement avec l'écran) ; il l'écarte désormais (`test-aide-paliers.ts:106`) et vérifie qu'elle est bien servie. Aucun code de production touché par cette correction.

**§58-I. Suite aux deux questions du propriétaire (domaine de la valeur, « ? » global).**
- **Aucun code `VALEUR_INCOHERENTE`.** Une valeur déclarée fausse (dans son domaine) rend l'étape fausse, sans signal spécifique ; aucun code n'est lu par la note. Un tel code resterait à décider (il toucherait le dictionnaire de compétences, `codes.ts` et les trois fichiers d'explication).
- **Valeur hors domaine = `parse_error` immédiat** (`verification.ts`, `messageHorsDomaine`) : TH et TV ≠ 0 ; EV > 1 ; CV dans ]0 ; 1[. Le contrôle se fait dans la boucle de lecture, donc avant tout jugement (règle locale, arrivée à f), même si l'expression de l'étape est fausse. Aucune tentative consommée ; le message ne dépend que de la transformation choisie, jamais de la fonction visée (rien ne fuit, y compris sous correction coupée). Tests : `test-fx-ecran2.ts` §5b (0 pour TH et TV, EV = 1, 1/2, négatif, zéro ; CV = 3, 1, 0, −1/3, 2 ; message identique pour tous les exercices).
- **« ? » global de l'écran** (`moteur.js`, `creerQuestion`) : à DROITE de la question elle-même, même gabarit que le « ? » de chaque étape ; ouvre la même légende en dessous, cachée d'office, rien d'enregistré (ce n'est pas une aide). Il apparaît pour tout écran qui déclare une `legende` ET une `question`. Référence : `docs/reference/chaine-transformations.html` (bloc `bloc-question`), comparée par `chromium-design`.

**§58-J. Code diagnostique `VALEUR_DECLAREE_INCORRECTE`** (demande du propriétaire). Émis par `verifierChaine` (`verification.ts:107`) quand la règle locale d'une étape est VRAIE pour la transformation choisie et que la valeur déclarée (dans le domaine) diffère de la valeur réelle ; au plus une fois par réponse. Déclaré aux cinq endroits habituels : `codes.ts:12` (`CODES_FX` passe à 6), `lib/dictionnaireCompetences.ts:313`, `lib/explicationsCompetences.ts:267` (professeur), `lib/explicationsCompetencesEleve.ts:64` (élève, sans citer la valeur attendue), `lib/categoriesCompetences.ts:111` (« Confusion de signe/sens »).
- **Signal pur** : il n'affecte ni les étapes fausses, ni `fractionCorrecte`, ni le verdict (testé : la fraction est identique avec et sans le code). Il n'existe que sur `not_equivalent` ; une valeur hors domaine ou illisible reste un `parse_error` (jamais ce code) ; une règle fausse (étape mal étiquetée) ne l'émet pas.
- **Combinaison** : une étape à la fois non admise ET à valeur fausse porte les DEUX codes (`TRANSFORMATION_HORS_SUJET` puis `VALEUR_DECLAREE_INCORRECTE`) : ce sont deux erreurs distinctes, toutes deux vraies.
- Tests : `test-fx-ecran2.ts` §5b (partition sur toutes les configurations × 4 graines × chaque étape à valeur : valeur fausse -> ce seul code et cette seule étape fausse ; chaîne juste -> aucun code ; fraction inchangée) ; `test-fx-ecran1.ts` (six codes déclarés) ; `test-explication-competences.ts` (chaque code du dictionnaire a ses explications).


## §59 : gen9 « Complète le carré » (commits C0 à C7) — noyau quadratique partagé, aide à paliers avec emphase, forme canonique exigée

Spécification : `docs/gen9-conception-avant-go.md` (huit décisions validées par le propriétaire) ; livrable : `docs/gen9-livrable.md`. `variante_id` `completion_du_carre`, `generateur_id` `gen9` ; entrée 4e n° 68 (chapitre « La fonction du second degré »). **Aucune migration** : aucun fichier de `supabase/` n'a été touché (la colonne `aides_utilisees.palier` existait depuis §56).

**§59-A. Noyau partagé `src/generateurs/_noyauQuadratique/`** (C0, comportement inchangé : les suites gen8 gardent leurs comptes). `polynome.ts` et `chaine.ts` y ont été DÉPLACÉS (le seul lecteur de polynômes reste `lirePolynome`) ; `tirage.ts` porte les pools `POOL_TRANSLATION` / `POOL_EV` / `POOL_CV` et `tirerRepli`, `effectif.ts` (`effectifDepuisReponse`, cascade §18/§45/§57), `ecranChaine.ts` (`ecranChaineTransformations`), `solutionChaine.ts`, `verificationChaine.ts` (`verifierChaineSur`), `descripteur.ts` (cases TH/TV/EV/CV/SOX). **Conséquence contractuelle** : modifier un pool ou le tirage du repli change `generer` des DEUX variantes — nouveau `variante_id` pour gen8 ET gen9.

**§59-B. `formule_coloree` à paliers et emphase** (C1) : `lib/aideTypee.ts:33` (`PalierFormule`), `:110` (`aideAPaliers`) ; `segments` OU `paliers` (1 à 3, `{legende?, segments}`), segment `emphase: true` (jamais avec un `role`). Ce n'est PAS une quatrième forme d'aide (CLAUDE.md : exactement trois). Le serveur ne sert que le palier demandé (`aideAuPalier`, état `aides_utilisees.palier`, pénalité binaire). Client : `public/moteur/aides/formuleColoree.js:35`, `public/moteur/ecrans.css:1315` (`.moteur-emphase` : fond `--violet-clair`, soulignement 2 px `--violet-vif`, jamais un verdict), `public/moteur/rendreTexte.js:66` (liste fermée `moteur-coef-[abc]|moteur-emphase`). Référence : `docs/reference/formule-emphase.html`, mesurée par `chromium-design`.

**§59-C. Case OBLIGATOIRE du descripteur** (C2) : `lib/contratGenerateur.ts:375` (`obligatoires`), `lib/configurationLigne.ts:39` (une configuration qui l'omet est refusée, 400, **jamais complétée**), `lib/registreGenerateurs.ts:62` (cohérence : case connue, dans aucun groupe exclusif), `public/prof.html:1790` (case cochée ET verrouillée dès la naissance de la ligne ; c'est la seule exception à « une nouvelle ligne naît vide », dictée par le descripteur). gen9 : `obligatoires: ["TH"]` (`generateur.ts:18`) — sans translation horizontale `b = 0` et rien n'est à compléter.

**§59-D. Génération** (`completionDuCarre/generation.ts:55`) : `f(x) = a(x − p)² + q` AFFICHÉE développée `ax² + bx + c` (`b = −2ap`, `c = ap² + q`), termes mélangés, jamais dans l'ordre canonique (`enonce.ts`). `b` et `c` doivent être ENTIERS : avec les pools de gen8 seuls 58 % des couples EV et 30 % des couples CV le sont (mesuré) ; le tirage se fait donc dans la liste exhaustive des couples admissibles (`couplesAdmissibles`, `generation.ts:19` : 76 couples EV, 18 CV). `a = −1` n'est PAS exclu (la contradiction du prompt initial a été tranchée par le propriétaire).

**§59-E. Écran 1 : la forme canonique est EXIGÉE** (C3). L'énoncé étant développé, recopier `ax² + bx + c` serait « juste » avec la vérification de gen8 (coefficients développés). `lireFormeCanonique` (`_noyauQuadratique/formeCanonique.ts:61`) ne lit aucun nombre elle-même (tout passe par `lirePolynome` / `corpsDeSaisie`, `polynome.ts:106`) : elle découpe la structure (une somme dont UN SEUL terme contient `x`, de la forme `coefficient × (x ± c)^2`, binôme unitaire) puis compare le polynôme reconstruit à celui que lit `lirePolynome` (garde finale : au moindre écart, « pas canonique »). `verifierFormeCanonique` (`completionDuCarre/verification.ts:16`) : illisible / pas canonique / `a = 0` → `parse_error` ; juste ⇔ `(a, p, q)` identiques en ℚ exact ; `q = 0` peut s'écrire sans constante.
- **Correction d'une affirmation fausse (du document de conception ET de gen8).** Les commentaires de gen8 (`fxDepuisGraphe/verification.ts`, `_noyauQuadratique/verificationChaine.ts`) et la décision n° 1 du document de conception disaient « `parse_error` : aucune tentative consommée ». C'est **faux** : `lib/moteurTentatives.ts:125` compte `parse_error` comme une tentative ratée, comme tout statut ≠ `correct` (le test de route le mesure : la ligne est stockée, `tentatives_restantes` baisse, et avec 1 seul essai la solution est révélée). Commentaires corrigés dans le code ; l'erratum figure dans le document de conception. **Conséquence pour gen9** : un élève qui recopie l'énoncé développé perd un essai, sans avertissement préalable autre que la question (« sous la forme canonique a(x − p)² + q »), le placeholder (`ex. 2(x-1)^2+3`) et l'aperçu LaTeX. Sous correction immédiate le message d'erreur lui explique la forme attendue ; sous correction coupée il ne le voit pas. Faire de `parse_error` un statut qui ne consomme pas d'essai serait un changement transversal (tous les générateurs) : **décision laissée au propriétaire**, rien n'a été modifié.

**§59-F. Trois nouveaux codes + `SIGNE_P_INVERSE` réutilisé** (`completionDuCarre/codes.ts:9`, `diagnostic.ts:16`). `P_SIGNE_INVERSE` du prompt avait la MÊME condition que `SIGNE_P_INVERSE` de gen8 (`p' = −p`, `q' = q`) : un seul code, déplacé dans le noyau (`_noyauQuadratique/codes.ts`). Définitions (a' = a exigé, EXACTEMENT une des deux quantités fausse) : `P_FACTEUR_A_OUBLIE` (`p' = a·p`), `SIGNE_P_INVERSE` (`p' = −p`), `Q_FACTEUR_A_OUBLIE` (`q' = q + (a−1)p²`), `Q_SIGNE_INVERSE` (`q' = q + 2a·p²`). **À `a = −1`** `a·p = −p` et `a − 1 = 2a` : les deux codes de `p` coïncident, ceux de `q` aussi → **aucun code émis** (aucun n'est plus juste que l'autre). **À `a = 1`** les valeurs « facteur oublié » sont les valeurs justes : ces deux codes sont inertes (non-émission naturelle ; ni EV, ni CV, ni SOX ne deviennent obligatoires — précision du propriétaire). Deux erreurs ou plus : aucun code. Déclarés aux cinq endroits : `lib/dictionnaireCompetences.ts:299-307`, `lib/explicationsCompetences.ts:272`, `lib/explicationsCompetencesEleve.ts:65` (texte statique, aucune valeur), `lib/categoriesCompetences.ts:112` (« Formule fantôme » ×2, « Confusion de signe/sens »). Signal pur : ni note, ni `fractionCorrecte`, ni verdict ne les lisent ; stockés dans `reponses.bug_detecte`, jamais servis.

**§59-G. Aide de l'écran 1, deux paliers** (C4, `completionDuCarre/aide.ts:25`, `SEGMENTS_PALIER_2` `:16`). Palier 1 : `a` mis en facteur sur les deux premiers termes, `f(x) = a(x² ± (b/a)x) ± c` (rôles `a` et `c`) — numérique mais ÉQUIVALENT à `f` (relu par `lirePolynome` dans le test) ; palier 2 : le schéma SYMBOLIQUE `a[(x + b/2a)² − (b/2a)²] + c`, identique pour TOUS les exercices (testé), la quantité `(b/2a)²` en emphase. **Réserve (LOGIQUE)** : refuser la valeur numérique de `(b/2a)²` au palier 2 « pour ne pas donner `p²` » est partiellement cosmétique, puisque le palier 1 montre déjà `b/a = −2p` en clair : l'élève en déduit `p` d'une division par 2. C'est la décision validée ; le palier 1 reste l'étape « factoriser `a` », qui est le vrai point de blocage.

**§59-H. Écran 2** (C5) : le composant chaîne et sa vérification sont ceux du noyau (`completionDuCarre/ecrans.ts`, `verification.ts:32`) ; la cascade est celle de gen8 (`cascade.ts:11`) ; la réponse de l'écran 1, canonique, est relue par `lirePolynome` puis `(a, p, q)` : la fonction effective de l'écran 2 est celle que l'élève a CONFIRMÉE, même fausse (option 4, §57). Poids 3 / 2 (`ecrans.ts:26`, mêmes raisons que gen8, §57). La consigne est identique sur les deux écrans et ne nomme aucune fonction ; la question de l'écran 1 donne la forme développée, celle de l'écran 2 la fonction effective (§58).

**§59-I. Câblage** (C6, CLAUDE.md « discipline de câblage prof.html ») : `lib/catalogueGenerateurs.ts:30`, `lib/registreGenerateurs.ts:20`, entrée JSON `4e` n° 68 « Complète le carré » (`public/catalogue-generateurs-complet.json`, libellé IDENTIQUE à `CATALOGUE_GENERATEURS`), **entrée ajoutée à `CORRESPONDANCE_JSON_VERS_PILOTE`** : `public/prof.html:1510` `"4e:68": [{ index: 0, variante_id: "completion_du_carre" }]` ET à `NUMEROS_PAR_CHAPITRE_4E` (`:1996`, chapitre 1). **Vérification réelle** (Chromium, vrai `api/router.ts`, base en mémoire, `scenarioGen9Prof`) : le bloc `[data-config-variante-id="completion_du_carre"]` existe, le champ « nombre d'exercices » n'est PAS `disabled`, TH est cochée et verrouillée, une tâche à deux lignes (`TH+EV`, `TH+TV+SOX` ×2) est créée par l'interface puis assignée par la route réelle (3 exercices, configurations figées).

**§59-J. Témoin technique** : un quatrième profil `formule` (graines `[4_294_966_000, 4_294_967_000)`, `_temoinTechnique/index.ts:72`) porte l'aide à deux paliers ; les profils `base`, `etendu`, `graphe` sont inchangés.

**§59-K. Tests ajoutés** (`package.json`) : `test-formule-paliers` (contrat, route, témoin), `test-gen9-generation` (12 configurations × 400 graines, b/c entiers, ordre jamais canonique, exercices épinglés), `test-gen9-ecran1` (écritures canoniques acceptées ; recopie de l'énoncé refusée sur 14 400 cas ; 4 codes contre un ORACLE écrit en (a, b, c) ; a = −1 sans code ; a = 1 inerte ; mutation du diagnostic détectée), `test-gen9-aide`, `test-gen9-ecran2` (cascade, trois régimes, poids), `test-route-gen9` (vrai routeur : câblage, TH obligatoire refusée si absente, 12 configurations, recopie stockée en `parse_error`, codes stockés non servis, cascade, aide, configuration figée) ; `test-configuration-ligne` (bloc `obligatoires`), `test-katex`, `test-texte-math` (emphase) ; Chromium : `scenarioGen9Prof`, `scenarioGen9Eleve` (parcours justes ×5 configurations, recopie, huit réponses fausses dont deux à a = −1 sans code, deux paliers, trois régimes), `scenarioFormulePaliers`, section « formule » de `chromium-design`.

**§59-L. Risques ouverts.** (1) `parse_error` consomme un essai (§59-E). (2) Le tirage partagé lie gen8 et gen9 (§59-A). (3) Palier 1 de l'aide (§59-G). (4) `lireFormeCanonique` refuse volontairement des écritures équivalentes mais non canoniques (`(2x-6)^2/2`, `2((x-3)^2)`, deux carrés) : message unique « Écris f(x) sous la forme canonique… ».
