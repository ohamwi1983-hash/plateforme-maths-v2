/**
 * Prompt "Profil de compétences élève", Étape 0 : vérification non négociable effectuée par lecture
 * directe du code réel (pas d'après une nomenclature d'analyse externe) — grep exhaustif de
 * `bug_detecte`/`bugDetecte` sur tout le dépôt (`lib/routes/reponses.ts`,
 * `src/diagnostic/diagnosticFacteurCommun.ts`, et tous les autres fichiers qui LISENT
 * `bug_detecte` : `lib/routes/profs/resultats.ts`, `lib/routes/profs/tableau-de-bord.ts`,
 * `lib/reglagesCorrection.ts` — aucun n'introduit de code supplémentaire, tous le traitent en
 * `string | null` opaque).
 *
 * **Les 7 seules valeurs littérales que `bug_detecte` pouvait prendre à cette date** :
 * - gen1 (`detecterBug`/`traiterChamp1`, `lib/routes/reponses.ts` lignes 86-98/149-155) : `"C04"`
 *   (mise_en_evidence, `detecterXMasqueParNegation`) et `"C07_ou_C08"` (cas_general,
 *   `correspondAuDeltaFantome`).
 * - gen6/facteurCommun : `"FC_CE_FANTOME"` (champ `ce`, ligne 198), `"FC_PRODUIT_NUL_OUBLIE"` /
 *   `"FC_RACINE_OPPOSEE_OUBLIEE"` / `"FC_RACINE_FANTOME"` (`detecterBugChamp2`,
 *   `src/diagnostic/diagnosticFacteurCommun.ts` lignes 89-107) et `"RECOPIE_NON_REDUITE"`
 *   (`simplifierFraction`, ligne 225).
 * Confirmé indépendamment par le commentaire déjà présent dans `supabase/schema.sql` (colonne
 * `reponses.bug_detecte`, ligne 132-134), qui listait exactement ces 7 mêmes valeurs — deux sources
 * indépendantes concordantes.
 *
 * **Écart trouvé avec le point de départ du prompt** : `C01`, `C02`, `C09`, `C10`, `C11` (4 des 12
 * entrées proposées) **n'existent nulle part dans le code** — aucun détecteur ne les produit
 * jamais. Ce sont des codes d'une nomenclature externe jamais implémentée dans ce dépôt. Retirés du
 * dictionnaire ci-dessous, conformément à la consigne explicite de l'Étape 0 ("ne jamais supposer
 * une correspondance exacte") — un code qui n'apparaîtra jamais en base n'a pas sa place dans ce
 * mapping.
 *
 * **Prompt "Détecteurs C05/C06 (Diagnostic, 3/3)"** : `C05_SIGNE_REPETE` (binome_conjugue) et
 * `C06_SIGNE_OPPOSE` (produit_remarquable) ajoutés — voir
 * `src/diagnostic/diagnosticBinomeProduitRemarquable.ts` et leur branchement dans `detecterBug`
 * (`lib/routes/reponses.ts`). Portent le total à 9 valeurs littérales possibles.
 *
 * **Prompt "Câblage taxonomie compétences — Tier 0/1/1.5"** :
 * - Tier 0 : aucun nouveau code — nouveaux points d'appel pour C04/C05_SIGNE_REPETE/
 *   C06_SIGNE_OPPOSE/C07_ou_C08/RECOPIE_NON_REDUITE (`traiterChamp1` étendu, gen1/simplification,
 *   gen6/niveau3-4/denominateurCarre/sansFacteurCommun/cubique — champ1 numérateur et, pour
 *   sansFacteurCommun, dénominateur).
 * - Tier 1 : `CE_PARTIELLE`/`RACINE_PARTIELLE`/`FORME_ENSEMBLE_SOLUTION` ajoutés (voir leurs
 *   points de câblage dans `lib/routes/reponses.ts`).
 * - Tier 1.5 : `GRILLE_SIGNE_FACTEUR`/`GRILLE_SIGNE_QUOTIENT` ajoutés, dérivés des `cellulesErronees*`
 *   déjà calculées (aucune nouvelle extraction numérique).
 *
 * **Prompt "Câblage taxonomie compétences — complément gen2 (écran racines)"** : `TYPE_RACINES`
 * ajouté — écran "racines" de gen2 (`traiterInequation`, `lib/routes/reponses.ts`), jusqu'ici hors
 * périmètre de la taxonomie (voir le commentaire de tête de `traiterInequation`, mis à jour en
 * conséquence). `RACINE_PARTIELLE` (déjà existant depuis Tier 1) y est réutilisé tel quel, jamais
 * redéfini.
 * Porte le total à 15 valeurs littérales possibles.
 *
 * **Prompt "Câblage taxonomie compétences — gen4"** (PROMPT-taxonomie-gen4.md) : 2 nouveaux codes —
 * `FRACTION_NON_REDUITE` (écran "simplifier" léger, `correspondAFractionNonReduite`,
 * `src/moteur/verificationEquationRationnelle.ts` — distinct de `RECOPIE_NON_REDUITE`, détecteur
 * différent, `FractionAReduire` n'a pas de `racineCommune`) et `RACINE_ETRANGERE_IGNOREE` (écran
 * final "racinesEtrangeres", `detecterRacineEtrangereIgnoree`, `lib/routes/reponses.ts`). 5 autres
 * points de câblage réutilisent des codes déjà existants sans en ajouter : "ce" (CE_PARTIELLE),
 * "simplifierChamp1"/"champ1" (C04/C05_SIGNE_REPETE/C06_SIGNE_OPPOSE/C07_ou_C08, via `traiterChamp1`
 * déjà générique + `bugs_plausibles` désormais calculé pour gen4), "simplifierChamp2"/"champ2"
 * (RACINE_PARTIELLE), "simplifierFactorisation" (RACINE_PARTIELLE, `detecterRacinePartielleFactorisation`
 * déjà exportée pour gen3), "simplifierFraction" (RECOPIE_NON_REDUITE, `correspondARecopieNonReduite`
 * déjà exportée).
 * Porte le total à 17 valeurs littérales possibles.
 *
 * **Prompt "Câblage taxonomie compétences — gen8"** (PROMPT-taxonomie-gen8.md) : 4 nouveaux codes —
 * `TRANSFORMATION_HORIZONTALE`/`TRANSFORMATION_VERTICALE`/`TRANSFORMATION_ECHELLE_VERTICALE`/
 * `TRANSFORMATION_ORIENTATION`, dérivés de `evaluerCurseurs` (`src/moteur/
 * verificationTransformationsGraphiques.ts`), câblés sur la note "curseurs" de gen8
 * (`lib/routes/reponses.ts`, `traiterTransformationGraphique`). **Premier cas de ce dépôt où
 * PLUSIEURS codes sont enregistrés pour une même soumission** (décision actée du prompt, "Option
 * B" : 4 compétences réellement indépendantes, jamais réduites à un seul code par priorité comme
 * pour la grille) — `bug_detecte` peut désormais contenir plusieurs codes joints par une virgule
 * (`joindreBugsDetectes`/`separerBugsDetectes`, `lib/profilCompetences.ts`), rétrocompatible avec
 * les codes existants (jamais de virgule dans un code isolé, `.split(",")` sur une valeur simple
 * est un no-op qui renvoie un tableau à 1 élément).
 * **Correctif de comptage** : le dictionnaire comptait RÉELLEMENT 20 entrées avant ce prompt (pas
 * 17) — `ALLURE_PARTIELLE`/`AXE_SYMETRIE_NOTATION`/`SIGNE_VARIATION_PARTIEL` (câblage gen7,
 * `PROMPT-taxonomie-gen7.md`, voir `scripts/test-taxonomie-gen7.ts`) avaient été ajoutées sans
 * jamais mettre à jour ce commentaire ni le "Porte le total" ci-dessus — vérifié par comptage direct
 * de `Object.keys(DICTIONNAIRE_COMPETENCES).length` avant tout ajout de ce prompt, jamais supposé
 * depuis les commentaires seuls. Porte le total à **24** valeurs littérales possibles (20+4).
 *
 * **Prompt "Câblage taxonomie compétences — gen9"** (PROMPT-taxonomie-gen9.md) : 1 nouveau code —
 * `FORME_CANONIQUE_SIGNE_P` (élève qui écrit `(x-|xS|)` au lieu de `(x+|xS|)` quand `xS` est
 * négatif, ou l'inverse), câblé sur les 4 écrans de gen9 (`traiterFormeCanoniqueTransformation`) en
 * plus de la réutilisation CROSS-GÉNÉRATEUR des 4 codes `TRANSFORMATION_*` ci-dessus (mêmes codes,
 * jamais redéfinis) — un même élève déclenchant `TRANSFORMATION_HORIZONTALE` sur gen8 PUIS sur gen9
 * cumule dans une seule entrée de son profil (la fonction pure `calculerProfilCompetences` ne
 * distingue jamais par générateur, seulement par code — déjà vérifié pour tous les autres codes
 * partagés). Même mécanique "plusieurs codes par soumission" que gen8 (Option B).
 * Porte le total à **25** valeurs littérales possibles (24+1).
 *
 * **Prompt "Câblage taxonomie compétences — gen10"** (PROMPT-taxonomie-gen10.md) : 2 nouveaux codes
 * — `FONCTION_REFERENCE_DIRECTION_DOMAINE` (racine_carree UNIQUEMENT, `reponse.soy !== exercice.soy`)
 * et `FONCTION_REFERENCE_ORIENTATION_IMPAIRE` (cube/racine_cubique/inverse UNIQUEMENT, XOR de
 * sox/soy) — plus réutilisation CROSS-GÉNÉRATEUR de `TRANSFORMATION_HORIZONTALE`/
 * `TRANSFORMATION_VERTICALE` (les 6 familles) et `TRANSFORMATION_ORIENTATION` (carre/
 * valeur_absolue/racine_carree UNIQUEMENT — jamais cube/racine_cubique/inverse, remplacé pour ces
 * 3 familles par `FONCTION_REFERENCE_ORIENTATION_IMPAIRE`), câblés sur la note "curseurs" de gen10
 * (`lib/routes/reponses.ts`, `traiterFonctionReference`). **Câblage explicitement restreint par
 * famille, contrairement à tous les prompts de taxonomie précédents** (voir
 * `evaluerCurseursFonctionReference`/`appliquerG`, `src/moteur/verificationFonctionsReference.ts`) :
 * `CH`/`EH`/`EV`/`CV` ne reçoivent JAMAIS de code (compensation `(ch/eh)ⁿ` × `(ev/cv)` possible pour
 * les 6 familles), et `SOY` sur `carre`/`valeur_absolue` n'a AUCUN effet observable sur `f` (parité
 * paire de `g`) — jamais comparé à `exercice.soy` pour ces 2 familles. Même mécanique "plusieurs
 * codes par soumission" que gen8/gen9 (Option B).
 * Porte le total à **27** valeurs littérales possibles (25+2).
 *
 * **Prompt "Câblage taxonomie compétences — gen13"** (PROMPT-taxonomie-gen13.md) : 3 nouveaux codes
 * — `EXISTENCE_VALEUR_ALGEBRIQUE` (ordonnee/zeros — pendant purement symbolique de
 * `EXISTENCE_POINT_GRAPHIQUE` de gen12, jamais cumulé avec lui : décision actée "Option B", aucune
 * réutilisation cross-générateur entre les deux), `ISOLEMENT_SIGNE_CONSTANTE` (écran "isolement",
 * voie générique uniquement — jamais les 2 branches spéciales niveau2 carre/cube, qui utilisent des
 * fonctions de vérification entièrement différentes), `SEPARATION_PARTIELLE` (écrans "separation" et
 * "resolutionBranches" — même compétence "une des deux équations/comparaisons correcte, l'autre
 * fausse" sur 2 écrans distincts, jamais 2 codes séparés). Plus 2 réutilisations : `RACINE_PARTIELLE`
 * (déjà existant depuis Tier 1, écran "zeros" — comparé, par correctif de cohérence avec le bug
 * corrigé pendant la construction de gen13, aux candidats non filtrés `racinesAValiderRacineCarree`
 * pour racine_carree niveau2 spécifiquement, jamais `zerosAttendus` pour cette famille précise —
 * voir `lib/routes/reponses.ts`) et `RACINE_ETRANGERE_IGNOREE` (déjà existant depuis gen4, écran
 * "validationSolution1"/"2" — PREMIER cumul cross-générateur réel de ce code, chaque soumission
 * atomique, jamais de logique "partielle" nécessaire ici contrairement à gen4 où 2 candidats sont
 * soumis ensemble).
 * Porte le total à **30** valeurs littérales possibles (27+3, les 2 réutilisations n'ajoutant aucune
 * nouvelle entrée).
 *
 * **Prompt "Câblage taxonomie compétences — gen14"** (PROMPT-taxonomie-gen14.md) : 3 nouveaux codes
 * — `SIGNE_SIN_QUADRANT`/`SIGNE_COS_QUADRANT`/`SIGNE_TAN_QUADRANT`, écran "signes" uniquement (les 3
 * autres écrans de gen14 — reduction/quadrant/anglePremierQuadrant — n'ont aucun candidat : valeur
 * unique ou choix fermé, rien à décomposer). Dérivés de `evaluerSignes` (déjà appelée côté client
 * pour le marquage rouge des cellules fausses — réutilisée telle quelle ici, jamais un second appel
 * indépendant), même mécanique "plusieurs codes par soumission" que gen8/gen9/gen10 (Option B) :
 * `!sin`/`!cos`/`!tan` déclenchent chacun leur propre code, cumulables sur une même soumission.
 * Porte le total à **33** valeurs littérales possibles (30+3).
 */
