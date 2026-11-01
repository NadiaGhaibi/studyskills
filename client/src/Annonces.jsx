import { useState } from 'react';
import { api, useApi, fmtDate } from './common.jsx';

// Espace étudiant : annonces de son enseignant
export function AnnoncesList() {
  const [rows] = useApi('/annonces');
  if (!rows) return <p>Chargement…</p>;
  if (!rows.length) return <div className="card">Aucune annonce pour le moment.</div>;
  return rows.map(a => <div className="card annonce" key={a.id}><h3>{a.titre}</h3><small>Publiée le {fmtDate(a.created_at)}</small><p>{a.contenu}</p></div>);
}

// Espace enseignant : publier, modifier, supprimer
export function AnnoncesTeacher() {
  const [rows, load] = useApi('/admin/annonces'), [aud] = useApi('/admin/auditoires'), [f, setF] = useState({}), [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async e => {
    e.preventDefault(); setBusy(true);
    try { await api('/admin/annonces' + (f.id ? '/' + f.id : ''), { method: f.id ? 'PUT' : 'POST', body: { titre: f.titre, contenu: f.contenu, auditoire_id: f.auditoire_id || null } }); setF({}); load() }
    catch (x) { alert(x.message) } setBusy(false);
  };
  const del = a => confirm(`Supprimer l'annonce « ${a.titre} » ?`) && api('/admin/annonces/' + a.id, { method: 'DELETE' }).then(load).catch(e => alert(e.message));
  const cible = a => a.auditoire_id ? aud?.find(x => x.id === a.auditoire_id)?.nom || 'Auditoire' : 'Tous vos étudiants';
  return <>
    <form className="card" onSubmit={save}><h3>{f.id ? "Modifier l'annonce" : 'Nouvelle annonce'}</h3>
      <input style={{ width: '100%' }} placeholder="Titre" value={f.titre || ''} onChange={set('titre')} required />
      <textarea placeholder="Contenu de l'annonce" value={f.contenu || ''} onChange={set('contenu')} required />
      <select value={f.auditoire_id || ''} onChange={set('auditoire_id')}><option value="">Destinataires : tous mes étudiants</option>{aud?.map(a => <option key={a.id} value={a.id}>Auditoire : {a.nom}</option>)}</select><br />
      <button disabled={busy}>{f.id ? 'Enregistrer' : 'Publier'}</button>{f.id && <button type="button" onClick={() => setF({})}>Annuler</button>}</form>
    {rows && !rows.length && <div className="card">Aucune annonce publiée.</div>}
    {rows && [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(a => <div className="card annonce" key={a.id}><h3>{a.titre}</h3>
      <small>{fmtDate(a.created_at)} · {cible(a)}</small><p>{a.contenu}</p>
      <button onClick={() => { setF(a); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Modifier</button><button className="danger" onClick={() => del(a)}>Supprimer</button></div>)}
  </>;
}
