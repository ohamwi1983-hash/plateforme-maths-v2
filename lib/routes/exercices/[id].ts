import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../../supabaseAdmin";

/**
 * GET /api/exercices/:id — un élève récupère son exercice assigné (Étape 4, prompt gen1) :
 * uniquement `enonce`, jamais `solution` (ni `bugs_plausibles`, qui est aussi un signal interne).
 * `forme_affichage` est exposée : c'est une propriété présentationnelle de l'énoncé (jamais un
 * signal de vérification), nécessaire côté client pour reproduire la condition de saut de
 * l'écran "isolement" (voir public/eleve.html, necessiteIsolement).
 *
 * Authentification ajoutée pour "Authentification élève et réglages de correction" — voir
 * `eleveAuthentifie` (lib/supabaseAdmin.ts) : `eleve_id` de l'exercice doit correspondre à
 * l'élève authentifié, sans quoi n'importe qui pourrait lire n'importe quel exercice par id.
 *
 * Adapté pour "Point d'entrée unique" (Étape 3) : perd l'injection automatique `req.query.id`
 * propre à la convention de fichier Vercel `[id].ts` — le routeur unique (`api/[...route].ts`)
 * extrait désormais `id` du segment de chemin lui-même et le transmet via `params`, seul
 * changement de contenu de cette route parmi les 15 migrées (voir RAPPORT.md).
 */
export const gererExercicesId = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const eleve = await eleveAuthentifie(req.headers.authorization as string | undefined);
  if (!eleve) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const id = params.id;
  if (typeof id !== "string") {
    res.status(400).json({ erreur: "Identifiant d'exercice manquant" });
    return;
  }

  const admin = supabaseAdmin();
  const { data: exercice, error } = await admin
    .from("exercices_assignes")
    .select("id, generateur_id, variante_id, enonce, forme_affichage, eleve_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !exercice || exercice.eleve_id !== eleve.id) {
    res.status(404).json({ erreur: "Exercice introuvable" });
    return;
  }

  const { eleve_id: _eleveId, ...exercicePublic } = exercice;
  res.status(200).json(exercicePublic);
});
