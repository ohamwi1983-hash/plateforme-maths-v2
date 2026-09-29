import { ErreurSyntaxe } from "./erreurSyntaxe";

/**
 * Évaluateur d'expressions NUMÉRIQUES du champ « racines » (`racinesChamp2`) : réécriture locale du
 * comportement de `pilote:src/moteur/expressionGenerale.ts` @ 6acc102 + `normalisationNumerique.ts`.
 * Distinct de `expressionAlgebrique.ts` (autre grammaire : ici des fonctions, des barres `|…|`, et `x` n'est
 * JAMAIS une variable). Reproduit tel quel, y compris ses particularités (vérifiées par la table de vérité
 * différentielle) : toute lettre `x`/`X` est d'abord remplacée par `*` (« 2x3 » = 2·3, « x » seul = erreur) ;
 * une valeur hors domaine (√ d'un négatif, division par 0) donne NaN/±∞ SANS erreur de lecture.
 *
 * Fonctions (insensibles à la casse) : sqrt/racine/racinecarree, cbrt/racinecubique/racine3,
 * abs/valeurabsolue ; `|…|` = abs ; exposants ², ³ ; puissance d'exposant fractionnaire signée
 * (`(x)^(1/3)` ≡ cbrt).
 */

type TypeJeton = "NOMBRE" | "PLUS" | "MOINS" | "FOIS" | "DIVISE" | "PUISSANCE" | "PAR_OUVRANTE" | "PAR_FERMANTE" | "BARRE" | "FONCTION";
type NomFonction = "sqrt" | "cbrt" | "abs";

interface Jeton {
  type: TypeJeton;
  valeur?: number;
  fonction?: NomFonction;
}

const NOMS_FONCTIONS: Record<string, NomFonction> = {
  sqrt: "sqrt",
  racine: "sqrt",
  racinecarree: "sqrt",
  cbrt: "cbrt",
  racinecubique: "cbrt",
  racine3: "cbrt",
  abs: "abs",
  valeurabsolue: "abs",
};

const OPERATEURS: Record<string, TypeJeton> = {
  "+": "PLUS",
  "-": "MOINS",
  "*": "FOIS",
  "·": "FOIS",
  "×": "FOIS",
  "/": "DIVISE",
  "^": "PUISSANCE",
  "(": "PAR_OUVRANTE",
  ")": "PAR_FERMANTE",
  "|": "BARRE",
};

const estChiffreOuPoint = (c: string): boolean => (c >= "0" && c <= "9") || c === "." || c === ",";
const estLettre = (c: string): boolean => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");

function tokeniser(expression: string): Jeton[] {
  const jetons: Jeton[] = [];
  let i = 0;
  while (i < expression.length) {
    const c = expression.charAt(i);
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (estChiffreOuPoint(c)) {
      let j = i;
      while (j < expression.length && estChiffreOuPoint(expression.charAt(j))) j++;
      jetons.push({ type: "NOMBRE", valeur: Number(expression.slice(i, j).replace(",", ".")) });
      i = j;
      continue;
    }
    if (c === "²" || c === "³") {
      jetons.push({ type: "PUISSANCE" });
      jetons.push({ type: "NOMBRE", valeur: c === "²" ? 2 : 3 });
      i++;
      continue;
    }
    if (estLettre(c)) {
      let j = i;
      while (j < expression.length && (estLettre(expression.charAt(j)) || (expression.charAt(j) >= "0" && expression.charAt(j) <= "9"))) j++;
      const mot = expression.slice(i, j).toLowerCase();
      // `hasOwn` : l'ancien code testait `mot in NOMS_FONCTIONS`, ce qui lisait « constructor » (clé du prototype
      // d'objet) comme une fonction dont la valeur est `undefined` (RAPPORT.md §19, divergence délibérée n°3).
      const fonction = Object.hasOwn(NOMS_FONCTIONS, mot) ? NOMS_FONCTIONS[mot] : undefined;
      if (fonction === undefined) throw new ErreurSyntaxe("identifiant_inconnu", mot);
      jetons.push({ type: "FONCTION", fonction });
      i = j;
      continue;
    }
    const operateur = OPERATEURS[c];
    if (operateur !== undefined) {
      jetons.push({ type: operateur });
      i++;
      continue;
    }
    throw new ErreurSyntaxe("caractere_inattendu", c);
  }
  return jetons;
}

