# AutoZoneX Connect — Changelog & Release Notes

## [v2.1.0-LTS] — 2026-09-13
**Branch**: `release/v2.1.0-lts` | **Status**: Production Long-Term Support (LTS)

### 🌟 Major Highlights & Production Features

#### 1. Inbound Webhook for Instant Ad Lead Engagement
- **Dedicated Multi-Tenant Endpoints**:
  - Direct Token Endpoint: `POST /api/webhooks/inbound/[token]`
  - Generic Authenticated Endpoint: `POST /api/webhooks/inbound` (accepts `x-api-key`, `x-webhook-token`, or `?token=...`)
  - Supports standard JSON payloads and HTML form submissions (`application/x-www-form-urlencoded` / `multipart/form-data`) from Meta Lead Ads, Google Ads, Zapier, Make.com, and Webflow forms.
- **Instant Autonomous Lead Engagement**:
  - Normalizes international phone formats into valid WhatsApp JIDs.
  - Automatically resolves or registers CRM Contacts and Pipeline Deals.
  - Automatically runs Balanced Round-Robin Assignment to distribute leads to sales reps.
  - Auto-attaches tags based on ad platform, campaign name, and payload attributes.
  - Sends an instant, warm, human-like WhatsApp welcome message referencing the lead's name, campaign, and specific inquiry.
  - Auto-dispatches requested brochures/PDF documents over WhatsApp simultaneously.
  - Automatically queues the lead for 120-second debounced autonomous AI profiling.
- **CRM Webhook Command Center**:
  - Integrated "Ad Lead Webhook" tab in `/dashboard/crm` with copyable URLs, secret token manager, and live WhatsApp session status.
  - Interactive Lead Simulator form for 1-click live testing directly from the web UI.

#### 2. Executive Analytics & Real-Time KPI Overview Dashboard (`/dashboard`)
- **Executive Command Center**:
  - 4 High-impact KPI cards: Active Contacts, Pipeline Deals, Hot Leads (High-Intent), and WhatsApp 24h Traffic.
  - Urgent Human Escalation Banner: Real-time alerts for customer inquiries requiring manual agent intervention.
  - Visual Pipeline Progression Funnel: Deal distribution across customized pipeline stages with relative percentage indicators.
  - Lead Intent Breakdown Matrix: Proportions of HIGH, MEDIUM, LOW, and UNQUALIFIED leads with average lead qualification score.
  - Live Real-Time Activity Feed: Audit log of inbound messages, outbound AI replies, auto-dispatches, and round-robin assignments.
  - WhatsApp Session Health Monitor & Quick Shortcuts.

#### 3. WhatsApp Voice Note Audio Transcription (Groq Whisper `whisper-large-v3`)
- **Audio Webhook Interception**: Detects incoming voice notes (`ptt`, `audio`, `audio/ogg`) in the webhook pipeline.
- **Engine Media Fetcher**: Implemented `downloadMessageMedia` in OpenWA engine adapter to stream audio binaries directly from the session.
- **Groq Whisper Transcription**: Calls `whisper-large-v3` with multipart form-data and Cloudflare-safe headers.
- **Holistic AI Integration**: Transcribed speech is recorded in the CRM activity timeline, fed to the AI auto-reply engine, and submitted into the 120-second debounced autonomous lead profiler.

#### 4. Knowledge Base Media & Brochure Auto-Dispatch
- **Media Schema Migration**: Added `mediaUrl` column to `knowledge_chunks` and `knowledge_sources`.
- **Persistent Disk Uploads**: Uploaded PDF/DOCX files are persisted to `/public/uploads/kb/` with direct download URLs assigned to chunks.
- **Knowledge Base UI**: Added optional Brochure/Media URL field when creating FAQ entries, with visual auto-dispatch badges on documents and FAQs.
- **Autonomous Auto-Dispatch**: When a customer on WhatsApp asks for a brochure, catalog, price sheet, or floor plan, the system automatically detects the request and dispatches the PDF document over WhatsApp alongside the AI conversational reply.

#### 5. Autonomous Balanced Round-Robin Lead Assignment
- **Workload-Aware Distribution**: Algorithm calculates active lead volume across all organization agents and admins (`ORG_ADMIN`, `AGENT`) and automatically assigns incoming leads to the rep with the lowest current workload.
- **Zero-Touch Triage**: Applied automatically across inbound ad webhooks, incoming WhatsApp messages from new contacts, and unassigned leads.

---

## [v2.0.0-LTS] — 2026-09-13
**Branch**: `release/v2.0.0-lts` | **Status**: Production Long-Term Support (LTS)

### 🌟 Major Highlights & Architecture Upgrades

