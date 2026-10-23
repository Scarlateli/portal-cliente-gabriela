import { useState, useRef, useEffect } from 'react';
import { FolderUp, Folder, FolderOpen, ChevronRight, Upload, Download, Trash2, Plus, Check, RotateCcw, CalendarDays, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { fmt, validarArquivo } from '../../lib/helpers.js';
import { prazoSub } from '../../lib/etapas.js';
import { IS_SUPABASE } from '../../lib/data.js';
import { useAvisos } from '../../lib/avisosContexto.js';
import { Visualizador } from './Visualizador.jsx';
import { tipoArquivo } from '../../lib/tipoArquivo.js';

/* Envios do cliente (rodada 4): o studio cria pedidos de arquivo (são
   sub-etapas com "pedir arquivos" marcado) e o cliente manda quantos
   arquivos precisar em cada um, de uma vez, com um recado opcional.
   Rodada 6: quando mandou tudo, o cliente clica em "Concluir entrega" e o
   pedido trava para ele (o banco garante); o studio confere e conclui, ou
   devolve ao cliente. */
export function EnviosCliente({ db, project, isStudio, abrir = () => {} }) {
  const stages = db.stages(project.id);
  const { ocultos } = useAvisos();
  const arquivos = ((db.subArquivos && db.subArquivos(project.id)) || []).filter((a) => !ocultos.has(a.id));
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
          ? 'Peça aqui os arquivos que o cliente precisa mandar (plantas, fotos, referências). Ele envia vários de uma vez e, no fim, conclui a entrega.'
          : 'Aqui ficam todos os arquivos que solicitamos a você. Em cada pedido, faça o upload de quantos arquivos forem necessários e, quando finalizar, conclua a entrega.'}
      </p>
      {isStudio && criando && <NovoPedido db={db} project={project} stages={stages} onFechar={() => setCriando(false)} />}
      {isStudio && !stages.length && <p className="hint">Crie as etapas do projeto antes de pedir arquivos.</p>}
      {pedidos.length === 0 ? (
        <Empty
          text={
            isStudio
              ? 'Nenhum pedido de arquivos ainda. Use “Novo pedido de arquivos” para pedir plantas, fotos ou referências.'
              : 'Nenhum arquivo pedido no momento. Quando o studio precisar de algo seu, o pedido aparece aqui.'
          }
        />
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
  const { avisar, excluirComDesfazer } = useAvisos();
  const input = useRef(null);
  const [enviando, setEnviando] = useState(false);
  // rodada 10: arrastar e soltar, situação de cada arquivo e visualizador
  const [arrastando, setArrastando] = useState(false);
  const [fila, setFila] = useState([]); // [{ nome, estado: 'esperando'|'enviando'|'ok'|'erro' }]
  const [vendo, setVendo] = useState(null);
  const [aviso, setAviso] = useState('');
  // rodada 12: recado sempre à vista para o cliente (antes ficava escondido num link)
  const [nota, setNota] = useState(b.clientNote || '');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const notaMudou = nota.trim() !== String(b.clientNote || '').trim();
  const [confirmando, setConfirmando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  // rodada 12: os arquivos enviados ficam numa "pasta" fechada; abre quando quiser ver
  const [pastaAberta, setPastaAberta] = useState(false);
  const [baixando, setBaixando] = useState('');
  const baixaveis = arquivos.filter((a) => a.storagePath);
  const baixarZip = async () => {
    setAviso('');
    setBaixando('Preparando…');
    try {
      const { baixarTodos } = await import('../../lib/baixarTodos.js');
      await baixarTodos(db, baixaveis, b.title, (i, n) => setBaixando('Baixando ' + i + ' de ' + n + '…'));
    } catch (e) {
      setAviso((e && e.message) || 'Não foi possível baixar os arquivos.');
    } finally {
      setBaixando('');
    }
  };
  const aberto = !b.done;
  const entregue = aberto && !!b.entregueEm;
  // entregue, o prazo já não pesa: mostra só a data, sem "atrasada"
  const pz = prazoSub(entregue ? { ...b, done: true } : b);
  // depois de concluir a entrega, o cliente não mexe mais no pedido
  const clienteMexe = !isStudio && aberto && !entregue && b.responsible === 'cliente';
  const podeEnviar = aberto && (isStudio || clienteMexe);
  const concluir = async () => {
    setConcluindo(true);
    try {
      await db.concluirEntrega(s.id, b.id);
      avisar('Entrega concluída. O studio foi avisado.');
      setConfirmando(false);
    } catch (e) {
      setAviso((e && e.message) || 'Não foi possível concluir a entrega. Tente de novo.');
    } finally {
      setConcluindo(false);
    }
  };

  // um arquivo de cada vez, para mostrar a situação de cada um
  const enviarLista = async (lista) => {
    if (!lista.length || enviando) return;
    const recusados = lista.map((f) => [f, validarArquivo(f)]).filter(([, p]) => p);
    const ok = lista.filter((f) => !validarArquivo(f));
    setAviso(recusados.length ? recusados.map(([f, p]) => f.name + ': ' + p).join(' ') : '');
    if (!ok.length) return;
    setEnviando(true);
    setFila(ok.map((f) => ({ nome: f.name, estado: 'esperando' })));
    const marcar = (i, estado) => setFila((l) => l.map((x, j) => (j === i ? { ...x, estado } : x)));
    let enviados = 0;
    try {
      for (let i = 0; i < ok.length; i++) {
        marcar(i, 'enviando');
        try {
          await db.enviarArquivos(projectId, b.id, [ok[i]], isStudio ? 'studio' : 'client');
          marcar(i, 'ok');
          enviados++;
        } catch {
          marcar(i, 'erro');
        }
      }
      if (enviados) avisar(enviados === 1 ? 'Arquivo enviado' : enviados + ' arquivos enviados');
      if (enviados < ok.length) setAviso('Alguns arquivos não foram enviados. Tente de novo.');
    } finally {
      setEnviando(false);
      setTimeout(() => setFila((l) => l.filter((x) => x.estado === 'erro')), 2500);
    }
  };
  const escolher = (e) => {
    const lista = Array.from(e.target.files || []);
    e.target.value = '';
    enviarLista(lista);
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
          <span className={'pill ' + (!aberto || entregue ? 'pill-done' : arquivos.length ? 'pill-now' : 'pill-todo')}>
            {!aberto
              ? 'Concluído'
              : entregue
                ? 'Entrega concluída'
                : arquivos.length
                ? arquivos.length + (arquivos.length === 1 ? ' arquivo enviado' : ' arquivos enviados')
                : 'Aguardando arquivos'}
          </span>
        </span>
      </div>
      {b.instructions && <p className="envio-instrucoes">{b.instructions}</p>}

      {arquivos.length > 0 && (
        <div className={'envio-arquivos-bloco' + (pastaAberta ? ' pasta-aberta' : '')}>
          <div className="envio-arquivos-topo">
            <button type="button" className="pasta" aria-expanded={pastaAberta} onClick={() => setPastaAberta(!pastaAberta)}>
              {pastaAberta ? <FolderOpen size={15} aria-hidden /> : <Folder size={15} aria-hidden />}
              <span>{arquivos.length + (arquivos.length === 1 ? ' arquivo enviado' : ' arquivos enviados')}</span>
              {arquivos.some((a) => a.nota) && <small>com observações</small>}
              <ChevronRight size={14} className="pasta-seta" aria-hidden />
            </button>
            {baixaveis.length > 1 && (
              <button type="button" className="link sm" disabled={!!baixando} onClick={baixarZip}>
                <Download size={12} /> {baixando || 'Baixar todos (.zip)'}
              </button>
            )}
          </div>
          {pastaAberta && (
            <ul className="envio-arquivos">
              {arquivos.map((a) => (
                <ArquivoEnviado
                  key={a.id}
                  db={db}
                  projectId={projectId}
                  a={a}
                  podeRemover={isStudio || (clienteMexe && a.sentBy === 'client')}
                  podeAnotar={clienteMexe && a.sentBy === 'client'}
                  onVer={() => setVendo(a)}
                  onRemover={() =>
                    excluirComDesfazer({ id: a.id, texto: '"' + a.name + '" removido', executar: () => db.removerArquivo(projectId, a.id) })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {clienteMexe ? (
        <div className="envio-recado">
          <label htmlFor={'recado-' + b.id}>
            <MessageSquare size={14} aria-hidden /> Recado para o studio <span>(opcional)</span>
          </label>
          <textarea
            id={'recado-' + b.id}
            rows={2}
            maxLength={1000}
            placeholder="Algo que o studio precisa saber sobre estes arquivos?"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          {notaMudou && (
            <div className="row">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={salvandoNota}
                onClick={async () => {
                  setSalvandoNota(true);
                  try {
                    await db.setNotaPedido(s.id, b.id, nota);
                    avisar('Recado salvo');
                  } catch (e) {
                    setAviso((e && e.message) || 'Não foi possível salvar o recado.');
                  } finally {
                    setSalvandoNota(false);
                  }
                }}
              >
                {salvandoNota ? 'Salvando…' : 'Salvar recado'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNota(b.clientNote || '')}>
                Desfazer
              </button>
            </div>
          )}
        </div>
      ) : (
        b.clientNote && (
          <div className="envio-recado envio-recado-lido">
            <span className="envio-recado-rot">
              <MessageSquare size={14} aria-hidden /> {isStudio ? 'Recado do cliente' : 'Seu recado'}
            </span>
            <p>{b.clientNote}</p>
          </div>
        )
      )}

      {entregue && (
        <p className="envio-entregue">
          <Check size={14} />{' '}
          {isStudio
            ? 'O cliente concluiu a entrega' + (b.entregueEm ? ' em ' + fmt(String(b.entregueEm).slice(0, 10)) : '') + '. Confira os arquivos.'
            : 'Entrega concluída' + (b.entregueEm ? ' em ' + fmt(String(b.entregueEm).slice(0, 10)) : '') + '. O studio vai conferir os arquivos.'}
        </p>
      )}

      <div className="row envio-acoes">
        {podeEnviar && (
          <div
            className={'soltar' + (arrastando ? ' soltar-ativo' : '')}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              enviarLista(Array.from(e.dataTransfer.files || []));
            }}
          >
            <Upload size={18} aria-hidden />
            <span className="soltar-texto">
              <strong>{arrastando ? 'Solte para enviar' : 'Arraste os arquivos aqui'}</strong>
              <small>PDF, fotos, Word ou Excel · até 20 MB cada</small>
            </span>
            <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={() => input.current && input.current.click()}>
              {enviando ? 'Enviando…' : arquivos.length ? 'Escolher mais arquivos' : 'Escolher arquivos'}
            </button>
            <input ref={input} type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" hidden onChange={escolher} />
          </div>
        )}
        {fila.length > 0 && (
          <ul className="fila" aria-live="polite">
            {fila.map((x, i) => (
              <li key={i} className={'fila-' + x.estado}>
                <span>{x.nome}</span>
                <em>{{ esperando: 'na fila', enviando: 'enviando…', ok: 'enviado ✓', erro: 'não enviado' }[x.estado]}</em>
              </li>
            ))}
          </ul>
        )}
        {isStudio &&
          (aberto ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => db.toggleSub(s.id, b.id)}>
                <Check size={13} /> Conferido, concluir pedido
              </button>
              {entregue && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => db.reabrirPedido(s.id, b.id)}>
                  <RotateCcw size={13} /> Devolver ao cliente
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => db.reabrirPedido(s.id, b.id)}>
              <RotateCcw size={13} /> Reabrir pedido
            </button>
          ))}
        {!isStudio && !aberto && (
          <span className="envio-validado">
            <Check size={12} /> Envio validado pelo studio.
          </span>
        )}
      </div>
      {clienteMexe && arquivos.length > 0 && (
        <div className="envio-concluir">
          {confirmando ? (
            <>
              <p>Depois de concluir, você não poderá mais trocar os arquivos nem o recado deste pedido. Se precisar, peça ao studio para reabrir.</p>
              <div className="row">
                <button type="button" className="btn btn-primary btn-sm" disabled={concluindo} onClick={concluir}>
                  <Check size={13} /> {concluindo ? 'Concluindo…' : 'Sim, concluir entrega'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmando(false)}>
                  Voltar
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Já mandou tudo o que precisava? Conclua a entrega para o studio saber que pode conferir.</p>
              <div className="row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmando(true)}>
                  <Check size={13} /> Concluir entrega
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {aviso && <p className="micro aviso-upload">{aviso}</p>}
      {vendo && <Visualizador db={db} arquivo={vendo} onFechar={() => setVendo(null)} />}
    </li>
  );
}

/* Um arquivo da pasta (rodada 12): nome (abre o visualizador), tamanho e
   data em letra menor, e a observação do cliente sobre ele. O cliente
   escreve a observação enquanto o pedido está aberto; o studio só lê. */
function ArquivoEnviado({ db, projectId, a, podeRemover, podeAnotar, onVer, onRemover }) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(a.nota || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      await db.anotarArquivo(projectId, a.id, texto);
      setEditando(false);
      avisar('Observação salva');
    } catch (e) {
      setErro((e && e.message) || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };
  return (
    <li>
      <div className="arq-linha">
        <Miniatura db={db} a={a} />
        <span className="arq-info">
          <button type="button" className="link sm arq-nome" onClick={onVer} title="Ver o arquivo">
            {a.name}
          </button>
          <span className="arq-meta">
            {a.size ? a.size + ' · ' : ''}
            {a.createdAt ? fmt(String(a.createdAt).slice(0, 10)) : ''}
            {a.sentBy === 'studio' ? ' · enviado pelo studio' : ''}
          </span>
        </span>
        {podeAnotar && !editando && (
          <button type="button" className="link sm arq-anotar" onClick={() => setEditando(true)}>
            {a.nota ? 'Editar observação' : 'Escrever sobre esta referência'}
          </button>
        )}
        {podeRemover && (
          <button type="button" className="icon-x" aria-label={'Remover ' + a.name} onClick={onRemover}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {editando ? (
        <div className="arq-nota-form">
          <textarea
            rows={2}
            maxLength={500}
            autoFocus
            aria-label={'Observação sobre ' + a.name}
            placeholder="Ex.: gosto da cor da parede, não do piso"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="row">
            <button type="button" className="btn btn-primary btn-sm" disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setTexto(a.nota || '');
                setEditando(false);
              }}
            >
              Cancelar
            </button>
            {erro && <span className="micro aviso-upload">{erro}</span>}
          </div>
        </div>
      ) : (
        a.nota && <p className="arq-nota">“{a.nota}”</p>
      )}
    </li>
  );
}

/* Miniatura das fotos enviadas (rodada 10); outros arquivos ganham um ícone */
function Miniatura({ db, a }) {
  const [url, setUrl] = useState(null);
  const imagem = tipoArquivo(a.name) === 'imagem' && a.storagePath && !!db.fileUrl;
  useEffect(() => {
    if (!imagem) return undefined;
    let vivo = true;
    Promise.resolve(db.fileUrl(a.storagePath))
      .then((u) => vivo && setUrl(u))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [db, a.storagePath, imagem]);
  return (
    <span className="mini" aria-hidden>
      {url ? <img src={url} alt="" loading="lazy" /> : <FileText size={14} />}
    </span>
  );
}