type Noeud =
  | { type: "nombre"; valeur: number }
  | { type: "negation"; operande: Noeud }
  | { type: "somme"; operateur: "+" | "-"; gauche: Noeud; droite: Noeud }
  | { type: "produit"; operateur: "*" | "/"; gauche: Noeud; droite: Noeud }
  | { type: "puissance"; base: Noeud; exposant: Noeud }
  | { type: "groupe"; interieur: Noeud }
  | { type: "appel"; fonction: NomFonction; argument: Noeud };

class Parseur {
  private position = 0;
  /** Barres `|…|` actuellement ouvertes : la barre FERMANTE d'un groupe ne doit pas démarrer un facteur implicite. */
  private profondeurBarre = 0;

  constructor(private readonly jetons: Jeton[]) {}

  analyser(): Noeud {
    const resultat = this.expression();
    if (this.position < this.jetons.length) throw new ErreurSyntaxe("expression_mal_formee");
    return resultat;
  }

  private regarder(): Jeton | undefined {
    return this.jetons[this.position];
  }

  private consommer(): Jeton {
    const jeton = this.jetons[this.position];
    if (!jeton) throw new ErreurSyntaxe("expression_incomplete");
    this.position++;
    return jeton;
  }

  private expression(): Noeud {
    let gauche = this.terme();
    while (this.regarder()?.type === "PLUS" || this.regarder()?.type === "MOINS") {
      const op = this.consommer().type;
      const droite = this.terme();
      gauche = { type: "somme", operateur: op === "PLUS" ? "+" : "-", gauche, droite };
    }
    return gauche;
  }

  private commenceUnFacteur(): boolean {
    const jeton = this.regarder();
    if (!jeton) return false;
    if (jeton.type === "BARRE") return this.profondeurBarre === 0;
    return jeton.type === "NOMBRE" || jeton.type === "PAR_OUVRANTE" || jeton.type === "FONCTION";
  }

  private terme(): Noeud {
    let gauche = this.unaire();
    for (;;) {
      const jeton = this.regarder();
      if (jeton?.type === "FOIS" || jeton?.type === "DIVISE") {
        const op = this.consommer().type;
        const droite = this.unaire();
        gauche = { type: "produit", operateur: op === "FOIS" ? "*" : "/", gauche, droite };
      } else if (this.commenceUnFacteur()) {
        const droite = this.unaire();
        gauche = { type: "produit", operateur: "*", gauche, droite };
      } else {
        break;
      }
    }
    return gauche;
  }

  private unaire(): Noeud {
    if (this.regarder()?.type === "MOINS") {
      this.consommer();
      return { type: "negation", operande: this.unaire() };
    }
    if (this.regarder()?.type === "PLUS") {
      this.consommer();
      return this.unaire();
    }
    return this.puissance();
  }

  private puissance(): Noeud {
    const base = this.primaire();
    if (this.regarder()?.type === "PUISSANCE") {
      this.consommer();
      return { type: "puissance", base, exposant: this.unaire() };
    }
    return base;
  }

