const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {transformSync}=require('next/dist/build/swc');
const {renderToStaticMarkup}=require('react-dom/server'),React=require('react');
const policy=require('../lib/caravan-notifications.cjs');
function compiled(file,mocks={}){
 const filename=path.resolve(__dirname,'..',file),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
 m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:Module.prototype.require.call(m,id);
 m._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code,filename);
 return m.exports;
}
test('only geral receives request alerts, and other operation panels stay clear even for managers',()=>{
 for(const role of ['geral','portaria','coordenacao','guias','apoio','caixa','telao','caravanas',null,undefined]){
  assert.equal(policy.canReceive(role),role==='geral');
  for(const panel of ['geral','portaria','coordenacao','guias','apoio','caixa','telao'])assert.equal(policy.showOnPanel(role,panel),role==='geral'&&panel==='geral');
 }
});
test('notification component renders no markup for non-managers or a missing role',()=>{
 const {CaravanRequestNotice}=compiled('components/CaravanRequests.jsx');
 for(const role of ['portaria','coordenacao','guias','apoio','caixa','telao','caravanas',undefined])assert.equal(renderToStaticMarkup(React.createElement(CaravanRequestNotice,{role})), '');
 assert.match(renderToStaticMarkup(React.createElement(CaravanRequestNotice,{role:'geral'})),/consultando solicitações/);
});
test('summary endpoint rejects all other roles before reading the database and keeps manager summaries',async()=>{
 let queries=0;
 const handler=compiled('pages/api/operacao/caravana-solicitacoes.js',{
  '../../../lib/db':{query:async()=>{queries++;return {rows:[{session_date:'2026-11-09',count:2}]};},transaction:()=>{throw Error('No writes expected');}},
  '../../../lib/operation-auth':{actor:async req=>({role:req.testRole}),fail:(status,message)=>Object.assign(Error(message),{status}),sameOrigin:()=>{throw Error('No mutation expected');}}
 }).default;
 async function request(role){const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};await handler({method:'GET',query:{summary:'1'},testRole:role},res);return res;}
 for(const role of ['portaria','coordenacao','guias','apoio','caixa','telao','caravanas']){assert.equal((await request(role)).statusCode,403);assert.equal(queries,0);}
 const r=await request('geral');assert.equal(r.statusCode,200);assert.deepEqual(r.data,{days:[{session:'2026-11-09',count:2}]});assert.equal(queries,1);
});
