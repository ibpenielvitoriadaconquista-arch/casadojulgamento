import {createHmac,timingSafeEqual} from 'node:crypto';
const roles=Object.freeze({
 'testeportaria@gmail.com':'portaria',
 'testeguia@gmail.com':'guias',
 'testeapoio@gmail.com':'apoio',
 'testecoordenacao@gmail.com':'coordenacao',
 'testecaixa@gmail.com':'caixa'
});
export function demoRole(email){return roles[String(email||'').toLowerCase()]||null;}
const compare=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
function secret(){const v=process.env.CDJ_DEMO_SESSION_SECRET||'';return v.length>=32?v:null;}
function sign(data){return createHmac('sha256',secret()).update(data).digest('hex');}
export function demoCookie(email){const role=demoRole(email),key=secret();if(!role||!key)throw Error('demo_disabled');const expires=Date.now()+2*60*60*1000;const data=Buffer.from(JSON.stringify({role,email:String(email).toLowerCase(),expires})).toString('base64url');return data+'.'+sign(data);}
export function getDemoActor(req){try{const token=req.cookies?.peniel_demo||'';const [data,mac]=token.split('.');if(!data||!mac||!secret()||!compare(sign(data),mac))return null;const parsed=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));if(parsed.expires<Date.now()||parsed.expires>Date.now()+3*60*60*1000||demoRole(parsed.email)!==parsed.role)return null;return parsed;}catch{return null;}}
export function checkDemo(email,password){const expected=process.env.CDJ_DEMO_PASSWORD||'';return Boolean(demoRole(email)&&expected.length>=8&&compare(password,expected));}
export function demoSetCookie(token){return 'peniel_demo='+token+'; Max-Age=7200; HttpOnly; Secure; SameSite=Strict; Path=/operacao/demo';}
