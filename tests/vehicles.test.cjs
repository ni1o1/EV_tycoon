const {test}=require('node:test');
const assert=require('node:assert/strict');
const {VEHICLE_MODELS,arrivalSoc,createVehicle,vehicleSoc}=require('../docs/vehicles.js');
const {dispatchEnergy}=require('../docs/energy.js');
const config={baseLoadLimit:500,transformerBoost:20,batteryCap:100,batteryRate:20,solarMax:10,chargerPower:{slow:7,fast:30},weather:{eff:{sunny:1}}};
function station(cars,overrides={}){return {hour:12,weather:'sunny',batteryKwh:0,activeBuffs:[],settings:{mode:'std'},assets:{solar:0,battery:0,transformer:0},cars,...overrides}}
test('arrival SOC follows a bounded normal distribution concentrated around 20 percent',()=>{
 let seed=171;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const values=Array.from({length:30000},()=>arrivalSoc(random));const mean=values.reduce((a,b)=>a+b,0)/values.length;
 const sd=Math.sqrt(values.reduce((sum,x)=>sum+(x-mean)**2,0)/values.length);
 assert.ok(values.every(x=>x>=.05&&x<=.5));assert.ok(mean>.197&&mean<.207,mean);assert.ok(sd>.062&&sd<.071,sd);
 assert.ok(values.filter(x=>x>=.1&&x<=.3).length/values.length>.84);
});
test('eight vehicle classes have distinct capacities and only purchased energy changes their SOC',()=>{
 assert.equal(VEHICLE_MODELS.length,8);assert.equal(new Set(VEHICLE_MODELS.map(v=>v.capacity)).size,8);
 for(const model of VEHICLE_MODELS){const car=createVehicle(model.emoji,()=>.5);assert.equal(car.batteryCapacity,model.capacity);assert.equal(car.kwhNeeded,model.capacity*(1-car.initialSoc));assert.equal(vehicleSoc(car),car.initialSoc);car.kwhReceived=car.kwhNeeded;assert.equal(vehicleSoc(car),1)}
});
test('vehicle AC and DC acceptance limits cap actual energy and billing even with a speed buff',()=>{
 const compact={...createVehicle('🚗',()=>.5),type:'slow',slot:0,priceLocked:2};
 const s=station([compact],{activeBuffs:[{type:'chargeSpeedMult',val:3}]});const r=dispatchEnergy(s,config,1);
 assert.ok(Math.abs(compact.lastPowerKw-3.6)<1e-9);assert.ok(Math.abs(r.revenue-1.2)<1e-9);
 compact.type='fast';const d=dispatchEnergy(s,config,1);assert.ok(Math.abs(compact.lastPowerKw-25)<1e-9);assert.ok(Math.abs(d.delivered-25/6)<1e-9);
});
test('station power limits and final SOC prevent overcharging or rebilling a completed vehicle',()=>{
 const car={...createVehicle('🛻',()=>.5),type:'fast',priceLocked:2};const s=station([car]);
 const limited=dispatchEnergy(s,{...config,baseLoadLimit:10},1);assert.equal(limited.load,10);assert.equal(car.lastPowerKw,10);
 car.kwhReceived=car.kwhNeeded-.05;const final=dispatchEnergy(s,config,1);assert.ok(Math.abs(final.revenue-.1)<1e-9);assert.equal(vehicleSoc(car),1);assert.equal(dispatchEnergy(s,config,1).revenue,0);
});
