import type { ColonneTableauSignes, EcranTableauSignes, LigneTableauSignes } from "./contratGenerateur";
import type { CasesTableauSignes } from "./reponsesEcran";
import { lirePropre } from "./tablePropre";

/**
 * STRUCTURE D'UN TABLEAU DE SIGNES (RAPPORT §30) — la SEULE dérivation « quelle case existe, quelles valeurs
 * elle offre, sous quelle clé elle répond ». Le serveur s'en sert pour valider ce qu'un élève envoie ; le
 * navigateur ne recalcule RIEN : `GET /api/exercices/:id` lui sert le résultat (`rangees`) et
 * `public/moteur/ecrans/tableauSignes.js` ne fait que le dessiner. Ainsi il n'existe pas de deuxième copie de
 * la règle « quel alphabet sur quelle colonne » à garder synchronisée.
 *
 * Deux sortes de tableau, choisies par la déclaration (jamais par un drapeau) :
 *  - STRUCTURÉ (`colonnes[*].genre` déclaré sur toutes les colonnes) : colonnes `intervalle, valeur, …, intervalle`
 *    (2N+1, 3 ≤ 2N+1 ≤ 9, aucune colonne −∞/+∞), alphabet dérivé du genre de la colonne et de la nature de la ligne ;
 *  - HÉRITÉ (aucun `genre`) : une case par colonne, alphabet de la ligne (`signesAutorises`) — le tableau à 5 colonnes
 *    du témoin, dont les assertions de la Section A ne bougent pas.
 * Une déclaration incohérente LÈVE (échec bruyant, jamais un tableau à moitié rendu).
 */

/** Plus grand tableau conçu : 4 valeurs de x = 9 colonnes. Pas de repli (défilement, vertical) au-delà : un futur générateur le décidera. */
export const NB_COLONNES_MAX = 9;

export const SIGNE_PLUS = "+";
export const SIGNE_MOINS = "-";
export const SIGNE_ZERO = "0";
export const SIGNE_INDEFINI = "∅";

/** Intervalle, ou point qui n'est pas une racine (le sommet d'une parabole sans racine double) : jamais `0`. */
const ALPHABET_DEUX = [SIGNE_PLUS, SIGNE_MOINS];
const ALPHABET_RACINE = [SIGNE_PLUS, SIGNE_MOINS, SIGNE_ZERO];
const ALPHABET_POLE = [SIGNE_PLUS, SIGNE_MOINS, SIGNE_ZERO, SIGNE_INDEFINI];
const ALPHABET_VARIATION_INTERVALLE = ["↗", "↘"];
const ALPHABET_VARIATION_SOMMET = ["⌢", "⌣"];

export interface CelluleResolue {
  /** Clé de la case dans `reponseBrute` : la PREMIÈRE colonne qu'elle couvre. */
  ancre: string;
  /** Colonnes couvertes (une seule, sauf case fusionnée d'une ligne `variation`). */
  couvre: string[];
  /** Valeurs proposées, dans l'ordre du cycle (le cycle ne revient jamais à `?`). */
  alphabet: string[];
}

export interface RangeeResolue {
  ligne: string;
  cellules: CelluleResolue[];
}

const ATTRIBUTS_STRUCTURE = ["genre", "valeur", "symbole", "racine", "pole", "sommet"] as const;

export function estTableauStructure(ecran: Pick<EcranTableauSignes, "colonnes">): boolean {
  return ecran.colonnes.some((c) => c.genre !== undefined);
}

function echec(ecran: EcranTableauSignes, message: string): never {
  throw new Error(`Écran tableau_signes « ${ecran.champ} » invalide : ${message}`);
}

function verifierIdsDistincts(ecran: EcranTableauSignes): void {
  const colonnes = new Set<string>();
  for (const c of ecran.colonnes) {
    if (typeof c.id !== "string" || c.id === "") echec(ecran, "colonne sans id");
    if (colonnes.has(c.id)) echec(ecran, `id de colonne en double « ${c.id} »`);
    colonnes.add(c.id);
  }
  const lignes = new Set<string>();
  for (const l of ecran.lignes) {
    if (typeof l.id !== "string" || l.id === "") echec(ecran, "ligne sans id");
    if (lignes.has(l.id)) echec(ecran, `id de ligne en double « ${l.id} »`);
    lignes.add(l.id);
  }
  if (ecran.lignes.length === 0) echec(ecran, "aucune ligne");
}

