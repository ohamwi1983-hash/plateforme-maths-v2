/**
 * Tâche "Résultats élève — tutoiement + ton familier" (retour utilisateur explicite : "emploie le
 * tutoiement et un ton plus familier. Tu parles à un jeune élève") — équivalent en tutoiement de
 * `lib/explicationsCompetences.ts::EXPLICATIONS_COMPETENCES` (contenu PROF, troisième personne,
 * "L'élève..."), pour l'onglet "Résultats" de `public/eleve.html` uniquement.
 *
 * Fichier séparé plutôt qu'une réécriture de `EXPLICATIONS_COMPETENCES` : ce dernier reste utilisé
 * tel quel par le drill-down prof (`public/prof.html::construireExplicationCompetence`), qui
 * s'adresse à un adulte lisant à propos d'un élève ("L'élève oublie...") — un ton totalement
 * différent, jamais interchangeable avec celui-ci. MÊMES CLÉS que `EXPLICATIONS_COMPETENCES`
 * (vérifié par `scripts/test-mes-resultats.ts`) : un code qui gagne un jour une entrée là-bas doit
 * en gagner une ici aussi, sinon la carte "Compétences à travailler" de l'élève affiche un texte
 * vide pour ce code alors que le prof, lui, voit une explication.
 */
export const EXPLICATIONS_COMPETENCES_ELEVE: Record<string, string> = {
  C04: "Quand tu mets un facteur négatif en évidence, n'oublie pas de changer le signe de TOUS les termes qui restent entre parenthèses.",
  C05_SIGNE_REPETE: "Pour factoriser a²-b², il te faut deux facteurs de signes opposés (un + et un -) — pas deux fois le même signe.",
  C06_SIGNE_OPPOSE: "Pour un carré parfait a²+2ab+b², les deux facteurs doivent avoir le MÊME signe — ne confonds pas avec une différence de carrés.",
  C07_ou_C08: "Attention au calcul de Δ = b²-4ac : vérifie que tu utilises bien un MOINS devant 4ac, surtout si c est négatif dans l'énoncé.",
  FC_CE_FANTOME: "N'oublie aucune valeur qui annule le dénominateur — et n'en invente pas une qui n'existe pas !",
  FC_PRODUIT_NUL_OUBLIE: "Dans une équation du type x(x-3)=0, le facteur x tout seul donne aussi une solution (x=0) — ne l'oublie pas juste parce qu'elle est moins visible.",
  RECOPIE_NON_REDUITE: "Ta réponse est juste, mais tu peux encore la simplifier ! Vérifie toujours si ta fraction peut être réduite davantage.",
  CE_PARTIELLE: "Tu as trouvé une des valeurs exclues, bien joué — mais il t'en manque au moins une.",
  RACINE_PARTIELLE: "Tu as trouvé une des racines, bravo — continue à chercher, il t'en manque au moins une.",
  FORME_ENSEMBLE_SOLUTION: "Vérifie bien la FORME de ta solution (rien, tout, un point, un intervalle...) avant de te soucier des valeurs à l'intérieur.",
  GRILLE_SIGNE_FACTEUR: "Dans ton tableau de signes, relis bien le signe de chaque facteur sur chaque intervalle — il y a une erreur avant même la ligne finale.",
  GRILLE_SIGNE_QUOTIENT: "Tes lignes de facteurs sont bonnes ! C'est la combinaison finale (le signe du produit/quotient) qui cloche — rappelle-toi que (-)×(-) = (+).",
  TYPE_RACINES: "Regarde bien le signe du discriminant : c'est lui qui te dit s'il y a 0 ou 2 racines réelles, ne confonds pas les deux cas.",
  FRACTION_NON_REDUITE: "Ta réponse est équivalente à la bonne, mais elle n'est pas encore complètement réduite — cherche un facteur commun aux coefficients.",
  RACINE_ETRANGERE_IGNOREE: "Une solution trouvée par le calcul doit parfois être rejetée si elle annule un dénominateur ou sort du domaine — pense à toujours vérifier tes solutions.",
  ALLURE_PARTIELLE: "Tu as bien vu un des deux points (le sens de la parabole OU la position de l'axe), mais pas les deux — regarde-les séparément.",
  AXE_SYMETRIE_NOTATION: "Ta valeur est bonne, mais n'oublie pas de l'écrire sous forme d'équation, comme x = ...",
  SIGNE_VARIATION_PARTIEL: "Ton signe est correct, mais sa traduction en flèches de variation (croissante/décroissante) ne suit pas — relis bien le lien entre les deux.",
  RACINE_NON_SIMPLIFIEE: "Ta valeur est juste, mais ta racine carrée peut encore être simplifiée — cherche un carré parfait sous la racine (par exemple √8 = 2√2).",
  RACINES_NOMBRE_INCORRECT: "Regarde le signe du discriminant : c'est lui qui te dit si la fonction a 0, 1 ou 2 racines — vérifie ce nombre avant de chercher leurs valeurs.",
  TABLEAU_SIGNE_PARTIEL: "Une partie de ta ligne de signe est juste, une partie non — reprends les cases une à une, intervalle par intervalle.",
  TABLEAU_VARIATION_PARTIEL: "Une partie de ta ligne de variations est juste, une partie non — reprends les flèches une à une en pensant au sommet.",
  TABLEAU_SIGNE_INVERSE: "Ta ligne de signe est l'inverse de la bonne : relis le signe de a et la règle « signe de a à l'extérieur des racines, signe contraire entre elles ».",
  TABLEAU_CONCAVITE_INCORRECTE: "Tes flèches sont à l'envers : relis le signe de a pour savoir si la parabole a un minimum ou un maximum, puis redessine les variations.",
  TRANSFORMATION_HORIZONTALE: "Relis bien le décalage horizontal de la courbe (vers la gauche ou la droite).",
  TRANSFORMATION_VERTICALE: "Relis bien le décalage vertical de la courbe (vers le haut ou le bas).",
  TRANSFORMATION_ECHELLE_VERTICALE: "Vérifie le facteur d'étirement ou de compression VERTICAL de la courbe.",
  TRANSFORMATION_ORIENTATION: "Vérifie bien le sens d'ouverture de la courbe (vers le haut ou vers le bas).",
  TRANSFORMATION_ECHELLE_HORIZONTALE: "Vérifie le facteur d'étirement ou de compression HORIZONTAL — ce n'est pas la même chose que le vertical.",
  FONCTION_REFERENCE_SYMETRIE_INTERNE: "Ne confonds pas la symétrie interne à la fonction avec l'orientation finale de la courbe.",
  FONCTION_REFERENCE_DIRECTION_DOMAINE: "Repère bien de quel côté du point pivot la fonction est définie.",
  FONCTION_REFERENCE_ORIENTATION_IMPAIRE: "Sur une fonction impaire, si tu n'inverses qu'un seul des deux réglages de symétrie, tu changes vraiment la courbe — pense à vérifier les deux ensemble.",
  FORME_CANONIQUE_SIGNE_P: "Quand le déplacement horizontal p est négatif, fais bien attention au signe dans (x-p) — un double négatif se transforme en +.",
  EXISTENCE_POINT_GRAPHIQUE: "Regarde bien si le point existe vraiment sur le graphique avant de calculer sa valeur.",
  ASYMPTOTE_PARTIELLE: "Une de tes deux asymptotes est correcte — relis l'autre.",
  DOMAINE_EXCLUSION_OUBLIEE: "Ton domaine est presque bon, mais il manque (ou il y a en trop) une exclusion — recompte bien.",
  EXISTENCE_VALEUR_ALGEBRIQUE: "Vérifie si la fonction est vraiment définie à cet endroit avant de calculer une valeur.",
  ISOLEMENT_SIGNE_CONSTANTE: "Ton isolement est presque bon — vérifie juste le signe de la constante que tu déplaces de l'autre côté de l'égalité.",
  SEPARATION_PARTIELLE: "Tu as bien résolu une des deux équations séparées — relis l'autre.",
  FC_RACINE_OPPOSEE_OUBLIEE: "Les deux racines d'une différence de carrés sont toujours opposées — tu as trouvé la bonne valeur, donne aussi sa version opposée.",
  FC_RACINE_FANTOME: "Attention aux erreurs de signe dans le calcul des racines — revérifie ta formule et le signe de chaque terme.",
  SIGNE_SIN_QUADRANT: "Revois le signe du sinus selon le quadrant du cercle trigonométrique.",
  SIGNE_COS_QUADRANT: "Revois le signe du cosinus selon le quadrant du cercle trigonométrique.",
  SIGNE_TAN_QUADRANT: "Revois le signe de la tangente selon le quadrant du cercle trigonométrique.",
  SIGNE_P_INVERSE: "Tes nombres sont bons, mais le décalage horizontal est de l'autre côté : si le sommet est en x = 3, la parenthèse est (x − 3), pas (x + 3).",
  Q_INCORRECT: "Ton coefficient et ton décalage horizontal sont bons — relis seulement la hauteur du sommet (la constante à la fin).",
  A_INCORRECT: "Ton sommet est bon, mais pas le coefficient devant la parenthèse : utilise un second point de la courbe pour le retrouver.",
  P_MAGNITUDE_INCORRECTE: "Ton coefficient et la hauteur du sommet sont bons — relis la position horizontale du sommet sur l'axe.",
};
