import { consumirPedido, destacarAlvo } from '../../lib/pendenciasContexto.js';
import { proximaEtapa } from '../../lib/pendencias.js';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GerenciarProjeto } from './GerenciarProjeto.jsx';
import {
  GitCommitVertical,
  CalendarDays,
  FileText,
  PenLine,
  Wallet,
  ClipboardList,
  Handshake,
  Building2,
  Hash,
  User,
  Clock,
  CircleCheck,
  ArrowLeft,
  Printer,
  KeyRound,
  MessageCircle,
  Check,
  ArrowRight,
  ChevronRight,
  House,
  Menu,
} from 'lucide-react';
import { TopBar, Esqueleto, ErrorBox, ErrorBanner } from '../atoms.jsx';
import { fmt, todayISO } from '../../lib/helpers.js';
import { enderecoCurto, vocativo } from '../../lib/endereco.js';
import { qk, IS_SUPABASE } from '../../lib/data.js';
import { useResolvedDb, specsFor } from '../../lib/useResolvedDb.js';
import { Timeline } from './Timeline.jsx';
import { Calendar } from './Calendar.jsx';
import { Documents } from './Documents.jsx';
import { Contract } from './Contract.jsx';
import { Payments } from './Payments.jsx';
import { Quotes } from './Quotes.jsx';
import { Suppliers } from './Suppliers.jsx';

const STUDIO_WHATSAPP = 'https://wa.me/5511936209087';

const TABS = [
  { id: 'timeline', label: 'Linha do Tempo', I: GitCommitVertical },
  { id: 'calendar', label: 'Calendário', I: CalendarDays },
  { id: 'docs', label: 'Documentos', I: FileText },
  { id: 'contract', label: 'Contratos e Termos', I: PenLine },
  { id: 'payments', label: 'Pagamentos', I: Wallet },
  { id: 'quotes', label: 'Orçamentos', I: ClipboardList },
  { id: 'suppliers', label: 'Fornecedores', I: Handshake },
];

export function ProjectView({ db: baseDb, user, pid, isStudio, onLogout, onBack, onPrint }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [
      { key: qk.project(pid), method: 'project', args: [pid] },
      { key: qk.clientName(pid), method: 'clientName', args: [pid] },
      { key: qk.templates(), method: 'templates' },
      { key: qk.stages(pid), method: 'stages', args: [pid] },
      { key: qk.calendar(pid), method: 'calendarEvents', args: [pid] },
      { key: qk.documents(pid), method: 'documents', args: [pid] },
      { key: qk.subArquivos(pid), method: 'subArquivos', args: [pid] },
      { key: qk.contracts(pid), method: 'contracts', args: [pid] },
      { key: qk.payment(pid), method: 'payment', args: [pid] },
      { key: qk.quotes(pid), method: 'quotes', args: [pid] },
      { key: qk.suppliers(pid), method: 'suppliers', args: [pid] },
      // o que espera pelo cliente (cartão "Seu próximo passo")
      ...(!isStudio && user ? [{ key: qk.pendencias(), method: 'pendencias', args: [user.role, user.id] }] : []),
      // cadastro de fornecedores: só o studio usa (e só o studio enxerga)
      ...(isStudio ? [{ key: qk.fornecedores(), method: 'fornecedores' }] : []),
    ]),
    pid,
  );

  if (!r.ready) {
    return (
      <div className="shell">
        <TopBar
          user={user}
          onLogout={onLogout}
          left={
            isStudio ? (
              <button className="icon-btn" title="Voltar" onClick={onBack}>
                <ArrowLeft size={16} />
              </button>
            ) : null
          }
        />
        <main id="conteudo" className="content">{r.error ? <ErrorBox error={r.error} /> : <Esqueleto />}</main>
      </div>
    );
  }

  const db = r.db;
  const project = db.project(pid);
  if (!project) {
    return (
      <div className="shell">
        <main id="conteudo" className="content">
          <div className="empty">
            Projeto não encontrado.{' '}
            <button type="button" className="link" onClick={onBack}>
              Voltar aos projetos
            </button>
          </div>
        </main>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="shell">
        <TopBar user={user} onLogout={onLogout} />
        <main id="conteudo" className="content">
          <ErrorBox text="Projeto não encontrado." />
        </main>
      </div>
    );
  }

  return (
    <ProjectInner
      db={db}
      user={user}
      project={project}
      isStudio={isStudio}
      onLogout={onLogout}
      onBack={onBack}
      onPrint={onPrint}
      mutationError={r.error}
      clearError={r.clearError}
    />
  );
}

