/**
 * Normalise un nom/prénom pour comparaison insensible à la casse et aux accents (prompt
 * "Authentification élève", Étape 3, point 2 : "comparaison insensible à la casse/accents").
 * Fait en JS plutôt que via l'extension Postgres `unaccent` : ce pilote n'a pas d'accès direct à
 * l'instance Supabase depuis ce bac à sable (réseau bloqué, déjà documenté au rapport de fin) et
 * ne peut donc pas confirmer que cette extension y est activée — comparer côté application évite
 * cette hypothèse non vérifiable.
 */
export function normaliserTexte(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
