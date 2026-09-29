/**
 * RLS (RAPPORT §22) : `invitations_prof` et `profs` ont RLS activé et AUCUNE police, dans `schema.sql` ET dans
 * `cumulatif.sql` (le seul fichier qui s'exécute réellement : CLAUDE.md, discipline de migration). Test STATIQUE
 * (lecture des deux fichiers) : le comportement réel de PostgreSQL (anon sans accès, service_role intact) a été
 * vérifié à part sur un cluster local — voir RAPPORT §22-C ; ce test verrouille que le SQL le reste.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..");
let nb = 0;
const echecs: string[] = [];
const verifier = (c: boolean, m: string) => {
  nb++;
  if (!c) echecs.push(m);
};

const PROTEGEES = ["invitations_prof", "profs"];
// Tables SANS RLS à ce jour : décision différée (RAPPORT §22-D). Ajouter RLS à l'une d'elles doit sortir d'ici.
const SANS_RLS_DIFFERE = ["aides_utilisees", "classes", "debuts_ecran", "eleves", "exercices_assignes", "inscriptions", "reponses", "taches", "taches_assignations", "taches_assignations_eleves", "taches_composition"];

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
  verifier(JSON.stringify(sansRls) === JSON.stringify(SANS_RLS_DIFFERE), `${nom} : tables sans RLS = ${JSON.stringify(sansRls)}, attendu (différé) ${JSON.stringify(SANS_RLS_DIFFERE)}`);
}
verifier(JSON.stringify(creees["schema.sql"]) === JSON.stringify(creees["cumulatif.sql"]), `schema.sql et cumulatif.sql doivent créer les mêmes tables : ${JSON.stringify(creees)}`);

// Témoin du détecteur : il voit bien l'absence d'une instruction.
const sansLigne = "create table profs (id int);\ncreate table invitations_prof (code text);\nalter table profs enable row level security;";
verifier(JSON.stringify(tablesAvecRls(sansLigne)) === JSON.stringify(["profs"]), "témoin : une table sans `enable row level security` ne doit pas être comptée");
verifier(tablesAvecRls("-- alter table x enable row level security;".replace(/--[^\n]*/g, "")).length === 0, "témoin : une instruction en commentaire ne compte pas");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(" - " + e);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (RLS invitations_prof/profs, sans police, schema.sql = cumulatif.sql)`);
