import { lirePropre } from "./tablePropre";
/**
 * Prompt "Catégorisation des compétences + regroupement du profil élève (Option B)" — table de
 * correspondance code de compétence -> catégorie/sous-catégorie, reprise TELLE QUELLE du prompt
 * (Section 1). Utilisée uniquement pour enrichir `CompetenceProfil` (`lib/profilCompetences.ts`) et
 * regrouper l'affichage du profil élève (espace professeur, `public/prof.html`) — jamais dupliquée
 * dans `prof.html` elle-même : le client reçoit `categorie`/`sousCategorie` par compétence et
 * `ordreCategories` (ci-dessous) directement dans la réponse de
 * `GET /api/profs/eleves/:id/profil`, même principe déjà établi pour `explication`/`exemple`
 * (`lib/explicationsCompetences.ts` — "un seul appelant HTTP suffit, jamais de 2e dictionnaire à
 * dupliquer dans public/prof.html").
 *
 * **Vérification de couverture (grep exhaustif de `lib/dictionnaireCompetences.ts`, 38 codes réels à
 * cette date — voir RAPPORT.md pour le détail)** : 5 codes réellement présents dans le dictionnaire
 * n'ont PAS d'entrée ci-dessous (introduits par des prompts postérieurs à la rédaction de celui-ci) —
 * `C04`, `FC_PRODUIT_NUL_OUBLIE`, `GRILLE_SIGNE_QUOTIENT`, `FONCTION_REFERENCE_ORIENTATION_IMPAIRE`,
 * `DOMAINE_EXCLUSION_OUBLIEE`. Conformément à la consigne explicite du prompt ("le signaler dans
 * RAPPORT.md plutôt que de deviner sa catégorie"), aucune catégorie n'a été devinée pour eux : ils
 * tombent sur `CATEGORIE_PAR_DEFAUT` ("Non classé") comme n'importe quel code inconnu, via le
 * garde-fou `categoriserCompetence` ci-dessous.
 */

export interface CategorieCompetence {
  categorie: string;
  sousCategorie?: string;
}

