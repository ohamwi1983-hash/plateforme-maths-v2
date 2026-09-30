import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { validerAide } from "../aideTypee";
import { calculerEtatExercice, chargerContexteTache, chargerDonneesExercice, COLONNES_EXERCICE_ASSIGNE, projeterExercice, regenererExercice, type LigneExerciceAssigne } from "../etatExercice";
import { dependancesTerminees } from "../cascadeEcrans";

/**
 * POST /api/reponses/aide — sert le texte d'aide d'un écran ET en enregistre l'usage côté serveur
 * (`aides_utilisees`, une seule ligne par (exercice, champ), `ignoreDuplicates`). Le texte d'aide
 * n'est jamais envoyé avec l'exercice (`GET /api/exercices/:id`) : la pénalité (lib/moteurTentatives.ts)
 * ne dépend donc jamais d'un booléen déclaré par le client.
 */
export const gererReponsesAide = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const eleve = await eleveAuthentifie(req.headers.authorization as string | undefined);
  if (!eleve) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }
  const corps = req.body as Record<string, unknown> | null;
  if (typeof corps !== "object" || corps === null || typeof corps.exercice_assigne_id !== "string" || typeof corps.champ !== "string") {
    res.status(400).json({ erreur: "Corps invalide : { exercice_assigne_id, champ }" });
    return;
  }
  const { exercice_assigne_id, champ } = corps as { exercice_assigne_id: string; champ: string };

  const admin = supabaseAdmin();
  const { data: ligne, error } = await admin.from("exercices_assignes").select(COLONNES_EXERCICE_ASSIGNE).eq("id", exercice_assigne_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ligne || ligne.eleve_id !== eleve.id) {
    res.status(404).json({ erreur: "Exercice assigné introuvable" });
    return;
  }
  const regenere = regenererExercice(ligne as unknown as LigneExerciceAssigne);
  if (!regenere) {
    res.status(409).json({ erreur: "Exercice non exécutable" });
    return;
  }
  const ecran = regenere.ecrans.find((e) => e.champ === champ);
  if (!ecran) {
    res.status(400).json({ erreur: `Champ inconnu pour cet exercice : ${champ}` });
    return;
  }
  const contexte = await chargerContexteTache(admin, ligne.tache_id as string, ligne.variante_id as string);
  if (!contexte || !contexte.aideActivee) {
    res.status(403).json({ erreur: "L'aide n'est pas activée pour cette tâche" });
    return;
  }
  // Cascade (RAPPORT §18) : l'aide est celle de l'écran PROJETÉ (bâtie sur les réponses confirmées), jamais celle
  // de la vraie valeur ; et l'aide d'un écran dépendant n'est pas délivrée avant que ses prédécesseurs soient terminés.
  const donnees = await chargerDonneesExercice(admin, exercice_assigne_id);
  const etat = calculerEtatExercice(regenere, donnees, contexte, new Date());
  if (!dependancesTerminees(ecran, new Set(etat.reponsesConfirmees.map((r) => r.champ)))) {
    res.status(409).json({ erreur: "Cet écran dépend d'écrans précédents pas encore terminés" });
    return;
  }
  const ecranProjete = projeterExercice(regenere, etat.reponsesConfirmees, contexte).ecrans.find((e) => e.champ === champ)!;
  if (!ecranProjete.aide) {
    res.status(404).json({ erreur: "Pas d'aide pour cet écran" });
    return;
  }
  // Aide typée : validée AVANT tout enregistrement d'usage. Une aide invalide n'est ni servie ni comptée
  // (échec bruyant : c'est un défaut du générateur, jamais de l'élève — la pénalité ne doit pas le payer).
  if (typeof ecranProjete.aide !== "string") {
    const problemes = validerAide(ecranProjete.aide);
    if (problemes.length > 0) throw new Error(`Aide invalide pour ${ligne.variante_id} / ${champ} : ${problemes.join(" ; ")}`);
  }
  // Retour en arrière (RAPPORT §37, D5) : l'aide reste demandable sur un écran répondu mais encore modifiable (l'usage est collant : la
  // pénalité ne se réinitialise jamais, sinon « aide puis retour » serait un moyen de la contourner) ; plus rien une fois l'exercice
  // rendu ou expiré.
  const etatChamp = etat.champs.find((c) => c.champ === champ);
  if (etat.exerciceVerrouille || (etatChamp?.verrouille && !etatChamp.modifiable)) {
    res.status(409).json({ erreur: etat.exerciceVerrouille ? "Cet exercice est rendu ou son temps est écoulé" : "Ce champ est déjà terminé" });
    return;
  }

  const { error: erreurUpsert } = await admin.from("aides_utilisees").upsert({ exercice_assigne_id, champ }, { onConflict: "exercice_assigne_id,champ", ignoreDuplicates: true });
  if (erreurUpsert) throw new Error(erreurUpsert.message);
  res.status(200).json({ aide: ecranProjete.aide, penalite_pourcent: contexte.aidePenalitePourcent });
});
