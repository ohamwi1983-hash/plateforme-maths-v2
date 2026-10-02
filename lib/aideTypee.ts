import { commandesInterditesDans } from "./balisageMath";

/**
 * Aide TYPÉE : exactement TROIS formes (la troisième, `annotations_figure`, est une décision de contrat du propriétaire, RAPPORT §56) ; une quatrième = nouvelle décision de
 * contrat. Une aide reste une donnée : jamais du HTML, jamais du code. Elle n'est jamais envoyée avec
 * l'écran, seulement par `POST /api/reponses/aide` (qui en enregistre l'usage côté serveur), et le
 * serveur la VALIDE avant de la servir (`validerAide`) : une aide invalide n'est ni servie ni comptée.
 *
 *  - `formule_coloree` : une formule découpée en segments LaTeX (sans `$`) ; `role` colore un segment
 *    (a, b ou c — classes `moteur-coef-a|b|c`, tokens de design). Le client assemble les segments. Un
 *    segment n'est jamais vide : un coefficient de valeur absolue 1 s'écrit sans chiffre, il n'y a rien à
 *    colorer, on OMET le segment (son signe reste dans un segment sans rôle).
 *  - `croquis_parabole` : croquis qualitatif de y = ax² + bx + c (a, b, c réels FINIS, a ≠ 0 ; entiers ou non : RAPPORT §49, coefficients irrationnels) ; les options
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

/**
 * Annotation d'une FIGURE déjà affichée (RAPPORT §56) : un point étiqueté, ou un vecteur étiqueté (flèche de `de` à `vers`). Coordonnées dans le REPÈRE de la figure (mêmes unités
 * que `fenetre`). L'étiquette est du TEXTE BRUT (rendu dans le SVG : ni `$`, ni LaTeX).
 */
export type Annotation =
  | { genre: "point"; x: number; y: number; etiquette: string }
  | { genre: "vecteur"; de: [number, number]; vers: [number, number]; etiquette: string };

export interface PalierAnnotations {
  /** Texte d'AUTEUR (balisage `$…$` admis) affiché dans la zone d'aide, à côté du graphique annoté. */
  legende: string;
  annotations: Annotation[];
}

/**
 * 3ᵉ forme d'aide typée (décision de contrat du propriétaire, RAPPORT §56) : des PALIERS d'annotations posées sur la figure de l'écran. Déclarée ENTIÈRE par le générateur, jamais envoyée
 * avec l'écran : `POST /api/reponses/aide` ne sert que le palier demandé, sous la forme `AideAnnotationsFigureServie` (annotations CUMULÉES des paliers ≤ p). Un palier `p` n'est servi que si
 * le palier `p − 1` l'a été (état serveur : `aides_utilisees.palier`).
 */
export interface AideAnnotationsFigure {
  type: "annotations_figure";
  paliers: PalierAnnotations[];
}

/** Ce que le navigateur reçoit pour `annotations_figure` : un palier, annotations cumulées, nombre total de paliers (pour proposer « Un indice de plus »). */
export interface AideAnnotationsFigureServie {
  type: "annotations_figure";
  palier: number;
  palierTotal: number;
  legende: string;
  annotations: Annotation[];
}

export type AideTypee = AideFormuleColoree | AideCroquisParabole | AideAnnotationsFigure;

export const PALIERS_MAX = 3;
export const ANNOTATIONS_PAR_PALIER_MAX = 6;
export const ETIQUETTE_LONGUEUR_MAX = 60;
export const COORDONNEE_MAX = 1e6;

/** Nombre de paliers d'une aide DÉCLARÉE (1 pour toute aide sans paliers). */
export function nombrePaliers(aide: unknown): number {
  if (typeof aide === "object" && aide !== null && (aide as { type?: unknown }).type === "annotations_figure" && Array.isArray((aide as { paliers?: unknown }).paliers)) {
    return (aide as { paliers: unknown[] }).paliers.length;
  }
  return 1;
}

/** Réduit une aide VALIDÉE au palier `palier` (1-indexé) : annotations cumulées des paliers ≤ `palier`, légende du palier `palier`. */
export function aideAuPalier(aide: AideAnnotationsFigure, palier: number): AideAnnotationsFigureServie {
  const retenus = aide.paliers.slice(0, palier);
  return {
    type: "annotations_figure",
    palier,
    palierTotal: aide.paliers.length,
    legende: (retenus[retenus.length - 1] as PalierAnnotations).legende,
    annotations: retenus.flatMap((p) => p.annotations),
  };
}

