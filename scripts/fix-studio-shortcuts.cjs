const fs = require('node:fs');
const path = require('node:path');
const base=path.join(__dirname,'../node_modules/@remotion/studio/dist');
const files=[path.join(base,'components/keyboard-shortcuts.js'),...fs.readdirSync(path.join(base,'esm')).filter(f=>f.endsWith('.mjs')).map(f=>path.join(base,'esm',f))];
let patched=0;
for(const file of files){
 let source=fs.readFileSync(file,'utf8');
 if(!source.includes('normalizeKey ='))continue;
 source=source.replace(/undo: \[\{ key: (['"])z\1, commandOrControl: true \}\],/g, 'undo: [{ key: "z", commandOrControl: true, shift: false }],');
 const old='event.key.toLowerCase() === normalizeKey(value.key).toLowerCase()';
 const replacement="((value.commandOrControl && ['z', 'y'].includes(value.key.toLowerCase()) && /^Key[ZY]$/.test(event.code)) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase()) === normalizeKey(value.key).toLowerCase()";
 if(!source.includes(replacement)){
  if(!source.includes(old))throw Error('Shortcut matcher changed; review patch: '+file);
  source=source.replace(old,replacement);
 }
 fs.writeFileSync(file,source);patched++;
}
if(patched<2)throw Error('Expected both CommonJS and browser ESM shortcut matchers');
console.log('Patched keyboard matchers (including browser): '+patched);


