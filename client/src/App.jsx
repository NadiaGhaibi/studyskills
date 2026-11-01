import { useState, useEffect, useCallback } from "react";
import {
  NOTES,
  api,
  useApi,
  Files,
  Grouped,
  Tabs,
  moyenne,
  fmt,
  Delai,
  toLocal,
} from "./common.jsx";
import StudentSpace from "./student/StudentSpace.jsx";
import Home from "./Home.jsx";
import { AnnoncesTeacher } from "./Annonces.jsx";
/* ---------- Enseignant ---------- */
const CFG = {
  filieres: ["nom"],
  auditoires: ["nom", ["filiere_id", "filieres"]],
  groupes_td: ["nom", ["auditoire_id", "auditoires"]],
  modules: ["nom", "ordre"],
  themes: ["nom", "ordre", ["module_id", "modules"]],
  activities: ["titre", "description", "echeance", ["theme_id", "themes"]],
};
function Crud({ t }) {
  const [rows, load] = useApi("/admin/" + t),
    [f, setF] = useState({}),
    [o, setO] = useState({});
  useEffect(() => {
    CFG[t]
      .filter(Array.isArray)
      .forEach(([, tb]) =>
        api("/admin/" + tb).then((d) => setO((x) => ({ ...x, [tb]: d }))),
      );
  }, [t]);
  const lab = (r) => r.nom || r.titre,
    first = CFG[t][0];
  const add = async (e) => {
    e.preventDefault();
    try {
      await api("/admin/" + t, {
        method: "POST",
        body:
          t === "activities"
            ? {
                ...f,
                echeance: f.echeance
                  ? new Date(f.echeance).toISOString()
                  : null,
              }
            : f,
      });
      setF({});
      load();
    } catch (x) {
      alert(x.message);
    }
  };
  return (
    <div className="card">
      <h3>{t.replace("_", " ")}</h3>
      <form onSubmit={add}>
        {CFG[t].map((k) =>
          k === "echeance" ? (
            <label key={k}>
              <small>Échéance</small>{" "}
              <input
                type="datetime-local"
                value={f.echeance || ""}
                onChange={(e) => setF({ ...f, echeance: e.target.value })}
              />
            </label>
          ) : Array.isArray(k) ? (
            <select
              key={k[0]}
              required={k[0] !== "filiere_id"}
              value={f[k[0]] || ""}
              onChange={(e) => setF({ ...f, [k[0]]: e.target.value })}
            >
              <option value="">{k[1]}…</option>
              {o[k[1]]?.map((r) => (
                <option key={r.id} value={r.id}>
                  {lab(r)}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={k}
              placeholder={k}
              required={k === first}
              value={f[k] || ""}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          ),
        )}
        <button className="primary">Ajouter</button>
      </form>
      {rows?.map((r) => (
        <p key={r.id}>
          {lab(r)}{" "}
          {t === "activities" && (
            <input
              type="datetime-local"
              title="Échéance"
              value={toLocal(r.echeance)}
              onChange={(e) =>
                api(`/admin/activities/${r.id}`, {
                  method: "PUT",
                  body: {
                    echeance: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  },
                })
                  .then(load)
                  .catch((x) => alert(x.message))
              }
            />
          )}{" "}
          <button
            onClick={() => {
              const v = prompt("Modifier", r[first]);
              v &&
                api(`/admin/${t}/${r.id}`, {
                  method: "PUT",
                  body: { [first]: v },
                }).then(load);
            }}
          >
            ✎
          </button>
          <button
            className="danger"
            onClick={() =>
              confirm("Supprimer (et tout ce qui en dépend) ?") &&
              api(`/admin/${t}/${r.id}`, { method: "DELETE" })
                .then(load)
                .catch((e) => alert(e.message))
            }
          >
            ✕
          </button>
        </p>
      ))}
    </div>
  );
}
function TWorks({ studentId, onGraded }) {
  const [st] = useApi("/structure"),
    [aud] = useApi("/admin/auditoires"),
    [gr, loadG] = useApi("/t/grades"),
    [f, setF] = useState({}),
    set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const qs = new URLSearchParams({
      ...f,
      ...(studentId ? { student_id: studentId } : {}),
    }).toString(),
    [rows] = useApi("/t/submissions?" + qs);
  const mod = st?.find((m) => m.id === f.module_id),
    th = mod?.themes.find((t) => t.id === f.theme_id);
  const grade = (r, note) =>
    api("/t/grades", {
      method: "PUT",
      body: {
        note,
        module_id: r.activity.theme.module.id,
        activity_id: r.activity.id,
        student_ids: studentId
          ? [studentId]
          : r.team
            ? r.team.team_members.map((m) => m.student.id)
            : [r.author.id],
      },
    })
      .then(() => {
        loadG();
        onGraded?.();
      })
      .catch((e) => alert(e.message));
  return (
    <div>
      {!studentId && (
        <div className="card">
          <select value={f.auditoire_id || ""} onChange={set("auditoire_id")}>
            <option value="">Tous les auditoires</option>
            {aud?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
          <select
            value={f.module_id || ""}
            onChange={(e) =>
              setF({
                ...f,
                module_id: e.target.value,
                theme_id: "",
                activity_id: "",
              })
            }
          >
            <option value="">Module…</option>
            {st?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
          <select
            value={f.theme_id || ""}
            onChange={(e) =>
              setF({ ...f, theme_id: e.target.value, activity_id: "" })
            }
          >
            <option value="">Thème…</option>
            {mod?.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
          <select value={f.activity_id || ""} onChange={set("activity_id")}>
            <option value="">Activité…</option>
            {th?.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titre}
              </option>
            ))}
          </select>
          <input
            placeholder="Chercher étudiant / équipe / activité"
            onChange={set("q")}
          />
        </div>
      )}
      {!rows ? (
        "…"
      ) : (
        <Grouped
          rows={rows}
          render={(r) => {
            const sid =
                studentId ||
                (r.team ? r.team.team_members[0]?.student.id : r.author.id),
              cur =
                gr?.find(
                  (g) =>
                    g.student_id === sid && g.activity_id === r.activity.id,
                )?.note || "";
            return (
              <div className="card" key={r.id}>
                <b>{r.titre}</b> <small>({r.activity.titre})</small>
                <br />
                <Delai r={r} />
                <br />
                {r.team ? (
                  <>
                    Équipe <b>{r.team.nom}</b> :{" "}
                    {r.team.team_members
                      .map((m) => `${m.student.prenom} ${m.student.nom}`)
                      .join(", ")}
                  </>
                ) : (
                  <>
                    Individuel : {r.author.prenom} {r.author.nom}
                  </>
                )}
                <br />
                <Files r={r} /> Note :{" "}
                <select value={cur} onChange={(e) => grade(r, e.target.value)}>
                  <option value="">—</option>
                  {NOTES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
function Students() {
  const [aud] = useApi("/admin/auditoires"),
    [mods] = useApi("/admin/modules"),
    [f, setF] = useState({}),
    [sel, setSel] = useState(),
    [gr, loadG] = useApi("/t/grades");
  const [rows] = useApi("/t/students?" + new URLSearchParams(f));
  if (sel)
    return (
      <>
        <button onClick={() => setSel()}>← Retour</button>
        <h3>
          Portfolio de {sel.prenom} {sel.nom}
        </h3>
        <p>
          {mods?.map((m) => (
            <span key={m.id}>
              {m.nom.split(":")[0]} :{" "}
              <b>{fmt(moyenne(gr || [], sel.id, m.id))}</b> ·{" "}
            </span>
          ))}
        </p>
        <p>
          <small>
            Dans cette vue, une note modifiée ne concerne que cet étudiant.
          </small>
        </p>
        <TWorks studentId={sel.id} onGraded={loadG} />
      </>
    );
  return (
    <div>
      <div className="card">
        <select onChange={(e) => setF({ ...f, auditoire_id: e.target.value })}>
          <option value="">Tous les auditoires</option>
          {aud?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
        <input
          placeholder="Chercher un étudiant"
          onChange={(e) => setF({ ...f, q: e.target.value })}
        />
      </div>
      {rows?.map((s) => (
        <div className="card" key={s.id}>
          <b>
            {s.nom} {s.prenom}
          </b>{" "}
          <small>
            {s.num_inscription} ·{" "}
            {[].concat(s.team_members || [])[0]?.team?.nom || "sans équipe"}
          </small>{" "}
          <button onClick={() => setSel(s)}>Portfolio</button>
          {mods?.map((m) => (
            <span key={m.id}>
              {" "}
              · {m.nom.split(":")[0]} :{" "}
              <b>{fmt(moyenne(gr || [], s.id, m.id))}</b>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
function Teacher() {
  const [tab, setTab] = useState("w");
  return (
    <>
      <Tabs
        tab={tab}
        set={setTab}
        tabs={[
          ["w", "Travaux"],
          ["s", "Étudiants & notes"],
          ["a", "Annonces"],
          ["c", "Configuration"],
        ]}
      />
      {tab === "w" && <TWorks />}
      {tab === "s" && <Students />}
      {tab === "a" && <AnnoncesTeacher />}
      {tab === "c" && (
        <>
          <div className="card">
            <button
              className="primary"
              onClick={() =>
                api("/t/seed", { method: "POST" })
                  .then(() => location.reload())
                  .catch((e) => alert(e.message))
              }
            >
              Créer automatiquement les 2 modules et 8 thèmes « Study Skills »
            </button>
          </div>
          {Object.keys(CFG).map((t) => (
            <Crud key={t} t={t} />
          ))}
        </>
      )}
    </>
  );
}

export default function App() {
  const [me, setMe] = useState();
  const init = () =>
    api("/me")
      .then(setMe)
      .catch(() => {
        localStorage.removeItem("t");
        setMe(null);
      });
  useEffect(() => {
    init();
  }, []);
  if (me === undefined) return "…";
  if (!me) return <Home onOk={init} />;
  return (
    <>
      <header>
        <div className="brand">
          <img
            className="logo"
            src="/logo-isg.png"
            alt="Université de Gabès – Institut Supérieur de Gestion de Gabès"
          />
          <h2>Study Skills</h2>
        </div>
        <span>
          {me.prenom} {me.nom}{" "}
          <button
            onClick={() => {
              localStorage.removeItem("t");
              setMe(null);
            }}
          >
            Déconnexion
          </button>
        </span>
      </header>
      {me.role === "teacher" ? <Teacher /> : <StudentSpace me={me} />}
    </>
  );
}
