import Link from 'next/link';
import Head from 'next/head';
import {byDay} from '../../lib/even3-sessions';
import {ticketStyle} from '../../lib/even3-styles';
import {salesReleaseEnabled} from '../../lib/release-gate.cjs';

export function getServerSideProps({params}) {
 const session=byDay(params?.dia);
 if(!session)return {notFound:true};
 return {props:{session,salesEnabled:salesReleaseEnabled()}};
}

export default function Dia({session:s,salesEnabled}){
 const checkoutEnabled=salesEnabled&&s.open;
 return <><Head><title>{s.date} | Casa do Julgamento 2026</title></Head><style>{ticketStyle}</style>
 <div className="evt"><header className="evbar"><nav className="evwrap evtop">
 <Link className="evbrand" href="/">IGREJA BATISTA PENIEL</Link>
 <Link className="evback" href="/ingressos">Voltar às datas</Link>
 </nav></header><main className="evwrap"><section className="evhero">
 <p className="eveye">{checkoutEnabled?'CHECKOUT DA DATA SELECIONADA':'VENDAS EM PREPARAÇÃO'}</p>
 <h1>Casa do Julgamento<br/>{s.date}</h1>
 <p className="evlede">Abertura dos portões: <b>{s.time}</b></p>
 <div className="evnotice"><b>Horário dos portões, não da apresentação.</b> Os grupos são formados somente após a chegada e o credenciamento.</div>
 <p>Ingresso: <b>R$ 15 + 1 kg de alimento não perecível por pessoa.</b> Taxas e disponibilidade serão confirmadas pela Even3.</p>
 <p>Rua Olavo Bilac, 94 · Centro · Vitória da Conquista — BA.</p>
 {checkoutEnabled?<><a className="evbtn" href={s.even3} rel="noreferrer">Continuar para a entrada de {s.date} na Even3 →</a>
 <p className="evcheck">Este botão direciona ao checkout específico cadastrado para {s.date}. <b>Antes de pagar, confira na Even3 se o nome da entrada corresponde à data {s.date}.</b> Caso apareça outra data, não conclua a compra e avise a organização. Informe os dados de cada participante e guarde os ingressos individuais com QR Code.</p>
 </>:<><p className="evnotice">O checkout desta data ainda não está liberado neste ambiente. Não tente concluir uma compra até a organização confirmar a homologação.</p><p><Link href="/ingressos">Consultar as seis datas</Link></p></>}
 </section></main></div></>
}
