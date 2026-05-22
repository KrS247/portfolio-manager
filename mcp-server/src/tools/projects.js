import { z } from 'zod';
import { call } from '../api.js';

export function registerProjectTools(server) {

  server.tool(
    'list_portfolios',
    'List all portfolios in the system',
    {},
    async ({ }, { apiKey }) => {
      const data = await call(apiKey, 'get', '/portfolios');
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'list_programs',
    'List programs, optionally filtered by portfolio',
    {
      portfolio_id: z.number().optional().describe('Filter by portfolio ID'),
    },
    async ({ portfolio_id }, { apiKey }) => {
      const params = portfolio_id ? { portfolio_id } : {};
      const data = await call(apiKey, 'get', '/programs', params);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'list_projects',
    'List all projects with their status, priority, and agile flag. Use this to discover project IDs.',
    {
      program_id: z.number().optional().describe('Filter by program ID'),
      status:     z.enum(['active', 'on_hold', 'closed']).optional().describe('Filter by status'),
    },
    async ({ program_id, status }, { apiKey }) => {
      const params = {};
      if (program_id) params.program_id = program_id;
      if (status)     params.status     = status;
      const data = await call(apiKey, 'get', '/projects', params);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_project',
    'Get full details of a single project including task counts and team members',
    {
      project_id: z.number().describe('The project ID'),
    },
    async ({ project_id }, { apiKey }) => {
      const data = await call(apiKey, 'get', `/projects/${project_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
