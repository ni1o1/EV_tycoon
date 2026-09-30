/* Replay real game rules with a seeded random stream; omit only drawing, timers and storage. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
function simulate(level,seed,{price=1.5,purchases=[],policy='',tune=''}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'docs/index.html'),'utf8'),{url:'https://balance.test/',runScripts:'outside-only'});
 const win=dom.window;win.setTimeout=()=>0;win.clearTimeout=()=>{};win.scrollTo=()=>{};
 const context=dom.getInternalVMContext();const run=code=>vm.runInContext(code,context);
 const ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 win.HTMLCanvasElement.prototype.getContext=()=>ctx;
 win.echarts={init:()=>({setOption(){},dispose(){},resize(){}})};
 let random=seed;win.Math.random=()=>{random=(random*1664525+1013904223)>>>0;return random/4294967296};
 for(const file of ['vehicles.js','energy.js','finance.js','station-art.js','game.js','campaign.js'])run(fs.readFileSync(path.join(root,'docs',file),'utf8'));
 run('updateUI=()=>{};draw=()=>{};resizeCanvas=()=>{};saveGame=()=>{};spawnFloatText=()=>{};showMoneyChange=()=>{};initChart=()=>{};');
 if(tune)run(tune);
 run(`startLevelGame(${level});state.price=${price};${purchases.map(x=>`buyAsset('${x}');`).join('')}`);
 const result=run(`(()=>{let lowest=state.money,ticks=0;for(;ticks<15000&&!state.ended;ticks++){if(state.pendingRent>0)payBill();if(state.pendingEvent)closeEventModal();if(state.ended)break;${policy}state.paused=false;tick();lowest=Math.min(lowest,state.money)}return {level:${level},won:state.victoryAchieved,money:Math.round(state.money),lowest:Math.round(lowest),energy:Math.round(state.totalEnergy),served:state.served||0,lost:state.lost||0,days:state.day-1,assets:{...state.assets}}})()`);
 dom.window.close();return JSON.parse(JSON.stringify(result));
}
const reserveBuy = `const safeBuy=k=>{if(state.money>=getAssetCost(k)+calcWeeklyRent()+3*calcDailyCost())buyAsset(k)};`;
// Reference plans exercise staged investment rather than granting assets or cash.
const referencePlans = {
 1: {price:1.8},
 2: {price:1.8,purchases:['solar','solar']},
 3: {price:1.8,purchases:['fastCharger','transformer']},
 4: {price:1.8,purchases:['solar','battery']},
 5: {price:1.9,purchases:['slowCharger','transformer']},
 6: {price:1.8,purchases:['transformer','fastCharger'],policy:reserveBuy+`if(state.assets.transformer<5)safeBuy('transformer');else if(state.assets.fastCharger<5)safeBuy('fastCharger');else if(state.assets.slowCharger<7)safeBuy('slowCharger');`}
};
function report(seeds=20){
 const rows=[];
 for(const strategy of ['idle','planned'])for(let level=1;level<=6;level++){
  const results=[];
  for(let i=1;i<=seeds;i++)results.push(simulate(level,i*171,strategy==='idle'?{}:referencePlans[level]));
  rows.push({strategy,level,wins:results.filter(r=>r.won).length,seeds,meanCash:Math.round(results.reduce((s,r)=>s+r.money,0)/seeds),minCash:Math.min(...results.map(r=>r.lowest)),meanEnergy:Math.round(results.reduce((s,r)=>s+r.energy,0)/seeds)});
 }
 return rows;
}
if(require.main===module)console.table(report(Number(process.argv[2])||20));
module.exports={simulate,report,referencePlans};
