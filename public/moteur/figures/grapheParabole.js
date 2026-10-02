/**
 * Figure « graphe_parabole » (RAPPORT §56) : graphique STATIQUE d'une parabole dans un repère gradué, dessiné à partir de la figure DÉCLARÉE par le générateur (donnée pure : fenêtre,
 * graduations, arc de Bézier quadratique). DOM API uniquement (`createElementNS` + `textContent`, jamais `innerHTML`), aucune couleur ni épaisseur ici : classes `figure-*` stylées par
 * `ecrans.css` avec les tokens du design system. Les nombres de ce fichier sont des coordonnées géométriques.
 *
 * La courbe est tracée par UN arc `Q` (exact pour une parabole) et rognée à la fenêtre par un `clipPath` : ses extrémités peuvent sortir du cadre. Les annotations d'une aide
 * (`annoter`) sont des marques AJOUTÉES sur une couche à part, calculées avec la MÊME transformation repère → pixels que la courbe : elles sont sur la courbe par construction.
 * L'état de la figure (les annotations posées) est local : il ne quitte jamais ce composant.
 */
const NS = "http://www.w3.org/2000/svg";
const LARGEUR = 360;
const HAUTEUR = 260;
const MARGE = { gauche: 34, droite: 14, haut: 12, bas: 28 };
let compteurClip = 0;

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

/** Nombre affiché sur un axe : entier, ou décimal à virgule ; le moins typographique. */
function etiquetteNombre(v) {
  return String(Math.round(v * 100) / 100).replace(".", ",").replace("-", "−");
}

