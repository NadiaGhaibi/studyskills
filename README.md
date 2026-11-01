# Study Skills – plateforme de dépôt et de notation (MERN + Supabase)

Stack : React (Vite) · Node/Express · Supabase (PostgreSQL + Auth + Storage). Pas de MongoDB : Supabase le remplace (M→S).

## Installation
1. Créer un projet sur supabase.com, ouvrir **SQL Editor**, coller et exécuter `schema.sql` (tables + bucket privé `travaux`).
2. `cp server/.env.example server/.env` puis renseigner `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (Project Settings > API) et `TEACHER_CODE` (code secret pour créer des comptes enseignants).
3. `npm run install:all`
4. Développement : deux terminaux → `npm run dev:server` (port 4000) et `npm run dev:client` (port 5173, proxy vers l'API).
5. Production : `npm run build` puis `npm start` (le serveur sert aussi le client compilé).

## Premier démarrage
1. Page d'accueil > onglet **Inscription enseignant** : nom, prénom, email, mot de passe et **code enseignant** (`TEACHER_CODE`). Les étudiants utilisent l'onglet **Inscription étudiant**.
2. Onglet **Configuration** : bouton « Créer automatiquement les 2 modules et 8 thèmes », puis créer filière(s), auditoire(s), groupes de TD et activités.
3. Les étudiants s'inscrivent (auditoire et groupe de TD proposés dans des listes), créent leur équipe (le créateur est chef), déposent leurs travaux.

## Règles implémentées
- Un étudiant ne peut appartenir qu'à une équipe (clé primaire sur `team_members.student_id`) ; seul le chef ajoute/retire des membres de son auditoire.
- Tous les membres d'une équipe peuvent voir, modifier (titre, lien, fichiers) et supprimer les travaux d'équipe.
- Formats : pdf, doc, docx, ppt, pptx, images (20 Mo max, 5 fichiers par dépôt) ou lien.
- Notes : A+ 18, A 16, B+ 15, B 14, C+ 12, C 10, D 8 ; l'enseignant note chaque activité ; la note d'un travail d'équipe est appliquée à tous les membres, puis modifiable étudiant par étudiant dans son portfolio (onglet « Étudiants & notes »). La note d'un module est calculée automatiquement : moyenne sur 20 des notes d'activités de l'étudiant.
- Multi-enseignants : chaque enseignant ne gère et ne voit que ses propres filières, auditoires, groupes, modules, thèmes, activités et travaux. Un étudiant est rattaché à l'enseignant de son auditoire.
- Les fichiers sont stockés dans un bucket privé ; liens signés valables 1 h.