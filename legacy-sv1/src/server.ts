import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { loadLegacyConfig } from "./config.js";
import { LegacyIpcClient, LegacyIpcError } from "./ipc.js";

const input = {
  trackIndex: z.number().int().min(0).optional(),
  partIndex: z.number().int().min(0).optional(),
  noteIndex: z.number().int().min(0).optional(),
  name: z.string().max(512).optional(),
  onset: z.number().int().min(0).optional(),
  duration: z.number().int().min(1).optional(),
  pitch: z.number().int().min(0).max(127).optional(),
  lyrics: z.string().max(4096).optional(),
  phonemes: z.string().max(4096).optional(),
  seconds: z.number().finite().min(0).optional(),
};
const writeTools = new Set(["project.open", "track.create", "track.update", "track.delete", "part.create", "part.update", "part.delete", "note.create", "note.update", "note.delete", "transport.play", "transport.pause", "transport.stop", "transport.seek"]);
const tools = ["studio.get_status", "project.get", "sequence.get", "transport.get", "transport.play", "transport.pause", "transport.stop", "transport.seek", "track.list", "track.get", "track.create", "track.update", "track.delete", "part.list", "part.get", "part.create", "part.update", "part.delete", "note.list", "note.create", "note.update", "note.delete"] as const;

export function createLegacyServer(client = new LegacyIpcClient(loadLegacyConfig())): McpServer {
  const server = new McpServer({ name: "synthv-agent-bridge-sv1-legacy", version: "1.0.0" });
  for (const name of tools) {
    server.tool(name, `SV1 legacy standard operation: ${name}`, input, async (args) => {
      try {
        const result = name === "studio.get_status" ? await client.status() : await client.call(name, { ...args, writeIntent: writeTools.has(name) });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        const publicError = error instanceof LegacyIpcError ? { code: error.code, message: error.message } : { code: "INTERNAL_ERROR", message: "Legacy bridge request failed." };
        return { content: [{ type: "text", text: JSON.stringify({ error: publicError }) }], isError: true };
      }
    });
  }
  return server;
}

export async function runLegacyStdioServer(): Promise<void> {
  const server = createLegacyServer();
  await server.connect(new StdioServerTransport());
}

export const legacyToolNames = tools;
