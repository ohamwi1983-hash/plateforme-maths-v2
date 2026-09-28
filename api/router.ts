import type { RequeteHttp, ReponseHttp } from "../lib/httpTypes";
import { avecGestionErreurs } from "../lib/avecGestionErreurs";
import { gererCatalogueGenerateurs } from "../lib/routes/catalogue-generateurs";
import { gererClasses } from "../lib/routes/classes";
import { gererClassesIdProfil } from "../lib/routes/classes/[id]/profil";
import { gererClassesRegenererCode } from "../lib/routes/classes/regenerer-code";
import { gererClassesRenommer } from "../lib/routes/classes/renommer";
import { gererConfig } from "../lib/routes/config";
import { gererConnexionEleve } from "../lib/routes/connexion-eleve";
import { gererEleves } from "../lib/routes/eleves";
import { gererElevesMesResultats } from "../lib/routes/eleves/mes-resultats";
import { gererExercicesIndex } from "../lib/routes/exercices/index";
import { gererExercicesId } from "../lib/routes/exercices/[id]";
import { gererInscriptionEleve } from "../lib/routes/inscription-eleve";
import { gererInscriptionProf } from "../lib/routes/inscription-prof";
import { gererProfsCreerEleve } from "../lib/routes/profs/creer-eleve";
import { gererProfsDesactiverEleve } from "../lib/routes/profs/desactiver-eleve";
import { gererProfsElevesId } from "../lib/routes/profs/eleves/[id]";
import { gererProfsElevesProfil } from "../lib/routes/profs/eleves/profil";
import { gererProfsResetMdpEleve } from "../lib/routes/profs/reset-mdp-eleve";
import { gererProfsResultats } from "../lib/routes/profs/resultats";
import { gererProfsTableauDeBord } from "../lib/routes/profs/tableau-de-bord";
import { gererProfsTransfererEleve } from "../lib/routes/profs/transferer-eleve";
import { gererReponsesDebutEcran } from "../lib/routes/reponses-debut-ecran";
import { gererTaches } from "../lib/routes/taches";
import { gererTachesId } from "../lib/routes/taches/[id]";

type Gestionnaire = (req: RequeteHttp, res: ReponseHttp, params: Record<string, string>) => Promise<void>;

/**
 * Repris de l'ancien pilote (`plateforme-maths-pilote/api/router.ts`), élagué pour la phase 1
 * (socle de gestion, sans générateur ni moteur d'exercice) : `TABLE_ROUTAGE` ne porte plus que les
 * entrées dont le gestionnaire est dans le périmètre de cette phase. Retirées, avec leur raison :
 * - `POST /api/assignations`, `GET /api/eleves/tableau-de-bord`, `POST /api/reponses` : consommateurs
 *   du futur contrat de générateur, reportés en phase 2 (voir RAPPORT.md).
 * - `GET /api/profs/exercices/:id`, `GET /api/reponses/grille-info` : jamais copiés (décision actée
 *   4 du prompt Phase 1 — le premier ne fonctionne que pour gen1, le second est gen5/gen6-spécifique).
 * - `POST /api/taches/apercu`, `GET /api/taches/:id/impression` : gestionnaires (`taches-apercu.ts`,
 *   `taches-impression.ts`) non copiés, tous deux dépendants de `genererLigne`/`calculerSolutionAttendue`
 *   (générateur), voir RAPPORT.md pour le détail de cet écart avec la liste de fichiers du prompt.
 *
 * `methodes` documente ce que le fichier déplacé gère réellement lui-même (chaque handler continue
 * de faire son propre `req.method !== "X" -> 405`) — la correspondance ne filtre donc QUE sur le
 * motif de chemin, jamais sur la méthode : filtrer aussi par méthode ferait répondre 404 (au lieu
 * du 405 d'origine, produit par le handler lui-même) à un appel avec une méthode incorrecte sur un
 * chemin par ailleurs valide.
 */
interface EntreeRoutage {
  /** Documentation seule (voir commentaire ci-dessus) — pas utilisé pour le filtrage. */
  methodes: readonly string[];
  chemin: string;
  correspond: (segments: string[]) => boolean;
  extraireParams: (segments: string[]) => Record<string, string>;
  gestionnaire: Gestionnaire;
}

const AUCUN_PARAM = (): Record<string, string> => ({});

