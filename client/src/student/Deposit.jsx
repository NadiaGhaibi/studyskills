import { useState } from "react";
import { api, useApi, fmtDate } from "../common.jsx";

export default function Deposit({ onDone }) {
  const [st] = useApi("/structure"),
    [team] = useApi("/team");
  const [f, setF] = useState({ scope: "individual" }),
    [files, setFiles] = useState([]),
    [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const theme = st?.flatMap((m) => m.themes).find((t) => t.id === f.theme_id),
    activity = theme?.activities.find((a) => a.id === f.activity_id);
  const send = async (e) => {
    e.preventDefault();
    if (!files.length && !f.link)
      return alert("Ajoutez au moins un fichier ou un lien");
    if (files.reduce((a, x) => a + x.size, 0) > 4.2e6)
      return alert(
        "Taille totale limitée à 4 Mo par dépôt : compressez vos fichiers ou déposez-les en plusieurs fois.",
      );
    if (f.link && !/^https?:\/\//i.test(f.link))
      return alert("Le lien doit commencer par http:// ou https://");
    const fd = new FormData();
    ["activity_id", "titre", "scope", "link"].forEach(
      (k) => f[k] && fd.append(k, f[k]),
    );
    files.forEach((x) => fd.append("files", x));
    setBusy(true);
    try {
      await api("/submissions", { method: "POST", form: fd });
      onDone();
    } catch (x) {
      alert(x.message);
    }
    setBusy(false);
  };
  if (!st || team === undefined) return <p>Chargement…</p>;
  if (!st.length)
    return (
      <div className="card">
        Votre enseignant n'a pas encore défini les modules et activités.
      </div>
    );
  return (
    <form className="card" onSubmit={send}>
      <h3>Déposer un travail</h3>
      <select value={f.scope} onChange={set("scope")}>
        <option value="individual">Travail individuel</option>
        <option value="team" disabled={!team}>
          Travail d'équipe
          {team ? ` (${team.nom})` : " — créez ou rejoignez une équipe"}
        </option>
      </select>
      <br />
      <select
        required
        value={f.theme_id || ""}
        onChange={(e) =>
          setF({ ...f, theme_id: e.target.value, activity_id: "" })
        }
      >
        <option value="">Thème…</option>
        {st.map((m) => (
          <optgroup key={m.id} label={m.nom}>
            {m.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        required
        value={f.activity_id || ""}
        onChange={set("activity_id")}
        disabled={!theme}
      >
        <option value="">Activité…</option>
        {theme?.activities.map((a) => (
          <option key={a.id} value={a.id}>
            {a.titre}
          </option>
        ))}
      </select>
      {activity?.description && (
        <p>
          <small>{activity.description}</small>
        </p>
      )}
      {activity?.echeance && (
        <p>
          <small>
            Échéance : <b>{fmtDate(activity.echeance)}</b>
          </small>{" "}
          {new Date() > new Date(activity.echeance) && (
            <span className="badge late">
              Échéance dépassée : votre dépôt sera marqué en retard
            </span>
          )}
        </p>
      )}
      <br />
      <input
        required
        style={{ width: "90%" }}
        placeholder="Titre du travail / de l'activité"
        value={f.titre || ""}
        onChange={set("titre")}
      />
      <p>
        Fichiers (pdf, word, ppt, pptx, images — 4 Mo au total, 5 fichiers max)
        :<br />
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
          onChange={(e) => setFiles([...e.target.files])}
        />
      </p>
      <input
        style={{ width: "90%" }}
        placeholder="et/ou un lien (https://…)"
        value={f.link || ""}
        onChange={set("link")}
      />
      <br />
      <button disabled={busy}>{busy ? "Envoi…" : "Déposer"}</button>
    </form>
  );
}
