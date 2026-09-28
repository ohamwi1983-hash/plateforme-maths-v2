import { normaliserTexte } from "./normaliserTexte";

export interface IdentiteEleve {
  nom: string;
  prenom: string;
}

/**
 * Élèves d'une classe qui partagent le même nom+prénom que `candidat` (comparaison insensible
 * casse/accents, prompt "Authentification élève", Étape 3, point 2). Générique sur `T` : sert à la
 * fois à compter les homonymes pour calculer un suffixe d'affichage (inscription/création par le
 * prof) et à lister les COMPTES CANDIDATS à essayer à la connexion (voir api/connexion-eleve.ts —
 * en présence d'homonymes, nom+prénom seuls ne désignent pas un compte unique ; c'est le mot de
 * passe, essayé successivement sur chaque candidat, qui tranche — point non traité explicitement
 * par le prompt, résolu ici et documenté dans le rapport de fin).
 */
export function filtrerHomonymes<T extends IdentiteEleve>(existants: T[], candidat: IdentiteEleve): T[] {
  const nomCandidat = normaliserTexte(candidat.nom);
  const prenomCandidat = normaliserTexte(candidat.prenom);
  return existants.filter((e) => normaliserTexte(e.nom) === nomCandidat && normaliserTexte(e.prenom) === prenomCandidat);
}

/**
 * Convention d'affichage retenue (prompt, Étape 3, point 2 : "un champ séparé ou une convention
 * d'affichage au choix, à documenter") : "Prénom Nom" pour le premier occurrent (suffixe 1 ou
 * absent), "Prénom Nom (N)" à partir du second — jamais recalculé rétroactivement pour les
 * homonymes déjà inscrits quand un nouveau survient.
 */
export function formaterAffichage(nom: string, prenom: string, suffixe: number | null | undefined): string {
  const base = `${prenom} ${nom}`;
  return suffixe && suffixe > 1 ? `${base} (${suffixe})` : base;
}
