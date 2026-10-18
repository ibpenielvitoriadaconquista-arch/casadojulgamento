import flyer from "../../lib/flyer-campaigns.cjs";
export default function Flyer(){return null;}
export async function getServerSideProps({params,res}){const destination=flyer.destinationFor(params?.lote);res.setHeader("Cache-Control","no-store, max-age=0");if(!destination)return {notFound:true};return {redirect:{destination,permanent:false}};}