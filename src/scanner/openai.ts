import { BillScanResultSchema, FinalBillScanResult } from "@/scanner";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

export class OpenAIBillScanner {
  constructor(
    private readonly openai: OpenAI,
    private readonly model: string,
  ) {}

  async scan(b64Image: string): Promise<FinalBillScanResult | null> {
    const result = await this.openai.beta.chat.completions.parse({
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "The following image is a receipt. Please extract each item and its cost, the total amount including tax, tip, and other fees, and the currency symbol or code.",
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${b64Image}` },
            },
          ],
        },
      ],
      response_format: zodResponseFormat(
        BillScanResultSchema,
        "bill_scan_result",
      ),
    });

    const scanResult = result.choices[0]?.message.parsed;
    if (!scanResult) {
      return null;
    }

    return {
      ...scanResult,
      items: scanResult.items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    };
  }
}
