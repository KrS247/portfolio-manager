import { z } from 'zod';
import { call } from '../api.js';

export function registerSprintTools(server) {

  server.tool(
    'list_sprints',
    'List all sprints with their status, dates, and associated project',
    {
      status: z.enum(['planned', 'active', 'completed']).optional().describe('Filter by sprint status'),
    },
    async ({ status }, { apiKey }) => {
      const params = status ? { status } : {};
      const data = await call(apiKey, 'get', '/sprints', params);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_sprint_board',
    'Get the full Agile board for a sprint — all tasks grouped by phase (Backlog, In Progress, Review, Done, etc.)',
    {
      sprint_id:  z.number().describe('The sprint ID'),
      project_id: z.number().describe('The project ID the sprint belongs to'),
    },
    async ({ sprint_id, project_id }, { apiKey }) => {
      // Fetch tasks for the project filtered by sprint
      const tasks = await call(apiKey, 'get', '/tasks', {
        parent_type: 'project',
        parent_id:   project_id,
        sprint_id,
      });
      // Fetch phase definitions for grouping context
      const phases = await call(apiKey, 'get', '/agile-phases');

      const board = {
        sprint_id,
        project_id,
        phases: phases.map(p => ({
          ...p,
          tasks: (Array.isArray(tasks) ? tasks : tasks.data || [])
            .filter(t => t.agile_phase_id === p.id),
        })),
        unassigned: (Array.isArray(tasks) ? tasks : tasks.data || [])
          .filter(t => !t.agile_phase_id),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(board, null, 2) }],
      };
    }
  );

  server.tool(
    'create_sprint',
    'Create a new sprint',
    {
      name:       z.string().describe('Sprint name, e.g. "Sprint 3 — June 2026"'),
      start_date: z.string().describe('ISO date YYYY-MM-DD'),
      end_date:   z.string().describe('ISO date YYYY-MM-DD'),
      goal:       z.string().optional().describe('Sprint goal statement'),
    },
    async (payload, { apiKey }) => {
      const data = await call(apiKey, 'post', '/sprints', {
        ...payload,
        status: 'planned',
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'update_sprint_status',
    'Change the status of a sprint: planned → active → completed',
    {
      sprint_id: z.number().describe('The sprint ID'),
      status:    z.enum(['planned', 'active', 'completed']).describe('New status'),
    },
    async ({ sprint_id, status }, { apiKey }) => {
      const data = await call(apiKey, 'put', `/sprints/${sprint_id}`, { status });
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
