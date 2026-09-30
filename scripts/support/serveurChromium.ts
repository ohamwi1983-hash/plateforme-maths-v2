// Serveur local + stub Supabase des scénarios Chromium (outils MANUELS, jamais lancés par les tests unitaires) : sert `public/` et
// pont vers le VRAI `api/router.ts` (base en mémoire, scripts/support/), remplace le seul CDN bloqué en bac à sable
// (`unpkg.com/@supabase/supabase-js`) par un stub de la seule API utilisée par les pages. Partagé par
// `scripts/chromium-temoin-technique.ts` et `scripts/chromium-fidelite-design.ts` (grep avant de dupliquer).

import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const RACINE = join(__dirname, "..", "..");

const TYPES_MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png" };

export function demarrerServeur(): Promise<{ serveur: Server; url: string }> {
  process.env.SUPABASE_URL = "http://supabase.invalide";
  process.env.SUPABASE_ANON_KEY = "anon-invalide";
  const serveur = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname.startsWith("/api/")) {
        const corpsBrut = await new Promise<string>((ok) => {
          let d = "";
          req.on("data", (c) => (d += c));
          req.on("end", () => ok(d));
        });
        const { default: routeur } = require("../../api/router");
        let statut = 200;
        let charge: unknown = null;
        // Les paramètres d'URL (`?classe_id=`, `?tache_id=`) atteignent le routeur comme sur Vercel.
        await routeur(
          { method: req.method, headers: req.headers, query: { path: url.pathname.slice(5), ...Object.fromEntries(url.searchParams) }, body: corpsBrut ? JSON.parse(corpsBrut) : {} },
          {
            status(c: number) {
              statut = c;
              return this;
            },
            json(o: unknown) {
              charge = o;
            },
            end() {},
          },
        );
        res.writeHead(statut, { "Content-Type": "application/json" }).end(JSON.stringify(charge));
        return;
      }
      const chemin = normalize(join(RACINE, "public", url.pathname === "/" ? "index.html" : url.pathname));
      if (!chemin.startsWith(join(RACINE, "public")) || !existsSync(chemin)) {
        res.writeHead(404).end("introuvable");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES_MIME[extname(chemin)] ?? "application/octet-stream" }).end(readFileSync(chemin));
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  return new Promise((ok) => serveur.listen(0, "127.0.0.1", () => ok({ serveur, url: `http://127.0.0.1:${(serveur.address() as any).port}` })));
}

export function stubSupabase(jeton: string, email: string): string {
  return `window.supabase = { createClient: () => ({ auth: {
    getSession: async () => ({ data: { session: { access_token: ${JSON.stringify(jeton)}, refresh_token: "r", user: { email: ${JSON.stringify(email)} } } } }),
    setSession: async () => ({ data: {}, error: null }), signInWithPassword: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }), updateUser: async () => ({ error: null }) } }) };`;
}

