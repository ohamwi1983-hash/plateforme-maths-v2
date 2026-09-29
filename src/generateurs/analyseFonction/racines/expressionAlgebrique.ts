import { ErreurSyntaxe } from "./erreurSyntaxe";

/**
 * Évaluateur d'expressions algébriques à UNE variable (x) du champ « Factorise l'équation » (`racinesChamp1`).
 * Réécrit localement (règle du dépôt : jamais importer un module de l'ancien pilote) à partir du
 * COMPORTEMENT de `pilote:src/moteur/expressionAlgebrique.ts` @ 6acc102, réduit à ce que gen7 utilise : ni
 * cubique, ni forme canonique/réduite, ni mise en évidence généralisée, ni variante irrationnelle. Le
 * tokeniseur/parseur que l'ancien pilote dupliquait dans `diagnosticMiseEnEvidence.ts` est ici UNIQUE.
 *
 * Grammaire : nombres (virgule ou point décimal — SEULE la première virgule est convertie), `x`/`X`,
 * `+ - * · × / ^`, exposants `²`/`³`, parenthèses, multiplication implicite (`2x(x-4)`, `(x-3)(x+3)`). Toute
 * autre lettre ou caractère est une erreur de lecture ; un `= 0` FINAL est toléré (`retirerEgaliteAZero`),
 * tout autre `=` est une erreur.
 */

type TypeJeton = "NOMBRE" | "X" | "PLUS" | "MOINS" | "FOIS" | "DIVISE" | "PUISSANCE" | "PAR_OUVRANTE" | "PAR_FERMANTE";

interface Jeton {
  type: TypeJeton;
  valeur?: number;
}

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
};

function estChiffreOuPoint(c: string | undefined): boolean {
  return c !== undefined && ((c >= "0" && c <= "9") || c === "." || c === ",");
}

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
      // `replace(",", ".")` ne remplace que la PREMIÈRE virgule : « 1,2,3 » devient « 1.2,3 » (NaN), comme avant.
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
    if (c === "x" || c === "X") {
      jetons.push({ type: "X" });
      i++;
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

/** Arbre syntaxique : assez riche pour évaluer une expression ET inspecter sa forme (détecteur C04). */
export type Noeud =
  | { type: "nombre"; valeur: number }
  | { type: "x" }
  | { type: "negation"; operande: Noeud }
  | { type: "somme"; operateur: "+" | "-"; gauche: Noeud; droite: Noeud }
  | { type: "produit"; operateur: "*" | "/"; gauche: Noeud; droite: Noeud }
  | { type: "puissance"; base: Noeud; exposant: Noeud }
  | { type: "groupe"; interieur: Noeud };

class Parseur {
  private position = 0;

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
    return !!jeton && (jeton.type === "NOMBRE" || jeton.type === "X" || jeton.type === "PAR_OUVRANTE");
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
    if (jeton.type === "X") return { type: "x" };
    if (jeton.type === "PAR_OUVRANTE") {
      const interieur = this.expression();
      if (this.regarder()?.type !== "PAR_FERMANTE") throw new ErreurSyntaxe("parenthese_fermante_manquante");
      this.consommer();
      return { type: "groupe", interieur };
    }
    throw new ErreurSyntaxe("expression_mal_formee");
  }
}

/** Tolère qu'un élève recopie l'équation complète (« … = 0 ») : SEUL un `= 0` final est retiré. */
export function retirerEgaliteAZero(expression: string): string {
  return expression.replace(/=\s*0\s*$/, "");
}

/** Lit une saisie. Lève `ErreurSyntaxe` (ou, exceptionnellement, une erreur d'exécution : imbrication démesurée). */
export function analyserExpression(saisie: string): Noeud {
  return new Parseur(tokeniser(retirerEgaliteAZero(saisie))).analyser();
}

export function evaluer(noeud: Noeud, x: number): number {
  switch (noeud.type) {
    case "nombre":
      return noeud.valeur;
    case "x":
      return x;
    case "negation":
      return -evaluer(noeud.operande, x);
    case "somme":
      return noeud.operateur === "+" ? evaluer(noeud.gauche, x) + evaluer(noeud.droite, x) : evaluer(noeud.gauche, x) - evaluer(noeud.droite, x);
    case "produit":
      return noeud.operateur === "*" ? evaluer(noeud.gauche, x) * evaluer(noeud.droite, x) : evaluer(noeud.gauche, x) / evaluer(noeud.droite, x);
    case "puissance":
      return Math.pow(evaluer(noeud.base, x), evaluer(noeud.exposant, x));
    case "groupe":
      return evaluer(noeud.interieur, x);
  }
}

