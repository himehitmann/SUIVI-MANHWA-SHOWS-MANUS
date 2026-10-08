import {chromium} from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const profile=await fs.mkdtemp(path.join(os.tmpdir(),"yomu-live-discovery-"));
const context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${process.cwd()}`,`--load-extension=${process.cwd()}`]});
const report={checkedAt:new Date().toISOString(),environment:"GitHub Actions Chromium, synthetic empty account",providers:"live",categories:{},screens:[],limitations:["A single observation does not establish catalog completeness or continuous availability.","Screenshots require human visual review."]};
try{
  await fs.mkdir("test-results",{recursive:true});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent("serviceworker");
  const began=Date.now();
  const data=await worker.evaluate(async()=>{
    let timer;
    try{return await Promise.race([buildDiscover(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("live_discovery_timeout")),90000);})]);}
    finally{clearTimeout(timer);}
  }).catch(error=>{report.providerError=String(error.message).slice(0,250);return null;});
  report.fetchMilliseconds=Date.now()-began;
  report.failedCategories=data?.failedCategories||[];
  for(const key of ["manga","manhwa","manhua","anime","kdrama","cdrama","jdrama","series","gamesSoon","gamesHot"]){
    const works=data?.[key]||[];
    report.categories[key]={count:works.length,sample:works.slice(0,3).map(item=>({title:item.title,format:item.format,country:item.country,year:item.year,externalIds:item.externalIds,cover:item.cover}))};
    if(key.endsWith("drama"))for(const item of works){
      assert.equal(item.format.toLowerCase(),key,"Regional row must agree with the work format");
      assert(!item.genres?.includes("Anime"),"Animation must not appear as live-action drama");
    }
  }
  const page=await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/library.html`);
  await page.waitForFunction(()=>typeof hydrate==="function");
  await page.evaluate(data=>{
    // Keep the observed snapshot stable while taking screenshots.
    const send=chrome.runtime.sendMessage;
    chrome.runtime.sendMessage=(message,callback)=>message.type==="DISCOVER"?callback(data?{ok:true,data}:{ok:false}):send.call(chrome.runtime,message,callback);
    discover=data;discoverTried=true;discoverLoading=false;spotPaused=true;
    hydrate({items:[],lists:[],sites:[],notifications:[],settings:{lang:"fr",homeCats:null}});
    switchView("home");
  },data);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    // Request lazy covers and wait for fallback URLs too: decode() can reject as src changes.
    await page.evaluate(async()=>{
      for(const image of document.querySelectorAll("#view-home img.cov")){
        image.loading="eager";
      }
      const deadline=Date.now()+12000;
      while(Date.now()<deadline){
        const images=[...document.querySelectorAll("#view-home img.cov")];
        if(images.every(image=>image.classList.contains("failed")||(image.complete&&image.naturalWidth>0)))break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
    });
    const screen=await page.evaluate(()=>({
      width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
      rows:document.querySelectorAll("#view-home .disco-wrap").length,
      covers:[...document.querySelectorAll("#view-home img.cov")].map(image=>({source:image.currentSrc||image.src,fallback:image.dataset.fallback||null,title:image.closest(".disco")?.querySelector("h4")?.textContent||document.querySelector(".home-feature h2")?.textContent,loaded:image.complete&&image.naturalWidth>0,failed:image.classList.contains("failed"),width:image.naturalWidth,height:image.naturalHeight})),
      heading:document.querySelector("#view-home h1")?.textContent
    }));
    report.screens.push(screen);
    assert.equal(screen.overflow,false,"Live home must fit the viewport");
    assert(screen.rows<=3,"An empty account should see at most three category rows");
    await page.screenshot({path:`test-results/home-live-${width}.png`,fullPage:true});
    const preview=await page.screenshot({type:"jpeg",quality:55,fullPage:true});
    console.log("HOME_VISUAL_"+width+" "+preview.toString("base64"));
  }

  report.searches=[];
  for(const query of ["yandere","portal"]){
    const observation=await worker.evaluate(async query=>{
      const began=Date.now(),result={query,firstResultsMilliseconds:null,rounds:[]};
      let response;
      for(let round=0;round<2;round++){
        if(round&&(!response?.hasMore||response.pending||!response.ok))break;
        const more=round?response.cursor:null,started=Date.now();
        const deadline=started+35000;
        do{
          response=await catalogSearchProgress(query,false,more);
          if(response.results?.length&&result.firstResultsMilliseconds===null)result.firstResultsMilliseconds=Date.now()-began;
          if(!response.pending||Date.now()>=deadline)break;
          await new Promise(resolve=>setTimeout(resolve,500));
        }while(true);
        const rows=response.results||[];
        const job=catalogJobs.get(accountEpoch+":"+query);
        result.rounds.push({
          round:round+1,milliseconds:Date.now()-started,ok:response.ok,pending:response.pending,
          count:rows.length,hasMore:response.hasMore,partial:response.partial,limited:response.limited,
          types:rows.reduce((counts,row)=>{counts[row.type]=(counts[row.type]||0)+1;return counts;},{}),
          sources:job?[...job.pages].map(([source,state])=>({source,page:state.page,more:state.more,failed:state.failed})):[],
          sample:rows.slice(0,12).map(row=>({title:row.title,type:row.type,format:row.format})),
          matchingTitleCount:rows.filter(row=>String(row.title||"").toLowerCase().includes(query)).length
        });
      }
      return result;
    },query);
    report.searches.push(observation);
    const [first,second]=observation.rounds;
    if(second)assert(second.count>=first.count,"Loading more must retain previously received results");
    for(const round of observation.rounds)for(const item of round.sample)assert(["reading","watching","game"].includes(item.type),"Search must contain works");
  }
  report.observation=data&&Object.values(report.categories).some(c=>c.count)?"data_received":"catalog_unavailable";
}finally{
  await fs.mkdir("test-results",{recursive:true});
  await fs.writeFile("test-results/live-discovery.json",JSON.stringify(report,null,2));
  console.log("LIVE_DISCOVERY_REPORT",JSON.stringify(report));
  await context.close();
}
