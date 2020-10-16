import createHttpError from "http-errors";
import { In } from "typeorm";
import { getCurrentTimestamp, validateInput } from "../utils";
import {
  AssetUnit,
  Batch,
  BatchUnit,
  BatchStatus,
  Location,
  LogisticUnit,
  StockUnit,
  TransportUnit,
  Transaction,
  Logistic,
  Transport,
  LogisticStatus,
  TransportStatus,
} from "../../../database/src/entities/supply-chain";

export const createStockUnit = async (gtin_serial_number: string) => {
  const existingStockUnit = await StockUnit.findOne(gtin_serial_number);
  if (existingStockUnit) {
    throw createHttpError(400, `Stock unit already exists`);
  }
  return await StockUnit.create({ gtin_serial_number }).save();
};

export const createBatchUnit = async (gtin_batch_number: string) => {
  const existingBatchUnit = await BatchUnit.findOne(gtin_batch_number);
  if (existingBatchUnit) {
    throw createHttpError(400, `Batch unit already exists`);
  }
  return await BatchUnit.create({ gtin_batch_number }).save();
};

export const createLogisticUnit = async (sscc: string) => {
  const existingLogisticUnit = await LogisticUnit.findOne(sscc);
  if (existingLogisticUnit) {
    throw createHttpError(400, `Logistic unit already exists`);
  }
  return await LogisticUnit.create({ sscc }).save();
};

export const createAssetUnit = async (grai: string) => {
  const existingAssetUnit = await AssetUnit.findOne(grai);
  if (existingAssetUnit) {
    throw createHttpError(400, `Asset unit already exists`);
  }
  return await AssetUnit.create({ grai }).save();
};

export const createTransportUnit = async (giai: string) => {
  const existingTransportUnit = await TransportUnit.findOne(giai);
  if (existingTransportUnit) {
    throw createHttpError(400, `Transport unit already exists`);
  }
  return await TransportUnit.create({ giai }).save();
};

export const createLocation = async (gln: string) => {
  const existingLocation = await Location.findOne(gln);
  if (existingLocation) {
    throw createHttpError(400, `Location already exists`);
  }
  return await Location.create({ gln }).save();
};

export const aggregateBatch = async (
  gtin_batch_number: string,
  gtin_serial_numbers: string[]
) => {
  // validate input
  const isValid = validateInput([gtin_batch_number, gtin_serial_numbers]);
  if (!isValid) {
    throw createHttpError(400, "Invalid input");
  }

  // confirm batch doesn't exist
  const existing_batch = await Batch.createQueryBuilder("batch")
    .leftJoinAndSelect("batch.batch_unit", "batch_unit")
    .where("batch_unit.gtin_batch_number = :gtin_batch_number", {
      gtin_batch_number,
    })
    .getOne();
  if (existing_batch) {
    throw createHttpError(400, `Batch already exists`);
  }

  // find entities
  const batch_unit_query = BatchUnit.findOne(gtin_batch_number);
  const stock_units_query = StockUnit.find({
    where: { gtin_serial_number: In(gtin_serial_numbers) },
  });
  const [batch_unit, stock_units] = await Promise.all([
    batch_unit_query,
    stock_units_query,
  ]).catch((error) => {
    console.log(error);
    throw createHttpError(500, "Query Error");
  });
  if (!batch_unit || stock_units.length !== gtin_serial_numbers.length) {
    throw createHttpError(400, "Unable to find requested entities");
  }

  // aggregate
  return await Batch.create({
    batch_unit,
    stock_units,
    aggregation_date: getCurrentTimestamp(),
  }).save();
};

