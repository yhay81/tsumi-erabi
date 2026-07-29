import { describe, expect, it } from "vitest";

import client from "../public/app.js?raw";
import metrics from "../ops/product-metrics.sql?raw";
import schema from "../db/migrations/0001_initial.sql?raw";

describe("browser client and metrics contract", () => {
  it("renders external Steam data through DOM text nodes without raw HTML injection", () => {
    expect(client).toContain("textContent");
    expect(client).toContain("replaceChildren");
    expect(client).not.toMatch(/\.innerHTML\s*=/);
    expect(client).toContain('referrerPolicy = "no-referrer"');
  });

  it("marks explicit QA traffic so automation is excluded from product metrics", () => {
    expect(client).toContain('get("qa") === "1"');
    expect(client).toContain("navigator.webdriver === true");
    expect(client).toContain("automated");
    expect(metrics).toContain("WHERE is_automated = 0");
  });

  it("stores no selected App ID or URL in the event schema", () => {
    expect(schema).toContain("session_hash TEXT NOT NULL");
    expect(schema).toContain("app_count INTEGER NOT NULL");
    expect(schema).not.toContain("selected_app");
    expect(schema).not.toContain("candidate_url");
  });
});
