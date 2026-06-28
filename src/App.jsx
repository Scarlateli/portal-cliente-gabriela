import { useState } from 'react';
import { makeDb } from './lib/db.js';
import { seed } from './lib/seed.js';
import { Login } from './components/Login.jsx';
import { AdminHome } from './components/admin/AdminHome.jsx';
import { ProjectView } from './components/project/ProjectView.jsx';
import { PrintView } from './components/PrintView.jsx';
import { ClientPicker } from './components/ClientPicker.jsx';

export default function App() {
  const [state, setState] = useState(seed);
  const [user, setUser] = useState(null);
  const [studioPid, setStudioPid] = useState(null);
  const [clientPid, setClientPid] = useState(null);
  const [printPid, setPrintPid] = useState(null);
  const db = makeDb(state, setState);

  const logout = () => { setUser(null); setStudioPid(null); setClientPid(null); };

  let body;
  if (printPid) {
    body = <PrintView db={db} project={db.project(printPid)} onClose={() => setPrintPid(null)} />;
  } else if (!user) {
    body = <Login db={db} onLogin={setUser} />;
  } else if (user.role === 'studio') {
    body = studioPid
      ? <ProjectView db={db} user={user} project={db.project(studioPid)} isStudio onLogout={logout} onBack={() => setStudioPid(null)} onPrint={setPrintPid} />
      : <AdminHome db={db} user={user} onLogout={logout} onOpen={setStudioPid} />;
  } else {
    const projects = db.projectsForClient(user.id);
    const pid = clientPid || (projects.length === 1 ? projects[0].id : null);
    body = pid
      ? <ProjectView db={db} user={user} project={db.project(pid)} isStudio={false} onLogout={logout} onBack={projects.length > 1 ? () => setClientPid(null) : undefined} onPrint={setPrintPid} />
      : <ClientPicker db={db} user={user} onLogout={logout} onOpen={setClientPid} />;
  }

  return <div className="cp">{body}</div>;
}
