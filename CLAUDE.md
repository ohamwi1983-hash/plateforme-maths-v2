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
  `public/moteur/ecrans/` (enregistré dans `index.js`) + un décodeur dans `lib/reponsesEcran.ts` + un
  écran dans le témoin technique UNIQUE — `src/generateurs/_temoinTechnique/` (`variante_id`
  `_temoin_technique_v1`, permanent, jamais dans le catalogue affiché ni assignable par l'API :
  `validerComposition` rejette toute variante hors catalogue). Il a deux profils d'exercice tirés de la
  graine : `base` (les 4 écrans d'origine, dont les 137 assertions de la « Section A » de
  `scripts/test-temoin-technique.ts` ne bougent pas : leur nombre est compté) et `etendu` (les écrans
  ajoutés depuis la phase 3b-1, « Section B ») ; un nouveau type d'écran s'ajoute au profil `etendu`. Le
  profil des exercices assignés par la route se DÉCLARE dans les tests (`imposerProfilAssignation`,
  `scripts/support/harnaisRouteur.ts`). `npm run chromium-temoin` doit passer. Tout texte d'auteur d'un
  composant passe par `rendreTexte(…, { math: true })`, jamais par `textContent`.
- **État local d'édition ≠ réponse.** Ce que l'élève compose (texte tapé, lignes ajoutées, cases
  cochées, choix non confirmé) ne quitte jamais le composant ; seule une réponse confirmée (« Valider »)
  est envoyée, sous forme d'UNE chaîne `reponse_brute`. `POST /api/reponses` rejette toute clé autre que
  `{ exercice_assigne_id, champ, reponse_brute }`. Vérification **uniquement côté serveur**, jamais de
  marquage d'erreur en direct pendant la frappe.
- Aléa : uniquement `creerPrng(graine)` (`lib/prng.ts`), jamais `Math.random()` dans un générateur.
  L'exercice n'est pas stocké : il est régénéré depuis `exercices_assignes.graine`. **Toute
  modification qui change ce que `generer` produit pour une graine donnée impose un NOUVEAU
  `variante_id` (`_v2`…)**, sinon les exercices déjà assignés changent sous les pieds des élèves.
  Précision : la règle protège des exercices DÉJÀ ASSIGNÉS. Une variante du catalogue qui n'a pas encore
  de générateur au registre (les `af_*` de gen7 avant leur livraison) ne peut pas être assignée : sa
  première implémentation garde l'identifiant du catalogue tel quel (`verifierCoherenceRegistre`
  l'exige). La règle ne s'applique qu'à un changement ULTÉRIEUR de `generer()`, une fois la variante livrée.
- L'aide n'est jamais envoyée avec l'écran : `POST /api/reponses/aide` la sert et enregistre l'usage
  côté serveur (`aides_utilisees`) — **après** l'avoir validée (`validerAide`) : une aide invalide n'est
  ni servie ni comptée. Une aide est une chaîne (texte d'auteur) ou une **aide typée à EXACTEMENT deux
  formes** (`lib/aideTypee.ts` : `formule_coloree`, `croquis_parabole`) ; une troisième forme est une
  décision de contrat, pas un fichier de plus.

## Balisage mathématique (phase 3b-1)

- **Trois sortes de texte.** Texte d'AUTEUR (consigne, libellés de choix/colonnes/lignes/sous-champs,
  étiquettes, aide en chaîne, solution attendue, message d'erreur) : peut contenir du balisage.
  Texte d'ÉLÈVE (`valeur_saisie`, ce qu'il tape, aperçus de sa saisie) : **jamais interprété** — un `$`
  tapé reste un `$`. Texte d'INTERFACE : brut. Un attribut (`placeholder`, `aria-label`) passe par
  `versTexteBrut`.
- **Grammaire** (`public/moteur/texteMath.js`, l'unique implémentation) : `$…$` inline ; `\$` = `$`
  littéral hors mathématiques ; `$$`, `$` non fermé ou contenu vide → **le texte entier** est rendu en
  texte brut, jamais d'exception. Contenu = LaTeX (sous-ensemble KaTeX).
- **Une couleur n'est jamais dans un texte servi.** Les commandes de couleur, de style, de lien et
  d'image sont interdites (`lib/balisageMath.ts`, **seul** endroit où la liste existe : ne jamais la
  recopier, ni dans `public/`, ni ailleurs). Seule couleur admise : le RÔLE a/b/c de `formule_coloree`.
