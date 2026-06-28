import { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { seed } from './lib/seed.js';
import { getDb, IS_SUPABASE, qk } from './lib/data.js';
import { useResolvedDb, specsFor } from './lib/useResolvedDb.js';
import { queryClient } from './lib/queryClient.js';
import { supabase } from './lib/supabase/client.js';
import { Login } from './components/Login.jsx';
import { Loading, ErrorBox } from './components/atoms.jsx';
import { AdminHome } from './components/admin/AdminHome.jsx';
import { ProjectView } from './components/project/ProjectView.jsx';
import { PrintView } from './components/PrintView.jsx';
import { ClientPicker } from './components/ClientPicker.jsx';

function AppInner() {
  // Estado do mock (ignorado no modo supabase). Mantido em useState para
  // que o caminho mock continue idêntico ao de hoje.
  const [mockState, setMockState] = useState(seed);

  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(IS_SUPABASE);
  const [studioPid, setStudioPid] = useState(null);
  const [clientPid, setClientPid] = useState(null);
  const [printPid, setPrintPid] = useState(null);

  // db: no mock recebe (state,set); no supabase é async e ignora os args.
  const db = getDb({ state: mockState, set: setMockState });

  // Sessão persistente (supabase): recupera o usuário logado entre reloads.
  useEffect(() => {
    if (!IS_SUPABASE || !supabase) return;
    let active = true;
    const loadProfile = async (authUser) => {
      if (!authUser) {
        if (active) {
          setUser(null);
          setBootstrapping(false);
        }
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, name')
        .eq('id', authUser.id)
        .single();
      if (active) {
        setUser(profile ? { id: profile.id, role: profile.role, name: profile.name } : null);
        setBootstrapping(false);
      }
    };
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      loadProfile(session?.user || null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    if (IS_SUPABASE && supabase) await supabase.auth.signOut();
    setUser(null);
    setStudioPid(null);
    setClientPid(null);
    queryClient.clear();
  };

  let body;
  if (bootstrapping) {
    body = (
      <div className="shell">
        <main className="content">
          <Loading text="Conectando…" />
        </main>
      </div>
    );
  } else if (printPid) {
    body = <PrintView db={db} pid={printPid} onClose={() => setPrintPid(null)} />;
  } else if (!user) {
    body = <Login db={db} onLogin={setUser} />;
  } else if (user.role === 'studio') {
    body = studioPid ? (
      <ProjectView
        db={db}
        user={user}
        pid={studioPid}
        isStudio
        onLogout={logout}
        onBack={() => setStudioPid(null)}
        onPrint={setPrintPid}
      />
    ) : (
      <AdminHome db={db} user={user} onLogout={logout} onOpen={setStudioPid} />
    );
  } else {
    body = (
      <ClientArea
        db={db}
        user={user}
        clientPid={clientPid}
        setClientPid={setClientPid}
        onLogout={logout}
        onPrint={setPrintPid}
      />
    );
  }

  return <div className="cp">{body}</div>;
}

// Área do cliente: replica a regra original — 1 projeto abre direto (sem
// "voltar"); vários mostram o seletor. A lista é resolvida pelo resolver
// (mock síncrono / supabase via React Query).
function ClientArea({ db, user, clientPid, setClientPid, onLogout, onPrint }) {
  const r = useResolvedDb(
    db,
    specsFor(db, [
      { key: qk.projectsForClient(user.id), method: 'projectsForClient', args: [user.id] },
    ]),
  );
  if (!r.ready) {
    return (
      <div className="shell">
        <main className="content">{r.error ? <ErrorBox /> : <Loading />}</main>
      </div>
    );
  }
  const projects = r.db.projectsForClient(user.id) || [];
  const pid = clientPid || (projects.length === 1 ? projects[0].id : null);
  if (pid) {
    return (
      <ProjectView
        db={db}
        user={user}
        pid={pid}
        isStudio={false}
        onLogout={onLogout}
        onBack={projects.length > 1 ? () => setClientPid(null) : undefined}
        onPrint={onPrint}
      />
    );
  }
  return (
    <ClientPicker
      db={db}
      user={user}
      projects={projects}
      onLogout={onLogout}
      onOpen={setClientPid}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
