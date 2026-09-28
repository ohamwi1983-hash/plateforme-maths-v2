import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { recupererToutesLesLignes } from "../supabasePagination";

/**
 * GET /api/eleves?classe_id=... — liste les élèves inscrits dans une classe.
 * Ajout pragmatique non listé explicitement à l'Étape 4 (prompt gen1) : à l'origine, sans compte
 * élève dans ce pilote, permettait à la page élève de proposer un sélecteur de nom plutôt que de
 * deviner un mécanisme d'identification non spécifié. Ce sélecteur a disparu avec
 * l'authentification élève réelle (voir public/eleve.html) ; cet endpoint reste utilisé par
 * `public/prof.html` pour peupler le sélecteur "réinitialiser le mot de passe d'un élève" (prompt
 * "Authentification élève", Étape 5) — d'où l'ajout de `prenom` à la sélection ci-dessous. Pas
 * d'authentification ici (portée volontairement étroite, cohérent avec le reste des routes
 * élève) : `POST /api/profs/reset-mdp-eleve` reste la seule action sensible, et vérifie lui-même
 * l'appartenance de l'élève à une classe du prof avant d'agir.
 *
 * GET /api/eleves (SANS classe_id) — prompt "Assigner à des élèves spécifiques" : liste TOUS les
 * élèves de TOUTES les classes du prof authentifié (`classe_id`/`classe_nom` inclus par ligne),
 * pour le sélecteur "Élèves spécifiques" du formulaire d'assignation. Contrairement à la branche
 * `classe_id` ci-dessus, cette branche EXIGE une authentification (`profAuthentifie`) : sans
 * `classe_id` à deviner pour scoper la requête, l'absence d'auth exposerait la liste d'élèves de
 * N'IMPORTE QUEL prof — jamais acceptable, même si la branche historique reste, elle, inchangée.
 */
