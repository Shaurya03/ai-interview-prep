import { z } from "zod";
import { generateJson } from "./llm.js";

const extractedRequirementSchema = z.object({
  text: z.string().trim().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});

const extractionResponseSchema = z.object({
  requirements: z.array(extractedRequirementSchema),
});

export type ExtractedRequirement = z.infer<
  typeof extractedRequirementSchema
> & {
  id: string;
};

export async function extractRequirements(
  jobDescription: string
): Promise<ExtractedRequirement[]> {
  const prompt = `
You are extracting requirements from a job description.

Your job is EXTRACTION, not invention.

Rules:
1. Only include requirements that are explicitly stated in the job description.
2. Do not invent technologies, responsibilities, qualifications, tools, or skills.
3. Do not assume that a technology is required merely because it is commonly used for the role.
4. Create one requirement for each distinct skill, qualification, experience requirement, behavioural requirement, or domain requirement.
5. "must" means the job description clearly presents it as required, expected, or a qualification.
6. "nice" means the job description explicitly presents it as preferred, bonus, plus, or nice-to-have.
7. Use "technical" for technologies, programming skills, engineering practices, or technical knowledge.
8. Use "behavioural" for communication, teamwork, leadership, ownership, adaptability, etc.
9. Use "domain" for industry/domain-specific knowledge.
10. Do not create duplicate requirements.
11. Keep the requirement text concise but faithful to the job description.
12. If the job description does not provide enough evidence for a requirement, leave it out.

Return ONLY valid JSON matching this structure:

{
  "requirements": [
    {
      "text": "5+ years with React",
      "kind": "technical",
      "priority": "must"
    }
  ]
}

JOB DESCRIPTION:
${jobDescription}
`;

  const result = await generateJson<unknown>(prompt);

  const parsed = extractionResponseSchema.parse(result);

  return parsed.requirements.map((requirement, index) => ({
    id: `r${index + 1}`,
    ...requirement,
  }));
}