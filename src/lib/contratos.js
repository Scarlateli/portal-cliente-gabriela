/* Como um contrato ou termo é resolvido com o cliente (Etapa 6):
   - aceite:     termo — o cliente aprova ou recusa com um botão
   - portal:     o cliente assina dentro do portal (nome digitado)
   - autentique: assinatura com validade jurídica (contrato oficial)
   Registros antigos sem `method` seguem a regra do tipo. */
export const metodoDe = (c) => c.method || (c.kind === 'termo' ? 'aceite' : 'autentique');
