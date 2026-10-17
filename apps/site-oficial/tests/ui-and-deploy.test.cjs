const {test}=require('node:test'); const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('API de sessões apresenta programação sem valores falsos quando vendas estão bloqueadas',()=>{
 const code=read('pages/api/sessoes.js');assert.match(code,/PRODUCTION_RELEASE_APPROVED\s*!==\s*['"]true['"]/);assert.match(code,/vagasOnlineRestantes:null/);assert.match(code,/vendaDisponivel:false/);});
test('rota antiga de sessões redireciona para o seletor oficial',async()=>{
 const code=read('pages/sessoes.jsx');
 const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 assert.deepEqual(module.getServerSideProps(),{redirect:{destination:'/ingressos',permanent:false}});
});
test('Página de flyer mantém um único CTA central',()=>{
 const code=read('pages/convite.jsx');assert.equal((code.match(/<Link\s/g)||[]).length,1);assert.match(code,/IR AO JULGAMENTO/);});
test('Mensagens públicas enfatizam abertura dos portões',()=>{
 for (const p of ['pages/index.jsx','pages/ingressos.jsx','pages/ingressos/[dia].jsx'])assert.match(read(p),/portões/i);});
test('Nenhuma fonte externa do Google é carregada pelo CSS',()=>{
 assert.doesNotMatch(read('styles.css'),/fonts\.googleapis\.com/);});
test('Health descreve ambiente de preview, não declara pagamento pronto',()=>{
 assert.match(read('pages/api/health.js'),/paymentsEnabled:false/);});
test('Arquivo .env real permanece ignorado no controle de versão',()=>{
 const x=read('.gitignore');assert.match(x,/\.env\.\*/);assert.match(x,/!\.env\.example/);});
