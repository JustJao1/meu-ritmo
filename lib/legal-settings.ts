import {z} from 'zod';
import {validBrazilTaxId} from './brazil-tax-id';

// Commercial identification is required before offering paid subscriptions.
// A developer credit is not a substitute for the actual service operator.
export const legalSettingsSchema=z.object({
  name:z.string().trim().min(3).max(150),
  taxId:z.string().trim().min(11).max(30).refine(validBrazilTaxId),
  address:z.string().trim().min(10).max(300),
  email:z.string().trim().toLowerCase().email().max(150)
}).strict();

export type LegalSettings=z.infer<typeof legalSettingsSchema>;

export function parseLegalSettings(raw:unknown):LegalSettings|null{
  try{
    const parsed=legalSettingsSchema.safeParse(typeof raw==='string'?JSON.parse(raw):raw);
    return parsed.success?parsed.data:null;
  }catch{return null;}
}
