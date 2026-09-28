import type { supabaseAdmin } from "./supabaseAdmin";
import { filtrerHomonymes, formaterAffichage } from "./homonymes";
import { genererEmailSynthetique } from "./emailSynthetique";
import { tousLesEleves } from "./tousLesEleves";

export interface ResultatProvisionnement {
  id: string;
  email: string;
  affichage: string;
}

export type ResultatOuErreur = { ok: true; resultat: ResultatProvisionnement } | { ok: false; erreur: string; detail?: string };

/**
 * Cœur commun à POST /api/inscription-eleve et POST /api/profs/creer-eleve (prompt
 * "Authentification élève", Étape 3 : "Même chemin que l'inscription... mais motDePasse fourni par
 * le prof") : compte Supabase Auth + ligne `eleves` + `inscriptions`, avec désambiguïsation
 * d'homonyme (Étape 3, point 2) et email synthétique si absent (point 3). Ne gère PAS la connexion
 * automatique après coup (Étape 3, point 6) : propre à l'inscription élève, pas à la création par
 * le prof (qui reste connecté en tant que prof) — laissée à l'appelant.
 *
 * Prompt "Connexion élève sans code", Étape 1 : désambiguïsation désormais GLOBALE (toute la table
 * `eleves`, `tousLesEleves`), plus seulement au sein de `classeId` via `inscriptions`
 * (`elevesDeLaClasse`, avant cette tâche) — la connexion sans code recherche les candidats sur toute
 * la plateforme, le suffixe d'affichage calculé ici doit donc désambiguïser au même périmètre dès la
 * création, pas seulement au sein d'une classe. Le mécanisme de suffixe lui-même (stockage, calcul
 * `formaterAffichage`) ne change pas, seul le périmètre de la recherche s'élargit (demande exacte).
 */
export async function provisionnerEleve(
  admin: ReturnType<typeof supabaseAdmin>,
  classeId: string,
  nom: string,
  prenom: string,
  motDePasse: string,
  emailFourni: string | undefined,
): Promise<ResultatOuErreur> {
  const resultatExistants = await tousLesEleves(admin);
  if (!resultatExistants.ok) return { ok: false, erreur: "Échec de lecture des élèves existants", detail: resultatExistants.erreur };

  const suffixe = filtrerHomonymes(resultatExistants.eleves, { nom, prenom }).length + 1;

  const email = emailFourni ?? genererEmailSynthetique(nom, prenom);

  const { data: userData, error: erreurCreation } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (erreurCreation || !userData.user) {
    return { ok: false, erreur: "Échec de création du compte : " + (erreurCreation?.message ?? "inconnu") };
  }

  const { error: erreurEleve } = await admin
    .from("eleves")
    .insert({ id: userData.user.id, nom, prenom, suffixe_affichage: suffixe });
  if (erreurEleve) return { ok: false, erreur: "Échec de création de l'élève" };

  const { error: erreurInscription } = await admin
    .from("inscriptions")
    .insert({ eleve_id: userData.user.id, classe_id: classeId });
  if (erreurInscription) return { ok: false, erreur: "Échec de l'inscription à la classe" };

  return { ok: true, resultat: { id: userData.user.id, email, affichage: formaterAffichage(nom, prenom, suffixe) } };
}
