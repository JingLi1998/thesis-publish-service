import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { google } from "googleapis";
import { HttpError } from "http-errors";
import "reflect-metadata";
import { createConnection } from "typeorm";
import { ApiToken, Channel } from "../../database/src/entities/google";
import { SPREADSHEET_ID } from "./constants";
import { handleNotification } from "./controllers";
import { asyncMiddleware } from "./middleware/asyncMiddleware";
import { router } from "./routes";
import { getCurrentTimestamp } from "./utils";
import morgan from "morgan";

const main = async () => {
  dotenv.config();

  // create database connection
  await createConnection({
    type: "postgres",
    url: process.env.ELEPHANT_URL,
    synchronize: true,
    // logging: true,
    entities: ["dist/database/src/entities/**/*.js"],
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

  (async function createChannel() {
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
          address: "https://www.trackntrace.network/api/notifications",
          expiration: (getCurrentTimestamp() * 1000 + 86400000).toString(),
        },
      });
      channel.resourceId = response.data.resourceId!;
      channel.expiration = response.data.expiration!;
      await channel.save();
    } catch (error) {
      console.log(error);
      console.error("[drive] Notification channel already exists");
    }
    setTimeout(createChannel, 86400000);
  })();

  // REFRESH URL
  // const url = oauth2Client.generateAuthUrl({
  //   access_type: "offline",
  //   scope: ["https://www.googleapis.com/auth/drive"],
  // });

  const app = express();

  // log http requests
  app.use(morgan("dev"));

  // json body parser
  app.use(express.json());

  app.use("/api", router);

  app.post(
    `/notifications`,
    asyncMiddleware(async (_req, res) => {
      await handleNotification(sheets);
      return res.status(200).json({ message: "OK" });
    })
  );

  // custom error handler
  app.use(
    (error: HttpError, _req: Request, res: Response, _next: NextFunction) => {
      res.status(error.status || 500);
      res.json({
        status: error.status || 500,
        message: error.message,
      });
    }
  );

  app.listen(process.env.PORT || 8000, () => {
    console.log(
      `[server] Server is running on Port ${process.env.PORT || 8000}`
    );
  });
};

main().catch((error) => console.error(error));
