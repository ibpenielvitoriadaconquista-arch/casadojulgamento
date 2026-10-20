const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(base,f),'utf8');
const {cleanInput}=require('../lib/staff-requests.cjs');
test('cadastro normaliza nome, WhatsApp e função Guia',()=>{
 const out=cleanInput({name:' Ana  Silva ',email:'ANA@EXEMPLO.COM',whatsapp:'(77) 99999-9999',role:'guia'});
 assert.deepEqual(out,{name:'Ana Silva',email:'ana@exemplo.com',whatsapp:'77999999999',role:'guias'});
});
test('cadastro rejeita função geral, contato inválido e entradas vazias',()=>{
 for(const role of ['geral','telao','admin',''])assert.throws(()=>cleanInput({name:'Ana Silva',email:'ana@exemplo.com',whatsapp:'77999999999',role}));
 assert.throws(()=>cleanInput({name:'Ana Silva',email:'sem-email',whatsapp:'77999999999',role:'guias'}));
 assert.throws(()=>cleanInput({name:'Ana Silva',email:'ana@exemplo.com',whatsapp:'1234',role:'guias'}));
});
test('papel Caixa existe sem ação de admissão fictícia',()=>{
 const ops=require('../lib/operation-training.cjs');
 assert.equal(ops.ROLES.caixa,'Caixa');assert.deepEqual(ops.ALLOWED.caixa,[]);
});
test('gerenciamento valida papel de gestor e recovery por sessão',()=>{
 const api=read('pages/api/operacao/solicitacoes.js');
 assert.match(api,/user.role!=='geral'/);
 assert.match(api,/status='pending'/);
 assert.match(api,/ON CONFLICT/);
 assert.match(api,/requested_role/);
 const recovery=read('pages/api/operacao/redefinir.js');
 assert.match(recovery,/verifyOtp/);
 assert.match(recovery,/setSession/);
 assert.match(recovery,/updateUser/);
});
test('recuperação nunca redireciona para localhost',()=>{
 const api=read('pages/api/operacao/recuperar.js');
 assert.match(api,/https:\/\/www\.ibpeniel\.com\/operacao\/redefinir/);
 assert.doesNotMatch(api,/localhost:3000/);
});
test('solicitações não abrem acesso automático e preservam autorização da gestão',()=>{
 const src=read('pages/api/operacao/solicitar.js');
 assert.doesNotMatch(src,/auth\.admin\.createUser|peniel_ops\.staff\s*\(/);
 assert.match(src,/peniel_ops\.access_requests/);
});
