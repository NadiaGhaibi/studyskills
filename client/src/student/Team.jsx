import { useState, useEffect } from 'react';
import { api, useApi } from '../common.jsx';

export default function Team({ me }) {
  const [t, load] = useApi('/team'), [nom, setNom] = useState(''), [q, setQ] = useState(''), [cand, setCand] = useState([]);
  const [tq, setTq] = useState(''), [teams, setTeams] = useState([]);
  const chef = !!t && t.chef_id === me.id;
  useEffect(() => { if (t === null) api('/teams?q=' + encodeURIComponent(tq)).then(setTeams).catch(() => {}) }, [tq, t]);
  useEffect(() => { if (chef) api('/team/candidates?q=' + encodeURIComponent(q)).then(setCand).catch(() => {}) }, [q, t]);
  const act = (p, m, b, ask) => { if (ask && !confirm(ask)) return; return api(p, { method: m, body: b }).then(load).catch(e => alert(e.message)) };

  if (t === undefined) return <p>Chargement…</p>;
  if (!t) return <>
    <div className="card"><h3>Créer une équipe</h3>
      <p><small>Vous en devenez le chef. Le nom doit être unique ; l'équipe appartient à votre auditoire. Un étudiant ne peut appartenir qu'à une seule équipe.</small></p>
      <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de l'équipe" />
      <button className="primary" disabled={!nom.trim()} onClick={() => act('/team', 'POST', { nom: nom.trim() })}>Créer l'équipe</button></div>
    <div className="card"><h3>Rejoindre une équipe existante</h3>
      <input placeholder="Rechercher une équipe" value={tq} onChange={e => setTq(e.target.value)} />
      {!teams.length && <p><small>Aucune équipe dans votre auditoire.</small></p>}
      {teams.map(x => <p key={x.id}><b>{x.nom}</b> <small>· chef : {x.chef?.prenom} {x.chef?.nom} · {x.membres} membre(s)</small>
        <button className="primary" onClick={() => act('/team/join', 'POST', { team_id: x.id }, `Rejoindre l'équipe « ${x.nom} » ?`)}>Rejoindre</button></p>)}</div></>;

  return <><div className="card"><h3>Équipe « {t.nom} » {chef && <button onClick={() => { const v = prompt("Nouveau nom de l'équipe", t.nom); v && act('/team', 'PUT', { nom: v.trim() }) }}>✎ Renommer</button>}</h3>
    <p><small>Auditoire : {t.auditoire?.nom} · {t.team_members.length} membre(s) · tous les membres ont les mêmes droits sur les travaux de l'équipe.</small></p>
    {t.team_members.map(({ student: s }) => <p key={s.id}>{s.prenom} {s.nom} <small>({s.num_inscription}){s.id === t.chef_id ? ' · chef d’équipe' : ''}{s.id === me.id ? ' · vous' : ''}</small>
      {chef && s.id !== me.id && <button className="danger" onClick={() => act('/team/members/' + s.id, 'DELETE', null, `Retirer ${s.prenom} ${s.nom} de l'équipe ?`)}>Retirer</button>}</p>)}
    {chef ? <button className="danger" onClick={() => act('/team', 'DELETE', null, "Dissoudre l'équipe ?")}>Dissoudre l'équipe</button>
      : <button className="danger" onClick={() => act('/team/leave', 'DELETE', null, "Quitter l'équipe ?")}>Quitter l'équipe</button>}</div>
    {chef && <div className="card"><h3>Ajouter des membres</h3><input placeholder="Rechercher par nom ou n° d'inscription" value={q} onChange={e => setQ(e.target.value)} style={{ width: '70%' }} />
      {!cand.length && <p><small>Aucun étudiant disponible (de votre auditoire et sans équipe).</small></p>}
      {cand.map(s => <p key={s.id}>{s.prenom} {s.nom} <small>({s.num_inscription})</small> <button className="primary" onClick={() => act('/team/members', 'POST', { student_id: s.id })}>Ajouter</button></p>)}</div>}</>;
}