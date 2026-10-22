import { dac18SampleConfig } from "../../src/config/dac-18-sample.ts";
import type { AdaptationConfig } from "../../src/domain/model.ts";

// Reuse representative demo content without sharing its mutable object identity.
// General tests use this fixture; DAC-18 demo tests exercise the public sample.
export const sampleAdaptationConfig: AdaptationConfig =
  structuredClone(dac18SampleConfig);
