const LOAN_DAILY_RATE = 0.02;
const CITY_CONFIG = {
    bj: { name: "北京", prices: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.75, 0.75, 0.75, 1.50, 1.50, 1.50, 0.75, 0.75, 0.75, 0.75, 1.50, 1.50, 1.50, 1.50, 1.50, 0.75, 0.35] },
    gz: { name: "广州", prices: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.75, 0.75, 1.50, 1.50, 0.75, 0.75, 1.50, 1.50, 1.50, 1.50, 1.50, 0.75, 0.75, 0.75, 0.75, 0.75] },
    sh: { name: "上海", prices: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.75, 0.75, 1.50, 1.50, 1.50, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 1.50, 1.50, 1.50, 0.75, 0.35, 0.35] }
};

const LOC_CONFIG = {
    res: { name: "居民区", traffic: [0.3, 0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 0.5, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.6, 0.8, 0.9, 1.0, 0.9, 0.7, 0.5, 0.4] }, 
    com: { name: "商业区", traffic: [0.05, 0.05, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.8, 0.7, 0.7, 0.6, 0.7, 0.9, 1.0, 1.0, 0.9, 0.6, 0.3, 0.1] }, 
    ind: { name: "就业中心", traffic: [0.05, 0.05, 0.05, 0.05, 0.1, 0.2, 0.5, 0.9, 1.0, 0.8, 0.6, 0.5, 0.5, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05] } 
};

const CONFIG = {
    initialMoney: 3500, 
    dailyCost: { slowCharger: 10, fastCharger: 20, solar: 10, battery: 10, transformer: 10 },
    baseWeeklyRent: 1000,
    rentGrowth: 250, 
    baseCosts: { slowCharger: 600, fastCharger: 1200, solar: 600, battery: 600, transformer: 600, marketing: 1500 },
    inflationRate: 1.10, 
    batteryCap: 100, batteryRate: 20, solarMax: 10, 
    baseLoadLimit: 20, transformerBoost: 20, 
    chargerPower: { slow: 7, fast: 30 },
    baseDailyPool: 15, 
    weather: {
        types: ['sunny', 'cloudy', 'rainy'],
        probs: [0.6, 0.25, 0.15],
        eff: { sunny: 1.0, cloudy: 0.6, rainy: 0.1, foggy: 0.4, stormy: 0.0, snowy: 0.25 },
        icons: { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', foggy: '🌫️', stormy: '⛈️', snowy: '❄️' }
    },
    carEmojis: ['🚗', '🚕', '🚙', '🏎️', '🚓', '🚑', '🚐', '🛻'],
    targetDays: 100
};

function generateTimeLabels() {
    const labels = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 10) {
            labels.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }
    return labels;
}
const TIME_LABELS = generateTimeLabels();

const weatherSystem = { sunAngle: 0, clouds: [], rainDrops: [], init: false };
function initWeatherSystem(w, h) {
    weatherSystem.clouds = [];
    for(let i=0; i<5; i++) { weatherSystem.clouds.push({ x: Math.random() * w, y: 20 + Math.random() * 60, speed: 0.2 + Math.random() * 0.3, scale: 0.8 + Math.random() * 0.5 }); }
    weatherSystem.rainDrops = [];
    for(let i=0; i<100; i++) { weatherSystem.rainDrops.push({ x: Math.random() * w, y: Math.random() * h, speed: 10 + Math.random() * 10, len: 10 + Math.random() * 15 }); }
    weatherSystem.init = true;
}

// ================= 状态管理 =================
let state = getInitialState();
let selectedSettings = { city: 'sh', loc: 'ind', mode: 'std' };
let modalOpenCount = 0;
let myChart = null;
let loanConfig = { type: 'installment' }; // 'installment' (等额本息) or 'principal' (等额本金)
let currentLevel = 0; // 当前选择的关卡
let unlockedLevels = []; // 已解锁的关卡

function getInitialState() {
    return {
        money: CONFIG.initialMoney, day: 1, hour: 8, minute: 0, 
        paused: true, gameSpeed: 500, lastGameSpeed: 500,
        assets: { slowCharger: 1, fastCharger: 0, solar: 0, battery: 0, transformer: 0 }, 
        currentCosts: { ...CONFIG.baseCosts },
        batteryKwh: 0, price: 1.5, 
        dailyPoolMax: CONFIG.baseDailyPool, dailyPoolLeft: CONFIG.baseDailyPool,
        cars: [], 
        lastTickData: { load: 0, solar: 0, batt: 0, grid: 0, limit: CONFIG.baseLoadLimit, battAction: 'idle' },
        chartData: { solar: new Array(144).fill(null), battery: new Array(144).fill(null), load: new Array(144).fill(null), yesterdayLoad: new Array(144).fill(null) },
        weeksSurvived: 0,
        nextEventTime: null,
        activeBuffs: [],
        timer: null,
        currentDayProfit: 0, lastDayProfit: null,
        pendingRent: 0,
        weather: rollWeather(),
        forecast: rollWeather(),
        victoryAchieved: false,
        settings: { city: 'bj', loc: 'res', mode: 'std' },
        // 新增贷款状态
        loan: { active: false, principal: 0, totalRemaining: 0, daysLeft: 0, type: 'installment', originalDays: 0, originalPrincipal: 0 }
    };
}

// ================= UI & Setup =================

function selectOption(type, val) {
    const choices = { city: ['sh','gz','bj'], loc: ['ind','com','res'], mode: ['std','super','offgrid','ghost','luxury','powerlimit','inflation','rain','shark'] };
    if (!choices[type]?.includes(val)) return;
    selectedSettings[type] = val;
    document.getElementById(type + '-select').value = val;
    if (type === 'city') document.getElementById('city-desc').textContent = { sh: '日间平价时段长，适合新手。', gz: '下午电价高，留意储能。', bj: '晚高峰较长，留意夜间成本。' }[val];
    if (type === 'loc') document.getElementById('loc-desc').textContent = { ind: '早高峰客流较旺。', com: '日间和晚间都有客流。', res: '晚间客流集中。' }[val];
}

function selectLevel(level) {
    if (level > 0 && !isLevelUnlocked(level)) return;
    if (level === 0) { closeModal('level-select-modal'); openModal('start-modal'); return; }
    closeModal('level-select-modal');
    startLevelGame(level);
}


function startLevelGame(level) {
    clearTimeout(state.timer);
    currentLevel = level;
    state = getInitialState();
    const mission = CAMPAIGN.find(l => l.id === level);
    state.settings = { city: mission.city, loc: mission.loc, mode: mission.mode };
    state.targetDays = mission.days;
    state.levelName = mission.name;
    state.money = mission.money;
    state.assets = { ...state.assets, ...mission.assets };
    state.dailyPoolMax = mission.pool || 20;
    state.dailyPoolLeft = state.dailyPoolMax;
    state.weather = 'sunny'; state.forecast = 'sunny';
    launchGame();
}


