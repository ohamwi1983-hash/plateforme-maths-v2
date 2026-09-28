/**
 * Signature minimale compatible avec le runtime Node des Vercel Functions (Étape 2), sans
 * dépendre du paquet `@vercel/node` — évite une dépendance supplémentaire pour un contrat déjà
 * simple (méthode, en-têtes, corps déjà parsé en JSON, query params, réponse JSON).
 */
export interface RequeteHttp {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
}

export interface ReponseHttp {
  status(code: number): ReponseHttp;
  json(payload: unknown): void;
  end(): void;
}
