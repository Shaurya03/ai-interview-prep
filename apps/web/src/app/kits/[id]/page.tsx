"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = "http://localhost:4000";

type Kit = {
  _id: string;
  name: string;
  jobDescription: string;
  companyUrl: string;
  daysAvailable: number;
  status: "draft" | "generating" | "ready" | "failed";
  data?: unknown;
  createdAt: string;
  updatedAt: string;
};

export default function KitDetailPage() {
  const router = useRouter();
  const params = useParams();

  const kitId = params.id as string;

  const [kit, setKit] = useState<Kit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
      } catch {
        setError("Unable to connect to the server.");
      } finally {
        setIsLoading(false);
      }
    }

    loadKit();
  }, [kitId, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-zinc-500">Loading interview kit...</p>
        </div>
      </main>
    );
  }

  if (error || !kit) {
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
            {error || "Interview kit not found."}
          </div>
        </div>
      </main>
    );
  }

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
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
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

            <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium capitalize text-zinc-600">
              {kit.status}
            </span>
          </div>
        </header>

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
              <h2 className="text-lg font-semibold">Preparation details</h2>

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
                  <p className="mt-1 font-medium capitalize">{kit.status}</p>
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

        <section className="mt-6">
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold">
              Your preparation kit will appear here
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
              Once we build the research and AI generation pipeline, this
              section will contain extracted requirements, interview questions,
              coverage, your study schedule, and flashcards.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}