function startGame() {
    clearTimeout(state.timer);
    closeModal('start-modal');
    currentLevel = 0;
    state = getInitialState();
    state.settings = { ...selectedSettings };
    state.levelName = '自由经营';
    state.dailyPoolMax = state.settings.mode === 'luxury' ? 40 : state.settings.mode === 'jam' ? 999 : 20;
    state.dailyPoolLeft = state.dailyPoolMax;
    if (state.settings.mode === 'super') { state.assets.slowCharger = 0; state.assets.fastCharger = 1; state.assets.transformer = 1; }
    if (state.settings.mode === 'offgrid') { state.assets.solar = 3; state.assets.battery = 2; state.batteryKwh = 100; }
    launchGame();
}


function initChart() {
    const chartDom = document.getElementById('chart-container');
    if (myChart) { myChart.dispose(); myChart = null; }
    if (!chartDom.clientWidth) return;
    myChart = echarts.init(chartDom);
    const option = {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        grid: { left: '5%', right: '5%', bottom: '5%', top: '20%', containLabel: true },
        legend: { data: ['昨日', '光伏', '储能', '电网'], top: 2, textStyle: { color: '#64748b', fontSize: 10 }, itemWidth: 10, itemHeight: 8, icon: 'roundRect' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', boundaryGap: false, data: TIME_LABELS, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: true, color: '#94a3b8', fontSize: 9, interval: 23 } },
        yAxis: { type: 'value', min: 0, splitLine: { show: true, lineStyle: { color: '#e2e8f0', type: 'dashed' } }, axisLabel: { color: '#64748b', fontSize: 9, formatter: '{value}' } },
        series: [
            { name: '昨日', type: 'line', data: state.chartData.yesterdayLoad, showSymbol: false, smooth: true, itemStyle: { color: '#94a3b8' }, lineStyle: { width: 1.5, type: 'dashed' }, z: 1 },
            { name: '光伏', type: 'line', data: state.chartData.solar, showSymbol: false, smooth: true, itemStyle: { color: '#d9b96e' }, lineStyle: { width: 0 }, areaStyle: { opacity: 0.3 }, z: 2 },
            { name: '储能', type: 'line', data: state.chartData.battery, showSymbol: false, smooth: true, itemStyle: { color: '#8cb06a' }, lineStyle: { width: 1.5 }, z: 3 },
            { name: '电网', type: 'line', data: state.chartData.load, showSymbol: false, smooth: true, itemStyle: { color: '#7399a6' }, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(115, 153, 166, 0.25)' }, { offset: 1, color: 'rgba(59, 130, 246, 0)' }]) }, z: 4 }
        ]
    };
    myChart.setOption(option);
}

function restartGame() {
    clearTimeout(state.timer);
    closeModal('game-over-modal');
    showCampaign();
}


function continueGame() {
    closeModal('game-over-modal');
    state.ended = false;
    setSpeed(state.lastGameSpeed);
    saveGame(true);
}


function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal || !modal.classList.contains('hidden')) return;
    if (modalOpenCount === 0) modalWasRunning = !state.paused;
    modal.classList.remove('hidden');
    modalOpenCount++;
    modal.setAttribute('aria-modal', 'true');
    state.paused = true;
    clearTimeout(state.timer);
    const first = modal.querySelector('button:not([disabled]), input');
    if (first) first.focus({ preventScroll: true });
    updateUI();
}


function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    modal.removeAttribute('aria-modal');
    modalOpenCount = Math.max(0, modalOpenCount - 1);
}


// ================= 贷款系统逻辑 =================
function openLoanModal() {
    if (currentLevel === 1) return;
    openModal('loan-modal');
    if (state.loan.active) {
        document.getElementById('loan-form').classList.add('hidden');
        document.getElementById('loan-status-view').classList.remove('hidden');
        document.getElementById('status-principal').innerText = `$${Math.round(state.loan.principal)}`;
        document.getElementById('status-days').innerText = state.loan.daysLeft;
    } else {
        document.getElementById('loan-form').classList.remove('hidden');
        document.getElementById('loan-status-view').classList.add('hidden');
        updateLoanPreview();
    }
}

function setLoanType(type) {
    loanConfig.type = type;
    document.getElementById('btn-installment').className = type === 'installment' 
        ? "border-2 border-blue-500 bg-blue-50 text-blue-700 rounded-lg p-2 text-center cursor-pointer transition-colors"
        : "border border-slate-200 text-slate-600 rounded-lg p-2 text-center cursor-pointer transition-colors";
        
    document.getElementById('btn-principal').className = type === 'principal' 
        ? "border-2 border-blue-500 bg-blue-50 text-blue-700 rounded-lg p-2 text-center cursor-pointer transition-colors"
        : "border border-slate-200 text-slate-600 rounded-lg p-2 text-center cursor-pointer transition-colors";
    updateLoanPreview();
}
function updateLoanPreview() {
    const principal = parseInt(document.getElementById('loan-amt-slider').value);
    const days = parseInt(document.getElementById('loan-days-slider').value);
    const plan = loanPlan(principal, days, loanConfig.type, LOAN_DAILY_RATE);
    window.previewLoanData = plan;
    document.getElementById('loan-amt-val').innerText = `$${principal}`;
    document.getElementById('loan-days-val').innerText = `${days}天`;
    document.getElementById('loan-total-repay').innerText = `$${plan.totalRepay.toFixed(2)}`;
    document.getElementById('loan-daily-repay').innerText = `$${plan.firstDayPayment.toFixed(2)}`;
}

function takeLoan() {
    const data = window.previewLoanData;
    if (!data || state.loan.active || currentLevel === 1) return;

    state.money += data.principal;
    
    state.loan = {
        active: true,
        type: data.type,
        
        // 通用数据
        principal: data.principal,       // 当前剩余本金
        daysLeft: data.days,             // 剩余天数
        originalDays: data.days,         // 原始天数（计算等额本金利息需要）
        
        // 等额本息专用数据
        fixedDaily: data.fixedDaily || 0,
        
        // 等额本金专用数据
        dailyBasePrincipal: data.dailyBasePrincipal || 0
    };

    spawnFloatText(`贷款 +$${data.principal}`, '#2563eb');
    closeLoanModal(); 
    updateUI();
}

function closeLoanModal() {
    closeModal('loan-modal');
    resumeAfterModal(); saveGame(true);
}


// ================= 核心循环 =================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;

