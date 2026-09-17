import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
// Local fonts make preview and export independent of installed system fonts.
if (typeof document !== 'undefined') {
 const handle=delayRender('Loading project Inter fonts');
 Promise.all([
  new FontFace('Inter',`url(${staticFile('fonts/Inter-Regular.ttf')})`,{weight:'400'}),
  new FontFace('Inter',`url(${staticFile('fonts/Inter-SemiBold.ttf')})`,{weight:'600'}),
 ].map(async font=>{const loaded=await font.load();document.fonts.add(loaded);})).then(()=>continueRender(handle)).catch(cancelRender);
}
