/**
 * Tests for the LLM service — buildStandardContext, buildEnhancedContext,
 * streamLLMQuery, generateConceptSummary, and createMessageId.
 *
 * Fetch and IndexedDB are mocked so no network or browser storage is needed.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// --- DB Mock ---
const mockDb = vi.hoisted(() => ({
  dailySummaries: {
    where: vi.fn(),
  },
  labResults: {
    orderBy: vi.fn(),
  },
  healthRecords: {
    where: vi.fn(),
  },
}));

vi.mock("@/db", () => ({ db: mockDb }));

import {
  buildStandardContext,
  buildEnhancedContext,
  createMessageId,
  streamLLMQuery,
  generateConceptSummary,
} from "../llm";

// --- Helpers ---

/** Set up the db mock to return empty data for all methods */
function setupEmptyDb() {
  mockDb.dailySummaries.where.mockReturnValue({
    between: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
      sortBy: vi.fn().mockResolvedValue([]),
    }),
  });
  mockDb.healthRecords.where.mockReturnValue({
    between: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
  });
  mockDb.labResults.orderBy.mockReturnValue({
    reverse: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    }),
  });
}

/** Create a mock fetch that returns an SSE-style response body */
function createMockFetch(sseData: string, status = 200) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(sseData);
  let delivered = false;

  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue({ detail: "LLM request failed" }),
    body: {
      getReader: vi.fn().mockReturnValue({
        read: vi.fn().mockImplementation(async () => {
          if (!delivered) {
            delivered = true;
            return { done: false, value: encoded };
          }
          return { done: true, value: undefined };
        }),
      }),
    },
  });
}

// --- createMessageId ---

describe("createMessageId", () => {
  it("returns a UUID string", () => {
    const id = createMessageId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("returns a unique ID on each call", () => {
    const ids = new Set(Array.from({ length: 10 }, () => createMessageId()));
    expect(ids.size).toBe(10);
  });
});

// --- buildStandardContext ---

describe("buildStandardContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyDb();
  });

  it("returns the no-data fallback when IndexedDB is empty", async () => {
    const context = await buildStandardContext();
    expect(context).toBe("No health data available yet.");
  });

  it("includes step count summary when daily summaries exist", async () => {
    const stepSummary = {
      metricType: "step_count",
      date: "2024-03-15",
      avg: null,
      sum: 8500,
      min: 8500,
      max: 8500,
      count: 1,
    };

    // Return step data only when the range starts with "step_count"
    mockDb.dailySummaries.where.mockReturnValue({
      between: vi.fn().mockImplementation((from: unknown[]) => {
        const hasData = Array.isArray(from) && from[0] === "step_count";
        return {
          toArray: vi.fn().mockResolvedValue(hasData ? [stepSummary] : []),
          sortBy: vi.fn().mockResolvedValue(hasData ? [stepSummary] : []),
        };
      }),
    });

    const context = await buildStandardContext();
    expect(context).not.toBe("No health data available yet.");
    expect(context).toContain("7-day avg");
  });

  it("includes lab result categories when results are available", async () => {
    const labResults = [{ category: "blood_panel", date: "2024-03-01" }];
    mockDb.labResults.orderBy.mockReturnValue({
      reverse: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(labResults) }),
      }),
    });

    // Need at least one metric with data too to get a non-empty context,
    // but actually the lab results alone still output "Recent lab work: ..."
    // even if all metric lines are empty. Let's check it's included.
    const context = await buildStandardContext();
    expect(context).toContain("Recent lab work");
    expect(context).toContain("blood_panel");
  });

  it("uses singular 'report' for a single lab result", async () => {
    const labResults = [{ category: "thyroid", date: "2024-03-01" }];
    mockDb.labResults.orderBy.mockReturnValue({
      reverse: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(labResults) }),
      }),
    });

    const context = await buildStandardContext();
    expect(context).toContain("1 report");
    expect(context).not.toContain("reports");
  });

  it("uses plural 'reports' for multiple lab results", async () => {
    const labResults = [
      { category: "thyroid", date: "2024-03-01" },
      { category: "blood_panel", date: "2024-02-15" },
    ];
    mockDb.labResults.orderBy.mockReturnValue({
      reverse: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(labResults) }),
      }),
    });

    const context = await buildStandardContext();
    expect(context).toContain("2 reports");
  });

  it("includes workout count when workouts occurred this week", async () => {
    mockDb.healthRecords.where.mockReturnValue({
      between: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(4) }),
    });

    const context = await buildStandardContext();
    expect(context).toContain("Workouts this week: 4");
  });

  it("omits workout line when there are no recent workouts", async () => {
    const context = await buildStandardContext();
    expect(context).not.toContain("Workouts this week");
  });
});

// --- buildEnhancedContext ---

