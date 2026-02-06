'use server';
/**
 * @fileOverview Generates standardized descriptions of OC/OT based on provided data.
 *
 * - generateOcOtDetailedDescription - A function that generates the descriptions.
 * - GenerateOcOtDetailedDescriptionInput - The input type for the generateOcOtDetailedDescription function.
 * - GenerateOcOtDetailedDescriptionOutput - The return type for the generateOcOtDetailedDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateOcOtDetailedDescriptionInputSchema = z.object({
  format: z.string().describe('The format of the OC/OT.'),
  country: z.string().describe('The country where the OC/OT originated.'),
  year: z.number().describe('The year the OC/OT was issued.'),
  plan: z.string().describe('The plan associated with the OC/OT.'),
  area: z.string().describe('The area affected by the OC/OT.'),
  details: z.string().describe('Additional details about the OC/OT.'),
});
export type GenerateOcOtDetailedDescriptionInput = z.infer<typeof GenerateOcOtDetailedDescriptionInputSchema>;

const GenerateOcOtDetailedDescriptionOutputSchema = z.object({
  description: z.string().describe('A standardized description of the OC/OT.'),
});
export type GenerateOcOtDetailedDescriptionOutput = z.infer<typeof GenerateOcOtDetailedDescriptionOutputSchema>;

export async function generateOcOtDetailedDescription(input: GenerateOcOtDetailedDescriptionInput): Promise<GenerateOcOtDetailedDescriptionOutput> {
  return generateOcOtDetailedDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateOcOtDetailedDescriptionPrompt',
  input: {schema: GenerateOcOtDetailedDescriptionInputSchema},
  output: {schema: GenerateOcOtDetailedDescriptionOutputSchema},
  prompt: `You are an expert data analyst specializing in OC/OT (Orders Change / Orders Trouble) data.

  Based on the provided information, generate a concise and standardized description of the OC/OT.

  Format: {{{format}}}
  Country: {{{country}}}
  Year: {{{year}}}
  Plan: {{{plan}}}
  Area: {{{area}}}
  Details: {{{details}}}
  `,
});

const generateOcOtDetailedDescriptionFlow = ai.defineFlow(
  {
    name: 'generateOcOtDetailedDescriptionFlow',
    inputSchema: GenerateOcOtDetailedDescriptionInputSchema,
    outputSchema: GenerateOcOtDetailedDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
