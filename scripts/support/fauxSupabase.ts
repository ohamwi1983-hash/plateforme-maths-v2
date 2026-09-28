/**
 * Faux client Supabase EN MÉMOIRE, juste assez fidèle pour exécuter les VRAIS gestionnaires de
 * `lib/routes/` (même idiome que `scripts/test-routeur.ts`, mais partagé et avec un vrai stockage) :
 * `from(table).select/insert/upsert/update/delete` + filtres `eq`/`in`/`not(…,"is",null)` + `order`,
 * `limit`, `range`, `returns`, `maybeSingle`/`single`, et la jointure imbriquée
 * `select("eleve_id, eleves(id, nom, …)")` (clé étrangère `<relation au singulier>_id`).
 * Pas de contraintes SQL : les tests vérifient le comportement des routes, pas Postgres.
 * Valeurs par défaut simulées : `id` (uuid) et les colonnes d'horodatage courantes.
 */
import { randomUUID } from "node:crypto";

type Ligne = Record<string, any>;
type Resultat = { data: any; error: { message: string } | null };

const TABLES_AVEC_ID = new Set(["profs", "classes", "eleves", "taches", "taches_composition", "taches_assignations", "taches_assignations_eleves", "exercices_assignes", "reponses"]);
const COLONNES_HORODATAGE = ["date_creation", "horodatage", "horodatage_debut", "date_debut"];

export class BaseMemoire {
  tables = new Map<string, Ligne[]>();
  maintenant: () => string = () => new Date().toISOString();

  table(nom: string): Ligne[] {
    if (!this.tables.has(nom)) this.tables.set(nom, []);
    return this.tables.get(nom)!;
  }

  inserer(nom: string, ligne: Ligne): Ligne {
    const complete: Ligne = { ...ligne };
    if (TABLES_AVEC_ID.has(nom) && complete.id === undefined) complete.id = randomUUID();
    for (const c of COLONNES_HORODATAGE) {
      if (complete[c] === undefined && (nom !== "taches_assignations" || c !== "horodatage") && this.colonneAttendue(nom, c)) complete[c] = this.maintenant();
    }
    this.table(nom).push(complete);
    return complete;
  }

  private colonneAttendue(nom: string, colonne: string): boolean {
    const attendues: Record<string, string[]> = {
      exercices_assignes: ["date_creation"],
      reponses: ["horodatage"],
      debuts_ecran: ["horodatage_debut"],
      aides_utilisees: ["horodatage"],
      taches_assignations: ["date_creation", "date_debut"],
      taches_assignations_eleves: ["date_creation", "date_debut"],
      taches: ["date_creation"],
    };
    return (attendues[nom] ?? []).includes(colonne);
  }

  from(nom: string) {
    return new Constructeur(this, nom);
  }
}

class Constructeur implements PromiseLike<Resultat> {
  private filtres: ((l: Ligne) => boolean)[] = [];
  private colonnes = "*";
  private tri: { col: string; asc: boolean } | null = null;
  private borne: number | null = null;
  private plage: [number, number] | null = null;
  private mode: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private charge: Ligne | Ligne[] | null = null;
  private optionsUpsert: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private unique: "maybe" | "single" | null = null;

  constructor(
    private base: BaseMemoire,
    private nom: string,
  ) {}

  select(colonnes = "*") {
    this.colonnes = colonnes;
    return this;
  }
  insert(charge: Ligne | Ligne[]) {
    this.mode = "insert";
    this.charge = charge;
    return this;
  }
  upsert(charge: Ligne | Ligne[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.mode = "upsert";
    this.charge = charge;
    this.optionsUpsert = options;
    return this;
  }
  update(charge: Ligne) {
    this.mode = "update";
    this.charge = charge;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filtres.push((l) => l[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filtres.push((l) => vals.includes(l[col]));
    return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op !== "is") throw new Error(`faux Supabase : not(${op}) non géré`);
    this.filtres.push((l) => (l[col] ?? null) !== val);
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.tri = { col, asc: opts.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.borne = n;
    return this;
  }
  range(debut: number, fin: number) {
    this.plage = [debut, fin];
    return this;
  }
  returns<T>() {
    void (0 as unknown as T);
    return this;
  }
  maybeSingle() {
    this.unique = "maybe";
    return this;
  }
  single() {
    this.unique = "single";
    return this;
  }

  private projeter(ligne: Ligne): Ligne {
    if (this.colonnes === "*") return { ...ligne };
    const sortie: Ligne = {};
    const relations: { nom: string; cols: string }[] = [];
    const sansRelations = this.colonnes.replace(/(\w+)\(([^)]*)\)/g, (_m, nom: string, cols: string) => {
      relations.push({ nom, cols });
      return "";
    });
    for (const col of sansRelations.split(",").map((c) => c.trim()).filter(Boolean)) sortie[col] = ligne[col] ?? null;
    for (const rel of relations) {
      const fk = `${rel.nom.replace(/s$/, "")}_id`;
      const cible = this.base.table(rel.nom).find((l) => l.id === ligne[fk]);
      sortie[rel.nom] = cible ? Object.fromEntries(rel.cols.split(",").map((c) => c.trim()).map((c) => [c, cible[c] ?? null])) : null;
    }
    return sortie;
  }

  private executer(): Resultat {
    const table = this.base.table(this.nom);
    if (this.mode === "insert" || this.mode === "upsert") {
      const lignes = Array.isArray(this.charge) ? this.charge : [this.charge!];
      const inserees: Ligne[] = [];
      for (const l of lignes) {
        if (this.mode === "upsert" && this.optionsUpsert.onConflict) {
          const cles = this.optionsUpsert.onConflict.split(",");
          const existante = table.find((t) => cles.every((c) => t[c] === l[c]));
          if (existante) {
            if (!this.optionsUpsert.ignoreDuplicates) Object.assign(existante, l);
            continue;
          }
        }
        inserees.push(this.base.inserer(this.nom, l));
      }
      return { data: inserees.map((l) => this.projeter(l)), error: null };
    }
    const cibles = table.filter((l) => this.filtres.every((f) => f(l)));
    if (this.mode === "update") {
      for (const l of cibles) Object.assign(l, this.charge);
      return { data: cibles.map((l) => this.projeter(l)), error: null };
    }
    if (this.mode === "delete") {
      this.base.tables.set(this.nom, table.filter((l) => !cibles.includes(l)));
      return { data: [], error: null };
    }
    let lignes = [...cibles];
    if (this.tri) {
      const { col, asc } = this.tri;
      lignes.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
    }
    if (this.plage) lignes = lignes.slice(this.plage[0], this.plage[1] + 1);
    if (this.borne !== null) lignes = lignes.slice(0, this.borne);
    const projetees = lignes.map((l) => this.projeter(l));
    if (this.unique) return { data: projetees[0] ?? null, error: null };
    return { data: projetees, error: null };
  }

  then<R1 = Resultat, R2 = never>(ok?: ((v: Resultat) => R1 | PromiseLike<R1>) | null, ko?: ((r: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return Promise.resolve()
      .then(() => this.executer())
      .then(ok, ko);
  }
}