function tick() {
    clearTimeout(state.timer);
    if (state.paused || modalOpenCount > 0 || state.ended) return;
    let gridPrice = currentGridPrice();
    let traffic = LOC_CONFIG[state.settings.loc].traffic[state.hour] * 0.18;
    if (state.settings.mode === 'ghost') traffic *= 0.5;
    if (['jam', 'luxury'].includes(state.settings.mode)) traffic *= 2;
    const buff = state.activeBuffs.find(b => b.type === 'trafficMult');
    if (buff) traffic *= buff.val;
    trySpawnCar(traffic);
    processEnergy(gridPrice);
    const i = state.hour * 6 + state.minute / 10;
    state.chartData.solar[i] = state.lastTickData.solar;
    state.chartData.battery[i] = state.lastTickData.batt;
    state.chartData.load[i] = state.lastTickData.grid;
    if (myChart) myChart.setOption({ series: [
        { data: state.chartData.yesterdayLoad }, { data: state.chartData.solar },
        { data: state.chartData.battery }, { data: state.chartData.load }
    ] });
    state.cars = state.cars.filter(car => {
        if (car.kwhReceived >= car.kwhNeeded - 0.001) { state.served = (state.served || 0) + 1; return false; }
        car.ticksLeft--;
        if (car.ticksLeft <= 0) { state.lost = (state.lost || 0) + 1; return false; }
        return true;
    });
    state.minute += 10;
    if (state.minute >= 60) {
        state.minute = 0; state.hour++;
        if (state.hour >= 24) { state.hour = 0; dailySettle(); }
        if (!checkEndGame() && modalOpenCount === 0 && state.nextEventTime && state.day === state.nextEventTime.day && state.hour === state.nextEventTime.hour) triggerRandomEvent();
    }
    if (checkEndGame()) return;
    updateUI(); draw(); saveGame();
    if (!state.paused && modalOpenCount === 0) state.timer = setTimeout(tick, state.gameSpeed);
}


function checkEndGame() {
    if (state.ended) return true;
    if (state.money < 0) { showGameOver(false); return true; }
    if (state.pendingRent > 0) return false;
    const mission = CAMPAIGN.find(l => l.id === currentLevel);
    const days = state.targetDays || CONFIG.targetDays;
    if (state.day > days && !state.victoryAchieved) {
        const passed = !mission || mission.goal(state);
        if (passed) state.victoryAchieved = true;
        showGameOver(passed, !passed);
        return true;
    }
    return false;
}


function showGameOver(victory, missedGoal = false) {
    state.paused = true; state.ended = true; clearTimeout(state.timer);
    document.querySelectorAll('[id$="-modal"]').forEach(el => { if (el.id !== 'game-over-modal') { el.classList.add('hidden'); el.removeAttribute('aria-modal'); } });
    modalOpenCount = 0;
    const mission = CAMPAIGN.find(l => l.id === currentLevel);
    if (victory && currentLevel) {
        unlockLevel(currentLevel + 1);
        const score = state.money >= state.initialMoney * 1.5 ? 3 : state.money >= state.initialMoney ? 2 : 1;
        progress[currentLevel] = Math.max(progress[currentLevel] || 0, score);
        writeStorage('ev_tycoon_progress_v2', progress);
    }
    document.getElementById('go-icon').innerText = victory ? '✦' : '↺';
    document.getElementById('go-title').innerText = victory ? (currentLevel === 6 ? '充电帝国，建成！' : '经营目标达成') : missedGoal ? '离目标还差一点' : '资金链断裂';
    document.getElementById('go-desc').innerText = victory ? `${state.levelName}完成，最终资金 $${state.money.toFixed(0)}。${currentLevel && currentLevel < 6 ? '下一关已解锁。' : '继续挑战更好的经营成绩。'}` : missedGoal ? `已完成 ${state.targetDays} 天经营，但还未达成「${mission.objective}」。调整投资节奏，再试一次。` : '提前预留租金，优先提高充电桩利用率，再逐步扩建。';
    document.getElementById('final-days').innerText = Math.max(0, state.day - 1);
    document.getElementById('btn-continue').classList.toggle('hidden', !victory);
    const next = document.getElementById('btn-next-level');
    next.classList.toggle('hidden', !victory || !currentLevel || currentLevel >= 6);
    next.onclick = () => { closeModal('game-over-modal'); startLevelGame(currentLevel + 1); };
    try { localStorage.removeItem('ev_tycoon_save_v2'); } catch (_) {}
    openModal('game-over-modal');
}


function processEnergy(gridPrice) {
    const result = dispatchEnergy(state, CONFIG, gridPrice);
    const profit = result.revenue - result.cost;
    state.money += profit; state.currentDayProfit += profit;
    state.totalRevenue = (state.totalRevenue || 0) + result.revenue;
    state.totalEnergy = (state.totalEnergy || 0) + result.delivered;
    state.lastTickData = result;
}


function scheduleNextEvent() {
    const offset = 2 + Math.floor(Math.random() * 4); 
    const hour = 9 + Math.floor(Math.random() * 9); 
    state.nextEventTime = { day: state.day + offset, hour: hour };
}

