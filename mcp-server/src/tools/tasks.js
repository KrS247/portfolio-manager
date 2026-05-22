import { z } from 'zod';
import { call } from '../api.js';

export function registerTaskTools(server) {

  server.tool(
    'list_tasks',
    'List tasks for a project, program, or portfolio. Filter by sprint, status, or assignee.',
    {
      parent_type: z.enum(['project', 'program', 'portfolio']).describe('The type of parent entity'),
      parent_id:   z.number().describe('The ID of the parent entity'),
      sprint_id:   z.number().optional().describe('Filter by sprint ID'),
      status:      z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
    },
    async ({ parent_type, parent_id, sprint_id, status }, { apiKey }) => {
      const params = { parent_type, parent_id };
      if (sprint_id) params.sprint_id = sprint_id;
      if (status)    params.status    = status;
      const data = await call(apiKey, 'get', '/tasks', params);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_task',
    'Get full details of a single task including resources, dependencies, and comments',
    {
      task_id: z.number().describe('The task ID'),
    },
    async ({ task_id }, { apiKey }) => {
      const data = await call(apiKey, 'get', `/tasks/${task_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'create_task',
    'Create a new task under a project, program, or portfolio',
    {
      title:            z.string().describe('Task title'),
      parent_type:      z.enum(['project', 'program', 'portfolio']),
      parent_id:        z.number(),
      description:      z.string().optional(),
      priority:         z.number().min(1).max(10).optional().default(5),
      status:           z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional().default('open'),
      start_date:       z.string().optional().describe('ISO date string YYYY-MM-DD'),
      due_date:         z.string().optional().describe('ISO date string YYYY-MM-DD'),
      sprint_id:        z.number().optional(),
      agile_phase_id:   z.number().optional(),
      task_type:        z.enum(['feature', 'bug_fix']).optional(),
      estimated_hours:  z.number().min(1).max(80).optional(),
      assigned_to:      z.number().optional().describe('User ID to assign'),
    },
    async (payload, { apiKey }) => {
      const data = await call(apiKey, 'post', '/tasks', payload);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'update_task',
    'Update fields on an existing task. Only include fields you want to change.',
    {
      task_id:          z.number().describe('The task ID to update'),
      title:            z.string().optional(),
      description:      z.string().optional(),
      priority:         z.number().min(1).max(10).optional(),
      status:           z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
      start_date:       z.string().optional(),
      due_date:         z.string().optional(),
      sprint_id:        z.number().nullable().optional().describe('Set null to remove from sprint'),
      agile_phase_id:   z.number().optional(),
      task_type:        z.enum(['feature', 'bug_fix']).optional(),
      estimated_hours:  z.number().min(1).max(80).optional(),
      actual_hours:     z.number().min(0).optional(),
      percent_complete: z.number().min(0).max(100).optional(),
      assigned_to:      z.number().nullable().optional(),
    },
    async ({ task_id, ...fields }, { apiKey }) => {
      const data = await call(apiKey, 'put', `/tasks/${task_id}`, fields);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'move_task_to_sprint',
    'Assign a task to a sprint (or remove it from its current sprint)',
    {
      task_id:   z.number().describe('The task ID'),
      sprint_id: z.number().nullable().describe('Sprint ID to assign, or null to unassign'),
    },
    async ({ task_id, sprint_id }, { apiKey }) => {
      const data = await call(apiKey, 'put', `/tasks/${task_id}`, { sprint_id });
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
