import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import { google } from "googleapis";

dotenv.config();

const drive = google.drive({
  version: "v3",
  auth: process.env.GOOGLE_API_KEY,
});

drive.about.get();

const app = express();

app.get(`/`, (_req, res) => res.send(`Express + Typescript Server`));

app.get(`/watch`, async (_req, res) => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/${process.env.GOOGLE_SHEET_ID}`
    );
    res.send(response);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

app.listen(process.env.PORT || 8000, () => {
  console.log(
    `[server]: Server is running at http://localhost:${
      process.env.PORT || 8000
    }`
  );
});
