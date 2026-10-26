import type { TutorClient } from "../api/client";
import type { PhotoPayload } from "./photo";

/** Diagnosis runs in the background; only ambiguous input needs a conversational clarification. */
export async function startMistakeAnalysis(
  client: TutorClient,
  photo: PhotoPayload,
  request: string,
  conversationId?: string,
) {
  const id = conversationId || (await client.createConversation("错题分析")).id;
  const uploaded = await client.uploadPhoto(id, {
    mimeType: photo.mimeType,
    data: photo.data,
  });
  const { analysis } = await client.createMistakeAnalysis({
    conversationId: id,
    photoId: uploaded.id,
    request,
  });
  return { conversationId: id, analysis };
}
