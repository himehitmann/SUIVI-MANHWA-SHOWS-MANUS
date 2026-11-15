import {describe,it,expect} from "vitest";
import {OFFERS,annualSaving,money,pricingCopy} from "../shared/pricing";

describe("paid offer catalogue",()=>{
 it("offers two billing periods for the same Pro product, in USD minor units",()=>{
   expect(OFFERS).toEqual([{id:"month",amount:349,months:1},{id:"year",amount:2999,months:12}]);
   expect(annualSaving()).toBe(1189);
 });
 it.each(["en","fr","es","de","pt","ja","ko","zh-CN"])("supplies every purchase state and benefit in %s",language=>{
   const copy=pricingCopy(language);
   expect(Object.keys(copy).sort()).toEqual(Object.keys(pricingCopy("en")).sort());
   for(const value of Object.values(copy))if(Array.isArray(value)){expect(value).toHaveLength(6);expect(value.every(text=>text.trim().length>0)).toBe(true);}else expect(value.trim().length).toBeGreaterThan(0);
   expect(copy.saving.split("{amount}")).toHaveLength(2);
   const parts=new Intl.NumberFormat(language,{style:"currency",currency:"USD"}).formatToParts(29.99);
   expect(parts.some(part=>part.type==="currency")).toBe(true);
   expect(money(2999,language)).toBe(parts.map(part=>part.value).join(""));
 });
 it("uses English only for an unsupported locale",()=>expect(pricingCopy("xx")).toEqual(pricingCopy("en")));
});
