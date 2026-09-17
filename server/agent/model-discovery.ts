/**
 * GACKS AI — Model Discovery Service (Phase 9)
 *
 * Queries running Ollama and llama.cpp servers to enumerate locally-installed
 * models and registers them dynamically in the ModelRegistry.
 *
 * Discovery is READ-ONLY — it never installs or modifies models.
 * Model installation is exclusively user-initiated (Phase 23-24).
 */

import { modelRegistry } from './model-registry.js'
import { ollamaAdapter } from './providers/ollama-adapter.js'
import { llamaCppAdapter } from './providers/openai-compatible-adapter.js'
import type { ModelDescriptor } from '../types.js'

export interface DiscoveryResult {
  ollama: {
    reachable: boolean
    models: string[]
    registered: number
  }
  llamacpp: {
    reachable: boolean
    models: string[]
    registered: number
  }
  totalDiscovered: number
  discoveredAt: number
}

export class ModelDiscovery {
  private lastResult: DiscoveryResult | null = null
  private activePromise: Promise<DiscoveryResult> | null = null

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  public async discover(): Promise<DiscoveryResult> {
    if (this.activePromise) {
      return this.activePromise
    }

    this.activePromise = (async () => {
      try {
        const [ollamaResult, llamaCppResult] = await Promise.allSettled([
          this.discoverOllama(),
          this.discoverLlamaCpp(),
        ])

        const ollama = ollamaResult.status === 'fulfilled'
          ? ollamaResult.value
          : { reachable: false, models: [], registered: 0 }

        const llamacpp = llamaCppResult.status === 'fulfilled'
          ? llamaCppResult.value
          : { reachable: false, models: [], registered: 0 }

        this.lastResult = {
          ollama,
          llamacpp,
          totalDiscovered: ollama.registered + llamacpp.registered,
          discoveredAt: Date.now(),
        }

        console.log(
          `[ModelDiscovery] Discovered ${this.lastResult.totalDiscovered} local models` +
          ` (Ollama: ${ollama.registered}, llama.cpp: ${llamacpp.registered})`,
        )

        return this.lastResult
      } finally {
        this.activePromise = null
      }
    })()

    return this.activePromise
  }

  public getLastResult(): DiscoveryResult | null {
    return this.lastResult
  }

  public getInstalledLocalModels(): ModelDescriptor[] {
    return modelRegistry.getLocalModels()
  }

  // ---------------------------------------------------------------------------
  // Provider-specific discovery
  // ---------------------------------------------------------------------------

  private async discoverOllama(): Promise<{ reachable: boolean; models: string[]; registered: number }> {
    const reachable = await ollamaAdapter.checkAvailability()
    if (!reachable) return { reachable: false, models: [], registered: 0 }

    const modelNames = await ollamaAdapter.listModels()
    let registered = 0

    for (const name of modelNames) {
      // Normalize model name: strip digest tags for matching
      const baseName = name.split(':')[0]

      // Check if we already have a rich descriptor for this model
      const existingId = `ollama:${name}`
      if (!modelRegistry.getById(existingId)) {
        modelRegistry.registerDiscovered('ollama', name, {
          displayName: `${name} (Local)`,
          description: `Locally installed Ollama model: ${name}`,
          tags: ['ollama', 'local', baseName],
        })
        registered++
      }
    }

    return { reachable: true, models: modelNames, registered }
  }

  private async discoverLlamaCpp(): Promise<{ reachable: boolean; models: string[]; registered: number }> {
    const reachable = await llamaCppAdapter.checkAvailability()
    if (!reachable) return { reachable: false, models: [], registered: 0 }

    const modelNames = await llamaCppAdapter.listModels()
    let registered = 0

    for (const name of modelNames) {
      const existingId = `llamacpp:${name}`
      if (!modelRegistry.getById(existingId)) {
        modelRegistry.registerDiscovered('llamacpp', name, {
          displayName: `${name} (llama.cpp)`,
          description: `Model loaded in llama.cpp server: ${name}`,
          tags: ['llamacpp', 'local', 'gguf'],
          quantization: name.includes('Q4') ? 'Q4_K_M'
            : name.includes('Q8') ? 'Q8_0'
            : name.includes('Q5') ? 'Q5_K_M'
            : undefined,
        })
        registered++
      }
    }

    return { reachable: true, models: modelNames, registered }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private emptyResult(): DiscoveryResult {
    return {
      ollama: { reachable: false, models: [], registered: 0 },
      llamacpp: { reachable: false, models: [], registered: 0 },
      totalDiscovered: 0,
      discoveredAt: Date.now(),
    }
  }
}

export const modelDiscovery = new ModelDiscovery()

