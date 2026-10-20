import {query} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import checkout from '../../../lib/even3-checkout.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método inválido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req);
  if(!['geral','caixa'].includes(user.role))throw fail(403,'Apenas Caixa ou Gestão Geral.');
  if(req.method==='GET'){const r=await query('SELECT id,session_date::text,channel,participant_name,intended_quantity,payment_method,financial_status,even3_sale_reference,created_at FROM peniel_ops.cashier_attendances ORDER BY created_at DESC LIMIT 70');return res.json({ok:true,orders:r.rows,admission:false});}
  const i=req.body||{};
  const session=checkout.ENTRIES.find(x=>x.iso===i.session);
  if(!session)throw fail(400,'Escolha a data oficial.');
  const name=String(i.name||'').trim().replace(/\s+/g,' ');
  const contact=String(i.contact||'').trim().slice(0,120);
  const quantity=Number(i.quantity);
  const channel=String(i.channel||'');
  const payment=String(i.paymentMethod||'');
  const notes=String(i.notes||'').trim();
  if(name.length<2||name.length>150||/[<>\x00-\x1f]/.test(name)||!Number.isSafeInteger(quantity)||quantity<1||quantity>20||!['balcao','tablet_fila'].includes(channel)||!['pix_igreja','dinheiro','even3','outro'].includes(payment)||notes.length>500)throw fail(400,'Confira nome, quantidade, atendimento e forma de pagamento.');
  const r=await query('INSERT INTO peniel_ops.cashier_attendances(session_date,channel,participant_name,participant_contact,intended_quantity,payment_method,financial_status,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,created_at',[i.session,channel,name,contact||null,quantity,payment,'not_verified',notes||null,user.user_id]);
  return res.status(201).json({ok:true,orderId:r.rows[0].id,checkoutUrl:checkout.buildCheckoutUrl(session.ticket),status:'not_verified',message:'Atendimento registrado. Utilize o checkout oficial da Even3 para emitir ingressos. Pagamento não confirmado nem ingresso emitido.',admission:false});
 }catch(e){if(!e.status)console.error('cdj_caixa_error',{code:String(e.code||e.name||'unknown').slice(0,40)});return res.status(e.status||503).json({error:e.status?e.message:'Caixa indisponível. Nenhuma venda foi confirmada.'});}
}