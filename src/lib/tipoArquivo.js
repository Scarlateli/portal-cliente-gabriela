// 'pdf' | 'imagem' | 'outro', pelo nome do arquivo (visualizador e miniaturas)
export const tipoArquivo = (nome = '') => {
  const ext = String(nome).toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return ext === 'heic' ? 'outro' : 'imagem';
  return 'outro';
};