function ProjectInner({
  db,
  user,
  project,
  isStudio,
  onLogout,
  onBack,
  onPrint,
  mutationError,
  clearError,
}) {
  // aba (e item) pedidos pelo sino de pendências (valem uma vez); senão, a
  // linha do tempo
  const [pedidoInicial] = useState(() => consumirPedido(project.id));
  const [tab, setTab] = useState(() => (pedidoInicial && pedidoInicial.aba) || 'timeline');
  // item a destacar dentro da aba (vindo do sino ou de um link entre abas)
  const [alvo, setAlvo] = useState(() => (pedidoInicial && pedidoInicial.alvo) || null);
  const [vezAlvo, setVezAlvo] = useState(0);
  const abrir = (aba, novoAlvo = null) => {
    setTab(aba);
    setAlvo(novoAlvo);
    setVezAlvo((n) => n + 1);
  };
  useEffect(() => destacarAlvo(alvo), [alvo, vezAlvo, tab]);
  useEffect(() => {
    const ir = (e) => {
      if (e.detail && e.detail.pid === project.id) {
        consumirPedido(project.id);
        abrir(e.detail.aba, e.detail.alvo || null);
      }
    };
    window.addEventListener('gl-ir-aba', ir);
    return () => window.removeEventListener('gl-ir-aba', ir);
  }, [project.id]);
  const expired = project.accessUntil && todayISO() > project.accessUntil;
  const heroStages = db.stages(project.id);
  const prazo = proximaEtapa(heroStages, todayISO());
  // atraso do studio não aparece em vermelho para o cliente (rodada 10)
  const prazoNeutro = prazo && prazo.atrasado && !isStudio && !prazo.doCliente;
  const minhas = !isStudio && db.pendencias ? (db.pendencias(user.role, user.id) || []).filter((p) => p.pid === project.id) : [];
  const [resent, setResent] = useState(null);
  const saudacao = vocativo(project.greeting, user && user.name);
  const [resending, setResending] = useState(false);
  // rodada 12: projeto criado sem e-mail — libera o acesso depois
  const [liberando, setLiberando] = useState(false);
  const semAcesso = !project.clientId;

  return (
    <div className="shell">
      <TopBar
        user={user}
        onLogout={onLogout}
        left={
          isStudio ? (
            <button className="icon-btn" title="Voltar" onClick={onBack}>
              <ArrowLeft size={16} />
            </button>
          ) : null
        }
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => onPrint(project.id)}>
            <Printer size={14} /> Histórico PDF
          </button>
        }
      />
      <main id="conteudo" className="content">
        <div className="hero">
          <div className="hero-headrow">
            <span className="hero-tag">
              {project.status === 'concluido' ? 'Concluído' : 'Em andamento'}
            </span>
            {/* o código do projeto é do studio; o cliente não precisa dele */}
            {isStudio && (
              <span className="hero-code">
                <Hash size={11} /> {project.code}
              </span>
            )}
          </div>
          {!isStudio && saudacao && <p className="hero-ola">Olá, {saudacao}</p>}
          <h1 className="hero-name">{project.name}</h1>
          <div className="hero-rows">
            {enderecoCurto(project) && (
              <span>
                <Building2 size={14} /> {enderecoCurto(project)}
              </span>
            )}
            {isStudio && (
              <span>
                <User size={14} /> Cliente: {db.clientName(project.id)}
                {semAcesso && <em className="sem-acesso">acesso ainda não liberado</em>}
              </span>
            )}
            <span>
              <CalendarDays size={14} /> Data de Início: {fmt(project.start)} · Previsão de Entrega: {fmt(project.due)}
            </span>
          </div>
          <div className="hero-stats">
            <div className="hstat">
              <strong>
                {heroStages.filter((st) => st.status === 'concluida').length}
                <span>/{heroStages.length}</span>
              </strong>
              <em>etapas concluídas</em>
            </div>
            {/* a fase com o próximo prazo e a data dela (só etapas macro) */}
            <div className={'hstat hstat-fase' + (prazo && prazo.atrasado && !prazoNeutro ? ' hstat-atrasado' : '')}>
              <strong>{prazo ? prazo.titulo : '—'}</strong>
              <em>
                {!prazo
                  ? 'Próxima etapa'
                  : prazoNeutro
                    ? 'Nova data em definição'
                    : prazo.data
                      ? (prazo.atrasado ? 'Prazo vencido – ' : 'Prazo – ') + fmt(prazo.data)
                      : 'Sem prazo definido'}
              </em>
            </div>
          </div>
          <Fases stages={heroStages} />
        </div>

        {!isStudio && !expired && <ProximoPasso lista={minhas} abrir={abrir} />}

        {project.accessUntil && (
          <div className={'access ' + (expired ? 'access-off' : '')}>
            <Clock size={14} />
            {expired ? (
              <span>
                O acesso do cliente a este projeto foi encerrado em {fmt(project.accessUntil)} — o
                portal dele está desativado.
              </span>
            ) : (
              <span>
                Projeto finalizado. O acesso do cliente encerra em {fmt(project.accessUntil)} —
                baixe o histórico antes disso.
              </span>
            )}
          </div>
        )}

        <ErrorBanner error={mutationError} onClose={clearError} />

        {isStudio && liberando && (
          <LiberarAcesso
            db={db}
            project={project}
            onFechar={() => setLiberando(false)}
            onLiberado={(r) => {
              setLiberando(false);
              setResent(r);
            }}
          />
        )}

        {resent && resent.jaTinhaAcesso && (
          <div className="invite-box">
            <strong>Acesso liberado! Esse cliente já tinha acesso ao portal.</strong>
            <p className="hint">O projeto já aparece para {resent.email}, com a senha que ele usa hoje.</p>
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={() => setResent(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}
        {resent && !resent.jaTinhaAcesso && (
          <div className="invite-box">
            <strong>
              {resent.emailSent
                ? 'Nova senha provisória enviada por e-mail para ' + resent.email
                : 'Nova senha provisória do cliente'}
            </strong>
            <code>
              e-mail: {resent.email}
              <br />
              senha provisória: {resent.tempPassword}
            </code>
            <div className="row">
              <button
                className="btn btn-primary btn-sm"
                onClick={() =>
                  navigator.clipboard &&
                  navigator.clipboard.writeText(
                    'Portal do Projeto — ' +
                      window.location.origin +
                      '\nE-mail: ' +
                      resent.email +
                      '\nSenha provisória: ' +
                      resent.tempPassword,
                  )
                }
              >
                Copiar dados de acesso
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setResent(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}

        {!isStudio && expired ? (
          <section className="panel">
            <header className="panel-head">
              <h2>Acesso Encerrado</h2>
            </header>
            <p className="hint">
              Seu acesso a este projeto foi encerrado em {fmt(project.accessUntil)}, um mês após a
              conclusão. Precisa de algum documento ou informação? É só falar com o studio.
            </p>
          </section>
        ) : (
          <>
            <nav className="tabs" role="tablist">
              {TABS.map(({ id, label, I }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={'tab' + (tab === id ? ' active' : '')}
                  onClick={() => setTab(id)}
                >
                  <I size={15} /> {label}
                </button>
              ))}
            </nav>

            <span id="aba-conteudo" aria-hidden />
            {tab === 'timeline' && <Timeline db={db} project={project} isStudio={isStudio} alvo={alvo} abrir={abrir} />}
            {tab === 'calendar' && <Calendar db={db} project={project} isStudio={isStudio} />}
            {tab === 'docs' && <Documents db={db} project={project} isStudio={isStudio} alvo={alvo} abrir={abrir} />}
            {tab === 'contract' && <Contract db={db} project={project} isStudio={isStudio} />}
            {tab === 'payments' && <Payments db={db} project={project} isStudio={isStudio} />}
            {tab === 'quotes' && <Quotes db={db} project={project} isStudio={isStudio} />}
            {tab === 'suppliers' && <Suppliers db={db} project={project} isStudio={isStudio} />}
            <NavInferior tab={tab} setTab={setTab} pendencias={minhas} />
          </>
        )}

        {isStudio && (
          <GerenciarProjeto
            db={db}
            project={project}
            onExcluido={onBack}
            acoes={
              project.status !== 'concluido' && (
                <>
                  {semAcesso && (
                    <button className="btn btn-primary btn-sm" onClick={() => setLiberando(true)} disabled={liberando}>
                      <KeyRound size={14} /> Liberar acesso ao cliente
                    </button>
                  )}
                  {IS_SUPABASE && !expired && !semAcesso && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={resending}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            'Gerar nova senha provisória para o cliente? A senha atual dele deixa de valer.',
                          )
                        )
                          return;
                        setResending(true);
                        try {
                          const r = await db.resendClientAccess(project.id);
                          if (r) setResent(r);
                        } finally {
                          setResending(false);
                        }
                      }}
                    >
                      <KeyRound size={14} /> {resending ? 'Gerando…' : 'Reenviar acesso'}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (
                        window.confirm('Finalizar o projeto? O acesso do cliente passa a expirar em 1 mês.')
                      )
                        db.completeProject(project.id);
                    }}
                  >
                    <CircleCheck size={14} /> Finalizar projeto
                  </button>
                </>
              )
            }
          />
        )}
        {!isStudio && (
          <footer className="client-foot">
            <div>
              <strong>Tem alguma dúvida?</strong>
              <p className="hint">Fale com nossa equipe.</p>
            </div>
            <a className="btn btn-primary fale-conosco" href={STUDIO_WHATSAPP} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Fale conosco
            </a>
          </footer>
        )}
      </main>
    </div>
  );
}

