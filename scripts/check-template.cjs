const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const bad=[];
for(const f of files){
 if(/^(public\/projects|src\/(generated|local)|\.models|\.venv|out|node_modules)\//.test(f)||/\.(mp4|mov|wav|mp3|m4a|patch)$/i.test(f)||/(^|\/)(\.env(?:\..*)?|hosts\.yml|id_ed25519|id_rsa)$/.test(f))bad.push(f);
 if(/\.(md|json|[cm]?js|tsx?|py|ya?ml|cmd)$/.test(f)){
  const s=fs.readFileSync(f,'utf8');
  if(/-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/.test(s)||/\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(s))bad.push(f+' (credential pattern)');
 }
}
for(const f of ['public/fonts/Inter-Regular.ttf','public/fonts/Inter-SemiBold.ttf','public/fonts/OFL.txt','public/openai-official.svg','public/examples/billboard.png','public/examples/diagram.png','public/examples/product.png'])if(!files.includes(f))bad.push(f+' (missing template asset)');
if(bad.length){console.error('Template check failed:\n'+bad.join('\n'));process.exit(1);}
console.log('Template check passed: no tracked personal media or known credential patterns; required assets present.');
