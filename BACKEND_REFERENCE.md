# Autozonex Connect: Backend API Reference (wwebjs-api)

This document outlines the core architecture and workflow for interacting with the WhatsApp engine.

## 1. Authentication & Security
*   **API Key**: Every request must include the `x-api-key` header (defined in `.env`).
*   **Multi-Session**: Use unique `sessionId` strings to isolate different WhatsApp accounts (e.g., one per Organization).

## 2. Core Workflow

### Phase A: Setup
1.  **Start Session**: `GET /session/start/:sessionId`
2.  **Monitor QR**: `GET /session/status/:sessionId` -> looking for `QR_SENT`.
3.  **Get QR Image**: `GET /session/qr/:sessionId/image`
4.  **Wait for Ready**: Wait for status `CONNECTED` and the `ready` webhook event.

### Phase B: Incoming Data (Webhook)
The engine POSTs to your configured `BASE_WEBHOOK_URL`.
*   **Event: `message`**: New incoming message. Use this to populate your **Unified Inbox**.
*   **Event: `authenticated`**: User successfully scanned QR.
*   **Event: `disconnected`**: User logged out from phone. Trigger an alert in the Dashboard.

### Phase C: Outgoing Data (Actions)
*   **Send Text**: `POST /client/sendMessage/:sessionId`
    *   Body: `{ "chatId": "123456789@c.us", "content": "Hello!" }`
*   **Send Media**: Use the same endpoint but include media data or URLs.

## 3. Top Tier APIs

| Feature | Endpoint | Method | Key Parameter |
| :--- | :--- | :--- | :--- |
| **Session Control** | `/session/terminate/:sessionId` | GET | Stops and deletes session data. |
| **Messaging** | `/client/sendMessage/:sessionId` | POST | `chatId`, `content` |
| **Inbox Loading** | `/chat/fetchMessages/:sessionId` | POST | `chatId`, `limit` |
| **CRM Sync** | `/client/getContacts/:sessionId` | GET | Returns all synced contacts. |
| **Group Control** | `/groupChat/addParticipants/:sessionId` | POST | `chatId`, `participants[]` |

## 4. Pro Tips for Autozonex Connect
1.  **Background Sync**: Don't wait for a user to open the dashboard to start a session. Use `AUTO_START_SESSIONS=TRUE` in the engine to keep accounts online.
2.  **Webhooks First**: Treat your local database as the "Source of Truth" for messages. When a webhook hits, save to DB, then update the UI via WebSockets or TanStack Query.
3.  **Rate Limiting**: WhatsApp is sensitive. When building the **Campaign Module**, implement a delay between messages (e.g., 5-10 seconds) to prevent phone bans.
