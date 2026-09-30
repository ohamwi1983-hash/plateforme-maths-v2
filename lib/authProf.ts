/**
 * Décision d'accès d'un professeur à partir de SA ligne `profs` (rôle admin-prof, RAPPORT §26). Fonction pure,
 * partagée par `profAuthentifie` (lib/supabaseAdmin.ts) et par le harnais de test (qui remplace ce module-là) :
 * une seule règle, jamais deux copies qui divergent.
 */
export interface ProfAuthentifie {
  id: string;
  nom: string;
  /** Lu en base à CHAQUE requête (jamais dans le jeton) : promotion/retrait effectifs immédiatement. */
  estAdmin: boolean;
}

export interface LigneProfAcces {
  id: string;
  nom?: string | null;
  actif?: boolean | null;
  est_admin?: boolean | null;
}

/** `null` = accès refusé (compte désactivé). Une colonne absente (`undefined`) n'est PAS un refus : seul `actif === false` désactive. */
export function profDepuisLigne(ligne: LigneProfAcces): ProfAuthentifie | null {
  if (ligne.actif === false) return null;
  return { id: ligne.id, nom: ligne.nom ?? "", estAdmin: ligne.est_admin === true };
}

/**
 * Décision d'accès d'un élève à partir de SA ligne `eleves` : un compte désactivé par son professeur
 * (`profs/desactiver-eleve`, `actif = false`) est refusé À CHAQUE requête. Sans cela, un jeton déjà émis restait
 * valable après la désactivation (la connexion refusait le compte, l'API non). Partagée par `eleveAuthentifie`
 * (lib/supabaseAdmin.ts) et par le harnais de test : une seule règle, jamais deux copies. Comme pour les
 * professeurs, seul `actif === false` désactive (une colonne absente n'est pas un refus).
 */
export interface EleveAuthentifie {
  id: string;
}

export function eleveDepuisLigne(ligne: { id: string; actif?: boolean | null }): EleveAuthentifie | null {
  return ligne.actif === false ? null : { id: ligne.id };
}
