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
