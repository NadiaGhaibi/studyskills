import { useState } from "react";
import {
  api,
  useApi,
  Files,
  Grouped,
  moyenne,
  fmt,
  Delai,
} from "../common.jsx";

export default function Works() {
  const [rows, load] = useApi("/submissions"),
    [gr] = useApi("/grades"),
    [st] = useApi("/structure"),
    [f, setF] = useState({ scope: "", module: "" });
  if (!rows || !gr || !st) return <p>Chargement…</p>;
  const edit = (r, fd) =>
    api("/submissions/" + r.id, { method: "PUT", form: fd })
      .then(load)
      .catch((e) => alert(e.message));
  const rename = (r) => {
    const v = prompt("Nouveau titre", r.titre);
    if (!v) return;
    const fd = new FormData();
    fd.append("titre", v);
    edit(r, fd);
  };
  const setLink = (r) => {
    const v = prompt(
      "Lien (https://…) — laisser vide pour le retirer",
      r.link || "",
    );
    if (v === null) return;
    const fd = new FormData();
    fd.append("link", v);
    edit(r, fd);
  };
  const addFiles = (r, files) => {
    const fd = new FormData();
    [...files].forEach((x) => fd.append("files", x));
    edit(r, fd);
  };
  const del = (r) =>
    confirm(
      `Supprimer « ${r.titre} » ?${r.team ? " Tous les membres de l'équipe n'y auront plus accès." : ""}`,
    ) &&
    api("/submissions/" + r.id, { method: "DELETE" })
      .then(load)
      .catch((e) => alert(e.message));
  const shown = rows.filter(
    (r) =>
      (!f.scope || (f.scope === "team") === !!r.team) &&
      (!f.module || r.activity.theme.module.id === f.module),
  );
  const note = (id, act) =>
    gr.find(
      (g) =>
        g.module_id === id && (act ? g.activity_id === act : !g.activity_id),
    )?.note;
  return (
    <>
      <div className="card">
        <h3>Notes des modules</h3>
        <p>
          <small>Moyenne de vos notes d'activités, sur 20.</small>
        </p>
        {st.map((m) => (
          <p key={m.id}>
            {m.nom} : <b>{fmt(moyenne(gr, null, m.id))}</b>
          </p>
        ))}
      </div>
      <div className="card">
        Portfolio :{" "}
        <select
          value={f.scope}
          onChange={(e) => setF({ ...f, scope: e.target.value })}
        >
          <option value="">Individuel + équipe</option>
          <option value="individual">Individuels</option>
          <option value="team">Équipe</option>
        </select>
        <select
          value={f.module}
          onChange={(e) => setF({ ...f, module: e.target.value })}
        >
          <option value="">Tous les modules</option>
          {st.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>{" "}
        <small>{shown.length} travail(aux)</small>
      </div>
      {!shown.length && <div className="card">Aucun travail déposé.</div>}
      <Grouped
        rows={shown}
        render={(r) => (
          <div className="card" key={r.id}>
            <b>{r.titre}</b>{" "}
            <small>
              — {r.activity.titre} ·{" "}
              {r.team ? "équipe " + r.team.nom : "individuel"} · par{" "}
              {r.author.prenom} {r.author.nom}
            </small>
            <br />
            <Delai r={r} />
            <br />
            <Files r={r} /> <br />
            Note de l'activité :{" "}
            <b>{note(r.activity.theme.module.id, r.activity.id) || "—"}</b>
            <br />
            <button onClick={() => rename(r)}>Renommer</button>
            <button onClick={() => setLink(r)}>Lien</button>
            <label>
              <span className="btn">+ Fichiers</span>
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(r, e.target.files)}
              />
            </label>
            <button className="danger" onClick={() => del(r)}>
              Supprimer
            </button>
          </div>
        )}
      />
    </>
  );
}