function verifierColonnesStructurees(ecran: EcranTableauSignes): void {
  const { colonnes } = ecran;
  if (colonnes.some((c) => c.genre !== "intervalle" && c.genre !== "valeur")) echec(ecran, "`genre` (intervalle | valeur) doit être déclaré sur TOUTES les colonnes ou sur aucune");
  if (colonnes.length < 3 || colonnes.length > NB_COLONNES_MAX || colonnes.length % 2 === 0) {
    echec(ecran, `${colonnes.length} colonnes (attendu : 2N+1 avec 3 ≤ 2N+1 ≤ ${NB_COLONNES_MAX}, soit 1 à 4 valeurs de x)`);
  }
  colonnes.forEach((c, i) => {
    const attendu = i % 2 === 0 ? "intervalle" : "valeur";
    if (c.genre !== attendu) echec(ecran, `la colonne ${i} (« ${c.id} ») doit être « ${attendu} » (alternance intervalle, valeur, …, intervalle)`);
    if (c.genre === "intervalle") {
      for (const a of ATTRIBUTS_STRUCTURE) if (a !== "genre" && c[a] !== undefined) echec(ecran, `colonne d'intervalle « ${c.id} » : \`${a}\` n'a de sens que sur une colonne « valeur »`);
    } else if (typeof c.valeur !== "string" || c.valeur.trim() === "") {
      echec(ecran, `colonne « ${c.id} » : \`valeur\` (texte de la valeur de x) est obligatoire`);
    }
  });
  if (ecran.signesAutorises !== undefined) echec(ecran, "`signesAutorises` d'écran n'existe que dans un tableau hérité (l'alphabet est dérivé)");
}

function alphabetSigne(colonne: ColonneTableauSignes, nature: "signe" | "quotient"): string[] {
  if (colonne.genre === "intervalle") return [...ALPHABET_DEUX];
  if (nature === "quotient" && colonne.pole === true) return [...ALPHABET_POLE];
  return colonne.racine === true ? [...ALPHABET_RACINE] : [...ALPHABET_DEUX];
}

/** Groupes de colonnes d'une ligne `variation` : chaque colonne `sommet` est seule, les colonnes entre deux points de changement sont fusionnées. */
function groupesVariation(colonnes: readonly ColonneTableauSignes[]): { colonnes: ColonneTableauSignes[]; sommet: boolean }[] {
  const groupes: { colonnes: ColonneTableauSignes[]; sommet: boolean }[] = [];
  for (const c of colonnes) {
    const dernier = groupes[groupes.length - 1];
    if (c.sommet === true) groupes.push({ colonnes: [c], sommet: true });
    else if (dernier && !dernier.sommet) dernier.colonnes.push(c);
    else groupes.push({ colonnes: [c], sommet: false });
  }
  return groupes;
}

function rangeeStructuree(ecran: EcranTableauSignes, ligne: LigneTableauSignes): RangeeResolue {
  if (ligne.signesAutorises !== undefined || ligne.rendu !== undefined) echec(ecran, `ligne « ${ligne.id} » : signesAutorises / rendu n'existent que dans un tableau hérité`);
  const nature = ligne.nature ?? "signe";
  if (nature !== "signe" && nature !== "quotient" && nature !== "variation") echec(ecran, `ligne « ${ligne.id} » : nature inconnue`);
  if (nature === "variation") {
    return {
      ligne: ligne.id,
      cellules: groupesVariation(ecran.colonnes).map((g) => ({
        ancre: g.colonnes[0].id,
        couvre: g.colonnes.map((c) => c.id),
        alphabet: [...(g.sommet ? ALPHABET_VARIATION_SOMMET : ALPHABET_VARIATION_INTERVALLE)],
      })),
    };
  }
  return { ligne: ligne.id, cellules: ecran.colonnes.map((c) => ({ ancre: c.id, couvre: [c.id], alphabet: alphabetSigne(c, nature) })) };
}

