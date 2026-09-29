/* Tradução de erros técnicos para linguagem de gente.

   O Supabase, o navegador e o Storage devolvem mensagens em inglês feitas
   para programador ("new row violates row-level security policy", "Failed
   to fetch"). Nada disso deve chegar cru à Gabriela ou a um cliente.

   Regra: se reconhecemos o erro, devolvemos uma frase que diz o que houve
   e o que fazer. Se a mensagem já foi escrita por nós em português, ela
   passa como está. Se é algo técnico desconhecido, cai numa frase
   genérica — e o original fica disponível como "detalhe técnico". */

const REGRAS = [
  {
    teste: /failed to fetch|networkerror|load failed|network request failed|fetch failed/i,
    texto: 'Sem conexão com a internet. Confira sua rede e tente de novo.',
  },
  {
    teste: /jwt expired|invalid jwt|refresh token|session.*(expired|missing)|not authenticated|não autenticado/i,
    texto: 'Sua sessão expirou. Saia e entre novamente para continuar.',
  },
  {
    teste: /row-level security|permission denied|42501|apenas o studio|not allowed/i,
    texto: 'Você não tem permissão para fazer esta alteração.',
  },
  {
    teste: /exceeded the maximum allowed size|payload too large|entity too large|\b413\b/i,
    texto: 'O arquivo passa do limite de 20 MB. Tente comprimir o PDF ou reduzir a imagem.',
  },
  {
    teste: /mime type|invalid_mime|not supported.*type/i,
    texto: 'Formato de arquivo não aceito. Envie PDF, imagem ou documento do Office.',
  },
  {
    teste: /duplicate key|23505|already exists/i,
    texto: 'Esse item já existe.',
  },
  {
    teste: /violates foreign key|23503/i,
    texto: 'Não foi possível concluir porque há itens ligados a este registro.',
  },
  {
    teste: /timeout|timed out|statement canceled/i,
    texto: 'O servidor demorou para responder. Tente de novo em instantes.',
  },
];

// Mensagens escritas por nós (edge functions, validações) já vêm em
// português — reconhecemos pelos acentos ou por palavras muito comuns.
const PARECE_PORTUGUES = /[áàâãéêíóôõúç]|\b(não|nao|para|arquivo|contrato|cliente|studio|anexe|documento)\b/i;

export function erroAmigavel(erro) {
  const original = erro ? erro.message || String(erro) : '';
  if (!original) {
    return { texto: 'Algo deu errado. Tente novamente.', detalhe: null };
  }
  for (const r of REGRAS) {
    if (r.teste.test(original)) return { texto: r.texto, detalhe: original };
  }
  if (PARECE_PORTUGUES.test(original)) {
    // já é uma frase nossa; mostrar o "detalhe" seria repetir a mesma coisa
    const texto = original.charAt(0).toUpperCase() + original.slice(1);
    return { texto, detalhe: null };
  }
  return {
    texto: 'Não foi possível concluir a ação. Tente de novo — se continuar, avise o studio.',
    detalhe: original,
  };
}
