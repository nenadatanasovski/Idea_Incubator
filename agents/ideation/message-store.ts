import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../../database/db.js';
import {
  IdeationMessage,
  IdeationMessageRow,
  MessageRole,
  ButtonOption,
  FormDefinition,
  WebSearchResult,
} from '../../types/ideation.js';
import { mapMessageRowToMessage } from '../../utils/ideation-mappers.js';

/**
 * MESSAGE STORE
 *
 * Stores and retrieves conversation messages.
 */

export interface AddMessageParams {
  sessionId: string;
  role: MessageRole;
  content: string;
  buttonsShown?: ButtonOption[] | null;
  buttonClicked?: string | null;
  formShown?: FormDefinition | null;
  formResponse?: Record<string, unknown> | null;
  webSearchResults?: WebSearchResult[] | null;
  tokenCount?: number;
}

/**
 * Helper to convert db result to objects
 */
function resultsToObjects(result: { columns: string[]; values: unknown[][] }): Record<string, unknown>[] {
  const columns = result.columns;
  return result.values.map(values => {
    return columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>);
  });
}

function rowToObject(result: { columns: string[]; values: unknown[][] }): Record<string, unknown> {
  if (result.values.length === 0) {
    return {};
  }
  return resultsToObjects(result)[0];
}

export class MessageStore {
  /**
   * Add a message to the conversation.
   */
  async add(params: AddMessageParams): Promise<IdeationMessage> {
    const db = await getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO ideation_messages (
        id, session_id, role, content,
        buttons_shown, button_clicked,
        form_shown, form_response,
        web_search_results, token_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      params.sessionId,
      params.role,
      params.content,
      params.buttonsShown ? JSON.stringify(params.buttonsShown) : null,
      params.buttonClicked || null,
      params.formShown ? JSON.stringify(params.formShown) : null,
      params.formResponse ? JSON.stringify(params.formResponse) : null,
      params.webSearchResults ? JSON.stringify(params.webSearchResults) : null,
      params.tokenCount || 0,
      now,
    ]);

    await saveDb();

