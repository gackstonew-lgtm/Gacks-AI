import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type {
  MemoryRecord,
  EntityRecord,
  EntityRelationRecord,
  AuditEvent,
  MissionState,
} from '../types.js'

export interface DatabaseState {
  users: Record<string, { id: string; name: string; email?: string; settings: Record<string, unknown> }>
  sessions: Record<string, { id: string; userId: string; createdAt: number; lastActiveAt: number }>
  missions: Record<string, MissionState>
  tasks: Array<{ id: string; userId: string; text: string; completed: boolean; createdAt: number }>
  memories: Record<string, MemoryRecord>
  entities: Record<string, EntityRecord>
  relations: Record<string, EntityRelationRecord>
  auditLogs: AuditEvent[]
}

const DEFAULT_STATE: DatabaseState = {
  users: {
    default: {
      id: 'default',
      name: 'Gackstone',
      settings: {
        voiceEngine: 'system',
        riskPolicy: 'standard',
        allowWrites: false,
      },
    },
  },
  sessions: {},
  missions: {
    'mission-initial': {
      id: 'mission-initial',
      title: 'Initialize GACKS P.A. V2 Architecture',
      goal: 'Deploy resilient agent runtime, memory, and verification engine',
      progress: 100,
      currentPhase: 'VERIFICATION',
      phaseStatuses: {
        PLANNING: 'completed',
        DIAGNOSIS: 'completed',
        IMPLEMENTATION: 'completed',
        VERIFICATION: 'completed',
        DEPLOYMENT: 'pending',
      },
      startedAt: Date.now() - 3600000,
      updatedAt: Date.now(),
      completedAt: null,
    },
  },
  tasks: [
    { id: 'task-1', userId: 'default', text: 'Analyze XAUUSD price action & Market Trends', completed: true, createdAt: Date.now() - 7200000 },
    { id: 'task-2', userId: 'default', text: 'Review trading journal & system metrics', completed: true, createdAt: Date.now() - 5400000 },
    { id: 'task-3', userId: 'default', text: 'Upgrade GACKS P.A. V2 Agent Runtime & Verifier', completed: true, createdAt: Date.now() - 3600000 },
    { id: 'task-4', userId: 'default', text: 'Test voice latency & barge-in controls', completed: false, createdAt: Date.now() - 1800000 },
    { id: 'task-5', userId: 'default', text: 'Run verification tests on live tools', completed: false, createdAt: Date.now() - 900000 },
  ],
  memories: {
    'mem-default-pref': {
      id: 'mem-default-pref',
      userId: 'default',
      category: 'semantic',
      content: 'User prefers concise, dry, British RP conversational delivery under 60 words, with verified tool actions.',
      importance: 5,
      confidence: 1.0,
      source: 'system_bootstrap',
      tags: ['preference', 'communication_style'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
    },
    'mem-trading-focus': {
      id: 'mem-trading-focus',
      userId: 'default',
      category: 'semantic',
      content: 'Primary focus markets are XAUUSD (Gold), Forex pairs, and AI engineering workflows.',
      importance: 4,
      confidence: 0.95,
      source: 'user_profile',
      tags: ['trading', 'focus_markets', 'projects'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
    },
  },
  entities: {
    'ent-project-gacks': {
      id: 'ent-project-gacks',
      userId: 'default',
      name: 'GACKS P.A.',
      type: 'project',
      properties: {
        repo: 'https://github.com/gackstonew-lgtm/Gacks-AI.git',
        productionUrl: 'https://gacks-ai.vercel.app/',
        architecture: 'GACKS P.A. V2 Jarvis Surpass',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  },
  relations: {},
  auditLogs: [],
}

export class Database {
  private filePath: string
  private state: DatabaseState
  private saveTimeout: NodeJS.Timeout | null = null

  constructor(filePath?: string) {
    this.filePath = filePath || join(process.cwd(), 'data', 'gacks_db.json')
    this.state = this.load()
  }

  private load(): DatabaseState {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        return {
          ...DEFAULT_STATE,
          ...parsed,
          users: { ...DEFAULT_STATE.users, ...(parsed.users || {}) },
          missions: { ...DEFAULT_STATE.missions, ...(parsed.missions || {}) },
          memories: { ...DEFAULT_STATE.memories, ...(parsed.memories || {}) },
          entities: { ...DEFAULT_STATE.entities, ...(parsed.entities || {}) },
        }
      }
    } catch (err) {
      console.warn('[GACKS DB] Could not read existing database, initializing defaults:', err)
    }

    this.saveImmediate(DEFAULT_STATE)
    return JSON.parse(JSON.stringify(DEFAULT_STATE))
  }

  private saveImmediate(stateToSave = this.state) {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(stateToSave, null, 2), 'utf-8')
    } catch (err) {
      console.error('[GACKS DB] Failed to persist database:', err)
    }
  }

  public scheduleSave() {
    if (this.saveTimeout) return
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null
      this.saveImmediate()
    }, 500)
  }

  // --- Tasks & Missions ---
  public getTasks(userId = 'default') {
    return this.state.tasks.filter((t) => t.userId === userId)
  }

  public addTask(text: string, userId = 'default') {
    const task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      text,
      completed: false,
      createdAt: Date.now(),
    }
    this.state.tasks.push(task)
    this.scheduleSave()
    return task
  }

  public toggleTask(id: string) {
    const task = this.state.tasks.find((t) => t.id === id)
    if (task) {
      task.completed = !task.completed
      this.scheduleSave()
    }
    return task
  }

  public deleteTask(id: string) {
    const idx = this.state.tasks.findIndex((t) => t.id === id)
    if (idx !== -1) {
      this.state.tasks.splice(idx, 1)
      this.scheduleSave()
      return true
    }
    return false
  }

  public getActiveMission(userId = 'default'): MissionState | null {
    const missions = Object.values(this.state.missions)
    return (
      missions.find((m) => m.phaseStatuses.DEPLOYMENT !== 'completed' && m.phaseStatuses.VERIFICATION !== 'failed') ||
      missions[missions.length - 1] ||
      null
    )
  }

  public saveMission(mission: MissionState) {
    this.state.missions[mission.id] = {
      ...mission,
      updatedAt: Date.now(),
    }
    this.scheduleSave()
    return this.state.missions[mission.id]
  }

  // --- Memories ---
  public getAllMemories(userId = 'default'): MemoryRecord[] {
    return Object.values(this.state.memories).filter((m) => m.userId === userId)
  }

  public getMemory(id: string): MemoryRecord | null {
    return this.state.memories[id] || null
  }

  public saveMemory(memory: MemoryRecord) {
    this.state.memories[memory.id] = {
      ...memory,
      updatedAt: Date.now(),
    }
    this.scheduleSave()
    return this.state.memories[memory.id]
  }

  public deleteMemory(id: string): boolean {
    if (this.state.memories[id]) {
      delete this.state.memories[id]
      this.scheduleSave()
      return true
    }
    return false
  }

  // --- Entities & Knowledge Graph ---
  public getEntities(userId = 'default'): EntityRecord[] {
    return Object.values(this.state.entities).filter((e) => e.userId === userId)
  }

  public saveEntity(entity: EntityRecord) {
    this.state.entities[entity.id] = { ...entity, updatedAt: Date.now() }
    this.scheduleSave()
    return this.state.entities[entity.id]
  }

  public getRelations(userId = 'default'): EntityRelationRecord[] {
    return Object.values(this.state.relations).filter((r) => r.userId === userId)
  }

  public saveRelation(relation: EntityRelationRecord) {
    this.state.relations[relation.id] = relation
    this.scheduleSave()
    return relation
  }

  // --- Audit Logs ---
  public logAudit(event: AuditEvent) {
    this.state.auditLogs.unshift(event)
    // Keep bounded to last 1000 records
    if (this.state.auditLogs.length > 1000) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 1000)
    }
    this.scheduleSave()
  }

  public getAuditLogs(limit = 50): AuditEvent[] {
    return this.state.auditLogs.slice(0, limit)
  }
}

export const db = new Database()
