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

export interface UtilisateurAuth {
  id: string;
  email: string;
  password: string;
  /** `ban_duration` reçu (ex. « 876000h ») ; `null` = non banni (jamais banni, ou « none »). */
  banni: string | null;
}

export class BaseMemoire {
  tables = new Map<string, Ligne[]>();
  private dernierMs = 0;
  private micro = 0;
  /**
   * Horodatage par défaut d'une ligne insérée : STRICTEMENT croissant, comme les microsecondes de Postgres (deux insertions successives
   * n'ont jamais le même `horodatage`). Sans cela, deux lignes insérées dans la même milliseconde seraient ex æquo et le tri `order("horodatage")`
   * ne distinguerait plus l'ordre d'insertion — dont dépend la validité des réponses sous retour en arrière (RAPPORT §37). Les 3 chiffres
   * de microsecondes (`…:00.123456Z`) ne décalent pas l'horloge : `new Date(...)` les tronque, l'ordre lexicographique les respecte.
   */
  maintenant: () => string = () => {
    const ms = Date.now();
    this.micro = ms === this.dernierMs ? this.micro + 1 : 0;
    this.dernierMs = ms;
    return new Date(ms).toISOString().replace("Z", `${String(this.micro).padStart(3, "0")}Z`);
  };


  /** Comptes « Supabase Auth » simulés, pour les routes qui appellent `admin.auth.admin.*` (rôle admin-prof, RAPPORT §26). */
  utilisateursAuth = new Map<string, UtilisateurAuth>();
  /** Journal des appels `auth.admin.*` (nom + argument utile), pour que les tests vérifient ce qui a été demandé à Auth. */
  appelsAuth: { appel: string; id?: string; attributs?: Record<string, unknown> }[] = [];
  /** Force l'échec du prochain `updateUserById` (message donné), une seule fois. */
  echecProchaineMajAuth: string | null = null;

  auth = {
    /** Connexion e-mail / mot de passe simulée (ni jeton réel, ni bannissement : ce n'est PAS le comportement de GoTrue). */
    signInWithPassword: async (a: { email: string; password: string }) => {
      const u = [...this.utilisateursAuth.values()].find((x) => x.email.toLowerCase() === a.email.toLowerCase() && x.password === a.password);
      // Jeton du harnais : `eleve:<id>` pour un compte qui a une ligne `eleves` (élève fantôme de l'aperçu), sinon `prof:<id>`.
      return u ? { data: { session: { access_token: `${this.table("eleves").some((e) => e.id === u.id) ? "eleve" : "prof"}:${u.id}`, refresh_token: "refresh" } }, error: null } : { data: { session: null }, error: { message: "Invalid login credentials" } };
    },
    admin: {
      createUser: async (a: { email: string; password: string; email_confirm?: boolean }) => {
        this.appelsAuth.push({ appel: "createUser", attributs: { email: a.email } });
        if ([...this.utilisateursAuth.values()].some((u) => u.email.toLowerCase() === a.email.toLowerCase())) {
          return { data: { user: null }, error: { message: "A user with this email address has already been registered" } };
        }
        const id = randomUUID();
        this.utilisateursAuth.set(id, { id, email: a.email, password: a.password, banni: null });
        return { data: { user: { id, email: a.email } }, error: null };
      },
      getUserById: async (id: string) => {
        const u = this.utilisateursAuth.get(id);
        return u ? { data: { user: { id: u.id, email: u.email } }, error: null } : { data: { user: null }, error: { message: "User not found" } };
      },
      updateUserById: async (id: string, attributs: { password?: string; ban_duration?: string }) => {
        this.appelsAuth.push({ appel: "updateUserById", id, attributs: { ...attributs } });
        if (this.echecProchaineMajAuth) {
          const message = this.echecProchaineMajAuth;
          this.echecProchaineMajAuth = null;
          return { data: { user: null }, error: { message } };
        }
        const u = this.utilisateursAuth.get(id);
        if (!u) return { data: { user: null }, error: { message: "User not found" } };
        if (attributs.password !== undefined) u.password = attributs.password;
        if (attributs.ban_duration !== undefined) u.banni = attributs.ban_duration === "none" ? null : attributs.ban_duration;
        return { data: { user: { id: u.id, email: u.email } }, error: null };
      },
      deleteUser: async (id: string) => {
        this.appelsAuth.push({ appel: "deleteUser", id });
        this.utilisateursAuth.delete(id);
        return { data: null, error: null };
      },
    },
  };

  table(nom: string): Ligne[] {
    if (!this.tables.has(nom)) this.tables.set(nom, []);
    return this.tables.get(nom)!;
  }

  inserer(nom: string, ligne: Ligne): Ligne {
    const complete: Ligne = { ...ligne };
    if (TABLES_AVEC_ID.has(nom) && complete.id === undefined) complete.id = randomUUID();
    // Défaut du schéma (`est_apercu boolean not null default false`) : sans lui, `.eq("est_apercu", false)` ne verrait aucune vraie tâche.
    if (nom === "taches" && complete.est_apercu === undefined) complete.est_apercu = false;
    // Défaut du schéma (RAPPORT §61) : `est_test boolean not null default false`.
    if (nom === "classes" && complete.est_test === undefined) complete.est_test = false;
    // Défaut du schéma : `eleves.actif boolean not null default true` (un élève créé par `provisionnerEleve` n'écrit pas la colonne).
    if (nom === "eleves" && complete.actif === undefined) complete.actif = true;
    // Défauts du schéma (RAPPORT §37) : `autoriser_retour_arriere boolean not null default false`, `remis_le` nul.
    if (nom === "taches" && complete.autoriser_retour_arriere === undefined) complete.autoriser_retour_arriere = false;
    if (nom === "exercices_assignes" && complete.remis_le === undefined) complete.remis_le = null;
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

  /**
   * `.single()` / `.maybeSingle()` après `insert` / `update` / `upsert` (avec `.select()`) : PostgREST renvoie UN objet,
   * pas un tableau. Le faux ne le faisait que pour `select` : `classes.ts` (génération paresseuse du code) recevait donc un
   * tableau, l'étalait (`{ ...[ligne] }` = `{ "0": ligne }`) et `prof.html` cessait de charger après `chargerClasses`.
   * `single()` sans ligne = erreur (PGRST116), `maybeSingle()` sans ligne = `null`.
   */
  private enUneLigneSiDemande(lignes: Ligne[]): Resultat {
    if (!this.unique) return { data: lignes, error: null };
    if (lignes.length === 0 && this.unique === "single") return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
    return { data: lignes[0] ?? null, error: null };
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
      return this.enUneLigneSiDemande(inserees.map((l) => this.projeter(l)));
    }
    const cibles = table.filter((l) => this.filtres.every((f) => f(l)));
    if (this.mode === "update") {
      for (const l of cibles) Object.assign(l, this.charge);
      return this.enUneLigneSiDemande(cibles.map((l) => this.projeter(l)));
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
