export type ChatMessageRole = "user" | "assistant";
export type ChatMessageStatus = "streaming" | "done" | "error";

export interface ChatMessage {
  id: string;
  sessionId: string;
  columnId: string;
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
  systemPrompt: string;
  turns: number;
}

export interface ChatSessionColumn {
  id: string;
  sessionId: string;
  position: number;
  providerId: string;
  createdAt: number;
  updatedAt: number;
}

export type ProviderHistoryMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface DbChatSessionRecord {
  id: string;
  title: string;
  provider_ids: string[];
  prompt: string;
  system_prompt: string;
  turns: number;
  created_at: number;
  updated_at: number;
}

export interface DbChatSessionColumnRecord {
  id: string;
  session_id: string;
  position: number;
  provider_id: string;
  created_at: number;
  updated_at: number;
}

export interface DbChatMessageRecord {
  id: string;
  session_id: string;
  column_id: string;
  provider_id: string;
  role: string;
  content: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface MessageSearchResult {
  message_id: string;
  session_id: string;
  session_title: string;
  snippet: string;
  created_at: number;
}
