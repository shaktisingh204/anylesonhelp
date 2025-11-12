'use server';
/**
 * @fileOverview Generates dynamic video previews using AI to enhance user experience.
 *
 * - generateDynamicVideoPreviews - A function that takes a video description and generates a preview image data URI.
 * - GenerateDynamicVideoPreviewsInput - The input type for the generateDynamicVideoPreviews function.
 * - GenerateDynamicVideoPreviewsOutput - The return type for the generateDynamicVideoPreviews function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDynamicVideoPreviewsInputSchema = z.object({
  videoDescription: z.string().describe('A description of the video content.'),
});
export type GenerateDynamicVideoPreviewsInput = z.infer<typeof GenerateDynamicVideoPreviewsInputSchema>;

const GenerateDynamicVideoPreviewsOutputSchema = z.object({
  previewDataUri: z.string().describe('A data URI containing a Base64 encoded preview image.'),
});
export type GenerateDynamicVideoPreviewsOutput = z.infer<typeof GenerateDynamicVideoPreviewsOutputSchema>;

export async function generateDynamicVideoPreviews(input: GenerateDynamicVideoPreviewsInput): Promise<GenerateDynamicVideoPreviewsOutput> {
  return generateDynamicVideoPreviewsFlow(input);
}

const generateDynamicVideoPreviewsPrompt = ai.definePrompt({
  name: 'generateDynamicVideoPreviewsPrompt',
  input: {schema: GenerateDynamicVideoPreviewsInputSchema},
  output: {schema: GenerateDynamicVideoPreviewsOutputSchema},
  prompt: `Given the following description of a video, generate a relevant preview image.
  Description: {{{videoDescription}}}
  If the description is not descriptive enough generate a generic video preview image.
  The image should be returned as a data URI.
  Ensure that the preview aligns with common video themes.
  If the description is irrelevant generate a warning message.
  `,
});

const generateDynamicVideoPreviewsFlow = ai.defineFlow(
  {
    name: 'generateDynamicVideoPreviewsFlow',
    inputSchema: GenerateDynamicVideoPreviewsInputSchema,
    outputSchema: GenerateDynamicVideoPreviewsOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: input.videoDescription,
    });

    if (!media || !media.url) {
      throw new Error('Failed to generate preview image.');
    }

    return {previewDataUri: media.url};
  }
);
