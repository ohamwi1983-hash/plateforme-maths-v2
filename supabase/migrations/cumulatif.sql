-- Migration cumulative — plateforme-maths-pilote
--
-- Un seul fichier, pas un fichier par changement : chaque `create table`/`alter table` ci-dessous
-- est idempotent (`if not exists`), donc l'exécuter en entier, à tout moment, sur une base à
-- n'importe quel stade de son historique réel, la met à jour sans erreur ni doublon — y compris
-- si certaines lignes sont déjà appliquées ou si la base n'a jamais été créée.
--
-- RÈGLE DE MAINTENANCE (voir RAPPORT.md, section sur l'audit du 2026-09-09) :
-- ce fichier doit être mis à jour DANS LE MÊME COMMIT que tout changement à `supabase/schema.sql`
-- (nouvelle table, nouvelle colonne, changement de contrainte). Ne jamais laisser une migration
-- exister uniquement en prose dans RAPPORT.md ou dans schema.sql sans l'ajouter ici sous forme
-- d'instruction exécutable — c'est exactement l'écart qui a rendu `taches_assignations.date_echeance`
-- indisponible en production malgré son ajout à schema.sql (documenté en prose, jamais livré comme
-- script à exécuter). Une tâche qui touche schema.sql n'est pas terminée si ce fichier n'a pas été
-- mis à jour en conséquence.
--
-- État couvert à ce jour : commits a5cbf25 (création initiale) → eda55c2 (tableau de bord élève,
-- date_echeance/champs_attendus) → le commit de "Gestion de classe étendue" (eleves.actif) — voir
-- `git log --oneline -- supabase/schema.sql`.

create table if not exists profs (
  id uuid primary key references auth.users(id),
  nom text not null
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  prof_id uuid not null references profs(id),
  nom text not null
);
alter table classes add column if not exists code text unique;

create table if not exists eleves (
  id uuid primary key default gen_random_uuid(),
  nom text not null
);
alter table eleves add column if not exists prenom text not null default '';
alter table eleves add column if not exists suffixe_affichage int;
alter table eleves add column if not exists actif boolean not null default true;

create table if not exists inscriptions (
  eleve_id uuid not null references eleves(id),
  classe_id uuid not null references classes(id),
  primary key (eleve_id, classe_id)
);

create table if not exists taches (
  id uuid primary key default gen_random_uuid(),
  prof_id uuid not null references profs(id),
  nom text not null,
  date_creation timestamptz not null default now()
);
alter table taches add column if not exists feedback_immediat boolean not null default true;
alter table taches add column if not exists reponse_visible boolean not null default false;

create table if not exists taches_composition (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  generateur_id text not null,
  variante_id text not null,
  nombre_exercices int not null
);

create table if not exists taches_assignations (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  classe_id uuid not null references classes(id),
  date_creation timestamptz not null default now()
);
alter table taches_assignations add column if not exists date_echeance timestamptz;

create table if not exists exercices_assignes (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  eleve_id uuid not null references eleves(id),
  generateur_id text not null,
  variante_id text not null,
  enonce jsonb not null,
  solution jsonb not null,
  bugs_plausibles jsonb,
  date_creation timestamptz not null default now()
);
alter table exercices_assignes add column if not exists forme_affichage text;
alter table exercices_assignes add column if not exists champs_attendus text[];

create table if not exists reponses (
  id uuid primary key default gen_random_uuid(),
  exercice_assigne_id uuid not null references exercices_assignes(id),
  champ text not null,
  valeur_saisie text not null,
  statut text not null,
  bug_detecte text,
  indice_utilise boolean not null default false,
  horodatage timestamptz not null default now()
);

-- Prompt "Inscription professeur (par invitation)", Étape 2.
create table if not exists invitations_prof (
  code text primary key,
  utilise boolean not null default false,
  cree_le timestamptz not null default now()
);

-- Prompt "Date de début de tâche" (2/3), Étape 1.
alter table taches_assignations add column if not exists date_debut timestamptz not null default now();

-- Prompt "Tentatives, aide, récapitulatif" (3/3), Étape 1.
alter table taches add column if not exists tentatives_supplementaires int not null default 0;
alter table taches add column if not exists aide_activee boolean not null default false;
alter table taches add column if not exists aide_penalite_pourcent int not null default 0;
alter table taches add column if not exists afficher_recapitulatif boolean not null default false;

-- Prompt "Assigner à des élèves spécifiques" : assignation par élève, table séparée de
-- taches_assignations (voir supabase/schema.sql pour la justification complète).
create table if not exists taches_assignations_eleves (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  eleve_id uuid not null references eleves(id),
  date_creation timestamptz not null default now(),
  date_echeance timestamptz,
  date_debut timestamptz not null default now()
);

-- Correctif "Chrono de réponse" : réglages de tâche (mode + durée) et mesure passive systématique
-- par réponse (voir supabase/schema.sql pour la justification complète).
alter table taches add column if not exists chrono_mode text not null default 'aucun';
alter table taches add column if not exists chrono_duree_secondes int;
alter table reponses add column if not exists duree_ecoulee_secondes int;

-- Correctif "Chrono de réponse" (révision "horodatage de départ côté serveur") : horodatage de
-- départ d'écran, seule source de vérité du temps (voir supabase/schema.sql pour la justification
-- complète). `create table if not exists` : idempotent comme le reste de ce fichier.
create table if not exists debuts_ecran (
  exercice_assigne_id uuid not null references exercices_assignes(id),
  champ text not null,
  horodatage_debut timestamptz not null default now(),
  primary key (exercice_assigne_id, champ)
);

-- Correctif "Chrono par variante" : surcharge par ligne de composition, repli sur
-- taches.chrono_duree_secondes si absente (voir supabase/schema.sql pour la justification complète).
alter table taches_composition add column if not exists chrono_duree_secondes int;

-- Prompt "Aperçu d'une tâche avant création" : élève fantôme par prof (jamais inscrit à une classe,
-- jamais affiché) + marqueur de tâche d'aperçu (voir supabase/schema.sql pour la justification
-- complète).
alter table profs add column if not exists eleve_apercu_id uuid references eleves(id);
alter table taches add column if not exists est_apercu boolean not null default false;
