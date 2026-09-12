"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function NewKitPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [daysAvailable, setDaysAvailable] = useState("5");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/kits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          jobDescription,
          companyUrl,
          daysAvailable: Number(daysAvailable),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? "Unable to create kit.");
        return;
      }

      router.push("/");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-6 text-sm text-zinc-500 transition hover:text-zinc-950"
          >
            ← Back to dashboard
          </button>

          <p className="mb-2 text-sm font-medium text-zinc-500">
            AI Interview Prep
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Create an interview kit
          </h1>

          <p className="mt-2 text-sm text-zinc-600">
            Tell us about the role and company so we can build your preparation
            plan.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium"
              >
                Kit name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={120}
                placeholder="Senior Backend Engineer - Acme"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />

              <p className="mt-1.5 text-xs text-zinc-500">
                Give this preparation kit a name you&apos;ll recognize later.
              </p>
            </div>

            <div>
              <label
                htmlFor="companyUrl"
                className="mb-2 block text-sm font-medium"
              >
                Company URL
              </label>

              <input
                id="companyUrl"
                type="url"
                value={companyUrl}
                onChange={(event) => setCompanyUrl(event.target.value)}
                required
                placeholder="https://example.com"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />

              <p className="mt-1.5 text-xs text-zinc-500">
                We&apos;ll use this later for company research.
              </p>
            </div>

            <div>
              <label
                htmlFor="daysAvailable"
                className="mb-2 block text-sm font-medium"
              >
                Days available
              </label>

              <input
                id="daysAvailable"
                type="number"
                value={daysAvailable}
                onChange={(event) => setDaysAvailable(event.target.value)}
                required
                min={1}
                max={60}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />

              <p className="mt-1.5 text-xs text-zinc-500">
                How many days you have to prepare for the interview.
              </p>
            </div>

            <div>
              <label
                htmlFor="jobDescription"
                className="mb-2 block text-sm font-medium"
              >
                Job description
              </label>

              <textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                required
                rows={12}
                placeholder="Paste the full job description here..."
                className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />

              <p className="mt-1.5 text-xs text-zinc-500">
                Paste the complete job description. We&apos;ll extract requirements
                from it later.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-zinc-100 pt-6">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Creating kit..." : "Create kit"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}