/** Dépouille les parenthèses englobantes redondantes : « ((x-3)) » → le nœud « x-3 ». */
export function depouiller(noeud: Noeud): Noeud {
  return noeud.type === "groupe" ? depouiller(noeud.interieur) : noeud;
}

/** Éclate un produit (par `*`, `/` ou juxtaposition, à toute profondeur) en la liste de ses facteurs. */
export function collecterFacteurs(noeud: Noeud): Noeud[] {
  const racine = depouiller(noeud);
  if (racine.type === "produit") return [...collecterFacteurs(racine.gauche), ...collecterFacteurs(racine.droite)];
  return [racine];
}

export function estXExplicite(noeud: Noeud): boolean {
  return depouiller(noeud).type === "x";
}

/** Vrai si l'expression est, au premier niveau, un PRODUIT (pas une somme) dont `x` est l'un des facteurs. */
export function estUnProduitAvecXExplicite(noeud: Noeud): boolean {
  const racine = depouiller(noeud);
  if (racine.type === "somme") return false;
  return collecterFacteurs(racine).some(estXExplicite);
}

type ClassificationFacteur =
  | { genre: "constante" }
  | { genre: "lineaire"; racine: number }
  | { genre: "puissance"; racine: number; exposant: number }
  | { genre: "inconnu" };

/**
 * Constante, expression linéaire kx+m (racine = −m/k) ou puissance entière d'un facteur linéaire. Le degré
 * se lit en ÉCHANTILLONNANT le facteur en x = 0, 1, 2 (pente constante = linéaire), jamais sur la forme
 * syntaxique : « 3-x », « -2x-3 » sont reconnus. Une négation en tête est dépouillée comme une parenthèse.
 */
function classifierFacteur(noeud: Noeud): ClassificationFacteur {
  const racine = depouiller(noeud);

  if (racine.type === "negation") return classifierFacteur(racine.operande);

  if (racine.type === "puissance") {
    const exposant = evaluer(racine.exposant, 0);
    const base = classifierFacteur(racine.base);
    if (base.genre === "lineaire" && Number.isInteger(exposant) && exposant >= 1) return { genre: "puissance", racine: base.racine, exposant };
    return { genre: "inconnu" };
  }

  const f0 = evaluer(racine, 0);
  const f1 = evaluer(racine, 1);
  const f2 = evaluer(racine, 2);
  const pente1 = f1 - f0;
  const pente2 = f2 - f1;

  if (Math.abs(pente1) < 1e-9 && Math.abs(pente2) < 1e-9) return { genre: "constante" };
  if (Math.abs(pente2 - pente1) < 1e-9) return { genre: "lineaire", racine: -f0 / pente1 };
  return { genre: "inconnu" };
}

/**
 * Racines du produit, une par facteur linéaire (n copies pour une puissance n) ; les constantes n'en
 * apportent aucune. `null` si un facteur n'est ni constant, ni linéaire, ni puissance d'un linéaire (ex.
 * « 4x^2-9 », qui n'est pas factorisé).
 */
export function extraireRacinesDuProduit(noeud: Noeud): number[] | null {
  const racines: number[] = [];
  for (const facteur of collecterFacteurs(noeud)) {
    const classification = classifierFacteur(facteur);
    if (classification.genre === "constante") continue;
    if (classification.genre === "lineaire") {
      racines.push(classification.racine);
      continue;
    }
    if (classification.genre === "puissance") {
      for (let i = 0; i < classification.exposant; i++) racines.push(classification.racine);
      continue;
    }
    return null;
  }
  return racines;
}

export interface Trinome {
  a: number;
  b: number;
  c: number;
}

/**
 * (a, b, c) du polynôme de degré 2 que représente le nœud, par échantillonnage en 5 points (3 résolvent,
 * 2 valident) ; `null` si ce n'est pas un polynôme de degré ≤ 2 (ou si une valeur n'est pas un nombre).
 */
export function extraireTrinome(noeud: Noeud, tolerance: number): Trinome | null {
  const [fm2, fm1, f0, f1, f2] = [-2, -1, 0, 1, 2].map((x) => evaluer(noeud, x)) as [number, number, number, number, number];

  const c = f0;
  const a = (f1 + fm1) / 2 - f0;
  const b = (f1 - fm1) / 2;

  const estBienUnPolynomeDeDegre2 = Math.abs(4 * a + 2 * b + c - f2) < tolerance && Math.abs(4 * a - 2 * b + c - fm2) < tolerance;
  return estBienUnPolynomeDeDegre2 ? { a, b, c } : null;
}

export function trinomesCorrespondent(saisi: Trinome, attendu: Trinome, tolerance: number): boolean {
  return Math.abs(saisi.a - attendu.a) < tolerance && Math.abs(saisi.b - attendu.b) < tolerance && Math.abs(saisi.c - attendu.c) < tolerance;
}