const EVENTS = {
    instant: [
        { t: "政府补贴", d: "新能源基建补助到账。", amt: 500, type: 'money' },
        { t: "设备过热", d: "几个模块烧坏了，需紧急维修。", amt: -300, type: 'money' },
        { t: "网红打卡", d: "某车评人来这充电，瞬间引流。", amt: 400, type: 'money' },
        { t: "偷电贼", d: "有人私接电线偷电被抓，罚款。", amt: -150, type: 'money' },
        { t: "环保罚单", d: "电池废液处理不当，环保局找上门。", amt: -500, type: 'money' },
        { t: "彩票中奖", d: "你在休息室捡到的彩票中了二等奖！", amt: 800, type: 'money' },
        { t: "设备老化", d: "部分设备老化严重，需要更换零件。", amt: -250, type: 'money' },
        { t: "客户打赏", d: "土豪车主觉得你服务不错，给了小费。", amt: 100, type: 'money' },
        { t: "保险理赔", d: "上次雷击损坏的设备，保险公司赔付了。", amt: 600, type: 'money' },
        { t: "员工培训", d: "组织员工参加专业培训，提升服务质量。", amt: -200, type: 'money' },
        { t: "银行利息", d: "账户余额产生的利息到账。", amt: 150, type: 'money' },
        { t: "设备被盗", d: "有人夜间偷走了部分充电设备。", amt: -400, type: 'money' },
        { t: "政府奖励", d: "被评为绿色能源示范站点，获得奖励。", amt: 700, type: 'money' },
        { t: "维修事故", d: "维修过程中发生意外，需要额外赔偿。", amt: -350, type: 'money' },
        { t: "广告收入", d: "在充电桩上投放广告获得收入。", amt: 300, type: 'money' },
        { t: "税务抽查", d: "税务部门抽查发现漏税问题，补缴税款。", amt: -450, type: 'money' },
        { t: "节能补贴", d: "使用节能设备获得额外补贴。", amt: 250, type: 'money' },
        { t: "客户投诉", d: "服务态度问题导致客户投诉，赔偿损失。", amt: -180, type: 'money' },
        { t: "技术升级", d: "系统技术升级，提升充电效率。", amt: -320, type: 'money' },
        { t: "合作推广", d: "与附近商家合作推广，获得推广费。", amt: 350, type: 'money' }
    ],
    longTerm: [
        { t: "台风过境", d: "台风'皮卡丘'来袭！暴雨不断，光伏发电基本报废。", type: 'forcedWeather', val: 'rainy', icon: '⛈️' },
        { t: "原材料暴跌", d: "国际铜价崩盘！电网电价打8折。", type: 'gridDiscount', val: 0.8, icon: '📉' },
        { t: "城市马拉松", d: "全城封路跑马拉松。客流减半。", type: 'trafficMult', val: 0.5, icon: '🏃' },
        { t: "高温预警", d: "连日高温，大家都不想出门。但光伏效率爆表(120%)！", type: 'multiBuff', buffs: [ { type: 'forcedWeather', val: 'sunny' }, { type: 'solarEfficiency', val: 1.2 } ], icon: '🥵' },
        { t: "油价暴涨", d: "国际油价起飞，开油车的都哭了。客流 +50%。", type: 'trafficMult', val: 1.5, icon: '⛽' },
        { t: "电池技术突破", d: "宁王发布新电池，储能设备采购打7折！", type: 'assetDiscount', target: 'battery', val: 0.7, icon: '🔋' },
        { t: "光伏产能过剩", d: "组件厂清库存，光伏板采购打7折！", type: 'assetDiscount', target: 'solar', val: 0.7, icon: '📉' },
        { t: "基建狂魔", d: "工程队大促销，充电桩和变压器安装费8折！", type: 'assetDiscount', target: 'infra', val: 0.8, icon: '🏗️' },
        { t: "极寒天气", d: "寒潮来袭！电池效率下降30%，但电网需求激增电价上涨。", type: 'multiBuff', buffs: [ { type: 'batteryEfficiency', val: 0.7 }, { type: 'gridPriceMult', val: 1.4 } ], icon: '❄️' },
        { t: "充电联盟", d: "加入城市充电联盟，客流增加但需支付联盟费用。", type: 'multiBuff', buffs: [ { type: 'trafficMult', val: 1.4 }, { type: 'dailyCostMult', val: 1.2 } ], icon: '🤝' },
        { t: "技术革新", d: "新技术让充电速度提升20%，但设备维护成本增加。", type: 'multiBuff', buffs: [ { type: 'chargeSpeedMult', val: 1.2 }, { type: 'dailyCostMult', val: 1.15 } ], icon: '⚡' },
        { t: "政策补贴", d: "政府推出新能源补贴政策，电价打7折。", type: 'gridDiscount', val: 0.7, icon: '🏛️' },
        { t: "用电高峰", d: "夏季用电高峰期，电网价格飙升50%。", type: 'gridPriceMult', val: 1.5, icon: '📈' },
        { t: "设备升级", d: "智能化升级完成，设备效率提升但维护成本增加。", type: 'multiBuff', buffs: [ { type: 'solarEfficiency', val: 1.3 }, { type: 'batteryEfficiency', val: 1.2 }, { type: 'dailyCostMult', val: 1.25 } ], icon: '🤖' },
        { t: "市场竞争", d: "附近新开充电站，客流减少25%。", type: 'trafficMult', val: 0.75, icon: '⚔️' },
        { t: "能源危机", d: "国际能源危机，所有能源价格上涨。", type: 'multiBuff', buffs: [ { type: 'gridPriceMult', val: 1.6 }, { type: 'dailyCostMult', val: 1.3 } ], icon: '🛢️' },
        { t: "绿色认证", d: "获得环保认证，设备采购享受折扣。", type: 'assetDiscount', target: 'all', val: 0.85, icon: '🌱' },
        { t: "智能化浪潮", d: "AI技术普及，智能化设备成本大幅下降。", type: 'assetDiscount', target: 'infra', val: 0.6, icon: '🧠' },
        { t: "经济衰退", d: "经济不景气，客流减少但运营成本下降。", type: 'multiBuff', buffs: [ { type: 'trafficMult', val: 0.7 }, { type: 'dailyCostMult', val: 0.8 } ], icon: '📉' },
        { t: "充电热潮", d: "电动车销量暴增，客流增加40%。", type: 'trafficMult', val: 1.4, icon: '🚗' },
        { t: "维护困难", d: "专业技术人员短缺，维护成本大幅上升。", type: 'dailyCostMult', val: 1.5, icon: '🔧' },
        { t: "创新补贴", d: "创新技术获得政府补贴，研发成本降低。", type: 'assetDiscount', target: 'battery', val: 0.5, icon: '💡' }
    ]
};

function triggerRandomEvent() {
    const hasActiveLongTerm = state.activeBuffs.some(b => b.isEventLongTerm);
    const isLongTerm = !hasActiveLongTerm && Math.random() < 0.4;
    let ev;
    let duration = 0;

    if (isLongTerm) {
        ev = EVENTS.longTerm[Math.floor(Math.random() * EVENTS.longTerm.length)];
        duration = 2 + Math.floor(Math.random() * 6);
        if (ev.type === 'multiBuff') {
            ev.buffs.forEach(subBuff => {
                state.activeBuffs.push({ name: ev.t, type: subBuff.type, val: subBuff.val, daysLeft: duration, icon: ev.icon, isEventLongTerm: true });
            });
        } else {
            state.activeBuffs.push({ name: ev.t, type: ev.type, val: ev.val, daysLeft: duration, icon: ev.icon, isEventLongTerm: true, target: ev.target });
        }
        document.getElementById('ev-amt').innerText = `持续 ${duration} 天`;
        document.getElementById('ev-amt').className = "font-bold text-blue-600";
    } else {
        let candidateEvents = EVENTS.instant;
        const currentRent = calcWeeklyRent(); 
        
        if (state.money < currentRent) {
            candidateEvents = candidateEvents.filter(e => e.amt > 0);
        } else if (state.money < currentRent * 1.5) {
            const goodEvents = candidateEvents.filter(e => e.amt > 0);
            candidateEvents = [...candidateEvents, ...goodEvents, ...goodEvents];
        }

        ev = candidateEvents[Math.floor(Math.random() * candidateEvents.length)];
        
        let inflation = 0;
        if (ev.amt !== 0) { inflation = (ev.amt > 0 ? 1 : -1) * state.day * 5; }
        let amount = ev.amt + inflation;
        
        state.money += amount;
        document.getElementById('ev-amt').innerText = (amount >= 0 ? "+" : "−") + `$${Math.abs(amount)}`;
        document.getElementById('ev-amt').className = amount > 0 ? "font-bold font-mono text-lg text-green-600" : "font-bold font-mono text-lg text-red-600";
    }

    document.getElementById('ev-icon').innerText = isLongTerm ? ev.icon : (ev.amt > 0 ? '💰' : '💸');
    document.getElementById('ev-title').innerText = ev.t;
    document.getElementById('ev-desc').innerText = ev.d;
    openModal('event-modal');
    updateUI(); 
    state.pendingEvent = { title: ev.t, description: ev.d, icon: document.getElementById('ev-icon').innerText, amount: document.getElementById('ev-amt').innerText };
    scheduleNextEvent(); saveGame(true);
}