- **`public/moteur/rendreTexte.js` est le seul point d'écriture d'un texte dans le DOM.**
  `rendreTexte(el, texte, { math: true })` pour un texte d'auteur ; sans option, texte brut. `rendreMath` est la
  seule fonction qui appelle KaTeX (0.18.9, vendoré dans `public/vendor/katex-0.18.9/`, jamais modifié à la main :
  `scripts/test-katex.ts` en épingle les sha256 et l'identité avec `node_modules/katex`). Réglages uniques
  (`reglagesKatex`) : `throwOnError: true` puis **repli en source** (`.moteur-math-source`), jamais le message rouge de KaTeX ;
  aucune commande de confiance (`trust` refuse tout et KaTeX rendrait alors la commande EN ROUGE sans lever d'erreur : d'où le
  drapeau `refuse`). Seule exception, `roles: true` pour l'aide `formule_coloree` : ses segments sont assemblés en UNE chaîne
  (`assemblerFormuleColoree`) et seul `\htmlClass{moteur-coef-a|b|c}` est admis. KaTeX ne bloque PAS les commandes de couleur
  (`\textcolor`…) : c'est la liste noire serveur (`lib/balisageMath.ts`) qui les arrête — elle reste indispensable. Tout texte
  d'auteur de gen7 doit compiler (garde de `scripts/test-katex.ts`).
- **La production (`lib/`, `api/`, `src/`) n'importe jamais depuis `public/`** (hors `include` de
  `tsconfig.json`, runtime Node non épinglé). Les tests chargent le module client par
  `scripts/support/texteMath.ts` (enveloppe typée) ; chaque texte servi par un générateur de test doit passer
  `verifierBalisageMath`.
- Nouveau générateur curriculaire : l'ajouter à `REGISTRE_GENERATEURS` **et** au catalogue **et** à
  `CORRESPONDANCE_JSON_VERS_PILOTE` (discipline de câblage ci-dessus) ; ses codes de compétence
  doivent exister dans `lib/dictionnaireCompetences.ts`.
- Le conteneur du moteur dans `eleve.html` est `#conteneur-moteur`, pas `#exercice` : `style.css`
  garde des règles héritées de l'ancien écran d'exercice sous `#exercice` (ex. `#exercice button
  { width: 100% }` en mobile) qui déforment tout composant placé dessous.

## Design system (phase 2)

Les 36 tokens de `:root` (`public/style.css`) sont documentés dans `docs/design-system.md`
(`scripts/test-design-system.ts` vérifie qu'ils restent identiques, et que `public/moteur/ecrans.css`
n'utilise que des `var(--token)`). Ne jamais ajouter de valeur en dur (couleur, police, espacement,
rayon) dans un composant d'écran ; ne jamais inventer un token sans mettre à jour le document (et le compte attendu par le test). Ombre de carte :
`var(--ombre-carte)`, jamais recopiée littéralement ; ombre de « Valider » : `var(--ombre-bouton)`. Les 3 tokens `--coef-a|b|c` (surbrillance d'un
coefficient) sont **réservés** à `.moteur-coef-*` — jamais un verdict — et leur contraste (≥ 4,5:1 sur tous
les fonds de carte) est calculé par le test.

## Fidélité au design : la référence fait foi, mesurée sur le style CALCULÉ (RAPPORT §32)

Le CSS source ne prouve rien : une règle de `ecrans.css` peut être écrasée par une règle plus spécifique de `style.css` (cas de `.moteur-champ`, corrigé en §32). Les cinq composants (champ, QCM, liste, champs multiples, intervalle) ont une référence EXACTE dans `docs/reference/composants-ecran.html` (le tableau de signes dans `docs/reference/tableau-signes.html`, les parties fausses dans `docs/reference/parties-fausses.html` (RAPPORT §52), l'enveloppe de l'exercice et l'assemblage de la carte dans `docs/reference/enveloppe-exercice.html`, RAPPORT §43-§44 ; le crayon « Modifier ma réponse » dans `docs/reference/crayon-modifier.html`, RAPPORT §48) ; `npm run chromium-design` rend la référence et l'application dans le même Chromium et compare les styles calculés. Toute retouche visuelle d'un composant se règle sur ce fichier, jamais sur une description ; un écart admis se documente dans le RAPPORT (hauteurs tactiles de 44px, bouton d'aide, ±∞). Un nouveau composant d'écran exige sa référence AVANT d'être construit. Les scénarios Chromium cliquent l'OPTION d'un QCM (label), jamais le radio natif, masqué visuellement mais jamais `display: none`.

## Enveloppe de l'exercice : un écran à la fois, progression, « Ce qu'on sait déjà » (RAPPORT §43 ; assemblage §44, refait en §47)

