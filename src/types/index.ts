// ============================================================
// LegacyLens — Shared TypeScript Types
// ============================================================

// Project Status
export type ProjectStatus = 'pending' | 'indexing' | 'complete' | 'failed';

// File Risk Levels
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Subscription Tiers
export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';

// User Roles in Projects
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

// Transcription Status
export type TranscriptionStatus = 'pending' | 'processing' | 'complete' | 'failed';

// Architecture Graph Types
export interface GraphNode {
  id: string;
  label: string;
  filePath: string;
  type: 'file' | 'folder' | 'module';
  riskLevel: RiskLevel;
  dependentsCount: number;
  dependenciesCount: number;
  linesOfCode: number;
  isEntryPoint: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'export' | 'extends' | 'implements';
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Tech Stack Detection
export interface TechStack {
  languages: { name: string; percentage: number; files: number }[];
  frameworks: string[];
  buildTools: string[];
  testingTools: string[];
  databases: string[];
}

// Q&A Context File
export interface ContextFile {
  path: string;
  snippet: string;
  score: number;
  lineStart?: number;
  lineEnd?: number;
}

// Meeting Insights
export interface MeetingInsights {
  decisions: string[];
  actionItems: string[];
  risks: string[];
  technicalDiscussions: { topic: string; timestamp: number; summary: string }[];
}

// Parsed File Structure
export interface ParsedFunction {
  name: string;
  params: string[];
  lineStart: number;
  lineEnd: number;
  isExported: boolean;
}

export interface ParsedClass {
  name: string;
  methods: string[];
  lineStart: number;
  lineEnd: number;
  isExported: boolean;
}

export interface ParsedImport {
  module: string;
  items: string[];
  isDefault: boolean;
}

export interface ParsedFile {
  path: string;
  content: string;
  linesOfCode: number;
  functions: ParsedFunction[];
  classes: ParsedClass[];
  imports: ParsedImport[];
  exports: string[];
}

// Search Results
export interface SearchResult {
  filePath: string;
  content: string;
  score: number;
  type: 'code' | 'meeting';
  metadata?: Record<string, unknown>;
}

// Streaming Q&A Response
export interface QAStreamChunk {
  chunk: string;
  done: boolean;
  contextFiles?: ContextFile[];
}

// Board / Kanban Types
export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  cards: BoardCard[];
}

export interface BoardCard {
  id: string;
  title: string;
  description?: string;
  position: number;
  linkedFiles: string[];
  linkedQaIds: string[];
  assignedTo?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  timeSpentMinutes: number;
}

// API Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
