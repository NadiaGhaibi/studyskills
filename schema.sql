-- À exécuter dans Supabase > SQL Editor
create extension if not exists pgcrypto;
create table filieres(id uuid primary key default gen_random_uuid(), teacher_id uuid not null, nom text not null);
create table auditoires(id uuid primary key default gen_random_uuid(), teacher_id uuid not null, filiere_id uuid references filieres on delete set null, nom text not null);
create table groupes_td(id uuid primary key default gen_random_uuid(), teacher_id uuid not null, auditoire_id uuid not null references auditoires on delete cascade, nom text not null);
create table profiles(id uuid primary key references auth.users on delete cascade, role text not null check (role in ('student','teacher')), nom text, prenom text, email text, num_inscription text unique, auditoire_id uuid references auditoires on delete set null, groupe_td_id uuid references groupes_td on delete set null);
create table modules(id uuid primary key default gen_random_uuid(), teacher_id uuid not null, nom text not null, ordre int default 0);
create table themes(id uuid primary key default gen_random_uuid(), teacher_id uuid not null, module_id uuid not null references modules on delete cascade, nom text not null, ordre int default 0);
create table activities(id uuid primary key default gen_random_uuid(), teacher_id uuid not null, theme_id uuid not null references themes on delete cascade, titre text not null, description text);
create table teams(id uuid primary key default gen_random_uuid(), nom text not null, chef_id uuid not null references profiles, auditoire_id uuid references auditoires);
-- PK sur student_id : un étudiant ne peut être que dans UNE équipe
create table team_members(student_id uuid primary key references profiles on delete cascade, team_id uuid not null references teams on delete cascade);
create table submissions(id uuid primary key default gen_random_uuid(), activity_id uuid not null references activities on delete cascade, team_id uuid references teams on delete cascade, author_id uuid not null references profiles on delete cascade, titre text not null, link text, files jsonb default '[]', created_at timestamptz default now());
create table grades(id uuid primary key default gen_random_uuid(), student_id uuid not null references profiles on delete cascade, module_id uuid not null references modules on delete cascade, activity_id uuid references activities on delete cascade, note text not null, valeur int not null);
create unique index on grades(student_id, module_id, coalesce(activity_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index on submissions(activity_id); create index on submissions(team_id); create index on profiles(auditoire_id);
-- Accès uniquement via le serveur (clé service_role) : RLS activée sans policy
do $$ declare t text; begin foreach t in array array['filieres','auditoires','groupes_td','profiles','modules','themes','activities','teams','team_members','submissions','grades'] loop execute format('alter table %I enable row level security',t); end loop; end $$;
insert into storage.buckets(id,name,public) values('travaux','travaux',false) on conflict do nothing;
