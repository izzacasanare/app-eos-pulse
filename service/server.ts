/**
 * EOS Pulse — Router
 *
 * This file is a THIN ROUTER ONLY.
 * It registers handlers and returns route definitions.
 *
 * Rules:
 *  - Import only from handlers/
 *  - No domain logic here
 *  - No direct db or schema imports
 *  - No business rules
 */

import type { Hono } from "hono";
import { meetingsHandler } from "./handlers/meetings.handler.ts";
import { issuesHandler } from "./handlers/issues.handler.ts";
import { rocksHandler } from "./handlers/rocks.handler.ts";
import { todosHandler } from "./handlers/todos.handler.ts";
import { usersHandler } from "./handlers/users.handler.ts";
import { settingsHandler } from "./handlers/settings.handler.ts";
import { checkinsHandler } from "./handlers/checkins.handler.ts";
import { headlinesHandler } from "./handlers/headlines.handler.ts";

export default (_app: Hono) => {
  return {
    ...meetingsHandler,
    ...issuesHandler,
    ...rocksHandler,
    ...todosHandler,
    ...usersHandler,
    ...settingsHandler,
    ...checkinsHandler,
    ...headlinesHandler,
  };
};