export const DICTIONNAIRE_COMPETENCES: Record<string, { libelle: string; description: string }> = {
  C04: { libelle: "Signe en mise en évidence", description: "Distribuer un signe négatif en mise en évidence" },
  C05_SIGNE_REPETE: { libelle: "Différence de carrés", description: "Factoriser a(x-r)(x+r) sans répéter le même signe entre les deux facteurs" },
  C06_SIGNE_OPPOSE: { libelle: "Carré parfait", description: "Factoriser a(x-r)² sans inverser le signe entre les deux facteurs" },
  C07_ou_C08: { libelle: "Discriminant", description: "Calculer le discriminant Δ (formule ou lecture des coefficients)" },
  FC_CE_FANTOME: { libelle: "Valeurs exclues", description: "Trouver les valeurs exclues d'une fraction rationnelle" },
  FC_PRODUIT_NUL_OUBLIE: { libelle: "Principe du produit nul", description: "Ne pas oublier que x=0 est solution" },
  FC_RACINE_OPPOSEE_OUBLIEE: { libelle: "Racine opposée", description: "Ne pas oublier la racine opposée (binôme conjugué)" },
  FC_RACINE_FANTOME: { libelle: "Racines du second degré", description: "Trouver les deux racines d'un trinôme" },
  RECOPIE_NON_REDUITE: { libelle: "Simplification complète", description: "Simplifier entièrement une fraction, éviter une recopie non réduite" },
  CE_PARTIELLE: { libelle: "Valeurs exclues (partiel)", description: "Une des deux valeurs exclues trouvée, l'autre manquante ou fausse" },
  RACINE_PARTIELLE: { libelle: "Racines (partiel)", description: "Une racine correcte, l'autre manquante ou fausse" },
  FORME_ENSEMBLE_SOLUTION: {
    libelle: "Forme de l'ensemble-solution",
    description: "Mauvaise forme qualitative choisie (∅ / ℝ / point / tous les réels sauf un ou plusieurs points / intervalle-union), indépendamment des valeurs à l'intérieur de cette forme",
  },
  GRILLE_SIGNE_FACTEUR: {
    libelle: "Signe d'un facteur",
    description: "Erreur sur le signe d'un facteur linéaire (numérateur, dénominateur, ou coefficient dominant) sur au moins un intervalle du tableau de signes",
  },
  GRILLE_SIGNE_QUOTIENT: {
    libelle: "Signe du quotient",
    description: "Toutes les lignes de facteurs correctes, mais erreur dans la combinaison des signes en ligne finale (quotient/produit)",
  },
  TYPE_RACINES: {
    libelle: "Existence des racines",
    description: "Mauvais choix entre « aucune racine » et « deux racines » — reconnaître le signe du discriminant, indépendamment du calcul des valeurs",
  },
  ALLURE_PARTIELLE: {
    libelle: "Allure de la parabole",
    description: "Sens de la parabole (signe de a) ou position de l'axe par rapport à l'axe des y (signe de ab) correct, l'autre faux",
  },
  AXE_SYMETRIE_NOTATION: {
    libelle: "Notation de l'axe de symétrie",
    description: "Valeur numérique correcte donnée sans l'écrire sous forme d'équation « x = ... »",
  },
  SIGNE_VARIATION_PARTIEL: {
    libelle: "Signe vers variation",
    description: "Ligne de signe correcte mais traduction en flèches de variation fausse, ou l'inverse",
  },
  RACINE_NON_SIMPLIFIEE: {
    libelle: "Racine carrée non simplifiée",
    description: "Valeur mathématiquement correcte mais écrite avec une racine carrée qui peut encore être simplifiée (√8 au lieu de 2√2)",
  },
  RACINES_NOMBRE_INCORRECT: {
    libelle: "Nombre de racines",
    description: "Se trompe sur le NOMBRE de racines (aucune, une ou deux) de la fonction étudiée, indépendamment de leurs valeurs",
  },
  TABLEAU_SIGNE_PARTIEL: {
    libelle: "Ligne de signe (partielle)",
    description: "Ligne de signe de f(x) en partie juste : certaines cases du tableau sont correctes, d'autres non",
  },
  TABLEAU_VARIATION_PARTIEL: {
    libelle: "Ligne de variations (partielle)",
    description: "Ligne des variations de f en partie juste : certaines cases sont correctes, d'autres non",
  },
  TABLEAU_SIGNE_INVERSE: {
    libelle: "Signes de f inversés",
    description: "Ligne de signe de f(x) entièrement inversée (+ à la place de −, et inversement) : confusion sur le signe de a ou sur le signe de f entre les racines",
  },
  TABLEAU_CONCAVITE_INCORRECTE: {
    libelle: "Sens des variations inversé",
    description: "Ligne des variations entièrement inversée (↗ ↘ échangés, minimum et maximum échangés) : confusion sur le sens de la parabole",
  },
  FRACTION_NON_REDUITE: {
    libelle: "Simplification numérique",
    description: "Fraction équivalente à l'originale mais pas réduite au maximum (facteur commun aux coefficients non éliminé)",
  },
  RACINE_ETRANGERE_IGNOREE: {
    libelle: "Racines étrangères",
    description: "Confond une racine valide et une racine à rejeter (qui annule une condition d'existence)",
  },
  TRANSFORMATION_HORIZONTALE: {
    libelle: "Translation horizontale",
    description: "Mauvaise lecture du décalage horizontal d'une parabole transformée",
  },
  TRANSFORMATION_VERTICALE: {
    libelle: "Translation verticale",
    description: "Mauvaise lecture du décalage vertical d'une parabole transformée",
  },
  TRANSFORMATION_ECHELLE_VERTICALE: {
    libelle: "Facteur d'échelle",
    description: "Mauvais rapport d'échelle (coefficient a) lu par curseurs sur une parabole transformée",
  },
  TRANSFORMATION_ORIENTATION: {
    libelle: "Sens d'ouverture",
    description: "Mauvais sens d'ouverture (vers le haut/bas) d'une parabole transformée",
  },
  FORME_CANONIQUE_SIGNE_P: {
    libelle: "Signe dans la forme canonique",
    description: "Écrit (x-xS) littéralement au lieu de substituer correctement le signe quand xS est négatif — confond soustraction et double négation",
  },
  FONCTION_REFERENCE_DIRECTION_DOMAINE: {
    libelle: "Direction du domaine",
    description: "Confond de quel côté du pivot une fonction à domaine restreint (racine carrée) est définie",
  },
  FONCTION_REFERENCE_ORIENTATION_IMPAIRE: {
    libelle: "Orientation (fonction impaire)",
    description: "Confond signe global et sens de symétrie sur une fonction impaire (cube, racine cubique, inverse) — seule la combinaison des deux compte, pas chacun séparément",
  },
  // PROMPT-taxonomie-gen11.md : `TRANSFORMATION_ECHELLE` renommée `TRANSFORMATION_ECHELLE_VERTICALE`
  // ci-dessus DÈS SA CRÉATION (gen8, jamais sous l'ancien nom bref — vérifié par grep, aucune
  // occurrence de "TRANSFORMATION_ECHELLE" bare dans lib/), donc aucune migration nécessaire ici ;
  // seul le nouveau code ci-dessous, pour coexister avec elle.
  TRANSFORMATION_ECHELLE_HORIZONTALE: {
    libelle: "Facteur d'échelle horizontal",
    description: "Mauvais rapport d'étirement/compression horizontal (CH/EH), lecture distincte de l'échelle verticale",
  },
  FONCTION_REFERENCE_SYMETRIE_INTERNE: {
    libelle: "Symétrie interne (fonction impaire)",
    description: "Mauvaise symétrie par rapport à l'axe Oy avant application de la fonction de référence, sur une famille impaire (cube, racine cubique, inverse)",
  },
  // PROMPT-taxonomie-gen12.md : les 3 codes ci-dessous possédaient déjà une entrée dans
  // lib/explicationsCompetences.ts (lot anticipatoire, jamais câblés jusqu'ici — même situation que
  // FONCTION_REFERENCE_DIRECTION_DOMAINE avant gen10, TRANSFORMATION_ECHELLE_HORIZONTALE avant
  // gen11) : libellé/description repris verbatim du prompt, aucune nouvelle entrée
  // explicationsCompetences.ts nécessaire.
  EXISTENCE_POINT_GRAPHIQUE: {
    libelle: "Existence d'un point sur le graphique",
    description: "Confond l'appartenance d'un point au domaine (existence) avec le calcul de sa valeur — dit qu'un point n'existe pas alors qu'il existe, ou l'inverse",
  },
  ASYMPTOTE_PARTIELLE: {
    libelle: "Asymptotes (partiel)",
    description: "Une des deux équations d'asymptote (verticale ou horizontale) correcte, l'autre fausse",
  },
  DOMAINE_EXCLUSION_OUBLIEE: {
    libelle: "Exclusion du domaine",
    description: "Domaine (ou intervalle de croissance/décroissance/constance) presque correct, mais une exclusion ou un morceau oublié ou en trop",
  },
  // PROMPT-taxonomie-gen13.md
  EXISTENCE_VALEUR_ALGEBRIQUE: {
    libelle: "Existence d'une valeur (algébrique)",
    description: "Confond l'existence d'une valeur dans le domaine avec son calcul, en contexte purement symbolique (sans lecture graphique)",
  },
  ISOLEMENT_SIGNE_CONSTANTE: {
    libelle: "Signe de la constante isolée",
    description: "Expression de base correctement isolée, mais signe de la constante déplacée de l'autre côté de l'égalité inversé",
  },
  SEPARATION_PARTIELLE: {
    libelle: "Séparation en deux équations (partiel)",
    description: "Une des deux équations issues d'une séparation (valeur absolue ou carré) ou d'une résolution par branches correcte, l'autre fausse",
  },
  // PROMPT-taxonomie-gen14.md
  SIGNE_SIN_QUADRANT: {
    libelle: "Signe du sinus",
    description: "Erreur sur le signe du sinus dans un quadrant donné du cercle trigonométrique",
  },
  SIGNE_COS_QUADRANT: {
    libelle: "Signe du cosinus",
    description: "Erreur sur le signe du cosinus dans un quadrant donné du cercle trigonométrique",
  },
  SIGNE_TAN_QUADRANT: {
    libelle: "Signe de la tangente",
    description: "Erreur sur le signe de la tangente dans un quadrant donné du cercle trigonométrique",
  },
};
