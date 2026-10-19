/* Endereço do projeto: guardado completo (rua e número, complemento,
   bairro, CEP, cidade, estado) e mostrado na forma curta nas telas. */

export const formatarCep = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
};

// "Rua Francisca Júlia, 215, Apto 72 · Santana, São Paulo/SP"
export function enderecoCurto(p) {
  if (!p) return '';
  const rua = [p.address, p.addressComplement].filter((x) => x && String(x).trim()).join(', ');
  const cidade = [p.city, p.state].filter((x) => x && String(x).trim()).join('/');
  const lugar = [p.neighborhood, cidade].filter((x) => x && String(x).trim()).join(', ');
  return [rua, lugar].filter(Boolean).join(' · ');
}

// com CEP, para o histórico em PDF e onde couber
export function enderecoCompleto(p) {
  const curto = enderecoCurto(p);
  return p && p.cep ? (curto ? curto + ' · CEP ' + p.cep : 'CEP ' + p.cep) : curto;
}

// Como o portal cumprimenta quem entra: o vocativo cadastrado ou, sem ele,
// o primeiro nome do cliente.
export function vocativo(greeting, nome) {
  const v = String(greeting || '').trim();
  if (v) return v;
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

export const ENDERECO_VAZIO = { address: '', addressComplement: '', neighborhood: '', cep: '', city: '', state: '' };
