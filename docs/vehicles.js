/* Fictional vehicle classes for the simulation, not specifications of real models. */
(function(root){
    const VEHICLE_MODELS = [
        {id:'compact',name:'紧凑车',emoji:'🚗',capacity:42,maxAcKw:3.6,maxDcKw:25},
        {id:'taxi',name:'出租车',emoji:'🚕',capacity:58,maxAcKw:7,maxDcKw:60},
        {id:'suv',name:'SUV',emoji:'🚙',capacity:82,maxAcKw:11,maxDcKw:120},
        {id:'sports',name:'跑车',emoji:'🏎️',capacity:70,maxAcKw:11,maxDcKw:150},
        {id:'patrol',name:'巡逻车',emoji:'🚓',capacity:62,maxAcKw:11,maxDcKw:90},
        {id:'ambulance',name:'救护车',emoji:'🚑',capacity:86,maxAcKw:22,maxDcKw:100},
        {id:'van',name:'厢式车',emoji:'🚐',capacity:76,maxAcKw:7,maxDcKw:50},
        {id:'pickup',name:'皮卡',emoji:'🛻',capacity:110,maxAcKw:11,maxDcKw:180}
    ];
    function arrivalSoc(random=Math.random){
        // Rejection sampling preserves a truncated normal rather than piling up at its bounds.
        for(let i=0;i<32;i++){
            const z=Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,random())))*Math.cos(2*Math.PI*random());
            const soc=.2+.07*z;
            if(soc>=.05&&soc<=.5)return soc;
        }
        return .2;
    }
    function vehicleModel(emoji){return VEHICLE_MODELS.find(v=>v.emoji===emoji)||VEHICLE_MODELS[0]}
    function createVehicle(emoji,random=Math.random){
        const model=vehicleModel(emoji),initialSoc=arrivalSoc(random);
        return {emoji,modelId:model.id,modelName:model.name,batteryCapacity:model.capacity,maxAcKw:model.maxAcKw,maxDcKw:model.maxDcKw,initialSoc,kwhNeeded:model.capacity*(1-initialSoc),kwhReceived:0,lastPowerKw:0};
    }
    function vehicleSoc(car){return car.batteryCapacity?Math.min(1,car.initialSoc+car.kwhReceived/car.batteryCapacity):Math.min(1,car.kwhReceived/car.kwhNeeded)}
    root.VEHICLE_MODELS=VEHICLE_MODELS;root.arrivalSoc=arrivalSoc;root.vehicleModel=vehicleModel;root.createVehicle=createVehicle;root.vehicleSoc=vehicleSoc;
    if(typeof module!=='undefined')module.exports={VEHICLE_MODELS,arrivalSoc,vehicleModel,createVehicle,vehicleSoc};
})(typeof globalThis!=='undefined'?globalThis:window);
