import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);
const anon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);
const app = express();
app.use(cors(), express.json());
const up = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20e6, files: 5 },
});
const NOTES = { "A+": 18, A: 16, "B+": 15, B: 14, "C+": 12, C: 10, D: 8 };
const OK = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
];
const err = (s, m) => Object.assign(new Error(m), { status: s });
const ok = (r) => {
  if (r.error) throw err(400, r.error.message);
  return r.data;
};
const h = (f) => (req, res, next) =>
  Promise.resolve(f(req, res, next)).catch((e) =>
    res.status(e.status || 500).json({ error: e.message }),
  );
const auth = (role) =>
  h(async (req, res, next) => {
    const {
      data: { user },
    } = await sb.auth.getUser((req.headers.authorization || "").slice(7));
    if (!user) throw err(401, "Non authentifié");
    req.me = ok(
      await sb
        .from("profiles")
        .select("*, auditoire:auditoires(id,teacher_id)")
        .eq("id", user.id)
        .single(),
    );
    if (role && req.me.role !== role) throw err(403, "Accès refusé");
    next();
  });
const tid = (me) => (me.role === "teacher" ? me.id : me.auditoire.teacher_id); // enseignant "propriétaire" des données
const adm = auth("teacher");

// ---- Comptes
app.post(
  "/api/register",
  h(async (req, res) => {
    const b = req.body,
      teacher = b.role === "teacher";
    if (
      teacher &&
      (!process.env.TEACHER_CODE || b.teacherCode !== process.env.TEACHER_CODE)
    )
      throw err(403, "Code enseignant invalide");
    if (
      !b.email ||
      !b.password ||
      !b.nom ||
      !b.prenom ||
      (!teacher && !(b.num_inscription && b.auditoire_id && b.groupe_td_id))
    )
      throw err(400, "Champs manquants");
    const { data, error } = await sb.auth.admin.createUser({
      email: b.email,
      password: b.password,
      email_confirm: true,
    });
    if (error) throw err(400, error.message);
    const r = await sb
      .from("profiles")
      .insert({
        id: data.user.id,
        role: teacher ? "teacher" : "student",
        nom: b.nom,
        prenom: b.prenom,
        email: b.email,
        ...(teacher
          ? {}
          : {
              num_inscription: b.num_inscription,
              auditoire_id: b.auditoire_id,
              groupe_td_id: b.groupe_td_id,
            }),
      });
    if (r.error) {
      await sb.auth.admin.deleteUser(data.user.id);
      throw err(
        400,
        r.error.message.includes("num_inscription")
          ? "Numéro d'inscription déjà utilisé"
          : r.error.message,
      );
    }
    res.json({ ok: true });
  }),
);
app.post(
  "/api/login",
  h(async (req, res) => {
    const { data, error } = await anon.auth.signInWithPassword({
      email: req.body.email,
      password: req.body.password,
    });
    if (error) throw err(401, "Identifiants invalides");
    res.json({ token: data.session.access_token });
  }),
);
app.get(
  "/api/public/auditoires",
  h(async (req, res) =>
    res.json(
      ok(
        await sb
          .from("auditoires")
          .select("id,nom,groupes_td(id,nom)")
          .order("nom"),
      ),
    ),
  ),
);
app.get("/api/me", auth(), (req, res) => res.json(req.me));
app.get(
  "/api/structure",
  auth(),
  h(async (req, res) =>
    res.json(
      ok(
        await sb
          .from("modules")
          .select(
            "id,nom,ordre,themes(id,nom,ordre,activities(id,titre,description,echeance))",
          )
          .eq("teacher_id", tid(req.me))
          .order("ordre"),
      ),
    ),
  ),
);

