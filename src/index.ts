import dotenv from "dotenv";
import express from "express";
// import axios from "axios";
import { google } from "googleapis";
import "reflect-metadata";
import { createConnection } from "typeorm";
import { ApiToken } from "./entities/ApiToken";

const main = async () => {
  dotenv.config();

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    `https://www.trackntrace.network`
  );

  await createConnection({
    type: "postgres",
    url: process.env.ELEPHANT_URL,
    synchronize: true,
    logging: true,
    entities: ["dist/entities/**/*.js"],
    cli: {
      entitiesDir: "src/entities",
    },
  });

  const apiToken = await ApiToken.findOne(1);

  oauth2Client.on("tokens", async (tokens) => {
    const apiToken = await ApiToken.findOne(1);
    if (tokens.refresh_token) {
      console.log(`[refresh token]: ${tokens.refresh_token}`);
      apiToken!.refreshToken = tokens.refresh_token;
    }
    if (tokens.access_token) {
      console.log(`[access token]: ${tokens.access_token}`);
      apiToken!.accessToken = tokens.access_token;
    }
    await apiToken?.save();
  });

  oauth2Client.setCredentials({
    access_token: apiToken?.accessToken,
    refresh_token: apiToken?.refreshToken,
  });

  const drive = google.drive({
    version: "v3",
    auth: oauth2Client,
  });

  const files = await drive.files.list();

  const sheet = files.data.files?.filter(
    (e) => e.name === "RFID Data Sheet"
  )[0];

  try {
    await drive.files.watch({
      fileId: sheet!.id!,
      requestBody: {
        // kind: "api#channel",
        type: "web_hook",
        id: "1",
        address: "https://www.trackntrace.network/notifications",
      },
    });
  } catch (error) {
    console.log(error.response);
    console.log(error.response.data.error);
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/drive",
  });

  const app = express();

  app.get(`/`, async (req, res) => {
    if (req.query.code !== undefined) {
      const { tokens } = await oauth2Client.getToken(req.query.code as string);
      if (tokens.access_token && tokens.refresh_token) {
        console.log(`[access token]: ${tokens.access_token}`);
        console.log(`[refresh token]: ${tokens.refresh_token}`);
        const apiToken = await ApiToken.findOne(1);
        if (apiToken !== undefined) {
          apiToken.accessToken = tokens.access_token;
          apiToken.refreshToken = tokens.refresh_token;
          await apiToken.save();
        } else {
          await ApiToken.create({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          }).save();
        }
        console.log(`[server]: Tokens updated in database`);
      } else {
        console.log(`[server]: Something went wrong`);
      }
    }
    res.send("Hello World");
  });

  app.get(`/auth`, (_req, res) => res.redirect(url));

  // app.get(`/watch`, async (_req, res) => {
  //   try {
  //     const response = await axios.get(
  //       `https://www.googleapis.com/drive/v3/${process.env.GOOGLE_SHEET_ID}`
  //     );
  //     res.send(response);
  //   } catch (error) {
  //     console.log(error);
  //     res.send(error);
  //   }
  // });

  app.post(`/notifications`, (_req, res) => {
    console.log(res);
  });

  app.listen(process.env.PORT || 8000, () => {
    console.log(
      `[server]: Server is running on Port ${process.env.PORT || 8000}`
    );
  });
};

main().catch((error) => console.log(error));