export const aggregateLogistic = async (
  sscc: string,
  gtin_batch_numbers: string[],
  grai: string
) => {
  // validate input
  const isValid = validateInput([sscc, gtin_batch_numbers, grai]);
  if (!isValid) {
    createHttpError(400, "Invalid Input");
  }

  // confirm logistic doesn't exist
  const existing_logistic = await Logistic.createQueryBuilder("logistic")
    .leftJoinAndSelect("logistic.logistic_unit", "logistic_unit")
    .where("logistic_unit.sscc = :sscc", { sscc })
    .getOne();
  if (existing_logistic) {
    throw createHttpError(400, `Logistic already exists`);
  }

  // find entities
  const logistic_unit_query = LogisticUnit.findOne(sscc);
  const asset_unit_query = AssetUnit.findOne(grai);
  const batch_units_query = BatchUnit.find({
    where: { gtin_batch_number: In(gtin_batch_numbers) },
  });
  const [logistic_unit, asset_unit, batch_units] = await Promise.all([
    logistic_unit_query,
    asset_unit_query,
    batch_units_query,
  ]).catch((error) => {
    console.log(error);
    throw createHttpError(500, "Query Error");
  });
  if (
    !logistic_unit ||
    !asset_unit ||
    batch_units.length !== gtin_batch_numbers.length
  ) {
    throw createHttpError(400, "Unable to find requested entities");
  }

  // aggregate
  return await Logistic.create({
    logistic_unit,
    asset_unit,
    batch_units,
    aggregation_date: getCurrentTimestamp(),
  }).save();
};

export const aggregateTransport = async (
  giai: string,
  sscc_numbers: string[]
) => {
  // validate input
  const isValid = validateInput([giai, sscc_numbers]);
  if (!isValid) {
    createHttpError(400, "Invalid Input");
  }

  // confirm transport doesn't exist
  const existing_transport = await Transport.createQueryBuilder("transport")
    .leftJoinAndSelect("transport.transport_unit", "transport_unit")
    .where("transport.giai = :giai", { giai })
    .getOne();
  if (existing_transport) {
    throw createHttpError(400, `Transport already exists`);
  }

  // find entities
  const transport_unit_query = TransportUnit.findOne(giai);
  const logistic_units_query = LogisticUnit.find({
    where: { sscc: In(sscc_numbers) },
  });
  const [transport_unit, logistic_units] = await Promise.all([
    transport_unit_query,
    logistic_units_query,
  ]).catch((error) => {
    console.log(error);
    throw createHttpError(400, "Unable to find requested entities");
  });

  // aggregate
  return await Transport.create({
    transport_unit,
    logistic_units,
    aggregation_date: getCurrentTimestamp(),
  }).save();
};

export const disaggregateBatch = async (gtin_batch_number: string) => {
  // validate input
  const isValid = validateInput([gtin_batch_number]);
  if (!isValid) {
    throw createHttpError(400, "Invalid Input");
  }

  // confirm batch exists
  const batch = await Batch.createQueryBuilder("batch")
    .leftJoinAndSelect("batch.batch_unit", "batch_unit")
    .where("batch_unit.gtin_batch_number = :gtin_batch_number", {
      gtin_batch_number,
    })
    .getOne();
  if (!batch) {
    throw createHttpError(400, `Batch does not exist`);
  }

  // disaggregate
  if (batch.disaggregation_date && batch.status === BatchStatus.COMPLETE) {
    throw createHttpError(`Batch already disaggregated`);
  }
  batch.disaggregation_date = getCurrentTimestamp();
  batch.status = BatchStatus.COMPLETE;
  return await batch.save();
};

export const disaggregateLogistic = async (sscc: string) => {
  // validate input
  const isValid = validateInput([sscc]);
  if (!isValid) {
    throw createHttpError(400, "Invalid Input");
  }

  // confirm logistic exists
  const logistic = await Logistic.createQueryBuilder("logistic")
    .leftJoinAndSelect("logistic.logistic_unit", "logistic_unit")
    .where("logistic_unit.sscc = :sscc", { sscc })
    .getOne();
  if (!logistic) {
    throw createHttpError(400, `Logistic does not exist`);
  }

  // disaggregate
  if (
    logistic.disaggregation_date &&
    logistic.status === LogisticStatus.COMPLETE
  ) {
    throw createHttpError(`Logistic already disaggregated`);
  }
  logistic.disaggregation_date = getCurrentTimestamp();
  logistic.status = LogisticStatus.COMPLETE;
  return await logistic.save();
};

