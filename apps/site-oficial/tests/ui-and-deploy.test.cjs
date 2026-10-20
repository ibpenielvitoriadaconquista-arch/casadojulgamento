const {test}=require('node:test'); const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('API de sessões usa gate de liberação e não inventa estoque',()=>{
 const code=read('pages/api/sessoes.js');
 assert.match(code,/salesReleaseEnabled/);
 assert.match(code,/vagasOnlineRestantes:null/);
 assert.match(code,/vendaDisponivel:salesEnabled/);
});
test('rota antiga de sessões redireciona para o seletor oficial',async()=>{
 const code=read('pages/sessoes.jsx');
 const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 assert.deepEqual(module.getServerSideProps(),{redirect:{destination:'/ingressos',permanent:false}});
});
test('Página de flyer mantém um único CTA central',()=>{
 const code=read('pages/convite.jsx');
 assert.equal(code.split('<Link ').length-1,1);
 assert.match(code,/IR AO JULGAMENTO/);
});
test('Mensagens públicas enfatizam abertura dos portões',()=>{
 for (const p of ['pages/index.jsx','pages/ingressos.jsx','pages/ingressos/[dia].jsx'])assert.match(read(p),/portões/i);
});
test('Nenhuma fonte externa do Google é carregada pelo CSS',()=>{
 assert.equal(read('styles.css').includes('fonts.googleapis.com'),false);
});
test('Health descreve ambiente de preview, não declara pagamento pronto',()=>{
 assert.match(read('pages/api/health.js'),/paymentsEnabled:false/);
});
test('Arquivo .env real permanece ignorado no controle de versão',()=>{
 const lines=read('.gitignore').split(/\\r?\\n/);
 assert.ok(lines.includes('.env.*'));
 assert.ok(lines.includes('!.env.example'));
});