/* Onde estamos (rodada 10): as fases do projeto numa linha, com a atual
   marcada, como num acompanhamento de pedido. */
export function Fases({ stages }) {
  // no celular, a linha rola de lado: começa mostrando a fase atual
  const lista = useRef(null);
  useEffect(() => {
    const el = lista.current && lista.current.querySelector('[aria-current="step"]');
    if (el && lista.current.scrollWidth > lista.current.clientWidth)
      lista.current.scrollLeft = el.offsetLeft - lista.current.clientWidth / 2 + el.clientWidth / 2;
  }, [stages]);
  if (!stages || stages.length < 2) return null;
  const algumaEmAndamento = stages.some((s) => s.status === 'em_andamento');
  const primeiraAberta = (stages.find((s) => s.status !== 'concluida') || {}).id;
  return (
    <ol className="fases" aria-label="Fases do projeto" ref={lista}>
      {stages.map((s) => {
        const estado =
          s.status === 'concluida'
            ? 'feita'
            : s.status === 'em_andamento' || (!algumaEmAndamento && s.id === primeiraAberta)
              ? 'atual'
              : 'futura';
        return (
          <li key={s.id} className={'fase fase-' + estado} aria-current={estado === 'atual' ? 'step' : undefined}>
            <span className="fase-ponto" aria-hidden>
              {estado === 'feita' && <Check size={11} />}
            </span>
            <span className="fase-nome">{s.title}</span>
            <span className="sr-only">{estado === 'feita' ? ' (concluída)' : estado === 'atual' ? ' (em andamento)' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* Seu próximo passo (rodada 10): no lugar da janela que abria por cima ao
   entrar, um cartão fixo com a ação mais importante e as demais embaixo. */
export function ProximoPasso({ lista, abrir }) {
  const [primeiro, ...resto] = lista;
  const [todas, setTodas] = useState(false);
  const visiveis = todas ? resto : resto.slice(0, 3);
  if (!primeiro)
    return (
      <section className="proximo proximo-ok" aria-label="Seu próximo passo">
        <Check size={18} aria-hidden /> <span>Tudo em dia. Não há nada esperando por você agora.</span>
      </section>
    );
  return (
    <section className="proximo" aria-label="Seu próximo passo">
      <div className="proximo-topo">
        <span className="proximo-rot">Seu próximo passo</span>
        {lista.length > 1 && <span className="proximo-n">{lista.length} pendências</span>}
      </div>
      <div className="proximo-principal">
        <p>{primeiro.texto}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => abrir(primeiro.aba, primeiro.alvo)}>
          Resolver <ArrowRight size={14} />
        </button>
      </div>
      {resto.length > 0 && (
        <ul className="proximo-resto">
          {visiveis.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => abrir(p.aba, p.alvo)}>
                <span>{p.texto}</span> <ChevronRight size={14} aria-hidden />
              </button>
            </li>
          ))}
          {resto.length > 3 && (
            <li>
              <button type="button" className="proximo-mais" onClick={() => setTodas(!todas)}>
                <span>{todas ? 'Mostrar menos' : 'Ver mais ' + (resto.length - 3) + (resto.length - 3 === 1 ? ' pendência' : ' pendências')}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/* Navegação embaixo no celular (rodada 10): 4 itens ao alcance do polegar,
   com o número de pendências de cada parte. Some no computador e no iPad,
   onde ficam as abas de cima. */
const NAV = [
  { id: 'timeline', label: 'Início', I: House },
  { id: 'docs', label: 'Documentos', I: FileText },
  { id: 'calendar', label: 'Agenda', I: CalendarDays },
];
const MAIS = ['contract', 'payments', 'quotes', 'suppliers'];

export function NavInferior({ tab, setTab, pendencias = [] }) {
  const [mais, setMais] = useState(false);
  const conta = (abas) => pendencias.filter((p) => abas.includes(p.aba)).length;
  const ir = (id) => {
    setTab(id);
    setMais(false);
    // leva ao começo da seção escolhida (logo abaixo do topo do projeto)
    const alvo = document.getElementById('aba-conteudo');
    if (alvo && alvo.scrollIntoView) setTimeout(() => alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const nMais = conta(MAIS);
  const nome = (label, n) => label + (n ? ', ' + n + (n === 1 ? ' pendência' : ' pendências') : '');
  // fora do conteúdo (que tem animação com transform e prenderia o "fixed")
  return createPortal(
    <>
      {mais && <div className="nav-folha-fundo" onClick={() => setMais(false)} aria-hidden />}
      {mais && (
        <div className="nav-folha" role="menu" aria-label="Mais seções">
          {TABS.filter((t) => MAIS.includes(t.id)).map(({ id, label, I }) => (
            <button key={id} type="button" role="menuitem" className={tab === id ? 'on' : undefined} aria-label={nome(label, conta([id]))} onClick={() => ir(id)}>
              <I size={18} /> <span>{label}</span>
              {conta([id]) > 0 && <span className="nav-n">{conta([id])}</span>}
            </button>
          ))}
        </div>
      )}
      <nav className="navbar" aria-label="Seções do projeto">
        {NAV.map(({ id, label, I }) => (
          <button key={id} type="button" className={tab === id ? 'on' : undefined} aria-current={tab === id ? 'page' : undefined} aria-label={nome(label, conta([id]))} onClick={() => ir(id)}>
            <span className="nav-ic">
              <I size={20} />
              {conta([id]) > 0 && <span className="nav-n">{conta([id])}</span>}
            </span>
            {label}
          </button>
        ))}
        <button type="button" className={MAIS.includes(tab) || mais ? 'on' : undefined} aria-expanded={mais} aria-label={nome('Mais', nMais)} onClick={() => setMais(!mais)}>
          <span className="nav-ic">
            <Menu size={20} />
            {nMais > 0 && <span className="nav-n">{nMais}</span>}
          </span>
          Mais
        </button>
      </nav>
    </>,
    document.querySelector('.cp') || document.body,
  );
}

/* Liberar o acesso de um projeto criado sem e-mail (rodada 12) */
function LiberarAcesso({ db, project, onFechar, onLiberado }) {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const liberar = async () => {
    if (!valido || enviando) return;
    setErro('');
    setEnviando(true);
    try {
      onLiberado(await db.liberarAcesso(project.id, email));
    } catch (e) {
      setErro((e && e.message) || 'Não foi possível liberar o acesso.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <section className="panel liberar-acesso" aria-label="Liberar acesso ao cliente">
      <header className="panel-head">
        <h2>Liberar acesso ao cliente</h2>
      </header>
      <p className="hint">
        O cliente recebe uma senha provisória (por e-mail, quando o envio está ativo) e passa a ver o projeto como
        está agora.
      </p>
      <label className="lab">
        E-mail do cliente
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cliente.com" aria-label="E-mail do cliente" />
      </label>
      {erro && <p className="error">{erro}</p>}
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!valido || enviando} onClick={liberar}>
          {enviando ? 'Liberando…' : 'Liberar acesso'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