    return this.get(id) as Promise<IdeationMessage>;
  }

  /**
   * Get a message by ID.
   */
  async get(messageId: string): Promise<IdeationMessage | null> {
    const db = await getDb();
    const results = db.exec(`
      SELECT * FROM ideation_messages WHERE id = ?
    `, [messageId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = rowToObject(results[0]) as IdeationMessageRow;
    return mapMessageRowToMessage(row);
  }

  /**
   * Get all messages for a session.
   */
  async getBySession(sessionId: string): Promise<IdeationMessage[]> {
    const db = await getDb();
    const results = db.exec(`
      SELECT * FROM ideation_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `, [sessionId]);

    if (results.length === 0) return [];

    return resultsToObjects(results[0]).map(row =>
      mapMessageRowToMessage(row as IdeationMessageRow)
    );
  }

  /**
   * Get recent messages for a session (for context window).
   */
  async getRecent(sessionId: string, limit: number = 50): Promise<IdeationMessage[]> {
    const db = await getDb();
    const results = db.exec(`
      SELECT * FROM (
        SELECT * FROM ideation_messages
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      ) ORDER BY created_at ASC
    `, [sessionId, limit]);

    if (results.length === 0) return [];

    return resultsToObjects(results[0]).map(row =>
      mapMessageRowToMessage(row as IdeationMessageRow)
    );
  }

  /**
   * Update message with button click.
   */
  async recordButtonClick(messageId: string, buttonId: string): Promise<void> {
    const db = await getDb();

    db.run(`
      UPDATE ideation_messages
      SET button_clicked = ?
      WHERE id = ?
    `, [buttonId, messageId]);

    await saveDb();
  }

  /**
   * Update message with form response.
   */
  async recordFormResponse(messageId: string, response: Record<string, unknown>): Promise<void> {
    const db = await getDb();

    db.run(`
      UPDATE ideation_messages
      SET form_response = ?
      WHERE id = ?
    `, [JSON.stringify(response), messageId]);

    await saveDb();
  }

  /**
   * Update message content (for async artifact edit completion).
   */
  async update(messageId: string, updates: { content?: string }): Promise<void> {
    const db = await getDb();

    if (updates.content) {
      db.run(`
        UPDATE ideation_messages
        SET content = ?
        WHERE id = ?
      `, [updates.content, messageId]);

      await saveDb();
    }
  }

  /**
   * Get total token count for a session.
   */
  async getTotalTokens(sessionId: string): Promise<number> {
    const db = await getDb();
    const results = db.exec(`
      SELECT COALESCE(SUM(token_count), 0) as total
      FROM ideation_messages
      WHERE session_id = ?
    `, [sessionId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return 0;
    }

    return Number(results[0].values[0][0]) || 0;
  }

  /**
   * Count messages in a session.
   */
  async count(sessionId: string): Promise<number> {
    const db = await getDb();
    const results = db.exec(`
      SELECT COUNT(*) as count
      FROM ideation_messages
      WHERE session_id = ?
    `, [sessionId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return 0;
    }

    return Number(results[0].values[0][0]) || 0;
  }

  /**
   * Get messages since a specific message (for partial handoff).
   */
  async getSince(sessionId: string, sinceMessageId: string): Promise<IdeationMessage[]> {
    const db = await getDb();

    // Get the created_at of the reference message
    const refResults = db.exec(`
      SELECT created_at FROM ideation_messages WHERE id = ?
    `, [sinceMessageId]);

    if (refResults.length === 0 || refResults[0].values.length === 0) {
      return [];
    }

    const refCreatedAt = refResults[0].values[0][0] as string;

    const results = db.exec(`
      SELECT * FROM ideation_messages
      WHERE session_id = ? AND created_at > ?
      ORDER BY created_at ASC
    `, [sessionId, refCreatedAt]);

    if (results.length === 0) return [];

    return resultsToObjects(results[0]).map(row =>
      mapMessageRowToMessage(row as IdeationMessageRow)
    );
  }

  /**
   * Delete a message and all messages after it (for message editing).
   * Returns the number of deleted messages.
   */
  async deleteFromMessage(sessionId: string, messageId: string): Promise<number> {
    const db = await getDb();

    // Get the created_at of the reference message
    const refResults = db.exec(`
      SELECT created_at FROM ideation_messages WHERE id = ?
    `, [messageId]);

    if (refResults.length === 0 || refResults[0].values.length === 0) {
      return 0;
    }

    const refCreatedAt = refResults[0].values[0][0] as string;

    // Count messages to delete (including the reference message)
    const countResults = db.exec(`
      SELECT COUNT(*) as count
      FROM ideation_messages
      WHERE session_id = ? AND created_at >= ?
    `, [sessionId, refCreatedAt]);

    const deleteCount = countResults.length > 0 ? Number(countResults[0].values[0][0]) || 0 : 0;

    // Delete the messages (including the reference message and all after)
    db.run(`
      DELETE FROM ideation_messages
      WHERE session_id = ? AND created_at >= ?
    `, [sessionId, refCreatedAt]);

    await saveDb();

    return deleteCount;
  }

  /**
   * Delete messages older than a certain message (for cleanup after handoff).
   */
  async deleteOlderThan(sessionId: string, keepFromMessageId: string): Promise<number> {
    const db = await getDb();

    // Get the created_at of the reference message
    const refResults = db.exec(`
      SELECT created_at FROM ideation_messages WHERE id = ?
    `, [keepFromMessageId]);

    if (refResults.length === 0 || refResults[0].values.length === 0) {
      return 0;
    }

    const refCreatedAt = refResults[0].values[0][0] as string;

    // Count messages to delete
    const countResults = db.exec(`
      SELECT COUNT(*) as count
      FROM ideation_messages
      WHERE session_id = ? AND created_at < ?
    `, [sessionId, refCreatedAt]);

    const deleteCount = countResults.length > 0 ? Number(countResults[0].values[0][0]) || 0 : 0;

    // Delete the messages
    db.run(`
      DELETE FROM ideation_messages
      WHERE session_id = ? AND created_at < ?
    `, [sessionId, refCreatedAt]);

    await saveDb();

    return deleteCount;
  }
}

// Singleton instance
export const messageStore = new MessageStore();
