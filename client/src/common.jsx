import { useState, useEffect, useCallback } from "react";
export const NOTES = ["A+", "A", "B+", "B", "C+", "C", "D"];
export const api = async (p, o = {}) => {
  const r = await fetch("/api" + p, {
    method: o.method || "GET",
    headers: {
      ...(localStorage.t ? { Authorization: "Bearer " + localStorage.t } : {}),
      ...(o.form ? {} : { "Content-Type": "application/json" }),
    },
    body: o.form || (o.body && JSON.stringify(o.body)),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && localStorage.t) {
    localStorage.removeItem("t");
    location.reload();
  }
  if (!r.ok) throw new Error(d.error || "Erreur");
  return d;
};
export const useApi = (p) => {
  const [d, s] = useState();
  const load = useCallback(
    () =>
      api(p)
        .then(s)
        .catch((e) => alert(e.message)),
    [p],
  );
  useEffect(() => {
    load();
  }, [load]);
  return [d, load];
};
export const Files = ({ r }) => (
  <>
    {r.files.map((f) => (
      <a key={f.path} href={f.url} target="_blank" rel="noreferrer">
        📎 {f.name}
      </a>
    ))}
    {r.link && (
      <a href={r.link} target="_blank" rel="noreferrer">
        🔗 lien
      </a>
    )}
  </>
);
export const Grouped = ({ rows, render }) => {
  // modules > thèmes
  const g = {};
  rows.forEach((r) => {
    const th = r.activity.theme,
      m = th.module;
    ((g[m.id] ??= { n: m.nom, t: {} }).t[th.id] ??= {
      n: th.nom,
      r: [],
    }).r.push(r);
  });
  return Object.entries(g).map(([id, m]) => (
    <section key={id}>
      <h2>{m.n}</h2>
      {Object.entries(m.t).map(([i, t]) => (
        <div key={i}>
          <h3>{t.n}</h3>
          {t.r.map(render)}
        </div>
      ))}
    </section>
  ));
};
export const Tabs = ({ tabs, tab, set }) => (
  <nav>
    {tabs.map(([k, l]) => (
      <button key={k} className={tab === k ? "on" : ""} onClick={() => set(k)}>
        {l}
      </button>
    ))}
  </nav>
);

// Note d'un module = moyenne (sur 20) des notes d'activités de l'étudiant (A+ 18, A 16, B+ 15, B 14, C+ 12, C 10, D 8)
export const moyenne = (grades, sid, mid) => {
  const v = grades
    .filter(
      (g) =>
        (!sid || g.student_id === sid) && g.module_id === mid && g.activity_id,
    )
    .map((g) => g.valeur);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
export const fmt = (n) => (n == null ? "—" : n.toFixed(2) + " / 20");

// Échéances : un travail est en retard s'il a été soumis après l'échéance de son activité
export const fmtDate = (d) =>
  new Date(d).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
export const toLocal = (d) =>
  d
    ? new Date(new Date(d) - new Date(d).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
export const isLate = (r) =>
  !!r.activity.echeance &&
  new Date(r.created_at) > new Date(r.activity.echeance);
export const Delai = ({ r }) => {
  const e = r.activity.echeance,
    late = isLate(r);
  return (
    <>
      <span>
        Soumis le <b>{fmtDate(r.created_at)}</b>
      </span>
      {e && <small> · échéance {fmtDate(e)}</small>}
      {e && (
        <span className={"badge " + (late ? "late" : "ok")}>
          {late ? "En retard" : "Dans les délais"}
        </span>
      )}
    </>
  );
};
