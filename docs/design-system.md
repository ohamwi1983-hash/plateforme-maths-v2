# Design system — tokens

Source de vérité **technique** : le bloc `:root` de `public/style.css`. Ce document en est la
description ; `scripts/test-design-system.ts` vérifie qu'ils restent identiques (mêmes 32 noms, mêmes
valeurs, aucun token non documenté). **Aucune valeur n'a été inventée** : les 31 variables issues du « système visuel partagé v3 » (phase 1)
ont été regroupées par famille et nommées par rôle ; le 32e token, `--ombre-carte`, **nomme** l'ombre de carte
qui était répétée à l'identique dans cinq règles de `style.css` (sans en changer la valeur ; ces cinq règles
l'utilisent désormais).

## Règle d'usage

Les composants d'écran du moteur (`public/moteur/ecrans.css`) s'appuient **exclusivement** sur ces
tokens : jamais de couleur, de police, d'espacement ni de rayon en dur. Vérifié par le même test.
Exceptions documentées, seules valeurs littérales admises dans `ecrans.css` : `0`, `auto`, `1px` et `2px`
(épaisseur de filet/focus, absents des tokens), `100%`, `1`/`600` (`line-height`/`font-weight`), et les
unités relatives `em` pour les tailles de police. Une hauteur de zone tactile se compose à partir de
l'échelle : `calc(var(--espace-5) + var(--espace-1))` (44 px).

Alias locaux : `public/moteur/ecrans.css` définit des alias `--etat-bordure`, `--etat-fond`, `--etat-texte`,
`--etat-filet`, **uniquement** par `var(--token)` existant (vérifié par le test) — jamais une valeur.

## États d'un composant d'écran

| État | Quand | Carte | Sélection / cases |
|---|---|---|---|
| Défaut | avant toute action | fond `--surface`, filet `1px --border`, `--radius`, `--ombre-carte` | fond `--surface-sunken` (champ, case) ou `--surface` (option de QCM) |
| Sélectionné | avant validation, et pendant une nouvelle tentative | inchangée | bordure 2px `--violet-vif`, fond `--violet-clair`, texte `--violet`, gras — **jamais vert ni rouge** |
| `correct` | réponse du serveur | bordure `--vert`, fond `--vert-clair` | bordure `--vert`, fond `--surface`, texte `--text` |
| `not_equivalent` | réponse du serveur | bordure `--danger`, fond `--danger-clair` | bordure `--danger`, fond `--surface`, texte `--text` |
| `parse_error` | réponse du serveur | bordure `--ambre`, fond `--ambre-clair` | bordure `--ambre`, fond `--surface`, texte `--text` |

Les trois verdicts sont posés sur la **carte entière** (`:has(.moteur-statut-…)`, classes présentes seulement si le
serveur a répondu) et **remplacent** l'état sélectionné une fois le champ verrouillé. Le serveur ne rend qu'un verdict par
champ : le tableau de signes est coloré **en entier**, jamais case par case.

**Écarts assumés par rapport à la palette brute (contraste, WCAG AA = 4,5:1)** : `--vert` sur `--vert-clair` = 3,68:1 et
`--ambre` sur `--ambre-clair` = 2,40:1 ne suffisent pas pour du texte ; le texte des messages de verdict `correct` et
`parse_error` est donc en `--text`, la bordure et le fond gardant la couleur du statut (`--danger` sur blanc = 6,5:1 reste
utilisé pour le libellé de `not_equivalent`).

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

### Ombre
| Token | Valeur | Rôle |
|---|---|---|
| `--ombre-carte` | `0 10px 24px -18px rgba(59,20,112,.3)` | Ombre de toute carte (`.panneau`, `.item-liste`, `.item-eleve`, `.carte-formulaire`, cartes d'écran du moteur) |

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
