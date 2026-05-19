import {
  type Folder,
  FolderCreateSchema,
  type FolderId,
  FolderIdSchema,
  FolderPatchSchema,
  type Project,
} from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { HttpError } from '../middleware/error-envelope.js';

export function registerFolderRoutes(app: FastifyInstance): void {
  // GET /api/folders
  app.get('/api/folders', async (_req, reply) => {
    const index = app.indexer.getIndex();
    const folders = [...index.folders.values()].sort((a, b) => a.sort_order - b.sort_order);
    return reply.send({ folders, count: folders.length });
  });

  // GET /api/folders/:id
  app.get('/api/folders/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = FolderIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid folder id.');
    }
    const index = app.indexer.getIndex();
    const folder = index.folders.get(idParsed.data);
    if (!folder) {
      throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found.');
    }
    return reply.send(folder);
  });

  // POST /api/folders
  app.post('/api/folders', async (req, reply) => {
    const body = FolderCreateSchema.parse(req.body);

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const newFolder = await app.indexer.withWriteLock(async (index, ops) => {
      const now = new Date().toISOString();

      let sortOrder = body.sort_order;
      if (sortOrder === undefined) {
        const maxOrder = [...index.folders.values()].reduce((max, f) => Math.max(max, f.sort_order), 0);
        sortOrder = maxOrder + 1024;
      }

      const folder: Folder = {
        id: FolderIdSchema.parse(ulid()),
        schema_version: 1,
        name: body.name,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
      };

      await ops.writeFolder(folder);
      app.broker.publish({ type: 'folder.created', payload: { id: folder.id, folder }, tabId });

      return folder;
    });

    return reply.code(201).send(newFolder);
  });

  // PATCH /api/folders/:id
  app.patch('/api/folders/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = FolderIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid folder id.');
    }
    const patch = FolderPatchSchema.parse(req.body);

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const updated = await app.indexer.withWriteLock(async (index, ops) => {
      const source = index.folders.get(idParsed.data);
      if (!source) {
        throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found.');
      }

      const now = new Date().toISOString();
      const folder: Folder = {
        id: source.id,
        schema_version: source.schema_version,
        name: patch.name ?? source.name,
        sort_order: patch.sort_order ?? source.sort_order,
        created_at: source.created_at,
        updated_at: now,
      };

      await ops.writeFolder(folder);
      app.broker.publish({ type: 'folder.changed', payload: { id: folder.id, folder }, tabId });

      return folder;
    });

    return reply.send(updated);
  });

  // DELETE /api/folders/:id — cascade: move projects to folder_id: null
  app.delete('/api/folders/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = FolderIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid folder id.');
    }
    const folderId = idParsed.data;

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const result = await app.indexer.withWriteLock(async (index, ops) => {
      const folder = index.folders.get(folderId);
      if (!folder) {
        throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found.');
      }

      // Find all projects in this folder
      const affectedProjects = [...index.projects.values()].filter((p) => p.folder_id === folderId);

      const now = new Date().toISOString();

      // Move each project to folder_id: null
      for (const project of affectedProjects) {
        const updated: Project = { ...project, folder_id: null, updated_at: now };
        await ops.writeProject(updated);
        app.broker.publish({ type: 'project.changed', payload: { id: updated.id, project: updated }, tabId });
      }

      // Delete the folder
      await ops.removeFolder(folderId as FolderId);
      app.broker.publish({ type: 'folder.deleted', payload: { id: folderId }, tabId });

      return {
        deleted_folder_id: folderId,
        projects_moved: affectedProjects.length,
      };
    });

    return reply.send(result);
  });
}
