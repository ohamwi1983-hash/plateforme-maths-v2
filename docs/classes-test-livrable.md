# Classes de test du compte administrateur — livrable

Détail, citations `fichier:ligne` et décisions : `RAPPORT.md` §61. Conception validée avant le « Go » (D1 à D6 telles que recommandées).

## Ce que l'admin peut faire

Onglet **Admin → Classes de test** : créer une classe de test, y ajouter N élèves de test (1 à 40, noms réservés `Élève 01 · Test-xxxx`, **un mot de passe commun affiché une seule fois**), les voir dans « Mes classes » avec le badge **TEST**, leur assigner des tâches comme à une vraie classe, répondre en tant qu'eux (connexion par nom + mot de passe), consulter les résultats normalement, puis **supprimer la classe en cascade** (confirmation en deux temps, irréversible).

**Régénérer le mot de passe commun** (RAPPORT §64) : si le mot de passe affiché à la création est perdu (rechargement de page, reconnexion), le bouton « Régénérer le mot de passe commun » de la classe pose un nouveau mot de passe sur tous ses élèves de test et l'affiche une seule fois ; l'ancien cesse de fonctionner.

## Checklist de suppression (lue dans le schéma réel)

`reponses`, `debuts_ecran`, `aides_utilisees` → `exercices_assignes` → `taches_assignations_eleves` → `taches_assignations` → `inscriptions` → `eleves` → **comptes Supabase Auth** → `classes`. Les tâches (`taches`, `taches_composition`) sont conservées : une tâche qui n'était assignée qu'à la classe de test redevient modifiable et supprimable. Refus avant toute suppression : classe non marquée test (404), élève inscrit ailleurs (409).

## Visibilité entre professeurs

Aucun autre professeur ne voit une classe de test (toutes les vues sont limitées au `prof_id`). **Fuite corrigée, non prévue par le prompt** : `tousLesEleves` lit toute la plateforme ; un élève de test homonyme aurait fait afficher « (2) » une vraie élève créée plus tard, pour toujours. Les élèves de test sont désormais ignorés pour ce calcul, mais restent candidats de la connexion.

## Gardes ajoutées

Une classe de test n'a jamais de code d'inscription ; l'auto-inscription par code et tout transfert depuis ou vers une classe de test sont refusés (un vrai élève qui y entrerait serait supprimé avec elle). `POST /api/classes` ne peut pas créer de classe de test.

## À faire avant le déploiement

**Exécuter `supabase/migrations/cumulatif.sql`** (ajoute `classes.est_test`, idempotent). Sans cela, la liste des classes et la création d'élèves échouent avec le détail PostgREST.

## Vérifications

`test-classe-test-cascade` (couverture du schéma relue, oracle sur toutes les tables, mutation de chacune des 10 étapes — retirer `aides_utilisees` est détecté), `test-route-classes-test` (vrai routeur, scénario complet, coexistence avec une vraie classe, instantané du reste identique), Chromium `scenarioClassesTest` (390 et 1280 px), suite complète sur export propre.