  private primaire(): Noeud {
    const jeton = this.consommer();
    if (jeton.type === "NOMBRE") return { type: "nombre", valeur: jeton.valeur as number };
    if (jeton.type === "PAR_OUVRANTE") {
      const interieur = this.expression();
      if (this.regarder()?.type !== "PAR_FERMANTE") throw new ErreurSyntaxe("parenthese_fermante_manquante");
      this.consommer();
      return { type: "groupe", interieur };
    }
    if (jeton.type === "BARRE") {
      this.profondeurBarre++;
      const interieur = this.expression();
      this.profondeurBarre--;
      if (this.regarder()?.type !== "BARRE") throw new ErreurSyntaxe("barre_fermante_manquante");
      this.consommer();
      return { type: "appel", fonction: "abs", argument: interieur };
    }
    if (jeton.type === "FONCTION") {
      if (this.regarder()?.type !== "PAR_OUVRANTE") throw new ErreurSyntaxe("parenthese_ouvrante_attendue");
      this.consommer();
      const argument = this.expression();
      if (this.regarder()?.type !== "PAR_FERMANTE") throw new ErreurSyntaxe("parenthese_fermante_manquante");
      this.consommer();
      return { type: "appel", fonction: jeton.fonction as NomFonction, argument };
    }
    throw new ErreurSyntaxe("expression_mal_formee");
  }
}

/** Plus petite fraction p/q (q ≤ qmax) égale à x dans la tolérance (0,333… → 1/3, jamais 2/6). */
function meilleureFraction(x: number, qmax = 12, tolerance = 1e-9): { p: number; q: number } | null {
  for (let q = 1; q <= qmax; q++) {
    const p = Math.round(x * q);
    if (Math.abs(x - p / q) < tolerance) return { p, q };
  }
  return null;
}

/** `base^exposant` ; base négative à exposant non entier : dénominateur pair → NaN, impair → |base|^(p/q) signé (-1)^p. */
function puissanceSignee(base: number, exposant: number): number {
  if (Number.isInteger(exposant)) return Math.pow(base, exposant);
  if (base >= 0) return Math.pow(base, exposant);
  const fraction = meilleureFraction(exposant);
  if (!fraction) return NaN;
  if (fraction.q % 2 === 0) return NaN;
  return Math.pow(-1, fraction.p) * Math.pow(Math.abs(base), fraction.p / fraction.q);
}

const racineCubiqueSignee = (u: number): number => Math.sign(u) * Math.pow(Math.abs(u), 1 / 3);

function appliquerFonction(fonction: NomFonction, u: number): number {
  switch (fonction) {
    case "sqrt":
      return Math.sqrt(u); // NaN pour u < 0, jamais d'exception
    case "cbrt":
      return racineCubiqueSignee(u);
    case "abs":
      return Math.abs(u);
  }
}

function evaluer(noeud: Noeud): number {
  switch (noeud.type) {
    case "nombre":
      return noeud.valeur;
    case "negation":
      return -evaluer(noeud.operande);
    case "somme":
      return noeud.operateur === "+" ? evaluer(noeud.gauche) + evaluer(noeud.droite) : evaluer(noeud.gauche) - evaluer(noeud.droite);
    case "produit":
      return noeud.operateur === "*" ? evaluer(noeud.gauche) * evaluer(noeud.droite) : evaluer(noeud.gauche) / evaluer(noeud.droite);
    case "puissance":
      return puissanceSignee(evaluer(noeud.base), evaluer(noeud.exposant));
    case "groupe":
      return evaluer(noeud.interieur);
    case "appel":
      return appliquerFonction(noeud.fonction, evaluer(noeud.argument));
  }
}

/**
 * Valeur d'une réponse numérique. Lève `ErreurSyntaxe` si elle ne se lit pas ; renvoie NaN ou ±∞ (jamais
 * d'exception) pour une valeur hors domaine : c'est l'APPELANT qui décide (`verifierRacinesChamp2`).
 * Toute lettre `x`/`X` devient `*` AVANT la lecture (`x` n'est jamais une variable ici).
 */
export function evaluerReponseNumerique(texte: string): number {
  const normalise = texte.replace(/[xX]/g, "*");
  const jetons = tokeniser(normalise);
  if (jetons.length === 0) throw new ErreurSyntaxe("expression_vide");
  return evaluer(new Parseur(jetons).analyser());
}
