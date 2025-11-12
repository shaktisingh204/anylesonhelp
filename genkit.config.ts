import {googleAI} from '@genkit-ai/google-genai';
import {genkit, type GenkitConfig} from 'genkit';
import {googleCloud} from '@genkit-ai/google-cloud';

export default {
  plugins: [
    googleAI(),
    googleCloud({
      // Log to Google Cloud Logging and export traces to Google Cloud Trace.
      // Requires: gcloud auth application-default login
    }),
  ],
  logSinks: ['googleCloud'],
  traceSinks: ['googleCloud'],
  enableTracingAndMetrics: true,
  // Flow state is stored in Firestore.
  flowStateStore: 'googleCloud',
  // Cache is stored in Firestore.
  cache: 'googleCloud',
} as GenkitConfig;
