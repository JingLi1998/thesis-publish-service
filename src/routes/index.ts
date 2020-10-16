import { Router } from "express";
import * as controller from "../controllers";
import { asyncMiddleware } from "../middleware/asyncMiddleware";
import createHttpError from "http-errors";
import { Transaction } from "../../../database/src/entities/supply-chain";

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
