// Inbound HTTPS staging for Pluga. NO check-in, payment or authorization occurs here.
// Configure CDJ_PLUGA_WEBHOOK_SECRET in Supabase Edge Functions > Secrets.
// The default deny behavior intentionally rejects all calls until configured.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const PROJECT_EVENT="798621";
const MAX_BYTES=16000;
function json(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v:unknown,max=200){return typeof v==="string"||typeof v==="number"?String(v).trim().slice(0,max):"";}
function field(obj:unknown,path:string):unknown {return path.split(".").reduce((v:any,k)=>v&&typeof v==="object"?v[k]:undefined,obj);}
function eqSecret(a:string,b:string):boolean{
 const encoder=new TextEncoder(),x=encoder.encode(a),y=encoder.encode(b);
 if(x.length!==y.length)return false;
 let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
 return diff===0;
}
async function hash(s:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
 if(req.method!=="POST")return json(405,{ok:false,error:"method_not_allowed"});
 const secret=Deno.env.get("CDJ_PLUGA_WEBHOOK_SECRET")||"";
 if(secret.length<32)return json(503,{ok:false,error:"receiver_not_configured"});
 const supplied=req.headers.get("x-cdj-webhook-secret")||"";
 if(!eqSecret(supplied,secret))return json(401,{ok:false,error:"unauthorized"});
 const size=req.headers.get("content-length");
 if(size&&Number(size)>MAX_BYTES)return json(413,{ok:false,error:"payload_too_large"});
 const mime=req.headers.get("content-type")||"";
 if(!mime.toLowerCase().includes("application/json"))return json(415,{ok:false,error:"json_required"});
 let raw:string;
 try{raw=await req.text();}catch{return json(400,{ok:false,error:"invalid_body"});}
 if(new TextEncoder().encode(raw).length>MAX_BYTES)return json(413,{ok:false,error:"payload_too_large"});
 let input:any;
 try{input=JSON.parse(raw);}catch{return json(400,{ok:false,error:"invalid_json"});}
 if(!input||typeof input!=="object"||Array.isArray(input))return json(422,{ok:false,error:"invalid_payload"});
 const data=(input.data&&typeof input.data==="object")?input.data:input;
 const kind=clean(input.event_kind||input.source_action||"").toLowerCase();
 if(!["smoke_test","registration_confirmed","sale_approved","sale_cancelled","sale_refunded"].includes(kind))
   return json(422,{ok:false,error:"invalid_event_kind"});
 const eventId=clean(field(data,"evento.id")??input.event_id??field(data,"event_id"),30);
 if(eventId!==PROJECT_EVENT)return json(422,{ok:false,error:"event_mismatch"});
 const code=clean(field(data,"inscricao.codigo")??input.ticket_code,32);
 if(kind==="registration_confirmed"&&!/^[0-9]{6,20}$/.test(code))return json(422,{ok:false,error:"invalid_ticket_code"});
 const notification=clean(input.notification_id??field(input,"id"),120);
 const saleRef=clean(field(data,"venda.referencia")??input.sale_reference,120);
 // Minimal PII, no full raw input, payment card data or keys stored.
 const safePayload={
  event_id:eventId,event_kind:kind,
  ticket_code:code||null,
  participant_name:clean(field(data,"pessoa.nome")??input.participant_name,150)||null,
  participant_id:clean(field(data,"pessoa.id")??input.participant_id,100)||null,
  even3_registration_id:clean(field(data,"inscricao.id")??input.even3_registration_id,100)||null,
  ticket_category:clean(field(data,"inscricao.titulo")??input.ticket_category,160)||null,
  sale_reference:saleRef||null,
  source_sale_status:clean(field(data,"venda.situacao")??input.sale_status,50)||null,
  notification_id:notification||null
 };
 const encoded=JSON.stringify(safePayload);
 const digest=await hash(encoded);
 // Same normalized event is idempotent; identical retries cannot add extra rows.
 const key=await hash(kind+"|"+eventId+"|"+(notification||"")+"|"+digest);
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const url=Deno.env.get("SUPABASE_URL")||"";
 if(!serviceKey||!url)return json(503,{ok:false,error:"backend_not_configured"});
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:record,error}=await admin.from("cdj_pluga_https_inbox").upsert({
   delivery_key:key,payload_sha256:digest,event_id:eventId,event_kind:kind,
   ticket_code:code||null,sale_reference:saleRef||null,notification_id:notification||null,payload:safePayload
 },{onConflict:"delivery_key",ignoreDuplicates:true}).select("id").maybeSingle();
 if(error){console.error("cdj_pluga_intake_error",{code:error.code});return json(503,{ok:false,error:"storage_unavailable"});}
 return json(202,{ok:true,status:record?"received":"duplicate",admission:false});
});