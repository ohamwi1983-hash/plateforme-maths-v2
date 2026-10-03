import type { DescripteurConfigurationCases } from "../../../lib/contratGenerateur";

/**
 * Cases de configuration par ligne COMMUNES à gen8 et gen9 (RAPPORT §55, §59) : les transformations appliquées à `x²`. Libellés = texte d'auteur affiché au professeur. `EV` et `CV` s'excluent ;
 * une transformation décochée vaut sa valeur neutre et n'est jamais montrée à l'élève. gen9 y ajoute `obligatoires: ["TH"]` (sans translation horizontale, `b = 0` : rien à compléter).
 */
export const CASES_TRANSFORMATIONS: DescripteurConfigurationCases["cases"] = [
  { id: "TH", libelle: "Translation horizontale (TH)" },
  { id: "TV", libelle: "Translation verticale (TV)" },
  { id: "EV", libelle: "Étirement vertical (EV)" },
  { id: "CV", libelle: "Compression verticale (CV)" },
  { id: "SOX", libelle: "Symétrie d'axe Ox (SOX)" },
];

export const LIBELLE_BLOC_TRANSFORMATIONS = "Transformations appliquées à x²";

export const EXCLUSIFS_TRANSFORMATIONS: string[][] = [["EV", "CV"]];
