/**
 * Surlignage rouge des PARTIES FAUSSES d'une réponse (RAPPORT §52) — SEULE implémentation, partagée par les six composants d'écran.
 *
 * Le serveur n'envoie des identifiants de parties (`parties_fausses`) que sous correction immédiate ; ce module ne juge RIEN : il montre ce qu'on lui désigne. Un composant lui fournit
 * `resoudre(id)` → `{ elements, controles?, declencheurs? }` (ou `null` pour un identifiant inconnu : ignoré, jamais une exception) :
 *  - `elements` : ce qui reçoit la classe `moteur-partie-fausse` ;
 *  - `controles` (défaut : `elements`) : ce qui reçoit l'information accessible — `aria-invalid` sur un champ ou un bouton radio, `aria-description` sur un bouton : la couleur ne suffit jamais ;
 *  - `declencheurs` : `[élément, événement]` dont l'un RETIRE la marque (l'élève a modifié cette partie : sa marque est périmée). Rien n'est jamais marqué pendant la frappe.
 */
export const CLASSE_FAUSSE = "moteur-partie-fausse";
const DESCRIPTION = "Réponse incorrecte";

export function creerMarquage(resoudre) {
  let actifs = [];
  function effacer() {
    for (const a of actifs) a.nettoyer();
    actifs = [];
  }
  return {
    effacer,
    marquer(ids) {
      effacer();
      if (!Array.isArray(ids)) return;
      for (const id of ids) {
        const cible = typeof id === "string" ? resoudre(id) : null;
        if (!cible) continue;
        const elements = (cible.elements ?? []).filter(Boolean);
        const controles = (cible.controles ?? elements).filter(Boolean);
        const declencheurs = cible.declencheurs ?? [];
        for (const e of elements) e.classList.add(CLASSE_FAUSSE);
        for (const c of controles) {
          if (c.tagName === "INPUT") c.setAttribute("aria-invalid", "true");
          else c.setAttribute("aria-description", DESCRIPTION);
        }
        const actif = {
          nettoyer() {
            for (const e of elements) e.classList.remove(CLASSE_FAUSSE);
            for (const c of controles) {
              c.removeAttribute("aria-invalid");
              c.removeAttribute("aria-description");
            }
            for (const [el, evt] of declencheurs) el.removeEventListener(evt, actif.retirer);
          },
          retirer() {
            actif.nettoyer();
            actifs = actifs.filter((a) => a !== actif);
          },
        };
        for (const [el, evt] of declencheurs) el.addEventListener(evt, actif.retirer);
        actifs.push(actif);
      }
    },
  };
}

/** Pièce de résumé à surligner : `fausse: true` est rendu en `.moteur-piece-fausse` (voir `moteur.js: rendrePieces`). */
export const fausse = (piece) => ({ ...piece, fausse: true });

/** `ids` est-il une liste non vide d'identifiants ? (sinon : aucun surlignage, le résumé garde sa forme d'origine.) */
export const aDesParties = (ids) => Array.isArray(ids) && ids.length > 0;
