# GEMINI.md

# Autozonex Connect

AI-Powered WhatsApp CRM, Campaign Automation & Customer Engagement Platform

---

## Project Mission

Build a production-grade multi-tenant SaaS platform that enables businesses to:

* Connect multiple WhatsApp accounts
* Manage customer conversations
* Run bulk messaging campaigns
* Manage CRM and leads
* Automate workflows
* Configure AI-powered auto replies
* Integrate external software using webhooks
* Operate entirely through a modern web interface

The platform must be self-hostable using Docker.

The platform must be designed as a long-term SaaS product and not as a simple WhatsApp sender.

---

# Development Rules

## Critical Rule

Act as a Senior Software Architect.

Never rush implementation.

Before implementing any feature:

1. Analyze requirements
2. Check existing architecture
3. Design scalable solution
4. Implement
5. Refactor if needed
6. Create reusable abstractions

Avoid shortcuts.

Prefer maintainability over speed.

---

# Core Architecture

## Stack

Frontend:

* Next.js 15
* App Router
* TypeScript
* TailwindCSS
* Shadcn UI
* TanStack Table
* TanStack Query

Backend:

* Next.js Route Handlers
* Server Actions
* TypeScript

Database:

* SQLite initially
* Drizzle ORM (or Prisma if explicitly chosen later)
* Architecture must remain PostgreSQL-compatible

Runtime:

* Docker

Storage:

* Docker Volume
* SQLite file stored in mounted volume

Authentication:

* Local Authentication
* Email + Password
* JWT Session Strategy

Multi-Tenancy:

* Required

AI:

* External AI Providers
* Provider configurable
* Organization-specific AI settings

WhatsApp:

* External WhatsApp Engine
* Communicates through HTTP API
* Base URL from environment variables

---

# Environment Variables

Never hardcode values.

Required:

WHATSAPP_ENGINE_URL=

JWT_SECRET=

DATABASE_URL=

AI_PROVIDER=

AI_API_KEY=

APP_URL=

UPLOAD_PATH=

All external services must be configurable.

---

# Multi-Tenant Architecture

Every resource belongs to an organization.

Organization owns:

* Users
* WhatsApp Sessions
* Contacts
* Leads
* Campaigns
* AI Configuration
* Knowledge Base
* Workflows
* Webhooks

Never create global business data.

All queries must be organization-scoped.

Data isolation is mandatory.

---

# Database Principles

Design database for future PostgreSQL migration.

Avoid SQLite-specific logic.

Use:

* UUIDs
* Foreign keys
* Soft deletes
* CreatedAt
* UpdatedAt

Every major entity must include:

* id
* organizationId
* createdAt
* updatedAt

---

# Core Modules

## Module 1

Authentication

Features:

* Register
* Login
* Logout
* Password Reset
* Session Management

Roles:

* Super Admin
* Organization Admin
* Agent

Implement RBAC from day one.

---

## Module 2

Organization Management

Features:

* Create organization
* Invite members
* Manage users
* Manage permissions

---

## Module 3

WhatsApp Session Management

Uses external WhatsApp Engine.

Do not implement WhatsApp logic internally.

Consume API through a dedicated service layer.

Features:

* Create session
* Start session
* Stop session
* Restart session
* Terminate session
* QR Login
* Pairing Code Login
* Session Monitoring
* Session Health

---

## Module 4

Unified Inbox

Features:

* Chat list
* Message history
* Search chats
* Search contacts

Message Types:

* Text
* Image
* Video
* Audio
* Document

Actions:

* Reply
* Forward
* Star
* React
* Delete

---

## Module 5

CRM

Entities:

Contact

Lead

Pipeline

Tag

Label

Note

Activity

Features:

* Contact management
* Lead management
* Pipeline management
* Contact timeline
* Lead assignment

---

## Module 6

Campaign Management

Features:

* Campaign Builder
* Audience Selection
* Scheduling
* Recurring Campaigns
* Message Variables

Examples:

{{firstName}}

{{company}}

{{expiryDate}}

---

## Module 7

Broadcast Engine

Must be queue based.

Never send messages directly from request handlers.

Architecture:

Campaign

→ Queue

→ Worker

→ WhatsApp Service

Features:

* Queue
* Retry
* Delays
* Batch Processing
* Status Tracking

---

## Module 8

AI Assistant

Organization-specific AI.

Every organization can have:

* Different model
* Different prompt
* Different knowledge base

Features:

* AI Auto Reply
* AI Suggested Replies
* Conversation Summary
* Lead Qualification

Human handoff required.

---

## Module 9

Knowledge Base

Supported Sources:

* PDF
* DOCX
* TXT
* Markdown
* URLs
* FAQ Entries

Features:

* Upload
* Index
* Search
* Retrieval

Knowledge bases belong to organizations.

---

## Module 10

Workflow Automation

Visual workflow engine.

Triggers:

* Message Received
* Lead Created
* Lead Updated
* Campaign Completed

Conditions:

* Contains Text
* Has Tag
* Has Label
* Pipeline Stage

Actions:

* Send Message
* Add Tag
* Add Label
* Assign User
* Trigger Webhook

Build workflow engine using extensible node architecture.

---

## Module 11

Webhook Engine

Incoming Webhooks:

Allow external software to create:

* Leads
* Contacts
* Events

Outgoing Webhooks:

Emit:

* Message Received
* Lead Created
* Lead Updated
* Campaign Completed
* Campaign Failed

Implement retry mechanism.

---

## Module 12

Analytics

Provide dashboards for:

Campaigns

CRM

Agents

Organizations

Metrics:

* Messages Sent
* Messages Failed
* Leads Created
* Conversion Rates
* Agent Activity

---

# UI Requirements

Design must feel modern SaaS.

Reference:

* HubSpot
* Intercom
* Close CRM
* Respond.io

Requirements:

* Responsive
* Dark Mode
* Light Mode
* Command Palette
* Global Search
* Sidebar Navigation

---

# Folder Structure

Use feature-first architecture.

Example:

src/

features/

auth/

crm/

campaigns/

whatsapp/

workflows/

ai/

knowledge-base/

analytics/

shared/

components/

lib/

database/

Avoid massive folders.

Keep features isolated.

---

# Code Quality

Mandatory:

* TypeScript strict mode
* Zod validation
* Error boundaries
* Centralized logging
* Reusable hooks
* Reusable services

No duplicated business logic.

---

# Docker

Must run with:

docker compose up

Services:

* Next.js
* SQLite volume

Persist all data through mounted volumes.

No data loss after restart.

---

# MVP Priority Order

Build in this exact order:

1. Authentication
2. Organizations
3. RBAC
4. WhatsApp Sessions
5. CRM
6. Inbox
7. Campaigns
8. Queue Engine
9. AI Assistant
10. Knowledge Base
11. Workflows
12. Analytics

Do not skip foundations.

Build scalable architecture first, features second.

---

# Success Criteria

The final product should behave like:

A self-hosted alternative to:

* WATI
* Respond.io
* Interakt
* DelightChat

with native CRM, AI automation, campaign management, and WhatsApp communication capabilities.
