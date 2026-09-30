import type { RequeteHttp, ReponseHttp } from "../lib/httpTypes";
import { avecGestionErreurs } from "../lib/avecGestionErreurs";
import { gererAdminProfsListe } from "../lib/routes/admin/profs/index";
import { gererAdminProfsCreer } from "../lib/routes/admin/profs/creer";
import { gererAdminProfsInviter } from "../lib/routes/admin/profs/inviter";
import { gererAdminProfsDesactiver } from "../lib/routes/admin/profs/[id]/desactiver";
import { gererAdminProfsReactiver } from "../lib/routes/admin/profs/[id]/reactiver";
import { gererAdminProfsResetMdp } from "../lib/routes/admin/profs/[id]/reset-mdp";
import { gererProfsMoi } from "../lib/routes/profs/moi";
import { gererAssignations } from "../lib/routes/assignations";
import { gererCatalogueGenerateurs } from "../lib/routes/catalogue-generateurs";
import { gererClasses } from "../lib/routes/classes";
import { gererClassesIdProfil } from "../lib/routes/classes/[id]/profil";
import { gererClassesRegenererCode } from "../lib/routes/classes/regenerer-code";
import { gererClassesRenommer } from "../lib/routes/classes/renommer";
import { gererConfig } from "../lib/routes/config";
import { gererConnexionEleve } from "../lib/routes/connexion-eleve";
import { gererEleves } from "../lib/routes/eleves";
import { gererElevesMesResultats } from "../lib/routes/eleves/mes-resultats";
import { gererElevesTableauDeBord } from "../lib/routes/eleves/tableau-de-bord";
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
import { gererReponses } from "../lib/routes/reponses";
import { gererReponsesAide } from "../lib/routes/reponses-aide";
import { gererReponsesDebutEcran } from "../lib/routes/reponses-debut-ecran";
import { gererTaches } from "../lib/routes/taches";
import { gererTachesApercu } from "../lib/routes/taches-apercu";
import { gererTachesId } from "../lib/routes/taches/[id]";

type Gestionnaire = (req: RequeteHttp, res: ReponseHttp, params: Record<string, string>) => Promise<void>;

/**
 * Repris de l'ancien pilote (`plateforme-maths-pilote/api/router.ts`), élagué en phase 1 puis
 * complété en phase 2 (contrat de générateur) : `POST /api/assignations`, `POST /api/reponses`,
 * `POST /api/reponses/aide` et `GET /api/eleves/tableau-de-bord` sont de nouveau routés, tous
 * adossés au registre unique de générateurs (`lib/registreGenerateurs.ts`). Toujours absents (jamais
 * copiés, décision actée 4 du prompt Phase 1) : `GET /api/profs/exercices/:id` (gen1 seulement) et
 * `GET /api/reponses/grille-info` (gen5/gen6). Restent différés, dépendants d'un générateur
 * curriculaire (phase 3) : `GET /api/taches/:id/impression`. `POST /api/taches/apercu` est routé depuis le RAPPORT §36.
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
  // Rôle admin-prof (RAPPORT §26) : chaque gestionnaire commence par `exigerAdmin` (401 / 403), avant toute validation.
  {
    methodes: ["GET"],
    chemin: "/api/admin/profs",
    correspond: (s) => s.length === 2 && s[0] === "admin" && s[1] === "profs",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererAdminProfsListe,
  },
  {
    methodes: ["POST"],
    chemin: "/api/admin/profs/creer",
    correspond: (s) => s.length === 3 && s[0] === "admin" && s[1] === "profs" && s[2] === "creer",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererAdminProfsCreer,
  },
  {
    methodes: ["POST"],
    chemin: "/api/admin/profs/inviter",
    correspond: (s) => s.length === 3 && s[0] === "admin" && s[1] === "profs" && s[2] === "inviter",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererAdminProfsInviter,
  },
  {
    methodes: ["POST"],
    chemin: "/api/admin/profs/:id/desactiver",
    correspond: (s) => s.length === 4 && s[0] === "admin" && s[1] === "profs" && s[3] === "desactiver",
    extraireParams: (s) => ({ id: s[2] }),
    gestionnaire: gererAdminProfsDesactiver,
  },
  {
    methodes: ["POST"],
    chemin: "/api/admin/profs/:id/reactiver",
    correspond: (s) => s.length === 4 && s[0] === "admin" && s[1] === "profs" && s[3] === "reactiver",
    extraireParams: (s) => ({ id: s[2] }),
    gestionnaire: gererAdminProfsReactiver,
  },
  {
    methodes: ["POST"],
    chemin: "/api/admin/profs/:id/reset-mdp",
    correspond: (s) => s.length === 4 && s[0] === "admin" && s[1] === "profs" && s[3] === "reset-mdp",
    extraireParams: (s) => ({ id: s[2] }),
    gestionnaire: gererAdminProfsResetMdp,
  },
  {
    methodes: ["GET"],
    chemin: "/api/profs/moi",
    correspond: (s) => s.length === 2 && s[0] === "profs" && s[1] === "moi",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererProfsMoi,
  },
  {
    methodes: ["POST"],
    chemin: "/api/assignations",
    correspond: (s) => s.length === 1 && s[0] === "assignations",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererAssignations,
  },
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
    chemin: "/api/eleves/tableau-de-bord",
    correspond: (s) => s.length === 2 && s[0] === "eleves" && s[1] === "tableau-de-bord",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererElevesTableauDeBord,
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
    chemin: "/api/reponses/aide",
    correspond: (s) => s.length === 2 && s[0] === "reponses" && s[1] === "aide",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererReponsesAide,
  },
  {
    methodes: ["POST"],
    chemin: "/api/reponses/debut-ecran",
    correspond: (s) => s.length === 2 && s[0] === "reponses" && s[1] === "debut-ecran",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererReponsesDebutEcran,
  },
  {
    methodes: ["POST"],
    chemin: "/api/reponses",
    correspond: (s) => s.length === 1 && s[0] === "reponses",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererReponses,
  },
  {
    methodes: ["GET", "POST"],
    chemin: "/api/taches",
    correspond: (s) => s.length === 1 && s[0] === "taches",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererTaches,
  },
  {
    // AVANT `/api/taches/:id` : sinon « apercu » serait lu comme un identifiant de tâche.
    methodes: ["POST"],
    chemin: "/api/taches/apercu",
    correspond: (s) => s.length === 2 && s[0] === "taches" && s[1] === "apercu",
    extraireParams: AUCUN_PARAM,
    gestionnaire: gererTachesApercu,
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
