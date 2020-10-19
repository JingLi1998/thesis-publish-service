import { Router } from "express";
import * as controller from "../controllers";
import { asyncMiddleware } from "../middleware/asyncMiddleware";

export const router = Router();

router.post(
  "/stock-unit",
  asyncMiddleware(async (req, res) => {
    const stock_unit = await controller.createStockUnit(
      req.body.gtin_serial_number
    );
    return res.status(201).json({ stock_unit });
  })
);

router.post(
  "/asset-unit",
  asyncMiddleware(async (req, res) => {
    const asset_unit = await controller.createAssetUnit(req.body.grai);
    return res.status(201).json({ asset_unit });
  })
);

router.post(
  "/transport-unit",
  asyncMiddleware(async (req, res) => {
    const transport_unit = await controller.createTransportUnit(req.body.giai);
    return res.status(201).json({ transport_unit });
  })
);

router.post(
  "/location",
  asyncMiddleware(async (req, res) => {
    const location = await controller.createLocation(req.body.gln);
    return res.status(201).json(location);
  })
);

router.post(
  "/batch",
  asyncMiddleware(async (req, res) => {
    const batch = await controller.aggregateBatch(
      req.body.gtin_batch_number,
      req.body.gtin_serial_numbers
    );
    return res.status(201).json({ batch });
  })
);

router.put(
  "/batch",
  asyncMiddleware(async (req, res) => {
    const batch = await controller.disaggregateBatch(
      req.body.gtin_batch_number
    );
    return res.status(200).json({ batch });
  })
);

router.post(
  "/logistic",
  asyncMiddleware(async (req, res) => {
    const logistic = await controller.aggregateLogistic(
      req.body.sscc,
      req.body.gtin_batch_numbers,
      req.body.grai
    );
    return res.status(201).json({ logistic });
  })
);

router.put(
  "/logistic",
  asyncMiddleware(async (req, res) => {
    const logistic = await controller.disaggregateLogistic(req.body.sscc);
    return res.status(200).json({ logistic });
  })
);

router.post(
  "/transport",
  asyncMiddleware(async (req, res) => {
    const transport = await controller.aggregateTransport(
      req.body.id,
      req.body.sscc_numbers,
      req.body.giai
    );
    return res.status(201).json({ transport });
  })
);

router.put(
  "/transport",
  asyncMiddleware(async (req, res) => {
    const transport = await controller.disaggregateTransport(req.body.id);
    return res.status(200).json({ transport });
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
