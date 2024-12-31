import { AutoRouter } from "itty-router";

const router = AutoRouter({ base: "/api" });

const mockBill = {
  id: "123",
  items: [
    {
      name: "test",
      amount: 42,
    },
  ],
  total: 42,
};

router.post("/v1/scan", async (/*request*/) => {
  // const formData = await request.formData();
  // const file = formData.get("file");

  return Response.json(mockBill);
});

router.get("/v1/bill/:id", async (/*request, env*/) => {
  // const id = request.params.id;

  return Response.json(mockBill);
});

// Fallback to static assets
// See: https://developers.cloudflare.com/workers/static-assets/
router.all("*", async (request, env) => env.ASSETS.fetch(request.url));

export default router;
