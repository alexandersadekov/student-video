const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../node_modules/@remotion/studio/dist');
const cjs=require(path.join(root,'components/keyboard-shortcuts.js'));
const file=fs.readdirSync(path.join(root,'esm')).find(f=>f.endsWith('.mjs')&&fs.readFileSync(path.join(root,'esm',f),'utf8').includes('var keyboardEventMatchesShortcut ='));
const src=fs.readFileSync(path.join(root,'esm',file),'utf8');
assert.match(src,/undo: \[\{ key: "z", commandOrControl: true, shift: false \}\]/);
const snippet=src.slice(src.indexOf('var normalizeKey ='),src.indexOf('var keyboardShortcutsOverlap ='));
const esm=vm.runInNewContext('const isMac=false;'+snippet+';keyboardEventMatchesShortcut');
for(const match of [cjs.keyboardEventMatchesShortcut,esm]){
 for(const [key,code,shift,action] of [['z','KeyZ',false,'undo'],['Z','KeyZ',true,'redo'],['я','KeyZ',false,'undo'],['Я','KeyZ',true,'redo'],['н','KeyY',false,'redo']]){
  const event={key,code,shiftKey:shift,ctrlKey:true,metaKey:false,altKey:false};
  const matches=a=>cjs.defaultKeyboardShortcuts[a].some(shortcut=>match({event,shortcut}));
  assert.equal(matches(action),true);assert.equal(matches(action==='undo'?'redo':'undo'),false);
 }
}
console.log('10 CommonJS/browser-ESM shortcut cases passed');