`public/moteur/moteur.js` (`afficher`, `construireEntete`, `construireRappel`, `ligneFaite`) construit, pour **tous** les générateurs, dans cet ordre : le lien « Mes tâches »
+ « EXERCICE i SUR m · tâche » + « Question k sur N » (`.moteur-suivi`), puis la carte de l'écran courant (`.moteur-ecran-courant`, qui seule porte la couleur vert / rouge / jaune) dont le
**premier enfant** est le panneau gris de progression et du rappel (`.moteur-rappel`). Référence : `docs/reference/enveloppe-exercice.html`, comparée en Chromium par
`npm run chromium-design` (à 390 et 1280 px).
- **Le panneau gris est le PREMIER ENFANT de la carte courante** (RAPPORT §47, jamais un frère) ; sa mise en page dépend de la largeur, en CSS seul (`ecrans.css`, bloc « Assemblage »).
  **Bureau (> 600 px)** : un encadré en retrait dans la carte (filet, arrondi `--radius-sm`, padding 14 × 16), comme l'ancien pilote ; le verdict colore la carte, jamais l'encadré.
  **Sous 600 px** (INCHANGÉ depuis §44, vérifié au pixel près) : tout est **bord à bord** — le bandeau gris touche la bannière violette (même couleur que le panneau), le panneau est
  AU-DESSUS du blanc, filets haut et bas, sans bord latéral (il annule le padding latéral de la carte par des marges négatives) ; la carte blanche fait la largeur de l'écran (sans
  arrondi, sans bord latéral, sans padding haut). Les gouttières de la page sont annulées par `--gouttiere-page` / `--marge-haute-page` (`.contenu-page`, `style.css`). Ne jamais
  réintroduire un élément englobant autour du panneau et de la carte, ni déplacer le rappel par script selon la largeur : c'est la structure unique + le CSS qui portent les deux mises en page.
- **Le rappel ne dérive QUE de l'état que le serveur expose** (`exercice.champs` : `verrouille`, `modifiable`, `statut`, `valeur_saisie`, `solution_attendue`) :
  aucun verdict inventé côté navigateur. `statut === null` (correction coupée) donne une marque et un segment NEUTRES (•, `--violet-2`), **jamais une coche ni une
  couleur de verdict** ; la valeur montrée est la réponse d'ÉLÈVE (`resumer`), jamais la solution (sauf « Réponse attendue » sur une ligne non réussie, si le serveur
  l'a révélée, §42). Tout nouvel indicateur de l'enveloppe dérivé des réponses suit la même règle que la règle de révélation plus bas.
- **« Modifier ma réponse » est un CRAYON, jamais un gros bouton** (RAPPORT §48, modèle A du propriétaire) : pastille ronde de 32 px (`--violet-clair`, icône SVG `--violet-vif`), à droite de la ligne du rappel (`.moteur-rappel-ligne-modifiable`, hauteur mini 32 px) ET à droite du bloc « Ta réponse » de la relecture (`.moteur-ligne-reponse`). **Seul `creerCrayon` (`moteur.js`) le crée** (nom accessible `Modifier ma réponse à l'écran « nom »`, nom d'auteur passé par `versTexteBrut` ; infobulle « Modifier »). Le bouton global du site (`button` : min-height 44 px, padding 9 × 18, bord 2 px, ombre, marge, survol `brightness`) est neutralisé propriété par propriété dans `.moteur-crayon` : toute retouche se mesure sur le style CALCULÉ (`verifierCrayons`, `chromium-design`). Zone cliquable de 32 px (≥ 24 px, WCAG 2.5.8) : ne PAS la porter à 44 px par pseudo-élément, les zones de lignes voisines (pas de 40 px) se chevaucheraient.
- **Une ligne du rappel n'utilise jamais les classes `moteur-statut-*`** : `.moteur-ecran:has(.moteur-statut-…)` colore la carte entière.
- **`EcranDeclare.nom`** (optionnel, texte d'auteur, court, unique dans l'exercice, identique pour tous les élèves) est le libellé d'une ligne ; absent, « Question n ».
  Posé sur gen7 (`NOMS_ECRANS_MD`, `src/generateurs/analyseFonctionMotifDelta/ecrans.ts`) et le témoin. Le rappel **remplace** l'ancienne ligne de consigne « Ce que tu sais déjà » de gen7 (`ligneFaits`, supprimée) : ne
  jamais remettre un rappel dans un texte de consigne.
- **Sans écran courant** (exercice terminé, tâche antérieure, remise à venir du retour en arrière), la RELECTURE reste celle d'avant : une carte par écran (énoncé, « Ta
  réponse », verdict, solution, « Modifier ma réponse »). Le rappel compact ne porte pas l'énoncé. **Sous 600 px, ces blocs de relecture sont AUSSI bord à bord** (RAPPORT §46) : chaque enfant direct de `.moteur-exercice` (`.moteur-ecran-termine`, `.moteur-fin` / `.moteur-remise`, `.moteur-message`) fait la largeur de l'écran, sans arrondi ni bord latéral ; il n'existe plus de « gouttière » rendue aux enfants. Mesuré par `verifierBlocsRelecturePleineLargeur` (Chromium).
