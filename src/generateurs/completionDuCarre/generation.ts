import type { ConfigurationCases } from "../../../lib/contratGenerateur";
import { ConfigurationDeLigneInvalide } from "../../../lib/genererPourLigne";
import { creerPrng } from "../../../lib/prng";
import { multiplierR, rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { POOL_TRANSLATION, poolFacteur, tirerRepli, type Facteur } from "../_noyauQuadratique/tirage";
import { TRANSFORMATIONS, estTransformation, type Transformation } from "../_noyauQuadratique/types";
import { coefficientsDeveloppes, type ExerciceCc } from "./types";

/**
 * Tirage de gen9 (RAPPORT §59). L'ORDRE des tirages et le CONTENU des pools (noyau partagé `_noyauQuadratique/tirage.ts`) sont contractuels (règle `_v2`) :
 *   1. un COUPLE `(th, facteur)` : sans `EV`/`CV`, `th` ∈ `POOL_TRANSLATION` (facteur 1/1) ; avec, un élément de `couplesAdmissibles` (liste EXHAUSTIVE, `th`-majeur puis ordre du pool des facteurs) ;
 *   2. `TV` active : un entier de `POOL_TRANSLATION` ; 3. l'ORDRE des termes (`tirerOrdre`) ; 4. le REPLI (`tirerRepli`).
 * `SOX` ne tire rien. Un couple est ADMISSIBLE quand `b = −2ap` et `c = ap² + q` sont ENTIERS (`q` l'est toujours) : sans ce filtre, 42 % (EV) et 70 % (CV) des couples du pool de gen8
 * donneraient des fractions dans l'énoncé. Modifier un pool ou ce filtre impose un nouveau `variante_id` à gen9 ET à gen8 (le noyau est partagé).
 */
const estEntier = (r: { d: number }): boolean => r.d === 1;

/** `(th, facteur)` donnant `b` et `c` entiers (le signe de `a` n'y change rien). */
export function couplesAdmissibles(pool: readonly Facteur[]): { th: number; facteur: Facteur }[] {
  const liste: { th: number; facteur: Facteur }[] = [];
  for (const th of POOL_TRANSLATION) {
    for (const facteur of pool) {
      const a = rat(facteur[0], facteur[1]);
      const b = multiplierR(rat(-2), multiplierR(a, rat(th)));
      const cSansQ = multiplierR(a, rat(th * th));
      if (estEntier(b) && estEntier(cSansQ)) liste.push({ th, facteur });
    }
  }
  return liste;
}

/** Valide la configuration figée (le serveur l'a déjà canonisée : défense en profondeur, jamais un défaut silencieux). `TH` est obligatoire. */
export function activesDe(configuration: ConfigurationCases | undefined): Transformation[] {
  if (!configuration || !Array.isArray(configuration.actives) || configuration.actives.length === 0) throw new ConfigurationDeLigneInvalide("completion_du_carre : configuration absente ou vide");
  const inconnues = configuration.actives.filter((id) => !estTransformation(id));
  if (inconnues.length > 0) throw new ConfigurationDeLigneInvalide("completion_du_carre : transformation inconnue dans la configuration");
  const actives = TRANSFORMATIONS.filter((t) => configuration.actives.includes(t));
  if (!actives.includes("TH")) throw new ConfigurationDeLigneInvalide("completion_du_carre : la translation horizontale (TH) est obligatoire");
  if (actives.includes("EV") && actives.includes("CV")) throw new ConfigurationDeLigneInvalide("completion_du_carre : EV et CV s'excluent");
  return actives;
}

/** Toutes les permutations de `elements` (ordre lexicographique des positions). */
function permutations<T>(elements: readonly T[]): T[][] {
  if (elements.length <= 1) return [[...elements]];
  return elements.flatMap((e, i) => permutations([...elements.slice(0, i), ...elements.slice(i + 1)]).map((reste) => [e, ...reste]));
}

/** Tire l'ordre d'AFFICHAGE parmi les permutations des termes présents, JAMAIS l'ordre canonique (`ax²`, `bx`, `c`). */
function tirerOrdre(prng: ReturnType<typeof creerPrng>, termesPresents: readonly number[]): number[] {
  const candidates = permutations(termesPresents).filter((ordre) => ordre.some((indice, rang) => indice !== termesPresents[rang]));
  return prng.choisir(candidates);
}

export function genererExerciceCc(graine: number, configuration: ConfigurationCases | undefined): ExerciceCc {
  const actives = activesDe(configuration);
  const prng = creerPrng(graine);
  const pool = poolFacteur(actives);
  let th: number;
  let facteurN = 1;
  let facteurD = 1;
  if (pool === null) th = prng.choisir(POOL_TRANSLATION);
  else {
    const couple = prng.choisir(couplesAdmissibles(pool));
    th = couple.th;
    [facteurN, facteurD] = couple.facteur;
  }
  const tv = actives.includes("TV") ? prng.choisir(POOL_TRANSLATION) : 0;
  const sox = actives.includes("SOX");
  const tirage = { th, tv, facteurN, facteurD, sox };
  const { c } = coefficientsDeveloppes({ a: sox ? rat(-facteurN, facteurD) : rat(facteurN, facteurD), p: rat(th), q: rat(tv) });
  const termesPresents = c.n === 0 ? [0, 1] : [0, 1, 2];
  const ordre = tirerOrdre(prng, termesPresents);
  return { actives, ...tirage, ordre, repli: tirerRepli(prng, actives, tirage) };
}
