/**
 * MSW handlers for API mocking
 */
import { rest } from 'msw';

export const handlers = [
  // Files API handlers
  rest.post('/api/v1/files/', async (req, res, ctx) => {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;

    if (!file || !category) {
      return res(ctx.status(400), ctx.json({ detail: 'File and category are required' }));
    }

    return res(ctx.status(201), ctx.json({
      id: 'file-123',
      name: file.name,
      category,
      size_bytes: file.size,
      sha256: 'abc123',
      created_at: new Date().toISOString(),
    }));
  }),

  rest.get('/api/v1/files/', (req, res, ctx) => {
    return res(ctx.json({
      items: [
        {
          id: 'file-1',
          name: 'test.py',
          category: 'TEST_CASE',
          size_bytes: 1024,
          sha256: 'hash1',
          created_at: new Date().toISOString(),
        },
      ],
      total: 1,
      skip: 0,
      limit: 100,
    }));
  }),

  // Add more handlers as needed...
];
