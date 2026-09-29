import { commandesInterditesDans } from "./balisageMath";

/**
 * Aide TYPÉE : exactement DEUX formes, pas une de plus (une troisième forme = nouvelle décision de
 * contrat). Une aide reste une donnée : jamais du HTML, jamais du code. Elle n'est jamais envoyée avec
 * l'écran, seulement par `POST /api/reponses/aide` (qui en enregistre l'usage côté serveur), et le
 * serveur la VALIDE avant de la servir (`validerAide`) : une aide invalide n'est ni servie ni comptée.
 *
 *  - `formule_coloree` : une formule découpée en segments LaTeX (sans `$`) ; `role` colore un segment
 *    (a, b ou c — classes `moteur-coef-a|b|c`, tokens de design). Le client assemble les segments. Un
 *    segment n'est jamais vide : un coefficient de valeur absolue 1 s'écrit sans chiffre, il n'y a rien à
 *    colorer, on OMET le segment (son signe reste dans un segment sans rôle).
 *  - `croquis_parabole` : croquis qualitatif de y = ax² + bx + c (a, b, c entiers, a ≠ 0) ; les options
 *    ajoutent des surcouches (marque S, surlignage de l'ensemble-image, marques sur Ox). Le client
 *    calcule la géométrie : c'est un AFFICHAGE, jamais une vérification.
 */

export const ROLES_COEFFICIENT = ["a", "b", "c"] as const;
export type RoleCoefficient = (typeof ROLES_COEFFICIENT)[number];

export interface SegmentFormule {
  /** Fragment LaTeX, sans délimiteur `$`, sans commande de couleur/lien/image. */
  latex: string;
  role?: RoleCoefficient;
}

export interface AideFormuleColoree {
  type: "formule_coloree";
  segments: SegmentFormule[];
}

export interface AideCroquisParabole {
  type: "croquis_parabole";
  a: number;
  b: number;
  c: number;
  marqueS?: boolean;
  surlignageImf?: boolean;
  marquesOx?: boolean;
}

export type AideTypee = AideFormuleColoree | AideCroquisParabole;

export const NB_SEGMENTS_MAX = 40;
export const LONGUEUR_LATEX_MAX = 200;
export const COEFFICIENT_MAX = 10000;

function clesInconnues(objet: Record<string, unknown>, autorisees: readonly string[]): string[] {
  return Object.keys(objet).filter((k) => !autorisees.includes(k));
}

/** Liste des problèmes d'une aide typée (vide = valide). Ne lève jamais. */
export function validerAide(aide: unknown): string[] {
  if (typeof aide !== "object" || aide === null || Array.isArray(aide)) return ["aide typée : objet attendu"];
  const objet = aide as Record<string, unknown>;
  const problemes: string[] = [];

  if (objet.type === "formule_coloree") {
    for (const k of clesInconnues(objet, ["type", "segments"])) problemes.push(`formule_coloree : clé inconnue « ${k} »`);
    if (!Array.isArray(objet.segments) || objet.segments.length === 0) {
      problemes.push("formule_coloree : `segments` doit être un tableau non vide");
      return problemes;
    }
    if (objet.segments.length > NB_SEGMENTS_MAX) problemes.push(`formule_coloree : ${objet.segments.length} segments (maximum ${NB_SEGMENTS_MAX})`);
    objet.segments.forEach((segment: unknown, i: number) => {
      if (typeof segment !== "object" || segment === null || Array.isArray(segment)) {
        problemes.push(`formule_coloree : segment ${i} : objet attendu`);
        return;
      }
      const s = segment as Record<string, unknown>;
      for (const k of clesInconnues(s, ["latex", "role"])) problemes.push(`formule_coloree : segment ${i} : clé inconnue « ${k} »`);
      if (typeof s.latex !== "string" || s.latex.trim() === "") {
        problemes.push(`formule_coloree : segment ${i} : \`latex\` doit être une chaîne non vide`);
      } else {
        if (s.latex.length > LONGUEUR_LATEX_MAX) problemes.push(`formule_coloree : segment ${i} : ${s.latex.length} caractères (maximum ${LONGUEUR_LATEX_MAX})`);
        if (s.latex.includes("$")) problemes.push(`formule_coloree : segment ${i} : le fragment ne doit contenir aucun « $ » (tout est déjà mathématique)`);
        for (const c of commandesInterditesDans(s.latex)) problemes.push(`formule_coloree : segment ${i} : commande interdite \\${c}`);
      }
      if (s.role !== undefined && !(ROLES_COEFFICIENT as readonly unknown[]).includes(s.role)) problemes.push(`formule_coloree : segment ${i} : rôle « ${String(s.role)} » inconnu (a, b ou c)`);
    });
    return problemes;
  }

  if (objet.type === "croquis_parabole") {
    for (const k of clesInconnues(objet, ["type", "a", "b", "c", "marqueS", "surlignageImf", "marquesOx"])) problemes.push(`croquis_parabole : clé inconnue « ${k} »`);
    for (const cle of ["a", "b", "c"] as const) {
      const v = objet[cle];
      if (typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) > COEFFICIENT_MAX) problemes.push(`croquis_parabole : ${cle} doit être un entier de valeur absolue ≤ ${COEFFICIENT_MAX}`);
    }
    if (objet.a === 0) problemes.push("croquis_parabole : a ne peut pas valoir 0");
    for (const cle of ["marqueS", "surlignageImf", "marquesOx"] as const) {
      if (objet[cle] !== undefined && typeof objet[cle] !== "boolean") problemes.push(`croquis_parabole : ${cle} doit être un booléen`);
    }
    return problemes;
  }

  return [`aide typée : type inconnu « ${String(objet.type)} » (formule_coloree ou croquis_parabole)`];
}

/** Une aide est « présente » (donc `aide_disponible`) si c'est une chaîne non vide ou un objet ; sa VALIDITÉ n'est contrôlée qu'à la livraison. */
export function aidePresente(aide: unknown): boolean {
  return (typeof aide === "string" && aide !== "") || (typeof aide === "object" && aide !== null);
}
