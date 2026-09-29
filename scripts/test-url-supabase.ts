/**
 * SUPABASE_URL avec suffixe d'API (RAPPORT §25) : le client Supabase ajoute LUI-MÊME /rest/v1, /auth/v1… ; une
 * variable d'environnement terminée par /rest/v1/ doublait le chemin (PGRST125 « Invalid path »). Vérifie
 * (1) la normalisation, (2) l'avertissement (une fois par valeur), (3) les VRAIES requêtes émises par le vrai client
 * (`supabaseAdmin()`, `fetch` simulé), (4) `GET /api/config`, (5) le témoin : sans normalisation le chemin est bien doublé.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireSupabaseUrl, normaliserUrlSupabase } from "../lib/urlSupabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { gererConfig } from "../lib/routes/config";

let nb = 0;
const echecs: string[] = [];
const verifier = (c: boolean, m: string) => {
  nb++;
  if (!c) echecs.push(m);
};

const BASE = "https://abcdefghij.supabase.co";
const jwt = "e30." + Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") + ".sig";

// --- 1. Normalisation pure ---
const CAS: [string, string | undefined, string, boolean][] = [
  ["valeur correcte", BASE, BASE, false],
  ["barre finale seule", BASE + "/", BASE, false],
  ["/rest/v1/ (le cas réel)", BASE + "/rest/v1/", BASE, true],
  ["/rest/v1 sans barre", BASE + "/rest/v1", BASE, true],
  ["/REST/V1/ en majuscules", BASE + "/REST/V1/", BASE, true],
  ["/auth/v1/", BASE + "/auth/v1/", BASE, true],
  ["/storage/v1", BASE + "/storage/v1", BASE, true],
  ["/realtime/v1/ et /functions/v1", BASE + "/functions/v1", BASE, true],
  ["espaces / saut de ligne autour", `  ${BASE}/rest/v1/\n`, BASE, true],
  ["barres multiples avant le suffixe", BASE + "//rest/v1//", BASE, true],
  ["hôte local avec port", "http://127.0.0.1:54321/rest/v1/", "http://127.0.0.1:54321", true],
  ["un autre chemin n'est PAS touché", BASE + "/rest/v2", BASE + "/rest/v2", false],
  ["/rest/v1 au milieu n'est PAS touché", BASE + "/rest/v1/x", BASE + "/rest/v1/x", false],
  ["chemin de proxy conservé", "https://proxy.exemple.fr/supabase/rest/v1/", "https://proxy.exemple.fr/supabase", true],
  ["absente", undefined, "", false],
  ["vide", "   ", "", false],
];
for (const [nom, brute, attendu, retire] of CAS) {
  const r = normaliserUrlSupabase(brute);
  verifier(r.url === attendu && r.suffixeRetire === retire, `normalisation « ${nom} » : obtenu ${JSON.stringify(r)}, attendu url=${JSON.stringify(attendu)} suffixeRetire=${retire}`);
}

// --- 2. Avertissement : une fois par valeur brute, seulement si un suffixe est retiré ---
const avertissements: string[] = [];
const warnOrigine = console.warn;
console.warn = (...a: unknown[]) => void avertissements.push(a.join(" "));
lireSupabaseUrl({ SUPABASE_URL: BASE } as NodeJS.ProcessEnv);
verifier(avertissements.length === 0, "valeur correcte : aucun avertissement");
lireSupabaseUrl({ SUPABASE_URL: BASE + "/rest/v1/" } as NodeJS.ProcessEnv);
lireSupabaseUrl({ SUPABASE_URL: BASE + "/rest/v1/" } as NodeJS.ProcessEnv);
verifier(avertissements.length === 1 && /SUPABASE_URL/.test(avertissements[0]) && avertissements[0].includes("/rest/v1/") && avertissements[0].includes(`"${BASE}"`), `suffixe : UN avertissement qui nomme le suffixe et l'URL corrigée (${JSON.stringify(avertissements)})`);
lireSupabaseUrl({ SUPABASE_URL: BASE + "/auth/v1" } as NodeJS.ProcessEnv);
verifier(avertissements.length === 2, "une autre valeur fautive : un nouvel avertissement");
console.warn = warnOrigine;

// --- 3. Vraies requêtes du vrai client, avec la variable fautive ---
async function cheminsEmis(fabrique: () => any): Promise<string[]> {
  const vus: string[] = [];
  const fetchOrigine = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    vus.push(new URL(String(input?.url ?? input)).pathname);
    return new Response(JSON.stringify({ access_token: "t", refresh_token: "r", user: { id: "u" } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const c = fabrique();
    await c.from("invitations_prof").select("code, utilise").eq("code", "x").maybeSingle();
    await c.auth.signInWithPassword({ email: "a@b.fr", password: "pppppp" });
  } finally {
    globalThis.fetch = fetchOrigine;
  }
  return vus;
}
process.env.SUPABASE_SERVICE_ROLE_KEY = jwt;
(async () => {
  for (const fautive of [BASE + "/rest/v1/", BASE + "/rest/v1", BASE + "/auth/v1/", BASE + "/", BASE]) {
    process.env.SUPABASE_URL = fautive;
    console.warn = () => {};
    const chemins = await cheminsEmis(() => supabaseAdmin());
    console.warn = warnOrigine;
    verifier(JSON.stringify(chemins) === JSON.stringify(["/rest/v1/invitations_prof", "/auth/v1/token"]), `supabaseAdmin() avec SUPABASE_URL=${fautive} : chemins émis ${JSON.stringify(chemins)}`);
  }

  // --- 4. GET /api/config sert l'URL normalisée au navigateur (qui construit /auth/v1 lui-même) ---
  process.env.SUPABASE_URL = BASE + "/rest/v1/";
  process.env.SUPABASE_ANON_KEY = "anon-publique";
  console.warn = () => {};
  let corps: any = null;
  let statut = 0;
  await gererConfig({ method: "GET", headers: {} } as any, { status(c: number) { statut = c; return this; }, json(o: unknown) { corps = o; } } as any, {} as any);
  console.warn = warnOrigine;
  verifier(statut === 200 && corps.supabaseUrl === BASE && corps.supabaseAnonKey === "anon-publique", `GET /api/config : ${statut} ${JSON.stringify(corps)}`);

  // --- 5. Témoin : SANS normalisation, le vrai client double bien le chemin (le défaut d'origine) ---
  const sans = await cheminsEmis(() => createClient(BASE + "/rest/v1/", jwt, { auth: { persistSession: false } }));
  verifier(JSON.stringify(sans) === JSON.stringify(["/rest/v1/rest/v1/invitations_prof", "/rest/v1/auth/v1/token"]), `témoin : sans normalisation les chemins sont doublés (${JSON.stringify(sans)})`);

  // --- 6. Variables absentes : même erreur qu'avant ---
  delete process.env.SUPABASE_URL;
  let message = "";
  try { supabaseAdmin(); } catch (e) { message = (e as Error).message; }
  verifier(/SUPABASE_URL \/ SUPABASE_SERVICE_ROLE_KEY manquants/.test(message), "URL absente : l'erreur d'origine est conservée");

  // --- 7. Personne d'autre ne lit process.env.SUPABASE_URL (sinon la normalisation serait contournée) ---
  const racine = join(__dirname, "..");
  const fichiers = (d: string): string[] => readdirSync(join(racine, d)).flatMap((n) => { const r = `${d}/${n}`; return statSync(join(racine, r)).isDirectory() ? fichiers(r) : r.endsWith(".ts") ? [r] : []; });
  const lecteurs = ["lib", "api", "src"].flatMap(fichiers).filter((f) => /process\.env\.SUPABASE_URL|env\.SUPABASE_URL/.test(readFileSync(join(racine, f), "utf8"))).sort();
  // lib/diagInvitation.ts : diagnostic TEMPORAIRE (RAPPORT §24), lit la valeur BRUTE exprès pour afficher l'hôte réel ; à retirer de cette liste avec lui.
  verifier(JSON.stringify(lecteurs) === JSON.stringify(["lib/diagInvitation.ts", "lib/urlSupabase.ts"]), `lecteurs de SUPABASE_URL : ${JSON.stringify(lecteurs)} (seul lib/urlSupabase.ts doit la lire ; lib/diagInvitation.ts est temporaire)`);

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (SUPABASE_URL avec suffixe d'API normalisée, requêtes réelles non doublées, avertissement une fois)`);
})();
