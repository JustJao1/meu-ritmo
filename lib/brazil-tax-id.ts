/** Public CPF/CNPJ check digits. This never stores or logs the taxpayer number. */
export function validBrazilTaxId(value:unknown):boolean{
 if(typeof value!=='string')return false;
 const digits=value.replace(/\D/g,'');
 if(![11,14].includes(digits.length)||/^(\d)\1+$/.test(digits))return false;
 if(digits.length===11){
   const part=(size:number)=>{
     const sum=Array.from({length:size},(_,i)=>Number(digits[i])*(size+1-i)).reduce((a,b)=>a+b,0);
     const mod=sum%11;
     return mod<2?0:11-mod;
   };
   return part(9)===Number(digits[9])&&part(10)===Number(digits[10]);
 }
 const calculate=(size:number)=>{
   const weights=size===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];
   const total=weights.reduce((sum,weight,i)=>sum+Number(digits[i])*weight,0);
   return total%11<2?0:11-total%11;
 };
 return calculate(12)===Number(digits[12])&&calculate(13)===Number(digits[13]);
}
