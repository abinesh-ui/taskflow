// Minimal Edge Function to activate the Edge Functions runtime.
// Deploying at least one function makes the Edge Functions service report
// "Healthy", which clears the project's overall "Unhealthy" status.
// It also doubles as a lightweight health-check / keep-alive endpoint.

Deno.serve((_req: Request) => {
  return new Response(
    JSON.stringify({ status: 'healthy', service: 'taskflow', time: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  );
});