// ---- Équipes
const myTeam = async (id) => {
  const m = (
    await sb
      .from("team_members")
      .select("team_id")
      .eq("student_id", id)
      .maybeSingle()
  ).data;
  if (!m) return null;
  return ok(
    await sb
      .from("teams")
      .select(
        "id,nom,chef_id,auditoire:auditoires(nom),team_members(student:profiles(id,nom,prenom,num_inscription))",
      )
      .eq("id", m.team_id)
      .single(),
  );
};
const chef = h(async (req, res, next) => {
  const t = await myTeam(req.me.id);
  if (!t || t.chef_id !== req.me.id) throw err(403, "Réservé au chef d'équipe");
  req.team = t;
  next();
});
app.get(
  "/api/team",
  auth("student"),
  h(async (req, res) => res.json(await myTeam(req.me.id))),
);
app.post(
  "/api/team",
  auth("student"),
  h(async (req, res) => {
    if (await myTeam(req.me.id))
      throw err(400, "Vous êtes déjà dans une équipe");
    const nom = (req.body.nom || "").trim();
    if (!nom) throw err(400, "Nom d'équipe requis");
    const r = await sb
      .from("teams")
      .insert({ nom, chef_id: req.me.id, auditoire_id: req.me.auditoire_id })
      .select()
      .single();
    if (r.error)
      throw err(
        400,
        r.error.code === "23505"
          ? "Ce nom d’équipe existe déjà"
          : r.error.message,
      );
    const t = r.data;
    ok(
      await sb
        .from("team_members")
        .insert({ student_id: req.me.id, team_id: t.id }),
    );
    res.json(await myTeam(req.me.id));
  }),
);
app.get(
  "/api/team/candidates",
  auth("student"),
  h(async (req, res) => {
    const taken = new Set(
        ok(await sb.from("team_members").select("student_id")).map(
          (x) => x.student_id,
        ),
      ),
      q = (req.query.q || "").toLowerCase();
    res.json(
      ok(
        await sb
          .from("profiles")
          .select("id,nom,prenom,num_inscription")
          .eq("role", "student")
          .eq("auditoire_id", req.me.auditoire_id),
      )
        .filter(
          (s) =>
            !taken.has(s.id) &&
            `${s.nom} ${s.prenom} ${s.num_inscription}`
              .toLowerCase()
              .includes(q),
        )
        .slice(0, 20),
    );
  }),
);
app.post(
  "/api/team/members",
  auth("student"),
  chef,
  h(async (req, res) => {
    const s = ok(
      await sb
        .from("profiles")
        .select("auditoire_id")
        .eq("id", req.body.student_id)
        .single(),
    );
    if (s.auditoire_id !== req.me.auditoire_id)
      throw err(400, "Étudiant hors de votre auditoire");
    const r = await sb
      .from("team_members")
      .insert({ student_id: req.body.student_id, team_id: req.team.id });
    if (r.error) throw err(400, "Cet étudiant est déjà dans une équipe");
    res.json(await myTeam(req.me.id));
  }),
);
app.delete(
  "/api/team/members/:id",
  auth("student"),
  chef,
  h(async (req, res) => {
    if (req.params.id === req.me.id)
      throw err(400, "Le chef ne peut pas se retirer");
    ok(
      await sb
        .from("team_members")
        .delete()
        .eq("student_id", req.params.id)
        .eq("team_id", req.team.id),
    );
    res.json(await myTeam(req.me.id));
  }),
);

