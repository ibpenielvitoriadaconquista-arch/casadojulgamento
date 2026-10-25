import Link from 'next/link';
import Head from 'next/head';
import {SESSION_TICKETS,EVEN3_EVENT} from '../lib/even3-sessions';
import {ticketStyle} from '../lib/even3-styles';
export default function Ingressos(){return <><Head><title>Ingressos | Casa do Julgamento 2026 — Peniel</title>
 <meta name="description" content="Escolha uma das seis datas da Casa do Julgamento 2026. Valor: R$ 15 + 1 kg de alimento por pessoa."/></Head>
 <style>{ticketStyle}</style>
 <div className="evt"><header className="evbar"><nav className="evwrap evtop">
 <Link className="evbrand" href="/">IGREJA BATISTA PENIEL<small>Casa do Julgamento 2026</small></Link>
 <Link className="evback" href="/">Voltar ao site</Link>
 </nav></header><main className="evwrap"><section className="evhero">
 <p className="eveye">Vitória da Conquista · Novembro 2026</p><h1>Ingressos para a Casa do Julgamento</h1>
 <p className="evlede">Clique em Comprar ingressos para escolher a data e a quantidade na Even3. Confira a entrada e a disponibilidade antes de pagar.</p>
 <div className="evnotice"><b>Os horários indicam a abertura dos portões</b>, não o início da apresentação. Os grupos são organizados após sua chegada e o credenciamento.</div>
 <p><a className="evbtn" href={EVEN3_EVENT}>COMPRAR INGRESSOS →</a></p></section><div className="evgrid">{SESSION_TICKETS.map(s=><article className="evcard" key={s.dia}><div className="evinfo">
 <p className="evlabel">DATAS E HORÁRIOS</p><h3>{s.date}</h3>
 <p className="evfacts">Portões: <b>{s.time}</b> · Ingresso: <b>R$ 15</b></p>
 <p className="evsmall">+ 1 kg de alimento não perecível por pessoa. Confira taxas, categoria e vagas na Even3.</p>
 </div></article>)}</div>
 <p className="evcheck">O pagamento e a emissão do ingresso individual com QR Code são realizados pela Even3. Confira o dia na página de pagamento e guarde seu ingresso.</p>
 <p>Igreja Batista Peniel · Rua Olavo Bilac, 94 — Centro, Vitória da Conquista, BA.</p>
 <p>Os alimentos apoiam o Projeto Refrigério.</p></main></div></>}
