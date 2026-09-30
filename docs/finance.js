/* One repayment calculation shared by previews, cash planning and settlement. */
(function(root) {
    const cents = n => Math.round((n + Number.EPSILON) * 100) / 100;
    function loanPayment(loan, rate) {
        if (!loan.active || loan.daysLeft <= 0) return { amount: 0, principal: 0, interest: 0 };
        const interest = cents(loan.principal * rate);
        const principal = loan.daysLeft === 1 ? loan.principal : Math.min(loan.principal,
            loan.type === 'installment' ? cents(loan.fixedDaily - interest) : loan.dailyBasePrincipal);
        return { amount: cents(principal + interest), principal: cents(principal), interest };
    }
    function loanPlan(principal, days, type, rate) {
        const power = Math.pow(1 + rate, days);
        const loan = { active: true, type, principal, daysLeft: days, fixedDaily: cents(principal * rate * power / (power - 1)), dailyBasePrincipal: cents(principal / days) };
        let totalRepay = 0; let firstDayPayment = 0;
        for (let i = 0; i < days; i++) {
            const pay = loanPayment(loan, rate);
            if (i === 0) firstDayPayment = pay.amount;
            totalRepay = cents(totalRepay + pay.amount);
            loan.principal = cents(Math.max(0, loan.principal - pay.principal)); loan.daysLeft--;
        }
        return { principal, days, type, fixedDaily: cents(principal * rate * power / (power - 1)), dailyBasePrincipal: cents(principal / days), totalRepay, firstDayPayment };
    }
    root.loanPayment = loanPayment; root.loanPlan = loanPlan;
    if (typeof module !== 'undefined') module.exports = { loanPayment, loanPlan };
})(typeof globalThis !== 'undefined' ? globalThis : window);
