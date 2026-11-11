import SessionHeartbeat from '../components/SessionHeartbeat';
import Link from 'next/link';
import {useEffect} from 'react';
import {useRouter} from 'next/router';
import {Analytics} from '@vercel/analytics/next';
import {track} from '@vercel/analytics';
import '../styles.css';

const publicPage=path=>['/','/ingressos','/convite','/divulgacao','/caravana'].includes(path)||/^\/ingressos\/(09|13|14|19|20|21)-11$/.test(path);
const campaignValues={utm_source:['instagram','whatsapp','igreja','qr','facebook'],utm_medium:['social','mensagem','impresso','qrcode'],utm_campaign:['casa2026']};
function beforeSend(event){
 try{
  const url=new URL(event.url);
  if(!publicPage(url.pathname))return null;
  const clean=new URL(url.origin+url.pathname);
  for(const [key,allowed] of Object.entries(campaignValues)){const value=url.searchParams.get(key);if(allowed.includes(value))clean.searchParams.set(key,value);}
  return {...event,url:clean.href};
 }catch{return null;}
}
export default function App({Component,pageProps}){
 const router=useRouter(),isPublic=publicPage(router.pathname)||router.pathname==='/ingressos/[dia]';
 useEffect(()=>{
  if(!isPublic)return;
  function click(event){
   const a=event.target.closest?.('a[href]');if(!a)return;
   try{const url=new URL(a.href);if(url.hostname!=='www.even3.com.br'||!url.pathname.includes('casa-do-julgamento-2026-798621'))return;
    track('Comprar ingresso',{pagina:window.location.pathname});
   }catch{/* A medição nunca deve impedir a navegação. */}
  }
  document.addEventListener('click',click);return()=>document.removeEventListener('click',click);
 },[isPublic]);
 const operational=router.pathname.startsWith('/operacao/')&&!['/operacao/login','/operacao/ativar','/operacao/redefinir','/operacao/recuperar','/operacao/solicitar'].includes(router.pathname)&&!router.pathname.startsWith('/operacao/demo');
 return <>{operational&&<SessionHeartbeat/>}<Component {...pageProps}/>{isPublic&&<Analytics beforeSend={beforeSend}/>}<footer style={{textAlign:'center',padding:'24px',fontSize:'13px',color:'#aab6c4'}}>Casa do Julgamento 2026 · Igreja Batista Peniel · <Link href="/ingressos">Ingressos</Link></footer></>;
}
