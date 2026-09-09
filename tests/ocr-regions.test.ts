import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../ocr-regions.js',import.meta.url),'utf8'),context);
describe('speech region backdrop',()=>{
 it('keeps a colored bubble despite a black ink sample',()=>{const out=context.YomuRegions.backdrop([[0,0,0],...Array.from({length:20},()=>[246,230,195])]);expect(out.background).toBe('#f6e6c3');expect(out.foreground).toBe('#171923');expect(out.backgroundConfidence).toBeGreaterThan(.9);});
 it('keeps light lettering readable on dark colored panels',()=>{const out=context.YomuRegions.backdrop(Array.from({length:20},()=>[35,30,70]));expect(out.background).toBe('#231e46');expect(out.foreground).toBe('#ffffff');});
 it('marks varied perimeters as uncertain instead of claiming a uniform bubble',()=>{const out=context.YomuRegions.backdrop([[0,0,0],[255,255,255],[180,0,0],[0,180,0]]);expect(out.backgroundConfidence).toBeLessThan(.5);});
 it('samples only within image boundaries',()=>{const calls:number[][]=[];context.YomuRegions.sampleBackdrop({getImageData:(x:number,y:number)=>{calls.push([x,y]);return {data:[255,255,255,255]};}},{x0:0,y0:0,x1:10,y1:10},10,10);expect(calls.length).toBe(48);expect(calls.every(([x,y])=>x>=0&&y>=0&&x<10&&y<10)).toBe(true);});
});
it('expands through flat background but stops before ink and image bounds',()=>{
 const pixels=new Uint8ClampedArray(100*100*4).fill(255);for(let y=0;y<100;y++)for(const x of [19,81]){const i=(y*100+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
 const ctx={getImageData:(x:number,y:number,w:number,h:number)=>{const data=new Uint8ClampedArray(w*h*4);for(let row=0;row<h;row++)data.set(pixels.slice(((y+row)*100+x)*4,((y+row)*100+x+w)*4),row*w*4);return {data};}};
 const box=context.YomuRegions.expandRegion(ctx,{x0:35,y0:30,x1:65,y1:70},100,100,{background:'#ffffff',backgroundConfidence:1});expect(box.x0).toBe(20);expect(box.x1).toBe(81);expect(box.y0).toBe(22);expect(box.y1).toBe(78);
 const uncertain=context.YomuRegions.expandRegion(ctx,{x0:35,y0:30,x1:65,y1:70},100,100,{background:'#ffffff',backgroundConfidence:.4});expect(uncertain.x0).toBe(35);expect(uncertain.x1).toBe(65);
});
