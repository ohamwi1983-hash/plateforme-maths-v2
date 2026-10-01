/**
 * Prompt "Bouton d'explication pédagogique par compétence (espace professeur)" — contenu pédagogique
 * détaillé (explication + exemple concret) pour un sous-ensemble des codes de
 * `lib/dictionnaireCompetences.ts`, indexé par le MÊME code. Fichier séparé plutôt que fusionné dans
 * `DICTIONNAIRE_COMPETENCES` : ce dernier porte le libellé/description COURTS affichés sur chaque
 * carte de compétence (toujours résolus, y compris pour l'écran "Résultats" et le résumé de bugs),
 * ce fichier-ci porte un contenu plus long, consulté uniquement à la demande (clic sur "?") — deux
 * usages distincts, jamais mélangés dans le même appelant.
 *
 * **Contrat non négociable** (voir `calculerProfilCompetences`, `lib/profilCompetences.ts`) : un
 * code présent dans `DICTIONNAIRE_COMPETENCES` mais absent d'ici (cas normal, ce fichier n'a pas
 * vocation à couvrir 100% des codes dès sa création — voir la liste des codes non encore détectés
 * par aucun code réel, ci-dessous) ne doit jamais faire planter quoi que ce soit : la fonction
 * appelante utilise un simple accès optionnel (`EXPLICATIONS_COMPETENCES[code]`, `undefined` si
 * absent), jamais un accès qui suppose l'entrée présente.
 *
 * Contenu fourni tel quel par le prompt (37 entrées) — 20 correspondent à un code déjà réellement
 * détecté par le code serveur (déjà présent dans `DICTIONNAIRE_COMPETENCES`) ; les 17 autres
 * (`TRANSFORMATION_*`, `FONCTION_REFERENCE_*`, `FORME_CANONIQUE_SIGNE_P`,
 * `EXISTENCE_POINT_GRAPHIQUE`/`EXISTENCE_VALEUR_ALGEBRIQUE`, `ASYMPTOTE_PARTIELLE`,
 * `DOMAINE_EXCLUSION_OUBLIEE`, `ISOLEMENT_SIGNE_CONSTANTE`, `SEPARATION_PARTIELLE`,
 * `SIGNE_SIN_QUADRANT`/`SIGNE_COS_QUADRANT`/`SIGNE_TAN_QUADRANT`) anticipent des détecteurs pas
 * encore câblés dans ce dépôt (aucun de ces codes n'apparaît dans `DICTIONNAIRE_COMPETENCES` — grep
 * exhaustif effectué avant cet ajout) : conservées ici telles quelles, prêtes à servir le jour où
 * ces détecteurs existeront, sans qu'on ait besoin de revenir modifier ce fichier à ce moment-là.
 */

export interface ExplicationCompetence {
  explication: string;
  exemple: string;
}

