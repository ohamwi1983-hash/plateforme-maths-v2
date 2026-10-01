/**
 * Points pondérés d'un exercice (RAPPORT §50) — module PUR (aucun accès au DOM), SEULE implémentation côté navigateur ; les tests le chargent par `require`
 * (`scripts/test-scores-ecran.ts`), la production serveur n'importe jamais depuis `public/`.
 *
 * Entrée : `exercice.champs` tel que le serveur l'expose (`champ`, `poids`, `score`). Le SERVEUR décide si un score existe (`score === null` = rien à montrer : le score suit la
 * solution, `lib/tableauDeBord.ts`) ; ce module ne fait que de l'arithmétique sur ce qu'il reçoit, jamais un verdict.
 *
 *  - points d'un écran = poids × score / 100, arrondi à 1 décimale ;
 *  - total obtenu = SOMME DES LIGNES AFFICHÉES (jamais l'arrondi d'une somme exacte : deux nombres à l'écran ne doivent pas se contredire) ;
 *  - total possible = somme des poids de TOUS les champs, y compris ceux qui n'ont pas encore de score (dénominateur connu dès le début, le total ne fait que monter) ;
 *  - poids absent, nul, décimal ou texte : 1 (comme `scorePondere.js`) ; score non fini : ignoré (jamais NaN affiché), score hors de 0..100 : borné.
 */
function poidsValide(poids) {
  return Number.isInteger(poids) && poids >= 1 ? poids : 1;
}

export function arrondirPoints(x) {
  return Math.round(x * 10) / 10;
}

/** Une entrée par champ : `obtenus` = `null` quand le serveur n'a pas envoyé de score. */
export function pointsParChamp(champs) {
  return champs.map((c) => {
    const poids = poidsValide(c.poids);
    const score = typeof c.score === "number" && Number.isFinite(c.score) ? Math.min(100, Math.max(0, c.score)) : null;
    return { champ: c.champ, poids, possibles: poids, obtenus: score === null ? null : arrondirPoints((poids * score) / 100) };
  });
}

/** `visible` : au moins un écran a un score (un score de 0 en est un) ; sinon il n'y a rien à afficher. */
export function totalPoints(champs) {
  const lignes = pointsParChamp(champs);
  let obtenus = 0;
  let possibles = 0;
  let visible = false;
  for (const l of lignes) {
    possibles += l.possibles;
    if (l.obtenus !== null) {
      obtenus = arrondirPoints(obtenus + l.obtenus);
      visible = true;
    }
  }
  return { obtenus, possibles, visible };
}

/** Format français : virgule décimale, aucun « ,0 » inutile. */
export function formaterPoints(x) {
  return String(arrondirPoints(x)).replace(".", ",");
}

/** « 1,8 / 2 pts » : l'unité suit le DÉNOMINATEUR (« 0 / 1 pt », « 1,8 / 2 pts »). */
export function formaterScore(obtenus, possibles) {
  return `${formaterPoints(obtenus)} / ${formaterPoints(possibles)} ${possibles > 1 ? "pts" : "pt"}`;
}
