import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=resolve(root,'dist');
if(!existsSync(dist)) {console.error('dist assente: eseguire prima npm run build.');process.exit(1);}
const forbiddenNames=/\.(fig|pdf|xlsx?|csv|woff2?|ttf|otf)$/i;
const markers=['audit_private','Source_Audit_PRIVATE','GastroSupply-shared','Centro-Cash-App-Agenti','Anagra_art','Analisi ordini WA commentata','wa.me/','mailto:'];
let errors=[];let files=0;
function visit(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,item.name);if(item.isDirectory()) visit(p);else{files++;if(forbiddenNames.test(item.name))errors.push(`Asset non ammesso: ${p}`);if(/\.(html|js|css|json|svg)$/i.test(p)){const text=readFileSync(p,'utf8');for(const marker of markers)if(text.includes(marker))errors.push(`Marker privato/azione esterna ${marker} in ${p}`);}}}}
visit(dist);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`PASS: ${files} file del bundle, nessun riferimento privato noto. Verificare separatamente le richieste di rete in E2E.`);
