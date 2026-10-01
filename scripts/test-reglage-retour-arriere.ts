// Test permanent — réglage « retour en arrière » d'une tâche (RAPPORT §37) : règle effective, validation du corps, persistance
// (POST / PATCH / GET /api/taches, aperçu), et discipline de migration (colonnes présentes dans schema.sql ET cumulatif.sql).
// Lancer : `npm run test-reglage-retour-arriere`. Sans réseau.

export {}; // module

import { readFileSync } from "node:fs";
import { appeler, creerScenario, installerBase } from "./support/harnaisRouteur";
import { retourArriereEffectif } from "../lib/moteurTentatives";
import { estCorpsValide } from "../lib/validationCorpsTaches";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

async function main(): Promise<void> {
  // ── 1. Règle effective : table de vérité complète ──
  for (const feedback of [true, false]) {
    for (const autorise of [true, false]) {
      verifier(retourArriereEffectif(feedback, autorise) === (!feedback && autorise), `retourArriereEffectif(${feedback}, ${autorise}) doit valoir ${!feedback && autorise}`);
    }
  }

  // ── 2. Validation du corps ──
  const base = { nom: "T", composition: [{ variante_id: "af_motif_racine_nulle_rationnelle", nombre_exercices: 1 }] };
  verifier(estCorpsValide({ ...base }), "corps sans le champ : valide (défaut false)");
  verifier(estCorpsValide({ ...base, feedback_immediat: false, autoriser_retour_arriere: true }), "retour + correction coupée : valide");
  verifier(estCorpsValide({ ...base, feedback_immediat: false, autoriser_retour_arriere: false, chrono_mode: "par_ecran" }), "pas de retour + chrono par écran : valide");
  verifier(estCorpsValide({ ...base, feedback_immediat: false, autoriser_retour_arriere: true, chrono_mode: "global", chrono_duree_secondes: 600 }), "retour + chrono global : valide (D6)");
  verifier(!estCorpsValide({ ...base, feedback_immediat: false, autoriser_retour_arriere: true, chrono_mode: "par_ecran" }), "retour + chrono par écran : REFUSÉ (D6)");
  verifier(!estCorpsValide({ ...base, autoriser_retour_arriere: true, chrono_mode: "par_ecran" }), "retour + chrono par écran : refusé même sous correction immédiate (aucune combinaison ambiguë)");
  for (const invalide of ["oui", 1, null, "true", []]) verifier(!estCorpsValide({ ...base, autoriser_retour_arriere: invalide }), `autoriser_retour_arriere = ${JSON.stringify(invalide)} : refusé (booléen exigé)`);

  // ── 3. Persistance par les routes ──
  const s = creerScenario();
  installerBase(s.base);
  const jeton = `prof:${s.profId}`;
  const composition = [{ variante_id: "af_motif_racine_nulle_rationnelle", nombre_exercices: 1 }];
  const creee = await appeler("taches", "POST", { jeton, corps: { nom: "Avec retour", feedback_immediat: false, autoriser_retour_arriere: true, composition } });
  verifier(creee.statut === 201, `POST avec retour : ${creee.statut}`);
  const sans = await appeler("taches", "POST", { jeton, corps: { nom: "Sans le champ", composition } });
  verifier(sans.statut === 201, `POST sans le champ : ${sans.statut}`);
  const refusee = await appeler("taches", "POST", { jeton, corps: { nom: "Conflit", feedback_immediat: false, autoriser_retour_arriere: true, chrono_mode: "par_ecran", composition } });
  verifier(refusee.statut === 400, `POST retour + chrono par écran : 400 attendu, reçu ${refusee.statut}`);
  const enBase = (id: string) => s.base.table("taches").find((t) => t.id === id);
  verifier(enBase(creee.corps.id)?.autoriser_retour_arriere === true, "colonne écrite à true");
  verifier(enBase(sans.corps.id)?.autoriser_retour_arriere === false, "défaut false quand le champ est absent");
  verifier(s.base.table("taches").length === 2, "le POST refusé n'a rien écrit");

  const liste = await appeler("taches", "GET", { jeton });
  const parNom = (nom: string) => (liste.corps.taches ?? liste.corps).find((t: { nom: string }) => t.nom === nom);
  verifier(parNom("Avec retour")?.autoriser_retour_arriere === true && parNom("Sans le champ")?.autoriser_retour_arriere === false, "GET /api/taches renvoie le réglage (pré-remplissage édition / duplication)");

  const idA = creee.corps.id as string;
  const patch = await appeler(`taches/${idA}`, "PATCH", { jeton, corps: { nom: "Avec retour", feedback_immediat: false, autoriser_retour_arriere: false, composition } });
  verifier(patch.statut === 200 && enBase(idA)?.autoriser_retour_arriere === false, `PATCH retire le retour : ${patch.statut}`);
  const patch2 = await appeler(`taches/${idA}`, "PATCH", { jeton, corps: { nom: "Avec retour", feedback_immediat: false, autoriser_retour_arriere: true, chrono_mode: "par_ecran", composition } });
  verifier(patch2.statut === 400 && enBase(idA)?.autoriser_retour_arriere === false, `PATCH retour + chrono par écran : refusé et rien écrit (${patch2.statut})`);

  const apercu = await appeler("taches/apercu", "POST", { jeton, corps: { nom: "Aperçu", feedback_immediat: false, autoriser_retour_arriere: true, composition } });
  verifier(apercu.statut === 200 || apercu.statut === 201, `aperçu : ${apercu.statut}`);
  verifier(s.base.table("taches").some((t) => t.est_apercu === true && t.autoriser_retour_arriere === true), "la tâche d'aperçu porte le réglage du formulaire");

  // ── 4. Discipline de migration (CLAUDE.md) : chaque colonne dans schema.sql ET cumulatif.sql, idempotente ──
  const schema = readFileSync("supabase/schema.sql", "utf8");
  const cumulatif = readFileSync("supabase/migrations/cumulatif.sql", "utf8");
  verifier(/autoriser_retour_arriere boolean not null default false/.test(schema), "schema.sql : taches.autoriser_retour_arriere");
  verifier(/remis_le timestamptz/.test(schema), "schema.sql : exercices_assignes.remis_le");
  verifier(/alter table taches add column if not exists autoriser_retour_arriere boolean not null default false;/.test(cumulatif), "cumulatif.sql : taches.autoriser_retour_arriere (idempotent)");
  verifier(/alter table exercices_assignes add column if not exists remis_le timestamptz;/.test(cumulatif), "cumulatif.sql : exercices_assignes.remis_le (idempotent)");

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 30)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (règle effective, validation, POST/PATCH/GET/aperçu, colonnes SQL dans schema.sql ET cumulatif.sql)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
