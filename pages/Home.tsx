import { useState, useEffect, useRef } from "react";
import { $fetch, $ws, $sse } from "@mspbots/fetch";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Label,
  ScrollArea,
} from "@mspbots/ui";
import {
  Rocket,
  Sparkles,
  Send,
  User,
  Shield,
  Database,
  Code2,
  ArrowRight,
} from "lucide-react";

export const meta = {
  label: "Home",
  icon: "Home",
  order: 1,
  menu: true,
};

interface RequestDemo {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: string;
  query?: string;
}

export function Home() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [wsMessages, setWsMessages] = useState<{ sent: string; received: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const access = useAccess();
  const tokenPayload = access.tokenPayload as { id?: string; name?: string; email?: string; role?: string } | null;
  const user = tokenPayload || undefined;
  const roles = access.roles;

  const makeRequest = async (demo: RequestDemo) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const url = demo.query ? `${demo.url}?${demo.query}` : demo.url;
      const options: RequestInit = {
        method: demo.method,
        headers: { "Content-Type": "application/json" },
      };
      if (demo.body) options.body = demo.body;
      const response = await $fetch(url, options);

      let responseData;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      setData(responseData);
      return responseData;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) wsRef.current.close();
    setWsStatus("connecting");
    const wsUrl = `/ws/demo?userId=${user?.id || "anonymous"}&t=${Date.now()}`;
    const ws = $ws(wsUrl);
    ws.onopen = () => setWsStatus("connected");
    ws.onmessage = (event) => {
      setWsMessages((prev) => [...prev, { sent: "", received: event.data }]);
    };
    ws.onclose = () => setWsStatus("disconnected");
    wsRef.current = ws;
  };

  const sendWsMessage = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg = `Hello at ${new Date().toISOString()}`;
      wsRef.current.send(msg);
      setWsMessages((prev) => [...prev, { sent: msg, received: "" }]);
    }
  };

  const disconnectWs = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus("disconnected");
  };

  useEffect(() => () => wsRef.current?.close(), []);

  const renderRequestCard = (demo: RequestDemo, description?: string) => (
    <Card key={demo.name} className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{demo.name}</CardTitle>
          <Badge variant="outline">{demo.method}</Badge>
        </div>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded bg-muted p-2 text-xs font-mono break-all">
          <span className="text-blue-500">{demo.method}</span> <span className="text-green-600">{demo.url}</span>
          {demo.query && <span className="text-gray-500">?{demo.query}</span>}
        </div>
        {demo.body && (
          <div className="rounded bg-muted p-2 text-xs font-mono text-orange-600 whitespace-pre-wrap break-all">
            {JSON.stringify(JSON.parse(demo.body), null, 2)}
          </div>
        )}
        <Button onClick={() => makeRequest(demo)} disabled={loading} className="w-full" size="sm">
          <Send className="mr-2 h-4 w-4" />
          Send Request
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">API Examples</h1>
          <p className="text-muted-foreground">Comprehensive API call demonstrations with input/output</p>
        </div>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Rocket className="h-4 w-4" />
        <AlertDescription>
          This page demonstrates all API calling patterns. See <code className="rounded bg-muted px-1 py-0.5">server.ts</code> for implementations.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="gap-2"><User className="h-4 w-4" />User Info</TabsTrigger>
              <TabsTrigger value="params" className="gap-2"><Code2 className="h-4 w-4" />Parameters</TabsTrigger>
              <TabsTrigger value="restful" className="gap-2"><Database className="h-4 w-4" />RESTful</TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2"><Shield className="h-4 w-4" />Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current User Context</CardTitle>
                  <CardDescription>From access token payload and roles</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <Label className="text-xs text-muted-foreground">User Info (tokenPayload)</Label>
                      <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">{JSON.stringify(user, null, 2)}</pre>
                    </div>
                    <div className="rounded-lg border p-4">
                      <Label className="text-xs text-muted-foreground">Roles</Label>
                      <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">{JSON.stringify(roles, null, 2)}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {renderRequestCard({ name: "Hello World", method: "GET", url: "/api/hello" })}
                {renderRequestCard({ name: "User Info", method: "GET", url: "/api/user-info", query: "demo=true" })}
              </div>
            </TabsContent>

            <TabsContent value="params" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle>Route Mapping - Parameter Types</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="mb-3 font-medium">Query Parameters</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({
                        name: "Query Demo",
                        method: "GET",
                        url: "/api/query-demo",
                        query: "page=1&pageSize=10&search=test&sort=name&order=desc",
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-medium">Path Parameters</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({ name: "Single Path", method: "GET", url: "/api/path-demo/123" })}
                      {renderRequestCard({ name: "Nested Path", method: "GET", url: "/api/nested-path/tenant1/users/user456" })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-medium">Request Body (POST)</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({
                        name: "Body Demo",
                        method: "POST",
                        url: "/api/body-demo",
                        body: JSON.stringify({ name: "Test Item", value: 42, tags: ["demo", "test"] }),
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-medium">Headers</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({ name: "Headers Demo", method: "GET", url: "/api/headers-demo" })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-medium">Mixed (Path + Query + Body)</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({
                        name: "Mixed Demo",
                        method: "POST",
                        url: "/api/mixed-demo/999",
                        query: "flag=true&active=1",
                        body: JSON.stringify({ extra: "data", timestamp: new Date().toISOString() }),
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Hono Native Routes</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="mb-3 font-medium">Query Parameters</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({ name: "Hono Query", method: "GET", url: "/api/hono/query", query: "page=3&pageSize=50" })}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 font-medium">Path Parameters</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({ name: "Hono Path", method: "GET", url: "/api/hono/path/abc123" })}
                      {renderRequestCard({ name: "Hono Nested", method: "GET", url: "/api/hono/nested/tenantA/users/userB" })}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 font-medium">Request Body</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({
                        name: "Hono Body",
                        method: "POST",
                        url: "/api/hono/body",
                        body: JSON.stringify({ message: "Hello Hono", data: { key: "value" } }),
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 font-medium">Mixed</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({
                        name: "Hono Mixed",
                        method: "POST",
                        url: "/api/hono/mixed/xyz",
                        query: "active=1",
                        body: JSON.stringify({ submitted: true, items: [1, 2, 3] }),
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="restful" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle>RESTful CRUD Operations</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="mb-3 font-medium">Read</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({ name: "List All", method: "GET", url: "/api/restful" })}
                      {renderRequestCard({ name: "Get One", method: "GET", url: "/api/restful/42" })}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 font-medium">Create</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({
                        name: "Create",
                        method: "POST",
                        url: "/api/restful",
                        body: JSON.stringify({ name: "New Item", value: 100, description: "A new resource" }),
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 font-medium">Update</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({
                        name: "Full Update (PUT)",
                        method: "PUT",
                        url: "/api/restful/42",
                        body: JSON.stringify({ name: "Updated Name", value: 200, description: "Fully replaced" }),
                      })}
                      {renderRequestCard({
                        name: "Partial Update (PATCH)",
                        method: "PATCH",
                        url: "/api/restful/42",
                        body: JSON.stringify({ partial: true, updatedAt: new Date().toISOString() }),
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 font-medium">Delete</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRequestCard({ name: "Delete", method: "DELETE", url: "/api/restful/42" })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle>Permissions & Roles</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Badge variant={roles?.includes("admin") ? "default" : "secondary"}>admin</Badge>
                    <Badge variant={roles?.includes("user") ? "default" : "secondary"}>user</Badge>
                    <Badge variant={roles?.includes("guest") ? "default" : "secondary"}>guest</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {renderRequestCard({ name: "Permissions Demo", method: "GET", url: "/api/permissions-demo" })}
                    {renderRequestCard({ name: "Admin Only", method: "GET", url: "/api/admin-only" })}
                    {renderRequestCard({
                      name: "Echo",
                      method: "POST",
                      url: "/api/echo",
                      body: JSON.stringify({ echo: "test", timestamp: Date.now() }),
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>WebSocket</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={connectWebSocket} disabled={wsStatus !== "disconnected"}>Connect</Button>
                    <Button onClick={sendWsMessage} disabled={wsStatus !== "connected"}>Send</Button>
                    <Button onClick={disconnectWs} disabled={wsStatus === "disconnected"}>Disconnect</Button>
                    <Badge variant={wsStatus === "connected" ? "default" : "secondary"}>{wsStatus}</Badge>
                  </div>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-4 text-xs">
                    {wsMessages.length ? JSON.stringify(wsMessages, null, 2) : "No messages"}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>SSE (Server-Sent Events)</CardTitle></CardHeader>
                <CardContent>
                  <SSEPreview />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <Card className="h-[calc(100vh-8rem)] flex flex-col shadow-lg border-primary/20">
              <CardHeader className="bg-muted/50 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Response
                </CardTitle>
                <CardDescription>
                  {error ? "Request failed" : loading ? "Sending request..." : data ? "Request successful" : "Ready"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4 w-full">
                  {error ? (
                    <div className="text-red-500 font-mono text-sm break-all whitespace-pre-wrap">{error}</div>
                  ) : loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
                      Processing...
                    </div>
                  ) : data ? (
                    <pre className="font-mono text-xs overflow-auto w-full whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
                      <Send className="h-8 w-8 mb-2 opacity-50" />
                      <p>Select an API example on the left to see the response here</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SSEPreview() {
  const [messages, setMessages] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    eventSourceRef.current = $sse("/sse/demo-stream");
    eventSourceRef.current.onmessage = (event) => {
      setMessages((prev) => [...prev.slice(-9), event.data]);
    };
    return () => eventSourceRef.current?.close();
  }, []);

  return (
    <div className="space-y-2">
      <pre className="max-h-40 overflow-auto rounded-md bg-muted p-4 text-xs">
        {messages.length ? messages.join("\n") : "Connecting to SSE..."}
      </pre>
    </div>
  );
}

export default Home;
