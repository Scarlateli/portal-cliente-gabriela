/* Link "Adicionar ao Google Agenda": abre a Agenda do Google já com o evento
   preenchido, sem precisar conectar a conta (nenhum dado sai do portal até a
   pessoa clicar em salvar lá). Com horário: compromisso de 1 hora no fuso de
   São Paulo. Sem horário: evento de dia inteiro. */

const doisDigitos = (n) => String(n).padStart(2, '0');

function proximoDia(dataISO) {
  const [a, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + 1));
  return dt.getUTCFullYear() + doisDigitos(dt.getUTCMonth() + 1) + doisDigitos(dt.getUTCDate());
}

export function linkGoogleAgenda({ title, date, time, link, projeto }) {
  if (!date) return null;
  const dia = date.replace(/-/g, '');
  let datas;
  if (time && /^\d{1,2}:\d{2}$/.test(time)) {
    const [h, min] = time.split(':').map(Number);
    const fimH = h + 1;
    // passa da meia-noite: termina às 23:59 para não cair no dia seguinte
    const fim = fimH >= 24 ? '235900' : doisDigitos(fimH) + doisDigitos(min) + '00';
    datas = `${dia}T${doisDigitos(h)}${doisDigitos(min)}00/${dia}T${fim}`;
  } else {
    datas = `${dia}/${proximoDia(date)}`;
  }
  const detalhes = [projeto ? 'Projeto: ' + projeto : '', link ? 'Link: ' + link : ''].filter(Boolean).join('\n');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title || 'Compromisso', dates: datas, ctz: 'America/Sao_Paulo' });
  if (detalhes) p.set('details', detalhes);
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
