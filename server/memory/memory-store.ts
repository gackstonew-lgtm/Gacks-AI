import { db } from '../db/index.js'
import type { MemoryCategory, MemoryRecord } from '../types.js'

export class MemoryStore {
  private workingMemory: Map<string, unknown> = new Map()

  // --- Working Memory (Session/Active Turn) ---
  public setWorking(key: string, value: unknown) {
    this.workingMemory.set(key, value)
  }

  public getWorking<T = unknown>(key: string): T | undefined {
    return this.workingMemory.get(key) as T | undefined
  }

  public clearWorking() {
    this.workingMemory.clear()
  }

  // --- Long-Term Memory (Episodic, Semantic, Procedural, Multi-Tenant Scoped) ---
  public recordMemory({
    userId = 'default',
    workspaceId = 'default-workspace',
    scope = 'workspace',
    category,
    content,
    importance = 3,
    confidence = 0.9,
    source,
    tags = [],
    metadata,
  }: {
    userId?: string
    workspaceId?: string
    scope?: import('../types.js').MemoryScope
    category: MemoryCategory
    content: string
    importance?: number
    confidence?: number
    source?: string
    tags?: string[]
    metadata?: Record<string, unknown>
  }): MemoryRecord | null {
    // Memory safety check: reject sensitive credentials
    if (this.containsSensitiveData(content)) {
      console.warn('[JAVIS Memory] Rejected memory containing potential sensitive credentials.')
      return null
    }

    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = Date.now()

    const record: MemoryRecord = {
      id,
      userId,
      workspaceId,
      scope,
      category,
      content: content.trim(),
      importance: Math.max(1, Math.min(5, importance)),
      confidence: Math.max(0, Math.min(1, confidence)),
      source,
      tags,
      metadata,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
    }

    db.saveMemory(record)
    return record
  }

  /**
   * Hybrid Memory Retrieval with Workspace / Tenant Isolation:
   * Rank candidate memories based on keyword similarity, category relevance,
   * recency weight, importance rating, and tenant boundaries.
   */
  public searchMemories({
    userId = 'default',
    workspaceId,
    query,
    category,
    limit = 5,
  }: {
    userId?: string
    workspaceId?: string
    query: string
    category?: MemoryCategory
    limit?: number
  }): MemoryRecord[] {
    const all = db.getAllMemories(userId)
    const tokens = this.tokenize(query)
    const now = Date.now()

    const scored = all
      .filter((m) => {
        // Enforce tenant/workspace isolation if workspaceId is specified
        if (workspaceId && m.workspaceId && m.workspaceId !== workspaceId) {
          return false
        }
        return category ? m.category === category : true
      })
      .map((mem) => {
        let matchScore = 0
        const memTokens = this.tokenize(mem.content + ' ' + mem.tags.join(' '))

        for (const t of tokens) {
          if (memTokens.has(t)) {
            matchScore += 1.0
          }
        }

        // Normalize match score against query token count
        const similarity = tokens.size > 0 ? matchScore / tokens.size : 0

        // Recency factor (decays over 30 days)
        const ageHours = (now - mem.updatedAt) / (1000 * 60 * 60)
        const recencyWeight = Math.max(0, 1 - ageHours / (30 * 24)) * 0.3

        // Importance factor (1 to 5 scale -> 0 to 0.5)
        const importanceWeight = (mem.importance / 5) * 0.5

        // Combined hybrid score
        const totalScore = similarity * 1.5 + recencyWeight + importanceWeight

        return { mem, totalScore }
      })
      .sort((a, b) => b.totalScore - a.totalScore)

    // Touch top memories to update accessed counts
    const top = scored.slice(0, limit).map((s) => s.mem)
    for (const m of top) {
      m.accessedAt = now
      m.accessCount += 1
      db.saveMemory(m)
    }

    return top
  }

  public deleteMemory(id: string): boolean {
    return db.deleteMemory(id)
  }

  private tokenize(str: string): Set<string> {
    return new Set(
      str
        .toLowerCase()
        .replace(/[^a-z0-9_\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    )
  }

  private containsSensitiveData(text: string): boolean {
    const lower = text.toLowerCase()
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9_-]{20,}/,
      /ghp_[a-zA-Z0-9]{20,}/,
      /ai_za[a-zA-Z0-9_-]{30,}/,
      /bearer\s+[a-zA-Z0-9_.-]{25,}/,
      /password\s*[:=]\s*['"]?[^\s'"]{4,}/,
      /private_key/,
      /-----begin [a-z ]+ private key-----/,
    ]
    return sensitivePatterns.some((pattern) => pattern.test(lower))
  }
}

export const memoryStore = new MemoryStore()
