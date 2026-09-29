/**
 * Somme pondérée des champs d'un score « corrects / comptés » (RAPPORT §17) : SEULE implémentation
 * côté navigateur, partagée par public/prof.html (Résultats) et public/eleve.html (tableau de bord).
 * Script CLASSIQUE (pas un module ES) : les pages l'appellent de façon synchrone depuis leurs scripts
 * inline (tri, badges, impression). `champ.poids` (entier ≥ 1) vient du serveur (`lib/poidsEcran.ts`) ;
 * absent ou invalide (réponse d'un ancien cache) → 1, donc le comptage d'origine. Parité avec
 * `sommePonderee` (lib/poidsEcran.ts) vérifiée par `scripts/test-poids-ecran.ts` (le navigateur ne peut
 * pas importer `lib/`, la production n'importe jamais depuis `public/`).
 *
 * Le DÉNOMINATEUR reste celui de chaque appelant : `champs` = les champs à compter (répondus, côté
 * prof). `ignorerSansStatut` : saute les champs dont le statut est masqué (`null`), comme le tableau de
 * bord élève (un statut masqué sous correction coupée ne doit jamais entrer dans un pourcentage).
 */
function sommeChampsPonderee(champs, options) {
  const ignorerSansStatut = Boolean(options && options.ignorerSansStatut);
  let correct = 0;
  let total = 0;
  for (const champ of champs) {
    if (ignorerSansStatut && champ.statut === null) continue;
    const poids = Number.isInteger(champ.poids) && champ.poids >= 1 ? champ.poids : 1;
    total += poids;
    if (champ.statut === "correct") correct += poids;
  }
  return { correct, total };
}

if (typeof module !== "undefined" && module.exports) module.exports = { sommeChampsPonderee };
