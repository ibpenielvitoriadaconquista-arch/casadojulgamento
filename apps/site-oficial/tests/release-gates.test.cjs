const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const dir=path.join(__dirname,'..');const txt=p=>fs.readFileSync(path.join(dir,p),'utf8');
test('fluxo nativo antigo não publica APIs de PIX, compra ou checkin sem autenticação',()=>{
 for(const p of ['pages/api/webhooks/pix.js','pages/api/checkin/validar.js','pages/api/admin/dashboard.js','pages/api/pedidos/index.js'])assert.equal(fs.existsSync(path.join(dir,p)),false,`Endpoint legado inesperado: ${p}`);
});
test('módulo PIX nunca cria payload fake',()=>{const p=txt('lib/payments.js');assert.match(p,/503/);assert.doesNotMatch(p,/BR\.GOV\.BCB\.PIX/)});
test('criação de reserva usa BEGIN / COMMIT / ROLLBACK',()=>{const p=txt('lib/db.js');for(let x of ['BEGIN','COMMIT','ROLLBACK'])assert(p.includes(x))});
test('pipeline CI usa instalação reproduzível',()=>{assert.match(txt('.github/workflows/security.yml'),/npm ci/)});
test('sem CPF nos formulários/campos de produção',()=>{assert.doesNotMatch(txt('db/migrations/001_init.sql'),/\bcpf\b/i);assert.doesNotMatch(txt('pages/dados.jsx'),/name="cpf"/i)});
