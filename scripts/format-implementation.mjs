import fs from 'node:fs';
import ts from 'typescript';
const roots=['src/app','src/features','src/design-system','src/domain','tests/e2e'];
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+ent.name;if(ent.isDirectory())walk(p);else if(/\.tsx?$/.test(p)&&!p.endsWith('core.ts'))files.push(p);}}
roots.forEach(walk);
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
for(const path of files){let text=fs.readFileSync(path,'utf8');if(path.endsWith('.tsx'))text=text.replace(/></g,'>\n<');const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);if(source.parseDiagnostics.length)throw Error('Syntax error in '+path);fs.writeFileSync(path,printer.printFile(source));}
console.log('Formatted '+files.length+' TypeScript files using the installed TypeScript printer.');
