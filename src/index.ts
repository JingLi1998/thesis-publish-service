import express from "express";

const app = express();

app.get("/", (_req, res) => res.send("Express + Typescript Server"));

app.listen(process.env.PORT || 8000, () => {
  console.log(
    `[server]: Server is running at http://localhost:${
      process.env.PORT || 8000
    }`
  );
});
