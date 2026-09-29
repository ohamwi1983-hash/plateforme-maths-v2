/**
 * Lecture de `SUPABASE_URL` (RAPPORT §25) — seule fonction du dépôt qui lit cette variable pour un client ou pour
 * le navigateur (`lib/supabaseAdmin.ts`, `lib/routes/config.ts`).
 *
 * Le client `@supabase/supabase-js` ajoute LUI-MÊME `rest/v1`, `auth/v1`, `storage/v1`, `realtime/v1`, `functions/v1`
 * à l'URL fournie (`new URL("rest/v1", baseUrl)`). Une variable d'environnement copiée avec un de ces suffixes
 * (`https://<ref>.supabase.co/rest/v1/`, l'« URL de l'API » de certains écrans du tableau de bord) donne
 * `/rest/v1/rest/v1/<table>` (PostgREST : `PGRST125 Invalid path`) et `/rest/v1/auth/v1/token` : TOUTES les requêtes
 * échouent, et les routes qui masquent l'erreur (« Code d'invitation invalide ») ne le disent pas.
 *
 * On retire donc un suffixe d'API final, et on le SIGNALE (une fois par valeur) : corriger la variable reste
 * la bonne réponse, ceci évite seulement un échec silencieux.
 */
const SUFFIXE_API = /\/+(?:rest|auth|storage|realtime|functions)\/v1\/*$/i;

export interface UrlSupabaseNormalisee {
  /** URL de base sans suffixe d'API ni `/` final ; chaîne vide si la variable est absente ou vide. */
  url: string;
  /** Vrai si un suffixe d'API a été retiré (la variable d'environnement est mal renseignée). */
  suffixeRetire: boolean;
}

export function normaliserUrlSupabase(brute: string | undefined): UrlSupabaseNormalisee {
  const nettoyee = (brute ?? "").trim();
  const sansSuffixe = nettoyee.replace(SUFFIXE_API, "");
  return { url: sansSuffixe.replace(/\/+$/, ""), suffixeRetire: sansSuffixe !== nettoyee };
}

const dejaSignalees = new Set<string>();

/** `SUPABASE_URL` normalisée. Avertit dans les logs (une fois par valeur brute) si un suffixe d'API a dû être retiré. */
export function lireSupabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const brute = env.SUPABASE_URL;
  const { url, suffixeRetire } = normaliserUrlSupabase(brute);
  if (suffixeRetire && brute !== undefined && !dejaSignalees.has(brute)) {
    dejaSignalees.add(brute);
    console.warn(`AVERTISSEMENT SUPABASE_URL : la valeur se termine par un suffixe d'API ("${brute.trim().slice(url.length)}"), retiré automatiquement (utilisé : "${url}"). Le client Supabase ajoute lui-même /rest/v1, /auth/v1… : corrigez la variable d'environnement en "${url}".`);
  }
  return url;
}
