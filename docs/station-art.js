/* Hand-drawn vector scenery. Art never changes the simulation or its random stream. */
(function (root) {
    const CAR_COLORS = [ ['#ef7855','#c34d3e'], ['#f1bd45','#c68b2b'], ['#48a5d0','#287898'], ['#cf536c','#99384f'], ['#e9eeec','#9daeb2'], ['#f4f0e1','#b6b4a3'], ['#8e84cf','#655da0'], ['#54b89e','#338878'] ];
    const EMOJIS = ['🚗','🚕','🚙','🏎️','🚓','🚑','🚐','🛻'];
    const vehicles = new Map();
    let sceneState = null, visualTime = 0, previousTime = 0, previousPaused = true;
    const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reducedMotion = () => !!motionQuery?.matches;
    const now = () => typeof performance !== 'undefined' ? performance.now() : 0;
    function sync(state) {
        const stamp = now();
        if (sceneState !== state) {
            vehicles.clear(); sceneState = state; visualTime = 0; previousTime = stamp;
            for (const v of state.cars) vehicles.set(v, {car:v,phase:'parked',started:0,model:Math.max(0,EMOJIS.indexOf(v.emoji)),dock:null,pose:null});
        }
        if (!state.paused && !previousPaused) visualTime += Math.min(100, Math.max(0, stamp - previousTime));
        previousTime = stamp; previousPaused = state.paused;
        const active = new Set(state.cars);
        for (const v of state.cars) if (!vehicles.has(v)) vehicles.set(v,{car:v,phase:reducedMotion()?'parked':'entering',started:visualTime,model:Math.max(0,EMOJIS.indexOf(v.emoji)),dock:null,pose:null});
        for (const [key,v] of vehicles) if (!active.has(key) && v.phase !== 'leaving') {
            if (reducedMotion() || !v.dock) vehicles.delete(key);
            else {v.phase='leaving';v.started=visualTime;v.exitStart=v.pose || v.dock}
        }
    }
    function inspect() { return Array.from(vehicles.values(),v=>({phase:v.phase,model:v.model,pose:v.pose?{...v.pose}:null})); }

    function draw(c, W, H, state) {
        sync(state);
        const night = state.hour < 6 || state.hour >= 19;
        const rr = (x,y,w,h,r,fill) => { c.fillStyle=fill; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); };
        const shape = (points,fill,stroke) => { c.beginPath(); points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p)); c.closePath(); if(fill){c.fillStyle=fill;c.fill()} if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke()} };
        const ellipse = (x,y,rx,ry,fill) => {c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill()};
        const label = (s,x,y,size,color,align='left') => { c.font=`600 ${size}px "PingFang SC",sans-serif`; c.fillStyle=color; c.textAlign=align;c.fillText(s,x,y);c.textAlign='left'};
        function tree(x,y,s=1) {
            c.save();c.translate(x,y);c.scale(s,s);
            ellipse(5,6,17,6,'#234f4227');rr(-10,0,20,7,3,'#c5c7aa');rr(-2,-17,5,21,1,'#896349');
            ellipse(0,-20,15,16,'#287958');ellipse(-7,-23,11,12,'#409267');ellipse(4,-30,12,11,'#5caa73');ellipse(-2,-33,7,6,'#89c080');
            c.restore();
        }
        function car(x,y,s,index=0) {
            const model=index%CAR_COLORS.length;
            const [paint,shade]=CAR_COLORS[model];
            const boxy=[2,5,6].includes(model), sporty=model===3, pickup=model===7;
            const roofY=boxy?-34:sporty?-21:-28;
            const backX=boxy?-27:pickup?-4:-19;
            const frontX=boxy?16:pickup?18:12;
            c.save();c.translate(x,y);c.scale(s,s);
            ellipse(2,17,41,11,'#213a4936');
            // Four tires, sidewalls, metal hubs, and the far axle.
            for(const [tx,ty] of [[-25,2],[24,3],[-23,16],[25,16]]) {ellipse(tx,ty,7,9,'#23313e');ellipse(tx+1,ty,3.5,5,'#8d9ba4');ellipse(tx+1,ty,1.5,2.5,'#dce4e8')}
            c.beginPath();c.moveTo(-39,0);c.quadraticCurveTo(-38,-9,-28,-10);c.lineTo(backX,roofY+5);c.quadraticCurveTo(backX+2,roofY,backX+12,roofY);c.lineTo(frontX,roofY);c.quadraticCurveTo(frontX+6,roofY+1,28,-14);c.lineTo(38,-11);c.quadraticCurveTo(44,-9,43,4);c.lineTo(38,12);c.lineTo(32,14);c.quadraticCurveTo(32,5,25,5);c.quadraticCurveTo(17,5,18,16);c.lineTo(-16,16);c.quadraticCurveTo(-15,5,-23,5);c.quadraticCurveTo(-32,5,-31,14);c.lineTo(-39,10);c.closePath();c.fillStyle=shade;c.fill();
            shape([[-38,-3],[-28,-10],[-17,-12],[25,-10],[38,-11],[43,-4],[36,3],[-36,3]],paint);
            shape([[backX-6,-10],[backX+2,roofY+4],[backX+12,roofY+1],[frontX-1,roofY+1],[26,-13],[13,-8]],paint);
            // The roof is seen from above; the windscreen and two side windows face the viewer.
            shape([[backX+4,roofY+5],[backX+12,roofY+2],[frontX-3,roofY+2],[frontX+5,roofY+11],[backX+14,roofY+11]],'#ffffff56');
            if(!pickup)shape([[backX-2,-11],[backX+4,roofY+6],[-7,roofY+5],[-6,-12]],'#244e64');
            shape([[-3,-12],[-4,roofY+5],[frontX-3,roofY+5],[19,-12]],'#244e64');
            shape([[frontX-1,roofY+4],[frontX+4,roofY+5],[25,-13],[20,-11]],'#86c5d3');
            shape([[-19,-13],[-15,-20],[-10,-21],[-9,-14]],'#75bfd040');
            c.strokeStyle='#ffffff5c';c.lineWidth=1;c.beginPath();c.moveTo(-36,-1);c.lineTo(35,-1);c.stroke();
            c.strokeStyle=shade;c.lineWidth=.8;c.beginPath();c.moveTo(-5,-9);c.lineTo(-5,13);c.moveTo(16,-7);c.lineTo(16,6);c.stroke();
            rr(-1,-5,6,2,1,'#eaf4ed');rr(-17,-5,6,2,1,'#eaf4ed');
            rr(21,-13,6,4,1,shade);rr(36,-5,6,4,1,'#fff1b1');rr(-39,-3,3,5,1,'#ef453e');
            shape([[37,5],[43,0],[42,6],[37,10]],'#233a46');rr(29,11,8,2,1,'#eaf1eb');
            if(model===1){rr(-5,roofY-4,16,6,2,'#fff4ce');label('TAXI',-3,roofY+1,4,'#84671d')}
            if(model===2){rr(-20,roofY-2,30,2,1,'#314c5b');rr(-26,0,55,3,1,'#244e6470')}
            if(model===3){rr(-38,-10,10,3,1,'#5e3542');rr(26,7,16,2,1,'#422f3a');shape([[8,roofY+2],[11,roofY+2],[24,-13],[21,-12]],'#fff4cd')}
            if(model===4){rr(-35,0,70,4,1,'#316caa');rr(-2,roofY-3,6,4,1,'#e5565c');rr(4,roofY-3,6,4,1,'#508ce2')}
            if(model===5){rr(-27,-10,21,20,2,'#f8f6e8');rr(-21,-5,5,13,0,'#d74e4a');rr(-25,-1,13,5,0,'#d74e4a');rr(-1,roofY-3,12,4,1,'#df5953')}
            if(model===6){rr(-30,-16,16,12,2,'#345b6c');c.strokeStyle='#afb4d9';c.beginPath();c.moveTo(-11,-13);c.lineTo(-11,11);c.stroke()}
            if(pickup){shape([[-37,-11],[-9,-12],[-5,-4],[-34,-2]],'#2c685e');c.strokeStyle='#7ac4ae';c.beginPath();c.moveTo(-28,-10);c.lineTo(-26,-3);c.moveTo(-18,-10);c.lineTo(-16,-3);c.stroke()}
            if(night){ellipse(40,-3,9,4,'#ffe9a845')}
            c.restore();
        }
        function charger(x,y,fast,connected,s=1) {
            c.save();c.translate(x,y);c.scale(s,s);
            ellipse(4,3,13,5,'#26495724');rr(-11,0,24,5,2,'#8b9fa4');
            const tone=fast?'#f0a334':'#1b9a97';
            shape([[8,-35],[14,-31],[14,0],[8,3]],fast?'#b7742b':'#147c7c');
            rr(-9,-35,19,37,3,'#f3f6ed');rr(-9,-35,19,8,3,tone);rr(-6,-23,13,11,2,'#203f50');rr(-4,-21,9,4,1,connected?'#8fe5b8':'#89bed3');
            label(fast?'DC':'AC',-3,-7,5.5,'#36757a');rr(-5,-4,11,2,1,tone);
            // A hanging lead and a black charging gun are visible even when the bay is empty.
            c.strokeStyle='#233d45';c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(11,-22);c.bezierCurveTo(25,-18,24,8,15,5);c.bezierCurveTo(10,3,18,-10,18,-15);c.stroke();rr(15,-21,5,9,1,'#263e49');rr(17,-23,4,4,1,'#4d6470');
            if(connected){c.beginPath();c.moveTo(13,-20);c.bezierCurveTo(24,-6,15,16,19,24);c.stroke();rr(17,21,5,4,1,'#233d45')}
            c.restore();
        }
        function utilities(x,y) {
            c.save();c.translate(x,y);
            ellipse(48,27,62,8,'#3757491a');
            shape([[0,0],[74,0],[74,28],[0,28]],'#f6f0d8');shape([[74,0],[85,-7],[85,20],[74,28]],'#bac9bd');
            rr(8,7,23,18,2,'#65949b');rr(10,9,19,11,1,'#315464');rr(42,9,24,13,1,'#aecdc2');
            shape([[-5,0],[9,-13],[86,-13],[78,2]],'#258c86');shape([[-5,0],[78,2],[78,7],[-5,5]],'#166d72');
            label('EV 充电站',10,4,8,'#fff3bc');
            if(state.assets.solar){
                shape([[11,-14],[20,-27],[84,-27],[77,-14]],'#264f76','#96bacb');
                c.strokeStyle='#70aac4';c.lineWidth=.7;for(let i=0;i<4;i++){c.beginPath();c.moveTo(20+i*15,-26);c.lineTo(12+i*15,-15);c.stroke()}c.beginPath();c.moveTo(16,-20);c.lineTo(80,-20);c.stroke();
            }
            if(state.assets.battery){rr(98,-2,16,26,2,'#eef3e4');shape([[114,-2],[121,-6],[121,19],[114,24]],'#9fb5ab');rr(101,1,10,5,1,'#2b735e');label('ϟ',102,17,13,'#3b9b73')}
            c.restore();
        }
        c.save();c.clearRect(0,0,W,H);
        c.fillStyle=night?'#344957':'#a7cc8e';c.fillRect(0,0,W,H);
        // A landscaped forecourt, rather than a grid of interface cards.
        rr(8,25,W-16,H-39,8,night?'#65777b':'#e6e5ce');
        const roadH=H>150?38:23, roadY=H-roadH;
        c.fillStyle=night?'#253743':'#637b87';c.fillRect(0,roadY,W,roadH);
        c.fillStyle='#b6c7c0';c.fillRect(0,roadY-4,W,4);
        c.strokeStyle=night?'#71818b':'#e1e7dd';c.lineWidth=1.5;c.setLineDash([14,14]);c.beginPath();c.moveTo(0,roadY+roadH*.58);c.lineTo(W,roadY+roadH*.58);c.stroke();c.setLineDash([]);
        for(let i=0;i<5;i++)rr(18+i*5,roadY+3,3,roadH-7,0,'#dce4d3');
        const tall=H>=185;
        if(tall){utilities(W/2-55,42);tree(28,62,.7);tree(W-25,62,.8)}
        else {tree(15,46,.55);tree(W-13,45,.55)}
        const types=[];for(const kind of ['slow','fast'])for(let i=0;i<state.assets[kind+'Charger'];i++)types.push([kind,i]);
        const shown=Math.min(12,types.length), count=Math.max(3,shown), top=tall?76:27;
        const usableH=Math.max(25,roadY-top-6);let layout={scale:0};
        for(let cols=2;cols<=Math.min(count,6);cols++){const rows=Math.ceil(count/cols);const scale=Math.min((W-30)/cols/104,usableH/rows/91,1.5);if(scale>layout.scale)layout={cols,rows,scale}}
        const {cols,rows,scale}=layout, cellW=104*scale, cellH=91*scale;
        const startX=(W-cols*cellW)/2,startY=top+(usableH-rows*cellH)/2;
        for(let i=0;i<count;i++){
            const type=i<shown?types[i]:null;
            const vehicle=type&&state.cars.find(v=>v.type===type[0]&&v.slot===type[1]);
            const visual=vehicle&&vehicles.get(vehicle);
            if(visual) visual.dock={x:startX+i%cols*cellW+57*scale,y:startY+Math.floor(i/cols)*cellH+53*scale,s:.83*scale,angle:0};
            c.save();c.translate(startX+i%cols*cellW,startY+Math.floor(i/cols)*cellH);c.scale(scale,scale);
            shape([[7,32],[87,27],[99,72],[19,77]],type?'#bdd1b36e':'#c5cabb45');
            c.strokeStyle=type?'#fffdf0':'#a8b8a3';c.lineWidth=1.8;c.setLineDash(type?[]:[4,4]);
            c.beginPath();c.moveTo(7,34);c.lineTo(19,75);c.lineTo(36,74);c.moveTo(70,71);c.lineTo(97,69);c.lineTo(85,28);c.stroke();c.setLineDash([]);
            if(type){
                charger(21,30,type[0]==='fast',!!visual&&visual.phase==='parked',1);
                if(vehicle){const pct=typeof vehicleSoc==='function'?vehicleSoc(vehicle):Math.min(1,vehicle.kwhReceived/vehicle.kwhNeeded);rr(36,78,52,3,1,'#a4b5a1');rr(36,78,52*pct,3,1,'#209a73');label(visual.phase==='entering'?'驶入':`${Math.round(pct*100)}%`,10,83,7,'#377964');const cap=vehicle.type==='slow'?vehicle.maxAcKw:vehicle.maxDcKw;label(`${(vehicle.lastPowerKw||0).toFixed(1)} / ${cap??(vehicle.type==='slow'?7:30)} kW`,47,90,7,'#557968','center')}
                else {label('空闲',59,60,9,'#869c86','center');shape([[53,66],[57,63],[61,66],[57,69]],'#acc9a0')}
                label(vehicle&&vehicle.batteryCapacity?`${vehicle.modelName} ${vehicle.batteryCapacity}kWh`:`${type[0]==='fast'?'快充':'慢充'} ${type[1]+1}`,43,17,7,night?'#e0e9d6':'#39716d');
            } else {label('扩建车位',52,58,8,'#97a18a','center')}
            c.restore();
        }
        // Passing traffic stays on the road. Only real customers acquire a bay.
        if(H>150&&!reducedMotion()){const pass=(visualTime%6500)/6500;car(-55+(W+110)*pass,roadY+22,.45,Math.floor(visualTime/6500)%8)}
        const lerp=(a,b,t)=>a+(b-a)*t;
        for(const [key,v] of vehicles){
            if(!v.dock)continue;
            const duration=Math.max(550,1400*(state.gameSpeed || 500)/500);
            let t=Math.min(1,(visualTime-v.started)/duration);
            if(reducedMotion())t=1;
            let pose;
            if(v.phase==='entering'){
                if(t>=1){v.phase='parked';pose=v.dock}
                else {const bend=t*t*(3-2*t);pose={x:lerp(-55,v.dock.x,bend),y:lerp(roadY+roadH*.62,v.dock.y,Math.max(0,(t-.3)/.7)**2),s:lerp(.45,v.dock.s,t),angle:-Math.sin(t*Math.PI)*.24}}
            } else if(v.phase==='leaving'){
                if(t>=1){vehicles.delete(key);continue}
                const begin=v.exitStart;const turn=Math.min(1,t/.55);pose={x:t<.55?lerp(begin.x,begin.x+18,turn):lerp(begin.x+18,W+65,(t-.55)/.45),y:lerp(begin.y,roadY+roadH*.62,turn),s:lerp(begin.s,.45,turn),angle:Math.sin(turn*Math.PI)*.2};
            } else pose=v.dock;
            v.pose={...pose};c.save();c.translate(pose.x,pose.y);c.rotate(pose.angle);car(0,0,pose.s,v.model);c.restore();
        }
        if(types.length>shown)label(`另有 ${types.length-shown} 桩营业`,W-10,roadY-9,8,night?'#d6e6da':'#506d6a','right');
        if(night){c.fillStyle='#182d4930';c.fillRect(0,0,W,H)}
        if(['rainy','stormy'].includes(state.weather)){c.strokeStyle='#b8d6e488';c.lineWidth=1;for(let i=0;i<30;i++){const x=(i*97+state.minute*3)%W,y=(i*47)%H;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y+10);c.stroke()}}
        c.restore();
    }
    root.StationArt={draw,inspect,reducedMotion};
})(typeof globalThis!=='undefined'?globalThis:window);
