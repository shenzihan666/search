import { invoke } from "@tauri-apps/api/core";
import type {
  ChatMessage,
  ChatMessageStatus,
  DbChatMessageRecord,
  DbChatSessionColumnRecord,
  DbChatSessionRecord,
  MessageSearchResult,
} from "../types/chat";
import { withTimeout } from "./utils";

export const ChatDb = {
  listSessions(): Promise<DbChatSessionRecord[]> {
    return withTimeout(
      invoke("list_chat_sessions"),
      10_000,
      "list_chat_sessions",
    );
  },

  createSession(
    id: string,
    title: string,
    providerIds: string[],
  ): Promise<DbChatSessionRecord> {
    return withTimeout(
      invoke("create_chat_session", { id, title, providerIds }),
      10_000,
      "create_chat_session",
    );
  },

  renameSession(id: string, title: string): Promise<DbChatSessionRecord> {
    return withTimeout(
      invoke("rename_chat_session", { id, title }),
      10_000,
      "rename_chat_session",
    );
  },

  saveSessionState(
    id: string,
    providerIds: string[],
    prompt: string,
  ): Promise<DbChatSessionRecord> {
    return withTimeout(
      invoke("save_chat_session_state", { id, providerIds, prompt }),
      15_000,
      "save_chat_session_state",
    );
  },

  setSystemPrompt(
    id: string,
    systemPrompt: string,
  ): Promise<DbChatSessionRecord> {
    return withTimeout(
      invoke("set_session_system_prompt", { id, systemPrompt }),
      10_000,
      "set_session_system_prompt",
    );
  },

  deleteSession(id: string): Promise<void> {
    return withTimeout(
      invoke("delete_chat_session", { id }),
      10_000,
      "delete_chat_session",
    );
  },

  listSessionColumns(sessionId: string): Promise<DbChatSessionColumnRecord[]> {
    return withTimeout(
      invoke("list_chat_session_columns", { sessionId }),
      10_000,
      "list_chat_session_columns",
    );
  },

  setSessionColumnProvider(
    columnId: string,
    providerId: string,
  ): Promise<DbChatSessionColumnRecord> {
    return withTimeout(
      invoke("set_chat_session_column_provider", { columnId, providerId }),
      10_000,
      "set_chat_session_column_provider",
    );
  },

  listMessages(
    sessionId: string,
    limit = 0,
    offset = 0,
  ): Promise<DbChatMessageRecord[]> {
    return withTimeout(
      invoke("list_chat_messages", { sessionId, limit, offset }),
      10_000,
      "list_chat_messages",
    );
  },

  countMessages(sessionId: string): Promise<number> {
    return withTimeout(
      invoke("count_chat_messages", { sessionId }),
      10_000,
      "count_chat_messages",
    );
  },

  createMessage(msg: ChatMessage): Promise<DbChatMessageRecord> {
    return withTimeout(
      invoke("create_chat_message", {
        id: msg.id,
        sessionId: msg.sessionId,
        columnId: msg.columnId,
        providerId: msg.providerId,
        role: msg.role,
        content: msg.content,
        status: msg.status,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      }),
      10_000,
      "create_chat_message",
    );
  },

  updateMessage(
    id: string,
    content: string,
    status: ChatMessageStatus,
  ): Promise<DbChatMessageRecord> {
    return withTimeout(
      invoke("update_chat_message", { id, content, status }),
      10_000,
      "update_chat_message",
    );
  },

  deleteMessage(id: string): Promise<void> {
    return withTimeout(
      invoke("delete_chat_message", { id }),
      10_000,
      "delete_chat_message",
    );
  },

  searchMessages(query: string, limit = 20): Promise<MessageSearchResult[]> {
    return withTimeout(
      invoke("search_chat_messages", { query, limit }),
      10_000,
      "search_chat_messages",
    );
  },

  exportSession(sessionId: string): Promise<DbChatMessageRecord[]> {
    return withTimeout(
      invoke("export_session_messages", { sessionId }),
      15_000,
      "export_session_messages",
    );
  },
};
