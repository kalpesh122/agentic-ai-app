import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { Env } from '../env.ts';

/**
 * Starts OpenTelemetry when an OTLP endpoint or Langfuse keys are configured. The AI SDK emits
 * GenAI spans when `experimental_telemetry.isEnabled` is true; Langfuse's span processor turns them
 * into traces with token usage and cost. Returns a shutdown function (no-op when disabled).
 */
export async function startTelemetry(
  env: Env,
): Promise<{ enabled: boolean; shutdown: () => Promise<void> }> {
  const processors = [];
  if (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY) {
    const { LangfuseSpanProcessor } = await import('@langfuse/otel');
    processors.push(
      new LangfuseSpanProcessor({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        baseUrl: env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
      }),
    );
  }
  const traceExporter = env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
    : undefined;
  if (processors.length === 0 && !traceExporter)
    return { enabled: false, shutdown: async () => {} };
  const sdk = new NodeSDK({
    serviceName: 'agentic-ai-app',
    spanProcessors: processors,
    ...(traceExporter ? { traceExporter } : {}),
  });
  sdk.start();
  return { enabled: true, shutdown: () => sdk.shutdown() };
}
