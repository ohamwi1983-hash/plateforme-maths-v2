# gen9 « Complète le carré » — conception avant le « Go »

Lecture seule, état de `main` au commit `5bbd3f9`. Aucun code n'a été écrit avant la validation des huit décisions ci-dessous (validées par le propriétaire telles que recommandées). `variante_id` : `completion_du_carre`.

## 1. Les deux confirmations demandées par le prompt

**`formule_coloree` ne met pas en évidence `(b/2a)²` telle quelle.** Ses segments n'acceptent que les rôles `a`, `b`, `c` (`lib/aideTypee.ts`, `validerAide`), colorés par les tokens `--coef-a|b|c`, réservés aux coefficients ; elle n'a pas de paliers (seul `annotations_figure` en a : `nombrePaliers`, `aideAuPalier`, `lib/routes/reponses-aide.ts:93`, `public/moteur/moteur.js:640`). Extension retenue : des `paliers` sur `formule_coloree` ET une emphase neutre sur un segment (tokens existants, aucune 4ᵉ forme d'aide). Le palier 2 est SYMBOLIQUE : la valeur numérique de `(b/2a)²` donnerait `p²`.

**Le composant chaîne est générique côté client, pas côté serveur.** `chaineTransformations.js` et `decoderChaineTransformations` se réutilisent tels quels. `verifierChaine(ex: ExerciceFx)`, `cascade.ts`, l'écran 2 de `ecrans.ts` et la solution écrite sont couplés à gen8 : extraction d'un noyau partagé (déplacement sans changement de logique, suite gen8 inchangée comme filet).

## 2. Défauts du prompt relevés, et décisions

| # | Constat | Décision |
|---|---|---|
| 1 | gen8 accepte toute forme équivalente ; ici `ax²+bx+c` est affiché : recopier l'énoncé serait « correct » | Forme canonique exigée (`lireFormeCanonique`, posée sur `lirePolynome` qui lit tous les nombres) ; sinon `parse_error` (erratum, §59 : un `parse_error` COMPTE comme une tentative ratée, `lib/moteurTentatives.ts` — la mention « aucune tentative consommée » de la première rédaction était fausse) |
| 2 | Le prompt exclut `a = −1` (génération) puis dit de ne pas l'exclure (collision) | Non exclu. À `a = −1`, les deux codes sur `p` coïncident (de même sur `q`) : aucun code émis, étape fausse |
| 3 | `P_SIGNE_INVERSE` a la même condition que `SIGNE_P_INVERSE` de gen8 (`p' = −p`, `q' = q`) | `SIGNE_P_INVERSE` réutilisé : trois nouveaux codes, pas quatre |
| 4 | Sans `TH`, `p = 0` donc `b = 0` : les quatre codes sont inobservables | `TH` obligatoire (case cochée et verrouillée) |
| 5 | Avec les pools de gen8, `b` et `c` sont entiers pour 58 % des couples (EV) et 30 % (CV) | Tirage dans la liste exhaustive des couples (`th`, facteur) donnant `b` et `c` entiers |
| 6 | Voir §1 | Paliers et emphase sur `formule_coloree`, palier 2 symbolique |
| 7 | Couplage de tirage avec gen8 | Noyau partagé (pools, repli) ; modifier un pool impose un nouveau `variante_id` aux DEUX variantes |
| 8 | « gen9 » est aussi l'ancien gen9 du pilote (entrée 4e n°9 « Forme canonique et transformations — second degré », non portée) | `generateur_id` « gen9 » conservé ; entrée de catalogue à la suite de la numérotation |

Précision (propriétaire) : à `a = 1`, `P_FACTEUR_A_OUBLIE` et `Q_FACTEUR_A_OUBLIE` donnent la BONNE valeur : il n'existe pas de réponse fausse de cette famille, donc non-émission naturelle ; ni `EV`, ni `CV`, ni `SOX` ne deviennent obligatoires.

## 3. Formules et collisions (vérifiées)

Avec `f(x) = ax² + bx + c = a(x − p)² + q` : `b = −2ap`, `c = ap² + q`.

| Code | Valeur erronée | Valeur en fonction de `(a, p, q)` | Inerte / ambigu quand |
|---|---|---|---|
| `P_FACTEUR_A_OUBLIE` | `p' = −b/2` | `a·p` | `a = 1` (valeur juste) ; `a = −1` (= `−p`) |
| `SIGNE_P_INVERSE` | `p' = b/(2a)` | `−p` | `a = −1` (= `a·p`) |
| `Q_FACTEUR_A_OUBLIE` | `q' = c − b²/(4a²)` | `q + (a − 1)p²` | `a = 1` (valeur juste) ; `a = −1` (= signe) |
| `Q_SIGNE_INVERSE` | `q' = c + b²/(4a)` | `q + 2a·p²` | `a = −1` (= facteur) |

Un code n'est émis que si `a' = a` et UNE seule des deux grandeurs (`p'`, `q'`) est fausse ; deux erreurs ou plus : aucun code (comme gen8). Une erreur sur `p` suivie d'un `q` calculé de façon cohérente ne reçoit donc aucun code : limite assumée.

## 4. Découpage (une PR, 8 commits)

0. Extraction du noyau chaîne (pur déplacement).
1. Paliers + emphase sur `formule_coloree` (référence de design d'abord).
2. Modèle, génération, descripteur à case obligatoire, tests de propriétés.
3. Écran 1 : lecteur de forme canonique, vérification, codes.
4. Aide à deux paliers.
5. Écran 2 branché sur le noyau.
6. Câblage : registre, catalogue, JSON et ses deux tables de `prof.html`.
7. Scénarios Chromium, RAPPORT §59, `CLAUDE.md`, livrable, export propre, PR.
