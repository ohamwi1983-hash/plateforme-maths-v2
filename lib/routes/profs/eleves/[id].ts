import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../../supabaseAdmin";
import { classesDuProfPourEleve } from "../../../eleveDuProf";
import { elevesDeLaClasse } from "../../../elevesDeLaClasse";
import { filtrerHomonymes, formaterAffichage } from "../../../homonymes";

interface CorpsModifierEleve {
  nom: string;
  prenom: string;
}

function estCorpsValide(corps: unknown): corps is CorpsModifierEleve {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.nom === "string" && c.nom.trim() !== "" && typeof c.prenom === "string" && c.prenom.trim() !== "";
}

/**
 * PATCH /api/profs/eleves/:id — prompt "Gestion de classe étendue", Étape 3 : modification
 * nom/prénom d'un élève. Ne touche jamais à l'email ni au mot de passe (déjà exclu par le corps
 * accepté ci-dessus, qui ne connaît que `nom`/`prenom`).
 *
 * Redétection d'homonyme (Étape 3 : "réutiliser lib/homonymes.ts existant... pas de duplication")
 * dans la classe de cet élève — au singulier comme le prompt, cohérent avec `eleves.suffixe_affichage`
 * qui n'a qu'UNE valeur stockée par élève (pas une par classe) : la 1re classe trouvée sert de
 * périmètre. Un élève inscrit dans plusieurs classes de ce prof (cas marginal, aucune interface de
 * ce pilote n'en crée) n'aurait qu'une redétection partielle — signalé, pas traité, comme la
 * décision déjà prise pour `eleves.id` sans contrainte stricte (voir supabase/schema.sql).
 */
export const gererProfsElevesId = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "PATCH") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { nom, prenom }" });
    return;
  }

  const admin = supabaseAdmin();
  const eleveId = params.id;
  const classeIds = await classesDuProfPourEleve(admin, eleveId, prof.id);
  if (classeIds.length === 0) {
    res.status(404).json({ erreur: "Élève introuvable" });
    return;
  }

  const nom = req.body.nom.trim();
  const prenom = req.body.prenom.trim();

  const resultatExistants = await elevesDeLaClasse(admin, classeIds[0]);
  if (!resultatExistants.ok) {
    res.status(500).json({ erreur: "Échec de lecture des élèves de la classe", detail: resultatExistants.erreur });
    return;
  }
  const autres = resultatExistants.eleves.filter((e) => e.id !== eleveId);
  const suffixe = filtrerHomonymes(autres, { nom, prenom }).length + 1;

  const { error } = await admin.from("eleves").update({ nom, prenom, suffixe_affichage: suffixe }).eq("id", eleveId);
  if (error) {
    res.status(500).json({ erreur: "Échec de la modification", detail: error.message });
    return;
  }

  res.status(200).json({ id: eleveId, affichage: formaterAffichage(nom, prenom, suffixe) });
});
