export type ChatMessageRole = "user" | "assistant";
export type ChatMessageStatus = "streaming" | "done" | "error";

export interface ChatMessage {
  id: string;
  sessionId: string;
  /** Each provider has its own copies of user messages — no more shared "" bucket. */
  providerId: string;
  role: ChatMessageRole;
  content: string;
  status: ChatMessageStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  providerIds: string[];
  prompt: string;
  /** Optional per-session system prompt sent to the LLM before conversation history. */
  systemPrompt: string;
  /** Derived from message count — not stored in DB, computed at load time. */
  turns: number;
}

export type ProviderHistoryMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/** Raw shape returned by the Tauri backend for chat sessions. */
export interface DbChatSessionRecord {
  id: string;
  title: string;
  provider_ids: string[];
  prompt: string;
  system_prompt: string;
  /** Derived from message COUNT at read time. */
  turns: number;
  created_at: number;
  updated_at: number;
}

/** Raw shape returned by the Tauri backend for chat messages. */
export interface DbChatMessageRecord {
  id: string;
  session_id: string;
  provider_id: string;
  role: string;
  content: string;
  status: string;
  created_at: number;
  updated_at: number;
}

/** Full-text search result from the backend. */
export interface MessageSearchResult {
  message_id: string;
  session_id: string;
  session_title: string;
  snippet: string;
  created_at: number;
}
