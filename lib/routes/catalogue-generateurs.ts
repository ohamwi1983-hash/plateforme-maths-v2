import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { profAuthentifie } from "../supabaseAdmin";
import { CATALOGUE_GENERATEURS } from "../catalogueGenerateurs";
import { chercherGenerateur } from "../registreGenerateurs";

/**
 * GET /api/catalogue-generateurs — prompt "Gestion de classe et formulaire de tâche généralisé",
 * Étape 3 : renvoie `CATALOGUE_GENERATEURS` tel quel, pour peupler dynamiquement le formulaire de
 * composition de tâche (Étape 4). Authentifié prof comme le reste de `prof.html` — pas de données
 * sensibles ici, mais pas de raison d'exposer cet endpoint sans authentification non plus.
 *
 * Chaque entrée porte `executable` : dérivé À LA VOLÉE du registre (`chercherGenerateur`, seule autorité sur ce qui s'exécute), jamais
 * une liste tenue à part. `prof.html` s'en sert pour n'activer « Aperçu » que si tout ce qui est composé sait s'exécuter (le serveur
 * refuse de toute façon en 409, `POST /api/taches/apercu`).
 */
export const gererCatalogueGenerateurs = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  res.status(200).json(CATALOGUE_GENERATEURS.map((entree) => ({ ...entree, executable: chercherGenerateur(entree.variante_id) !== null })));
});