function dailySettle() {
    state.day++;
    state.weather = state.forecast;
    const forcedWeather = state.activeBuffs.find(b => b.type === 'forcedWeather');
    if (forcedWeather) state.weather = forcedWeather.val;
    state.forecast = rollWeather();

    state.activeBuffs.forEach(b => b.daysLeft--);
    state.activeBuffs = state.activeBuffs.filter(b => b.daysLeft > 0);

    const dailyCost = calcDailyCost();
    state.money -= dailyCost;
    let loanPaid = 0;
    spawnFloatText(`日维护 -$${dailyCost}`, '#f97316');
    
        if (state.loan.active) {
        const payment = loanPayment(state.loan, LOAN_DAILY_RATE);
        state.money -= payment.amount;
        loanPaid = payment.amount;
        state.loan.principal = Math.round(Math.max(0, state.loan.principal - payment.principal) * 100) / 100;
        state.loan.daysLeft--;
        spawnFloatText(`还贷 -$${payment.amount.toFixed(2)}`, '#49735b');
        if (state.loan.daysLeft <= 0 || state.loan.principal <= 0.001) {
            state.loan.active = false; state.loan.principal = 0;
            spawnFloatText('贷款结清', '#49735b');
        }
    }

    if (state.settings.mode === 'jam') state.dailyPoolLeft = 999;
    else if (state.settings.mode === 'ghost') state.dailyPoolLeft = state.dailyPoolMax;
    else if (state.settings.mode === 'powerlimit') state.dailyPoolLeft = state.dailyPoolMax;
    else state.dailyPoolLeft = state.dailyPoolMax; 

    state.lastDayProfit = state.currentDayProfit - dailyCost - loanPaid;
    state.history = state.history || [];
    state.history.push({ day: state.day - 1, profit: state.lastDayProfit });
    state.history = state.history.slice(-30);
    state.currentDayProfit = 0;

    state.chartData.yesterdayLoad = [...state.chartData.load];
    state.chartData.load.fill(null);
    state.chartData.solar.fill(null);
    state.chartData.battery.fill(null);
    
    if(myChart) {
        myChart.setOption({ series: [ { data: state.chartData.yesterdayLoad }, { data: [] }, { data: [] }, { data: [] } ] });
    }

    let rentInterval = 7;
    if (state.settings.mode === 'shark') rentInterval = 3;

    if (state.day > 1 && (state.day - 1) % rentInterval === 0) {
        const rent = calcWeeklyRent();
        state.pendingRent = rent;
        showBillModal();
    }
}

function rollWeather() {
    const r = Math.random();
    let cumulativeProb = 0;
    for (let i = 0; i < CONFIG.weather.types.length; i++) {
        cumulativeProb += CONFIG.weather.probs[i];
        if (r < cumulativeProb) return CONFIG.weather.types[i];
    }
    return CONFIG.weather.types[0];
}

function calcDailyCost() {
    let cost = 0;
    cost += state.assets.slowCharger * CONFIG.dailyCost.slowCharger;
    cost += state.assets.fastCharger * CONFIG.dailyCost.fastCharger;
    cost += state.assets.solar * CONFIG.dailyCost.solar;
    cost += state.assets.battery * CONFIG.dailyCost.battery;
    cost += state.assets.transformer * CONFIG.dailyCost.transformer;
    const dailyCostMultBuff = state.activeBuffs.find(b => b.type === 'dailyCostMult');
    if (dailyCostMultBuff) cost *= dailyCostMultBuff.val;
    return cost;
}

function calcWeeklyRent() {
    let base = CONFIG.baseWeeklyRent; 
    let growth = CONFIG.rentGrowth;
    if (state.settings.mode === 'offgrid' || state.settings.mode === 'powerlimit') { base = 500; growth = 125; }
    if (state.settings.mode === 'luxury') { base = 2000; growth = 350; }
    if (state.settings.mode === 'inflation') return Math.floor(base * Math.pow(1.3, state.weeksSurvived));
    if (state.settings.mode === 'shark') { base = 1500; growth = 200; }
    if (currentLevel === 1) { base = 300; growth = 0; }
    return base + (state.weeksSurvived * growth);
}

function trySpawnCar(baseProb) {
    if (state.dailyPoolLeft <= 0) return;
    const totalChargers = state.assets.slowCharger + state.assets.fastCharger;
    const spawnAttempts = 2 + Math.floor(totalChargers * 0.8); 
    for (let i = 0; i < spawnAttempts; i++) {
        if (state.dailyPoolLeft <= 0) break;
        attemptSingleSpawn(baseProb);
    }
}

function attemptSingleSpawn(baseProb) {
    let weatherMod = 1.0;
    if (state.weather === 'rainy') weatherMod = 0.9;
    if (Math.random() > baseProb * weatherMod) return;

    const myPrice = state.price;
    let acceptChance = 1.0;
    if (myPrice > 2.0) {
        const excess = myPrice - 2.0;
        acceptChance = 0.2 / (excess * 2 + 1); 
    } else {
        if (myPrice <= 1.2) acceptChance = 1.0;
        else { const t = (myPrice - 1.2) / 0.8; acceptChance = 1.0 - (t * 0.7); }
    }
    if (state.settings.mode === 'luxury') acceptChance = Math.min(1.0, acceptChance * 1.3); 

    if (Math.random() > acceptChance) return; 

    const wantFast = Math.random() < 0.3; 
    let spawnType = null;
    let slot = -1;

    if (state.settings.mode === 'super') {
        slot = findFreeSlot('fast');
        if (slot !== -1) spawnType = 'fast';
    } else {
        if (wantFast) {
            slot = findFreeSlot('fast');
            if (slot !== -1) spawnType = 'fast';
            else if (Math.random() < 0.5) { 
                slot = findFreeSlot('slow');
                if (slot !== -1) spawnType = 'slow';
            }
        } else {
            slot = findFreeSlot('slow');
            if (slot !== -1) {
                spawnType = 'slow';
            } else if (findFreeSlot('fast') !== -1) {
                slot = findFreeSlot('fast');
                spawnType = 'fast'; 
            }
        }
    }

    if (spawnType && slot !== -1) {
        state.dailyPoolLeft--;
        const kwhNeed = 45 + Math.random() * 15;
        const power = CONFIG.chargerPower[spawnType];
        const idealTicks = Math.ceil((kwhNeed / power) * 6);
        const patience = Math.ceil(idealTicks * 1.5);
        const emoji = CONFIG.carEmojis[Math.floor(Math.random() * CONFIG.carEmojis.length)];

        state.cars.push({
            type: spawnType, slot: slot, ticksLeft: patience, kwhNeeded: kwhNeed, kwhReceived: 0,
            emoji: emoji, priceLocked: state.price
        });
    }
}

