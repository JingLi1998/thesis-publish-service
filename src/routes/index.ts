import { Router } from "express";
import * as controller from "../controllers";
import { asyncMiddleware } from "../middleware/asyncMiddleware";
import createHttpError from "http-errors";

type Unit = "stock" | "batch" | "logistic" | "transport" | "asset" | "location";

export const router = Router();

router.post(
  "/create",
  asyncMiddleware(async (req, res) => {
    switch (req.body.type as Unit) {
      case "stock":
        await controller.createStockUnit(req.body.identifier);
        break;
      case "batch":
        await controller.createBatchUnit(req.body.identifier);
        break;
      case "logistic":
        await controller.createLogisticUnit(req.body.identifier);
        break;
      case "transport":
        await controller.createTransportUnit(req.body.identifier);
        break;
      case "asset":
        await controller.createAssetUnit(req.body.identifier);
        break;
      case "location":
        await controller.createLocation(req.body.identifier);
        break;
      default:
        throw createHttpError(400, "No unit type was provided");
    }
    return res.status(200).json({ message: "OK" });
  })
);

router.post(
  "/aggregate",
  asyncMiddleware(async (req, res) => {
    await controller.aggregateBatch(
      req.body.gtin_batch_number,
      req.body.gtin_serial_numbers
    );
    return res.status(201).json({ message: "OK" });
  })
);

router.put(
  "/disaggregate",
  asyncMiddleware(async (req, res) => {
    await controller.disaggregateBatch(req.body.gtin_batch_number);
    return res.status(201).json({ message: "OK" });
  })
);

router.post(
  "/transaction",
  asyncMiddleware(async (req, res) => {
    await controller.createTransaction(req.body.transaction_data);
    return res.status(201).json({ message: "OK" });
  })
);

// OLD ROUTES
// app.get(`/publish`, async (req, res) => {
//   if (req.query.code !== undefined) {
//     const { tokens } = await oauth2Client.getToken(req.query.code as string);
//     if (tokens.access_token && tokens.refresh_token) {
//       console.log(`[access token]: ${tokens.access_token}`);
//       console.log(`[refresh token]: ${tokens.refresh_token}`);
//       const apiToken = await ApiToken.findOne(1);
//       if (apiToken !== undefined) {
//         apiToken.accessToken = tokens.access_token;
//         apiToken.refreshToken = tokens.refresh_token;
//         await apiToken.save();
//       } else {
//         await ApiToken.create({
//           accessToken: tokens.access_token,
//           refreshToken: tokens.refresh_token,
//         }).save();
//       }
//       console.log(`[server] Tokens updated in database`);
//     } else {
//       console.log(`[server] Something went wrong`);
//     }
//   }
//   res.send("Hello World");
// });

// app.get(`/url`, (_req, res) => res.sendStatus(200).json({ url }));

// app.get(`/sheets`, async (_req, res) => {
//   const currentTimestamp = getCurrentTimestamp();
//   const prevTimestamp = getPreviousTimestamp(TIMESTAMP_FILE_PATH);
//   if (currentTimestamp - prevTimestamp > TIMESTAMP_INTERVAL) {
//     console.log(
//       `[timestamp] More than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
//     );
//     getSheetData();
//   } else {
//     console.log(
//       `[timestamp] Less than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
//     );
//   }
//   fs.writeFileSync(TIMESTAMP_FILE_PATH, currentTimestamp.toString());
//   return res.sendStatus(200);
// });
