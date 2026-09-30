const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dispatchEnergy } = require('../docs/energy.js');
const config = { baseLoadLimit:20, transformerBoost:20, batteryCap:100, batteryRate:20, solarMax:10, chargerPower:{slow:7,fast:30}, weather:{eff:{sunny:1,rainy:.1}} };
const make = (overrides={}) => ({hour:12,weather:'sunny',batteryKwh:0,activeBuffs:[],settings:{mode:'std'},assets:{solar:0,battery:0,transformer:0},cars:[{type:'slow',kwhNeeded:50,kwhReceived:49.5,priceLocked:2}],...overrides});
test('partial final charge is billed once for exactly delivered energy',()=>{
 const s=make(); const r=dispatchEnergy(s,config,1); assert.equal(s.cars[0].kwhReceived,50);assert.equal(r.revenue,1);assert.equal(r.cost,.5);
 const second=dispatchEnergy(s,config,1);assert.equal(second.revenue,0);assert.equal(second.cost,0);
});
test('off-grid station never imports power, empty battery means zero revenue at night',()=>{
 const s=make({hour:23,settings:{mode:'offgrid'},assets:{solar:5,battery:1,transformer:0},cars:[{type:'fast',kwhNeeded:50,kwhReceived:0,priceLocked:2}]});
 const r=dispatchEnergy(s,config,.35);assert.equal(r.grid,0);assert.equal(r.revenue,0);assert.equal(s.cars[0].kwhReceived,0);assert.equal(s.batteryKwh,0);
});
test('off-grid dispatch shares only available solar and battery energy among cars',()=>{
 const s=make({settings:{mode:'offgrid'},assets:{solar:1,battery:1,transformer:0},batteryKwh:1,cars:[{type:'fast',kwhNeeded:50,kwhReceived:0,priceLocked:2},{type:'slow',kwhNeeded:50,kwhReceived:0,priceLocked:1}]});
 const r=dispatchEnergy(s,config,.35);assert.equal(r.grid,0);assert.ok(Math.abs(r.delivered-8/3)<1e-10);assert.equal(s.batteryKwh,0);
 assert.ok(Math.abs(s.cars.reduce((sum,c)=>sum+c.kwhReceived,0)-r.delivered)<1e-10);
});
test('fast-charge buff cannot violate feeder limit; charging storage uses spare grid capacity',()=>{
 const s=make({activeBuffs:[{type:'chargeSpeedMult',val:2}],assets:{solar:0,battery:1,transformer:0},cars:[{type:'fast',kwhNeeded:50,kwhReceived:0,priceLocked:2}]});
 const r=dispatchEnergy(s,config,.35);assert.ok(r.grid<=20+1e-9);assert.equal(s.batteryKwh,0);assert.ok(r.load<=20+1e-9);assert.equal(r.revenue,r.delivered*2);
});
test('solar surplus and grid charging respect storage capacity and charge-rate limit',()=>{
 const s=make({assets:{solar:10,battery:1,transformer:1},cars:[],batteryKwh:99});
 const r=dispatchEnergy(s,config,.35);assert.equal(s.batteryKwh,100);assert.equal(r.grid,0);assert.equal(r.revenue,0);
});
test('peak dispatch uses solar, then storage, then grid while conserving energy',()=>{
 const s=make({assets:{solar:1,battery:1,transformer:2},batteryKwh:50,cars:[{type:'fast',kwhNeeded:50,kwhReceived:0,priceLocked:2}]});
 const r=dispatchEnergy(s,config,1.5);assert.equal(r.solar,10);assert.equal(r.batt,20);assert.ok(r.grid<1e-9);assert.equal(r.delivered,5);assert.equal(r.revenue,10);
});
test('off-grid output scales with generation and storage, independent of a disconnected grid feeder',()=>{
 const s=make({settings:{mode:'offgrid'},assets:{solar:6,battery:2,transformer:0},batteryKwh:100,cars:[{type:'fast',kwhNeeded:50,kwhReceived:0,priceLocked:2},{type:'fast',kwhNeeded:50,kwhReceived:0,priceLocked:2}]});
 const r=dispatchEnergy(s,config,.35);assert.equal(r.limit,100);assert.equal(r.load,60);assert.equal(r.grid,0);assert.equal(r.revenue,20);
});