export const CATEGORIES_COMPETENCES: Record<string, CategorieCompetence> = {
  // 1. Réponse partielle
  COORDONNEE_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  CE_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  ALLURE_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  ASYMPTOTE_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  SEPARATION_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  SEUIL_VALEUR_PARTIEL: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  VARIANCE_ECART_TYPE_PARTIEL: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  INTERVALLE_BORNE_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },
  CLASSE_MODALE_MODE_PARTIEL: { categorie: "Réponse partielle", sousCategorie: "Paire de valeurs" },

  RACINE_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Liste de taille variable" },
  MODE_INCORRECT: { categorie: "Réponse partielle", sousCategorie: "Liste de taille variable" },
  LONGUEUR_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Liste de taille variable" },
  COMBINAISON_VECTEURS_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Liste de taille variable" },
  SELECTION_VECTEURS_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Liste de taille variable" },
  BOITE_MOUSTACHES_PARTIEL: { categorie: "Réponse partielle", sousCategorie: "Liste de taille variable" },

  GRILLE_SIGNE_FACTEUR: { categorie: "Réponse partielle", sousCategorie: "Tableau à lignes fixes" },
  CLASSEMENT_PARTIEL: { categorie: "Réponse partielle", sousCategorie: "Tableau à lignes fixes" },
  PRODUIT_PARTIEL: { categorie: "Réponse partielle", sousCategorie: "Tableau à lignes fixes" },
  PRODUIT_DISPERSION_PARTIEL: { categorie: "Réponse partielle", sousCategorie: "Tableau à lignes fixes" },
  IDENTIFICATION_LIGNE_PARTIELLE: { categorie: "Réponse partielle", sousCategorie: "Tableau à lignes fixes" },

  // 2. Confusion de signe/sens
  C05_SIGNE_REPETE: { categorie: "Confusion de signe/sens" },
  C06_SIGNE_OPPOSE: { categorie: "Confusion de signe/sens" },
  FORME_CANONIQUE_SIGNE_P: { categorie: "Confusion de signe/sens" },
  ISOLEMENT_SIGNE_CONSTANTE: { categorie: "Confusion de signe/sens" },
  CONSTRUCTION_VECTEUR_SENS_INVERSE: { categorie: "Confusion de signe/sens" },
  RELATION_VECTORIELLE_SIGNE: { categorie: "Confusion de signe/sens" },
  REDUCTION_SENS_INVERSE: { categorie: "Confusion de signe/sens" },
  FC_RACINE_OPPOSEE_OUBLIEE: { categorie: "Confusion de signe/sens" },

  // 3. Existence/validité non reconnue
  TYPE_RACINES: { categorie: "Existence/validité non reconnue" },
  RACINE_ETRANGERE_IGNOREE: { categorie: "Existence/validité non reconnue" },
  EXISTENCE_POINT_GRAPHIQUE: { categorie: "Existence/validité non reconnue" },
  EXISTENCE_VALEUR_ALGEBRIQUE: { categorie: "Existence/validité non reconnue" },
  FC_CE_FANTOME: { categorie: "Existence/validité non reconnue" },

  // 4. Réponse non finalisée
  RECOPIE_NON_REDUITE: { categorie: "Réponse non finalisée" },
  FRACTION_NON_REDUITE: { categorie: "Réponse non finalisée" },
  RACINE_NON_SIMPLIFIEE: { categorie: "Réponse non finalisée" },
  DENOMINATEUR_NON_RATIONALISE: { categorie: "Réponse non finalisée" },
  ECART_TYPE_NON_ARRONDI: { categorie: "Réponse non finalisée" },

  // 5. Formule fantôme
  C07_ou_C08: { categorie: "Formule fantôme" },
  FC_RACINE_FANTOME: { categorie: "Formule fantôme" },
  FREQUENCE_OUBLI_MULTIPLICATION: { categorie: "Formule fantôme" },
  FREQUENCE_MAUVAIS_DENOMINATEUR: { categorie: "Formule fantôme" },
  CONSTRUCTION_VECTEUR_NON_MULTIPLIE: { categorie: "Formule fantôme" },

  // 6. Confusion catégorielle entre deux notions/représentations voisines
  FORME_ENSEMBLE_SOLUTION: { categorie: "Confusion catégorielle" },
  COLINEARITE_CONCLUSION_INCORRECTE: { categorie: "Confusion catégorielle" },
  ORTHOGONALITE_CONCLUSION_INCORRECTE: { categorie: "Confusion catégorielle" },
  COMPARAISON_DISPERSION_ETENDUE: { categorie: "Confusion catégorielle" },
  UNITE_INCORRECTE: { categorie: "Confusion catégorielle" },
  AXE_SYMETRIE_NOTATION: { categorie: "Confusion catégorielle" },
  SIGNE_VARIATION_PARTIEL: { categorie: "Confusion catégorielle" },

  // 7. Combinaison/accumulation incorrecte
  SOMME_EFFECTIFS_INCORRECTE: { categorie: "Combinaison/accumulation incorrecte" },
  SOMME_PRODUITS_INCORRECTE: { categorie: "Combinaison/accumulation incorrecte" },
  SOMME_DISPERSION_INCORRECTE: { categorie: "Combinaison/accumulation incorrecte" },
  CUMUL_NON_ACCUMULE: { categorie: "Combinaison/accumulation incorrecte" },
  ETENDUE_SANS_MINMAX: { categorie: "Combinaison/accumulation incorrecte" },

  // 8. Mauvais élément de référence choisi
  RELATION_VECTORIELLE_POINTS: { categorie: "Mauvais élément de référence" },
  EGALITE_MAUVAIS_VECTEUR: { categorie: "Mauvais élément de référence" },
  ORTHOGONALITE_SOMMET_INCORRECT: { categorie: "Mauvais élément de référence" },

  // 9. Nombre d'éléments incorrect
  QUEL_ANGLE_NOMBRE_SOLUTIONS: { categorie: "Nombre d'éléments incorrect", sousCategorie: "Compte" },
  PARAMETRE_NOMBRE_SOLUTIONS: { categorie: "Nombre d'éléments incorrect", sousCategorie: "Compte" },
  IDENTIFICATION_NOMBRE_LIGNES: { categorie: "Nombre d'éléments incorrect", sousCategorie: "Compte" },
  DISPERSION_ARGUMENTS_NOMBRE: { categorie: "Nombre d'éléments incorrect", sousCategorie: "Compte" },
  DISPERSION_ARGUMENT_DUPLIQUE: { categorie: "Nombre d'éléments incorrect", sousCategorie: "Distinction" },

  // 10. Lecture graphique/visuelle
  TRANSFORMATION_HORIZONTALE: { categorie: "Lecture graphique/visuelle" },
  TRANSFORMATION_VERTICALE: { categorie: "Lecture graphique/visuelle" },
  TRANSFORMATION_ECHELLE_VERTICALE: { categorie: "Lecture graphique/visuelle" },
  TRANSFORMATION_ECHELLE_HORIZONTALE: { categorie: "Lecture graphique/visuelle" },
  TRANSFORMATION_ORIENTATION: { categorie: "Lecture graphique/visuelle" },
  FONCTION_REFERENCE_SYMETRIE_INTERNE: { categorie: "Lecture graphique/visuelle" },
  FONCTION_REFERENCE_DIRECTION_DOMAINE: { categorie: "Lecture graphique/visuelle" },
  SIGNE_SIN_QUADRANT: { categorie: "Lecture graphique/visuelle" },
  SIGNE_COS_QUADRANT: { categorie: "Lecture graphique/visuelle" },
  SIGNE_TAN_QUADRANT: { categorie: "Lecture graphique/visuelle" },
  VALEUR_SIN_REMARQUABLE: { categorie: "Lecture graphique/visuelle" },
  VALEUR_COS_REMARQUABLE: { categorie: "Lecture graphique/visuelle" },
  VALEUR_TAN_REMARQUABLE: { categorie: "Lecture graphique/visuelle" },

  // 11. Organisation/ordre non respecté
  TABLEAU_FREQUENCES_ORDRE: { categorie: "Organisation/ordre non respecté" },
};

