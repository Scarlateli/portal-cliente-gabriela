import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { CamposEndereco } from './CamposEndereco.jsx';

/* Editar os dados do projeto e excluir o projeto (só o studio vê). A exclusão
   pede o código do projeto digitado: apaga etapas, documentos, contratos,
   pagamentos e os arquivos, e não tem como desfazer.
   `acoes`: outros botões do studio (reenviar acesso, finalizar), que entram
   na mesma linha e no mesmo tamanho. */
export function GerenciarProjeto({ db, project, onExcluido, acoes = null }) {
  const [aberto, setAberto] = useState(null); // 'editar' | 'excluir' | null
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');

  const abrirEdicao = () => {
    setF({
      code: project.code || '',
      name: project.name || '',
      address: project.address || '',
      addressComplement: project.addressComplement || '',
      neighborhood: project.neighborhood || '',
      cep: project.cep || '',
      city: project.city || '',
      state: project.state || '',
      greeting: project.greeting || '',
      start: project.start || '',
      due: project.due || '',
    });
    setAberto(aberto === 'editar' ? null : 'editar');
  };
  const campo = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valido = f && f.code.trim() && f.name.trim();

  const salvar = async () => {
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      await db.updateProject(project.id, { ...f, code: f.code.trim(), name: f.name.trim() });
      setAberto(null);
    } catch {
      /* erro exibido pelo ErrorBanner do contêiner */
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (confirmacao.trim() !== String(project.code).trim() || salvando) return;
    setSalvando(true);
    try {
      await db.deleteProject(project.id);
      onExcluido();
    } catch {
      setSalvando(false);
    }
  };

  return (
    <div className="gp">
      <div className="row gp-acoes">
        {acoes}
        <button type="button" className="btn btn-ghost btn-sm" onClick={abrirEdicao} aria-expanded={aberto === 'editar'}>
          <Pencil size={14} /> Editar dados do projeto
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm gp-perigo"
          onClick={() => {
            setConfirmacao('');
            setAberto(aberto === 'excluir' ? null : 'excluir');
          }}
          aria-expanded={aberto === 'excluir'}
        >
          <Trash2 size={14} /> Excluir projeto
        </button>
      </div>

      {aberto === 'editar' && f && (
        <section className="panel gp-painel">
          <div className="form-grid">
            <label className="lab">
              Código do projeto
              <input value={f.code} onChange={campo('code')} aria-label="Código do projeto" />
            </label>
            <label className="lab">
              Nome do projeto
              <input value={f.name} onChange={campo('name')} aria-label="Nome do projeto" />
            </label>
            <h4 className="form-sec">Endereço da obra</h4>
            <CamposEndereco f={f} setF={setF} />
            <h4 className="form-sec">Prazos e cumprimento</h4>
            <label className="lab">
              Início
              <input type="date" value={f.start} onChange={campo('start')} />
            </label>
            <label className="lab">
              Entrega prevista
              <input type="date" value={f.due} onChange={campo('due')} />
            </label>
            <label className="lab full">
              Como o portal cumprimenta (opcional)
              <input
                value={f.greeting}
                onChange={campo('greeting')}
                placeholder="ex.: Marília e Vitor · Família Silva"
                aria-label="Como o portal cumprimenta o cliente"
                maxLength={60}
              />
            </label>
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary btn-sm" disabled={!valido || salvando} onClick={salvar}>
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAberto(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}

      {aberto === 'excluir' && (
        <section className="panel gp-painel gp-painel-perigo" role="alertdialog" aria-labelledby="gp-excluir-titulo">
          <h3 id="gp-excluir-titulo">Excluir este projeto?</h3>
          <p>
            Saem junto as etapas, documentos, contratos, pagamentos, orçamentos e todos os arquivos enviados. O acesso do
            cliente a este projeto também acaba. Não há como desfazer.
          </p>
          <label className="lab">
            Para confirmar, digite o código do projeto: <strong>{project.code}</strong>
            <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} aria-label="Código do projeto, para confirmar a exclusão" />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn-perigo btn-sm"
              disabled={confirmacao.trim() !== String(project.code).trim() || salvando}
              onClick={excluir}
            >
              {salvando ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAberto(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
