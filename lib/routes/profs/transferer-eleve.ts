import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { classesDuProfPourEleve } from "../../eleveDuProf";
import { elevesDeLaClasse } from "../../elevesDeLaClasse";
import { filtrerHomonymes, formaterAffichage } from "../../homonymes";

interface CorpsTransferer {
  eleve_id: string;
  nouvelle_classe_id: string;
}

function estCorpsValide(corps: unknown): corps is CorpsTransferer {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.eleve_id === "string" && c.eleve_id.trim() !== "" && typeof c.nouvelle_classe_id === "string" && c.nouvelle_classe_id.trim() !== "";
}

/**
 * POST /api/profs/transferer-eleve — prompt "Gestion de classe étendue", Étape 4 : déplace un
 * élève d'une classe du prof vers une AUTRE classe du même prof (transfert vers la classe d'un
 * autre prof explicitement hors périmètre — vérifié ci-dessous par `classesDuProfPourEleve` sur les
 * DEUX classes, origine et destination). Ne touche jamais `exercices_assignes`/`reponses` — décision
 * explicite du prompt, pas un oubli : aucune requête sur ces tables ici.
 */
export const gererProfsTransfererEleve = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { eleve_id, nouvelle_classe_id }" });
    return;
  }

  const admin = supabaseAdmin();
  const eleveId = req.body.eleve_id;
  const nouvelleClasseId = req.body.nouvelle_classe_id;

  const classeIdsOrigine = await classesDuProfPourEleve(admin, eleveId, prof.id);
  if (classeIdsOrigine.length === 0) {
    res.status(404).json({ erreur: "Élève introuvable" });
    return;
  }

  if (classeIdsOrigine.includes(nouvelleClasseId)) {
    res.status(400).json({ erreur: "Cet élève est déjà inscrit dans cette classe" });
    return;
  }

  const { data: classeDestination, error: erreurClasseDestination } = await admin
    .from("classes")
    .select("id, est_test")
    .eq("id", nouvelleClasseId)
    .eq("prof_id", prof.id)
    .maybeSingle();
  if (erreurClasseDestination || !classeDestination) {
    res.status(404).json({ erreur: "Classe de destination introuvable" });
    return;
  }

  // Classes de test (RAPPORT §61) : jamais de transfert depuis ou vers une classe de test — un vrai élève déplacé dans une classe de test serait supprimé avec elle.
  const { data: classesOrigine, error: erreurOrigine } = await admin.from("classes").select("id, est_test").in("id", classeIdsOrigine);
  if (erreurOrigine) {
    res.status(500).json({ erreur: "Échec de lecture des classes d'origine", detail: erreurOrigine.message });
    return;
  }
  if (classeDestination.est_test === true || (classesOrigine ?? []).some((c) => c.est_test === true)) {
    res.status(400).json({ erreur: "Transfert impossible depuis ou vers une classe de test." });
    return;
  }

  const { data: eleve, error: erreurEleve } = await admin.from("eleves").select("nom, prenom").eq("id", eleveId).maybeSingle();
  if (erreurEleve || !eleve) {
    res.status(500).json({ erreur: "Échec de lecture de l'élève" });
    return;
  }

  const resultatExistantsDestination = await elevesDeLaClasse(admin, classeDestination.id);
  if (!resultatExistantsDestination.ok) {
    res.status(500).json({ erreur: "Échec de lecture des élèves de la classe de destination", detail: resultatExistantsDestination.erreur });
    return;
  }
  const suffixe = filtrerHomonymes(resultatExistantsDestination.eleves, { nom: eleve.nom, prenom: eleve.prenom }).length + 1;

  // Retire l'élève de TOUTES ses classes actuelles chez ce prof avant d'insérer la nouvelle — gère
  // proprement le cas marginal (non exposé par l'interface) où il en aurait plus d'une, plutôt que
  // de n'en retirer qu'une arbitrairement et laisser une inscription orpheline.
  const { error: erreurSuppression } = await admin.from("inscriptions").delete().eq("eleve_id", eleveId).in("classe_id", classeIdsOrigine);
  if (erreurSuppression) {
    res.status(500).json({ erreur: "Échec du retrait de l'ancienne classe", detail: erreurSuppression.message });
    return;
  }

  const { error: erreurInsertion } = await admin.from("inscriptions").insert({ eleve_id: eleveId, classe_id: classeDestination.id });
  if (erreurInsertion) {
    res.status(500).json({ erreur: "Échec de l'inscription dans la nouvelle classe", detail: erreurInsertion.message });
    return;
  }

  const { error: erreurMajSuffixe } = await admin.from("eleves").update({ suffixe_affichage: suffixe }).eq("id", eleveId);
  if (erreurMajSuffixe) {
    res.status(500).json({ erreur: "Échec de la mise à jour de l'affichage", detail: erreurMajSuffixe.message });
    return;
  }

  res.status(200).json({ ok: true, affichage: formaterAffichage(eleve.nom, eleve.prenom, suffixe) });
});