- La carte des composants n'est plus celle de `composants-ecran.html` par son enveloppe (bord haut, rayons, largeur, padding latéral : `enveloppe-exercice.html`) ; cette
  référence reste celle de ce que la carte CONTIENT. `--retrait-plein-bord` (`style.css`) vaut 16 px sur mobile (carte bord à bord) : la modifier sans relancer
  `npm run chromium-temoin` la casse.

## « Afficher la réponse attendue » commande la révélation (RAPPORT §42)

`reponse_visible` n'est plus contournée par la révélation à l'épuisement : **la solution d'un champ n'est montrée pendant la
résolution que si `solutionMontreeEnCours`** (`lib/reglagesCorrection.ts`, **seule** définition : correction immédiate ET case cochée).
Case décochée, un champ épuisé (1 essai = premier échec) montre son verdict (`statut`) et se verrouille, mais **ni `solution_attendue` ni
`revele`** (`construireChampVue`, `lib/tableauDeBord.ts`). Restent forcés, inchangés : la tâche ANTÉRIEURE (échéance passée) et la fin d'une
tâche sous correction coupée (`REGLAGES_FORCEES_ANTERIEURES`). Il n'existe **aucun récapitulatif élève** qui porte la solution
(`construireLigneRecap` n'est branchée nulle part, et n'a pas de solution) : case décochée, l'élève ne voit jamais la solution avant l'échéance.
Tout site qui suppose « la vraie valeur a été montrée » (repli de la cascade, tableau aux valeurs vraies, tout futur texte qui reprendrait une
solution) lit `ContexteProjection.solutionMontree` (posé par `projeterExercice`), **jamais `feedback_immediat` seul**. `scripts/test-reponse-visible.ts`
verrouille la table réglages × essais × régimes.

## Correction immédiate coupée (règle de révélation)

Sous `feedback_immediat = false` : **un seul essai effectif** (`tentativesMaxEffectif`, `lib/moteurTentatives.ts`,
seule source ; le formulaire prof verrouille « Tentatives supplémentaires » à 0) et **rien n'est révélé —
ni verdict, ni solution, ni `revele`, ni message d'erreur — avant que la tâche ENTIÈRE soit terminée**, jamais
à l'épuisement d'un champ. Un échec ne doit pas être plus visible qu'une réussite, par AUCUN canal : ajouter
un nouvel indicateur dérivé des réponses d'un élève (série, compétences, score, badge…) impose de l'exclure
tant que la tâche est masquée (`revelationFinDeTache`, `lib/etatExercice.ts` ; voir `RAPPORT.md` §13).

## Score partiel `fractionCorrecte` (RAPPORT §16)

`ResultatVerification` peut porter `fractionCorrecte` (0 ≤ φ < 1) **sur `not_equivalent` seulement** ; le
verdict reste binaire (échec partiel = échec pour `tentativesMax`), seul `score` (`calculerEtatChampTentatives`,
`lib/moteurTentatives.ts`) en tient compte. La fraction est stockée dans `reponses.fraction_correcte` et
**ne sort jamais d'une réponse HTTP** (règle de révélation ci-dessus). Tout nouveau site qui dérive l'état d'un
champ depuis `reponses` doit lire la colonne et la transmettre (`etatTentativesAvecChrono`). Le test
`scripts/test-score-partiel.ts` embarque une copie gelée de l'ancienne formule : ne jamais la modifier.

## Poids par écran (RAPPORT §17)

`EcranDeclare.poids` (entier ≥ 1, défaut 1) pondère les agrégations « corrects / total » — **jamais** lu
ailleurs que par `lib/poidsEcran.ts` (côté navigateur : `public/moteur/scorePondere.js`, seule
implémentation, script classique). Tout nouveau site qui compte des champs corrects sur un total doit passer
par l'un des deux et garder son dénominateur d'origine. Repli à 1 pour toute ligne non exécutable. Le poids est
statique (jamais dépendant des réponses). Risque ouvert : changer un poids réécrit l'historique des pourcentages
(la règle `_v2` ne le couvre pas — décision différée, voir RAPPORT §17-E).

## Cascade de réponses entre écrans (RAPPORT §18)

