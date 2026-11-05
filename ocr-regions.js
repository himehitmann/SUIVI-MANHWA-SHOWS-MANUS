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

 function expandRegion(context,bbox,width,height,estimate){
  const b={x0:Math.max(0,Math.floor(bbox.x0)),y0:Math.max(0,Math.floor(bbox.y0)),x1:Math.min(width,Math.ceil(bbox.x1)),y1:Math.min(height,Math.ceil(bbox.y1))};
  if(estimate.backgroundConfidence<.85)return b;
  const rgb=estimate.background.slice(1).match(/../g).map(v=>parseInt(v,16));
  const pad=Math.min(80,Math.max(12,Math.round((b.x1-b.x0)*.6))),verticalPad=8;
  const left=Math.max(0,b.x0-pad),top=Math.max(0,b.y0-verticalPad),right=Math.min(width,b.x1+pad),bottom=Math.min(height,b.y1+verticalPad);
  const image=context.getImageData(left,top,right-left,bottom-top),pixels=image.data,stride=right-left;
  const flat=(x,y)=>{const i=((y-top)*stride+x-left)*4;return [0,1,2].every(c=>Math.abs(pixels[i+c]-rgb[c])<=18);};
  const column=x=>{for(let y=b.y0;y<b.y1;y++)if(!flat(x,y))return false;return true;};
  const row=y=>{for(let x=b.x0;x<b.x1;x++)if(!flat(x,y))return false;return true;};
  while(b.x0>left&&column(b.x0-1))b.x0--;
  while(b.x1<right&&column(b.x1))b.x1++;
  while(b.y0>top&&row(b.y0-1))b.y0--;
  while(b.y1<bottom&&row(b.y1))b.y1++;
  return b;
 }

 function protectNeighbors(regions){
  const conflicts=new Set();
  const intersects=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.y1,b.y1)>Math.max(a.y0,b.y0);
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){
   const a=regions[i],b=regions[j];
   if(intersects(a.renderBox||a.bbox,b.renderBox||b.bbox)&&!intersects(a.bbox,b.bbox)){conflicts.add(i);conflicts.add(j);}
  }
  return regions.map((r,i)=>conflicts.has(i)?{...r,renderBox:{...r.bbox}}:r);
 }
 root.YomuRegions={backdrop,sampleBackdrop,expandRegion,protectNeighbors};
})(globalThis);
