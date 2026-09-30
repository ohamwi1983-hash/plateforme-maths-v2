# Design system — tokens

Source de vérité **technique** : le bloc `:root` de `public/style.css`. Ce document en est la
description ; `scripts/test-design-system.ts` vérifie qu'ils restent identiques (mêmes 36 noms, mêmes
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

### Surbrillance des coefficients (phase 3b-1)
| Token | Valeur | Rôle |
|---|---|---|
| `--coef-a` | `#BF2280` | Coefficient a dans l'aide `formule_coloree` (magenta) |
| `--coef-b` | `#1137D0` | Coefficient b (bleu) |
| `--coef-c` | `#795B15` | Coefficient c (brun ocre) |

**Réservés à la surbrillance d'un coefficient** : jamais un verdict, jamais un état (le rouge, le vert et
l'ambre ont déjà un sens). Les teintes de l'ancien pilote (`#d6336c`, `#1971c2`, `#2f9e44`) n'étaient pas mesurées
et ne conviennent pas : `#2f9e44` n'atteint que 3,45:1 sur fond blanc.

Contrastes mesurés (WCAG, ratio calculé ; seuil du test : **4,5:1** pour du texte) — `scripts/test-design-system.ts`
recalcule ces ratios et échoue sous le seuil :

| Token | `--surface` | `--surface-sunken` | `--ambre-clair` | `--violet-clair` | `--vert-clair` | `--danger-clair` |
|---|---|---|---|---|---|---|
| `--coef-a` | 5,59 | 5,09 | 5,02 | 4,80 | 4,98 | 4,80 |
| `--coef-b` | 8,46 | 7,71 | 7,60 | 7,27 | 7,53 | 7,27 |
| `--coef-c` | 6,32 | 5,76 | 5,68 | 5,43 | 5,63 | 5,43 |

Distinction entre les trois teintes (ΔE CIE76 après simulation de Machado 2009, sévérité 1) : vision normale
70 / 82 / 130 (a–b / a–c / b–c) ; protanopie 50 / 72 / 119 ; deutéranopie 79 / **48** / 124 ; tritanopie 92 / 49 /
**48**. Le minimum est 48 (les teintes du pilote tombaient à 20 sous déficience). Une distinction purement
chromatique n'est pas garantie pour autant : l'**ordre** des termes (a, b, c de gauche à droite) reste l'indice non
chromatique, et le nom de chaque coefficient figure dans l'`aria-label` de l'aide.

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
| `--ombre-bouton` | `0 8px 16px -6px rgba(124,58,237,.45)` | Ombre du bouton principal « Valider » du moteur (`.moteur-bouton-principal`), valeur de la référence validée (RAPPORT §32) |

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

## Enveloppe de l'exercice (RAPPORT §43, assemblage révisé §44)

Référence : `docs/reference/enveloppe-exercice.html` (exprimée **uniquement** avec les tokens ci-dessus : aucune valeur nouvelle, aucun
token ajouté). `npm run chromium-design` la rend et la compare à l'application à 390 et 1280 px. Ordre à toutes les largeurs :
**[lien + titres] → [panneau gris : progression + « Ce qu'on sait déjà »] → [carte blanche de l'écran]**. Le panneau gris est AU-DESSUS de la
carte, jamais dedans : sa bordure basse EST la bordure haute de la carte (la carte n'a pas de bord haut).

| Largeur | Assemblage |
|---|---|
| Bureau (> 600 px) | panneau gris et carte blanche de même largeur (la colonne), un seul bloc aux angles arrondis (gris en haut, blanc en bas) ; lien et titres sur le fond de la page |
| Mobile (≤ 600 px) | **bord à bord** : le bandeau gris (lien + titres) touche la bannière violette et a la couleur du panneau gris ; panneau gris (filets haut et bas) et carte blanche font la largeur de l'écran, sans arrondi ni bord latéral ; padding de la carte : 16 px |

| Élément | Règle |
|---|---|
| Lien « Mes tâches » | puce ronde de 30 px `--violet-clair` + libellé 14 px gras `--violet-vif` ; zone tactile ≥ 44 px par pseudo-élément |
| Surtitre | 11 px gras, `0.06em`, `--text-muted` : « EXERCICE i SUR m · nom de la tâche » (majuscules ÉCRITES dans le texte, jamais `text-transform`, RAPPORT §30 ; le nom de la tâche reste tel que saisi) |
| Titre | `--font-marque` 20 px gras, `-0.01em` : « Question k sur N » |
| Panneau gris | `--surface-sunken`, filet `--border`, padding 14 × 24 px (16 px sur mobile) |
| Piste de progression | 12 px de haut, fond `--violet-clair`, pilule ; un segment par écran |
| Ligne du rappel | marque ronde de 20 px + nom (13 px gras) + réponse d'ÉLÈVE (`--font-marque` 14 px) ; l'écran courant : cercle numéroté `--violet-vif` |

**Marques et segments** (couleur = le verdict que le **serveur** a décidé de montrer, `info.statut`) : `correct` → `--vert-vif` (✓), `not_equivalent`
→ `--danger` (✕), `parse_error` → `--ambre` (!), **sans verdict** (correction coupée, `statut = null`) → marque `--violet-clair` (•) et segment
`--violet-2` : **jamais une coche ni une couleur de verdict**, un élève juste et un élève faux voient la même chose. La couleur de la CARTE de
l'écran courant (vert, rouge, jaune) est inchangée et ne touche que la carte : le panneau gris n'en est plus un descendant. Aucune ligne du rappel
n'utilise les classes `moteur-statut-*` : les sélecteurs `:has(.moteur-statut-…)` de la carte les liraient.

**Gouttières** : le mobile annule celles de la page par `--gouttiere-page` (16 px bureau, 14 px mobile) et `--marge-haute-page` (24 / 16 px), définies dans
`.contenu-page` (`style.css`) — des valeurs de mise en page, pas des tokens. `--retrait-plein-bord` du tableau de signes : 24 px de carte + 1 px de bordure +
gouttière sur bureau ; 16 px (le padding de la carte, déjà bord à bord) sur mobile.

**Carte des composants** : `composants-ecran.html` reste la référence de ce que la carte CONTIENT (consigne, champs, boutons, espacements). Sa propre enveloppe
(bord haut, rayons, padding latéral, largeur) n'est plus celle de cette référence mais celle de `enveloppe-exercice.html` (RAPPORT §44) ; `chromium-design`
ne compare plus sur la carte que le fond, l'ombre, le bord bas et le padding bas.

Graisse 700 : utilisée par le lien, les étiquettes et les marques de l'enveloppe (la règle d'usage ci-dessus ne listait que 600).

