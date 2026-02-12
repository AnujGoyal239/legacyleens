// ============================================================
// LegacyLens — Documentation Generator (LLD, HLD, System Design)
// Uses Groq to generate best-in-class documentation from codebase context.
// ============================================================

import Groq from 'groq-sdk';
import { logger } from '../trpc.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const LLM_MODEL = 'llama-3.3-70b-versatile';

function buildProjectContext(context: {
  projectName: string;
  techStack: unknown;
  entryPoints: string[];
  architectureSummary: string;
  fileSummary: string;
  repoDescription?: string | null;
}): string {
  return `
Project: ${context.projectName}
${context.repoDescription ? `Description: ${context.repoDescription}` : ''}

Tech stack: ${JSON.stringify(context.techStack, null, 2)}

Entry points: ${context.entryPoints.join(', ') || 'None detected'}

Architecture / dependency overview:
${context.architectureSummary}

File and module summary:
${context.fileSummary}
`.trim();
}

/**
 * Generate Low Level Design (LLD) document.
 * Focus: module/class/function-level design, data structures, algorithms, interfaces.
 */
export async function generateLLD(context: {
  projectName: string;
  techStack: unknown;
  entryPoints: string[];
  architectureSummary: string;
  fileSummary: string;
  repoDescription?: string | null;
}): Promise<string> {
  const ctx = buildProjectContext(context);
  const prompt = `You are an expert software architect. Generate a **Low Level Design (LLD)** document for this codebase.

Context:
${ctx}

Produce a professional LLD document in markdown with these sections (adapt if needed):
1. **Overview** — Purpose and scope of the system at module level
2. **Module Design** — Key modules, their responsibilities, and interfaces
3. **Data Structures & Types** — Important types, DTOs, and domain models
4. **Key Algorithms & Logic** — Critical flows and business logic
5. **Interfaces & APIs** — Function signatures, request/response shapes
6. **Dependencies** — How modules depend on each other
7. **Configuration** — Env, config files, and tunables

Use clear headings, bullet points, and code blocks where helpful. Be specific to this codebase.`;

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You write precise, professional technical documentation. Output valid markdown only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });
    const text = completion.choices[0]?.message?.content?.trim() || 'Unable to generate LLD.';
    logger.info({ projectName: context.projectName }, 'LLD generated');
    return text;
  } catch (err) {
    logger.error({ err }, 'LLD generation failed');
    throw new Error('Failed to generate LLD');
  }
}

/**
 * Generate High Level Design (HLD) document.
 * Focus: system components, services, data flow, deployment, scaling.
 */
export async function generateHLD(context: {
  projectName: string;
  techStack: unknown;
  entryPoints: string[];
  architectureSummary: string;
  fileSummary: string;
  repoDescription?: string | null;
}): Promise<string> {
  const ctx = buildProjectContext(context);
  const prompt = `You are an expert software architect. Generate a **High Level Design (HLD)** document for this codebase.

Context:
${ctx}

Produce a professional HLD document in markdown with these sections (adapt if needed):
1. **System Overview** — High-level purpose and main capabilities
2. **Architecture Diagram (text/ASCII or mermaid)** — Components and their relationships
3. **Components & Services** — Main building blocks and responsibilities
4. **Data Flow** — How data moves through the system
5. **Technology Choices** — Why these frameworks and tools
6. **Deployment & Runtime** — How the system is run and deployed
7. **Scaling & Performance** — Horizontal/vertical scaling, bottlenecks, caching
8. **Security & Auth** — How auth and security are handled at a high level

Use clear headings, bullet points, and optional mermaid diagrams. Be specific to this codebase.`;

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You write precise, professional technical documentation. Output valid markdown only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });
    const text = completion.choices[0]?.message?.content?.trim() || 'Unable to generate HLD.';
    logger.info({ projectName: context.projectName }, 'HLD generated');
    return text;
  } catch (err) {
    logger.error({ err }, 'HLD generation failed');
    throw new Error('Failed to generate HLD');
  }
}

/**
 * Generate System Design document.
 * Focus: end-to-end system design, trade-offs, scalability, reliability, real-world alignment.
 */
export async function generateSystemDesign(context: {
  projectName: string;
  techStack: unknown;
  entryPoints: string[];
  architectureSummary: string;
  fileSummary: string;
  repoDescription?: string | null;
}): Promise<string> {
  const ctx = buildProjectContext(context);
  const prompt = `You are an expert system designer. Generate a **System Design** document for this codebase that could be used in a senior interview or architecture review.

Context:
${ctx}

Produce a professional System Design document in markdown with these sections (adapt if needed):
1. **Requirements** — Functional and non-functional requirements inferred from the codebase
2. **Capacity Estimation** — Back-of-the-envelope (if applicable): traffic, storage, bandwidth
3. **System APIs** — Main API contracts or entry points
4. **Data Model** — Core entities, storage, and relationships
5. **High-Level Design** — Major components and how they interact (with diagram description or mermaid)
6. **Detailed Design** — Critical paths and components in more detail
7. **Trade-offs** — Design decisions and their pros/cons
8. **Reliability & Fault Tolerance** — Error handling, retries, failure modes
9. **Scaling** — How the system can scale (sharding, replication, caching)
10. **Monitoring & Observability** — Logging, metrics, alerting (inferred or suggested)

Use clear headings, bullet points, and optional mermaid. Be specific to this codebase.`;

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You write precise, professional technical documentation. Output valid markdown only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4500,
    });
    const text = completion.choices[0]?.message?.content?.trim() || 'Unable to generate System Design.';
    logger.info({ projectName: context.projectName }, 'System Design generated');
    return text;
  } catch (err) {
    logger.error({ err }, 'System Design generation failed');
    throw new Error('Failed to generate System Design');
  }
}
