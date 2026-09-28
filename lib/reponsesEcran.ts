/**
 * Décodeurs de `reponseBrute` partagés par les générateurs (format par type d'écran documenté dans
 * lib/contratGenerateur.ts). Un décodage impossible ne lève jamais d'exception : il renvoie un
 * message pédagogique, que le générateur transforme en `parse_error`.
 */

export type Decodage<T> = { ok: true; valeur: T } | { ok: false; message: string };

export function decoderListeValeurs(reponseBrute: string): Decodage<string[]> {
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return { ok: false, message: "La liste de valeurs n'a pas pu être lue." };
  }
  if (!Array.isArray(brut) || !brut.every((v) => typeof v === "string")) {
    return { ok: false, message: "La liste de valeurs n'a pas pu être lue." };
  }
  const valeurs = brut.map((v) => v.trim()).filter((v) => v !== "");
  if (valeurs.length === 0) return { ok: false, message: "Ajoute au moins une valeur avant de valider." };
  return { ok: true, valeur: valeurs };
}

export type CasesTableauSignes = Record<string, Record<string, string>>;

export function decoderTableauSignes(reponseBrute: string): Decodage<CasesTableauSignes> {
  let brut: unknown;
  try {
    brut = JSON.parse(reponseBrute);
  } catch {
    return { ok: false, message: "Le tableau de signes n'a pas pu être lu." };
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return { ok: false, message: "Le tableau de signes n'a pas pu être lu." };
  const cases: CasesTableauSignes = {};
  for (const [ligne, colonnes] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof colonnes !== "object" || colonnes === null || Array.isArray(colonnes)) return { ok: false, message: "Le tableau de signes n'a pas pu être lu." };
    cases[ligne] = {};
    for (const [colonne, signe] of Object.entries(colonnes as Record<string, unknown>)) {
      if (typeof signe !== "string") return { ok: false, message: "Le tableau de signes n'a pas pu être lu." };
      cases[ligne][colonne] = signe;
    }
  }
  return { ok: true, valeur: cases };
}
