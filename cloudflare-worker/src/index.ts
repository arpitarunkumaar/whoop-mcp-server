import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { handleAccessRequest } from "./access-handler";
import type { AccessUserProps, Env } from "./types";
import {
  assertAllowedWhoopUser,
  getWhoopAuthStatus,
  getWhoopBodyMeasurements,
  getWhoopCycles,
  getWhoopProfile,
  getWhoopRecovery,
  getWhoopSleep,
  getWhoopWorkouts,
} from "./whoop";

function buildToolPayload(toolName: string, data: unknown, error?: string) {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tool: toolName,
  };

  if (error) {
    payload.error = error;
  } else {
    payload.data = data;
  }

  return {
    content: [
      {
        text: JSON.stringify(payload),
        type: "text" as const,
      },
    ],
  };
}

export class WhoopMcpAgent extends McpAgent<Env, Record<string, never>, AccessUserProps> {
  server = new McpServer({
    name: "whoop-mcp-cloudflare",
    version: "1.0.0",
  });

  private ensureAllowedUser(): void {
    const email = this.props?.email;
    if (!email) {
      throw new Error("Missing Access-authenticated user context.");
    }
    assertAllowedWhoopUser(email, this.env.WHOOP_ALLOWED_EMAIL);
  }

  private async runTool(toolName: string, fn: () => Promise<unknown>) {
    try {
      this.ensureAllowedUser();
      const data = await fn();
      return buildToolPayload(toolName, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildToolPayload(toolName, null, message);
    }
  }

  async init(): Promise<void> {
    this.server.tool("get_whoop_auth_status", "Get WHOOP authentication status", {}, async () =>
      this.runTool("get_whoop_auth_status", async () => getWhoopAuthStatus(this.env)),
    );

    this.server.tool("get_whoop_profile", "Get WHOOP user profile information", {}, async () =>
      this.runTool("get_whoop_profile", async () => getWhoopProfile(this.env)),
    );

    this.server.tool(
      "get_whoop_body_measurements",
      "Get WHOOP user body measurements",
      {},
      async () =>
        this.runTool("get_whoop_body_measurements", async () => getWhoopBodyMeasurements(this.env)),
    );

    const collectionSchema = {
      end_date: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(5),
      next_token: z.string().optional(),
      start_date: z.string().optional(),
    };

    this.server.tool(
      "get_whoop_workouts",
      "Get WHOOP workout data",
      collectionSchema,
      async ({ end_date, limit, next_token, start_date }) =>
        this.runTool("get_whoop_workouts", async () =>
          getWhoopWorkouts(this.env, { end_date, limit, next_token, start_date }),
        ),
    );

    this.server.tool(
      "get_whoop_recovery",
      "Get WHOOP recovery data",
      collectionSchema,
      async ({ end_date, limit, next_token, start_date }) =>
        this.runTool("get_whoop_recovery", async () =>
          getWhoopRecovery(this.env, { end_date, limit, next_token, start_date }),
        ),
    );

    this.server.tool(
      "get_whoop_sleep",
      "Get WHOOP sleep data",
      collectionSchema,
      async ({ end_date, limit, next_token, start_date }) =>
        this.runTool("get_whoop_sleep", async () =>
          getWhoopSleep(this.env, { end_date, limit, next_token, start_date }),
        ),
    );

    this.server.tool(
      "get_whoop_cycles",
      "Get WHOOP physiological cycle data",
      collectionSchema,
      async ({ end_date, limit, next_token, start_date }) =>
        this.runTool("get_whoop_cycles", async () =>
          getWhoopCycles(this.env, { end_date, limit, next_token, start_date }),
        ),
    );
  }
}

export default new OAuthProvider({
  apiHandler: WhoopMcpAgent.serve("/mcp"),
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: { fetch: handleAccessRequest as never },
  tokenEndpoint: "/token",
});