export const gererEleves = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const admin = supabaseAdmin();
  const classeId = req.query.classe_id;

  if (typeof classeId !== "string") {
    const prof = await profAuthentifie(req.headers.authorization as string | undefined);
    if (!prof) {
      res.status(401).json({ erreur: "Non authentifié" });
      return;
    }

    const { data: classes, error: erreurClasses } = await admin.from("classes").select("id, nom").eq("prof_id", prof.id);
    if (erreurClasses) {
      res.status(500).json({ erreur: "Échec de récupération des classes", detail: erreurClasses.message });
      return;
    }
    const classeIds = (classes ?? []).map((c) => c.id as string);
    if (classeIds.length === 0) {
      res.status(200).json([]);
      return;
    }
    const classeNomParId = new Map((classes ?? []).map((c) => [c.id as string, c.nom as string]));

    const { data: inscriptions, error } = (await admin
      .from("inscriptions")
      .select("eleve_id, classe_id, eleves(id, nom, prenom, actif)")
      .in("classe_id", classeIds)) as {
      data: { eleve_id: string; classe_id: string; eleves: { id: string; nom: string; prenom: string; actif: boolean } | null }[] | null;
      error: { message: string } | null;
    };
    if (error) {
      res.status(500).json({ erreur: "Échec de récupération des élèves", detail: error.message });
      return;
    }

    const eleves = (inscriptions ?? [])
      .filter((ligne) => ligne.eleves !== null && ligne.eleves.actif)
      .map((ligne) => ({
        id: ligne.eleves!.id,
        nom: ligne.eleves!.nom,
        prenom: ligne.eleves!.prenom,
        classe_id: ligne.classe_id,
        classe_nom: classeNomParId.get(ligne.classe_id) ?? "",
      }));
    res.status(200).json(eleves);
    return;
  }

  const { data: inscriptions, error } = (await admin
    .from("inscriptions")
    .select("eleve_id, eleves(id, nom, prenom, actif)")
    .eq("classe_id", classeId)) as {
    data: { eleve_id: string; eleves: { id: string; nom: string; prenom: string; actif: boolean } | null }[] | null;
    error: { message: string } | null;
  };
  if (error) {
    res.status(500).json({ erreur: "Échec de récupération des élèves", detail: error.message });
    return;
  }

  // Prompt "Gestion de classe étendue", Étape 2 : un élève désactivé "disparaît des listes actives
  // (sélecteur de réinitialisation de mot de passe, listes de classe)" — ce sont les 2 seuls
  // consommateurs de cet endpoint (voir public/prof.html), jamais toutes ses données ailleurs.
  const eleves = (inscriptions ?? [])
    .map((ligne) => ligne.eleves)
    .filter((e): e is { id: string; nom: string; prenom: string; actif: boolean } => e !== null && e.actif)
    .map(({ id, nom, prenom }) => ({ id, nom, prenom }));

  // Refonte "Onglet Classes" (Option C, tri "Nom / Réponses / Dernière activité") : nombre total de
  // réponses soumises et date de la plus récente, par élève — définitions 1 et 3 retenues par
  // l'utilisateur pour "plus/moins actif". Même chemin `exercices_assignes -> reponses` que
  // `lib/routes/profs/resultats.ts` (jamais un 2e schéma d'agrégation), mais ici sur TOUTE
  // l'historique de l'élève (pas juste cette classe/tâche) : `exercices_assignes.eleve_id`
  // n'est pas scopé par classe, cohérent avec le fait qu'un élève ne peut être que dans une classe
  // à la fois (voir transferer-eleve.ts) — sa "dernière activité" reste donc bien celle de sa
  // classe actuelle.
  const eleveIds = eleves.map((e) => e.id);
  // Correctif (pagination défensive, même classe de bug que `compterReponsesAvecBug`,
  // `lib/routes/profs/tableau-de-bord.ts` — voir RAPPORT.md) : "toute l'historique" d'une classe
  // entière peut dépasser la limite PostgREST de 1000 lignes.
  let exercicesBruts: { id: string; eleve_id: string }[];
  let reponsesBrutes: { exercice_assigne_id: string; horodatage: string }[];
  try {
    exercicesBruts = await recupererToutesLesLignes(() =>
      admin
        .from("exercices_assignes")
        .select("id, eleve_id")
        .in("eleve_id", eleveIds.length > 0 ? eleveIds : [""]),
    );
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des exercices assignés", detail: e instanceof Error ? e.message : String(e) });
    return;
  }
  const eleveIdParExerciceId = new Map<string, string>(exercicesBruts.map((e) => [e.id, e.eleve_id]));
  const exerciceIds = [...eleveIdParExerciceId.keys()];

  try {
    reponsesBrutes = await recupererToutesLesLignes(() =>
      admin
        .from("reponses")
        .select("exercice_assigne_id, horodatage")
        .in("exercice_assigne_id", exerciceIds.length > 0 ? exerciceIds : [""]),
    );
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des réponses", detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  const nbReponsesParEleve = new Map<string, number>();
  const derniereActiviteParEleve = new Map<string, string>();
  for (const r of reponsesBrutes) {
    const eleveId = eleveIdParExerciceId.get(r.exercice_assigne_id as string);
    if (!eleveId) continue;
    nbReponsesParEleve.set(eleveId, (nbReponsesParEleve.get(eleveId) ?? 0) + 1);
    const horodatage = r.horodatage as string;
    const actuelle = derniereActiviteParEleve.get(eleveId);
    if (!actuelle || horodatage > actuelle) derniereActiviteParEleve.set(eleveId, horodatage);
  }

  const elevesAvecActivite = eleves.map((e) => ({
    ...e,
    nb_reponses: nbReponsesParEleve.get(e.id) ?? 0,
    derniere_activite: derniereActiviteParEleve.get(e.id) ?? null,
  }));
  res.status(200).json(elevesAvecActivite);
});