Une donnée affichée qui dépend d'un écran précédent vient de la réponse **confirmée** par l'élève, jamais de
l'exercice brut, et la vérification suivante se fait sur cette même valeur. Contrat : `EcranDeclare.dependDe`
+ `Generateur.projeter` (point de substitution UNIQUE ; `projeterExercice`, `lib/etatExercice.ts`) ; tout site
qui lit `ecrans`, `verifier`, `solutionAttendue` ou l'aide doit recevoir l'exercice projeté (six sites, dont
`POST /reponses/aide`). Un écran dépendant n'est servi qu'une fois ses prédécesseurs terminés (filtrage
serveur). Repli quand la valeur confirmée est inexploitable : vraie valeur si la solution a été montrée (`solutionMontree`,
RAPPORT §42), donnée de repli déclarée sinon (correction coupée, ou immédiate sans « Afficher la réponse attendue ») — choisi sur le réglage STATIQUE de la tâche, jamais sur `revele`. Ne
jamais coller la chaîne brute de l'élève dans un texte d'auteur : décoder puis re-sérialiser.

**Exception (RAPPORT §45) : quand la solution est montrée** (`solutionMontreeEnCours` : correction immédiate ET « Afficher la réponse attendue »), un champ terminé non réussi a été RÉVÉLÉ avec sa solution ; les écrans suivants repartent de la VRAIE valeur, jamais de la réponse fausse. Le filtre est dans `projeterExercice` (seules les réponses `statut === "correct"` sont transmises à `projeter`) : aucun générateur ne le refait, et un appel direct à `Generateur.projeter` dans un test doit l'imiter. Sans solution montrée (correction coupée, ou immédiate SANS la case), la cascade sur la donnée fausse de l'élève est inchangée (§38). Verrouillé par `scripts/test-cascade-revelee.ts`.


## Tableau de signes / variations : structure dérivée d'un seul module (RAPPORT §30)

