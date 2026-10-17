import Link from 'next/link';
import VideoConvite from '../components/VideoConvite';
export default function Home(){
 return <main className="container home">
  <nav className="miniNav" aria-label="Navegação principal"><Link className="site-mark" href="/">CASA DO <span>JULGAMENTO</span></Link><div className="nav-mini"><Link href="/divulgacao">Divulgar</Link><Link href="/caravana">Caravana</Link></div></nav>
  <section className="hero-grid" aria-labelledby="titulo-hero">
    <div className="hero-art"><img src="/artecoracao.jpg" alt="Cartaz do evento: coração anatômico preso em correntes, com identidade visual da Casa do Julgamento" loading="eager" /></div>
    <div className="hero-copy"><p className="eyebrow">Igreja Batista Peniel · 2026</p><h1 id="titulo-hero" className="title">Casa do Julgamento</h1><p className="pulse-line" aria-hidden="true">— ♥ —</p><p className="sub">Viva a Casa do Julgamento: uma experiência teatral imersiva sobre as escolhas que fazemos.</p><p className="caption">Vitória da Conquista · Bahia</p></div>
  </section>
  <section aria-labelledby="convite-video"><h2 id="convite-video" className="eyebrow" style={{textAlign:'center'}}>Seu convite começa aqui</h2><VideoConvite /></section>
  <p className="intro-message">Uma experiência que começa com um convite e continua com a sua decisão de participar.</p>
  <Link className="btn" href="/ingressos">ESCOLHER DATA E COMPRAR INGRESSO <span aria-hidden="true">→</span></Link><div className="nav-mini" style={{justifyContent:'center',margin:'22px 0'}}><Link href="/divulgacao">Ajudar na divulgação</Link><Link href="/caravana">Organizar caravana</Link></div><section className="evnotice" style={{padding:20,textAlign:'center'}}><p><b>09 a 21 de novembro · Seis sessões</b></p><p>R$15 + 1 kg de alimento não perecível por pessoa. Eventuais taxas são apresentadas na Even3.</p><p>Igreja Batista Peniel · Rua Olavo Bilac, 94 · Centro · Vitória da Conquista.</p><p>O horário é de abertura dos portões. Os grupos são formados após a chegada e o check-in.</p><Link href="/ingressos">Consultar todas as datas</Link></section></main>}