const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const dir=path.join(__dirname,'..');const txt=(p)=>fs.readFileSync(path.join(dir,p),'utf8');
test('webhook bloqueado não contém comando de pagar',()=>{const c=txt('pages/api/webhooks/pix.js');assert.match(c,/503/);assert.doesNotMatch(c,/UPDATE pedidos/)});
test('API checkin está bloqueada sem provedor de identidade',()=>{assert.match(txt('pages/api/checkin/validar.js'),/503/);assert.match(txt('pages/api/admin/dashboard.js'),/503/)});
test('módulo PIX nunca cria payload fake',()=>{const p=txt('lib/payments.js');assert.match(p,/503/);assert.doesNotMatch(p,/BR\.GOV\.BCB\.PIX/)});
test('criação de reserva usa BEGIN / COMMIT / ROLLBACK',()=>{const p=txt('lib/db.js');for(let x of ['BEGIN','COMMIT','ROLLBACK'])assert(p.includes(x))});
test('falta do lockfile deliberadamente bloqueia pipeline CI',()=>{assert.match(txt('.github/workflows/security.yml'),/npm ci/)});
test('sem CPF nos formulários/campos de produção',()=>{assert.doesNotMatch(txt('db/migrations/001_init.sql'),/\bcpf\b/i);assert.doesNotMatch(txt('pages/dados.jsx'),/name="cpf"/i)});

test('compra bloqueada sem liberação institucional',()=>{assert.match(txt('pages/api/pedidos/index.js'),/PRODUCTION_RELEASE_APPROVED/);assert.match(txt('pages/api/pedidos/index.js'),/503/)});
