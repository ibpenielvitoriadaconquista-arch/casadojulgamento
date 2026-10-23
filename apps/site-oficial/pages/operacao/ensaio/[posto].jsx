export async function getServerSideProps({params}){const allowed=['geral','portaria','coordenacao','guias','apoio','telao','caixa'];if(!allowed.includes(params.posto))return {notFound:true};return {redirect:{destination:'/operacao/'+params.posto+'?sessao=2026-10-22',permanent:false}};}
export default function Legacy(){return null;}
