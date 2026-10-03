import { randomBytes } from "node:crypto";
import type { RequeteHttp, ReponseHttp } from "../../../../httpTypes";
import { avecGestionErreurs } from "../../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../../supabaseAdmin";
import { exigerAdmin } from "../../../../adminAuth";
import { elevesDeLaClasse } from "../../../../elevesDeLaClasse";
import { provisionnerEleve } from "../../../../provisionnerEleve";

export const NOMBRE_ELEVES_TEST_MAX = 40;
const ALPHABET_MDP = "abcdefghijkmnpqrstuvwxyz23456789"; // sans caractères ambigus (l, o, 0, 1)

/** Mot de passe commun d'une série d'élèves de test : 8 caractères, tirés de `crypto` (jamais `Math.random`). */
function genererMotDePasse(): string {
  return [...randomBytes(8)].map((o) => ALPHABET_MDP[o % ALPHABET_MDP.length]).join("");
}

/**
 * POST /api/admin/classes-test/:id/eleves `{ nombre }` EXACTEMENT (1 à 40) — crée N élèves de test dans la classe (RAPPORT §61, D6). Noms RÉSERVÉS : nom « Test-xxxx » (xxxx = début de l'identifiant de la
 * classe, donc distinct d'une classe de test à l'autre) et prénom « Élève 01 », « Élève 02 »… (la numérotation continue après les élèves existants) : ils ne peuvent pas être homonymes d'un vrai élève,
 * ni d'un élève d'une autre classe de test. UN mot de passe commun est généré et renvoyé UNE SEULE FOIS (jamais relisible ensuite). Le calcul d'homonymes d'un élève de test compte tout le monde.
 */
export const gererAdminClassesTestEleves = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const corps = req.body;
  const c = typeof corps === "object" && corps !== null && !Array.isArray(corps) ? (corps as Record<string, unknown>) : null;
  if (c === null || Object.keys(c).some((k) => k !== "nombre") || typeof c.nombre !== "number" || !Number.isInteger(c.nombre) || c.nombre < 1 || c.nombre > NOMBRE_ELEVES_TEST_MAX) {
    res.status(400).json({ erreur: `Corps invalide : { nombre: entier de 1 à ${NOMBRE_ELEVES_TEST_MAX} }` });
    return;
  }
  const nombre = c.nombre;

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
  const existants = await elevesDeLaClasse(admin, classe.id as string);
  if (!existants.ok) {
    res.status(500).json({ erreur: "Échec de lecture des élèves de la classe", detail: existants.erreur });
    return;
  }

  const motDePasse = genererMotDePasse();
  const nomFamille = `Test-${(classe.id as string).replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toLowerCase()}`;
  const crees: { id: string; nom: string; prenom: string }[] = [];
  for (let k = 1; k <= nombre; k++) {
    const prenom = `Élève ${String(existants.eleves.length + k).padStart(2, "0")}`;
    const resultat = await provisionnerEleve(admin, classe.id as string, nomFamille, prenom, motDePasse, undefined, { classeEstTest: true });
    if (!resultat.ok) {
      res.status(500).json({ erreur: resultat.erreur, detail: resultat.detail, eleves_crees: crees.length });
      return;
    }
    crees.push({ id: resultat.resultat.id, nom: nomFamille, prenom });
  }
  res.status(201).json({ mot_de_passe: motDePasse, eleves: crees });
});
