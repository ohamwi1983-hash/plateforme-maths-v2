import type { ConfigurationCases } from "../../../lib/contratGenerateur";
import { ConfigurationDeLigneInvalide } from "../../../lib/genererPourLigne";
import { creerPrng } from "../../../lib/prng";
import type { Prng } from "../../../lib/prng";
import { TRANSFORMATIONS, estTransformation, parametres, parametresRepli, type ExerciceFx, type RepliFx, type Transformation } from "./types";
import { egalR } from "../analyseFonctionMotifDelta/exact/rationnel";

/**
 * Tirage de gen8 (RAPPORT §56). L'ORDRE des tirages et le CONTENU des pools sont contractuels (règle `_v2` : les exercices déjà assignés se régénèrent depuis `(graine, configuration)`) :
 *   1. `TH` active : un entier de `POOL_TRANSLATION` ; 2. `TV` active : idem ; 3. `EV` OU `CV` active : un élément de `POOL_EV` / `POOL_CV` ; 4. TOUJOURS : le côté de `A` (±1).
 * `SOX` ne tire rien (déterminée par la case). Une transformation non cochée ne consomme aucun tirage : ajouter `TV` à une configuration ne change donc pas le `p` tiré pour la même graine.
 * Puis, APRÈS ces quatre-là, le tirage du REPLI de l'écran 2 (`tirerRepli`) : mêmes pools, mais `SOX` y est un pile-ou-face (sinon le repli de la configuration `SOX` seule serait toujours la vraie
 * fonction), répété jusqu'à obtenir une fonction DIFFÉRENTE de la vraie (au plus 64 essais, puis une alternative déterministe).
 *
 * Pools (décision D3, `docs/gen8-conception-avant-go.md` §2.4 : le prompt ne bornait pas le numérateur de l'EV fractionnaire et laissait un point `A` à 120 unités de `S`) :
 *   - EV : entiers 2 à 5, puis fractions irréductibles `n/2` (n impair) et `n/4` (n impair) de valeur ∈ ]1 ; 4] ;
 *   - CV : `1/d` pour d ∈ [2 ; 5], puis `n/d` irréductible, n ∈ [2 ; 5], n < d, d ≤ 4 (`d = 5` et `d = 6` écartés : A à 30 unités de S).
 */
export const POOL_TRANSLATION: readonly number[] = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

export type Facteur = readonly [number, number];

export const POOL_EV: readonly Facteur[] = [
  [2, 1], [3, 1], [4, 1], [5, 1],
  [3, 2], [5, 2], [7, 2],
  [5, 4], [7, 4], [9, 4], [11, 4], [13, 4], [15, 4],
];

export const POOL_CV: readonly Facteur[] = [
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 3], [3, 4],
];

/** Valide la configuration figée (le serveur l'a déjà canonisée : défense en profondeur, jamais un défaut silencieux). */
export function activesDe(configuration: ConfigurationCases | undefined): Transformation[] {
  if (!configuration || !Array.isArray(configuration.actives) || configuration.actives.length === 0) throw new ConfigurationDeLigneInvalide("fx_depuis_graphe : configuration absente ou vide");
  const inconnues = configuration.actives.filter((id) => !estTransformation(id));
  if (inconnues.length > 0) throw new ConfigurationDeLigneInvalide("fx_depuis_graphe : transformation inconnue dans la configuration");
  const actives = TRANSFORMATIONS.filter((t) => configuration.actives.includes(t));
  if (actives.includes("EV") && actives.includes("CV")) throw new ConfigurationDeLigneInvalide("fx_depuis_graphe : EV et CV s'excluent");
  return actives;
}

export function genererExerciceFx(graine: number, configuration: ConfigurationCases | undefined): ExerciceFx {
  const actives = activesDe(configuration);
  const prng = creerPrng(graine);
  const th = actives.includes("TH") ? prng.choisir(POOL_TRANSLATION) : 0;
  const tv = actives.includes("TV") ? prng.choisir(POOL_TRANSLATION) : 0;
  const pool = actives.includes("EV") ? POOL_EV : actives.includes("CV") ? POOL_CV : null;
  const [facteurN, facteurD] = pool ? prng.choisir(pool) : [1, 1];
  const signeEcart: 1 | -1 = prng.choisir([-1, 1] as const);
  const sansRepli = { actives, th, tv, facteurN, facteurD, sox: actives.includes("SOX"), signeEcart };
  return { ...sansRepli, repli: tirerRepli(prng, actives, sansRepli) };
}

const memeFonction = (a: Omit<ExerciceFx, "repli" | "effectif">, r: RepliFx): boolean => {
  const vrai = parametres({ ...a, repli: r });
  const autre = parametresRepli({ repli: r });
  return egalR(vrai.a, autre.a) && egalR(vrai.p, autre.p) && egalR(vrai.q, autre.q);
};

/** Repli de l'écran 2 : atteignable avec `actives`, différent de la vraie fonction. Consomme le PRNG APRÈS les tirages de l'exercice (ordre contractuel). */
function tirerRepli(prng: Prng, actives: readonly Transformation[], vrai: Omit<ExerciceFx, "repli" | "effectif">): RepliFx {
  const tirage = (): RepliFx => {
    const pool = actives.includes("EV") ? POOL_EV : actives.includes("CV") ? POOL_CV : null;
    const th = actives.includes("TH") ? prng.choisir(POOL_TRANSLATION) : 0;
    const tv = actives.includes("TV") ? prng.choisir(POOL_TRANSLATION) : 0;
    const [facteurN, facteurD] = pool ? prng.choisir(pool) : [1, 1];
    const sox = actives.includes("SOX") ? prng.choisir([false, true] as const) : false;
    return { th, tv, facteurN, facteurD, sox };
  };
  for (let essai = 0; essai < 64; essai++) {
    const r = tirage();
    if (!memeFonction(vrai, r)) return r;
  }
  // Probabilité 2^-64 au pire : alternative déterministe (on bascule la première dimension active).
  const r: RepliFx = { th: vrai.th, tv: vrai.tv, facteurN: vrai.facteurN, facteurD: vrai.facteurD, sox: vrai.sox };
  if (actives.includes("SOX")) return { ...r, sox: !r.sox };
  if (actives.includes("TH")) return { ...r, th: r.th === 1 ? 2 : 1 };
  if (actives.includes("TV")) return { ...r, tv: r.tv === 1 ? 2 : 1 };
  const pool = actives.includes("EV") ? POOL_EV : POOL_CV;
  const suivant = pool[(pool.findIndex(([n, d]) => n === r.facteurN && d === r.facteurD) + 1) % pool.length] as Facteur;
  return { ...r, facteurN: suivant[0], facteurD: suivant[1] };
}
