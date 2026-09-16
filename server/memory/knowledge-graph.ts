import { db } from '../db/index.js'
import type { EntityRecord, EntityRelationRecord } from '../types.js'

export class KnowledgeGraph {
  public addEntity(
    name: string,
    type: EntityRecord['type'],
    properties: Record<string, unknown> = {},
    userId = 'default',
  ): EntityRecord {
    const existing = db.getEntities(userId).find((e) => e.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      existing.properties = { ...existing.properties, ...properties }
      existing.updatedAt = Date.now()
      db.saveEntity(existing)
      return existing
    }

    const entity: EntityRecord = {
      id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      name,
      type,
      properties,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    db.saveEntity(entity)
    return entity
  }

  public addRelation(
    sourceName: string,
    relationType: EntityRelationRecord['relation'],
    targetName: string,
    metadata: Record<string, unknown> = {},
    userId = 'default',
  ): EntityRelationRecord {
    const source = this.addEntity(sourceName, 'project', {}, userId)
    const target = this.addEntity(targetName, 'service', {}, userId)

    const rel: EntityRelationRecord = {
      id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      sourceId: source.id,
      targetId: target.id,
      relation: relationType,
      metadata,
      createdAt: Date.now(),
    }

    db.saveRelation(rel)
    return rel
  }

  public getContextFor(entityName: string, userId = 'default'): string {
    const entity = db.getEntities(userId).find((e) => e.name.toLowerCase() === entityName.toLowerCase())
    if (!entity) return ''

    const relations = db.getRelations(userId).filter((r) => r.sourceId === entity.id || r.targetId === entity.id)
    const entities = db.getEntities(userId)
    const idMap = new Map(entities.map((e) => [e.id, e.name]))

    const lines = relations.map((r) => {
      const src = idMap.get(r.sourceId) || r.sourceId
      const tgt = idMap.get(r.targetId) || r.targetId
      return `${src} ${r.relation.replace(/_/g, ' ')} ${tgt}`
    })

    return lines.length > 0 ? `Known entity relationships:\n${lines.join('\n')}` : ''
  }
}

export const knowledgeGraph = new KnowledgeGraph()
