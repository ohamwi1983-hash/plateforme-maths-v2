/**
 * RLS (RAPPORT §22 et §23) : LES 13 tables du pilote ont RLS activé et AUCUNE police, dans `schema.sql` ET dans
 * `cumulatif.sql` (le seul fichier qui s'exécute réellement : CLAUDE.md, discipline de migration). Toute NOUVELLE
 * table sans `enable row level security` fait échouer ce test. Test STATIQUE (lecture des fichiers) : le comportement
 * réel de PostgreSQL (anon sans accès, service_role intact) a été vérifié à part sur un cluster local — voir
 * RAPPORT §22-C et §23-C ; ce test verrouille que le SQL le reste.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..");
let nb = 0;
const echecs: string[] = [];
const verifier = (c: boolean, m: string) => {
  nb++;
  if (!c) echecs.push(m);
};

// Liste FIGÉE des tables du pilote : ajouter une table impose de l'ajouter ici ET d'activer RLS dans les deux fichiers.
const PROTEGEES = ["aides_utilisees", "classes", "debuts_ecran", "eleves", "exercices_assignes", "inscriptions", "invitations_prof", "profs", "reponses", "taches", "taches_assignations", "taches_assignations_eleves", "taches_composition"];

function sansCommentaires(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}
const tablesCreees = (sql: string) => [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_]+)/gi)].map((m) => m[1]).sort();
const tablesAvecRls = (sql: string) => [...sql.matchAll(/alter\s+table\s+([a-z_]+)\s+enable\s+row\s+level\s+security\s*;/gi)].map((m) => m[1]).sort();

const FICHIERS = { "supabase/schema.sql": "schema.sql", "supabase/migrations/cumulatif.sql": "cumulatif.sql" };
const creees: Record<string, string[]> = {};
for (const [chemin, nom] of Object.entries(FICHIERS)) {
  const sql = sansCommentaires(readFileSync(join(RACINE, chemin), "utf8"));
  creees[nom] = tablesCreees(sql);
  const rls = tablesAvecRls(sql);
  verifier(JSON.stringify(rls) === JSON.stringify([...PROTEGEES].sort()), `${nom} : tables avec RLS = ${JSON.stringify(rls)}, attendu ${JSON.stringify(PROTEGEES)}`);
  for (const t of PROTEGEES) verifier(creees[nom].includes(t), `${nom} : la table protégée ${t} doit y être créée`);
  verifier(!/create\s+policy/i.test(sql), `${nom} : AUCUNE police attendue (une police sur invitations_prof/profs rouvrirait l'accès anon)`);
  verifier(!/disable\s+row\s+level\s+security/i.test(sql), `${nom} : RLS ne doit jamais être désactivé`);
  const sansRls = creees[nom].filter((t) => !rls.includes(t));
  verifier(sansRls.length === 0, `${nom} : tables créées SANS RLS : ${JSON.stringify(sansRls)}`);
  verifier(JSON.stringify(creees[nom]) === JSON.stringify([...PROTEGEES].sort()), `${nom} : tables créées ${JSON.stringify(creees[nom])} ≠ liste figée`);
}
verifier(JSON.stringify(creees["schema.sql"]) === JSON.stringify(creees["cumulatif.sql"]), `schema.sql et cumulatif.sql doivent créer les mêmes tables : ${JSON.stringify(creees)}`);

// Piège du client serveur (RAPPORT §23-D) : après `signInWithPassword`, `admin.from(...)` du MÊME client part avec le JWT
// de l'utilisateur (rôle `authenticated`, donc RLS sans police = 0 ligne / écriture refusée), plus avec la clé
// `service_role`. Aucun accès aux données ne doit suivre un `signInWithPassword` dans un même fichier de route
// (`admin.auth.admin.*` est épargné : il garde la clé de service — mesuré).
function fichiersTs(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    return statSync(join(RACINE, rel)).isDirectory() ? fichiersTs(rel) : rel.endsWith(".ts") ? [rel] : [];
  });
}
// Découverte automatique : un NOUVEAU fichier qui appelle `signInWithPassword` est contrôlé aussi.
const sansCommentairesTs = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const routes = ["lib", "api", "src"].flatMap(fichiersTs).filter((f) => sansCommentairesTs(readFileSync(join(RACINE, f), "utf8")).includes(".signInWithPassword("));
verifier(routes.length === 3, `fichiers appelant signInWithPassword : ${JSON.stringify(routes)} (3 attendus ; un nouveau doit être examiné)`);
for (const chemin of routes) {
  const src = sansCommentairesTs(readFileSync(join(RACINE, chemin), "utf8"));
  const i = src.indexOf(".signInWithPassword(");
  const apres = src.slice(i);
  verifier(!/\.(from|rpc)\(/.test(apres), `${chemin} : accès aux données APRÈS signInWithPassword (le client enverrait le JWT utilisateur, plus service_role)`);
  verifier(!/provisionner(Eleve|Prof)\(/.test(apres), `${chemin} : provisionnerEleve/provisionnerProf APRÈS signInWithPassword`);
}

const suspect = "await admin.auth.signInWithPassword({});\nawait admin.from(\"eleves\").select();";
verifier(/\.(from|rpc)\(/.test(suspect.slice(suspect.indexOf(".signInWithPassword("))), "témoin : un accès aux données après signInWithPassword doit être détecté");

// Témoin du détecteur : il voit bien l'absence d'une instruction.
const sansLigne = "create table profs (id int);\ncreate table invitations_prof (code text);\nalter table profs enable row level security;";
verifier(JSON.stringify(tablesAvecRls(sansLigne)) === JSON.stringify(["profs"]), "témoin : une table sans `enable row level security` ne doit pas être comptée");
verifier(tablesAvecRls("-- alter table x enable row level security;".replace(/--[^\n]*/g, "")).length === 0, "témoin : une instruction en commentaire ne compte pas");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(" - " + e);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (RLS sur les 13 tables, sans police, schema.sql = cumulatif.sql, pas d'accès aux données après signInWithPassword)`);
