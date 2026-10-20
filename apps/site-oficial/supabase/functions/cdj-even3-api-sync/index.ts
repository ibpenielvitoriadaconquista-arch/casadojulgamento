// Direct Even3 API V1 -> restricted staging snapshots. No admission or financial authorization.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const EVENT_ID="798621", BASE="https://www.even3.com.br/api/v1/";
const response=(status:number,body:Record<string,unknown>)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const value=(x:unknown,max=180):string|null=>typeof x==="string"||typeof x==="number"?String(x).trim().slice(0,max)||null:null;
const equal=(a:string,b:string)=>{const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);if(x.length!==y.length)return false;let r=0;for(let i=0;i<x.length;i++)r|=x[i]^y[i];return r===0;};
const items=(x:any):any[]=>Array.isArray(x)?x:Array.isArray(x?.data)?x.data:Array.isArray(x?.items)?x.items:Array.isArray(x?.results)?x.results:[];
async function remote(path:string,key:string){
 try {
  const res=await fetch(BASE+path,{method:"GET",headers:{"Authorization-Token":key,"Accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(12000)});
  if(!res.ok)return {ok:false,status:res.status,code:"http_"+res.status,body:null};
  const raw=await res.text();
  if(raw.length>2500000)return {ok:false,status:res.status,code:"response_too_large",body:null};
  return {ok:true,status:res.status,code:"ok",body:JSON.parse(raw)};
 }catch(e){return {ok:false,status:0,code:e instanceof SyntaxError?"invalid_json":"network_or_timeout",body:null};}
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return response(405,{ok:false,error:"method_not_allowed"});
 const url=Deno.env.get("SUPABASE_URL")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!service)return response(503,{ok:false,error:"supabase_backend_missing"});
 const db=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:secret,error:secretError}=await db.rpc("cdj_even3_get_sync_token");
 if(secretError||typeof secret!=="string"||secret.length<32)return response(503,{ok:false,error:"invocation_secret_unavailable"});
 const supplied=req.headers.get("x-cdj-sync-token")||"";
 if(!equal(supplied,secret))return response(401,{ok:false,error:"unauthorized"});
 const apiKey=Deno.env.get("EVEN3_API_KEY")||"";
 if(apiKey.length<20)return response(503,{ok:false,error:"even3_key_missing"});
 let mode="probe";
 try{const b=await req.json();mode=b?.mode==="sync"?"sync":b?.mode==="schema"?"schema":"probe";}catch{/* probe */}
 // The event endpoint determines whether the key belongs to event 798621.
 const event=await remote("event",apiKey);
 if(!event.ok)return response(502,{ok:false,mode,stage:"event",code:event.code,http_status:event.status,admission:false});
 const list=items(event.body);
 const obj=list.find((x:any)=>String(x?.id_event??x?.id??"")===EVENT_ID)
       ??(!Array.isArray(event.body)?event.body:null);
 const verified=String(obj?.id_event??obj?.id??"")===EVENT_ID;
 if(!verified)return response(422,{ok:false,mode,stage:"event",code:"event_id_mismatch_or_unrecognized_shape",response_shape:Array.isArray(event.body)?"array":typeof event.body,admission:false});
 if(mode==="probe")return response(200,{ok:true,mode,event_id:EVENT_ID,api_version:"v1",admission:false});
 if(mode==="schema") {
 const pay=await remote("payments",apiKey);
 const sample=items(pay.body)[0];
 return response(pay.ok?200:502,{ok:pay.ok,mode:"schema",stage:"payments",api_status:pay.status,
   keys:sample&&typeof sample==="object"?Object.keys(sample).slice(0,45):[],
   nested_fields:sample&&typeof sample==="object"?Object.fromEntries(Object.entries(sample).filter(([k,v])=>v&&typeof v==="object"&&!Array.isArray(v)).slice(0,6).map(([k,v])=>[k,Object.keys(v as any).slice(0,20)])):{},
   admission:false});
}

 const {data:run,error:runErr}=await db.from("cdj_even3_api_sync_runs").insert({mode:"sync"}).select("id").single();
 if(runErr||!run?.id)return response(503,{ok:false,code:"run_storage_unavailable"});
 const errors:string[]=[],counts:Record<string,number>={};
 const catalog={title:value(obj?.title??obj?.name,180),tickets:items(obj?.tickets).slice(0,200).map((t:any)=>({
  title:value(t?.title??t?.name,150),prices:items(t?.prices).slice(0,20).map((p:any)=>({
   id_ticket:value(p?.id_ticket,50),id_ticket_price:value(p?.id_ticket_price,50),price:value(p?.price,50)
  }))
 }))};
 const {error:catErr}=await db.from("cdj_even3_api_catalog").upsert({event_id:EVENT_ID,source:"v1",catalog},{onConflict:"event_id,source"});
 if(catErr)errors.push("catalog_storage_"+catErr.code);else counts.catalog=1;
 async function pageStore(kind:"attendees"|"payments",path:string) {
  const r=await remote(path,apiKey);
  if(!r.ok){errors.push(kind+"_"+r.code);return;}
  const parsed=items(r.body);
  counts[kind+"_response"]=parsed.length;
  if(parsed.length>5000){errors.push(kind+"_too_many");return;}
  // Deliberately do not infer event association when the API's response is missing id_event.
  const rows=parsed.filter((p:any)=>String(p?.id_event??p?.event_id??"")===EVENT_ID).map((p:any)=>{
   if(kind==="attendees"){
    const attendeeId=value(p?.id_attendees??p?.id_attendee,70);
    return attendeeId?{event_id:EVENT_ID,attendee_id:attendeeId,
     checkin_code:value(p?.checkin_code??p?.code,50),participant_name:value(p?.name,200),
     participant_email:value(p?.email,200),category_name:value(p?.registration_category,170),
     is_confirmed:typeof p?.confirmed==="boolean"?p.confirmed:null,upstream_version:"v1",retrieved_at:new Date().toISOString()}:null;
   }
   const paymentId=value(p?.id_payment,70);
   return paymentId?{event_id:EVENT_ID,payment_id:paymentId,
    reference:value(p?.reference_payment,160),payment_status:value(p?.status_payment??p?.status??p?.payment_status,60),
    amount_raw:value(p?.amount_payment??p?.amount,80),upstream_version:"v1",retrieved_at:new Date().toISOString()}:null;
  }).filter(Boolean);
  counts[kind+"_matched"]=rows.length;
  if(parsed.length>0&&rows.length===0){errors.push(kind+"_event_id_or_field_mapping_unverified");return;}
  const table=kind==="attendees"?"cdj_even3_api_attendees":"cdj_even3_api_payments";
  for(let i=0;i<rows.length;i+=100){
   const {error}=await db.from(table).upsert(rows.slice(i,i+100),{onConflict:kind==="attendees"?"event_id,attendee_id":"event_id,payment_id"});
   if(error){errors.push(kind+"_storage_"+error.code);break;}
  }
 }
 await pageStore("attendees","attendees/");
 await pageStore("payments","payments");
 const result=errors.length?"partial":"ok";
 await db.from("cdj_even3_api_sync_runs").update({finished_at:new Date().toISOString(),result,counts,error_codes:errors}).eq("id",run.id);
 return response(errors.length?207:200,{ok:!errors.length,mode,result,counts,error_codes:errors,admission:false});
});