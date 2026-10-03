import { DebordementExact, ZERO_R, oppR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { coefficient, constante, corpsDeSaisie, decalerP, degre, egalP, estConstant, foisScalaire, lirePolynome, plusP, puissanceP, X } from "./polynome";

/**
 * Lecteur de FORME CANONIQUE `a(x − p)² + q` (RAPPORT §59). gen8 accepte toute forme équivalente (coefficients développés) ; gen9 AFFICHE `ax² + bx + c` : recopier l'énoncé serait « correct ».
 * L'écran 1 de gen9 exige donc que la réponse SOIT écrite sous forme canonique. Ce module ne lit AUCUN nombre lui-même : il découpe la structure du texte (sommes de niveau 0, groupe
 * parenthésé élevé au carré) et confie chaque morceau numérique à `lirePolynome`, l'unique lecteur (CLAUDE.md). Il ne juge rien : il dit seulement `(a, p, q)` ou « pas canonique ».
 *
 * Forme admise : une SOMME de termes dont UN SEUL contient `x`, et celui-là est `coefficient × (x ± c)^2` (le coefficient avant OU après le carré, implicite ou avec `*`, `/` par une constante) ;
 * les autres termes sont des constantes (leur somme est `q`). Le binôme doit être unitaire (`x − p`) : `(2x − 6)^2` n'est pas canonique. `²` vaut `^2`.
 * Garde finale : le polynôme reconstruit `a(x − p)² + q` est comparé à celui que lit `lirePolynome` pour tout le texte ; au moindre écart, « pas canonique » (jamais un `(a, p, q)` faux).
 */
export type LectureFormeCanonique = { ok: true; a: Rat; p: Rat; q: Rat } | { ok: false; raison: "illisible" | "pas_canonique"; message: string };

export const MESSAGE_PAS_CANONIQUE = "Écris f(x) sous la forme canonique a(x − p)² + q : un seul terme en x, de la forme a(x − p)^2, puis la constante q (par exemple 2(x-3)^2+1).";

const pasCanonique: LectureFormeCanonique = { ok: false, raison: "pas_canonique", message: MESSAGE_PAS_CANONIQUE };

const contientX = (s: string): boolean => /[xX]/.test(s);

/** Découpe aux `+`/`-` de niveau 0 qui SÉPARENT deux termes (pas un signe unaire après `(`, `^`, `*`, `/` ou un autre signe). Chaque morceau garde son signe. */
function decouperSommes(corps: string): string[] {
  const morceaux: string[] = [];
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i < corps.length; i++) {
    const c = corps.charAt(i);
    if (c === "(") profondeur++;
    else if (c === ")") profondeur--;
    else if ((c === "+" || c === "-") && profondeur === 0 && i > 0 && !"+-*/^(".includes(corps.charAt(i - 1))) {
      morceaux.push(corps.slice(debut, i));
      debut = i;
    }
  }
  morceaux.push(corps.slice(debut));
  return morceaux;
}

/** Le groupe parenthésé de niveau 0 suivi de `^2` dans `terme` : `{ debut, fin, interieur }` (`fin` exclu, après le `^2`) ; `null` s'il n'y en a pas EXACTEMENT un. */
function trouverCarre(terme: string): { debut: number; fin: number; interieur: string } | null {
  const groupes: { debut: number; fin: number; interieur: string }[] = [];
  let profondeur = 0;
  let ouverture = -1;
  for (let i = 0; i < terme.length; i++) {
    const c = terme.charAt(i);
    if (c === "(") {
      if (profondeur === 0) ouverture = i;
      profondeur++;
    } else if (c === ")") {
      profondeur--;
      if (profondeur === 0 && ouverture >= 0) {
        const suite = terme.slice(i + 1);
        if (/^\^2(?![0-9])/.test(suite)) groupes.push({ debut: ouverture, fin: i + 3, interieur: terme.slice(ouverture + 1, i) });
        ouverture = -1;
      }
    }
  }
  return groupes.length === 1 ? (groupes[0] as { debut: number; fin: number; interieur: string }) : null;
}

export function lireFormeCanonique(texte: string): LectureFormeCanonique {
  const entiere = lirePolynome(texte);
  if (!entiere.ok) return { ok: false, raison: "illisible", message: entiere.message };
  const normalise = corpsDeSaisie(texte);
  if (!normalise.ok) return { ok: false, raison: "illisible", message: normalise.message };
  try {
    const corps = normalise.corps.replace(/²/g, "^2");
    const termes = decouperSommes(corps);
    const variables = termes.filter(contientX);
    if (variables.length !== 1) return pasCanonique;
    const terme = variables[0] as string;
    const carre = trouverCarre(terme);
    if (carre === null) return pasCanonique;
    const reste = `${terme.slice(0, carre.debut)}§${terme.slice(carre.fin)}`;
    if (contientX(reste)) return pasCanonique;
    // Le binôme `x − p` : unitaire, de degré 1.
    const binome = lirePolynome(carre.interieur);
    const unitaire = (r: Rat): boolean => r.n === 1 && r.d === 1;
    if (!binome.ok || degre(binome.polynome) !== 1 || !unitaire(coefficient(binome.polynome, 1))) return pasCanonique;
    const p = oppR(coefficient(binome.polynome, 0));
    // Le coefficient : le reste du terme, le carré remplacé par 1 (avec une multiplication explicite si le carré suit un chiffre ou une parenthèse).
    const avantCarre = reste.slice(0, reste.indexOf("§"));
    const liaison = avantCarre !== "" && /[0-9)]$/.test(avantCarre) ? "*" : "";
    const coefficientTexte = reste.replace("§", `${liaison}1`);
    const lueCoefficient = lirePolynome(coefficientTexte);
    if (!lueCoefficient.ok || !estConstant(lueCoefficient.polynome)) return pasCanonique;
    const a = coefficient(lueCoefficient.polynome, 0);
    // La constante : somme des autres termes.
    let q = constante(ZERO_R);
    for (const t of termes) {
      if (t === terme) continue;
      const lue = lirePolynome(t);
      if (!lue.ok || !estConstant(lue.polynome)) return pasCanonique;
      q = plusP(q, lue.polynome);
    }
    // Garde : a(x − p)² + q reconstruit = ce que lit lirePolynome pour tout le texte.
    const reconstruit = plusP(foisScalaire(decalerP(puissanceP(X, 2), p), a), q);
    if (!egalP(reconstruit, entiere.polynome)) return pasCanonique;
    return { ok: true, a, p, q: coefficient(q, 0) };
  } catch (e) {
    if (e instanceof DebordementExact) return pasCanonique; // saisie démesurée : jamais une erreur 500
    throw e;
  }
}
