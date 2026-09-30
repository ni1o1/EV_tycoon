/* Ten-minute dispatch. Bill exactly the energy delivered to each vehicle. */
(function (root) {
    function powerLimit(state, config) {
        if (state.settings.mode === 'offgrid') return state.assets.solar * config.solarMax + state.assets.battery * config.batteryRate;
        return state.settings.mode === 'powerlimit' ? 10 + state.assets.transformer * 10 : config.baseLoadLimit + state.assets.transformer * config.transformerBoost;
    }
    function dispatchEnergy(state, config, gridPrice) {
        const buff = (type, fallback) => state.activeBuffs.find(b => b.type === type)?.val ?? fallback;
        const offgrid = state.settings.mode === 'offgrid';
        const limit = powerLimit(state, config);
        const requests = state.cars.map(car => Math.max(0, Math.min(car.kwhNeeded - car.kwhReceived, config.chargerPower[car.type] * buff('chargeSpeedMult', 1) / 6)));
        const demand = requests.reduce((a, b) => a + b, 0);
        const sun = state.hour >= 6 && state.hour <= 18 ? Math.sin((state.hour - 6) / 12 * Math.PI) : 0;
        const weather = buff('forcedWeather', state.weather);
        const solar = Math.max(0, state.assets.solar * config.solarMax * sun * (config.weather.eff[weather] ?? 0) * buff('solarEfficiency', 1) / 6);
        const capacity = state.assets.battery * config.batteryCap;
        const rate = state.assets.battery * config.batteryRate * buff('batteryEfficiency', 1) / 6;
        state.batteryKwh = Math.max(0, Math.min(capacity, state.batteryKwh));
        const served = Math.min(demand, limit / 6, offgrid ? solar + Math.min(rate, state.batteryKwh) : Infinity);
        const usedSolar = Math.min(served, solar);
        let remaining = served - usedSolar;
        let usedBatt = 0;
        let gridCharge = 0;
        // Solar first; discharge at peak prices or whenever the grid is unavailable.
        if (offgrid || gridPrice > 0.45) {
            usedBatt = Math.min(remaining, state.batteryKwh, rate);
            remaining -= usedBatt;
            state.batteryKwh -= usedBatt;
        }
        const storedSolar = Math.min(Math.max(0, solar - usedSolar), capacity - state.batteryKwh, Math.max(0, rate - usedBatt));
        state.batteryKwh += storedSolar;
        if (!offgrid && gridPrice <= 0.45) {
            gridCharge = Math.min(capacity - state.batteryKwh, Math.max(0, rate - storedSolar), Math.max(0, limit / 6 - remaining));
            state.batteryKwh += gridCharge;
        }
        const grid = offgrid ? 0 : remaining + gridCharge;
        let revenue = 0;
        state.cars.forEach((car, i) => {
            const delivered = demand > 0 ? requests[i] * served / demand : 0;
            car.kwhReceived = Math.min(car.kwhNeeded, car.kwhReceived + delivered);
            revenue += delivered * car.priceLocked;
        });
        return { revenue, cost: grid * gridPrice, delivered: served, load: served * 6, reqLoad: demand * 6, limit,
            solar: usedSolar * 6, batt: usedBatt * 6, grid: grid * 6,
            unmet: Math.max(0, demand - served) * 6,
            battAction: usedBatt > 0 ? 'discharge' : gridCharge + storedSolar > 0 ? 'charge' : 'idle' };
    }
    root.dispatchEnergy = dispatchEnergy; root.powerLimit = powerLimit;
    if (typeof module !== 'undefined') module.exports = { dispatchEnergy, powerLimit };
})(typeof globalThis !== 'undefined' ? globalThis : window);
