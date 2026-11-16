import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { batchSchema } from '../src/model.js';
await writeFile(
  '../data/batch.schema.json',
  JSON.stringify(z.toJSONSchema(batchSchema), null, 2) + '\n',
);
