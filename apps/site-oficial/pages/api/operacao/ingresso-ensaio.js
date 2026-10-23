export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 return res.status(410).json({error:'O Lote 1 agora utiliza a operação oficial. Abra /operacao/portaria e selecione Lote 1.'});
}