#### 1. Autonomous Multi-Agent AI Intelligence Engine
- **4-Tier Specialized Agent Architecture**:
  - **Lead Profiler Agent**: Evaluates conversation history against BANT qualification criteria (Budget, Authority, Need, Timeline), detects sentiment (ENTHUSIASTIC, WARM, NEUTRAL, COLD, FRUSTRATED), scores buying intent (0–100), and recommends deal stage progression.
  - **Follow-Up Strategist Agent**: Calculates optimal re-engagement delays (hours/days) and formulates strategic communication goals based on prior lead behavior and sales notes.
  - **Copywriter Agent**: Drafts consultative, hyper-personalized follow-up messages using organization knowledge base context and lead pain points.
  - **Supervisor Arbiter**: Enforces guardrails, evaluates weighted confidence thresholds, detects negative/frustrated sentiment, and auto-escalates critical situations to human sales reps.
- **Autonomous vs. Approval Modes**: Organizations can toggle between full hands-free autonomous execution or review-before-send approval queues.

#### 2. 120-Second Conversational Burst Debouncing
- **Debounced Burst Aggregation (`lead-analysis-queue.ts`)**: Incoming WhatsApp messages reset an active 120-second silence timer before triggering multi-agent intelligence.
- Eliminates premature lead profiling and ensures multi-message user bursts are analyzed holistically as a single cohesive conversation.

#### 3. Authentic Human WhatsApp Chat Persona & Mobile-Friendly Formatting
- **Zero Repetitive Introductions**: Completely eliminated robotic `"I am Riya from [Company]"` opening scripts on ongoing conversations. The AI greets naturally like an authentic human team member and directly addresses customer questions.
- **Strict Table Prohibition**: Forbids markdown tables (`| Col 1 | Col 2 |`) that break across mobile screens.
- **Runtime Table-to-WhatsApp Card Converter (`convertMarkdownTablesToWhatsApp`)**: Fail-safe parser that transforms any tabular data into clean, bolded, mobile-friendly bullet cards (`*Title*` + `• *Key*: Value`).

#### 4. Cluster-Safe Queue Workers & Atomic State Locking
- **Distributed PM2 Cluster Resilience**: Upgraded broadcast message and follow-up workers with atomic database claims (`UPDATE ... WHERE status = 'PENDING' RETURNING id`).
- Prevents race conditions, dual dispatches, and double-sends in multi-core / multi-process production deployments.

#### 5. Dynamic Audience Segmentation & Advanced Variables for Campaigns
- **Audience Targeting Filters**: Filter campaign recipient lists by **Deals Pipeline Stage** and **Minimum AI Lead Score** (e.g. Hot Leads 75+, Qualified 50+).
- **Expanded Template Interpolation**: Dynamic variables supported across campaigns:
  - `{{firstName}}`, `{{phone}}`, `{{company}}`, `{{leadScore}}`, `{{stage}}`, `{{buyingIntent}}`.
- **Interactive Builder**: 1-click variable pill insertion and real-time live message preview.

#### 6. Autonomous Stagnant Deal Re-Activator & Aging Indicators
- **Autonomous Stagnant Deal Worker (`stagnant-deal-worker.ts`)**: Background cron worker scanning every 60 seconds for deals inactive for >48 hours in active pipeline stages.
- **Cluster-Safe Atomic Locking**: Employs conditional atomic update claiming to prevent multiple cluster instances from duplicate re-engagement.
- **Context-Aware Multi-Agent Re-Activation**: Invokes the Follow-up Strategist & Copywriter Agent to synthesize warm, non-pushy, human-like check-in messages formatted for WhatsApp without markdown tables.
- **Anti-Spam & Anti-Fatigue Guardrails**: Automatically suppresses contacts messaged within the last 48 hours or contacts who have received 3 consecutive re-activations without replying.
- **Autonomous vs. Approval Execution**: Auto-sends via active WhatsApp session in Autonomous mode; stages 1-click review proposals in Co-Pilot mode.
- **Kanban Toolbar 1-Click Action & Filter**: Visual badges, "Filter Inactive (>48h)" toggle, and an instant "Auto-Reactivate Stagnant" button directly in the pipeline board.

#### 7. Modern UI/UX & Enterprise Cloud Positioning
- **Modern Landing Page**: Enterprise-focused positioning highlighting native WhatsApp CRM, AI Multi-Agent automation, and unified team inbox.
- **Glassmorphic Authentication**: Redesigned `/login` and `/register` portals with sleek glassmorphic card styling and responsive mobile layouts.

---

## [v1.0.0-LTS] — Earlier Release
**Branch**: `main`

- Multi-tenant architecture with organization-level data isolation.
- OpenWA external WhatsApp engine integration (QR scan, session lifecycle, pairing code).
- Unified multi-agent Inbox for real-time customer chats (text, media, audio, documents).
- Visual Kanban Sales Pipeline with drag-and-drop deal management.
- Broadcast Campaign Manager with delay scheduling and queueing.
- Multi-provider AI Assistant configuration (Groq & OpenRouter support).
- Knowledge Base indexing for PDFs, Markdown, and custom documents.
