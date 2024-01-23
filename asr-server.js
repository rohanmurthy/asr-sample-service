import Fastify from "fastify";
import { TranscriptMocks } from "./mock-transcripts.js";
import { startTranscribeJob, getTranscriptResult, getUserTranscriptResults } from "./transcription.js";

const DELAY_MS = 5_000;
const FAILURE_RATE = 1 / 10;
const MAX_REQUESTS = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const addRandomRequestLatency = async () => {
  await sleep(DELAY_MS + Math.random() * DELAY_MS);
};

const fastify = Fastify({
  logger: true,
});

let currentRequests = 0;

fastify.addHook("onRequest", async (request, reply) => {
  if (currentRequests + 1 > MAX_REQUESTS) {
    return reply.code(429).send({ error: "Too many requests" });
  }

  currentRequests++;
});

["onResponse", "onRequestAbort"].forEach((hook) => {
  fastify.addHook(hook, async (request) => {
    currentRequests = Math.max(0, currentRequests - 1);
  });
});

fastify.get("/get-asr-output", async function handler(request, reply) {
  const { path } = request.query;

  await addRandomRequestLatency();

  const file = TranscriptMocks.get(path);
  if (!file) {
    return reply.code(404).send({ error: "File not found" });
  }

  if (file.shouldError || Math.random() < FAILURE_RATE) {
    return reply.code(500).send({ error: "Internal server error" });
  }

  return { path, transcript: file.text };
});

fastify.post("/transcribe", async function handler(request, reply) {
  if (!request.body) {
    return reply.code(400).send({ error: "Invalid request body" });
  }

  const jobId = await startTranscribeJob(request.body);
  return { jobId };
});

fastify.get("/transcript/:jobId", async function handler(request, reply) {
  if (!request.params || !request.params.jobId) {
    return reply.code(400).send({ error: "Invalid jobId" });
  }

  const transcriptResult = getTranscriptResult(request.params.jobId);
  if (!transcriptResult) {
    return reply.code(404).send({ error: "jobId does not exist" });
  }
  return { transcriptResult };
});

fastify.get("/transcript/search", async function handler(request, reply) {
  const { jobStatus, userId } = request.query;
  if (!jobStatus || !userId) {
    return reply.code(400).send({ error: "Invalid query params" });
  }

  const transcriptResults = getUserTranscriptResults({ jobStatus, userId });
  if (!transcriptResults) {
    return reply.code(404).send({ error: "transcriptResults for user ID and jobStatus do not exist" });
  }
  return { transcriptResults };
});

try {
  console.log("Starting server..., supported paths:");
  console.log(TranscriptMocks.keys());
  await fastify.listen({ port: 3000 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