function rangeeHeritee(ecran: EcranTableauSignes, ligne: LigneTableauSignes): RangeeResolue {
  if (ligne.nature !== undefined) echec(ecran, `ligne « ${ligne.id} » : \`nature\` exige un tableau structuré (colonnes avec \`genre\`)`);
  const alphabet = ligne.signesAutorises && ligne.signesAutorises.length > 0 ? ligne.signesAutorises : ecran.signesAutorises;
  if (!alphabet || alphabet.length === 0) echec(ecran, `ligne « ${ligne.id} » sans alphabet`);
  return { ligne: ligne.id, cellules: ecran.colonnes.map((c) => ({ ancre: c.id, couvre: [c.id], alphabet: [...alphabet] })) };
}

/**
 * Une rangée résolue par ligne déclarée, dans l'ordre. Lève si la déclaration est incohérente.
 * Un tableau hérité mêlé d'attributs structurés est refusé (`genre` partiel).
 */
export function resoudreRangees(ecran: EcranTableauSignes): RangeeResolue[] {
  verifierIdsDistincts(ecran);
  if (!estTableauStructure(ecran)) {
    for (const c of ecran.colonnes) for (const a of ATTRIBUTS_STRUCTURE) if (c[a] !== undefined) echec(ecran, `colonne « ${c.id} » : \`${a}\` sans \`genre\` (déclarer \`genre\` partout ou nulle part)`);
    return ecran.lignes.map((l) => rangeeHeritee(ecran, l));
  }
  verifierColonnesStructurees(ecran);
  return ecran.lignes.map((l) => rangeeStructuree(ecran, l));
}

/** `lignesJustes` : une entrée par ligne déclarée (`Map`, jamais un objet à clés dynamiques) — un générateur qui distingue « signe juste, variation fausse » en a besoin. */
export type ComparaisonTableau = { ok: true; tousJustes: boolean; lignesJustes: ReadonlyMap<string, boolean> } | { ok: false; message: string };

/**
 * Compare la réponse décodée d'un élève à la solution `attendu` (mêmes clés : `{[ligne]:{[ancre]:valeur}}`).
 * `ok: false` (→ `parse_error` chez le générateur) : case manquante, case inconnue en trop, ou valeur hors de
 * l'alphabet de SA case. Un client honnête n'en produit jamais (« Valider » reste désactivé tant qu'un `?` reste) ;
 * ce sont des requêtes forgées ou périmées, jamais un essai raté. Toutes les clés viennent de l'élève : lecture
 * par `lirePropre` (RAPPORT §20), jamais `table[cle]`.
 */
export function comparerCasesTableau(rangees: readonly RangeeResolue[], saisi: CasesTableauSignes, attendu: Readonly<Record<string, Readonly<Record<string, string>>>>): ComparaisonTableau {
  const lignesConnues = new Set(rangees.map((r) => r.ligne));
  for (const cle of Object.keys(saisi)) if (!lignesConnues.has(cle)) return { ok: false, message: "Le tableau contient une ligne inconnue." };
  const lignesJustes = new Map<string, boolean>();
  for (const rangee of rangees) {
    const ligneSaisie = lirePropre(saisi, rangee.ligne);
    if (ligneSaisie === undefined) return { ok: false, message: "Complète toutes les cases du tableau avant de valider." };
    const ancres = new Set(rangee.cellules.map((c) => c.ancre));
    for (const cle of Object.keys(ligneSaisie)) if (!ancres.has(cle)) return { ok: false, message: "Le tableau contient une case inconnue." };
    const ligneAttendue = lirePropre(attendu, rangee.ligne);
    let ligneJuste = true;
    for (const cellule of rangee.cellules) {
      const valeur = lirePropre(ligneSaisie, cellule.ancre);
      if (typeof valeur !== "string") return { ok: false, message: "Complète toutes les cases du tableau avant de valider." };
      if (!cellule.alphabet.includes(valeur)) return { ok: false, message: "Une case du tableau contient une valeur qui ne fait pas partie de ses choix." };
      if (!ligneAttendue || lirePropre(ligneAttendue, cellule.ancre) !== valeur) ligneJuste = false;
    }
    lignesJustes.set(rangee.ligne, ligneJuste);
  }
  return { ok: true, tousJustes: [...lignesJustes.values()].every(Boolean), lignesJustes };
}