const TABLE_ROUTAGE: EntreeRoutage[] = [
  {
    methodes: ["GET"],
    chemin: "/api/catalogue-generateurs",
    correspond: (s) => s.length === 1 && s[0] === "catalogue-generateurs",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererCatalogueGenerateurs,
  },
  {
    methodes: ["POST"],
    chemin: "/api/classes/regenerer-code",
    correspond: (s) => s.length === 2 && s[0] === "classes" && s[1] === "regenerer-code",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererClassesRegenererCode,
  },
  {
    methodes: ["POST"],
    chemin: "/api/classes/renommer",
    correspond: (s) => s.length === 2 && s[0] === "classes" && s[1] === "renommer",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererClassesRenommer,
  },
  {
    methodes: ["GET", "POST"],
    chemin: "/api/classes",
    correspond: (s) => s.length === 1 && s[0] === "classes",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererClasses,
  },
  {
    methodes: ["GET"],
    chemin: "/api/classes/:id/profil",
    correspond: (s) => s.length === 3 && s[0] === "classes" && s[2] === "profil",
    extraireParams: (s) => ({ id: s[1] }),
    gestionnaire: gererClassesIdProfil,
  },
  {
    methodes: ["GET"],
    chemin: "/api/config",
    correspond: (s) => s.length === 1 && s[0] === "config",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererConfig,
  },
  {
    methodes: ["POST"],
    chemin: "/api/connexion-eleve",
    correspond: (s) => s.length === 1 && s[0] === "connexion-eleve",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererConnexionEleve,
  },
  {
    methodes: ["GET"],
    chemin: "/api/eleves/mes-resultats",
    correspond: (s) => s.length === 2 && s[0] === "eleves" && s[1] === "mes-resultats",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererElevesMesResultats,
  },
  {
    methodes: ["GET"],
    chemin: "/api/eleves",
    correspond: (s) => s.length === 1 && s[0] === "eleves",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererEleves,
  },
  {
    methodes: ["GET"],
    chemin: "/api/exercices/:id",
    correspond: (s) => s.length === 2 && s[0] === "exercices",
    extraireParams: (s) => ({ id: s[1] }),
    gestionnaire: gererExercicesId,
  },
  {
    methodes: ["GET"],
    chemin: "/api/exercices",
    correspond: (s) => s.length === 1 && s[0] === "exercices",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererExercicesIndex,
  },
  {
    methodes: ["POST"],
    chemin: "/api/inscription-eleve",
    correspond: (s) => s.length === 1 && s[0] === "inscription-eleve",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererInscriptionEleve,
  },
  {
    methodes: ["POST"],
    chemin: "/api/inscription-prof",
    correspond: (s) => s.length === 1 && s[0] === "inscription-prof",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererInscriptionProf,
  },
  {
    methodes: ["POST"],
    chemin: "/api/profs/creer-eleve",
    correspond: (s) => s.length === 2 && s[0] === "profs" && s[1] === "creer-eleve",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererProfsCreerEleve,
  },
  {
    methodes: ["POST"],
    chemin: "/api/profs/desactiver-eleve",
    correspond: (s) => s.length === 2 && s[0] === "profs" && s[1] === "desactiver-eleve",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererProfsDesactiverEleve,
  },
  {
    methodes: ["PATCH"],
    chemin: "/api/profs/eleves/:id",
    correspond: (s) => s.length === 3 && s[0] === "profs" && s[1] === "eleves",
    extraireParams: (s) => ({ id: s[2] }),
    gestionnaire: gererProfsElevesId,
  },
  {
    methodes: ["GET"],
    chemin: "/api/profs/eleves/:id/profil",
    correspond: (s) => s.length === 4 && s[0] === "profs" && s[1] === "eleves" && s[3] === "profil",
    extraireParams: (s) => ({ id: s[2] }),
    gestionnaire: gererProfsElevesProfil,
  },
  {
    methodes: ["POST"],
    chemin: "/api/profs/reset-mdp-eleve",
    correspond: (s) => s.length === 2 && s[0] === "profs" && s[1] === "reset-mdp-eleve",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererProfsResetMdpEleve,
  },
  {
    methodes: ["GET"],
    chemin: "/api/profs/resultats",
    correspond: (s) => s.length === 2 && s[0] === "profs" && s[1] === "resultats",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererProfsResultats,
  },
  {
    methodes: ["GET"],
    chemin: "/api/profs/tableau-de-bord",
    correspond: (s) => s.length === 2 && s[0] === "profs" && s[1] === "tableau-de-bord",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererProfsTableauDeBord,
  },
  {
    methodes: ["POST"],
    chemin: "/api/profs/transferer-eleve",
    correspond: (s) => s.length === 2 && s[0] === "profs" && s[1] === "transferer-eleve",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererProfsTransfererEleve,
  },
  {
    methodes: ["POST"],
    chemin: "/api/reponses/debut-ecran",
    correspond: (s) => s.length === 2 && s[0] === "reponses" && s[1] === "debut-ecran",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererReponsesDebutEcran,
  },
  {
    methodes: ["GET", "POST"],
    chemin: "/api/taches",
    correspond: (s) => s.length === 1 && s[0] === "taches",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererTaches,
  },
  {
    methodes: ["PATCH", "DELETE"],
    chemin: "/api/taches/:id",
    correspond: (s) => s.length === 2 && s[0] === "taches",
    extraireParams: (s) => ({ id: s[1] }),
    gestionnaire: gererTachesId,
  },
];

/**
 * Découpe en segments le chemin capturé par `vercel.json` (`rewrites: /api/:path* ->
 * /api/router`) — lu dans `req.query.path`, jamais dans `req.url` (voir l'historique complet de ce
 * choix dans l'ancien pilote, `plateforme-maths-pilote/api/router.ts`, non reproduit ici :
 * comportement inchangé, juste la table élaguée).
 */
function extraireSegments(query: Record<string, string | string[] | undefined>): string[] {
  const chemin = query.path;
  if (typeof chemin !== "string" || chemin === "") return [];
  return chemin.split("/").filter((s) => s.length > 0);
}

export default avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  const segments = extraireSegments(req.query);

  for (const entree of TABLE_ROUTAGE) {
    if (entree.correspond(segments)) {
      await entree.gestionnaire(req, res, entree.extraireParams(segments));
      return;
    }
  }

  res.status(404).json({ erreur: "Route introuvable" });
});
