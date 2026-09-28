import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { genererCodeClasseUnique } from "../codeClasse";
import { elevesDeLaClasse } from "../elevesDeLaClasse";

interface CorpsCreerClasse {
  nom: string;
}

function estCorpsCreerClasseValide(corps: unknown): corps is CorpsCreerClasse {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.nom === "string" && c.nom.trim() !== "";
}

/**
 * GET /api/classes — liste les classes du prof authentifié.
 * Ajout pragmatique non listé explicitement à l'Étape 4 (prompt gen1) : nécessaire pour peupler le
 * sélecteur de classe du formulaire de composition de tâche (Étape 6) — voir le rapport de fin.
 *
 * Étendu pour "Authentification élève et réglages de correction" (Étape 2) : génère et persiste
 * paresseusement un `code` pour toute classe qui n'en a pas encore — Portée explicite de ce
 * prompt exclut toute interface de création de classe pour cette itération ("se limiter au strict
 * nécessaire pour que l'authentification fonctionne : le code existe et est lisible quelque
 * part"), donc pas de génération "à la création" ; celle-ci a lieu ici, au premier chargement de
 * la liste par le prof, qui est l'endroit le plus proche qui existe déjà dans ce pilote.
 *
 * POST /api/classes — prompt "Gestion de classe et formulaire de tâche généralisé", Étape 2 :
 * `{nom}` -> insère la classe avec `prof_id` du prof authentifié et un `code` généré directement à
 * la création (via `genererCodeClasseUnique`, réutilisé tel quel) — la génération paresseuse
 * ci-dessus reste nécessaire pour les classes déjà existantes sans code, créées avant cet ajout.
 */
export const gererClasses = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const admin = supabaseAdmin();

  if (req.method === "GET") {
    const { data: classes, error } = await admin.from("classes").select("id, nom, code").eq("prof_id", prof.id);
    if (error) {
      res.status(500).json({ erreur: "Échec de récupération des classes", detail: error.message });
      return;
    }

    const resultat = [];
    for (const classe of classes ?? []) {
      if (classe.code) {
        resultat.push(classe);
        continue;
      }
      const code = await genererCodeClasseUnique(admin);
      const { data: classeMaj, error: erreurMaj } = await admin
        .from("classes")
        .update({ code })
        .eq("id", classe.id)
        .select("id, nom, code")
        .single();
      resultat.push(erreurMaj || !classeMaj ? classe : classeMaj);
    }

    // Refonte "Onglet Classes" (Option C) : effectif par classe pour le panneau "Mes classes" (liste
    // de sélection) et le bandeau de la classe active — calculé ici plutôt que dans
    // `/api/profs/tableau-de-bord` (dont la réponse ne porte pas `id`, seulement `code`, et n'est
    // jamais rechargée après une mutation d'élève ; un 2e appel réseau aurait aussi été nécessaire).
    // `elevesDeLaClasse` déjà réutilisée telle quelle (voir `lib/routes/profs/resultats.ts`), jamais
    // un 2e chemin de lecture des inscriptions.
    const avecEffectif = [];
    for (const classe of resultat) {
      const resultatEleves = await elevesDeLaClasse(admin, classe.id);
      const nombreElevesActifs = resultatEleves.ok ? resultatEleves.eleves.filter((e) => e.actif).length : 0;
      avecEffectif.push({ ...classe, nombre_eleves_actifs: nombreElevesActifs });
    }

    res.status(200).json(avecEffectif);
    return;
  }

  if (req.method === "POST") {
    if (!estCorpsCreerClasseValide(req.body)) {
      res.status(400).json({ erreur: "Corps invalide : { nom: string }" });
      return;
    }

    const code = await genererCodeClasseUnique(admin);
    const { data: classe, error } = await admin
      .from("classes")
      .insert({ prof_id: prof.id, nom: req.body.nom, code })
      .select("id, nom, code")
      .single();
    if (error || !classe) {
      res.status(500).json({ erreur: "Échec de création de la classe", detail: error?.message });
      return;
    }

    res.status(201).json(classe);
    return;
  }

  res.status(405).json({ erreur: "Méthode non autorisée" });
});
