import type { RequeteHttp, ReponseHttp } from "./httpTypes";

/**
 * Enveloppe un handler pour garantir qu'il répond toujours en JSON, même en cas d'exception non
 * anticipée. Sans ce filet, une exception qui sort d'une fonction async non interceptée fait
 * planter la fonction serverless : Vercel renvoie alors sa page de crash générique en HTML (le
 * client échoue à la parser comme JSON — signature typique : "Unexpected token 'A', "A server
 * e"... is not valid JSON"). Chaque endpoint reste par ailleurs inchangé : ceci n'ajoute qu'un
 * filet, ça ne remplace aucune gestion d'erreur déjà présente dans le corps du handler.
 *
 * Signature étendue avec un 3e paramètre `params` (prompt "Point d'entrée unique", Étape 1 :
 * "signature uniforme... async function handler(req, res, params: Record<string,string>)") — le
 * routeur unique (`api/[...route].ts`) l'appelle systématiquement avec 3 arguments, y compris pour
 * les routes sans segment dynamique (`params = {}` dans ce cas). Un handler déplacé qui ne déclare
 * que 2 paramètres (la quasi-totalité des routes) reste valide tel quel : TypeScript autorise
 * qu'une fonction déclare moins de paramètres que le type attendu (l'argument surnuméraire est
 * simplement ignoré, comme pour n'importe quel callback `Array.prototype.map`) — aucun des
 * handlers déplacés n'a donc eu besoin d'ajouter ce paramètre pour compiler, seul
 * `lib/routes/exercices/[id].ts` le déclare réellement (Étape 3, le seul segment dynamique de ce
 * pilote).
 */
export function avecGestionErreurs(
  handler: (req: RequeteHttp, res: ReponseHttp, params: Record<string, string>) => Promise<void> | void,
): (req: RequeteHttp, res: ReponseHttp, params: Record<string, string>) => Promise<void> {
  return async (req, res, params) => {
    try {
      await handler(req, res, params);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ erreur: "Erreur interne", detail: message });
    }
  };
}
