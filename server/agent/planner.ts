import type { Plan, PlanStep } from '../types.js'

export class Planner {
  /**
   * Determine if a user prompt warrants a multi-step structured plan.
   */
  public needsPlan(prompt: string): boolean {
    const complexPatterns = [
      /(fix|debug|repair|diagnose|resolve)\b.*(code|issue|bug|error|test|build|failure|deployment|vercel|server)/i,
      /(vulnerabilit|cve|security audit|audit dependenc)/i,
      /(deploy|release|publish|migrate)\b/i,
      /(refactor|rewrite|rebuild|upgrade|audit|clean|optimize)\b/i,
      /(build|test|lint|compile|bundle)\b.*(project|app|codebase|repository)/i,
      /(add|implement|create|integrate)\b.*(feature|component|endpoint|service|tool)/i,
      /(forex|gold|xauusd|market analysis|trade audit|market trend|market structure)/i,
      /(multi-step|workflow|pipeline|routine)/i,
    ]
    return complexPatterns.some((pattern) => pattern.test(prompt))
  }

  /**
   * Create a structured plan for an identified goal.
   */
  public createPlan(goal: string): Plan {
    const id = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const steps: PlanStep[] = []

    if (/(morning briefing|executive briefing|daily briefing)/i.test(goal)) {
      steps.push(
        {
          id: `${id}-1`,
          description: 'Aggregate revenue pacing, customer alerts, and priorities for executive morning briefing',
          status: 'pending',
          tool: 'generate_morning_briefing',
          args: { workspaceId: 'default-workspace' },
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Retrieve urgent client accounts requiring operator attention',
          status: 'pending',
          tool: 'manage_crm_customer',
          args: { action: 'urgent' },
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Inspect pending executive approvals queued in the Approval Center',
          status: 'pending',
          tool: 'manage_approval_request',
          args: { action: 'list_pending' },
          dependencies: [`${id}-2`],
        },
        {
          id: `${id}-4`,
          description: 'Render JAVIS Executive Briefing blade on HUD',
          status: 'pending',
          tool: 'blade',
          dependencies: [`${id}-3`],
        },
      )
    } else if (/(forex|audit trade|trade audit|market structure)/i.test(goal)) {
      steps.push(
        {
          id: `${id}-1`,
          description: 'Audit trade plan parameters, risk-to-reward ratio, and position sizing',
          status: 'pending',
          tool: 'audit_forex_trade',
          args: { pair: 'XAUUSD', direction: 'LONG', entryPrice: 2650.0, stopLoss: 2640.0, takeProfit: 2680.0 },
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Evaluate technical invalidation level and enforce safety disclaimers',
          status: 'pending',
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Present trade audit report on HUD blade',
          status: 'pending',
          tool: 'blade',
          dependencies: [`${id}-2`],
        },
      )
    } else if (/(growth|revenue pacing|bottleneck|business analysis)/i.test(goal)) {
      steps.push(
        {
          id: `${id}-1`,
          description: 'Analyze company growth metrics, revenue pacing, and operational bottlenecks',
          status: 'pending',
          tool: 'analyze_business_growth',
          args: { workspaceId: 'default-workspace' },
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Query CRM pipeline for high-leverage revenue opportunities',
          status: 'pending',
          tool: 'manage_crm_customer',
          args: { action: 'urgent' },
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Synthesize growth strategy and render executive growth blade',
          status: 'pending',
          tool: 'blade',
          dependencies: [`${id}-2`],
        },
      )
    } else if (/(vulnerabilit|cve|security audit|audit dependenc)/i.test(goal)) {
      steps.push(
        {
          id: `${id}-1`,
          description: 'Inspect workspace dependencies in package.json',
          status: 'pending',
          tool: 'read_file',
          args: { path: 'package.json' },
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Query OSV Open Source Vulnerabilities API for known security advisories',
          status: 'pending',
          tool: 'query_external_api',
          args: {
            provider: 'osv-vulnerabilities',
            operation: 'query_package_vulnerabilities',
            parameters: { package_name: 'vite', ecosystem: 'npm' },
          },
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Analyze vulnerability findings and verify risk level',
          status: 'pending',
          dependencies: [`${id}-2`],
        },
        {
          id: `${id}-4`,
          description: 'Display security audit report on HUD blade',
          status: 'pending',
          tool: 'blade',
          dependencies: [`${id}-3`],
        },
      )
    } else if (/(weather|forecast|temperature)/i.test(goal)) {
      steps.push(
        {
          id: `${id}-1`,
          description: 'Resolve location coordinates via Open-Meteo Geocoding',
          status: 'pending',
          tool: 'query_external_api',
          args: {
            provider: 'open-meteo-geocoding',
            operation: 'search_location',
            parameters: { name: 'Nairobi' },
          },
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Retrieve real-time atmospheric forecast via Open-Meteo Weather API',
          status: 'pending',
          tool: 'query_external_api',
          args: {
            provider: 'open-meteo-weather',
            operation: 'get_forecast',
            parameters: { latitude: -1.2921, longitude: 36.8219 },
          },
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Format atmospheric conditions and display weather report',
          status: 'pending',
          tool: 'blade',
          dependencies: [`${id}-2`],
        },
      )
    } else if (/deployment|vercel/i.test(goal)) {
      steps.push(
        {
          id: `${id}-1`,
          description: 'Inspect deployment configuration and active environment variables',
          status: 'pending',
          tool: 'check_integrations',
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Inspect workspace files and package build scripts',
          status: 'pending',
          tool: 'read_file',
          args: { path: 'package.json' },
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Verify system diagnostics and network connectivity',
          status: 'pending',
          tool: 'read_file',
          args: { path: 'README.md' },
          dependencies: [`${id}-2`],
        },
        {
          id: `${id}-4`,
          description: 'Display diagnostic summary on HUD blade',
          status: 'pending',
          tool: 'blade',
          dependencies: [`${id}-3`],
        },
      )
    } else if (/(code|bug|fix|refactor|feature|test|build|lint|compile|repository|workspace)/i.test(goal)) {
      steps.push(
        {
          id: `${id}-1`,
          description: 'Inspect repository structure and locate target files',
          status: 'pending',
          tool: 'list_directory',
          args: { path: '.' },
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Inspect file contents and identify required modifications',
          status: 'pending',
          tool: 'read_file',
          args: { path: 'package.json' },
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Apply scoped code modifications or file operations',
          status: 'pending',
          dependencies: [`${id}-2`],
        },
        {
          id: `${id}-4`,
          description: 'Execute terminal verification (build, test, or lint)',
          status: 'pending',
          tool: 'run_terminal_command',
          args: { command: 'npm run build' },
          dependencies: [`${id}-3`],
        },
        {
          id: `${id}-5`,
          description: 'Verify outcomes and display engineering summary',
          status: 'pending',
          tool: 'blade',
          dependencies: [`${id}-4`],
        },
      )
    } else {
      steps.push(
        {
          id: `${id}-1`,
          description: `Analyze requirements for: ${goal}`,
          status: 'pending',
          dependencies: [],
        },
        {
          id: `${id}-2`,
          description: 'Execute required actions and verify outputs',
          status: 'pending',
          dependencies: [`${id}-1`],
        },
        {
          id: `${id}-3`,
          description: 'Summarize outcome and confirm completion',
          status: 'pending',
          dependencies: [`${id}-2`],
        },
      )
    }

    return {
      id,
      goal,
      status: 'pending',
      steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }
}

export const planner = new Planner()
