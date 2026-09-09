"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:4000";

type Kit = {
  _id: string;
  name: string;
  companyUrl: string;
  daysAvailable: number;
  status: "draft" | "generating" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
};

type User = {
  id: string;
  email: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const authResponse = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });

        if (!authResponse.ok) {
          router.push("/login");
          return;
        }

        const authResult = await authResponse.json();
        setUser(authResult.user);

        const kitsResponse = await fetch(`${API_URL}/kits`, {
          credentials: "include",
        });

        const kitsResult = await kitsResponse.json();

        if (!kitsResponse.ok) {
          setError(
            kitsResult.error?.message ?? "Unable to load your interview kits."
          );
          return;
        }

        setKits(kitsResult.kits);
      } catch {
        setError("Unable to connect to the server.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  async function handleLogout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      router.push("/login");
    } catch {
      setError("Unable to log out.");
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-zinc-500">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              AI Interview Prep
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Your interview kits
            </h1>

            {user && (
              <p className="mt-2 text-sm text-zinc-600">
                Logged in as {user.email}
              </p>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Log out
          </button>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Saved kits</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Your interview preparation kits will appear here.
              </p>
            </div>

            <button
              onClick={() => router.push("/kits/new")}
              className="rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Create new kit
            </button>
          </div>

          {kits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
              <h3 className="text-base font-semibold">
                No interview kits yet
              </h3>

              <p className="mt-2 text-sm text-zinc-500">
                Create your first kit to start preparing for an interview.
              </p>

              <button
                onClick={() => router.push("/kits/new")}
                className="mt-5 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Create your first kit
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {kits.map((kit) => (
                <button
                  key={kit._id}
                  type="button"
                  onClick={() => router.push(`/kits/${kit._id}`)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{kit.name}</h3>

                      <p className="mt-1 text-sm text-zinc-500">
                        {kit.companyUrl}
                      </p>
                    </div>

                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600">
                      {kit.status}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-sm text-zinc-500">
                    <span>
                      {kit.daysAvailable}{" "}
                      {kit.daysAvailable === 1 ? "day" : "days"} available
                    </span>

                    <span>
                      {new Date(kit.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}