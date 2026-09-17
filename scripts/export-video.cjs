const path = require('node:path');
const readline = require('node:readline/promises');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
(async () => {
  const rl = readline.createInterface({input:process.stdin,output:process.stdout});
  // Список композиций спрашиваем у Remotion: он знает и шаблонные, и импортированные,
  // и личные из src/local, поэтому здесь нет захардкоженных названий.
  console.log('Reading compositions...');
  const cli=path.join(root,'node_modules/@remotion/cli/remotion-cli.js');
  const listed=await new Promise((resolve,reject)=>{
    let out='';
    const p=spawn(process.execPath,[cli,'compositions','src/index.ts','--quiet'],{stdio:['ignore','pipe','inherit']});
    p.stdout.on('data',c=>{out+=c;});
    p.on('exit',code=>code===0?resolve(out):reject(Error('Could not read compositions')));
  });
  const ids=listed.trim().split(/\s+/).filter(Boolean);
  if(!ids.length)throw Error('No compositions found');
  ids.forEach((id,i)=>console.log(`${i+1}. ${id}`));
  const i=Number(await rl.question('Video number: '))-1;
  if(!Number.isInteger(i)||!ids[i])throw Error('Invalid video number');
  const quality=await rl.question('1 = compact 1080p / 2 = draft 540p: ');
  rl.close();
  if(!['1','2'].includes(quality))throw Error('Invalid quality');
  const filename=`out/${ids[i]}-${Date.now()}.mp4`;
  const flags=quality==='2'?['--scale=0.5','--crf=25']:['--video-bitrate=5M'];
  const child=spawn(process.execPath,['node_modules/@remotion/cli/remotion-cli.js','render','src/index.ts',ids[i],filename,'--codec=h264','--audio-codec=aac','--audio-bitrate=128k','--concurrency=1',...flags],{stdio:'inherit'});
  child.on('exit',code=>{console.log(code===0?`Saved: ${filename}`:'Render failed');process.exitCode=code||0;});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
