import express from "express";

const app = express();
const PORT = 8000;

app.get("/", (_req, res) => res.send("Express + Typescript Server"));

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});
