-- Schéma Supabase — Pilote Phase 0/0.5 (gen1 : mise_en_evidence + cas_general ; gen6 : facteurCommun)
-- + Authentification élève et réglages de correction.
-- Reproduit tel quel depuis l'Étape 3 du prompt d'implémentation initial (gen1).
-- RLS complet volontairement hors scope pour ce pilote — voir le rapport de fin pour l'endroit
-- exact où RLS devra être ajouté avant tout usage à plusieurs profs/classes réelles. Ce constat
-- pèse davantage depuis l'ajout des comptes élèves (RLS absent = n'importe quel titulaire d'une
-- clé anon peut, en théorie, requêter d'autres tables que les siennes) — noté, non traité ici.

create table profs (
  id uuid primary key references auth.users(id),
  nom text not null
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  prof_id uuid not null references profs(id),
  nom text not null,
  -- Ajouté pour "Authentification élève et réglages de correction" (Étape 1) : code à 6
  -- caractères, généré paresseusement par GET /api/classes si absent (voir Étape 2/RAPPORT.md —
  -- Portée explicite exclut toute interface de création de classe pour cette itération, donc pas
  -- de génération "à la création"). Nullable + unique : une classe existante sans code tant que
  -- GET /api/classes n'a pas encore tourné dessus.
  code text unique
);

