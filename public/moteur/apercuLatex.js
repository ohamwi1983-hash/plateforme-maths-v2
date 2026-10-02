/**
 * Aperçu LaTeX d'une saisie d'élève (RAPPORT §58) : « f(x) = » suivi de ce que l'élève tape, mis en forme (fractions, exposants, parenthèses, ×). C'est un AFFICHAGE, jamais une lecture
 * de référence : la vérification reste celle du serveur (`lirePolynome`), l'aperçu ne juge rien, ne signale aucune erreur et ne dépend d'aucune règle de correction.
 *
 * Règles (CLAUDE.md « Balisage mathématique ») :
 *  - la saisie est du texte d'ÉLÈVE : elle n'est JAMAIS interprétée comme du LaTeX. Le LaTeX rendu est CONSTRUIT ici, à partir d'un jeu fermé de jetons (nombres, lettres, `+ - * / ^ = ( )`,
 *    exposants `² ³ ⁴`) ; tout autre caractère est affiché littéralement et ÉCHAPPÉ (`$`, `\`, `{`, `}`, `%`, `#`, `&`, `_`, `~`…). Un `$` tapé reste un `$` ; aucune commande ne peut donc
 *    être introduite par l'élève (couleur, lien, image : impossible par construction).
 *  - TOLÉRANT : on tape caractère par caractère, donc la saisie est presque toujours incomplète (`2(x-`, `x^`, `1/`). Jamais d'exception ; une parenthèse non fermée se ferme par
 *    `\right.` (délimiteur nul), une opérande manquante laisse un groupe vide ; le LaTeX produit compile avec KaTeX (`throwOnError: true`) pour TOUTE chaîne (testé par fuzz).
 *  - Les espaces sont sans effet à l'affichage ; deux nombres adjacents sont séparés (`2 3` ne devient jamais « 23 »).
 *  - Aucune dépendance (module pur, chargé tel quel par les tests : `scripts/support/apercuLatex.ts`).
 */

const LONGUEUR_MAX = 400; // au-delà, l'aperçu s'arrête (le serveur refuse de toute façon une expression de plus de 120 caractères)
const PROFONDEUR_MAX = 25; // imbrication de parenthèses : au-delà, la parenthèse est affichée comme un simple signe

const EXPOSANTS = { "²": "2", "³": "3", "⁴": "4" };

// Caractères ASCII affichés tels quels en mode mathématique (hors jeu d'opérateurs, qui a ses propres jetons).
const SIGNES_SIMPLES = new Set([",", ";", ":", "!", "?", ".", "<", ">", "|"]);
const ECHAPPES = { $: "\\$", "\\": "\\backslash ", "{": "\\{", "}": "\\}", "%": "\\%", "#": "\\#", "&": "\\&", _: "\\_", "~": "\\sim ", "[": "[", "]": "]", "\"": "\\text{\"}", "`": "\\text{`}", "@": "\\text{@}", "'": "\\text{'}" }; // l'apostrophe est le « prime » de KaTeX en mode mathématique (`x²'` = double exposant) : toujours en texte

/** Normalise la saisie : signes typographiques → ASCII, longueur bornée. Les espaces sont conservés ici : `lire` les saute, mais ils séparent deux nombres (`2 3` n'est jamais « 23 »). */
function normaliser(texte) {
  return String(texte ?? "")
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .slice(0, LONGUEUR_MAX);
}

/** Jetons : { t: "nombre"|"lettres"|"op"|"exp"|"autre", v } */
function lire(texte) {
  const jetons = [];
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c >= "0" && c <= "9") {
      let j = i;
      while (j < texte.length && texte[j] >= "0" && texte[j] <= "9") j++;
      if (j < texte.length && (texte[j] === "," || texte[j] === ".") && j + 1 < texte.length && texte[j + 1] >= "0" && texte[j + 1] <= "9") {
        const separateur = texte[j];
        j++;
        while (j < texte.length && texte[j] >= "0" && texte[j] <= "9") j++;
        jetons.push({ t: "nombre", v: texte.slice(i, j).replace(separateur, separateur === "," ? "{,}" : ".") });
      } else {
        jetons.push({ t: "nombre", v: texte.slice(i, j) });
      }
      i = j;
    } else if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(c)) {
      let j = i;
      while (j < texte.length && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(texte[j])) j++;
      jetons.push({ t: "lettres", v: texte.slice(i, j) });
      i = j;
    } else if ("+-*/^=()".includes(c)) {
      jetons.push({ t: "op", v: c });
      i++;
    } else if (Object.hasOwn(EXPOSANTS, c)) {
      jetons.push({ t: "exp", v: EXPOSANTS[c] });
      i++;
    } else {
      const point = String.fromCodePoint(texte.codePointAt(i)); // un caractère entier, jamais une moitié de paire de substitution
      jetons.push({ t: "autre", v: point });
      i += point.length;
    }
  }
  return jetons;
}

/** LaTeX d'une suite de lettres : `x` seul reste en italique ; un mot (`sqrt`, `abc`) passe en romain pour ne pas être lu comme un produit de variables. */
function lettres(v) {
  if (v.length === 1) return /[A-Za-z]/.test(v) ? v : `\\text{${v}}`;
  return /^[A-Za-z]+$/.test(v) ? `\\mathrm{${v}}` : `\\text{${v}}`;
}

