import Link from 'next/link';
import VideoConvite from '../components/VideoConvite';
// Rota do flyer: arte de marca, vídeo central e um único CTA, sem menu nem links extras.
export default function Convite(){return <main className="container narrow" style={{textAlign:'center'}}>
  <p className="eyebrow">Igreja Batista Peniel · 2026</p>
  <h1 className="title">Casa do Julgamento</h1>
  <VideoConvite etiqueta="Vídeo do convite da Casa do Julgamento" />
  <Link href="/sessoes" className="btn">IR AO JULGAMENTO <span aria-hidden="true">→</span></Link>
 </main>}
