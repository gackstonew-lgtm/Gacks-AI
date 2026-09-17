/**
 * GACKS AI — Hardware Advisor (Phase 10-11, 48)
 *
 * Reads hardware telemetry from the existing WindowsSystemService and
 * recommends the best local models that fit in available RAM/VRAM.
 *
 * Integrates with ModelRegistry to filter by hardware constraints.
 * Never makes model installation decisions — only provides recommendations.
 */

import { modelRegistry } from './model-registry.js'
import type { ModelDescriptor } from '../types.js'

export interface HardwareProfile {
  totalRamGb: number
  availableRamGb: number
  gpuVramGb: number
  hasGpu: boolean
  cpuCores: number
  cpuModel: string
  canRunLocal: boolean       // true if system can run at least a small model
  recommendedMaxModelSizeGb: number
}

export interface ModelRecommendation {
  model: ModelDescriptor
  reason: string
  fitScore: number           // 0-100, higher is better fit for this hardware
  canRun: boolean
}

export interface HardwareCompatibilityReport {
  profile: HardwareProfile
  recommendations: ModelRecommendation[]
  recommendedLocalModel: ModelDescriptor | null
  cloudFallbackAdvised: boolean
}

export class HardwareAdvisor {
  private cachedProfile: HardwareProfile | null = null
  private cacheTs = 0
  private readonly CACHE_TTL_MS = 60_000

  // ---------------------------------------------------------------------------
  // Hardware profile
  // ---------------------------------------------------------------------------

  public async getProfile(): Promise<HardwareProfile> {
    if (this.cachedProfile && Date.now() - this.cacheTs < this.CACHE_TTL_MS) {
      return this.cachedProfile
    }

    try {
      // Try to read from the existing system monitor endpoint
      const report = await this.fetchHardwareReport()
      this.cachedProfile = report
      this.cacheTs = Date.now()
      return report
    } catch {
      // Fallback: conservative profile
      return this.defaultProfile()
    }
  }

  public invalidateCache(): void {
    this.cachedProfile = null
    this.cacheTs = 0
  }

  // ---------------------------------------------------------------------------
  // Recommendations
  // ---------------------------------------------------------------------------

  public async getCompatibilityReport(): Promise<HardwareCompatibilityReport> {
    const profile = await this.getProfile()
    const localModels = modelRegistry.getLocalModels()

    const recommendations: ModelRecommendation[] = localModels.map((model) => {
      const canRun = this.canRunModel(model, profile)
      const fitScore = this.scoreFit(model, profile)
      const reason = this.buildReason(model, profile, canRun)
      return { model, reason, fitScore, canRun }
    })

    recommendations.sort((a, b) => b.fitScore - a.fitScore)

    const runnable = recommendations.filter((r) => r.canRun)
    const recommendedLocalModel = runnable[0]?.model ?? null
    const cloudFallbackAdvised = !profile.canRunLocal || runnable.length === 0

    return { profile, recommendations, recommendedLocalModel, cloudFallbackAdvised }
  }

  /** Returns the best local model for this hardware, or null if none fit */
  public async getBestLocalModel(): Promise<ModelDescriptor | null> {
    const report = await this.getCompatibilityReport()
    return report.recommendedLocalModel
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private canRunModel(model: ModelDescriptor, profile: HardwareProfile): boolean {
    if (!model.sizeGb) return true // unknown size — assume it can run

    // GPU path
    if (model.requiresGpu) {
      return profile.hasGpu && profile.gpuVramGb >= model.minVramGb
    }

    // CPU path — need at least 1.3× model size in available RAM
    const requiredRam = (model.sizeGb ?? 0) * 1.3
    return profile.availableRamGb >= requiredRam
  }

  private scoreFit(model: ModelDescriptor, profile: HardwareProfile): number {
    if (!this.canRunModel(model, profile)) return 0

    let score = 50

    // Prefer models that are smaller relative to available RAM (more headroom)
    if (model.sizeGb && profile.availableRamGb > 0) {
      const utilization = (model.sizeGb * 1.3) / profile.availableRamGb
      if (utilization < 0.3) score += 30
      else if (utilization < 0.5) score += 20
      else if (utilization < 0.7) score += 10
      else score -= 10
    }

    // Prefer models with tool calling support
    if (model.capabilities.includes('tool_calling')) score += 10

    // Prefer larger context windows
    if (model.contextWindow >= 128_000) score += 5
    else if (model.contextWindow >= 32_000) score += 2

    return Math.max(0, Math.min(100, score))
  }

  private buildReason(model: ModelDescriptor, profile: HardwareProfile, canRun: boolean): string {
    if (!canRun) {
      if (model.requiresGpu && !profile.hasGpu) {
        return 'Requires GPU — not available on this system'
      }
      if (model.sizeGb) {
        return `Requires ~${(model.sizeGb * 1.3).toFixed(1)} GB RAM, only ${profile.availableRamGb.toFixed(1)} GB available`
      }
      return 'Insufficient hardware resources'
    }

    const mbRam = model.sizeGb ? `${(model.sizeGb * 1.3).toFixed(1)} GB RAM` : 'unknown RAM'
    return `Fits comfortably — estimated ${mbRam} required, ${profile.availableRamGb.toFixed(1)} GB available`
  }

  private async fetchHardwareReport(): Promise<HardwareProfile> {
    // Read from localhost bridge (existing system service)
    const bridgeUrl = process.env.JARVIS_BRIDGE_URL ?? `http://localhost:${process.env.JARVIS_BRIDGE_PORT ?? '8787'}`
    const res = await fetch(`${bridgeUrl}/api/v1/system/hardware`, {
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) return this.defaultProfile()

    const data = (await res.json()) as {
      memory?: { totalGb?: number; usedGb?: number; availableGb?: number }
      cpu?: { model?: string; cores?: number; logicalProcessors?: number }
      gpu?: Array<{ name?: string; vramGb?: number }>
    }

    const totalRamGb = data.memory?.totalGb ?? 8
    const usedRamGb = data.memory?.usedGb ?? 4
    const availableRamGb = data.memory?.availableGb ?? totalRamGb - usedRamGb
    const gpuVramGb = data.gpu?.[0]?.vramGb ?? 0
    const hasGpu = gpuVramGb > 0
    const cpuCores = data.cpu?.cores ?? 4
    const cpuModel = data.cpu?.model ?? 'Unknown CPU'

    // Recommend no more than 50% of available RAM for model loading
    const recommendedMaxModelSizeGb = (availableRamGb * 0.5) / 1.3

    return {
      totalRamGb,
      availableRamGb,
      gpuVramGb,
      hasGpu,
      cpuCores,
      cpuModel,
      canRunLocal: availableRamGb >= 3,
      recommendedMaxModelSizeGb,
    }
  }

  private defaultProfile(): HardwareProfile {
    return {
      totalRamGb: 8,
      availableRamGb: 4,
      gpuVramGb: 0,
      hasGpu: false,
      cpuCores: 4,
      cpuModel: 'Unknown',
      canRunLocal: true,
      recommendedMaxModelSizeGb: 1.5,
    }
  }
}

export const hardwareAdvisor = new HardwareAdvisor()