export const disaggregateTransport = async (giai: string) => {
  // validate input
  const isValid = validateInput([giai]);
  if (!isValid) {
    throw createHttpError(400, "Invalid Input");
  }

  // confirm transport exists
  const transport = await Transport.createQueryBuilder("transport")
    .leftJoinAndSelect("transport.transport_unit", "transport_unit")
    .where("transport.giai = :giai", { giai })
    .getOne();
  if (!transport) {
    throw createHttpError(400, `Transport does not exist`);
  }

  // disaggregate
  if (
    transport.disaggregation_date &&
    transport.status === TransportStatus.COMPLETE
  ) {
    throw createHttpError(`Transport already disaggregated`);
  }
  transport.disaggregation_date = getCurrentTimestamp();
  transport.status = TransportStatus.COMPLETE;
  return await transport.save();
};

export type TransactionFields = {
  who: string;
  where: string;
  when: number;
  why: string;
  what_stock?: string[];
  what_batch?: string[];
  what_logistic?: string[];
  what_transport?: string[];
};

export const createTransaction = async (
  transaction_data: TransactionFields
) => {
  const isValid =
    validateInput([
      transaction_data.who,
      transaction_data.where,
      transaction_data.when,
      transaction_data.why,
    ]) ||
    transaction_data.what_stock ||
    transaction_data.what_batch ||
    transaction_data.what_logistic ||
    transaction_data.what_transport;
  if (!isValid) {
    throw createHttpError(400, "Invalid Input");
  }

  // confirm transaction doesn't exist
  const existing_transaction = await Transaction.createQueryBuilder(
    "transaction"
  )
    .where({
      why: transaction_data.why,
      when: transaction_data.when,
    })
    .leftJoinAndSelect("transaction.who", "who", "who.gln = :gln", {
      gln: transaction_data.who,
    })
    .leftJoinAndSelect("transaction.where", "where", "where.gln = :gln", {
      gln: transaction_data.where,
    })
    .leftJoinAndSelect(
      "transaction.what_stock",
      "what_stock",
      "what_stock.gtin_serial_number IN (:gtin_serial_numbers)",
      { gtin_serial_numbers: transaction_data.what_stock || [] }
    )
    .leftJoinAndSelect(
      "transaction.what_batch",
      "what_batch",
      "what_batch.gtin_batch_number IN (:gtin_batch_numbers)",
      { gtin_batch_numbers: transaction_data.what_batch || [] }
    )
    .leftJoinAndSelect(
      "transaction.what_logistic",
      "what_logistic",
      "what_logistic.sscc IN (:ssccs)",
      { ssccs: transaction_data.what_logistic || [] }
    )
    .leftJoinAndSelect(
      "transaction.what_transport",
      "what_transport",
      "what_transport.giai IN (:giais)",
      { giais: transaction_data.what_transport || [] }
    )
    .getOne();
  if (existing_transaction) {
    throw createHttpError(400, "Transaction already exists");
  }

  // find entities
  const who_query = Location.findOne(transaction_data.who);
  const where_query = Location.findOne(transaction_data.where);
  const what_stock_query = StockUnit.find({
    where: { gtin_serial_number: In(transaction_data.what_stock || [""]) },
  });
  const [who, where, what_stock] = await Promise.all([
    who_query,
    where_query,
    what_stock_query,
  ]);
  const what_batch_query = BatchUnit.find({
    where: { gtin_batch_number: In(transaction_data.what_batch || [""]) },
  });
  const what_logistic_query = LogisticUnit.find({
    where: { sscc: In(transaction_data.what_logistic || [""]) },
  });
  const what_transport_query = TransportUnit.find({
    where: { giai: In([""]) },
  });
  const [what_batch, what_logistic, what_transport] = await Promise.all([
    what_batch_query,
    what_logistic_query,
    what_transport_query,
  ]);
  if (
    !who ||
    !where ||
    (!what_stock.length &&
      !what_batch.length &&
      what_logistic!.length &&
      !what_transport!.length)
  ) {
    throw createHttpError(400, "Unable to find requested entities");
  }

  // create transaction
  const transaction = await Transaction.create({
    who,
    where,
    when: transaction_data.when,
    why: transaction_data.why,
    what_stock: what_stock || [],
    what_batch: what_batch || [],
    what_logistic: what_logistic || [],
    what_transport: what_transport || [],
  }).save();
  console.log(transaction);
  return transaction;
};
