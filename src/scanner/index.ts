import { z } from "zod";

export const BillScanResultSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
    }),
  ),
  total: z.number(),
  currencySymbolOrCode: z.string(),
});

export type BillScanResult = z.infer<typeof BillScanResultSchema>;

export type FinalBillScanResult = BillScanResult & {
  items: BillScanResult["items"] &
    {
      id: string;
    }[];
};
