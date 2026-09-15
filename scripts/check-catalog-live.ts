import {createCatalog} from '../server/lib/catalog.ts';
const search=createCatalog();
for(const q of ['Aniimo','Colony']){const r=await search(q);console.log(JSON.stringify({query:q,sources:r.sources,results:r.results.map(x=>({title:x.title,type:x.type,format:x.format,country:x.country,year:x.year,url:x.url})).slice(0,18)}));}
