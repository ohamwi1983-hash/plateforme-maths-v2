// Test permanent — signalement "L'inscription élève... échoue avec 'Échec de lecture des
// inscriptions existantes'... visible sur les deux flux, qui partagent tous les deux
// provisionnerEleve.ts". Contrairement à tous les autres scripts/test-*.ts (qui remplacent
// require.cache[".../supabaseAdmin"] par un `admin` bricolé à la main), CE test fait passer
// lib/provisionnerEleve.ts/lib/tousLesEleves.ts par le VRAI @supabase/supabase-js
// (createClient() réel, jamais mocké), pointé sur un faux serveur HTTP local imitant PostgREST —
// exactement pour ne jamais confondre un bug d'un fake de test avec un vrai bug de production, ce
// que les autres tests ne peuvent pas garantir sur ce point précis.
//
// Prompt "Connexion élève sans code", Étape 1 : `provisionnerEleve.ts` lit désormais `eleves`
// directement via `tousLesEleves` (toute la plateforme), plus `inscriptions` scopé à une classe
// (`elevesDeLaClasse`, avant cette tâche) — ce fichier de test, écrit pour l'ancien signalement
// PostgREST, est adapté en conséquence : `GET /rest/v1/eleves` remplace `GET /rest/v1/inscriptions`
// comme requête simulée, le reste de l'intention du test (a/b/c ci-dessous) est inchangé.
//
// Confirme, par exécution réelle (pas supposée) :
// (a) AUCUN élève existant sur toute la plateforme n'est PAS la cause du bug — le provisionnement
//     réussit normalement ;
// (b) QUELQUES élèves déjà existants (peu importe leur classe) réussit également ;
// (c) la cause réelle reproduite : quand PostgREST renvoie une vraie erreur ("column eleves.actif
//     does not exist" — cas typique si `supabase/migrations/cumulatif.sql` n'a pas été exécuté
//     contre la vraie base après "Gestion de classe étendue", ou si le cache de schéma PostgREST
//     n'a pas été rechargé), le message reste "Échec de lecture des élèves existants" (reformulé
//     par le prompt "Connexion élève sans code" — le texte exact du signalement d'origine n'est
//     plus littéralement applicable puisque la requête ne porte plus sur `inscriptions`) MAIS porte
//     toujours le détail réel en `detail` (correctif d'origine, préservé).

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

import { createServer } from "http";
import { URL } from "url";
import path from "path";

type Scenario = "vide" | "quelques" | "colonne-manquante";

function creerServeurPostgrestFactice(scenario: Scenario) {
  const eleves =
    scenario === "vide"
      ? []
      : [
          { id: "e1", nom: "Martin", prenom: "Léa", actif: true },
          { id: "e2", nom: "Dupont", prenom: "Noah", actif: true },
        ];

  return createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    let corps = "";
    for await (const chunk of req) corps += chunk;

    if (url.pathname === "/rest/v1/eleves" && req.method === "GET") {
      if (scenario === "colonne-manquante") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "42703", message: "column eleves.actif does not exist", details: null, hint: null }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(eleves));
      return;
    }
    // Classes de test (RAPPORT §61) : `provisionnerEleve` lit `classes` (colonne `est_test`) pour ignorer les élèves de test dans le suffixe d'homonymes ; aucune classe de test ici.
    if (url.pathname === "/rest/v1/classes" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
      return;
    }
    if (url.pathname === "/auth/v1/admin/users" && req.method === "POST") {
      const payload = JSON.parse(corps);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "nouvel-eleve-uuid", email: payload.email }));
      return;
    }
    if ((url.pathname === "/rest/v1/eleves" || url.pathname === "/rest/v1/inscriptions") && req.method === "POST") {
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(corps || "{}");
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ erreur: "route non simulée dans ce test : " + req.method + " " + url.pathname }));
  });
}

async function appelerProvisionnerEleve(scenario: Scenario) {
  const serveur = creerServeurPostgrestFactice(scenario);
  await new Promise<void>((resolve) => serveur.listen(0, resolve));
  const port = (serveur.address() as any).port;

  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "cle-factice-pour-ce-test";

  const cheminSupabaseAdmin = path.resolve(__dirname, "../lib/supabaseAdmin");
  const cheminProvisionnerEleve = path.resolve(__dirname, "../lib/provisionnerEleve");
  delete require.cache[require.resolve(cheminSupabaseAdmin)];
  delete require.cache[require.resolve(cheminProvisionnerEleve)];
  const { supabaseAdmin } = require(cheminSupabaseAdmin);
  const { provisionnerEleve } = require(cheminProvisionnerEleve);

  const admin = supabaseAdmin();
  const resultat = await provisionnerEleve(admin, "classe-4gb", "Nouveau", "Eleve", "secret1", undefined);

  await new Promise((resolve) => serveur.close(resolve));
  return resultat;
}

async function main() {
  const resultatVide = await appelerProvisionnerEleve("vide");
  if (!resultatVide.ok) {
    throw new Error(`Plateforme SANS AUCUN élève existant : provisionnement attendu réussi (le nombre d'élèves n'est pas la cause du bug), obtenu ${JSON.stringify(resultatVide)}`);
  }
  console.log("OK : provisionnement réussi sans aucun élève existant sur toute la plateforme — pas la cause du signalement");

  const resultatQuelques = await appelerProvisionnerEleve("quelques");
  if (!resultatQuelques.ok) {
    throw new Error(`Quelques élèves déjà existants sur la plateforme : provisionnement attendu réussi, obtenu ${JSON.stringify(resultatQuelques)}`);
  }
  console.log("OK : provisionnement réussi avec quelques élèves déjà existants sur la plateforme — pas la cause du signalement");

  const resultatColonneManquante = await appelerProvisionnerEleve("colonne-manquante");
  if (resultatColonneManquante.ok) {
    throw new Error(`Erreur PostgREST réelle sur la lecture des élèves : provisionnement attendu en échec, obtenu ${JSON.stringify(resultatColonneManquante)}`);
  }
  if (resultatColonneManquante.erreur !== "Échec de lecture des élèves existants") {
    throw new Error(`Message attendu exactement "Échec de lecture des élèves existants" (reformulé par le prompt "Connexion élève sans code", voir lib/provisionnerEleve.ts), obtenu "${resultatColonneManquante.erreur}"`);
  }
  if (!resultatColonneManquante.detail || !resultatColonneManquante.detail.includes("eleves.actif")) {
    throw new Error(`Détail attendu porter le vrai message PostgREST ("column eleves.actif does not exist"), obtenu ${JSON.stringify(resultatColonneManquante.detail)} — c'est exactement ce que ce correctif ajoute`);
  }
  console.log(`OK : cause réelle reproduite (erreur PostgREST sur la lecture de eleves) — le message reste générique mais porte désormais le détail réel : "${resultatColonneManquante.detail}"`);

  console.log("TOUS LES TESTS DE PROVISIONNEMENT (VRAI CLIENT SUPABASE) PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
