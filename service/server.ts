import type { HandlerParams } from "@mspbots/type";
import type { Hono } from "hono";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}

interface Resource {
  id: string;
  name: string;
  value: number;
}

const routes = {
  "GET /api/hello"(params: HandlerParams) {
    return {
      params,
      message: "Hello World!",
      timestamp: new Date().toISOString(),
    };
  },

  "GET /api/user-info"(params: HandlerParams) {
    return {
      params,
      appId: params.id,
      appName: params.name,
      userId: params.user?.["id"] || "anonymous",
      queryParams: params.query,
    };
  },

  "GET /api/query-demo"(params: HandlerParams) {
    const { page, pageSize, search, sort, order } = params.query;
    return {
      params,
      message: "Query parameters received",
      queryValues: { page, pageSize, search, sort, order },
    };
  },

  "GET /api/path-demo/:id"(params: HandlerParams) {
    return {
      params,
      message: "Path parameter received",
      id: params.params.id,
    };
  },

  "GET /api/nested-path/:tenantId/users/:userId"(params: HandlerParams) {
    return {
      params,
      message: "Nested path parameters",
      tenantId: params.params.tenantId,
      userId: params.params.userId,
    };
  },

  "POST /api/body-demo"(params: HandlerParams) {
    return {
      params,
      message: "Body data received",
      data: params.body,
      contentType: params.headers["content-type"],
    };
  },

  "POST /api/mixed-demo/:id"(params: HandlerParams) {
    return {
      params,
      message: "Path, query, and body combined",
      pathId: params.params.id,
      query: params.query,
      body: params.body,
    };
  },

  "GET /api/headers-demo"(params: HandlerParams) {
    return {
      params,
      message: "Headers received",
      extractedHeaders: {
        "x-request-id": params.headers["x-request-id"],
        "x-forwarded-for": params.headers["x-forwarded-for"],
        "authorization": params.headers["authorization"] ? "[PRESENT]" : "[MISSING]",
      },
    };
  },

  "GET /api/restful"(params: HandlerParams) {
    const items: Resource[] = [
      { id: "1", name: "Resource 1", value: 100 },
      { id: "2", name: "Resource 2", value: 200 },
    ];
    return { params, items, total: items.length };
  },

  "GET /api/restful/:id"(params: HandlerParams) {
    return {
      params,
      id: params.params.id,
      name: `Resource ${params.params.id}`,
      value: Math.floor(Math.random() * 1000),
    };
  },

  "POST /api/restful"(params: HandlerParams) {
    const body = params.body as { name?: string; value?: number };
    return {
      params,
      id: Math.random().toString(36).substring(2, 9),
      name: body.name || "New Resource",
      value: body.value || 0,
    };
  },

  "PUT /api/restful/:id"(params: HandlerParams) {
    const body = params.body as { name?: string; value?: number };
    return {
      params,
      id: params.params.id,
      name: body.name || `Updated Resource ${params.params.id}`,
      value: body.value || 0,
    };
  },

  "PATCH /api/restful/:id"(params: HandlerParams) {
    return {
      params,
      id: params.params.id,
      patched: true,
      data: params.body,
    };
  },

  "DELETE /api/restful/:id"(params: HandlerParams) {
    return {
      params,
      id: params.params.id,
      deleted: true,
    };
  },

  "GET /api/permissions-demo"(params: HandlerParams) {
    return {
      params,
      message: "Permission check demo",
      user: params.user,
    };
  },

  "GET /api/admin-only"(params: HandlerParams) {
    const user = params.user as User | undefined;
    if (!user || user.role !== "admin") {
      return { params, error: "Forbidden", message: "Admin access required" };
    }
    return {
      params,
      message: "Admin secret data",
      adminOnly: true,
    };
  },

  "POST /api/echo"(params: HandlerParams) {
    return {
      params,
      message: "Echo API - Returns the data you sent",
      receivedData: params.body,
      dataType: typeof params.body,
      timestamp: new Date().toISOString(),
    };
  },
};

export default (app: Hono) => {
  app.get("/api/hello-app", (c) => {
    return c.json({
      params: {
        query: c.req.query(),
        param: c.req.param(),
      },
      message: "Hello from Hono native route!",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/hono/query", (c) => {
    const page = c.req.query("page");
    const pageSize = c.req.query("pageSize");
    const search = c.req.query("search");
    return c.json({
      params: {
        query: c.req.query(),
        param: c.req.param(),
      },
      message: "Query params via Hono",
      extractedParams: { page, pageSize, search },
    });
  });

  app.get("/api/hono/path/:id", (c) => {
    const id = c.req.param("id");
    return c.json({
      params: {
        query: c.req.query(),
        param: c.req.param(),
      },
      message: "Path param via Hono",
      id,
    });
  });

  app.post("/api/hono/body", async (c) => {
    const body = await c.req.json();
    return c.json({
      params: {
        query: c.req.query(),
        param: c.req.param(),
        body,
      },
      message: "Body via Hono",
      data: body,
    });
  });

  app.post("/api/hono/mixed/:id", async (c) => {
    const id = c.req.param("id");
    const query = c.req.query();
    const body = await c.req.json();
    return c.json({
      params: {
        query,
        param: { id },
        body,
      },
      message: "Path, query, body via Hono",
      path: { id },
      query,
      body,
    });
  });

  app.get("/api/hono/headers", (c) => {
    const auth = c.req.header("authorization");
    const requestId = c.req.header("x-request-id");
    return c.json({
      params: {
        query: c.req.query(),
        param: c.req.param(),
        headers: c.req.header(),
      },
      message: "Headers via Hono",
      extractedHeaders: { authorization: auth ? "[PRESENT]" : "[MISSING]", "x-request-id": requestId },
    });
  });

  app.get("/api/hono/nested/:tenantId/users/:userId", (c) => {
    const { tenantId, userId } = c.req.param();
    return c.json({
      params: {
        query: c.req.query(),
        param: c.req.param(),
      },
      message: "Nested path via Hono",
      tenantId,
      userId,
    });
  });

  app.get("/sse/demo-stream", (c) => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"message":"hello"}\n\n'));
        const interval = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(`data: {"time":"${new Date().toISOString()}"}\n\n`));
        }, 1000);
        c.req.raw.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  app.get("/ws/demo", (c) => {
    const queryParams = c.req.query();
    console.log("WebSocket connected. Params:", queryParams);
    const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
    socket.onopen = () => {
      console.log("WebSocket connected");
    };
    socket.onmessage = (event) => {
      socket.send(JSON.stringify({ type: "response", data: "echo: " + event.data, queryParams }));
    };
    socket.onclose = () => {
      console.log("WebSocket closed");
    };
    return response;
  });

  return routes;
};
