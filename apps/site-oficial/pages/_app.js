import Link from 'next/link';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '../styles.css';

export default function App({Component,pageProps}){
  return (
    <>
      <Component {...pageProps}/>
      <footer style={{textAlign:'center',padding:'24px',fontSize:'13px',color:'#aab6c4'}}>
        Casa do Julgamento 2026 · Igreja Batista Peniel · <Link href="/ingressos">Ingressos</Link>
      </footer>
      <SpeedInsights />
    </>
  );
}