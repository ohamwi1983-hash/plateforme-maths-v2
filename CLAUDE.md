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

Le CSS source ne prouve rien : une règle de `ecrans.css` peut être écrasée par une règle plus spécifique de `style.css` (cas de `.moteur-champ`, corrigé en §32). Les cinq composants (champ, QCM, liste, champs multiples, intervalle) ont une référence EXACTE dans `docs/reference/composants-ecran.html` (le tableau de signes dans `docs/reference/tableau-signes.html`) ; `npm run chromium-design` rend la référence et l'application dans le même Chromium et compare les styles calculés. Toute retouche visuelle d'un composant se règle sur ce fichier, jamais sur une description ; un écart admis se documente dans le RAPPORT (hauteurs tactiles de 44px, bouton d'aide, ±∞). Un nouveau composant d'écran exige sa référence AVANT d'être construit. Les scénarios Chromium cliquent l'OPTION d'un QCM (label), jamais le radio natif, masqué visuellement mais jamais `display: none`.

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
serveur). Repli quand la valeur confirmée est inexploitable : vraie valeur si `feedback_immediat`, donnée de
repli déclarée si correction coupée — choisi sur le réglage STATIQUE de la tâche, jamais sur `revele`. Ne
jamais coller la chaîne brute de l'élève dans un texte d'auteur : décoder puis re-sérialiser.

## Tableau de signes / variations : structure dérivée d'un seul module (RAPPORT §30)

Un tableau **structuré** (`colonnes[*].genre`) alterne `intervalle, valeur, …, intervalle` (2N+1, 3 à 9, jamais de colonne −∞/+∞). Quelle case existe, quelles valeurs elle offre (`+ -` / `+ - 0` / `+ - 0 ∅` / `↗ ↘` / `⌢ ⌣`) et sous quelle clé elle répond (case fusionnée d'une ligne `variation` = **première colonne du groupe**) est dérivé par `resoudreRangees` (`lib/structureTableau.ts`), **seule** autorité : le navigateur reçoit `rangees` déjà résolu, la vérification passe par `comparerCasesTableau` — ne jamais recalculer un alphabet ailleurs. `0` n'est offert que sur une colonne `racine: true` (jamais sur un sommet qui n'est pas racine) ; `∅` seulement sur un `pole` d'une ligne `quotient`. Le cycle d'une case ne revient **jamais** à `?`, « Valider » reste désactivé tant qu'il reste un `?` (comme `champs_multiples`), et une valeur hors de l'alphabet de SA case est un `parse_error`, jamais un essai raté. Le tableau est **plein-bord** (`--retrait-plein-bord`, défini par `style.css` : quatre termes dans trois règles, gardés par la mesure Chromium — ne pas le modifier sans relancer `npm run chromium-temoin`). Titres de section : bonne casse écrite dans le contenu, **jamais** `text-transform` (`f(x)` deviendrait `F(X)` ; `scripts/test-structure-tableau.ts`). Le RENDU est celui de la référence stricte `docs/reference/tableau-signes.html` (cellules à filets fins, aucune bulle par valeur, variations en grandes cases fusionnées, flèche tracée et pivotée — jamais un glyphe `↗`/`↘`) : toute retouche visuelle se compare côte à côte à ce fichier (RAPPORT §31), pas à une description. Un tableau sans `genre` reste « hérité » (Section A du témoin).

## Vérification de la factorisation de gen7 (RAPPORT §19)

Les écrans `racinesChamp1`/`racinesChamp2` sont des **modules purs** (`src/generateurs/analyseFonction/racines/`),
prouvés contre l'ancien pilote par une table de vérité différentielle figée
(`scripts/support/table-verite-racines-pilote.json`, provenance `docs/extraction-table-verite-racines.md`).
`irreductible` n'a **aucun** de ces écrans : `ecransRacines("irreductible")` est vide et `CategorieRacines` l'exclut
du typage — ne jamais lui donner un écran « toujours correct ». L'**ordre des tirages** de `genererRacines` est
figé (toute modification impose un nouveau `variante_id`). Toute divergence avec l'ancien pilote doit être
délibérée, listée dans le test et dans `RAPPORT.md` (quatre à ce jour). `C07_ou_C08` n'est jamais émis ni déclaré pour gen7.

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

