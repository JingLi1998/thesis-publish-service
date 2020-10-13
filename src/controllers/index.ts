import { Controller, Get, Post } from "@overnightjs/core";
import { Request, Response } from "express";

@Controller("/stock_units")
export class StockUnitController {
  @Get(":id")
  private get(_req: Request, res: Response) {
    return res.status(200).json({ msg: "get stock unit" });
  }

  @Get("")
  private getAll(_req: Request, res: Response) {
    return res.status(200).json({
      message: "get_all_called",
    });
  }
}
