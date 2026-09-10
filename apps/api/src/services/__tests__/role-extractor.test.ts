import { describe, expect, it, vi } from "vitest";

import { extractRole } from "../role-extractor.js";

vi.mock("../llm.js", () => ({
  generateJson: vi.fn(),
}));

import { generateJson } from "../llm.js";

const mockedGenerateJson = vi.mocked(generateJson);

describe("extractRole", () => {
  it("extracts title, seniority, and responsibilities", async () => {
    mockedGenerateJson.mockResolvedValue({
      title: "Full Stack Software Engineer Intern",
      seniority: "Intern",
      responsibilities: [
        "Build and maintain web applications",
        "Develop REST APIs",
        "Collaborate with the engineering team",
      ],
    });

    const jobDescription = `
      We are looking for a Full Stack Software Engineer Intern.

      Responsibilities:
      - Build and maintain web applications
      - Develop REST APIs
      - Collaborate with the engineering team
    `;

    const result = await extractRole(jobDescription);

    expect(result).toEqual({
      title: "Full Stack Software Engineer Intern",
      seniority: "Intern",
      responsibilities: [
        "Build and maintain web applications",
        "Develop REST APIs",
        "Collaborate with the engineering team",
      ],
    });

    expect(mockedGenerateJson).toHaveBeenCalledTimes(1);
  });

  it("uses Not specified when seniority is not stated", async () => {
    mockedGenerateJson.mockResolvedValue({
      title: "Software Engineer",
      seniority: "Not specified",
      responsibilities: ["Build web applications"],
    });

    const result = await extractRole(
      "We are looking for a Software Engineer to build web applications."
    );

    expect(result.seniority).toBe("Not specified");
  });

  it("rejects an empty job description", async () => {
    await expect(extractRole("   ")).rejects.toThrow(
      "Job description cannot be empty."
    );

    expect(mockedGenerateJson).not.toHaveBeenCalled();
  });

  it("rejects invalid LLM output", async () => {
    mockedGenerateJson.mockResolvedValue({
      title: "Software Engineer",
      seniority: "Junior",
      responsibilities: "Build applications",
    });

    await expect(
      extractRole("We are looking for a Software Engineer.")
    ).rejects.toThrow();
  });
});