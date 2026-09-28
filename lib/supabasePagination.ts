/**
 * Bug réel trouvé en production (voir RAPPORT.md, section sur `calculerTempsParVarianteProf` puis
 * `compterReponsesAvecBug`) : PostgREST/Supabase plafonne silencieusement toute requête `select` à
 * 1000 lignes par défaut, sans jamais renvoyer d'erreur. Toute requête sur `reponses` ou
 * `exercices_assignes` (ou toute autre table) qui n'est PAS bornée à un seul élève/exercice — donc
 * potentiellement au-delà de ce volume dès qu'un prof cumule un historique important — doit passer
 * par `recupererToutesLesLignes` plutôt qu'un simple `.select()...in()`, sous peine de tronquer
 * silencieusement le résultat et fausser tout calcul en aval.
 *
 * Extrait de `lib/routes/profs/tableau-de-bord.ts` (site d'origine du correctif) pour être partagé
 * par tous les sites concernés — ne jamais redéfinir cette boucle localement ailleurs.
 */
export const TAILLE_PAGE_SUPABASE = 1000; // limite par défaut PostgREST/Supabase — silencieuse sans .range()

/**
 * Accumule toutes les lignes d'une requête Supabase potentiellement au-delà de la limite par
 * défaut de PostgREST, en paginant via `.range()` par lots de `TAILLE_PAGE_SUPABASE`, jusqu'à ce
 * qu'une page renvoie moins que la taille de page (fin de la table atteinte).
 *
 * `construireRequete` doit renvoyer un NOUVEAU query builder à chaque appel (une requête PostgREST
 * déjà exécutée ne se rejoue pas) — `.range()` est ajouté ici, par page, jamais par l'appelant.
 */
export async function recupererToutesLesLignes<T>(
  construireRequete: () => { range: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
): Promise<T[]> {
  const toutes: T[] = [];
  let debut = 0;
  for (;;) {
    const { data, error } = await construireRequete().range(debut, debut + TAILLE_PAGE_SUPABASE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    toutes.push(...page);
    if (page.length < TAILLE_PAGE_SUPABASE) break; // dernière page (partielle ou vide) atteinte
    debut += TAILLE_PAGE_SUPABASE;
  }
  return toutes;
}
