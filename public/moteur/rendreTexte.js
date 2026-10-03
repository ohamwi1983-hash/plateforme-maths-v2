/**
 * Point UNIQUE d'écriture d'un texte dans le DOM (consigne, libellé, aide, résultat, message) : aucun
 * composant d'écran n'écrit directement dans le DOM un texte qu'un générateur fournit. Jamais
 * interprété comme HTML (`textContent`, nœuds texte : aucune injection possible depuis un générateur
 * ni depuis un élève).
 *
 * Trois sortes de texte (CLAUDE.md « Balisage mathématique ») :
 *  - texte d'AUTEUR (généré par un générateur ou par le moteur pour l'élève) : `{ math: true }`, le
 *    balisage `$…$` est segmenté (`texteMath.js`) et chaque segment mathématique passe par `rendreMath` ;
 *  - texte d'ÉLÈVE (ce qu'il a tapé) et texte d'INTERFACE : sans option, texte brut — un `$` tapé par un
 *    élève reste un `$` ;
 *  - attribut (`placeholder`, `aria-label`) : `versTexteBrut` (texteMath.js).
 */
import { decouperTexteMath } from "./texteMath.js";

/**
 * Rendu d'UN segment mathématique par KaTeX (`public/vendor/katex-0.18.9/`, chargé par `eleve.html` : `globalThis.katex`).
 *
 * Sûreté :
 *  - `throwOnError: true` puis repli : un LaTeX que KaTeX refuse s'affiche en SOURCE (texte brut), jamais en message d'erreur de KaTeX
 *    (qui serait rouge : une couleur n'est jamais dans un texte servi). Idem si KaTeX n'est pas chargé.
 *  - `trust` : par défaut AUCUNE commande de confiance (`\htmlClass`, `\href`… ne s'exécutent pas ; KaTeX les rend alors en texte
 *    rouge SANS lever d'erreur, d'où le drapeau `refuse` qui déclenche le même repli). Seule exception, demandée par l'appelant avec
 *    `roles: true` (l'aide `formule_coloree`, dont la chaîne est ASSEMBLÉE par le client, jamais écrite par un auteur) :
 *    `\htmlClass` avec exactement une classe `moteur-coef-a|b|c`.
 *  - `strict` : l'extension HTML est un avertissement de principe sans objet ici (ignoré) ; les autres écarts au LaTeX restent des
 *    avertissements de la console.
 *
 * @param {Element} element
 * @param {string} latex
 * @param {{ roles?: boolean }} [options]
 */
export function rendreMath(element, latex, options = {}) {
  element.classList.add("moteur-math");
  const katex = globalThis.katex;
  if (!katex || typeof katex.render !== "function") {
    element.textContent = latex;
    element.classList.add("moteur-math-source");
    return;
  }
  const { reglages, refuse } = reglagesKatex(options.roles === true);
  try {
    katex.render(latex, element, reglages);
    if (refuse()) throw new Error("commande non autorisée");
  } catch {
    element.replaceChildren();
    element.textContent = latex;
    element.classList.add("moteur-math-source");
  }
}

/**
 * Réglages KaTeX d'un rendu (exportés pour être testés sans DOM : `scripts/test-katex.ts`). `refuse()` dit si KaTeX a rencontré une
 * commande de confiance non autorisée pendant ce rendu.
 *
 * @param {boolean} roles vrai pour l'aide `formule_coloree` seulement
 */
export function reglagesKatex(roles) {
  let refus = false;
  return {
    refuse: () => refus,
    reglages: {
      throwOnError: true,
      displayMode: false,
      trust: (contexte) => {
        if (roles === true && contexte.command === "\\htmlClass" && /^(moteur-coef-[abc]|moteur-emphase)$/.test(String(contexte.class))) return true;
        refus = true;
        return false;
      },
      strict: (code) => (code === "htmlExtension" ? "ignore" : "warn"),
    },
  };
}

/**
 * @param {Element} element
 * @param {string} texte
 * @param {{ math?: boolean }} [options] `math: true` pour un texte d'auteur ; sans option : texte brut.
 */
export function rendreTexte(element, texte, options = {}) {
  if (!options.math) {
    element.textContent = texte;
    return;
  }
  const { segments } = decouperTexteMath(texte);
  element.replaceChildren();
  // Une formule KaTeX est un bloc en ligne : le navigateur pourrait renvoyer à la ligne la ponctuation qui la suit (« $a$ », « , b »).
  // Le premier signe de ponctuation du texte suivant est donc collé à la formule dans un conteneur insécable.
  const PONCTUATION = /^[,.;:!?)]/;
  let retenu = "";
  segments.forEach((segment, i) => {
    if (segment.type === "texte") {
      const valeur = segment.valeur.slice(retenu.length);
      retenu = "";
      if (valeur !== "") element.append(document.createTextNode(valeur));
      return;
    }
    const span = document.createElement("span");
    rendreMath(span, segment.valeur);
    const suivant = segments[i + 1];
    const signe = suivant && suivant.type === "texte" ? PONCTUATION.exec(suivant.valeur) : null;
    if (signe) {
      const groupe = document.createElement("span");
      groupe.className = "moteur-insecable";
      groupe.append(span, document.createTextNode(signe[0]));
      element.append(groupe);
      retenu = signe[0];
    } else {
      element.append(span);
    }
  });
}