describe("buildEnhancedContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyDb();
  });

  it("returns a non-empty string", async () => {
    const context = await buildEnhancedContext();
    expect(typeof context).toBe("string");
    // Even with no data it returns the standard "No health data" string
    expect(context.length).toBeGreaterThan(0);
  });

  it("includes lab result values with flag annotations in enhanced context", async () => {
    // First call is from buildStandardContext (limit 5), second from buildEnhancedContext (limit 3)
    const labResult = {
      category: "lipid_panel",
      date: "2024-03-01",
      structuredValues: {
        HDL: { value: 55, unit: "mg/dL", flag: "normal", referenceRange: "40-60" },
        LDL: { value: 145, unit: "mg/dL", flag: "high" },
      },
    };

    mockDb.labResults.orderBy
      .mockReturnValueOnce({
        // standard context call (limit 5) — show category only
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([labResult]) }),
        }),
      })
      .mockReturnValueOnce({
        // enhanced context call (limit 3) — show values
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([labResult]) }),
        }),
      });

    const context = await buildEnhancedContext();
    expect(context).toContain("HDL");
    expect(context).toContain("55");
    expect(context).toContain("mg/dL");
    expect(context).toContain("[HIGH]");
  });

  it("omits the lab section when there are no lab results", async () => {
    const context = await buildEnhancedContext();
    expect(context).not.toContain("--- Lab Results ---");
  });
});

// --- streamLLMQuery ---

describe("streamLLMQuery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("yields text chunks from an SSE stream", async () => {
    const sseData = 'data: {"text":"Hello"}\ndata: {"text":" world"}\ndata: [DONE]\n';
    vi.stubGlobal("fetch", createMockFetch(sseData));

    const chunks: string[] = [];
    for await (const chunk of streamLLMQuery({
      messages: [{ role: "user", content: "Hi" }],
      healthContext: "No data",
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("stops yielding when [DONE] sentinel is received", async () => {
    const sseData = 'data: {"text":"A"}\ndata: [DONE]\ndata: {"text":"B"}\n';
    vi.stubGlobal("fetch", createMockFetch(sseData));

    const chunks: string[] = [];
    for await (const chunk of streamLLMQuery({
      messages: [{ role: "user", content: "Hi" }],
      healthContext: "",
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["A"]); // "B" is after [DONE] and should not be yielded
  });

  it("throws an error when the response is not OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({ detail: "Rate limit exceeded" }),
        body: null,
      }),
    );

    await expect(async () => {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: consuming async iterator for test
      for await (const _ of streamLLMQuery({ messages: [], healthContext: "" })) {}
    }).rejects.toThrow("Rate limit exceeded");
  });

  it("throws when response body is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, body: null }),
    );

    await expect(async () => {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: consuming async iterator for test
      for await (const _ of streamLLMQuery({ messages: [], healthContext: "" })) {}
    }).rejects.toThrow("No response body");
  });

  it("ignores malformed SSE lines without throwing", async () => {
    const sseData = 'data: {"text":"OK"}\ndata: not-valid-json\ndata: [DONE]\n';
    vi.stubGlobal("fetch", createMockFetch(sseData));

    const chunks: string[] = [];
    for await (const chunk of streamLLMQuery({ messages: [], healthContext: "" })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["OK"]);
  });

  it("throws when the SSE payload contains an error field", async () => {
    const sseData = 'data: {"error":"Upstream failure"}\n';
    vi.stubGlobal("fetch", createMockFetch(sseData));

    await expect(async () => {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: consuming async iterator for test
      for await (const _ of streamLLMQuery({ messages: [], healthContext: "" })) {}
    }).rejects.toThrow("Upstream failure");
  });

  it("ignores SSE lines that do not start with 'data: '", async () => {
    const sseData = ': comment\nevent: ping\ndata: {"text":"yes"}\ndata: [DONE]\n';
    vi.stubGlobal("fetch", createMockFetch(sseData));

    const chunks: string[] = [];
    for await (const chunk of streamLLMQuery({ messages: [], healthContext: "" })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["yes"]);
  });
});

// --- generateConceptSummary ---

describe("generateConceptSummary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects and returns the full text from an SSE stream", async () => {
    const sseData =
      'data: {"text":"Penicillin is an antibiotic."}\ndata: {"text":" It treats infections."}\ndata: [DONE]\n';
    vi.stubGlobal("fetch", createMockFetch(sseData));

    const result = await generateConceptSummary("372687004", "Amoxicillin", "allergen");
    expect(result).toBe("Penicillin is an antibiotic. It treats infections.");
  });

  it("trims leading and trailing whitespace from the result", async () => {
    const sseData = 'data: {"text":"  spaced  "}\ndata: [DONE]\n';
    vi.stubGlobal("fetch", createMockFetch(sseData));

    const result = await generateConceptSummary("123", "Test", "condition");
    expect(result).toBe("spaced");
  });

  it("throws when the response is not OK (using title field)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({ title: "Service unavailable" }),
        body: null,
      }),
    );

    await expect(generateConceptSummary("123", "Test", "condition")).rejects.toThrow(
      "Service unavailable",
    );
  });

  it("throws when response body is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, body: null }),
    );

    await expect(generateConceptSummary("123", "Test", "condition")).rejects.toThrow(
      "No response body",
    );
  });
});
