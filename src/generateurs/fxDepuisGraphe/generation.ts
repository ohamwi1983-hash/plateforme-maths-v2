import type { ConfigurationCases } from "../../../lib/contratGenerateur";
import { ConfigurationDeLigneInvalide } from "../../../lib/genererPourLigne";
import { creerPrng } from "../../../lib/prng";
import { POOL_TRANSLATION, poolFacteur, tirerRepli } from "../_noyauQuadratique/tirage";
import { TRANSFORMATIONS, estTransformation, type Transformation } from "../_noyauQuadratique/types";
import type { ExerciceFx } from "./types";

/**
 * Tirage de gen8 (RAPPORT §56). L'ORDRE des tirages et le CONTENU des pools sont contractuels (règle `_v2` : les exercices déjà assignés se régénèrent depuis `(graine, configuration)`) :
 *   1. `TH` active : un entier de `POOL_TRANSLATION` ; 2. `TV` active : idem ; 3. `EV` OU `CV` active : un élément de `POOL_EV` / `POOL_CV` ; 4. TOUJOURS : le côté de `A` (±1).
 * `SOX` ne tire rien (déterminée par la case). Une transformation non cochée ne consomme aucun tirage : ajouter `TV` à une configuration ne change donc pas le `p` tiré pour la même graine.
 * Puis, APRÈS ces quatre-là, le tirage du REPLI de l'écran 2 (`tirerRepli`, noyau partagé `_noyauQuadratique/tirage.ts`, qui porte aussi les pools : RAPPORT §59).
 */

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
  const pool = poolFacteur(actives);
  const [facteurN, facteurD] = pool ? prng.choisir(pool) : [1, 1];
  const signeEcart: 1 | -1 = prng.choisir([-1, 1] as const);
  const sansRepli = { actives, th, tv, facteurN, facteurD, sox: actives.includes("SOX"), signeEcart };
  return { ...sansRepli, repli: tirerRepli(prng, actives, sansRepli) };
}
