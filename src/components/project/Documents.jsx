import { useState, useRef } from 'react';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { DOC_TYPES } from '../../lib/constants.js';
import { fmt } from '../../lib/helpers.js';

export function Documents({ db, project, isStudio }) {
  const docs = db.documents(project.id);
  const [filter, setFilter] = useState('');
  const [type, setType] = useState('geral');
  const fileRef = useRef(null);
  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f)
      db.addDocument(
        project.id,
        { name: f.name, type, size: (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB' },
        f,
      );
    e.target.value = '';
  };
  const openDoc = async (d) => {
    if (!d.storagePath) return;
    try {
      const url = await db.fileUrl(d.storagePath);
      if (url) window.open(url, '_blank', 'noopener');
    } catch {
      /* ignora — sem arquivo disponível */
    }
  };
  const shown = !filter ? docs : docs.filter((d) => d.type === filter);
  const typeLabel = (id) => (DOC_TYPES.find((t) => t.id === id) || { label: 'Geral' }).label;
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Documentos</h2>
        {isStudio && (
          <div className="head-actions">
            <select className="mini-select" value={type} onChange={(e) => setType(e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fileRef.current && fileRef.current.click()}
            >
              <Upload size={14} /> Enviar PDF
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onPick} />
          </div>
        )}
      </header>
      <div className="filter-row">
        {DOC_TYPES.map((t) => (
          <button
            key={t.id}
            className={'filter' + (filter === t.id ? ' on' : '')}
            onClick={() => setFilter(filter === t.id ? '' : t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty text={filter ? 'Nenhum documento nesta categoria.' : 'Nenhum documento ainda.'} />
      ) : (
        <ul className="doc-list">
          {shown.map((d) => (
            <li key={d.id} className="doc">
              <span className="doc-ic">
                <FileText size={18} />
              </span>
              <span className="doc-meta">
                <strong>{d.name}</strong>
                <small>
                  {typeLabel(d.type)} · {d.size} · {fmt(d.date)}
                </small>
              </span>
              <button
                className="icon-btn"
                title={d.storagePath ? 'Baixar' : 'Arquivo disponível ao conectar o Supabase'}
                onClick={() => openDoc(d)}
                disabled={!d.storagePath}
              >
                <Download size={16} />
              </button>
              {isStudio && (
                <button
                  className="icon-btn icon-del"
                  title="Excluir"
                  onClick={() => {
                    if (window.confirm('Excluir "' + d.name + '"?')) db.deleteDocument(d.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
