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
 *    colorer, on OMET le segment (son signe reste dans un segment sans rôle). Deux extensions (RAPPORT §59, MÊME forme, pas une 4ᵉ) :
 *      · `emphase: true` sur un segment : mise en évidence NEUTRE d'une quantité qui n'est pas un coefficient (fond + soulignement, aucun token `--coef-*`) ; jamais avec un `role` ;
 *      · `paliers` (1 à 3) À LA PLACE de `segments` : chaque palier a sa légende (texte d'auteur, facultative) et SA formule complète. Le serveur ne sert que le palier demandé
 *        (même mécanisme que `annotations_figure` : `aides_utilisees.palier`, pénalité binaire).
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
  /** Mise en évidence neutre (jamais avec `role`). */
  emphase?: boolean;
}

/** Un palier d'une aide `formule_coloree` : une légende d'auteur facultative et la formule COMPLÈTE de ce palier (rien n'est cumulé : le générateur reprend ce qu'il veut garder). */
export interface PalierFormule {
  legende?: string;
  segments: SegmentFormule[];
}

/** Exactement UNE des deux écritures : `segments` (aide sans paliers, historique) ou `paliers`. */
export interface AideFormuleColoree {
  type: "formule_coloree";
  segments?: SegmentFormule[];
  paliers?: PalierFormule[];
}

