import { httpsCallable } from "firebase/functions";

import {
  aiOutputSchema,
  aiRequestSchema,
  type AiOutput,
} from "@/src/domain/schemas";
import {
  requireFirebaseAuth,
  requireFirebaseFunctions,
} from "./firebase/config";

export async function parseWithCloudAi(input: unknown): Promise<AiOutput> {
  const request = aiRequestSchema.parse(input);
  if (!requireFirebaseAuth().currentUser) {
    throw new Error("Sign in to use optional cloud AI parsing.");
  }
  const parseTranscript = httpsCallable<unknown, unknown>(
    requireFirebaseFunctions(),
    "parseTranscript",
  );
  const result = await parseTranscript(request);
  return aiOutputSchema.parse(result.data);
}
