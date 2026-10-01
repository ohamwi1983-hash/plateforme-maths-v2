/**
 * Croquis SVG partagés du moteur (DOM API uniquement : `createElementNS` + `textContent`, jamais
 * `innerHTML` ni gabarit de chaîne). Deux croquis, un seul module :
 *
 *  - `construireCroquisParabole({ a, b, c, marqueS, surlignageImf, marquesOx })` : la parabole
 *    y = ax² + bx + c, servie par l'aide typée `croquis_parabole`. Les trois croquis de gen7 (axe et
 *    sommet, domaine et image, tableau de signes) en sont des PARAMÈTRES (les surcouches).
 *  - `construireCroquisAllure({ signeA, signeAB, positionSommet, c })` : l'axe Oy seul, qui suit EN DIRECT les choix
 *    locaux d'un écran `champs_multiples` (illustration, pas une aide). Purement qualitatif : il ne
 *    dépend que de deux signes et de `c`.
 *
 * Géométrie : un AFFICHAGE, jamais une vérification. Le croquis de parabole est une VRAIE parabole mise
 * à l'échelle (axes à échelles indépendantes, fenêtre calée sur 0, le sommet, les racines et `c`) : les
 * racines, le sommet et le point (0 ; c) sont donc sur la courbe PAR CONSTRUCTION (les marques sur Ox et
 * le tracé viennent de la même fonction) — le défaut historique de l'ancien pilote, où des marques
 * placées à part se désynchronisaient de la courbe. Deux points mathématiquement confondus (S et C quand
 * b = 0, une racine et le sommet quand Δ = 0) restent confondus : leurs étiquettes sont écartées.
 *
 * Aucune couleur ni épaisseur ici : uniquement des classes (`croquis-*`), stylées par `ecrans.css` avec
 * les tokens du design system. Les nombres de ce fichier sont des coordonnées géométriques.
 */

const NS = "http://www.w3.org/2000/svg";

function el(nom, attributs = {}, classe) {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attributs)) e.setAttribute(k, String(v));
  if (classe) e.setAttribute("class", classe);
  return e;
}

function texte(contenu, attributs, classe) {
  const t = el("text", attributs, classe);
  t.textContent = contenu;
  return t;
}

