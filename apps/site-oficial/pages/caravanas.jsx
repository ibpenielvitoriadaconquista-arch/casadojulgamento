export async function getServerSideProps({res}){res.setHeader('Cache-Control','no-store');return {redirect:{destination:'/operacao/caravanas',permanent:false}};}
export default function CaravanShortcut(){return null;}
