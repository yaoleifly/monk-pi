import { MONK_BASE_URL } from "./constants";

export interface ValidateResult {
  valid: boolean;
  latencyMs: number;
  models: string[];
  error?: string;
  statusCode?: number;
}

export interface CompletionTestResult {
  success: boolean;
  latencyMs: number;
  reply?: string;
  error?: string;
}

/**
 * Validates the Monk API Key by checking GET /v1/models
 */
export async function validateApiKey(
  apiKey: string,
  baseUrl: string = MONK_BASE_URL
): Promise<ValidateResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return {
      valid: false,
      latencyMs: 0,
      models: [],
      error: "API Key 不能为空",
    };
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/models`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (response.status === 401 || response.status === 403) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return {
        valid: false,
        latencyMs,
        models: [],
        statusCode: response.status,
        error: body.error?.message || "API Key 无效或已过期，请检查 monk.party 的订阅凭证",
      };
    }

    if (!response.ok) {
      return {
        valid: false,
        latencyMs,
        models: [],
        statusCode: response.status,
        error: `Monk API 响应异常 (HTTP ${response.status})`,
      };
    }

    const data = (await response.json().catch(() => ({}))) as {
      data?: Array<{ id: string }>;
    };

    const models = Array.isArray(data.data) ? data.data.map((m) => m.id) : [];

    return {
      valid: true,
      latencyMs,
      models,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      valid: false,
      latencyMs,
      models: [],
      error: isAbort
        ? "连接 Monk 服务超时（超过 8 秒），请检查网络连接"
        : `网络连接失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Tests an actual chat completion to ensure the model responds properly
 */
export async function testChatCompletion(
  apiKey: string,
  model: string = "monk-fast",
  baseUrl: string = MONK_BASE_URL
): Promise<CompletionTestResult> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "pong" }],
        max_tokens: 10,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errJson = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return {
        success: false,
        latencyMs,
        error: errJson.error?.message || `HTTP ${response.status}`,
      };
    }

    const json = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply = json.choices?.[0]?.message?.content?.trim() || "";

    return {
      success: true,
      latencyMs,
      reply,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