function pgcd(x, y) {
  let a = Math.abs(x);
  let b = Math.abs(y);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

/** Fraction irréductible « p/q » (ou entier) — arithmétique entière exacte ; sur des valeurs non entières (coefficients irrationnels, RAPPORT §49) : décimale arrondie. */
export function etiquetteFraction(numerateur, denominateur) {
  if (!Number.isInteger(numerateur) || !Number.isInteger(denominateur)) return etiquetteDecimale(numerateur / denominateur);
  let n = numerateur;
  let d = denominateur;
  if (d < 0) [n, d] = [-n, -d];
  const g = pgcd(n, d);
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}

function etiquetteDecimale(v) {
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

/**
 * Racines réelles de ax²+bx+c : exactes (fractions) quand Δ est un carré parfait, décimales sinon ; `null` si Δ < 0. Coefficients RÉELS admis (RAPPORT §49 : `b = −2√2`…) :
 * Δ est alors un flottant, `Δ = 0` et `Δ < 0` se décident à une tolérance relative de 1e-9 (aucun effet sur des coefficients entiers, dont Δ est un entier).
 */
export function racinesParabole(a, b, c) {
  const delta = b * b - 4 * a * c;
  const echelle = Math.max(1, b * b, Math.abs(4 * a * c));
  if (delta < -1e-9 * echelle) return null;
  const den = 2 * a;
  if (Math.abs(delta) <= 1e-9 * echelle) return [{ valeur: -b / den, etiquette: etiquetteFraction(-b, den) }];
  const s = Math.round(Math.sqrt(delta));
  const exact = [a, b, c].every(Number.isInteger) && s * s === delta;
  const brutes = [(-b - Math.sqrt(delta)) / den, (-b + Math.sqrt(delta)) / den].sort((x, y) => x - y);
  if (exact) {
    const [n1, n2] = [-b - s, -b + s].sort((x, y) => x / den - y / den);
    return [
      { valeur: brutes[0], etiquette: etiquetteFraction(n1, den) },
      { valeur: brutes[1], etiquette: etiquetteFraction(n2, den) },
    ];
  }
  return brutes.map((v) => ({ valeur: v, etiquette: etiquetteDecimale(v) }));
}

/** Description textuelle du croquis de parabole (attribut `aria-label`). */
export function descriptionCroquisParabole({ a, b, c }) {
  const nombre = (v) => (Number.isInteger(v) ? v : etiquetteDecimale(v));
  const terme = (coef, suite) => (coef === 0 ? "" : `${coef < 0 ? " − " : " + "}${Math.abs(coef) === 1 && suite !== "" ? "" : nombre(Math.abs(coef))}${suite}`);
  const corps = `${a === 1 ? "" : a === -1 ? "−" : nombre(a)}x²${terme(b, "x")}${terme(c, "")}`;
  return `Croquis de la parabole d'équation y = ${corps}, ouverte vers le ${a > 0 ? "haut" : "bas"}.`;
}

const LARGEUR = 280;
const HAUTEUR = 210;
const MARGE_X = 22;
const MARGE_HAUT = 16;
const MARGE_BAS = 34;

function flecheAxe(x, y, direction) {
  // Pointe de flèche (triangle) au bout d'un axe : direction "droite" ou "haut".
  const pts = direction === "droite" ? `${x - 7},${y - 4} ${x},${y} ${x - 7},${y + 4}` : `${x - 4},${y + 7} ${x},${y} ${x + 4},${y + 7}`;
  return el("polygon", { points: pts }, "croquis-fleche");
}

/**
 * Construit le croquis de parabole. `options` : `{ a, b, c, marqueS?, surlignageImf?, marquesOx? }`
 * (a, b, c entiers, a ≠ 0 : déjà validés côté serveur par `validerAide`).
 * @returns {SVGSVGElement}
 */
export function construireCroquisParabole(options) {
  const { a, b, c } = options;
  const xS = -b / (2 * a);
  const yS = a * xS * xS + b * xS + c;
  const f = (x) => a * x * x + b * x + c;
  const racines = racinesParabole(a, b, c);

  // Fenêtre mathématique : contient toujours 0, xS, les racines et c ; ouverte du côté où s'ouvre la parabole.
  const xs = [0, xS, ...(racines ? racines.map((r) => r.valeur) : [])];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const padX = Math.max(1, (xMax - xMin) * 0.45);
  const xLo = xMin - padX;
  const xHi = xMax + padX;
  const ys = [0, yS, c];
  const yMinCles = Math.min(...ys);
  const yMaxCles = Math.max(...ys);
  const amplitude = Math.max(yMaxCles - yMinCles, 1);
  const yLo = a > 0 ? yMinCles - amplitude * 0.3 : yMinCles - amplitude * 0.9;
  const yHi = a > 0 ? yMaxCles + amplitude * 0.9 : yMaxCles + amplitude * 0.3;

  const px = (x) => MARGE_X + ((x - xLo) / (xHi - xLo)) * (LARGEUR - 2 * MARGE_X);
  const py = (y) => MARGE_HAUT + ((yHi - y) / (yHi - yLo)) * (HAUTEUR - MARGE_HAUT - MARGE_BAS);

  const svg = el("svg", { viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`, role: "img", "aria-label": descriptionCroquisParabole({ a, b, c }), focusable: "false" }, "moteur-croquis");

  const ox = py(0);
  const oy = px(0);

  if (options.surlignageImf) {
    // Ensemble-image : de la hauteur du sommet jusqu'au bord de l'axe Oy, du côté où s'ouvre la parabole.
    svg.appendChild(el("line", { x1: oy, y1: py(yS), x2: oy, y2: a > 0 ? MARGE_HAUT / 2 : HAUTEUR - MARGE_BAS / 2 }, "croquis-surlignage"));
  }

  svg.appendChild(el("line", { x1: 6, y1: ox, x2: LARGEUR - 8, y2: ox }, "croquis-axe"));
  svg.appendChild(flecheAxe(LARGEUR - 6, ox, "droite"));
  svg.appendChild(texte("x", { x: LARGEUR - 18, y: ox - 8 }, "croquis-etiquette"));
  svg.appendChild(el("line", { x1: oy, y1: HAUTEUR - 8, x2: oy, y2: 8 }, "croquis-axe"));
  svg.appendChild(flecheAxe(oy, 6, "haut"));
  svg.appendChild(texte("y", { x: oy + 8, y: 16 }, "croquis-etiquette"));

  const points = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const x = xLo + ((xHi - xLo) * i) / N;
    points.push(`${px(x).toFixed(1)},${py(f(x)).toFixed(1)}`);
  }
  svg.appendChild(el("polyline", { points: points.join(" ") }, "croquis-courbe"));

  // Point (0 ; c) sur Oy. Étiquette à droite, du côté opposé à celle de S quand les deux points coïncident.
  const cx = oy;
  const cy = py(c);
  const memeSommetEtC = Math.abs(cx - px(xS)) < 1 && Math.abs(cy - py(yS)) < 1;
  svg.appendChild(el("circle", { cx, cy, r: 4 }, "croquis-point"));
  const libC = `c = ${Number.isInteger(c) ? c : etiquetteDecimale(c)}`;
  const versLeHaut = a > 0 ? memeSommetEtC : !memeSommetEtC;
  svg.appendChild(texte(libC, { x: cx + 8, y: cy + (versLeHaut ? -8 : 16) }, "croquis-etiquette croquis-etiquette-forte"));

  // Sommet, toujours dessiné (point) ; la lettre S seulement avec `marqueS`, hors du tracé (sous le
  // sommet d'une parabole ouverte vers le haut, au-dessus sinon).
  svg.appendChild(el("circle", { cx: px(xS), cy: py(yS), r: 5 }, "croquis-sommet"));
  if (options.marqueS) svg.appendChild(texte("S", { x: px(xS), y: py(yS) + (a > 0 ? 20 : -11), "text-anchor": "middle" }, "croquis-etiquette croquis-etiquette-sommet"));

  if (options.marquesOx) {
    // Marques sur Ox issues de la MÊME fonction que la courbe : racines réelles et xS ; une racine
    // confondue avec xS (Δ = 0) ne donne qu'une marque (fusion), portant aussi l'indice x_S.
    const marques = [];
    for (const r of racines ?? []) marques.push({ x: r.valeur, etiquette: r.etiquette, estXS: Math.abs(r.valeur - xS) < 1e-9 });
    if (!marques.some((m) => m.estXS)) marques.push({ x: xS, etiquette: etiquetteFraction(-b, 2 * a), estXS: true });
    for (const m of marques) {
      svg.appendChild(el("circle", { cx: px(m.x), cy: ox, r: 4 }, "croquis-point"));
      svg.appendChild(texte(m.etiquette, { x: px(m.x), y: ox + 17, "text-anchor": "middle" }, "croquis-etiquette croquis-etiquette-petite"));
      if (m.estXS) {
        const indice = texte("x", { x: px(m.x), y: ox + 29, "text-anchor": "middle" }, "croquis-etiquette croquis-etiquette-petite");
        const sub = el("tspan", { "baseline-shift": "sub", dy: 3 }, "croquis-indice");
        sub.textContent = "S";
        indice.appendChild(sub);
        svg.appendChild(indice);
      }
    }
  }
  return svg;
}

/** Position du sommet par rapport à Oy : `"gauche"`, `"axe"`, `"droite"` ou `null`. Déduite de `signeAB` (a·b > 0 : à gauche) si `positionSommet` n'est pas donnée. */
export function positionDuSommet(signeAB, positionSommet) {
  if (positionSommet === "gauche" || positionSommet === "axe" || positionSommet === "droite") return positionSommet;
  return signeAB === "+" ? "gauche" : signeAB === "-" ? "droite" : signeAB === "0" ? "axe" : null;
}

/** Description textuelle du croquis d'allure, uniquement d'après les choix locaux (attribut `aria-label`). */
export function descriptionCroquisAllure(signeA, signeAB, positionSommet) {
  const position = positionDuSommet(signeAB, positionSommet);
  if (!signeA || !position) return "Croquis de l'axe des ordonnées : fais tes deux choix pour voir la parabole.";
  const sens = signeA === "-" ? "bas" : "haut";
  const lieu = position === "axe" ? "sur l'axe des ordonnées" : position === "gauche" ? "à gauche de l'axe des ordonnées" : "à droite de l'axe des ordonnées";
  return `Croquis de l'axe des ordonnées : parabole ouverte vers le ${sens}, sommet ${lieu}.`;
}

const LARGEUR_ALLURE = 200;
const HAUTEUR_ALLURE = 180;

/**
 * Croquis de l'axe Oy seul. `signeA` (`"+"` | `"-"`), `signeAB` (`"+"` | `"-"` | `"0"`) : les choix
 * LOCAUX de l'élève (`null` tant que l'un des deux manque : courbe neutre en pointillés) ; `c` : ordonnée
 * à l'origine, publique dans l'énoncé.
 * @returns {SVGSVGElement}
 */
export function construireCroquisAllure({ signeA, signeAB, positionSommet, c }) {
  const position = positionDuSommet(signeAB, positionSommet);
  const enCours = !signeA || !position;
  const svg = el("svg", { viewBox: `0 0 ${LARGEUR_ALLURE} ${HAUTEUR_ALLURE}`, role: "img", "aria-label": descriptionCroquisAllure(signeA, signeAB, positionSommet), focusable: "false" }, "moteur-croquis moteur-croquis-allure");
  const marge = 22;
  const axeX = LARGEUR_ALLURE / 2;
  const sommetY = 90;
  const demiLargeur = LARGEUR_ALLURE / 2 - marge;
  const k = 60 / (demiLargeur * demiLargeur);
  const decalage = enCours || position === "axe" ? 0 : position === "gauche" ? -demiLargeur * 0.5 : demiLargeur * 0.5;
  const sommetX = axeX + decalage;
  const sens = !enCours && signeA === "-" ? -1 : 1;
  const yPx = (x) => sommetY - sens * k * (x - sommetX) * (x - sommetX);

  svg.appendChild(el("line", { x1: axeX, y1: HAUTEUR_ALLURE - 10, x2: axeX, y2: 12 }, "croquis-axe"));
  svg.appendChild(flecheAxe(axeX, 12, "haut"));
  svg.appendChild(texte("y", { x: axeX + 9, y: 26 }, "croquis-etiquette"));
  const points = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const x = marge + ((LARGEUR_ALLURE - 2 * marge) * i) / N;
    points.push(`${x.toFixed(1)},${yPx(x).toFixed(1)}`);
  }
  const courbe = el("polyline", { points: points.join(" ") }, enCours ? "croquis-courbe croquis-courbe-neutre" : "croquis-courbe");
  if (enCours) courbe.setAttribute("stroke-dasharray", "7 6");
  svg.appendChild(courbe);
  const yC = yPx(axeX);
  svg.appendChild(el("circle", { cx: axeX, cy: yC, r: 5 }, enCours ? "croquis-point croquis-point-neutre" : "croquis-point"));
  svg.appendChild(texte(`c = ${Number.isInteger(c) ? c : etiquetteDecimale(c)}`, { x: axeX + 8, y: yC + (yC > sommetY - 5 ? 18 : -10) }, "croquis-etiquette croquis-etiquette-forte"));
  return svg;
}
