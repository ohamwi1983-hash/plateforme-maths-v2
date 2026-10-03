import type { RequeteHttp, ReponseHttp } from "../../../../httpTypes";
import { avecGestionErreurs } from "../../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../../supabaseAdmin";
import { exigerAdmin } from "../../../../adminAuth";
import { elevesDeLaClasse } from "../../../../elevesDeLaClasse";
import { elevesInscritsAilleurs } from "../../../../elevesDeTest";
import { genererMotDePasseEleveTest } from "../../../../motDePasseEleveTest";

/** Comptes réinitialisés EN PARALLÈLE par lot (même valeur que la suppression, `TAILLE_LOT_COMPTES_AUTH`, et `TAILLE_LOT_EMAILS` de `admin/profs/index.ts`). */
const TAILLE_LOT_REINITIALISATION = 10;

/**
 * POST /api/admin/classes-test/:id/mot-de-passe (corps vide `{}` EXACTEMENT) — RÉGÉNÈRE le mot de passe commun de TOUS les élèves de test de la classe (RAPPORT §64) : un nouveau mot de passe (même générateur que
 * la création, `genererMotDePasseEleveTest`) est posé sur chaque compte Supabase Auth et renvoyé UNE SEULE FOIS, jamais relisible ensuite — même mécanisme que la création initiale. L'ancien mot de passe cesse
 * de fonctionner ; une session déjà ouverte n'est pas révoquée. Seulement SES classes de test (404 sinon) ; classe sans élève : 409 ; élève inscrit aussi ailleurs : 409, RIEN n'est modifié (jamais le mot de
 * passe d'un vrai élève). Si un compte échoue, la réponse est une erreur SANS mot de passe : l'état des comptes est alors mélangé, et relancer régénère un mot de passe pour tous (l'état redevient cohérent).
 */
export const gererAdminClassesTestMotDePasse = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const corps = req.body;
  if (typeof corps !== "object" || corps === null || Array.isArray(corps) || Object.keys(corps).length > 0) {
    res.status(400).json({ erreur: "Corps invalide : aucun champ n'est accepté ({})" });
    return;
  }

  const admin = supabaseAdmin();
  const { data: classe, error } = await admin.from("classes").select("id, prof_id, est_test").eq("id", params.id).maybeSingle();
  if (error) {
    res.status(500).json({ erreur: "Échec de lecture de la classe", detail: error.message });
    return;
  }
  if (!classe || classe.prof_id !== moi.id || classe.est_test !== true) {
    res.status(404).json({ erreur: "Classe de test introuvable" });
    return;
  }
  const lecture = await elevesDeLaClasse(admin, classe.id as string);
  if (!lecture.ok) {
    res.status(500).json({ erreur: "Échec de lecture des élèves de la classe", detail: lecture.erreur });
    return;
  }
  const eleves = lecture.eleves;
  if (eleves.length === 0) {
    res.status(409).json({ erreur: "Cette classe de test n'a aucun élève : ajoutez-en d'abord." });
    return;
  }
  const partages = await elevesInscritsAilleurs(admin, classe.id as string, eleves.map((e) => e.id));
  if ("erreur" in partages) {
    res.status(500).json({ erreur: partages.erreur });
    return;
  }
  if (partages.noms.length > 0) {
    res.status(409).json({ erreur: "Réinitialisation refusée : des élèves de cette classe sont aussi inscrits dans une autre classe (" + partages.noms.join(", ") + ").", eleves_partages: partages.noms });
    return;
  }

  const motDePasse = genererMotDePasseEleveTest();
  const echecs: string[] = [];
  for (let i = 0; i < eleves.length; i += TAILLE_LOT_REINITIALISATION) {
    const lot = eleves.slice(i, i + TAILLE_LOT_REINITIALISATION);
    const resultats = await Promise.all(lot.map(async (e) => ({ e, erreur: (await admin.auth.admin.updateUserById(e.id, { password: motDePasse })).error })));
    for (const { e, erreur } of resultats) if (erreur) echecs.push(`${e.prenom} ${e.nom}`.trim());
  }
  if (echecs.length > 0) {
    res.status(500).json({ erreur: `Échec de la réinitialisation pour ${echecs.length} élève(s) : ${echecs.join(", ")}. Relancez la régénération pour remettre tous les comptes d'accord.`, eleves_en_echec: echecs });
    return;
  }
  res.status(200).json({ mot_de_passe: motDePasse, eleves: eleves.map((e) => ({ nom: e.nom, prenom: e.prenom })) });
});
