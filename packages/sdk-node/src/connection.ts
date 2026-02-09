/**
 * Connection configuration with Zod validation
 */

import { z } from "zod";
import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";

/**
 * Connection type schema
 */
const ConnectionSchema = z.object({
  name: z.string(),
  type: z.enum(["http", "websocket", "graphql", "grpc", "ui"]),
  base_url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().default(30000),
  retry: z.object({
    max_attempts: z.number().default(3),
    backoff_ms: z.number().default(1000),
  }).optional(),
  auth: z.object({
    type: z.enum(["bearer", "basic", "api_key", "oauth", "custom"]),
    credentials: z.record(z.unknown()),
  }).optional(),
  tls: z.object({
    enabled: z.boolean().default(true),
    verify: z.boolean().default(true),
    cert_path: z.string().optional(),
    key_path: z.string().optional(),
    ca_path: z.string().optional(),
  }).optional(),
  proxy: z.object({
    url: z.string().url(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Connection = z.infer<typeof ConnectionSchema>;

/**
 * Connection class for managing test environment configuration
 */
export class ConnectionClass implements Connection {
  name: string;
  type: "http" | "websocket" | "graphql" | "grpc" | "ui";
  base_url?: string;
  headers?: Record<string, string>;
  timeout: number;
  retry?: { max_attempts: number; backoff_ms: number };
  auth?: { type: string; credentials: Record<string, unknown> };
  tls?: {
    enabled: boolean;
    verify: boolean;
    cert_path?: string;
    key_path?: string;
    ca_path?: string;
  };
  proxy?: {
    url: string;
    username?: string;
    password?: string;
  };
  metadata?: Record<string, unknown>;

  constructor(data: Connection) {
    const validated = ConnectionSchema.parse(data);
    Object.assign(this, validated);
  }

  /**
   * Load connection from YAML file
   */
  static fromYaml(path: string): ConnectionClass {
    try {
      const content = readFileSync(path, "utf-8");
      const data = parseYaml(content);
      return new ConnectionClass(data);
    } catch (error) {
      throw new Error(`Failed to load connection from ${path}: ${error}`);
    }
  }

  /**
   * Load connection from environment variables
   */
  static fromEnv(prefix: string = "RIGOUR"): ConnectionClass {
    const env = process.env;
    const name = env[`${prefix}_NAME`] || "default";
    const type = (env[`${prefix}_TYPE`] || "http") as Connection["type"];
    const base_url = env[`${prefix}_BASE_URL`];
    const timeout = parseInt(env[`${prefix}_TIMEOUT`] || "30000", 10);

    return new ConnectionClass({
      name,
      type,
      base_url,
      timeout,
      headers: extractPrefixedEnv(`${prefix}_HEADER_`, env),
      auth: env[`${prefix}_AUTH_TYPE`]
        ? {
            type: env[`${prefix}_AUTH_TYPE`] as any,
            credentials: extractPrefixedEnv(`${prefix}_AUTH_`, env),
          }
        : undefined,
    });
  }

  /**
   * Get full URL for an endpoint
   */
  getUrl(endpoint: string): string {
    if (!this.base_url) {
      return endpoint;
    }
    const base = this.base_url.endsWith("/")
      ? this.base_url
      : this.base_url + "/";
    const path = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    return base + path;
  }

  /**
   * Get headers with auth if configured
   */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.headers };

    if (this.auth) {
      if (this.auth.type === "bearer" && this.auth.credentials.token) {
        headers.Authorization = `Bearer ${this.auth.credentials.token}`;
      } else if (this.auth.type === "api_key" && this.auth.credentials.key) {
        headers["X-API-Key"] = this.auth.credentials.key as string;
      } else if (
        this.auth.type === "basic" &&
        this.auth.credentials.username &&
        this.auth.credentials.password
      ) {
        const encoded = Buffer.from(
          `${this.auth.credentials.username}:${this.auth.credentials.password}`
        ).toString("base64");
        headers.Authorization = `Basic ${encoded}`;
      }
    }

    return headers;
  }

  /**
   * Validate the connection
   */
  validate(): boolean {
    ConnectionSchema.parse(this);
    return true;
  }

  /**
   * Convert to plain object
   */
  toJSON(): Connection {
    return {
      name: this.name,
      type: this.type,
      base_url: this.base_url,
      headers: this.headers,
      timeout: this.timeout,
      retry: this.retry,
      auth: this.auth,
      tls: this.tls,
      proxy: this.proxy,
      metadata: this.metadata,
    };
  }
}

/**
 * Extract environment variables by prefix
 */
function extractPrefixedEnv(
  prefix: string,
  env: NodeJS.ProcessEnv
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(prefix) && value) {
      const cleanKey = key.slice(prefix.length).toLowerCase();
      result[cleanKey] = value;
    }
  }
  return result;
}

/**
 * Export Zod schema for validation
 */
export const Schemas = {
  Connection: ConnectionSchema,
};
