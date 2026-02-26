import { z } from 'zod';
import { insertIdeaSchema, ideas, setCategorySchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  ideas: {
    list: {
      method: 'GET' as const,
      path: '/api/idea',
      input: z.object({
        sort: z.enum(['date', 'rating']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof ideas.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/ideas',
      input: insertIdeaSchema,
      responses: {
        201: z.custom<typeof ideas.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    evaluate: {
      method: 'GET' as const,
      path: '/api/ideas/evaluate',
      responses: {
        200: z.array(z.custom<typeof ideas.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    vote: {
      method: 'POST' as const,
      path: '/api/ideas/:id/vote',
      responses: {
        200: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    // Admin only
    setCategory: {
      method: 'PATCH' as const,
      path: '/api/ideas/:id/category',
      input: setCategorySchema,
      responses: {
        200: z.custom<typeof ideas.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/ideas/:id',
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  settings: {
    get: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: z.custom<Settings>(),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/settings',
      input: updateSettingsSchema,
      responses: {
        200: z.custom<Settings>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
};

import { Settings, updateSettingsSchema } from './schema';


export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
