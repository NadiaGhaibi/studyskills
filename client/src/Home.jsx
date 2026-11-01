import { useState } from 'react';
import { api, useApi, Tabs } from './common.jsx';

const COURS = [
  ['Module 1', 'Étudier à l’université', ['Intégration universitaire', 'Gestion du temps et organisation', 'Recherche d’information', 'Autonomie dans l’apprentissage']],
  ['Module 2', 'Apprendre à apprendre', ['Pensée critique', 'Résolution de problèmes', 'Autoévaluation', 'Prise d’initiative']],
];

function Form({ mode, onOk }) {
  const [f, setF] = useState({}), [aud] = useApi('/public/auditoires'), set = k => e => setF({ ...f, [k]: e.target.value });
  const wide = { width: '92%' };
  const go = async e => {
    e.preventDefault();
    try {
      if (mode !== 'login') await api('/register', { method: 'POST', body: { ...f, role: mode } });
      const { token } = await api('/login', { method: 'POST', body: { email: f.email, password: f.password } });
      localStorage.t = token; onOk();
    } catch (x) { alert(x.message) }
  };
  return <form onSubmit={go}>
    {mode !== 'login' && <><input style={wide} placeholder="Nom" onChange={set('nom')} required /><input style={wide} placeholder="Prénom" onChange={set('prenom')} required /></>}
    <input style={wide} type="email" placeholder="Email" onChange={set('email')} required />
    <input style={wide} type="password" placeholder="Mot de passe (6 caractères min.)" onChange={set('password')} required minLength={6} />
    {mode === 'student' && <>
      <input style={wide} placeholder="N° d'inscription" onChange={set('num_inscription')} required />
      <select style={wide} onChange={e => setF({ ...f, auditoire_id: e.target.value, groupe_td_id: '' })} required><option value="">Auditoire…</option>{aud?.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>
      <select style={wide} value={f.groupe_td_id || ''} onChange={set('groupe_td_id')} required><option value="">Groupe de TD…</option>{aud?.find(a => a.id === f.auditoire_id)?.groupes_td.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}</select>
      {aud && !aud.length && <p><small>Aucun auditoire n'est encore disponible : votre enseignant doit d'abord les créer.</small></p>}</>}
    {mode === 'teacher' && <><input style={wide} type="password" placeholder="Code enseignant" onChange={set('teacherCode')} required />
      <p><small>Le code enseignant vous est communiqué par l'administrateur de la plateforme.</small></p></>}
    <button style={{ width: '92%' }}>{mode === 'login' ? 'Se connecter' : "Créer mon compte"}</button>
  </form>;
}

export default function Home({ onOk }) {
  const [mode, setMode] = useState('login');
  return <>
    <div className="hero"><img className="logo" src="/logo-isg.png" alt="Université de Gabès – Institut Supérieur de Gestion de Gabès" /><h1><span className="mark">Study Skills</span></h1><p>Plateforme de dépôt et d'évaluation des activités du cours <b>Study Skills</b> — 1ère année Business Computing, Institut Supérieur de Gestion de Gabès. Les activités se réalisent en équipe ou individuellement ; chaque étudiant y construit son portfolio.</p></div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: '2 1 380px' }}>
        {COURS.map(([m, titre, themes]) => <div className="card module" key={m}><small>{m}</small><h2 style={{ margin: '4px 0' }}>{titre}</h2>
          <ol>{themes.map(t => <li key={t}>{t}</li>)}</ol></div>)}
      </div>
      <div className="card" style={{ flex: '1 1 300px' }}>
        <Tabs tab={mode} set={setMode} tabs={[['login', 'Connexion'], ['student', 'Inscription étudiant'], ['teacher', 'Inscription enseignant']]} />
        <h3>{{ login: 'Connexion', student: 'Inscription étudiant', teacher: 'Inscription enseignant' }[mode]}</h3>
        <Form key={mode} mode={mode} onOk={onOk} />
      </div>
    </div>
  </>;
}