// Even3 API pull -> protected snapshots ONLY. Never approve payment or admission.
// Invocation requires a legacy service_role JWT, not anon/user tokens.
// The event API key must be configured in the Supabase Edge Function secret EVEN3_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const EVENT="798621";
const MAX_ATTENDEES=5000;
function respond(status:number,body:Record<string,unknown>) {
 return Response.json(body,{status,headers:{"cache-control":"no-store"}});
}
function text(v:unknown,max=220):string|null{
 if(v===undefined||v===null)return null;
 const s=String(v).trim();return s?s.slice(0,max):null;
}
function arr(v:unknown):any[] {
 if(Array.isArray(v))return v;
 if(v&&typeof v==="object"){
  const x=v as Record<string,unknown>;
  if(Array.isArray(x.data))return x.data;
  if(Array.isArray(x.items))return x.items;
  if(Array.isArray(x.results))return x.results;
 }
 return [];
}
function same(a:string,b:string):boolean{
 const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
 if(x.length!==y.length)return false;
 let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;
}
async function get(url:string,headers:HeadersInit):Promise<{status:number,body:any|null,error?:string}>{
 let r:Response;
 try {r=await fetch(url,{method:"GET",headers,signal:AbortSignal.timeout(12500),redirect:"error"});}
 catch{return {status:0,body:null,error:"network_or_timeout"};}
 if(!r.ok)return {status:r.status,body:null,error:"http_"+r.status};
 let b:any;
 try {const raw=await r.text();if(raw.length>3500000)return {status:r.status,body:null,error:"response_too_large"};b=JSON.parse(raw);}
 catch {return {status:r.status,body:null,error:"invalid_json"};}
 return {status:r.status,body:b};
}
Deno.serve(async req=>{
 if(req.method!=="POST")return respond(405,{ok:false,error:"method_not_allowed"});
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const incoming=req.headers.get("authorization")||"";
 if(!service||!incoming.startsWith("Bearer ")||!same(incoming.slice(7),service))
   return respond(401,{ok:false,error:"admin_authorization_required"});
 const apiKey=Deno.env.get("EVEN3_API_KEY")||"";
 if(!apiKey||apiKey.length<20)return respond(503,{ok:false,error:"even3_key_not_configured"});
 const url=Deno.env.get("SUPABASE_URL")||"";
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false},db:{schema:"peniel_ops"}});
 const {data:run,error:runError}=await admin.from("even3_api_sync_runs").insert({mode:"sync"}).select("id").single();
 if(runError||!run?.id)return respond(503,{ok:false,error:"sync_storage_unavailable"});
 const counts:Record<string,number>={};
 const errors:string[]=[];
 let version="v1";
 try{
  const headers={"Authorization-Token":apiKey,"Accept":"application/json"};
  const base="https://www.even3.com.br/api/v1/";
  const event=await get(base+"event",headers);
  const eventObj=arr(event.body)[0];
  if(event.status!==200||!eventObj||String(eventObj.id_event)!==EVENT) {
    errors.push(event.error||"event_id_mismatch_or_missing");
  }else{
    counts.event=1;
    const catalog={title:text(eventObj.title,200),tickets:Array.isArray(eventObj.tickets)?eventObj.tickets.map((t:any)=>({
      title:text(t.title,170),prices:Array.isArray(t.prices)?t.prices.map((p:any)=>({
        id_ticket:text(p.id_ticket,50),id_ticket_price:text(p.id_ticket_price,50),price:p.price??null
      })):[]})) : []};
    const {error}=await admin.from("even3_api_catalog").upsert({event_id:EVENT,source:"v1",catalog,retrieved_at:new Date().toISOString()},{onConflict:"event_id,source"});
    if(error)errors.push("catalog_db_"+error.code);
    const attendees=await get(base+"attendees/",headers);
    if(attendees.status===200){
      const people=arr(attendees.body);
      counts.attendees_reported=people.length;
      if(people.length>MAX_ATTENDEES){errors.push("too_many_attendees");}
      else {
        const rows=people.filter((p:any)=>String(p.id_event)===EVENT && text(p.id_attendees,50)).map((p:any)=>({
          event_id:EVENT,attendee_id:text(p.id_attendees,50),checkin_code:text(p.checkin_code,30),
          participant_name:text(p.name,200),participant_email:text(p.email,200),
          category_name:text(p.registration_category,200),is_confirmed:typeof p.confirmed==="boolean"?p.confirmed:null,
          upstream_version:"v1",retrieved_at:new Date().toISOString()
        }));
        for(let i=0;i<rows.length;i+=100){
          const {error}=await admin.from("even3_api_attendees").upsert(rows.slice(i,i+100),{onConflict:"event_id,attendee_id"});
          if(error){errors.push("attendees_db_"+error.code);break;}
        }
        counts.attendees_saved=rows.length;
      }
    }else errors.push("attendees_"+(attendees.error||attendees.status));
    const payments=await get(base+"payments",headers);
    if(payments.status===200){
      const items=arr(payments.body);
      counts.payment_rows_returned=items.length;
      // Payments list may have duplicate item lines. Preserve only ID / reference / raw amount.
      const uniq=new Map<string,any>();
      for(const p of items){
        if(String(p.id_event)!==EVENT)continue;
        const id=text(p.id_payment,70);
        if(!id)continue;
        uniq.set(id,{event_id:EVENT,payment_id:id,reference:text(p.reference_payment,150),
          payment_status:text(p.status??p.payment_status,80),amount_raw:text(p.amount,80),
          upstream_version:"v1",retrieved_at:new Date().toISOString()});
      }
      const rows=[...uniq.values()];
      for(let i=0;i<rows.length;i+=100){
        const {error}=await admin.from("even3_api_payments").upsert(rows.slice(i,i+100),{onConflict:"event_id,payment_id"});
        if(error){errors.push("payments_db_"+error.code);break;}
      }
      counts.payments_saved=rows.length;
    }else errors.push("payments_"+(payments.error||payments.status));
  }
 }catch(e){errors.push("sync_exception");console.error("even3_sync_exception",{name:e instanceof Error?e.name:"unknown"});}
 const result=errors.length===0?"ok":counts.event===1?"partial":"error";
 const {error:updateError}=await admin.from("even3_api_sync_runs").update({finished_at:new Date().toISOString(),api_version:version,result,counts,error_codes:errors}).eq("id",run.id);
 if(updateError)console.error("even3_run_update_failed",{code:updateError.code});
 return respond(result==="ok"?200:result==="partial"?207:502,{ok:result==="ok",result,counts,error_codes:errors,admission:false});
});