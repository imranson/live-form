// Vercel serves the built client from dist/client and rewrites /api/* to this function (see vercel.json).
import { bootstrap } from '../server/bootstrap.js';

export default bootstrap();
