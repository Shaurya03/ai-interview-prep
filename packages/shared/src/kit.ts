import { z } from "zod";

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
});

export const kitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().nonnegative(),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(z.object({
    id: z.string().min(1),
    front: z.string(),
    back: z.string(),
    requirement_ids: z.array(z.string().min(1)),
  })),
  schedule: z.object({
    days_available: z.number().int().positive(),
    days: z.array(z.object({
      day: z.number().int().positive(),
      focus: z.string(),
      question_ids: z.array(z.string().min(1)),
      minutes: z.number().int().nonnegative(),
    })),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string().min(1)),
    passes: z.number().int().nonnegative(),
  }),
});

export type InterviewKit = z.infer<typeof kitSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type Question = z.infer<typeof questionSchema>;
