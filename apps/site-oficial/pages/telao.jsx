export async function getServerSideProps({res,query={}}) {
 res.setHeader('Cache-Control','private, no-store');
 return {redirect:{destination:'/operacao/telao?exibir=1'+(typeof query.sessao==='string'?'&sessao='+encodeURIComponent(query.sessao):''),permanent:false}};
}
export default function Panel(){return null;}
