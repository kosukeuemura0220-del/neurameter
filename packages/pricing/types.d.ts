export interface ModelPricing {
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  reasoningPricePerMToken?: number;
  cachedInputPricePerMToken?: number;
  contextWindowSize: number;
  maxOutputTokens: number;
}

export interface PricingData {
  [provider: string]: {
    [model: string]: ModelPricing;
  };
}

declare const data: PricingData;
export default data;
