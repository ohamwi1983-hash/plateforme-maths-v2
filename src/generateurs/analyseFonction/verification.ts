import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { verifierAllure } from "./allure";
import { verifierAxeSommet } from "./axeSommet";
import { verifierCoefficients } from "./coefficients";
import { verifierDomaineImage } from "./domaineImage";
import type { ExerciceAnalyseFonction } from "./exercice";
import { verifierRacinesChamp1, verifierRacinesChamp2 } from "./racines";
import { CHAMP_RACINES_FACTORISATION, CHAMP_RACINES_ZEROS, type DonneesRacines } from "./racines/types";
import { verifierReconnaissance } from "./reconnaissance";
import { verifierTableauSignes } from "./tableauSignes";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE, CHAMP_RECONNAISSANCE, CHAMP_TABLEAU_SIGNES } from "./types";

/** `DonneesRacines` d'un exercice à racines. `racinesChamp1` vérifie la VRAIE fonction ; `racinesChamp2` les racines EFFECTIVES (cascade). */
function donneesRacines(ex: ExerciceAnalyseFonction, champ: string): DonneesRacines {
  const f = ex.fonction;
  if (f.racines === null || f.categorie === "irreductible" || ex.formeFactorisee === null || ex.zeros === null) {
    throw new Error(`gen7 : le champ « ${champ} » n'existe pas pour af_irreductible (aucun écran de racines)`);
  }
  return { categorie: f.categorie, a: f.a, b: f.b, c: f.c, racines: champ === CHAMP_RACINES_ZEROS ? ex.zeros.racines : f.racines, formeFactorisee: ex.formeFactorisee };
}

export function verifierAnalyseFonction(ex: ExerciceAnalyseFonction, champ: string, reponseBrute: string): ResultatVerification {
  const f = ex.fonction;
  switch (champ) {
    case CHAMP_COEFFICIENTS:
      return verifierCoefficients(f, reponseBrute);
    case CHAMP_ALLURE:
      return verifierAllure(f, reponseBrute);
    case CHAMP_AXE_SOMMET:
      return verifierAxeSommet(f, reponseBrute);
    case CHAMP_DOMAINE_IMAGE:
      return verifierDomaineImage(f, reponseBrute);
    case CHAMP_RECONNAISSANCE:
      return verifierReconnaissance(f, reponseBrute);
    case CHAMP_RACINES_FACTORISATION:
      return verifierRacinesChamp1(donneesRacines(ex, champ), reponseBrute);
    case CHAMP_RACINES_ZEROS:
      return verifierRacinesChamp2(donneesRacines(ex, champ), reponseBrute);
    case CHAMP_TABLEAU_SIGNES:
      return verifierTableauSignes(f, reponseBrute);
    default:
      throw new Error(`gen7 : champ inconnu « ${champ} »`);
  }
}
