/* Visualizador de arquivos dentro do portal (rodada 10): PDF e imagem abrem
   numa janela, sem precisar baixar; ao lado (ou embaixo, no celular) pode
   vir um painel com ações, como "Aprovar / Pedir ajustes".
   O arquivo é buscado e mostrado como "blob:" do próprio portal, o que
   funciona com a política de segurança (CSP) e no iPad. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink, Loader2, FileText } from 'lucide-react';
import { tipoArquivo } from '../../lib/tipoArquivo.js';

export function Visualizador({ db, arquivo, onFechar, children = null }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState('');
  const fechar = useRef(null);
  const tipo = tipoArquivo(arquivo.name);

  useEffect(() => {
    let vivo = true;
    let objeto = null;
    (async () => {
      try {
        if (!arquivo.storagePath) throw new Error('sem arquivo');
        const assinado = await db.fileUrl(arquivo.storagePath);
        const r = await fetch(assinado);
        if (!r.ok) throw new Error('falhou');
        const blob = await r.blob();
        const certo = tipo === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob;
        objeto = URL.createObjectURL(certo);
        if (vivo) setUrl(objeto);
      } catch {
        if (vivo) setErro(arquivo.storagePath ? 'Não foi possível abrir o arquivo aqui.' : 'Arquivo indisponível no modo demonstração.');
      }
    })();
    return () => {
      vivo = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [db, arquivo.storagePath, tipo]);

  useEffect(() => {
    if (fechar.current) fechar.current.focus();
    const esc = (e) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = antes;
    };
  }, [onFechar]);

  const baixar = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const raiz = document.querySelector('.cp') || document.body;
  return createPortal(
    <div className="visu-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={'visu' + (children ? ' visu-com-lado' : '')} role="dialog" aria-modal="true" aria-label={arquivo.name}>
        <header className="visu-topo">
          <strong title={arquivo.name}>{arquivo.name}</strong>
          <div className="visu-acoes">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => url && window.open(url, '_blank', 'noopener')} disabled={!url}>
              <ExternalLink size={14} /> Abrir em nova aba
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={baixar} disabled={!url}>
              <Download size={14} /> Baixar
            </button>
            <button type="button" className="icon-btn" aria-label="Fechar" ref={fechar} onClick={onFechar}>
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="visu-corpo">
          <div className="visu-arquivo">
            {erro ? (
              <p className="visu-msg">
                <FileText size={20} /> {erro}
              </p>
            ) : !url ? (
              <p className="visu-msg">
                <Loader2 size={20} className="spin" /> Abrindo…
              </p>
            ) : tipo === 'pdf' ? (
              <iframe title={arquivo.name} src={url} />
            ) : tipo === 'imagem' ? (
              <img src={url} alt={arquivo.name} />
            ) : (
              <p className="visu-msg">
                <FileText size={20} /> Este tipo de arquivo não abre no navegador. Use “Baixar”.
              </p>
            )}
          </div>
          {children && <aside className="visu-lado">{children}</aside>}
        </div>
      </div>
    </div>,
    raiz,
  );
}
