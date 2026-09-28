import { normaliserTexte } from "./normaliserTexte";

/**
 * Email synthétique globalement unique (prompt "Authentification élève", Étape 3, point 3 :
 * "pas seulement unique dans la classe"). Le suffixe aléatoire (base36, ~41 bits d'entropie) porte
 * à lui seul la garantie d'unicité globale ; `admin.auth.admin.createUser` échoue de toute façon
 * explicitement si une collision improbable survenait (email déjà pris), remontée comme une erreur
 * normale par l'appelant plutôt que retentée ici.
 */
export function genererEmailSynthetique(nom: string, prenom: string): string {
  const nettoyer = (s: string): string => {
    const propre = normaliserTexte(s).replace(/[^a-z0-9]/g, "");
    return propre === "" ? "eleve" : propre;
  };
  const suffixe = Math.random().toString(36).slice(2, 10);
  return `${nettoyer(prenom)}.${nettoyer(nom)}.${suffixe}@pilote.local`;
}
