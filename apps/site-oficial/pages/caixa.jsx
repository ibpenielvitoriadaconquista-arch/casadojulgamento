export async function getServerSideProps({res}){
 res.setHeader('Cache-Control','private, no-store');
 return {redirect:{destination:'/operacao/caixa',permanent:false}};
}
export default function Panel(){return null;}
