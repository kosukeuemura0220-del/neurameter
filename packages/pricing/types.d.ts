export interface ModelPricing {
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  reasoningPricePerMToken?: number;
  cachedInputPricePerMToken?: number;
}

export interface PricingData {
  [provider: string]: {
    [model: string]: ModelPricing;
  };
}

declare const data: PricingData;
export default data;