export default {
  type: "graphe_parabole",

  creer(figure) {
    const { xMin, xMax, yMin, yMax } = figure.fenetre;
    const largeurUtile = LARGEUR - MARGE.gauche - MARGE.droite;
    const hauteurUtile = HAUTEUR - MARGE.haut - MARGE.bas;
    const px = (x) => MARGE.gauche + ((x - xMin) / (xMax - xMin)) * largeurUtile;
    const py = (y) => MARGE.haut + ((yMax - y) / (yMax - yMin)) * hauteurUtile;

    const element = document.createElement("div");
    element.className = "moteur-figure moteur-figure-parabole";
    const svg = el("svg", { viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`, role: "img", "aria-label": figure.description, focusable: "false" }, "figure-svg");
    const idClip = `figure-clip-${++compteurClip}`;
    const defs = el("defs");
    const clip = el("clipPath", { id: idClip });
    clip.appendChild(el("rect", { x: MARGE.gauche, y: MARGE.haut, width: largeurUtile, height: hauteurUtile }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    svg.appendChild(el("rect", { x: MARGE.gauche, y: MARGE.haut, width: largeurUtile, height: hauteurUtile }, "figure-cadre"));

    // Quadrillage fin à chaque entier quand la fenêtre est petite, quadrillage des graduations étiquetées toujours.
    const fin = (min, max) => max - min <= 30;
    const grille = el("g", {}, "figure-grilles");
    if (fin(xMin, xMax)) for (let x = Math.ceil(xMin); x <= xMax; x++) grille.appendChild(el("line", { x1: px(x), y1: MARGE.haut, x2: px(x), y2: MARGE.haut + hauteurUtile }, "figure-grille-fine"));
    if (fin(yMin, yMax)) for (let y = Math.ceil(yMin); y <= yMax; y++) grille.appendChild(el("line", { x1: MARGE.gauche, y1: py(y), x2: MARGE.gauche + largeurUtile, y2: py(y) }, "figure-grille-fine"));
    for (const x of figure.graduations.x) grille.appendChild(el("line", { x1: px(x), y1: MARGE.haut, x2: px(x), y2: MARGE.haut + hauteurUtile }, "figure-grille"));
    for (const y of figure.graduations.y) grille.appendChild(el("line", { x1: MARGE.gauche, y1: py(y), x2: MARGE.gauche + largeurUtile, y2: py(y) }, "figure-grille"));
    svg.appendChild(grille);

    // Axes du repère, seulement s'ils sont dans la fenêtre.
    if (xMin <= 0 && xMax >= 0) svg.appendChild(el("line", { x1: px(0), y1: MARGE.haut, x2: px(0), y2: MARGE.haut + hauteurUtile }, "figure-axe"));
    if (yMin <= 0 && yMax >= 0) svg.appendChild(el("line", { x1: MARGE.gauche, y1: py(0), x2: MARGE.gauche + largeurUtile, y2: py(0) }, "figure-axe"));

    // Graduations étiquetées, hors du cadre (à gauche et en dessous).
    for (const x of figure.graduations.x) svg.appendChild(texte(etiquetteNombre(x), { x: px(x), y: MARGE.haut + hauteurUtile + 16, "text-anchor": "middle" }, "figure-graduation"));
    for (const y of figure.graduations.y) svg.appendChild(texte(etiquetteNombre(y), { x: MARGE.gauche - 6, y: py(y) + 4, "text-anchor": "end" }, "figure-graduation"));

    const c = figure.courbe;
    const trace = el("g", { "clip-path": `url(#${idClip})` });
    trace.appendChild(el("path", { d: `M ${px(c.x0)} ${py(c.y0)} Q ${px(c.xc)} ${py(c.yc)} ${px(c.x1)} ${py(c.y1)}` }, "figure-courbe"));
    svg.appendChild(trace);

    const couche = el("g", {}, "figure-annotations");
    svg.appendChild(couche);
    element.appendChild(svg);

    function pointAnnote(a) {
      const g = el("g", {}, "figure-annotation figure-annotation-point");
      const [cx, cy] = [px(a.x), py(a.y)];
      g.appendChild(el("circle", { cx, cy, r: 5 }, "figure-point-annote"));
      // Étiquette du côté libre : à droite sauf près du bord droit ; au-dessus sauf près du bord haut.
      const droite = cx < LARGEUR - MARGE.droite - 80;
      const haut = cy > MARGE.haut + 20;
      g.appendChild(texte(a.etiquette, { x: cx + (droite ? 9 : -9), y: cy + (haut ? -8 : 16), "text-anchor": droite ? "start" : "end" }, "figure-etiquette figure-etiquette-forte"));
      return g;
    }

    function vecteurAnnote(a) {
      const g = el("g", {}, "figure-annotation figure-annotation-vecteur");
      const [x1, y1, x2, y2] = [px(a.de[0]), py(a.de[1]), px(a.vers[0]), py(a.vers[1])];
      const longueur = Math.hypot(x2 - x1, y2 - y1);
      if (longueur < 1) return g;
      g.appendChild(el("line", { x1, y1, x2, y2 }, "figure-vecteur"));
      const [ux, uy] = [(x2 - x1) / longueur, (y2 - y1) / longueur];
      const pointe = `${x2},${y2} ${x2 - 9 * ux + 4 * uy},${y2 - 9 * uy - 4 * ux} ${x2 - 9 * ux - 4 * uy},${y2 - 9 * uy + 4 * ux}`;
      g.appendChild(el("polygon", { points: pointe }, "figure-vecteur-pointe"));
      // Étiquette au milieu : au-dessus d'un vecteur plutôt horizontal, à droite d'un vecteur plutôt vertical.
      const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
      const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
      g.appendChild(texte(a.etiquette, { x: horizontal ? mx : mx + 8, y: horizontal ? my - 7 : my + 4, "text-anchor": horizontal ? "middle" : "start" }, "figure-etiquette"));
      return g;
    }

    return {
      element,
      /** Remplace la couche d'annotations par `annotations` (liste CUMULÉE servie par le serveur pour le palier atteint). */
      annoter(annotations) {
        couche.replaceChildren();
        for (const a of Array.isArray(annotations) ? annotations : []) {
          if (a && a.genre === "point" && Number.isFinite(a.x) && Number.isFinite(a.y)) couche.appendChild(pointAnnote(a));
          else if (a && a.genre === "vecteur" && Array.isArray(a.de) && Array.isArray(a.vers)) couche.appendChild(vecteurAnnote(a));
        }
      },
    };
  },
};
