import type { EcranChaineTransformations, EcranChampsMultiples } from "./contratGenerateur";

/**
 * Décodeurs de `reponseBrute` partagés par les générateurs (format par type d'écran documenté dans
 * lib/contratGenerateur.ts). Un décodage impossible ne lève jamais d'exception : il renvoie un
 * message pédagogique, que le générateur transforme en `parse_error`.
 */

export type Decodage<T> = { ok: true; valeur: T } | { ok: false; message: string };

export function decoderListeValeurs(reponseBrute: string): Decodage<string[]> {
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return { ok: false, message: "La liste de valeurs n'a pas pu être lue." };
  }
  if (!Array.isArray(brut) || !brut.every((v) => typeof v === "string")) {
    return { ok: false, message: "La liste de valeurs n'a pas pu être lue." };
  }
  const valeurs = brut.map((v) => v.trim()).filter((v) => v !== "");
  if (valeurs.length === 0) return { ok: false, message: "Ajoute au moins une valeur avant de valider." };
  return { ok: true, valeur: valeurs };
}

export type CasesTableauSignes = Record<string, Record<string, string>>;

export function decoderTableauSignes(reponseBrute: string): Decodage<CasesTableauSignes> {
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return { ok: false, message: "Le tableau de signes n'a pas pu être lu." };
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return { ok: false, message: "Le tableau de signes n'a pas pu être lu." };
  // Les clés (id de ligne, id de colonne) viennent de l'ÉLÈVE : `JSON.parse` crée une vraie clé « __proto__ »,
  // et `cases["__proto__"] = {}` sur un objet littéral CHANGERAIT SON PROTOTYPE (les lignes lues ensuite
  // seraient héritées, jamais propres). Objets SANS prototype + rejet explicite de « __proto__ » (RAPPORT.md §20).
  const illisible = { ok: false as const, message: "Le tableau de signes n'a pas pu être lu." };
  const cases: CasesTableauSignes = Object.create(null);
  for (const [ligne, colonnes] of Object.entries(brut as Record<string, unknown>)) {
    if (ligne === "__proto__") return illisible;
    if (typeof colonnes !== "object" || colonnes === null || Array.isArray(colonnes)) return illisible;
    const ligneCases: Record<string, string> = Object.create(null);
    for (const [colonne, signe] of Object.entries(colonnes as Record<string, unknown>)) {
      if (colonne === "__proto__" || typeof signe !== "string") return illisible;
      ligneCases[colonne] = signe;
    }
    cases[ligne] = ligneCases;
  }
  return { ok: true, valeur: cases };
}

/**
 * `liste_valeurs` avec `permetAucune` : `[]` est la réponse explicite « aucune valeur ». Une liste
 * non vide se décode comme `decoderListeValeurs`. `decoderListeValeurs` reste INCHANGÉ (il rejette
 * toujours la liste vide : un écran sans `permetAucune` ne peut pas la confirmer).
 */
export function decoderListeValeursOuAucune(reponseBrute: string): Decodage<{ aucune: boolean; valeurs: string[] }> {
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return { ok: false, message: "La liste de valeurs n'a pas pu être lue." };
  }
  if (!Array.isArray(brut) || !brut.every((v) => typeof v === "string")) return { ok: false, message: "La liste de valeurs n'a pas pu être lue." };
  if (brut.length === 0) return { ok: true, valeur: { aucune: true, valeurs: [] } };
  const valeurs = brut.map((v) => v.trim()).filter((v) => v !== "");
  if (valeurs.length === 0) return { ok: false, message: "Ajoute au moins une valeur, ou choisis « aucune valeur »." };
  return { ok: true, valeur: { aucune: false, valeurs } };
}

/** Texte de la déclaration d'un sous-champ, sans balisage, pour nommer le champ fautif dans un message. */
function nomSousChamp(libelle: string): string {
  return libelle.replace(/\\\$/g, "\u0000").replace(/\$/g, "").replace(/\u0000/g, "$").trim() || "un champ";
}

/**
 * `champs_multiples` : valide `reponseBrute` contre la DÉCLARATION de l'écran (ids, ids de choix). Ne
 * juge jamais la justesse. Un sous-champ vide (après `trim`) est refusé : jamais lu comme 0.
 */
export function decoderChampsMultiples(reponseBrute: string, ecran: Pick<EcranChampsMultiples, "champs">): Decodage<Record<string, string>> {
  const illisible = { ok: false as const, message: "Les champs n'ont pas pu être lus." };
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return illisible;
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return illisible;
  const objet = brut as Record<string, unknown>;
  const attendus = ecran.champs.map((c) => c.id);
  const enTrop = Object.keys(objet).filter((k) => !attendus.includes(k));
  if (enTrop.length > 0) return { ok: false, message: `Un champ inattendu a été reçu (${enTrop.join(", ")}).` };
  const valeurs: Record<string, string> = {};
  for (const champ of ecran.champs) {
    const v = objet[champ.id];
    const nom = nomSousChamp(champ.libelle);
    if (v === undefined) return { ok: false, message: `Le champ « ${nom} » manque.` };
    if (typeof v !== "string") return { ok: false, message: `Le champ « ${nom} » n'a pas pu être lu.` };
    const nettoye = v.trim();
    if (nettoye === "") return { ok: false, message: `Le champ « ${nom} » est vide : remplis-le avant de valider.` };
    if (champ.genre === "choix" && !champ.choix.some((c) => c.id === nettoye)) return { ok: false, message: `Le choix du champ « ${nom} » n'existe pas.` };
    valeurs[champ.id] = nettoye;
  }
  return { ok: true, valeur: valeurs };
}

