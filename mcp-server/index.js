#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);

function loadCore() {
  try {
    return {
      runner: require("vibe-clinic/src/runner"),
      schema: require("vibe-clinic/src/schema"),
      init: require("vibe-clinic/src/init"),
    };
  } catch {
    return {
      runner: require("../src/runner"),
      schema: require("../src/schema"),
      init: require("../src/init"),
    };
  }
}

const core = loadCore();
const { runDiagnostics, discoverDiagnostics } = core.runner;
const { validateDiagnosticModule } = core.schema;
const { initialize } = core.init;

const server = new McpServer({
  name: "vibe-clinic",
  version: "1.1.0",
});

server.tool(
  "run_clinic",
  "Run all .clinic.js diagnostics in the project and return structured results with OK/WARNING/ERROR status and health percentage. Trigger: 자가진단 실행, 진단 돌려줘, run diagnostics",
  {
    projectDir: z.string().describe("Absolute path to the project root directory containing .vibe-clinic/"),
  },
  async ({ projectDir }) => {
    try {
      const results = await runDiagnostics(projectDir);

      const summary = {
        total: results.length,
        ok: results.filter((r) => r.status === "OK").length,
        warning: results.filter((r) => r.status === "WARNING").length,
        error: results.filter((r) => r.status === "ERROR").length,
      };

      const overallStatus =
        summary.error > 0 ? "ERROR" : summary.warning > 0 ? "WARNING" : "OK";

      const healthPercent =
        summary.total > 0 ? Math.round((summary.ok / summary.total) * 100) : 100;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { results, summary, overallStatus, healthPercent },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error running diagnostics: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "init_clinic",
  "Initialize .vibe-clinic/ directory structure in a project with config, example diagnostic, and error pattern template. Trigger: 자가진단 적용, 자가진단 MCP 적용, 자가진단 초기화, vibe-clinic init",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
  },
  async ({ projectDir }) => {
    try {
      const diagRoot = path.join(projectDir, ".vibe-clinic");
      const existed = fs.existsSync(diagRoot);

      const origLog = console.log;
      console.log = () => {};
      try { initialize(projectDir); } finally { console.log = origLog; }

      const text = existed
        ? `.vibe-clinic/ already exists in ${projectDir} — existing files were not touched. .gitignore entry and MCP config were ensured.`
        : `Initialized .vibe-clinic/ in ${projectDir}\n\nCreated:\n- .vibe-clinic/config.json\n- .vibe-clinic/diagnostics/example.clinic.js\n- .vibe-clinic/error-patterns/ERR_000_template.md`;

      return {
        content: [{ type: "text", text }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error initializing: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_clinics",
  "List all diagnostic files (.clinic.js) in the project with their metadata (id, name, layer)",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
  },
  async ({ projectDir }) => {
    try {
      const files = discoverDiagnostics(projectDir);

      if (files.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No .clinic.js files found in .vibe-clinic/diagnostics/",
            },
          ],
        };
      }

      const diagnostics = [];
      for (const filePath of files) {
        try {
          delete require.cache[require.resolve(filePath)];
          const mod = require(filePath);
          const validation = validateDiagnosticModule(mod, filePath);
          diagnostics.push({
            file: path.basename(filePath),
            id: mod.id || path.basename(filePath, ".clinic.js"),
            name: mod.name || "Unknown",
            layer: mod.layer || "UNKNOWN",
            linkedTask: mod.linkedTask || null,
            valid: validation.valid,
            errors: validation.errors,
          });
        } catch (err) {
          diagnostics.push({
            file: path.basename(filePath),
            id: path.basename(filePath, ".clinic.js"),
            name: "Failed to load",
            layer: "UNKNOWN",
            valid: false,
            errors: [err.message],
          });
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify(diagnostics, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error listing diagnostics: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "read_error_pattern",
  "Read an error pattern log file from .vibe-clinic/error-patterns/",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    filename: z
      .string()
      .optional()
      .describe("Specific error pattern filename (e.g. ERR_001_division_nan.md). If omitted, lists all available patterns"),
  },
  async ({ projectDir, filename }) => {
    try {
      const patternsDir = path.join(projectDir, ".vibe-clinic", "error-patterns");

      if (!fs.existsSync(patternsDir)) {
        return {
          content: [{ type: "text", text: "No error-patterns/ directory found" }],
        };
      }

      if (!filename) {
        const files = fs.readdirSync(patternsDir).filter((f) => f.endsWith(".md"));
        return {
          content: [
            {
              type: "text",
              text:
                files.length > 0
                  ? `Available error patterns:\n${files.map((f) => `- ${f}`).join("\n")}`
                  : "No error pattern files found",
            },
          ],
        };
      }

      const safeName = path.basename(filename);
      if (safeName !== filename) {
        return {
          content: [{ type: "text", text: `Invalid filename: ${filename}` }],
          isError: true,
        };
      }

      const filePath = path.join(patternsDir, safeName);
      if (!fs.existsSync(filePath)) {
        return {
          content: [{ type: "text", text: `Error pattern not found: ${filename}` }],
          isError: true,
        };
      }

      const content = fs.readFileSync(filePath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error reading pattern: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "write_error_pattern",
  "Create or update an error pattern log in .vibe-clinic/error-patterns/ to prevent repeating the same mistakes",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    filename: z
      .string()
      .describe("Error pattern filename (e.g. ERR_002_null_reference.md)"),
    content: z.string().describe("Markdown content for the error pattern log"),
  },
  async ({ projectDir, filename, content }) => {
    try {
      const patternsDir = path.join(projectDir, ".vibe-clinic", "error-patterns");
      fs.mkdirSync(patternsDir, { recursive: true });

      const safeName = path.basename(filename);
      if (safeName !== filename) {
        return {
          content: [{ type: "text", text: `Invalid filename: ${filename}` }],
          isError: true,
        };
      }

      const filePath = path.join(patternsDir, safeName);
      const existed = fs.existsSync(filePath);
      fs.writeFileSync(filePath, content, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: `${existed ? "Updated" : "Created"} error pattern: ${filename}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error writing pattern: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "open_dashboard",
  "Open the Vibe Clinic web dashboard in the browser. Shows all diagnostics as visual cards with a Run button for one-click verification. Trigger: 대시보드 열어줘, 자가진단 대시보드, dashboard",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    port: z.number().optional().describe("Port number (default: 7700)"),
  },
  async ({ projectDir, port }) => {
    try {
      const dashboardPort = port || 7700;
      const { spawn } = await import("child_process");

      let vibeDiagBin;
      try {
        vibeDiagBin = require.resolve("vibe-clinic/bin/vibe-clinic.js");
      } catch {
        vibeDiagBin = path.resolve(
          path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
          "..",
          "bin",
          "vibe-clinic.js"
        );
      }

      const child = spawn("node", [vibeDiagBin, "dashboard", "--cwd", projectDir, "--port", String(dashboardPort)], {
        windowsHide: true,
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      return {
        content: [
          {
            type: "text",
            text: `Dashboard opened at http://localhost:${dashboardPort}\nProject: ${projectDir}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error opening dashboard: ${err.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

