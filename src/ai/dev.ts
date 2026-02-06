import { config } from 'dotenv';
config();

import '@/ai/flows/generate-oc-ot-detailed-description.ts';
import '@/ai/flows/extract-pdf-data-flow.ts';
import '@/ai/flows/semantic-analysis-flow.ts';
import '@/ai/flows/trend-analysis-flow.ts';
import '@/ai/flows/anomaly-detection-flow.ts';
