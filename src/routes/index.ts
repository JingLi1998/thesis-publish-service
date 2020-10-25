import { Router } from "express";
import * as controller from "../controllers";
import { asyncMiddleware } from "../middleware/asyncMiddleware";

export const router = Router();

router.post(
  "/product",
  asyncMiddleware(async (req, res) => {
    const product = await controller.createProduct(
      req.body.name,
      req.body.size
    );
    return res.status(201).json({ product });
  })
);

router.post(
  "/asset-unit",
  asyncMiddleware(async (req, res) => {
    const asset_unit = await controller.createAssetUnit(req.body.asset_type);
    return res.status(201).json({ asset_unit });
  })
);

router.post(
  "/transport-unit",
  asyncMiddleware(async (req, res) => {
    const transport_unit = await controller.createTransportUnit(
      req.body.brand,
      req.body.model
    );
    return res.status(201).json({ transport_unit });
  })
);

router.post(
  "/location",
  asyncMiddleware(async (req, res) => {
    const location = await controller.createLocation(
      req.body.name,
      req.body.latitude,
      req.body.longitude
    );
    return res.status(201).json(location);
  })
);

router.post(
  "/stock-unit",
  asyncMiddleware(async (req, res) => {
    const { stock_unit, transaction } = await controller.createStockUnit(
      req.body.product_gtin,
      req.body.transaction_data
    );
    return res.status(201).json({ stock_unit, transaction });
  })
);

router.post(
  "/batch",
  asyncMiddleware(async (req, res) => {
    const { batch, transaction } = await controller.aggregateBatch(
      req.body.gtin_serial_numbers,
      req.body.transaction_data
    );
    return res.status(201).json({ batch, transaction });
  })
);

router.put(
  "/batch",
  asyncMiddleware(async (req, res) => {
    const { batch, transaction } = await controller.disaggregateBatch(
      req.body.gtin_batch_number,
      req.body.transaction_data
    );
    return res.status(200).json({ batch, transaction });
  })
);

router.post(
  "/logistic",
  asyncMiddleware(async (req, res) => {
    const { logistic, transaction } = await controller.aggregateLogistic(
      req.body.gtin_batch_numbers,
      req.body.grai,
      req.body.transaction_data
    );
    return res.status(201).json({ logistic, transaction });
  })
);

router.put(
  "/logistic",
  asyncMiddleware(async (req, res) => {
    const { logistic, transaction } = await controller.disaggregateLogistic(
      req.body.sscc,
      req.body.transaction_data
    );
    return res.status(200).json({ logistic, transaction });
  })
);

router.post(
  "/transport",
  asyncMiddleware(async (req, res) => {
    const { transport, transaction } = await controller.aggregateTransport(
      req.body.sscc_numbers,
      req.body.giai,
      req.body.transaction_data
    );
    return res.status(201).json({ transport, transaction });
  })
);

router.put(
  "/transport",
  asyncMiddleware(async (req, res) => {
    const { transport, transaction } = await controller.disaggregateTransport(
      req.body.id,
      req.body.transaction_data
    );
    return res.status(200).json({ transport, transaction });
  })
);

router.post(
  "/transaction",
  asyncMiddleware(async (req, res) => {
    await controller.createTransaction(req.body.transaction_data);
    return res.status(201).json({ message: "OK" });
  })
);

router.post(
  "/resource-policy",
  asyncMiddleware(async (req, res) => {
    const resource_policy = await controller.createResourcePolicy(
      req.body.resource_id,
      req.body.resource_type,
      req.body.permission,
      req.body.user_email
    );
    return res.status(201).json({ resource_policy });
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
