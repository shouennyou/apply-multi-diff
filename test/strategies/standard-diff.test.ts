import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import { load as parseYaml } from "js-yaml";

// --- Mocked/Assumed Imports ---
// These functions would be imported from your actual source code.
// We are assuming their existence and signatures for this test file.
import {
  applyDiff,
  getToolDescription,
} from "../../src/strategies/standard-diff";
// -----------------------------

// Define the structure of the test fixture files
interface TestFixtures {
  tool_description_tests: {
    name: string;
    description: string;
    input: { cwd: string };
    expected_to_contain: string[];
  }[];
  apply_diff_tests: {
    name: string;
    description: string;
    input: {
      original_content: string;
      diff_content?: string;
      matchThreshold?: number;
    };
    expected: {
      success: boolean;
      content?: string;
      reason?: string;
    };
  }[];
}

const loadFixturesFromDir = (dirPath: string): TestFixtures => {
  const allFixtures: TestFixtures = {
    tool_description_tests: [],
    apply_diff_tests: [],
  };
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (path.extname(file) === ".yml" || path.extname(file) === ".yaml") {
      const filePath = path.join(dirPath, file);
      const fixture = parseYaml(
        fs.readFileSync(filePath, "utf-8")
      ) as Partial<TestFixtures>;
      if (fixture.tool_description_tests) {
        allFixtures.tool_description_tests.push(...fixture.tool_description_tests);
      }
      if (fixture.apply_diff_tests) {
        allFixtures.apply_diff_tests.push(...fixture.apply_diff_tests);
      }
    }
  }
  return allFixtures;
};
const fixturePath = path.join(__dirname, "../fixtures/standard-diff");
const fixtures = loadFixturesFromDir(fixturePath);

// --- Test Suite ---

describe("Standard Diff Strategy", () => {
  it("applies independently configurable hunk and deletion thresholds", () => {
    const patch = "--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n context line\n-abcdefghij\n+replacement";
    const source = "context line\nabcXXXghij";
    expect(applyDiff(source, patch).success).toBe(false);
    expect(applyDiff(source, patch, { matchThreshold: 0.1, deleteThreshold: 0.5 }).success).toBe(false);
    expect(applyDiff(source, patch, { matchThreshold: 0.5, deleteThreshold: 0.2 }).success).toBe(false);
    expect(applyDiff(source, patch, { matchThreshold: 0.5, deleteThreshold: 0.3 })).toEqual({ success: true, content: "context line\nreplacement\n" });
    expect(applyDiff("context line\nabcdefghiX", patch, { matchThreshold: 1, deleteThreshold: 0 }).success).toBe(false);
    expect(() => applyDiff(source, patch, { matchThreshold: NaN })).toThrow(RangeError);
    expect(() => applyDiff(source, patch, { deleteThreshold: 1.1 })).toThrow(RangeError);
  });

  it("uses the configured threshold for large hunks", () => {
    const lines = Array.from({ length: 60 }, (_, i) => `context ${i.toString().padStart(2, "0").repeat(10)}`);
    lines[59] = "A".repeat(1000);
    const patch = `--- a/file\n+++ b/file\n@@ -1,61 +1,61 @@\n${lines.map(line => ` ${line}`).join("\n")}\n-old value\n+new value`;
    const source = [...lines.slice(0, 59), `${lines[59]}${"X".repeat(600)}`, "old value"].join("\n");
    expect(applyDiff(source, patch).success).toBe(false);
    expect(applyDiff(source, patch, { matchThreshold: 1 }).success).toBe(true);
  });

  it("preserves hunk lines beginning with --- and +++", () => {
    const result = applyDiff(
      "---old",
      "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n----old\n+++new"
    );
    expect(result).toEqual({ success: true, content: "++new" });
  });

  it("does not report success when a deletion is missing", () => {
    const result = applyDiff(
      "keep\nother",
      "--- a/file.txt\n+++ b/file.txt\n@@ -1,2 +1,1 @@\n-keep\n-missing\n+changed"
    );
    expect(result.success).toBe(false);
  });

  it("adds a trailing newline for an appended target", () => {
    const result = applyDiff(
      "line 1",
      "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1,2 @@\n line 1\n+added"
    );
    expect(result).toEqual({ success: true, content: "line 1\nadded\n" });
  });

  describe("getToolDescription()", () => {
    fixtures.tool_description_tests.forEach((testCase) => {
      it(testCase.description, () => {
        const description = getToolDescription(testCase.input.cwd);
        for (const expected of testCase.expected_to_contain) {
          expect(description).toInclude(expected);
        }
      });
    });
  });

  describe("applyDiff()", () => {
    fixtures.apply_diff_tests.forEach((testCase) => {
      it(testCase.description, () => {
        if (typeof testCase.input.diff_content !== "string") return;
        const result = applyDiff(
          testCase.input.original_content,
          testCase.input.diff_content,
          { matchThreshold: testCase.input.matchThreshold }
        );

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          if (result.success) {
            expect(result.content).toBe(testCase.expected.content ?? "");
          } else {
            throw new Error("Expected success but got failure");
          }
        } else {
          if (!result.success) {
            if (testCase.expected.reason) {
              expect(result.error.message).toInclude(testCase.expected.reason);
            }
          } else {
            throw new Error("Expected failure but got success");
          }
        }
      });
    });
  });
});
