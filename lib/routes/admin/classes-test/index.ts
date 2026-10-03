import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../supabaseAdmin";
import { exigerAdmin } from "../../../adminAuth";
import { elevesDeLaClasse } from "../../../elevesDeLaClasse";

const NOM_MAX = 80;

/**
 * GET / POST /api/admin/classes-test — classes de TEST du compte administrateur (RAPPORT §61), réservées aux admins (`exigerAdmin` : 401 / 403, AVANT toute validation).
 *  - GET : les classes `est_test` DE CET ADMIN, avec leurs élèves (nom / prénom de connexion) ; jamais la classe d'un autre professeur.
 *  - POST `{ nom }` EXACTEMENT : crée une classe `est_test = true`, SANS code d'inscription. Toute autre clé, `est_test` en tête, est refusée (400) : le marquage n'est écrit que par cette route (la route
 *    `POST /api/classes`, ouverte à tout professeur, n'écrit que `nom`).
 */
export const gererAdminClassesTest = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;
  const admin = supabaseAdmin();

  if (req.method === "GET") {
    const { data: classes, error } = await admin.from("classes").select("id, nom, est_test").eq("prof_id", moi.id);
    if (error) {
      res.status(500).json({ erreur: "Échec de récupération des classes de test", detail: error.message });
      return;
    }
    const liste = [];
    for (const classe of (classes ?? []).filter((c) => c.est_test === true)) {
      const eleves = await elevesDeLaClasse(admin, classe.id as string);
      if (!eleves.ok) {
        res.status(500).json({ erreur: "Échec de récupération des élèves d'une classe de test", detail: eleves.erreur });
        return;
      }
      liste.push({ id: classe.id as string, nom: classe.nom as string, nombre_eleves: eleves.eleves.length, eleves: eleves.eleves.map((e) => ({ nom: e.nom, prenom: e.prenom })) });
    }
    res.status(200).json({ classes: liste });
    return;
  }

  const corps = req.body;
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) {
    res.status(400).json({ erreur: "Corps invalide : { nom: string }" });
    return;
  }
  const c = corps as Record<string, unknown>;
  const inconnues = Object.keys(c).filter((k) => k !== "nom");
  if (inconnues.length > 0) {
    res.status(400).json({ erreur: `Champ(s) non autorisé(s) : ${inconnues.join(", ")}` });
    return;
  }
  if (typeof c.nom !== "string" || c.nom.trim() === "" || c.nom.trim().length > NOM_MAX) {
    res.status(400).json({ erreur: `Corps invalide : { nom: string } — nom non vide, ${NOM_MAX} caractères au plus` });
    return;
  }
  const { data: classe, error } = await admin.from("classes").insert({ prof_id: moi.id, nom: c.nom.trim(), est_test: true }).select("id, nom").single();
  if (error || !classe) {
    res.status(500).json({ erreur: "Échec de création de la classe de test", detail: error?.message });
    return;
  }
  res.status(201).json({ id: classe.id as string, nom: classe.nom as string, est_test: true });
});