## Tableau de signes plein-bord (phase 3b, RAPPORT §30-§31)

Rendu de **référence stricte** : `docs/reference/tableau-signes.html` (code fourni par le propriétaire du projet, à ouvrir dans un navigateur pour comparer avec la capture Chromium `captures-chromium/*-etendu-10b-carte-tableau-7-colonnes.png`). Ne pas réinterpréter.

- **Cellules, pas des boutons décoratifs** : aucune bordure arrondie, aucun fond, aucune ombre autour d'une valeur ; filets fins `border-top` / `border-right` `1px solid var(--border)` (le dernier de la ligne sans filet droit). Toute la cellule est la zone tactile : **48px** de haut sur les signes, **56px** sur les variations, largeur = celle de la colonne (jamais moins de 44px).
- **Bande de symboles** entièrement `--surface-sunken` ; **titres de ligne** en bandeau `--surface-sunken` (texte `--text-muted`, gras, `letter-spacing: 0.03em`, **jamais `text-transform`** : `f(x)` resterait `f(x)`) ; aucun titre « TABLEAU DE SIGNES ».
- **Colonnes de valeur** : fond `--violet-clair` continu sur les lignes de x, de signes et de variations ; valeurs de x en gras `--violet`. Les colonnes d'intervalle de la ligne des x restent vides.
- **Variations** : 3 grandes cases (`colspan` 3 | 1 | 3 pour 7 colonnes). Le sommet est un glyphe `⌢`/`⌣`. La flèche d'intervalle n'est **jamais** un caractère `↗`/`↘` : on mesure la case (`getBoundingClientRect`), on calcule l'angle réel `atan2(0,42·h ; 0,68·l)`, on trace un trait droit de la bonne longueur, on colle une pointe SVG fixe (`viewBox 0 0 10 10`, jamais étirée) et on pivote le bloc d'un seul coup (`transform: rotate`). Elle est redessinée si la case change de taille (`ResizeObserver`). Couleur = `currentColor` (`--text`, ou la couleur du verdict).
- **Plein-bord** : le tableau sort de la carte et de la gouttière de page jusqu'aux bords de la colonne de contenu. `--retrait-plein-bord` n'est **pas** un token de `:root` : c'est une propriété de mise en page définie sur `.contenu-page` (`style.css`), somme de quatre termes (padding de la carte `--espace-4`, bordure 1px, padding de `.moteur-exercice` `--espace-3`, gouttière de page). `ecrans.css` la lit avec repli `0px`.
- 9 colonnes × 44px dépassent 390px : cas hors périmètre tant qu'aucun générateur n'a plus de 7 colonnes.

## Formules mathématiques (phase 3b-3, RAPPORT §33)

Les textes d'auteur sont rendus par KaTeX 0.18.9 (`public/vendor/katex-0.18.9/`, polices woff2 seules, licence MIT conservée). Ni couleur ni taille ne viennent d'un texte : la couleur d'un coefficient est la classe `moteur-coef-a|b|c` (tokens `--coef-*`). Écart assumé avec la référence des champs multiples : le libellé « a = » y est un texte de 24 px ; rendu par KaTeX il mesure 28 à 31 px selon la lettre, ce qui désalignait les champs — `.moteur-sous-champ-libelle` a donc `min-width: calc(var(--espace-4) * 1.5)` (36 px), mesuré par `chromium-design`.