export const NB_SEGMENTS_MAX = 40;
export const LONGUEUR_LATEX_MAX = 200;
export const COEFFICIENT_MAX = 10000;
/** `|a|` en dessous : parabole dégénérée (aucun croquis lisible). */
export const COEFFICIENT_A_ABS_MIN = 1e-6;

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
      if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > COEFFICIENT_MAX) problemes.push(`croquis_parabole : ${cle} doit être un nombre fini de valeur absolue ≤ ${COEFFICIENT_MAX}`);
    }
    if (typeof objet.a === "number" && Math.abs(objet.a) < COEFFICIENT_A_ABS_MIN) problemes.push("croquis_parabole : a ne peut pas valoir 0 (ni être quasi nul)");
    for (const cle of ["marqueS", "surlignageImf", "marquesOx"] as const) {
      if (objet[cle] !== undefined && typeof objet[cle] !== "boolean") problemes.push(`croquis_parabole : ${cle} doit être un booléen`);
    }
    return problemes;
  }

  if (objet.type === "annotations_figure") {
    for (const k of clesInconnues(objet, ["type", "paliers"])) problemes.push(`annotations_figure : clé inconnue « ${k} »`);
    if (!Array.isArray(objet.paliers) || objet.paliers.length === 0 || objet.paliers.length > PALIERS_MAX) {
      problemes.push(`annotations_figure : \`paliers\` doit être un tableau de 1 à ${PALIERS_MAX} paliers`);
      return problemes;
    }
    const nombre = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= COORDONNEE_MAX;
    const couple = (v: unknown): boolean => Array.isArray(v) && v.length === 2 && v.every(nombre);
    objet.paliers.forEach((palier: unknown, i: number) => {
      const lieu = `annotations_figure : palier ${i + 1}`;
      if (typeof palier !== "object" || palier === null || Array.isArray(palier)) {
        problemes.push(`${lieu} : objet attendu`);
        return;
      }
      const p = palier as Record<string, unknown>;
      for (const k of clesInconnues(p, ["legende", "annotations"])) problemes.push(`${lieu} : clé inconnue « ${k} »`);
      if (typeof p.legende !== "string" || p.legende.trim() === "") problemes.push(`${lieu} : \`legende\` doit être une chaîne non vide`);
      else {
        if (p.legende.length > LONGUEUR_LATEX_MAX) problemes.push(`${lieu} : légende de ${p.legende.length} caractères (maximum ${LONGUEUR_LATEX_MAX})`);
        for (const c of commandesInterditesDans(p.legende)) problemes.push(`${lieu} : commande interdite \\${c}`);
      }
      if (!Array.isArray(p.annotations) || p.annotations.length === 0 || p.annotations.length > ANNOTATIONS_PAR_PALIER_MAX) {
        problemes.push(`${lieu} : \`annotations\` doit contenir de 1 à ${ANNOTATIONS_PAR_PALIER_MAX} annotations`);
        return;
      }
      p.annotations.forEach((a: unknown, j: number) => {
        const ou = `${lieu}, annotation ${j + 1}`;
        if (typeof a !== "object" || a === null || Array.isArray(a)) {
          problemes.push(`${ou} : objet attendu`);
          return;
        }
        const an = a as Record<string, unknown>;
        if (an.genre === "point") {
          for (const k of clesInconnues(an, ["genre", "x", "y", "etiquette"])) problemes.push(`${ou} : clé inconnue « ${k} »`);
          if (!nombre(an.x) || !nombre(an.y)) problemes.push(`${ou} : x et y doivent être des nombres finis (|v| ≤ ${COORDONNEE_MAX})`);
        } else if (an.genre === "vecteur") {
          for (const k of clesInconnues(an, ["genre", "de", "vers", "etiquette"])) problemes.push(`${ou} : clé inconnue « ${k} »`);
          if (!couple(an.de) || !couple(an.vers)) problemes.push(`${ou} : de et vers doivent être des couples de nombres finis`);
        } else problemes.push(`${ou} : genre « ${String(an.genre)} » inconnu (point ou vecteur)`);
        if (typeof an.etiquette !== "string" || an.etiquette.trim() === "" || an.etiquette.length > ETIQUETTE_LONGUEUR_MAX || /[$\\]/.test(an.etiquette)) {
          problemes.push(`${ou} : \`etiquette\` doit être un texte brut non vide (≤ ${ETIQUETTE_LONGUEUR_MAX} caractères, sans « $ » ni « \\ »)`);
        }
      });
    });
    return problemes;
  }

  return [`aide typée : type inconnu « ${String(objet.type)} » (formule_coloree, croquis_parabole ou annotations_figure)`];
}

/** Une aide est « présente » (donc `aide_disponible`) si c'est une chaîne non vide ou un objet ; sa VALIDITÉ n'est contrôlée qu'à la livraison. */
export function aidePresente(aide: unknown): boolean {
  return (typeof aide === "string" && aide !== "") || (typeof aide === "object" && aide !== null);
}
