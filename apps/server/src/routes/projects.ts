import {
  type FolderId,
  INBOX_PROJECT_ID,
  type Project,
  ProjectCreateSchema,
  ProjectIdSchema,
  ProjectPatchSchema,
} from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { HttpError } from '../middleware/error-envelope.js';

export function registerProjectRoutes(app: FastifyInstance): void {
  // GET /api/projects
  app.get('/api/projects', async (_req, reply) => {
    const index = app.indexer.getIndex();
    const projects = [...index.projects.values()];

    // Sort: Inbox first, then by sort_order ascending
    projects.sort((a, b) => {
      if (a.id === INBOX_PROJECT_ID) return -1;
      if (b.id === INBOX_PROJECT_ID) return 1;
      return a.sort_order - b.sort_order;
    });

    return reply.send({ projects, count: projects.length });
  });

  // GET /api/projects/:id
  app.get('/api/projects/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    // Accept both valid ULIDs and the special Inbox sentinel
    const rawId = String(params.id ?? '');
    const index = app.indexer.getIndex();
    // Find project by string comparison (handles Inbox sentinel too)
    const project = [...index.projects.values()].find((p) => p.id === rawId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }
    return reply.send(project);
  });

  // POST /api/projects
  app.post('/api/projects', async (req, reply) => {
    const body = ProjectCreateSchema.parse(req.body);

    // Reject is_inbox: true in body
    const rawBody = req.body as Record<string, unknown>;
    if (rawBody.is_inbox === true) {
      throw new HttpError(400, 'VALIDATION', 'Cannot create a project with is_inbox: true.');
    }

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const newProject = await app.indexer.withWriteLock(async (index, ops) => {
      // Validate folder_id exists if non-null
      if (body.folder_id !== null && body.folder_id !== undefined) {
        if (!index.folders.has(body.folder_id as FolderId)) {
          throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found.');
        }
      }

      const now = new Date().toISOString();

      // Default sort_order
      let sortOrder = body.sort_order;
      if (sortOrder === undefined) {
        const maxOrder = [...index.projects.values()].reduce((max, p) => Math.max(max, p.sort_order), 0);
        sortOrder = maxOrder + 1024;
      }

      const project: Project = {
        id: ProjectIdSchema.parse(ulid()),
        schema_version: 1,
        name: body.name,
        folder_id: body.folder_id ?? null,
        is_hierarchical: body.is_hierarchical ?? false,
        color: body.color ?? null,
        icon: body.icon ?? null,
        sort_order: sortOrder,
        is_inbox: false,
        created_at: now,
        updated_at: now,
      };

      await ops.writeProject(project);
      app.broker.publish({ type: 'project.created', payload: { id: project.id, project }, tabId });

      return project;
    });

    return reply.code(201).send(newProject);
  });

  // PATCH /api/projects/:id
  app.patch('/api/projects/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const rawId = String(params.id ?? '');
    const patch = ProjectPatchSchema.parse(req.body);

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const updated = await app.indexer.withWriteLock(async (index, ops) => {
      // Find project by string id (handles Inbox sentinel)
      const source = [...index.projects.values()].find((p) => p.id === rawId);
      if (!source) {
        throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
      }

      // Reject modifications to Inbox
      if (source.id === INBOX_PROJECT_ID) {
        throw new HttpError(409, 'INBOX_IMMUTABLE', 'Inbox cannot be modified.');
      }

      // Validate folder_id exists if non-null
      if (patch.folder_id !== undefined && patch.folder_id !== null) {
        if (!index.folders.has(patch.folder_id as FolderId)) {
          throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found.');
        }
      }

      const now = new Date().toISOString();
      const project: Project = {
        id: source.id,
        schema_version: source.schema_version,
        name: patch.name ?? source.name,
        folder_id: patch.folder_id !== undefined ? patch.folder_id : source.folder_id,
        is_hierarchical: patch.is_hierarchical ?? source.is_hierarchical,
        color: patch.color !== undefined ? patch.color : source.color,
        icon: patch.icon !== undefined ? patch.icon : source.icon,
        sort_order: patch.sort_order ?? source.sort_order,
        is_inbox: source.is_inbox,
        created_at: source.created_at,
        updated_at: now,
      };

      await ops.writeProject(project);
      app.broker.publish({ type: 'project.changed', payload: { id: project.id, project }, tabId });

      return project;
    });

    return reply.send(updated);
  });

  // DELETE /api/projects/:id — cascade soft-delete all items, then remove the project file
  app.delete('/api/projects/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const rawId = String(params.id ?? '');
    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const result = await app.indexer.withWriteLock(async (index, ops) => {
      const source = [...index.projects.values()].find((p) => p.id === rawId);
      if (!source) {
        throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
      }
      if (source.is_inbox) {
        throw new HttpError(409, 'INBOX_IMMUTABLE', 'Inbox cannot be deleted.');
      }

      // Enumerate all active (non-trashed) items in the project (including completed ones)
      const projectItems = [...index.items.values()].filter(
        (i) => i.project_id === source.id && i.trashed_at === null,
      );

      const trashedAt = new Date().toISOString();
      // Each item gets trashed_with: <project.id> per api.md §4.5
      // (project id is reused as the cascade key even though it's a ProjectId, not ItemId)
      for (const item of projectItems) {
        const trashed = {
          ...item,
          trashed_at: trashedAt,
          // trashed_with accepts ItemId | null; project id string used as coordination key per spec
          trashed_with: source.id as unknown as (typeof item)['trashed_with'],
          updated_at: trashedAt,
        };
        await ops.moveItemToTrash(trashed);
        app.broker.publish({ type: 'item.trashed', payload: { id: item.id, item: trashed }, tabId });
      }

      await ops.removeProject(source.id);
      app.broker.publish({ type: 'project.deleted', payload: { id: source.id }, tabId });

      return { deleted_project_id: source.id, trashed_items: projectItems.length };
    });

    return reply.send(result);
  });
}
