/**
 * Tous les textes d'AUTEUR d'un écran déclaré (ceux que le moteur passe à `rendreTexte(…, { math: true })`) : consigne, libellés de choix /
 * sous-champs / colonnes / lignes, étiquettes de liste, aide en chaîne. Pour les tests de balisage et de compilation KaTeX.
 * L'aide typée n'est pas un texte : `formule_coloree` est assemblée par le client (`assemblerFormuleColoree`), `croquis_parabole` est un dessin.
 */
import type { EcranDeclare } from "../../lib/contratGenerateur";

export function textesAuteurDe(e: EcranDeclare): string[] {
  const t = [e.consigne];
  if (e.nom) t.push(e.nom);
  if (typeof e.aide === "string") t.push(e.aide);
  if (e.type === "qcm") t.push(...e.choix.map((c) => c.libelle));
  if (e.type === "champs_multiples") {
    for (const s of e.champs) {
      t.push(s.libelle);
      if (s.genre === "choix") t.push(...s.choix.map((c) => c.libelle));
      else if (s.placeholder) t.push(s.placeholder);
    }
  }
  if (e.type === "intervalle" && e.apercu) t.push(e.apercu.libelle);
  if (e.type === "liste_valeurs") t.push(e.etiquetteAjout, ...(e.etiquetteAucune ? [e.etiquetteAucune] : []), ...(e.etiquetteAuMoinsUne ? [e.etiquetteAuMoinsUne] : []));
  if (e.type === "tableau_signes") {
    if (e.titre) t.push(e.titre);
    for (const c of e.colonnes) t.push(c.libelle, ...(c.valeur ? [c.valeur] : []), ...(c.symbole ? [c.symbole] : []));
    for (const l of e.lignes) t.push(l.libelle);
  }
  return t;
}