function findFreeSlot(type) {
    const limit = state.assets[type + 'Charger'];
    for(let i=0; i<limit; i++) {
        if (!state.cars.some(c => c.type === type && c.slot === i)) return i;
    }
    return -1;
}

function getAssetCost(type) {
    let cost = state.currentCosts[type];
    const discount = state.activeBuffs.find(b => b.type === 'assetDiscount' && b.target === type);
    if (discount) cost *= discount.val;
    if (['slowCharger', 'fastCharger', 'transformer'].includes(type)) {
        const infraDiscount = state.activeBuffs.find(b => b.type === 'assetDiscount' && b.target === 'infra');
        if (infraDiscount) cost *= infraDiscount.val;
    }
    const allDiscount = state.activeBuffs.find(b => b.type === 'assetDiscount' && b.target === 'all');
    if (allDiscount) cost *= allDiscount.val;
    return Math.floor(cost);
}

function buyAsset(type) {
    if (!Object.hasOwn(CONFIG.baseCosts, type) || (currentLevel === 1 && ['solar', 'battery', 'fastCharger'].includes(type)) || (type === 'transformer' && state.settings.mode === 'offgrid')) return;
    const cost = getAssetCost(type);
    if (type === 'slowCharger' && state.settings.mode === 'super') { spawnFloatText("模式限制: 禁止慢充", "#ef4444"); return; }
    if (state.money >= cost) {
        state.money -= cost;
        if (type === 'marketing') {
            state.marketingPurchases = (state.marketingPurchases || 0) + 1; state.dailyPoolMax += 10; state.dailyPoolLeft += 10; spawnFloatText("客流+10", "#ec4899");
        } else {
            state.assets[type]++; spawnFloatText(`购买 -$${cost}`, "#2563eb");
        }
        state.currentCosts[type] = Math.floor(state.currentCosts[type] * CONFIG.inflationRate);
        updateUI(); resizeCanvas(); saveGame(true);
    } else {
        spawnFloatText("资金不足", "#ef4444");
    }
}

function spawnFloatText(txt, col) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.innerText = txt;
    el.style.color = col;
    el.style.left = (30+Math.random()*40)+'%';
    el.style.top = (40+Math.random()*20)+'%';
    document.getElementById('fx-container').appendChild(el);
    setTimeout(()=>el.remove(), 1200);
}