/** Ce que le navigateur reçoit pour une `formule_coloree` À PALIERS : un palier, le nombre total de paliers, sa légende et sa formule. */
export interface AideFormuleColoreeServie {
  type: "formule_coloree";
  palier: number;
  palierTotal: number;
  legende?: string;
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

export type AideFormuleAPaliers = AideFormuleColoree & { paliers: PalierFormule[] };
/** Les deux écritures d'aide à paliers. */
export type AideAPaliers = AideAnnotationsFigure | AideFormuleAPaliers;
export type AideServieAPaliers = AideAnnotationsFigureServie | AideFormuleColoreeServie;

/** Une aide typée DÉCLARÉE est-elle à paliers ? (`annotations_figure`, ou `formule_coloree` écrite avec `paliers`.) Seule porte de décision côté serveur. */
export function aideAPaliers(aide: unknown): aide is AideAPaliers {
  if (typeof aide !== "object" || aide === null) return false;
  const a = aide as { type?: unknown; paliers?: unknown };
  return (a.type === "annotations_figure" || a.type === "formule_coloree") && Array.isArray(a.paliers);
}

/** Nombre de paliers d'une aide DÉCLARÉE (1 pour toute aide sans paliers). */
export function nombrePaliers(aide: unknown): number {
  return aideAPaliers(aide) ? aide.paliers.length : 1;
}

/**
 * Réduit une aide VALIDÉE à paliers au palier `palier` (1-indexé). `annotations_figure` : annotations cumulées des paliers ≤ `palier`, légende du palier `palier`. `formule_coloree` : la légende et la
 * formule du palier `palier` SEULS (chaque palier est complet).
 */
export function aideAuPalier(aide: AideAnnotationsFigure, palier: number): AideAnnotationsFigureServie;
export function aideAuPalier(aide: AideFormuleAPaliers, palier: number): AideFormuleColoreeServie;
export function aideAuPalier(aide: AideAPaliers, palier: number): AideServieAPaliers;
export function aideAuPalier(aide: AideAPaliers, palier: number): AideServieAPaliers {
  if (aide.type === "formule_coloree") {
    const p = aide.paliers[palier - 1] as PalierFormule;
    return { type: "formule_coloree", palier, palierTotal: aide.paliers.length, ...(p.legende !== undefined ? { legende: p.legende } : {}), segments: p.segments };
  }
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

/** Problèmes d'une liste de segments de formule (vide = valide). `lieu` préfixe chaque message. */
function validerSegments(segments: unknown, lieu: string): string[] {
  const problemes: string[] = [];
  if (!Array.isArray(segments) || segments.length === 0) return [`${lieu} : \`segments\` doit être un tableau non vide`];
  if (segments.length > NB_SEGMENTS_MAX) problemes.push(`${lieu} : ${segments.length} segments (maximum ${NB_SEGMENTS_MAX})`);
  segments.forEach((segment: unknown, i: number) => {
    if (typeof segment !== "object" || segment === null || Array.isArray(segment)) {
      problemes.push(`${lieu} : segment ${i} : objet attendu`);
      return;
    }
    const s = segment as Record<string, unknown>;
    for (const k of clesInconnues(s, ["latex", "role", "emphase"])) problemes.push(`${lieu} : segment ${i} : clé inconnue « ${k} »`);
    if (typeof s.latex !== "string" || s.latex.trim() === "") {
      problemes.push(`${lieu} : segment ${i} : \`latex\` doit être une chaîne non vide`);
    } else {
      if (s.latex.length > LONGUEUR_LATEX_MAX) problemes.push(`${lieu} : segment ${i} : ${s.latex.length} caractères (maximum ${LONGUEUR_LATEX_MAX})`);
      if (s.latex.includes("$")) problemes.push(`${lieu} : segment ${i} : le fragment ne doit contenir aucun « $ » (tout est déjà mathématique)`);
      for (const c of commandesInterditesDans(s.latex)) problemes.push(`${lieu} : segment ${i} : commande interdite \\${c}`);
    }
    if (s.role !== undefined && !(ROLES_COEFFICIENT as readonly unknown[]).includes(s.role)) problemes.push(`${lieu} : segment ${i} : rôle « ${String(s.role)} » inconnu (a, b ou c)`);
    if (s.emphase !== undefined && typeof s.emphase !== "boolean") problemes.push(`${lieu} : segment ${i} : \`emphase\` doit être un booléen`);
    if (s.emphase === true && s.role !== undefined) problemes.push(`${lieu} : segment ${i} : \`emphase\` et \`role\` s'excluent (l'emphase n'est pas un coefficient)`);
  });
  return problemes;
}

/** Liste des problèmes d'une aide typée (vide = valide). Ne lève jamais. */
export function validerAide(aide: unknown): string[] {
  if (typeof aide !== "object" || aide === null || Array.isArray(aide)) return ["aide typée : objet attendu"];
  const objet = aide as Record<string, unknown>;
  const problemes: string[] = [];

  if (objet.type === "formule_coloree") {
    for (const k of clesInconnues(objet, ["type", "segments", "paliers"])) problemes.push(`formule_coloree : clé inconnue « ${k} »`);
    const aSegments = objet.segments !== undefined;
    const aPaliers = objet.paliers !== undefined;
    if (aSegments === aPaliers) {
      problemes.push("formule_coloree : exactement UNE des clés `segments` ou `paliers` est attendue");
      return problemes;
    }
    if (aSegments) {
      problemes.push(...validerSegments(objet.segments, "formule_coloree"));
      return problemes;
    }
    if (!Array.isArray(objet.paliers) || objet.paliers.length === 0 || objet.paliers.length > PALIERS_MAX) {
      problemes.push(`formule_coloree : \`paliers\` doit être un tableau de 1 à ${PALIERS_MAX} paliers`);
      return problemes;
    }
    objet.paliers.forEach((palier: unknown, i: number) => {
      const lieu = `formule_coloree : palier ${i + 1}`;
      if (typeof palier !== "object" || palier === null || Array.isArray(palier)) {
        problemes.push(`${lieu} : objet attendu`);
        return;
      }
      const p = palier as Record<string, unknown>;
      for (const k of clesInconnues(p, ["legende", "segments"])) problemes.push(`${lieu} : clé inconnue « ${k} »`);
      if (p.legende !== undefined) {
        if (typeof p.legende !== "string" || p.legende.trim() === "") problemes.push(`${lieu} : \`legende\` doit être une chaîne non vide`);
        else {
          if (p.legende.length > LONGUEUR_LATEX_MAX) problemes.push(`${lieu} : légende de ${p.legende.length} caractères (maximum ${LONGUEUR_LATEX_MAX})`);
          for (const c of commandesInterditesDans(p.legende)) problemes.push(`${lieu} : commande interdite \\${c}`);
        }
      }
      problemes.push(...validerSegments(p.segments, lieu));
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
