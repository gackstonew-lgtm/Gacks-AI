import type { CustomerRecord } from '../types.js'

export class CrmService {
  private customers: Map<string, CustomerRecord> = new Map()

  constructor() {
    this.seedDefaultCustomers()
  }

  private seedDefaultCustomers() {
    const defaults: CustomerRecord[] = [
      {
        id: 'cust-1',
        workspaceId: 'default-workspace',
        name: 'Apex Digital Logistics',
        email: 'procurement@apexdigital.example',
        phone: '+254700112233',
        channel: 'email',
        status: 'active',
        sentiment: 'positive',
        ltvUsd: 14500,
        tags: ['enterprise', 'logistics', 'high-priority'],
        notes: ['Contract renewal upcoming in Q4.', 'Interested in automating freight manifest analysis.'],
        lastContactAt: Date.now() - 86400000 * 2,
        createdAt: Date.now() - 86400000 * 90,
      },
      {
        id: 'cust-2',
        workspaceId: 'default-workspace',
        name: 'Nairobi Global Imports',
        email: 'director@nairobimports.example',
        phone: '+254711445566',
        channel: 'whatsapp',
        status: 'churn_risk',
        sentiment: 'negative',
        ltvUsd: 8200,
        tags: ['retail', 'urgent_followup'],
        notes: ['Experienced delay in last automated shipment summary report.', 'Awaiting executive call.'],
        lastContactAt: Date.now() - 86400000 * 5,
        createdAt: Date.now() - 86400000 * 120,
      },
      {
        id: 'cust-3',
        workspaceId: 'default-workspace',
        name: 'Savanna Solar Energy',
        email: 'info@savannasolar.example',
        phone: '+254722889900',
        channel: 'web',
        status: 'lead',
        sentiment: 'neutral',
        ltvUsd: 0,
        tags: ['inbound_lead', 'energy'],
        notes: ['Requested custom enterprise quote for AI Business Suite installation.'],
        lastContactAt: Date.now() - 3600000 * 6,
        createdAt: Date.now() - 3600000 * 12,
      },
    ]

    for (const c of defaults) {
      this.customers.set(c.id, c)
    }
  }

  public getCustomers(workspaceId = 'default-workspace'): CustomerRecord[] {
    return Array.from(this.customers.values()).filter((c) => c.workspaceId === workspaceId)
  }

  public getCustomer(id: string, workspaceId = 'default-workspace'): CustomerRecord | undefined {
    const c = this.customers.get(id)
    return c && c.workspaceId === workspaceId ? c : undefined
  }

  public findCustomer(query: string, workspaceId = 'default-workspace'): CustomerRecord[] {
    const q = query.toLowerCase().trim()
    return this.getCustomers(workspaceId).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }

  public getUrgentAttentionList(workspaceId = 'default-workspace'): CustomerRecord[] {
    return this.getCustomers(workspaceId).filter(
      (c) => c.status === 'churn_risk' || c.sentiment === 'negative' || c.tags.includes('urgent_followup'),
    )
  }

  public createCustomer(customer: Omit<CustomerRecord, 'id' | 'createdAt'>): CustomerRecord {
    const id = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const record: CustomerRecord = {
      ...customer,
      id,
      createdAt: Date.now(),
    }
    this.customers.set(id, record)
    return record
  }

  public updateCustomer(id: string, updates: Partial<CustomerRecord>, workspaceId = 'default-workspace'): CustomerRecord | null {
    const existing = this.getCustomer(id, workspaceId)
    if (!existing) return null

    const updated = { ...existing, ...updates }
    this.customers.set(id, updated)
    return updated
  }

  public addNote(id: string, note: string, workspaceId = 'default-workspace'): CustomerRecord | null {
    const existing = this.getCustomer(id, workspaceId)
    if (!existing) return null

    existing.notes.push(note)
    existing.lastContactAt = Date.now()
    this.customers.set(id, existing)
    return existing
  }
}

export const crmService = new CrmService()
