/* Replay real game rules with a seeded random stream; omit only drawing, timers and storage. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
function simulate(level,seed,{price=1.5,purchases=[],policy='',tune='',unlocks}={}){
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
 const unlocked=unlocks ?? (level===1?[]:level===2?['marketing','fastCharger','solar']:['marketing','fastCharger','solar','battery','bank']);
 run(`career.unlocks=${JSON.stringify(unlocked)};`);
 run(`startLevelGame(${level});state.price=${price};${purchases.map(x=>`buyAsset('${x}');`).join('')}`);
 const result=run(`(()=>{let lowest=state.money,ticks=0;for(;ticks<30000&&!state.ended;ticks++){if(state.pendingRent>0)payBill();if(state.pendingEvent)closeEventModal();lowest=Math.min(lowest,state.money);if(state.ended)break;${policy}state.paused=false;tick();lowest=Math.min(lowest,state.money)}return {level:${level},won:state.victoryAchieved,money:Math.round(state.money),lowest:Math.round(lowest),energy:Math.round(state.totalEnergy),served:state.served||0,lost:state.lost||0,days:state.day-1,assets:{...state.assets},unlocks:[...career.unlocks],milestones:[...state.claimedMilestones]}})()`);
 dom.window.close();return JSON.parse(JSON.stringify(result));
}
function investments(targets,priority=Object.keys(targets)) {
 return `const targets=${JSON.stringify(targets)};for(const k of ${JSON.stringify(priority)}){if(state.assets[k]>=targets[k]||purchaseRestriction(k))continue;if(state.money>=getAssetCost(k)+calcWeeklyRent()+3*calcDailyCost()){buyAsset(k)}break;}`;
}
const referencePlans = {
 1: {price:1.8,purchases:['slowCharger'],policy:investments({transformer:2,fastCharger:1,solar:1},['fastCharger','transformer','solar'])},
 2: {price:1.8,purchases:['solar'],policy:investments({solar:2,fastCharger:1,transformer:2,battery:1},['fastCharger','transformer','solar','battery'])},
 3: {price:1.8,purchases:['fastCharger','transformer'],policy:investments({transformer:5,fastCharger:4,solar:3,battery:2})},
 4: {price:1.8,purchases:['fastCharger'],policy:investments({solar:2,transformer:2,battery:1})},
 5: {price:1.9,purchases:['slowCharger','transformer'],policy:investments({solar:3,fastCharger:2,transformer:6,slowCharger:4,battery:2})},
 6: {price:1.8,purchases:['solar','solar','battery','slowCharger'],policy:investments({battery:4,solar:6,slowCharger:4})},
 7: {price:1.9,purchases:['fastCharger','transformer'],policy:investments({transformer:7,fastCharger:5,slowCharger:3,battery:2})},
 8: {price:1.8,purchases:['transformer','fastCharger'],policy:investments({transformer:8,fastCharger:6,slowCharger:8,solar:4,battery:3})},
 9: {price:1.9,purchases:['transformer','fastCharger'],policy:investments({transformer:6,fastCharger:5,slowCharger:5,solar:4,battery:4})},
 10:{price:1.9,purchases:['transformer','fastCharger'],policy:investments({transformer:9,fastCharger:6,slowCharger:6,solar:5,battery:4})}
};
function report(seeds=8){
 const rows=[];
 for(const strategy of ['idle','planned'])for(let level=1;level<=10;level++){
  const results=[];
  for(let i=1;i<=seeds;i++)results.push(simulate(level,i*171,strategy==='idle'?{}:referencePlans[level]));
  rows.push({strategy,level,wins:results.filter(r=>r.won).length,seeds,meanCash:Math.round(results.reduce((s,r)=>s+r.money,0)/seeds),minCash:Math.min(...results.map(r=>r.lowest)),meanEnergy:Math.round(results.reduce((s,r)=>s+r.energy,0)/seeds),meanServed:Math.round(results.reduce((s,r)=>s+r.served,0)/seeds)});
 }
 return rows;
}
if(require.main===module)console.table(report(Number(process.argv[2])||8));
module.exports={simulate,report,referencePlans,investments};
