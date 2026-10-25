import checkout from './even3-checkout.cjs';
export const EVEN3_EVENT='https://www.even3.com.br/tickets/get/casa-do-julgamento-2026-798621?even3_orig=get_tickets';
export const SESSION_TICKETS=checkout.ENTRIES.map(s=>({
  ...s,
  open:true, // Indica existência do link; estoque e pagamento são verificados pela Even3.
  even3:EVEN3_EVENT
}));
export const byDay=day=>SESSION_TICKETS.find(s=>s.dia===day);
export const TICKET_RELEASE_APPROVED=true;
