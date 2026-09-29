/**
 * Segmentation du balisage mathématique `$…$` d'un texte D'AUTEUR — module pur (aucun accès au DOM),
 * l'UNIQUE implémentation de la grammaire (client + tests ; la production serveur n'importe jamais
 * depuis `public/`). Convention complète : CLAUDE.md « Balisage mathématique ».
 *
 *  - Délimiteur unique : `$…$`, inline. Pas de mode display : `$$` est invalide.
 *  - Hors mathématiques, `\$` est un `$` littéral ; un autre `\` est littéral. Un `$` précédé d'un
 *    nombre PAIR d'antislashs n'est pas échappé (`\\$` : deux antislashs littéraux puis un délimiteur).
 *  - Le `$` fermant est le prochain `$` non échappé ; dans les mathématiques le contenu est transmis
 *    tel quel au rendu (un `\$` y reste du LaTeX).
 *  - Invalide (`$` non fermé, `$$`, contenu vide) : le texte ENTIER est rendu en texte brut, tel quel.
 *    Jamais d'exception.
 *
 * Ce module ne contient AUCUNE liste de commandes interdites : cette liste vit une seule fois, dans
 * lib/balisageMath.ts (côté serveur et tests).
 */

/** @typedef {{ type: "texte" | "math", valeur: string }} SegmentTexteMath */

/**
 * @param {string} texte
 * @returns {{ valide: boolean, segments: SegmentTexteMath[] }}
 */
export function decouperTexteMath(texte) {
  const chaine = String(texte ?? "");
  const invalide = () => ({ valide: false, segments: chaine === "" ? [] : [{ type: "texte", valeur: chaine }] });
  const segments = [];
  let tampon = "";
  let i = 0;
  const n = chaine.length;
  while (i < n) {
    const c = chaine[i];
    if (c === "\\") {
      let fin = i;
      while (fin < n && chaine[fin] === "\\") fin++;
      const nb = fin - i;
      if (chaine[fin] === "$" && nb % 2 === 1) {
        tampon += "\\".repeat(nb - 1) + "$";
        i = fin + 1;
      } else {
        tampon += "\\".repeat(nb);
        i = fin;
      }
      continue;
    }
    if (c === "$") {
      if (chaine[i + 1] === "$") return invalide();
      let j = i + 1;
      let fermeture = -1;
      while (j < n) {
        if (chaine[j] === "\\") {
          j += 2;
          continue;
        }
        if (chaine[j] === "$") {
          fermeture = j;
          break;
        }
        j++;
      }
      if (fermeture < 0) return invalide();
      const contenu = chaine.slice(i + 1, fermeture);
      if (contenu.trim() === "") return invalide();
      if (tampon !== "") segments.push({ type: "texte", valeur: tampon });
      tampon = "";
      segments.push({ type: "math", valeur: contenu });
      i = fermeture + 1;
      continue;
    }
    tampon += c;
    i++;
  }
  if (tampon !== "") segments.push({ type: "texte", valeur: tampon });
  return { valide: true, segments };
}

/**
 * Texte sans délimiteurs, pour un attribut (`placeholder`, `aria-label`, `title`) : le LaTeX reste
 * lisible, `\$` devient `$`. Texte invalide : renvoyé tel quel.
 *
 * @param {string} texte
 * @returns {string}
 */
export function versTexteBrut(texte) {
  return decouperTexteMath(texte).segments.map((s) => s.valeur).join("");
}
