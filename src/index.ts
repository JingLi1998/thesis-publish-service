import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import { google } from "googleapis";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: "https://www.googleapis.com/auth/drive",
});

// const drive = google.drive({
//   version: "v3",
//   auth: process.env.GOOGLE_API_KEY,
// });

// drive.about.get();

console.log(url);

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
