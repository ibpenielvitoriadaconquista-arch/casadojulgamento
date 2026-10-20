export async function getServerSideProps({res}) {
 res.setHeader('Cache-Control','private, no-store');
 return {redirect:{destination:'/operacao/portaria',permanent:false}};
}
export default function Panel(){return null;}
