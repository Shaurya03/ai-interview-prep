"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = "http://localhost:4000";

type Requirement = {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
};

type Question = {
  id: string;
  requirement_ids: string[];
  category: "technical" | "behavioural" | "system-design" | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: number;
};

type Flashcard = {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
};

type ScheduleDay = {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
};

type GeneratedKit = {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };

  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };

  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };

  questions: Question[];

  flashcards: Flashcard[];

  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };

  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
};

type Kit = {
  _id: string;
  name: string;
  jobDescription: string;
  companyUrl: string;
  daysAvailable: number;
  status: "draft" | "generating" | "ready" | "failed";
  data?: GeneratedKit | null;
  createdAt: string;
  updatedAt: string;
};

export default function KitDetailPage() {
  const router = useRouter();
  const params = useParams();

  const kitId = params.id as string;

  const [kit, setKit] = useState<Kit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function loadKit() {
    try {
      const response = await fetch(`${API_URL}/kits/${kitId}`, {
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        setError(result.error?.message ?? "Unable to load this kit.");
        return;
      }

      setKit(result.kit);
      setError("");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadKit();
  }, [kitId, router]);

  async function generateKit() {
    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/kits/${kitId}/generate`, {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        setError(
          result.error?.message ?? "Unable to generate the interview kit."
        );
        return;
      }

      setKit((currentKit) =>
        currentKit
          ? {
            ...currentKit,
            status: "ready",
            data: result.data,
          }
          : currentKit
      );
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-zinc-500">
            Loading interview kit...
          </p>
        </div>
      </main>
    );
  }

  if (error && !kit) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-6 text-sm text-zinc-500 transition hover:text-zinc-950"
          >
            ← Back to dashboard
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!kit) {
    return null;
  }

  const data = kit.data;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-6 text-sm text-zinc-500 transition hover:text-zinc-950"
        >
          ← Back to dashboard
        </button>

        <header className="mb-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-500">
                Interview Kit
              </p>

              <h1 className="text-3xl font-semibold tracking-tight">
                {kit.name}
              </h1>

              <a
                href={kit.companyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950"
              >
                {kit.companyUrl}
              </a>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium capitalize text-zinc-600">
                {kit.status}
              </span>

              {(kit.status === "draft" ||
                kit.status === "failed" ||
                kit.status === "ready") && (
                  <button
                    type="button"
                    onClick={generateKit}
                    disabled={isGenerating}
                    className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating
                      ? "Generating..."
                      : kit.status === "ready"
                        ? "Regenerate"
                        : kit.status === "failed"
                          ? "Retry generation"
                          : "Generate preparation kit"}
                  </button>
                )}
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Job description</h2>

              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                {kit.jobDescription}
              </div>
            </div>
          </section>

          <aside>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                Preparation details
              </h2>

              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <p className="text-zinc-500">Days available</p>
                  <p className="mt-1 font-medium">
                    {kit.daysAvailable}{" "}
                    {kit.daysAvailable === 1 ? "day" : "days"}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500">Status</p>
                  <p className="mt-1 font-medium capitalize">
                    {kit.status}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500">Created</p>
                  <p className="mt-1 font-medium">
                    {new Date(kit.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {kit.status === "generating" && (
          <section className="mt-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950" />

              <h2 className="mt-4 text-lg font-semibold">
                Building your preparation kit
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                We&apos;re extracting requirements, researching the company,
                generating questions and flashcards, and building your
                preparation schedule.
              </p>
            </div>
          </section>
        )}

        {kit.status === "failed" && (
          <section className="mt-6">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <h2 className="text-lg font-semibold text-red-900">
                Generation failed
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                Something went wrong while building this preparation kit.
                You can retry the generation without recreating the kit.
              </p>
            </div>
          </section>
        )}

        {kit.status === "draft" && (
          <section className="mt-6">
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
              <h2 className="text-lg font-semibold">
                Your preparation kit is ready to generate
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                Generate a personalized kit containing company research,
                requirements, interview questions, a preparation schedule,
                and flashcards.
              </p>

              <button
                type="button"
                onClick={generateKit}
                disabled={isGenerating}
                className="mt-5 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating
                  ? "Generating..."
                  : "Generate preparation kit"}
              </button>
            </div>
          </section>
        )}

        {kit.status === "ready" && data && (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Company brief</h2>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-sm font-medium text-zinc-500">
                    Summary
                  </p>

                  <p className="mt-2 text-sm leading-7 text-zinc-700">
                    {data.company_brief.summary}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-500">
                    What they do
                  </p>

                  <p className="mt-2 text-sm leading-7 text-zinc-700">
                    {data.company_brief.what_they_do}
                  </p>
                </div>

                {data.company_brief.sources.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-zinc-500">
                      Research sources
                    </p>

                    <div className="mt-2 space-y-1">
                      {data.company_brief.sources.map((source) => (
                        <a
                          key={source}
                          href={source}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
                        >
                          {source}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">
                    Role & requirements
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {data.role.title} · {data.role.seniority}
                  </p>
                </div>

                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {data.role.requirements.length} requirements
                </span>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">
                  Responsibilities
                </h3>

                <ul className="mt-3 space-y-2">
                  {data.role.responsibilities.map(
                    (responsibility, index) => (
                      <li
                        key={`${responsibility}-${index}`}
                        className="text-sm leading-6 text-zinc-700"
                      >
                        • {responsibility}
                      </li>
                    )
                  )}
                </ul>
              </div>

              <div className="mt-7">
                <h3 className="text-sm font-semibold">
                  Requirements
                </h3>

                <div className="mt-3 space-y-3">
                  {data.role.requirements.map((requirement) => (
                    <div
                      key={requirement.id}
                      className="rounded-xl border border-zinc-200 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm leading-6 text-zinc-800">
                          {requirement.text}
                        </p>

                        <div className="flex shrink-0 gap-2">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600">
                            {requirement.kind}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${requirement.priority === "must"
                                ? "bg-zinc-950 text-white"
                                : "bg-zinc-100 text-zinc-600"
                              }`}
                          >
                            {requirement.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">
                    Interview questions
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Questions generated from the extracted requirements.
                  </p>
                </div>

                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {data.questions.length} questions
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {data.questions.map((question, index) => (
                  <article
                    key={question.id}
                    className="rounded-xl border border-zinc-200 p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
                          {index + 1}
                        </span>

                        <div>
                          <p className="font-medium leading-6 text-zinc-900">
                            {question.prompt}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600">
                              {question.category}
                            </span>

                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                              Difficulty {question.difficulty}/3
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Answer outline
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                        {question.answer_outline}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">
                    Preparation schedule
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    A {data.schedule.days_available}-day preparation plan.
                  </p>
                </div>

                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {data.schedule.days.reduce(
                    (total, day) => total + day.minutes,
                    0
                  )}{" "}
                  minutes
                </span>
              </div>

              <div className="mt-6 space-y-3">
                {data.schedule.days.map((day) => (
                  <div
                    key={day.day}
                    className="rounded-xl border border-zinc-200 p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Day {day.day}
                        </p>

                        <h3 className="mt-1 font-medium text-zinc-900">
                          {day.focus}
                        </h3>
                      </div>

                      <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                        {day.minutes} min
                      </span>
                    </div>

                    {day.question_ids.length > 0 && (
                      <p className="mt-3 text-sm text-zinc-500">
                        {day.question_ids.length}{" "}
                        {day.question_ids.length === 1
                          ? "question"
                          : "questions"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">Flashcards</h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Quick revision material based on the job requirements.
                  </p>
                </div>

                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {data.flashcards.length} cards
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {data.flashcards.map((flashcard) => (
                  <article
                    key={flashcard.id}
                    className="rounded-xl border border-zinc-200 p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Question
                    </p>

                    <h3 className="mt-2 font-medium leading-6 text-zinc-900">
                      {flashcard.front}
                    </h3>

                    <div className="my-4 border-t border-zinc-100" />

                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Answer
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {flashcard.back}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Coverage</h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-500">
                    Requirements
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {data.role.requirements.length}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-500">
                    Coverage passes
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {data.coverage.passes}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-500">
                    Uncovered requirements
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {data.coverage.uncovered_requirement_ids.length}
                  </p>
                </div>
              </div>

              {data.coverage.uncovered_requirement_ids.length === 0 ? (
                <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  All required interview areas are covered.
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Some requirements are not currently covered by generated
                  questions.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}