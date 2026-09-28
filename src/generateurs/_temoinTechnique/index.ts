import { creerPrng } from "../../../lib/prng";
import { decoderListeValeurs, decoderTableauSignes } from "../../../lib/reponsesEcran";
import { etatActuelSequentiel, type EcranDeclare, type Generateur, type ReponseConfirmee, type ResultatVerification } from "../../../lib/contratGenerateur";

/**
 * Générateur TÉMOIN TECHNIQUE — non curriculaire, jetable dans son contenu mais permanent dans son
 * rôle : un écran par type de la bibliothèque (`champ_expression`, `qcm`, `liste_valeurs`,
 * `tableau_signes`), pour valider le contrat, le moteur client et le dispatcher serveur de bout en
 * bout, et pour valider tout futur ajout de type d'écran. Ne couvre AUCUN cas réel de gen7 (voir
 * RAPPORT.md §10, risque connu). Jamais dans `CATALOGUE_GENERATEURS` ni dans
 * `public/catalogue-generateurs-complet.json` : le registre refuse de démarrer sinon.
 */

export const VARIANTE_TEMOIN = "_temoin_technique_v1";
export const GENERATEUR_TEMOIN = "_temoin_technique";

export const CODE_ERREUR_CALCUL = "TEMOIN_ERREUR_CALCUL";
export const CODE_MAUVAIS_CHOIX = "TEMOIN_MAUVAIS_CHOIX";

export const CHAMP_SOMME = "somme";
export const CHAMP_PARITE = "parite";
export const CHAMP_DIVISEURS = "diviseurs";
export const CHAMP_SIGNES = "signes";

export interface ExerciceTemoin {
  a: number;
  b: number;
  /** Entier dont on cherche les diviseurs positifs. */
  n: number;
  /** Racines r1 < r2 de (x − r1)(x − r2). */
  r1: number;
  r2: number;
}

const CHOIX_PARITE = [
  { id: "pair", libelle: "Pair" },
  { id: "impair", libelle: "Impair" },
  { id: "ni", libelle: "Ni pair ni impair" },
];

const COLONNES_SIGNES = ["c0", "c1", "c2", "c3", "c4"];

function signeEn(valeur: number): string {
  return valeur > 0 ? "+" : valeur < 0 ? "-" : "0";
}

/** Signe de (x − r) sur chacune des 5 colonnes : x < r1, x = r1, r1 < x < r2, x = r2, x > r2. */
function signesDuFacteur(r: number, r1: number, r2: number): Record<string, string> {
  const pointsDeTest = [r1 - 1, r1, (r1 + r2) / 2, r2, r2 + 1];
  return Object.fromEntries(COLONNES_SIGNES.map((colonne, i) => [colonne, signeEn(pointsDeTest[i] - r)]));
}

function signesDuProduit(r1: number, r2: number): Record<string, string> {
  const pointsDeTest = [r1 - 1, r1, (r1 + r2) / 2, r2, r2 + 1];
  return Object.fromEntries(COLONNES_SIGNES.map((colonne, i) => [colonne, signeEn((pointsDeTest[i] - r1) * (pointsDeTest[i] - r2))]));
}

function solutionSigneParLigne(ex: ExerciceTemoin): Record<string, Record<string, string>> {
  return {
    facteur1: signesDuFacteur(ex.r1, ex.r1, ex.r2),
    facteur2: signesDuFacteur(ex.r2, ex.r1, ex.r2),
    produit: signesDuProduit(ex.r1, ex.r2),
  };
}

function diviseursPositifs(n: number): number[] {
  const resultat: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) resultat.push(d);
  return resultat;
}

/**
 * Évaluateur arithmétique minimal (entiers/décimaux, + − × ÷, parenthèses, moins unaire) — écrit
 * pour ce témoin uniquement, sans `eval`. Renvoie un message pédagogique en cas d'échec de lecture.
 */
