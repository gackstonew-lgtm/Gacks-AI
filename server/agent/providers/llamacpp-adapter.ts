/**
 * GACKS AI — llama.cpp Adapter (Phase 7)
 *
 * llama.cpp's built-in server exposes an OpenAI-compatible API.
 * This module re-exports a pre-configured instance of OpenAICompatibleAdapter
 * pointed at the llama.cpp server.
 *
 * Default URL: http://localhost:8080
 * Override with: LLAMACPP_BASE_URL environment variable
 */

export { llamaCppAdapter as default, OpenAICompatibleAdapter } from './openai-compatible-adapter.js'
export type { OpenAICompatibleMessage, OpenAICompatibleTool } from './openai-compatible-adapter.js'
export { llamaCppAdapter } from './openai-compatible-adapter.js'