export const CATEGORIE_PAR_DEFAUT: CategorieCompetence = { categorie: "Non classé" };

export function categoriserCompetence(code: string): CategorieCompetence {
  return lirePropre(CATEGORIES_COMPETENCES, code) ?? CATEGORIE_PAR_DEFAUT; // jamais la chaîne de prototypes (RAPPORT.md §20)
}

/**
 * Ordre canonique des catégories de premier niveau, calculé (jamais retranscrit à la main, pour ne
 * jamais dériver de `CATEGORIES_COMPETENCES` ci-dessus) à partir de leur PREMIÈRE apparition dans la
 * table — "l'ordre où les catégories apparaissent dans CATEGORIES_COMPETENCES" (Étape 2b, option
 * retenue plutôt que le tri par nombre décroissant de cartes : un professeur qui consulte plusieurs
 * profils d'élèves voit les catégories toujours dans le même ordre, indépendamment du nombre de
 * cartes de chacune pour tel ou tel élève — plus facile à balayer d'un profil à l'autre).
 * `CATEGORIE_PAR_DEFAUT.categorie` ("Non classé") est toujours ajoutée en dernier, garantissant le
 * garde-fou de l'Étape 2d ("toujours affiché en dernier") même si elle n'apparaît dans aucune
 * réponse d'élève.
 */
export const ORDRE_CATEGORIES: string[] = (() => {
  const ordre: string[] = [];
  for (const { categorie } of Object.values(CATEGORIES_COMPETENCES)) {
    if (!ordre.includes(categorie)) ordre.push(categorie);
  }
  ordre.push(CATEGORIE_PAR_DEFAUT.categorie);
  return ordre;
})();
