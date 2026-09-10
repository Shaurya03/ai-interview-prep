import { z } from "zod";

import { generateJson } from "./llm.js";

const roleResponseSchema = z.object({
  title: z.string().trim().min(1),
  seniority: z.string().trim().min(1),
  company: z.string().trim().min(1),
  location: z.string().trim().min(1),
  responsibilities: z.array(z.string().trim().min(1)),
});

export interface ExtractedRole {
  title: string;
  seniority: string;
  company: string;
  location: string;
  responsibilities: string[];
}

export async function extractRole(
  jobDescription: string
): Promise<ExtractedRole> {
  if (!jobDescription.trim()) {
    throw new Error("Job description cannot be empty.");
  }

  const prompt = `
You are extracting structured role information from a job description.

Extract ONLY information that is explicitly supported by the supplied job description.

Return:
- title: the job title
- seniority: the stated seniority level. If the job description does not explicitly state seniority, use "Not specified".
- company: the company name if explicitly stated. If it is not stated, use "Not specified".
- location: the job location if explicitly stated. If it is not stated, use "Not specified".
- responsibilities: the main responsibilities explicitly described in the job description

Rules:
- Do not invent responsibilities.
- Do not infer a seniority level that is not supported by the job description.
- Keep responsibilities concise.
- Do not include requirements in the responsibilities list unless they are also explicitly responsibilities.
- Return JSON only.

Job description:

${jobDescription}
`;

  const raw = await generateJson<unknown>(prompt);
  const parsed = roleResponseSchema.parse(raw);

  return parsed;
}