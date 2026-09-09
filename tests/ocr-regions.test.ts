import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../ocr-regions.js',import.meta.url),'utf8'),context);
describe('speech region backdrop',()=>{
 it('keeps a colored bubble despite a black ink sample',()=>{const out=context.YomuRegions.backdrop([[0,0,0],...Array.from({length:20},()=>[246,230,195])]);expect(out.background).toBe('#f6e6c3');expect(out.foreground).toBe('#171923');expect(out.backgroundConfidence).toBeGreaterThan(.9);});
 it('keeps light lettering readable on dark colored panels',()=>{const out=context.YomuRegions.backdrop(Array.from({length:20},()=>[35,30,70]));expect(out.background).toBe('#231e46');expect(out.foreground).toBe('#ffffff');});
 it('marks varied perimeters as uncertain instead of claiming a uniform bubble',()=>{const out=context.YomuRegions.backdrop([[0,0,0],[255,255,255],[180,0,0],[0,180,0]]);expect(out.backgroundConfidence).toBeLessThan(.5);});
 it('samples only within image boundaries',()=>{const calls:number[][]=[];context.YomuRegions.sampleBackdrop({getImageData:(x:number,y:number)=>{calls.push([x,y]);return {data:[255,255,255,255]};}},{x0:0,y0:0,x1:10,y1:10},10,10);expect(calls.length).toBe(48);expect(calls.every(([x,y])=>x>=0&&y>=0&&x<10&&y<10)).toBe(true);});
});