export interface ReponseIntervalle {
  crochetGauche: "[" | "]";
  borneGauche: string;
  crochetDroit: "[" | "]";
  borneDroite: string;
}

/**
 * `intervalle` : structure et crochets seulement. N'interprète PAS les nombres (voir
 * `lireNombreOuFraction`) et ne juge pas le sens (un `+inf` à gauche est lisible ; c'est le
 * générateur qui le déclarera faux).
 */
export function decoderIntervalle(reponseBrute: string): Decodage<ReponseIntervalle> {
  const illisible = { ok: false as const, message: "L'intervalle n'a pas pu être lu." };
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return illisible;
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return illisible;
  const o = brut as Record<string, unknown>;
  const cles = ["crochetGauche", "borneGauche", "crochetDroit", "borneDroite"];
  if (Object.keys(o).length !== cles.length || !cles.every((k) => typeof o[k] === "string")) return illisible;
  const crochetGauche = o.crochetGauche as string;
  const crochetDroit = o.crochetDroit as string;
  if (crochetGauche !== "[" && crochetGauche !== "]") return { ok: false, message: "Le crochet de gauche doit être [ ou ]." };
  if (crochetDroit !== "[" && crochetDroit !== "]") return { ok: false, message: "Le crochet de droite doit être [ ou ]." };
  const borneGauche = (o.borneGauche as string).trim();
  const borneDroite = (o.borneDroite as string).trim();
  if (borneGauche === "") return { ok: false, message: "La borne de gauche est vide : écris un nombre ou choisis −∞." };
  if (borneDroite === "") return { ok: false, message: "La borne de droite est vide : écris un nombre ou choisis +∞." };
  return { ok: true, valeur: { crochetGauche, borneGauche, crochetDroit, borneDroite } };
}

/**
 * LE lecteur de nombre de la plateforme (ne jamais en écrire un autre) : entier, décimal (point OU
 * virgule) ou fraction `p/q` (`q ≠ 0`, espaces tolérés autour de `/`). Chaîne vide, espaces seuls,
 * texte non numérique, `1/0` → `null` — jamais 0. Comportement de référence : ancien pilote,
 * `src/moteur/analyseFonction.ts` (`parserNombreOuFraction`), avec en plus le refus explicite de
 * `Infinity`, de la notation hexadécimale/binaire/scientifique et des séparateurs multiples, et l'acceptation
 * du signe moins typographique « − » (U+2212).
 */
export function lireNombreOuFraction(texte: string): number | null {
  const nettoye = texte.trim().replace(/\u2212/g, "-").replace(",", ".");
  if (nettoye === "") return null;
  const NOMBRE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (NOMBRE.test(nettoye)) return Number(nettoye);
  const fraction = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(nettoye);
  if (!fraction) return null;
  const numerateur = Number(fraction[1]);
  const denominateur = Number(fraction[2]);
  if (!Number.isFinite(numerateur) || !Number.isFinite(denominateur) || denominateur === 0) return null;
  return numerateur / denominateur;
}

export interface EtapeChaine {
  expression: string;
  transformation: string;
}

export const EXPRESSION_ETAPE_LONGUEUR_MAX = 120;

/**
 * `chaine_transformations` : structure SEULEMENT (RAPPORT §56). `{"etapes":[{"expression","transformation"}…]}` : de `etapesMin` à `etapesMax` étapes, clés exactes, `transformation` ∈ ids de
 * `choix`, `expression` non vide (après `trim`) et d'au plus 120 caractères. Ne juge JAMAIS la justesse, ne lit PAS l'expression (c'est le générateur qui l'interprète). Tableaux et
 * clés fixes uniquement : aucune clé venue de l'élève n'indexe un objet.
 */
export function decoderChaineTransformations(reponseBrute: string, ecran: Pick<EcranChaineTransformations, "choix" | "etapesMin" | "etapesMax">): Decodage<EtapeChaine[]> {
  const illisible = { ok: false as const, message: "La chaîne d'étapes n'a pas pu être lue." };
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return illisible;
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return illisible;
  const cles = Object.keys(brut);
  if (cles.length !== 1 || cles[0] !== "etapes") return illisible;
  const etapes = (brut as { etapes: unknown }).etapes;
  if (!Array.isArray(etapes)) return illisible;
  if (etapes.length < ecran.etapesMin || etapes.length > ecran.etapesMax) {
    return { ok: false, message: ecran.etapesMin === ecran.etapesMax ? `La chaîne doit comporter ${ecran.etapesMin} étape${ecran.etapesMin > 1 ? "s" : ""}.` : `La chaîne doit comporter de ${ecran.etapesMin} à ${ecran.etapesMax} étapes.` };
  }
  const sortie: EtapeChaine[] = [];
  for (let i = 0; i < etapes.length; i++) {
    const e: unknown = etapes[i];
    if (typeof e !== "object" || e === null || Array.isArray(e)) return illisible;
    const k = Object.keys(e);
    if (k.length !== 2 || !k.includes("expression") || !k.includes("transformation")) return illisible;
    const { expression, transformation } = e as { expression: unknown; transformation: unknown };
    if (typeof expression !== "string" || typeof transformation !== "string") return illisible;
    const nettoyee = expression.trim();
    if (nettoyee === "") return { ok: false, message: `L'étape ${i + 1} n'a pas d'expression : écris-la avant de valider.` };
    if (nettoyee.length > EXPRESSION_ETAPE_LONGUEUR_MAX) return { ok: false, message: `L'expression de l'étape ${i + 1} est trop longue.` };
    if (!ecran.choix.some((c) => c.id === transformation)) return { ok: false, message: `La transformation de l'étape ${i + 1} n'existe pas.` };
    sortie.push({ expression: nettoyee, transformation });
  }
  return { ok: true, valeur: sortie };
}
