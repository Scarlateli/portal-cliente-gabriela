import { useState, useRef } from 'react';
import { FolderUp, Upload, Download, Trash2, Plus, Check, RotateCcw, CalendarDays, AlertTriangle } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { fmt, validarArquivo } from '../../lib/helpers.js';
import { prazoSub } from '../../lib/etapas.js';
import { IS_SUPABASE } from '../../lib/data.js';

/* Envios do cliente (rodada 4): o studio cria pedidos de arquivo (são
   sub-etapas com "pedir arquivos" marcado) e o cliente manda quantos
   arquivos precisar em cada um, de uma vez, com um recado opcional.
   O studio confere e marca o pedido como concluído. */
export function EnviosCliente({ db, project, isStudio, abrir = () => {} }) {
  const stages = db.stages(project.id);
  const arquivos = (db.subArquivos && db.subArquivos(project.id)) || [];
  const pedidos = stages.flatMap((s) => (s.subs || []).filter((b) => b.pedeArquivos).map((b) => ({ b, s })));
  // abertos primeiro, pelo prazo; concluídos no fim
  pedidos.sort((x, y) => Number(x.b.done) - Number(y.b.done) || String(x.b.due || '9999').localeCompare(String(y.b.due || '9999')));
  const [criando, setCriando] = useState(false);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Envios do Cliente</h2>
        {isStudio && !criando && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCriando(true)} disabled={!stages.length}>
            <Plus size={14} /> Novo pedido de arquivos
          </button>
        )}
      </header>
      <p className="hint envios-intro">
        {isStudio
          ? 'Peça aqui os arquivos que o cliente precisa mandar (plantas, fotos, referências). Ele envia vários de uma vez em cada pedido.'
          : 'Aqui ficam os arquivos que o studio pediu. Em cada pedido, você pode mandar vários arquivos de uma vez.'}
      </p>
      {isStudio && criando && <NovoPedido db={db} project={project} stages={stages} onFechar={() => setCriando(false)} />}
      {isStudio && !stages.length && <p className="hint">Crie as etapas do projeto antes de pedir arquivos.</p>}
      {pedidos.length === 0 ? (
        <Empty text={isStudio ? 'Nenhum pedido de arquivos ainda.' : 'Nenhum arquivo pedido no momento.'} />
      ) : (
        <ul className="envios">
          {pedidos.map(({ b, s }) => (
            <Pedido
              key={b.id}
              db={db}
              projectId={project.id}
              b={b}
              s={s}
              isStudio={isStudio}
              arquivos={arquivos.filter((a) => a.subId === b.id)}
              abrir={abrir}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NovoPedido({ db, project, stages, onFechar }) {
  const aberta = stages.find((s) => s.status === 'em_andamento') || stages[0];
  const [f, setF] = useState({ title: '', stageId: aberta ? aberta.id : '', due: '', instructions: '' });
  const [avisar, setAvisar] = useState(IS_SUPABASE);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const salvar = async () => {
    if (!f.title.trim() || !f.stageId || salvando) return;
    setSalvando(true);
    try {
      await db.addSub(f.stageId, {
        title: f.title.trim(),
        kind: 'documentacao',
        responsible: 'cliente',
        due: f.due,
        pedeArquivos: true,
        instructions: f.instructions,
      });
      if (avisar && IS_SUPABASE) {
        try {
          const r = await db.avisarCliente(project.id, 'Enviar arquivos: ' + f.title.trim() + (f.due ? ' (até ' + fmt(f.due) + ')' : ''));
          if (!(r && r.emailSent)) setAviso('Pedido criado. O e-mail ao cliente não foi enviado.');
        } catch {
          setAviso('Pedido criado. O e-mail ao cliente não foi enviado.');
        }
      }
      if (!aviso) onFechar();
    } finally {
      setSalvando(false);
    }
  };
  return (
    <div className="add-stage envios-novo">
      <input placeholder="O que o cliente deve enviar (ex.: Plantas do apartamento)" aria-label="Título do pedido" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <div className="add-row">
        <label className="inline-lab">
          Etapa
          <select value={f.stageId} onChange={(e) => setF({ ...f, stageId: e.target.value })}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-lab">
          Prazo
          <input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </label>
      </div>
      <textarea
        rows={2}
        maxLength={600}
        placeholder="Instruções (opcional): formato, quais ambientes, o que não pode faltar"
        aria-label="Instruções do pedido"
        value={f.instructions}
        onChange={(e) => setF({ ...f, instructions: e.target.value })}
      />
      {IS_SUPABASE && (
        <label className="aprov-check">
          <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} /> Avisar o cliente por e-mail
        </label>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!f.title.trim() || !f.stageId || salvando} onClick={salvar}>
          {salvando ? 'Criando…' : 'Criar pedido'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
          {aviso ? 'Fechar' : 'Cancelar'}
        </button>
        {aviso && <span className="micro">{aviso}</span>}
      </div>
      <p className="micro">O pedido também aparece na linha do tempo, dentro da etapa escolhida, como responsabilidade do cliente.</p>
    </div>
  );
}

function Pedido({ db, projectId, b, s, isStudio, arquivos, abrir }) {
  const input = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [nota, setNota] = useState(b.clientNote || '');
  const [editandoNota, setEditandoNota] = useState(false);
  const pz = prazoSub(b);
  const aberto = !b.done;
  const podeEnviar = aberto && (isStudio || b.responsible === 'cliente');

  const escolher = async (e) => {
    const lista = Array.from(e.target.files || []);
    e.target.value = '';
    if (!lista.length) return;
    const recusados = lista.map((f) => [f, validarArquivo(f)]).filter(([, p]) => p);
    const ok = lista.filter((f) => !validarArquivo(f));
    setAviso(recusados.length ? recusados.map(([f, p]) => f.name + ': ' + p).join(' ') : '');
    if (!ok.length) return;
    setEnviando(true);
    try {
      await db.enviarArquivos(projectId, b.id, ok, isStudio ? 'studio' : 'client');
    } finally {
      setEnviando(false);
    }
  };
  const abrirArquivo = async (a) => {
    if (!a.storagePath) return;
    const url = await db.fileUrl(a.storagePath);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <li className={'envio' + (aberto ? '' : ' envio-feito')} id={'alvo-pedido-' + b.id}>
      <div className="envio-topo">
        <div>
          <h3>
            <FolderUp size={15} /> {b.title}
          </h3>
          <button type="button" className="link sm envio-etapa" onClick={() => abrir('timeline', 'sub-' + b.id)}>
            Etapa: {s.title}
          </button>
        </div>
        <span className="envio-situacao">
          <span className={'sub-chip sub-prazo sub-prazo-' + pz.estado}>
            {pz.estado === 'atrasado' ? <AlertTriangle size={10} /> : <CalendarDays size={10} />} {pz.texto}
          </span>
          <span className={'pill ' + (!aberto ? 'pill-done' : arquivos.length ? 'pill-now' : 'pill-todo')}>
            {!aberto
              ? 'Concluído'
              : arquivos.length
                ? arquivos.length + (arquivos.length === 1 ? ' arquivo enviado' : ' arquivos enviados')
                : 'Aguardando arquivos'}
          </span>
        </span>
      </div>
      {b.instructions && <p className="envio-instrucoes">{b.instructions}</p>}

      {arquivos.length > 0 && (
        <ul className="envio-arquivos">
          {arquivos.map((a) => (
            <li key={a.id}>
              <button type="button" className="link sm" onClick={() => abrirArquivo(a)} disabled={!a.storagePath}>
                <Download size={12} /> {a.name}
              </button>
              <span className="micro">
                {a.size ? a.size + ' · ' : ''}
                {a.createdAt ? fmt(String(a.createdAt).slice(0, 10)) : ''}
                {a.sentBy === 'studio' ? ' · enviado pelo studio' : ''}
              </span>
              {(isStudio || (aberto && a.sentBy === 'client')) && (
                <button
                  type="button"
                  className="icon-x"
                  aria-label={'Remover ' + a.name}
                  onClick={() => {
                    if (window.confirm('Remover "' + a.name + '"?')) db.removerArquivo(projectId, a.id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {(b.clientNote || (!isStudio && aberto)) && (
        <div className="envio-nota">
          {editandoNota ? (
            <>
              <textarea rows={2} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} aria-label="Recado para o studio" />
              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    await db.setNotaPedido(s.id, b.id, nota);
                    setEditandoNota(false);
                  }}
                >
                  Salvar recado
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditandoNota(false)}>
                  Cancelar
                </button>
              </div>
            </>
          ) : b.clientNote ? (
            <p>
              <strong>Recado do cliente:</strong> {b.clientNote}{' '}
              {!isStudio && aberto && (
                <button type="button" className="link sm" onClick={() => setEditandoNota(true)}>
                  Editar
                </button>
              )}
            </p>
          ) : (
            <button type="button" className="link sm" onClick={() => setEditandoNota(true)}>
              Deixar um recado para o studio
            </button>
          )}
        </div>
      )}

      <div className="row envio-acoes">
        {podeEnviar && (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={() => input.current && input.current.click()}>
              <Upload size={13} /> {enviando ? 'Enviando…' : arquivos.length ? 'Enviar mais arquivos' : 'Enviar arquivos'}
            </button>
            <input ref={input} type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" hidden onChange={escolher} />
          </>
        )}
        {isStudio &&
          (aberto ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => db.toggleSub(s.id, b.id)}>
              <Check size={13} /> Conferido, concluir pedido
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => db.toggleSub(s.id, b.id)}>
              <RotateCcw size={13} /> Reabrir pedido
            </button>
          ))}
        {!isStudio && !aberto && <span className="micro">O studio já conferiu este pedido.</span>}
      </div>
      {aviso && <p className="micro aviso-upload">{aviso}</p>}
    </li>
  );
}