function evaluerExpression(texte: string): { ok: true; valeur: number } | { ok: false; message: string } {
  const source = texte.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
  if (source === "") return { ok: false, message: "Écris une expression avant de valider." };
  let i = 0;
  const erreur = (message: string): never => {
    throw new Error(message);
  };
  function facteur(): number {
    if (source[i] === "-") {
      i++;
      return -facteur();
    }
    if (source[i] === "+") {
      i++;
      return facteur();
    }
    if (source[i] === "(") {
      i++;
      const v = somme();
      if (source[i] !== ")") erreur("Il manque une parenthèse fermante.");
      i++;
      return v;
    }
    const debut = i;
    while (i < source.length && /[0-9.]/.test(source[i])) i++;
    if (i === debut) return erreur(source[i] === undefined ? "L'expression semble incomplète : il manque un nombre à la fin." : `Le caractère « ${source[i]} » n'est pas reconnu ici.`);
    const nombre = Number(source.slice(debut, i));
    if (Number.isNaN(nombre)) return erreur("Un nombre est mal écrit (trop de points ou de virgules).");
    return nombre;
  }
  function produit(): number {
    let v = facteur();
    while (source[i] === "*" || source[i] === "/") {
      const op = source[i++];
      const droite = facteur();
      if (op === "/" && droite === 0) erreur("Division par zéro impossible.");
      v = op === "*" ? v * droite : v / droite;
    }
    return v;
  }
  function somme(): number {
    let v = produit();
    while (source[i] === "+" || source[i] === "-") {
      const op = source[i++];
      const droite = produit();
      v = op === "+" ? v + droite : v - droite;
    }
    return v;
  }
  try {
    const valeur = somme();
    if (i < source.length) return { ok: false, message: `Le caractère « ${source[i]} » n'est pas reconnu ici.` };
    return { ok: true, valeur };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Expression illisible." };
  }
}

function ecransDe(ex: ExerciceTemoin): EcranDeclare[] {
  return [
    {
      champ: CHAMP_SOMME,
      type: "champ_expression",
      consigne: `Calcule ${ex.a} + ${ex.b}.`,
      aide: "Additionne les deux nombres.",
      placeholder: "Ta réponse",
    },
    {
      champ: CHAMP_PARITE,
      type: "qcm",
      consigne: `Le nombre ${ex.a} + ${ex.b} est-il pair ou impair ?`,
      aide: "Un nombre pair se termine par 0, 2, 4, 6 ou 8.",
      choix: CHOIX_PARITE,
    },
    {
      champ: CHAMP_DIVISEURS,
      type: "liste_valeurs",
      consigne: `Liste tous les diviseurs positifs de ${ex.n}.`,
      aide: "Cherche les entiers d tels que le reste de la division de n par d vaut 0.",
      etiquetteAjout: "Ajouter un diviseur",
    },
    {
      champ: CHAMP_SIGNES,
      type: "tableau_signes",
      consigne: `Complète le tableau de signes de (x − ${ex.r1})(x − ${ex.r2}).`,
      aide: "Le produit est positif quand les deux facteurs ont le même signe.",
      colonnes: [
        { id: "c0", libelle: `x < ${ex.r1}` },
        { id: "c1", libelle: `x = ${ex.r1}` },
        { id: "c2", libelle: `${ex.r1} < x < ${ex.r2}` },
        { id: "c3", libelle: `x = ${ex.r2}` },
        { id: "c4", libelle: `x > ${ex.r2}` },
      ],
      lignes: [
        { id: "facteur1", libelle: `x − ${ex.r1}` },
        { id: "facteur2", libelle: `x − ${ex.r2}` },
        { id: "produit", libelle: "Produit" },
      ],
      signesAutorises: ["+", "-", "0"],
    },
  ];
}

function resultat(statut: "correct" | "not_equivalent", codesCompetence: string[] = []): ResultatVerification {
  return { statut, codesCompetence };
}

