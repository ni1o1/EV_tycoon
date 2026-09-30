const {test}=require('node:test');const assert=require('node:assert/strict');
const {loanPlan,loanPayment}=require('../docs/finance.js');
for(const type of ['installment','principal'])test(`${type}: preview equals actual repayments, final installment settles exact principal`,()=>{
 for(const days of [3,7,15])for(const principal of [500,3000,5000]){
  const plan=loanPlan(principal,days,type,.02);const loan={...plan,daysLeft:days,active:true};let total=0;
  while(loan.daysLeft){const pay=loanPayment(loan,.02);total+=pay.amount;loan.principal=Math.round((loan.principal-pay.principal)*100)/100;loan.daysLeft--}
  assert.equal(loan.principal,0);assert.ok(Math.abs(total-plan.totalRepay)<1e-8);assert.ok(plan.totalRepay>principal);
 }
});