function updateUI() {
    document.getElementById('ui-money').innerText = state.money >= 1000000 ? `$${(state.money / 1000000).toFixed(1)}M` : `$${Math.floor(state.money).toLocaleString('en-US')}`;
    
    const dCost = calcDailyCost();
    document.getElementById('ui-daily-cost').innerText = `-$${dCost.toFixed(2)}`;
    const wRent = calcWeeklyRent();
    document.getElementById('ui-weekly-rent').innerText = `-$${wRent}`;
    
// 更新贷款卡片
    const loanCard = document.getElementById('card-loan-status');
    const loanPaymentEl = document.getElementById('ui-loan-payment');
    
    if (state.loan.active) {
        loanCard.className = "stat-card border-t-4 border-indigo-500 bg-indigo-50/50 cursor-pointer";
        
        const nextPayment = loanPayment(state.loan, LOAN_DAILY_RATE).amount;
        loanPaymentEl.innerText = `-$${nextPayment.toFixed(2)}`;
    } else {
        loanCard.className = "stat-card border-t-4 border-slate-300 opacity-60 cursor-pointer";
        loanPaymentEl.innerText = "--";
    }

    const daysLeft = 8 - ((state.day - 1) % 7 + 1);
    let rentLabel = '周租';
    if(state.settings.mode === 'shark') {
        const sharkDaysLeft = 4 - ((state.day - 1) % 3 + 1);
        document.getElementById('ui-rent-countdown').innerText = sharkDaysLeft === 1 ? '明日' : `${sharkDaysLeft}d`;
        rentLabel = '高频租金';
    } else {
        document.getElementById('ui-rent-countdown').innerText = daysLeft === 1 ? '明日' : `${daysLeft}d`;
    }
    // Update label text logic if needed, currently fixed in HTML structure or controlled here
    
    const transformerLabel = document.getElementById('transformer-sub');
    if (state.settings.mode === 'powerlimit') transformerLabel.innerText = '+10kW';
    else transformerLabel.innerText = '+20kW';

    const lastProfitEl = document.getElementById('ui-last-profit');
    if (state.lastDayProfit !== null) {
        const val = state.lastDayProfit.toFixed(2);
        const sign = state.lastDayProfit >= 0 ? '+' : '';
        const color = state.lastDayProfit >= 0 ? 'text-green-600' : 'text-red-500';
        lastProfitEl.innerHTML = `<span class="${color}">${sign}$${val}</span>`;
    } else {
        lastProfitEl.innerText = "--";
    }

    const h = state.hour.toString().padStart(2,'0');
    const m = state.minute.toString().padStart(2,'0');
    document.getElementById('ui-clock').innerText = `${h}:${m}`;
    document.getElementById('ui-day').innerText = `D${state.day}`;
    document.getElementById('ui-pool').innerText = state.settings.mode === 'jam' ? '∞' : `${state.dailyPoolLeft}/${state.dailyPoolMax}`;

    const w = state.weather;
    document.getElementById('ui-weather-icon').innerText = CONFIG.weather.icons[w];
    let eff = CONFIG.weather.eff[w] * 100;
    
    const forced = state.activeBuffs.find(b => b.type === 'forcedWeather');
    const boosted = state.activeBuffs.find(b => b.type === 'solarEfficiency');
    if (boosted) eff *= boosted.val;

    document.getElementById('ui-weather-eff').innerText = `PV:${eff.toFixed(0)}%${forced ? '(锁定)' : ''}`;
    let effColor = 'text-slate-500';
    if(w === 'rainy' || w === 'stormy') effColor = 'text-red-500';
    if(boosted) effColor = 'text-green-600 font-black'; 
    document.getElementById('ui-weather-eff').className = `text-[8px] font-bold ${effColor} whitespace-nowrap`;

    let forecastW = state.forecast;
    if (forced && forced.daysLeft > 1) forecastW = forced.val;
    const fIcon = CONFIG.weather.icons[forecastW];
    document.getElementById('ui-forecast').innerText = `明:${fIcon}`;

    let gp = CITY_CONFIG[state.settings.city].prices[state.hour] || 0;
    if (state.settings.mode === 'collapse') { if (state.hour >= 6 && state.hour < 18) gp = 10.0; else gp = 0.2; }
    if (state.settings.mode === 'offgrid') gp = 0; 
    const discountBuff = state.activeBuffs.find(b => b.type === 'gridDiscount');
    if (discountBuff) gp *= discountBuff.val;
    const gpMult = state.activeBuffs.find(b => b.type === 'gridPriceMult');
    if (gpMult) gp *= gpMult.val;

    const gpEl = document.getElementById('ui-grid-price');
    gpEl.innerText = state.settings.mode === 'offgrid' ? '离网' : `$${gp.toFixed(2)}`;
    gpEl.className = `font-mono font-bold text-lg ${gp>=1.5 ? 'text-red-500' : 'text-slate-700'}`;

    const d = state.lastTickData;
    document.getElementById('ui-load-text').innerText = `${d.load.toFixed(1)} / ${d.limit} kW`;
    
    const base = d.limit > 0 ? d.limit : 1;
    const pSolar = (d.solar / base) * 100;
    const pBatt = (d.batt / base) * 100;
    const pGrid = (d.grid / base) * 100;

    document.getElementById('bar-solar').style.width = `${pSolar}%`;
    document.getElementById('bar-batt').style.width = `${pBatt}%`;
    document.getElementById('bar-grid').style.width = `${pGrid}%`;
    
    const battBar = document.getElementById('bar-batt');
    if (d.battAction === 'charge') battBar.innerText = '⚡';
    else if (d.battAction === 'discharge') battBar.innerText = '🔋';
    else battBar.innerText = '';

    const overloadMsg = document.getElementById('ui-overload-msg');
    const powerMonitor = document.getElementById('power-monitor');
    if (d.reqLoad > d.limit) {
        overloadMsg.classList.remove('hidden');
        powerMonitor.classList.add('warning-pulse', 'border-red-400');
    } else {
        overloadMsg.classList.add('hidden');
        powerMonitor.classList.remove('warning-pulse', 'border-red-400');
    }

    document.getElementById('count-slow').innerText = state.assets.slowCharger;
    document.getElementById('count-fast').innerText = state.assets.fastCharger;
    document.getElementById('count-solar').innerText = state.assets.solar;
    document.getElementById('count-battery').innerText = state.assets.battery;
    document.getElementById('count-transformer').innerText = state.assets.transformer;
    
    const updateCostDisplay = (type, elId) => {
        const raw = state.currentCosts[type];
        const actual = getAssetCost(type);
        const el = document.getElementById(elId);
        if (actual < raw) {
            el.innerHTML = `<span class="opacity-50 line-through text-[8px] mr-1">$${raw}</span><span>$${actual}</span>`;
        } else {
            el.innerText = `$${raw}`;
        }
    };

    updateCostDisplay('slowCharger', 'cost-slow');
    updateCostDisplay('fastCharger', 'cost-fast');
    updateCostDisplay('transformer', 'cost-transformer');
    updateCostDisplay('solar', 'cost-solar');
    updateCostDisplay('battery', 'cost-battery');
    updateCostDisplay('marketing', 'cost-marketing');

    const buffBar = document.getElementById('ui-buff-bar');
    if (state.activeBuffs.length > 0) {
        buffBar.classList.remove('hidden');
        const uniqueBuffs = [];
        const seen = new Set();
        state.activeBuffs.forEach(b => {
            if(!seen.has(b.name)) { uniqueBuffs.push(b); seen.add(b.name); }
        });
        buffBar.innerHTML = uniqueBuffs.map(b => `
            <div class="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                <span class="text-xs">${b.icon}</span>
                <span class="text-[9px] font-bold text-indigo-700">${b.name} ${b.daysLeft}d</span>
            </div>
        `).join('');
    } else {
        buffBar.classList.add('hidden');
    }

    const speedLabel = document.getElementById('ui-speed-label');
    if (state.paused) {
        speedLabel.innerText = "已暂停";
        speedLabel.className = "text-[10px] text-slate-400 font-bold animate-pulse";
    } else {
        const ms = state.gameSpeed;
        const txt = ms===500?"1x":ms===125?"4x":"8x";
        speedLabel.innerText = "> " + txt;
        speedLabel.className = "text-[10px] text-green-600 font-bold";
    }
    updateDashboard();
}