// Équipes de MON auditoire (pour en rejoindre une) + inscription à une équipe existante
app.get(
  "/api/teams",
  auth("student"),
  h(async (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    res.json(
      ok(
        await sb
          .from("teams")
          .select(
            "id,nom,chef:profiles!chef_id(nom,prenom),team_members(student_id)",
          )
          .eq("auditoire_id", req.me.auditoire_id)
          .order("nom"),
      )
        .filter((t) => t.nom.toLowerCase().includes(q))
        .map((t) => ({
          id: t.id,
          nom: t.nom,
          chef: t.chef,
          membres: t.team_members.length,
        })),
    );
  }),
);
app.post(
  "/api/team/join",
  auth("student"),
  h(async (req, res) => {
    if (await myTeam(req.me.id))
      throw err(400, "Vous êtes déjà dans une équipe");
    const t = (
      await sb
        .from("teams")
        .select("id,auditoire_id")
        .eq("id", req.body.team_id)
        .maybeSingle()
    ).data;
    if (!t || t.auditoire_id !== req.me.auditoire_id)
      throw err(400, "Équipe introuvable dans votre auditoire");
    const r = await sb
      .from("team_members")
      .insert({ student_id: req.me.id, team_id: t.id });
    if (r.error) throw err(400, "Vous êtes déjà dans une équipe");
    res.json(await myTeam(req.me.id));
  }),
);
app.put(
  "/api/team",
  auth("student"),
  chef,
  h(async (req, res) => {
    const nom = (req.body.nom || "").trim();
    if (!nom) throw err(400, "Nom d'équipe requis");
    const r = await sb.from("teams").update({ nom }).eq("id", req.team.id);
    if (r.error)
      throw err(
        400,
        r.error.code === "23505"
          ? "Ce nom d’équipe existe déjà"
          : r.error.message,
      );
    res.json(await myTeam(req.me.id));
  }),
);
app.delete(
  "/api/team/leave",
  auth("student"),
  h(async (req, res) => {
    const t = await myTeam(req.me.id);
    if (!t) throw err(400, "Vous n'avez pas d'équipe");
    if (t.chef_id === req.me.id)
      throw err(400, "Le chef ne peut pas quitter : dissolvez l’équipe");
    ok(await sb.from("team_members").delete().eq("student_id", req.me.id));
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/team",
  auth("student"),
  chef,
  h(async (req, res) => {
    // dissolution possible seulement si aucun travail n'a été déposé
    const n = ok(
      await sb.from("submissions").select("id").eq("team_id", req.team.id),
    ).length;
    if (n) throw err(400, "Impossible : l'équipe a déjà déposé des travaux");
    ok(await sb.from("teams").delete().eq("id", req.team.id));
    res.json({ ok: true });
  }),
);

// ---- Travaux
const SEL =
  "*, activity:activities(id,titre,teacher_id,echeance,theme:themes(id,nom,module:modules(id,nom))), team:teams(id,nom,auditoire_id,team_members(student:profiles(id,nom,prenom))), author:profiles(id,nom,prenom,num_inscription,auditoire_id)";
const sign = async (rows) => {
  for (const r of rows)
    r.files = await Promise.all(
      (r.files || []).map(async (f) => ({
        ...f,
        url: (await sb.storage.from("travaux").createSignedUrl(f.path, 3600))
          .data?.signedUrl,
      })),
    );
  return rows;
};
const store = (files = [], me) =>
  Promise.all(
    files.map(async (f) => {
      const ext = f.originalname.split(".").pop().toLowerCase();
      if (!OK.includes(ext)) throw err(400, "Format non autorisé : " + ext);
      const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      ok(
        await sb.storage
          .from("travaux")
          .upload(path, f.buffer, { contentType: f.mimetype }),
      );
      return { name: f.originalname, path };
    }),
  );
const canEdit = async (me, s) => {
  // tous les membres de l'équipe ont les mêmes droits
  if (!s) throw err(404, "Introuvable");
  if (s.team_id) {
    if ((await myTeam(me.id))?.id === s.team_id) return;
  } else if (s.author_id === me.id) return;
  throw err(403, "Accès refusé");
};
const getSub = async (id) =>
  (await sb.from("submissions").select("*").eq("id", id).maybeSingle()).data;
app.get(
  "/api/submissions",
  auth("student"),
  h(async (req, res) => {
    const t = await myTeam(req.me.id);
    let q = sb
      .from("submissions")
      .select(SEL)
      .order("created_at", { ascending: false });
    q = t
      ? q.or(
          `team_id.eq.${t.id},and(team_id.is.null,author_id.eq.${req.me.id})`,
        )
      : q.eq("author_id", req.me.id).is("team_id", null);
    res.json(await sign(ok(await q)));
  }),
);
app.post(
  "/api/submissions",
  auth("student"),
  up.array("files"),
  h(async (req, res) => {
    const b = req.body,
      t = b.scope === "team" ? await myTeam(req.me.id) : null;
    if (b.scope === "team" && !t) throw err(400, "Vous n'avez pas d'équipe");
    ok(
      await sb
        .from("activities")
        .select("id")
        .eq("id", b.activity_id)
        .eq("teacher_id", tid(req.me))
        .single(),
    );
    const files = await store(req.files, req.me);
    if (!files.length && !b.link) throw err(400, "Fichier ou lien requis");
    res.json(
      ok(
        await sb
          .from("submissions")
          .insert({
            activity_id: b.activity_id,
            titre: b.titre,
            link: b.link || null,
            files,
            team_id: t?.id || null,
            author_id: req.me.id,
          })
          .select()
          .single(),
      ),
    );
  }),
);
app.put(
  "/api/submissions/:id",
  auth("student"),
  up.array("files"),
  h(async (req, res) => {
    const s = await getSub(req.params.id);
    await canEdit(req.me, s);
    const b = req.body;
    const files = [...s.files, ...(await store(req.files, req.me))];
    res.json(
      ok(
        await sb
          .from("submissions")
          .update({ titre: b.titre ?? s.titre, link: b.link ?? s.link, files })
          .eq("id", s.id)
          .select()
          .single(),
      ),
    );
  }),
);
app.delete(
  "/api/submissions/:id",
  auth("student"),
  h(async (req, res) => {
    const s = await getSub(req.params.id);
    await canEdit(req.me, s);
    if (s.files.length)
      await sb.storage.from("travaux").remove(s.files.map((f) => f.path));
    ok(await sb.from("submissions").delete().eq("id", s.id));
    res.json({ ok: true });
  }),
);
app.get(
  "/api/grades",
  auth("student"),
  h(async (req, res) =>
    res.json(
      ok(await sb.from("grades").select("*").eq("student_id", req.me.id)),
    ),
  ),
);

// ---- Enseignant : configuration (CRUD générique, chaque enseignant ne voit que ses données)
const T = {
  filieres: 1,
  auditoires: 1,
  groupes_td: 1,
  modules: 1,
  themes: 1,
  activities: 1,
};
const chk = h((req, res, next) =>
  T[req.params.t] ? next() : res.status(404).json({ error: "Table inconnue" }),
);
const clean = ({ id, teacher_id, ...b }) =>
  "echeance" in b ? { ...b, echeance: b.echeance || null } : b;
app.get(
  "/api/admin/:t",
  adm,
  chk,
  h(async (req, res) =>
    res.json(
      ok(await sb.from(req.params.t).select("*").eq("teacher_id", req.me.id)),
    ),
  ),
);
app.post(
  "/api/admin/:t",
  adm,
  chk,
  h(async (req, res) =>
    res.json(
      ok(
        await sb
          .from(req.params.t)
          .insert({ ...clean(req.body), teacher_id: req.me.id })
          .select()
          .single(),
      ),
    ),
  ),
);
app.put(
  "/api/admin/:t/:id",
  adm,
  chk,
  h(async (req, res) =>
    res.json(
      ok(
        await sb
          .from(req.params.t)
          .update(clean(req.body))
          .eq("id", req.params.id)
          .eq("teacher_id", req.me.id)
          .select()
          .single(),
      ),
    ),
  ),
);
app.delete(
  "/api/admin/:t/:id",
  adm,
  chk,
  h(async (req, res) => {
    ok(
      await sb
        .from(req.params.t)
        .delete()
        .eq("id", req.params.id)
        .eq("teacher_id", req.me.id),
    );
    res.json({ ok: true });
  }),
);

// ---- Enseignant : consultation et notation
app.get(
  "/api/t/submissions",
  adm,
  h(async (req, res) => {
    const {
        activity_id,
        theme_id,
        module_id,
        auditoire_id,
        student_id,
        q = "",
      } = req.query,
      s = q.toLowerCase();
    let x = sb
      .from("submissions")
      .select(SEL)
      .order("created_at", { ascending: false });
    if (activity_id) x = x.eq("activity_id", activity_id);
    const rows = ok(await x).filter(
      (r) =>
        r.activity.teacher_id === req.me.id &&
        (!theme_id || r.activity.theme.id === theme_id) &&
        (!module_id || r.activity.theme.module.id === module_id) &&
        (!auditoire_id ||
          (r.team?.auditoire_id || r.author.auditoire_id) === auditoire_id) &&
        (!student_id ||
          (r.team
            ? r.team.team_members.some((m) => m.student.id === student_id)
            : r.author.id === student_id)) &&
        (!s ||
          JSON.stringify([
            r.titre,
            r.activity.titre,
            r.team?.nom,
            r.author,
            r.team?.team_members,
          ])
            .toLowerCase()
            .includes(s)),
    );
    res.json(await sign(rows));
  }),
);
app.get(
  "/api/t/students",
  adm,
  h(async (req, res) => {
    const aud = ok(
        await sb.from("auditoires").select("id").eq("teacher_id", req.me.id),
      ).map((a) => a.id),
      s = (req.query.q || "").toLowerCase();
    let q = sb
      .from("profiles")
      .select(
        "id,nom,prenom,num_inscription,auditoire_id,team_members(team:teams(id,nom))",
      )
      .eq("role", "student")
      .in("auditoire_id", aud);
    if (req.query.auditoire_id)
      q = q.eq("auditoire_id", req.query.auditoire_id);
    res.json(
      ok(await q.order("nom")).filter((x) =>
        `${x.nom} ${x.prenom} ${x.num_inscription}`.toLowerCase().includes(s),
      ),
    );
  }),
);
app.get(
  "/api/t/grades",
  adm,
  h(async (req, res) =>
    res.json(
      ok(
        await sb
          .from("grades")
          .select("*, modules!inner(teacher_id)")
          .eq("modules.teacher_id", req.me.id),
      ),
    ),
  ),
);
app.put(
  "/api/t/grades",
  adm,
  h(async (req, res) => {
    // même note pour toute l'équipe par défaut ; modifiable par étudiant
    const { student_ids, activity_id, note } = req.body,
      valeur = NOTES[note];
    if (valeur == null) throw err(400, "Note invalide");
    if (!activity_id || !student_ids?.length)
      throw err(400, "Activité et étudiants requis");
    const module_id = ok(
      await sb
        .from("activities")
        .select("id,theme:themes(module_id)")
        .eq("id", activity_id)
        .eq("teacher_id", req.me.id)
        .single(),
    ).theme.module_id; // la note du module est calculée, jamais saisie
    for (const s of student_ids) {
      let d = sb
        .from("grades")
        .delete()
        .eq("student_id", s)
        .eq("module_id", module_id);
      d = activity_id
        ? d.eq("activity_id", activity_id)
        : d.is("activity_id", null);
      ok(await d);
    }
    ok(
      await sb
        .from("grades")
        .insert(
          student_ids.map((s) => ({
            student_id: s,
            module_id,
            activity_id,
            note,
            valeur,
          })),
        ),
    );
    res.json({ ok: true });
  }),
);
// ---- Enseignant : initialisation du plan de cours (2 modules, 8 thèmes)
const PLAN = [
  [
    "Module 1 : Étudier à l’université",
    [
      "Intégration universitaire",
      "Gestion du temps et organisation",
      "Recherche d’information",
      "Autonomie dans l’apprentissage",
    ],
  ],
  [
    "Module 2 : Apprendre à apprendre",
    [
      "Pensée critique",
      "Résolution de problèmes",
      "Autoévaluation",
      "Prise d’initiative",
    ],
  ],
];
app.post(
  "/api/t/seed",
  adm,
  h(async (req, res) => {
    if (
      ok(await sb.from("modules").select("id").eq("teacher_id", req.me.id))
        .length
    )
      throw err(400, "Des modules existent déjà");
    for (const [i, [nom, ths]] of PLAN.entries()) {
      const m = ok(
        await sb
          .from("modules")
          .insert({ teacher_id: req.me.id, nom, ordre: i + 1 })
          .select()
          .single(),
      );
      ok(
        await sb
          .from("themes")
          .insert(
            ths.map((n, j) => ({
              teacher_id: req.me.id,
              module_id: m.id,
              nom: n,
              ordre: j + 1,
            })),
          ),
      );
    }
    res.json({ ok: true });
  }),
);
// ---- Production : sert le client compilé (client/dist)
const dist = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/dist",
);
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.listen(process.env.PORT || 4000, () => console.log("API prête"));