export const EXPLICATIONS_COMPETENCES: Record<string, ExplicationCompetence> = {
  C04: {
    explication:
      "Quand on met un facteur négatif en évidence, il faut changer le signe de tous les termes restants entre parenthèses. L'élève oublie de changer le signe d'un ou plusieurs termes.",
    exemple:
      "Factoriser -2x² - 4x. La bonne réponse est -2x(x + 2). Une erreur typique donne -2x(x - 2) — le -2x est correctement mis en évidence, mais le signe du second terme n'a pas été inversé.",
  },
  C05_SIGNE_REPETE: {
    explication:
      "Pour factoriser a²-b² = (a-b)(a+b), il faut deux facteurs de signes opposés. L'élève répète le même signe dans les deux facteurs.",
    exemple:
      "x² - 9 = 0 se factorise (x-3)(x+3) = 0. Une erreur typique donne (x-3)(x-3) — bonne valeur, mauvais signe sur un des deux facteurs.",
  },
  C06_SIGNE_OPPOSE: {
    explication:
      "Pour factoriser un carré parfait a²+2ab+b² = (a+b)², les deux facteurs doivent avoir le même signe. L'élève utilise des signes opposés, confondant avec une différence de carrés.",
    exemple:
      "x² - 6x + 9 = 0 se factorise (x-3)² = 0. Une erreur typique donne (x-3)(x+3) — il applique le motif de la différence de carrés à un carré parfait.",
  },
  C07_ou_C08: {
    explication:
      "Deux erreurs différentes sur le calcul de Δ = b²-4ac produisent souvent la même valeur fausse — utiliser b²+4ac par erreur de formule, ou appliquer la bonne formule mais mal gérer le signe d'un c négatif dans l'énoncé. Les deux étant numériquement indissociables dans beaucoup de cas, elles sont regroupées sous un seul code.",
    exemple:
      "x²+2x-3=0 (a=1, b=2, c=-3). Δ correct = 4-4(1)(-3) = 16. Les deux erreurs possibles mènent souvent à confondre -4ac avec +4ac en présence d'un c négatif.",
  },
  FC_CE_FANTOME: {
    explication:
      "Pour une fraction rationnelle, il faut exclure toute valeur de x qui annule le dénominateur. L'élève en oublie une, ou en invente une qui n'existe pas.",
    exemple:
      "Pour 1/((x-2)(x+5)), les valeurs exclues sont x=2 et x=-5. Une erreur typique ne donne que x=2, oubliant x=-5.",
  },
  FC_PRODUIT_NUL_OUBLIE: {
    explication:
      "Dans une équation factorisée en produit nul (ex. x(x-3)=0), chaque facteur peut être la cause du zéro — y compris x seul, qui donne x=0. L'élève oublie cette solution parce qu'elle est « moins visible ».",
    exemple:
      "Résoudre x²-3x=0. Après mise en évidence, x(x-3)=0. Les 2 solutions sont x=0 et x=3. Une erreur typique ne donne que x=3.",
  },
  RECOPIE_NON_REDUITE: {
    explication:
      "Après avoir éliminé un facteur commun d'une fraction, il faut vérifier qu'elle ne peut plus être réduite. L'élève soumet une réponse mathématiquement équivalente à la bonne, mais pas entièrement simplifiée.",
    exemple:
      "Simplifier (2x+4)/(x+2). Après factorisation, (2(x+2))/(x+2) = 2. Une erreur typique soumet 2(x+2)/(x+2) — vrai, mais pas fini.",
  },
  CE_PARTIELLE: {
    explication: "Sur un exercice à 2 valeurs exclues, l'élève en trouve une correcte et rate l'autre.",
    exemple: "Un exercice exclut x≠1 et x≠-3. Une réponse partielle donne x≠1 mais oublie x≠-3 (ou l'inverse).",
  },
  RACINE_PARTIELLE: {
    explication:
      "Sur un exercice à plusieurs racines/zéros, l'élève en trouve une correcte et se trompe sur au moins une autre (mais pas toutes).",
    exemple: "Résoudre x²-5x+6=0 (racines 2 et 3). Une réponse partielle donne 2 et 4.",
  },
  FORME_ENSEMBLE_SOLUTION: {
    explication:
      "L'élève se trompe sur la forme qualitative de la solution (∅, ℝ, un point, tous les réels sauf un/plusieurs points, un ou plusieurs intervalles) — indépendamment des valeurs à l'intérieur de cette forme.",
    exemple:
      "La vraie solution est ]-∞;2[ ∪ ]5;+∞[ (« au moins un intervalle »). Une erreur typique choisit la forme « Un point ».",
  },
  GRILLE_SIGNE_FACTEUR: {
    explication:
      "Dans un tableau de signes, l'élève se trompe sur le signe d'un facteur (numérateur, dénominateur ou coefficient dominant) sur au moins un intervalle — avant même la ligne finale.",
    exemple: "Tableau de signes de (x-2)/(x+3). Une erreur typique donne un mauvais signe pour (x+3) sur l'intervalle ]-3;2[.",
  },
  GRILLE_SIGNE_QUOTIENT: {
    explication: "Toutes les lignes de facteurs sont correctes, mais la combinaison des signes en ligne finale (quotient ou produit) est fausse.",
    exemple: "L'élève identifie correctement le signe de chaque facteur sur un intervalle, mais oublie que (-)×(-) = (+) en combinant les deux.",
  },
  TYPE_RACINES: {
    explication:
      "L'élève confond « aucune racine réelle » et « deux racines réelles » — une erreur sur le signe du discriminant, indépendante du calcul des valeurs elles-mêmes.",
    exemple: "Δ<0 pour un trinôme donné, donc la bonne réponse est « aucune racine ». Une erreur typique répond « deux racines ».",
  },
  FRACTION_NON_REDUITE: {
    explication:
      "Comme RECOPIE_NON_REDUITE, mais dans un contexte où il n'existe pas de racine commune à évaluer — la réduction incomplète se détecte via un facteur commun aux coefficients, pas via une racine.",
    exemple:
      "Simplifier une fraction où numérateur et dénominateur partagent un facteur 2 dans leurs coefficients. Une réponse équivalente mais non réduite garde ce facteur 2 des deux côtés.",
  },
  RACINE_ETRANGERE_IGNOREE: {
    explication:
      "Une solution trouvée algébriquement doit être rejetée si elle viole une condition d'existence (annule un dénominateur, sort d'un domaine). L'élève confond une racine valide et une racine à rejeter.",
    exemple:
      "Résoudre une équation avec x au dénominateur ; deux solutions candidates apparaissent, x=2 et x=-1, mais x=-1 annule un dénominateur. Une erreur typique garde les deux comme valides.",
  },
  ALLURE_PARTIELLE: {
    explication:
      "Sur la lecture de l'allure d'une parabole, l'élève reconnaît correctement le sens de la parabole (signe de a) OU la position de l'axe par rapport à l'axe des y (signe de ab), mais pas les deux.",
    exemple: "Pour f(x)=-2x²+4x-1, l'élève identifie correctement que la parabole s'ouvre vers le bas, mais se trompe sur la position de l'axe de symétrie.",
  },
  AXE_SYMETRIE_NOTATION: {
    explication: "L'élève trouve la bonne valeur numérique de l'axe de symétrie, mais ne l'écrit pas sous forme d'équation x = ....",
    exemple: "xS=3. L'élève écrit 3 au lieu de x=3.",
  },
  SIGNE_VARIATION_PARTIEL: {
    explication:
      "La ligne de signe d'une expression est correcte, mais sa traduction en flèches de variation (croissante/décroissante) est fausse — ou l'inverse.",
    exemple: "Le signe d'une expression est correctement identifié +, -, + sur 3 intervalles, mais les flèches de variation données ne correspondent pas à cette alternance.",
  },
  RACINE_NON_SIMPLIFIEE: {
    explication:
      "La valeur donnée est mathématiquement juste, mais la racine carrée n'est pas simplifiée : le radicande contient encore un carré parfait. La réponse est comptée fausse tant que la forme n'est pas finalisée.",
    exemple: "Les racines de x² − 8 = 0 sont ±2√2. L'élève écrit sqrt(8) : la valeur est exacte, mais √8 se simplifie en 2√2.",
  },
  RACINES_NOMBRE_INCORRECT: {
    explication:
      "L'élève se trompe sur le NOMBRE de racines de la fonction étudiée (aucune, une ou deux), et pas seulement sur leurs valeurs : c'est le signe du discriminant (ou la forme de la fonction) qui n'est pas bien lu. Le nombre attendu est celui que donnent les coefficients confirmés par l'élève, même faux.",
    exemple: "Pour f(x) = x² − 4x + 1, Δ = 12 > 0 : deux racines. L'élève répond « aucune racine ».",
  },
  TABLEAU_SIGNE_PARTIEL: {
    explication: "Dans le tableau, la ligne de signe de f(x) est en partie juste : certaines cases sont correctes, d'autres non (et la ligne n'est pas simplement inversée).",
    exemple: "Pour f(x) = x² − 4 (racines −2 et 2), le signe attendu est + 0 − 0 +. L'élève met + 0 + 0 + : le signe entre les racines est faux, le reste est juste.",
  },
  TABLEAU_VARIATION_PARTIEL: {
    explication: "Dans le tableau, la ligne des variations de f est en partie juste : certaines cases sont correctes, d'autres non (et la ligne n'est pas simplement inversée).",
    exemple: "Pour f(x) = x² − 4, attendu : ↘ ⌣ ↗. L'élève met ↘ ⌣ ↘ : la décroissance avant le sommet est juste, la croissance après est fausse.",
  },
  TABLEAU_SIGNE_INVERSE: {
    explication:
      "La ligne de signe de f(x) est exactement l'inverse de la bonne : chaque + est à la place d'un − et inversement (les 0 aux racines sont justes). Cela traduit souvent une confusion sur le signe de a, ou sur la règle « signe de a à l'extérieur des racines, signe contraire entre elles ».",
    exemple: "Pour f(x) = x² − 4, attendu : + 0 − 0 +. L'élève met − 0 + 0 − : toute la ligne est inversée.",
  },
  TABLEAU_CONCAVITE_INCORRECTE: {
    explication:
      "La ligne des variations est exactement l'inverse de la bonne : les flèches ↗ ↘ sont échangées et le sommet est pris pour un maximum au lieu d'un minimum (ou inversement). L'élève confond le sens de la parabole (signe de a).",
    exemple: "Pour f(x) = x² − 4 (a > 0, minimum au sommet), attendu : ↘ ⌣ ↗. L'élève met ↗ ⌢ ↘.",
  },
  TRANSFORMATION_HORIZONTALE: {
    explication: "Mauvaise lecture du décalage horizontal d'une parabole ou d'une fonction de référence transformée.",
    exemple: "Une parabole décalée de 3 vers la droite (sommet en x=3) ; l'élève lit un décalage de 3 vers la gauche, ou une autre valeur.",
  },
  TRANSFORMATION_VERTICALE: {
    explication: "Mauvaise lecture du décalage vertical.",
    exemple: "Une courbe décalée de 2 vers le haut ; l'élève lit un décalage vers le bas, ou une autre valeur.",
  },
  TRANSFORMATION_ECHELLE_VERTICALE: {
    explication: "Mauvaise lecture du facteur d'étirement/compression vertical (le coefficient multiplicatif devant la fonction).",
    exemple: "Une parabole 2 fois plus « resserrée » que la référence ; l'élève lit un facteur différent de 2.",
  },
  TRANSFORMATION_ORIENTATION: {
    explication: "Mauvaise lecture du sens d'ouverture (vers le haut/bas, ou le signe global de la transformation).",
    exemple: "Une parabole qui s'ouvre vers le bas ; l'élève indique qu'elle s'ouvre vers le haut.",
  },
  TRANSFORMATION_ECHELLE_HORIZONTALE: {
    explication: "Mauvaise lecture de l'étirement/compression horizontal — une compétence distincte de l'échelle verticale.",
    exemple: "Une courbe compressée horizontalement d'un facteur 2 ; l'élève lit une compression verticale, ou un facteur horizontal différent.",
  },
  FONCTION_REFERENCE_SYMETRIE_INTERNE: {
    explication: "Sur une fonction impaire (cube, racine cubique, inverse), confond la symétrie appliquée avant la fonction de référence avec l'orientation finale de la courbe.",
    exemple: "Pour une fonction cube transformée, l'élève inverse la symétrie interne au lieu de l'orientation finale de la courbe.",
  },
  FONCTION_REFERENCE_DIRECTION_DOMAINE: {
    explication: "Pour une fonction à domaine restreint (racine carrée), confond de quel côté du point pivot la fonction est définie.",
    exemple: "Une racine carrée définie pour x≥2 ; l'élève pense qu'elle est définie pour x≤2.",
  },
  // PROMPT-taxonomie-gen10.md : entrée réelle pour le code déjà anticipé sous le nom
  // `FONCTION_REFERENCE_SYMETRIE_INTERNE` ci-dessus (même concept — symétrie/orientation sur une
  // fonction impaire — jamais utilisé par aucun détecteur réel), mais le prompt qui câble ce
  // détecteur nomme définitivement le code `FONCTION_REFERENCE_ORIENTATION_IMPAIRE` : entrée
  // ajoutée sous CE nom exact (jamais un renommage rétroactif de l'ancienne entrée anticipée, qui
  // reste inerte comme les autres codes non encore détectés listés en tête de fichier).
  FONCTION_REFERENCE_ORIENTATION_IMPAIRE: {
    explication:
      "Sur une fonction impaire (cube, racine cubique, inverse), seule la combinaison relative du signe global (SOX) et du sens de symétrie (SOY) est observable — l'élève confond les deux et en inverse un seul au lieu des deux ensemble (ou l'inverse), pensant à tort que cela change la courbe.",
    exemple: "Une fonction cube dont SOX et SOY sont tous deux vrais (leur effet se compense). L'élève inverse SOX seul, pensant corriger l'orientation, alors que cela change réellement la courbe.",
  },
  FORME_CANONIQUE_SIGNE_P: {
    explication: "Écrit (x-p) littéralement au lieu de substituer correctement le signe quand p (le déplacement horizontal) est négatif — confond soustraction et double négation.",
    exemple: "xS=-3. La forme canonique correcte contient (x+3). Une erreur typique écrit (x-3).",
  },
  EXISTENCE_POINT_GRAPHIQUE: {
    explication: "Confond l'appartenance d'un point au domaine (lu sur un graphique) avec le calcul de sa valeur.",
    exemple: "La fonction n'est pas définie en x=2 (trou ou asymptote visible sur le graphique). L'élève affirme qu'elle y est définie et propose une valeur.",
  },
  ASYMPTOTE_PARTIELLE: {
    explication: "Une des deux équations d'asymptote (verticale ou horizontale) est correcte, l'autre fausse.",
    exemple: "Asymptotes x=2 et y=-1. L'élève trouve x=2 mais se trompe sur l'asymptote horizontale.",
  },
  DOMAINE_EXCLUSION_OUBLIEE: {
    explication: "Le domaine (ou un intervalle de croissance/décroissance/constance) donné est presque correct, mais une exclusion ou un morceau a été oublié ou ajouté en trop.",
    exemple: "Le domaine réel exclut 2 points isolés ; l'élève n'en exclut qu'un seul.",
  },
  EXISTENCE_VALEUR_ALGEBRIQUE: {
    explication: "La même confusion qu'EXISTENCE_POINT_GRAPHIQUE, mais en contexte purement symbolique — pas de graphique, juste un calcul algébrique de domaine.",
    exemple: "Une fonction n'est pas définie en x=2 (dénominateur nul) ; l'élève affirme qu'elle l'est et propose une valeur, sans support graphique.",
  },
  ISOLEMENT_SIGNE_CONSTANTE: {
    explication: "L'expression de base est correctement isolée, mais le signe de la constante déplacée de l'autre côté de l'égalité est inversé.",
    exemple: "Isoler (2x+3)² = 25/16. Une erreur typique donne (2x+3)² = -25/16 — la partie gauche est juste, seul le signe de la constante à droite est faux.",
  },
  SEPARATION_PARTIELLE: {
    explication: "Quand une équation (valeur absolue, carré) se sépare en deux équations à résoudre séparément, l'élève résout correctement l'une des deux et se trompe sur l'autre.",
    exemple: "|2x-1|=5 se sépare en 2x-1=5 et 2x-1=-5. Une erreur typique résout correctement la première mais se trompe sur la seconde.",
  },
  FC_RACINE_OPPOSEE_OUBLIEE: {
    explication:
      "Sur une différence de carrés du type (x-r)(x+r)=0, les deux racines sont toujours opposées. L'élève trouve la bonne valeur numérique, mais répète la même racine deux fois au lieu de donner sa version opposée.",
    exemple: "2x²-18=0, soit 2(x-3)(x+3)=0, racines -3 et 3. Une erreur typique répond 3 et 3.",
  },
  FC_RACINE_FANTOME: {
    explication:
      "La paire de racines soumise correspond exactement à ce qu'on obtiendrait avec une erreur de signe précise et reproductible : soit Δ=b²+4ac au lieu de b²-4ac, soit les deux vraies racines avec un signe global inversé.",
    exemple: "x²+5x+6=0, racines réelles -2 et -3. Une erreur de formule donnerait 1 et -6. Une erreur de signe global donnerait 2 et 3.",
  },
  SIGNE_SIN_QUADRANT: {
    explication: "Erreur sur le signe du sinus dans un quadrant donné du cercle trigonométrique.",
    exemple: "Dans le 3e quadrant, sinus et cosinus sont tous deux négatifs. Une erreur typique donne un sinus positif.",
  },
  SIGNE_COS_QUADRANT: {
    explication: "Erreur sur le signe du cosinus dans un quadrant donné du cercle trigonométrique.",
    exemple: "Dans le 2e quadrant, le cosinus est négatif. Une erreur typique le donne positif.",
  },
  SIGNE_TAN_QUADRANT: {
    explication: "Erreur sur le signe de la tangente dans un quadrant donné du cercle trigonométrique.",
    exemple: "Dans le 4e quadrant, sinus négatif et cosinus positif donnent une tangente négative. Une erreur typique la donne positive.",
  },
};
