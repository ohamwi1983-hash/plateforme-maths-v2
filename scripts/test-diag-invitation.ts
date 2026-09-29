// TEMPORAIRE (RAPPORT §24) — supprimer avec `lib/diagInvitation.ts`. Vérifie que le diagnostic DIAG-INVITATION
// (1) n'altère jamais la réponse de la route, (2) distingue « aucune ligne » de « erreur de requête »,
// (3) journalise les points de code du code reçu et le nombre de lignes vues, (4) ne fuit ni mot de passe, ni email, ni code stocké.
export {};

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
type Ligne = Record<string, any>;
const STOCKE = "f396a771-9370-4a17-a686-6bf8ab89e090";
let nb = 0;
function verifier(c: boolean, m: string) {
  nb++;
  if (!c) throw new Error("ÉCHEC : " + m);
}

async function tenter(codeSaisi: string, mode: "normal" | "erreur-requete" | "table-vide") {
  const tables: Record<string, Ligne[]> = { invitations_prof: mode === "table-vide" ? [] : [{ code: STOCKE, utilise: false }], profs: [] };
  const admin: any = {
    auth: { admin: { createUser: async () => ({ data: { user: { id: "u1" } }, error: null }) }, signInWithPassword: async () => ({ data: { session: { access_token: "t", refresh_token: "r" } }, error: null }) },
    from(table: string) {
      const filtres: ((l: Ligne) => boolean)[] = [];
      const chaine: any = {
        select: () => chaine,
        limit: () => chaine,
        eq: (col: string, val: unknown) => (filtres.push((l) => l[col] === val), chaine),
        maybeSingle: () => Promise.resolve(mode === "erreur-requete" ? { data: null, error: { message: "Invalid API key", code: "PGRST301", details: null, hint: "Double check your Supabase `anon` or `service_role` API key." } } : { data: tables[table].filter((l) => filtres.every((f) => f(l)))[0] ?? null, error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        then: (resolve: any) => resolve({ data: tables[table], error: null, count: tables[table].length }),
      };
      return chaine;
    },
  };
  require.cache[cheminSupabaseAdmin] = { id: cheminSupabaseAdmin, filename: cheminSupabaseAdmin, loaded: true, exports: { supabaseAdmin: () => admin, profAuthentifie: async () => null, eleveAuthentifie: async () => null } } as any;
  delete require.cache[require.resolve("../lib/routes/inscription-prof")];
  delete require.cache[require.resolve("../lib/diagInvitation")];
  const { gererInscriptionProf } = require("../lib/routes/inscription-prof");
  const journal: string[] = [];
  const origine = console.log;
  console.log = (...a: unknown[]) => void journal.push(a.join(" "));
  let statut = 0;
  let corps: any = null;
  try {
    await gererInscriptionProf({ method: "POST", headers: {}, body: { codeInvitation: codeSaisi, email: "secret.prof@exemple.fr", motDePasse: "MotDePasse-Secret-1", nom: "Test" } }, { status(c: number) { statut = c; return this; }, json(o: unknown) { corps = o; } }, {});
  } finally {
    console.log = origine;
  }
  const lignes = journal.filter((l) => l.startsWith("DIAG-INVITATION ")).map((l) => JSON.parse(l.slice("DIAG-INVITATION ".length)));
  return { statut, corps, lignes, brut: journal.join("\n") };
}

(async () => {
  // Code exact : la route réussit comme avant, aucune lecture de contrôle.
  const ok = await tenter(STOCKE, "normal");
  verifier(ok.statut === 201, `code exact : 201 attendu, obtenu ${ok.statut}`);
  verifier(ok.lignes.map((l) => l.etape).join() === "avant,apres" && ok.lignes[1].decision === "TROUVE", "code exact : étapes avant,apres et décision TROUVE (pas de contrôle superflu)");

  // Majuscule initiale : 404 inchangé ; le diagnostic voit UNE ligne, égale sans casse mais pas exactement.
  const maj = await tenter("F" + STOCKE.slice(1), "normal");
  verifier(maj.statut === 404 && maj.corps.erreur === "Code d'invitation invalide", "majuscule : réponse 404 inchangée");
  const [avant, apres, controle] = maj.lignes;
  verifier(avant.recu === "F" + STOCKE.slice(1) && avant.pointsDeCodeRecu[0] === "0046" && avant.pointsDeCodeRecu.length === 36, "majuscule : le code reçu et ses points de code (U+0046 en tête, 36 caractères) sont journalisés");
  verifier(apres.decision === "AUCUNE_LIGNE" && apres.erreurRequete === null, "majuscule : « aucune ligne » distinct d'une erreur de requête");
  verifier(controle.nombreLignesVues === 1 && controle.lignes[0].egalExact === false && controle.lignes[0].egalSansCasse === true && controle.lignes[0].longueurStocke === 36, "majuscule : 1 ligne vue, égale sans casse mais pas exactement");
  verifier(!maj.brut.includes(STOCKE), "le code STOCKÉ n'est jamais écrit dans les logs");

  // Espaces + caractère invisible : longueurs avant/après trim et point de code U+200B visibles.
  const inv = await tenter(`  ${STOCKE}​ `, "normal");
  verifier(inv.lignes[0].longueurRecu === 40 && inv.lignes[0].longueurApresTrim === 37 && inv.lignes[0].pointsDeCodeRecu.includes("200b"), "espaces + U+200B : longueurs 40 -> 37 et point de code 200b visibles");

  // Erreur de requête (mauvaise clé) : MÊME 404 pour le client, mais le log dit ERREUR_DE_REQUETE avec code/message/hint.
  const err = await tenter(STOCKE, "erreur-requete");
  verifier(err.statut === 404 && err.corps.erreur === "Code d'invitation invalide", "erreur de requête : réponse client inchangée (même 404)");
  verifier(err.lignes[1].decision === "ERREUR_DE_REQUETE" && err.lignes[1].erreurRequete.code === "PGRST301" && /Invalid API key/.test(err.lignes[1].erreurRequete.message), "erreur de requête : distinguée de « aucune ligne », code et message journalisés");

  // Table vue vide (RLS avec une clé sans droit, ou mauvais projet) : 0 ligne vue.
  const vide = await tenter(STOCKE, "table-vide");
  verifier(vide.lignes[2].nombreLignesVues === 0 && vide.lignes[2].compteExact === 0, "table vue vide : nombreLignesVues = 0");

  // Aucune fuite de secret.
  for (const t of [ok, maj, inv, err, vide]) verifier(!/MotDePasse-Secret|secret\.prof@/.test(t.brut), "ni mot de passe ni email dans les logs");
  console.log(`OK : ${nb} vérifications (diagnostic DIAG-INVITATION temporaire : réponse inchangée, cas distingués, aucune fuite)`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