function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper || wrapper.clientWidth === 0 || wrapper.clientHeight === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = wrapper.clientWidth;
    canvasHeight = wrapper.clientHeight;
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (myChart && !document.getElementById('energy-view').classList.contains('hidden')) myChart.resize();
    draw();
}
window.addEventListener('resize', resizeCanvas);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(document.getElementById('canvas-wrapper'));
function draw() {
    if (!canvasWidth || !canvasHeight) return;
    const W = canvasWidth, H = canvasHeight;
    const night = state.hour < 6 || state.hour >= 19;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = night ? '#344862' : '#edf2f7'; ctx.fillRect(0, 0, W, H);
    const rect = (x, y, w, h, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r); ctx.fill(); };
    const text = (s, x, y, color, size = 10) => { ctx.fillStyle = color; ctx.font = `500 ${size}px "PingFang SC", sans-serif`; ctx.fillText(s, x, y); };
    ctx.strokeStyle = night ? '#435871' : '#dce5ed'; ctx.lineWidth = .6;
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const tall = H >= 175;
    if (tall) {
        const hubWidth = Math.min(W - 28, 210);
        rect((W - hubWidth) / 2, 39, hubWidth, 34, 6, '#4b729e');
        text(`光伏 ${state.assets.solar * 10} kW  /  储能 ${Math.round(state.batteryKwh)} kWh`, (W - hubWidth) / 2 + 13, 60, '#fff0bb', 10);
        for (const x of [22, W - 22]) {
            rect(x - 2, 49, 4, 15, 1, '#bea68b');
            ctx.fillStyle = '#c1d4c8'; ctx.beginPath(); ctx.ellipse(x + 2, 62, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8eb6a0'; ctx.beginPath(); ctx.arc(x, 51, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#adceba'; ctx.beginPath(); ctx.arc(x - 3, 48, 7, 0, Math.PI * 2); ctx.fill();
        }
    }
    const types = [];
    for (const kind of ['slow', 'fast']) for (let i = 0; i < state.assets[kind + 'Charger']; i++) types.push([kind, i]);
    const shown = Math.min(12, types.length), count = Math.max(6, shown);
    const top = tall ? 84 : 34, bottom = 27, availableH = Math.max(20, H - top - bottom);
    let layout = { scale: 0 };
    for (let cols = 2; cols <= Math.min(count, 6); cols++) {
        const rows = Math.ceil(count / cols);
        const scale = Math.min((W - 24) / cols / 90, availableH / rows / 96, 1.35);
        if (scale > layout.scale) layout = { cols, rows, scale };
    }
    const { cols, rows, scale } = layout;
    const cellW = 90 * scale, cellH = 96 * scale;
    const startX = (W - cols * cellW) / 2, startY = top + (availableH - rows * cellH) / 2;
    const roadY = startY + rows * cellH + 8;
    if (H - bottom - roadY >= 24) {
        rect(0, roadY, W, 24, 0, night ? '#293b52' : '#9aacbd');
        ctx.strokeStyle = night ? '#71879e' : '#edf3f8'; ctx.lineWidth = 2; ctx.setLineDash([15, 13]);
        ctx.beginPath(); ctx.moveTo(0, roadY + 12); ctx.lineTo(W, roadY + 12); ctx.stroke(); ctx.setLineDash([]);
    }
    for (let i = 0; i < count; i++) {
        const type = i < shown ? types[i] : null;
        const car = type && state.cars.find(c => c.type === type[0] && c.slot === type[1]);
        ctx.save(); ctx.translate(startX + (i % cols) * cellW, startY + Math.floor(i / cols) * cellH); ctx.scale(scale, scale);
        if (type) rect(4, 6, 82, 89, 7, night ? '#203248' : '#cbd9e6');
        rect(4, 3, 82, 89, 7, type ? (night ? '#5c728c' : '#fbfcfe') : (night ? '#3d536c' : '#e0e7ef'));
        ctx.strokeStyle = '#c3d3e5'; ctx.setLineDash(type ? [] : [4, 4]); ctx.strokeRect(12, 27, 66, 54); ctx.setLineDash([]);
        if (type) {
            const fast = type[0] === 'fast';
            rect(35, 7, 20, 17, 3, fast ? '#c9b3de' : '#94b6d7');
            rect(39, 10, 12, 5, 1, '#416484');
            text(fast ? 'DC' : 'AC', 13, 20, '#7693b2', 9);
            if (car) {
                rect(31, 32, 30, 44, 6, '#334c6d25');
                rect(28, 29, 30, 44, 6, fast ? '#edc683' : '#abc4dd');
                rect(31, 36, 24, 9, 2, '#557797'); rect(31, 60, 24, 6, 2, '#557797');
                const pct = Math.min(1, car.kwhReceived / car.kwhNeeded);
                rect(13, 84, 63, 3, 1, '#d8e4ef'); rect(13, 84, 63 * pct, 3, 1, '#88b69f');
                text(`${Math.round(pct * 100)}%`, 60, 20, '#7aab98', 8);
            } else text('空闲', 33, 58, '#8fa4bb', 11);
        } else text('待扩建', 27, 58, '#9caebe', 10);
        ctx.restore();
    }
    if (types.length > shown) text(`另有 ${types.length - shown} 台充电桩正常营业`, 12, H - 31, night ? '#bfd2e7' : '#8c9eb5', 9);
    if (['rainy', 'stormy'].includes(state.weather)) {
        ctx.strokeStyle = '#68889544';
        for (let i = 0; i < 24; i++) { const x = (i * 97 + state.minute * 3) % W, y = (i * 47) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke(); }
    }
}

function closeEventModal() {
    closeModal('event-modal');
    state.pendingEvent = null;
    if (checkEndGame()) return;
    resumeAfterModal();
    saveGame(true);
}


function showBillModal() {
    const balance = state.money;
    const rent = state.pendingRent;
    const final = balance - rent;

    document.getElementById('bill-balance').innerText = `$${balance.toFixed(2)}`;
    document.getElementById('bill-rent').innerText = `-$${rent.toFixed(2)}`;
    document.getElementById('bill-final').innerText = `$${final.toFixed(2)}`;
    
    const finalEl = document.getElementById('bill-final');
    if (final < 0) finalEl.className = "font-mono font-bold text-red-600";
    else finalEl.className = "font-mono font-bold text-green-600";

    openModal('bill-modal'); 
}

function payBill() {
    const rent = state.pendingRent;
    state.money -= rent;
    if (state.lastDayProfit !== null) state.lastDayProfit -= rent;
    if (state.history?.length) state.history[state.history.length - 1].profit -= rent;
    state.pendingRent = 0; state.weeksSurvived++;
    closeModal('bill-modal');
    if (checkEndGame()) return;
    resumeAfterModal(); updateUI(); saveGame(true);
}


function updatePrice(v) {
    state.price = Math.max(0.5, Math.min(3, Number(v) || 1.5));
    document.getElementById('price-display').innerText = `$${state.price.toFixed(2)}`;
    document.getElementById('price-slider').value = state.price;
    updateUI(); saveGame(true);
}

function adjustPrice(delta) {
    let newVal = state.price + delta;
    newVal = Math.max(0.5, Math.min(3.0, newVal));
    newVal = Math.round(newVal * 10) / 10;
    updatePrice(newVal);
    const slider = document.getElementById('price-slider');
    if (slider) slider.value = newVal;
}

function setSpeed(ms) {
    clearTimeout(state.timer);
    if (ms === 0) state.paused = true;
    else {
        state.gameSpeed = ms; state.lastGameSpeed = ms;
        state.paused = modalOpenCount > 0 || !!state.ended;
        if (!state.paused) state.timer = setTimeout(tick, ms);
    }
    updateUI(); saveGame(true);
}


// 加载已解锁的关卡
function loadUnlockedLevels() {
    const saved = readStorage('ev_tycoon_unlocked_levels', [1]);
    unlockedLevels = Array.isArray(saved) ? [...new Set([1, ...saved.filter(n => Number.isInteger(n) && n >= 1 && n <= 6)])] : [1];
}


// 保存已解锁的关卡
function saveUnlockedLevels() { writeStorage('ev_tycoon_unlocked_levels', unlockedLevels); }


// 解锁新关卡
function unlockLevel(level) {
    if (level <= 6 && !unlockedLevels.includes(level)) {
        unlockedLevels.push(level);
        saveUnlockedLevels();
    }
}

// 检查关卡是否已解锁
function isLevelUnlocked(level) {
    return unlockedLevels.includes(level);
}

// 更新关卡选择界面的显示状态
function updateLevelSelectUI() { renderCampaign(); }