export const generateurTemoinTechnique: Generateur<ExerciceTemoin> = {
  variante_id: VARIANTE_TEMOIN,
  generateur_id: GENERATEUR_TEMOIN,
  curriculaire: false,
  codesCompetenceDeclares: [CODE_ERREUR_CALCUL, CODE_MAUVAIS_CHOIX],

  generer(graine: number): ExerciceTemoin {
    const prng = creerPrng(graine);
    const a = prng.entierEntre(11, 49);
    const b = prng.entierEntre(11, 49);
    const n = prng.choisir([12, 18, 20, 24, 30, 36]);
    const r1 = prng.entierEntre(-4, 1);
    const r2 = r1 + prng.entierEntre(2, 5);
    return { a, b, n, r1, r2 };
  },

  ecrans: ecransDe,

  etatActuel(exercice: ExerciceTemoin, reponsesConfirmees: ReponseConfirmee[]) {
    return etatActuelSequentiel(ecransDe(exercice).map((e) => e.champ), reponsesConfirmees);
  },

  verifier(ex: ExerciceTemoin, champ: string, reponseBrute: string): ResultatVerification {
    if (champ === CHAMP_SOMME) {
      const lu = evaluerExpression(reponseBrute);
      if (!lu.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: lu.message };
      if (lu.valeur === ex.a + ex.b) return resultat("correct");
      const confondOperation = lu.valeur === ex.a - ex.b || lu.valeur === ex.a * ex.b;
      return resultat("not_equivalent", confondOperation ? [CODE_ERREUR_CALCUL] : []);
    }
    if (champ === CHAMP_PARITE) {
      if (!CHOIX_PARITE.some((c) => c.id === reponseBrute)) return { statut: "parse_error", codesCompetence: [], messageErreur: "Ce choix n'existe pas : sélectionne l'une des propositions." };
      const attendu = (ex.a + ex.b) % 2 === 0 ? "pair" : "impair";
      if (reponseBrute === attendu) return resultat("correct");
      return resultat("not_equivalent", reponseBrute === "ni" ? [CODE_MAUVAIS_CHOIX] : []);
    }
    if (champ === CHAMP_DIVISEURS) {
      const liste = decoderListeValeurs(reponseBrute);
      if (!liste.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: liste.message };
      const nombres = liste.valeur.map((v) => Number(v.replace(",", ".")));
      if (nombres.some((v) => !Number.isInteger(v))) return { statut: "parse_error", codesCompetence: [], messageErreur: "Chaque valeur doit être un nombre entier (par exemple 6)." };
      const saisis = new Set(nombres);
      const attendus = new Set(diviseursPositifs(ex.n));
      const identiques = saisis.size === attendus.size && [...attendus].every((d) => saisis.has(d));
      return resultat(identiques ? "correct" : "not_equivalent");
    }
    if (champ === CHAMP_SIGNES) {
      const tableau = decoderTableauSignes(reponseBrute);
      if (!tableau.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: tableau.message };
      const attendu = solutionSigneParLigne(ex);
      for (const ligne of Object.keys(attendu)) {
        for (const colonne of COLONNES_SIGNES) {
          if (typeof tableau.valeur[ligne]?.[colonne] !== "string") return { statut: "parse_error", codesCompetence: [], messageErreur: "Complète toutes les cases du tableau avant de valider." };
          if (!["+", "-", "0"].includes(tableau.valeur[ligne][colonne])) return { statut: "parse_error", codesCompetence: [], messageErreur: "Un signe du tableau n'est pas reconnu (attendu : +, - ou 0)." };
        }
      }
      const tousJustes = Object.entries(attendu).every(([ligne, colonnes]) => COLONNES_SIGNES.every((c) => tableau.valeur[ligne][c] === colonnes[c]));
      return resultat(tousJustes ? "correct" : "not_equivalent");
    }
    throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
  },

  solutionAttendue(ex: ExerciceTemoin, champ: string): string {
    if (champ === CHAMP_SOMME) return String(ex.a + ex.b);
    if (champ === CHAMP_PARITE) return (ex.a + ex.b) % 2 === 0 ? "Pair" : "Impair";
    if (champ === CHAMP_DIVISEURS) return diviseursPositifs(ex.n).join(", ");
    if (champ === CHAMP_SIGNES) {
      const sol = solutionSigneParLigne(ex);
      return Object.entries(sol)
        .map(([ligne, colonnes]) => `${ligne} : ${COLONNES_SIGNES.map((c) => colonnes[c]).join(" ")}`)
        .join(" ; ");
    }
    throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
  },
};

/**
 * Outil de TEST uniquement (jamais utilisé par le serveur ni le client) : `reponseBrute` correcte
 * d'un champ, dans le format documenté par type d'écran (lib/contratGenerateur.ts). Permet aux tests
 * et à la validation Chromium de jouer un exercice sans dupliquer la logique de solution.
 */
export function reponseBruteCorrecte(ex: ExerciceTemoin, champ: string): string {
  if (champ === CHAMP_SOMME) return String(ex.a + ex.b);
  if (champ === CHAMP_PARITE) return (ex.a + ex.b) % 2 === 0 ? "pair" : "impair";
  if (champ === CHAMP_DIVISEURS) return JSON.stringify(diviseursPositifs(ex.n).map(String));
  if (champ === CHAMP_SIGNES) return JSON.stringify(solutionSigneParLigne(ex));
  throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
}
