# Design system — tokens

Source de vérité **technique** : le bloc `:root` de `public/style.css`. Ce document en est la
description ; `scripts/test-design-system.ts` vérifie qu'ils restent identiques (mêmes 31 noms, mêmes
valeurs, aucun token non documenté). **Aucune valeur n'a été inventée en phase 2** : les 31 variables
issues du « système visuel partagé v3 » (phase 1) ont seulement été regroupées par famille et nommées
par rôle.

## Règle d'usage

Les composants d'écran du moteur (`public/moteur/ecrans.css`) s'appuient **exclusivement** sur ces
tokens : jamais de couleur, de police, d'espacement ni de rayon en dur. Vérifié par le même test.
Exceptions documentées, seules valeurs littérales admises dans `ecrans.css` : `0`, `auto`, `1px` et `2px`
(épaisseur de filet/focus, absents des tokens), `100%`, `1`/`600` (`line-height`/`font-weight`), et les
unités relatives `em` pour les tailles de police. Une hauteur de zone tactile se compose à partir de
l'échelle : `calc(var(--espace-5) + var(--espace-1))` (44 px).

## Tokens

### Marque — violet
| Token | Valeur | Rôle |
|---|---|---|
| `--violet` | `#3B1470` | Violet le plus sombre : en-têtes, texte de marque sur fond clair |
| `--violet-2` | `#5B21B6` | Violet intermédiaire (dégradés, survol) |
| `--violet-vif` | `#7C3AED` | Action principale, focus, sélection |
| `--violet-clair` | `#F1EBFC` | Fond de sélection, élément « révélé » |

### Statut — réussite / erreur
| Token | Valeur | Rôle |
|---|---|---|
| `--vert` | `#158F52` | Texte/icône « réussite » |
| `--vert-clair` | `#E4F6EC` | Fond « réussite » |
| `--vert-vif` | `#16A34A` | Vert d'accent (progression) |
| `--danger` | `#B3261E` | Texte/icône « erreur », action destructive |
| `--danger-clair` | `#FBEAE8` | Fond « erreur » |

### Accents — ambre, bleu, jaune
| Token | Valeur | Rôle |
|---|---|---|
| `--ambre` | `#E08A2E` | Avertissement, aide (indice), erreur de lecture (`parse_error`) |
| `--ambre-vif` | `#F5A623` | Ambre d'accent |
| `--ambre-clair` | `#FDF1E2` | Fond ambre |
| `--bleu` | `#2563EB` | Icônes du bloc « Réglages » |
| `--bleu-clair` | `#E7EEFC` | Fond bleu |
| `--jaune` | `#CA8A04` | Icônes de chrono |
| `--jaune-clair` | `#FEF9C3` | Fond jaune |

### Neutres
| Token | Valeur | Rôle |
|---|---|---|
| `--bg` | `#FAF9FC` | Fond de page |
| `--surface` | `#FFFFFF` | Fond de carte |
| `--surface-sunken` | `#F6F3FB` | Fond en creux (zones de saisie, cases) |
| `--text` | `#1C1730` | Texte principal |
| `--text-muted` | `#6E6785` | Texte secondaire |
| `--border` | `#E9E4F3` | Filets et contours |

### Rayons
| Token | Valeur | Rôle |
|---|---|---|
| `--radius` | `20px` | Cartes |
| `--radius-sm` | `13px` | Champs, boutons |

### Typographie
| Token | Valeur | Rôle |
|---|---|---|
| `--font-marque` | `"Fraunces", serif` | Titres et marque |
| `--font-corps` | `"Inter", sans-serif` | Corps de texte |

Il n'existe **pas** de token de taille de police ni d'épaisseur : c'est un manque connu du système v3,
volontairement non comblé (« aucune nouvelle valeur »). Les composants du moteur héritent la taille de
leur conteneur (`font-size: inherit` ou `em` relatifs).

### Espacement
| Token | Valeur | Usage |
|---|---|---|
| `--espace-1` | `4px` | Micro-écart (icône/texte) |
| `--espace-2` | `8px` | Écart interne serré |
| `--espace-3` | `16px` | Écart standard, gouttière mobile |
| `--espace-4` | `24px` | Séparation de blocs |
| `--espace-5` | `40px` | Grande séparation, base des zones tactiles |
