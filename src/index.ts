import dotenv from "dotenv";
import express from "express";
import { google } from "googleapis";
import "reflect-metadata";
import { createConnection } from "typeorm";
import { ApiToken } from "./entities/ApiToken";
import fs from "fs";
import {
  SPREADSHEET_ID,
  TIMESTAMP_FILE_PATH,
  TIMESTAMP_INTERVAL,
} from "./constants";
import { getCurrentTimestamp, getPreviousTimestamp } from "./utils";
import { Channel } from "./entities/Channel";

const main = async () => {
  dotenv.config();

  // create database connection
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

  // set up oauth2client
  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    `https://www.trackntrace.network`
  );

  // automatically save updated tokens to database
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

  // set tokens to client
  const apiToken = await ApiToken.findOne(1);
  oauth2Client.setCredentials({
    access_token: apiToken?.accessToken,
    refresh_token: apiToken?.refreshToken,
  });

  // create google drive instance
  const drive = google.drive({
    version: "v3",
    auth: oauth2Client,
  });

  // create google sheets instance
  const sheets = google.sheets({
    version: "v4",
    auth: oauth2Client,
  });

  try {
    const channel = await Channel.findOneOrFail(1);
    await drive.channels.stop({
      requestBody: {
        id: "3",
        resourceId: channel?.resourceId,
      },
    });
    console.log(`[channel] Channel stopped successfully`);
    const response = await drive.files.watch({
      fileId: SPREADSHEET_ID,
      requestBody: {
        type: "web_hook",
        id: "3",
        resourceId: "RFID Sheet",
        address: "https://www.trackntrace.network/publish/notifications",
      },
    });
    console.log(response);
    channel.resourceId = response.data.resourceId!;
    channel.expiration = response.data.expiration!;
    await channel.save();
  } catch (error) {
    console.log(error);
    console.error("[drive] Notification channel already exists");
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive"],
  });

  const getSheetData = async () => {
    // console.info(`[interval] Starting interval`);
    // const interval = setInterval(async () => {
    // const previousTimeStamp = getPreviousTimestamp(TIMESTAMP_FILE_PATH);
    // const currentTimestamp = getCurrentTimestamp();
    // if (currentTimestamp - previousTimeStamp > TIMESTAMP_INTERVAL) {
    // console.info(`[interval] Clearing interval`);
    // clearInterval(interval);
    setTimeout(async () => {
      const spreadsheet = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1",
      });
      const rows = spreadsheet.data.values;
      console.log(`ID, Timestamp, Latitude, Longitude, Temperature, Humidity`);
      rows?.slice(1).map((row) => {
        console.log(
          `${row[0]}, ${row[1]}, ${row[2]}, ${row[3]}, ${row[4]}, ${row[5]}`
        );
      });
      // }
    }, 10000);
  };

  const app = express();

  app.get(`/publish`, async (req, res) => {
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
        console.log(`[server] Tokens updated in database`);
      } else {
        console.log(`[server] Something went wrong`);
      }
    }
    res.send("Hello World");
  });

  app.get(`/publish/auth`, (_req, res) => res.redirect(url));

  app.get(`/publish/sheets`, async (_req, res) => {
    const currentTimestamp = getCurrentTimestamp();
    const prevTimestamp = getPreviousTimestamp(TIMESTAMP_FILE_PATH);
    if (currentTimestamp - prevTimestamp > TIMESTAMP_INTERVAL) {
      console.log(
        `[timestamp] More than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
      );
      getSheetData();
    } else {
      console.log(
        `[timestamp] Less than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
      );
    }
    fs.writeFileSync(TIMESTAMP_FILE_PATH, currentTimestamp.toString());
    return res.sendStatus(200);
  });

  app.post(`/publish/notifications`, (_req, res) => {
    console.log("[notification] Received Notification");
    const currentTimestamp = getCurrentTimestamp();
    const prevTimestamp = getPreviousTimestamp(TIMESTAMP_FILE_PATH);
    if (currentTimestamp - prevTimestamp > TIMESTAMP_INTERVAL) {
      console.log(
        `[timestamp] More than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
      );
      getSheetData();
    } else {
      console.log(
        `[timestamp] Less than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
      );
    }
    fs.writeFileSync(TIMESTAMP_FILE_PATH, currentTimestamp.toString());
    return res.sendStatus(200);
    res.send("Received");
  });

  app.listen(process.env.PORT || 8000, () => {
    console.log(
      `[server] Server is running on Port ${process.env.PORT || 8000}`
    );
  });
};

main().catch((error) => console.error(error));