Un tableau **structuré** (`colonnes[*].genre`) alterne `intervalle, valeur, …, intervalle` (2N+1, 3 à 9, jamais de colonne −∞/+∞). Quelle case existe, quelles valeurs elle offre (`+ -` / `+ - 0` / `+ - 0 ∅` / `↗ ↘` / `⌢ ⌣`) et sous quelle clé elle répond (case fusionnée d'une ligne `variation` = **première colonne du groupe**) est dérivé par `resoudreRangees` (`lib/structureTableau.ts`), **seule** autorité : le navigateur reçoit `rangees` déjà résolu, la vérification passe par `comparerCasesTableau` — ne jamais recalculer un alphabet ailleurs. `0` n'est offert que sur une colonne `racine: true` (jamais sur un sommet qui n'est pas racine) ; `∅` seulement sur un `pole` d'une ligne `quotient`. Le cycle d'une case ne revient **jamais** à `?`, « Valider » reste désactivé tant qu'il reste un `?` (comme `champs_multiples`), et une valeur hors de l'alphabet de SA case est un `parse_error`, jamais un essai raté. Le tableau est **plein-bord** (`--retrait-plein-bord`, défini par `style.css` : quatre termes dans trois règles, gardés par la mesure Chromium — ne pas le modifier sans relancer `npm run chromium-temoin`). Titres de section : bonne casse écrite dans le contenu, **jamais** `text-transform` (`f(x)` deviendrait `F(X)` ; `scripts/test-structure-tableau.ts`). Le RENDU est celui de la référence stricte `docs/reference/tableau-signes.html` (cellules à filets fins, aucune bulle par valeur, variations en grandes cases fusionnées, flèche tracée et pivotée — jamais un glyphe `↗`/`↘`) : toute retouche visuelle se compare côte à côte à ce fichier (RAPPORT §31), pas à une description. Un tableau sans `genre` reste « hérité » (Section A du témoin).

## Cascade des coefficients dans gen7 (RAPPORT §38, repris par §49)

La cascade est **uniforme dans les deux régimes de correction** : une donnée confirmée par l'élève, fausse mais exploitable, sert de point de départ à l'écran suivant, que la vraie valeur ait été montrée (correction immédiate) ou non — seul l'AFFICHAGE du tableau dépend du réglage (valeurs de x vraies seulement si `solutionMontreeEnCours`, RAPPORT §42). Les écrans 2 à 6 de gen7 sont jugés sur la fonction EFFECTIVE (`fonctionEffective`, `src/generateurs/analyseFonctionMotifDelta/types.ts`), dérivée des coefficients confirmés : jamais lue dans les réponses à `axeSommet` ou `racines`, jamais sur `ex.a/b/c` bruts. Tout nouvel écran de gen7 dont l'énoncé ou la vérification dépend d'un écran précédent déclare `dependDe` (`DEPENDANCES_MD`, `ecrans.ts`) ET lit l'exercice projeté, et son test verrouille les DEUX régimes. Coefficients inexploitables ⇒ repli sur la vraie fonction (publique dans l'énoncé : aucune fuite sous correction coupée). Le libellé et la disponibilité de l'aide ne dépendent JAMAIS de la justesse de la donnée confirmée (`coefficientsAffiches`) : sous correction coupée, un libellé propre à l'erreur est un verdict visible ; `test-retour-arriere` le garde.

## gen7 « motif / delta » : les dix variantes actuelles (RAPPORT §49)

`af_motif_*` ×7 (sans discriminant) et `af_delta_*` ×3 (avec discriminant) sont les SEULES variantes gen7. Les quatre anciennes (`af_mise_en_evidence`, `af_binome_conjugue`, `af_produit_remarquable`, `af_irreductible`), leurs écrans de factorisation (`racinesChamp1`/`racinesChamp2`), la table de vérité différentielle contre l'ancien pilote et le mécanisme « variante retirée » (`Generateur.retire`, `VARIANTES_RETIREES`) ont été **SUPPRIMÉES** (RAPPORT §51) : aucune tâche n'existait en production. Une variante du registre est donc exécutable ET au catalogue affiché (`verifierCoherenceRegistre`, contrôlé au chargement). Les codes de factorisation (`C04`, `C05_SIGNE_REPETE`, `C06_SIGNE_OPPOSE`, …) restent au dictionnaire de compétences et aux explications : c'est la taxonomie, utilisée par plusieurs tests, pas du code mort.
- **Calcul exact, jamais flottant pour décider** (`src/generateurs/analyseFonctionMotifDelta/exact/`) : coefficients et valeurs dans ℚ(√r) ; la comparaison est hybride (`comparaison.ts`, ±0,005 si l'attendu est rationnel, exacte s'il comporte une racine) ; une racine saisie s'écrit `sqrt(n)`, jamais en LaTeX. Le signe passe par une approximation, mais le zéro est exact.
- **Un tirage = un indice dans le pool exhaustif de la famille** (`familles.ts`) : l'ORDRE du pool est contractuel (règle `_v2`) ; ne jamais le réordonner ni borner autrement sans nouveau `variante_id`. L'ordre des termes affiché n'est jamais canonique.
- **Six écrans identiques** (`ecrans.ts`) : coefficients, allure (sens + position du sommet, UNE aide combinée), axe/sommet, ensemble-image (aperçu « im f = » au-dessus, aucune aide), racines (résultat seul), tableau. Tous les écrans 2 à 6 sont jugés sur la fonction EFFECTIVE (`fonctionEffective`), y compris les racines (différence avec §38). Poids 1/1/2/1/(2 motif | 3 delta)/3.
- **Les six codes** sont déclarés dans `codes.ts` ; les quatre `TABLEAU_*` sont de vrais détecteurs (`classerLigne`, `tableauSignes.ts`) et n'existent que sur `not_equivalent`. Un nouveau code se déclare ICI, au dictionnaire de compétences et dans les trois fichiers d'explication.
- **L'indice de racine carrée est uniforme** dans les consignes (même texte avec ou sans radical) : un libellé propre aux irrationnelles serait un indice sur la réponse. `.moteur-consigne` porte `white-space: pre-line` pour les retours à la ligne d'une consigne d'auteur.

## Scores par écran et cumul en points : « le score suit la solution » (RAPPORT §50)

`ChampVue.score` (`lib/tableauDeBord.ts`, **seule** définition du gate) n'est non nul que si le champ est terminé ET la solution montrée (`solutionMontreeEnCours`, ou révélation forcée : tâche antérieure, fin d'une tâche sous correction coupée). Immédiat sans « Afficher la réponse attendue » : verdict seul, jamais de score. Tout nouveau site qui expose un score ou un total dérivé des réponses suit ce même gate. **Exception assumée à la règle `fractionCorrecte` (§16)** : un score partiel la révèle, et n'est donc exposé que là où le verdict l'est déjà ; `POST /api/reponses` n'envoie JAMAIS de score (seul le GET `exercices/:id` et le tableau de bord). `GET exercices/:id` envoie `poids` de TOUS les champs (le dénominateur exige les écrans pas encore servis). Côté navigateur, `public/moteur/pointsEcran.js` est la seule implémentation : points = poids × score / 100 arrondi à 0,1, **total = somme des lignes affichées**, jamais de couleur de verdict (la marque de la ligne la porte). Référence design : `docs/reference/scores.html` (mesurée par `chromium-design`). Ces points ne sont PAS le pourcentage du tableau de bord (statuts, `scorePondere.js`) : ne jamais les mélanger.

## Parties fausses surlignées en rouge (RAPPORT §52)

Sous correction **immédiate** (avec ou sans « Afficher la réponse attendue », avec ou sans essais supplémentaires), les parties fausses d'une réponse sont surlignées : dans l'écran courant après « Valider », et dans l'écran récapitulatif / le rappel gris (« Ta réponse »).
- **Contrat** : un générateur désigne les parties dans `ResultatVerification.not_equivalent.partiesFausses` (`lib/contratGenerateur.ts` : identifiants par type d'écran — id de sous-champ, `crochetGauche|borneGauche|borneDroite|crochetDroit`, `ligne:<i>` | `mode:aucune`, `<ligne>:<ancre>`, id du choix coché, `champ`). `verifierAvecControle` en contrôle la forme. Sans `partiesFausses`, comportement d'origine (carte rouge seule) : jamais une erreur. Un nouveau générateur doit les désigner ; un nouveau type d'écran doit implémenter `marquer(ids)` ET le 3e argument de `resumer`.
- **Porte unique** : `lib/partiesFausses.ts`. Exposées seulement si le réglage RÉEL de la tâche est « correction immédiate » (`contexte.reglages.feedback_immediat`) — jamais par la révélation forcée (tâche antérieure, fin de tâche sous correction coupée). `POST /api/reponses` les envoie (`parties_fausses`) ; `GET /api/exercices/:id` les recalcule pour la relecture. C'est une information PLUS FINE que le verdict : ne jamais l'exposer ailleurs, ni sous correction coupée. Sa porte est DIFFÉRENTE de celle du score et de `fractionCorrecte` (qui suivent la solution) : ne pas les confondre.
- **Client** : `public/moteur/ecrans/marquage.js` est la SEULE implémentation (classe `moteur-partie-fausse`, `aria-invalid` / `aria-description`, retrait dès que l'élève modifie SA partie ; jamais de marquage pendant la frappe). `moteur.js:rendrePieces` rend les morceaux `fausse: true` en `.moteur-piece-fausse`.
- **Design** : référence `docs/reference/parties-fausses.html`, mesurée par `chromium-design` (toutes les cases de tableau marquées, pas seulement la première). Le CSS vit en FIN de `ecrans.css` : il doit l'emporter sur les règles d'état à spécificité égale. La couleur ne suffit jamais (✕, soulignement ondulé).

## Aperçu d'une tâche : élève fantôme (RAPPORT §36)

`POST /api/taches/apercu` (`lib/routes/taches-apercu.ts`) assigne une tâche `est_apercu` au seul élève fantôme du professeur (`profs.eleve_apercu_id`, jamais inscrit à une classe) et renvoie sa session ; `eleve.html?apercu=1` (`initModeApercu`, `persistSession: false`) l'ouvre par le moteur normal. Trois règles : (1) le fantôme DOIT avoir une ligne `taches_assignations_eleves` (sinon le tableau de bord élève ignore la tâche) ; (2) toute nouvelle table qui référence `exercices_assignes` ou `taches` doit être ajoutée à `supprimerAncienApercu` (sinon le 2e aperçu échoue sur une clé étrangère : c'est arrivé à `aides_utilisees` dans l'ancien pilote) ; (3) « Aperçu » n'est actif que pour des variantes `executable` (champ dérivé du registre par `GET /api/catalogue-generateurs`, jamais une liste à part) ; toute vue professeur qui lit `taches` ou `exercices_assignes` doit exclure `est_apercu`.

## Tables d'objets littéraux : jamais `cle in table` ni `table[cle]` avec une clé dynamique (RAPPORT §20)

Tout objet littéral hérite de `Object.prototype` : `"constructor" in table` est vrai et `table["constructor"]` est
une fonction. Pour une clé qui n'est pas une constante du code (code de compétence, id venu du serveur, et surtout
tout texte ou toute clé JSON venant de l'ÉLÈVE) : `lirePropre(table, cle)` (`lib/tablePropre.ts`) ou `Object.hasOwn`,
une `Map` pour un compteur, `Object.create(null)` pour un objet construit avec des clés d'élève (et rejet de
`__proto__`, comme `decoderTableauSignes`). Un test doit reproduire l'entrée hostile (`scripts/test-durcissement-prototype.ts`).

## RLS : toute table a RLS activé, sans police (RAPPORT §22-§23)

Les 13 tables ont `enable row level security` **sans aucune police** : `anon`/`authenticated` n'ont accès à rien, le serveur
passe par `supabaseAdmin()` (`service_role`, contourne RLS). Toute nouvelle `create table` doit, dans le même commit, ajouter
son `alter table … enable row level security` à `schema.sql` ET `cumulatif.sql` et sa ligne à la liste figée de
`scripts/test-rls-schema.ts`. Ne créer une police que pour un accès direct navigateur -> base (aucun aujourd'hui). Après un
`admin.auth.signInWithPassword`, le MÊME client n'accède plus aux données en `service_role` : aucun `.from(...)` ensuite.

## `SUPABASE_URL` : toujours lue par `lireSupabaseUrl` (RAPPORT §25)

Le client `@supabase/supabase-js` ajoute lui-même `/rest/v1`, `/auth/v1`… à l'URL fournie : une variable d'environnement
terminée par `/rest/v1/` double le chemin (PGRST125) et fait échouer toutes les requêtes, en silence derrière les messages
génériques (« Code d'invitation invalide »). Ne jamais lire `process.env.SUPABASE_URL` ailleurs que dans `lib/urlSupabase.ts`
(`lireSupabaseUrl`, qui retire un suffixe d'API et avertit) ; `scripts/test-url-supabase.ts` le vérifie. La bonne valeur reste
`https://<ref>.supabase.co`, sans chemin.

## Rôle admin-prof (RAPPORT §26)

- **Toute route `/api/admin/*` commence par `exigerAdmin`** (`lib/adminAuth.ts` : 401 non authentifié ou désactivé, **403** non admin), AVANT toute validation de corps ; `est_admin` est relu en base à chaque requête (`profAuthentifie`), jamais lu dans un jeton ni déduit côté client. L'onglet « Admin » de `prof.html` n'est qu'un affichage (`GET /api/profs/moi`).
- **`est_admin` n'est écrit par AUCUNE route, ni `provisionnerProf`** : seul le propriétaire du projet l'accorde, en SQL (§26-D). Un admin ne se désactive pas, et aucune désactivation / réinitialisation de mot de passe ne vise un compte admin.
- Un prof désactivé (`profs.actif = false`) est refusé par `profAuthentifie` (401 partout) ET banni côté Supabase Auth ; tout nouveau site d'authentification de prof passe par `profAuthentifie`.
- Toute création de compte prof passe par `provisionnerProf` (compensation : le compte Auth est supprimé si la ligne `profs` échoue). Un code d'invitation généré par l'interface est lié à un e-mail (`email_cible`) ; discordance = le même 404 générique que « code inexistant ».


## Retour en arrière (RAPPORT §37)

Réglage de tâche `taches.autoriser_retour_arriere` (défaut faux) ; **effectif seulement sous correction immédiate coupée** (`retourArriereEffectif`, `lib/moteurTentatives.ts`, seule source ; lu par `chargerContexteTache` → `ContexteTache.retourArriere`, jamais re-dérivé ailleurs) et **interdit avec un chrono `par_ecran`** (`estCorpsValide`, 400). Le chrono `global` est compatible.

- **Validité = ordre d'insertion, aucune écriture d'invalidation** (`lib/reponsesValides.ts`, seule autorité) : une ligne `reponses` est valide si elle est plus récente que la dernière ligne de CHAQUE écran amont (fermeture transitive de `dependDe`) ; l'état d'un écran est sa dernière ligne si valide, sinon « sans réponse ». Aucune ligne n'est jamais supprimée ni marquée. Tout lecteur qui montre un état, un statut ou un score par écran passe par `donneesEffectives` / `dernieresReponsesValides` (fait : `calculerEtatExercice`, `mes-resultats`, `profs/resultats`) ; les statistiques (bugs détectés, durées, série) comptent TOUTES les lignes.
- **Modifier ≠ terminer.** Sous retour, `verrouille` (moteur) = répondu ; `modifiable` = répondu et exercice pas verrouillé ; l'exercice n'est **terminé** (donc rien n'est corrigé, la tâche ne se complète pas) qu'une fois **rendu** (`exercices_assignes.remis_le`, `POST /api/exercices/:id/remise`, exige une réponse valide à chaque écran) ou son chrono global écoulé (`exerciceVerrouille`). Sans remise, la dernière réponse ferait tout révéler d'un coup. Un échec reste modifiable comme une réussite : la réponse HTTP et le GET sont identiques (testé), aucun verdict avant la remise.
- **Réponse identique** (`trim()` des deux côtés) = aucune ligne écrite, donc rien de périmé. Vérification d'un écran modifié sur les seules réponses de son AMONT. L'usage d'aide est collant (jamais réinitialisé).
- **« Terminé » a UNE définition** : `champsTermines` / `calculerEtatExercice` (`lib/etatExercice.ts`) ; `verrouillageTache`, `mes-resultats` et `profs/resultats` l'utilisent — ne jamais réécrire une boucle « ce champ est-il terminé » (c'est ce qui avait fait diverger le chrono et la colonne `complet` de la vue prof).
- **Client** : chaque composant d'écran accepte `valeurInitiale` (la `reponse_brute` confirmée) et doit la restaurer **sans altération** — re-valider sans changer doit produire la même chaîne (sinon une simple relecture périmerait l'aval ; le scénario Chromium le mesure sur les six composants). Un nouveau type d'écran doit implémenter `valeurInitiale`.
- **Harnais** : `BaseMemoire.maintenant` produit des horodatages strictement croissants ; ne pas le remplacer par un horodatage à la milliseconde (ex æquo → ordre d'insertion perdu).
