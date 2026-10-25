import Link from 'next/link';
import Head from 'next/head';
import {SESSION_TICKETS,byDay,EVEN3_EVENT} from '../../lib/even3-sessions';
import {ticketStyle} from '../../lib/even3-styles';

export function getStaticPaths(){return {paths:SESSION_TICKETS.map(s=>({params:{dia:s.dia}})),fallback:false}}
export function getStaticProps({params}){return {props:{session:byDay(params.dia)}}}
export default function Dia({session:s}){
 return <><Head><title>{s.date} | Casa do Julgamento 2026</title></Head><style>{ticketStyle}</style>
 <div className="evt"><header className="evbar"><nav className="evwrap evtop">
 <Link className="evbrand" href="/">IGREJA BATISTA PENIEL</Link>
 <Link className="evback" href="/ingressos">Voltar às datas</Link>
 </nav></header><main className="evwrap"><section className="evhero">
 <p className="eveye">INFORMAÇÕES DA DATA</p>
 <h1>Casa do Julgamento<br/>{s.date}</h1>
 <p className="evlede">Abertura dos portões: <b>{s.time}</b></p>
 <div className="evnotice"><b>Horário dos portões, não da apresentação.</b> Os grupos são formados somente após a chegada e o credenciamento.</div>
 <p>Ingresso: <b>R$ 15 + 1 kg de alimento não perecível por pessoa.</b> Taxas e disponibilidade são informadas pela Even3.</p>
 <p>Rua Olavo Bilac, 94 · Centro · Vitória da Conquista — BA.</p>
 {s.open?<><a className="evbtn" href={EVEN3_EVENT} rel="noreferrer">COMPRAR INGRESSOS →</a>
 <p className="evcheck">Na Even3, selecione a data e a quantidade de ingressos. <b>Antes de pagar, confira na Even3 se o nome da entrada corresponde à data {s.date}.</b> Caso apareça outra data, não conclua a compra e avise a organização. Preencha os dados solicitados pela Even3 e guarde seus ingressos.</p>
 </>:<p>O link desta data ainda não está configurado. <Link href="/ingressos">Consultar outras datas</Link>.</p>}
 </section></main></div></>
}
