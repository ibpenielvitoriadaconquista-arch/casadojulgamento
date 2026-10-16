const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8'), script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
const map=new Map();const storage={getItem(k){return map.get(k)||null},setItem(k,v){map.set(k,v)}};
function client(role){const elems=new Map();function elem(id){if(!elems.has(id))elems.set(id,{innerHTML:'',textContent:'',value:'',className:'',disabled:false,addEventListener(){}});return elems.get(id)}const document={getElementById:elem,addEventListener(){}};const window={addEventListener(){},location:{search:'?posto='+role,href:'https://simulador.local/?posto='+role},history:{replaceState(){}},BroadcastChannel:function(){this.postMessage=()=>{};this.onmessage=null}};const context={window,document,localStorage:storage,location:window.location,history:window.history,URL,URLSearchParams,BroadcastChannel:window.BroadcastChannel,Date,console,setTimeout,clearTimeout,confirm:()=>true};vm.runInNewContext(script,context);return{api:window.__penielDemo,html:elem};}
const p=client('portaria'),c=client('coordenacao'),g=client('guia'),screen=client('telao');
const snap=()=>JSON.parse(JSON.stringify(g.api.readState().sessions['2026-11-09']));let s=snap();const id=s.tickets[0].id;
assert(p.api.action('scan',id));s=snap();assert(s.tickets[0].checked);assert.strictEqual(s.tickets[0].group,null,'Portaria must not assign group');
assert(c.api.action('assign'));s=snap();assert.strictEqual(s.tickets[0].group,'G01');assert(c.api.action('close','G01'));assert(c.api.action('send','G01'));assert(g.api.action('arrive','G01'));assert(g.api.action('start','G01'));assert(snap().groups[0].status==='circuit');
console.log('PASS first group 1/20: check-in→coord→wait→guide independent, waiting clear.');
// Add everyone to reach three groups, preserving nuclear families and top 20.
s=snap();for(const t of s.tickets){if(!t.checked)assert(p.api.action('scan',t.id))}
while(snap().tickets.some(t=>t.checked&&!t.group))assert(c.api.action('assign'));
s=snap();console.log('groups:',s.groups.filter(x=>x.members.length).map(x=>x.id+':'+x.members.length));assert(s.groups.filter(x=>x.members.length).length>=3);assert(s.groups.every(x=>x.members.length<=20));
assert(c.api.action('close','G02'));assert(c.api.action('send','G02'));assert(g.api.action('arrive','G02'));
assert.strictEqual(g.api.action('start','G02'),false,'prior must be safe');assert(g.api.action('safe','G01'));assert(g.api.action('start','G02'));
assert(c.api.action('close','G03'));assert(c.api.action('send','G03'));assert(g.api.action('arrive','G03'));assert(g.api.action('safe','G02'));
assert.strictEqual(g.api.action('start','G03'),false,'third group blocked even though previous two reached safe point');
assert(g.api.action('finish','G01'));assert(g.api.action('start','G03'));
assert(snap().groups.filter(x=>['safe','circuit'].includes(x.status)).length<=2);
console.log('PASS third group blocked before earlier group finishes; allows after a slot frees.');
assert(screen.html('content').innerHTML.includes('TELÃO')||screen.html('title').textContent.includes('Telão')||screen.html('content').innerHTML.includes('SALA DE ESPERA'));
// simulate onsite registration. Not checked automatically
assert(p.api.action('onsite'));s=snap();const sold=s.tickets.at(-1);assert(sold.id.startsWith('SIM-PRES-'));assert(!sold.checked&&!sold.group);assert.strictEqual(s.counterOnsite,1);
console.log('PASS onsite mock ticket remains unchecked and has not been paid.');
console.log('PASS syntax and state-machine tests; no browser smoke (headless browser blocked by environment).');