create table eleves (
  id uuid primary key default gen_random_uuid(),
  -- `id` est désormais l'uid du compte Supabase Auth de l'élève (créé via
  -- admin.auth.admin.createUser, fourni explicitement à l'insertion — le `default
  -- gen_random_uuid()` ci-dessus ne sert donc plus qu'aux éventuelles lignes historiques). Pas de
  -- `references auth.users(id)` (contrairement à `profs`) : ce pilote n'a pas d'accès DB direct
  -- pour vérifier si d'anciennes lignes `eleves` (créées avant ce système d'authentification, via
  -- l'ancien menu déroulant) violeraient une contrainte de clé étrangère stricte — voir RAPPORT.md.
  nom text not null,
  -- Ajouté pour "Authentification élève et réglages de correction" (Étape 3) : le prompt d'origine
  -- ne liste aucun ALTER TABLE sur `eleves` alors que la recherche par nom+prénom l'exige — écart
  -- corrigé ici, voir RAPPORT.md. `not null default ''` : rétrocompatible avec d'éventuelles lignes
  -- existantes (nom seul, sans prénom séparé).
  prenom text not null default '',
  -- Rang d'affichage parmi les homonymes (même nom+prénom, comparaison insensible casse/accents)
  -- au sein d'une même classe au moment de l'inscription — 1 (ou null) pour le premier, jamais
  -- affiché ; 2+ affiché entre parenthèses ("Léa Dubois (2)"). Calculé une seule fois à la
  -- création, jamais recalculé rétroactivement (voir lib/homonymes.ts).
  suffixe_affichage int,
  -- Ajouté pour "Gestion de classe étendue" (Étape 1) : désactivation d'un compte élève (pas de
  -- suppression réelle — "toutes ses données restent intactes", voir RAPPORT.md). `not null
  -- default true` : toute ligne déjà existante reste active tant qu'elle n'est pas désactivée
  -- explicitement.
  actif boolean not null default true
);

-- Prompt "Aperçu d'une tâche avant création" : un "élève fantôme" par prof, créé paresseusement au
-- premier clic sur "Aperçu" (POST /api/taches/apercu) — un vrai compte Supabase Auth + une vraie
-- ligne `eleves` (pour réutiliser TEL QUEL tout le moteur élève existant : génération d'exercices,
-- correction, chrono, aide, récapitulatif — GET /api/eleves/tableau-de-bord, POST /api/reponses,
-- POST /api/reponses/debut-ecran, aucun de ces endpoints n'est modifié), mais JAMAIS inscrit à une
-- classe (`inscriptions`) — donc invisible de tout ce qui liste des élèves par classe (listes
-- d'élèves, résultats par élève). `alter table` plutôt qu'une colonne inline dans `create table
-- profs` ci-dessus : `eleves` n'existe pas encore à ce point du fichier (référence circulaire),
-- cette colonne doit donc être ajoutée après la définition de `eleves` plus bas.
alter table profs add column eleve_apercu_id uuid references eleves(id);

create table inscriptions (
  eleve_id uuid not null references eleves(id),
  classe_id uuid not null references classes(id),
  primary key (eleve_id, classe_id)
);

create table taches (
  id uuid primary key default gen_random_uuid(),
  prof_id uuid not null references profs(id),
  nom text not null,
  date_creation timestamptz not null default now(),
  -- Réglages de correction (Étape 1 de "Authentification élève et réglages de correction") :
  -- reponse_visible n'a d'effet que si feedback_immediat est vrai — pas de contrainte SQL,
  -- règle applicative dans api/reponses.ts (lib/reglagesCorrection.ts).
  feedback_immediat boolean not null default true,
  reponse_visible boolean not null default false,
  -- Réglages de tâche (prompt "Tentatives, aide, récapitulatif" (3/3), Étape 1) : "0 = pas de
  -- seconde chance" — traduit en tentativesMax = tentatives_supplementaires + 1 avant tout appel
  -- au moteur de score (lib/moteurTentatives.ts), jamais stocké tel quel.
  tentatives_supplementaires int not null default 0,
  -- aide_penalite_pourcent n'a d'effet que si aide_activee est vrai (même convention que
  -- reponse_visible ci-dessus) — pas de contrainte SQL, règle applicative. 0-100, jamais vérifié
  -- en base : validé côté serveur à la création/modification (lib/validationCorpsTaches.ts).
  aide_activee boolean not null default false,
  aide_penalite_pourcent int not null default 0,
  -- Défaut à false (décision explicite, jamais spécifiée par l'énoncé d'origine — voir RAPPORT.md) :
  -- cohérent avec aide_activee, le prof active explicitement l'écran récapitulatif s'il le souhaite.
  afficher_recapitulatif boolean not null default false,
  -- Correctif "Chrono de réponse" : un seul mode actif à la fois ('aucun' | 'par_ecran' | 'global'),
  -- pas de contrainte SQL — validé côté serveur (lib/routes/taches.ts). chrono_duree_secondes reste
  -- null tant que chrono_mode='aucun' ; sinon dérive `revelee`/`score` d'un champ dans
  -- lib/moteurTentatives.ts (calculerChronoExpire), jamais depuis un booléen envoyé par le client.
  chrono_mode text not null default 'aucun',
  chrono_duree_secondes int,
  -- Prompt "Aperçu d'une tâche avant création" : `true` pour la tâche éphémère générée par
  -- POST /api/taches/apercu (bouton "Aperçu" du formulaire "Créer une tâche") — exclue de toute
  -- liste/statistique orientée prof (GET /api/taches, GET /api/profs/tableau-de-bord, GET
  -- /api/profs/resultats), jamais assignable à une vraie classe/élève. Le prof n'a au plus qu'UNE
  -- seule tâche d'aperçu vivante à la fois (POST /api/taches/apercu supprime la précédente avant
  -- d'en créer une nouvelle) — évite toute accumulation sans mécanisme de purge périodique.
  est_apercu boolean not null default false
);

create table taches_composition (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  generateur_id text not null,   -- 'gen1' | 'gen6'
  variante_id text not null,     -- 'mise_en_evidence' | 'cas_general' | 'facteurCommun'
  nombre_exercices int not null,
  -- Correctif "Chrono par variante" : surcharge, ligne de composition par ligne, du chrono de
  -- tâche — nullable, repli sur `taches.chrono_duree_secondes` si absent (voir
  -- lib/resoudreChronoDureeSecondes.ts). Ignoré entièrement en mode `chrono_mode='global'` (un
  -- seul budget partagé, pas de sens à la surcharge dans ce mode) ; n'a d'effet qu'en
  -- `chrono_mode='par_ecran'`. Pas de contrainte d'unicité sur `(tache_id, variante_id)` (aucune
  -- ajoutée par ce correctif — décision actée : si plusieurs lignes correspondantes existent avec
  -- des valeurs différentes, `resoudreChronoDureeSecondes` retient la première valeur non nulle
  -- trouvée).
  chrono_duree_secondes int
);

create table taches_assignations (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  classe_id uuid not null references classes(id),
  date_creation timestamptz not null default now(),
  -- Ajouté pour "Tableau de bord élève" (Étape 1) : le prompt d'origine ne liste aucun ALTER TABLE
  -- pour une échéance alors que toute la classification en 3 catégories (Étape 3) en dépend — écart
  -- corrigé ici, voir RAPPORT.md. Portée : l'échéance dépend de l'assignation à UNE classe précise
  -- (POST /api/assignations), pas de la tâche elle-même (qui peut en théorie être réassignée à une
  -- autre classe avec une autre échéance) — cohérent avec le sens déjà donné à cette table.
  -- Nullable : les assignations déjà existantes avant ce correctif n'ont pas d'échéance ; traitées
  -- comme "jamais en retard" (voir lib/tableauDeBord.ts, classifierTache) plutôt que de forcer une
  -- valeur arbitraire.
  date_echeance timestamptz,
  -- Ajouté pour "Date de début de tâche" (2/3), Étape 1 : "défaut : maintenant" — NOT NULL avec
  -- `default now()` (contrairement à `date_echeance`, optionnelle) : une assignation a TOUJOURS un
  -- début, y compris les lignes déjà existantes avant ce correctif (elles reçoivent `now()` au
  -- moment de l'ALTER TABLE, donc immédiatement visibles, jamais rétroactivement masquées — voir
  -- lib/tableauDeBord.ts, classifierTache).
  date_debut timestamptz not null default now()
);

-- Prompt "Assigner à des élèves spécifiques" : assignation par ÉLÈVE (jamais par classe) —
-- potentiellement des élèves de classes différentes pour une même tâche. Table séparée de
-- `taches_assignations` (jamais un `classe_id` rendu nullable dessus) : les 2 mécanismes
-- coexistent sans se marcher dessus, `GET /api/taches` les fusionne dans une seule liste
-- `assignations` (voir lib/routes/taches.ts). `tacheEstAssignee` (lib/tacheAssignee.ts) considère
-- une tâche assignée si l'une OU l'autre table a au moins une ligne — même règle de verrouillage
-- de suppression, jamais recalculée différemment ici.
create table taches_assignations_eleves (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  eleve_id uuid not null references eleves(id),
  date_creation timestamptz not null default now(),
  date_echeance timestamptz,
  date_debut timestamptz not null default now()
);

create table exercices_assignes (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches(id),
  eleve_id uuid not null references eleves(id),
  generateur_id text not null,
  variante_id text not null,
  enonce jsonb not null,
  solution jsonb not null,
  bugs_plausibles jsonb,
  -- Ajouté après l'Étape 3 initiale de gen1 : nécessaire pour reproduire côté pilote la condition
  -- exacte de saut de l'écran "isolement" (src/moteur/session.ts:30-36 du dépôt source,
  -- necessiteIsolement dépend de formeAffichage, pas seulement de variante_id) — voir RAPPORT.md.
  -- Nullable (pas de `not null`) : concept propre à gen1, sans équivalent pour gen6/facteurCommun
  -- (dont la condition de saut équivalente — écran de factorisation intermédiaire — dépend de
  -- `categorie`, jamais de `forme_affichage`) ; les lignes gen6 laissent ce champ à `null`.
  forme_affichage text,
  date_creation timestamptz not null default now(),
  -- Ajouté pour "Tableau de bord élève" (Étape 1) : liste exacte des `reponses.champ` attendus
  -- POUR CET EXERCICE PRÉCIS, calculée et figée à la génération (voir lib/champsAttendus.ts,
  -- api/assignations.ts) — jamais recalculée depuis `variante_id` seul, qui ne suffit pas (Étape 1
  -- du prompt : formeAffichage/catégorie réelle de D/N ne sont connus qu'à la génération). Nullable :
  -- les lignes déjà existantes avant ce correctif n'ont pas cette liste ; un exercice sans
  -- `champs_attendus` est traité comme jamais complet (voir lib/tableauDeBord.ts).
  champs_attendus text[]
);

create table reponses (
  id uuid primary key default gen_random_uuid(),
  exercice_assigne_id uuid not null references exercices_assignes(id),
  champ text not null,           -- gen1 : 'isolement' | 'reconnaissance' | 'champ1' | 'champ2' ;
                                  -- gen6/facteurCommun : 'ce' | 'simplifierDenomReconnaissance' |
                                  -- 'simplifierDenomChamp1' | 'simplifierDenomChamp2' |
                                  -- 'simplifierDenomFactorisation' | 'simplifierNumReconnaissance' |
                                  -- 'simplifierNumChamp1' | 'simplifierNumChamp2' |
                                  -- 'simplifierNumFactorisation' | 'simplifierFraction' |
                                  -- 'grille' | 'intervalle' (Priorité 1, remédiation spec-gen6 :
                                  -- écrans manquants ajoutés en fin de séquence facteurCommun — ces
                                  -- 2 valeurs de `champ` existaient déjà pour niveau1/2/3/4/
                                  -- denominateurCarre/sansFacteurCommun/cubique, jamais nouvelles
                                  -- au niveau colonne, `champ` restant un simple `text` sans enum SQL)
  valeur_saisie text not null,   -- valeurs de paire (racines, ou numérateur/dénominateur de
                                  -- simplifierFraction) encodées "valeur1;valeur2" — voir RAPPORT.md
  statut text not null,          -- 'correct' | 'not_equivalent' | 'parse_error'
  bug_detecte text,              -- nullable : gen1 'C04'|'C05_SIGNE_REPETE'|'C06_SIGNE_OPPOSE'|
                                  -- 'C07_ou_C08' ; gen6 'FC_CE_FANTOME' |
                                  -- 'FC_PRODUIT_NUL_OUBLIE' | 'FC_RACINE_OPPOSEE_OUBLIEE' |
                                  -- 'FC_RACINE_FANTOME' | 'RECOPIE_NON_REDUITE' | null
  indice_utilise boolean not null default false,
  horodatage timestamptz not null default now(),
  -- Correctif "Chrono de réponse" (révision "horodatage de départ côté serveur") : mesure passive,
  -- systématique (indépendante de chrono_mode) — calculée CÔTÉ SERVEUR à la soumission, à partir de
  -- `debuts_ecran.horodatage_debut` (jamais une valeur envoyée par le client, falsifiable via la
  -- console développeur). Nullable : `null` si `debuts_ecran` n'a aucune ligne pour ce champ au
  -- moment de la soumission (signal `POST /api/reponses/debut-ecran` jamais reçu). Purement
  -- informatif ici (jamais utilisé pour la notation) — `chronoExpire` (lib/moteurTentatives.ts)
  -- est dérivé indépendamment, directement depuis `debuts_ecran`, jamais depuis cette colonne.
  duree_ecoulee_secondes int
);

-- Correctif "Chrono de réponse" (révision "horodatage de départ côté serveur") : horodatage de
-- départ D'ÉCRAN, écrit UNE SEULE FOIS par (exercice_assigne_id, champ) — jamais mis à jour ensuite
-- (toute insertion utilise `on conflict do nothing`, lib/routes/reponses-debut-ecran.ts) : la
-- première écriture gagne, une réouverture d'écran/un rechargement de page n'écrase jamais
-- l'horodatage déjà enregistré. Seule source de vérité du temps pour dériver `chronoExpire` et
-- `reponses.duree_ecoulee_secondes` — le client n'envoie plus jamais de valeur temporelle.
create table debuts_ecran (
  exercice_assigne_id uuid not null references exercices_assignes(id),
  champ text not null,
  horodatage_debut timestamptz not null default now(),
  primary key (exercice_assigne_id, champ)
);

-- Prompt "Inscription professeur (par invitation)", Étape 2 — codes d'invitation à usage unique,
-- insérés directement par le prof actuel via Supabase Table Editor (Portée explicite : aucune
-- interface de création/gestion pour cette itération, pas d'écran dédié).
create table invitations_prof (
  code text primary key,
  utilise boolean not null default false,
  cree_le timestamptz not null default now()
);
