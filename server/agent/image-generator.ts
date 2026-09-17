import { GoogleGenAI } from '@google/genai'

export interface ImageGenerationOptions {
  prompt: string
  size?: '1024x1024' | '512x512' | '1792x1024' | '1024x1792'
  style?: 'vivid' | 'natural' | 'photorealistic' | 'cinematic'
  provider?: 'auto' | 'openai' | 'gemini' | 'pollinations'
}

export interface ImageGenerationResult {
  success: boolean
  url?: string
  prompt: string
  provider: string
  mimeType: string
  caption?: string
  error?: string
}

export class ImageGenerationEngine {
  /**
   * Generates an image using an available AI provider with automatic fallback.
   */
  public async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const prompt = String(options.prompt || '').trim()
    if (!prompt) {
      return {
        success: false,
        prompt: '',
        provider: 'none',
        mimeType: 'image/jpeg',
        error: 'Prompt cannot be empty for image generation',
      }
    }

    const preferredProvider = options.provider || 'auto'

    // 1. Try OpenAI DALL-E 3 if requested or configured
    if ((preferredProvider === 'auto' || preferredProvider === 'openai') && process.env.OPENAI_API_KEY) {
      try {
        const result = await this.generateOpenAiDallE(prompt, options.size || '1024x1024')
        if (result.success) return result
      } catch (err: any) {
        console.warn(`[ImageGen] OpenAI DALL-E failed, attempting fallback: ${err.message}`)
      }
    }

    // 2. Try Gemini Imagen if requested or configured
    if ((preferredProvider === 'auto' || preferredProvider === 'gemini') && process.env.GEMINI_API_KEY) {
      try {
        const result = await this.generateGeminiImagen(prompt)
        if (result.success) return result
      } catch (err: any) {
        console.warn(`[ImageGen] Gemini Imagen failed, attempting fallback: ${err.message}`)
      }
    }

    // 3. Fallback: Free / Open-source high-speed generator (Pollinations.ai)
    try {
      const result = await this.generatePollinations(prompt, options.size || '1024x1024')
      return result
    } catch (err: any) {
      return {
        success: false,
        prompt,
        provider: 'failed',
        mimeType: 'image/jpeg',
        error: `All image generation providers failed: ${err.message}`,
      }
    }
  }

  private async generateOpenAiDallE(prompt: string, size: string): Promise<ImageGenerationResult> {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: size === '512x512' ? '1024x1024' : size,
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI DALL-E API error ${res.status}: ${err}`)
    }

    const data = (await res.json()) as any
    const imageUrl = data?.data?.[0]?.url
    if (!imageUrl) throw new Error('No image URL returned by OpenAI DALL-E')

    return {
      success: true,
      url: imageUrl,
      prompt,
      provider: 'OpenAI DALL-E 3',
      mimeType: 'image/png',
      caption: data?.data?.[0]?.revised_prompt || prompt,
    }
  }

  private async generateGeminiImagen(prompt: string): Promise<ImageGenerationResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    })

    const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes
    if (!imageBytes) throw new Error('No image bytes returned by Gemini Imagen')

    const dataUrl = `data:image/jpeg;base64,${imageBytes}`
    return {
      success: true,
      url: dataUrl,
      prompt,
      provider: 'Google Gemini Imagen 3',
      mimeType: 'image/jpeg',
      caption: prompt,
    }
  }

  private async generatePollinations(prompt: string, size: string): Promise<ImageGenerationResult> {
    const cleanPrompt = encodeURIComponent(prompt)
    const [width, height] = size === '512x512' ? ['512', '512'] : ['1024', '1024']
    const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&nologo=true`

    return {
      success: true,
      url: imageUrl,
      prompt,
      provider: 'Pollinations AI (Neural Diffusion)',
      mimeType: 'image/jpeg',
      caption: prompt,
    }
  }
}

export const imageGenerator = new ImageGenerationEngine()
