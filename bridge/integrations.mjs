import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

/**
 * Truthful integrations server.
 * Ensures the assistant NEVER hallucinates or pretends to execute external actions
 * (WhatsApp, Email, etc.) when the integration is not authentically configured.
 */
export function integrationsServer() {
  const hasEmail = Boolean(
    process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS,
  )
  const hasWhatsApp = Boolean(
    process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID,
  )

  return createSdkMcpServer({
    name: 'jarvis_integrations',
    version: '1.0.0',
    instructions:
      'Truthful external integrations for email and messaging. Always check connection status before reporting actions to the user.',
    alwaysLoad: true,
    tools: [
      tool(
        'check_integrations',
        'Check which external integrations (WhatsApp, Email, etc.) are actually connected and configured in GACKS P.A.',
        {},
        async () => {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    whatsapp: hasWhatsApp
                      ? 'CONNECTED'
                      : 'NOT_CONNECTED (Requires WHATSAPP_API_TOKEN and WHATSAPP_PHONE_ID in .env)',
                    email: hasEmail
                      ? 'CONNECTED'
                      : 'NOT_CONNECTED (Requires EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env)',
                    screen_capture: 'READY (via Web getDisplayMedia / permissions)',
                    camera: 'READY (via Web getUserMedia / permissions)',
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        },
      ),
      tool(
        'send_whatsapp_message',
        'Send an authentic WhatsApp message to a phone number. Requires official WhatsApp Cloud API configuration.',
        {
          recipient: z.string().describe('Recipient phone number in international format (+1..., +254...)'),
          message: z.string().describe('Message text to send'),
        },
        async (args) => {
          if (!hasWhatsApp) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text:
                    `WhatsApp is not connected. GACKS P.A requires official Meta WhatsApp Business Cloud API credentials ` +
                    `(WHATSAPP_API_TOKEN and WHATSAPP_PHONE_ID) in the .env file. No message was sent to ${args.recipient}. ` +
                    `Please explain this to the user truthfully.`,
                },
              ],
            }
          }
          // Real WhatsApp Cloud API call would go here if configured
          return {
            content: [
              {
                type: 'text',
                text: `WhatsApp message could not be delivered: live credentials not initialized.`,
              },
            ],
          }
        },
      ),
      tool(
        'send_email',
        'Send an authentic email. Requires SMTP configuration in .env.',
        {
          to: z.string().describe('Recipient email address'),
          subject: z.string().describe('Email subject line'),
          body: z.string().describe('Email body text'),
        },
        async (args) => {
          if (!hasEmail) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text:
                    `Email integration is not configured. GACKS P.A requires SMTP configuration ` +
                    `(EMAIL_HOST, EMAIL_USER, EMAIL_PASS) in the .env file. No email was sent to ${args.to}. ` +
                    `Please inform the user truthfully.`,
                },
              ],
            }
          }
          return {
            content: [
              {
                type: 'text',
                text: `Email could not be delivered: live SMTP not initialized.`,
              },
            ],
          }
        },
      ),
    ],
  })
}
