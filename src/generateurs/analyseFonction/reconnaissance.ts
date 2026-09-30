import type { ResultatVerification } from "../../../lib/contratGenerateur";
import type { CategorieAnalyseFonction, FonctionSecondDegre } from "./types";

/**
 * Écran `racinesReconnaissance` (« Quelle est la méthode la plus rapide pour trouver les racines de f ? ») : 4 choix
 * (jamais `cas_general`). Le choix est comparé à la VRAIE catégorie (`pilote:src/moteur/analyseFonction.ts:114-116`
 * @ 6acc102), jamais au choix précédent ni au contexte. Aucun code de compétence. Divergence (D6, RAPPORT §33) : un
 * identifiant hors liste est un `parse_error` (l'ancien : `not_equivalent`) — un client honnête ne peut pas l'envoyer.
 */
export const CHOIX_RECONNAISSANCE: { id: CategorieAnalyseFonction; libelle: string }[] = [
  { id: "mise_en_evidence", libelle: "Mise en évidence" },
  { id: "binome_conjugue", libelle: "Binôme conjugué" },
  { id: "produit_remarquable", libelle: "Produit remarquable" },
  { id: "irreductible", libelle: "Non factorisable" },
];

export function verifierReconnaissance(f: Pick<FonctionSecondDegre, "categorie">, reponseBrute: string): ResultatVerification {
  if (!CHOIX_RECONNAISSANCE.some((c) => c.id === reponseBrute)) return { statut: "parse_error", codesCompetence: [], messageErreur: "Ce choix n'existe pas : sélectionne l'une des propositions." };
  return { statut: reponseBrute === f.categorie ? "correct" : "not_equivalent", codesCompetence: [] };
}