/** Caractère « autre » : littéral et échappé. Jamais une commande. */
function autre(v) {
  if (Object.hasOwn(ECHAPPES, v)) return ECHAPPES[v];
  if (SIGNES_SIMPLES.has(v)) return v;
  if (/^[\u0020-\u007E\u00A0-\u00FF]$/.test(v)) return /^[\u0000-\u0020\u007F-\u00A0]$/.test(v) ? "" : `\\text{${v}}`; // ASCII restant ou Latin-1 : texte
  return "\\square "; // tout le reste (émoji, symbole hors jeu, caractère de contrôle) : un carré, jamais une exception ni un avertissement de KaTeX
}

/**
 * Convertit la saisie en LaTeX (sans libellé). Chaîne vide si la saisie est vide.
 * @param {string} saisie
 * @returns {string}
 */
export function versLatexApercu(saisie) {
  const jetons = lire(normaliser(saisie));
  let p = 0;
  let profondeur = 0;
  const courant = () => jetons[p];
  const estOp = (v) => courant() !== undefined && courant().t === "op" && courant().v === v;

  // atome : nombre | lettres | « ( somme ) » ; "" si rien à lire (le jeton n'est PAS consommé)
  function atome() {
    const j = courant();
    if (j === undefined) return "";
    if (j.t === "nombre") {
      p++;
      return j.v;
    }
    if (j.t === "lettres") {
      p++;
      return lettres(j.v);
    }
    if (j.t === "autre") {
      p++;
      return autre(j.v);
    }
    if (j.t === "op" && j.v === "(" && profondeur < PROFONDEUR_MAX) {
      p++;
      profondeur++;
      const interieur = somme();
      profondeur--;
      if (estOp(")")) {
        p++;
        return `\\left(${interieur}\\right)`;
      }
      return `\\left(${interieur}\\right.`; // parenthèse pas encore fermée : délimiteur nul à droite
    }
    if (j.t === "op" && j.v === "(") {
      p++;
      return "(";
    }
    return "";
  }

  // exposant : « ^ » suivi d'un atome signé, ou exposant « ² ³ ⁴ »
  function puissance() {
    let base = atome();
    let avecExposant = false;
    // KaTeX refuse `a^{b}^{c}` (double exposant) : un exposant de plus enveloppe la base déjà exposée dans un groupe.
    const exposer = (e) => {
      const b = base === "" ? "{}" : avecExposant ? `{${base}}` : base;
      avecExposant = true;
      return `${b}^{${e}}`;
    };
    for (;;) {
      if (courant() !== undefined && courant().t === "exp") {
        base = exposer(courant().v);
        p++;
        continue;
      }
      if (estOp("^")) {
        p++;
        let signe = "";
        while (estOp("-") || estOp("+")) {
          signe += courant().v;
          p++;
        }
        const e = atome();
        base = exposer(`${signe}${e}`);
        continue;
      }
      break;
    }
    return base;
  }

  // facteur : signes éventuels puis puissance
  function facteurSigne() {
    let signe = "";
    while (estOp("-") || estOp("+")) {
      signe += courant().v;
      p++;
    }
    return signe + puissance();
  }

  const debutFacteur = () => {
    const j = courant();
    if (j === undefined) return false;
    return j.t === "nombre" || j.t === "lettres" || j.t === "autre" || (j.t === "op" && j.v === "(") || j.t === "exp";
  };

  // terme : facteurs reliés par « * », « / » ou une multiplication implicite
  function terme() {
    const facteurs = [facteurSigne()];
    for (;;) {
      if (estOp("*")) {
        p++;
        facteurs.push("\\cdot ", facteurSigne());
      } else if (estOp("/")) {
        p++;
        // le dénominateur est le facteur qui suit ; le numérateur, le facteur qui précède (comme la lecture de gauche à droite de l'expression)
        const denominateur = facteurSigne();
        let numerateur = "";
        for (let k = facteurs.length - 1; k >= 0; k--) {
          if (facteurs[k] !== "\\cdot ") {
            numerateur = facteurs[k];
            facteurs.length = k;
            break;
          }
        }
        facteurs.push(`\\dfrac{${numerateur}}{${denominateur}}`);
      } else if (debutFacteur()) {
        const precedent = facteurs[facteurs.length - 1] ?? "";
        const suivant = facteurSigne();
        // deux nombres adjacents ne se lisent jamais « 23 »
        const colle = /[0-9]$/.test(precedent) && /^[0-9]/.test(suivant);
        facteurs.push(colle ? "\\," : "", suivant);
      } else {
        break;
      }
    }
    return facteurs.join("");
  }

  function somme() {
    let sortie = terme();
    while (estOp("+") || estOp("-") || estOp("=")) {
      sortie += courant().v;
      p++;
      sortie += terme();
    }
    return sortie;
  }

  let latex = "";
  while (p < jetons.length) {
    const avant = p;
    latex += somme();
    if (p === avant) {
      // jeton que rien ne sait lire (« ) » ou « ^ » isolés) : affiché tel quel, puis on continue
      const j = courant();
      latex += j.t === "op" ? (j.v === ")" ? ")" : j.v === "^" ? "\\wedge " : j.v) : "";
      p++;
    }
  }
  return latex;
}

/**
 * LaTeX complet de l'aperçu : le libellé d'AUTEUR (LaTeX sans `$`, ex. « f(x) = ») suivi de la saisie mise en forme.
 * @param {string} libelle
 * @param {string} saisie
 */
export function apercuComplet(libelle, saisie) {
  const valeur = versLatexApercu(saisie);
  return valeur === "" ? libelle : `${libelle}\\,${valeur}`;
}
