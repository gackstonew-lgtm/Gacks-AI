import { RiskLevel, RiskLevels } from '../types.js'

export interface PolicyDecision {
  allowed: boolean
  riskLevel: RiskLevel
  requiresConfirmation: boolean
  reason: string
}

export class PolicyEngine {
  private userConfirmations: Set<string> = new Set()
  private allowWrites: boolean = process.env.JARVIS_ALLOW_WRITES === '1'

  public setAllowWrites(allow: boolean) {
    this.allowWrites = allow
  }

  public getAllowWrites(): boolean {
    return this.allowWrites
  }

  /**
   * Determine the risk level of an action/tool.
   */
  public evaluateRisk(toolName: string, _args: Record<string, unknown> = {}): RiskLevel {
    const name = toolName.toLowerCase()

    // Financial / High consequence (Level 4)
    if (/(pay|purchase|buy|transfer|checkout|charge|financial)/i.test(name)) {
      return RiskLevels.FINANCIAL_HIGH_CONSEQUENCE
    }

    // Destructive / Security (Level 3)
    if (
      /(delete|destroy|drop|format|unlink|kill|terminate|wipe|rmdir|remove_file|exec_shell|run_bash)/i.test(
        name,
      )
    ) {
      return RiskLevels.DESTRUCTIVE_SECURITY
    }

    // External side effect / Governed execution (Level 2)
    if (/(send_email|send_whatsapp|post_message|publish|tweet|outbound|launch_app|send_notification)/i.test(name)) {
      return RiskLevels.EXTERNAL_SIDE_EFFECT
    }

    // Low-risk write (Level 1)
    if (
      /(write_file|create_task|save_note|patch_ui|ui_theme|ui_effect|ui_reset|edit_file|write_clipboard)/i.test(
        name,
      )
    ) {
      return RiskLevels.LOW_RISK_WRITE
    }

    // Read only (Level 0)
    return RiskLevels.READ_ONLY
  }

  /**
   * Decide if the action is permitted under current security policy.
   */
  public evaluate(
    toolName: string,
    args: Record<string, unknown> = {},
    hasUserConfirmation = false,
  ): PolicyDecision {
    const risk = this.evaluateRisk(toolName, args)

    switch (risk) {
      case RiskLevels.READ_ONLY:
        return {
          allowed: true,
          riskLevel: risk,
          requiresConfirmation: false,
          reason: 'Read-only actions are permitted by default.',
        }

      case RiskLevels.LOW_RISK_WRITE:
        if (!this.allowWrites && !hasUserConfirmation) {
          return {
            allowed: false,
            riskLevel: risk,
            requiresConfirmation: true,
            reason: `Action '${toolName}' modifies local state. Allowed when JARVIS_ALLOW_WRITES=1 or confirmed by operator.`,
          }
        }
        return {
          allowed: true,
          riskLevel: risk,
          requiresConfirmation: false,
          reason: 'Low-risk write permitted by policy configuration.',
        }

      case RiskLevels.EXTERNAL_SIDE_EFFECT:
        if (!hasUserConfirmation) {
          return {
            allowed: false,
            riskLevel: risk,
            requiresConfirmation: true,
            reason: `External communication via '${toolName}' requires operator confirmation.`,
          }
        }
        return {
          allowed: true,
          riskLevel: risk,
          requiresConfirmation: false,
          reason: 'External action explicitly confirmed by operator.',
        }

      case RiskLevels.DESTRUCTIVE_SECURITY:
      case RiskLevels.FINANCIAL_HIGH_CONSEQUENCE:
        if (!hasUserConfirmation) {
          return {
            allowed: false,
            riskLevel: risk,
            requiresConfirmation: true,
            reason: `High consequence action '${toolName}' requires explicit confirmation.`,
          }
        }
        return {
          allowed: true,
          riskLevel: risk,
          requiresConfirmation: false,
          reason: 'High consequence action explicitly confirmed by operator.',
        }
    }
  }
}

export const policyEngine = new PolicyEngine()
