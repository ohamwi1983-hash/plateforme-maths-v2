/**
 * Rôle admin-prof (RAPPORT §26) : les VRAIS gestionnaires (`api/router.ts`) contre la base en mémoire. Chaque route
 * admin est testée en rejet explicite pour un non-admin (403), pour un non-authentifié / élève / compte désactivé (401),
 * puis dans son scénario nominal et ses garde-fous (jamais soi-même, jamais un autre admin, jamais est_admin par l'API).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { appeler, creerScenario, installerBase } from "./support/harnaisRouteur";
import { profAuthentifie } from "../lib/supabaseAdmin";
import { provisionnerProf } from "../lib/provisionnerProf";

let nb = 0;
const echecs: string[] = [];
const verifier = (c: boolean, m: string) => {
  nb++;
  if (!c) echecs.push(m);
};
const UUID_INEXISTANT = "00000000-0000-4000-8000-000000000000";

function monter() {
  const s = creerScenario(); // prof-1, prof-2, classe-1 (de prof-1), eleve-1, eleve-2
  const b = s.base;
  const profs = b.table("profs");
  const ajouter = (id: string, nom: string, email: string, extra: Record<string, unknown> = {}) => {
    const ligne = profs.find((p) => p.id === id) ?? b.inserer("profs", { id });
    Object.assign(ligne, { nom, ...extra });
    b.utilisateursAuth.set(id, { id, email, password: "ancien-mdp", banni: null });
  };
  ajouter("prof-1", "Alice Admin", "alice@ecole.be", { est_admin: true, actif: true }); // admin appelant
  ajouter("prof-2", "Bob Ordinaire", "bob@ecole.be", { est_admin: false, actif: true }); // prof ordinaire (cible)
  ajouter("prof-3", "Carl Autre-Admin", "carl@ecole.be", { est_admin: true, actif: true }); // autre admin
  ajouter("prof-4", "Dana Inactive", "dana@ecole.be", { est_admin: false, actif: false }); // désactivée
  ajouter("prof-5", "Eve AdminInactive", "eve@ecole.be", { est_admin: true, actif: false }); // admin désactivé
  b.inserer("classes", { id: "classe-bob", prof_id: "prof-2", nom: "Classe de Bob" });
  installerBase(b);
  return { ...s, b };
}


async function main() {
  const { b } = monter();
  // Les identifiants doivent être des UUID pour passer le contrôle de forme : on remplace prof-N par des UUID fixes.
  const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  for (const [i, ancien] of ["prof-1", "prof-2", "prof-3", "prof-4", "prof-5"].entries()) {
    const nouveau = uuid(i + 1);
    for (const p of b.table("profs")) if (p.id === ancien) p.id = nouveau;
    const u = b.utilisateursAuth.get(ancien)!;
    b.utilisateursAuth.delete(ancien);
    b.utilisateursAuth.set(nouveau, { ...u, id: nouveau });
    for (const c of b.table("classes")) if (c.prof_id === ancien) c.prof_id = nouveau;
  }
  const [ID_A, ID_BOB, ID_CARL, ID_DANA] = [uuid(1), uuid(2), uuid(3), uuid(4)];
  const jA = `prof:${ID_A}`, jBob = `prof:${ID_BOB}`, jDana = `prof:${ID_DANA}`, jEve = `prof:${uuid(5)}`;

  const etat = () => JSON.stringify({ profs: b.table("profs"), inv: b.table("invitations_prof"), auth: [...b.utilisateursAuth.values()], appels: b.appelsAuth.length });

  // ---------- 1. Chaque route admin : 401 / 403 explicites, sans aucun effet de bord ----------
  const ROUTES: { nom: string; chemin: string; methode: string; corps?: unknown }[] = [
    { nom: "GET liste", chemin: "admin/profs", methode: "GET" },
    { nom: "POST creer", chemin: "admin/profs/creer", methode: "POST", corps: { email: "x@ecole.be", motDePasse: "secret12", nom: "X" } },
    { nom: "POST inviter", chemin: "admin/profs/inviter", methode: "POST", corps: { email: "x@ecole.be" } },
    { nom: "POST desactiver", chemin: `admin/profs/${ID_BOB}/desactiver`, methode: "POST", corps: {} },
    { nom: "POST reactiver", chemin: `admin/profs/${ID_BOB}/reactiver`, methode: "POST", corps: {} },
    { nom: "POST reset-mdp", chemin: `admin/profs/${ID_BOB}/reset-mdp`, methode: "POST", corps: { nouveauMotDePasse: "nouveau12" } },
  ];
  const avant = etat();
  for (const r of ROUTES) {
    const sans = await appeler(r.chemin, r.methode, { corps: r.corps });
    verifier(sans.statut === 401 && sans.corps.erreur === "Non authentifié", `${r.nom} sans jeton : 401 attendu, obtenu ${sans.statut} ${JSON.stringify(sans.corps)}`);
    const eleve = await appeler(r.chemin, r.methode, { jeton: "eleve:eleve-1", corps: r.corps });
    verifier(eleve.statut === 401, `${r.nom} jeton élève : 401 attendu, obtenu ${eleve.statut}`);
    const ordinaire = await appeler(r.chemin, r.methode, { jeton: jBob, corps: r.corps });
    verifier(ordinaire.statut === 403 && ordinaire.corps.erreur === "Réservé aux administrateurs", `${r.nom} prof NON admin : 403 explicite attendu, obtenu ${ordinaire.statut} ${JSON.stringify(ordinaire.corps)}`);
    const ordinaireCorpsInvalide = await appeler(r.chemin, r.methode, { jeton: jBob, corps: { n_importe: "quoi" } });
    verifier(ordinaireCorpsInvalide.statut === 403, `${r.nom} prof NON admin + corps invalide : 403 AVANT toute validation, obtenu ${ordinaireCorpsInvalide.statut}`);
    const inactif = await appeler(r.chemin, r.methode, { jeton: jEve, corps: r.corps });
    verifier(inactif.statut === 401, `${r.nom} admin DÉSACTIVÉ : 401 attendu, obtenu ${inactif.statut}`);
    const mauvaiseMethode = await appeler(r.chemin, r.methode === "GET" ? "POST" : "GET", { jeton: jA });
    verifier(mauvaiseMethode.statut === 405, `${r.nom} mauvaise méthode : 405 attendu, obtenu ${mauvaiseMethode.statut}`);
  }
  verifier(etat() === avant, "aucun effet de bord (profs, invitations, comptes Auth, appels Auth) après tous les rejets 401/403/405");

  // ---------- 2. GET /api/profs/moi ----------
  const moiAdmin = await appeler("profs/moi", "GET", { jeton: jA });
  verifier(moiAdmin.statut === 200 && moiAdmin.corps.est_admin === true && moiAdmin.corps.nom === "Alice Admin" && moiAdmin.corps.id === ID_A, `moi admin : ${JSON.stringify(moiAdmin.corps)}`);
  const moiOrdinaire = await appeler("profs/moi", "GET", { jeton: jBob });
  verifier(moiOrdinaire.statut === 200 && moiOrdinaire.corps.est_admin === false, `moi prof ordinaire : est_admin false attendu (${JSON.stringify(moiOrdinaire.corps)})`);
  verifier((await appeler("profs/moi", "GET", { jeton: jDana })).statut === 401, "moi compte désactivé : 401");
  verifier((await appeler("profs/moi", "GET")).statut === 401, "moi sans jeton : 401");

  // ---------- 3. Liste ----------
  const liste = await appeler("admin/profs", "GET", { jeton: jA });
  verifier(liste.statut === 200 && liste.corps.profs.length === 5, `liste : 5 profs attendus (${JSON.stringify(liste.corps).slice(0, 120)})`);
  const bobListe = liste.corps.profs.find((p: any) => p.id === ID_BOB);
  verifier(bobListe && bobListe.email === "bob@ecole.be" && bobListe.actif === true && bobListe.est_admin === false && bobListe.nom === "Bob Ordinaire", `liste : ligne de Bob ${JSON.stringify(bobListe)}`);
  const danaListe = liste.corps.profs.find((p: any) => p.id === ID_DANA);
  verifier(danaListe.actif === false, "liste : Dana apparaît inactive");
  verifier(liste.corps.profs.find((p: any) => p.id === ID_CARL).est_admin === true, "liste : Carl apparaît admin");
  verifier(JSON.stringify(liste.corps.profs.map((p: any) => p.nom)) === JSON.stringify([...liste.corps.profs.map((p: any) => p.nom)].sort((x: string, y: string) => x.localeCompare(y))), "liste : triée par nom");
  b.utilisateursAuth.delete(ID_DANA);
  const listeSansAuth = await appeler("admin/profs", "GET", { jeton: jA });
  verifier(listeSansAuth.statut === 200 && listeSansAuth.corps.profs.find((p: any) => p.id === ID_DANA).email === null, "liste : un compte Auth introuvable donne email null sans faire échouer la liste");
  b.utilisateursAuth.set(ID_DANA, { id: ID_DANA, email: "dana@ecole.be", password: "ancien-mdp", banni: null });

  // ---------- 4. Création directe ----------
  const cree = await appeler("admin/profs/creer", "POST", { jeton: jA, corps: { email: "  Nouveau@Ecole.be ", motDePasse: "secret12", nom: " Nina Nouvelle " } });
  verifier(cree.statut === 201 && cree.corps.nom === "Nina Nouvelle" && cree.corps.email === "Nouveau@Ecole.be", `création : ${cree.statut} ${JSON.stringify(cree.corps)}`);
  const ligneNina = b.table("profs").find((p) => p.id === cree.corps.id);
  verifier(!!ligneNina && ligneNina.nom === "Nina Nouvelle" && ligneNina.est_admin !== true && ligneNina.actif !== false, `création : ligne profs non admin et active (${JSON.stringify(ligneNina)})`);
  verifier(b.utilisateursAuth.has(cree.corps.id), "création : compte Auth créé");
  const moiNina = await appeler("profs/moi", "GET", { jeton: `prof:${cree.corps.id}` });
  verifier(moiNina.statut === 200 && moiNina.corps.est_admin === false, "création : la nouvelle prof est connectée non admin");
  for (const [nom, corps, statut] of [
    ["est_admin dans le corps", { email: "y@ecole.be", motDePasse: "secret12", nom: "Y", est_admin: true }, 400],
    ["actif dans le corps", { email: "y@ecole.be", motDePasse: "secret12", nom: "Y", actif: false }, 400],
    ["e-mail invalide", { email: "pas-un-email", motDePasse: "secret12", nom: "Y" }, 400],
    ["mot de passe trop court", { email: "y@ecole.be", motDePasse: "abc", nom: "Y" }, 400],
    ["nom vide", { email: "y@ecole.be", motDePasse: "secret12", nom: "  " }, 400],
    ["corps absent", null, 400],
    ["e-mail déjà pris (autre casse)", { email: "BOB@ecole.be", motDePasse: "secret12", nom: "Doublon" }, 409],
  ] as [string, unknown, number][]) {
    const r = await appeler("admin/profs/creer", "POST", { jeton: jA, corps });
    verifier(r.statut === statut, `création « ${nom} » : ${statut} attendu, obtenu ${r.statut} ${JSON.stringify(r.corps)}`);
    if (nom === "est_admin dans le corps") verifier(/est_admin/.test(r.corps.erreur), "création : le refus nomme est_admin");
  }
  verifier(b.table("profs").length === 6, `création refusée : aucune ligne profs supplémentaire (obtenu ${b.table("profs").length})`);
  verifier([...b.utilisateursAuth.values()].filter((u) => u.email.toLowerCase() === "bob@ecole.be").length === 1, "création en doublon : pas de second compte Auth");

  // ---------- 5. Invitation liée à un e-mail, puis inscription ----------
  const inv = await appeler("admin/profs/inviter", "POST", { jeton: jA, corps: { email: " Invitee@Ecole.be " } });
  verifier(inv.statut === 201 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(inv.corps.code) && inv.corps.email === "invitee@ecole.be", `invitation : ${inv.statut} ${JSON.stringify(inv.corps)}`);
  const ligneInv = b.table("invitations_prof").find((i) => i.code === inv.corps.code);
  verifier(!!ligneInv && ligneInv.email_cible === "invitee@ecole.be" && ligneInv.cree_par === ID_A && (ligneInv.utilise ?? false) === false, `invitation : ligne liée à l'e-mail, créée par l'admin, non utilisée (${JSON.stringify(ligneInv)})`);
  const inv2 = await appeler("admin/profs/inviter", "POST", { jeton: jA, corps: { email: "invitee@ecole.be" } });
  verifier(inv2.corps.code !== inv.corps.code, "invitation : deux codes distincts pour le même e-mail");
  for (const [nom, corps] of [["clé en trop", { email: "a@b.be", est_admin: true }], ["e-mail invalide", { email: "nope" }], ["e-mail absent", {}]] as [string, unknown][]) {
    const r = await appeler("admin/profs/inviter", "POST", { jeton: jA, corps });
    verifier(r.statut === 400, `invitation « ${nom} » : 400 attendu, obtenu ${r.statut}`);
  }
  const journalOrigine = console.log;
  console.log = () => {}; // le diagnostic DIAG-INVITATION (temporaire) écrit dans console.log
  const inscrire = (code: string, email: string) => appeler("inscription-prof", "POST", { corps: { codeInvitation: code, email, motDePasse: "secret12", nom: "Invitee" } });
  const mauvais = await inscrire(inv.corps.code, "intrus@ecole.be");
  verifier(mauvais.statut === 404 && mauvais.corps.erreur === "Code d'invitation invalide", `inscription avec un AUTRE e-mail : 404 générique attendu, obtenu ${mauvais.statut} ${JSON.stringify(mauvais.corps)}`);
  verifier(!b.utilisateursAuth.has("intrus") && ![...b.utilisateursAuth.values()].some((u) => u.email === "intrus@ecole.be"), "inscription refusée : aucun compte Auth créé");
  verifier(b.table("invitations_prof").find((i) => i.code === inv.corps.code)!.utilise !== true, "inscription refusée : code toujours utilisable");
  const inconnu = await inscrire("code-qui-n-existe-pas", "intrus@ecole.be");
  verifier(JSON.stringify(inconnu.corps) === JSON.stringify(mauvais.corps) && inconnu.statut === mauvais.statut, "e-mail discordant et code inexistant : réponses IDENTIQUES (aucun oracle)");
  const bon = await inscrire(inv.corps.code, "  INVITEE@ecole.be ");
  verifier(bon.statut === 201 && bon.corps.prof?.email === "INVITEE@ecole.be", `inscription avec le bon e-mail (casse/espaces ignorés) : 201 attendu, obtenu ${bon.statut} ${JSON.stringify(bon.corps)}`);
  const ligneInvitee = b.table("profs").find((p) => p.id === bon.corps.prof?.id);
  verifier(!!ligneInvitee && ligneInvitee.est_admin !== true, "inscription par invitation : jamais admin");
  verifier(b.table("invitations_prof").find((i) => i.code === inv.corps.code)!.utilise === true, "inscription réussie : code marqué utilisé");
  const reutilise = await inscrire(inv.corps.code, "invitee@ecole.be");
  verifier(reutilise.statut === 400 && /déjà été utilisé/.test(reutilise.corps.erreur), `code lié déjà utilisé + bon e-mail : 400 « déjà utilisé », obtenu ${reutilise.statut}`);
  const reutiliseMauvais = await inscrire(inv.corps.code, "intrus@ecole.be");
  verifier(reutiliseMauvais.statut === 404, "code lié déjà utilisé + AUTRE e-mail : 404 générique (l'état du code ne fuit pas)");
  b.inserer("invitations_prof", { code: "CODE-HISTORIQUE", utilise: false });
  const historique = await inscrire("CODE-HISTORIQUE", "n-importe-qui@ecole.be");
  verifier(historique.statut === 201, `code historique sans e-mail lié : utilisable par n'importe qui (201), obtenu ${historique.statut}`);
  console.log = journalOrigine;

  // ---------- 6. Désactivation ----------
  const ordinaireAvant = await appeler("classes", "GET", { jeton: jBob });
  verifier(ordinaireAvant.statut === 200, `Bob actif accède à ses routes (200), obtenu ${ordinaireAvant.statut}`);
  const desactive = await appeler(`admin/profs/${ID_BOB}/desactiver`, "POST", { jeton: jA, corps: {} });
  verifier(desactive.statut === 200 && desactive.corps.ok === true, `désactivation : ${desactive.statut} ${JSON.stringify(desactive.corps)}`);
  verifier(b.table("profs").find((p) => p.id === ID_BOB)!.actif === false, "désactivation : profs.actif = false");
  verifier(b.utilisateursAuth.get(ID_BOB)!.banni === "876000h", "désactivation : bannissement Supabase Auth demandé (876000h)");
  for (const [chemin, m] of [["classes", "GET"], ["profs/moi", "GET"], ["profs/tableau-de-bord", "GET"], ["taches", "GET"], ["catalogue-generateurs", "GET"]] as [string, string][]) {
    const r = await appeler(chemin, m, { jeton: jBob });
    verifier(r.statut === 401, `prof désactivé : ${m} /api/${chemin} refusé (401), obtenu ${r.statut}`);
  }
  verifier(b.table("classes").some((c) => c.id === "classe-bob"), "désactivation : la classe de Bob n'est PAS supprimée (jamais une suppression)");
  verifier((await appeler(`admin/profs/${ID_BOB}/desactiver`, "POST", { jeton: jA, corps: {} })).statut === 200, "désactivation répétée : idempotente (200)");
  const avantGardeFous = etat();
  const soi = await appeler(`admin/profs/${ID_A}/desactiver`, "POST", { jeton: jA, corps: {} });
  verifier(soi.statut === 403 && /propre compte/.test(soi.corps.erreur), `garde-fou : s'auto-désactiver = 403 explicite (${soi.statut} ${JSON.stringify(soi.corps)})`);
  const autreAdmin = await appeler(`admin/profs/${ID_CARL}/desactiver`, "POST", { jeton: jA, corps: {} });
  verifier(autreAdmin.statut === 403 && /administrateur/.test(autreAdmin.corps.erreur), `garde-fou : désactiver un autre admin = 403 explicite (${autreAdmin.statut})`);
  verifier((await appeler(`admin/profs/${UUID_INEXISTANT}/desactiver`, "POST", { jeton: jA, corps: {} })).statut === 404, "désactivation d'un id inconnu : 404");
  verifier((await appeler("admin/profs/pas-un-uuid/desactiver", "POST", { jeton: jA, corps: {} })).statut === 404, "désactivation d'un id mal formé : 404 (jamais une erreur PostgREST)");
  verifier(etat() === avantGardeFous, "garde-fous : aucun effet de bord des refus 403/404");
  b.echecProchaineMajAuth = "ban indisponible";
  const banEchoue = await appeler(`admin/profs/${ID_DANA}/desactiver`, "POST", { jeton: jA, corps: {} });
  verifier(banEchoue.statut === 500 && /bannissement/.test(banEchoue.corps.erreur) && banEchoue.corps.detail === "ban indisponible", `échec du bannissement : 500 explicite (${banEchoue.statut} ${JSON.stringify(banEchoue.corps)})`);
  verifier(b.table("profs").find((p) => p.id === ID_DANA)!.actif === false, "échec du bannissement : le compte reste refusé par l'API (actif=false)");

  // ---------- 7. Réactivation ----------
  b.echecProchaineMajAuth = "levée impossible";
  const leveeEchoue = await appeler(`admin/profs/${ID_BOB}/reactiver`, "POST", { jeton: jA, corps: {} });
  verifier(leveeEchoue.statut === 500 && b.table("profs").find((p) => p.id === ID_BOB)!.actif === false, "réactivation : échec de la levée du ban => 500 et le compte reste refusé");
  const reactive = await appeler(`admin/profs/${ID_BOB}/reactiver`, "POST", { jeton: jA, corps: {} });
  verifier(reactive.statut === 200 && b.table("profs").find((p) => p.id === ID_BOB)!.actif === true && b.utilisateursAuth.get(ID_BOB)!.banni === null, "réactivation : actif=true et ban levé");
  verifier((await appeler("classes", "GET", { jeton: jBob })).statut === 200, "réactivation : Bob retrouve l'accès");
  verifier((await appeler(`admin/profs/${UUID_INEXISTANT}/reactiver`, "POST", { jeton: jA, corps: {} })).statut === 404, "réactivation d'un id inconnu : 404");

  // ---------- 8. Réinitialisation du mot de passe ----------
  const reset = await appeler(`admin/profs/${ID_BOB}/reset-mdp`, "POST", { jeton: jA, corps: { nouveauMotDePasse: "tout-neuf-12" } });
  verifier(reset.statut === 200 && b.utilisateursAuth.get(ID_BOB)!.password === "tout-neuf-12", `reset-mdp : 200 et mot de passe changé (${reset.statut})`);
  verifier((await appeler(`admin/profs/${ID_BOB}/reset-mdp`, "POST", { jeton: jA, corps: { nouveauMotDePasse: "abc" } })).statut === 400, "reset-mdp : mot de passe trop court = 400");
  verifier((await appeler(`admin/profs/${ID_BOB}/reset-mdp`, "POST", { jeton: jA, corps: {} })).statut === 400, "reset-mdp : mot de passe absent = 400");
  const resetAdmin = await appeler(`admin/profs/${ID_CARL}/reset-mdp`, "POST", { jeton: jA, corps: { nouveauMotDePasse: "prise-de-controle" } });
  verifier(resetAdmin.statut === 403 && b.utilisateursAuth.get(ID_CARL)!.password === "ancien-mdp", `garde-fou : reset du mot de passe d'un autre admin = 403, mot de passe inchangé (${resetAdmin.statut})`);
  const resetSoi = await appeler(`admin/profs/${ID_A}/reset-mdp`, "POST", { jeton: jA, corps: { nouveauMotDePasse: "auto-reset-12" } });
  verifier(resetSoi.statut === 403 && b.utilisateursAuth.get(ID_A)!.password === "ancien-mdp", "garde-fou : reset de son propre mot de passe (admin) = 403 par cette voie");
  verifier((await appeler(`admin/profs/${UUID_INEXISTANT}/reset-mdp`, "POST", { jeton: jA, corps: { nouveauMotDePasse: "tout-neuf-12" } })).statut === 404, "reset-mdp d'un id inconnu : 404");

  // ---------- 9. est_admin n'est écrit par AUCUNE route ni bibliothèque ----------
  const racine = join(__dirname, "..");
  const fichiers = (d: string): string[] => readdirSync(join(racine, d)).flatMap((n) => { const r = `${d}/${n}`; return statSync(join(racine, r)).isDirectory() ? fichiers(r) : r.endsWith(".ts") ? [r] : []; });
  const ecrivains = ["lib", "api", "src"].flatMap(fichiers).filter((f) => /(insert|update|upsert)\s*\(\s*\{[^)]*est_admin/s.test(readFileSync(join(racine, f), "utf8")));
  verifier(ecrivains.length === 0, `est_admin ne doit être écrit par aucune route/bibliothèque : ${JSON.stringify(ecrivains)}`);
  const sourceProvisionnement = readFileSync(join(racine, "lib/provisionnerProf.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  verifier(!/est_admin|estAdmin/.test(sourceProvisionnement), "provisionnerProf ne connaît pas est_admin");

  // ---------- 10. Le vrai profAuthentifie (client factice) et provisionnerProf (compensation) ----------
  const colonnesLues: string[] = [];
  const clientAvec = (ligne: any, erreurLecture = false) => ({
    auth: { getUser: async (t: string) => (t === "jeton-valide" ? { data: { user: { id: "u1" } }, error: null } : { data: { user: null }, error: { message: "x" } }) },
    from: () => ({ select: (colonnes: string) => (colonnesLues.push(colonnes), { eq: () => ({ maybeSingle: async () => (erreurLecture ? { data: null, error: { message: "column est_admin does not exist" } } : { data: ligne, error: null }) }) }) }),
  }) as any;
  const H = "Bearer jeton-valide";
  const r1 = await profAuthentifie(H, clientAvec({ id: "u1", nom: "N", actif: true, est_admin: true }));
  verifier(!!r1 && r1.estAdmin === true && r1.nom === "N", "profAuthentifie réel : actif + admin");
  verifier(/\bactif\b/.test(colonnesLues[0] ?? "") && /\best_admin\b/.test(colonnesLues[0] ?? ""), `profAuthentifie réel : lit les colonnes actif ET est_admin (select « ${colonnesLues[0]} »)`);
  verifier((await profAuthentifie(H, clientAvec({ id: "u1", nom: "N", actif: false, est_admin: true }))) === null, "profAuthentifie réel : compte désactivé refusé, même admin");
  const r3 = await profAuthentifie(H, clientAvec({ id: "u1", nom: "N", actif: true, est_admin: false }));
  verifier(!!r3 && r3.estAdmin === false, "profAuthentifie réel : prof ordinaire");
  verifier((await profAuthentifie(H, clientAvec(null))) === null, "profAuthentifie réel : pas de ligne profs = refusé");
  verifier((await profAuthentifie(H, clientAvec(null, true))) === null, "profAuthentifie réel : erreur de lecture (colonne absente avant migration) = refusé");
  verifier((await profAuthentifie("Bearer autre", clientAvec({ id: "u1", actif: true }))) === null && (await profAuthentifie(undefined, clientAvec({ id: "u1" }))) === null, "profAuthentifie réel : jeton invalide / absent refusé");
  const supprimes: string[] = [];
  const clientCompense = (echecSuppression: boolean) => ({
    auth: { admin: { createUser: async () => ({ data: { user: { id: "cree-1" } }, error: null }), deleteUser: async (id: string) => { supprimes.push(id); return { error: echecSuppression ? { message: "suppression impossible" } : null }; } } },
    from: () => ({ insert: async () => ({ error: { message: "insert refusé" } }) }),
  }) as any;
  const c1 = await provisionnerProf(clientCompense(false), { email: "a@b.be", motDePasse: "secret12", nom: "N" });
  verifier(!c1.ok && c1.etape === "profil" && supprimes.join() === "cree-1", `provisionnerProf : l'échec de la ligne profs SUPPRIME le compte Auth (${JSON.stringify(c1)} ${supprimes})`);
  const c2 = await provisionnerProf(clientCompense(true), { email: "a@b.be", motDePasse: "secret12", nom: "N" });
  verifier(!c2.ok && /cree-1/.test(c2.message) && /suppression impossible/.test(c2.message), "provisionnerProf : l'échec de la suppression est signalé dans le message");

  // ---------- 11. Routage ----------
  verifier((await appeler(`admin/profs/${ID_BOB}/inconnue`, "POST", { jeton: jA })).statut === 404, "route admin inconnue : 404 « Route introuvable »");

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (routes admin : 401/403 explicites, scénarios, garde-fous, est_admin jamais écrit)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
