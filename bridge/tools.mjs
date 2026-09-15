import { readFile, readdir, stat } from 'node:fs/promises'
import { isAbsolute, resolve as resolvePath } from 'node:path'

/**
 * Universal Tool Registry for GACKS P.A.
 * Provides normalized tool definitions (Gemini FunctionDeclarations)
 * and execution dispatch for HUD, screen, camera, file system, and integrations.
 */

export function createToolRegistry({ send, ask, _allowWrites = false }) {
  const tools = new Map()

  function registerTool(name, description, parameters, execute) {
    tools.set(name, {
      declaration: {
        name,
        description,
        parameters: parameters || { type: 'OBJECT', properties: {} },
      },
      execute,
    })
  }

  // --- 1. HUD & Display Tools (jarvis) -----------------------------------
  registerTool(
    'blade',
    'Open a holographic blade in the HUD to show visual content: an article, image, video, live web page, or list.',
    {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Headline on the blade header.' },
        subtitle: { type: 'STRING', description: 'Category or source tag, e.g. REUTERS, SYSTEM.' },
        kind: {
          type: 'STRING',
          enum: ['article', 'image', 'video', 'page', 'markdown', 'metrics'],
          description: 'Type of content to render.',
        },
        url: { type: 'STRING', description: 'URL for image, video, or web page.' },
        body: { type: 'STRING', description: 'Markdown or plain text for article or notes.' },
        accent: { type: 'STRING', description: 'Optional CSS hex accent color.' },
      },
      required: ['title'],
    },
    async (args) => {
      const blade = {
        id: `blade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: String(args.title || 'Data'),
        subtitle: args.subtitle ? String(args.subtitle) : undefined,
        kind: args.kind || 'markdown',
        url: args.url ? String(args.url) : undefined,
        body: args.body ? String(args.body) : undefined,
        accent: args.accent ? String(args.accent) : undefined,
        closable: true,
      }
      send({ type: 'blade', blade })
      return { status: 'opened', bladeId: blade.id, title: blade.title }
    },
  )

  registerTool(
    'display',
    'Compose custom HTML markup into a rich card panel in the HUD.',
    {
      type: 'OBJECT',
      properties: {
        html: { type: 'STRING', description: 'Safe HTML snippet using .hud-* classes.' },
        title: { type: 'STRING', description: 'Header title on the panel.' },
      },
      required: ['html'],
    },
    async (args) => {
      const panel = {
        id: `panel-${Date.now()}`,
        html: String(args.html),
        title: args.title ? String(args.title) : undefined,
      }
      send({ type: 'panel', panel })
      return { status: 'displayed', panelId: panel.id }
    },
  )

  // --- 2. Interface Controls (jarvis_ui) ----------------------------------
  registerTool(
    'ui_theme',
    'Retint the interface accent color temporarily to convey status (e.g. cyan, red for alerts, gold).',
    {
      type: 'OBJECT',
      properties: {
        accent: { type: 'STRING', description: 'CSS color string, e.g. "#00e5ff", "#ff3b30", "#ffd700".' },
      },
      required: ['accent'],
    },
    async (args) => {
      send({ type: 'ui', op: 'patch', args: { accent: args.accent } })
      return { status: 'accent_updated', color: args.accent }
    },
  )

  registerTool(
    'ui_effect',
    'Trigger a visual HUD flourish on the display glass.',
    {
      type: 'OBJECT',
      properties: {
        kind: {
          type: 'STRING',
          enum: ['glitch', 'pulse', 'scan', 'shake', 'flash'],
          description: 'Type of visual effect.',
        },
      },
      required: ['kind'],
    },
    async (args) => {
      send({ type: 'ui', op: 'effect', args: { kind: args.kind } })
      return { status: 'effect_fired', effect: args.kind }
    },
  )

  registerTool(
    'ui_reset',
    'Reset all UI tints, orbits, and custom styling back to the default HUD appearance.',
    { type: 'OBJECT', properties: {} },
    async () => {
      send({ type: 'ui', op: 'reset', args: {} })
      return { status: 'ui_reset' }
    },
  )

  // --- 3. Screen Understanding & Vision (jarvis_screen, jarvis_eyes) ------
  registerTool(
    'capture_screen',
    'Capture and view what is currently open on the user screen, desktop, or window. Use when asked "look at my screen", "what is on my screen", "explain this code on my screen", etc.',
    {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING', description: 'Brief purpose of screen inspection, shown to the user.' },
      },
    },
    async (args) => {
      const reply = await ask(
        'capture_screen',
        { reason: String(args.reason ?? 'inspecting screen contents').slice(0, 100) },
        60_000,
      )
      if (reply?.error) {
        return { error: String(reply.error) }
      }
      if (typeof reply?.data !== 'string' || !reply.data) {
        return { error: 'Screen capture returned no image data.' }
      }
      return {
        status: 'success',
        image: {
          inlineData: {
            mimeType: reply.mimeType || 'image/jpeg',
            data: reply.data,
          },
        },
        message: 'Current screenshot captured from the user monitor.',
      }
    },
  )

  registerTool(
    'look',
    'Look through the webcam at whoever is in front of the screen. Use only when explicitly asked to look.',
    {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING', description: 'What you are looking for, shown while camera is active.' },
      },
    },
    async (args) => {
      const reply = await ask(
        'capture',
        { mode: 'look', reason: String(args.reason ?? '').slice(0, 80) },
        25_000,
      )
      if (reply?.error) return { error: String(reply.error) }
      if (typeof reply?.data !== 'string' || !reply.data) {
        return { error: 'Camera returned no image data.' }
      }
      return {
        status: 'success',
        image: {
          inlineData: {
            mimeType: reply.mimeType || 'image/jpeg',
            data: reply.data,
          },
        },
        message: 'Webcam snapshot captured.',
      }
    },
  )

  // --- 4. Truthful Integrations (jarvis_integrations) ---------------------
  registerTool(
    'check_integrations',
    'Check which external integrations (WhatsApp, Email, Screen, Camera) are configured and live.',
    { type: 'OBJECT', properties: {} },
    async () => {
      const hasEmail = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
      const hasWhatsApp = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID)
      return {
        whatsapp: hasWhatsApp ? 'CONNECTED' : 'NOT_CONFIGURED (Requires WHATSAPP_API_TOKEN and WHATSAPP_PHONE_ID in .env)',
        email: hasEmail ? 'CONNECTED' : 'NOT_CONFIGURED (Requires EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env)',
        screen_understanding: 'READY (Browser getDisplayMedia API)',
        webcam: 'READY (Browser getUserMedia API)',
      }
    },
  )

  registerTool(
    'send_whatsapp_message',
    'Send an authentic WhatsApp message to a phone number. Requires verified WhatsApp Business Cloud API in .env.',
    {
      type: 'OBJECT',
      properties: {
        recipient: { type: 'STRING', description: 'Phone number in international format (+1..., +254...)' },
        message: { type: 'STRING', description: 'Message body to send.' },
      },
      required: ['recipient', 'message'],
    },
    async (args) => {
      const hasWhatsApp = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID)
      if (!hasWhatsApp) {
        return {
          error:
            `WhatsApp is not connected. Official Meta WhatsApp Business Cloud API credentials ` +
            `(WHATSAPP_API_TOKEN and WHATSAPP_PHONE_ID) are required in .env. No message was sent to ${args.recipient}.`,
        }
      }
      return { error: 'Live WhatsApp sending is not active.' }
    },
  )

  registerTool(
    'send_email',
    'Send an authentic email. Requires SMTP configuration in .env.',
    {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Recipient email address.' },
        subject: { type: 'STRING', description: 'Subject line.' },
        body: { type: 'STRING', description: 'Email body text.' },
      },
      required: ['to', 'subject', 'body'],
    },
    async (args) => {
      const hasEmail = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
      if (!hasEmail) {
        return {
          error:
            `Email integration is not configured. SMTP settings (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) ` +
            `must be set in .env. No email was sent to ${args.to}.`,
        }
      }
      return { error: 'Live SMTP email delivery is not active.' }
    },
  )

  // --- 5. Safe Filesystem Reads ------------------------------------------
  registerTool(
    'read_file',
    'Read the text contents of a local file safely.',
    {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Relative or absolute file path.' },
      },
      required: ['path'],
    },
    async (args) => {
      try {
        const p = isAbsolute(args.path) ? args.path : resolvePath(process.cwd(), args.path)
        const info = await stat(p)
        if (!info.isFile()) return { error: `Path is not a regular file: ${args.path}` }
        if (info.size > 256 * 1024) return { error: `File too large (${info.size} bytes). Max is 256KB.` }
        const content = await readFile(p, 'utf8')
        return { path: args.path, content }
      } catch (err) {
        return { error: `Could not read file: ${err.message}` }
      }
    },
  )

  registerTool(
    'list_directory',
    'List files and directories within a given directory.',
    {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Directory path to list. Defaults to current directory.' },
      },
    },
    async (args) => {
      try {
        const target = args.path ? (isAbsolute(args.path) ? args.path : resolvePath(process.cwd(), args.path)) : process.cwd()
        const entries = await readdir(target, { withFileTypes: true })
        return {
          directory: target,
          entries: entries.slice(0, 50).map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'directory' : 'file',
          })),
        }
      } catch (err) {
        return { error: `Could not list directory: ${err.message}` }
      }
    },
  )

  return {
    getDeclarations: () => Array.from(tools.values()).map((t) => t.declaration),
    hasTool: (name) => tools.has(name),
    executeTool: async (name, args) => {
      const t = tools.get(name)
      if (!t) throw new Error(`Unknown tool: ${name}`)
      return await t.execute(args)
    },
    getToolNames: () => Array.from(tools.keys()),
  }
}
