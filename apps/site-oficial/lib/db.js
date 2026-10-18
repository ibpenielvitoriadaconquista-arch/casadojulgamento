import pg from "pg";
const { Pool }=pg;
let pool;
function getPool(){
  let connectionString=process.env.DATABASE_URL||process.env.POSTGRES_URL;
  if(!connectionString) throw new Error("DATABASE_URL não configurado");
  let ssl;
  if(process.env.SUPABASE_CA_CERT){
    const url=new URL(connectionString);
    for(const key of ["sslmode","sslrootcert","sslcert","sslkey","uselibpqcompat"])url.searchParams.delete(key);
    connectionString=url.toString();
    ssl={ca:process.env.SUPABASE_CA_CERT.replace(/\\n/g,"\n"),rejectUnauthorized:true};
  }
  if(!pool) pool=new Pool({connectionString,...(ssl?{ssl}:{}),max:5,connectionTimeoutMillis:5000,statement_timeout:10000,query_timeout:11000});
  return pool;
}
export async function query(sql, params=[]){return getPool().query(sql,params);}
export async function transaction(fn){
  const client=await getPool().connect();
  try { await client.query("BEGIN"); const result=await fn(client);await client.query("COMMIT"); return result; }
  catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
  finally{client.release();}
}
