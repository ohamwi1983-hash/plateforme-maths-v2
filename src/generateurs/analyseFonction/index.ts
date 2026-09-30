/**
 * gen7 « Analyse d'une fonction du second degré » (phase 3b) : modules purs de vérification des huit écrans.
 * `./racines` (3b-2) porte `racinesChamp1`/`racinesChamp2` ; ce dossier porte les six autres (3b-3).
 */
export * from "./types";
export * from "./formatage";
export { SOUS_CHAMPS_COEFFICIENTS, verifierCoefficients } from "./coefficients";
export { SOUS_CHAMPS_ALLURE, signeDe, verifierAllure } from "./allure";
export { SOUS_CHAMPS_AXE_SOMMET, verifierAxeSommet } from "./axeSommet";
export { verifierDomaineImage } from "./domaineImage";
export { CHOIX_RECONNAISSANCE, verifierReconnaissance } from "./reconnaissance";
export { colonnesTableau, ecranTableauSignes, LIGNES_TABLEAU, rangeesTableau, solutionTableau, verifierTableauSignes, type AffichageColonnes } from "./tableauSignes";
export { genererExercice, construireIrreductible, type DonneesZeros, type ExerciceAnalyseFonction } from "./exercice";
export { factorisationVersLatex, noeudVersLatex, projeterAnalyseFonction, racinesDeFactorisation } from "./cascade";
export { aideFormuleColoree, champsAnalyseFonction, ecransAnalyseFonction } from "./ecrans";
export { verifierAnalyseFonction } from "./verification";
export { reponseBruteCorrecteAnalyseFonction, solutionAttendueAnalyseFonction } from "./solutions";
