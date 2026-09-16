import { BaseApiAdapter } from './base-adapter.js'
import type { ApiAuthType, ApiAdapterContext, ApiExecutionResult } from '../types.js'

export class GitHubAdapter extends BaseApiAdapter {
  id = 'github-api'
  name = 'GitHub Public API'
  category = 'Development'
  description = 'Inspect repositories, commits, releases, issues, and metadata on GitHub.'
  authType: ApiAuthType = 'apiKey'
  baseUrl = 'https://api.github.com'
  capabilities = ['github', 'git', 'repositories', 'code', 'pull_requests', 'releases', 'issues']
  priority = 2 as const

  async execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult> {
    const start = Date.now()
    const owner = String(params.owner || '').trim()
    const repo = String(params.repo || '').trim()

    if (!owner || !repo) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'get_repo',
        durationMs: 0,
        error: 'Parameters "owner" and "repo" are required for GitHub API operations.',
        isUntrustedData: true,
      }
    }

    let endpoint = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    if (operation === 'get_releases') {
      endpoint += '/releases'
    } else if (operation === 'get_issues') {
      endpoint += '/issues?state=open&per_page=10'
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    }

    // Token priority: isolated adapter credential > process.env.GITHUB_TOKEN
    const token = context?.credential?.apiKey || process.env.GITHUB_TOKEN
    if (token) {
      headers.Authorization = `token ${token}`
    }

    const res = await this.safeFetch(endpoint, { headers }, context)
    if (!res.ok) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'get_repo',
        durationMs: Date.now() - start,
        statusCode: res.status,
        rateLimitRemaining: res.rateLimitRemaining,
        rateLimitReset: res.rateLimitReset,
        error: `GitHub API error (HTTP ${res.status}): ${res.rawText.slice(0, 150)}`,
        isUntrustedData: true,
      }
    }

    let payload: any
    if (Array.isArray(res.data)) {
      payload = res.data.slice(0, 10).map((item: any) => ({
        id: item.id,
        name: item.name || item.title,
        tag_name: item.tag_name,
        published_at: item.published_at || item.created_at,
        html_url: item.html_url,
      }))
    } else {
      payload = {
        name: res.data.name,
        full_name: res.data.full_name,
        description: res.data.description,
        stars: res.data.stargazers_count,
        forks: res.data.forks_count,
        open_issues: res.data.open_issues_count,
        default_branch: res.data.default_branch,
        language: res.data.language,
        license: res.data.license?.name,
      }
    }

    return this.wrapUntrustedResult(
      operation || 'get_repo',
      payload,
      Date.now() - start,
      res.status,
    )
  }
}

export const githubAdapter = new GitHubAdapter()
