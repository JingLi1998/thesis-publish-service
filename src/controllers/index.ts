import fs from "fs";
import { sheets_v4 } from "googleapis";
import createHttpError from "http-errors";
import { In } from "typeorm";
import {
  AssetUnit,
  AssetUnitStatus,
  Batch,
  BatchStatus,
  Location,
  Logistic,
  LogisticStatus,
  Product,
  StockUnit,
  Transaction,
  Transport,
  TransportStatus,
  TransportUnit,
  TransportUnitStatus,
} from "../../../database/src/entities/supply-chain";
import {
  SPREADSHEET_ID,
  TIMESTAMP_FILE_PATH,
  TIMESTAMP_INTERVAL,
} from "../constants";
import {
  getCurrentTimestamp,
  getPreviousTimestamp,
  validateInput,
} from "../utils";

type TransactionData = {
  who: number;
  where: number;
  why: string;
};

export const handleNotification = async (sheets: sheets_v4.Sheets) => {
  console.log("[notification] Received Notification");
  const currentTimestamp = getCurrentTimestamp();
  const prevTimestamp = getPreviousTimestamp(TIMESTAMP_FILE_PATH);
  if (currentTimestamp - prevTimestamp > TIMESTAMP_INTERVAL) {
    console.log(
      `[timestamp] More than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
    );
    getSheetData(sheets);
  } else {
    console.log(
      `[timestamp] Less than ${TIMESTAMP_INTERVAL} seconds since last timestamp`
    );
  }
  fs.writeFileSync(TIMESTAMP_FILE_PATH, currentTimestamp.toString());
  return;
};

const getSheetData = async (sheets: sheets_v4.Sheets) => {
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

export const createProduct = async (name: string, size: string) => {
  return await Product.create({ name, size }).save();
};

export const createAssetUnit = async (asset_type: string) => {
  return await AssetUnit.create({ asset_type }).save();
};

export const createTransportUnit = async (brand: string, model: string) => {
  return await TransportUnit.create({ brand, model }).save();
};

export const createLocation = async (
  name: string,
  latitude: number,
  longitude: number
) => {
  return await Location.create({ name, latitude, longitude }).save();
};

export const createStockUnit = async (
  product_gtin: string,
  transaction_data: TransactionData
) => {
  const product = await Product.findOneOrFail(product_gtin);
  const stock_unit = await StockUnit.create({ product }).save();
  const who = await Location.findOneOrFail(transaction_data.who);
  const where = await Location.findOneOrFail(transaction_data.where);
  const transaction = await Transaction.create({
    who,
    where,
    what_stock: [stock_unit],
    why: transaction_data.why,
  }).save();
  return { stock_unit, transaction };
};

export const aggregateBatch = async (
  gtin_serial_numbers: number[],
  transaction_data: TransactionData
) => {
  // find entities
  const stock_units = await StockUnit.find({
    where: { gtin_serial: In(gtin_serial_numbers) },
    relations: ["batches"],
  });

  if (stock_units.length !== gtin_serial_numbers.length) {
    throw createHttpError(400, "Unable to find requested entities");
  } else if (
    stock_units.some((stock_unit) =>
      stock_unit.batches?.some(
        (batch) => batch.status === BatchStatus.IN_PROGRESS
      )
    )
  ) {
    throw createHttpError(400, "Some entities are already batched");
  }

  stock_units.forEach((stock_unit) => delete stock_unit.batches);

  // aggregate
  const batch = await Batch.create({
    stock_units,
  }).save();

  // create transaction
  const who = await Location.findOneOrFail(transaction_data.who);
  const where = await Location.findOneOrFail(transaction_data.where);
  const transaction = await Transaction.create({
    who,
    where,
    what_stock: stock_units,
    what_batch: [batch],
    why: transaction_data.why,
  }).save();
  delete transaction.what_batch[0].stock_units;
  return { batch, transaction };
};

export const aggregateLogistic = async (
  gtin_batch_numbers: string[],
  grai: string,
  transaction_data: TransactionData
) => {
  // find entities
  const asset_unit_query = AssetUnit.findOneOrFail(grai);
  const batch_query = Batch.find({
    where: { gtin_batch: In(gtin_batch_numbers) },
    relations: ["logistics"],
  });
  const [asset_unit, batches] = await Promise.all([
    asset_unit_query,
    batch_query,
  ]);
  if (!asset_unit || batches.length !== gtin_batch_numbers.length) {
    throw createHttpError(400, "Unable to find requested entities");
  } else if (
    batches.some((batch) =>
      batch.logistics?.some(
        (logistic) => logistic.status === LogisticStatus.IN_PROGRESS
      )
    )
  ) {
    throw createHttpError(400, "Some entities are already batched");
  } else if (asset_unit.status === AssetUnitStatus.UNAVAILABLE) {
    throw createHttpError(400, "Asset unit unavailable");
  }
  batches.forEach((batch) => delete batch.logistics);

  // aggregate
  asset_unit.status = AssetUnitStatus.UNAVAILABLE;
  const asset_unit_save_query = asset_unit.save();
  const logistic = Logistic.create({
    asset_unit,
    batches,
  });
  const logistic_query = logistic.save();
  await Promise.all([logistic_query, asset_unit_save_query]);

  const who = await Location.findOneOrFail(transaction_data.who);
  const where = await Location.findOneOrFail(transaction_data.where);
  const transaction = await Transaction.create({
    who,
    where,
    what_batch: batches,
    what_logistic: [logistic],
    why: transaction_data.why,
  }).save();
  delete transaction.what_logistic[0].batches;
  return { logistic, transaction };
};

export const aggregateTransport = async (
  sscc_numbers: string[],
  giai: string,
  transaction_data: TransactionData
) => {
  // find entities
  const transport_unit_query = TransportUnit.findOneOrFail(giai);
  const logistic_query = Logistic.find({
    where: { sscc: In(sscc_numbers) },
    relations: ["transports"],
  });
  const [transport_unit, logistics] = await Promise.all([
    transport_unit_query,
    logistic_query,
  ]);
  if (!transport_unit || logistics.length !== sscc_numbers.length) {
    throw createHttpError(400, "Requested entities not found");
  } else if (
    logistics.some((logistic) =>
      logistic.transports?.some(
        (transport) => transport.status === TransportStatus.IN_PROGRESS
      )
    )
  ) {
    throw createHttpError(400, "Some entities are already batched");
  } else if (transport_unit.status === TransportUnitStatus.UNAVAILABLE) {
    throw createHttpError(400, "Transport unit unavailable");
  }
  logistics.forEach((logistic) => delete logistic.transports);

  // aggregate
  transport_unit.status = TransportUnitStatus.UNAVAILABLE;
  const transport_unit_save_query = transport_unit.save();
  const transport_query = Transport.create({
    transport_unit,
    logistics,
  }).save();
  const [transport] = await Promise.all([
    transport_query,
    transport_unit_save_query,
  ]);

  const who = await Location.findOneOrFail(transaction_data.who);
  const where = await Location.findOneOrFail(transaction_data.where);
  const transaction = await Transaction.create({
    who,
    where,
    what_logistic: logistics,
    what_transport: [transport],
    why: transaction_data.why,
  }).save();
  delete transaction.what_transport[0].logistics;
  return { transport, transaction };
};

export const disaggregateBatch = async (
  gtin_batch: string,
  transaction_data: TransactionData
) => {
  // validate input
  const isValid = validateInput([gtin_batch]);
  if (!isValid) {
    throw createHttpError(400, "Invalid Input");
  }

  // confirm batch exists
  const batch = await Batch.findOne(gtin_batch, { relations: ["stock_units"] });
  if (!batch) {
    throw createHttpError(400, `Batch does not exist`);
  } else if (
    batch.disaggregation_date &&
    batch.status === BatchStatus.COMPLETE
  ) {
    throw createHttpError(`Batch already disaggregated`);
  }

  // disaggregate
  batch.disaggregation_date = new Date();
  batch.status = BatchStatus.COMPLETE;
  await batch.save();

  const who = await Location.findOneOrFail(transaction_data.who);
  const where = await Location.findOneOrFail(transaction_data.where);
  const transaction = await Transaction.create({
    who,
    where,
    what_stock: batch.stock_units,
    what_batch: [batch],
    why: transaction_data.why,
  }).save();
  delete transaction.what_batch[0].stock_units;
  return { batch, transaction };
};

export const disaggregateLogistic = async (
  sscc: string,
  transaction_data: TransactionData
) => {
  // validate input
  const isValid = validateInput([sscc]);
  if (!isValid) {
    throw createHttpError(400, "Invalid Input");
  }

  // confirm logistic exists
  const logistic = await Logistic.findOne(sscc, {
    relations: ["batches", "asset_unit"],
  });
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
  logistic.disaggregation_date = new Date();
  logistic.status = LogisticStatus.COMPLETE;
  logistic.asset_unit.status = AssetUnitStatus.AVAILABLE;
  const logistic_query = logistic.save();
  const asset_unit_query = logistic.asset_unit.save();
  await Promise.all([logistic_query, asset_unit_query]);

  const who = await Location.findOneOrFail(transaction_data.who);
  const where = await Location.findOneOrFail(transaction_data.where);
  const transaction = await Transaction.create({
    who,
    where,
    what_batch: logistic.batches,
    what_logistic: [logistic],
    why: transaction_data.why,
  }).save();
  delete transaction.what_logistic[0].batches;
  return { logistic, transaction };
};

export const disaggregateTransport = async (
  id: string,
  transaction_data: TransactionData
) => {
  // validate input
  const isValid = validateInput([id]);
  if (!isValid) {
    throw createHttpError(400, "Invalid Input");
  }

  // confirm transport exists
  const transport = await Transport.findOne(id, {
    relations: ["logistics", "transport_unit"],
  });
  if (!transport) {
    throw createHttpError(400, `Transport does not exist`);
  }

  // disaggregate;
  if (
    transport.disaggregation_date &&
    transport.status === TransportStatus.COMPLETE
  ) {
    throw createHttpError(`Transport already disaggregated`);
  }
  transport.disaggregation_date = new Date();
  transport.status = TransportStatus.COMPLETE;
  transport.transport_unit.status = TransportUnitStatus.AVAILABLE;
  const transport_query = transport.save();
  const transport_unit_query = transport.transport_unit.save();
  await Promise.all([transport_query, transport_unit_query]);

  const who = await Location.findOneOrFail(transaction_data.who);
  const where = await Location.findOneOrFail(transaction_data.where);
  const transaction = await Transaction.create({
    who,
    where,
    what_logistic: transport.logistics,
    what_transport: [transport],
    why: transaction_data.why,
  }).save();
  delete transaction.what_transport[0].logistics;
  return { transport, transaction };
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
  const what_batch_query = Batch.find({
    where: { gtin_batch_number: In(transaction_data.what_batch || [""]) },
  });
  const what_logistic_query = Logistic.find({
    where: { sscc: In(transaction_data.what_logistic || [""]) },
  });
  const what_transport_query = Transport.find({
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
  return Transaction.create({
    who,
    where,
    when: transaction_data.when,
    why: transaction_data.why,
    what_stock: what_stock || [],
    what_batch: what_batch || [],
    what_logistic: what_logistic || [],
    what_transport: what_transport || [],
  }).save();
};
