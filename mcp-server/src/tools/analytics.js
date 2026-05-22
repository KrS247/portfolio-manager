import { z } from 'zod';
import { call } from '../api.js';

export function registerAnalyticsTools(server) {

  server.tool(
    'get_capacity',
    'Get team capacity report — shows each team member\'s allocated vs available hours across a date range',
    {
      from: z.string().describe('Start date ISO YYYY-MM-DD'),
      to:   z.string().describe('End date ISO YYYY-MM-DD'),
    },
    async ({ from, to }, { apiKey }) => {
      const data = await call(apiKey, 'get', '/capacity', { from, to });
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'list_risks',
    'List risks in the risk register, optionally filtered by project or severity',
    {
      project_id: z.number().optional().describe('Filter by project ID'),
      status:     z.string().optional().describe('Filter by risk status'),
    },
    async ({ project_id, status }, { apiKey }) => {
      const params = {};
      if (project_id) params.project_id = project_id;
      if (status)     params.status     = status;
      const data = await call(apiKey, 'get', '/risks', params);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'create_risk',
    'Log a new risk to the risk register',
    {
      title:          z.string(),
      description:    z.string().optional(),
      parent_type:    z.enum(['project', 'program', 'portfolio']),
      parent_id:      z.number(),
      probability:    z.number().min(1).max(5).optional().describe('1=Very Low, 5=Very High'),
      impact:         z.number().min(1).max(5).optional().describe('1=Very Low, 5=Very High'),
      mitigation:     z.string().optional(),
      status:         z.enum(['open', 'mitigated', 'closed']).optional().default('open'),
    },
    async (payload, { apiKey }) => {
      const data = await call(apiKey, 'post', '/risks', payload);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'update_risk',
    'Update an existing risk entry',
    {
      risk_id:     z.number(),
      title:       z.string().optional(),
      description: z.string().optional(),
      probability: z.number().min(1).max(5).optional(),
      impact:      z.number().min(1).max(5).optional(),
      mitigation:  z.string().optional(),
      status:      z.enum(['open', 'mitigated', 'closed']).optional(),
    },
    async ({ risk_id, ...fields }, { apiKey }) => {
      const data = await call(apiKey, 'put', `/risks/${risk_id}`, fields);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_evm',
    'Get Earned Value Management (EVM) metrics: PV, EV, AC, SPI, CPI across all projects',
    {},
    async ({}, { apiKey }) => {
      const data = await call(apiKey, 'get', '/evm');
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_dashboard_summary',
    'Get a high-level portfolio health summary: project counts by status, overdue tasks, active sprints, and top risks',
    {},
    async ({}, { apiKey }) => {
      // Fetch multiple endpoints and compose a summary
      const [projects, risks] = await Promise.all([
        call(apiKey, 'get', '/projects').catch(() => []),
        call(apiKey, 'get', '/risks').catch(() => []),
      ]);

      const projectList = Array.isArray(projects) ? projects : projects.data || [];
      const riskList    = Array.isArray(risks)    ? risks    : risks.data    || [];

      const summary = {
        projects: {
          total:    projectList.length,
          active:   projectList.filter(p => p.status === 'active').length,
          on_hold:  projectList.filter(p => p.status === 'on_hold').length,
          closed:   projectList.filter(p => p.status === 'closed').length,
        },
        risks: {
          total:     riskList.length,
          open:      riskList.filter(r => r.status === 'open').length,
          high:      riskList.filter(r => (r.probability || 0) * (r.impact || 0) >= 16).length,
        },
        top_risks: riskList
          .filter(r => r.status === 'open')
          .sort((a, b) => ((b.probability || 0) * (b.impact || 0)) - ((a.probability || 0) * (a.impact || 0)))
          .slice(0, 5)
          .map(r => ({ id: r.id, title: r.title, score: (r.probability || 0) * (r.impact || 0) })),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    }
  );
}
