import { useState } from 'react';
import { api, useApi, fmtDate, Files } from './common.jsx';

const MAX = 4.2e6; // Vercel refuse les requêtes au-delà d'environ 4,5 Mo
const isEdit = f => !!f.id;

// Espace enseignant : publier, modifier, supprimer les cours
export function CoursTeacher() {
  const [rows, load] = useApi('/t/cours'), [aud] = useApi('/admin/auditoires');
  const [f, setF] = useState({}), [files, setFiles] = useState([]), [fk, setFk] = useState(0), [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const reset = () => { setF({}); setFiles([]); setFk(k => k + 1) };
  const toggle = p => setF(x => { const r = x.remove || []; return { ...x, remove: r.includes(p) ? r.filter(q => q !== p) : [...r, p] } });
  const edit = c => { setF({ ...c, remove: [] }); window.scrollTo({ top: 0, behavior: 'smooth' }) };
  const save = async e => {
    e.preventDefault();
    if (files.reduce((a, x) => a + x.size, 0) > MAX) return alert('Taille totale limitée à 4 Mo par envoi.');
    const fd = new FormData();
    ['titre', 'description', 'link', 'auditoire_id'].forEach(k => fd.append(k, f[k] || ''));
    if (isEdit(f)) fd.append('remove', JSON.stringify(f.remove || []));
    files.forEach(x => fd.append('files', x));
    setBusy(true);
    try { await api(isEdit(f) ? '/t/cours/' + f.id : '/t/cours', { method: isEdit(f) ? 'PUT' : 'POST', form: fd }); reset(); load() }
    catch (x) { alert(x.message) }
    setBusy(false);
  };
  const del = c => confirm(`Supprimer le cours « ${c.titre || 'sans titre'} » et ses fichiers ?`) && api('/t/cours/' + c.id, { method: 'DELETE' }).then(load).catch(e => alert(e.message));
  const cible = c => c.auditoire_id ? 'Auditoire : ' + (aud?.find(a => a.id === c.auditoire_id)?.nom || '…') : 'Tous vos étudiants';
  return <>
    <form className="card" onSubmit={save}><h3>{isEdit(f) ? 'Modifier le cours' : 'Ajouter un cours'}</h3>
      <input style={{ width: '100%' }} placeholder="Titre (facultatif)" value={f.titre || ''} onChange={set('titre')} />
      <textarea placeholder="Description (facultative)" value={f.description || ''} onChange={set('description')} />
      <input style={{ width: '100%' }} placeholder="Lien https://… (facultatif)" value={f.link || ''} onChange={set('link')} />
      {isEdit(f) && f.files?.length > 0 && <p><small>Fichiers actuels (cliquez pour retirer) :</small><br />
        {f.files.map(x => { const out = (f.remove || []).includes(x.path); return <button type="button" key={x.path} className={out ? 'danger' : ''} onClick={() => toggle(x.path)}>{out ? '↩ ' : '✕ '}{x.name}</button> })}</p>}
      <p><small>Fichiers : pdf, pptx, ppt, images — 4 Mo au total par envoi.</small><br />
        <input key={fk} type="file" multiple accept=".pdf,.ppt,.pptx,image/*" onChange={e => setFiles([...e.target.files])} /></p>
      <select value={f.auditoire_id || ''} onChange={set('auditoire_id')}><option value="">Destinataires : tous mes étudiants</option>{aud?.map(a => <option key={a.id} value={a.id}>Auditoire : {a.nom}</option>)}</select><br />
      <button disabled={busy}>{isEdit(f) ? 'Enregistrer' : 'Publier le cours'}</button>{isEdit(f) && <button type="button" onClick={reset}>Annuler</button>}
    </form>
    {rows && !rows.length && <div className="card">Aucun cours publié.</div>}
    {rows?.map(c => <div className="card" key={c.id}><h3>{c.titre || 'Sans titre'}</h3>{c.description && <p>{c.description}</p>}
      <small>Publié le {fmtDate(c.created_at)} · {cible(c)}</small><br /><Files r={c} /><br />
      <button onClick={() => edit(c)}>Modifier</button><button className="danger" onClick={() => del(c)}>Supprimer</button></div>)}
  </>;
}

// Espace étudiant : cours publiés par son enseignant
export function CoursList() {
  const [rows] = useApi('/cours');
  if (!rows) return <p>Chargement…</p>;
  if (!rows.length) return <div className="card">Aucun cours publié pour le moment.</div>;
  return rows.map(c => <div className="card" key={c.id}><h3>{c.titre || c.files?.[0]?.name || 'Cours'}</h3>{c.description && <p>{c.description}</p>}
    <small>Publié le {fmtDate(c.created_at)}</small><br /><Files r={c} /></div>);
}
