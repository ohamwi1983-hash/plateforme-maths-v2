/**
 * Aide typée « formule_coloree » : une formule découpée en segments LaTeX ; un segment avec `role`
 * (a, b ou c) prend la couleur de surbrillance du coefficient (classe `moteur-coef-a|b|c`, tokens de
 * design) ; un segment avec `emphase` est mis en évidence de façon NEUTRE (classe `moteur-emphase`, fond + soulignement, aucun token `--coef-*` : RAPPORT §59). Le contenu est une DONNÉE
 * validée par le serveur (`validerAide`, lib/aideTypee.ts) : le client assemble, il ne compose rien.
 *
 * Aide À PALIERS (RAPPORT §59) : le serveur ne sert que le palier demandé, sous la forme `{ palier, palierTotal, legende?, segments }` ; la légende (texte d'auteur) est écrite au-dessus de
 * la formule du palier. Sans `palierTotal`, c'est l'aide historique : la formule seule.
 *
 * Les segments sont assemblés en UNE SEULE chaîne LaTeX (`assemblerFormuleColoree`, texteMath.js) rendue en
 * un seul appel : des fragments rendus séparément perdraient l'espacement des opérateurs. C'est le seul
 * appel de `rendreMath` qui active la confiance restreinte (`roles: true`), limitée aux classes de coefficient et à l'emphase.
 */
import { rendreMath, rendreTexte } from "../rendreTexte.js";
import { assemblerFormuleColoree } from "../texteMath.js";

function creerFormule(segments) {
  const element = document.createElement("div");
  element.className = "moteur-aide-visuelle moteur-formule";
  element.setAttribute("role", "group");
  // Alternative textuelle : la formule complète, sans couleur ni emphase (l'ordre des symboles la porte déjà).
  element.setAttribute("aria-label", "Formule : " + segments.map((s) => s.latex).join(""));
  const formule = document.createElement("span");
  rendreMath(formule, assemblerFormuleColoree(segments), { roles: true });
  element.appendChild(formule);
  return element;
}

export default {
  type: "formule_coloree",

  creer(aide) {
    if (!Number.isInteger(aide.palierTotal)) return creerFormule(aide.segments);
    const enveloppe = document.createElement("div");
    enveloppe.className = "moteur-formule-palier";
    if (typeof aide.legende === "string" && aide.legende !== "") {
      const legende = document.createElement("p");
      legende.className = "moteur-aide-legende";
      rendreTexte(legende, aide.legende, { math: true });
      enveloppe.appendChild(legende);
    }
    enveloppe.appendChild(creerFormule(aide.segments));
    return enveloppe;
  },
};
