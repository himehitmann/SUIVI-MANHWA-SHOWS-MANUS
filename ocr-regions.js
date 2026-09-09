/* Estimate a speech region's backdrop from its perimeter, resisting isolated ink.
 * This is flat-background reconstruction, not texture-aware/neural inpainting. */
(function(root){
 function backdrop(samples){
  if(!samples.length)return {background:'#ffffff',foreground:'#171923',backgroundConfidence:0};
  const bins=new Map();for(const s of samples){const key=s.slice(0,3).map(v=>Math.floor(v/24)).join(',');if(!bins.has(key))bins.set(key,[]);bins.get(key).push(s);}
  const group=[...bins.values()].sort((a,b)=>b.length-a.length)[0];
  const rgb=[0,1,2].map(c=>{const values=group.map(s=>s[c]).sort((a,b)=>a-b);return values[Math.floor(values.length/2)];});
  const light=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114;
  return {background:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),foreground:light<140?'#ffffff':'#171923',backgroundConfidence:group.length/samples.length};
 }
 function sampleBackdrop(context,bbox,width,height){
  const samples=[],x0=Math.max(0,Math.floor(bbox.x0)-3),y0=Math.max(0,Math.floor(bbox.y0)-3),x1=Math.min(width-1,Math.ceil(bbox.x1)+3),y1=Math.min(height-1,Math.ceil(bbox.y1)+3);
  for(let n=0;n<12;n++){const x=Math.round(x0+(x1-x0)*n/11),y=Math.round(y0+(y1-y0)*n/11);for(const [px,py] of [[x,y0],[x,y1],[x0,y],[x1,y]])samples.push(Array.from(context.getImageData(px,py,1,1).data));}
  return backdrop(samples);
 }
 root.YomuRegions={backdrop,sampleBackdrop};
})(globalThis);
